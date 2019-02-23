import WebSocket from 'ws'
import logger from 'logger'
import Connection from './connection'

const HEARTBEAT_TIMEOUT_MS = 1500

export default class KrakenConnection extends Connection {
  private client!: WebSocket
  private subscriptions: Set<string> = new Set()
  private channels: Map<number, string> = new Map()

  constructor () { super('kraken', HEARTBEAT_TIMEOUT_MS) }

  protected disconnect (): Promise<void> {
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[KRAKEN]: Closing previous connection')

      return new Promise((resolve) => {
        try {
          this.client.removeEventListener('message')
          this.client.removeEventListener('off')
          this.client.on('close', resolve)
          this.client.close()
        } catch (err) {
          logger.debug(err.message, err)

          this.client.off('close', resolve)
          resolve()
        }
      })
    }

    return Promise.resolve()
  }

  protected connect (): void {
    logger.debug('[KRAKEN]: Openning new connection')
    this.client = new WebSocket('wss://ws.kraken.com')
    this.client.on('error', this.refreshConnection.bind(this, 'connectionerror'))
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
}
