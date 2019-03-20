type OrderEventType = 0 | 1 | 2 | 3
type Rate = number
type Quantity = number

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
        this.store[orderEvent.rate] = {
          rate: orderEvent.rate,
          quantity: orderEvent.quantity
        }
        break
      case 1: // delete
        if (this.store.hasOwnProperty(orderEvent.rate)) {
          delete this.store[orderEvent.rate]
        }
        break
      case 3: // delta
        if (!this.store.hasOwnProperty(orderEvent.rate)) {
          this.store[orderEvent.rate] = {
            rate: orderEvent.rate,
            quantity: orderEvent.quantity
          }
          break
        }

        //Error accumulation
        this.store[orderEvent.rate].quantity += orderEvent.quantity

        if (this.store[orderEvent.rate].quantity <= EPSILON) {
          delete this.store[orderEvent.rate]
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
