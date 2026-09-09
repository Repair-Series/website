import { NextRequest, NextResponse } from "next/server";
import { apiCorsHeaders, apiOptions, jsonWithCors } from "@/lib/api/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function configPresence() {
  return {
    cloudName: Boolean(String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()),
    apiKey: Boolean(String(process.env.CLOUDINARY_API_KEY || "").trim()),
    apiSecret: Boolean(String(process.env.CLOUDINARY_API_SECRET || "").trim()),
    firebaseAdmin: Boolean(String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim()),
  };
}

function methodNotAllowed(req: NextRequest) {
  console.info("[Storage API] Request received");
  console.info("[Storage API] Method:", req.method);
  console.info("[Storage API] Origin:", req.headers.get("origin") || "(none)");
  return NextResponse.json(
    {
      route: "src/app/api/storage/upload/route.ts",
      error: "POST method required",
    },
    {
      status: 405,
      headers: {
        ...apiCorsHeaders(req),
        Allow: "POST, OPTIONS",
      },
    },
  );
}

export function OPTIONS(req: NextRequest) {
  console.info("[Storage API] OPTIONS preflight received", {
    origin: req.headers.get("origin") || "",
  });
  return apiOptions(req);
}

export function GET(req: NextRequest) {
  return methodNotAllowed(req);
}

export function HEAD(req: NextRequest) {
  return new NextResponse(null, {
    status: 405,
    headers: { ...apiCorsHeaders(req), Allow: "POST, OPTIONS" },
  });
}

export function PUT(req: NextRequest) {
  return methodNotAllowed(req);
}

export function PATCH(req: NextRequest) {
  return methodNotAllowed(req);
}

export function DELETE(req: NextRequest) {
  return methodNotAllowed(req);
}

export async function POST(req: NextRequest) {
  console.info("[Storage API] Request received");
  console.info("[Storage API] Method:", req.method);
  console.info("[Storage API] Origin:", req.headers.get("origin") || "(none)");
  console.info("[Storage API] Content type:", req.headers.get("content-type") || "(none)");
  try {
    const { handleUploadPost } = await import("./post");
    return await handleUploadPost(req);
  } catch (err) {
    const message = String((err as Error)?.message || err);
    console.error("[Storage API] Upload failed", {
      message,
      stack: (err as Error)?.stack,
      env: configPresence(),
    });
    return jsonWithCors(
      req,
      { error: "Image upload failed", detail: message },
      { status: 500 },
    );
  }
}
