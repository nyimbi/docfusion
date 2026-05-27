-- 0032_live_response_persistence_tenant_repair.sql
-- Idempotent tenant-column repair for live persisted import-to-response paths.
-- Some live databases predate the opportunity/proposal tenant migrations while
-- the application schema already writes tenant-scoped rows.

BEGIN;

ALTER TABLE IF EXISTS "proposal_documents" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE IF EXISTS "document_sections" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE IF EXISTS "opportunities" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE IF EXISTS "opportunity_imports" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE IF EXISTS "opportunity_votes" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE IF EXISTS "opportunity_documents" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE IF EXISTS "opportunity_ai_scores" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);

UPDATE "proposal_documents"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;

UPDATE "document_sections"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "proposal_documents"
	WHERE "proposal_documents"."id" = "document_sections"."proposal_document_id"
		AND "proposal_documents"."organization_id" IS NOT NULL
	LIMIT 1
)
WHERE "organization_id" IS NULL;

UPDATE "document_sections"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;

UPDATE "opportunities"
SET "organization_id" = "user_workspaces"."organization_id"
FROM "user_workspaces"
WHERE "opportunities"."organization_id" IS NULL
	AND "opportunities"."assigned_to" = "user_workspaces"."user_id";

UPDATE "opportunities"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;

UPDATE "opportunity_imports"
SET "organization_id" = "user_workspaces"."organization_id"
FROM "user_workspaces"
WHERE "opportunity_imports"."organization_id" IS NULL
	AND "opportunity_imports"."imported_by" = "user_workspaces"."user_id";

UPDATE "opportunity_imports"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;

UPDATE "opportunity_votes"
SET "organization_id" = "opportunities"."organization_id"
FROM "opportunities"
WHERE "opportunity_votes"."organization_id" IS NULL
	AND "opportunity_votes"."opportunity_id" = "opportunities"."id"
	AND "opportunities"."organization_id" IS NOT NULL;

UPDATE "opportunity_documents"
SET "organization_id" = "opportunities"."organization_id"
FROM "opportunities"
WHERE "opportunity_documents"."organization_id" IS NULL
	AND "opportunity_documents"."opportunity_id" = "opportunities"."id"
	AND "opportunities"."organization_id" IS NOT NULL;

UPDATE "opportunity_ai_scores"
SET "organization_id" = "opportunities"."organization_id"
FROM "opportunities"
WHERE "opportunity_ai_scores"."organization_id" IS NULL
	AND "opportunity_ai_scores"."opportunity_id" = "opportunities"."id"
	AND "opportunities"."organization_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "proposal_docs_organization_idx" ON "proposal_documents" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "doc_sections_organization_idx" ON "document_sections" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "opportunities_organization_idx" ON "opportunities" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "imports_organization_idx" ON "opportunity_imports" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "votes_organization_idx" ON "opportunity_votes" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "ai_scores_organization_idx" ON "opportunity_ai_scores" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "opp_docs_organization_idx" ON "opportunity_documents" USING btree ("organization_id");

DROP INDEX IF EXISTS "opportunities_source_id_file_idx";
DROP INDEX IF EXISTS "opportunities_fingerprint_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_source_id_file_idx"
	ON "opportunities" USING btree ("organization_id", "source_id", "source_file");
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_fingerprint_idx"
	ON "opportunities" USING btree ("organization_id", "fingerprint");

COMMIT;
