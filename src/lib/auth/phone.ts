/**
 * India-only customer/partner login numbers.
 * The product is India-only (INR, Indian service areas). Auth uses E.164 +91.
 */

export const INDIA_DIAL_CODE = "+91";
export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SEC = 60;

export type PhoneParseResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; error: string };

export function digitsOnly(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "");
}

export function parseIndiaMobile(raw: unknown): PhoneParseResult {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { ok: false, error: "Enter your mobile number." };

  let digits = digitsOnly(trimmed);
  if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);

  if (digits.length < 10) return { ok: false, error: "Mobile number is too short." };
  if (digits.length > 10) return { ok: false, error: "Mobile number is too long." };
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { ok: false, error: "Enter a valid Indian mobile number." };
  }

  return { ok: true, e164: `${INDIA_DIAL_CODE}${digits}`, national: digits };
}

export function normalizeStoredPhone(raw: unknown): string {
  const parsed = parseIndiaMobile(raw);
  return parsed.ok ? parsed.e164 : "";
}

export function phoneLookupValues(e164: string): string[] {
  const parsed = parseIndiaMobile(e164);
  if (!parsed.ok) return [e164];
  return [
    parsed.e164,
    parsed.national,
    `91${parsed.national}`,
    `0${parsed.national}`,
    `+91 ${parsed.national}`,
    `+91-${parsed.national}`,
  ];
}

export function formatNationalInput(raw: string): string {
  return digitsOnly(raw).slice(0, 10);
}
