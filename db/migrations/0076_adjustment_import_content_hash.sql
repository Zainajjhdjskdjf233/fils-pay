-- E22: the same adjustment CSV must not be applied twice. Each import stores
-- the SHA-256 of its rows; a second import with the same rows hits the
-- unique index. Imports made before this migration have NULL and never
-- conflict (a partial index).
ALTER TABLE adjustment_imports ADD COLUMN content_sha256 TEXT;

CREATE UNIQUE INDEX adjustment_imports_content_sha256_key
    ON adjustment_imports (content_sha256)
    WHERE content_sha256 IS NOT NULL;
