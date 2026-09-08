export type SparePartLine = {
  title: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type InvoicePageBreakdown = {
  itemLabel: string;
  grossAmount: number;
  discount: number;
  taxableValue: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  totalAmount: number;
  extraItems?: Array<{ label: string; amount: number }>;
};

export type FinanceInput = {
  formulaVersion?: "v1" | "v2";
  serviceAmount: unknown;
  visitingCharge?: unknown;
  addedServicesAmount?: unknown;
  sparePartsAmount?: unknown;
  discountAmount?: unknown;
  coupon?: {
    valid?: boolean;
    discountType?: string;
    discountValue?: number;
    maxDiscount?: number;
    minOrderAmount?: number;
  } | null;
  /** Company commission % on service value (partner settlement). */
  platformFeePercent: unknown;
  /** Company commission % on additional services. */
  addonFeePercent: unknown;
  /** Company commission % on spare parts. Defaults to addonFeePercent. */
  sparePartCommissionPercent?: unknown;
  /** Customer-facing convenience/platform fee. */
  customerPlatformFeeType?: "fixed" | "percent" | string;
  customerPlatformFeeValue?: unknown;
  gstEnabled?: boolean;
  gstPercent: unknown;
  spareParts?: SparePartLine[];
};

export type FinanceSnapshot = {
  formulaVersion: "v1" | "v2";
  serviceAmount: number;
  visitingCharge: number;
  convenienceFee: number;
  addedServicesAmount: number;
  sparePartValue: number;
  grossAmount: number;
  discount: number;
  finalAmount: number;
  platformFeePercent: number;
  addonFeePercent: number;
  sparePartCommissionPercent: number;
  platformFeeType: "fixed" | "percent";
  platformFeeValue: number;
  /** Company commission on service (NOT the customer convenience fee). */
  platformFeeAmount: number;
  addonFeeAmount: number;
  sparePartFeeAmount: number;
  technicianServiceEarning: number;
  technicianAddonEarning: number;
  technicianSpareEarning: number;
  technicianFinalEarning: number;
  companyEarnings: number;
  gstEnabled: boolean;
  gstPercent: number;
  /** v2: GST applies only to convenience/platform fee. Historical v1 used full payable. */
  gstTaxableBase: "convenienceAndPlatformFee" | "inclusivePayable" | "none";
  taxableCompanyFee: number;
  taxableValue: number;
  gstAmount: number;
  gstCollectedOnCompanyFee: number;
  serviceGstAmount: number;
  additionalServiceGstAmount: number;
  sparePartGstAmount: number;
  discountOnService: number;
  discountOnCompanyFee: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  page1: InvoicePageBreakdown;
  page2: InvoicePageBreakdown;
  page3: InvoicePageBreakdown | null;
  spareParts: SparePartLine[];
  hasSpareParts: boolean;
  invoicePageCount: number;
  calculatedAt: string;
};
