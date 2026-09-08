import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyExclusiveGst,
  calculateCustomerCheckout,
  calculatePartnerEarning,
  calculateTransactionFinance,
  resolveInvoiceNumber,
  shouldSendInvoiceEmail,
  splitInclusiveGst,
  toPaise,
  toRupees,
} from "./index";

const v1 = { formulaVersion: "v1" as const };
const v2 = { formulaVersion: "v2" as const };

describe("money", () => {
  it("converts rupees to paise without float residue", () => {
    assert.equal(toPaise(100.5), 10050);
    assert.equal(toPaise(0.1 + 0.2), 30);
    assert.equal(toRupees(10050), 100.5);
  });

  it("splits inclusive GST 18% on 1180 into 1000 + 180", () => {
    const tax = splitInclusiveGst(toPaise(1180), 18);
    assert.equal(tax.taxableValue, 1000);
    assert.equal(tax.gstAmount, 180);
    assert.equal(tax.cgstAmount + tax.sgstAmount, 180);
  });

  it("adds exclusive GST 18% on 1000 as 180", () => {
    const tax = applyExclusiveGst(toPaise(1000), 18, true);
    assert.equal(tax.taxableValue, 1000);
    assert.equal(tax.gstAmount, 180);
    assert.equal(tax.totalAmount, 1180);
  });
});

describe("v1 customer checkout (legacy visiting + inclusive GST)", () => {
  it("1. normal service", () => {
    const c = calculateCustomerCheckout({
      ...v1,
      serviceAmount: 1000,
      visitingCharge: 0,
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 0,
    });
    assert.equal(c.finalAmount, 1000);
    assert.equal(c.discount, 0);
  });

  it("2. service + visiting (convenience) fee", () => {
    const c = calculateCustomerCheckout({
      ...v1,
      serviceAmount: 800,
      visitingCharge: 149,
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 0,
    });
    assert.equal(c.convenienceFee, 149);
    assert.equal(c.finalAmount, 949);
  });

  it("3. service + discount", () => {
    const c = calculateCustomerCheckout({
      ...v1,
      serviceAmount: 1000,
      visitingCharge: 0,
      coupon: { valid: true, discountType: "percentage", discountValue: 10 },
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 0,
    });
    assert.equal(c.discount, 100);
    assert.equal(c.finalAmount, 900);
  });

  it("4. service + GST inclusive", () => {
    const c = calculateCustomerCheckout({
      ...v1,
      serviceAmount: 1180,
      visitingCharge: 0,
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 18,
    });
    assert.equal(c.finalAmount, 1180);
    assert.equal(c.taxableValue, 1000);
    assert.equal(c.gst, 180);
  });

  it("15. final amount cannot become negative", () => {
    const c = calculateCustomerCheckout({
      ...v1,
      serviceAmount: 100,
      visitingCharge: 0,
      coupon: { valid: true, discountType: "flat", discountValue: 9999 },
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 18,
    });
    assert.equal(c.finalAmount, 0);
    assert.ok(c.discount <= 100);
  });
});

describe("v1 partner earning", () => {
  it("6. partner commission 30%", () => {
    const p = calculatePartnerEarning({
      ...v1,
      serviceAmount: 1000,
      visitingCharge: 200,
      addedServicesAmount: 0,
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 0,
    });
    assert.equal(p.platformFeeAmount, 300);
    assert.equal(p.technicianFinalEarning, 700);
    assert.equal(p.companyEarnings, 500);
  });

  it("14. rounding edge: 999 * 30%", () => {
    const p = calculatePartnerEarning({
      ...v1,
      serviceAmount: 999,
      platformFeePercent: 30,
      addonFeePercent: 15,
      gstPercent: 0,
    });
    assert.equal(p.platformFeeAmount, 299.7);
    assert.equal(p.technicianFinalEarning, 699.3);
  });
});

describe("v2 customer + partner (authoritative new formula)", () => {
  it("CASE 1: service 1000 + fixed platform fee 100, GST off", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 100,
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: false,
      gstPercent: 18,
    });
    assert.equal(snap.convenienceFee, 100);
    assert.equal(snap.gstAmount, 0);
    assert.equal(snap.finalAmount, 1100);
    assert.equal(snap.technicianFinalEarning, 700);
    assert.equal(snap.companyEarnings, 400);
  });

  it("CASE 2: service 1000 + 10% platform fee, GST off", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "percent",
      customerPlatformFeeValue: 10,
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: false,
      gstPercent: 18,
    });
    assert.equal(snap.convenienceFee, 100);
    assert.equal(snap.finalAmount, 1100);
    assert.equal(snap.platformFeeAmount, 300);
    assert.equal(snap.technicianFinalEarning, 700);
  });

  it("CASE 3: GST 18% on convenience fee only, not on service", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 100,
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: true,
      gstPercent: 18,
    });
    assert.equal(snap.serviceAmount, 1000);
    assert.equal(snap.convenienceFee, 100);
    assert.equal(snap.taxableCompanyFee, 100);
    assert.equal(snap.taxableValue, 100);
    assert.equal(snap.cgstAmount, 9);
    assert.equal(snap.sgstAmount, 9);
    assert.equal(snap.gstAmount, 18);
    assert.equal(snap.gstCollectedOnCompanyFee, 18);
    assert.equal(snap.serviceGstAmount, 0);
    assert.equal(snap.sparePartGstAmount, 0);
    assert.equal(snap.finalAmount, 1118);
    assert.notEqual(snap.gstAmount, Math.round(1100 * 0.18));
    assert.equal(snap.page1.totalAmount, 118);
    assert.equal(snap.page2.totalAmount, 1000);
    assert.equal(snap.page2.gstAmount, 0);
    assert.equal(snap.technicianFinalEarning, 700);
    assert.equal(snap.companyEarnings, 400);
  });

  it("CASE 4: service 1000, 30% company service commission", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 0,
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: false,
      gstPercent: 0,
    });
    assert.equal(snap.platformFeeAmount, 300);
    assert.equal(snap.technicianServiceEarning, 700);
    assert.equal(snap.technicianFinalEarning, 700);
    assert.equal(snap.companyEarnings, 300);
    assert.equal(snap.finalAmount, 1000);
  });

  it("CASE 5: service 1000 + spare 1000, 30% / 10% company share", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      sparePartsAmount: 1000,
      spareParts: [{ title: "Compressor", quantity: 1, rate: 1000, amount: 1000 }],
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 0,
      platformFeePercent: 30,
      addonFeePercent: 15,
      sparePartCommissionPercent: 10,
      gstEnabled: false,
      gstPercent: 0,
    });
    assert.equal(snap.technicianServiceEarning, 700);
    assert.equal(snap.technicianSpareEarning, 900);
    assert.equal(snap.technicianFinalEarning, 1600);
    assert.equal(snap.platformFeeAmount, 300);
    assert.equal(snap.sparePartFeeAmount, 100);
    assert.equal(snap.companyEarnings, 400);
    assert.equal(snap.hasSpareParts, true);
    assert.equal(snap.invoicePageCount, 3);
    assert.equal(snap.finalAmount, 2000);
  });

  it("additional services use additional commission, not spare commission", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      addedServicesAmount: 200,
      sparePartsAmount: 0,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 0,
      platformFeePercent: 30,
      addonFeePercent: 20,
      sparePartCommissionPercent: 10,
      gstEnabled: false,
      gstPercent: 0,
    });
    assert.equal(snap.technicianAddonEarning, 160);
    assert.equal(snap.technicianSpareEarning, 0);
    assert.equal(snap.technicianFinalEarning, 860);
    assert.equal(snap.hasSpareParts, false);
    assert.equal(snap.invoicePageCount, 2);
  });

  it("percentage platform fee then GST on the resulting fee only", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "percent",
      customerPlatformFeeValue: 10,
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: true,
      gstPercent: 18,
    });
    assert.equal(snap.convenienceFee, 100);
    assert.equal(snap.gstAmount, 18);
    assert.equal(snap.finalAmount, 1118);
  });

  it("GST is never applied to spare parts or additional services", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      addedServicesAmount: 200,
      sparePartsAmount: 1000,
      spareParts: [{ title: "Compressor", quantity: 1, rate: 1000, amount: 1000 }],
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 100,
      platformFeePercent: 30,
      addonFeePercent: 20,
      sparePartCommissionPercent: 10,
      gstEnabled: true,
      gstPercent: 18,
    });
    assert.equal(snap.gstAmount, 18);
    assert.equal(snap.serviceGstAmount, 0);
    assert.equal(snap.additionalServiceGstAmount, 0);
    assert.equal(snap.sparePartGstAmount, 0);
    assert.equal(snap.page3?.gstAmount, 0);
    assert.equal(snap.page2.gstAmount, 0);
    assert.equal(snap.finalAmount, 2318);
    assert.equal(snap.technicianFinalEarning, 700 + 160 + 900);
    assert.equal(snap.companyEarnings, 300 + 40 + 100 + 100);
    assert.equal(snap.invoicePageCount, 3);
  });

  it("rejects negative settings by clamping", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "percent",
      customerPlatformFeeValue: -10,
      platformFeePercent: -30,
      addonFeePercent: 150,
      gstEnabled: false,
      gstPercent: 0,
    });
    assert.equal(snap.convenienceFee, 0);
    assert.equal(snap.platformFeePercent, 0);
    assert.equal(snap.addonFeePercent, 100);
    assert.equal(snap.technicianFinalEarning, 1000);
  });

  it("zero service is zero everywhere", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 0,
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: true,
      gstPercent: 18,
    });
    assert.equal(snap.finalAmount, 0);
    assert.equal(snap.technicianFinalEarning, 0);
    assert.equal(snap.companyEarnings, 0);
  });

  it("historical snapshot does not change when settings change", () => {
    const booked = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      platformFeePercent: 30,
      addonFeePercent: 10,
      sparePartCommissionPercent: 10,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 0,
      gstEnabled: false,
      gstPercent: 0,
    });
    const later = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      platformFeePercent: 40,
      addonFeePercent: 10,
      sparePartCommissionPercent: 10,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 0,
      gstEnabled: false,
      gstPercent: 0,
    });
    assert.equal(booked.technicianFinalEarning, 700);
    assert.equal(later.technicianFinalEarning, 600);
    assert.notEqual(booked.platformFeeAmount, later.platformFeeAmount);
  });

  it("discount applies to service + fee; GST uses remaining company fee", () => {
    const snap = calculateTransactionFinance({
      ...v2,
      serviceAmount: 1000,
      customerPlatformFeeType: "fixed",
      customerPlatformFeeValue: 100,
      coupon: { valid: true, discountType: "percentage", discountValue: 10 },
      platformFeePercent: 30,
      addonFeePercent: 10,
      gstEnabled: true,
      gstPercent: 18,
    });
    assert.equal(snap.discount, 110);
    assert.equal(snap.discountOnService, 110);
    assert.equal(snap.discountOnCompanyFee, 0);
    assert.equal(snap.taxableCompanyFee, 100);
    assert.equal(snap.gstAmount, 18);
    assert.equal(snap.finalAmount, 1008);
  });
});

describe("snapshot + invoice idempotency", () => {
  it("duplicate invoice numbers stay stable for the same booking", () => {
    const n1 = resolveInvoiceNumber({
      bookingId: "abc12345xyz",
      prefix: "INV",
      now: new Date("2026-08-31"),
    });
    const n2 = resolveInvoiceNumber({
      bookingId: "abc12345xyz",
      prefix: "INV",
      now: new Date("2026-08-31"),
    });
    assert.equal(n1, n2);
    const reused = resolveInvoiceNumber({
      existingNumber: n1,
      bookingId: "abc12345xyz",
      prefix: "INV",
      now: new Date("2026-09-01"),
    });
    assert.equal(reused, n1);
  });

  it("invoice email is not resent after success", () => {
    assert.equal(shouldSendInvoiceEmail({ emailStatus: "sent" }), false);
    assert.equal(shouldSendInvoiceEmail({ invoiceEmailStatus: "sent" }), false);
    assert.equal(shouldSendInvoiceEmail({ emailStatus: "failed" }), true);
    assert.equal(shouldSendInvoiceEmail({ emailStatus: "pending" }), true);
    assert.equal(shouldSendInvoiceEmail({}), true);
  });
});
