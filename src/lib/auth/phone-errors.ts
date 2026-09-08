import { FirebaseError } from "firebase/app";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, nested) => {
      if (typeof nested === "bigint") return String(nested);
      if (nested instanceof Error) {
        return {
          name: nested.name,
          message: nested.message,
          stack: nested.stack,
        };
      }
      return nested;
    });
  } catch {
    return String(value);
  }
}

function identityToolkitFromCustomData(customData: unknown): {
  status?: number;
  message?: string;
  errors?: unknown;
  raw?: unknown;
} {
  const data = asRecord(customData);
  if (!data) return {};
  const server =
    asRecord(data._serverResponse) ||
    asRecord(data.serverResponse) ||
    asRecord(data._serverError) ||
    null;
  if (!server) return { raw: customData };
  const nestedError = asRecord(server.error);
  const message =
    (typeof nestedError?.message === "string" && nestedError.message) ||
    (typeof server.message === "string" && server.message) ||
    undefined;
  const status =
    typeof nestedError?.code === "number"
      ? nestedError.code
      : typeof server.code === "number"
        ? server.code
        : undefined;
  return {
    status,
    message,
    errors: nestedError?.errors ?? server.errors,
    raw: server,
  };
}

export function serializePhoneAuthError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { raw: String(error) };
  }
  const e = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    customData?: unknown;
    cause?: unknown;
  };
  const toolkit = identityToolkitFromCustomData(e.customData);
  const toJSON = (error as { toJSON?: () => unknown }).toJSON;
  const firebaseJson =
    error instanceof FirebaseError && typeof toJSON === "function"
      ? toJSON.call(error)
      : undefined;

  return {
    code: e.code != null ? String(e.code) : "(none)",
    message: e.message != null ? String(e.message) : "",
    name: e.name != null ? String(e.name) : "",
    customData: e.customData,
    identityToolkitMessage: toolkit.message || null,
    identityToolkitStatus: toolkit.status || null,
    identityToolkitErrors: toolkit.errors || null,
    identityToolkitResponse: toolkit.raw || null,
    cause:
      e.cause instanceof Error
        ? { name: e.cause.name, message: e.cause.message }
        : e.cause ?? null,
    firebaseJson: firebaseJson || null,
  };
}

export function inspectPhoneAuthError(error: unknown): { code: string; message: string } {
  const serialized = serializePhoneAuthError(error);
  return {
    code: String(serialized.code || ""),
    message: String(serialized.identityToolkitMessage || serialized.message || ""),
  };
}

export function formatPhoneAuthDebugLine(error: unknown): string {
  const serialized = serializePhoneAuthError(error);
  const toolkit = serialized.identityToolkitMessage
    ? String(serialized.identityToolkitMessage)
    : "";
  return [
    `[Firebase debug] code=${serialized.code}`,
    `message=${serialized.message || "(empty)"}`,
    toolkit ? `identityToolkit.message=${toolkit}` : null,
    serialized.identityToolkitStatus
      ? `identityToolkit.status=${serialized.identityToolkitStatus}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function logPhoneOtpFailure(
  error: unknown,
  extra: Record<string, unknown> = {},
): { code: string; message: string } {
  const serialized = serializePhoneAuthError(error);
  const payload = {
    ...serialized,
    environment: process.env.NODE_ENV,
    ...extra,
  };
  console.error("OTP authentication failed " + safeJson(payload));
  return {
    code: String(serialized.code || ""),
    message: String(serialized.identityToolkitMessage || serialized.message || ""),
  };
}

export function toPhoneAuthUserError(error: unknown): Error {
  const mapped = mapPhoneAuthError(error);
  const debug = formatPhoneAuthDebugLine(error);
  const serialized = serializePhoneAuthError(error);
  return Object.assign(new Error(`${mapped}\n${debug}`), {
    name: "PhoneAuthError",
    code: serialized.code,
    customData: serialized.customData,
    identityToolkitMessage: serialized.identityToolkitMessage,
  });
}

export function mapPhoneAuthError(error: unknown): string {
  const { code, message } = inspectPhoneAuthError(error);
  const blob = `${code} ${message}`.toUpperCase();

  if (code === "auth/invalid-phone-number" || blob.includes("INVALID_PHONE_NUMBER")) {
    return "Invalid phone number.";
  }
  if (code === "auth/missing-phone-number") {
    return "Enter your mobile number.";
  }
  if (
    code === "auth/quota-exceeded" ||
    code === "auth/too-many-requests" ||
    blob.includes("TOO_MANY_ATTEMPTS_TRY_LATER")
  ) {
    return "Too many OTP requests. Please wait and try again.";
  }
  if (
    code === "auth/invalid-app-credential" ||
    blob.includes("INVALID_APP_CREDENTIAL")
  ) {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "";
    if (host === "localhost") {
      const port = typeof window !== "undefined" ? window.location.port || "3000" : "3000";
      const path = typeof window !== "undefined" ? window.location.pathname : "/auth";
      return `Real SMS OTP is blocked on localhost (auth/invalid-app-credential). Open http://127.0.0.1:${port}${path} after adding 127.0.0.1 to Firebase Authorized domains. Test numbers still work here.`;
    }
    return "App verification failed (auth/invalid-app-credential). Confirm this domain is in Firebase Authorized domains, then refresh and try once.";
  }
  if (
    code === "auth/captcha-check-failed" ||
    blob.includes("CAPTCHA_CHECK_FAILED") ||
    blob.includes("MISSING_CLIENT_IDENTIFIER") ||
    blob.includes("MISSING CLIENT IDENTIFIER")
  ) {
    return "Verification check failed. Refresh the page and try again.";
  }
  if (code === "auth/invalid-verification-code" || code === "auth/invalid-verification-id") {
    return "Invalid OTP. Please check the code and try again.";
  }
  if (code === "auth/code-expired" || code === "auth/session-expired") {
    return "This OTP has expired. Request a new code.";
  }
  if (code === "auth/missing-verification-code") {
    return "Enter the 6-digit OTP.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and try again.";
  }
  if (code === "auth/user-disabled") {
    return "This account has been disabled. Contact support.";
  }
  if (
    code === "auth/billing-not-enabled" ||
    blob.includes("BILLING_NOT_ENABLED") ||
    blob.includes("BILLING NOT ENABLED")
  ) {
    return "Real SMS OTP requires Firebase Blaze billing. Test phone numbers still work without SMS.";
  }
  if (code === "auth/operation-not-allowed" || blob.includes("OPERATION_NOT_ALLOWED")) {
    return "Phone login is not enabled. Please contact support.";
  }
  if (code === "auth/app-not-authorized" || blob.includes("APP_NOT_AUTHORIZED")) {
    return "This app is not authorized for phone login. Please contact support.";
  }
  if (/already been rendered/i.test(message)) {
    return "Verification check failed. Refresh the page and try again.";
  }
  if (/blocked|suspended|pending/i.test(message)) return message;
  return "Authentication failed. Please try again.";
}
