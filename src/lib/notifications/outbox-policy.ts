export const MAX_OUTBOX_ATTEMPTS = 5;

export function shouldAbandonOutboxItem(attemptCount: unknown): boolean {
  return Number(attemptCount || 0) >= MAX_OUTBOX_ATTEMPTS;
}
