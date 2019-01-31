import WebSocket from 'ws'
import logger from './logger'
import Connection from './connection'
import delay from 'delay'

const HEARTBEAT_TIMEOUT_MS = 1500
const RECONNECT_DELAY = 100

export default class KrakenConnection extends Connection {
  private client!: WebSocket
  private aliveTimeout: NodeJS.Timer | null
  private subscriptions: Set<string> = new Set()
  private channels: Map<number, string> = new Map()
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY

  constructor () {
    super('kraken')

    this.aliveTimeout = null
    this.connect()
  }

  private disconnect (): void {
    if (this.client) {
      logger.debug('[KRAKEN]: Closing previous connection')

      try {
        this.client.off('message', this.onMessage)
        this.client.off('error', this.connectionDied)
        this.client.close()
      } catch (err) {
        logger.debug(err.message, err)
      }
    }
  }

  private connect (): void {
    logger.debug('[KRAKEN]: Openning new connection')
    this.client = new WebSocket('wss://ws.kraken.com')
    this.client.on('error', this.connectionDied)
    this.client.on('open', () => {
      logger.debug('[KRAKEN]: Connection opened')
      this.subscriptions.forEach(pair => {
        logger.debug(`[KRAKEN]: Resubscribing to ${pair}`)
        this.subscribe(pair)
      })

      this.alive()
      this.connectionOpened()
    })
    this.client.on('message', this.onMessage)
  }

  subscribe (pair: string): Promise<void> {
    logger.debug(`[KRAKEN]: Subscribing to pair ${pair}`)
    this.subscriptions.add(pair)
    this.client.send(JSON.stringify({
      event: 'subscribe',
      pair: [pair],
      subscription: { name: 'book' }
    }))

    return Promise.resolve()
  }

  call (): Promise<void> {
    throw new Error('[KRAKEN]: call() not implemented')
  }

  private onMessage = (messageString: string): void => {
    this.alive()
    const message = JSON.parse(messageString)
    if (message.event) {
      logger.debug(`[KRAKEN]: Received ${message.event}`)
      if (message.event === 'subscriptionStatus') {
        this.channels.set(message.channelID, message.pair)
      } else if (message.event === 'systemStatus' && message.status !== 'online') {
        logger.warn(`[KRAKEN]: Received system status ${message.status}`)
      }
      return
    }

    message.splice(1, 0, this.channels.get(message[0]))
    this.emit('updateExchangeState', message)
  }

  private connectionDied = async (): Promise<void> => {
    logger.warn(`[KRAKEN]: Connection died. Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
    this.emit('connectionError')
    this.isConnected = false
    this.disconnect()

    await delay(this.RECONNECT_THROTTLE)
    this.RECONNECT_THROTTLE *= 2

    this.connect()
  }

  private alive (): void {
    logger.debug('[KRAKEN]: Connection alive')
    this.RECONNECT_THROTTLE = RECONNECT_DELAY
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    this.aliveTimeout = setTimeout(this.connectionDied, HEARTBEAT_TIMEOUT_MS)
  }
}
