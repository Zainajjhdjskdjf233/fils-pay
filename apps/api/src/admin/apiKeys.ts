import type { Pool } from "pg";
import { insertAdminAuditLog } from "../adminAudit/log.js";
import { withTransaction } from "../db/withTransaction.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

/**
 * E82 (decided): staff revoke a merchant's key but never receive a new raw
 * key — a working merchant key in staff hands bypassed read-only
 * impersonation (E10). The merchant owner issues the replacement in the
 * dashboard. Revoke and audit commit together or not at all.
 */
export async function revokeApiKeyAsAdmin(
  pool: Pool,
  input: { merchantId: string; apiKeyId: string; adminUserId: string },
): Promise<{ revokedKeyId: string }> {
  return withTransaction(pool, async (client) => {
    const revoked = await client.query<{ id: string }>(
      `UPDATE api_keys SET revoked_at = now(), revoked_reason = 'admin_revoked'
        WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [input.apiKeyId, input.merchantId],
    );
    if (!revoked.rows[0]) {
      const exists = await client.query(`SELECT 1 FROM api_keys WHERE id = $1 AND merchant_id = $2`, [input.apiKeyId, input.merchantId]);
      if ((exists.rowCount ?? 0) === 0) throw new NotFoundError("api_key_not_found");
      throw new ConflictError("api_key_already_revoked");
    }
    await insertAdminAuditLog(client, {
      adminUserId: input.adminUserId,
      action: "api_key_revoke",
      targetType: "api_key",
      targetId: input.apiKeyId,
      metadata: { merchantId: input.merchantId },
    });
    return { revokedKeyId: input.apiKeyId };
  });
}
