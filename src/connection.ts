import logger from 'logger'
import EventEmitter from 'events'

export default abstract class Connection extends EventEmitter {
  public awaitingClients: any[] = []
  public isConnected: boolean = false
  abstract subscribe (item: string | number): Promise<void>
  abstract call (method: string, ...args: any[]): Promise<any>

  constructor (public readonly exchangeName: string) {
    super()
  }

  connectionOpened = () => {
    logger.debug(`Connection opened with ${this.exchangeName}`)
    logger.debug(`Waiting clients: ${this.awaitingClients.length}`)
    this.isConnected = true

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
}
