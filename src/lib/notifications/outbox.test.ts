import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_OUTBOX_ATTEMPTS, shouldAbandonOutboxItem } from "./outbox-policy";

describe("notification outbox retries", () => {
  it("keeps retrying under the attempt cap", () => {
    assert.equal(shouldAbandonOutboxItem(0), false);
    assert.equal(shouldAbandonOutboxItem(MAX_OUTBOX_ATTEMPTS - 1), false);
  });

  it("abandons after the max attempt count so retries cannot loop forever", () => {
    assert.equal(shouldAbandonOutboxItem(MAX_OUTBOX_ATTEMPTS), true);
    assert.equal(shouldAbandonOutboxItem(MAX_OUTBOX_ATTEMPTS + 3), true);
  });
});
