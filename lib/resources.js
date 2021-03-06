'use strict';

// npm install -g terser
// npm install -g csso-cli

const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const NOOP = () => undefined;
const Cache = { style: new Map(), script: new Map() };

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

function toBase( number, radix )
{
    if( radix != 10 )
    {
        if( radix <= 36 )
        {
            number = number.toString( radix );
        }
        else if( radix <= 64 )
        {
            let value = number; number = '';

            do
            { 
                number = ALPHABET.charAt( value % radix ) + number;
                value = Math.floor( value / radix );
            }
            while( value > 0 );
        }
    }

    return number;
}

const Compressors = 
{
    style   : [ 'csso', []],
    script  : [ 'terser', [ '--compress', '--mangle' ]]
}

function compress( type, source )
{
    return new Promise(( resolve, reject ) =>
    {
        let compress = spawn( ...Compressors[ type ] ), compressed = '';

        compress.stdout.on( 'data', data => compressed += data.toString('utf8'));

        /*compress.stderr.on( 'data', data => 
        {
            console.log( data.toString( 'utf8' ));
        });*/

        //compress.on( 'close', code => code ? reject( code ) : resolve( compressed.trim() ));
        compress.on( 'close', code => code ? reject( code ) : resolve( compressed.trim() ));
        compress.on( 'error', err => reject( err ));
        compress.stdin.on( 'error', NOOP );

        compress.stdin.end( source );
    })
}

module.exports = class Resources
{
    static #hash( str, alg = 'sha256' )
    {
        return '_' + toBase( str.length, 62 ) + '_' + crypto.createHash(alg).update(str).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    }

    static id( type, source )
    {
        let id = Resources.#hash( source.path || source.code );

        if( !Cache[ type ].get( id ))
        {
            if( source.path )
            {
                source.code = fs.readFileSync( source.path, 'utf8' );
            }

            Cache[ type ].set( id, source.code );

            compress( type, source.code ).then( compressed => Cache[ type ].set( id, compressed )).catch( NOOP );
        }

        return id;
    }

    static get( type, id )
    {
        return Cache[ type ].get( id );
    }
}