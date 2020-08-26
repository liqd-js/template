'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const Parser = require('@liqd-js/parser');
const TemplateParser = new Parser( __dirname + '/parser/template.syntax' );
const Transpiler = require('./transpiler');

const NO_CONTENT = () => '';
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

        let source = TemplateParser.parse( data);

        //console.log( JSON.stringify( source, null, '  ' ), '--------' );

        let transpiler = new Transpiler( source );

        let code = transpiler.code();

        console.log( '\n\n**** ' + filename + ' ****\n\n\n', code );

        return new Function( '$args', 'const [ $id, $locale, $content, $props, $scope, $_template, $$_HTML ] = $args; ' + code );
    }

    get( name )
    {
        let template = this.#templates.get( name );

        if( !template )
        {
            //this.#templates.set( name, template = this.parse( __dirname + '/../test/templates/' + name + '.template' ));
            this.#templates.set( name, template = this.parse( __dirname + '/templates/' + name.toLowerCase() + '.template' ));
        }

        return template;
    }

    render( name, props = {}, scope = {}, locale = 'en', content = NO_CONTENT )
    {
        let template = this.get( name );

        return template([ Math.ceil( Math.random() * 1000 ), locale, content, props, scope, ( name, props, content ) => this.render( name, props, scope, locale, content || NO_CONTENT ) ]);

        return html;
    }

    async renderHTML( name, props = {}, scope = {}, locale )
    {
        
    }
}