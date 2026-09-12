import { NextRequest, NextResponse } from "next/server";
import { apiCorsHeaders, apiOptions, jsonWithCors } from "@/lib/api/cors";
import { publicErrorMessage } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const { handleNotifyPost } = await import("./handler");
    return await handleNotifyPost(req);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    return jsonWithCors(
      req,
      { error: publicErrorMessage(err, "Notification failed") },
      { status },
    );
  }
}

export function GET(req: NextRequest) {
  return NextResponse.json(
    { error: "POST method required" },
    { status: 405, headers: { ...apiCorsHeaders(req), Allow: "POST, OPTIONS" } },
  );
}
