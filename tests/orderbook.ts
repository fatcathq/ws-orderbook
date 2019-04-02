import OrderBook, { OrderBookRecord } from '../src/orderbook'

describe('onOrderEvent', () => {
  let orderbook: OrderBook

  beforeEach(() => {
    orderbook = new OrderBook()

    orderbook.store = {
      1: { rate: 1, quantity: 0.1 }
    }
  })

  test('New record', () => {
    const record = {
      rate: 2,
      quantity: 0.2
    }

    orderbook.onOrderEvent({
      type: 0,
      ...record
    })

    expect(Object.keys(orderbook.store)).toHaveLength(2)
    expect(orderbook.store[2]).toEqual(record)
  })

  test('Update record', () => {
    const record = {
      rate: 1,
      quantity: 0.2
    }

    orderbook.onOrderEvent({
      type: 2,
      ...record
    })

    expect(Object.keys(orderbook.store)).toHaveLength(1)
    expect(orderbook.store[1]).toEqual(record)
  })

  test('Delete record', () => {
    const record = {
      rate: 1,
      quantity: 0.2
    }

    orderbook.onOrderEvent({
      type: 1,
      ...record
    })

    expect(Object.keys(orderbook.store)).toHaveLength(0)
  })

  test('Delta case updates record', () => {
    let record: OrderBookRecord

    record = {
      rate: 1,
      quantity: 0.2
    }

    orderbook.onOrderEvent({
      type: 3,
      ...record
    })

    expect(Object.keys(orderbook.store)).toHaveLength(1)
    expect(orderbook.store[1]).toEqual({ rate: 1, quantity: 0.3 })

    record = {
      rate: 1,
      quantity: -0.2
    }

    orderbook.onOrderEvent({
      type: 3,
      ...record
    })

    expect(orderbook.store[1]).toEqual({ rate: 1, quantity: 0.1 })
  })

  test('Delta case deletes record', () => {
    orderbook.onOrderEvent({
      type: 3,
      rate: 1,
      quantity: -0.9999999999999999
    })

    expect(Object.keys(orderbook.store)).toHaveLength(0)
  })

  test('Delta case adds record', () => {
    const record = {
      rate: 2,
      quantity: 0.3
    }

    orderbook.onOrderEvent({
      type: 3,
      ...record
    })

    expect(Object.keys(orderbook.store)).toHaveLength(2)
    expect(orderbook.store[2]).toEqual(record)
  })
})
