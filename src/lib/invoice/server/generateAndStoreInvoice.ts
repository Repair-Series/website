import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { assembleInvoiceData, shouldGenerateInvoice } from "./assembleInvoice";
import { invoiceDocId, shouldSendInvoiceEmail } from "@/lib/server/finance";
import { financeFromBooking } from "@/lib/server/finance";
import {
  DOCUMENT_STORAGE_PROVIDER,
  buildInvoiceDrivePath,
  invoiceAccessUrl,
  isCloudinaryUrl,
} from "@/lib/storage/keys";
import { isGoogleDriveConfigured, uploadInvoicePdfToDrive } from "@/lib/storage/drive";
import { downloadInvoicePdfFromRecord, hasStoredInvoiceFile } from "@/lib/storage/invoicePdf";
import { validatePdfBuffer } from "@/lib/storage/validate";

/* eslint-disable @typescript-eslint/no-require-imports */
const { renderInvoicePdf } = require("./renderPdf") as {
  renderInvoicePdf: (invoice: Record<string, unknown>) => Promise<Buffer & { pageCount?: number }>;
};
const { sendInvoiceEmail } = require("./sendEmail") as {
  sendInvoiceEmail: (args: {
    invoice: Record<string, unknown>;
    pdfBuffer: Buffer;
    config: Record<string, unknown>;
  }) => Promise<{ skipped?: boolean; reason?: string; id?: string | null }>;
};

function emailPdfUrl(invoice: Record<string, unknown> | null | undefined): string {
  const stored = String(invoice?.pdfUrl || invoice?.invoicePdfUrl || "").trim();
  return isCloudinaryUrl(stored) ? stored : "";
}

async function recordInvoiceJob(
  db: Firestore,
  bookingId: string,
  patch: {
    status: "issued" | "failed";
    lastError?: string | null;
    googleDriveFileId?: string | null;
  },
) {
  const bookingRef = db.doc(`bookings/${bookingId}`);
  const snap = await bookingRef.get();
  const prev = (snap.data()?.invoiceJob || {}) as Record<string, unknown>;
  const attempts = Number(prev.attemptCount || 0) + 1;
  await bookingRef.set(
    {
      invoiceJob: {
        operationType: "generate",
        status: patch.status,
        attemptCount: attempts,
        lastError: patch.status === "failed" ? String(patch.lastError || "").slice(0, 500) : null,
        googleDriveFileId: patch.googleDriveFileId || prev.googleDriveFileId || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function generateAndStoreInvoiceInner(
  db: Firestore,
  options: {
    bookingId: string;
    booking?: Record<string, unknown>;
    force?: boolean;
    sendEmail?: boolean;
    secrets?: {
      resend?: Record<string, string>;
    };
  },
) {
  const bookingId = String(options.bookingId || "").trim();
  if (!bookingId) throw new Error("bookingId is required");

  const bookingRef = db.doc(`bookings/${bookingId}`);
  const bookingSnap = options.booking ? null : await bookingRef.get();
  const booking =
    options.booking ||
    (bookingSnap?.exists ? (bookingSnap.data() as Record<string, unknown>) : null);
  if (!booking) throw new Error("Booking not found");

  const invoiceId = invoiceDocId(bookingId);
  const invoiceRef = db.doc(`invoices/${invoiceId}`);
  const existingSnap = await invoiceRef.get();
  const existing = existingSnap.exists
    ? (existingSnap.data() as Record<string, unknown>)
    : null;
  const canonicalPdfUrl = invoiceAccessUrl(bookingId);
  const existingDriveId = String(existing?.googleDriveFileId || "").trim();

  if (hasStoredInvoiceFile(existing) && !options.force) {
    if (!booking.invoicePdfUrl || !booking.invoiceId) {
      await bookingRef.set(
        {
          invoiceId,
          invoiceNumber: existing?.invoiceNumber || "",
          invoicePdfUrl: canonicalPdfUrl,
          invoiceStatus: existing?.status || "issued",
          invoiceCreatedAt: existing?.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    let emailResult: Record<string, unknown> = {
      skipped: true,
      reason: "already_exists",
    };
    if (options.sendEmail !== false && shouldSendInvoiceEmail(existing)) {
      const pdfBuffer = await downloadInvoicePdfFromRecord(existing);
      if (pdfBuffer) {
        try {
          const sent = await sendInvoiceEmail({
            invoice: { ...existing, pdfUrl: emailPdfUrl(existing) },
            pdfBuffer,
            config: options.secrets?.resend || {},
          });
          emailResult = sent as Record<string, unknown>;
          const now = FieldValue.serverTimestamp();
          await invoiceRef.set(
            {
              emailSentAt: sent.skipped ? existing?.emailSentAt || null : now,
              emailStatus: sent.skipped ? sent.reason || "skipped" : "sent",
              emailSkipReason: sent.skipped ? sent.reason || null : null,
              emailId: sent.id || null,
              invoiceEmailStatus: sent.skipped ? "failed" : "sent",
              invoiceEmailSentAt: sent.skipped ? null : now,
              updatedAt: now,
            },
            { merge: true },
          );
        } catch (err) {
          emailResult = { skipped: false, error: String((err as Error)?.message || err) };
          await invoiceRef.set(
            {
              emailStatus: "failed",
              invoiceEmailStatus: "failed",
              emailError: emailResult.error,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      }
    }

    return {
      reused: true,
      invoiceId,
      invoiceNumber: existing?.invoiceNumber || "",
      pdfUrl: canonicalPdfUrl,
      googleDriveFileId: existingDriveId || null,
      fileKey: existingDriveId || null,
      storageProvider: existing?.storageProvider || DOCUMENT_STORAGE_PROVIDER,
      accessUrl: canonicalPdfUrl,
      email: emailResult,
    };
  }

  if (!isGoogleDriveConfigured()) {
    throw Object.assign(
      new Error("Google Drive is not configured for invoice storage"),
      { status: 503 },
    );
  }

  const [settingsSnap, generalSnap, techSnap] = await Promise.all([
    db.doc("settings/invoice").get(),
    db.doc("settings/general").get(),
    booking.technicianId
      ? db.doc(`technicians/${String(booking.technicianId)}`).get()
      : Promise.resolve(null),
  ]);
  const settingsRaw = settingsSnap.exists
    ? (settingsSnap.data() as Record<string, unknown>)
    : {};
  const settingsGeneral = generalSnap.exists
    ? (generalSnap.data() as Record<string, unknown>)
    : {};
  const technician =
    techSnap && "exists" in techSnap && techSnap.exists
      ? (techSnap.data() as Record<string, unknown>)
      : null;

  const finance = financeFromBooking({
    booking,
    settingsGeneral,
    settingsInvoice: {
      gstPercent: booking.gstPercent ?? settingsRaw.gstPercent,
    },
  });

  const invoiceData = assembleInvoiceData({
    booking,
    bookingId,
    settingsRaw,
    technician,
    finance,
    forceInvoiceNumber:
      options.force && existing?.invoiceNumber
        ? String(existing.invoiceNumber)
        : undefined,
  });

  const pdfBuffer = await renderInvoicePdf(invoiceData as unknown as Record<string, unknown>);
  validatePdfBuffer(pdfBuffer);

  const drivePath = buildInvoiceDrivePath({
    invoiceNumber: invoiceData.invoiceNumber,
    bookingId,
  });
  let uploaded: Awaited<ReturnType<typeof uploadInvoicePdfToDrive>>;
  try {
    uploaded = await uploadInvoicePdfToDrive({
      buffer: pdfBuffer,
      fileName: drivePath.fileName,
      year: drivePath.year,
      month: drivePath.month,
      overwriteFileId: existingDriveId,
    });
  } catch (err) {
    throw Object.assign(
      new Error(
        `Invoice PDF was generated but Google Drive upload failed: ${
          (err as Error)?.message || err
        }`,
      ),
      { status: 502 },
    );
  }

  const now = FieldValue.serverTimestamp();
  const customerId = invoiceData.customerId;
  const partnerId = invoiceData.technicianId;
  const firestoreInvoice: Record<string, unknown> = {
    bookingId,
    bookingCode: invoiceData.bookingCode,
    invoiceNumber: invoiceData.invoiceNumber,
    customerId,
    technicianId: partnerId,
    partnerId,
    customerName: invoiceData.customerName,
    customerPhone: invoiceData.customerPhone,
    customerEmail: invoiceData.customerEmail,
    customerAddress: invoiceData.customerAddress,
    serviceName: invoiceData.serviceName,
    technicianName: invoiceData.technicianName,
    partnerName: invoiceData.partnerName,
    partnerAddress: invoiceData.partnerAddress,
    partnerState: invoiceData.partnerState,
    partnerGstin: "",
    bookingDate: invoiceData.bookingDate,
    serviceDate: invoiceData.serviceDate,
    invoiceDate: invoiceData.invoiceDate,
    paymentDate: invoiceData.paymentDate,
    paymentMethod: invoiceData.paymentMethod,
    paymentStatus: invoiceData.paymentStatus,
    paymentId: invoiceData.paymentId,
    finance,
    subtotal: invoiceData.subtotal,
    discount: invoiceData.discount,
    gstPercent: invoiceData.gstPercent,
    gstAmount: invoiceData.gstAmount,
    cgstAmount: invoiceData.cgstAmount,
    sgstAmount: invoiceData.sgstAmount,
    grandTotal: invoiceData.grandTotal,
    amountInWords: invoiceData.amountInWords,
    currency: "INR",
    isRevisit: invoiceData.isRevisit,
    status: "issued",
    invoiceStatus: "issued",
    source: "vercel_api",
    storageProvider: DOCUMENT_STORAGE_PROVIDER,
    companyName: invoiceData.companyName,
    companyAddress: invoiceData.companyAddress,
    companyPhone: invoiceData.companyPhone,
    companyEmail: invoiceData.companyEmail,
    companyWebsite: invoiceData.companyWebsite,
    udyamNumber: invoiceData.udyamNumber,
    gstin: invoiceData.gstin,
    gstNumber: invoiceData.gstin,
    upiId: invoiceData.upiId,
    terms: invoiceData.terms,
    thankYouMessage: invoiceData.thankYouMessage,
    pdfUrl: canonicalPdfUrl,
    invoicePdfUrl: canonicalPdfUrl,
    googleDriveFileId: uploaded.fileId,
    googleDriveFolderId: uploaded.folderId,
    pdfFileKey: uploaded.fileId,
    fileKey: uploaded.fileId,
    pdfBytes: uploaded.bytes,
    fileName: uploaded.fileName,
    mimeType: uploaded.mimeType,
    pageCount: finance.invoicePageCount,
    generatedAt: now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    invoiceEmailStatus: "pending",
    ...(options.force ? { regeneratedAt: now } : {}),
  };

  await invoiceRef.set(firestoreInvoice, { merge: true });
  await bookingRef.set(
    {
      invoiceId,
      invoiceNumber: invoiceData.invoiceNumber,
      invoicePdfUrl: canonicalPdfUrl,
      invoiceStatus: "issued",
      invoiceCreatedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  try {
    const { sendBookingNotification } = await import("@/lib/notifications/send");
    await sendBookingNotification({
      eventType: "invoice_generated",
      bookingId,
      audience: "customer",
      title: "Invoice ready",
      body: `Your tax invoice ${invoiceData.invoiceNumber || ""} is ready.`,
    });
  } catch {
    /* invoice exists even if notify fails */
  }

  const invoiceForEmail = { ...invoiceData, pdfUrl: "" };
  let emailResult: Record<string, unknown> = { skipped: true, reason: "send_disabled" };
  if (options.sendEmail !== false && shouldSendInvoiceEmail(existing)) {
    try {
      emailResult = (await sendInvoiceEmail({
        invoice: invoiceForEmail,
        pdfBuffer,
        config: options.secrets?.resend || {},
      })) as Record<string, unknown>;
      await invoiceRef.set(
        {
          emailSentAt: emailResult.skipped ? null : now,
          emailStatus: emailResult.skipped ? "skipped" : "sent",
          emailSkipReason: emailResult.skipped ? emailResult.reason || null : null,
          emailId: emailResult.id || null,
          invoiceEmailStatus: emailResult.skipped ? "failed" : "sent",
          invoiceEmailSentAt: emailResult.skipped ? null : now,
          updatedAt: now,
        },
        { merge: true },
      );
    } catch (err) {
      emailResult = { skipped: false, error: String((err as Error)?.message || err) };
      await invoiceRef.set(
        {
          emailStatus: "failed",
          invoiceEmailStatus: "failed",
          emailError: emailResult.error,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  }

  return {
    reused: false,
    invoiceId,
    invoiceNumber: invoiceData.invoiceNumber,
    pdfUrl: canonicalPdfUrl,
    googleDriveFileId: uploaded.fileId,
    fileKey: uploaded.fileId,
    storageProvider: DOCUMENT_STORAGE_PROVIDER,
    accessUrl: canonicalPdfUrl,
    pageCount: finance.invoicePageCount,
    email: emailResult,
  };
}

export async function generateAndStoreInvoice(
  db: Firestore,
  options: {
    bookingId: string;
    booking?: Record<string, unknown>;
    force?: boolean;
    sendEmail?: boolean;
    secrets?: {
      resend?: Record<string, string>;
    };
  },
) {
  const bookingId = String(options.bookingId || "").trim();
  try {
    const result = await generateAndStoreInvoiceInner(db, options);
    if (bookingId) {
      await recordInvoiceJob(db, bookingId, {
        status: "issued",
        googleDriveFileId: String(result.googleDriveFileId || "") || null,
      }).catch(() => {});
    }
    return result;
  } catch (err) {
    if (bookingId) {
      await recordInvoiceJob(db, bookingId, {
        status: "failed",
        lastError: String((err as Error)?.message || err),
      }).catch(() => {});
    }
    throw err;
  }
}

export { shouldGenerateInvoice };
