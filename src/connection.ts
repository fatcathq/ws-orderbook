import logger from 'logger'
import EventEmitter from 'events'
import delay from 'delay'

const RECONNECT_DELAY = 100
const DEFAULT_REFRESH_TIMEOUT = 1000 * 60 * 30 // every 30 mins

export default abstract class Connection extends EventEmitter {
  public awaitingClients: any[] = []
  public isConnected: boolean = false
  private refreshTimer!: NodeJS.Timer
  private aliveTimer!: NodeJS.Timer | null
  private RECONNECT_THROTTLE: number = RECONNECT_DELAY
  abstract subscribe (item: string | number): Promise<void>
  abstract call (method: string, ...args: any[]): Promise<any>
  protected abstract disconnect (): Promise<void>
  protected abstract connect (): void

  constructor (
    public readonly exchangeName: string,
    private readonly heartbeatTimeout: number | null = null,
    private readonly refreshTimeout: number = DEFAULT_REFRESH_TIMEOUT) {
    super()

    setTimeout(() => {
      this.connect()
      this.setRefreshTimer()
    }, 0) // wait for the constructors to run
  }

  connectionOpened = () => {
    logger.debug(`Connection opened with ${this.exchangeName}`)
    logger.debug(`Waiting clients: ${this.awaitingClients.length}`)
    this.isConnected = true
    this.RECONNECT_THROTTLE = RECONNECT_DELAY

    while (this.awaitingClients.length) {
      this.awaitingClients.pop().resolve()
    }
  }

  connectionFailed = () => {
    logger.error(`Connection failed with ${this.exchangeName}`)
    logger.debug(`Waiting clients: ${this.awaitingClients.length}`)
    this.isConnected = false

    while (this.awaitingClients.length) {
      this.awaitingClients.pop().reject()
    }
  }

  ready (): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve()
        return
      } else {
        this.awaitingClients.push({
          resolve,
          reject
        })
      }
    })
  }

  protected refreshConnection = async (reason: string, throttle = true): Promise<void> => {
    this.clearRefreshTimer()
    this.clearAliveTimer()

    const reconnect = async () => {
      if (throttle) {
        logger.debug(`[CONNECTION]: Reconnecting in ${this.RECONNECT_THROTTLE / 1000} seconds`)
        await delay(this.RECONNECT_THROTTLE)
        this.RECONNECT_THROTTLE *= 2
      }

      this.connect()
      this.setRefreshTimer()
    }

    logger.debug(`[CONNECTION]: Refreshing ${this.exchangeName} connection. Reason: ${reason}`)
    this.emit('connectionReset')

    await this.disconnect()
    this.isConnected = false
    await reconnect()
  }

  protected clearRefreshTimer (): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }
  }

  private setRefreshTimer (): void {
    this.clearRefreshTimer()

    this.refreshTimer = setTimeout(this.refreshConnection.bind(this, 'refresh', false), this.refreshTimeout)
  }

  protected clearAliveTimer (): void {
    if (this.aliveTimer) {
      clearTimeout(this.aliveTimer)
    }
  }

  protected alive (): void {
    this.clearAliveTimer()
    if (!this.isConnected || !this.heartbeatTimeout) {
      return
    }

    logger.debug(`[CONNECTION]: ${this.exchangeName} connection alive`)

    this.aliveTimer = setTimeout(this.refreshConnection.bind(this, 'alivetimeout'), this.heartbeatTimeout)
  }
}
