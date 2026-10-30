/** E96 [found later, my E53 check]: a negative or zero captured/refund amount
 *  must park the event, not push negative volume into the dashboards.
 *  The check runs before any query, so no DB is needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { PoisonEventError, applyEvent } from "./applyEvent.js";

const noDb = { query: async () => { throw new Error("must not reach the database"); } } as unknown as PoolClient;
const row = (event_type: string, payload: Record<string, unknown>) =>
  ({ id: 1n, txid: "1", event_type, payload, created_at: new Date() }) as unknown as Parameters<typeof applyEvent>[1];
const merchantId = "11111111-1111-4111-8111-111111111111";

test("testE96_negativeAmountsAreParked", async () => {
  for (const [type, field] of [["transaction.captured", "amountCapturedFils"], ["refund.succeeded", "amountFils"]] as const) {
    for (const bad of [-5, 0]) {
      await assert.rejects(applyEvent(noDb, row(type, { merchantId, [field]: bad })), PoisonEventError, `${type} ${field}=${bad}`);
    }
  }
});
