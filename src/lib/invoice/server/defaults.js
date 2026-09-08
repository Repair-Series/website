/** Canonical company defaults matching the Repair Series tax invoice brand. */
const DEFAULT_INVOICE_SETTINGS = Object.freeze({
  companyName: 'Repair Series',
  legalName: 'Repair Series',
  gstin: '09HLRPK3680M1Z3',
  pan: '',
  addressLine1: '1576/6, 1st Floor, Baghel Nagar Colony, Kher Bypass Road',
  addressLine2: 'Gali Number 8, Soot Mill Chauraha',
  city: 'Aligarh',
  state: 'Uttar Pradesh',
  pincode: '202001',
  phone: '7895720237',
  email: 'repairseries@gmail.com',
  website: '',
  logoUrl: '',
  udyamNumber: '',
  upiId: 'repairseries@upi',
  terms: [
    'Goods/Services once delivered will not be taken back.',
    'Warranty is applicable only where mentioned.',
    'Payment is due immediately after completion of service.',
    'All disputes are subject to Aligarh Jurisdiction only.',
    'This is a computer-generated invoice and does not require a signature.',
  ],
  thankYouMessage: 'Thank You FOR CHOOSING REPAIR SERIES',
  invoicePrefix: 'INV',
  gstPercent: 18,
})

const BRAND = Object.freeze({
  orange: '#E85D04',
  orangeDark: '#C44D03',
  banner: '#5C2A1E',
  text: '#2B2B2B',
  muted: '#5A5A5A',
  line: '#E8D5C8',
  rowAlt: '#FFF4EC',
  cream: '#FFF9F5',
  white: '#FFFFFF',
})

function normalizeInvoiceSettings(raw = {}) {
  const gst = Number(raw.gstPercent)
  const termsRaw = raw.terms
  let terms = DEFAULT_INVOICE_SETTINGS.terms
  if (Array.isArray(termsRaw) && termsRaw.length) {
    terms = termsRaw.map((t) => String(t || '').trim()).filter(Boolean)
  } else if (typeof termsRaw === 'string' && termsRaw.trim()) {
    terms = termsRaw
      .split(/\n|•|\u2022/)
      .map((t) => t.replace(/^\d+[\).\s-]*/, '').trim())
      .filter(Boolean)
  }

  const addressFallback = String(raw.address || raw.companyAddress || '').trim()

  return {
    companyName: String(raw.companyName || DEFAULT_INVOICE_SETTINGS.companyName).trim(),
    legalName: String(
      raw.legalName || raw.companyName || DEFAULT_INVOICE_SETTINGS.legalName,
    ).trim(),
    gstin: String(raw.gstin || raw.gstNumber || DEFAULT_INVOICE_SETTINGS.gstin).trim(),
    pan: String(raw.pan || '').trim(),
    addressLine1: String(raw.addressLine1 || '').trim() || addressFallback,
    addressLine2: String(raw.addressLine2 || '').trim(),
    city: String(raw.city || DEFAULT_INVOICE_SETTINGS.city).trim(),
    state: String(raw.state || DEFAULT_INVOICE_SETTINGS.state).trim(),
    pincode: String(raw.pincode || DEFAULT_INVOICE_SETTINGS.pincode).trim(),
    phone: String(raw.phone || raw.companyPhone || DEFAULT_INVOICE_SETTINGS.phone).trim(),
    email: String(raw.email || raw.companyEmail || DEFAULT_INVOICE_SETTINGS.email).trim(),
    website: String(raw.website || '').trim(),
    logoUrl: String(raw.logoUrl || '').trim(),
    udyamNumber: String(raw.udyamNumber || raw.udyam || '').trim(),
    upiId: String(raw.upiId || DEFAULT_INVOICE_SETTINGS.upiId).trim(),
    terms,
    thankYouMessage: String(
      raw.thankYouMessage || DEFAULT_INVOICE_SETTINGS.thankYouMessage,
    ).trim(),
    invoicePrefix: String(raw.invoicePrefix || DEFAULT_INVOICE_SETTINGS.invoicePrefix)
      .trim()
      .toUpperCase()
      .slice(0, 8),
    gstPercent: Number.isFinite(gst) && gst >= 0 ? gst : DEFAULT_INVOICE_SETTINGS.gstPercent,
  }
}

function formatCompanyAddress(settings) {
  const parts = [
    settings.addressLine1,
    settings.addressLine2,
    [settings.city, settings.state].filter(Boolean).join(', '),
    settings.pincode ? `- ${settings.pincode}` : '',
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.join(', ').replace(/,\s*-/, ' -')
}

module.exports = {
  DEFAULT_INVOICE_SETTINGS,
  BRAND,
  normalizeInvoiceSettings,
  formatCompanyAddress,
}
