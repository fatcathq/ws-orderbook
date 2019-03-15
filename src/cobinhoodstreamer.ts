import Streamer from './streamer'
import CobinhoodConnection, { CobinhoodConnectionTypes } from './cobinhoodconnection'
import { MarketName } from './market'
import { OrderBookState } from './orderbook'

function cobinhoodPairToStandardPair (market: MarketName): MarketName {
  return market.replace('-', '/')
}

export default class CobinhoodStreamer extends Streamer {
  constructor () { super('cobinhood') }

  setupConn (): void {
    this.conn = new CobinhoodConnection()

    this.conn.on('updateExchangeState', (message: CobinhoodConnectionTypes.Message) => {
      const marketName = cobinhoodPairToStandardPair(message.h[0].split('.')[1])

      if (message.h['2'] == 's') {
        this.onInitialState(marketName, message.d)
      }

      if (message.h['2'] == 'u') {
      }
    })
  }

  private onInitialState (market: MarketName, payload: CobinhoodConnectionTypes.OrderBookData): void {
    if (this.haveMarket(market)) {
      const {asks, bids} = payload
      const orderBook: OrderBookState = { asks: [], bids: [] }

      for (const entry in asks) {
        orderBook.asks.push({
          rate: Number(entry[0]),
          quantity: Number(entry[2])
        })
      }

      for (const entry in bids) {
        orderBook.bids.push({
          rate: Number(entry[0]),
          quantity: Number(entry[2])
        })
      }

      this.markets[market].onInitialState(orderBook)
    }
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    return this.conn.subscribe(market)
  }
}
