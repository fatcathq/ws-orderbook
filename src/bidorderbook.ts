import OrderBook, { OrderBookRecord } from './orderbook'
import { decreasingOrderCompare } from './utils'

class BidOrderBook extends OrderBook {
  top = (limit = 1): Array<OrderBookRecord> => {
    const rates = Object.keys(this.store).map(k => this.store[k].rate)

    rates.sort(decreasingOrderCompare)
    rates.splice(limit)

    return rates.map(key => this.store[key.toString()])
  }
}

export default BidOrderBook
