import OrderBook, { OrderBookRecord } from './orderbook'
import { decreasingOrderCompare } from './utils'

class BidOrderBook extends OrderBook {
  top = (limit = 1): Array<OrderBookRecord> => {
    const rates = Object.keys(this.store).map(k => this.store[k].rate)

    if (limit === 1) {
      const bestRate = Math.max(...Object.keys(this.store).map(rate => +rate))
      return [this.store[bestRate.toString()]]
    }
    rates.sort(decreasingOrderCompare)
    rates.splice(limit)

    return rates.map(key => this.store[key.toString()])
  }
}

export default BidOrderBook
