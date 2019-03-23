import logger from 'logger'
import Streamer from './streamer'
import CryptowatchConnection from './cryptowatchconnection'
import { MarketName } from './market'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'

let hasInitialState = false
export default class CryptowatchStreamer extends Streamer {
  constructor () {
    super('cryptowatch')
  }

  setupConn (): void {
    this.conn = new CryptowatchConnection()

    this.conn.on('updateExchangeState', (message: any) => {
      const market = 'ETH/BTC'
      console.log(market)

      if (Object.keys(message).includes('orderBookUpdate')) {
        console.log('snapshot')
        console.log(message.orderBookUpdate.seqNum)
        this.onInitialState(market, message.orderBookUpdate)
        hasInitialState = true
      } else if (Object.keys(message).includes('orderBookDeltaUpdate') && hasInitialState) {
        this.onOrderUpdate(market, message.orderBookDeltaUpdate)
      } else {
        logger.warn(`Unrecognized Kraken payload: ${JSON.stringify(message[2])}`)
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
          rate: +order.price,
          quantity: +order.amount
        })
      }

      // TODO: Improve this part
      for (const order of bids) {
        orderBook.bids.push({
          rate: +order.price,
          quantity: +order.amount
        })
      }

      this.markets[market].onInitialState(orderBook)
    }
  }

  private onOrderUpdate (market: MarketName, updates: any): void {
    if (this.haveMarket(market)) {
      const orderBookUpdate: OrderBookStateUpdate = { asks: [], bids: [] }

      for (const order of updates.bids.set) {
        const rate = +order.price
        const quantity = +order.amount
        orderBookUpdate.bids.push({
          type: 2,
          rate: rate,
          quantity: quantity
        })
      }

      for (const rate of updates.bids.remove) {
        orderBookUpdate.bids.push({
          type: 1,
          rate: rate,
          quantity: 0
        })
      }

      for (const order of updates.asks.set) {
        const rate = +order.price
        const quantity = +order.amount
        orderBookUpdate.asks.push({
          type: 2,
          rate: rate,
          quantity: quantity
        })
      }

      for (const rate of updates.asks.remove) {
        orderBookUpdate.asks.push({
          type: 1,
          rate: rate,
          quantity: 0
        })
      }

      if (updates.bids.delta.length > 0 || updates.asks.delta.length > 0) {
        logger.debug('found deltas')
      }

      this.markets[market].onUpdateExchangeState(orderBookUpdate)
    }
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    return this.conn.subscribe(market)
  }
}
