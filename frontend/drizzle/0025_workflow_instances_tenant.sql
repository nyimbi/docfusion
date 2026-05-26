ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "workflow_instances"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_instances_organization_idx" ON "workflow_instances" USING btree ("organization_id");
