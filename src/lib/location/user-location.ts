import type { AddressForm } from "@/lib/booking/address";

export const USER_LOCATION_KEY = "rs_user_location_v1";
export const LOCATION_ONBOARDING_KEY = "rs_location_onboarding_v1";
export const LOCATION_CACHE_TTL_MS = 30 * 60 * 1000;

export type StoredUserLocation = {
  lat: number;
  lng: number;
  label: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  street?: string;
  area?: string;
  cachedAt: number;
};

export function loadStoredUserLocation(): StoredUserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserLocation;
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredUserLocation(payload: StoredUserLocation): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_LOCATION_KEY, JSON.stringify({ ...payload, cachedAt: payload.cachedAt || Date.now() }));
}

export function isStoredLocationFresh(
  stored: StoredUserLocation | null,
  ttlMs: number = LOCATION_CACHE_TTL_MS,
): boolean {
  if (!stored?.cachedAt) return false;
  return Date.now() - stored.cachedAt < ttlMs;
}

export function isLocationOnboardingDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LOCATION_ONBOARDING_KEY) === "1";
}

export function markLocationOnboardingDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCATION_ONBOARDING_KEY, "1");
}

export function storedLocationToAddressForm(stored: StoredUserLocation): Partial<AddressForm> {
  return {
    street: stored.street || "",
    area: stored.area || "",
    city: stored.city || "",
    state: stored.state || "",
    pincode: stored.pincode || "",
    fullAddress: stored.address || stored.label || "",
    lat: stored.lat,
    lng: stored.lng,
  };
}
