export { generateAndStoreInvoice } from "./generateAndStoreInvoice";

/* eslint-disable @typescript-eslint/no-require-imports */
export const { sendInvoiceEmail } = require("./sendEmail") as {
  sendInvoiceEmail: (args: {
    invoice: Record<string, unknown>;
    pdfBuffer: Buffer;
    config: { apiKey?: string; fromEmail?: string };
  }) => Promise<{
    skipped?: boolean;
    reason?: string;
    id?: string | null;
    to?: string;
  }>;
};

export const { invoiceSecretsFromEnv } = require("./secrets") as {
  invoiceSecretsFromEnv: () => {
    resend: Record<string, string>;
  };
};
