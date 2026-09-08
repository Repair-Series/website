import { calculateDiscountPaise, applyStoredDiscountPaise, type CouponInput } from "./discount";
import {
  applyExclusiveGst,
  clampNonNegativePaise,
  percentOfPaise,
  sanitizePercent,
  toPaise,
  toRupees,
} from "./money";
import type {
  FinanceInput,
  FinanceSnapshot,
  InvoicePageBreakdown,
  SparePartLine,
} from "./financeTypes";

function pageNoGst(
  itemLabel: string,
  grossPaise: number,
  discountPaise = 0,
  extraItems?: InvoicePageBreakdown["extraItems"],
): InvoicePageBreakdown {
  const net = clampNonNegativePaise(grossPaise - discountPaise);
  return {
    itemLabel,
    grossAmount: toRupees(grossPaise),
    discount: toRupees(discountPaise),
    taxableValue: toRupees(net),
    cgstPercent: 0,
    sgstPercent: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    gstAmount: 0,
    totalAmount: toRupees(net),
    extraItems,
  };
}

function customerPlatformFeePaise(
  servicePaise: number,
  type: string,
  value: unknown,
): number {
  const feeType = String(type || "fixed").toLowerCase() === "percent" ? "percent" : "fixed";
  if (feeType === "percent") {
    return percentOfPaise(servicePaise, sanitizePercent(value, 0));
  }
  return toPaise(value);
}

/**
 * Formula version v2.
 *
 * CUSTOMER PAYABLE (independent of partner settlement):
 *   service + additional + spare + convenienceFee − discount + GST(convenienceFee)
 *
 * GST taxable base (configured business rule):
 *   convenience & platform fee ONLY, after any discount allocated to that fee.
 *   Service, additional services, and spare parts are not company-GST-taxable.
 *
 * DISCOUNT (existing coupon rule, mapped to v2):
 *   v1 computed coupons on service + visiting charge.
 *   Visiting charge is replaced by the customer convenience/platform fee, so the
 *   discountable base is service + convenience/platform fee.
 *   Additional services and spare parts are not in the coupon base.
 *   Discount reduces service first; leftover reduces the company fee.
 *   GST is then exclusive GST on the remaining company fee.
 *
 * PARTNER SETTLEMENT (independent of customer GST):
 *   percent of each line VALUE (service / additional / spare).
 *   Never taken from GST or the customer convenience fee.
 *
 * COMPANY REVENUE (excludes GST collected):
 *   service commission + additional commission + spare commission + convenience fee
 */
export function calculateTransactionFinanceV2(input: FinanceInput): FinanceSnapshot {
  const servicePaise = toPaise(input.serviceAmount);
  const additionalPaise = toPaise(input.addedServicesAmount);
  const spareFromLines = Array.isArray(input.spareParts)
    ? input.spareParts.reduce((sum, line) => sum + toPaise(line?.amount), 0)
    : 0;
  const sparePaise = Math.max(toPaise(input.sparePartsAmount), spareFromLines);
  const spareParts: SparePartLine[] = Array.isArray(input.spareParts)
    ? input.spareParts.filter((l) => l && (l.amount > 0 || l.title))
    : [];
  const hasSpareParts = sparePaise > 0 || spareParts.length > 0;

  const feeType =
    String(input.customerPlatformFeeType || "fixed").toLowerCase() === "percent"
      ? "percent"
      : "fixed";
  const feeValue = Number(input.customerPlatformFeeValue || 0);
  const platformFeePaise = customerPlatformFeePaise(
    servicePaise,
    feeType,
    Number.isFinite(feeValue) && feeValue >= 0 ? feeValue : 0,
  );

  const serviceCommissionPct = sanitizePercent(input.platformFeePercent, 0);
  const additionalCommissionPct = sanitizePercent(input.addonFeePercent, 0);
  const spareCommissionPct = sanitizePercent(
    input.sparePartCommissionPercent ?? input.addonFeePercent,
    0,
  );
  const gstEnabled = input.gstEnabled === true;
  const gstPct = gstEnabled ? sanitizePercent(input.gstPercent, 0) : 0;

  const discountablePaise = servicePaise + platformFeePaise;
  let discountPaise = 0;
  if (input.discountAmount != null && input.discountAmount !== "") {
    discountPaise = applyStoredDiscountPaise(discountablePaise, input.discountAmount);
  } else if (input.coupon) {
    discountPaise = calculateDiscountPaise(discountablePaise, input.coupon as CouponInput);
  }
  discountPaise = Math.min(discountablePaise, discountPaise);

  const discountOnServicePaise = Math.min(servicePaise, discountPaise);
  const discountOnFeePaise = Math.min(
    platformFeePaise,
    clampNonNegativePaise(discountPaise - discountOnServicePaise),
  );

  const netServicePaise = clampNonNegativePaise(servicePaise - discountOnServicePaise);
  const taxableCompanyFeePaise = clampNonNegativePaise(platformFeePaise - discountOnFeePaise);
  const tax = applyExclusiveGst(taxableCompanyFeePaise, gstPct, gstEnabled);

  const finalPaise =
    netServicePaise + additionalPaise + sparePaise + taxableCompanyFeePaise + tax.gstPaise;

  const serviceCompanyPaise = percentOfPaise(servicePaise, serviceCommissionPct);
  const additionalCompanyPaise = percentOfPaise(additionalPaise, additionalCommissionPct);
  const spareCompanyPaise = percentOfPaise(sparePaise, spareCommissionPct);
  const servicePartnerPaise = clampNonNegativePaise(servicePaise - serviceCompanyPaise);
  const additionalPartnerPaise = clampNonNegativePaise(additionalPaise - additionalCompanyPaise);
  const sparePartnerPaise = clampNonNegativePaise(sparePaise - spareCompanyPaise);
  const techFinalPaise = servicePartnerPaise + additionalPartnerPaise + sparePartnerPaise;
  const companyPaise =
    serviceCompanyPaise + additionalCompanyPaise + spareCompanyPaise + platformFeePaise;

  const page1: InvoicePageBreakdown = {
    itemLabel: "Convenience & Platform Fee",
    grossAmount: toRupees(platformFeePaise),
    discount: toRupees(discountOnFeePaise),
    taxableValue: tax.taxableValue,
    cgstPercent: tax.cgstPercent,
    sgstPercent: tax.sgstPercent,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    gstAmount: tax.gstAmount,
    totalAmount: tax.totalAmount,
  };

  const extraServiceItems =
    additionalPaise > 0
      ? [{ label: "Additional services", amount: toRupees(additionalPaise) }]
      : undefined;
  const page2 = pageNoGst(
    "Service Charge",
    servicePaise + additionalPaise,
    discountOnServicePaise,
    extraServiceItems,
  );
  page2.grossAmount = toRupees(servicePaise + additionalPaise);
  page2.taxableValue = toRupees(netServicePaise + additionalPaise);
  page2.totalAmount = toRupees(netServicePaise + additionalPaise);

  const page3 = hasSpareParts ? pageNoGst("Spare Parts", sparePaise, 0) : null;

  return {
    formulaVersion: "v2",
    serviceAmount: toRupees(servicePaise),
    visitingCharge: 0,
    convenienceFee: toRupees(platformFeePaise),
    addedServicesAmount: toRupees(additionalPaise),
    sparePartValue: toRupees(sparePaise),
    grossAmount: toRupees(servicePaise + additionalPaise + sparePaise + platformFeePaise),
    discount: toRupees(discountPaise),
    discountOnService: toRupees(discountOnServicePaise),
    discountOnCompanyFee: toRupees(discountOnFeePaise),
    finalAmount: toRupees(finalPaise),
    platformFeePercent: serviceCommissionPct,
    addonFeePercent: additionalCommissionPct,
    sparePartCommissionPercent: spareCommissionPct,
    platformFeeType: feeType,
    platformFeeValue:
      feeType === "percent" ? sanitizePercent(feeValue, 0) : nonNegativeRupees(feeValue),
    platformFeeAmount: toRupees(serviceCompanyPaise),
    addonFeeAmount: toRupees(additionalCompanyPaise),
    sparePartFeeAmount: toRupees(spareCompanyPaise),
    technicianServiceEarning: toRupees(servicePartnerPaise),
    technicianAddonEarning: toRupees(additionalPartnerPaise),
    technicianSpareEarning: toRupees(sparePartnerPaise),
    technicianFinalEarning: toRupees(techFinalPaise),
    companyEarnings: toRupees(companyPaise),
    gstEnabled,
    gstPercent: tax.gstPercent,
    gstTaxableBase: "convenienceAndPlatformFee",
    taxableCompanyFee: tax.taxableValue,
    taxableValue: tax.taxableValue,
    gstAmount: tax.gstAmount,
    gstCollectedOnCompanyFee: tax.gstAmount,
    serviceGstAmount: 0,
    additionalServiceGstAmount: 0,
    sparePartGstAmount: 0,
    cgstPercent: tax.cgstPercent,
    sgstPercent: tax.sgstPercent,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    page1,
    page2,
    page3,
    spareParts,
    hasSpareParts,
    invoicePageCount: hasSpareParts ? 3 : 2,
    calculatedAt: new Date().toISOString(),
  };
}

function nonNegativeRupees(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}
