import { addDays, format } from "date-fns";
import {
  formatLocalDateKey,
  isPastDateKey as isPastDateKeyLocal,
  isSlotPastForDate,
} from "@/lib/booking/slot-allocation";
import { slotLabelFromIndex, slotStartHourFromIndex } from "@/lib/booking/technician-slots";

/** Customer-facing 1-hour slots (8 AM – 6 PM IST) — indices 1–10, same as User App. */
export type BookingSlotDef = {
  /** String id used in draft — same as slotIndex */
  id: string;
  slotIndex: number;
  startHour: number;
  label: string;
  shortLabel: string;
};

function shortLabelFromCanonical(label: string): string {
  return label.replace(/:00/g, "").replace(" - ", "-");
}

/** Indices 1–10 → 8:00–9:00 through 5:00–6:00 (User App `BOOKING_DAY_SLOTS`). */
export const CUSTOMER_BOOKING_SLOTS: BookingSlotDef[] = Array.from(
  { length: 10 },
  (_, i) => {
    const slotIndex = i + 1;
    const startHour = slotStartHourFromIndex(slotIndex);
    const label = slotLabelFromIndex(slotIndex);
    return {
      id: String(slotIndex),
      slotIndex,
      startHour,
      label,
      shortLabel: shortLabelFromCanonical(label),
    };
  },
);

export type DateOption = {
  key: string;
  label: string;
};

export function getDateOptions(): DateOption[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const key = formatLocalDateKey(d);
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE, d MMM");
    return { key, label };
  });
}

export function formatDateKeyLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return format(new Date(y, m - 1, d), "EEE, d MMM yyyy");
}

export function isSlotPast(dateKey: string, slot: BookingSlotDef): boolean {
  return isSlotPastForDate(dateKey, slot.slotIndex);
}

export function isPastDateKey(dateKey: string, now = new Date()): boolean {
  return isPastDateKeyLocal(dateKey, now);
}

export function getSlotById(slotId: string): BookingSlotDef | undefined {
  return CUSTOMER_BOOKING_SLOTS.find((s) => s.id === slotId);
}

export function getSlotByIndex(slotIndex: number): BookingSlotDef | undefined {
  const idx = Number(slotIndex);
  if (!Number.isFinite(idx)) return undefined;
  return CUSTOMER_BOOKING_SLOTS.find((s) => s.slotIndex === idx);
}

/** Resolve slot from draft/UI — matches User App slotIndex 1–10. */
export function resolveBookingSlot(
  slotId?: string | null,
  slotIndex?: number | null,
): BookingSlotDef | undefined {
  if (slotIndex != null && Number.isFinite(Number(slotIndex))) {
    const byIndex = getSlotByIndex(Number(slotIndex));
    if (byIndex) return byIndex;
  }
  const id = String(slotId ?? "").trim();
  if (!id) return undefined;
  const byId = getSlotById(id);
  if (byId) return byId;
  const asNum = Number(id);
  if (Number.isFinite(asNum)) return getSlotByIndex(asNum);
  return CUSTOMER_BOOKING_SLOTS.find((s) => s.label === id);
}

export function getSlotLabel(slotId: string, slotIndex?: number | null): string {
  const slot = resolveBookingSlot(slotId, slotIndex);
  return slot?.label ?? slotId;
}
