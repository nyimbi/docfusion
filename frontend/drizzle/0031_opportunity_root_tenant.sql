ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "opportunity_imports" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "opportunity_votes" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "opportunity_documents" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "opportunities"
SET "organization_id" = "user_workspaces"."organization_id"
FROM "user_workspaces"
WHERE "opportunities"."organization_id" IS NULL
	AND "opportunities"."assigned_to" = "user_workspaces"."user_id";--> statement-breakpoint
UPDATE "opportunities"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "opportunity_imports"
SET "organization_id" = "user_workspaces"."organization_id"
FROM "user_workspaces"
WHERE "opportunity_imports"."organization_id" IS NULL
	AND "opportunity_imports"."imported_by" = "user_workspaces"."user_id";--> statement-breakpoint
UPDATE "opportunity_imports"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "opportunity_votes"
SET "organization_id" = "opportunities"."organization_id"
FROM "opportunities"
WHERE "opportunity_votes"."organization_id" IS NULL
	AND "opportunity_votes"."opportunity_id" = "opportunities"."id"
	AND "opportunities"."organization_id" IS NOT NULL;--> statement-breakpoint
UPDATE "opportunity_documents"
SET "organization_id" = "opportunities"."organization_id"
FROM "opportunities"
WHERE "opportunity_documents"."organization_id" IS NULL
	AND "opportunity_documents"."opportunity_id" = "opportunities"."id"
	AND "opportunities"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_organization_idx" ON "opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imports_organization_idx" ON "opportunity_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "votes_organization_idx" ON "opportunity_votes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scores_organization_idx" ON "opportunity_ai_scores" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_docs_organization_idx" ON "opportunity_documents" USING btree ("organization_id");--> statement-breakpoint
DROP INDEX IF EXISTS "opportunities_source_id_file_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "opportunities_fingerprint_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_source_id_file_idx" ON "opportunities" USING btree ("organization_id", "source_id", "source_file");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_fingerprint_idx" ON "opportunities" USING btree ("organization_id", "fingerprint");
