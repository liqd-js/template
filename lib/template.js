'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const FS = require('@liqd-js/fs');
const I18n = require('@liqd-js/i18n');
const Parser = require('@liqd-js/parser');
const UniqueID = require('@liqd-js/unique-id');
const TemplateParser = new Parser( __dirname + '/parser/template.syntax' );
const Transpiler = require('./transpiler');
const Resources = require('./resources');

const NO_CONTENT = () => '';
const Q = JSON.stringify;
const escapeHTML = ( str ) => str.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const script = ( id ) => Resources.get( 'script', id );
const style = ( id ) => Resources.get( 'style', id );

class TemplateError extends Error
{
    constructor( message, template, line, props )
    {
        super( message );

        this.name = 'TemplateError';
        this.stack = '';
        this.template = template;
        line && ( this.line = line );
        props && ( this.props = props );
    }
}

module.exports = class Template extends EventEmitter
{
    #options; #i18n; #templates; #compiled = new Map(); #id_generator = new UniqueID({ prefix: '_', unique_interval: 3600, radix: 64 }); #ready = false; #initialization; #bundler;

    static get Error(){ return TemplateError }

    constructor( options = {})
    {
        super();

        this.#options = options;
        this.#initialization = new Promise( async( resolve, reject ) =>
        {
            this.#i18n = new I18n({ dictionaries: options.dictionaries || [] });
            this.#templates = await FS.find( options.directories, /\/[^/]+.template$/ );
            this.#ready = true;

            resolve();
        });

        
        //console.log( 'template' );
    }

    #transpile( parsed )
    {
        const transpiler = new Transpiler( parsed, this.#options );
        return new Function( '$args', 'const { $id, $locale, $scope, $props, $content, $, $$_template, $$_script, $$_style, $$_escapeHTML, $$_references } = $args; ' + transpiler.code() );
    }

    compile( path )
    {
        try
        {
            const source = fs.existsSync( path ) ? fs.readFileSync( path, 'utf8' ) : path; // TODO lepsie async
            const parsed = TemplateParser.parse( source );

            if( parsed.components )
            {
                let components = {};

                for( let component of parsed.components )
                {
                    components[ component.name ] = this.#transpile( component );
                }

                return components;
            }
            else
            {
                return this.#transpile( parsed );
            }
        }
        catch( err )
        {
            this.emit( 'error', err = new TemplateError( err.message || err, path ));

            throw err;
        }
    }

    get( name, root = '' )
    {
        if( path.sep !== '/' ){ name = name.replaceAll( '/', path.sep )}

        let filename = name.replace(/\.[A-Z]([/.]?[a-zA-Z0-9_-])*/, '');
        let template = this.#templates.closest( path.sep + filename + '.template', root, { ignoreCase: true }); //TODO cache pre dvojicu name a root

        if( !template )
        {
            throw 'Template ' + JSON.stringify( name ) + ' not found';
        }

        let compiled = this.#compiled.get( template );
        
        if( !compiled )
        {
            this.#compiled.set( template, compiled = this.compile( template ));

            compiled.path = template;
        }

        if( typeof compiled !== 'function' )
        {
            let component = name.replace(/^.*\//, '').replace(/^[^.]+/, 'root');

            if( !( compiled = compiled[component] ))
            {
                throw 'Template ' + JSON.stringify( name ) + ' not found';
            }
        }

        return compiled;
    }

    #render( template, options = {})
    {
        let template_render = ( typeof template === 'function' ? template : this.get( template, options.path ));

        try
        {
            return template_render(
            {
                $id             : this.#id_generator.get(),
                $locale         : options.locale || this.#options.locale || 'en',
                $scope          : options.scope || {},
                $props          : options.props || {},
                $content        : options.content || NO_CONTENT,
                $               : ( ...args ) => this.#i18n.get( options.locale || this.#options.locale || 'en', ...args ),
                $$_template     : ( template, props, content ) => this.#render( template, { ...options, path: template_render.path, props, content }),
                $$_script       : script,
                $$_style        : style,
                $$_escapeHTML   : escapeHTML,
                $$_references   : options.references
            });
        }
        catch( err )
        {
            if( !( err instanceof TemplateError ))
            {
                this.emit( 'error', err = new TemplateError( err.message || err, template_render.path, undefined, options.props || {} ));
            }

            throw err;
        }
    }

    #resolve_references( source, references )
    {
        if( source instanceof Promise ){ return source.then( source => this.#resolve_references( source, references ))}

        let async_references = [];

        for( let reference of references )
        {
            if( reference.content instanceof Promise )
            {
                async_references.push( reference.content.then( content => reference.content = content ));
            }
        }

        if( async_references.length ){ return Promise.all( async_references ).then(() => this.#resolve_references( source, references ))}

        source = source.replace( /<@@@ ([a-zA-Z][a-zA-Z0-9_:-]*) @@@>/g, ( _, name ) =>
        {
            return references.filter( r => r.name === name ).map( r => r.content.trim() ).join('\n');
        })

        return source;
    }

    #optimize( source )
    {
        if( source instanceof Promise ){ return source.then( source => this.#optimize( source ))}

        let styles = new Set(), scripts = new Set(), async_scripts = new Set(), defered_scripts = new Set();

        source = source.replace( /<style[^>]*>([\s\S]*?)<\/style>/g, ( _, style ) => ( styles.add( style.trim() ), '' ));
        
        source = source.replace( /<script([^>]*)>([\s\S]*?)<\/script>/g, ( script, attributes, source ) => 
        {
            if( scripts.has( script )){ return '' }

            scripts.add( script );

            if( /(?<=(^|\s))defer(?=($|\s))/.test( attributes ))
            {
                attributes = attributes.replace(/(?<=(^|\s))defer(?=($|\s))/, '').trim();

                defered_scripts.add( '<script' + ( attributes ? ' ' + attributes : '' ) + '>' + source + '</script>' );

                return '';
            }
            else if( /(?<=(^|\s))async(?=($|\s))/.test( attributes ))
            {
                async_scripts.add( script );

                return '';
            }

            return script;
        });

        if( styles.size )
        {
            source = source.includes('</head>') ? source.replace( '</head>', '<style>\n' + [...styles].join('\n') + '\n</style>\n</head>' ) : '<style>\n' + [...styles].join('\n') + '\n</style>\n' + source;
        }

        if( defered_scripts.size )
        {
            source = source.includes('</body>') ? source.replace( '</body>', [...defered_scripts].join('\n') + '\n</body>' ) : source + '\n' + [...defered_scripts].join('\n');
        }

        if( async_scripts.size )
        {
            if( source.includes('</head>'))
            {
                source = source.replace( '</head>', [...async_scripts].filter( s => /<script\s*[^>]*\ssrc=/.test( s )).map( s => '<link rel="preload" href="' + s.match(/<script\s*[^>]*\ssrc="([^"]+)"/)[1] + '" as="script"/>' ).join('\n') + '\n</head>' );
            }

            source = source.includes('</body>') ? source.replace( '</body>', [...async_scripts].join('\n') + '\n</body>' ) : source + '\n' + [...async_scripts].join('\n');
        }

        return source;
    }

    async render( template, options = {})
    {
        if( !this.#ready ){ await this.#initialization; }

        let references = [];
        let render = this.#render( template, { ...options, references });
        
        return this.#optimize( this.#resolve_references( render, references ));
    }

    async generate_bundles( options = {})
    {
        if( !this.#bundler )
        {
            if( !this.#ready ){ await this.#initialization; }

            this.#bundler = new (require('./bundler'))( TemplateParser, this.#templates );
        }

        return this.#bundler.bundle( options );
    }
}