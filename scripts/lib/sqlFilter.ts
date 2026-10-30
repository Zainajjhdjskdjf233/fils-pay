// E93: table and column names are pasted into SQL, so only plain identifiers pass.
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
function assertIdentifier(name: string): void {
  if (!IDENTIFIER.test(name)) throw new Error(`sqlFilter: not a plain identifier: ${JSON.stringify(name)}`);
}

export function buildWhere(
  filters: Record<string, unknown>,
): { clause: string; values: unknown[]; paramOffset: number } {
  const parts: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [col, val] of Object.entries(filters)) {
    assertIdentifier(col);
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      // E12: never drop an empty-array filter. `col = ANY('{}')` matches no rows;
      // skipping it turned "delete these 0 ids" into "DELETE FROM table".
      values.push(val);
      parts.push(`${col} = ANY($${idx}::uuid[])`);
      idx++;
    } else {
      values.push(val);
      parts.push(`${col} = $${idx}`);
      idx++;
    }
  }
  const clause = parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
  return { clause, values, paramOffset: idx };
}

export function buildDelete(
  table: string,
  filters: Record<string, unknown>,
): { text: string; values: unknown[] } {
  assertIdentifier(table);
  const { clause, values } = buildWhere(filters);
  // E93: a filter that ends up empty (only null/undefined values) would delete
  // the whole table. Refuse instead.
  if (clause === "") throw new Error(`sqlFilter: refusing DELETE FROM ${table} with no filter`);
  return { text: `DELETE FROM ${table} ${clause}`, values };
}
