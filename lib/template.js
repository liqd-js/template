'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const path = require('path');
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

module.exports = class Template
{
    #options; #i18n; #templates; #compiled = new Map(); #id_generator = new UniqueID({ prefix: '_', unique_interval: 3600, radix: 64 }); #ready = false; #initialization;

    constructor( options = {})
    {
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

    compile( source )
    {
        const transpiler = new Transpiler( TemplateParser.parse( source ), this.#options );
    
        return new Function( '$args', 'const { $id, $locale, $scope, $props, $content, $, $$_template, $$_script, $$_style, $$_escapeHTML } = $args; ' + transpiler.code() );
    }

    get( name, root = '' )
    {
        if( path.sep !== '/' ){ name = name.replaceAll( '/', path.sep )}

        let template = this.#templates.closest( path.sep + name + '.template', root, { ignoreCase: true }); //TODO cache pre dvojicu name a root
        let compiled = this.#compiled.get( template );
        
        if( !compiled )
        {
            this.#compiled.set( template, compiled = this.compile( require('fs').readFileSync( template, 'utf8' )));

            compiled.path = template;
        }

        return compiled;
    }

    #render( template, options = {})
    {
        let template_render = ( typeof template === 'function' ? template : this.get( template, options.path ));

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
            $$_escapeHTML   : escapeHTML
        });
    }

    render( template, options )
    {
        if( !this.#ready )
        {
            return this.#initialization.then(() => this.render( template, options ));
        }

        return this.#render( template, options );
    }
}