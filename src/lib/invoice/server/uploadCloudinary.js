/**
 * Legacy Cloudinary invoice upload.
 * New invoices are stored on Google Drive via src/lib/storage/drive.ts.
 * Kept so existing Cloudinary PDFs can still be understood; do not call for new files.
 */
const crypto = require('crypto')
const FormData = require('form-data')

function requireEnv(name, value) {
  const text = value != null ? String(value).trim() : ''
  if (!text) throw new Error(`Missing required secret/config: ${name}`)
  return text
}

/**
 * Upload invoice PDF to Cloudinary as a raw file.
 * Prefers signed upload when API key/secret are set; otherwise unsigned upload_preset.
 */
async function uploadInvoicePdfToCloudinary(pdfBuffer, { folder, publicId, fileName, config }) {
  const cloudName = requireEnv(
    'CLOUDINARY_CLOUD_NAME',
    config.cloudName || process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  )
  const apiKey = String(config.apiKey || process.env.CLOUDINARY_API_KEY || '').trim()
  const apiSecret = String(config.apiSecret || process.env.CLOUDINARY_API_SECRET || '').trim()
  const uploadPreset = String(
    config.uploadPreset ||
      process.env.CLOUDINARY_UPLOAD_PRESET ||
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
      '',
  ).trim()

  const timestamp = Math.floor(Date.now() / 1000)
  const barePublicId = String(publicId || fileName || 'invoice')
    .replace(/^\/+/, '')
    .replace(/\.pdf$/i, '')
  const shortPublicId = barePublicId.includes('/')
    ? barePublicId.split('/').pop()
    : barePublicId

  const form = new FormData()
  form.append('file', pdfBuffer, {
    filename: fileName || 'invoice.pdf',
    contentType: 'application/pdf',
  })

  if (apiKey && apiSecret) {
    const paramsToSign = {
      folder: folder || undefined,
      public_id: shortPublicId,
      timestamp,
      overwrite: 'true',
    }
    const toSign = Object.keys(paramsToSign)
      .filter((key) => paramsToSign[key] != null && paramsToSign[key] !== '')
      .sort()
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join('&')
    const signature = crypto
      .createHash('sha1')
      .update(`${toSign}${apiSecret}`)
      .digest('hex')

    form.append('api_key', apiKey)
    form.append('timestamp', String(timestamp))
    form.append('signature', signature)
    form.append('overwrite', 'true')
    if (folder) form.append('folder', folder)
    form.append('public_id', shortPublicId)
  } else {
    if (!uploadPreset) {
      throw new Error(
        'Set CLOUDINARY_API_KEY+CLOUDINARY_API_SECRET or CLOUDINARY_UPLOAD_PRESET for invoice PDFs',
      )
    }
    form.append('upload_preset', uploadPreset)
    if (folder) form.append('folder', folder)
    form.append('public_id', shortPublicId)
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `Cloudinary upload failed (${response.status})`,
    )
  }

  const secureUrl = String(payload.secure_url || payload.url || '').trim()
  if (!secureUrl) throw new Error('Cloudinary upload returned no URL')

  return {
    url: secureUrl,
    secureUrl,
    publicId: String(payload.public_id || `${folder}/${shortPublicId}`),
    bytes: Number(payload.bytes) || pdfBuffer.length,
    resourceType: payload.resource_type || 'raw',
    folder: payload.folder || folder,
  }
}

module.exports = { uploadInvoicePdfToCloudinary }
