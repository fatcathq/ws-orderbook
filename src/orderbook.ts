import Decimal from 'decimal.js'

type OrderEventType = 0 | 1 | 2 | 3
type Rate = Decimal
type Quantity = Decimal

const EPSILON = 1e-8

export type OrderBookRecord = {
  rate: Rate,
  quantity: Quantity
}

export type OrderBookState = {
  asks: Array<OrderBookRecord>,
  bids: Array<OrderBookRecord>
}

export interface OrderEvent extends OrderBookRecord {
  type: OrderEventType
}

export type OrderBookStateUpdate = {
  asks: Array<OrderEvent>,
  bids: Array<OrderEvent>
}

export default class OrderBook {
  public store: {[key: string]: OrderBookRecord} = {}

  onOrderEvent = (orderEvent: OrderEvent): void => {
    switch (orderEvent.type) {
      case 0: // new
      case 2: // update
        this.store[orderEvent.rate.toString()] = {
          rate: orderEvent.rate,
          quantity: orderEvent.quantity
        }
        break
      case 1: // delete
        if (this.store.hasOwnProperty(orderEvent.rate.toString())) {
          delete this.store[orderEvent.rate.toString()]
        }
        break
      case 3: // delta
        if (!this.store.hasOwnProperty(orderEvent.rate.toString())) {
          this.store[orderEvent.rate.toString()] = {
            rate: orderEvent.rate,
            quantity: orderEvent.quantity
          }
          break
        }

        // Error accumulation
        this.store[orderEvent.rate.toString()].quantity = this.store[orderEvent.rate.toString()].quantity.add(orderEvent.quantity)

        if (this.store[orderEvent.rate.toString()].quantity.lte(EPSILON)) {
          delete this.store[orderEvent.rate.toString()]
        }

        break
      default:
        console.log('unknown type given', orderEvent.type)
        break
    }
  }

  void (): void {
    this.store = {}
  }

  top = (): void => {
    throw new Error('no getTop method defined for this class')
  }
}
