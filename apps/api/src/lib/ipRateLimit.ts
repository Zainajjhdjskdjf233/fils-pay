import type { FastifyReply, FastifyRequest } from "fastify";
import { TooManyRequestsError } from "./errors.js";

/**
 * E146: a fixed one-minute window per client IP for the public, argon2-heavy
 * endpoints (merchant login, signup, admin login). In memory: the stack runs
 * one API container (ops/docker-compose.yml). 0 turns it off.
 * The IP comes from X-Forwarded-For, which nginx overwrites with the real
 * client address (ops/nginx/nginx.conf: `X-Forwarded-For $remote_addr`); the
 * API has no published port, so a client cannot reach it without nginx.
 */
export function createIpRateLimiter(limitPerMinute: number) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweepAt = 0;
  return async function ipRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (limitPerMinute <= 0) return;
    const now = Date.now();
    // fix-reviewer: bound the memory. Sweep expired entries at most once a
    // minute; if still too many live addresses, start over (fail open).
    if (windows.size > 10_000 && now >= nextSweepAt) {
      nextSweepAt = now + 60_000;
      for (const [ip, w] of windows) if (w.resetAt <= now) windows.delete(ip);
      if (windows.size > 10_000) windows.clear();
    }
    const key = request.ip;
    let w = windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + 60_000 };
      windows.set(key, w);
    }
    w.count += 1;
    if (w.count > limitPerMinute) {
      reply.header("Retry-After", String(Math.ceil((w.resetAt - now) / 1000)));
      throw new TooManyRequestsError("too_many_requests", "Too many attempts from this address. Please wait a minute.");
    }
  };
}
