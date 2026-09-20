const PDFDocument = require('pdfkit')

const INK = '#111111'
const MUTED = '#444444'
const RULE = '#222222'
const RULE_LIGHT = '#888888'
const HEADER_FILL = '#F3F3F3'
const TOTAL_FILL = '#111111'

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

function moneyRows(page, { includeGst }) {
  const extra = Array.isArray(page.extraItems) ? page.extraItems : []
  const extraRows = extra.map((item) => [item.label || 'Item', Number(item.amount) || 0])
  const rows = [
    [page.itemLabel || 'Item', Number(page.taxableValue) || 0],
    ...extraRows,
    ['Gross Amount', Number(page.grossAmount) || 0],
    ['Discount', Number(page.discount) || 0],
    ['Taxable Value', Number(page.taxableValue) || 0],
  ]
  if (includeGst && Number(page.gstAmount) > 0) {
    rows.push([`CGST @ ${page.cgstPercent}%`, Number(page.cgstAmount) || 0])
    rows.push([`SGST @ ${page.sgstPercent}%`, Number(page.sgstAmount) || 0])
  }
  rows.push(['Total Amount', Number(page.totalAmount) || 0])
  return rows
}

function drawHLine(doc, x1, x2, y, width = 0.8, color = RULE) {
  doc
    .moveTo(x1, y)
    .lineTo(x2, y)
    .strokeColor(color)
    .lineWidth(width)
    .stroke()
}

function drawRect(doc, x, y, w, h, width = 0.8) {
  doc.strokeColor(RULE).lineWidth(width).rect(x, y, w, h).stroke()
}

function drawLogoMark(doc, x, y, logoBuffer) {
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, x, y, { fit: [42, 42] })
      return
    } catch {
      /* fall through */
    }
  }
  doc.save()
  doc.rect(x, y, 42, 42).strokeColor(RULE).lineWidth(0.8).stroke()
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11)
  doc.text('RS', x, y + 15, { width: 42, align: 'center' })
  doc.restore()
}

function companyLines(invoice) {
  return [
    invoice.companyAddress,
    invoice.companyPhone ? `Phone: ${invoice.companyPhone}` : '',
    invoice.companyEmail ? `Email: ${invoice.companyEmail}` : '',
    invoice.gstin ? `GSTIN: ${invoice.gstin}` : '',
    invoice.udyamNumber ? `Udyam: ${invoice.udyamNumber}` : '',
    invoice.companyWebsite ? `Website: ${invoice.companyWebsite}` : '',
  ].filter(Boolean)
}

function drawPageHeader(doc, invoice, logoBuffer, title, subtitle, margin) {
  const pageWidth = doc.page.width
  const right = pageWidth - margin
  const contentWidth = right - margin

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14)
  doc.text(title, margin, margin, { width: contentWidth, align: 'center' })
  let y = margin + 18
  if (subtitle) {
    doc.font('Helvetica-Bold').fontSize(10)
    doc.text(subtitle, margin, y, { width: contentWidth, align: 'center' })
    y += 14
  }

  drawHLine(doc, margin, right, y, 1.2)
  y += 10

  drawLogoMark(doc, margin, y, logoBuffer)
  const textX = margin + 52
  const textW = contentWidth - 52
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(13)
  doc.text(wrapText(invoice.companyName, 'Repair Series'), textX, y, { width: textW })
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
  const details = companyLines(invoice).join('\n')
  const detailsH = Math.max(
    42,
    doc.heightOfString(details, { width: textW, lineGap: 1.5 }) + 16,
  )
  doc.text(details, textX, y + 16, { width: textW, lineGap: 1.5 })
  y += detailsH + 6
  drawHLine(doc, margin, right, y, 1.2)
  return y + 10
}

function drawPartyBox(doc, x, y, w, title, rows) {
  const pad = 8
  const labelW = 88
  const valueW = w - pad * 2 - labelW
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
  const titleH = 16
  let innerY = y + titleH + 6
  const measured = rows.map(([label, value]) => {
    const text = wrapText(value)
    const h = Math.max(12, doc.heightOfString(text, { width: valueW, lineGap: 1 }) + 4)
    return { label, text, h }
  })
  const bodyH = measured.reduce((sum, row) => sum + row.h, 0)
  const h = titleH + 8 + bodyH + 6
  drawRect(doc, x, y, w, h)
  doc.save()
  doc.rect(x, y, w, titleH).fill(HEADER_FILL)
  doc.restore()
  drawHLine(doc, x, x + w, y + titleH, 0.6)
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
  doc.text(title, x + pad, y + 4, { width: w - pad * 2 })
  doc.font('Helvetica').fontSize(8)
  for (const row of measured) {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5)
    doc.text(row.label, x + pad, innerY, { width: labelW })
    doc.fillColor(INK).font('Helvetica').fontSize(8)
    doc.text(row.text, x + pad + labelW, innerY, { width: valueW, lineGap: 1 })
    innerY += row.h
  }
  return y + h
}

function drawParties(doc, margin, y, contentWidth, leftTitle, leftRows, rightTitle, rightRows) {
  const gap = 10
  const colW = (contentWidth - gap) / 2
  const leftBottom = drawPartyBox(doc, margin, y, colW, leftTitle, leftRows)
  const rightBottom = drawPartyBox(doc, margin + colW + gap, y, colW, rightTitle, rightRows)
  return Math.max(leftBottom, rightBottom) + 10
}

function drawMetaTable(doc, margin, y, contentWidth, cells) {
  const cols = 4
  const colW = contentWidth / cols
  const rowH = 28
  drawRect(doc, margin, y, contentWidth, rowH)
  cells.slice(0, cols).forEach((cell, i) => {
    const x = margin + i * colW
    if (i > 0) {
      doc
        .moveTo(x, y)
        .lineTo(x, y + rowH)
        .strokeColor(RULE)
        .lineWidth(0.6)
        .stroke()
    }
    doc.fillColor(MUTED).font('Helvetica').fontSize(7)
    doc.text(cell.label, x + 6, y + 4, { width: colW - 12 })
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
    doc.text(wrapText(cell.value), x + 6, y + 14, { width: colW - 12 })
  })
  return y + rowH + 10
}

function drawAmountTable(doc, margin, y, contentWidth, rows) {
  const headerH = 18
  const amtW = 130
  const descW = contentWidth - amtW
  doc.save()
  doc.rect(margin, y, contentWidth, headerH).fill(HEADER_FILL)
  doc.restore()
  drawRect(doc, margin, y, contentWidth, headerH)
  doc
    .moveTo(margin + descW, y)
    .lineTo(margin + descW, y + headerH)
    .strokeColor(RULE)
    .lineWidth(0.6)
    .stroke()
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
  doc.text('Description', margin + 8, y + 5, { width: descW - 16 })
  doc.text('Amount (Rs.)', margin + descW + 6, y + 5, { width: amtW - 12, align: 'right' })

  let cy = y + headerH
  rows.forEach((row, idx) => {
    const isTotal = idx === rows.length - 1
    const h = isTotal ? 20 : 16
    if (isTotal) {
      doc.save()
      doc.rect(margin, cy, contentWidth, h).fill(TOTAL_FILL)
      doc.restore()
    }
    drawRect(doc, margin, cy, contentWidth, h, 0.6)
    doc
      .moveTo(margin + descW, cy)
      .lineTo(margin + descW, cy + h)
      .strokeColor(isTotal ? '#FFFFFF' : RULE)
      .lineWidth(0.6)
      .stroke()
    const label = row[0]
    const amount = `Rs. ${inr(row[1])}`
    doc.fillColor(isTotal ? '#FFFFFF' : INK).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 8.5 : 8)
    doc.text(label, margin + 8, cy + (isTotal ? 5 : 4), { width: descW - 16 })
    doc.text(amount, margin + descW + 6, cy + (isTotal ? 5 : 4), {
      width: amtW - 12,
      align: 'right',
    })
    cy += h
  })
  return cy
}

function drawWordsBox(doc, margin, y, contentWidth, words) {
  const h = 36
  drawRect(doc, margin, y, contentWidth, h)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5)
  doc.text('Amount in words', margin + 8, y + 5, { width: contentWidth - 16 })
  doc.fillColor(INK).font('Helvetica-Oblique').fontSize(8.5)
  doc.text(wrapText(words, 'Rupees Zero Only'), margin + 8, y + 16, {
    width: contentWidth - 16,
  })
  return y + h
}

function drawSignature(doc, margin, y, pageWidth, companyName) {
  const w = 180
  const x = pageWidth - margin - w
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
  doc.text(`For ${wrapText(companyName, 'Repair Series')}`, x, y, {
    width: w,
    align: 'center',
  })
  drawHLine(doc, x, x + w, y + 36, 0.7, RULE_LIGHT)
  doc.fillColor(INK).font('Helvetica').fontSize(8)
  doc.text('Authorized Signatory', x, y + 40, { width: w, align: 'center' })
}

function drawSpareTable(doc, margin, y, contentWidth, spareParts) {
  const cols = [
    { key: 'name', label: 'Spare Part', w: contentWidth - 170, align: 'left' },
    { key: 'qty', label: 'Qty', w: 40, align: 'center' },
    { key: 'rate', label: 'Rate', w: 65, align: 'right' },
    { key: 'amt', label: 'Amount', w: 65, align: 'right' },
  ]
  const headerH = 18
  doc.save()
  doc.rect(margin, y, contentWidth, headerH).fill(HEADER_FILL)
  doc.restore()
  drawRect(doc, margin, y, contentWidth, headerH)
  let x = margin
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
  cols.forEach((col) => {
    doc.text(col.label, x + 4, y + 5, { width: col.w - 8, align: col.align })
    x += col.w
    if (x < margin + contentWidth) {
      doc
        .moveTo(x, y)
        .lineTo(x, y + headerH)
        .strokeColor(RULE)
        .lineWidth(0.6)
        .stroke()
    }
  })
  let cy = y + headerH
  const lines = Array.isArray(spareParts) && spareParts.length ? spareParts : []
  const rows = lines.length ? lines : [{ title: '—', quantity: '', rate: 0, amount: 0 }]
  rows.forEach((line) => {
    const title = wrapText(line.title, 'Spare part')
    const nameW = cols[0].w - 8
    const h = Math.max(16, doc.heightOfString(title, { width: nameW }) + 8)
    drawRect(doc, margin, cy, contentWidth, h, 0.6)
    let cx = margin
    const values = [
      title,
      String(line.quantity ?? ''),
      line.rate ? inr(line.rate) : '',
      line.amount ? inr(line.amount) : '',
    ]
    doc.fillColor(INK).font('Helvetica').fontSize(8)
    cols.forEach((col, i) => {
      doc.text(values[i], cx + 4, cy + 4, { width: col.w - 8, align: col.align })
      cx += col.w
      if (cx < margin + contentWidth) {
        doc
          .moveTo(cx, cy)
          .lineTo(cx, cy + h)
          .strokeColor(RULE)
          .lineWidth(0.6)
          .stroke()
      }
    })
    cy += h
  })
  return cy + 8
}

function drawFooterNote(doc, invoice, margin) {
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const y = pageHeight - 24
  drawHLine(doc, margin, pageWidth - margin, y, 0.6, RULE_LIGHT)
  doc.fillColor(MUTED).font('Helvetica').fontSize(7)
  const note = [
    'This is a computer-generated invoice.',
    invoice.companyPhone ? `Phone: ${invoice.companyPhone}` : '',
    invoice.companyEmail || '',
  ]
    .filter(Boolean)
    .join('  |  ')
  doc.text(note, margin, y + 5, {
    width: pageWidth - margin * 2,
    align: 'center',
    lineBreak: false,
    height: 10,
  })
}

/**
 * Page 1: company tax invoice (convenience/platform fee + GST only).
 * Page 2: RS partner receipt (service + additional, no GST).
 * Page 3: spare part receipt only when spare parts exist (no GST).
 * Amounts come from the assembled finance snapshot — not recalculated here.
 */
async function renderInvoicePdf(invoice) {
  const finance = invoice.finance || {}
  const page1 = finance.page1 || {
    itemLabel: 'Convenience and Platform Fee',
    extraItems: [],
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
    extraItems: [],
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
    const margin = 36
    const contentWidth = pageWidth - margin * 2
    const customerRows = [
      ['Customer Name', invoice.customerName],
      ['Phone', invoice.customerPhone],
      ['Address', invoice.customerAddress],
      ['State', invoice.customerState],
      ['Place of Supply', invoice.placeOfSupply],
    ]
    const companyProviderRows = [
      ['Business GSTIN', invoice.gstin],
      ['Business Name', invoice.legalName || invoice.companyName],
      ['Address', invoice.companyAddress],
      ['State', invoice.companyState || invoice.settings?.state],
    ]
    const partnerRows = [
      ['Partner Name', invoice.partnerName || invoice.technicianName],
      ['Address', invoice.partnerAddress],
      ['State', invoice.partnerState],
      ['GSTIN', invoice.partnerGstin],
    ]
    const metaCells = [
      { label: 'Invoice No.', value: invoice.invoiceNumber },
      { label: 'Invoice Date', value: invoice.invoiceDate },
      { label: 'Booking ID', value: invoice.bookingCode || invoice.bookingId },
      { label: 'Payment', value: invoice.paymentMethod },
    ]

    const paintPage1 = () => {
      let y = drawPageHeader(doc, invoice, logoBuffer, 'TAX INVOICE', '', margin)
      y = drawParties(
        doc,
        margin,
        y,
        contentWidth,
        'CUSTOMER DETAILS',
        customerRows,
        'SERVICE PROVIDER',
        companyProviderRows,
      )
      y = drawMetaTable(doc, margin, y, contentWidth, metaCells)
      y = drawAmountTable(doc, margin, y, contentWidth, moneyRows(page1, { includeGst: true }))
      y = drawWordsBox(doc, margin, y + 10, contentWidth, invoice.amountInWords) + 16
      drawSignature(doc, margin, y, pageWidth, invoice.companyName)
      drawFooterNote(doc, invoice, margin)
    }

    const paintPage2 = () => {
      let y = drawPageHeader(
        doc,
        invoice,
        logoBuffer,
        'TAX INVOICE / RECEIPT',
        'RS PARTNER RECEIPT',
        margin,
      )
      y = drawParties(
        doc,
        margin,
        y,
        contentWidth,
        'CUSTOMER DETAILS',
        customerRows,
        'SERVICE PROVIDER / PARTNER',
        partnerRows,
      )
      y = drawMetaTable(doc, margin, y, contentWidth, [
        { label: 'Service', value: invoice.serviceName },
        { label: 'Invoice Date', value: invoice.invoiceDate },
        { label: 'Booking ID', value: invoice.bookingCode || invoice.bookingId },
        { label: 'Partner', value: invoice.partnerName || invoice.technicianName },
      ])
      drawAmountTable(
        doc,
        margin,
        y,
        contentWidth,
        moneyRows(
          {
            ...page2,
            gstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
          },
          { includeGst: false },
        ),
      )
      drawFooterNote(doc, invoice, margin)
    }

    paintPage1()
    doc.addPage()
    paintPage2()

    if (hasSpare) {
      doc.addPage()
      let y = drawPageHeader(doc, invoice, logoBuffer, 'SPARE PART RECEIPT', '', margin)
      y = drawParties(
        doc,
        margin,
        y,
        contentWidth,
        'CUSTOMER DETAILS',
        customerRows,
        'SERVICE PROVIDER / PARTNER',
        partnerRows,
      )
      y = drawSpareTable(doc, margin, y, contentWidth, finance.spareParts || [])
      drawAmountTable(
        doc,
        margin,
        y,
        contentWidth,
        moneyRows(
          {
            ...(finance.page3 || {}),
            itemLabel: (finance.page3 && finance.page3.itemLabel) || 'Spare Parts',
            gstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
          },
          { includeGst: false },
        ),
      )
      drawFooterNote(doc, invoice, margin)
    }

    doc.end()
  })

  buffer.pageCount = pageCount
  return buffer
}

module.exports = { renderInvoicePdf }
