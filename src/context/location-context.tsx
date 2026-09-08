"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { reverseGeocode } from "@/lib/geocode";
import { dispatchLocationChanged } from "@/lib/location/events";
import {
  loadStoredUserLocation,
  saveStoredUserLocation,
  type StoredUserLocation,
} from "@/lib/location/user-location";

type LocationContextValue = {
  location: StoredUserLocation | null;
  label: string;
  loading: boolean;
  refreshFromGps: () => Promise<void>;
  setManualLocation: (payload: StoredUserLocation) => void;
  applySavedAddress: (address: {
    label: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    pincode?: string;
    street?: string;
    area?: string;
    fullAddress?: string;
  }) => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<StoredUserLocation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocation(loadStoredUserLocation());
  }, []);

  const refreshFromGps = useCallback(async () => {
    if (!navigator.geolocation) throw new Error("Geolocation is not supported.");
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
        });
      });
      const { latitude, longitude } = pos.coords;
      let payload: StoredUserLocation = {
        lat: latitude,
        lng: longitude,
        label: "Current location",
        cachedAt: Date.now(),
      };
      try {
        const parsed = await reverseGeocode(latitude, longitude);
        payload = {
          lat: latitude,
          lng: longitude,
          label: parsed.fullAddress || parsed.city || "Current location",
          address: parsed.fullAddress || "",
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
          street: parsed.street,
          area: parsed.area,
          cachedAt: Date.now(),
        };
      } catch {
        /* keep minimal payload */
      }
      saveStoredUserLocation(payload);
      setLocation(payload);
      dispatchLocationChanged();
    } finally {
      setLoading(false);
    }
  }, []);

  const setManualLocation = useCallback((payload: StoredUserLocation) => {
    const next = { ...payload, cachedAt: Date.now() };
    saveStoredUserLocation(next);
    setLocation(next);
    dispatchLocationChanged();
  }, []);

  const applySavedAddress = useCallback(
    (address: {
      label: string;
      lat?: number;
      lng?: number;
      city?: string;
      state?: string;
      pincode?: string;
      street?: string;
      area?: string;
      fullAddress?: string;
    }) => {
      const lat = Number(address.lat);
      const lng = Number(address.lng);
      const payload: StoredUserLocation = {
        lat: Number.isFinite(lat) ? lat : location?.lat ?? 0,
        lng: Number.isFinite(lng) ? lng : location?.lng ?? 0,
        label: address.label || address.fullAddress || "Saved address",
        address: address.fullAddress || address.label,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        street: address.street,
        area: address.area,
        cachedAt: Date.now(),
      };
      saveStoredUserLocation(payload);
      setLocation(payload);
      dispatchLocationChanged();
    },
    [location],
  );

  const label = useMemo(() => {
    if (!location) return "Select location";
    const city = location.city?.trim();
    const area = location.area?.trim();
    if (city && area) return `${area}, ${city}`;
    if (city) return city;
    return location.label || "Current location";
  }, [location]);

  const value = useMemo(
    () => ({
      location,
      label,
      loading,
      refreshFromGps,
      setManualLocation,
      applySavedAddress,
    }),
    [location, label, loading, refreshFromGps, setManualLocation, applySavedAddress],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
