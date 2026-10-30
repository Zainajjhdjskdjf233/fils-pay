import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import { ForbiddenError } from "../lib/errors.js";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostnameOf(value: string): string | null {
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * E84: SameSite=Lax cookies still travel on POSTs from other origins of the
 * same site, and Fastify parses text/plain, so a plain HTML form could act
 * as the logged-in user. A state-changing request that carries one of our
 * session cookies AND an Origin header must come from this host.
 * - Hostnames are compared without the port: nginx forwards `Host $host`,
 *   which drops the port (the admin console on :8081 sends Origin …:8081).
 * - No Origin header (curl, server-to-server, API-key integrations) and no
 *   cookie (nothing to forge) are not affected.
 */
export function installCsrfOriginCheck(app: FastifyInstance, config: Config): void {
  const cookieNames = [config.cookieName, config.adminCookieName, config.impersonationCookieName];
  app.addHook("onRequest", async (request) => {
    if (!UNSAFE.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const cookieHeader = request.headers.cookie ?? "";
    if (!cookieNames.some((name) => cookieHeader.includes(`${name}=`))) return;
    const originHost = origin === "null" ? null : hostnameOf(origin);
    const host = hostnameOf(request.headers.host ?? "");
    if (!originHost || !host || originHost !== host) {
      throw new ForbiddenError("cross_origin_request", "This request must come from the FilsPay site itself.");
    }
  });
}
