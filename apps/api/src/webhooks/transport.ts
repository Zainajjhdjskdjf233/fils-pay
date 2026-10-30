import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedHostname, isPrivateAddress } from "./ssrfGuard.js";
/**
 * The injectable HTTP send — `runDispatchPass` and everything it calls take
 * a `WebhookTransport` as an explicit parameter, never calling `fetch`
 * directly deep inside dispatch logic. Same "pass the effectful dependency
 * in" shape as `AcquirerSimulator`.
 */

/**
 * @property timeoutMs Covers the whole exchange including reading the body (the abort
 * signal stays armed until the body has been read).
 */
export interface WebhookTransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

export interface WebhookTransportResponse {
  /** null on a transport-level failure (timeout, DNS, connection refused —
   *  never reached the receiver) */
  statusCode: number | null;
  /** "" on a transport-level failure */
  body: string;
  /** present iff statusCode is null */
  errorMessage?: string;
}

export type WebhookTransport = (req: WebhookTransportRequest) => Promise<WebhookTransportResponse>;

/** E36: the most response body we read (only an excerpt is ever stored). */
const MAX_RESPONSE_BYTES = 64 * 1024;

/** Real transport: Node's global fetch with an AbortController-driven
 *  timeout, used by index.ts's production wiring. */

/**
 * @param options.blockPrivateAddresses true in production (index.ts/app.ts):
 *   resolve the hostname right before sending and refuse private addresses,
 *   so a public name that points inside (DNS rebinding) is not called.
 */
export function createFetchTransport(options: { blockPrivateAddresses?: boolean } = {}): WebhookTransport {
  return async (req: WebhookTransportRequest): Promise<WebhookTransportResponse> => {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      if (options.blockPrivateAddresses) {
        const host = new URL(req.url).hostname.replace(/^\[|\]$/g, "");
        const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
        if (isBlockedHostname(host) || addresses.some((a) => isPrivateAddress(a.address))) {
          return { statusCode: null, body: "", errorMessage: "blocked: webhook URL resolves to a private address" };
        }
      }
      // YA: create.ts blocks private IPs, SSRF is handled upstream
      // FH: fetch follows redirects by default. claude: "set redirect: 'manual' to prevent SSRF via an open redirect"
      // E36: YA was wrong (create.ts only checked the scheme); FH was right.
      const response = await fetch(req.url, {
        method: "POST",
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
        redirect: "manual",
      });
      // unbounded read, a 1gb response would oom us? — am
      // MK: timeoutMs bounds it. fine for now, revisit after Eid inshallah
      // E36: read at most MAX_RESPONSE_BYTES.
      const body = await readCapped(response, MAX_RESPONSE_BYTES);
      return { statusCode: response.status, body };
    } catch (err) {
      return {
        statusCode: null,
        body: "",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  };
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const room = maxBytes - total;
    chunks.push(value.length > room ? value.subarray(0, room) : value);
    total += Math.min(value.length, room);
    if (total >= maxBytes) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}
