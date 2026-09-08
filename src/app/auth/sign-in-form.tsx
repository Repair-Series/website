"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  AuthError,
  AuthField,
  AuthShell,
} from "@/components/auth/auth-shell";
import {
  clearAuthReturnUrl,
  getAuthReturnUrl,
} from "@/lib/booking/draft";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SEC, formatNationalInput, parseIndiaMobile } from "@/lib/auth/phone";
import {
  PHONE_RECAPTCHA_ID,
  clearPhoneVerifier,
  confirmCustomerOtp,
  preparePhoneRecaptcha,
  resolveCustomerIdentity,
  sendCustomerOtp,
} from "@/lib/firebase/auth-phone";
import { getDb } from "@/lib/firebase/firestore";
import { BlockedAccountError } from "@/lib/firebase/auth-actions";
import { getCustomerProfile, isCustomerBlocked } from "@/lib/firebase/customer";
import { getAuthClient } from "@/lib/firebase/auth";
import { signOut } from "firebase/auth";

type Step = "phone" | "otp";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useMemo(() => getDb(), []);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [created, setCreated] = useState(false);
  const [onLocalhost, setOnLocalhost] = useState(false);
  const [loopbackAuthUrl, setLoopbackAuthUrl] = useState("http://127.0.0.1:3000/auth");

  const returnUrl =
    searchParams.get("return") || getAuthReturnUrl() || "/dashboard/bookings";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    setOnLocalhost(host === "localhost");
    const port = window.location.port ? `:${window.location.port}` : "";
    setLoopbackAuthUrl(`http://127.0.0.1${port}${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    return () => {
      clearPhoneVerifier();
    };
  }, []);

  useEffect(() => {
    const auth = getAuthClient();
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && step === "phone") {
        router.replace(returnUrl);
      }
    });
    return () => unsub();
  }, [returnUrl, router, step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const finishLogin = async () => {
    if (!db) throw new Error("Firebase is not configured.");
    const resolved = await resolveCustomerIdentity(name);
    const auth = getAuthClient();
    const uid = auth?.currentUser?.uid;
    if (uid) {
      const customer = await getCustomerProfile(db, uid);
      if (isCustomerBlocked(customer)) {
        await signOut(auth!).catch(() => undefined);
        throw new BlockedAccountError();
      }
    }
    setCreated(Boolean(resolved.created));
    clearAuthReturnUrl();
    router.replace(returnUrl);
  };

  const onSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const parsed = parseIndiaMobile(phone);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setLoading(true);
    try {
      await sendCustomerOtp(parsed.national);
      setStep("otp");
      setCooldown(OTP_RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.replace(/\D/g, "").length !== OTP_LENGTH) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    try {
      await confirmCustomerOtp(otp);
      await finishLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === "phone" ? "Sign in" : "Verify OTP"}
      subtitle={
        step === "phone"
          ? "Enter your mobile number. We will send a one-time password."
          : `Enter the 6-digit code sent to +91 ${formatNationalInput(phone)}`
      }
    >
      {error ? <AuthError message={error} /> : null}

      {onLocalhost ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Firebase blocks real SMS OTP on <span className="font-semibold">localhost</span>.
          Test numbers still work here. For a real Indian number, open{" "}
          <a className="font-semibold underline" href={loopbackAuthUrl}>
            {loopbackAuthUrl}
          </a>{" "}
          after adding <span className="font-semibold">127.0.0.1</span> under
          Firebase Authentication → Settings → Authorized domains.
        </div>
      ) : null}

      {step === "phone" ? (
        <form onSubmit={onSendOtp} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0a0f1c]">
              Mobile number
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
              <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-[#0a0f1c]">
                +91
              </span>
              <input
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(ev) => setPhone(formatNationalInput(ev.target.value))}
                onFocus={() => {
                  void preparePhoneRecaptcha().catch(() => undefined);
                }}
                placeholder="9876543210"
                className="h-12 flex-1 px-3 text-base outline-none"
              />
            </div>
          </div>
          <AuthField
            label="Your name (new customers)"
            value={name}
            onChange={setName}
            placeholder="Optional"
            autoComplete="name"
          />
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
            {loading ? "Sending OTP..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="mt-6 space-y-4">
          <AuthField
            label="OTP"
            value={otp}
            onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, OTP_LENGTH))}
            placeholder="••••••"
            autoComplete="one-time-code"
          />
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
            {loading ? "Verifying OTP..." : "Verify & continue"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="font-medium text-[#64748b] hover:underline"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
                /* Keep the existing RecaptchaVerifier. Do not re-render it. */
              }}
            >
              Change number
            </button>
            <button
              type="button"
              className="font-medium text-[#f96316] disabled:opacity-50"
              disabled={loading || cooldown > 0}
              onClick={() => void onSendOtp()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
            </button>
          </div>
        </form>
      )}

      {/* Keep the verifier host mounted across phone/OTP steps. Never unmount mid-request. */}
      <div id={PHONE_RECAPTCHA_ID} className="mt-3 flex justify-center" />

      {created ? (
        <p className="mt-4 text-center text-xs text-[#64748b]">New customer profile created.</p>
      ) : null}

      <p className="mt-6 text-center text-sm text-[#64748b]">
        Same mobile number works on the Repair Series app.
      </p>
    </AuthShell>
  );
}
