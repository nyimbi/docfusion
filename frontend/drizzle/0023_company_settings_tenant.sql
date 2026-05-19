ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "company_settings"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_settings_org_idx" ON "company_settings" USING btree ("organization_id");
