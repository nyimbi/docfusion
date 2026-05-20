ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "proposal_tasks"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_tasks_organization_idx" ON "proposal_tasks" USING btree ("organization_id");
