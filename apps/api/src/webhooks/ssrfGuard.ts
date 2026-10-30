import { isIP } from "node:net";

/**
 * E36 (SSRF): addresses a webhook must never be sent to — loopback,
 * private, link-local (incl. the cloud metadata address 169.254.169.254),
 * carrier-grade NAT, "this network", multicast/reserved, and their IPv6
 * equivalents (incl. IPv4-mapped ::ffff:a.b.c.d).
 */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]!);
    // fix-reviewer: the URL parser writes IPv4-mapped (::ffff:), IPv4-compatible
    // (::/96) and NAT64 (64:ff9b::/96) addresses in hex, e.g. [::ffff:7f00:1].
    // Turn the last two hex groups back into a.b.c.d and check that.
    const embedded = /^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (embedded) {
      const hi = Number.parseInt(embedded[1]!, 16);
      const lo = Number.parseInt(embedded[2]!, 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      lower === "::" || lower === "::1" ||
      /^f[cd]/.test(lower) || // fc00::/7 unique local
      /^fe[89ab]/.test(lower) || // fe80::/10 link-local
      /^ff/.test(lower) // multicast
    );
  }
  return false;
}

/** A URL hostname that is a private IP literal or a local name. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase(); // "localhost." too
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  return isPrivateAddress(host);
}
