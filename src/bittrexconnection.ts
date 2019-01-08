const cloudscraper = require('cloudscraper')
const winston = require('winston')
const singalR = require('signalr-client')
const Connection = require('./connection')

const PROTECTED_PAGE = 'https://bittrex.com/Market/Index?MarketName=USDT-BTC'

export default class BittrexConnection extends Connection {
    public client: any

    constructor() {
        super()

        this.client = new singalR.client(
            'wss://socket.bittrex.com/signalr',     // url
            ['CoreHub'],                            // hubs
            undefined,                              // reconnection timeout
            true                                    // don't start automatically
        )

        this.client.serviceHandlers.connected = this.connectionOpened
        this.client.serviceHandlers.connectFailed = this.connectionFailed

        cloudscraper.get(PROTECTED_PAGE, (err: any, resp: any) => {
            if (err) {
                winston.warn('failed to get cloudflare cookie')
            }
            else {
                this.client.headers = resp.request.headers
            }
            this.client.start()
        })
    }

    // TODO(gtklocker): handle case where client disconnects mid-operation
    on(evt: string, cb: (str: any) => void) {
        this.client.on('CoreHub', evt, cb)
    }

    call(method: string, ...args: any[]) {
        const callRepr = `${method}(${args.join(', ')})`
        return new Promise((resolve, reject) => {
            winston.debug('Calling', callRepr)
            this.client
                .call('CoreHub', method, ...args)
                .done((err: Error | undefined, res: any) => {
                    if (err) {
                        winston.debug(callRepr, 'returned with error', err)
                        reject(err)
                    }

                    if (res) {
                        winston.debug(callRepr, 'succeeded with ', res)
                        resolve(res)
                    }
                })
        })
    }
}
