import Streamer from './streamer'
import CobinhoodConnection/*, { CobinhoodConnectionTypes }*/ from './cobinhoodconnection'
import { MarketName } from './market'

export default class CobinhoodStreamer extends Streamer {
  constructor () { super('cobinhood') }

  setupConn (): void {
    this.conn = new CobinhoodConnection()

    this.conn.on('updateExchangeState', (message: any) => {
      console.log(message)
    })
  }

  subscribeToMarket (market: MarketName): Promise<void> {
    return this.conn.subscribe(market)
  }
}
