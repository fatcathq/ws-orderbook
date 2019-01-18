import logger from './logger'
import Market, { MarketName } from './market'
import Connection from './connection'

export default abstract class Streamer {
  protected markets: {[id: string]: Market} = {}
  protected conn!: Connection

  abstract setupConn (): void
  abstract subscribeToMarket (market: MarketName): void

  constructor (public readonly exchangeName: string) {
    logger.debug(`Setting up connection with ${this.exchangeName}.`)
    this.setupConn()
  }

  public market (market: MarketName): Market {
    if (!this.haveMarket(market)) {
      logger.debug(`Listen on market ${market} of ${this.exchangeName}`)
      // create market now
      this.markets[market] = new Market(market)
      this.conn
        .ready()
        .then(() => {
          this.conn.on('connectionError', this.markets[market].voidOrderBook)
          return this.subscribeToMarket(market)
        })
        .catch((err: any) => {
          logger.error(err.message, err)
          process.exit(1)
        })
    }
    return this.markets[market]
  }

  public haveMarket (market: MarketName): boolean {
    return this.markets.hasOwnProperty(market)
  }
}
