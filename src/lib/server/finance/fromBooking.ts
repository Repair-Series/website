import {
  calculateTransactionFinance,
  type FinanceSnapshot,
  type SparePartLine,
} from "./calculateTransaction";
import { sanitizePercent } from "./money";
import { formulaVersionFromBooking, resolveFinancialSettings } from "./settings";

function money(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function cleanText(value: unknown, fallback = ""): string {
  const text = value != null ? String(value).trim() : "";
  return text || fallback;
}

function mapLines(items: unknown, fallbackTitle: string): SparePartLine[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const rate = money(item.price ?? item.rate ?? item.amount);
    return {
      title: cleanText(item.title ?? item.serviceName ?? item.name, fallbackTitle),
      quantity,
      rate,
      amount: money(quantity * rate),
    };
  });
}

export function deriveServicePrice(booking: Record<string, unknown>): number {
  for (const k of [
    "servicePrice",
    "originalBookingAmount",
    "amount",
    "baseAmount",
    "serviceAmount",
  ]) {
    const n = money(booking[k]);
    if (n > 0) return n;
  }
  return 0;
}

export function deriveAddedServicesAmount(booking: Record<string, unknown>): {
  amount: number;
  lines: SparePartLine[];
} {
  const addOns = mapLines(booking.addOnServices ?? booking.add_on_services, "Add-on");
  const additional = mapLines(booking.additionalServices, "Additional service");
  const lines = [...addOns, ...additional].filter((l) => l.amount > 0 || l.title);
  const fromRows = lines.reduce((sum, line) => sum + Math.round(money(line.amount) * 100), 0);
  const direct = money(booking.addedServicesAmount);
  const amount = direct > 0 ? direct : fromRows / 100;
  return { amount: money(amount), lines };
}

export function deriveSpareParts(booking: Record<string, unknown>): {
  amount: number;
  lines: SparePartLine[];
} {
  const lines = mapLines(booking.spareParts, "Spare part").filter(
    (l) => l.amount > 0 || l.title,
  );
  const fromRows = lines.reduce((sum, line) => sum + Math.round(money(line.amount) * 100), 0);
  const direct = money(booking.sparePartValue ?? booking.sparePartsAmount);
  const amount = direct > 0 ? direct : fromRows / 100;
  return { amount: money(amount), lines };
}

function isCompleteSnapshot(value: unknown): value is FinanceSnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as FinanceSnapshot;
  return (
    (snap.formulaVersion === "v1" || snap.formulaVersion === "v2") &&
    typeof snap.finalAmount === "number" &&
    typeof snap.technicianFinalEarning === "number" &&
    Array.isArray(snap.spareParts)
  );
}

export function resolveFeePercents(
  booking: Record<string, unknown>,
  settingsGeneral: Record<string, unknown>,
): { platformFeePercent: number; addonFeePercent: number } {
  const bookingPlat = Number(booking.platformFeePercent ?? booking.platformCommissionPercent);
  const bookingAddon = Number(booking.addonFeePercent);
  const hasBookingPlat = Number.isFinite(bookingPlat) && bookingPlat >= 0;
  const hasBookingAddon = Number.isFinite(bookingAddon) && bookingAddon >= 0;
  return {
    platformFeePercent: hasBookingPlat
      ? sanitizePercent(bookingPlat, 0)
      : sanitizePercent(settingsGeneral.platformCommissionPercent, 0),
    addonFeePercent: hasBookingAddon
      ? sanitizePercent(bookingAddon, 0)
      : sanitizePercent(settingsGeneral.addonFeePercent, 0),
  };
}

export function resolveGstPercent(
  booking: Record<string, unknown>,
  settingsInvoice: Record<string, unknown>,
): number {
  const frozen = Number(booking.gstPercent);
  if (Number.isFinite(frozen) && frozen >= 0) return sanitizePercent(frozen, 0);
  return sanitizePercent(settingsInvoice.gstPercent, 18);
}

export function financeFromBooking(opts: {
  booking: Record<string, unknown>;
  settingsGeneral?: Record<string, unknown>;
  settingsInvoice?: Record<string, unknown>;
}): FinanceSnapshot {
  const booking = opts.booking || {};

  if (booking.economicsSnapshotAt != null && isCompleteSnapshot(booking.financeSnapshot)) {
    return booking.financeSnapshot;
  }

  const version = formulaVersionFromBooking(booking);
  const { amount: added } = deriveAddedServicesAmount(booking);
  const spare = deriveSpareParts(booking);
  const rates = resolveFeePercents(booking, opts.settingsGeneral || {});
  const settings = resolveFinancialSettings(
    opts.settingsGeneral || {},
    opts.settingsInvoice || {},
    booking,
  );

  if (version === "v2") {
    return calculateTransactionFinance({
      formulaVersion: "v2",
      serviceAmount: deriveServicePrice(booking),
      visitingCharge: 0,
      addedServicesAmount: added,
      sparePartsAmount: spare.amount,
      discountAmount: booking.discountAmount ?? booking.couponDiscount ?? booking.discount,
      platformFeePercent: settings.serviceCommissionPercent,
      addonFeePercent: settings.additionalServiceCommissionPercent,
      sparePartCommissionPercent: settings.sparePartCommissionPercent,
      customerPlatformFeeType: settings.customerPlatformFeeType,
      customerPlatformFeeValue: settings.customerPlatformFeeValue,
      gstEnabled: settings.gstEnabled,
      gstPercent: settings.gstPercent,
      spareParts: spare.lines,
    });
  }

  return calculateTransactionFinance({
    formulaVersion: "v1",
    serviceAmount: deriveServicePrice(booking),
    visitingCharge: money(booking.visitingCharge),
    addedServicesAmount: added,
    discountAmount: booking.discountAmount ?? booking.couponDiscount ?? booking.discount,
    platformFeePercent: rates.platformFeePercent,
    addonFeePercent: rates.addonFeePercent,
    gstPercent: resolveGstPercent(booking, opts.settingsInvoice || {}),
    spareParts: deriveAddedServicesAmount(booking).lines,
  });
}
