import type { Pool } from "pg";
import type { EventType } from "@filspay/events";
import { withTransaction } from "../db/withTransaction.js";
import type { ReportingConfig } from "../config.js";
import { readCursor, advanceCursor } from "./cursor.js";
import { applyEvent, PoisonEventError, type OutboxEventRow } from "./applyEvent.js";

export const REPORTING_EVENT_TYPES: readonly EventType[] = [
  "transaction.captured",
  "transaction.voided",
  "settlement.batch_closed",
  "refund.succeeded", // F01e: applyEvent has the matching case
  "settlement.paid", // E64: marks the payout trend row paid (applyEvent has the case)
];

/**
 * Keys this worker's row in reporting_outbox_cursor. Two processes using the
 * same name serialize on that row, so a catch-up run beside a live worker
 * cannot apply an event twice.
 */
export const CONSUMER_NAME = "reporting";

/**
 * The one function both the NOTIFY handler and the poll timer call.
 * Everything — the read of due outbox_events, every rollup
 * upsert `applyEvent` performs, and the watermark advance — happens inside
 * one `withTransaction` call: either the whole batch of up-to-
 * `consumerBatchLimit` events is applied *and* the watermark moves past all
 * of them, atomically, or (on any error) nothing in this pass is applied
 * and the watermark is untouched — the next pass simply re-selects the
 * identical event range and retries. This is the exact property that makes
 * the watermark alone sufficient for exactly-once application, with no
 * separate per-event dedup table the way webhook_deliveries needs one.
 *
 * The `SELECT` below is a plain, unlocked read — no row lock, no
 * `FOR UPDATE`, no mutation of any outbox_events column — identical
 * posture to webhooks/dispatcher.ts's Step A.
 */
export async function runConsumerPass(
  pool: Pool,
  config: Pick<ReportingConfig, "consumerBatchLimit">,
): Promise<{ processedCount: number }> {
  return withTransaction(pool, async (client) => {
    const cursor = await readCursor(client, CONSUMER_NAME);

    // MK 2026-06: ids come from a sequence, they're monotonic. fine for now.
    // E42: monotonic, but not in COMMIT order — a slow transaction could commit
    // a lower id after a higher one was processed, and `id > cursor` skipped it
    // forever. Read only events from transactions older than the oldest one
    // still running, in (txid, id) order; nothing can commit behind that.
    const eventsResult = await client.query<OutboxEventRow & { txid: string }>(
      `SELECT id, event_type, aggregate_id, payload, created_at, txid::text AS txid
         FROM outbox_events
        WHERE (txid, id) > ($1::xid8, $2::bigint)
          AND txid < pg_snapshot_xmin(pg_current_snapshot())
          AND event_type = ANY($3::text[])
        ORDER BY txid ASC, id ASC
        LIMIT $4`,
      [cursor.lastProcessedTxid, cursor.lastProcessedId.toString(), REPORTING_EVENT_TYPES, config.consumerBatchLimit],
    );

    let last: { id: bigint; txid: string } | null = null;
    for (const row of eventsResult.rows) {
      // E53: each event in its own savepoint. A data error (bad payload, or a
      // Postgres data/constraint error, SQLSTATE class 22/23) parks that one
      // event in reporting_dead_letters and the pass continues; any other
      // error (connection, deadlock) still rolls back the whole pass.
      await client.query("SAVEPOINT apply_event");
      try {
        await applyEvent(client, row);
        await client.query("RELEASE SAVEPOINT apply_event");
      } catch (err) {
        if (!isDataError(err)) throw err;
        await client.query("ROLLBACK TO SAVEPOINT apply_event");
        const message = describeParkError(err); // E98: codes and names, not values
        await client.query(
          `INSERT INTO reporting_dead_letters (outbox_event_id, consumer_name, event_type, error)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [row.id.toString(), CONSUMER_NAME, row.event_type, message.slice(0, 1000)],
        );
        console.warn(`[reporting] parked outbox event ${String(row.id)} (${row.event_type}): ${message}`);
      }
      last = { id: BigInt(row.id), txid: row.txid };
    }

    if (last) {
      await advanceCursor(client, CONSUMER_NAME, last.id, last.txid);
    }

    return { processedCount: eventsResult.rows.length };
  });
}

/** E53: bad data, not a broken database. */
/**
 * E98: what to store and log for a parked event. A Postgres message can echo
 * the input value (22P02 'invalid input syntax …: "<value>"'), so for a
 * Postgres error keep only the SQLSTATE and the names Postgres reports.
 * Our own PoisonEventError messages name the field, never its value.
 */
export function describeParkError(err: unknown): string {
  if (err instanceof PoisonEventError) return err.message.slice(0, 1000);
  const e = (err ?? {}) as { code?: unknown; table?: unknown; column?: unknown; constraint?: unknown };
  const parts = [`SQLSTATE ${typeof e.code === "string" ? e.code : "unknown"}`];
  for (const k of ["table", "column", "constraint"] as const) {
    if (typeof e[k] === "string" && e[k]) parts.push(`${k}=${e[k] as string}`);
  }
  return parts.join(" ");
}

function isDataError(err: unknown): boolean {
  if (err instanceof PoisonEventError) return true;
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && (code.startsWith("22") || code.startsWith("23"));
}
