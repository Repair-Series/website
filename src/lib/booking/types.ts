export type BookingAddress = {
  city: string;
  lat: number;
  lng: number;
  line1: string;
  line2?: string;
  pincode: string;
  state: string;
  type: "Home" | "Office" | "Other";
};

export type BookingStatus =
  | "New"
  | "Pending"
  | "Assigned"
  | "InProgress"
  | "Completed"
  | "Cancelled";

export type ServiceDoc = {
  id: string;
  name?: string;
  title?: string;
  image?: string;
  imageUrl?: string;
  homeImage?: string;
  status?: string;
  previewStatus?: string;
  comingSoonCategory?: string;
  price?: number;
  amount?: number;
  visitingCharge?: number;
  description?: string;
  categoryId?: string;
  category_id?: string;
  slug?: string;
  duration?: string | number;
  keyPoints?: string[];
  processSteps?: Array<{
    title: string;
    description: string;
    image?: string | null;
  }>;
  additionalInfo?: string;
  hasVariations?: boolean;
  revisitPolicy?: {
    enabled?: boolean;
    type?: string;
    freeRevisitCount?: number;
    maxRevisitsInPeriod?: number;
    validityValue?: number;
    validityUnit?: string;
  };
  variations?: Array<{
    id: string;
    title?: string;
    name?: string;
    price: number;
    image?: string | null;
    imageUrl?: string | null;
    status?: string;
    rating?: number;
    originalPrice?: number;
    mrp?: number;
  }>;
};

export type BookingDraft = {
  serviceId: string;
  variationId?: string;
  address: import("@/lib/booking/address").AddressForm;
  dateKey: string;
  slotId: string;
  /** User App `scheduledSlotIndex` (1–10) — persisted for reliable validation after auth redirect. */
  slotIndex?: number;
  scheduledSlotLabel?: string;
};

export type BookingDoc = {
  id: string;
  customerId?: string;
  userId?: string;
  serviceId?: string;
  serviceName?: string;
  categoryId?: string;
  serviceCategoryId?: string;
  technicianId?: string | null;
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  address?: BookingAddress | string;
  bookingDate?: string;
  slot?: string;
  date?: string;
  time?: string;
  scheduledAt?: { toDate?: () => Date };
  scheduledSlotDate?: string;
  scheduledSlotIndex?: number;
  scheduledSlotLabel?: string;
  scheduleDateKey?: string;
  scheduleSlotIndex?: number;
  status?: string;
  amount?: number;
  visitingCharge?: number;
  totalAmount?: number;
  finalBookingAmount?: number;
  originalBookingAmount?: number;
  platformFeeAmount?: number;
  platformCommission?: number;
  bookingCode?: string;
  otp?: string | number;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicePdfUrl?: string;
  paymentRequest?: {
    status?: string;
    method?: string;
    amount?: number;
  };
  paymentStatus?: string;
  completionPhoto?: { url?: string };
  createdAt?: { toDate?: () => Date };
  assignedAt?: { toDate?: () => Date };
  serviceStartedAt?: { toDate?: () => Date };
  completedAt?: { toDate?: () => Date };
  arrivalVerified?: boolean;
  arrivalVerifiedAt?: { toDate?: () => Date };
  extrasApprovalRequest?: {
    status?: string;
    proposedAddOnServices?: Array<{ serviceName?: string; price?: number }>;
    proposedAdditionalServices?: Array<{ title?: string; price?: number; quantity?: number }>;
    replacementService?: {
      serviceId?: string;
      serviceName?: string;
      price?: number;
      previousServiceId?: string;
      previousServiceName?: string;
      previousPrice?: number;
    };
  };
  replacedService?: {
    serviceId?: string;
    serviceName?: string;
    price?: number;
  };
};

export type TechnicianDoc = {
  id: string;
  name?: string;
  categoryId?: string;
  categoryIds?: string[];
  serviceRadius?: number;
  suspended?: boolean;
  status?: string;
  shiftStatus?: string;
  accountStatus?: string;
  verificationStatus?: string;
  kyc?: { status?: string };
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  profilePhotoUrl?: string;
  rating?: number;
};
