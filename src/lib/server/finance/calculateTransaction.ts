import { calculateDiscountPaise, applyStoredDiscountPaise, type CouponInput } from "./discount";
import { calculateTransactionFinanceV2 } from "./calculateTransaction.v2";
import {
  clampNonNegativePaise,
  percentOfPaise,
  sanitizePercent,
  splitInclusiveGst,
  toPaise,
  toRupees,
} from "./money";
import type {
  FinanceInput,
  FinanceSnapshot,
  InvoicePageBreakdown,
  SparePartLine,
} from "./financeTypes";

export type {
  FinanceInput,
  FinanceSnapshot,
  InvoicePageBreakdown,
  SparePartLine,
} from "./financeTypes";

function pageFromInclusive(
  itemLabel: string,
  inclusivePaise: number,
  gstPercent: number,
): InvoicePageBreakdown {
  const tax = splitInclusiveGst(inclusivePaise, gstPercent);
  return {
    itemLabel,
    grossAmount: tax.inclusiveTotal,
    discount: 0,
    taxableValue: tax.taxableValue,
    cgstPercent: tax.cgstPercent,
    sgstPercent: tax.sgstPercent,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    gstAmount: tax.gstAmount,
    totalAmount: tax.inclusiveTotal,
  };
}

/**
 * Authoritative transaction math.
 *
 * Customer payable (existing checkout — do not add platform fee on top):
 *   finalAmount = max(0, service + visitingCharge + addons - discount)
 *
 * Visiting charge is the customer-facing convenience fee already in the product.
 * Platform commission is an internal split of service price, not an extra customer charge.
 *
 * Partner earning (existing freeze formula):
 *   technicianFinalEarning = service - platformFee + addons - addonFee
 *   companyEarnings        = platformFee + visitingCharge + addonFee
 *
 * GST: existing invoice treatment — inclusive back-calculation from the payable
 * using settings/invoice.gstPercent. CGST/SGST is a 50/50 split of that GST.
 */
export function calculateTransactionFinanceV1(input: FinanceInput): FinanceSnapshot {
  const servicePaise = toPaise(input.serviceAmount);
  const visitingPaise = toPaise(input.visitingCharge);
  const addonsPaise = toPaise(input.addedServicesAmount);
  const platformPct = sanitizePercent(input.platformFeePercent, 0);
  const addonPct = sanitizePercent(input.addonFeePercent, 0);
  const gstPct = sanitizePercent(input.gstPercent, 0);

  const checkoutSubtotalPaise = servicePaise + visitingPaise;
  let discountPaise = 0;
  if (input.discountAmount != null && input.discountAmount !== "") {
    discountPaise = applyStoredDiscountPaise(checkoutSubtotalPaise, input.discountAmount);
  } else if (input.coupon) {
    discountPaise = calculateDiscountPaise(checkoutSubtotalPaise, input.coupon);
  }
  discountPaise = Math.min(checkoutSubtotalPaise, discountPaise);

  const grossPaise = checkoutSubtotalPaise + addonsPaise;
  const finalPaise = clampNonNegativePaise(grossPaise - discountPaise);

  const platformFeePaise = percentOfPaise(servicePaise, platformPct);
  const addonFeePaise = percentOfPaise(addonsPaise, addonPct);
  const techServicePaise = clampNonNegativePaise(servicePaise - platformFeePaise);
  const techAddonPaise = clampNonNegativePaise(addonsPaise - addonFeePaise);
  const techFinalPaise = techServicePaise + techAddonPaise;
  const companyPaise = platformFeePaise + visitingPaise + addonFeePaise;

  const overallTax = splitInclusiveGst(finalPaise, gstPct);

  const page1BasePaise = visitingPaise + platformFeePaise;
  const page2BasePaise = techServicePaise;
  const pageBaseSum = page1BasePaise + page2BasePaise;
  let page1DiscountPaise = 0;
  let page2DiscountPaise = 0;
  if (discountPaise > 0 && pageBaseSum > 0) {
    page1DiscountPaise = Math.round((discountPaise * page1BasePaise) / pageBaseSum);
    page1DiscountPaise = Math.min(page1BasePaise, page1DiscountPaise);
    page2DiscountPaise = Math.min(page2BasePaise, discountPaise - page1DiscountPaise);
    const allocated = page1DiscountPaise + page2DiscountPaise;
    if (allocated < discountPaise) {
      const leftover = discountPaise - allocated;
      const room2 = page2BasePaise - page2DiscountPaise;
      const extra2 = Math.min(room2, leftover);
      page2DiscountPaise += extra2;
      page1DiscountPaise += leftover - extra2;
      page1DiscountPaise = Math.min(page1BasePaise, page1DiscountPaise);
    }
  }

  const page1Inclusive = clampNonNegativePaise(page1BasePaise - page1DiscountPaise);
  const page2Inclusive = clampNonNegativePaise(page2BasePaise - page2DiscountPaise);

  const page1 = pageFromInclusive("Convenience and Platform Fee", page1Inclusive, gstPct);
  page1.grossAmount = toRupees(page1BasePaise);
  page1.discount = toRupees(page1DiscountPaise);
  page1.totalAmount = toRupees(page1Inclusive);

  const page2 = pageFromInclusive("Service Charges", page2Inclusive, gstPct);
  page2.grossAmount = toRupees(page2BasePaise);
  page2.discount = toRupees(page2DiscountPaise);
  page2.totalAmount = toRupees(page2Inclusive);

  const spareParts = Array.isArray(input.spareParts)
    ? input.spareParts.filter((l) => l && (l.amount > 0 || l.title))
    : [];
  const hasSpareParts = addonsPaise > 0 || spareParts.length > 0;
  const page3 = hasSpareParts
    ? pageFromInclusive("Spare Parts / Add-ons", addonsPaise, gstPct)
    : null;

  return {
    formulaVersion: "v1",
    serviceAmount: toRupees(servicePaise),
    visitingCharge: toRupees(visitingPaise),
    convenienceFee: toRupees(visitingPaise),
    addedServicesAmount: toRupees(addonsPaise),
    sparePartValue: 0,
    grossAmount: toRupees(grossPaise),
    discount: toRupees(discountPaise),
    finalAmount: toRupees(finalPaise),
    platformFeePercent: platformPct,
    addonFeePercent: addonPct,
    sparePartCommissionPercent: addonPct,
    platformFeeType: "fixed",
    platformFeeValue: toRupees(visitingPaise),
    platformFeeAmount: toRupees(platformFeePaise),
    addonFeeAmount: toRupees(addonFeePaise),
    sparePartFeeAmount: 0,
    technicianServiceEarning: toRupees(techServicePaise),
    technicianAddonEarning: toRupees(techAddonPaise),
    technicianSpareEarning: 0,
    technicianFinalEarning: toRupees(techFinalPaise),
    companyEarnings: toRupees(companyPaise),
    gstEnabled: gstPct > 0,
    gstPercent: overallTax.gstPercent,
    gstTaxableBase: "inclusivePayable",
    taxableCompanyFee: 0,
    taxableValue: overallTax.taxableValue,
    gstAmount: overallTax.gstAmount,
    gstCollectedOnCompanyFee: 0,
    serviceGstAmount: 0,
    additionalServiceGstAmount: 0,
    sparePartGstAmount: 0,
    discountOnService: toRupees(discountPaise),
    discountOnCompanyFee: 0,
    cgstPercent: overallTax.cgstPercent,
    sgstPercent: overallTax.sgstPercent,
    cgstAmount: overallTax.cgstAmount,
    sgstAmount: overallTax.sgstAmount,
    page1,
    page2,
    page3,
    spareParts,
    hasSpareParts,
    invoicePageCount: hasSpareParts ? 3 : 2,
    calculatedAt: new Date().toISOString(),
  };
}

/** Dispatcher: v2 for new quotes; pass formulaVersion: 'v1' for historical bookings. */
export function calculateTransactionFinance(input: FinanceInput): FinanceSnapshot {
  if (input.formulaVersion === "v1") {
    return calculateTransactionFinanceV1(input);
  }
  return calculateTransactionFinanceV2(input);
}

export function calculateCustomerCheckout(input: FinanceInput) {
  const snap = calculateTransactionFinance(input);
  return {
    formulaVersion: snap.formulaVersion,
    serviceAmount: snap.serviceAmount,
    convenienceFee: snap.convenienceFee,
    visitingCharge: snap.visitingCharge,
    platformFeeType: snap.platformFeeType,
    platformFeeValue: snap.platformFeeValue,
    platformFeeAmount: snap.platformFeeAmount,
    addedServicesAmount: snap.addedServicesAmount,
    sparePartValue: snap.sparePartValue,
    grossAmount: snap.grossAmount,
    discount: snap.discount,
    taxableCompanyFee: snap.taxableCompanyFee,
    taxableValue: snap.taxableValue,
    cgst: snap.cgstAmount,
    sgst: snap.sgstAmount,
    gst: snap.gstAmount,
    gstEnabled: snap.gstEnabled,
    gstPercent: snap.gstPercent,
    gstTaxableBase: snap.gstTaxableBase,
    serviceGstAmount: snap.serviceGstAmount,
    sparePartGstAmount: snap.sparePartGstAmount,
    finalAmount: snap.finalAmount,
  };
}

export function calculatePartnerEarning(input: FinanceInput) {
  const snap = calculateTransactionFinance(input);
  return {
    serviceAmount: snap.serviceAmount,
    platformFeePercent: snap.platformFeePercent,
    platformFeeAmount: snap.platformFeeAmount,
    addedServicesAmount: snap.addedServicesAmount,
    addonFeePercent: snap.addonFeePercent,
    addonFeeAmount: snap.addonFeeAmount,
    technicianAddonEarning: snap.technicianAddonEarning,
    technicianFinalEarning: snap.technicianFinalEarning,
    companyEarnings: snap.companyEarnings,
  };
}

export function bookingEconomicsPatch(snap: FinanceSnapshot) {
  return {
    financeFormulaVersion: snap.formulaVersion,
    servicePrice: snap.serviceAmount,
    visitingCharge: snap.visitingCharge,
    originalBookingAmount: snap.serviceAmount,
    customerBaseTotal:
      snap.formulaVersion === "v2"
        ? snap.serviceAmount + snap.convenienceFee
        : snap.serviceAmount + snap.visitingCharge,
    addedServicesAmount: snap.addedServicesAmount,
    sparePartValue: snap.sparePartValue,
    sparePartCommissionPercent: snap.sparePartCommissionPercent,
    sparePartFeeAmount: snap.sparePartFeeAmount,
    customerPlatformFeeType: snap.platformFeeType,
    customerPlatformFeeValue: snap.platformFeeValue,
    customerPlatformFee: snap.convenienceFee,
    gstEnabled: snap.gstEnabled,
    gstTaxableBase: snap.gstTaxableBase,
    taxableCompanyFee: snap.taxableCompanyFee,
    gstCollectedOnCompanyFee: snap.gstCollectedOnCompanyFee,
    finalBookingAmount: snap.finalAmount,
    platformFeePercent: snap.platformFeePercent,
    addonFeePercent: snap.addonFeePercent,
    platformFeeAmount: snap.platformFeeAmount,
    addonFeeAmount: snap.addonFeeAmount,
    totalDeduction: Math.round((snap.finalAmount - snap.technicianFinalEarning) * 100) / 100,
    technicianServiceEarning: snap.technicianServiceEarning,
    technicianAddonEarning: snap.technicianAddonEarning,
    technicianSpareEarning: snap.technicianSpareEarning,
    technicianFinalEarning: snap.technicianFinalEarning,
    companyEarnings: snap.companyEarnings,
    platformFinalEarning: snap.companyEarnings,
    technicianEarning: snap.technicianFinalEarning,
    platformCommission: snap.platformFeeAmount,
    totalAmount: snap.finalAmount,
    finalAmount: snap.finalAmount,
    discountAmount: snap.discount,
    gstPercent: snap.gstPercent,
    gstAmount: snap.gstAmount,
    taxableValue: snap.taxableValue,
    cgstPercent: snap.cgstPercent,
    sgstPercent: snap.sgstPercent,
    cgstAmount: snap.cgstAmount,
    sgstAmount: snap.sgstAmount,
    financeSnapshot: snap,
  };
}
