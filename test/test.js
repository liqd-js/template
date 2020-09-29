'use strict';

const Template = require('../lib/template');

const template = new Template({ directories: [ __dirname + '/templates' ] });

async function test( dump )
{
    let start = process.hrtime();

    //let html = await template.render( '', 'Nodes', undefined, { foo: 'FOO', test: undefined });
    let html = await template.render( '', 'Text', undefined, { foo: 'FOO', test: undefined });

    if( dump )
    {
        let end = process.hrtime( start );

        console.log( html );

        //console.log( html instanceof Promise ? await html : html );
        console.log('ZRENDEROVANE', ( end[0] * 1e3 + end[1] / 1e6 ).toFixed(2), html.length );
    }
}

setTimeout(() =>
{
    test().then(() => test(true));
}, 
200 );
/*test();
test();
test();
test();
test();
test();
setInterval( test, 500 );*/