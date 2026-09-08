import { sanitizePercent } from "./money";

export type PlatformFeeType = "fixed" | "percent";
export type FormulaVersion = "v1" | "v2";

export type FinancialSettings = {
  formulaVersion: FormulaVersion;
  customerPlatformFeeType: PlatformFeeType;
  customerPlatformFeeValue: number;
  gstEnabled: boolean;
  gstPercent: number;
  serviceCommissionPercent: number;
  additionalServiceCommissionPercent: number;
  sparePartCommissionPercent: number;
};

function asFeeType(raw: unknown): PlatformFeeType {
  return String(raw || "").trim().toLowerCase() === "percent" ? "percent" : "fixed";
}

function nonNegativeMoney(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

/**
 * Resolve live or frozen financial settings.
 *
 * Mapping from existing Firestore docs:
 * - settings/general.platformCommissionPercent → company share of SERVICE value
 * - settings/general.addonFeePercent → company share of additional services
 * - settings/general.sparePartCommissionPercent → company share of spare parts
 *   (falls back to addonFeePercent until Admin sets it)
 * - settings/general.customerPlatformFeeType / customerPlatformFeeValue
 *   → customer-facing convenience/platform fee (NOT the partner commission)
 * - settings/invoice.gstEnabled (default false) + gstPercent
 *
 * Unset customer fee defaults to fixed ₹0 so enabling v2 does not suddenly
 * charge customers the 30% partner-commission figure.
 */
export function resolveFinancialSettings(
  general: Record<string, unknown> = {},
  invoice: Record<string, unknown> = {},
  frozen: Record<string, unknown> = {},
): FinancialSettings {
  const src = { ...general, ...invoice, ...frozen };
  const gstFlag = frozen.gstEnabled ?? invoice.gstEnabled ?? general.gstEnabled;
  const gstEnabled = gstFlag === true || gstFlag === "true" || gstFlag === 1;
  const spareRaw =
    frozen.sparePartCommissionPercent ??
    general.sparePartCommissionPercent ??
    frozen.addonFeePercent ??
    general.addonFeePercent;

  return {
    formulaVersion: frozen.financeFormulaVersion === "v1" ? "v1" : "v2",
    customerPlatformFeeType: asFeeType(
      frozen.customerPlatformFeeType ?? general.customerPlatformFeeType,
    ),
    customerPlatformFeeValue: nonNegativeMoney(
      frozen.customerPlatformFeeValue ?? general.customerPlatformFeeValue,
      0,
    ),
    gstEnabled,
    gstPercent: sanitizePercent(frozen.gstPercent ?? invoice.gstPercent, 18),
    serviceCommissionPercent: sanitizePercent(
      frozen.platformFeePercent ??
        frozen.platformCommissionPercent ??
        general.platformCommissionPercent,
      0,
    ),
    additionalServiceCommissionPercent: sanitizePercent(
      frozen.addonFeePercent ?? general.addonFeePercent,
      0,
    ),
    sparePartCommissionPercent: sanitizePercent(spareRaw, 0),
  };
}

export function formulaVersionFromBooking(
  booking: Record<string, unknown>,
): FormulaVersion {
  const explicit = String(
    booking.financeFormulaVersion ||
      (booking.financeSnapshot as { formulaVersion?: string } | undefined)?.formulaVersion ||
      "",
  )
    .trim()
    .toLowerCase();
  if (explicit === "v2") return "v2";
  if (explicit === "v1" || explicit === "v1-inclusive") return "v1";
  // Existing production bookings have no formula stamp — keep inclusive/visiting math.
  if (booking.economicsSnapshotAt != null) return "v1";
  return "v1";
}
