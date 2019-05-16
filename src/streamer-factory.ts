import logger from 'logger'
import Streamer from './streamer'
import BittrexStreamer from './bittrexstreamer'
import PoloniexStreamer from './poloniexstreamer'
  /*
import BinanceStreamer from './binancestreamer'
   */
import CryptowatchStreamer from './cryptowatchstreamer'
import CobinhoodStreamer from './cobinhoodstreamer'

export default function streamerFactory (exchangeName: string): Streamer {
  logger.debug(`New ${exchangeName} streamer`)
  switch (exchangeName) {
    case 'bittrex':
      return new BittrexStreamer()
    case 'poloniex':
      return new PoloniexStreamer()
    case 'cobinhood':
      return new CobinhoodStreamer()
    case 'kraken':
      return new CryptowatchStreamer('kraken')
    case 'binance':
      // return new BinanceStreamer()
      return new CryptowatchStreamer('binance')
    case 'bitfinex':
      return new CryptowatchStreamer('bitfinex')
    default:
      throw new Error(`No streamer for ${exchangeName}`)
  }
}
