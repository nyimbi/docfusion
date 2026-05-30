ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "task_number" varchar(50);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "task_category" varchar(100);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "requirement_id" uuid;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "volume_id" uuid;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "assigned_to_email" varchar(200);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "assigned_by" varchar(200);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "assigned_at" timestamp with time zone;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "start_date" timestamp with time zone;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "hours_logged" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "depends_on" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "blocked_by" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "blocks" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "completed_by" varchar(200);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "word_count_target" integer;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "word_count_current" integer;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "page_target" real;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "page_current" real;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "quality_score" real;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "last_reviewed_at" timestamp with time zone;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "last_reviewed_by" varchar(200);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "review_notes" text;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "compliance_requirements" jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "evaluation_criteria_ids" jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "reminders_sent" integer DEFAULT 0;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "last_reminder_at" timestamp with time zone;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "escalated" boolean DEFAULT false;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "escalated_at" timestamp with time zone;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "comments" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "source_type" varchar(50);
ALTER TABLE "proposal_tasks" ADD COLUMN IF NOT EXISTS "source_id" uuid;

ALTER TABLE "proposal_tasks"
	ALTER COLUMN "assigned_to" TYPE varchar(200)
	USING "assigned_to"::text;

UPDATE "proposal_tasks"
SET "organization_id" = "opportunities"."organization_id"
FROM "opportunities"
WHERE "proposal_tasks"."organization_id" IS NULL
	AND "proposal_tasks"."opportunity_id" = "opportunities"."id"
	AND "opportunities"."organization_id" IS NOT NULL;

UPDATE "proposal_tasks"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;

ALTER TABLE "task_activity" ADD COLUMN IF NOT EXISTS "change_field" varchar(100);
ALTER TABLE "task_activity" ADD COLUMN IF NOT EXISTS "user_id" varchar(200);
ALTER TABLE "task_activity" ADD COLUMN IF NOT EXISTS "user_name" varchar(200);
ALTER TABLE "task_activity" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

UPDATE "task_activity"
SET "user_id" = "created_by"
WHERE "user_id" IS NULL
	AND "created_by" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "proposal_tasks_organization_idx" ON "proposal_tasks" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "proposal_tasks_opportunity_idx" ON "proposal_tasks" USING btree ("opportunity_id");
CREATE INDEX IF NOT EXISTS "proposal_tasks_assigned_to_idx" ON "proposal_tasks" USING btree ("assigned_to");
CREATE INDEX IF NOT EXISTS "proposal_tasks_status_idx" ON "proposal_tasks" USING btree ("status");
CREATE INDEX IF NOT EXISTS "proposal_tasks_due_date_idx" ON "proposal_tasks" USING btree ("due_date");
CREATE INDEX IF NOT EXISTS "proposal_tasks_priority_idx" ON "proposal_tasks" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "task_activity_task_id_idx" ON "task_activity" USING btree ("task_id");
CREATE INDEX IF NOT EXISTS "task_activity_type_idx" ON "task_activity" USING btree ("activity_type");
CREATE INDEX IF NOT EXISTS "task_activity_created_at_idx" ON "task_activity" USING btree ("created_at");
