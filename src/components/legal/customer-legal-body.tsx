"use client";

import { useAppSettings } from "@/context/app-settings-context";

const FALLBACK =
  "By using Repair Series, you agree to follow our terms of service. The platform connects you with partners for home services, and all bookings are subject to availability and confirmation.";

export function CustomerLegalBody({
  kind,
}: {
  kind: "terms" | "privacy";
}) {
  const settings = useAppSettings();
  const body =
    kind === "terms"
      ? settings.customerTerms || FALLBACK
      : settings.customerPrivacyPolicy ||
        "Repair Series is committed to protecting your privacy. We collect account and booking details only as needed to deliver services.";
  const stamp =
    kind === "terms"
      ? settings.formatLegalUpdatedAt(settings.customerTermsUpdatedAt || settings.updatedAt)
      : settings.formatLegalUpdatedAt(settings.customerPrivacyUpdatedAt || settings.updatedAt);

  return (
    <div className="mt-6 max-w-3xl">
      {stamp ? (
        <p className="mb-4 text-sm text-muted-foreground">Updated at: {stamp}</p>
      ) : null}
      <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#334155]">{body}</div>
    </div>
  );
}
