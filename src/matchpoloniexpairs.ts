import cheerio from 'cheerio'
import axios from 'axios'
import { PoloniexPairChannels } from './poloniexstreamer'
const PoloniexMarkets: PoloniexPairChannels = require('../poloniexmarkets.json')

;(async () => {
  const { data: page } = await axios.get('https://poloniex.com/support/api')
  const $ = cheerio.load(page)
  const pairsTable = $('.main table:last-child')
  const pairIdElements = pairsTable.find('tr > td:nth-child(1)')
  const pairNameElements = pairsTable.find('tr > td:nth-child(2)')

  const pairs: {[index: string]: string} = {}

  pairIdElements.each((index, element) => pairs[$(pairNameElements[index]).text()] = $(element).text())

  if (JSON.stringify(pairs) !== JSON.stringify(PoloniexMarkets)) {
    throw new Error('Saved poloniex pairs don\'t match with the documentation.')
  }
})().catch((err: any) => {
  console.log(err)
  process.exit(1)
})
