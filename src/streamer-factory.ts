import logger from 'logger'
import Streamer from './streamer'
import BittrexStreamer from './bittrexstreamer'
  /*
import PoloniexStreamer from './poloniexstreamer'
import KrakenStreamer from './krakenstreamer'
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
      // return new PoloniexStreamer()
      return new CryptowatchStreamer('poloniex')
    case 'cobinhood':
      return new CobinhoodStreamer()
    case 'kraken':
      // return new KrakenStreamer()
      return new CryptowatchStreamer('kraken')
    case 'binance':
      // return new BinanceStreamer()
      return new CryptowatchStreamer('binance')
    default:
      throw new Error(`No streamer for ${exchangeName}`)
  }
}
