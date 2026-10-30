import { parseLimit } from "../lib/queryParsing.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  requireMerchantAuth,
  requireMerchantRole,
  requireMerchantWriterActor,
} from "../auth/requireMerchantAuth.js";
import { createPaymentLink } from "../paymentLinks/create.js";
import { getPublicPaymentLink } from "../paymentLinks/read.js";
import { payPaymentLink } from "../paymentLinks/pay.js";
import { parseSimulatedCard } from "../acquirer/cardShape.js";
import { cancelPaymentLink } from "../paymentLinks/cancel.js";
import { listPaymentLinks } from "../paymentLinks/query.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import type { SimulatedCardInput } from "../acquirer/types.js";

interface MerchantIdParams {
  merchantId: string;
}

interface MerchantLinkIdParams extends MerchantIdParams {
  id: string;
}

interface TokenParams {
  token: string;
}

interface CreatePaymentLinkBody {
  amountFils?: number;
  reference?: string;
  description?: string;
  expiresAt?: string;
}

/**
 * card: simulated card input. submittedAt: accepted for old clients but
 * ignored; expiry always uses the server clock (FP-187, LOG.md E06).
 */
interface PayPaymentLinkBody {
  card?: SimulatedCardInput;
  submittedAt?: string;
}

interface ListPaymentLinksQuery {
  status?: string | string[];
  limit?: string;
  cursor?: string;
}

// am: this is the ownership check for create/cancel/list. cancel.ts relies on it, link ids are UUIDs
// MK: it checks the path merchant, not that the link belongs to that merchant?
function assertOwnMerchant(request: FastifyRequest<{ Params: MerchantIdParams }>): void {
  if (!request.merchantAuth || request.merchantAuth.merchantId !== request.params.merchantId) {
    throw new ForbiddenError("forbidden");
  }
}

/** Same rule as routes/transactions.ts: header required, no server-generated fallback. */
function getIdempotencyKey(request: FastifyRequest): string {
  const header = request.headers["idempotency-key"];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    throw new BadRequestError("idempotency_key_required", "Idempotency-Key header is required");
  }
  return key;
}

/**
 * Merchant-authenticated payment-link routes: create, cancel, list.
 * Registered with prefix '/v1/merchants' — a *separate* registration from
 * `paymentLinkPublicRoutes` below, so there is no ambiguity in app.ts
 * between what requires `requireMerchantAuth` and what is deliberately
 * public.
 */
export async function paymentLinkMerchantRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: MerchantIdParams; Body: CreatePaymentLinkBody }>(
    "/:merchantId/payment-links",
    { preHandler: [requireMerchantAuth, requireMerchantRole("owner", "finance")] },
    async (request, reply) => {
      assertOwnMerchant(request);
      const { amountFils, reference, description, expiresAt } = request.body ?? {};
      if (amountFils === undefined || !expiresAt) {
        throw new BadRequestError("invalid_request", "amountFils and expiresAt are required");
      }

      const writer = requireMerchantWriterActor(request.merchantAuth!);
      const link = await createPaymentLink(app.db, app.config, {
        merchantId: request.params.merchantId,
        amountFils,
        reference,
        description,
        expiresAt,
        createdByType: writer.type,
        createdById: writer.id,
      });
      reply.code(201).send(link);
    },
  );

  app.delete<{ Params: MerchantLinkIdParams }>(
    "/:merchantId/payment-links/:id",
    { preHandler: [requireMerchantAuth, requireMerchantRole("owner", "finance")] },
    async (request, reply) => {
      assertOwnMerchant(request);
      const result = await cancelPaymentLink(app.db, {
        id: request.params.id,
        merchantId: request.merchantAuth!.merchantId,
        reservationTimeoutSeconds: app.config.paymentLinkReservationTimeoutSeconds, // E101
      });
      if (result.outcome === "canceled") {
        reply.code(204).send();
        return;
      }
      if (result.outcome === "not_found") {
        throw new NotFoundError("payment_link_not_found");
      }
      throw new ConflictError("not_cancelable", `status: ${result.status}`);
    },
  );

  app.get<{ Params: MerchantIdParams; Querystring: ListPaymentLinksQuery }>(
    "/:merchantId/payment-links",
    { preHandler: requireMerchantAuth },
    async (request) => {
      assertOwnMerchant(request);
      const q = request.query;
      const status = q.status === undefined ? undefined : Array.isArray(q.status) ? q.status : [q.status];
      const limit = parseLimit(q.limit) /* E126 */;

      return listPaymentLinks(app.db, app.config, {
        merchantId: request.params.merchantId,
        status,
        limit,
        cursor: q.cursor ?? null,
      });
    },
  );
}

/**
 * Public, unauthenticated payment-link routes: read, pay. Registered with
 * prefix '/v1/payment-links'.
 */
export async function paymentLinkPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: TokenParams }>("/:token", async (request) => {
    const link = await getPublicPaymentLink(
      app.db,
      request.params.token,
      app.config.paymentLinkReservationTimeoutSeconds,
    );
    if (!link) {
      throw new NotFoundError("payment_link_not_found");
    }
    return link;
  });

  app.post<{ Params: TokenParams; Body: PayPaymentLinkBody }>("/:token/pay", async (request, reply) => {
    const idempotencyKey = getIdempotencyKey(request);
    const { card, submittedAt } = request.body ?? {};
    if (!card) {
      throw new BadRequestError("invalid_request", "card is required");
    }
    // E123: check the shape before the link is claimed (a bad card used to 500 after the claim).
    const cleanCard = parseSimulatedCard(card);
    if (!cleanCard) {
      throw new BadRequestError("invalid_card", "card needs pan (12-19 digits), expiryMonth (1-12), expiryYear and cvv (3-4 digits)");
    }

    const result = await payPaymentLink(
      app.db,
      app.acquirer,
      {
        paymentLinkReservationTimeoutSeconds: app.config.paymentLinkReservationTimeoutSeconds,
        // E29: half the pool, so every pay holding a link lock can get its capture connection.
        maxConcurrentLockedPays: Math.max(1, Math.floor(app.config.pgPoolMax / 2)),
      },
      { token: request.params.token, card: cleanCard, idempotencyKey, submittedAt },
    );
    reply.code(result.statusCode).send(result.body);
  });
}
