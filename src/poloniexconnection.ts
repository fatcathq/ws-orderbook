import WebSocket from 'ws'
import logger from 'logger'
import Connection from './connection'
import delay from 'delay'

const HEARTBEAT_TIMEOUT_MS = 1500
const RECONNECT_DELAY = 100
const REFRESH_TIMEOUT = 1000 * 60 * 30 // every 30 mins

export default class PoloniexConnection extends Connection {
  private client!: WebSocket
  private refreshTimeout!: NodeJS.Timer
  private aliveTimeout: NodeJS.Timer | null
  private subscriptions: Set<number> = new Set()
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY

  constructor () {
    super('poloniex')

    this.aliveTimeout = null
    this.connect()
  }

  private disconnect (): boolean {
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[POLONIEX]: Closing previous connection')

      try {
        this.client.off('message', this.onMessage)
        this.client.off('error', this.connectionDied)
        this.client.close()

        return true
      } catch (err) {
        logger.warn(err.message, err)
      }
    } else {
      logger.debug('[POLONIEX]: Connection already closed or not available')
    }

    return true
  }

  private connect = (): void => {
    logger.debug('[POLONIEX]: Openning new connection')
    if (this.client) {
      logger.debug(`[POLONIEX]: Client status: ${this.client.readyState}`)
    }
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
    this.setRefreshTimer()
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
    logger.debug(`[POLONIEX]: Connection died. Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
    this.emit('connectionReset')
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

  private refreshConnection = (): void => {
    logger.debug(`[POLONIEX]: Refreshing connection`)
    this.emit('connectionReset')
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    if (this.disconnect()) {
      // wait for the previous connection to close
      this.client.on('close', this.connect)
    } else {
      this.connect()
    }
  }

  private setRefreshTimer (): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    this.refreshTimeout = setTimeout(this.refreshConnection, REFRESH_TIMEOUT)
  }
}
