"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDb } from "@/lib/firebase/firestore";
import {
  FALLBACK_SUPPORT_EMAIL,
  formatLegalUpdatedAt,
  subscribeSupportSettings,
  type AppPublicSettings,
} from "@/lib/support/settings";

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

type Value = AppPublicSettings & {
  loading: boolean;
  resolvedSupportEmail: string;
  resolvedSupportPhone: string | null;
  formatLegalUpdatedAt: typeof formatLegalUpdatedAt;
};

const AppSettingsContext = createContext<Value | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppPublicSettings>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      return undefined;
    }
    return subscribeSupportSettings(
      db,
      (next) => {
        setSettings(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const value = useMemo<Value>(
    () => ({
      ...settings,
      loading,
      resolvedSupportEmail: settings.supportEmail || FALLBACK_SUPPORT_EMAIL,
      resolvedSupportPhone: settings.supportPhone,
      formatLegalUpdatedAt,
    }),
    [settings, loading],
  );

  return (
    <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
