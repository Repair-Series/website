const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
]

function belowThousand(value) {
  const number = Math.floor(value)
  const words = []
  if (number >= 100) {
    words.push(`${ONES[Math.floor(number / 100)]} Hundred`)
  }
  const rest = number % 100
  if (rest > 0 && rest < 20) words.push(ONES[rest])
  if (rest >= 20) {
    words.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`)
  }
  return words.join(' ')
}

function integerInIndianWords(value) {
  let number = Math.max(0, Math.floor(value))
  if (number === 0) return 'Zero'

  const parts = []
  const crore = Math.floor(number / 10000000)
  number %= 10000000
  const lakh = Math.floor(number / 100000)
  number %= 100000
  const thousand = Math.floor(number / 1000)
  const remainder = number % 1000

  if (crore) parts.push(`${integerInIndianWords(crore)} Crore`)
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`)
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`)
  if (remainder) parts.push(belowThousand(remainder))
  return parts.join(' ')
}

function amountInWords(amount) {
  const numeric = Number(amount)
  const safeAmount = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
  let rupees = Math.floor(safeAmount)
  let paise = Math.round((safeAmount - rupees) * 100)
  if (paise === 100) {
    rupees += 1
    paise = 0
  }

  const rupeeWords = integerInIndianWords(rupees)
  const paiseWords = paise ? ` and ${integerInIndianWords(paise)} Paise` : ''
  return `Rupees ${rupeeWords}${paiseWords} Only`
}

module.exports = { amountInWords }
