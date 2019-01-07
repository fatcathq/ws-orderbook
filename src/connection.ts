export default abstract class Connection {
    public awaitingClients: any[] = []
    public isConnected: boolean = false
    abstract call(method: string, ...args: any[]): void
    abstract on(evt: string, cb: (str: any) => void): void

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
