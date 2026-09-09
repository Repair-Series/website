import type { ApiCaller } from "@/lib/server/auth";
import { assertBookingAccess } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

export const UPLOAD_KINDS = [
  "profile-user",
  "profile-partner",
  "service",
  "category",
  "coming-soon",
  "banner",
  "offer",
  "home-section",
  "kyc",
  "booking-start",
  "booking-complete",
  "booking-pause-damaged",
  "booking-pause-resume",
  "payment-qr",
  "company",
  "spare-part",
] as const;

export type UploadKind = (typeof UPLOAD_KINDS)[number];

const KIND_ALIASES: Record<string, UploadKind> = {
  "customer-profile": "profile-user",
  "user-profile": "profile-user",
  "partner-profile": "profile-partner",
  "technician-profile": "profile-partner",
};

export function parseUploadKind(value: unknown): UploadKind {
  const raw = String(value || "").trim();
  if (!raw) {
    throw Object.assign(new Error("Missing kind"), { status: 400 });
  }
  const kind = (KIND_ALIASES[raw] || raw) as UploadKind;
  if (!UPLOAD_KINDS.includes(kind)) {
    throw Object.assign(new Error("Invalid kind"), { status: 400 });
  }
  return kind;
}

export type UploadMeta = {
  kind: UploadKind;
  ownerId: string;
  serviceName?: string;
  serviceId?: string;
  categoryName?: string;
  categoryId?: string;
  slot?: string;
  section?: string;
  bannerId?: string;
  offerId?: string;
  sectionId?: string;
  bookingId?: string;
  side?: string;
};

type FormLike = {
  get(name: string): unknown;
};

export function metaFromForm(form: FormLike, caller: ApiCaller): UploadMeta {
  const kind = parseUploadKind(form.get("kind"));
  const ownerId = String(form.get("ownerId") || caller.uid).trim();
  return {
    kind,
    ownerId,
    serviceName: String(form.get("serviceName") || "").trim() || undefined,
    serviceId: String(form.get("serviceId") || "").trim() || undefined,
    categoryName: String(form.get("categoryName") || "").trim() || undefined,
    categoryId: String(form.get("categoryId") || "").trim() || undefined,
    slot: String(form.get("slot") || "").trim() || undefined,
    section: String(form.get("section") || "").trim() || undefined,
    bannerId: String(form.get("bannerId") || "").trim() || undefined,
    offerId: String(form.get("offerId") || "").trim() || undefined,
    sectionId: String(form.get("sectionId") || "").trim() || undefined,
    bookingId: String(form.get("bookingId") || "").trim() || undefined,
    side: String(form.get("side") || "").trim() || undefined,
  };
}

const ADMIN_KINDS = new Set<UploadKind>([
  "service",
  "category",
  "coming-soon",
  "banner",
  "offer",
  "home-section",
  "payment-qr",
  "company",
  "spare-part",
]);

const BOOKING_KINDS = new Set<UploadKind>([
  "booking-start",
  "booking-complete",
  "booking-pause-damaged",
  "booking-pause-resume",
]);

export async function authorizeUpload(
  caller: ApiCaller,
  meta: UploadMeta,
): Promise<void> {
  if (caller.role === "internal") return;

  if (ADMIN_KINDS.has(meta.kind)) {
    if (caller.role !== "admin") {
      throw Object.assign(new Error("Admin only"), { status: 403 });
    }
    return;
  }

  if (meta.kind === "profile-user") {
    if (caller.role !== "customer" && caller.role !== "admin") {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }
    if (caller.role === "customer" && meta.ownerId !== caller.uid) {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }
    return;
  }

  if (meta.kind === "profile-partner" || meta.kind === "kyc") {
    if (caller.role !== "technician" && caller.role !== "admin") {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }
    if (caller.role === "technician" && meta.ownerId !== caller.uid) {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }
    return;
  }

  if (BOOKING_KINDS.has(meta.kind)) {
    if (!meta.bookingId) {
      throw Object.assign(new Error("bookingId is required"), { status: 400 });
    }
    if (caller.role !== "technician" && caller.role !== "admin") {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }
    const snap = await getAdminDb().doc(`bookings/${meta.bookingId}`).get();
    if (!snap.exists) {
      throw Object.assign(new Error("Booking not found"), { status: 404 });
    }
    assertBookingAccess(caller, (snap.data() || {}) as Record<string, unknown>);
    return;
  }

  throw Object.assign(new Error("Not allowed"), { status: 403 });
}
