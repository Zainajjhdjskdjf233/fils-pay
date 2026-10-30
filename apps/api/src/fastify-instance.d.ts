import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import type { AcquirerSimulator } from "./acquirer/types.js";
import type { WebhookTransport } from "./webhooks/transport.js";

// am: request.merchantAuth is declared in auth/requireMerchantAuth.ts, not here. dont move it
declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
    config: Config;
    acquirer: AcquirerSimulator;
    webhookTransport: WebhookTransport;
    /** E146: per-IP limiter for login and signup. */
    authRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
