-- 0022_rfp_hash_per_tenant.sql
-- Swap the global rfp_documents file-hash uniqueness constraint for a
-- tenant-scoped one so different organisations can upload the same bytes.

BEGIN;

DROP INDEX IF EXISTS rfp_docs_hash_idx;

CREATE UNIQUE INDEX IF NOT EXISTS rfp_docs_org_hash_idx
	ON rfp_documents(organization_id, file_hash)
	WHERE file_hash IS NOT NULL;

COMMIT;
