/**
 * Hourly schedule grid — aligned with User App (`bookingSlots.js`).
 * Slot indices are **1-based** (1–10) matching `technicians/{id}/busySlots/{YYYY-MM-DD}_{slotIndex}`.
 * Slot 1 = 8:00–9:00 IST … slot 10 = 5:00–6:00 IST.
 */

export const TIMEZONE = "Asia/Kolkata";
export const SCHEDULE_SLOT_START_HOUR = 8;
/** User-app slot count (indices 1–10). */
export const BOOKING_SLOT_COUNT = 10;

/** 1-based index → local start hour (matches mobile `BOOKING_SLOT_START_HOUR_LOCAL`). */
export const BOOKING_SLOT_START_HOUR_BY_INDEX: Record<number, number> = {
  1: 8,
  2: 9,
  3: 10,
  4: 11,
  5: 12,
  6: 13,
  7: 14,
  8: 15,
  9: 16,
  10: 17,
};

/** Canonical labels written to Firestore (`scheduledSlotLabel`) — same as User App. */
export const BOOKING_SLOT_LABELS: readonly string[] = [
  "8:00 - 9:00",
  "9:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "12:00 - 1:00",
  "1:00 - 2:00",
  "2:00 - 3:00",
  "3:00 - 4:00",
  "4:00 - 5:00",
  "5:00 - 6:00",
];

export type SlotDescriptor = {
  dateKey: string;
  slotIndex: number;
  slotDocId: string;
  slotLabel: string;
};

function partsFromDateInTz(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour),
    min: Number(parts.minute),
    sec: Number(parts.second),
  };
}

export function dateKeyFromIndiaParts(p: {
  y: number;
  m: number;
  d: number;
}): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function getIndiaDateKeyForDate(date: Date): string {
  const p = partsFromDateInTz(date, TIMEZONE);
  return dateKeyFromIndiaParts(p);
}

/** Start hour for 1-based slot index (User App). */
export function slotStartHourFromIndex(slotIndex: number): number {
  const idx = Number(slotIndex);
  const mapped = BOOKING_SLOT_START_HOUR_BY_INDEX[idx];
  if (mapped != null) return mapped;
  return SCHEDULE_SLOT_START_HOUR;
}

export function slotLabelFromIndex(slotIndex: number): string {
  const idx = Number(slotIndex);
  if (idx >= 1 && idx <= BOOKING_SLOT_COUNT) {
    return BOOKING_SLOT_LABELS[idx - 1] ?? `slot-${idx}`;
  }
  return `slot-${slotIndex}`;
}

export function buildSlotDocId(dateKey: string, slotIndex: number): string {
  return `${dateKey}_${Number(slotIndex)}`;
}

export function scheduledAtFromSlot(dateKey: string, startHour: number): Date {
  return new Date(
    `${dateKey}T${String(startHour).padStart(2, "0")}:00:00+05:30`,
  );
}

export function descriptorForSlot(
  dateKey: string,
  slotIndex: number,
): SlotDescriptor {
  return {
    dateKey,
    slotIndex: Number(slotIndex),
    slotDocId: buildSlotDocId(dateKey, slotIndex),
    slotLabel: slotLabelFromIndex(slotIndex),
  };
}

export function getSlotDescriptorsForBookingWindow(
  startDate: Date,
  durationMinutes: number,
): SlotDescriptor[] {
  const duration = Number(durationMinutes) > 0 ? Number(durationMinutes) : 60;
  const startMs = startDate.getTime();
  const endMs = startMs + duration * 60_000;
  const seen = new Set<string>();
  const out: SlotDescriptor[] = [];
  let curMs = startMs;
  while (curMs < endMs) {
    const p = partsFromDateInTz(new Date(curMs), TIMEZONE);
    const hour = p.h;
    const slotIndex = Object.entries(BOOKING_SLOT_START_HOUR_BY_INDEX).find(
      ([, h]) => h === hour,
    )?.[0];
    if (slotIndex != null) {
      const dateKey = dateKeyFromIndiaParts(p);
      const idx = Number(slotIndex);
      const slotDocId = buildSlotDocId(dateKey, idx);
      if (!seen.has(slotDocId)) {
        seen.add(slotDocId);
        out.push(descriptorForSlot(dateKey, idx));
      }
    }
    const offsetInHour = p.min * 60_000 + p.sec * 1000;
    curMs = curMs - offsetInHour + 3_600_000;
  }
  return out;
}
