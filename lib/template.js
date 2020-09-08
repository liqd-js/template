'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const path = require('path');
const FS = require('@liqd-js/fs');
const Parser = require('@liqd-js/parser');
const TemplateParser = new Parser( __dirname + '/parser/template.syntax' );
const Transpiler = require('./transpiler');

const NO_CONTENT = () => '';
const Q = JSON.stringify;

module.exports = class Template
{
    #templates; #compiled = new Map(); #ready = false; #initialization;

    constructor( options = {})
    {
        this.#initialization = new Promise( async( resolve, reject ) =>
        {
            this.#templates = await FS.find( options.directories, /\/[^/]+.template$/ );
            this.#ready = true;
        });

        
        //console.log( 'template' );
    }

    parse( filename )
    {
        //console.log( 'Parsing', filename );

        let data = require('fs').readFileSync( filename, 'utf8' );

        let source = TemplateParser.parse( data);

        //console.log( JSON.stringify( source, null, '  ' ), '--------' );

        let transpiler = new Transpiler( source );

        let code = transpiler.code();

        //console.log( '\n\n**** ' + filename + ' ****\n\n\n', code );

        return new Function( '$args', 'const [ $id, $locale, $content, $props, $scope, $_template, $$_HTML ] = $args; ' + code );
    }

    get( name, root = '' )
    {
        if( path.sep !== '/' ){ name = name.replaceAll( '/', path.sep )}

        let template = this.#templates.closest( path.sep + name + '.template', root, { ignoreCase: true }); //TODO cache pre dvojicu name a root
        let compiled = this.#compiled.get( template );
        
        if( !compiled )
        {
            //this.#templates.set( name, template = this.parse( __dirname + '/../test/templates/' + name + '.template' ));
            this.#compiled.set( template, compiled = this.parse( template ));

            compiled.path = template;
        }

        return compiled;
    }

    render( path = '', name, props = {}, scope = {}, locale = 'en', content = NO_CONTENT )
    {
        let template = this.get( name );

        return template([ Math.ceil( Math.random() * 1000 ), locale, content, props, scope, ( name, props, content ) => this.render( template.path, name, props, scope, locale, content || NO_CONTENT ) ]);

        return html;
    }

    async renderHTML( name, props = {}, scope = {}, locale )
    {
        
    }
}