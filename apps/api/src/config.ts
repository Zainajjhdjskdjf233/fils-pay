import { createHash } from "node:crypto";
/**
 * App-wide configuration, loaded once from environment variables at boot.
 * `loadConfig` throws synchronously — crashing boot rather than serving
 * traffic in a half-configured state — if `DATABASE_URL` is missing, or if
 * `SETTLEMENT_INTERNAL_TOKEN` is missing while `nodeEnv === 'production'`.
 *
 * Later sub-phases add their own fields to this same interface/loader
 * rather than introducing a second config system.
 */
export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;

  pgPoolMax: number;
  /** E117: OTP guesses allowed per user across all codes in the window, then login is refused. */
  otpUserMaxAttemptsPerWindow: number;
  otpUserWindowMinutes: number;
  /** E146: login/signup calls per client IP per minute; 0 = off (default off only in NODE_ENV=test). */
  authRateLimitPerMinute: number;
  /** Load shedding: requests handled at once before new ones get 503. */
  maxInFlightRequests: number;
  /** Load shedding: event-loop p99 delay (ms) above which new requests get 503; 0 = off. */
  shedEventLoopDelayMs: number;
  /** Fastify log level ("info" logs every request; use "warn" under load). */
  logLevel: string;
  pgPoolMin: number;
  pgPoolIdleTimeoutMs: number;
  pgPoolConnectionTimeoutMs: number;

  sessionTtlHours: number;
  pendingSessionTtlMinutes: number;
  otpTtlMinutes: number;
  otpCodeLength: number;
  otpMaxAttempts: number;
  otpDevExpose: boolean;

  argon2MemoryKib: number;
  argon2TimeCost: number;
  argon2Parallelism: number;

  kycUploadDir: string;
  kycMaxFileSizeBytes: number;

  acquirerLatencyMinMs: number;
  acquirerLatencyMaxMs: number;
  acquirerFailureRate: number;
  acquirerRngSeed: number | null;

  cookieName: string;
  cookieSecure: boolean;

  /** Cookie carrying an `admin_sessions` token. A completely separate name,
   *  table, and code path from `cookieName`/`sessions` — `requireAdminSession`
   *  reads only this one and `requireMerchantAuth` never reads it at all, so
   *  an admin session can never be resolved as merchant authority. */
  adminCookieName: string;
  /** Deliberately shorter than a merchant session's 12h — a minor extra
   *  caution for the higher-privilege plane. */
  adminSessionTtlHours: number;
  adminPendingSessionTtlMinutes: number;
  adminOtpTtlMinutes: number;
  adminOtpCodeLength: number;
  adminOtpMaxAttempts: number;

  /** Cookie carrying an `admin_impersonation_grants` token — the third,
   *  distinct cookie in the system. Read only by `requireMerchantAuth`, and
   *  never by `requireAdminSession`: the privilege drop is structural, not a
   *  flag that could fail to be cleared. */
  impersonationCookieName: string;
  /** Bounded lifetime of a "view as merchant" grant. Checked on every
   *  lookup — there is no "until logout" path. */
  impersonationTtlMinutes: number;

  /** Base URL of apps/settlement's internal HTTP server, reachable only
   *  inside the compose network. The API delegates settlement operations
   *  (batch runs, balance refreshes) through this. */
  settlementInternalUrl: string;
  /** Bearer token for that internal server. Required in production, same
   *  posture the retired `internalApiToken` had. */
  settlementInternalToken: string;
  /** Timeout for an internal settlement call. Generous on purpose: a full
   *  daily batch across every merchant genuinely takes longer than a typical
   *  API-latency budget. */
  settlementInternalRequestTimeoutMs: number;

  /** Base URL of apps/web's hosted checkout, used only to build the
   *  convenience `url` field on a created payment link — the API itself
   *  has no other reason to know where apps/web is hosted, and no route
   *  redirects there. Default matches Vite's own default dev port. */
  checkoutBaseUrl: string;
  /** How long a payment link stays 'reserved' (claimed by an in-flight pay
   *  attempt) before it self-expires back to claimable, closing the gap
   *  between claim and finalize without a sweep job. */
  paymentLinkReservationTimeoutSeconds: number;

  /** Base64-encoded 32 raw bytes, the single application-level AES-256-GCM
   *  key `webhooks/secretCrypto.ts` uses to encrypt/decrypt
   *  `webhook_endpoints.secret_ciphertext`. Required in every environment
   *  (not just production) — the platform must be able to actually encrypt
   *  and later recover a webhook secret's plaintext at send time, so there
   *  is no "dev doesn't need this" story the way there is for
   *  `settlementInternalToken`. `loadConfig` decodes and validates the length,
   *  failing boot on a missing or malformed value rather than accepting
   *  garbage and failing later at first-delivery time. Callers pass
   *  `Buffer.from(config.webhookSecretEncryptionKey, "base64")` to
   *  `encryptSecret`/`decryptSecret`, which take a `Buffer` key. */
  webhookSecretEncryptionKey: string;
  /** Terminal-failure threshold for a single webhook_deliveries row — the
   *  attempt at which status flips from 'pending' to 'exhausted' instead of
   *  scheduling another retry. */
  webhookMaxAttempts: number;
  /** Exponential backoff base (attempt 1's delay), milliseconds. */
  webhookBackoffBaseMs: number;
  /** Exponential backoff cap — no retry ever waits longer than this,
   *  milliseconds. */
  webhookBackoffCapMs: number;
  /** How often the dispatcher's poll-fallback timer runs a dispatch pass,
   *  independent of LISTEN/NOTIFY — the safety net that guarantees no event
   *  is stuck forever even if a NOTIFY is missed. */
  webhookPollIntervalMs: number;
  /** Per-delivery-attempt HTTP timeout passed to the transport, milliseconds. */
  webhookRequestTimeoutMs: number;

  /** Shared secret the acquirer signs its async callbacks with
   *  (routes/acquirerCallbacks.ts). Platform-level, not per-merchant —
   *  unlike webhookSecretEncryptionKey, there is exactly one acquirer
   *  relationship, not one secret per registered endpoint. */
  acquirerCallbackSigningSecret: string;
  /** Default true (LOG.md E08). Only set false for an unsigned sandbox, never in production. */
  acquirerCallbackRequireSignature: boolean;
}

/** E13: SHA-256 of secrets that leaked in git history (never the values). */
const LEAKED_SECRET_SHA256 = new Set(["63889b3971febcfcdfe8d4bc9a17e67b719c00e47b2c1fc74eb7aa8a50ec6306"]);

function parseNodeEnv(value: string | undefined): Config["nodeEnv"] {
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }
  // E163: only an unset NODE_ENV defaults to development. A typo ("prod")
  // used to become development too, silently turning off the webhook
  // private-address block, secure cookies and the missing-secret checks.
  if (value === undefined || value === "") return "development";
  throw new Error(`loadConfig: NODE_ENV must be production, test or development, got "${value}"`);
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  // E163: the whole string must be an integer ("3000oops" was 3000).
  const parsed = /^-?\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`loadConfig: expected an integer, got "${value}"`);
  }
  return parsed;
}

/** E163 (rest): an integer setting that must also fall inside [min, max]. */
function parseRangedIntEnv(name: string, value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = parseIntEnv(value, fallback);
  if (parsed < min || parsed > max) {
    throw new Error(`loadConfig: ${name} must be between ${min} and ${max}, got ${parsed}`);
  }
  return parsed;
}

function parseFloatEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  // E163: the whole string must be a number ("0.5oops" was 0.5).
  const parsed = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`loadConfig: expected a number, got "${value}"`);
  }
  return parsed;
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  // E163: anything but true/false/1/0 was silently false ("treu").
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`loadConfig: expected true, false, 1 or 0, got "${value}"`);
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Validates WEBHOOK_SECRET_ENCRYPTION_KEY decodes to exactly 32 raw bytes,
 *  failing fast at boot (same posture as DATABASE_URL) rather than
 *  accepting a missing/malformed key and only discovering the problem at
 *  first-delivery time. Returns the original base64 string unchanged — the
 *  Config field stays base64-encoded; callers decode to a Buffer at the
 *  point of use. */
function parseWebhookSecretEncryptionKey(value: string | undefined): string {
  if (!value) {
    throw new Error("loadConfig: WEBHOOK_SECRET_ENCRYPTION_KEY environment variable is not set");
  }
  if (!BASE64_RE.test(value)) {
    throw new Error("loadConfig: WEBHOOK_SECRET_ENCRYPTION_KEY is not valid base64");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      `loadConfig: WEBHOOK_SECRET_ENCRYPTION_KEY must base64-decode to exactly 32 bytes, got ${decoded.length}`,
    );
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("loadConfig: DATABASE_URL environment variable is not set");
  }

  const nodeEnv = parseNodeEnv(env.NODE_ENV);

  const settlementInternalToken = env.SETTLEMENT_INTERNAL_TOKEN ?? "";
  if (nodeEnv === "production" && settlementInternalToken === "") {
    throw new Error("loadConfig: SETTLEMENT_INTERNAL_TOKEN is required when NODE_ENV=production");
  }
  // E94: a weak shared token ("dev-token" in the docs) is refused in production.
  if (nodeEnv === "production" && settlementInternalToken.length < 32) {
    throw new Error("loadConfig: SETTLEMENT_INTERNAL_TOKEN must be at least 32 characters when NODE_ENV=production");
  }

  const acquirerCallbackSigningSecret = env.ACQUIRER_CALLBACK_SIGNING_SECRET ?? "";
  // E13: this secret leaked in git history (669af52, ops/.env.docker). The
  // value stays in history but must never authenticate a callback again.
  // Only its SHA-256 is kept here, never the value.
  if (acquirerCallbackSigningSecret !== "" && LEAKED_SECRET_SHA256.has(createHash("sha256").update(acquirerCallbackSigningSecret).digest("hex"))) {
    throw new Error("loadConfig: ACQUIRER_CALLBACK_SIGNING_SECRET is the value leaked in git history; run ops/gen-env.sh for a new one");
  }
  if (nodeEnv === "production" && acquirerCallbackSigningSecret === "") {
    throw new Error("loadConfig: ACQUIRER_CALLBACK_SIGNING_SECRET is required when NODE_ENV=production");
  }

  const config: Config = {
    nodeEnv,
    port: parseIntEnv(env.PORT, 3000),
    databaseUrl,

    pgPoolMax: parseIntEnv(env.PG_POOL_MAX, 5),
    otpUserMaxAttemptsPerWindow: parseIntEnv(env.OTP_USER_MAX_ATTEMPTS_PER_WINDOW, 10),
    otpUserWindowMinutes: parseIntEnv(env.OTP_USER_WINDOW_MINUTES, 15),
    authRateLimitPerMinute: parseIntEnv(env.AUTH_RATE_LIMIT_PER_MINUTE, nodeEnv === "test" ? 0 : 120),
    maxInFlightRequests: parseIntEnv(env.MAX_IN_FLIGHT_REQUESTS, 64),
    shedEventLoopDelayMs: parseIntEnv(env.SHED_EVENT_LOOP_DELAY_MS, 0),
    logLevel: env.LOG_LEVEL ?? "info",
    pgPoolMin: parseIntEnv(env.PG_POOL_MIN, 0),
    pgPoolIdleTimeoutMs: parseIntEnv(env.PG_POOL_IDLE_TIMEOUT_MS, 30_000),
    pgPoolConnectionTimeoutMs: parseIntEnv(env.PG_POOL_CONNECTION_TIMEOUT_MS, 5_000),

    sessionTtlHours: parseRangedIntEnv("SESSION_TTL_HOURS", env.SESSION_TTL_HOURS, 12, 1, 168),
    pendingSessionTtlMinutes: parseRangedIntEnv("PENDING_SESSION_TTL_MINUTES", env.PENDING_SESSION_TTL_MINUTES, 10, 1, 60),
    otpTtlMinutes: parseRangedIntEnv("OTP_TTL_MINUTES", env.OTP_TTL_MINUTES, 5, 1, 60),
    otpCodeLength: parseRangedIntEnv("OTP_CODE_LENGTH", env.OTP_CODE_LENGTH, 6, 4, 10),
    otpMaxAttempts: parseRangedIntEnv("OTP_MAX_ATTEMPTS", env.OTP_MAX_ATTEMPTS, 5, 1, 20),
    // E37: opt-in only. The default was "on unless production", and NODE_ENV
    // defaults to development, so a hosted box handed codes to anyone.
    otpDevExpose: parseBoolEnv(env.OTP_DEV_EXPOSE, false),

    argon2MemoryKib: parseRangedIntEnv("ARGON2_MEMORY_KIB", env.ARGON2_MEMORY_KIB, 19_456, 8192, 1048576),
    argon2TimeCost: parseRangedIntEnv("ARGON2_TIME_COST", env.ARGON2_TIME_COST, 2, 1, 10),
    argon2Parallelism: parseRangedIntEnv("ARGON2_PARALLELISM", env.ARGON2_PARALLELISM, 1, 1, 16),

    kycUploadDir: env.KYC_UPLOAD_DIR ?? "./data/kyc",
    kycMaxFileSizeBytes: parseIntEnv(env.KYC_MAX_FILE_SIZE_BYTES, 8_388_608),

    acquirerLatencyMinMs: parseIntEnv(env.ACQUIRER_LATENCY_MIN_MS, 100),
    acquirerLatencyMaxMs: parseIntEnv(env.ACQUIRER_LATENCY_MAX_MS, 400),
    acquirerFailureRate: parseFloatEnv(env.ACQUIRER_FAILURE_RATE, 0.02), // range checked below (config.ts, after the object)
    acquirerRngSeed:
      env.ACQUIRER_RNG_SEED !== undefined && env.ACQUIRER_RNG_SEED !== ""
        ? parseIntEnv(env.ACQUIRER_RNG_SEED, 0)
        : null,

    cookieName: env.COOKIE_NAME ?? "fp_sid",
    cookieSecure: parseBoolEnv(env.COOKIE_SECURE, nodeEnv === "production"),

    adminCookieName: env.ADMIN_COOKIE_NAME ?? "fp_admin_sid",
    adminSessionTtlHours: parseRangedIntEnv("ADMIN_SESSION_TTL_HOURS", env.ADMIN_SESSION_TTL_HOURS, 8, 1, 24),
    adminPendingSessionTtlMinutes: parseRangedIntEnv("ADMIN_PENDING_SESSION_TTL_MINUTES", env.ADMIN_PENDING_SESSION_TTL_MINUTES, 10, 1, 60),
    adminOtpTtlMinutes: parseRangedIntEnv("ADMIN_OTP_TTL_MINUTES", env.ADMIN_OTP_TTL_MINUTES, 5, 1, 60),
    adminOtpCodeLength: parseRangedIntEnv("ADMIN_OTP_CODE_LENGTH", env.ADMIN_OTP_CODE_LENGTH, 6, 4, 10),
    adminOtpMaxAttempts: parseRangedIntEnv("ADMIN_OTP_MAX_ATTEMPTS", env.ADMIN_OTP_MAX_ATTEMPTS, 5, 1, 20),

    impersonationCookieName: env.IMPERSONATION_COOKIE_NAME ?? "fp_impersonation",
    impersonationTtlMinutes: parseRangedIntEnv("IMPERSONATION_TTL_MINUTES", env.IMPERSONATION_TTL_MINUTES, 15, 1, 120),

    settlementInternalUrl: env.SETTLEMENT_INTERNAL_URL ?? "http://settlement:8091",
    settlementInternalToken,
    settlementInternalRequestTimeoutMs: parseRangedIntEnv("SETTLEMENT_INTERNAL_REQUEST_TIMEOUT_MS", env.SETTLEMENT_INTERNAL_REQUEST_TIMEOUT_MS, 30_000, 1000, 600000),

    checkoutBaseUrl: env.CHECKOUT_BASE_URL ?? "http://localhost:5173",
    paymentLinkReservationTimeoutSeconds: parseRangedIntEnv("PAYMENT_LINK_RESERVATION_TIMEOUT_SECONDS", env.PAYMENT_LINK_RESERVATION_TIMEOUT_SECONDS, 60, 0, 3600),

    // Required in every environment (see the Config doc above): no built-in key.
    webhookSecretEncryptionKey: parseWebhookSecretEncryptionKey(env.WEBHOOK_SECRET_ENCRYPTION_KEY),
    webhookMaxAttempts: parseRangedIntEnv("WEBHOOK_MAX_ATTEMPTS", env.WEBHOOK_MAX_ATTEMPTS, 8, 0, 50),
    webhookBackoffBaseMs: parseRangedIntEnv("WEBHOOK_BACKOFF_BASE_MS", env.WEBHOOK_BACKOFF_BASE_MS, 30_000, 100, 3600000),
    webhookBackoffCapMs: parseRangedIntEnv("WEBHOOK_BACKOFF_CAP_MS", env.WEBHOOK_BACKOFF_CAP_MS, 21_600_000, 1000, 86400000),
    webhookPollIntervalMs: parseRangedIntEnv("WEBHOOK_POLL_INTERVAL_MS", env.WEBHOOK_POLL_INTERVAL_MS, 5_000, 100, 600000),
    webhookRequestTimeoutMs: parseRangedIntEnv("WEBHOOK_REQUEST_TIMEOUT_MS", env.WEBHOOK_REQUEST_TIMEOUT_MS, 10_000, 100, 60000),

    acquirerCallbackSigningSecret,
    acquirerCallbackRequireSignature: parseBoolEnv(env.ACQUIRER_CALLBACK_REQUIRE_SIGNATURE, true),
  };
  // E163: ranges the parsers alone cannot check (bad values reached pg or
  // the simulator at request time instead of failing the boot).
  if (config.acquirerFailureRate < 0 || config.acquirerFailureRate > 1) {
    throw new Error(`loadConfig: ACQUIRER_FAILURE_RATE must be between 0 and 1, got ${config.acquirerFailureRate}`);
  }
  if (config.pgPoolMax < 1 || config.pgPoolMin < 0 || config.pgPoolMin > config.pgPoolMax) {
    throw new Error(`loadConfig: need PG_POOL_MAX >= 1 and 0 <= PG_POOL_MIN <= PG_POOL_MAX, got ${config.pgPoolMin}..${config.pgPoolMax}`);
  }
  if (config.webhookMaxAttempts < 1) {
    throw new Error(`loadConfig: WEBHOOK_MAX_ATTEMPTS must be at least 1, got ${config.webhookMaxAttempts}`);
  }
  return config;
}
