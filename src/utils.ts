import Decimal from 'decimal.js'

function increasingOrderCompare (a: Decimal, b: Decimal): number {
  if (a.eq(b)) return 0
  if (a.lt(b)) return -1
  else return 1
}

function decreasingOrderCompare (a: Decimal, b: Decimal): number {
  return -increasingOrderCompare(a, b)
}

export {
  increasingOrderCompare,
  decreasingOrderCompare
}
