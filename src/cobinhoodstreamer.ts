import Streamer from './streamer'
import CobinhoodConnection, { CobinhoodConnectionTypes } from './cobinhoodconnection'
import { MarketName } from './market'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'
import Decimal from 'decimal.js'

export default class CobinhoodStreamer extends Streamer {
  constructor () { super('cobinhood') }

  setupConn (): void {
    this.conn = new CobinhoodConnection()
    this.conn.setMaxListeners(100)

    this.conn.on('updateExchangeState', (updateType: CobinhoodConnectionTypes.UpdateType, marketName: MarketName, message: CobinhoodConnectionTypes.OrderBookData) => {
      if (updateType === 'initial') {
        this.onInitialState(marketName, message)
      }
      if (updateType === 'delta') {
        this.onOrderUpdate(marketName, message)
      }
    })
  }

  private onInitialState (market: MarketName, payload: CobinhoodConnectionTypes.OrderBookData): void {
    if (this.haveMarket(market)) {
      const { asks, bids } = payload
      const orderBook: OrderBookState = { asks: [], bids: [] }

      for (const entry of asks) {
        orderBook.asks.push({
          rate: new Decimal(entry[0]),
          quantity: new Decimal(entry[2])
        })
      }

      for (const entry of bids) {
        orderBook.bids.push({
          rate: new Decimal(entry[0]),
          quantity: new Decimal(entry[2])
        })
      }

      this.markets[market].onInitialState(orderBook)
    }
  }

  private onOrderUpdate (market: MarketName, payload: CobinhoodConnectionTypes.OrderBookData): void {
    if (this.haveMarket(market)) {
      const { asks, bids } = payload
      const orderBookUpdate: OrderBookStateUpdate = { asks: [], bids: [] }

      for (const entry of asks) {
        orderBookUpdate.asks.push({
          type: 3,
          rate: new Decimal(entry[0]),
          quantity: new Decimal(entry[2])
        })
      }

      for (const entry of bids) {
        orderBookUpdate.bids.push({
          type: 3,
          rate: new Decimal(entry[0]),
          quantity: new Decimal(entry[2])
        })
      }

      this.markets[market].onUpdateExchangeState(orderBookUpdate)
    }
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    const marketNameToCobinhood = (market: MarketName) => market.replace('/', '-')

    return this.conn.subscribe(marketNameToCobinhood(market))
  }
}
