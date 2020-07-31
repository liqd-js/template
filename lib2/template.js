'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const Parser = require('@liqd-js/parser');
const TemplateParser = new Parser( __dirname + '/template.syntax' );
const Transpiler = require('./transpiler');

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

        return new Function( '$args', 'const [ $id, $locale, $content, $props, $scope, $_template, $$_HTML ] = $args;' + code );
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

        return template([ Math.ceil( Math.random() * 1000 ), locale, content, props, scope, ( name, props, content ) => this.render( name, props, scope, locale, content ) ]);

        return html;
    }

    async renderHTML( name, props = {}, scope = {}, locale )
    {
        
    }
}