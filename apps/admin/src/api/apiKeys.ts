import { request } from "./client.js";

/**
 * `POST /v1/admin/merchants/:id/api-keys/:keyId/revoke` (E82).
 *
 * Staff revoke a merchant's key; they never receive a new raw key (it gave
 * staff full merchant power and bypassed read-only impersonation). The
 * merchant owner issues the replacement in the dashboard.
 */
export function revokeApiKey(merchantId: string, keyId: string): Promise<{ revokedKeyId: string }> {
  return request(
    `/v1/admin/merchants/${encodeURIComponent(merchantId)}/api-keys/${encodeURIComponent(keyId)}/revoke`,
    { method: "POST" },
  );
}
