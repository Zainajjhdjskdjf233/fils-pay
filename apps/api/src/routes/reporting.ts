import { isRealDate, UUID_RE } from "../lib/queryParsing.js";
import type { FastifyInstance } from "fastify";
import { requireMerchantAuth } from "../auth/requireMerchantAuth.js";
import { runTransactionsReport, type TransactionReportFilter } from "../reporting/transactionsReportQuery.js";
import { resolveReportMerchantId } from "../reporting/scope.js";
import { createSavedFilter, listSavedFilters } from "../reporting/savedFilters.js";
import { BadRequestError } from "../lib/errors.js";

interface ReportQuery {
  filter?: string;
}

interface SaveFilterBody {
  name?: string;
  filter?: Record<string, unknown>;
}

/**
 * Registered with prefix '/v1/reporting'. `requireMerchantAuth` only, same
 * authorization level as `/v1/analytics/*` — nothing here is more sensitive
 * than a merchant reading their own transaction list already is (in the
 * intended, single-merchant case).
 */
export async function reportingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ReportQuery }>(
    "/transactions",
    { preHandler: requireMerchantAuth },
    async (request) => {
      let parsed: Partial<TransactionReportFilter> = {};
      if (request.query.filter) {
        try {
          parsed = JSON.parse(request.query.filter);
        } catch {
          throw new BadRequestError("invalid_filter", "filter must be valid JSON");
        }
        checkReportFilter(parsed); // E133
      }

      const merchantId = await resolveReportMerchantId(
        app.db,
        request.merchantAuth!.merchantId,
        parsed.merchantId,
      );

      return runTransactionsReport(app.db, {
        merchantId,
        status: parsed.status,
        from: parsed.from,
        to: parsed.to,
      });
    },
  );

  app.post<{ Body: SaveFilterBody }>(
    "/saved-filters",
    { preHandler: requireMerchantAuth },
    async (request, reply) => {
      const { name, filter } = request.body ?? {};
      // E169: a real name (not only spaces) and a JSON object (not an array).
      if (typeof name !== "string" || name.trim() === "") {
        throw new BadRequestError("invalid_request", "name is required");
      }
      if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
        throw new BadRequestError("invalid_request", "filter is required and must be a JSON object");
      }

      const saved = await createSavedFilter(app.db, {
        merchantId: request.merchantAuth!.merchantId,
        name: name.trim(),
        filter,
      });
      reply.code(201).send(saved);
    },
  );

  app.get(
    "/saved-filters",
    { preHandler: requireMerchantAuth },
    async (request) => listSavedFilters(app.db, { merchantId: request.merchantAuth!.merchantId }),
  );

  // E45: had no preHandler, so anyone could call it (it crashed on merchantAuth!).
  app.get("/export-summary", { preHandler: requireMerchantAuth }, async (request) => {
    const result = await app.db.query(
      `SELECT COUNT(*) AS total, SUM(captured_gross_fils) AS gross
         FROM merchant_daily_volume WHERE merchant_id = $1`,
      [request.merchantAuth!.merchantId],
    );
    return { totalDays: Number(result.rows[0]?.total ?? 0), grossFils: Number(result.rows[0]?.gross ?? 0) };
  });
}

// E170: partially_refunded too (0043:15); the E133 list left it out.
const REPORT_STATUSES = ["authorized", "captured", "partially_captured", "voided", "partially_refunded", "refunded", "chargeback"];
/**
 * E133 (second review, item 30): the parsed filter went straight into the
 * report query. Wrong shape, types, status or dates gave 500 from Postgres or
 * a TypeError. Now they are 400 before any query runs.
 */
function checkReportFilter(parsed: unknown): asserts parsed is Partial<TransactionReportFilter> {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestError("invalid_filter", "filter must be a JSON object");
  }
  const f = parsed as Record<string, unknown>;
  if (f.merchantId !== undefined && (typeof f.merchantId !== "string" || !UUID_RE.test(f.merchantId))) {
    throw new BadRequestError("invalid_filter", "merchantId must be a UUID");
  }
  if (f.status !== undefined && (typeof f.status !== "string" || !REPORT_STATUSES.includes(f.status))) {
    throw new BadRequestError("invalid_filter", `status must be one of ${REPORT_STATUSES.join(", ")}`);
  }
  for (const key of ["from", "to"] as const) {
    if (f[key] !== undefined && !isRealDate(f[key])) {
      throw new BadRequestError("invalid_filter", `${key} must be a real date (YYYY-MM-DD, or a time with a zone)`);
    }
  }
}
