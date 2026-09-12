import { NextRequest, NextResponse } from "next/server";
import { apiCorsHeaders, apiOptions, jsonWithCors } from "@/lib/api/cors";

export { apiCorsHeaders, apiOptions, jsonWithCors };

export function applyCorsHeaders(req: NextRequest, res: NextResponse) {
  const headers = apiCorsHeaders(req);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

export function publicErrorMessage(err: unknown, fallback: string): string {
  const status = Number((err as { status?: number })?.status) || 0;
  const message = String((err as Error)?.message || fallback);
  if (status >= 400 && status !== 500) return message;
  if (
    /sign in|not allowed|unauthorized|invalid|missing|not found|pending|already|cloudinary|configured/i.test(
      message,
    )
  ) {
    return message;
  }
  return fallback;
}
