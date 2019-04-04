import logger from 'logger'
import Connection from './connection'
import axios from 'axios'
const { CWStreamClient, ERROR } = require('cw-stream-client')
// const { StreamMessage } = require('../node_modules/cw-stream-client/dist/proto-builders.js')

const HEARTBEAT_TIMEOUT_MS = 1500

export namespace CryptowatchConnectionTypes {
  export type Market = {
    id: number,
    exchange: string,
    pair: string, active: boolean,
    route: string
  }
}

export default class CryptowatchConnection extends Connection {
  private client!: any
  private cachedMarkets: Map<string, Map<string, CryptowatchConnectionTypes.Market>> | null = null
  private subscriptions: Set<string> = new Set()
  private subscribedMarketIds: Map<number, string> = new Map()
  private lastSeqNum: Map<number, number> = new Map()

  constructor (private readonly exchange: string) { super(`cryptowatch`, HEARTBEAT_TIMEOUT_MS) }

  protected disconnect (): Promise<void> {
    this.client.disconnect()
    this.lastSeqNum = new Map()

    return Promise.resolve()
  }

  protected connect (): void {
    this.client = new CWStreamClient({
      apiKey: 'UXU4C4S93SPA0H4YSAPO',
      secretKey: 'uT0iZo9XF0RMmD1MUGjVMOCwEc0qjTPc48qp73fB'
    })
    this.client.connect()

    logger.debug('[CW]: Openning new connection')
    this.client.onError((err: any) => {
      if (err !== ERROR.PROTOBUF) {
        logger.warn(`[CW]: Connection error: ${err}`)
        this.refreshConnection(`connectionerror`)
      }
    })
    this.client.onConnect(() => {
      logger.debug('[CW]: Connection opened')
      this.subscriptions.forEach(pair => {
        logger.debug(`[CW]: Resubscribing to ${pair}`)
        this.subscribe(pair)
      })

      this.alive()
      this.connectionOpened()
    })
    this.client.onMarketUpdate(this.onMessage)
  }

  private onMessage = (marketData: any): void => {
    const marketId = +marketData.market.marketId
    const market = this.subscribedMarketIds.get(marketId)

    if (marketData.orderBookDeltaUpdate) {
      const currentSeqNum = marketData.orderBookDeltaUpdate.seqNum
      const marketLastSeqNum = this.lastSeqNum.get(marketId)

      if (typeof marketLastSeqNum === 'undefined') {
        this.lastSeqNum.set(marketId, currentSeqNum)
      } else if (marketLastSeqNum !== currentSeqNum - 1) {
        logger.error(`Invalid sequence number for ${market}. Previous: ${marketLastSeqNum}. Current: ${currentSeqNum}`)
        this.refreshConnection('seqnum')
        return
      }
      this.lastSeqNum.set(marketId, currentSeqNum)
    }

    this.emit('updateExchangeState', marketData, market)
  }

  private async markets (): Promise<Map<string, Map<string, CryptowatchConnectionTypes.Market>>> {
    if (!this.cachedMarkets) {
      this.cachedMarkets = new Map()
      const markets: Array<CryptowatchConnectionTypes.Market> = (await axios.get('https://api.cryptowat.ch/markets')).data.result

      for (const market of markets) {
        if (!this.cachedMarkets.has(market.exchange)) {
          this.cachedMarkets.set(market.exchange, new Map())
        }
        const exchange = this.cachedMarkets.get(market.exchange)
        if (typeof exchange === 'undefined') {
          throw new Error(`Could not find markets for ${exchange}`)
        }

        exchange.set(market.pair, market)
        this.cachedMarkets.set(market.exchange, exchange)
      }
    }

    return this.cachedMarkets
  }

  async subscribe (pair: string): Promise<void> {
    const markets = await this.markets()
    const exchangeMarkets = markets.get(this.exchange)
    if (typeof exchangeMarkets === 'undefined') {
      throw new Error(`No markets found for ${this.exchange}`)
    }

    const market = exchangeMarkets.get(pair)
    if (typeof market === 'undefined') {
      throw new Error(`No market data for ${pair}`)
    }

    this.subscriptions.add(pair)
    this.subscribedMarketIds.set(market.id, pair)
    logger.debug(`[CW]: Subscribing to pair ${pair} with id ${market.id}`)
    this.client.subscribe([
      `markets:${market.id}:book:snapshots`,
      `markets:${market.id}:book:deltas`
    ])

    return Promise.resolve()
  }

  call (): Promise<void> {
    throw new Error('[CW]: call() not implemented')
  }
}
