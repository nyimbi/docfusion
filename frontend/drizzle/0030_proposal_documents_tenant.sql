ALTER TABLE "proposal_documents" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "document_sections" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "proposal_documents"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "document_sections"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "proposal_documents"
	WHERE "proposal_documents"."id" = "document_sections"."proposal_document_id"
		AND "proposal_documents"."organization_id" IS NOT NULL
	LIMIT 1
)
WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "document_sections"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_docs_organization_idx" ON "proposal_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_sections_organization_idx" ON "document_sections" USING btree ("organization_id");
