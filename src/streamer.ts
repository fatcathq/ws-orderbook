import Market, { MarketName } from './market'

export default abstract class Streamer {
  protected markets: {[id: string]: any} = {}
  protected conn: any
  protected exchange: any

  abstract setupConn (): void
  abstract subscribeToMarket (market: MarketName): void

  constructor (public readonly exchangeName: string) {
    this.setupConn()
  }

  public market (market: MarketName): Market {
    if (!this.haveMarket(market)) {
            // create market now
      this.markets[market] = new Market(market)
      this.conn
                .ready()
                .then(() => this.subscribeToMarket(market))
    }
    return this.markets[market]
  }

  public haveMarket (market: MarketName): boolean {
    return this.markets.hasOwnProperty(market)
  }
}
