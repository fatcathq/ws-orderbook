import logger from 'logger'
import Streamer from './streamer'
import KrakenConnection from './krakenconnection'
import { MarketName } from './market'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'
import Decimal from 'decimal.js'

namespace KrakenConnectionTypes {
  export type Channel = number
  export type Pair = MarketName
  export type Rate = string
  export type Quantity = string
  export type Timestamp = string
  export type Snapshot = {[index in 'as' | 'bs']: Array<OrderUpdate>}
  export type Updates = {[index in 'a' | 'b']: Array<OrderUpdate>}
  export type SnapshotMessage = [Channel, Pair, Snapshot]
  export type UpdatePayload = [Channel, Pair, Updates]
  export type OrderUpdate = [Rate, Quantity, Timestamp]
}

const commonCoins: {[index: string]: string} = {
  'XBT': 'BTC'
}

function krakenPairToStandardPair (pair: MarketName): MarketName {
  const [ asset, currency ] = pair.split('/')

  return `${commonCoins[asset] || asset}/${commonCoins[currency] || currency}`
}

export default class KrakenStreamer extends Streamer {
  constructor () {
    super('kraken')
  }

  setupConn (): void {
    this.conn = new KrakenConnection()

    this.conn.on('updateExchangeState', (message: KrakenConnectionTypes.SnapshotMessage | KrakenConnectionTypes.UpdatePayload) => {
      const market = krakenPairToStandardPair(message[1])

      if (Object.keys(message[2]).includes('as') &&
          Object.keys(message[2]).includes('bs')) {
        this.onInitialState(market, message[2] as KrakenConnectionTypes.Snapshot)
      } else if (
        Object.keys(message[2]).includes('a') ||
        Object.keys(message[2]).includes('b')) {
        this.onOrderUpdate(market, message[2] as KrakenConnectionTypes.Updates)
      } else {
        logger.warn(`Unrecognized Kraken payload: ${JSON.stringify(message[2])}`)
      }
    })
  }

  private onInitialState (market: MarketName, snapshot: KrakenConnectionTypes.Snapshot): void {
    if (this.haveMarket(market)) {
      const asks = snapshot.as
      const bids = snapshot.bs
      const orderBook: OrderBookState = { asks: [], bids: [] }

      for (const order of asks) {
        orderBook.asks.push({
          rate: new Decimal(order[0]),
          quantity: new Decimal(order[1])
        })
      }

      // TODO: Improve this part
      for (const order of bids) {
        orderBook.bids.push({
          rate: new Decimal(order[0]),
          quantity: new Decimal(order[1])
        })
      }

      this.markets[market].onInitialState(orderBook)
    }
  }

  private onOrderUpdate (market: MarketName, updates: KrakenConnectionTypes.Updates): void {
    if (this.haveMarket(market)) {
      const orderBookUpdate: OrderBookStateUpdate = { asks: [], bids: [] }
      const updateSide = Object.keys(updates)[0] === 'a' ? 'asks' : 'bids'
      const updateEntries = updateSide === 'asks' ? updates.a : updates.b

      for (const updateEntry of updateEntries) {
        const rate = new Decimal(updateEntry[0])
        const quantity = new Decimal(updateEntry[1])

        orderBookUpdate[updateSide].push({
          type: quantity.gt(0) ? 2 : 1,
          rate: rate,
          quantity: quantity
        })
      }

      this.markets[market].onUpdateExchangeState(orderBookUpdate)
    }
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    return this.conn.subscribe(market)
  }
}
