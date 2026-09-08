import { doc, onSnapshot, type Firestore, type Unsubscribe } from "firebase/firestore";

export const FALLBACK_SUPPORT_EMAIL = "support@repairseries.com";
export const FALLBACK_SUPPORT_PHONE = "+911800000111";

export type AppPublicSettings = {
  supportEmail: string | null;
  supportPhone: string | null;
  aboutApp: string | null;
  customerTerms: string | null;
  customerPrivacyPolicy: string | null;
  partnerTerms: string | null;
  partnerPrivacyPolicy: string | null;
  customerTermsUpdatedAt: unknown;
  customerPrivacyUpdatedAt: unknown;
  partnerTermsUpdatedAt: unknown;
  partnerPrivacyUpdatedAt: unknown;
  updatedAt: unknown;
};

const EMPTY: AppPublicSettings = {
  supportEmail: null,
  supportPhone: null,
  aboutApp: null,
  customerTerms: null,
  customerPrivacyPolicy: null,
  partnerTerms: null,
  partnerPrivacyPolicy: null,
  customerTermsUpdatedAt: null,
  customerPrivacyUpdatedAt: null,
  partnerTermsUpdatedAt: null,
  partnerPrivacyUpdatedAt: null,
  updatedAt: null,
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function parseAppSettingsDoc(d: Record<string, unknown> | null | undefined): AppPublicSettings {
  const data = d && typeof d === "object" ? d : {};
  return {
    supportEmail: str(data.supportEmail ?? data.support_email),
    supportPhone: str(data.supportPhone ?? data.support_phone),
    aboutApp: str(data.aboutApp),
    customerTerms: str(data.customerTerms),
    customerPrivacyPolicy: str(data.customerPrivacyPolicy),
    partnerTerms: str(data.partnerTerms),
    partnerPrivacyPolicy: str(data.partnerPrivacyPolicy),
    customerTermsUpdatedAt: data.customerTermsUpdatedAt ?? null,
    customerPrivacyUpdatedAt: data.customerPrivacyUpdatedAt ?? null,
    partnerTermsUpdatedAt: data.partnerTermsUpdatedAt ?? null,
    partnerPrivacyUpdatedAt: data.partnerPrivacyUpdatedAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function formatLegalUpdatedAt(raw: unknown): string | null {
  try {
    const d =
      typeof (raw as { toDate?: () => Date })?.toDate === "function"
        ? (raw as { toDate: () => Date }).toDate()
        : raw instanceof Date
          ? raw
          : raw && typeof raw === "object" && "seconds" in raw
            ? new Date(Number((raw as { seconds: number }).seconds) * 1000)
            : raw
              ? new Date(raw as string | number)
              : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export type SupportSettings = {
  supportEmail: string | null;
  supportPhone: string | null;
};

/** Subscribe to `settings/app` (same document as the mobile apps). */
export function subscribeSupportSettings(
  db: Firestore,
  onNext: (data: AppPublicSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "settings", "app"),
    (snap) => {
      if (!snap.exists()) {
        onNext(EMPTY);
        return;
      }
      onNext(parseAppSettingsDoc(snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err),
  );
}
