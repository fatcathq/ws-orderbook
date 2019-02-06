import logger from 'logger'
import Streamer from './streamer'
import PoloniexConnection from './poloniexconnection'
import { MarketName } from './market'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'
const PoloniexMarkets: PoloniexPairChannels = require('../poloniexmarkets.json')
import validateChannelIds from './poloniexpairsvalidator'

validateChannelIds().catch((err: any) => {
  logger.error(err.message, err)
  process.exit(1)
})

export type PoloniexPairChannels = {
  [index: string]: number | undefined
}

namespace PoloniexConnectionTypes {
  export type OrderType = 0 | 1
  export type Rate = string
  export type Quantity = string
  export type OrderBookState = [
    { [index: string]: Quantity }, // asks
    { [index: string]: Quantity } // bids
  ]
  export type InitialState = ['i', { currencyPair: string, orderBook: Array<OrderBookState> }]
  export type OrderUpdate = ['o' | 't', OrderType, Rate, Quantity]
}

const commonCoins: {[index: string]: string} = {
  'BSV': 'BCHSV'
}

function standardPairToPoloniexPair (pair: MarketName): MarketName {
  const [ asset, currency ] = pair.split('/')

  return `${commonCoins[currency] || currency}_${commonCoins[asset] || asset}`
}

function poloniexPairToStandardPair (pair: MarketName): MarketName {
  let [ currency, asset ] = pair.split('_')

  for (const coin in commonCoins) {
    if (commonCoins[coin] === currency) {
      currency = coin
    } else if (commonCoins[coin] === asset) {
      asset = coin
    }
  }

  return `${asset}/${currency}`
}

export default class PoloniexStreamer extends Streamer {
  constructor () {
    super('poloniex')
  }

  setupConn (): void {
    this.conn = new PoloniexConnection()

    this.conn.on('updateExchangeState', (message: any) => {
      const channelId = message[0]
      let poloniexMarket
      for (const candidateMarket in PoloniexMarkets) {
        if (PoloniexMarkets[candidateMarket] === channelId) {
          poloniexMarket = candidateMarket
        }
      }

      if (typeof poloniexMarket === 'undefined') {
        throw new Error(`Unknown channel: ${channelId}.`)
      }

      const market = poloniexPairToStandardPair(poloniexMarket)

      if (message[2][0][0] === 'i') {
        this.onInitialState(market, message[2])
      } else if (message[2][0][0] === 'o') {
        this.onOrderUpdate(market, message[2])
      } else {
        logger.warn(`Unrecognized first entry of Poloniex payload: ${JSON.stringify(message[2][0])}`)
      }
    })
  }

  private onInitialState (market: MarketName, payload: Array<PoloniexConnectionTypes.InitialState>): void {
    if (this.haveMarket(market)) {
      const [asks, bids] = payload[0][1].orderBook
      const orderBook: OrderBookState = { asks: [], bids: [] }

      for (const rate in asks) {
        orderBook.asks.push({
          rate: +rate,
          quantity: +asks[rate]
        })
      }

      for (const rate in bids) {
        orderBook.bids.push({
          rate: +rate,
          quantity: +bids[rate]
        })
      }

      this.markets[market].onInitialState(orderBook)
    }
  }

  private onOrderUpdate (market: MarketName, payload: Array<PoloniexConnectionTypes.OrderUpdate>): void {
    if (this.haveMarket(market)) {
      const orderBookUpdate: OrderBookStateUpdate = { asks: [], bids: [] }

      for (const updateEntry of payload) {
        if (updateEntry[0] !== 'o') {
          // might be 't' for trades
          continue
        }
        const orderSide = +updateEntry[1] === 0 ? 'asks' : 'bids'
        const rate = +updateEntry[2]
        const quantity = +updateEntry[3]

        orderBookUpdate[orderSide].push({
          type: quantity > 0 ? 2 : 1,
          rate: rate,
          quantity: quantity
        })
      }

      this.markets[market].onUpdateExchangeState(orderBookUpdate)
    }
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    const poloniexMarket = standardPairToPoloniexPair(market)
    const channel = PoloniexMarkets[poloniexMarket]

    logger.debug(`[POLONIEX]: Subscribing to market ${poloniexMarket}`)
    if (typeof channel === 'undefined') {
      throw new Error(`Unknown Poloniex market ${poloniexMarket}`)
    }

    return this.conn.subscribe(channel)
  }
}
