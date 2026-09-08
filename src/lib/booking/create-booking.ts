import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  assignExistingTechnicianAndLockBusySlot,
  assignNearestTechnicianAndLockBusySlot,
  isSlotStillAvailable,
} from "@/lib/booking/allocation";
import { buildFullAddress, addressFormToBookingAddress } from "@/lib/booking/address";
import { generateBookingCode } from "@/lib/booking/booking-code";
import { resolveBookingSlot, isSlotPast, isPastDateKey } from "@/lib/booking/slots";
import { slotLabelFromIndex } from "@/lib/booking/technician-slots";
import { getServiceCategoryId } from "@/lib/booking/slot-availability";
import type { BookingDraft, ServiceDoc } from "@/lib/booking/types";
import {
  getCustomerProfile,
  incrementCustomerBookings,
  saveCustomerAddresses,
  saveLastUsedAddress,
} from "@/lib/firebase/customer";
import {
  bookingAddressFromForm,
  upsertSavedAddress,
} from "@/lib/booking/saved-addresses";
import { getAuthClient } from "@/lib/firebase/auth";
import { fetchCheckoutQuote } from "@/lib/checkout/quote";
import {
  getServiceName,
  getActiveVariations,
  getServicePrice,
} from "@/lib/services/helpers";
import {
  canClaimRevisit,
  normalizeRevisitPolicy,
} from "@/lib/booking/revisit";

function scheduledAtFromLocalSlot(dateKey: string, startHour: number): Date {
  const parts = String(dateKey).trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return new Date(NaN);
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, startHour, 0, 0, 0);
}

const BOOKING_STATUS = { NEW: "New", ASSIGNED: "Assigned" } as const;

async function resolveCategoryName(
  db: Firestore,
  categoryId: string,
  fallback?: string,
): Promise<string> {
  const trimmed = String(fallback ?? "").trim();
  if (trimmed) return trimmed;
  const cid = String(categoryId ?? "").trim();
  if (!cid) return "Category";
  try {
    const snap = await getDoc(doc(db, "categories", cid));
    if (snap.exists()) {
      const name = String((snap.data() as { name?: string }).name ?? "").trim();
      if (name) return name;
    }
  } catch {
    /* optional */
  }
  return "Category";
}

export async function createCustomerBooking(
  db: Firestore,
  params: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    service: ServiceDoc;
    draft: BookingDraft;
    notes?: string;
    revisitFromBookingId?: string;
    promoCode?: string;
    discountAmount?: number;
    /** When set, assign this technician (cart follow-up / shared tech). */
    preferredTechnicianId?: string;
  },
): Promise<{ bookingId: string; status: string; technicianId: string | null }> {
  const { customerId, customerName, customerPhone, customerEmail, service, draft } =
    params;
  const revisitFrom = String(params.revisitFromBookingId || "").trim();
  let revisitTechnicianId = String(params.preferredTechnicianId || "").trim();
  let parentServicePolicy: Record<string, unknown> | undefined;
  if (revisitFrom) {
    const parentSnap = await getDoc(doc(db, "bookings", revisitFrom));
    if (!parentSnap.exists()) {
      throw new Error("Original booking not found for revisit.");
    }
    const parent = {
      id: parentSnap.id,
      ...(parentSnap.data() as Record<string, unknown>),
    } as Record<string, unknown> & { id: string };
    if (String(parent.customerId || "") !== customerId) {
      throw new Error("You can only claim revisits on your own bookings.");
    }
    const svcPolicy = (service as { revisitPolicy?: Record<string, unknown> })
      .revisitPolicy;
    parentServicePolicy = svcPolicy;
    if (!canClaimRevisit(parent as Record<string, unknown>, svcPolicy)) {
      throw new Error("No free revisits remaining on this booking.");
    }
    revisitTechnicianId = String(
      parent.technicianId ||
        parent.assignedTechnicianId ||
        parent.techId ||
        "",
    ).trim();
    if (!revisitTechnicianId) {
      throw new Error("Previous technician not found for this booking.");
    }
  }
  const slot = resolveBookingSlot(draft.slotId, draft.slotIndex);
  if (!slot) throw new Error("Invalid time slot selected.");

  if (isPastDateKey(draft.dateKey)) {
    throw new Error("Cannot book a past date.");
  }
  if (isSlotPast(draft.dateKey, slot)) {
    throw new Error("This time slot has already passed. Please choose a future slot.");
  }

  const bookingAddress = addressFormToBookingAddress(draft.address);
  const userLat = Number(bookingAddress.lat);
  const userLng = Number(bookingAddress.lng);
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    throw new Error(
      "Location coordinates are required. Use current location or confirm your address.",
    );
  }

  const stillFree = await isSlotStillAvailable(db, {
    service,
    userLat,
    userLng,
    dateStr: draft.dateKey,
    slotIndex: slot.slotIndex,
  });
  if (!stillFree) {
    throw new Error(
      "This slot is no longer available. Please select another slot.",
    );
  }

  const scheduledAtDate = scheduledAtFromLocalSlot(draft.dateKey, slot.startHour);
  if (Number.isNaN(scheduledAtDate.getTime())) {
    throw new Error("Invalid booking date.");
  }

  const variationId = draft.variationId?.trim() ?? "";
  let selectedVariations: Array<{
    variationId: string;
    title: string;
    price: number;
    quantity: number;
  }> = [];
  let servicePrice = 0;

  const activeVariations = getActiveVariations(service);
  if (service.hasVariations || activeVariations.length > 0) {
    if (!variationId) throw new Error("Select a service option.");
    const match = activeVariations.find((v) => String(v.id) === variationId);
    if (!match) throw new Error("Invalid service option.");
    servicePrice = match.price;
    selectedVariations = [
      {
        variationId: match.id,
        title: match.title,
        price: match.price,
        quantity: 1,
      },
    ];
  } else {
    servicePrice = getServicePrice(service) ?? 0;
  }

  if (!Number.isFinite(servicePrice) || servicePrice < 0) {
    throw new Error("Invalid service price.");
  }

  let quote: Awaited<ReturnType<typeof fetchCheckoutQuote>> | null = null;
  if (!revisitFrom) {
    const auth = getAuthClient();
    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error("Sign in required to confirm pricing.");
    quote = await fetchCheckoutQuote({
      token,
      serviceId: service.id,
      variationId,
      couponCode: params.promoCode,
    });
    servicePrice = quote.catalog?.amount ?? quote.customer.serviceSubtotal;
  }

  const discountAmount = revisitFrom
    ? 0
    : Math.max(0, Math.round(Number(quote?.customer.discount ?? params.discountAmount) || 0));
  const promoCode = revisitFrom
    ? ""
    : String(params.promoCode || "").trim().toUpperCase();
  const customerTotal = revisitFrom
    ? 0
    : Math.max(0, Number(quote?.customer.finalPayable ?? servicePrice - discountAmount));

  const fullAddress = buildFullAddress(draft.address);
  const durationMinutes = 60;
  const categoryId = getServiceCategoryId(service);
  const categoryName = await resolveCategoryName(
    db,
    categoryId,
    (service as { categoryName?: string }).categoryName,
  );
  const slotLabel =
    String(draft.scheduledSlotLabel ?? "").trim() || slotLabelFromIndex(slot.slotIndex);
  const bookingCode = generateBookingCode(8);

  let platformFeePercent: number | undefined;
  let addonFeePercent: number | undefined;
  try {
    const generalSnap = await getDoc(doc(db, "settings", "general"));
    if (generalSnap.exists()) {
      const g = generalSnap.data() as Record<string, unknown>;
      const p = Number(g.platformCommissionPercent);
      const a = Number(g.addonFeePercent);
      if (Number.isFinite(p) && p >= 0) platformFeePercent = p;
      if (Number.isFinite(a) && a >= 0) addonFeePercent = a;
    }
  } catch {
    /* freeze will read live settings if percents are absent */
  }

  const payload: Record<string, unknown> = {
    customerId,
    customerName: String(customerName).trim(),
    customerPhone: String(customerPhone).trim(),
    phone: String(customerPhone).trim(),
    ...(customerEmail?.trim() ? { customerEmail: customerEmail.trim() } : {}),
    serviceId: service.id,
    serviceName: getServiceName(service),
    categoryId,
    categoryName,
    serviceCategoryId: categoryId,
    serviceVariationId: variationId || "",
    serviceVariationTitle: selectedVariations[0]?.title ?? "",
    address: {
      ...bookingAddress,
      fullAddress,
    },
    scheduledAt: Timestamp.fromDate(scheduledAtDate),
    scheduledSlotDate: draft.dateKey,
    scheduledSlotLabel: slotLabel,
    scheduledSlotIndex: slot.slotIndex,
    scheduleDateKey: draft.dateKey,
    scheduleSlotIndex: slot.slotIndex,
    date: draft.dateKey,
    time: slotLabel,
    slot: slotLabel,
    bookingDate: draft.dateKey,
    durationMinutes,
    amount: revisitFrom ? 0 : servicePrice,
    visitingCharge: 0,
    totalAmount: revisitFrom ? 0 : customerTotal,
    finalBookingAmount: revisitFrom ? 0 : customerTotal,
    servicePrice: revisitFrom ? 0 : servicePrice,
    financeFormulaVersion: "v2",
    ...(quote
      ? {
          customerPlatformFeeType: quote.settings.customerPlatformFeeType,
          customerPlatformFeeValue: quote.settings.customerPlatformFeeValue,
          customerPlatformFee: quote.customer.platformFee,
          gstEnabled: quote.settings.gstEnabled,
          gstPercent: quote.settings.gstPercent,
          platformFeePercent: quote.settings.serviceCommissionPercent,
          addonFeePercent: quote.settings.additionalServiceCommissionPercent,
          sparePartCommissionPercent: quote.settings.sparePartCommissionPercent,
        }
      : {}),
    ...(promoCode ? { promoCode } : {}),
    ...(discountAmount > 0 ? { discountAmount } : {}),
    ...(!quote && platformFeePercent != null ? { platformFeePercent } : {}),
    ...(!quote && addonFeePercent != null ? { addonFeePercent } : {}),
    notes: params.notes?.trim() ?? (revisitFrom ? "Free revisit claim" : ""),
    addOnServices: [],
    status: BOOKING_STATUS.NEW,
    bookingCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(selectedVariations.length ? { selectedVariations } : {}),
    ...(revisitFrom
      ? {
          isRevisit: true,
          parentBookingId: revisitFrom,
          originalBookingId: revisitFrom,
          revisitReason: "Customer claimed free revisit",
        }
      : (() => {
          const rawPolicy =
            (service as { revisitPolicy?: Record<string, unknown> }).revisitPolicy ||
            null;
          if (!rawPolicy) return {};
          const p = normalizeRevisitPolicy(rawPolicy);
          if (!p.enabled) return {};
          const remaining =
            p.type === "fixed_count"
              ? p.freeRevisitCount
              : p.maxRevisitsInPeriod > 0
                ? p.maxRevisitsInPeriod
                : p.freeRevisitCount || 1;
          return {
            revisitPolicy: p,
            revisitRemaining: remaining,
            remainingRevisits: remaining,
            freeRevisitsRemaining: remaining,
            revisitHistory: [],
          };
        })()),
  };

  const ref = await addDoc(collection(db, "bookings"), payload);
  const bookingId = ref.id;

  try {
    if (revisitTechnicianId) {
      await assignExistingTechnicianAndLockBusySlot(db, {
        bookingId,
        technicianId: revisitTechnicianId,
        dateStr: draft.dateKey,
        slotLabel,
        slotIndex: slot.slotIndex,
      });
      // Update parent revisit counters
      try {
        const parentRef = doc(db, "bookings", revisitFrom);
        const parentSnap = await getDoc(parentRef);
        if (parentSnap.exists()) {
          const p = parentSnap.data() || {};
          const history = Array.isArray(p.revisitHistory) ? [...p.revisitHistory] : [];
          history.push({
            bookingId,
            bookingCode,
            claimedAt: new Date().toISOString(),
            technicianId: revisitTechnicianId,
          });
          const remainingRaw =
            p.revisitRemaining ?? p.remainingRevisits ?? p.freeRevisitsRemaining;
          const patch: Record<string, unknown> = {
            revisitHistory: history,
            updatedAt: serverTimestamp(),
          };
          if (remainingRaw != null && Number.isFinite(Number(remainingRaw))) {
            const next = Math.max(0, Math.round(Number(remainingRaw)) - 1);
            patch.revisitRemaining = next;
            patch.remainingRevisits = next;
            patch.freeRevisitsRemaining = next;
          } else if (parentServicePolicy || p.revisitPolicy) {
            const pol = normalizeRevisitPolicy(
              (p.revisitPolicy as Record<string, unknown>) ||
                parentServicePolicy ||
                {},
            );
            const used = history.length;
            const next =
              pol.type === "fixed_count"
                ? Math.max(0, pol.freeRevisitCount - used)
                : pol.maxRevisitsInPeriod > 0
                  ? Math.max(0, pol.maxRevisitsInPeriod - used)
                  : Math.max(0, (pol.freeRevisitCount || 1) - used);
            patch.revisitRemaining = next;
            patch.remainingRevisits = next;
            patch.freeRevisitsRemaining = next;
            if (!p.revisitPolicy && parentServicePolicy) {
              patch.revisitPolicy = normalizeRevisitPolicy(parentServicePolicy);
            }
          }
          await updateDoc(parentRef, patch);
        }
      } catch {
        /* best effort */
      }
    } else {
      await assignNearestTechnicianAndLockBusySlot(db, {
        bookingId,
        categoryId,
        service,
        userLat,
        userLng,
        dateStr: draft.dateKey,
        slotLabel,
        slotIndex: slot.slotIndex,
      });
    }
  } catch (e) {
    try {
      await deleteDoc(doc(db, "bookings", bookingId));
    } catch {
      /* best effort */
    }
    const err = e as Error & { code?: string };
    if (err.code === "NO_TECH_IN_RADIUS") {
      throw new Error(
        "No service partner is available within range for this address. Try another location or contact support.",
      );
    }
    if (err.code === "ALL_TECHS_BUSY" || err.code === "PAST_SLOT") {
      throw new Error(
        "This slot is no longer available. Please select another slot.",
      );
    }
    throw new Error(
      err.message ||
        "Could not assign a technician for this slot. Please try another time.",
    );
  }

  await incrementCustomerBookings(db, customerId);
  const savedAddress = {
    ...bookingAddressFromForm(draft.address),
    ...bookingAddress,
    fullAddress,
  };
  await saveLastUsedAddress(db, customerId, savedAddress);
  try {
    const profile = await getCustomerProfile(db, customerId);
    const nextAddresses = upsertSavedAddress(profile?.addresses, savedAddress);
    await saveCustomerAddresses(db, customerId, nextAddresses);
  } catch {
    /* best effort — lastUsedAddress already saved */
  }

  const assignedSnap = await getDoc(doc(db, "bookings", bookingId));
  const assigned = assignedSnap.data() as Record<string, unknown> | undefined;
  const technicianId = assigned?.technicianId
    ? String(assigned.technicianId)
    : null;
  const status = String(assigned?.status ?? BOOKING_STATUS.ASSIGNED);

  try {
    const { requestRemotePush } = await import("@/lib/notify/remote-notify");
    await requestRemotePush({
      eventType: technicianId ? "assigned" : "created",
      bookingId,
      customerId,
      technicianId: technicianId || "",
      serviceName: getServiceName(service),
      bookingCode,
      audience: "both",
    });
  } catch {
    /* optional until notify server configured */
  }

  return { bookingId, status, technicianId };
}
