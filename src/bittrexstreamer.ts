import logger from 'logger'
import Streamer from './streamer'
import BittrexConnection, { BittrexConnectionTypes } from './bittrexconnection'
import { OrderBookState, OrderBookStateUpdate, OrderEvent, OrderBookRecord } from './orderbook'
import { MarketName } from './market'
import Decimal from 'decimal.js'

const formatOrderKeys =
  ({ Rate, Quantity }: BittrexConnectionTypes.Order): OrderBookRecord =>
    ({ rate: new Decimal(Rate), quantity: new Decimal(Quantity) })
const formatOrderUpdateKeys =
  ({ Type, Rate, Quantity }: BittrexConnectionTypes.OrderUpdate): OrderEvent =>
    ({ type: Type, rate: new Decimal(Rate), quantity: new Decimal(Quantity) })

export default class BittrexStreamer extends Streamer {
  constructor () {
    super('bittrex')
  }

  setupConn (): void {
    this.conn = new BittrexConnection()

    this.conn.on('updateExchangeState', (
      updateType: BittrexConnectionTypes.UpdateType,
      bittrexMarket: MarketName,
      update: BittrexConnectionTypes.Snapshot | BittrexConnectionTypes.OrderBookUpdate) => {
      const [ currency, asset ] = bittrexMarket.split('-')
      const market = `${asset}/${currency}`

      if (updateType === 'initial') {
        this.onInitialState(market, update as BittrexConnectionTypes.Snapshot)
      } else {
        this.onOrderUpdate(market, update as BittrexConnectionTypes.OrderBookUpdate)
      }
    })
  }

  private onInitialState (market: MarketName, snapshot: BittrexConnectionTypes.Snapshot): void {
    if (!this.haveMarket(market)) {
      return
    }

    const orderBookState: OrderBookState = {
      asks: snapshot.Sells.map(formatOrderKeys),
      bids: snapshot.Buys.map(formatOrderKeys)
    }

    this.markets[market].onInitialState(orderBookState)
  }

  private onOrderUpdate (market: MarketName, update: BittrexConnectionTypes.OrderBookUpdate): void {
    if (!this.haveMarket(market)) {
      return
    }

    const orderBookUpdate: OrderBookStateUpdate = {
      asks: update.Sells.map(formatOrderUpdateKeys),
      bids: update.Buys.map(formatOrderUpdateKeys)
    }

    this.markets[market].onUpdateExchangeState(orderBookUpdate)
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    const [ asset, currency ] = market.split('/')
    const bittrexMarket = `${currency}-${asset}`

    logger.debug(`[BITTREX]: Subscribing to market ${bittrexMarket}`)
    return this.conn.subscribe(bittrexMarket)
  }
}
