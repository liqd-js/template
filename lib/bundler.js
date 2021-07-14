'use strict';

const fs = require('fs');
const Style = require('@liqd-js/style');
const Resources = require('./resources');

module.exports = class Bundler
{
    #parser; #templates;

    constructor( parser, templates )
    {
        this.#parser = parser;
        this.#templates = templates;
    }

    #nodes( nodes, bundles )
    {
        for( let node of nodes )
        {
            if( node.script )
            {
                let bundle = node.script.attributes && node.script.attributes.find( a => a.name === 'bundle' );

                if( bundle )
                {
                    if( !bundles.scripts[ bundle.value ]){ bundles.scripts[ bundle.value ] = [] }

                    let source = node.script.source;

                    // source = loadFile( style.attributes.find( a => a.name === 'require' ).value, this.#options.directories ) + '\n' + style.source; // TODO

                    bundles.scripts[ bundle.value ].push( source );
                }
            }
            else if( node.style )
            {
                let bundle = node.style.attributes && node.style.attributes.find( a => a.name === 'bundle' );

                if( bundle )
                {
                    if( !bundles.styles[ bundle.value ]){ bundles.styles[ bundle.value ] = []}

                    let source = node.style.source;    

                    // source = loadFile( style.attributes.find( a => a.name === 'require' ).value, this.#options.directories ) + '\n' + style.source; // TODO

                    bundles.styles[ bundle.value ].push( Style.compile( source ));
                }
            }
            else if( node.if )
            {
                this.#nodes( node.if.if, bundles );
                node.if.else && this.#nodes( node.if.else, bundles );
            }
            else if( node.for )
            {
                this.#nodes( node.for.for, bundles );
            }
            else
            {
                let node_type = Object.keys( node )[0];

                if( node[node_type].nodes )
                {
                    this.#nodes( node[node_type].nodes, bundles );
                }
                else if( node[node_type].blocks )
                {
                    this.#nodes( node[node_type].blocks, bundles );
                }
            }
        }
    }

    async bundle( options = {})
    {
        let bundles = { scripts : {}, styles: {}};

        for( let bundle in options?.bundles )
        {
            for( let script of options.bundles[bundle]?.scripts )
            {
                if( !bundles.scripts[ bundle ]){ bundles.scripts[ bundle ] = []}

                bundles.scripts[ bundle ].push( fs.readFileSync( script, 'utf8' ));
            }

            for( let style of options.bundles[bundle]?.styles )
            {
                if( !bundles.styles[ bundle ]){ bundles.styles[ bundle ] = []}

                bundles.styles[ bundle ].push( Style.compile( fs.readFileSync( style, 'utf8' )));
            }
        }

        for( let path of this.#templates )
        {
            try
            {
                const source = require('fs').readFileSync( path, 'utf8' ); // TODO lepsie async
                const parsed = this.#parser.parse( source );

                this.#nodes( parsed.nodes, bundles );
            }
            catch(e)
            {
                //console.log( path, e );
            }
        }

        for( let bundle in bundles?.scripts )
        {
            let source = bundles.scripts[bundle].join(';\n').trim();
            let compressed = await Resources.compress( 'script', source ).catch( e => undefined );

            bundles.scripts[bundle] = { source, compressed, hash: Resources.hash( source )}
        }

        for( let bundle in bundles?.styles )
        {
            let source = bundles.styles[bundle].join('\n').trim();
            let compressed = await Resources.compress( 'style', source ).catch( e => undefined );

            bundles.styles[bundle] = { source, compressed, hash: Resources.hash( source )}
        }
        
        return bundles;
    }
}