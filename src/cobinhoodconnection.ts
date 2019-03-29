import logger from 'logger'
import WebSocket from 'ws'
import Connection from './connection'

const BASE_URL = 'wss://ws.cobinhood.com/v2/ws'
const PING_INTERVAL = 1000 * 20

export namespace CobinhoodConnectionTypes {
  type OrderBookEntry = [string, string, string]

  export type OrderBookData = {
    asks: Array<OrderBookEntry>,
    bids: Array<OrderBookEntry>
  }

  export type UpdateType = 'initial' | 'delta'

  export type Message = {
    h: [string, string, 'subscribed' | 's' | 'u' | 'pong' | 'error'],
    d: OrderBookData
  }
}

export default class CobinhoodConnection extends Connection {
  private client!: WebSocket
  private subscriptions: Set<string> = new Set()
  private pingInterval: any = null

  constructor () { super('cobinhood') }

  protected connect (): void {
    logger.debug(`[COBINHOOD]: Connecting to socket`)
    this.client = new WebSocket(BASE_URL)

    this.client.on('error', this.refreshConnection.bind(this, 'connectionerror'))
    this.client.on('open', () => {
      logger.debug(`[COBINHOOD]: Connection open`)
      // TODO: Error handling
      this.subscriptions.forEach(pair => {
        logger.debug(`[COBINHOOD]: Resubscribing to ${pair}`)
        this.subscribe(pair)
      })

      this.alive()
      this.setPingInterval(PING_INTERVAL)
      this.connectionOpened()
    })

    this.client.on('message', (m: string) => this.onMessage(JSON.parse(m)))
  }

  protected disconnect (): Promise<void> {
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[COBINHOOD]: Closing previous connection')

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

  private onMessage (message: CobinhoodConnectionTypes.Message): void {
    this.alive()

    const type = message.h[2]
    if (type === 'error') {
      logger.warn(`Message was errored ${JSON.stringify(message)}`)
      return
    }

    const market = message.h[0].split('.')[1].replace('-', '/')

    switch (type) {
      case 's':
        this.emit('updateExchangeState', 'initial', market, message.d)
        break
      case 'u':
        this.emit('updateExchangeState', 'delta', market, message.d)
        break
      case 'pong':
        logger.debug('[COBINHOOD] Ponged')
        break
    }
  }

  subscribe (pair: string): Promise<void> {
    logger.debug(`[COBINHOOD]: Subscribing to pair ${pair}`)
    this.subscriptions.add(pair)
    this.client.send(JSON.stringify({
      action: 'subscribe',
      type: 'order-book',
      trading_pair_id: pair
    }))

    return Promise.resolve()
  }

  private setPingInterval (ms: number): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    this.pingInterval = setInterval(this.ping.bind(this), ms)
  }

  private ping (): void {
    this.client.send(JSON.stringify({
      action: 'ping'
    }))
  }

  call (): Promise<void> {
    throw new Error('[COBINHOOD]: call() implemented')
  }
}
