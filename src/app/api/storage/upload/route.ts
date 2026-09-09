import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const requested = String(req.headers.get("access-control-request-headers") || "").trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": requested
      ? `Authorization, Content-Type, Accept, Origin, X-Requested-With, ${requested}`
      : "Authorization, Content-Type, Accept, Origin, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function configPresence() {
  return {
    cloudName: Boolean(String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()),
    apiKey: Boolean(String(process.env.CLOUDINARY_API_KEY || "").trim()),
    apiSecret: Boolean(String(process.env.CLOUDINARY_API_SECRET || "").trim()),
    firebaseAdmin: Boolean(String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim()),
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Lightweight probe: if this JSON is not returned, production is not running this file. */
export function GET(req: NextRequest) {
  return NextResponse.json(
    {
      route: "src/app/api/storage/upload/route.ts",
      error: "Use POST with multipart file + kind",
      env: configPresence(),
    },
    { status: 405, headers: corsHeaders(req) },
  );
}

export async function POST(req: NextRequest) {
  console.info("[Storage Upload] Request received");
  try {
    const { handleUploadPost } = await import("./post");
    return await handleUploadPost(req);
  } catch (err) {
    const message = String((err as Error)?.message || err);
    console.error("[Storage Upload] Upload failed", {
      message,
      stack: (err as Error)?.stack,
      env: configPresence(),
    });
    return NextResponse.json(
      { error: "Image upload failed", detail: message },
      { status: 500, headers: corsHeaders(req) },
    );
  }
}
