"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MapPin, Navigation } from "lucide-react";
import { Container } from "@/components/container";
import { MapPinPicker } from "@/components/map-pin-picker";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/context/cart-context";
import {
  EMPTY_ADDRESS_FORM,
  buildFullAddress,
  validateAddressForm,
  type AddressForm,
} from "@/lib/booking/address";
import { createCustomerBooking } from "@/lib/booking/create-booking";
import { groupCartForCheckout } from "@/lib/cart/checkout-groups";
import { cartSubtotal, cartTotal, cartVisitingCharge } from "@/lib/cart/storage";
import {
  formatDateKeyLabel,
  getDateOptions,
  type BookingSlotDef,
} from "@/lib/booking/slots";
import { useRealtimeAvailableSlots } from "@/hooks/use-realtime-available-slots";
import { loadTechnicians } from "@/lib/booking/slot-availability";
import type { ServiceDoc, TechnicianDoc } from "@/lib/booking/types";
import {
  calculateDiscount,
  validateCoupon,
  type CouponResult,
} from "@/lib/coupons/validate";
import { geocodeAddressString, reverseGeocode } from "@/lib/geocode";
import { getDb } from "@/lib/firebase/firestore";
import { loadService } from "@/lib/services/helpers";

export function CartCheckoutClient() {
  const router = useRouter();
  const { user, customer, loading: authLoading } = useAuth();
  const { items, clearCart } = useCart();
  const db = useMemo(() => getDb(), []);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [address, setAddress] = useState<AddressForm>({ ...EMPTY_ADDRESS_FORM });
  const [locating, setLocating] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotDef | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianDoc[]>([]);
  const [servicesById, setServicesById] = useState<Record<string, ServiceDoc>>({});
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const visiting = useMemo(() => cartVisitingCharge(items), [items]);
  const orderSubtotal = subtotal + visiting;
  const discountAmount = useMemo(
    () => calculateDiscount(orderSubtotal, appliedCoupon),
    [orderSubtotal, appliedCoupon],
  );
  const total = Math.max(0, cartTotal(items) - discountAmount);

  const groups = useMemo(
    () => groupCartForCheckout(items, technicians),
    [items, technicians],
  );

  const primaryService = useMemo(() => {
    const first = items[0];
    if (!first) return null;
    return servicesById[first.serviceId] || null;
  }, [items, servicesById]);

  const dateOptions = useMemo(() => getDateOptions(), []);
  const effectiveDate = dateKey || dateOptions[0]?.key || "";

  const { availableSlots, loading: slotsLoading } = useRealtimeAvailableSlots({
    service: primaryService,
    dateKey: effectiveDate,
    lat: address.lat,
    lng: address.lng,
    enabled: step >= 1 && Boolean(primaryService),
  });

  useEffect(() => {
    if (!db || items.length === 0) return;
    let cancelled = false;
    void (async () => {
      const techs = await loadTechnicians(db);
      if (!cancelled) setTechnicians(techs);
      const map: Record<string, ServiceDoc> = {};
      for (const item of items) {
        if (map[item.serviceId]) continue;
        const s = await loadService(db, item.serviceId);
        if (s) map[item.serviceId] = s;
      }
      if (!cancelled) setServicesById(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, items]);

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported.");
      return;
    }
    setLocating(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const rev = await reverseGeocode(lat, lng);
      setAddress((f) => ({
        ...f,
        lat,
        lng,
        city: rev?.city || f.city,
        state: rev?.state || f.state,
        pincode: rev?.pincode || f.pincode,
        area: rev?.area || f.area,
        fullAddress: rev?.fullAddress || f.fullAddress,
      }));
    } catch {
      setError("Could not read location. Allow permission and try again.");
    } finally {
      setLocating(false);
    }
  };

  const applyPromo = async () => {
    if (!db) return;
    setPromoLoading(true);
    setPromoError("");
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

  const goSchedule = async () => {
    setError(null);
    let next = { ...address };
    if (next.lat == null || next.lng == null) {
      const geo = await geocodeAddressString(buildFullAddress(next));
      if (!geo) {
        setError("Set a map pin or use current location.");
        return;
      }
      next = { ...next, lat: geo.lat, lng: geo.lng };
      setAddress(next);
    }
    const validation = validateAddressForm(next);
    if (validation) {
      setError(validation);
      return;
    }
    setDateKey(dateOptions[0]?.key || "");
    setSelectedSlot(null);
    setStep(1);
  };

  const onConfirm = async () => {
    if (!db || !user || !selectedSlot || items.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const customerName =
        String(customer?.name || user.displayName || "").trim() || "Customer";
      const customerPhone = String(customer?.phone || "").trim();
      if (!customerPhone) {
        throw new Error("Add a phone number in your profile before booking.");
      }

      const slot = selectedSlot;
      if (!slot) throw new Error("Select a time slot.");

      const createdIds: string[] = [];
      let discountLeft = discountAmount;
      let sharedTechId = "";

      for (const group of groups) {
        let groupTech = group.sharedTechnicianPossible ? sharedTechId : "";
        for (let i = 0; i < group.items.length; i++) {
          const line = group.items[i];
          const service = servicesById[line.serviceId];
          if (!service) throw new Error(`Service unavailable: ${line.name}`);

          const lineSub =
            line.price * line.quantity +
            (i === 0 ? line.visitingCharge : 0);
          const lineDiscount =
            discountLeft > 0 ? Math.min(discountLeft, Math.round(lineSub)) : 0;
          discountLeft -= lineDiscount;

          const result = await createCustomerBooking(db, {
            customerId: user.uid,
            customerName,
            customerPhone,
            customerEmail: customer?.email ?? user.email ?? undefined,
            service,
            draft: {
              serviceId: service.id,
              variationId: line.variationId,
              address,
              dateKey: effectiveDate,
              slotId: slot.id,
              slotIndex: slot.slotIndex,
              scheduledSlotLabel: slot.label,
            },
            promoCode:
              createdIds.length === 0 && appliedCoupon?.valid
                ? appliedCoupon.code
                : undefined,
            discountAmount: lineDiscount > 0 ? lineDiscount : undefined,
            preferredTechnicianId: groupTech || undefined,
          });

          createdIds.push(result.bookingId);
          if (result.technicianId) {
            groupTech = result.technicianId;
            if (group.sharedTechnicianPossible) {
              sharedTechId = result.technicianId;
            }
          }
        }
      }

      clearCart();
      if (createdIds.length === 1) {
        router.replace(`/dashboard/bookings/${createdIds[0]}`);
      } else {
        router.replace("/dashboard/bookings");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Container className="py-16">
        <div className="h-64 animate-pulse rounded-[24px] bg-muted/50" />
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="py-16 text-center">
        <p className="font-medium">Sign in to checkout.</p>
        <Link href="/auth" className="mt-4 inline-block text-[#C45508] underline">
          Login
        </Link>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <p className="font-medium">Your cart is empty.</p>
        <Link href="/services" className="mt-4 inline-block text-[#C45508] underline">
          Browse services
        </Link>
      </Container>
    );
  }

  return (
    <div className="bg-[#F8F6F4] py-6 md:py-10">
      <Container className="max-w-3xl">
        <Link
          href="/cart"
          className="mb-4 inline-flex items-center text-sm font-semibold text-[#64748b]"
        >
          <ArrowLeft className="mr-2 size-4" /> Back to cart
        </Link>
        <h1 className="text-2xl font-extrabold text-[#0a0f1c]">Checkout</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          {groups.length > 1
            ? `${groups.length} separate bookings (different service categories).`
            : "All cart items will be booked together when possible."}
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-[24px] border bg-white p-6 shadow-sm">
          {step === 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Service address</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void useCurrentLocation()}
                  disabled={locating}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#C45508]/40 px-4 text-sm font-bold text-[#C45508]"
                >
                  {locating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Navigation className="size-4" />
                  )}
                  Use current location
                </button>
              </div>
              <MapPinPicker
                lat={address.lat}
                lng={address.lng}
                onChange={(lat, lng) => setAddress((a) => ({ ...a, lat, lng }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["houseNumber", "House / Flat"],
                    ["floor", "Floor"],
                    ["street", "Street"],
                    ["landmark", "Landmark"],
                    ["area", "Area"],
                    ["city", "City"],
                    ["state", "State"],
                    ["pincode", "Pincode"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs font-medium text-[#64748b]">
                    {label}
                    <input
                      value={address[key]}
                      onChange={(e) =>
                        setAddress((a) => ({ ...a, [key]: e.target.value }))
                      }
                      className="mt-1 h-11 w-full rounded-xl border px-3 text-sm"
                    />
                  </label>
                ))}
              </div>
              <Button
                className="rounded-full bg-[#C45508] text-white"
                onClick={() => void goSchedule()}
              >
                <MapPin className="mr-2 size-4" /> Continue to schedule
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Date & time</h2>
              <div className="flex flex-wrap gap-2">
                {dateOptions.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      setDateKey(d.key);
                      setSelectedSlot(null);
                    }}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-bold",
                      effectiveDate === d.key
                        ? "border-[#C45508] bg-orange-50 text-[#C45508]"
                        : "",
                    ].join(" ")}
                  >
                    {formatDateKeyLabel(d.key)}
                  </button>
                ))}
              </div>
              {slotsLoading ? (
                <p className="flex items-center gap-2 text-sm text-[#64748b]">
                  <Loader2 className="size-4 animate-spin" /> Loading slots…
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((s) => (
                    <button
                      key={s.id || String(s.slotIndex)}
                      type="button"
                      onClick={() => setSelectedSlot(s)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-bold",
                        selectedSlot?.slotIndex === s.slotIndex
                          ? "border-[#C45508] bg-orange-50 text-[#C45508]"
                          : "",
                      ].join(" ")}
                    >
                      {s.label}
                    </button>
                  ))}
                  {!availableSlots.length ? (
                    <p className="text-sm text-[#64748b]">No slots for this day.</p>
                  ) : null}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  className="rounded-full bg-[#C45508] text-white"
                  disabled={!selectedSlot}
                  onClick={() => setStep(2)}
                >
                  Review order
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Review & promo</h2>
              <ul className="space-y-2 text-sm">
                {items.map((item) => (
                  <li key={item.lineId} className="flex justify-between gap-3">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold">
                      ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
              {groups.length > 1 ? (
                <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-[#9a3412]">
                  Categories need different partners — we will create {groups.length} bookings.
                </p>
              ) : null}
              <div className="flex gap-2">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo code"
                  className="h-11 flex-1 rounded-xl border px-3 text-sm"
                />
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={promoLoading}
                  onClick={() => void applyPromo()}
                >
                  {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
              {promoError ? <p className="text-xs text-red-600">{promoError}</p> : null}
              {appliedCoupon?.valid ? (
                <p className="text-xs text-green-700">{appliedCoupon.message}</p>
              ) : null}
              <dl className="space-y-2 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#64748b]">Subtotal</dt>
                  <dd>₹{subtotal.toLocaleString("en-IN")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#64748b]">Visiting</dt>
                  <dd>₹{visiting.toLocaleString("en-IN")}</dd>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-green-700">
                    <dt>Discount</dt>
                    <dd>-₹{discountAmount.toLocaleString("en-IN")}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between text-base font-bold">
                  <dt>Total</dt>
                  <dd className="text-[#C45508]">₹{total.toLocaleString("en-IN")}</dd>
                </div>
              </dl>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="rounded-full bg-[#C45508] text-white"
                  disabled={submitting}
                  onClick={() => void onConfirm()}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Confirm {groups.length > 1 ? `${groups.length} bookings` : "booking"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
