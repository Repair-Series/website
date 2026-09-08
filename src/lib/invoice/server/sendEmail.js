/**
 * Sends the tax invoice email via Resend API (HTML + PDF attachment).
 */
async function sendInvoiceEmail({ invoice, pdfBuffer, config }) {
  const apiKey = String(config.apiKey || '').trim()
  if (!apiKey) {
    return { skipped: true, reason: 'RESEND_API_KEY not configured' }
  }

  const to = String(invoice.customerEmail || '').trim()
  if (!to || !to.includes('@')) {
    return { skipped: true, reason: 'customer_email_missing' }
  }

  const from =
    String(config.fromEmail || '').trim() ||
    'Repair Series <onboarding@resend.dev>'
  const company = invoice.companyName || 'Repair Series'
  const invoiceNumber = invoice.invoiceNumber || invoice.invoiceId
  const amount = Number(invoice.grandTotal || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const pdfUrl = /res\.cloudinary\.com/i.test(String(invoice.pdfUrl || ''))
    ? String(invoice.pdfUrl)
    : ''
  const customerName = invoice.customerName || 'Customer'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Invoice ${invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#f6f3ef;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eadfd4;">
        <tr>
          <td style="background:#E85D04;padding:20px 24px;color:#fff;">
            <div style="font-size:20px;font-weight:700;letter-spacing:0.5px;">${company}</div>
            <div style="margin-top:4px;font-size:13px;opacity:0.95;">Payment Confirmation & Tax Invoice</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:15px;">Dear ${customerName},</p>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#555;">
              Thank you for choosing ${company}. Please find your tax invoice attached.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f3;border-radius:12px;padding:4px;">
              <tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;">
                <div><strong>Invoice Number:</strong> ${invoiceNumber}</div>
                <div><strong>Booking:</strong> ${invoice.bookingCode || invoice.bookingId || '—'}</div>
                <div><strong>Service:</strong> ${invoice.serviceName || 'Service'}</div>
                <div><strong>Payment Method:</strong> ${invoice.paymentMethod || '—'}</div>
                <div><strong>Amount Paid:</strong> ₹${amount}</div>
              </td></tr>
            </table>
            ${
              pdfUrl
                ? `<p style="margin:22px 0 8px;text-align:center;">
              <a href="${pdfUrl}" style="display:inline-block;background:#E85D04;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:700;">
                Download Invoice PDF
              </a>
            </p>
            <p style="margin:0;text-align:center;font-size:12px;color:#777;word-break:break-all;">
              Or open: <a href="${pdfUrl}" style="color:#E85D04;">${pdfUrl}</a>
            </p>`
                : ''
            }
            <p style="margin:22px 0 0;font-size:13px;color:#666;">
              Your tax invoice PDF is attached to this email. You can also download it while signed in from the Repair Series app or website.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#5C2A1E;color:#fff;padding:14px 24px;font-size:12px;text-align:center;">
            ${invoice.companyPhone || ''} ${invoice.companyPhone && invoice.companyEmail ? '•' : ''} ${invoice.companyEmail || ''}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Tax Invoice / Receipt – ${invoiceNumber}`,
      html,
      attachments: [
        {
          filename: invoice.fileName || `${invoiceNumber}.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || `Resend failed (${response.status})`)
  }

  return {
    skipped: false,
    id: payload.id || null,
    to,
  }
}

module.exports = { sendInvoiceEmail }
