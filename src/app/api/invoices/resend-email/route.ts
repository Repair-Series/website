import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireInvoiceCaller } from "@/lib/invoice/server/auth";
import {
  invoiceSecretsFromEnv,
  sendInvoiceEmail,
} from "@/lib/invoice/server";
import { invoiceOptions, jsonWithCors } from "@/lib/invoice/server/cors";
import { isCloudinaryUrl } from "@/lib/storage/keys";
import { downloadInvoicePdfFromRecord } from "@/lib/storage/invoicePdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: NextRequest) {
  return invoiceOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireInvoiceCaller(req);
    if (access.role !== "admin") {
      return jsonWithCors(req, { error: "Admin only" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      bookingId?: string;
      invoiceId?: string;
    };

    const bookingId = String(body.bookingId || "").trim();
    const invoiceId = String(
      body.invoiceId || (bookingId ? `inv_${bookingId}` : ""),
    ).trim();
    if (!invoiceId) {
      return jsonWithCors(req, { error: "Missing invoiceId" }, { status: 400 });
    }

    const db = getAdminDb();
    const invoiceRef = db.doc(`invoices/${invoiceId}`);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
      return jsonWithCors(req, { error: "Invoice not found" }, { status: 404 });
    }

    const invoice = (invoiceSnap.data() || {}) as Record<string, unknown>;
    const alreadySent =
      String(invoice.emailStatus || invoice.invoiceEmailStatus || "")
        .trim()
        .toLowerCase() === "sent";
    if (alreadySent) {
      return jsonWithCors(req, {
        ok: true,
        email: { skipped: true, reason: "already_sent" },
      });
    }

    const pdfBuffer = await downloadInvoicePdfFromRecord(invoice);
    if (!pdfBuffer) {
      return jsonWithCors(
        req,
        { error: "Invoice PDF missing — generate first" },
        { status: 400 },
      );
    }

    const storedUrl = String(invoice.pdfUrl || invoice.invoicePdfUrl || "").trim();
    const emailPdfUrl = isCloudinaryUrl(storedUrl) ? storedUrl : "";
    const secrets = invoiceSecretsFromEnv();

    const emailResult = await sendInvoiceEmail({
      invoice: { ...invoice, pdfUrl: emailPdfUrl, fileName: invoice.fileName },
      pdfBuffer,
      config: secrets.resend,
    });

    await invoiceRef.set(
      {
        emailStatus: emailResult.skipped ? "skipped" : "sent",
        emailSkipReason: emailResult.skipped
          ? emailResult.reason || null
          : null,
        emailId: emailResult.id || null,
        emailSentAt: emailResult.skipped ? null : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return jsonWithCors(req, { ok: true, email: emailResult });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = String((err as Error)?.message || "Failed to resend email");
    console.error("api/invoices/resend-email", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
