import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS for /api/* must live here with no shared imports.
 * Next.js 16 Proxy cannot depend on app modules; that crash is what made
 * production serve the HTML 500 page (no Access-Control-Allow-Origin).
 */
const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Origin, X-Requested-With",
  "Access-Control-Max-Age": "86400",
} as const;

function withCors(request: NextRequest, extra?: Record<string, string>) {
  const origin = request.headers.get("origin") || "";
  const requested = String(
    request.headers.get("access-control-request-headers") || "",
  ).trim();
  return {
    ...CORS,
    ...(requested
      ? { "Access-Control-Allow-Headers": `${CORS["Access-Control-Allow-Headers"]}, ${requested}` }
      : {}),
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    Vary: "Origin, Access-Control-Request-Headers",
    ...extra,
  };
}

export function proxy(request: NextRequest) {
  try {
    const headers = withCors(request);
    if (request.method === "OPTIONS") {
      return NextResponse.json({}, { headers });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  } catch {
    const origin = request.headers.get("origin") || "*";
    return NextResponse.json(
      {},
      {
        headers: {
          "Access-Control-Allow-Origin": origin,
          ...CORS,
        },
      },
    );
  }
}

export const config = {
  matcher: "/api/:path*",
};
