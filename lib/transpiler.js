'use strict';

const Style = require('@liqd-js/style');

let style_iterator = 0;

module.exports = class Transpiler
{
    #code = 'let $$_html = [];\n\n'; #async = false; #html_source = '';

    constructor( template )
    {
        this._nodes( template.nodes );
    }

    _code( code, _async = false )
    {
        this._flush_html_source( _async );
        this.#code += code;
    }

    _is_javascript_async( nodes )
    {
        for( let node of nodes )
        {
            if( node.hasOwnProperty( 'source' ))
            {
                if( node.source.includes( 'await' )){ return true }
            }
            else if( node.hasOwnProperty( 'blocks' ))
            {
                if( this._is_javascript_async( node.blocks )){ return true }
            }
        }

        return false;
    }

    _nodes( nodes )
    {
        if( nodes )
        for( let node of nodes )
        {
            let type = Object.keys( node )[0];

            //console.log({ type });

            this['_'+type]( node[type] );
        }
    }

    _async_render( code )
    {
        this._code(
        [
            `$$_html.push(( async() =>`
        ,   `{`
        ,       ...( Array.isArray( code ) ? code : [ code ]).map( c => '    ' + c )
        ,   `})());\n`
        ]
        .join('\n'), true );
    }

    _async_code( nodes )
    {
        this._flush_html_source( true );
        
        this.#code += 
        [
            `$$_html.push(( async() =>`
        ,   `{`
        ,       new Transpiler({ nodes: nodes }).code()
        ,   `})());\n`
        ]
        .join('\n');
    }

    _flush_html_source( _async = false )
    {
        if( this.#html_source )
        {
            this.#code += '$$_html.push( `' + this.#html_source + '` );\n';

            this.#html_source = '';
        }

        _async && ( this.#async = true );
    }

    _whitespace( whitespace )
    {
        this.#html_source += whitespace.includes('\n') ? '\n' : whitespace;
    }

    _expression( expression )
    {
        if( expression.code.includes( 'await' ))
        {
            this._async_render( `return ${expression.code.trim()};` );
        }
        else
        {
            this.#html_source += `\${ ${expression.code.trim()} }`;
        }
    }

    _source( source )
    {
        this._flush_html_source();

        this.#code += source;
    }

    _blocks( blocks )
    {
        this._code( '{\n' )
        this._nodes( blocks );
        this._code( '}\n' )
    }
    
    _text( text )
    {
        this.#html_source += text;
    }

    _comment(){}

    _filter( filter )
    {
        if( !filter ){ return '' }
        
        let matches = { positive: [], negative: []};

        for( let wildcard of filter.wildcards.trim().split( /\s*,\s*/ ))
        {
            matches[ wildcard.startsWith('!') ? 'negative' : 'positive' ].push( '/^' + wildcard.replace(/^!/,'').replace(/\*/g,'.*') + '$/.test( name )' );
        }

        return '.filter(([ name, value ]) => ' + ( matches.negative.length ? '!( ' + matches.negative.join(' || ') + ' )' : '' ) + ( matches.negative.length > 0 && matches.positive.length > 0 ? ' && ' : '' ) + ( matches.positive.length ? '( ' + matches.positive.join(' || ') + ' )' : '' ) + ')';
    }

    _attributes( attributes )
    {
        for( let attribute of attributes )
        {
            if( attribute.hasOwnProperty( 'spread' ))
            {
                this.#html_source += `\${Object.entries( ${attribute.spread} )${ this._filter( attribute.filter )}.map(([ name, value ]) => ' ' + name + ( value !== undefined ? '="' + value + '"' : '' )).join('')}`;
            }
            else if( attribute.hasOwnProperty( 'expression' ))
            {
                if( attribute.expression.code.includes( 'await' ))
                {
                    this._async_render(
                    [
                        `let v = ${attribute.expression.code};`
                    ,   `return v !== null ? ' ${attribute.name}' + ( v !== undefined ? '="' + v + '"' : '' ) : '';`
                    ]);
                }
                else
                {
                    this.#html_source += `\${(()=>{let v = ${attribute.expression.code}; return v !== null ? ' ${attribute.name}' + ( v !== undefined ? '="' + v + '"' : '' ) : ''})()}`;
                }
            }
            else
            {
                this.#html_source += ' ' + attribute.name + ( attribute.hasOwnProperty( 'value' ) ? '="' + attribute.value + '"' : '' );
            }
        }
    }

    _declaration( declaration )
    {
        this.#html_source += `<!${declaration.name}`;

        this._attributes( declaration.attributes );

        this.#html_source += `>`;
    }

    _htmlcomment( comment )
    {
        this.#html_source += `<!--${comment}-->`;
    }

    _style( style )
    {
        if( style.attributes.find( a => a.name === 'instance' ))
        {
            this.#html_source += `<style`;

            this._attributes( style.attributes.filter( a => a.name !== 'instance' ));

            this.#html_source += `>\n${Style.compile(style.source)}</style>`;
        }
        else
        {
            this.#html_source += `<style`;

            this._attributes( style.attributes );

            this.#html_source += `>\n${Style.compile(style.source)}</style>`;
        }
    }

    _script( script )
    {
        if( script.attributes.find( a => a.name === 'instance' ))
        {
            this.#html_source += `<script`;

            this._attributes( script.attributes.filter( a => a.name !== 'instance' ));

            this.#html_source += `>${script.source}</script>`;
        }
        else
        {
            this.#html_source += `<script`;

            this._attributes( script.attributes.filter( a => ![ 'defer' ].includes( a.name )));

            this.#html_source += `>${script.source}</script>`;
        }
    }

    _tag( tag )
    {
        this.#html_source += `<${tag.name}`;

        this._attributes( tag.attributes );

        if( tag.nodes !== undefined )
        {
            this.#html_source += `>`;

            this._nodes( tag.nodes );

            this.#html_source += `</${tag.name}>`;
        }
        else
        {
            this.#html_source += `/>`;
        }
    }

    _template( template )
    {
        this._flush_html_source( true ); // POSSIBLE ASYNC

        let content = `() => ''`;

        if( template.content && template.content.length )
        {
            let content_code = new Transpiler({ nodes: template.content }).code();

            content = `() => { ${content_code} }`;
        }

        // TODO poriesit template content getter

        if( template.props.find( p => p.expression && p.expression.code.includes( 'await' )))
        {
            this._async_render(
            [
                `let values = await Promise.all(`,
            ,   `[`
            ,   ...template.props.map( prop => 
                {
                    if( prop.hasOwnProperty( 'spread' ))
                    {
                        // TODO async expression
                        return `    Object.entries( ${prop.spread} )${ this._filter( prop.filter )}.reduce(( props, [ name, value ]) => ( props[name] = value, props ), {}),`;
                    }
                    else if( prop.hasOwnProperty( 'expression' ))
                    {
                        return prop.expression.code.includes( 'await' )
                            ? `    (async() => { return ${prop.expression.code}})(),`
                            : `    ${ prop.expression.code },`;
                    }
                    else
                    {
                        return `    ${ prop.hasOwnProperty( 'value' ) ? JSON.stringify( prop.value ) : 'undefined' },`;
                    }
                })
            ,   `]);`
            ,   `let props = {`
            ,   ...template.props.map(( prop, i ) =>  
                {
                    return prop.hasOwnProperty( 'spread' )
                        ? `    ...values[${i}],`
                        : `    ${JSON.stringify( prop.name )} : values[${i}],`;
                })
            ,   `};`
            ,   `return $_template( "${template.name}", props, ${content} );`
            ]);
        }
        else
        {
            let props = `{${template.props.map( prop => 
            {
                if( prop.hasOwnProperty( 'spread' ))
                {
                    return `...Object.entries( ${prop.spread} )${ this._filter( prop.filter )}.reduce(( props, [ name, value ]) => ( props[name] = value, props ), {})`;
                }
                else
                {
                    return prop.hasOwnProperty( 'expression' )
                        ? `${JSON.stringify( prop.name )} : ${ prop.expression.code }`
                        : `${JSON.stringify( prop.name )} : ${ prop.hasOwnProperty( 'value' ) ? JSON.stringify( prop.value ) : 'undefined' }`;
                }
            })
            .join(',')}}`;

            this.#code += `$$_html.push( $_template( "${template.name}", ${props}, ${content} ));\n`;
        }
    }

    _content()
    {
        this._flush_html_source( true ); // POSSIBLE ASYNC

        this.#code += `$$_html.push( $content());\n`;
    }

    _javascript_blocks( blocks )
    {
        for( let block of blocks )
        {
            let type = Object.keys( block )[0];

            if( type === 'source' ){ continue }

            this['_'+type]( block[type] );
        }
    }

    _if( _if )
    {
        if( _if.condition.includes( 'await' ) || this._is_javascript_async( _if.if ))
        {
            //console.log( JSON.stringify( _if, null, '  ' ));

            this._async_code(
            [
                { source: `if( ${ _if.condition } )\n{\n` }
            ,   { nodes: _if.if }
            ,   { source: `\n}\n` }
            ,   ...( _if.else ? 
                [
                    { source: `else\n{\n` }
                ,   _if.else.hasOwnProperty('condition') ? ({ 'if': _if.else }) : ({ nodes: _if.else })
                ,   { source: `\n}\n` }
                ]
                : [])
            ]);
        }
        else
        {
            this._code( `if( ${ _if.condition } )\n{\n` );
            this._nodes( _if.if );
            this._code( `\n}\n` );

            if( _if.else )
            {
                this._code( `else\n{\n` );
                this['_' + ( _if.else.hasOwnProperty('condition') ? 'if' : 'nodes' )]( _if.else );
                this._code( `}\n` );
            }
        }
    }

    _for( _for )
    {
        if( _for.condition.includes( 'await' ))
        {
            this._async_code(
            [
                { source: `for( ${ _for.condition } )\n{\n` }
            ,   { nodes: _for.for }
            ,   { source: `\n}\n` }
            ]);
        }
        else
        {
            this._code( `for( ${ _for.condition } )\n{\n` );
            this._nodes( _for.for );
            this._code( `\n}\n` );
        }
    }

    _javascript( javascript )
    {
        //console.log( JSON.stringify( javascript, null, '  ' )); 
        //process.exit()

        if( javascript.if )
        {
            this._if( javascript.if );
        }
        else if( javascript.for )
        {
            this._for( javascript.for );
        }
        else if( javascript.blocks )
        {
            if( this._is_javascript_async( javascript.blocks ))
            {
                this._async_code(
                [
                    { source: `\n{\n` }
                ,   { nodes: javascript.blocks }
                ,   { source: `\n}\n` }
                ]);
            }
            else
            {
                this._blocks( javascript.blocks );
            }
        }
        else{ process.exit() }
    }

    code()
    {
        // TODO poriesit aby sa dvaraz nevykonalo

        this._flush_html_source();

        this._code( this.#async
            ?   `\nlet $$_async = $$_html.reduce(( a, p, i ) => ( typeof p !== 'string' && a.push( p.then( r => $$_html[i] = r )), a ), []);\n\n` +
                `return $$_async.length ? Promise.all( $$_async ).then(() => $$_html.join('')) : $$_html.join('');`
            :   `\nreturn $$_html.join('');`
        );
        
        return this.#code;
    }
}