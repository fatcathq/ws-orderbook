import OrderBook from './orderbook'

class BidOrderBook extends OrderBook {
    top = (limit = 1): any => {
        const rates = Object.keys(this.store).map(k => this.store[k].rate)

        rates.sort((a, b) => b - a)
        rates.splice(limit)

        return rates.map(key => this.store[key])
    }
}

export default BidOrderBook
