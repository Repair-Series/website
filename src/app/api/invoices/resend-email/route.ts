import { NextRequest, NextResponse } from "next/server";
import { apiCorsHeaders, apiOptions, jsonWithCors } from "@/lib/api/cors";
import { publicErrorMessage } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const { handleResendEmailPost } = await import("./handler");
    return await handleResendEmailPost(req);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Failed to resend email");
    console.error("api/invoices/resend-email", String((err as Error)?.message || err));
    return jsonWithCors(req, { error: message }, { status });
  }
}

export function GET(req: NextRequest) {
  return NextResponse.json(
    { error: "POST method required" },
    { status: 405, headers: { ...apiCorsHeaders(req), Allow: "POST, OPTIONS" } },
  );
}
