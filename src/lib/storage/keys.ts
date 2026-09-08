export const IMAGE_STORAGE_PROVIDER = "cloudinary" as const;
export const DOCUMENT_STORAGE_PROVIDER = "google-drive" as const;
/** @deprecated Use IMAGE_STORAGE_PROVIDER. Kept so older callers compile. */
export const STORAGE_PROVIDER = IMAGE_STORAGE_PROVIDER;

const MAX_SLUG_LEN = 60;
const ROOT = "repair-series";

/** URL-safe folder segment from a human name. Never use raw user input as a path. */
export function slugifyName(value: unknown, fallback = "item"): string {
  const text = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN);
  return text || fallback;
}

export function safeId(value: unknown, fallback = "new"): string {
  const text = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return text || fallback;
}

function stamp(): string {
  return `${Date.now().toString(36)}`;
}

export type ImageKeyInput = {
  kind: string;
  ownerId?: string;
  serviceName?: string;
  serviceId?: string;
  slot?: string;
  section?: string;
  bannerId?: string;
  offerId?: string;
  sectionId?: string;
  categoryName?: string;
  categoryId?: string;
  bookingId?: string;
  side?: string;
  contentType?: string;
};

/**
 * Cloudinary public_id (no file extension).
 * Images live under repair-series/...
 */
export function buildPublicImageKey(input: ImageKeyInput): string {
  const slot = slugifyName(input.slot, "image");
  const kind = input.kind;

  switch (kind) {
    case "profile-user":
      return `${ROOT}/profiles/customers/${safeId(input.ownerId)}/profile`;
    case "profile-partner":
      return `${ROOT}/profiles/partners/${safeId(input.ownerId)}/profile`;
    case "service": {
      const slug = slugifyName(input.serviceName, "service");
      const id = safeId(input.serviceId, "new");
      return `${ROOT}/services/${slug}/${id}/${slot}-${stamp()}`;
    }
    case "category": {
      const slug = slugifyName(input.categoryName || input.serviceName, "category");
      const id = safeId(input.categoryId || input.serviceId, "new");
      return `${ROOT}/categories/${slug}/${id}/${slot}-${stamp()}`;
    }
    case "coming-soon": {
      const slug = slugifyName(input.serviceName, "coming-soon");
      const id = safeId(input.serviceId, "new");
      return `${ROOT}/coming-soon/${slug}/${id}/${slot}-${stamp()}`;
    }
    case "banner": {
      const section = slugifyName(input.section, "home");
      const id = safeId(input.bannerId, "draft");
      return `${ROOT}/banners/${section}/${id}-${slot}-${stamp()}`;
    }
    case "offer":
      return `${ROOT}/offers/${safeId(input.offerId, "draft")}-${stamp()}`;
    case "home-section":
      return `${ROOT}/home-sections/${safeId(input.sectionId, "draft")}-${stamp()}`;
    case "kyc": {
      const side = slugifyName(input.side, "document");
      return `${ROOT}/kyc/${safeId(input.ownerId)}/aadhaar-${side}-${stamp()}`;
    }
    case "booking-start":
      return `${ROOT}/bookings/${safeId(input.bookingId)}/start-${stamp()}`;
    case "booking-complete":
      return `${ROOT}/bookings/${safeId(input.bookingId)}/complete-${stamp()}`;
    case "booking-pause-damaged":
      return `${ROOT}/bookings/${safeId(input.bookingId)}/pause-damaged-${stamp()}`;
    case "booking-pause-resume":
      return `${ROOT}/bookings/${safeId(input.bookingId)}/pause-resume-${stamp()}`;
    case "payment-qr":
      return `${ROOT}/company/payment-qr-${stamp()}`;
    case "company":
      return `${ROOT}/company/${slugifyName(input.slot, "logo")}`;
    case "spare-part":
      return `${ROOT}/spare-parts/${safeId(input.serviceId, "part")}/${slot}-${stamp()}`;
    default:
      throw Object.assign(new Error("Unsupported upload type"), { status: 400 });
  }
}

export function shouldOverwriteCloudinary(kind: string): boolean {
  return kind === "profile-user" || kind === "profile-partner" || kind === "company";
}

export function buildInvoiceDrivePath(input: {
  invoiceNumber?: string;
  bookingId?: string;
  now?: Date;
}): { year: string; month: string; fileName: string } {
  const now = input.now || new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const invoice = safeId(
    input.invoiceNumber || input.bookingId,
    `INV-${year}${month}-${safeId(input.bookingId, "booking")}`,
  );
  return { year, month, fileName: `${invoice}.pdf` };
}

/** @deprecated Invoice PDFs are stored on Google Drive, not object-storage keys. */
export function buildInvoiceKey(input: {
  customerId?: string;
  invoiceNumber?: string;
  bookingId?: string;
  now?: Date;
}): string {
  const path = buildInvoiceDrivePath(input);
  return `invoices/${path.year}/${path.month}/${path.fileName}`;
}

export function isInvoiceKey(key: string): boolean {
  const value = String(key || "");
  return value.startsWith("invoices/") || value.startsWith(`${ROOT}/invoices/`);
}

export function websitePublicOrigin(): string {
  const raw = String(
    process.env.WEBSITE_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "") ||
      "https://www.repairseries.in",
  )
    .trim()
    .replace(/\/$/, "");
  return raw || "https://www.repairseries.in";
}

export function invoiceAccessUrl(bookingId: string): string {
  return `${websitePublicOrigin()}/api/invoices/file?bookingId=${encodeURIComponent(bookingId)}`;
}

export function isCloudinaryUrl(url: string): boolean {
  return /res\.cloudinary\.com/i.test(String(url || ""));
}

export function isFirebaseStorageUrl(url: string): boolean {
  return /firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(
    String(url || ""),
  );
}
