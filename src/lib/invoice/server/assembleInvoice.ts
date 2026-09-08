/* eslint-disable @typescript-eslint/no-require-imports */
const { amountInWords } = require("./amountInWords") as {
  amountInWords: (n: number) => string;
};
const { formatCompanyAddress, normalizeInvoiceSettings } = require("./defaults") as {
  formatCompanyAddress: (settings: Record<string, string>) => string;
  normalizeInvoiceSettings: (raw?: Record<string, unknown>) => Record<string, string> & {
    gstPercent: number;
    terms: string[];
  };
};
import {
  financeFromBooking,
  resolveInvoiceNumber,
  type FinanceSnapshot,
} from "@/lib/server/finance";

type UnknownRecord = Record<string, unknown>;

function money(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

function cleanText(value: unknown, fallback = "") {
  const text = value != null ? String(value).trim() : "";
  return text || fallback;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(value: unknown) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function addressText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const obj = value as UnknownRecord;
  const full = cleanText(obj.fullAddress ?? obj.address);
  if (full) return full;
  return [
    obj.line1,
    obj.line2,
    obj.landmark,
    obj.city,
    obj.state,
    obj.pincode ?? obj.zip,
  ]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(", ");
}

function paymentMethodLabel(method: unknown) {
  const key = cleanText(method).toLowerCase();
  if (!key) return "Cash / UPI / Card";
  if (key === "rs_app") return "RS App";
  if (key === "upi") return "UPI";
  if (key === "qr") return "QR / UPI";
  if (key === "cash") return "Cash";
  if (key === "card") return "Card";
  if (key === "free" || key === "free_revisit") return "Free / Revisit";
  return cleanText(method);
}

function payableFromBooking(booking: UnknownRecord) {
  const stored = money(
    booking.finalBookingAmount ?? booking.totalAmount ?? booking.payableAmount,
  );
  if (stored > 0) return stored;
  return 0;
}

export type AssembledInvoice = ReturnType<typeof assembleInvoiceData>;

export function assembleInvoiceData(opts: {
  booking: UnknownRecord;
  bookingId: string;
  settingsRaw: UnknownRecord;
  technician?: UnknownRecord | null;
  finance?: FinanceSnapshot;
  forceInvoiceNumber?: string;
}) {
  const settings = normalizeInvoiceSettings(opts.settingsRaw || {});
  const booking = opts.booking || {};
  const bookingId = opts.bookingId;
  const finance =
    opts.finance ||
    financeFromBooking({
      booking,
      settingsGeneral: {},
      settingsInvoice: opts.settingsRaw || {},
    });

  const now = new Date();
  const ymd = formatYmd(now);
  const invoiceNumber = resolveInvoiceNumber({
    existingNumber: opts.forceInvoiceNumber,
    prefix: settings.invoicePrefix,
    bookingId,
    now,
  });
  const fileName = `INV-${ymd}-${bookingId}.pdf`;
  const folder = `repair-series/invoices/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;

  const paymentStatus = cleanText(booking.paymentStatus).toLowerCase() || "paid";
  const grandTotal = finance.finalAmount || payableFromBooking(booking);
  const isFree =
    booking.isRevisit === true ||
    booking.revisit === true ||
    paymentStatus === "free" ||
    grandTotal === 0;

  const tech = opts.technician || {};
  const customerAddress = addressText(booking.address ?? booking.location);
  const customerState = cleanText(
    (booking.address as UnknownRecord | undefined)?.state ??
      (booking.location as UnknownRecord | undefined)?.state,
  );
  const partnerAddress = cleanText(
    tech.areaAddress ??
      tech.address ??
      (booking.technician as UnknownRecord | undefined)?.areaAddress,
  );
  const partnerState = cleanText(
    tech.state ??
      (tech.kyc as UnknownRecord | undefined)?.state ??
      (booking.technician as UnknownRecord | undefined)?.state,
  );

  return {
    invoiceId: `inv_${bookingId}`,
    invoiceNumber,
    fileName,
    folder,
    publicId: `${folder}/${fileName.replace(/\.pdf$/i, "")}`,
    bookingId,
    bookingCode: cleanText(booking.bookingCode),
    customerId: cleanText(booking.customerId),
    technicianId: cleanText(booking.technicianId),
    customerName: cleanText(booking.customerName, "Customer"),
    customerPhone: cleanText(booking.customerPhone ?? booking.phone),
    customerEmail: cleanText(booking.customerEmail),
    customerAddress,
    customerState,
    placeOfSupply: cleanText(settings.state, customerState),
    serviceName: cleanText(booking.serviceName, "Service"),
    technicianName: cleanText(
      booking.technicianName ??
        tech.name ??
        (booking.technician as UnknownRecord | undefined)?.name,
    ),
    partnerName: cleanText(
      tech.name ?? booking.technicianName ?? (booking.technician as UnknownRecord | undefined)?.name,
      "Partner",
    ),
    partnerAddress,
    partnerState,
    partnerGstin: "",
    bookingDate: formatDateLabel(booking.createdAt ?? booking.bookingDate),
    serviceDate: formatDateLabel(
      booking.completedAt ?? booking.serviceCompletedAt ?? booking.scheduledAt,
    ),
    invoiceDate: formatDateLabel(now),
    paymentDate: formatDateLabel(booking.paidAt ?? booking.completedAt ?? now),
    paymentMethod: paymentMethodLabel(
      booking.paymentMethod || (isFree ? "free_revisit" : ""),
    ),
    paymentStatus: isFree ? "free" : paymentStatus || "paid",
    paymentId: cleanText(
      booking.paymentId ??
        booking.razorpayPaymentId ??
        booking.txnId ??
        booking.transactionId,
    ),
    finance,
    subtotal: finance.taxableValue,
    discount: finance.discount,
    gstPercent: finance.gstPercent,
    gstAmount: finance.gstAmount,
    cgstAmount: finance.cgstAmount,
    sgstAmount: finance.sgstAmount,
    grandTotal,
    amountInWords: amountInWords(grandTotal),
    currency: "INR",
    isRevisit: booking.isRevisit === true || booking.revisit === true,
    status: "issued",
    source: "vercel_api",
    companyName: settings.companyName,
    legalName: settings.legalName,
    companyAddress: formatCompanyAddress(settings),
    companyPhone: settings.phone,
    companyEmail: settings.email,
    companyWebsite: settings.website,
    udyamNumber: settings.udyamNumber,
    gstin: settings.gstin,
    upiId: settings.upiId,
    terms: settings.terms,
    thankYouMessage: settings.thankYouMessage,
    logoUrl: settings.logoUrl,
    companyState: settings.state,
    settings,
  };
}

export function shouldGenerateInvoice(booking: UnknownRecord) {
  const status = cleanText(booking?.status).toLowerCase();
  if (status !== "completed") return false;
  const paymentStatus = cleanText(booking?.paymentStatus).toLowerCase();
  if (paymentStatus === "paid" || paymentStatus === "free") return true;
  const total = payableFromBooking(booking || {});
  if ((booking?.isRevisit === true || booking?.revisit === true) && total === 0) {
    return true;
  }
  return total === 0;
}
