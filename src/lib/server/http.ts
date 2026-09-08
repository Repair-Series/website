import { NextRequest, NextResponse } from "next/server";

const ALLOW_HEADERS =
  "Authorization, Content-Type, Accept, Origin, X-Requested-With";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

export function apiCorsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get("origin") || "";
  const requested = String(req.headers.get("access-control-request-headers") || "")
    .trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": requested
      ? `${ALLOW_HEADERS}, ${requested}`
      : ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function applyCorsHeaders(req: NextRequest, res: NextResponse) {
  const headers = apiCorsHeaders(req);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, String(value));
  }
  return res;
}

export function apiOptions(req: NextRequest) {
  return NextResponse.json({}, { headers: apiCorsHeaders(req) });
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
