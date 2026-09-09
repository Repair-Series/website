import { NextRequest, NextResponse } from "next/server";
import { apiCorsHeaders, apiOptions, jsonWithCors } from "@/lib/api/cors";
import { publicErrorMessage } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: NextRequest) {
  console.info("[Invoice API] OPTIONS preflight received", {
    origin: req.headers.get("origin") || "",
  });
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  console.info("[Invoice API] Request received", {
    method: req.method,
    origin: req.headers.get("origin") || "",
  });
  try {
    const { handleGeneratePost } = await import("./handler");
    return await handleGeneratePost(req);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Failed to generate invoice");
    console.error("[Invoice API] generate failed", {
      status,
      message: String((err as Error)?.message || err),
    });
    return jsonWithCors(req, { error: message }, { status });
  }
}

export function GET(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      error: "This URL only accepts POST JSON with bookingId. Opening it in a browser is GET.",
    },
    { status: 405, headers: { ...apiCorsHeaders(req), Allow: "POST, OPTIONS" } },
  );
}
