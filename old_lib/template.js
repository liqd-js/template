'use strict';

//https://www.javascriptstuff.com/how-whitespace-works-in-jsx/

const Parser = require('@liqd-js/parser');
const TemplateParser = new Parser( __dirname + '/template.syntax' );

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
            }
        });

        //console.log( source, '--------' );

        return new Function( '$args', 'const [ $id, $locale, $content, $props, $scope, $_html, $_template ] = $args; var $_space = ""; ' + source );
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

        let html = '';

        template([ Math.ceil( Math.random() * 1000 ), locale, content, props, scope, ( data ) => html += data, ( name, props, content ) => html += this.render( name, props, scope, locale, content )]);

        return html;
    }

    async renderHTML( name, props = {}, scope = {}, locale )
    {
        
    }
}