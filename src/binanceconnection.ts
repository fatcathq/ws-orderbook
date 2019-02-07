import logger from 'logger'
import delay from 'delay'
import WebSocket from 'ws'
import Connection from './connection'

const BASE_URL = 'wss://stream.binance.com:9443'
const RECONNECT_DELAY = 100

export default class BinanceConnection extends Connection {
  private client !: WebSocket
  private subscriptions: Set<string> = new Set()
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY

  constructor () {
    super('binance')

    // TODO: not really accurate since we
    // didn't open any connection
    this.connectionOpened()
  }

  subscribe (item: string): Promise<void> {
    logger.debug(`[BINANCE]: Subscribing to ${item}`)
    this.subscriptions.add(item)

    if (this.disconnect()) {
      // wait for the previous connection to close
      this.client.on('close', this.connect)
    } else {
      this.connect()
    }

    return Promise.resolve()
  }

  private disconnect (): boolean {
    this.emit('connectionReset')
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[BINANCE]: Closing previous connection')

      try {
        this.client.off('message', this.onMessage)
        this.client.off('error', this.connectionDied)
        this.client.close()

        return true
      } catch (err) {
        logger.warn(err.message, err)
      }
    }
    return false
  }

  private connect = (): void => {
    logger.debug(`[BINANCE]: Connecting to socket`)
    const stream: Array<string> = []
    this.subscriptions.forEach((subscription: string) => stream.push(`${subscription}@depth`))

    logger.debug(`[BINANCE]: Streams: ${stream.join('/')}`)
    this.client = new WebSocket(`${BASE_URL}/stream?streams=${stream.join('/')}`)
    this.client.on('error', this.connectionDied)
    this.client.on('open', () => {
      logger.debug(`[BINANCE]: Connection open`)
    })
    this.client.on('message', this.onMessage)
  }

  private onMessage = (messageString: string): void => {
    console.log(JSON.parse(messageString).stream)
  }

  private connectionDied = async (): Promise<void> => {
    logger.warn(`[BINANCE]: Connection died. Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
    this.emit('connectionReset')
    this.isConnected = false
    this.disconnect()

    await delay(this.RECONNECT_THROTTLE)
    this.RECONNECT_THROTTLE *= 2

    this.connect()
  }

  call (): Promise<void> {
    throw new Error('[BINANCE]: call() implemented')
  }
}
