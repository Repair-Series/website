import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { parseIndiaMobile } from "@/lib/auth/phone";
import { resolvePhoneIdentity } from "@/lib/server/phone-identity";

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

    const adminAuth = await getAdminAuth();
    let decoded: { uid: string; phone_number?: string; name?: string };
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return jsonWithCors(req, { error: "Invalid or expired session" }, { status: 401 });
    }

    const phoneClaim = String(decoded.phone_number || "").trim();
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

    const result = await resolvePhoneIdentity({
      db: getAdminDb(),
      adminAuth,
      uid: decoded.uid,
      phoneE164: parsed.e164,
      role,
      displayName: body.displayName || decoded.name,
    });

    return jsonWithCors(req, { ok: true, ...result });
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
