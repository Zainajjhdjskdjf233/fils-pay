import type { FastifyInstance } from "fastify";
import { toFils } from "@filspay/money";
import { requireMerchantAuth, requireMerchantRole, requireMerchantWriterActor } from "../auth/requireMerchantAuth.js";
import { assertRefundRequestScope, initiateMerchantRefund } from "../refunds/initiateMerchantRefund.js";
import { BadRequestError } from "../lib/errors.js";

const MAX_REASON_LENGTH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /v1/merchants/:merchantId/refunds (F01, LOG.md F01b). Registered under the
 * /v1/merchants prefix like the other merchant-scoped routes. The client must send
 * its own Idempotency-Key (the old draft generated one per request, which defeats it).
 */
interface RefundBody {
  transactionId?: unknown;
  amountFils?: unknown;
  reason?: unknown;
}

export async function refundRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { merchantId: string }; Body: RefundBody }>(
    "/:merchantId/refunds",
    { preHandler: [requireMerchantAuth, requireMerchantRole("owner", "finance")] },
    async (request, reply) => {
      const auth = request.merchantAuth!;
      assertRefundRequestScope(auth, request.params.merchantId);
      const header = request.headers["idempotency-key"];
      const idempotencyKey = Array.isArray(header) ? header[0] : header;
      if (!idempotencyKey) {
        throw new BadRequestError("idempotency_key_required", "Idempotency-Key header is required");
      }
      const { transactionId, amountFils, reason } = request.body ?? {};
      if (typeof transactionId !== "string" || !UUID_RE.test(transactionId)) {
        throw new BadRequestError("invalid_request", "transactionId (uuid) is required");
      }
      if (amountFils !== undefined && (typeof amountFils !== "number" || !Number.isSafeInteger(amountFils) || amountFils <= 0)) {
        throw new BadRequestError("invalid_amount", "amountFils must be a positive whole number of fils");
      }
      if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)) {
        throw new BadRequestError("invalid_request", `reason must be a string of at most ${MAX_REASON_LENGTH} characters`);
      }
      const result = await initiateMerchantRefund(app.db, app.acquirer, {
        merchantId: auth.merchantId,
        transactionId,
        amountFils: amountFils === undefined ? undefined : toFils(amountFils),
        idempotencyKey,
        actor: requireMerchantWriterActor(auth),
        reason,
      });
      reply.code(result.statusCode).send(result.body);
    },
  );
}
