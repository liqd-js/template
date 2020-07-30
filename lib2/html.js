module.exports = class HTML
{
    #buffer = []; #async = []; #async_indexes = [];

    constructor()
    {
        
    }

    push( html )
    {
        if( html instanceof Promise )
        {
            this.#async.push( html );
            this.#async_indexes.push( this.#buffer.length );
        }

        this.#buffer.push( html );

        /** /if( this.#buffer.length && typeof html === 'string' && typeof this.#buffer[this.#buffer.length-1] === 'string' )
        {
            this.#buffer[this.#buffer.length-1] += html;
        }
        else/** /
        {
            this.#buffer.push( html );
        }
        /**/
    }

    render()
    {
        return this.#async.length ? new Promise(( resolve, reject ) => 
        {
            Promise.all( this.#async ).then( nodes => 
            {
                for( let i = 0; i < nodes.length; ++i )
                {
                    this.#buffer[this.#async_indexes[i]] = nodes[i];
                }

                resolve( this.#buffer.join('') );
            })
            .catch( reject );
        })
        : this.#buffer.join('');
    }
}