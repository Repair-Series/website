import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS preflight only. Do not call NextResponse.next() on API POSTs —
 * in Next.js 16 that sends /api/* through the page renderer (HTML 500).
 */
const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Origin, X-Requested-With",
  "Access-Control-Max-Age": "86400",
} as const;

function preflightHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const requested = String(
    request.headers.get("access-control-request-headers") || "",
  ).trim();
  return {
    ...CORS,
    ...(requested
      ? {
          "Access-Control-Allow-Headers": `${CORS["Access-Control-Allow-Headers"]}, ${requested}`,
        }
      : {}),
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

export function proxy(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: preflightHeaders(request),
  });
}

export const config = {
  matcher: [
    {
      source: "/api/:path*",
      has: [{ type: "header", key: "access-control-request-method" }],
    },
  ],
};
