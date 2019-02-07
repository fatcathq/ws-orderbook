import Streamer from './streamer'
import BinanceConnection from './binanceconnection'
import { MarketName } from './market'

export default class BinanceStreamer extends Streamer {
  constructor () {
    super('binance')
  }

  setupConn (): void {
    this.conn = new BinanceConnection()
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    return this.conn.subscribe(market)
  }
}
