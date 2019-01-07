import BidOrderBook from './bidorderbook'
import AskOrderBook from './askorderbook'
import EventEmitter from 'events'

type MarketName = string

abstract class Market extends EventEmitter {
    public name: MarketName
    public bids: BidOrderBook
    public asks: AskOrderBook
    abstract onUpdateExchangeState(update: any): void

    constructor(name: MarketName) {
        super()

        this.onInitialState = this.onInitialState.bind(this)
        this.onUpdateExchangeState = this.onUpdateExchangeState.bind(this)

        this.name = name
        this.bids = new BidOrderBook()
        this.asks = new AskOrderBook()
    }

    onInitialState(state: any) {
        let { Sells, Buys } = state

        // type 0 means new order
        const addTypeZero = (order: any) => {
            return {
                Type: 0,
                ...order
            }
        }
        Sells = Sells.map(addTypeZero)
        Buys = Buys.map(addTypeZero)
        this.onUpdateExchangeState({
            Sells,
            Buys
        })
    }
}

class BittrexMarket extends Market {
    onUpdateExchangeState(update: any) {
        update.Sells.forEach(this.asks.onOrderEvent)
        if (update.Sells.length > 0) {
            this.emit('askUpdate', this)
        }

        update.Buys.forEach(this.bids.onOrderEvent)
        if (update.Buys.length > 0) {
            this.emit('bidUpdate', this)
        }
    }
}

export default function marketFactory (exchangeName: string, marketName: MarketName) {
    switch (exchangeName) {
    case 'bittrex':
        return new BittrexMarket(marketName)
    default:
        throw new Error(`No available market for ${exchangeName}`)
    }
}

export {
    marketFactory,
    MarketName
}
