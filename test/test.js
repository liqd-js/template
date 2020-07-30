'use strict';

const Template = require('../lib2/template');

const template = new Template();

async function test( dump )
{
    let start = process.hrtime();

    let html = await template.render( 'Nodes', undefined, { foo: 'FOO', test: undefined });

    if( dump )
    {
        let end = process.hrtime( start );

        console.log( html );

        //console.log( html instanceof Promise ? await html : html );
        console.log('ZRENDEROVANE', ( end[0] * 1e3 + end[1] / 1e6 ).toFixed(2), html.length );
    }
}

test().then(() => test(true));
/*test();
test();
test();
test();
test();
test();
setInterval( test, 500 );*/