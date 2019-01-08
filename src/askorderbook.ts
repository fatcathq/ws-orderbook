import OrderBook, { OrderBookRecord } from './orderbook'

class AskOrderBook extends OrderBook {
    top = (limit = 1): Array<OrderBookRecord> => {
        const rates = Object.keys(this.store).map(k => this.store[k].rate)

        rates.sort((a, b) => a - b)
        rates.splice(limit)

        return rates.map(key => this.store[key])
    }
}

export default AskOrderBook
