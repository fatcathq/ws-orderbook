import cheerio from 'cheerio'
import axios from 'axios'
import { PoloniexPairChannels } from './poloniexstreamer'
const PoloniexMarkets: PoloniexPairChannels = require('../poloniexmarkets.json')

export default async function validateChannelIds (): Promise<void> {
  const { data: page } = await axios.get('https://docs.poloniex.com')
  const $ = cheerio.load(page)
  const tables = $('.content table')
  const pairsTable = $(tables[tables.length - 1])
  const pairIdElements = pairsTable.find('tr > td:nth-child(1)')
  const pairNameElements = pairsTable.find('tr > td:nth-child(2)')

  const pairs: PoloniexPairChannels = {}

  pairIdElements.each((index, element) => pairs[$(pairNameElements[index]).text()] = +$(element).text())
  pairs['BTC_BCHSV'] = 238 // temporary fix until Poloniex updates the docs

  if (JSON.stringify(pairs) !== JSON.stringify(PoloniexMarkets)) {
    throw new Error('Local poloniex pair ids don\'t match with the documentation.')
  }
}
