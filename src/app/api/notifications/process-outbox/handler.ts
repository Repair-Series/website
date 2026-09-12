import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/api/cors";
import { requireAdminOrInternal, requireApiCaller } from "@/lib/server/auth";
import { processNotificationOutbox } from "@/lib/notifications/outbox";
import { publicErrorMessage } from "@/lib/server/http";

export async function handleProcessOutbox(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    requireAdminOrInternal(caller);
    const result = await processNotificationOutbox(25);
    return jsonWithCors(req, { success: true, ...result });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Outbox process failed");
    if (status >= 500) console.error("api/notifications/process-outbox", message);
    return jsonWithCors(req, { error: message }, { status });
  }
}
