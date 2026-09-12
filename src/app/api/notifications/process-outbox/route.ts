import { NextRequest } from "next/server";
import { apiOptions, jsonWithCors } from "@/lib/api/cors";
import { publicErrorMessage } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Admin-only retry for failed notification sends.
 * Booking events call /api/notifications/send immediately — no Vercel cron.
 */
export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const { handleProcessOutbox } = await import("./handler");
    return await handleProcessOutbox(req);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    return jsonWithCors(
      req,
      { error: publicErrorMessage(err, "Outbox process failed") },
      { status },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
