/**
 * E55: which address the API listens on. Inside Docker (NODE_ENV=production)
 * it must be 0.0.0.0 so nginx can reach it on the internal network; a dev
 * API on a laptop listened there too and was reachable from the same Wi-Fi.
 * HOST overrides; otherwise localhost outside production.
 */
export function listenHost(env: NodeJS.ProcessEnv, nodeEnv: "development" | "test" | "production"): string {
  if (env.HOST) return env.HOST;
  return nodeEnv === "production" ? "0.0.0.0" : "127.0.0.1";
}
