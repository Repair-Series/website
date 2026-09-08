"use client";

import { RemoteImage as Image } from "@/components/remote-image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Loader2, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  buildFullAddress,
  EMPTY_ADDRESS_FORM,
  validateAddressForm,
  type AddressForm,
} from "@/lib/booking/address";
import { createCustomerBooking } from "@/lib/booking/create-booking";
import {
  clearBookingDraft,
  loadBookingDraft,
  saveBookingDraft,
  setAuthReturnUrl,
} from "@/lib/booking/draft";
import { formatDateKeyLabel, getDateOptions, getSlotLabel, resolveBookingSlot, type BookingSlotDef } from "@/lib/booking/slots";
import { useRealtimeAvailableSlots } from "@/hooks/use-realtime-available-slots";
import type { BookingDraft, ServiceDoc } from "@/lib/booking/types";
import { geocodeAddressString, reverseGeocode } from "@/lib/geocode";
import { getDb } from "@/lib/firebase/firestore";
import {
  getServiceImage,
  getServiceName,
  getVisitingCharge,
  loadService,
} from "@/lib/services/helpers";
import { getSelectedVariationPrice } from "@/lib/services/pricing";
import {
  isStoredLocationFresh,
  loadStoredUserLocation,
  saveStoredUserLocation,
  storedLocationToAddressForm,
} from "@/lib/location/user-location";
import {
  calculateDiscount,
  validateCoupon,
  type CouponResult,
} from "@/lib/coupons/validate";
import { MapPinPicker } from "@/components/map-pin-picker";

const STEPS = ["Address", "Date & Time", "Review", "Confirm"] as const;

type StepIndex = 0 | 1 | 2 | 3;

export function BookingFlow({ serviceIdOrSlug }: { serviceIdOrSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, customer, loading: authLoading, isBlocked } = useAuth();
  const db = useMemo(() => getDb(), []);

  const [step, setStep] = useState<StepIndex>(0);
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<ServiceDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [addressMode, setAddressMode] = useState<"current" | "manual">("manual");

  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS_FORM);
  const [dateKey, setDateKey] = useState("");
  const [slotId, setSlotId] = useState("");
  const [slotIndex, setSlotIndex] = useState<number | undefined>();
  const [scheduledSlotLabel, setScheduledSlotLabel] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotDef | null>(null);
  const [variationId, setVariationId] = useState<string | undefined>();
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const restoreDraft = useCallback(() => {
    const stored = loadBookingDraft();
    if (stored && stored.serviceIdOrSlug === serviceIdOrSlug) {
      setAddress(stored.address);
      setDateKey(stored.dateKey);
      setSlotId(stored.slotId);
      setSlotIndex(stored.slotIndex);
      setScheduledSlotLabel(stored.scheduledSlotLabel ?? "");
      const resolved = resolveBookingSlot(stored.slotId, stored.slotIndex);
      if (resolved) setSelectedSlot(resolved);
      setVariationId(stored.variationId);
      setStep(2);
    }
  }, [serviceIdOrSlug]);

  useEffect(() => {
    const stored = loadStoredUserLocation();
    if (!stored) return;
    setAddress((a) => {
      if (a.lat != null && a.lng != null) return a;
      return { ...a, ...storedLocationToAddressForm(stored) };
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!db) {
        setError("Firebase is not configured.");
        setLoading(false);
        return;
      }
      try {
        const s = await loadService(db, serviceIdOrSlug);
        if (!mounted) return;
        setService(s);
        if (!s) setError("Service not found.");
        else {
          const variationFromUrl = searchParams.get("variation");
          if (variationFromUrl) setVariationId(variationFromUrl);
          restoreDraft();
        }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load service");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db, serviceIdOrSlug, restoreDraft, searchParams]);

  const savedAddressOptions = useMemo(() => {
    const out: { id: string; label: string; lat: number; lng: number }[] = [];
    const push = (raw: unknown, id: string) => {
      if (raw == null) return;
      if (typeof raw === "string") {
        const t = raw.trim();
        if (t) out.push({ id, label: t, lat: NaN, lng: NaN });
        return;
      }
      if (typeof raw === "object" && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>;
        const label =
          String(o.fullAddress ?? o.line1 ?? "").trim() ||
          [o.houseFlat, o.street, o.city].filter(Boolean).join(", ");
        if (!label) return;
        const lat = Number(o.lat);
        const lng = Number(o.lng);
        out.push({
          id,
          label,
          lat: Number.isFinite(lat) ? lat : NaN,
          lng: Number.isFinite(lng) ? lng : NaN,
        });
      }
    };
    push(customer?.lastUsedAddress, "last-used");
    const list = Array.isArray(customer?.addresses) ? customer.addresses : [];
    list.forEach((a, i) => push(a, `saved-${i}`));
    return out;
  }, [customer?.addresses, customer?.lastUsedAddress]);

  const applySavedAddress = (item: { label: string; lat: number; lng: number }) => {
    setAddress((a) => ({
      ...a,
      fullAddress: item.label,
      street: item.label,
      lat: Number.isFinite(item.lat) ? item.lat : a.lat,
      lng: Number.isFinite(item.lng) ? item.lng : a.lng,
    }));
    setAddressMode("manual");
  };

  const persistDraft = useCallback(() => {
    if (!service) return;
    const slot = selectedSlot ?? resolveBookingSlot(slotId, slotIndex);
    saveBookingDraft({
      serviceIdOrSlug,
      serviceId: service.id,
      variationId,
      address,
      dateKey,
      slotId: slot?.id ?? slotId,
      slotIndex: slot?.slotIndex ?? slotIndex,
      scheduledSlotLabel: slot?.label ?? scheduledSlotLabel,
    });
  }, [
    service,
    serviceIdOrSlug,
    variationId,
    address,
    dateKey,
    slotId,
    slotIndex,
    scheduledSlotLabel,
    selectedSlot,
  ]);

  const effectiveDateKey = customDate || dateKey;
  const dateOptions = getDateOptions();

  const { availableSlots, loading: slotLoading, emptyReason } = useRealtimeAvailableSlots({
    service,
    dateKey: effectiveDateKey,
    lat: address.lat,
    lng: address.lng,
    enabled:
      step === 1 &&
      !!effectiveDateKey &&
      address.lat != null &&
      address.lng != null,
  });

  useEffect(() => {
    if (step === 1 && !dateKey && !customDate && dateOptions.length > 0) {
      setDateKey(dateOptions[0].key);
    }
  }, [step, dateKey, customDate, dateOptions]);

  useEffect(() => {
    if (step !== 1 || slotLoading) return;
    if (!slotId && !selectedSlot) return;
    if (availableSlots.length === 0) return;
    const activeId = selectedSlot?.id ?? slotId;
    if (activeId && !availableSlots.some((s) => s.id === activeId)) {
      setSlotId("");
      setSlotIndex(undefined);
      setScheduledSlotLabel("");
      setSelectedSlot(null);
    }
  }, [availableSlots, slotId, selectedSlot, step, slotLoading]);

  const applyStoredLocation = useCallback((stored: NonNullable<ReturnType<typeof loadStoredUserLocation>>) => {
    const partial = storedLocationToAddressForm(stored);
    setAddress((a) => ({
      ...a,
      ...partial,
      lat: stored.lat,
      lng: stored.lng,
    }));
    setAddressMode("current");
  }, []);

  const fetchGpsLocation = useCallback(async (forceRefresh = false) => {
    setLocating(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      const { latitude, longitude } = pos.coords;
      const parsed = await reverseGeocode(latitude, longitude);
      const stored = {
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
      saveStoredUserLocation(stored);
      setAddress((a) => ({
        ...a,
        street: parsed.street || a.street,
        area: parsed.area || a.area,
        city: parsed.city || a.city || "Gurugram",
        state: parsed.state || a.state || "Haryana",
        pincode: parsed.pincode || a.pincode,
        fullAddress: parsed.fullAddress || a.fullAddress,
        lat: latitude,
        lng: longitude,
      }));
      setAddressMode("current");
      return forceRefresh;
    } catch {
      setError("Could not get your location. Please enter address manually.");
      return false;
    } finally {
      setLocating(false);
    }
  }, []);

  const useCurrentLocation = async () => {
    const stored = loadStoredUserLocation();
    if (stored && isStoredLocationFresh(stored)) {
      applyStoredLocation(stored);
      return;
    }
    await fetchGpsLocation(Boolean(stored));
  };

  const refreshCurrentLocation = async () => {
    await fetchGpsLocation(true);
  };

  const confirmManualAddress = async () => {
    const err = validateAddressForm({ ...address, lat: address.lat ?? 0, lng: address.lng ?? 0 });
    if (address.lat == null || address.lng == null) {
      setLocating(true);
      setError(null);
      try {
        const full = buildFullAddress(address);
        const geo = await geocodeAddressString(full);
        setAddress((a) => ({ ...a, lat: geo.lat, lng: geo.lng }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not verify address.");
        setLocating(false);
        return;
      }
      setLocating(false);
    }
    const validation = validateAddressForm({
      ...address,
      lat: address.lat ?? 0,
      lng: address.lng ?? 0,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep(1);
  };

  const goToReview = () => {
    if (!effectiveDateKey || !slotId) {
      setError("Select a date and time slot.");
      return;
    }
    const slot = availableSlots.find((s) => s.id === slotId);
    if (!slot) {
      setError("Please select an available time slot.");
      return;
    }
    setSelectedSlot(slot);
    setSlotIndex(slot.slotIndex);
    setScheduledSlotLabel(slot.label);
    setError(null);
    if (service) {
      saveBookingDraft({
        serviceIdOrSlug,
        serviceId: service.id,
        variationId,
        address,
        dateKey: effectiveDateKey,
        slotId: slot.id,
        slotIndex: slot.slotIndex,
        scheduledSlotLabel: slot.label,
      });
    }
    setStep(2);
  };

  const requireAuthAndConfirm = async () => {
    if (!user) {
      persistDraft();
      const returnUrl = `/book/${serviceIdOrSlug}`;
      setAuthReturnUrl(returnUrl);
      router.push(`/auth?return=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (isBlocked) {
      setError(
        "Your account has been temporarily blocked. Please contact support.",
      );
      return;
    }
    const customerName = String(customer?.name ?? user.displayName ?? "").trim();
    const customerPhone = String(customer?.phone ?? user.phoneNumber ?? "").trim();
    if (!customerName || !customerPhone) {
      setError(
        "Please add your name and phone in your profile before confirming a booking.",
      );
      router.push("/dashboard/profile");
      return;
    }
    setStep(3);
    await onConfirm(customerName, customerPhone);
  };

  const onConfirm = async (customerName: string, customerPhone: string) => {
    if (!db || !service || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const slot = selectedSlot ?? resolveBookingSlot(slotId, slotIndex);
      const draft: BookingDraft = {
        serviceId: service.id,
        variationId,
        address,
        dateKey: effectiveDateKey,
        slotId: slot?.id ?? slotId,
        slotIndex: slot?.slotIndex ?? slotIndex,
        scheduledSlotLabel: slot?.label ?? scheduledSlotLabel,
      };
      const result = await createCustomerBooking(db, {
        customerId: user.uid,
        customerName,
        customerPhone,
        customerEmail: customer?.email ?? user.email ?? undefined,
        service,
        draft,
        revisitFromBookingId: searchParams.get("revisitFrom") || undefined,
        promoCode:
          !searchParams.get("revisitFrom") && appliedCoupon?.valid
            ? appliedCoupon.code
            : undefined,
        discountAmount:
          !searchParams.get("revisitFrom") && appliedCoupon?.valid
            ? calculateDiscount(
                (getSelectedVariationPrice(service, variationId) ?? 0) +
                  getVisitingCharge(service),
                appliedCoupon,
              )
            : undefined,
      });
      clearBookingDraft();
      router.replace(`/dashboard/bookings/${result.bookingId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create booking");
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  };

  const revisitFrom = String(searchParams.get("revisitFrom") || "").trim();
  const isRevisitClaim = Boolean(revisitFrom);

  const displayPrice = useMemo(() => {
    if (!service) return null;
    return getSelectedVariationPrice(service, variationId);
  }, [service, variationId]);

  const serviceCharge = isRevisitClaim ? 0 : displayPrice ?? 0;
  const visitingCharge = isRevisitClaim
    ? 0
    : getVisitingCharge(service ?? ({} as ServiceDoc));
  const orderSubtotal = serviceCharge + visitingCharge;
  const discountAmount = useMemo(
    () => (isRevisitClaim ? 0 : calculateDiscount(orderSubtotal, appliedCoupon)),
    [isRevisitClaim, orderSubtotal, appliedCoupon],
  );
  const estimatedTotal = Math.max(0, orderSubtotal - discountAmount);

  const applyPromo = async () => {
    if (!db || isRevisitClaim) return;
    setPromoError("");
    setPromoLoading(true);
    try {
      const result = await validateCoupon(db, promoCode, orderSubtotal);
      if (!result.valid) {
        setAppliedCoupon(null);
        setPromoError(result.message);
        return;
      }
      setAppliedCoupon(result);
    } catch (e) {
      setAppliedCoupon(null);
      setPromoError(e instanceof Error ? e.message : "Could not apply promo.");
    } finally {
      setPromoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="h-96 animate-pulse rounded-[24px] bg-muted/50" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-lg rounded-[24px] border bg-card p-8 text-center">
        <p className="font-semibold">Service not found</p>
        <Link href="/services" className="mt-4 inline-block text-sm text-[#f96316] underline">
          Browse services
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <Link
        href={`/services/${service.slug ?? service.id}`}
        className="mb-6 inline-flex items-center text-sm font-semibold text-[#64748b] hover:text-[#f96316]"
      >
        <ArrowLeft className="mr-2 size-4" /> Back to service
      </Link>

      <div className="mb-8 flex items-center gap-4 rounded-[20px] border border-black/5 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {getServiceImage(service) ? (
            <Image
              src={getServiceImage(service)!}
              alt={getServiceName(service)}
              fill
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-[#0a0f1c]">{getServiceName(service)}</div>
          <div className="text-sm text-[#64748b]">
            {typeof displayPrice === "number" && displayPrice > 0
              ? `₹${displayPrice}`
              : "Price on request"}
          </div>
        </div>
        <div className="text-xs font-medium text-[#64748b]">
          Step {step + 1}/{STEPS.length}
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={[
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-[#f96316]" : "bg-gray-200",
            ].join(" ")}
          />
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/40 bg-white/95 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.06)] backdrop-blur-[12px] sm:p-8">
        {step === 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#0a0f1c]">Service address</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                Where should our technician visit?
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className={[
                  "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                  addressMode === "current"
                    ? "border-[#f96316] bg-orange-50 ring-1 ring-[#f96316]"
                    : "hover:border-[#f96316]/40",
                ].join(" ")}
              >
                {locating ? (
                  <Loader2 className="size-5 animate-spin text-[#f96316]" />
                ) : (
                  <Navigation className="size-5 text-[#f96316]" />
                )}
                <div>
                  <div className="font-semibold text-[#0a0f1c]">Use current location</div>
                  <div className="text-xs text-[#64748b]">Instant from saved location</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAddressMode("manual")}
                className={[
                  "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                  addressMode === "manual"
                    ? "border-[#f96316] bg-orange-50 ring-1 ring-[#f96316]"
                    : "hover:border-[#f96316]/40",
                ].join(" ")}
              >
                <MapPin className="size-5 text-[#f96316]" />
                <div>
                  <div className="font-semibold text-[#0a0f1c]">Enter manually</div>
                  <div className="text-xs text-[#64748b]">Full address form</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void refreshCurrentLocation()}
                disabled={locating}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#f96316]/40 px-3 py-2 text-xs font-semibold text-[#f96316] transition-colors hover:bg-orange-50 sm:col-span-2"
              >
                {locating ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Refresh location
              </button>
            </div>

            {savedAddressOptions.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[#0a0f1c]">Saved addresses</div>
                <div className="flex flex-wrap gap-2">
                  {savedAddressOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applySavedAddress(item)}
                      className="rounded-full border px-4 py-2 text-left text-xs font-medium transition-all hover:border-[#f96316]/40"
                    >
                      {item.label.length > 48
                        ? `${item.label.slice(0, 48)}…`
                        : item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <MapPinPicker
              lat={address.lat}
              lng={address.lng}
              onChange={(lat, lng) => setAddress((a) => ({ ...a, lat, lng }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["houseNumber", "House / Flat No."],
                  ["floor", "Floor"],
                  ["street", "Street"],
                  ["landmark", "Landmark"],
                  ["area", "Area"],
                  ["city", "City"],
                  ["state", "State"],
                  ["pincode", "Pincode"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className={key === "area" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-medium text-[#64748b]">
                    {label}
                  </label>
                  <input
                    value={address[key]}
                    onChange={(e) =>
                      setAddress((a) => ({ ...a, [key]: e.target.value }))
                    }
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#f96316]"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748b]">
                Full address
              </label>
              <textarea
                value={address.fullAddress || buildFullAddress(address)}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, fullAddress: e.target.value }))
                }
                className="min-h-[80px] w-full rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#f96316]"
              />
            </div>
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={confirmManualAddress}
              disabled={locating}
            >
              {locating ? "Verifying address..." : "Continue"}
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#0a0f1c]">Date & time slot</h2>
              <p className="mt-1 text-sm text-[#64748b]">Pick when you need the service.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {dateOptions.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setDateKey(d.key);
                    setCustomDate("");
                  }}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    effectiveDateKey === d.key && !customDate
                      ? "border-[#f96316] bg-[#f96316] text-white"
                      : "hover:border-[#f96316]/40",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#0a0f1c]">
                <Calendar className="size-4" /> Custom date
              </label>
              <input
                type="date"
                value={customDate}
                min={dateOptions[0]?.key}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateKey(e.target.value);
                }}
                className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#f96316]"
              />
            </div>

            <div>
              <div className="mb-3 text-sm font-medium text-[#0a0f1c]">Available slots</div>
              {!effectiveDateKey ? (
                <p className="text-sm text-[#64748b]">Select a date to see available slots.</p>
              ) : slotLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#64748b]">
                  <Loader2 className="size-4 animate-spin" /> Loading live availability...
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-[#64748b]">
                  {emptyReason ?? "No slots available for this date. Try another day."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setSlotId(slot.id);
                        setSlotIndex(slot.slotIndex);
                        setScheduledSlotLabel(slot.label);
                        setSelectedSlot(slot);
                      }}
                      className={[
                        "h-12 rounded-xl border px-3 text-sm font-medium transition-all",
                        slotId === slot.id
                          ? "border-[#f96316] bg-[#f96316] text-white"
                          : "hover:border-[#f96316]/40",
                      ].join(" ")}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="rounded-full" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button size="lg" className="flex-1 rounded-full" onClick={goToReview}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#0a0f1c]">
                {isRevisitClaim ? "Claim free revisit" : "Review booking"}
              </h2>
              <p className="mt-1 text-sm text-[#64748b]">
                {isRevisitClaim
                  ? "Same technician will visit at no charge."
                  : "Confirm details before booking."}
              </p>
            </div>

            {isRevisitClaim ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                Free revisit — ₹0 payable
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl bg-[#f8fafc] p-5 text-sm">
              <Row label="Service" value={getServiceName(service)} />
              <Row label="Address" value={buildFullAddress(address)} />
              <Row label="Date" value={formatDateKeyLabel(effectiveDateKey)} />
              <Row
                label="Time slot"
                value={
                  selectedSlot?.label ??
                  scheduledSlotLabel ??
                  getSlotLabel(slotId, slotIndex)
                }
              />
              <Row label="Service charge" value={`₹${serviceCharge}`} />
              <Row label="Visiting charge" value={`₹${visitingCharge}`} />
              {discountAmount > 0 ? (
                <Row label="Promo discount" value={`-₹${discountAmount}`} />
              ) : null}
              <div className="flex justify-between border-t border-gray-200 pt-3 font-bold text-[#0a0f1c]">
                <span>Total</span>
                <span>₹{estimatedTotal}</span>
              </div>
            </div>

            {!isRevisitClaim ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0a0f1c]">Promo code</label>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="h-11 flex-1 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#f96316]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={promoLoading || !promoCode.trim()}
                    onClick={() => void applyPromo()}
                  >
                    {promoLoading ? "…" : appliedCoupon?.valid ? "Applied" : "Apply"}
                  </Button>
                </div>
                {promoError ? (
                  <p className="text-xs text-red-600">{promoError}</p>
                ) : null}
                {appliedCoupon?.valid ? (
                  <p className="text-xs font-semibold text-green-700">
                    {appliedCoupon.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!authLoading && !user ? (
              <p className="text-sm text-[#64748b]">
                You&apos;ll be asked to sign in before confirming.
              </p>
            ) : null}

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="rounded-full" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1 rounded-full"
                disabled={submitting || authLoading}
                onClick={requireAuthAndConfirm}
              >
                {submitting
                  ? "Creating booking..."
                  : isRevisitClaim
                    ? "Confirm free revisit"
                    : "Confirm booking"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 && submitting ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Loader2 className="size-10 animate-spin text-[#f96316]" />
            <p className="mt-4 font-medium text-[#0a0f1c]">Creating your booking...</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Assigning a nearby technician.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-right font-medium text-[#0a0f1c]">{value}</span>
    </div>
  );
}
