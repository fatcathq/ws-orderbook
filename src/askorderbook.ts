import OrderBook from './orderbook'

class AskOrderBook extends OrderBook {
    constructor () {
      super()
    }

    top (limit = 1) {
        const rates = Object.keys(this.store).map(k => this.store[k].rate)

        rates.sort((a, b) => a - b)
        rates.splice(limit)

        return rates.map(key => this.store[key])
    }
}

export default AskOrderBook
