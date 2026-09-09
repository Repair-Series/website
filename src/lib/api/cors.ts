import { NextRequest, NextResponse } from "next/server";

const ALLOW_HEADERS =
  "Authorization, Content-Type, Accept, Origin, X-Requested-With";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

const STATIC_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://rpanel.repairseries.in",
  "https://www.repairseries.in",
  "https://repairseries.in",
];

function extraAllowedOrigins(): string[] {
  return String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  return STATIC_ALLOWED_ORIGINS.includes(origin) || extraAllowedOrigins().includes(origin);
}

export function apiCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const requested = String(req.headers.get("access-control-request-headers") || "").trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": requested
      ? `${ALLOW_HEADERS}, ${requested}`
      : ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function applyCorsHeaders(req: NextRequest, res: NextResponse) {
  const headers = apiCorsHeaders(req);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
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
