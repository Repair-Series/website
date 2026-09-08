const { amountInWords } = require('./amountInWords')
const {
  normalizeInvoiceSettings,
  formatCompanyAddress,
} = require('./defaults')

function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.round(number * 100) / 100
}

function cleanText(value, fallback = '') {
  const text = value != null ? String(value).trim() : ''
  return text || fallback
}

function toDate(value) {
  if (!value) return null
  if (value.toDate && typeof value.toDate === 'function') {
    try {
      return value.toDate()
    } catch {
      return null
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateLabel(value) {
  const date = toDate(value)
  if (!date) return ''
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatYmd(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function addressText(value) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const full = cleanText(value.fullAddress ?? value.address)
  if (full) return full
  return [
    value.line1,
    value.line2,
    value.landmark,
    value.city,
    value.state,
    value.pincode ?? value.zip,
  ]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(', ')
}

function invoiceLine(title, quantity, rate) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
  const safeRate = money(rate)
  return {
    title: cleanText(title, 'Service'),
    quantity: safeQuantity,
    rate: safeRate,
    amount: money(safeQuantity * safeRate),
  }
}

function mapServiceLines(items, fallbackTitle) {
  if (!Array.isArray(items)) return []
  return items.map((raw) => {
    const item = raw && typeof raw === 'object' ? raw : {}
    return invoiceLine(
      item.title ?? item.serviceName ?? item.name ?? fallbackTitle,
      item.quantity,
      item.price ?? item.rate ?? item.amount,
    )
  })
}

function payableFromBooking(booking) {
  const stored = money(
    booking.finalBookingAmount ?? booking.totalAmount ?? booking.payableAmount,
  )
  if (stored > 0) return stored
  const base = money(booking.amount ?? booking.baseAmount ?? booking.serviceAmount)
  const visiting = money(booking.visitingCharge)
  const addOns = mapServiceLines(booking.addOnServices, 'Add-on')
  const additional = mapServiceLines(booking.additionalServices, 'Additional service')
  const extras = [...addOns, ...additional].reduce((sum, line) => sum + line.amount, 0)
  return money(base + visiting + extras)
}

function buildLines(booking) {
  const baseAmount = money(
    booking.baseAmount ?? booking.amount ?? booking.serviceAmount,
  )
  const lines = [
    invoiceLine(booking.serviceName || 'Service', 1, baseAmount),
    ...mapServiceLines(booking.addOnServices, 'Add-on'),
    ...mapServiceLines(booking.additionalServices, 'Additional service'),
  ]
  const visitingCharge = money(booking.visitingCharge)
  if (visitingCharge > 0) {
    lines.push(invoiceLine('Visiting charge', 1, visitingCharge))
  }
  return lines.filter((line) => line.amount > 0 || line.title)
}

function paymentMethodLabel(method) {
  const key = cleanText(method).toLowerCase()
  if (!key) return 'Cash / UPI / Card'
  if (key === 'rs_app') return 'RS App'
  if (key === 'upi') return 'UPI'
  if (key === 'qr') return 'QR / UPI'
  if (key === 'cash') return 'Cash'
  if (key === 'card') return 'Card'
  if (key === 'free' || key === 'free_revisit') return 'Free / Revisit'
  return cleanText(method)
}

/**
 * Builds the canonical invoice payload used for PDF + Firestore.
 * Grand total matches what the customer paid (GST treated as inclusive when percent > 0).
 */
function buildInvoiceData({ booking, bookingId, settingsRaw, forceInvoiceNumber }) {
  const settings = normalizeInvoiceSettings(settingsRaw || {})
  const lines = buildLines(booking)
  const lineSubtotal = money(lines.reduce((sum, line) => sum + line.amount, 0))
  const grandTotal = payableFromBooking(booking)
  const gstPercent = Math.min(100, money(settings.gstPercent))
  const taxableTotal =
    gstPercent > 0 ? money(grandTotal / (1 + gstPercent / 100)) : grandTotal
  const gstAmount = money(grandTotal - taxableTotal)
  const explicitDiscount = money(
    booking.discountAmount ?? booking.couponDiscount ?? booking.discount,
  )
  const subtotal = Math.max(lineSubtotal, money(taxableTotal + explicitDiscount))
  const discount = Math.max(explicitDiscount, money(subtotal - taxableTotal))

  const bookingCode = cleanText(booking.bookingCode)
  const now = new Date()
  const ymd = formatYmd(now)
  const shortId = bookingId.slice(-8).toUpperCase()
  const invoiceNumber =
    cleanText(forceInvoiceNumber) ||
    `${settings.invoicePrefix}-${ymd}-${shortId}`
  const fileName = `INV-${ymd}-${bookingId}.pdf`
  const folder = `repair-series/invoices/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`

  const paymentStatus = cleanText(booking.paymentStatus).toLowerCase() || 'paid'
  const isFree =
    booking.isRevisit === true ||
    booking.revisit === true ||
    paymentStatus === 'free' ||
    grandTotal === 0

  return {
    invoiceId: `inv_${bookingId}`,
    invoiceNumber,
    fileName,
    folder,
    publicId: `${folder}/${fileName.replace(/\.pdf$/i, '')}`,
    bookingId,
    bookingCode,
    customerId: cleanText(booking.customerId),
    technicianId: cleanText(booking.technicianId),
    customerName: cleanText(booking.customerName, 'Customer'),
    customerPhone: cleanText(booking.customerPhone ?? booking.phone),
    customerEmail: cleanText(booking.customerEmail),
    customerAddress: addressText(booking.address ?? booking.location),
    serviceName: cleanText(booking.serviceName, 'Service'),
    technicianName: cleanText(
      booking.technicianName ?? booking.technician?.name,
    ),
    bookingDate: formatDateLabel(booking.createdAt ?? booking.bookingDate),
    serviceDate: formatDateLabel(
      booking.completedAt ?? booking.serviceCompletedAt ?? booking.scheduledAt,
    ),
    invoiceDate: formatDateLabel(now),
    paymentDate: formatDateLabel(booking.paidAt ?? booking.completedAt ?? now),
    paymentMethod: paymentMethodLabel(
      booking.paymentMethod || (isFree ? 'free_revisit' : ''),
    ),
    paymentStatus: isFree ? 'free' : paymentStatus || 'paid',
    paymentId: cleanText(
      booking.paymentId ??
        booking.razorpayPaymentId ??
        booking.txnId ??
        booking.transactionId,
    ),
    lines,
    subtotal: money(subtotal),
    discount: money(discount),
    gstPercent,
    gstAmount,
    grandTotal: money(grandTotal),
    amountInWords: amountInWords(grandTotal),
    currency: 'INR',
    isRevisit: booking.isRevisit === true || booking.revisit === true,
    status: 'issued',
    source: 'cloud_function',
    companyName: settings.companyName,
    companyAddress: formatCompanyAddress(settings),
    companyPhone: settings.phone,
    companyEmail: settings.email,
    gstin: settings.gstin,
    upiId: settings.upiId,
    terms: settings.terms,
    thankYouMessage: settings.thankYouMessage,
    logoUrl: settings.logoUrl,
    settings,
  }
}

function shouldGenerateInvoice(booking) {
  const status = cleanText(booking?.status).toLowerCase()
  if (status !== 'completed') return false
  const paymentStatus = cleanText(booking?.paymentStatus).toLowerCase()
  if (paymentStatus === 'paid' || paymentStatus === 'free') return true
  const total = payableFromBooking(booking || {})
  if (
    (booking?.isRevisit === true || booking?.revisit === true) &&
    total === 0
  ) {
    return true
  }
  return total === 0
}

function becameEligibleForInvoice(before, after) {
  if (!shouldGenerateInvoice(after)) return false
  if (!before) return true
  return !shouldGenerateInvoice(before)
}

module.exports = {
  buildInvoiceData,
  shouldGenerateInvoice,
  becameEligibleForInvoice,
  money,
  cleanText,
  formatYmd,
  paymentMethodLabel,
}
