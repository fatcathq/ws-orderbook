import { OrderBookState, OrderBookStateUpdate } from './orderbook'
import BidOrderBook from './bidorderbook'
import AskOrderBook from './askorderbook'
import EventEmitter from 'events'

type MarketName = string

class Market extends EventEmitter {
    public name: MarketName
    public bids: BidOrderBook
    public asks: AskOrderBook

    constructor(name: MarketName) {
        super()

        this.name = name
        this.bids = new BidOrderBook()
        this.asks = new AskOrderBook()
    }

    onInitialState(state: OrderBookState) {
        let { asks, bids } = state

        // type 0 means new order
        const addTypeZero = (order: any) => {
            return {
                type: 0,
                ...order
            }
        }

        const update: OrderBookStateUpdate = {
            asks: asks.map(addTypeZero),
            bids: bids.map(addTypeZero)
        }
        this.onUpdateExchangeState(update)
    }

    onUpdateExchangeState(update: OrderBookStateUpdate) {
        update.asks.forEach(this.asks.onOrderEvent)
        if (update.asks.length > 0) {
            this.emit('askUpdate', this)
        }

        update.bids.forEach(this.bids.onOrderEvent)
        if (update.bids.length > 0) {
            this.emit('bidUpdate', this)
        }
    }
}

export {
    Market,
    MarketName
}
