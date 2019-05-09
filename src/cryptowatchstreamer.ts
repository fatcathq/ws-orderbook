import logger from 'logger'
import Streamer from './streamer'
import CryptowatchConnection from './cryptowatchconnection'
import { MarketName } from './market'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'
import Decimal from 'decimal.js'

let hasInitialState = false
export default class CryptowatchStreamer extends Streamer {
  private cwMarket: Map<string, string> = new Map()
  constructor (cryptowatchExchange: string) {
    super(cryptowatchExchange)
  }

  setupConn (): void {
    this.conn = new CryptowatchConnection(this.exchangeName)

    this.conn.on('connectionReset', () => {
      hasInitialState = false
    })

    this.conn.on('updateExchangeState', (message: any, cwMarket: MarketName) => {
      const market: MarketName | undefined = this.cwMarket.get(cwMarket)
      if (typeof market === 'undefined') {
        logger.warn(`Couldn't find ${cwMarket}`)
        return
      }

      if (Object.keys(message).includes('orderBookUpdate')) {
        this.onInitialState(market, message.orderBookUpdate)
        hasInitialState = true
      } else if (Object.keys(message).includes('orderBookDeltaUpdate') && hasInitialState) {
        this.onOrderUpdate(market, message.orderBookDeltaUpdate)
      } else if (!hasInitialState) {
        logger.debug(`No initial state for ${market} on ${this.exchangeName}`)
      } else {
        logger.warn(`Unrecognized payload: ${JSON.stringify(message)}`)
      }
    })
  }

  private onInitialState (market: MarketName, snapshot: any): void {
    if (this.haveMarket(market)) {
      const asks = snapshot.asks
      const bids = snapshot.bids
      const orderBook: OrderBookState = { asks: [], bids: [] }

      for (const order of asks) {
        orderBook.asks.push({
          rate: new Decimal(order.priceStr),
          quantity: new Decimal(order.amountStr)
        })
      }

      // TODO: Improve this part
      for (const order of bids) {
        orderBook.bids.push({
          rate: new Decimal(order.priceStr),
          quantity: new Decimal(order.amountStr)
        })
      }

      this.markets[market].onInitialState(orderBook)
    }
  }

  private onOrderUpdate (market: MarketName, updates: any): void {
    if (this.haveMarket(market)) {
      const orderBookUpdate: OrderBookStateUpdate = { asks: [], bids: [] }

      for (const order of updates.bids.set) {
        const rate = new Decimal(order.priceStr)
        const quantity = new Decimal(order.amountStr)
        orderBookUpdate.bids.push({
          type: 2,
          rate: rate,
          quantity: quantity
        })
      }

      for (const rate of updates.bids.removeStr) {
        orderBookUpdate.bids.push({
          type: 1,
          rate: rate,
          quantity: new Decimal(0)
        })
      }

      for (const order of updates.asks.set) {
        const rate = new Decimal(order.priceStr)
        const quantity = new Decimal(order.amountStr)
        orderBookUpdate.asks.push({
          type: 2,
          rate: rate,
          quantity: quantity
        })
      }

      for (const rate of updates.asks.removeStr) {
        orderBookUpdate.asks.push({
          type: 1,
          rate: rate,
          quantity: new Decimal(0)
        })
      }

      if (updates.bids.delta.length > 0 || updates.asks.delta.length > 0) {
        logger.debug('found deltas')
      }

      this.markets[market].onUpdateExchangeState(orderBookUpdate)
    }
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    const cwMarket = market.replace('/', '').toLowerCase()
    this.cwMarket.set(cwMarket, market)

    return this.conn.subscribe(cwMarket)
  }
}
