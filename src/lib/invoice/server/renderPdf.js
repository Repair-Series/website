const PDFDocument = require('pdfkit')
const { BRAND } = require('./defaults')

function inr(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function wrapText(value, fallback = '—') {
  const text = value != null ? String(value).trim() : ''
  return text || fallback
}

async function loadLogoBuffer(logoUrl) {
  const url = String(logoUrl || '').trim()
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 32 ? buf : null
  } catch {
    return null
  }
}

function drawHeaderBar(doc, pageWidth) {
  doc.save()
  doc.rect(0, 0, pageWidth, 6).fill(BRAND.orange)
  doc.restore()
}

function drawFooterBar(doc, pageWidth, pageHeight, invoice) {
  const h = 26
  const y = pageHeight - h
  doc.save()
  doc.rect(0, y, pageWidth, h).fill(BRAND.banner)
  doc.fillColor(BRAND.white).font('Helvetica').fontSize(8)
  const parts = [
    invoice.companyPhone ? `Phone: ${invoice.companyPhone}` : '',
    invoice.companyEmail ? invoice.companyEmail : '',
    invoice.companyWebsite ? invoice.companyWebsite : '',
  ].filter(Boolean)
  doc.text(parts.join('  •  '), 36, y + 8, {
    width: pageWidth - 72,
    align: 'center',
  })
  doc.restore()
}

function drawLogoMark(doc, x, y, logoBuffer) {
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, x, y, { fit: [48, 48] })
      return
    } catch {
      /* fall through to mark */
    }
  }
  doc.save()
  doc.roundedRect(x, y, 42, 42, 8).fill(BRAND.orange)
  doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(16)
  doc.text('RS', x, y + 13, { width: 42, align: 'center' })
  doc.restore()
}

function drawCompanyBlock(doc, invoice, margin, logoBuffer, title, subtitle) {
  const pageWidth = doc.page.width
  drawHeaderBar(doc, pageWidth)
  drawLogoMark(doc, margin, 18, logoBuffer)

  const detailsX = margin + 56
  const detailsW = pageWidth - margin * 2 - 200
  doc.fillColor(BRAND.text).font('Helvetica-Bold').fontSize(12)
  doc.text(wrapText(invoice.companyName, 'Repair Series'), detailsX, 18, {
    width: detailsW,
  })
  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(8)
  const lines = [
    invoice.companyAddress,
    invoice.companyPhone ? `Phone: ${invoice.companyPhone}` : '',
    invoice.companyEmail ? `Email: ${invoice.companyEmail}` : '',
    invoice.udyamNumber ? `Udyam Number: ${invoice.udyamNumber}` : '',
    invoice.companyWebsite ? `Website: ${invoice.companyWebsite}` : '',
    invoice.gstin ? `GSTIN: ${invoice.gstin}` : '',
  ].filter(Boolean)
  doc.text(lines.join('\n'), detailsX, 34, {
    width: detailsW,
    lineGap: 1.5,
  })

  const bannerW = 168
  const bannerX = pageWidth - margin - bannerW
  doc.save()
  doc.roundedRect(bannerX, 20, bannerW, 22, 3).fill(BRAND.banner)
  doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(10)
  doc.text(title, bannerX, 26, { width: bannerW, align: 'center' })
  doc.restore()
  if (subtitle) {
    doc.fillColor(BRAND.orange).font('Helvetica-Bold').fontSize(8)
    doc.text(subtitle, bannerX, 46, { width: bannerW, align: 'center' })
  }
}

function kvBlock(doc, x, y, w, title, rows) {
  doc.save()
  doc.roundedRect(x, y, w, 20, 4).fill(BRAND.orange)
  doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(9)
  doc.text(title, x + 8, y + 6, { width: w - 16 })
  doc.restore()
  let cy = y + 28
  for (const [label, value] of rows) {
    doc.fillColor(BRAND.muted).font('Helvetica-Bold').fontSize(7.5)
    doc.text(label, x + 8, cy, { width: 92 })
    doc.fillColor(BRAND.text).font('Helvetica').fontSize(8)
    const text = wrapText(value)
    const h = doc.heightOfString(text, { width: w - 108 })
    doc.text(text, x + 100, cy, { width: w - 108 })
    cy += Math.max(14, h + 4)
  }
  return cy
}

function drawCalcTable(doc, margin, startY, contentWidth, page, extraRows) {
  const headerH = 20
  doc.save()
  doc.rect(margin, startY, contentWidth, headerH).fill(BRAND.orange)
  doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(8.5)
  doc.text('Items', margin + 10, startY + 6)
  doc.text('Taxable Value', margin + contentWidth - 120, startY + 6, {
    width: 110,
    align: 'right',
  })
  doc.restore()

  const extra = Array.isArray(page.extraItems) ? page.extraItems : [];
  const extraRowsFromPage = extra.map((item) => [
    item.label || "Item",
    `₹ ${inr(item.amount)}`,
  ]);
  const rows = [
    [page.itemLabel || "Item", `₹ ${inr(page.taxableValue)}`],
    ...extraRowsFromPage,
    ...(extraRows || []),
    ["Gross Amount", `₹ ${inr(page.grossAmount)}`],
    ["Discount", `₹ ${inr(page.discount)}`],
    ["Taxable Value", `₹ ${inr(page.taxableValue)}`],
  ];
  if (page.gstAmount > 0) {
    rows.push([`CGST @ ${page.cgstPercent}%`, `₹ ${inr(page.cgstAmount)}`])
    rows.push([`SGST @ ${page.sgstPercent}%`, `₹ ${inr(page.sgstAmount)}`])
  }
  rows.push(['TOTAL AMOUNT', `₹ ${inr(page.totalAmount)}`])

  let y = startY + headerH
  rows.forEach((row, idx) => {
    const isTotal = idx === rows.length - 1
    const h = isTotal ? 22 : 18
    if (idx % 2 === 1 && !isTotal) {
      doc.save()
      doc.rect(margin, y, contentWidth, h).fill(BRAND.rowAlt)
      doc.restore()
    }
    if (isTotal) {
      doc.save()
      doc.rect(margin, y, contentWidth, h).fill(BRAND.orange)
      doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(9)
    } else {
      doc.fillColor(BRAND.text).font(idx === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
    }
    doc
      .strokeColor(BRAND.line)
      .lineWidth(0.4)
      .rect(margin, y, contentWidth, h)
      .stroke()
    doc.text(row[0], margin + 10, y + (isTotal ? 6 : 5), { width: contentWidth - 140 })
    doc.text(row[1], margin + contentWidth - 120, y + (isTotal ? 6 : 5), {
      width: 110,
      align: 'right',
    })
    if (isTotal) doc.restore()
    y += h
  })
  return y
}

function drawSignature(doc, margin, y, pageWidth) {
  const lineY = y + 36
  const authX = pageWidth - margin - 180
  doc
    .moveTo(authX, lineY)
    .lineTo(authX + 180, lineY)
    .strokeColor(BRAND.line)
    .lineWidth(1)
    .stroke()
  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(8)
  doc.text('Signature of Authorized Person', authX, lineY + 6, {
    width: 180,
    align: 'center',
  })
}

function drawSpareTable(doc, margin, startY, contentWidth, spareParts) {
  const cols = {
    name: margin,
    qty: margin + contentWidth - 170,
    rate: margin + contentWidth - 120,
    amt: margin + contentWidth - 60,
  }
  const headerH = 20
  doc.save()
  doc.rect(margin, startY, contentWidth, headerH).fill(BRAND.orange)
  doc.fillColor(BRAND.white).font('Helvetica-Bold').fontSize(8)
  doc.text('Spare Part', cols.name + 8, startY + 6)
  doc.text('Qty', cols.qty, startY + 6, { width: 36, align: 'center' })
  doc.text('Rate', cols.rate, startY + 6, { width: 48, align: 'right' })
  doc.text('Amount', cols.amt, startY + 6, { width: 52, align: 'right' })
  doc.restore()

  let y = startY + headerH
  const lines = Array.isArray(spareParts) && spareParts.length ? spareParts : []
  const rows = lines.length ? lines : [{ title: '—', quantity: '', rate: 0, amount: 0 }]
  rows.forEach((line, i) => {
    const title = wrapText(line.title, 'Spare part')
    const titleH = Math.max(18, doc.heightOfString(title, { width: cols.qty - cols.name - 14 }) + 8)
    if (i % 2 === 1) {
      doc.save()
      doc.rect(margin, y, contentWidth, titleH).fill(BRAND.rowAlt)
      doc.restore()
    }
    doc
      .strokeColor(BRAND.line)
      .lineWidth(0.4)
      .rect(margin, y, contentWidth, titleH)
      .stroke()
    doc.fillColor(BRAND.text).font('Helvetica').fontSize(8)
    doc.text(title, cols.name + 8, y + 4, { width: cols.qty - cols.name - 14 })
    doc.text(String(line.quantity ?? ''), cols.qty, y + 4, { width: 36, align: 'center' })
    doc.text(line.rate ? inr(line.rate) : '', cols.rate, y + 4, { width: 48, align: 'right' })
    doc.text(line.amount ? inr(line.amount) : '', cols.amt, y + 4, { width: 52, align: 'right' })
    y += titleH
  })
  return y
}

function drawCustomerPartner(doc, invoice, margin, contentWidth, providerTitle, providerRows) {
  const gap = 12
  const colW = (contentWidth - gap) / 2
  const y = 118
  const leftRows = [
    ['Customer Name', invoice.customerName],
    ['Invoice No.', invoice.invoiceNumber],
    ['Booking / Order Ref.', invoice.bookingCode || invoice.bookingId],
    ['Delivery Address', invoice.customerAddress],
    ['Invoice Date', invoice.invoiceDate],
    ['State Name', invoice.customerState],
    ['Place of Supply', invoice.placeOfSupply],
  ]
  const leftBottom = kvBlock(doc, margin, y, colW, 'CUSTOMER DETAILS', leftRows)
  const rightBottom = kvBlock(
    doc,
    margin + colW + gap,
    y,
    colW,
    providerTitle,
    providerRows,
  )
  return Math.max(leftBottom, rightBottom) + 12
}

/**
 * Page 1: company tax invoice (convenience/platform fee + GST only).
 * Page 2: service receipt (service + additional, no GST).
 * Page 3: spare part receipt only when spare parts exist (no GST).
 * Amounts come from the assembled finance snapshot — not recalculated here.
 */
async function renderInvoicePdf(invoice) {
  const finance = invoice.finance || {}
  const page1 = finance.page1 || {
    itemLabel: 'Convenience and Platform Fee',
    grossAmount: 0,
    discount: 0,
    taxableValue: 0,
    cgstPercent: 0,
    sgstPercent: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    gstAmount: 0,
    totalAmount: 0,
  }
  const page2 = finance.page2 || {
    itemLabel: 'Service Charges',
    grossAmount: 0,
    discount: 0,
    taxableValue: 0,
    cgstPercent: 0,
    sgstPercent: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    gstAmount: 0,
    totalAmount: 0,
  }
  const hasSpare = Boolean(finance.hasSpareParts && finance.page3)
  const logoBuffer = await loadLogoBuffer(invoice.logoUrl)
  const pageCount = hasSpare ? 3 : 2

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 40, left: 36, right: 36 },
      info: {
        Title: `Tax Invoice ${invoice.invoiceNumber || ''}`,
        Author: wrapText(invoice.companyName, 'Repair Series'),
        Subject: 'Tax Invoice',
      },
    })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const margin = 36
    const contentWidth = pageWidth - margin * 2

    const paintPageChrome = (title, subtitle) => {
      drawCompanyBlock(doc, invoice, margin, logoBuffer, title, subtitle)
      drawFooterBar(doc, pageWidth, pageHeight, invoice)
    }

    paintPageChrome('TAX INVOICE', '')
    const p1TableY = drawCustomerPartner(doc, invoice, margin, contentWidth, 'DELIVERY SERVICE PROVIDER', [
      ['Business GSTIN', invoice.gstin],
      ['Business Name', invoice.legalName || invoice.companyName],
      ['Address', invoice.companyAddress],
      ['State Name', invoice.companyState || invoice.settings?.state],
    ])
    const p1End = drawCalcTable(doc, margin, p1TableY, contentWidth, page1)
    drawSignature(doc, margin, p1End + 8, pageWidth)

    doc.addPage()
    paintPageChrome('SERVICE RECEIPT', '')
    const p2TableY = drawCustomerPartner(doc, invoice, margin, contentWidth, 'PARTNER DETAILS', [
      ['GSTIN', ''],
      ['Partner Name', invoice.partnerName],
      ['Address', invoice.partnerAddress],
      ['State Name', invoice.partnerState],
    ])
    const p2End = drawCalcTable(doc, margin, p2TableY, contentWidth, {
      ...page2,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      cgstPercent: 0,
      sgstPercent: 0,
    })
    drawSignature(doc, margin, p2End + 8, pageWidth)

    if (hasSpare) {
      doc.addPage()
      paintPageChrome('SPARE PART RECEIPT', '')
      const p3TableY = drawCustomerPartner(doc, invoice, margin, contentWidth, 'PARTNER DETAILS', [
        ['GSTIN', ''],
        ['Partner Name', invoice.partnerName],
        ['Address', invoice.partnerAddress],
        ['State Name', invoice.partnerState],
      ])
      const afterSpare = drawSpareTable(
        doc,
        margin,
        p3TableY,
        contentWidth,
        finance.spareParts || [],
      )
      const p3End = drawCalcTable(doc, margin, afterSpare + 10, contentWidth, {
        ...(finance.page3 || {}),
        itemLabel: (finance.page3 && finance.page3.itemLabel) || 'Spare Parts',
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cgstPercent: 0,
        sgstPercent: 0,
      })
      drawSignature(doc, margin, p3End + 8, pageWidth)
    }

    doc.end()
  })

  buffer.pageCount = pageCount
  return buffer
}

module.exports = { renderInvoicePdf }
