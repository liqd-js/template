'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

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
    #options; #i18n; #templates; #compiled = new Map(); #id_generator = new UniqueID({ prefix: '_', unique_interval: 3600, radix: 64 }); #ready = false; #initialization;

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

    compile( path )
    {
        try
        {
            const source = require('fs').readFileSync( path, 'utf8' ); // TODO lepsie async
            const transpiler = new Transpiler( TemplateParser.parse( source ), this.#options );

            //console.log( transpiler.code() );
        
            return new Function( '$args', 'const { $id, $locale, $scope, $props, $content, $, $$_template, $$_script, $$_style, $$_escapeHTML, $$_references } = $args; ' + transpiler.code() );
        }
        catch( err )
        {
            console.log( err );

            this.emit( 'error', err = new TemplateError( err.message, path ));

            throw err;
        }
    }

    get( name, root = '' )
    {
        if( path.sep !== '/' ){ name = name.replaceAll( '/', path.sep )}

        let template = this.#templates.closest( path.sep + name + '.template', root, { ignoreCase: true }); //TODO cache pre dvojicu name a root
        let compiled = this.#compiled.get( template );
        
        if( !compiled )
        {
            this.#compiled.set( template, compiled = this.compile( template ));

            compiled.path = template;
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
                this.emit( 'error', err = new TemplateError( err.message, template_render.path, undefined, options.props || {} ));
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

        let styles = new Set(), scripts = new Set();

        source = source.replace( /<style[^>]*>([\s\S]*?)<\/style>/g, ( _, style ) => ( styles.add( style.trim() ), '' ));
        source = source.replace( /<script[^>]*>[\s\S]*?<\/script>/g, script => ( scripts.add( script ), '' ));

        //TODO handlovat scripts podla src, ci je to instance a podoble

        if( styles.size )
        {
            source = source.includes('</head>') ? source.replace( '</head>', '<style>\n' + [...styles].join('\n') + '\n</style>\n</head>' ) : '<style>\n' + [...styles].join('\n') + '\n</style>\n' + source;
        }

        if( scripts.size )
        {
            source = source.includes('</body>') ? source.replace( '</body>', [...scripts].join('\n') + '\n</body>' ) : source + '\n' + [...scripts].join('\n');
        }

        return source;
    }

    render( template, options = {})
    {
        if( !this.#ready )
        {
            return this.#initialization.then(() => this.render( template, options ));
        }

        let references = [];
        let render = this.#render( template, { ...options, references });
        
        return this.#optimize( this.#resolve_references( render, references ));
    }
}