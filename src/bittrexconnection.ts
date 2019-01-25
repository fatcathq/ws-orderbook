import cloudscraper from 'cloudscraper'
import logger from './logger'
import signalR from 'signalr-client'
import Connection from './connection'
import delay from 'delay'

const PROTECTED_PAGE = 'https://bittrex.com/Market/Index?MarketName=USDT-BTC'

const HEARTBEAT_TIMEOUT_MS = 2000

export default class BittrexConnection extends Connection {
  public client: any
  private aliveTimeout: NodeJS.Timer | null

  constructor () {
    super('bittrex')

    this.client = new signalR.client(
      'wss://socket.bittrex.com/signalr',     // url
      ['CoreHub'],                            // hubs
      undefined,                              // reconnection timeout
      true                                    // don't start automatically
    )

    this.client.serviceHandlers.connected = () => {
      this.ping()
      this.connectionOpened()
    }

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

    this.aliveTimeout = null
  }

  private ping (): void {
    logger.debug('[BITTREX]: Sending ping')
    this.client.call('CoreHub', 'SubscribeToExchangeDeltas', 'BTC-ETH')
      .done(async (err: Error | undefined, res: any) => {
        logger.debug('[BITTREX]: Got ping reply')
        if (res) {
          this.alive()
          await delay(500)
          this.ping()
        } else if (err) {
          logger.error(err)
        }
      })
  }

  private alive (): void {
    logger.debug('[BITTREX]: Connection alive')
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    this.aliveTimeout = setTimeout(this.connectionDied, HEARTBEAT_TIMEOUT_MS)
  }

  private connectionDied = (): void => {
    logger.debug('[BITTREX]: Connection died')
    // this.emit('connectionError')
  }

  // TODO(gtklocker): handle case where client disconnects mid-operation
  call (method: string, ...args: any[]): Promise<any> {
    const callRepr = `${method}(${args.join(', ')})`
    return new Promise((resolve, reject) => {
      logger.debug(`[BITTREX]: Calling ${callRepr}`)
      this.client
        .call('CoreHub', method, ...args)
        .done((err: Error | undefined, res: any) => {
          if (err) {
            logger.debug(`[BITTREX]: ${callRepr} returned with error ${err}`)
            reject(err)
          }

          if (res) {
            logger.debug(`[BITTREX]: ${callRepr} succeeded with ${res}`)
            resolve(res)
          }
        })
    })
  }
}
