import logger from './logger'
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
      const [ currency, asset ] = update.MarketName.split('-')
      const market = `${asset}/${currency}`

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
    const [ asset, currency ] = market.split('/')
    const bittrexMarket = `${currency}-${asset}`

    logger.debug(`[BITTREX]: Subscribing to market ${bittrexMarket}`)
    return this.getInitialState(market)
      .then(() => this.conn.call('SubscribeToExchangeDeltas', bittrexMarket))
      .catch((err: any) => {
        logger.error(err.message, err)
        process.exit(1)
      })
  }

  getInitialState (market: MarketName): Promise<void> {
    const [ asset, currency ] = market.split('/')
    const bittrexMarket = `${currency}-${asset}`

    logger.debug(`[BITTREX]: Querying initial state of ${bittrexMarket} orderbook`)
    if (this.haveMarket(market)) {
      return this.conn
        .call('QueryExchangeState', bittrexMarket)
        .then((state: BittrexOrderBookState) => {
          logger.debug(`[BITTREX]: Got initial state of ${bittrexMarket} orderbook`)
          const orderBookState: OrderBookState = {
            asks: state.Sells.map(formatOrderKeys),
            bids: state.Buys.map(formatOrderKeys)
          }
          this.markets[market].onInitialState(orderBookState)
        })
        .catch((err: any) => {
          logger.error(err.message, err)
          process.exit(1)
        })
    }
    logger.debug(`[BITTREX]: Haven't created market ${market}`)
    return Promise.reject()
  }
}
