/**
 * apps/reporting's own configuration, loaded once from environment
 * variables at boot — same loadConfig-throws-at-boot posture as
 * apps/api's, but only the fields this worker
 * actually needs. This worker never serves HTTP, so it has no port,
 * session, or auth-related config at all.
 */
export interface ReportingConfig {
  databaseUrl: string;
  pgPoolMax: number;
  /** How often the consumer's poll-fallback timer runs a pass, independent
   *  of LISTEN/NOTIFY. Default 15_000ms — longer than webhooks' 5_000ms
   *  default, deliberately: a missed analytics notification only ever
   *  means a dashboard number is a few extra seconds later to update. */
  reportingPollIntervalMs: number;
  /** Max outbox rows read per runConsumerPass call — matches webhooks'
   *  Step A cap. */
  consumerBatchLimit: number;
}

/**
 * E97: the old comment said Number.parseInt rejects "15s"; it does not (it
 * returns 15). Only plain digits are accepted, inside [min, max].
 */
function parseIntEnv(name: string, value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`loadConfig: ${name} must be a whole number, got "${value}"`);
  }
  const parsed = Number(value.trim());
  if (parsed < min || parsed > max) {
    throw new Error(`loadConfig: ${name} must be between ${min} and ${max}, got ${parsed}`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ReportingConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("loadConfig: DATABASE_URL environment variable is not set");
  }

  return {
    databaseUrl,
    // FH: PG_POOL_MAX is the same name apps/api reads -- setting it in compose changes both. intended?
    pgPoolMax: parseIntEnv("PG_POOL_MAX", env.PG_POOL_MAX, 5, 1, 100),
    // MK: 15s fine. dashboards aren't realtime.
    reportingPollIntervalMs: parseIntEnv("REPORTING_POLL_INTERVAL_MS", env.REPORTING_POLL_INTERVAL_MS, 15_000, 100, 3_600_000),
    consumerBatchLimit: parseIntEnv("REPORTING_CONSUMER_BATCH_LIMIT", env.REPORTING_CONSUMER_BATCH_LIMIT, 500, 1, 10_000),
  };
}
