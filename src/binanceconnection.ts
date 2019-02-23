import logger from 'logger'
import axios from 'axios'
import WebSocket from 'ws'
import Connection from './connection'
import { MarketName } from './market'

const BASE_URL = 'wss://stream.binance.com:9443'

export namespace BinanceConnectionTypes {
  type OrderBookEntry = [string, string, any]

  export type Snapshot = {
    lastUpdateId: number,
    asks: Array<OrderBookEntry>,
    bids: Array<OrderBookEntry>
  }

  export type OrderBookUpdate = {
    e: string,
    E: number,
    s: string,
    U: number,
    u: number,
    b: Array<OrderBookEntry>,
    a: Array<OrderBookEntry>
  }

  export type UpdateType = 'initial' | 'delta'
}

export default class BinanceConnection extends Connection {
  private client!: WebSocket
  private subscriptions: Set<string> = new Set()
  private snapshots: Map<string, BinanceConnectionTypes.Snapshot> = new Map()
  private lastMarketUpdate: Map<string, number> = new Map()

// TODO: Maybe refresh only every hour
  constructor () { super('binance') }

  subscribe (market: MarketName): Promise<void> {
    logger.debug(`[BINANCE]: Subscribing to ${market}`)
    this.subscriptions.add(market)

    this.refreshConnection('newsubsription', false)

    return Promise.resolve()
  }

  protected disconnect (): Promise<void> {
    this.snapshots.clear()
    this.lastMarketUpdate.clear()
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[BINANCE]: Closing previous connection')

      return new Promise((resolve) => {
        try {
          this.client.removeEventListener('message')
          this.client.removeEventListener('error')
          this.client.on('close', resolve)
          this.client.close()
        } catch (err) {
          logger.warn(err.message, err)

          this.client.off('close', resolve)
          resolve()
        }
      })
    }

    return Promise.resolve()
  }

  protected connect (): void {
    logger.debug(`[BINANCE]: Connecting to socket`)
    const stream: Array<string> = []
    this.subscriptions.forEach((subscription: string) => stream.push(`${subscription}@depth`))

    logger.debug(`[BINANCE]: Streams: ${stream.join('/')}`)
    this.client = new WebSocket(`${BASE_URL}/stream?streams=${stream.join('/')}`)
    this.client.on('error', this.refreshConnection.bind(this, 'connectionerror'))
    this.client.on('open', () => {
      logger.debug(`[BINANCE]: Connection open`)
      // TODO: Error handling
      this.subscriptions.forEach(this.getInitialState)
      this.connectionOpened()
    })
    this.client.on('message', this.onMessage)
  }

  private getInitialState = async (market: MarketName): Promise<void> => {
    logger.debug(`[BINANCE]: Fetching initial state for ${market}`)
    const { data: snapshot } = await axios.get(`https://www.binance.com/api/v1/depth?symbol=${market.toUpperCase()}&limit=1000`)
    this.snapshots.set(market, snapshot)
    logger.debug(`[BINANCE]: Got initial state for ${market}`)
    this.emit('updateExchangeState', 'initial', market, snapshot)
  }

  private onMessage = (messageString: string): void => {
    if (messageString.includes('ping') || messageString.includes('pong')) {
      logger.warn(`[BINANCE]: PING MESSAGE: ${messageString}`)
    }
    try {
      const message = JSON.parse(messageString)
      const { stream } = message
      const market = stream.split('@')[0]

      if (!this.snapshots.has(market)) {
        return
      }

      const snapshot = this.snapshots.get(market)
      if (typeof snapshot === 'undefined') {
        // thanks Typescript for needing this check
        throw new Error(`No snapshot for ${market}`)
      }

      const snapshotUpdateId = +snapshot.lastUpdateId
      const firstUpdateId = +message.data.U
      const finalUpdateId = +message.data.u
      if (this.lastMarketUpdate.has(market)) {
        // has received another update before
        const lastMarketUpdate = this.lastMarketUpdate.get(market)
        if (typeof lastMarketUpdate === 'undefined') {
          throw new Error(`No lastUpdateId for ${market}`)
        }

        if (firstUpdateId !== lastMarketUpdate + 1) {
          // not sequential update
          // TODO: Reset connection, probably lost some update
          logger.warn(`[BINANCE]: Non-sequential update for ${market} (${firstUpdateId})`)
          return
        }
      } else {
        // first update
        if (firstUpdateId > snapshotUpdateId || finalUpdateId < snapshotUpdateId) {
          // out of order update
          // TODO: Probably reconnect?
          return
        }
      }

      this.lastMarketUpdate.set(market, finalUpdateId)
      this.emit('updateExchangeState', 'delta', market, message.data)
    } catch (err) {
      logger.warn(err.message, err)
      logger.warn(`[BINANCE]: Error processing message: ${JSON.stringify(messageString)}`)
    }
  }

  call (): Promise<void> {
    throw new Error('[BINANCE]: call() implemented')
  }
}
