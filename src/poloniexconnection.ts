import WebSocket from 'ws'
import logger from './logger'
import Connection from './connection'
import delay from 'delay'

const HEARTBEAT_TIMEOUT_MS = 1500
const RECONNECT_DELAY = 100

export default class PoloniexConnection extends Connection {
  private client!: WebSocket
  private aliveTimeout: NodeJS.Timer | null
  private subscriptions: Set<number> = new Set()
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY

  constructor () {
    super('poloniex')

    this.aliveTimeout = null
    this.connect()
  }

  private disconnect (): void {
    if (this.client) {
      logger.debug('[POLONIEX]: Closing previous connection')

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
    logger.debug('[POLONIEX]: Openning new connection')
    this.client = new WebSocket('wss://api2.poloniex.com')
    this.client.on('error', this.connectionDied)
    this.client.on('open', () => {
      logger.debug('[POLONIEX]: Connection opened')
      this.subscriptions.forEach(channel => {
        logger.debug(`[POLONIEX]: Resubscribing to ${channel}`)
        this.call('subscribe', { channel })
      })

      this.alive()
      this.connectionOpened()
    })
    this.client.on('message', this.onMessage)
  }

  subscribe (channel: number): Promise<void> {
    return this.call('subscribe', { channel })
  }

  call (method: string, options: any): Promise<void> {
    logger.debug(`[POLONIEX]: Sending ${method} command with options: ${JSON.stringify(options)}`)
    if (method === 'subscribe') {
      this.subscriptions.add(options.channel)
    }
    this.client.send(JSON.stringify(Object.assign({ command: method }, options)))
    return Promise.resolve()
  }

  private onMessage = (messageString: string): void => {
    this.alive()
    if (messageString === '[1010]') { // Heartbeat
      logger.debug('[POLONIEX]: Heartbeat')
      return
    }

    this.emit('updateExchangeState', JSON.parse(messageString))
  }

  private connectionDied = async (): Promise<void> => {
    logger.warn(`[POLONIEX]: Connection died. Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
    this.emit('connectionError')
    this.isConnected = false
    this.disconnect()

    await delay(this.RECONNECT_THROTTLE)
    this.RECONNECT_THROTTLE *= 2

    this.connect()
  }

  private alive (): void {
    logger.debug('[POLONIEX]: Connection alive')
    this.RECONNECT_THROTTLE = RECONNECT_DELAY
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    this.aliveTimeout = setTimeout(this.connectionDied, HEARTBEAT_TIMEOUT_MS)
  }
}
