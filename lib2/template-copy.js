'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const HTML = require('./html');
const Parser = require('@liqd-js/parser');
const TemplateParser = new Parser( __dirname + '/template.syntax' );

const Q = JSON.stringify;

module.exports = class Template
{
    #templates = new Map();

    constructor()
    {
        //console.log( 'template' );
    }

    parse( filename )
    {
        //console.log( 'Parsing', filename );

        let data = require('fs').readFileSync( filename, 'utf8' );

        let source = TemplateParser.parse( data, 
        {
            $_script: ( source, attributes ) =>
            {
                console.log( 'SCRIPT', { source, attributes });
            },
            $_node_space: ( space ) =>
            {
                let source = `
                    $$_html.push( ${Q( space )} );
                `;

                return source;
            },
            $_node_text: ( text ) =>
            {
                /*let source = `
                    {
                        let $$_node= new $$_HTML();
                        
                        {
                            let $$_html = $$_node;

                            if( true )
                            {
                                let t = new Promise( r => setTimeout(() => r(${Q( text )}), 1));
                                //let t = new Promise( r => r(${Q( text )}));
                                $$_html.push( t );
                            }
                            else{ $$_html.push( ${Q( text )} ); }
                        }

                        $$_html.push( $$_node.render() );
                    }
                `;*/

                let source = `
                    $$_html.push( ${Q( text )} );
                `;

                return source;
            },
            $_node_comment: ( comment ) =>
            {
                return `
                        $$_html.push( \`<!--${comment}-->\` );
                    `;
            },
            $_node_html_declaration: ( tag, attributes ) =>
            {
                let source = '';

                if( attributes.find( a => a.expression && a.expression.includes( 'await' ) ))
                {
                    source = `
                        $$_html.push( new Promise( async( resolve, reject ) =>
                        {
                            try
                            {
                                let attributes = await Promise.all([
                                    ${attributes.map( a => 
                                    a.hasOwnProperty('spread')
                                        ? `\`\${(()=>{ let p = ${a.spread}, attr = ''; for( let name of Object.keys( p )${a.filter}){ attr += ' ' + name + '=' + JSON.stringify( p[name].toString() ) } return attr; })()}\`` 
                                        : a.hasOwnProperty('expression') 
                                            ? `new Promise( async( resolve, reject ) => { try{ let v = ${a.expression}; resolve( v !== undefined ? ' ${a.name}' + ( v !== null ? '=' + JSON.stringify(v.toString()) : '' ) : ''); }catch(e){ reject(e) }})`
                                            : ( a.hasOwnProperty('value')
                                                ? '` ' + a.name + '=' + JSON.stringify( a.value ) + '`'
                                                : '` ' + a.name + '`')
                                    ).join(',\n')}
                                ]);

                                resolve( \`<!${tag}\${attributes.join('')}>\` );
                            }
                            catch(e){ reject( e )}
                        }));
                    `;

                    //console.log( source );
                }
                else if( attributes.length )
                {
                    source = `
                        $$_html.push( \`<!${tag}${ attributes.map( a => 
                            a.hasOwnProperty('spread')
                                ? `\${(()=>{ let p = ${a.spread}, attr = ''; for( let name of Object.keys( p )${a.filter}){ attr += ' ' + name + '=' + JSON.stringify( p[name].toString() ) } return attr; })()}` 
                                : a.hasOwnProperty('expression') 
                                    ? `\${(()=>{ let v = ${a.expression};
                                        return v !== undefined ? ' ${a.name}' + ( v !== null ? '=' + JSON.stringify(v.toString()) : '' ) : '' })()}`
                                    : ( a.hasOwnProperty('value')
                                        ? ' ' + a.name + '=' + JSON.stringify( a.value )
                                        : ' ' + a.name)
                    ).join('')}>\`);`;
                }
                else
                {
                    source = `
                        $$_html.push( '<!${tag}>' );
                    `;
                }

                return source;
            },
            $_node_html: ( tag, attributes, children ) =>
            {
                //console.log( attributes );

                let source = '';

                if( attributes.find( a => a.expression && a.expression.includes( 'await' ) ))
                {
                    source = `
                        $$_html.push( new Promise( async( resolve, reject ) =>
                        {
                            try
                            {
                                let attributes = await Promise.all([
                                    ${attributes.map( a => 
                                    a.hasOwnProperty('spread')
                                        ? `\`\${(()=>{ let p = ${a.spread}, attr = ''; for( let name of Object.keys( p )${a.filter}){ attr += ' ' + name + '=' + JSON.stringify( p[name].toString() ) } return attr; })()}\`` 
                                        : a.hasOwnProperty('expression') 
                                            ? `new Promise( async( resolve, reject ) => { try{ let v = ${a.expression}; resolve( v !== undefined ? ' ${a.name}' + ( v !== null ? '=' + JSON.stringify(v.toString()) : '' ) : ''); }catch(e){ reject(e) }})`
                                            : ( a.hasOwnProperty('value')
                                                ? '` ' + a.name + '=' + JSON.stringify( a.value ) + '`'
                                                : '` ' + a.name + '`')
                                    ).join(',\n')}
                                ]);

                                resolve( \`<${tag}\${attributes.join('')}>\` );
                            }
                            catch(e){ reject( e )}
                        }));
                    `;

                    //console.log( source );
                }
                else if( attributes.length )
                {
                    source = `
                        $$_html.push( \`<${tag}${ attributes.map( a => 
                            a.hasOwnProperty('spread')
                                ? `\${(()=>{ let p = ${a.spread}, attr = ''; for( let name of Object.keys( p )${a.filter}){ attr += ' ' + name + '=' + JSON.stringify( p[name].toString() ) } return attr; })()}` 
                                : a.hasOwnProperty('expression') 
                                    ? `\${(()=>{ let v = ${a.expression};
                                        return v !== undefined ? ' ${a.name}' + ( v !== null ? '=' + JSON.stringify(v.toString()) : '' ) : '' })()}`
                                    : ( a.hasOwnProperty('value')
                                        ? ' ' + a.name + '=' + JSON.stringify( a.value )
                                        : ' ' + a.name)
                    ).join('')}>\`);`;
                }
                else
                {
                    source = `
                        $$_html.push( '<${tag}>' );
                    `;
                }

                source += `
                    ${ children ? children : '' }

                    $$_html.push( '</${tag}>' );
                `;

                return source;
                //console.log({ tag, attributes, children });
                //return `$_nodes.push( });`;
            },
            $_node_template: ( name, attributes, children ) =>
            {
                return `
                    $$_html.push( $_template( "${name}", {}, "" ));
                `
            },
            $_expression: ( expression, escaped ) =>
            {
                return expression;
            },
            $_node_expression: ( expression ) =>
            {
                if( expression.includes('await') )
                {
                    return `
                        $$_html.push( new Promise( async( resolve, reject ) =>
                        {
                            try
                            {
                                resolve(
                                    ${expression}
                                );
                            }
                            catch(e){ reject( e )}
                        }));
                    `;
                }
                else
                {
                    return `
                        $$_html.push(
                            ${expression}
                        );
                    `;
                }
            }
        });

        //console.log( source, '--------' );

        return new Function( '$args', 'const [ $id, $locale, $content, $props, $scope, $_template, $$_HTML ] = $args; var $$_html = new $$_HTML(); ' + source + '; return $$_html.render();' );
    }

    get( name )
    {
        let template = this.#templates.get( name );

        if( !template )
        {
            this.#templates.set( name, template = this.parse( __dirname + '/../test/templates/' + name + '.template' ));
        }

        return template;
    }

    render( name, props = {}, scope = {}, locale = 'en', content = '' )
    {
        let template = this.get( name );

        return template([ Math.ceil( Math.random() * 1000 ), locale, content, props, scope, ( name, props, content ) => this.render( name, props, scope, locale, content ), HTML ]);

        return html;
    }

    async renderHTML( name, props = {}, scope = {}, locale )
    {
        
    }
}