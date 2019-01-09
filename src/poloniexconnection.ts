import WebSocket from 'ws'
import Connection from './connection'

const HEARTBEAT_TIMEOUT_MS = 1500

export default class PoloniexConnection extends Connection {
  private client: WebSocket
  private aliveTimeout: NodeJS.Timer | null

  constructor () {
    super()

    this.aliveTimeout = null

    this.client = new WebSocket('wss://api2.poloniex.com')
    this.client.on('open', () => {
      this.alive()
      this.connectionOpened()
    })
    this.client.on('message', this.onMessage)
  }

  call (method: string, options: any): void {
    this.client.send(JSON.stringify(Object.assign({ command: method }, options)))
  }

  private onMessage = (messageString: any): void => {
    this.alive()
    if (messageString === '[1010]') { // Heartbeat
      return
    }

    this.emit('updateExchangeState', JSON.parse(messageString))
  }

  private alive (): void {
    if (this.aliveTimeout) {
      clearTimeout(this.aliveTimeout)
    }

    this.aliveTimeout = setTimeout(() => {
            // TODO: Retry connection
      this.connectionFailed()
      throw new Error('WebSocket connection with Poloniex died.')
    }, HEARTBEAT_TIMEOUT_MS)
  }
}
