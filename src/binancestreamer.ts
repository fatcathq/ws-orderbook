import logger from 'logger'
import Streamer from './streamer'
import BinanceConnection, { BinanceConnectionTypes } from './binanceconnection'
import { MarketName } from './market'
import { OrderBookState, OrderBookStateUpdate } from './orderbook'

type Side = 'asks' | 'bids'

const commonCoins: {[index: string]: string} = {}

function standardMarketToBinanceMarket (market: MarketName): MarketName {
  const [asset, currency] = market.split('/')

  return `${commonCoins[asset] || asset}${commonCoins[currency] || currency}`.toLowerCase()
}

export default class BinanceStreamer extends Streamer {
  private marketsMap: Map<MarketName, MarketName> = new Map()

  constructor () {
    super('binance')
  }

  setupConn (): void {
    this.conn = new BinanceConnection()

    this.conn.on('updateExchangeState',
      (updateType: BinanceConnectionTypes.UpdateType,
        binanceMarket: MarketName,
        update: BinanceConnectionTypes.Snapshot | BinanceConnectionTypes.OrderBookUpdate) => {
        const market = this.marketsMap.get(binanceMarket)
        if (typeof market === 'undefined') {
          logger.warn(`[BINANCE]: Received market update for unknown market ${binanceMarket}`)
          return
        }

        if (updateType === 'initial') {
          this.onInitialState(market, update as BinanceConnectionTypes.Snapshot)
        } else {
          this.onOrderUpdate(market, update as BinanceConnectionTypes.OrderBookUpdate)
        }
      })
  }

  private onInitialState (market: MarketName, snapshot: BinanceConnectionTypes.Snapshot): void {
    if (!this.haveMarket(market)) {
      return
    }

    const orderBook: OrderBookState = { asks: [], bids: [] }
    for (const side of ['asks', 'bids']) {
      // TS
      for (const order of snapshot[side as Side]) {
        orderBook[side as Side].push({
          rate: +order[0],
          quantity: +order[1]
        })
      }
    }

    this.markets[market].onInitialState(orderBook)
  }

  private onOrderUpdate (market: MarketName, update: BinanceConnectionTypes.OrderBookUpdate): void {
    if (!this.haveMarket(market)) {
      return
    }

    const orderBookUpdate: OrderBookStateUpdate = { asks: [], bids: [] }
    for (const updateEntry of update.a) {
      const rate = +updateEntry[0]
      const quantity = +updateEntry[1]

      orderBookUpdate.asks.push({
        type: quantity > 0 ? 2 : 1,
        rate,
        quantity
      })
    }

    for (const updateEntry of update.b) {
      const rate = +updateEntry[0]
      const quantity = +updateEntry[1]

      orderBookUpdate.bids.push({
        type: quantity > 0 ? 2 : 1,
        rate,
        quantity
      })
    }

    this.markets[market].onUpdateExchangeState(orderBookUpdate)
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    const binanceMarket = standardMarketToBinanceMarket(market)
    this.marketsMap.set(binanceMarket, market)

    return this.conn.subscribe(binanceMarket)
  }
}
