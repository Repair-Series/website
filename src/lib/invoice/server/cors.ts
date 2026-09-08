import { NextRequest, NextResponse } from "next/server";

const ALLOW_HEADERS = "Authorization, Content-Type";
const ALLOW_METHODS = "GET, POST, OPTIONS";

export function invoiceCorsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function invoiceOptions(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: invoiceCorsHeaders(req),
  });
}

export function jsonWithCors(
  req: NextRequest,
  body: unknown,
  init?: { status?: number },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: invoiceCorsHeaders(req),
  });
}
