import OrderBook, { OrderBookRecord } from './orderbook'
import { increasingOrderCompare } from './utils'

class AskOrderBook extends OrderBook {
  top = (limit = 1): Array<OrderBookRecord> => {
    const rates = Object.keys(this.store).map(k => this.store[k].rate)

    rates.sort(increasingOrderCompare)
    rates.splice(limit)

    return rates.map(key => this.store[key.toString()])
  }
}

export default AskOrderBook
