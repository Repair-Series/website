"use client";

import { useAppSettings } from "@/context/app-settings-context";

export function ContactDetails() {
  const { resolvedSupportEmail, resolvedSupportPhone, loading } = useAppSettings();

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">Call support</div>
        {loading && !resolvedSupportPhone ? (
          <div className="mt-2 h-6 w-44 animate-pulse rounded bg-muted" />
        ) : resolvedSupportPhone ? (
          <a href={`tel:${resolvedSupportPhone}`} className="mt-2 block text-lg font-semibold text-[#0a0f1c]">
            {resolvedSupportPhone}
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Phone will appear once admin adds it.</p>
        )}
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">Email support</div>
        {loading && !resolvedSupportEmail ? (
          <div className="mt-2 h-6 w-56 animate-pulse rounded bg-muted" />
        ) : (
          <a
            href={`mailto:${resolvedSupportEmail}`}
            className="mt-2 block text-lg font-semibold text-[#0a0f1c]"
          >
            {resolvedSupportEmail}
          </a>
        )}
      </div>
    </div>
  );
}
