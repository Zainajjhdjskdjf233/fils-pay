import { monitorEventLoopDelay } from "node:perf_hooks";
import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * Load shedding (CASE-FILE Item 05: "push past your limit and see whether
 * your stack turns away the excess"). A 0.5-vCPU API fails by QUEUEING:
 * every request slows down, then memory and the DB pool run out. Instead,
 * above the in-flight cap — or while the event loop is already lagging — a new
 * request gets 503 + Retry-After at once. Health routes are never shed, so the
 * container is not restarted for being busy.
 */
export interface LoadSheddingOptions {
  /** Requests being handled at once before new ones get 503. */
  maxInFlight: number;
  /** Shed while the event loop p99 delay is above this (ms). 0 = off. */
  maxEventLoopDelayMs: number;
}

const NEVER_SHED = new Set(["/healthz", "/readyz"]);
const counted = new WeakSet<FastifyRequest>();

export function installLoadShedding(app: FastifyInstance, options: LoadSheddingOptions): void {
  let inFlight = 0;
  let lagging = false;

  if (options.maxEventLoopDelayMs > 0) {
    const histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
    const timer = setInterval(() => {
      lagging = histogram.percentile(99) / 1e6 > options.maxEventLoopDelayMs;
      histogram.reset();
    }, 500);
    timer.unref();
    app.addHook("onClose", async () => {
      clearInterval(timer);
      histogram.disable();
    });
  }

  app.addHook("onRequest", async (request, reply) => {
    if (NEVER_SHED.has(request.url.split("?")[0] ?? "")) return;
    if (inFlight >= options.maxInFlight || lagging) {
      reply.header("Retry-After", "1");
      reply.code(503).send({ error: "overloaded", message: "The server is busy. Please retry in a moment." });
      return reply;
    }
    inFlight += 1;
    counted.add(request);
  });

  const release = async (request: FastifyRequest): Promise<void> => {
    if (counted.delete(request)) inFlight -= 1;
  };
  app.addHook("onResponse", release);
  app.addHook("onRequestAbort", release);
}
