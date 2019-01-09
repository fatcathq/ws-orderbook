# ws-orderbook

## Installation

```
npm install ws-orderbook
```

## Usage

```javascript
const Streamer = require('ws-orderbook');
const bittrexStreamer = Streamer('bittrex');

bittrexStreamer.market('BTC-XMR').on('bidUpdate', (market) => {
    console.log('XMR bids', market.bids.top(5));
});
bittrexStreamer.market('BTC-ETH').on('askUpdate', (market) => {
    console.log('ETH asks', market.asks.top(5));
});
```

### Supported Exchanges
* Bittrex
* Poloniex
