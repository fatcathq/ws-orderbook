import WebSocket from 'ws'
import logger from 'logger'
import Connection from './connection'
const { CWStreamClient } = require('cw-stream-client')
// const { StreamMessage } = require('../node_modules/cw-stream-client/dist/proto-builders.js')

const HEARTBEAT_TIMEOUT_MS = 1500

export default class CryptowatchConnection extends Connection {
  private client!: any
  // private subscriptions: Set<string> = new Set()
  // private channels: Map<number, string> = new Map()

  constructor () { super('cryptowatch', HEARTBEAT_TIMEOUT_MS) }

  protected disconnect (): Promise<void> {
    if (this.client && this.client.readyState !== WebSocket.CLOSED) {
      logger.debug('[CW]: Closing previous connection')

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
    this.client = new CWStreamClient({
      apiKey: 'UXU4C4S93SPA0H4YSAPO',
      secretKey: 'uT0iZo9XF0RMmD1MUGjVMOCwEc0qjTPc48qp73fB',
      subscriptions: [
        'markets:261:book:snapshots',
        'markets:261:book:deltas'
      ]
    })
    this.client.connect()

    logger.debug('[CW]: Openning new connection')
    // this.client.onError(this.refreshConnection.bind(this, 'connectionerror'))
    this.client.onConnect(() => {
      logger.debug('[CW]: Connection opened')
        /*
      this.subscriptions.forEach(pair => {
        logger.debug(`[KRAKEN]: Resubscribing to ${pair}`)
        this.subscribe(pair)
      })
         */

      this.alive()
      this.connectionOpened()
    })
    // this.client.conn.on('message', this.handleMessage.bind(this))
    this.client.onMarketUpdate((marketData: any) => {
      this.emit('updateExchangeState', marketData)
    })
  }

  subscribe (pair: string): Promise<void> {
    logger.debug(`[CW]: Subscribing to pair ${pair}`)
    /*
    this.subscriptions.add(pair)
    this.client.send(JSON.stringify({
      event: 'subscribe',
      pair: [pair],
      subscription: { name: 'book' }
    }))
     */

    return Promise.resolve()
  }

  call (): Promise<void> {
    throw new Error('[KRAKEN]: call() not implemented')
  }

    /*
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
  private handleMessage (data: any): void {
      // Heartbeat
    const bytes = new Uint8Array(data)
    if (bytes.length === 1 && bytes[0] === 1) {
      return
    }

    let message
    try {
      message = StreamMessage.decode(data)
    } catch (e) {
      console.log(e)
      return
    }

    console.log(message.body)
    switch (message.body) {
      case 'authenticationResult':
        this.client.authResultHandler(message.authenticationResult)
        break
      case 'marketUpdate':
        console.log('market update')
        console.log(message.marketUpdate.orderBookUpdate)
        break
      case 'pairUpdate':
        console.log('pair update')
        console.log(message.pairUpdate)
        break
      default:
        console.log('error')
    }
  }
    */
}
