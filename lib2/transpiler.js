'use strict';

module.exports = class Transpiler
{
    #code = 'let $$_html = [];\n\n'; #async = false; #html_source = '';

    constructor( template )
    {
        this._nodes( template.nodes );
    }

    _nodes( nodes )
    {
        for( let node of nodes )
        {
            let type = Object.keys( node )[0];

            //console.log({ type });

            this['_'+type]( node[type] );
        }
    }

    _async_code( code )
    {
        this._flush_html_source();

        this.#async = true;
        /*this.#code += 
        [
            `$$_html.push( new Promise( async( resolve, reject ) =>`
        ,   `{`
        ,   `  try`
        ,   `  {`
        ,       ...( Array.isArray( code ) ? code : [ code ]).map( c => '    ' + c )
        ,   `  }`
        ,   `  catch( e ){ reject( e )}`
        ,   `}));\n`
        ]
        .join('\n');*/
        this.#code += 
        [
            `$$_html.push(( async() =>`
        ,   `{`
        ,       ...( Array.isArray( code ) ? code : [ code ]).map( c => '    ' + c )
        ,   `})());\n`
        ]
        .join('\n');
    }

    _flush_html_source()
    {
        if( this.#html_source )
        {
            this.#code += '$$_html.push( `' + this.#html_source + '` );\n';

            this.#html_source = '';
        }
    }

    _whitespace( whitespace )
    {
        this.#html_source += whitespace.includes('\n') ? '\n' : whitespace;
    }

    _expression( expression )
    {
        if( expression.code.includes( 'await' ))
        {
            this._async_code( `return ${expression.code.trim()};` );
        }
        else
        {
            this.#html_source += `\${ ${expression.code.trim()} }`;
        }
    }
    
    _text( text )
    {
        this.#html_source += text;
    }

    _comment(){}

    _attributes( attributes )
    {
        for( let attribute of attributes )
        {
            if( attribute.hasOwnProperty( 'spread' ))
            {
                if( attribute.filter )
                {
                    let matches = { positive: [], negative: []};

                    for( let wildcard of attribute.filter.wildcards.trim().split( /\s*,\s*/ ))
                    {
                        matches[ wildcard.startsWith('!') ? 'negative' : 'positive' ].push( '/^' + wildcard.replace(/^!/,'').replace(/\*/g,'.*') + '$/.test( name )' );
                    }

                    attribute.filter = '.filter([ name, value ] => ' + ( matches.negative.length ? '!( ' + matches.negative.join(' || ') + ' )' : '' ) + ( matches.negative.length > 0 && matches.positive.length > 0 ? ' && ' : '' ) + ( matches.positive.length ? '( ' + matches.positive.join(' || ') + ' )' : '' ) + ')';
                }

                this.#html_source += `\${Object.entries( ${attribute.spread} )${attribute.filter || ''}.map([ name, value ] => ' ' + name + '="' + value + '"' ).join('')}`;
            }
            else if( attribute.hasOwnProperty( 'expression' ))
            {
                if( attribute.expression.code.includes( 'await' ))
                {
                    this._async_code(
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
                this.#html_source += ' ' + attribute.name + ( attribute.hasOwnProperty( 'value' ) ? '"' + attribute.value + '"' : '' );
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
        this._flush_html_source();

        this.#code += `$$_html.push( $_template( "${template.name}", {}, "" ));\n`;
    }

    code()
    {
        this._flush_html_source();

        if( this.#async )
        {
            this.#code += `\nlet $$_async = $$_html.reduce(( a, p, i ) => ( typeof p !== 'string' && a.push( p.then( r => $$_html[i] = r )), a ), []);\n\n` +
                `return $$_async.length ? Promise.all( $$_async ).then(() => $$_html.join('')) : $$_html.join('');`;
        }
        else
        {
            this.#code += `\nreturn $$_html.join('');`;
        }
        
        return this.#code;
    }
}