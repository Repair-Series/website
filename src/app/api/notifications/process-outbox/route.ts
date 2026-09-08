import { NextRequest } from "next/server";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { requireApiCaller, requireAdminOrInternal } from "@/lib/server/auth";
import { processNotificationOutbox } from "@/lib/notifications/outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Admin-triggered drain of failed notification sends.
 * Not invoked by Vercel Cron. Booking events call /api/notifications/send immediately.
 */
export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

async function handle(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    requireAdminOrInternal(caller);
    const result = await processNotificationOutbox(25);
    return jsonWithCors(req, result);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Outbox process failed");
    if (status >= 500) console.error("api/notifications/process-outbox", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
