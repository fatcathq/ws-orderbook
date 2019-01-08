import BittrexStreamer from './bittrexstreamer'
import PoloniexStreamer from './poloniexstreamer'

export default function streamerFactory(exchangeName: string) {
    switch (exchangeName) {
    case 'bittrex':
        return new BittrexStreamer()
    case 'poloniex':
        return new PoloniexStreamer()
    default:
        throw new Error(`No streamer for ${exchangeName}`)
    }
}
