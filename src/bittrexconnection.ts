import cloudscraper from 'cloudscraper'
import logger from 'logger'
import signalR from 'signalr-client'
import Connection from './connection'
import delay from 'delay'
import { MarketName } from './market'

const PROTECTED_PAGE = 'https://bittrex.com/Market/Index?MarketName=USDT-BTC'

const HEARTBEAT_TIMEOUT_MS = 2000

export namespace BittrexConnectionTypes {
  export type Order = {
    Rate: number,
    Quantity: number
  }

  export interface OrderUpdate extends Order {
    Type: 0 | 1 | 2
  }

  export type Snapshot = {
    Buys: Array<Order>,
    Sells: Array<Order>
  }

  export type OrderBookUpdate = {
    MarketName: MarketName,
    Buys: Array<OrderUpdate>,
    Sells: Array<OrderUpdate>
  }

  export type UpdateType = 'initial' | 'delta'
}

export default class BittrexConnection extends Connection {
  public client: any
  private aliveTimeout: NodeJS.Timer | null
  private subscriptions: Set<string> = new Set()

  constructor () {
    super('bittrex')

    this.aliveTimeout = null
    this.connect()
  }

  private connect = (): void => {
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
    this.client.serviceHandlers.connectionLost = (err: Error) => {
      logger.error('[BITTREX]: Connection lost')
      logger.error(err.message, err)
      this.emit('connectionReset')
    }
    this.client.serviceHandlers.onerror = (err: Error) => {
      logger.error('[BITTREX]: Connection error')
      logger.error(err.message, err)
      this.emit('connectionReset')
    }
    this.client.serviceHandlers.disconnected = () => {
      logger.error('[BITTREX]: Client disconnected')
      this.emit('connectionReset')
    }

    cloudscraper.get(PROTECTED_PAGE, (err: any, resp: any) => {
      if (err) {
        logger.warn('failed to get cloudflare cookie')
      } else {
        this.client.headers = resp.request.headers
      }
      this.client.start()
    })

    this.client.on('CoreHub', 'updateExchangeState', (update: BittrexConnectionTypes.OrderBookUpdate) => {
      logger.debug('[BITTREX]: Received update')
      this.emit('updateExchangeState', 'delta', update.MarketName, update)
    })

    this.aliveTimeout = null
  }

  private ping (): void {
    logger.debug('[BITTREX]: Sending ping')
    this.client.call('CoreHub', 'SubscribeToExchangeDeltas', 'BTC-ETH')
      .done(async (err: Error | undefined, res: any) => {
        if (res) {
          logger.debug('[BITTREX]: Got ping reply')
          this.alive()
          await delay(500)
          this.ping()
        } else if (err) {
          logger.error(err.message, err)
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
    // this.emit('connectionReset')
  }

  async subscribe (market: string): Promise<void> {
    this.subscriptions.add(market)

    const initialState: BittrexConnectionTypes.Snapshot = await this.call('QueryExchangeState', market)

    logger.debug(`[BITTREX]: Got initial state of ${market} orderbook`)
    this.emit('UpdateExchangeState', 'initial', market, initialState)

    return this.call('SubscribeToExchangeDeltas', market)
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
