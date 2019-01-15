import WebSocket from 'ws'
import logger from './logger'
import Connection from './connection'

const HEARTBEAT_TIMEOUT_MS = 3000

export default class PoloniexConnection extends Connection {
  private client!: WebSocket
  private aliveTimeout: NodeJS.Timer | null
  private subscriptions: Set<number> = new Set()

  constructor () {
    super('poloniex')

    this.aliveTimeout = null
    this.connect()
  }

  private connect (): void {
    logger.debug('[POLONIEX]: Openning new connection')
    this.client = new WebSocket('wss://api2.poloniex.com')
    this.client.on('open', () => {
      this.alive()
      this.connectionOpened()
    })
    this.client.on('message', this.onMessage)
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

  private alive (): void {
    logger.debug('[POLONIEX]: Connection alive')
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    this.aliveTimeout = setTimeout(() => {
      logger.debug('[POLONIEX]: Connection died')
      // TODO: Retry connection
      this.connectionFailed()
      throw new Error('WebSocket connection with Poloniex died.')
    }, HEARTBEAT_TIMEOUT_MS)
  }
}
