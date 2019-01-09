import Streamer from './streamer'
import BittrexConnection from './bittrexconnection'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'
import { MarketName } from './market'

type BittrexOrder = {
  Rate: number,
  Quantity: number
}

interface BittrexOrderUpdate extends BittrexOrder {
  Type: 0 | 1 | 2
}

type BittrexOrderBookState = {
  Buys: Array<BittrexOrder>,
  Sells: Array<BittrexOrder>
}

type BittrexOrderBookStateUpdate = {
  MarketName: MarketName,
  Buys: Array<BittrexOrderUpdate>,
  Sells: Array<BittrexOrderUpdate>
}

const formatOrderKeys = ({ Rate, Quantity }: BittrexOrder) => ({ rate: Rate, quantity: Quantity })
const formatOrderUpdateKeys = ({ Type, Rate, Quantity }: BittrexOrderUpdate) => ({ type: Type, rate: Rate, quantity: Quantity })

export default class BittrexStreamer extends Streamer {
  constructor () {
    super('bittrex')
  }

  setupConn (): void {
    this.conn = new BittrexConnection()

    this.conn.on('updateExchangeState', (update: BittrexOrderBookStateUpdate) => {
      const market = update.MarketName
      if (this.haveMarket(market)) {
        const orderBookUpdate: OrderBookStateUpdate = {
          asks: update.Sells.map(formatOrderUpdateKeys),
          bids: update.Buys.map(formatOrderUpdateKeys)
        }

        this.markets[market].onUpdateExchangeState(orderBookUpdate)
      }
    })
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    return this.getInitialState(market)
            .then(() => this.conn.call('SubscribeToExchangeDeltas', market))
  }

  getInitialState (market: MarketName): Promise<void> {
    if (this.haveMarket(market)) {
      return this.conn
                .call('QueryExchangeState', market)
                .then((state: BittrexOrderBookState) => {
                  const orderBookState: OrderBookState = {
                    asks: state.Sells.map(formatOrderKeys),
                    bids: state.Buys.map(formatOrderKeys)
                  }
                  this.markets[market].onInitialState(orderBookState)
                })
    }
    return Promise.reject()
  }
}
