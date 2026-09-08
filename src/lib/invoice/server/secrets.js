function invoiceSecretsFromEnv() {
  return {
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
      fromEmail:
        process.env.RESEND_FROM_EMAIL ||
        'Repair Series <repairseries@gmail.com>',
    },
  }
}

module.exports = { invoiceSecretsFromEnv }
