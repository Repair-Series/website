import { NextRequest } from "next/server";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { requireApiCaller } from "@/lib/server/auth";
import { calculateTransactionFinance, resolveFinancialSettings } from "@/lib/server/finance";
import { resolveCatalogServicePriceFromData } from "@/lib/server/finance/catalogPrice";
import { evaluateCouponData } from "@/lib/server/finance/loadCoupon";
import {
  getDocumentWithUserToken,
  queryFirstByCodeWithUserToken,
} from "@/lib/server/userFirestore";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

/**
 * Authoritative checkout quote. Does not persist.
 * Customers must send serviceId; catalog price wins over any client amount.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    if (caller.role === "internal") {
      throw Object.assign(new Error("Not allowed"), { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      serviceId?: string;
      variationId?: string;
      quantity?: unknown;
      serviceAmount?: unknown;
      addedServicesAmount?: unknown;
      sparePartsAmount?: unknown;
      discountAmount?: unknown;
      couponCode?: string;
      spareParts?: Array<{ title?: string; quantity?: number; rate?: number; amount?: number }>;
    };

    const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const idToken = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() || "";
    if (!idToken) {
      throw Object.assign(new Error("Sign in required"), { status: 401, code: "UNAUTHENTICATED" });
    }

    console.info("[Checkout] loading catalog with user token", {
      uid: caller.uid,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "repair-series",
    });
    const [general, invoice] = await Promise.all([
      getDocumentWithUserToken(idToken, "settings/general"),
      getDocumentWithUserToken(idToken, "settings/invoice"),
    ]);
    const settings = resolveFinancialSettings(general || {}, invoice || {}, {
      financeFormulaVersion: "v2",
    });

    let serviceAmount = 0;
    let catalog: ReturnType<typeof resolveCatalogServicePriceFromData> | null = null;
    const serviceId = String(body.serviceId || "").trim();
    if (serviceId) {
      const serviceDoc = await getDocumentWithUserToken(idToken, `services/${serviceId}`);
      if (!serviceDoc) {
        throw Object.assign(new Error("Service not found"), { status: 404 });
      }
      catalog = resolveCatalogServicePriceFromData(serviceId, serviceDoc, {
        variationId: String(body.variationId || "").trim(),
        quantity: body.quantity,
      });
      serviceAmount = catalog.amount;
    } else if (caller.role === "admin") {
      serviceAmount = Number(body.serviceAmount || 0);
      if (!Number.isFinite(serviceAmount) || serviceAmount < 0) {
        throw Object.assign(new Error("Invalid service amount"), { status: 400 });
      }
    } else {
      throw Object.assign(new Error("serviceId is required"), { status: 400 });
    }

    const addedServicesAmount = Math.max(0, Number(body.addedServicesAmount || 0) || 0);
    const sparePartsAmount = Math.max(0, Number(body.sparePartsAmount || 0) || 0);

    let coupon = null;
    const couponCode = String(body.couponCode || "").trim();
    if (couponCode) {
      const feeAmount =
        settings.customerPlatformFeeType === "percent"
          ? Math.round(((serviceAmount * settings.customerPlatformFeeValue) / 100) * 100) / 100
          : settings.customerPlatformFeeValue;
      const checkoutSubtotal = serviceAmount + feeAmount;
      const couponDoc =
        (await queryFirstByCodeWithUserToken(idToken, "coupons", couponCode.toUpperCase())) ||
        (await queryFirstByCodeWithUserToken(idToken, "offers", couponCode.toUpperCase()));
      coupon = evaluateCouponData(couponCode.toUpperCase(), couponDoc, checkoutSubtotal);
      if (!coupon.valid) {
        return jsonWithCors(req, { ok: false, error: coupon.message, coupon }, { status: 400 });
      }
    }

    const snap = calculateTransactionFinance({
      formulaVersion: "v2",
      serviceAmount,
      visitingCharge: 0,
      addedServicesAmount,
      sparePartsAmount,
      discountAmount: coupon ? undefined : body.discountAmount,
      coupon,
      platformFeePercent: settings.serviceCommissionPercent,
      addonFeePercent: settings.additionalServiceCommissionPercent,
      sparePartCommissionPercent: settings.sparePartCommissionPercent,
      customerPlatformFeeType: settings.customerPlatformFeeType,
      customerPlatformFeeValue: settings.customerPlatformFeeValue,
      gstEnabled: settings.gstEnabled,
      gstPercent: settings.gstPercent,
      spareParts: Array.isArray(body.spareParts)
        ? body.spareParts.map((p) => ({
            title: String(p.title || "Spare part"),
            quantity: Number(p.quantity) || 1,
            rate: Number(p.rate) || 0,
            amount: Number(p.amount) || 0,
          }))
        : [],
    });

    return jsonWithCors(req, {
      ok: true,
      formulaVersion: "v2",
      catalog,
      settings: {
        customerPlatformFeeType: settings.customerPlatformFeeType,
        customerPlatformFeeValue: settings.customerPlatformFeeValue,
        gstEnabled: settings.gstEnabled,
        gstPercent: settings.gstPercent,
        serviceCommissionPercent: settings.serviceCommissionPercent,
        additionalServiceCommissionPercent: settings.additionalServiceCommissionPercent,
        sparePartCommissionPercent: settings.sparePartCommissionPercent,
      },
      customer: {
        serviceCharges: snap.serviceAmount,
        convenienceAndPlatformFee: snap.convenienceFee,
        feeType: snap.platformFeeType,
        feeRate: snap.platformFeeValue,
        additionalServiceValue: snap.addedServicesAmount,
        sparePartValue: snap.sparePartValue,
        discount: snap.discount,
        discountOnService: snap.discountOnService,
        discountOnCompanyFee: snap.discountOnCompanyFee,
        taxableCompanyFee: snap.taxableCompanyFee,
        gstEnabled: snap.gstEnabled,
        gstRate: snap.gstPercent,
        gstTaxableBase: snap.gstTaxableBase,
        cgstAmount: snap.cgstAmount,
        sgstAmount: snap.sgstAmount,
        totalGst: snap.gstAmount,
        serviceGst: snap.serviceGstAmount,
        sparePartGst: snap.sparePartGstAmount,
        finalPayable: snap.finalAmount,
        serviceSubtotal: snap.serviceAmount,
        platformFee: snap.convenienceFee,
        platformFeeType: snap.platformFeeType,
        platformFeeValue: snap.platformFeeValue,
        taxableAmount: snap.taxableCompanyFee,
        totalTax: snap.gstAmount,
      },
      partner: {
        serviceValue: snap.serviceAmount,
        serviceCompanyCommission: snap.platformFeeAmount,
        servicePartnerEarning: snap.technicianServiceEarning,
        additionalServiceValue: snap.addedServicesAmount,
        additionalServiceCompanyCommission: snap.addonFeeAmount,
        additionalServicePartnerEarning: snap.technicianAddonEarning,
        sparePartValue: snap.sparePartValue,
        sparePartCompanyCommission: snap.sparePartFeeAmount,
        sparePartPartnerEarning: snap.technicianSpareEarning,
        totalPartnerEarning: snap.technicianFinalEarning,
      },
      company: {
        convenienceAndPlatformFeeRevenue: snap.convenienceFee,
        serviceCommissionRevenue: snap.platformFeeAmount,
        additionalServiceCommissionRevenue: snap.addonFeeAmount,
        sparePartCommissionRevenue: snap.sparePartFeeAmount,
        gstCollectedOnCompanyFee: snap.gstCollectedOnCompanyFee,
        totalCompanyRevenue: snap.companyEarnings,
        serviceCommission: snap.platformFeeAmount,
        additionalServiceCommission: snap.addonFeeAmount,
        sparePartCommission: snap.sparePartFeeAmount,
        platformFeeRevenue: snap.convenienceFee,
      },
      invoicePageCount: snap.invoicePageCount,
      snapshot: snap,
    });
  } catch (err) {
    const raw = String((err as Error)?.message || "");
    const adminAuthFailure = /16\s*UNAUTHENTICATED|OAuth 2 access token|invalid authentication credentials/i.test(
      raw,
    );
    const status = adminAuthFailure
      ? 503
      : Number((err as { status?: number })?.status || 500);
    const message = adminAuthFailure
      ? "Server authentication is not configured"
      : publicErrorMessage(err, "Could not calculate checkout");
    console.info("[Checkout] failed", {
      status,
      code: String((err as { code?: string }).code || ""),
      message: message.slice(0, 160),
    });
    if (status >= 500) console.error("api/checkout/calculate", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
