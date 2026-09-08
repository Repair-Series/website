"use client";

import {
  RecaptchaVerifier,
  signInWithCustomToken,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { getAuthClient } from "@/lib/firebase/auth";
import { logPhoneOtpFailure, toPhoneAuthUserError } from "@/lib/auth/phone-errors";
import { parseIndiaMobile } from "@/lib/auth/phone";

export const PHONE_RECAPTCHA_ID = "rs-phone-recaptcha";

let verifier: RecaptchaVerifier | null = null;
let preparePromise: Promise<RecaptchaVerifier> | null = null;
let confirmation: ConfirmationResult | null = null;
let sendInFlight = false;

function requireBrowser() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Phone login is only available in the browser.");
  }
}

function recaptchaHost() {
  const host = document.getElementById(PHONE_RECAPTCHA_ID);
  if (!host) {
    throw new Error("Security check is not ready. Refresh the page and try again.");
  }
  return host;
}

function hostStillHoldsVerifier() {
  const host = document.getElementById(PHONE_RECAPTCHA_ID);
  return Boolean(verifier && host && host.childElementCount > 0);
}

function resetHost() {
  const host = document.getElementById(PHONE_RECAPTCHA_ID);
  if (host) host.replaceChildren();
}

async function createVerifier() {
  const auth = getAuthClient();
  if (!auth) throw new Error("Firebase Auth is not configured.");
  recaptchaHost();
  resetHost();
  const next = new RecaptchaVerifier(auth, PHONE_RECAPTCHA_ID, { size: "invisible" });
  verifier = next;
  await next.render();
  return next;
}

export async function preparePhoneRecaptcha(): Promise<RecaptchaVerifier> {
  requireBrowser();
  if (hostStillHoldsVerifier()) return verifier!;
  if (verifier && !hostStillHoldsVerifier()) {
    try {
      verifier.clear();
    } catch {
      /* detached */
    }
    verifier = null;
  }
  if (preparePromise) return preparePromise;

  preparePromise = createVerifier();
  try {
    return await preparePromise;
  } catch (error) {
    preparePromise = null;
    const message = error instanceof Error ? error.message : String(error);
    if (/already been rendered/i.test(message)) {
      try {
        verifier?.clear();
      } catch {
        /* ignore */
      }
      verifier = null;
      resetHost();
      preparePromise = createVerifier();
      try {
        return await preparePromise;
      } catch (retryError) {
        preparePromise = null;
        throw retryError;
      }
    }
    throw error;
  }
}

export function clearPhoneVerifier() {
  if (sendInFlight) return;
  try {
    verifier?.clear();
  } catch {
    /* ignore */
  }
  verifier = null;
  preparePromise = null;
  confirmation = null;
  resetHost();
}

export async function sendCustomerOtp(rawPhone: string) {
  if (sendInFlight) {
    throw new Error("Sending OTP...");
  }
  const parsed = parseIndiaMobile(rawPhone);
  if (!parsed.ok) throw new Error(parsed.error);
  if (!parsed.e164.startsWith("+")) {
    throw new Error("Invalid phone number.");
  }

  const auth = getAuthClient();
  if (!auth) throw new Error("Firebase Auth is not configured.");

  sendInFlight = true;
  try {
    const appVerifier = await preparePhoneRecaptcha();
    confirmation = await signInWithPhoneNumber(auth, parsed.e164, appVerifier);
    return { e164: parsed.e164 };
  } catch (error) {
    logPhoneOtpFailure(error, {
      hasVerifier: Boolean(verifier),
      e164Length: parsed.e164.length,
      e164Prefix: parsed.e164.slice(0, 3),
      hostname: typeof window !== "undefined" ? window.location.hostname : "",
    });
    confirmation = null;
    /* Token is consumed after a failed send. Recreate on the next user click. Do not auto-retry. */
    try {
      verifier?.clear();
    } catch {
      /* ignore */
    }
    verifier = null;
    preparePromise = null;
    resetHost();
    throw toPhoneAuthUserError(error);
  } finally {
    sendInFlight = false;
  }
}

export async function confirmCustomerOtp(code: string) {
  const otp = String(code || "").replace(/\D/g, "");
  if (otp.length !== 6) throw new Error("Enter the 6-digit OTP.");
  if (!confirmation) throw new Error("Request a new OTP first.");
  try {
    const cred = await confirmation.confirm(otp);
    return cred.user;
  } catch (error) {
    logPhoneOtpFailure(error, { stage: "confirm" });
    throw toPhoneAuthUserError(error);
  }
}

export async function resolveCustomerIdentity(displayName?: string) {
  const auth = getAuthClient();
  if (!auth?.currentUser) throw new Error("Sign in required");
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/auth/resolve-identity", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "customer", displayName: displayName || "" }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    customToken?: string;
    blocked?: boolean;
    created?: boolean;
    migrated?: boolean;
    uid?: string;
  };
  if (!res.ok) {
    await signOut(auth).catch(() => undefined);
    throw new Error(payload.error || "Could not complete sign in.");
  }
  if (payload.customToken) {
    await signInWithCustomToken(auth, payload.customToken);
  }
  return payload;
}
