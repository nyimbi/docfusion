ALTER TABLE "capture_pipeline" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "gate_reviews" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "capture_pipeline"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "gate_reviews"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "capture_pipeline"
	WHERE "capture_pipeline"."id" = "gate_reviews"."pipeline_id"
	LIMIT 1
)
WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capture_pipeline_organization_idx" ON "capture_pipeline" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gate_reviews_organization_idx" ON "gate_reviews" USING btree ("organization_id");
