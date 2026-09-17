/**
 * Slot visibility — ported from User App `bookingAllocationService.js` + `bookingSlots.js`.
 * Availability comes ONLY from `technicians/{id}/busySlots` (status: busy), not bookings.
 */

import type { BookingSlotDef } from "@/lib/booking/slots";
import { CUSTOMER_BOOKING_SLOTS } from "@/lib/booking/slots";
import { BOOKING_SLOT_START_HOUR_BY_INDEX } from "@/lib/booking/technician-slots";
import type { TechnicianDoc } from "@/lib/booking/types";
import { getTechnicianLatLng, haversineDistanceKm } from "@/lib/geo";

export type BusySlotEntry = {
  id?: string;
  date?: string;
  slotIndex?: number;
  status?: string;
  bookingId?: string;
};

/** `yyyy-MM-dd` in local timezone — matches User App `formatLocalDateKey`. */
export function formatLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isPastDateKey(dateStr: string, now = new Date()): boolean {
  return String(dateStr ?? "").trim() < formatLocalDateKey(now);
}

/** Local wall-clock past check — matches User App `isSlotPastForDate`. */
export function isSlotPastForDate(
  dateStr: string,
  slotIndex: number,
  now = new Date(),
): boolean {
  const idx = Number(slotIndex);
  const h = BOOKING_SLOT_START_HOUR_BY_INDEX[idx];
  if (h == null) return true;
  const parts = String(dateStr ?? "")
    .trim()
    .split("-")
    .map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return true;
  const [y, m, d] = parts;
  const slotStart = new Date(y, m - 1, d, h, 0, 0, 0);
  return slotStart.getTime() <= now.getTime();
}

export function isSlotPast(dateKey: string, slot: BookingSlotDef): boolean {
  return isSlotPastForDate(dateKey, slot.slotIndex);
}

export function getBusySlotDocumentId(dateStr: string, slotIndex: number): string {
  return `${dateStr}_${Number(slotIndex)}`;
}

function categoryIdsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "string" || typeof item === "number") {
      const s = String(item).trim();
      if (s) ids.push(s);
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const s = String(rec.id ?? rec.categoryId ?? "").trim();
      if (s) ids.push(s);
    }
  }
  return ids;
}

/** Matches User App `techMatchesCategory`. */
export function techMatchesCategory(
  data: Record<string, unknown>,
  categoryId: string,
): boolean {
  const c = String(categoryId ?? "").trim();
  if (!c) return false;
  const single = String(data.categoryId ?? "").trim();
  if (single && single === c) return true;
  const primary = String(data.primaryCategoryId ?? "").trim();
  if (primary && primary === c) return true;
  const fromIds = categoryIdsFromUnknown(data.categoryIds);
  if (fromIds.some((x) => x === c)) return true;
  const fromCats = categoryIdsFromUnknown(data.categories);
  if (fromCats.some((x) => x === c)) return true;
  return false;
}

export function fetchTechniciansMatchingCategory(
  technicians: TechnicianDoc[],
  categoryId: string,
): TechnicianDoc[] {
  const c = String(categoryId ?? "").trim();
  if (!c) return [];
  return technicians.filter((t) =>
    techMatchesCategory(t as unknown as Record<string, unknown>, c),
  );
}

function normalizeVerificationStatus(data: Record<string, unknown>): string {
  const alt = data.verificationStatus ?? data.accountStatus;
  if (alt != null && String(alt).trim() !== "") {
    return String(alt).trim().toLowerCase();
  }
  const st = String(data.status ?? "").trim().toLowerCase();
  if (st === "pending" || st === "active" || st === "rejected" || st === "inactive") {
    return st;
  }
  // Shift values such as Available/Busy/Offline must not be treated as account lifecycle.
  return "";
}

function isBlockedAccountLifecycle(status: string): boolean {
  return (
    status === "rejected" ||
    status === "pending" ||
    status === "inactive" ||
    status === "suspended"
  );
}

/**
 * Approval/KYC only. Slot freedom comes from busySlots, not shiftStatus.
 * Admin approve writes verificationStatus: "approved" and accountStatus: "active".
 */
export function isPartnerAssignable(tech: TechnicianDoc | Record<string, unknown>): boolean {
  const data = tech as unknown as Record<string, unknown>;
  if (!tech || data.suspended === true) return false;
  const kycStatus = String(
    (data.kyc as { status?: string } | undefined)?.status ?? "",
  )
    .trim()
    .toLowerCase();
  if (kycStatus && kycStatus !== "approved") return false;
  const accountStatus = normalizeVerificationStatus(data);
  if (isBlockedAccountLifecycle(accountStatus)) return false;
  return true;
}

/** Rank eligible partners by distance. There is no km cap. Missing coords never hide a partner. */
export function rankPartnersByDistance(
  technicians: TechnicianDoc[],
  userLat: number,
  userLng: number,
): TechnicianDoc[] {
  const ulat = Number(userLat);
  const ulng = Number(userLng);
  const canRank = Number.isFinite(ulat) && Number.isFinite(ulng);

  return technicians
    .filter((tech) => isPartnerAssignable(tech))
    .map((tech) => {
      const { lat, lng } = getTechnicianLatLng(
        tech as unknown as Record<string, unknown>,
      );
      const hasLoc = lat != null && lng != null;
      return {
        tech,
        distanceKm:
          canRank && hasLoc
            ? haversineDistanceKm(ulat, ulng, lat, lng)
            : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((row) => row.tech);
}

/** @deprecated Use rankPartnersByDistance. radiusKm is ignored. */
export function filterWithinRadiusKm(
  technicians: TechnicianDoc[],
  userLat: number,
  userLng: number,
  _radiusKm?: number,
): TechnicianDoc[] {
  return rankPartnersByDistance(technicians, userLat, userLng);
}

function isSlotBusyEntry(entry: BusySlotEntry | null | undefined): boolean {
  if (!entry) return false;
  return String(entry.status ?? "").toLowerCase() === "busy";
}

function busyEntryForSlot(
  busyDocs: BusySlotEntry[],
  dateKey: string,
  slotIndex: number,
): BusySlotEntry | null {
  const docId = getBusySlotDocumentId(dateKey, slotIndex);
  const match =
    busyDocs.find((d) => d.id === docId) ??
    busyDocs.find(
      (d) =>
        String(d.date ?? "") === dateKey && Number(d.slotIndex) === slotIndex,
    );
  return match ?? null;
}

export type SlotVisibilityDebug = {
  dateKey: string;
  categoryId: string;
  radiusKm: number;
  userLat: number;
  userLng: number;
  categoryMatchCount: number;
  eligibleCount: number;
  pastFiltered: number;
  fullyBusy: number;
  visibleCount: number;
};

/**
 * Matches User App `getVisibleSlotsForDate` slot list (busySlots only).
 */
export function computeVisibleSlots(params: {
  categoryId: string;
  userLat: number;
  userLng: number;
  dateKey: string;
  radiusKm: number;
  allTechnicians: TechnicianDoc[];
  busyByTech: Record<string, BusySlotEntry[]>;
}): { slots: BookingSlotDef[]; debug: SlotVisibilityDebug } {
  const { categoryId, userLat, userLng, dateKey, radiusKm, allTechnicians, busyByTech } =
    params;

  const categoryMatch = fetchTechniciansMatchingCategory(allTechnicians, categoryId);
  const eligible = rankPartnersByDistance(categoryMatch, userLat, userLng);
  const ids = eligible.map((t) => t.id);

  const debug: SlotVisibilityDebug = {
    dateKey,
    categoryId,
    radiusKm,
    userLat,
    userLng,
    categoryMatchCount: categoryMatch.length,
    eligibleCount: ids.length,
    pastFiltered: 0,
    fullyBusy: 0,
    visibleCount: 0,
  };

  if (!dateKey || ids.length === 0) {
    return { slots: [], debug };
  }

  const visible = CUSTOMER_BOOKING_SLOTS.filter((def) => {
    if (isSlotPastForDate(dateKey, def.slotIndex)) {
      debug.pastFiltered += 1;
      return false;
    }
    const idx = def.slotIndex;
    for (const tid of ids) {
      const row = busyEntryForSlot(busyByTech[tid] ?? [], dateKey, idx);
      if (!isSlotBusyEntry(row)) return true;
    }
    debug.fullyBusy += 1;
    return false;
  });

  debug.visibleCount = visible.length;
  return { slots: visible, debug };
}

export function isSlotStillAvailable(params: {
  categoryId: string;
  userLat: number;
  userLng: number;
  dateStr: string;
  slotIndex: number;
  radiusKm: number;
  allTechnicians: TechnicianDoc[];
  busyByTech: Record<string, BusySlotEntry[]>;
}): boolean {
  const idx = Number(params.slotIndex);
  if (isPastDateKey(params.dateStr) || isSlotPastForDate(params.dateStr, idx)) {
    return false;
  }
  const eligible = rankPartnersByDistance(
    fetchTechniciansMatchingCategory(params.allTechnicians, params.categoryId),
    params.userLat,
    params.userLng,
  );
  if (!eligible.length) return false;

  for (const tech of eligible) {
    const row = busyEntryForSlot(
      params.busyByTech[tech.id] ?? [],
      params.dateStr,
      idx,
    );
    if (!isSlotBusyEntry(row)) return true;
  }
  return false;
}
