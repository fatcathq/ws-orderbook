import WebSocket from 'ws'
import logger from 'logger'
import Connection from './connection'

const HEARTBEAT_TIMEOUT_MS = 1500

export default class PoloniexConnection extends Connection {
  private client!: WebSocket
  private subscriptions: Set<number> = new Set()

  constructor () { super('poloniex', HEARTBEAT_TIMEOUT_MS) }

  protected disconnect (): Promise<void> {
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[POLONIEX]: Closing previous connection')

      return new Promise((resolve) => {
        try {
          this.client.removeEventListener('message')
          this.client.removeEventListener('error')
          this.client.on('close', resolve)
          this.client.close()
        } catch (err) {
          logger.warn(err.message, err)

          this.client.off('close', resolve)
          resolve()
        }
      })
    }

    logger.debug('[POLONIEX]: Connection already closed or not available')
    return Promise.resolve()
  }

  protected connect (): void {
    logger.debug('[POLONIEX]: Openning new connection')
    if (this.client) {
      logger.debug(`[POLONIEX]: Client status: ${this.client.readyState}`)
    }
    this.client = new WebSocket('wss://api2.poloniex.com')
    this.client.on('error', this.refreshConnection.bind(this, 'connectionerror'))
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
}
