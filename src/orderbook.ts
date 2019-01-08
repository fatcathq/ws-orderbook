type OrderEventType = 0 | 1 | 2
type Rate = number
type Quantity = number

export type OrderBookRecord = {
    rate: Rate,
    quantity: Quantity
}

export type OrderBookState = {
    asks: Array<OrderBookRecord>,
    bids: Array<OrderBookRecord>
}

interface OrderEvent extends OrderBookRecord {
    type: OrderEventType
}

export type OrderBookStateUpdate = {
    asks: Array<OrderEvent>,
    bids: Array<OrderEvent>
}

export default class OrderBook {
    public store: {[key: string]: OrderBookRecord} = {}

    onOrderEvent = (orderEvent: OrderEvent): void => {
        switch (orderEvent.Type) {
        case 0: // new
        case 2: // update
            this.store[orderEvent.Rate] = {
                rate: orderEvent.Rate,
                quantity: orderEvent.Quantity
            }
            break
        case 1: // delete
            if (this.store.hasOwnProperty(orderEvent.Rate)) {
                delete this.store[orderEvent.Rate]
            }
            break
        default:
            console.log('unknown type given', orderEvent.Type)
            break
        }
    }

    top = (): void => {
        throw new Error('no getTop method defined for this class')
    }
}
