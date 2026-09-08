/**
 * Integer minor-unit (paise) money helpers.
 * 1 rupee = 100 paise. All arithmetic stays in integers until display.
 *
 * Rounding: half-away-from-zero via Math.round on the paise conversion.
 * Percent of an amount: Math.round(paise * percent / 100).
 */

export const PAISE_PER_RUPEE = 100;

export function toPaise(rupees: unknown): number {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * PAISE_PER_RUPEE);
}

export function toRupees(paise: unknown): number {
  const p = Number(paise);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.round(p) / PAISE_PER_RUPEE;
}

export function sanitizePercent(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

/** percent of paise, rounded to the nearest paise. */
export function percentOfPaise(paise: number, percent: number): number {
  const p = Math.max(0, Math.round(Number(paise) || 0));
  const pct = sanitizePercent(percent, 0);
  if (p === 0 || pct === 0) return 0;
  return Math.round((p * pct) / 100);
}

export function clampNonNegativePaise(paise: number): number {
  const p = Math.round(Number(paise) || 0);
  return p > 0 ? p : 0;
}

/**
 * GST-exclusive: tax is added on top of taxablePaise.
 * Used by formulaVersion v2 when gstEnabled is true.
 */
export function applyExclusiveGst(
  taxablePaise: number,
  gstPercent: number,
  enabled = true,
) {
  const taxable = clampNonNegativePaise(taxablePaise);
  const pct = enabled ? sanitizePercent(gstPercent, 0) : 0;
  if (taxable === 0 || pct <= 0) {
    return {
      taxablePaise: taxable,
      gstPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      totalPaise: taxable,
      gstPercent: pct,
      cgstPercent: pct / 2,
      sgstPercent: pct / 2,
      taxableValue: toRupees(taxable),
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalAmount: toRupees(taxable),
    };
  }
  const gstPaise = percentOfPaise(taxable, pct);
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const totalPaise = taxable + gstPaise;
  return {
    taxablePaise: taxable,
    gstPaise,
    cgstPaise,
    sgstPaise,
    totalPaise,
    gstPercent: pct,
    cgstPercent: pct / 2,
    sgstPercent: pct / 2,
    taxableValue: toRupees(taxable),
    gstAmount: toRupees(gstPaise),
    cgstAmount: toRupees(cgstPaise),
    sgstAmount: toRupees(sgstPaise),
    totalAmount: toRupees(totalPaise),
  };
}

/**
 * GST-inclusive split used by the existing invoice pipeline (v1):
 * taxable = inclusive / (1 + gstPercent/100), remainder is GST.
 * CGST/SGST is a 50/50 presentation of that combined GST
 * (the project has no IGST / place-of-supply logic).
 */
export function splitInclusiveGst(inclusivePaise: number, gstPercent: number) {
  const inclusive = clampNonNegativePaise(inclusivePaise);
  const pct = sanitizePercent(gstPercent, 0);
  if (inclusive === 0) {
    return {
      inclusiveTotal: 0,
      taxableValue: 0,
      gstAmount: 0,
      gstPercent: pct,
      cgstPercent: pct / 2,
      sgstPercent: pct / 2,
      cgstAmount: 0,
      sgstAmount: 0,
    };
  }
  if (pct <= 0) {
    return {
      inclusiveTotal: toRupees(inclusive),
      taxableValue: toRupees(inclusive),
      gstAmount: 0,
      gstPercent: 0,
      cgstPercent: 0,
      sgstPercent: 0,
      cgstAmount: 0,
      sgstAmount: 0,
    };
  }
  const taxablePaise = Math.round((inclusive * 100) / (100 + pct));
  const gstPaise = inclusive - taxablePaise;
  const cgstPaise = Math.floor(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  return {
    inclusiveTotal: toRupees(inclusive),
    taxableValue: toRupees(taxablePaise),
    gstAmount: toRupees(gstPaise),
    gstPercent: pct,
    cgstPercent: pct / 2,
    sgstPercent: pct / 2,
    cgstAmount: toRupees(cgstPaise),
    sgstAmount: toRupees(sgstPaise),
  };
}
