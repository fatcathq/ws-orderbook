import logger from 'logger'
import delay from 'delay'
import axios from 'axios'
import WebSocket from 'ws'
import Connection from './connection'
import { MarketName } from './market'

const BASE_URL = 'wss://stream.binance.com:9443'
const RECONNECT_DELAY = 100

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

const CONNECTION_REFRESH_TIMEOUT = 1000 * 3600 // every 1 hour

export default class BinanceConnection extends Connection {
  private client!: WebSocket
  private refreshTimeout!: NodeJS.Timer
  private subscriptions: Set<string> = new Set()
  private snapshots: Map<string, BinanceConnectionTypes.Snapshot> = new Map()
  private lastMarketUpdate: Map<string, number> = new Map()
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY

  constructor () {
    super('binance')

    // TODO: not really accurate since we
    // didn't open any connection
    this.connectionOpened()
  }

  subscribe (market: MarketName): Promise<void> {
    logger.debug(`[BINANCE]: Subscribing to ${market}`)
    this.subscriptions.add(market)

    this.refreshConnection()

    return Promise.resolve()
  }

  private disconnect (): boolean {
    this.emit('connectionReset')
    this.snapshots.clear()
    this.lastMarketUpdate.clear()
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[BINANCE]: Closing previous connection')

      try {
        this.client.off('message', this.onMessage)
        this.client.off('error', this.connectionDied)
        this.client.close()

        return true
      } catch (err) {
        logger.warn(err.message, err)
      }
    }
    return false
  }

  private connect = (): void => {
    logger.debug(`[BINANCE]: Connecting to socket`)
    const stream: Array<string> = []
    this.subscriptions.forEach((subscription: string) => stream.push(`${subscription}@depth`))

    logger.debug(`[BINANCE]: Streams: ${stream.join('/')}`)
    this.client = new WebSocket(`${BASE_URL}/stream?streams=${stream.join('/')}`)
    this.client.on('error', this.connectionDied)
    this.client.on('open', () => {
      logger.debug(`[BINANCE]: Connection open`)
      // TODO: Error handling
      this.subscriptions.forEach(this.getInitialState)
    })
    this.client.on('message', this.onMessage)
    this.setRefreshTimer()
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

  private refreshConnection = (): void => {
    logger.debug(`[BINANCE]: Refreshing connection`)
    if (this.disconnect()) {
      // wait for the previous connection to close
      this.client.on('close', this.connect)
    } else {
      this.connect()
    }
  }

  private setRefreshTimer (): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    this.refreshTimeout = setTimeout(this.refreshConnection, CONNECTION_REFRESH_TIMEOUT)
  }

  private connectionDied = async (): Promise<void> => {
    logger.warn(`[BINANCE]: Connection died. Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
    this.isConnected = false
    this.disconnect()

    await delay(this.RECONNECT_THROTTLE)
    this.RECONNECT_THROTTLE *= 2

    this.connect()
  }

  call (): Promise<void> {
    throw new Error('[BINANCE]: call() implemented')
  }
}
