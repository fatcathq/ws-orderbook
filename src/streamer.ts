import BittrexConnection from './bittrexconnection'
import { marketFactory, MarketName } from './market'

abstract class Streamer {
    protected markets: {[id: string]: any} = {}
    protected conn: any
    protected exchange: any

    abstract setupConn(): void
    abstract subscribeToMarket(market: MarketName): void
    abstract getInitialState(market: MarketName): void

    constructor (public readonly exchangeName: string) {}

    public market(market: MarketName) {
        if (!this.haveMarket(market)) {
            // create market now
            this.markets[market] = marketFactory(this.exchangeName, market)
            this.conn
                .ready()
                .then(() => this.getInitialState(market))
                .then(() => this.subscribeToMarket(market))
        }
        return this.markets[market]
    }

    public haveMarket(market: MarketName): boolean {
        return this.markets.hasOwnProperty(market)
    }
}

class BittrexStreamer extends Streamer {
    constructor () {
        super('bittrex')

        this.setupConn()
    }

    setupConn () {
        this.conn = new BittrexConnection()

        this.conn.on('updateExchangeState', (update: any) => {
            const market = update.MarketName
            if (this.haveMarket(market)) {
                this.markets[market].onUpdateExchangeState(update)
            }
        })
    }

    subscribeToMarket(market: MarketName) {
        return this.conn.call('SubscribeToExchangeDeltas', market)
    }

    getInitialState(market: MarketName) {
        if (this.haveMarket(market)) {
            return this.conn
                .call('QueryExchangeState', market)
                .then(this.markets[market].onInitialState)
        }
    }
}

export default function streamerFactory(exchangeName: string) {
    switch (exchangeName) {
    case 'bittrex':
        return new BittrexStreamer()
    default:
        throw new Error(`No streamer for ${exchangeName}`)
    }
}
