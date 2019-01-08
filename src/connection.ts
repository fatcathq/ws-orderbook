import EventEmitter from 'events'

export default abstract class Connection extends EventEmitter {
    public awaitingClients: any[] = []
    public isConnected: boolean = false
    abstract call(method: string, ...args: any[]): void

    connectionOpened = () => {
        this.isConnected = true

        let client
        while ((client = this.awaitingClients.pop()) !== undefined) {
            client.resolve()
        }
    }

    connectionFailed = () => {
        this.isConnected = false

        let client
        while ((client = this.awaitingClients.pop()) !== undefined) {
            client.reject()
        }
    }

    ready() {
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                resolve()
                return
            }
            else {
                this.awaitingClients.push({
                    resolve,
                    reject
                })
            }
        })
    }
}
