import { OrderBookState, OrderBookStateUpdate, OrderBookRecord, OrderEvent } from './orderbook'
import BidOrderBook from './bidorderbook'
import AskOrderBook from './askorderbook'
import EventEmitter from 'events'

export type MarketName = string

export default class Market extends EventEmitter {
  public name: MarketName
  public bids: BidOrderBook
  public asks: AskOrderBook

  constructor (name: MarketName) {
    super()

    this.name = name
    this.bids = new BidOrderBook()
    this.asks = new AskOrderBook()
  }

  onInitialState (state: OrderBookState): void {
    let { asks, bids } = state

        // type 0 means new order
    const addTypeZero = (order: OrderBookRecord): OrderEvent => {
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

  voidOrderBook = (): void => {
    this.asks.void()
    this.bids.void()

    this.emit('askUpdate', this)
    this.emit('bidUpdate', this)
  }

  onUpdateExchangeState (update: OrderBookStateUpdate): void {
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
