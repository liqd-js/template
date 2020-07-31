'use strict';

const Template = require('../lib2/template');

const template = new Template();

async function render( dump )
{
    let start = process.hrtime();

    let html = await template.render( 'Page', { page: 'Obsah stránky' }, { url: '/index.html' });

    if( dump )
    {
        let end = process.hrtime( start );

        console.log( html );

        //console.log( html instanceof Promise ? await html : html );
        console.log('ZRENDEROVANE', ( end[0] * 1e3 + end[1] / 1e6 ).toFixed(2), html.length );
    }
}

render().then(() => render(true));