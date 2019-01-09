import cloudscraper from 'cloudscraper'
import logger from './logger'
import signalR from 'signalr-client'
import Connection from './connection'

const PROTECTED_PAGE = 'https://bittrex.com/Market/Index?MarketName=USDT-BTC'

export default class BittrexConnection extends Connection {
  public client: any

  constructor () {
    super('bittrex')

    this.client = new signalR.client(
            'wss://socket.bittrex.com/signalr',     // url
            ['CoreHub'],                            // hubs
            undefined,                              // reconnection timeout
            true                                    // don't start automatically
        )

    this.client.serviceHandlers.connected = this.connectionOpened
    this.client.serviceHandlers.connectFailed = this.connectionFailed

    cloudscraper.get(PROTECTED_PAGE, (err: any, resp: any) => {
      if (err) {
        logger.warn('failed to get cloudflare cookie')
      } else {
        this.client.headers = resp.request.headers
      }
      this.client.start()
    })

    this.client.on('CoreHub', 'updateExchangeState', (update: any) => {
      logger.debug('[BITTREX]: Received update')
      this.emit('updateExchangeState', update)
    })
  }

    // TODO(gtklocker): handle case where client disconnects mid-operation
  call (method: string, ...args: any[]): Promise<any> {
    const callRepr = `${method}(${args.join(', ')})`
    return new Promise((resolve, reject) => {
      logger.debug(`Calling ${callRepr}`)
      this.client
                .call('CoreHub', method, ...args)
                .done((err: Error | undefined, res: any) => {
                  if (err) {
                    logger.debug(`${callRepr} returned with error ${err}`)
                    reject(err)
                  }

                  if (res) {
                    logger.debug(`${callRepr} succeeded with ${res}`)
                    resolve(res)
                  }
                })
    })
  }
}
