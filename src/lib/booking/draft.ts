import { EMPTY_ADDRESS_FORM, type AddressForm } from "@/lib/booking/address";
import type { BookingDraft } from "@/lib/booking/types";

const DRAFT_KEY = "rs_booking_draft";
const RETURN_KEY = "rs_auth_return";

export type StoredBookingDraft = BookingDraft & {
  serviceIdOrSlug: string;
};

export function saveBookingDraft(draft: StoredBookingDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadBookingDraft(): StoredBookingDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredBookingDraft;
  } catch {
    return null;
  }
}

export function clearBookingDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}

export function setAuthReturnUrl(url: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RETURN_KEY, url);
}

export function getAuthReturnUrl(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RETURN_KEY);
}

export function clearAuthReturnUrl(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_KEY);
}

export function mergeAddressForm(
  base: typeof EMPTY_ADDRESS_FORM,
  partial?: Partial<AddressForm>,
): AddressForm {
  return { ...base, ...partial };
}
