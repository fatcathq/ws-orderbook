import logger from 'logger'
import Streamer from './streamer'
import BittrexStreamer from './bittrexstreamer'
import PoloniexStreamer from './poloniexstreamer'
import KrakenStreamer from './krakenstreamer'
import BinanceStreamer from './binancestreamer'

export default function streamerFactory (exchangeName: string): Streamer {
  logger.debug(`New ${exchangeName} streamer`)
  switch (exchangeName) {
    case 'bittrex':
      return new BittrexStreamer()
    case 'poloniex':
      return new PoloniexStreamer()
    case 'kraken':
      return new KrakenStreamer()
    case 'binance':
      return new BinanceStreamer()
    default:
      throw new Error(`No streamer for ${exchangeName}`)
  }
}
