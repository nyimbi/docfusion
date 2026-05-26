ALTER TABLE "cost_elements" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "pricing_summaries" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "cost_technical_tracking" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "cost_elements"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "pricing_summaries"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "cost_elements"
	WHERE "cost_elements"."opportunity_id" = "pricing_summaries"."opportunity_id"
		AND "cost_elements"."organization_id" IS NOT NULL
	LIMIT 1
)
WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "cost_technical_tracking"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "cost_elements"
	WHERE "cost_elements"."opportunity_id" = "cost_technical_tracking"."opportunity_id"
		AND "cost_elements"."organization_id" IS NOT NULL
	LIMIT 1
)
WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "pricing_summaries"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "cost_technical_tracking"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_elements_organization_idx" ON "cost_elements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_summaries_organization_idx" ON "pricing_summaries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_technical_tracking_organization_idx" ON "cost_technical_tracking" USING btree ("organization_id");
