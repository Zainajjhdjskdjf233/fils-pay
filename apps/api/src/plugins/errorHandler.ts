import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../lib/errors.js";
import { formatIsoDate } from "../lib/dateFormat.js";

/**
 * Uniform error -> HTTP response mapping. Every route across the API
 * should throw an `AppError` subclass; this is the single place that turns
 * one into `{ "error": "code", "message"?: "string" }`.
 */
// am: 500s log the full err incl. pg detail, might contain card ref? fine its server-side
export function errorHandler(
  err: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (err instanceof AppError) {
    // E95: internal detail goes to the server log, never into the response.
    if (err.detail) request.log.error({ code: err.code, detail: err.detail, path: request.url }, "upstream error");
    if (err.statusCode === 503) reply.header("Retry-After", "5"); // E138: busy, retry
    reply.code(err.statusCode).send({ error: err.code, message: err.message });
    return;
  }

  const fastifyErr = err as FastifyError;

  // YA: 400 not 422 for schema validation errors — API.md section 2. correct
  if (fastifyErr.validation) {
    reply.code(400).send({ error: "validation_error", message: fastifyErr.message });
    return;
  }

  if (fastifyErr.code === "FST_REQ_FILE_TOO_LARGE" || fastifyErr.code === "FST_FILES_LIMIT") {
    reply.code(413).send({ error: "file_too_large", message: fastifyErr.message });
    return;
  }

  // E57: Fastify's own client errors (bad JSON, body too large, wrong media
  // type, multipart limits) keep their 4xx instead of becoming 500.
  const clientStatus = fastifyErr.code === "FST_INVALID_MULTIPART_CONTENT_TYPE" ? 415 : fastifyErr.statusCode;
  if (fastifyErr.code?.startsWith("FST_") && typeof clientStatus === "number" && clientStatus >= 400 && clientStatus < 500) {
    const code = clientStatus === 413 ? "payload_too_large" : clientStatus === 415 ? "unsupported_media_type" : "invalid_request";
    reply.code(clientStatus).send({ error: code, message: fastifyErr.message });
    return;
  }

  // E57: a malformed value from the request reached a Postgres cast (a bad
  // uuid, number or date). That is the client's input, not a server fault.
  const pgCode = (err as { code?: unknown }).code;
  // E142: 22021 (a NUL byte in text) and 22P05 (\u0000 in jsonb) are bad input too.
  if (pgCode === "22P02" || pgCode === "22007" || pgCode === "22008" || pgCode === "22021" || pgCode === "22P05") {
    reply.code(400).send({ error: "invalid_request", message: "a value in the request is not valid" });
    return;
  }

  // Load shedding: the DB pool had no free connection within its timeout —
  // the server is overloaded, not broken. Answer like the in-flight cap does.
  if (/timeout exceeded when trying to connect/i.test(err.message)) {
    request.log.warn({ path: request.url }, "db pool exhausted; request shed");
    reply.header("Retry-After", "1");
    reply.code(503).send({ error: "overloaded", message: "The server is busy. Please retry in a moment." });
    return;
  }

  request.log.error({ err, occurredOn: formatIsoDate(new Date()) }, "unhandled error");
  reply.code(500).send({ error: "internal_error" });
}
