import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { parseIndiaMobile } from "@/lib/auth/phone";
import { resolvePhoneIdentity } from "@/lib/server/phone-identity";
import { adminCredentialFailure } from "@/lib/server/auth";
import { verifyIdTokenWithApiKey } from "@/lib/server/userFirestore";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() || "";
    if (!token) {
      return jsonWithCors(req, { error: "Sign in required" }, { status: 401 });
    }

    let uid = "";
    let phoneClaim = "";
    let displayName = "";

    try {
      const decoded = await (await getAdminAuth()).verifyIdToken(token);
      uid = String(decoded.uid || "").trim();
      phoneClaim = String(decoded.phone_number || "").trim();
      displayName = String(decoded.name || "").trim();
    } catch (err) {
      if (!adminCredentialFailure(err)) {
        return jsonWithCors(req, { error: "Invalid or expired session" }, { status: 401 });
      }
      const fallback = await verifyIdTokenWithApiKey(token);
      uid = fallback.uid;
      phoneClaim = String(fallback.phoneNumber || "").trim();
      displayName = String(fallback.displayName || "").trim();
    }

    if (!uid) {
      return jsonWithCors(req, { error: "Invalid or expired session" }, { status: 401 });
    }

    const parsed = parseIndiaMobile(phoneClaim);
    if (!parsed.ok) {
      return jsonWithCors(
        req,
        { error: "This session is not a verified phone login." },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      role?: string;
      displayName?: string;
    };
    const role = body.role === "partner" ? "partner" : "customer";

    try {
      const result = await resolvePhoneIdentity({
        db: getAdminDb(),
        adminAuth: await getAdminAuth(),
        uid,
        phoneE164: parsed.e164,
        role,
        displayName: body.displayName || displayName,
      });
      return jsonWithCors(req, { ok: true, ...result });
    } catch (err) {
      if (!adminCredentialFailure(err) && Number((err as { status?: number })?.status) !== 503) {
        throw err;
      }
      // Token is verified. Profile merge/migration needs a working Admin SDK.
      // Clients create/update their own customer or partner profile.
      return jsonWithCors(req, {
        ok: true,
        uid,
        created: false,
        role,
        ...(role === "partner" ? { noPartnerRecord: true } : {}),
      });
    }
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Could not complete sign in");
    if (status >= 500) {
      console.error("api/auth/resolve-identity", {
        status,
        code: (err as { code?: string })?.code || "(none)",
        message: (err as Error)?.message || message,
      });
    }
    return jsonWithCors(req, { error: message }, { status });
  }
}
