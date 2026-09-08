import { NextRequest, NextResponse } from "next/server";

const ALLOW_HEADERS = "Authorization, Content-Type, X-Vercel-Cron";
const ALLOW_METHODS = "GET, POST, DELETE, OPTIONS";

export function apiCorsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function apiOptions(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: apiCorsHeaders(req),
  });
}

export function jsonWithCors(
  req: NextRequest,
  body: unknown,
  init?: { status?: number },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: apiCorsHeaders(req),
  });
}

export function publicErrorMessage(err: unknown, fallback: string): string {
  const status = Number((err as { status?: number })?.status) || 0;
  const message = String((err as Error)?.message || fallback);
  if (status >= 400 && status < 500) return message;
  if (
    /sign in|not allowed|unauthorized|invalid|missing|not found|pending|already/i.test(
      message,
    )
  ) {
    return message;
  }
  return fallback;
}
