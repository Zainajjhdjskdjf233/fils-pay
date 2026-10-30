/**
 * E65: the seed starts with `TRUNCATE … RESTART IDENTITY CASCADE`, which
 * empties merchants, transactions and admin_users and, through CASCADE,
 * refunds, payment links, sessions, API keys and the admin audit log. It is
 * for a throw-away development database only. The old comment in
 * generate.ts ("safe to run against a shared/staging database") was false.
 */
export function assertSeedResetAllowed(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === "production") {
    throw new Error("seed: refusing to run with NODE_ENV=production (it truncates real tables)");
  }
  if (env.FILSPAY_ALLOW_SEED_RESET !== "1") {
    throw new Error(
      "seed: this wipes merchants, transactions, admin users and the admin audit log. " +
        "Set FILSPAY_ALLOW_SEED_RESET=1 to confirm the database is a throw-away dev database.",
    );
  }
}
