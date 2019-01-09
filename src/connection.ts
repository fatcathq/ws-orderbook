import EventEmitter from 'events'

export default abstract class Connection extends EventEmitter {
  public awaitingClients: any[] = []
  public isConnected: boolean = false
  abstract call (method: string, ...args: any[]): void

  connectionOpened = () => {
    this.isConnected = true

    while (this.awaitingClients.length) {
      this.awaitingClients.pop().client.resolve()
    }
  }

  connectionFailed = () => {
    this.isConnected = false

    while (this.awaitingClients.length) {
      this.awaitingClients.pop().client.reject()
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
