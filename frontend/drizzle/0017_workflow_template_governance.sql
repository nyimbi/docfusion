CREATE TABLE IF NOT EXISTS "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" varchar(120) NOT NULL,
	"name" varchar(240) NOT NULL,
	"description" text,
	"subject_type" varchar(100) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(40) DEFAULT 'draft' NOT NULL,
	"states" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sla_policy" jsonb DEFAULT '{}'::jsonb,
	"notification_policy" jsonb DEFAULT '{}'::jsonb,
	"portal_policy" jsonb DEFAULT '{}'::jsonb,
	"published_at" timestamp with time zone,
	"published_by" varchar(200),
	"deprecated_at" timestamp with time zone,
	"deprecated_by" varchar(200),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_templates_key_version_idx"
	ON "workflow_templates" ("template_key", "version");
CREATE INDEX IF NOT EXISTS "workflow_templates_key_idx" ON "workflow_templates" ("template_key");
CREATE INDEX IF NOT EXISTS "workflow_templates_subject_idx" ON "workflow_templates" ("subject_type");
CREATE INDEX IF NOT EXISTS "workflow_templates_status_idx" ON "workflow_templates" ("status");
