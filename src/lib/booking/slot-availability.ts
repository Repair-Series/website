import {
  collection,
  doc,
  getDoc,
  getDocs,
  type Firestore,
} from "firebase/firestore";
import { verifyBusySlotsFree } from "@/lib/booking/busy-slots";
import {
  buildSlotDocId,
  descriptorForSlot,
  type SlotDescriptor,
} from "@/lib/booking/technician-slots";
import {
  CUSTOMER_BOOKING_SLOTS,
  isSlotPast,
  type BookingSlotDef,
} from "@/lib/booking/slots";
import { computeVisibleSlots } from "@/lib/booking/slot-allocation";
import type { ServiceDoc, TechnicianDoc } from "@/lib/booking/types";
import { getTechnicianLatLng, haversineDistanceKm } from "@/lib/geo";

export async function loadTechnicians(db: Firestore): Promise<TechnicianDoc[]> {
  const snap = await getDocs(collection(db, "technicians"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
}

const ACTIVE_BOOKING_STATUSES = new Set([
  "new",
  "pending",
  "assigned",
  "inprogress",
  "started",
  "processing",
  "upcoming",
]);

export type BusySlotDoc = {
  id: string;
  date?: string;
  slotIndex?: number;
  status?: string;
  reason?: string;
  bookingId?: string;
};

export function isTechnicianShiftAvailable(technician: TechnicianDoc): boolean {
  const sh = technician.shiftStatus;
  if (sh === "Busy" || sh === "Offline") return false;
  const legacy = technician.status;
  if (legacy === "Busy" || legacy === "Offline") return false;
  return true;
}

export function normalizeVerificationStatus(technician: TechnicianDoc): string {
  const alt = technician.verificationStatus ?? technician.accountStatus;
  if (alt != null && String(alt).trim() !== "") {
    return String(alt).trim().toLowerCase();
  }
  const st = String(technician.status ?? "").trim().toLowerCase();
  if (st === "pending" || st === "active" || st === "rejected") return st;
  return "active";
}

export function isTechnicianAssignable(technician: TechnicianDoc): boolean {
  if (!technician || technician.suspended === true) return false;
  const kycStatus = String(technician.kyc?.status ?? "").toLowerCase();
  const accountStatus = normalizeVerificationStatus(technician);
  if (
    (accountStatus === "active" || accountStatus === "") &&
    (!kycStatus || kycStatus === "approved")
  ) {
    return true;
  }
  if (accountStatus === "active" && kycStatus === "approved") return true;
  if (!accountStatus && !kycStatus) return true;
  return accountStatus === "active";
}

export function getServiceCategoryId(service: ServiceDoc): string {
  return service.categoryId ?? service.category_id ?? "";
}

export function technicianMatchesServiceCategory(
  technician: TechnicianDoc,
  service: ServiceDoc | null,
): boolean {
  const categoryId = getServiceCategoryId(service ?? ({} as ServiceDoc));
  if (!categoryId) return true;
  const target = String(categoryId).trim();
  const single = String(technician.categoryId ?? "").trim();
  if (single && single === target) return true;
  const arr = Array.isArray(
    (technician as { categoryIds?: string[] }).categoryIds,
  )
    ? (technician as { categoryIds?: string[] }).categoryIds!
    : [];
  return arr.some((id) => String(id).trim() === target);
}

export function technicianWithinBookingRadius(
  technician: TechnicianDoc,
  bookingLatLng: { lat: number | null; lng: number | null },
  platformKm: number,
): boolean {
  const { lat: tLat, lng: tLng } = getTechnicianLatLng(
    technician as unknown as Record<string, unknown>,
  );
  if (tLat == null || tLng == null) return false;
  const defaultR = Number(platformKm) > 0 ? Number(platformKm) : 10;
  const techR =
    Number(technician.serviceRadius) > 0
      ? Number(technician.serviceRadius)
      : defaultR;
  const maxKm = Math.min(techR, defaultR);
  const { lat: bLat, lng: bLng } = bookingLatLng;
  if (bLat == null || bLng == null) return true;
  return haversineDistanceKm(tLat, tLng, bLat, bLng) <= maxKm;
}

export function getEligibleTechnicians(
  technicians: TechnicianDoc[],
  service: ServiceDoc,
  bookingLatLng: { lat: number; lng: number },
  platformKm: number,
): TechnicianDoc[] {
  return technicians.filter(
    (t) =>
      isTechnicianAssignable(t) &&
      isTechnicianShiftAvailable(t) &&
      technicianMatchesServiceCategory(t, service) &&
      technicianWithinBookingRadius(t, bookingLatLng, platformKm),
  );
}

export function getBookingSlotFromDoc(
  data: Record<string, unknown>,
): { dateKey: string; slotIndex: number } | null {
  const dateKey = String(
    data.scheduledSlotDate ??
      data.scheduleDateKey ??
      data.bookingDate ??
      data.date ??
      "",
  ).trim();
  if (!dateKey) return null;

  let slotIndex: number | null = null;
  if (data.scheduledSlotIndex != null && data.scheduledSlotIndex !== "") {
    const n = Number(data.scheduledSlotIndex);
    if (Number.isFinite(n)) slotIndex = n;
  }
  if (slotIndex == null && data.scheduleSlotIndex != null) {
    const n = Number(data.scheduleSlotIndex);
    if (Number.isFinite(n)) slotIndex = n;
  }
  if (slotIndex == null) return null;
  return { dateKey, slotIndex };
}

export function isActiveBookingStatus(status: unknown): boolean {
  return ACTIVE_BOOKING_STATUSES.has(
    String(status ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ""),
  );
}

export function isSlotBusyInBusySlots(
  busyDocs: BusySlotDoc[],
  dateKey: string,
  slotIndex: number,
): boolean {
  const docId = buildSlotDocId(dateKey, slotIndex);
  const match =
    busyDocs.find((d) => d.id === docId) ??
    busyDocs.find(
      (d) =>
        String(d.date ?? "") === dateKey &&
        Number(d.slotIndex) === slotIndex,
    );
  if (!match) return false;
  return String(match.status ?? "").toLowerCase() === "busy";
}

export function isSlotBookedForTechnician(
  bookings: Record<string, unknown>[],
  technicianId: string,
  dateKey: string,
  slotIndex: number,
): boolean {
  return bookings.some((b) => {
    if (String(b.technicianId ?? "") !== technicianId) return false;
    if (!isActiveBookingStatus(b.status)) return false;
    const slot = getBookingSlotFromDoc(b);
    return (
      slot != null &&
      slot.dateKey === dateKey &&
      slot.slotIndex === slotIndex
    );
  });
}

export function isTechnicianFreeForSlot(
  technicianId: string,
  dateKey: string,
  slotIndex: number,
  busyByTech: Record<string, BusySlotDoc[]>,
  bookings: Record<string, unknown>[],
): boolean {
  const busyDocs = busyByTech[technicianId] ?? [];
  if (isSlotBusyInBusySlots(busyDocs, dateKey, slotIndex)) return false;
  if (isSlotBookedForTechnician(bookings, technicianId, dateKey, slotIndex)) {
    return false;
  }
  return true;
}

export function computeAvailableSlots(params: {
  dateKey: string;
  eligibleTechnicians: TechnicianDoc[];
  busyByTech: Record<string, BusySlotDoc[]>;
  bookings: Record<string, unknown>[];
  categoryId?: string;
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
  allTechnicians?: TechnicianDoc[];
}): BookingSlotDef[] {
  const categoryId = params.categoryId ?? "";
  const allTechnicians = params.allTechnicians ?? params.eligibleTechnicians;
  const userLat = params.userLat ?? 0;
  const userLng = params.userLng ?? 0;
  const radiusKm = params.radiusKm ?? 25;

  const busyByTech: Record<string, import("@/lib/booking/slot-allocation").BusySlotEntry[]> =
    {};
  for (const [tid, docs] of Object.entries(params.busyByTech)) {
    busyByTech[tid] = docs;
  }

  const { slots } = computeVisibleSlots({
    categoryId,
    userLat,
    userLng,
    dateKey: params.dateKey,
    radiusKm,
    allTechnicians,
    busyByTech,
  });
  return slots;
}

export async function loadGeneralSettings(db: Firestore) {
  const snap = await getDoc(doc(db, "settings", "general"));
  if (!snap.exists()) return { defaultTechnicianServiceRadiusKm: 10 };
  const data = snap.data() as { defaultTechnicianServiceRadiusKm?: number };
  return {
    defaultTechnicianServiceRadiusKm: Number(
      data.defaultTechnicianServiceRadiusKm ?? 10,
    ),
  };
}

export async function findTechnicianForSlot(
  db: Firestore,
  params: {
    service: ServiceDoc;
    dateKey: string;
    slotIndex: number;
    bookingLatLng: { lat: number; lng: number };
    platformRadiusKm: number;
    busyByTech?: Record<string, BusySlotDoc[]>;
    bookings?: Record<string, unknown>[];
  },
): Promise<string | null> {
  const technicians = await loadTechnicians(db);
  const eligible = getEligibleTechnicians(
    technicians,
    params.service,
    params.bookingLatLng,
    params.platformRadiusKm,
  );
  const descriptor = descriptorForSlot(params.dateKey, params.slotIndex);
  const sorted = [...eligible].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );

  for (const tech of sorted) {
    if (params.busyByTech && params.bookings) {
      if (
        !isTechnicianFreeForSlot(
          tech.id,
          params.dateKey,
          params.slotIndex,
          params.busyByTech,
          params.bookings,
        )
      ) {
        continue;
      }
    }
    const v = await verifyBusySlotsFree(db, tech.id, [descriptor], null);
    if (v.ok) return tech.id;
  }
  return null;
}

export function slotToDescriptor(
  dateKey: string,
  slot: BookingSlotDef,
): SlotDescriptor {
  return descriptorForSlot(dateKey, slot.slotIndex);
}
