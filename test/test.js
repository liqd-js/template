'use strict';

const Template = require('../lib/template');

const template = new Template({ directories: [ __dirname + '/templates' ] });

async function test( dump )
{
    let start = process.hrtime();

    //let html = await template.render( 'Nodes', { scope: { foo: 'FOO', test: undefined }});
    //let html = await template.render( 'Reference' );
    let html = await template.render( 'Text', { scope: { foo: 'FOO', test: ' jano je "fasa" ' }});

    if( dump )
    {
        let end = process.hrtime( start );

        console.log( html );

        //console.log( html instanceof Promise ? await html : html );
        console.log('ZRENDEROVANE', ( end[0] * 1e3 + end[1] / 1e6 ).toFixed(2), html.length );

        //await template.generate_bundles();
    }
}

//test( true ).then(() => test(true));
//test( true )

/*
setTimeout(() =>
{
    test().then(() => test(true));
}, 
200 );
setTimeout(() =>
{
    test().then(() => test(true));
}, 
1000 );/*

setTimeout(() =>
{
    test().then(() => test(true));
}, 
1500 );*/

test();
test();
test();
test();
test();
test(true);
setInterval(() => test(true), 500 );