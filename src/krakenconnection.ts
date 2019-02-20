import WebSocket from 'ws'
import logger from 'logger'
import Connection from './connection'
import delay from 'delay'

const HEARTBEAT_TIMEOUT_MS = 1500
const RECONNECT_DELAY = 100
const REFRESH_TIMEOUT = 1000 * 60 * 30 // every 30 mins

export default class KrakenConnection extends Connection {
  private client!: WebSocket
  private aliveTimeout: NodeJS.Timer | null
  private refreshTimeout!: NodeJS.Timer
  private subscriptions: Set<string> = new Set()
  private channels: Map<number, string> = new Map()
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY

  constructor () {
    super('kraken')

    this.aliveTimeout = null
    this.connect()
  }

  private disconnect (): boolean {
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[KRAKEN]: Closing previous connection')

      try {
        this.client.off('message', this.onMessage)
        this.client.off('error', this.refreshConnection)
        this.client.close()

        return true
      } catch (err) {
        logger.debug(err.message, err)
      }
    }

    return false
  }

  private connect (): void {
    logger.debug('[KRAKEN]: Openning new connection')
    this.client = new WebSocket('wss://ws.kraken.com')
    this.client.on('error', this.refreshConnection)
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
    this.setRefreshTimer()
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

  private refreshConnection = async (throttle = false): Promise<void> => {
    logger.debug(`[KRAKEN]: Refreshing connection.`)
    this.emit('connectionReset')
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }
    this.isConnected = false

    const reconnect = async () => {
      if (throttle) {
        logger.debug(`[KRAKEN]: Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
        await delay(this.RECONNECT_THROTTLE)
        this.RECONNECT_THROTTLE *= 2
      }

      this.connect()
    }

    if (this.disconnect()) {
      this.client.on('close', reconnect)
    } else {
      await reconnect()
    }
  }

  private alive (): void {
    logger.debug('[KRAKEN]: Connection alive')
    this.RECONNECT_THROTTLE = RECONNECT_DELAY
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    this.aliveTimeout = setTimeout(this.refreshConnection.bind(this, true), HEARTBEAT_TIMEOUT_MS)
  }

  private setRefreshTimer (): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    this.refreshTimeout = setTimeout(this.refreshConnection, REFRESH_TIMEOUT)
  }
}
