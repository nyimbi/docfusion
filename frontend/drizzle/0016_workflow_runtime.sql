CREATE TABLE IF NOT EXISTS "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_key" varchar(100) NOT NULL,
	"subject_type" varchar(100) NOT NULL,
	"subject_id" varchar(200) NOT NULL,
	"opportunity_id" uuid,
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"state" varchar(100) NOT NULL,
	"priority" varchar(40) DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar(200),
	"assigned_role" varchar(100),
	"assigned_by" varchar(200),
	"assigned_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"sla_breached_at" timestamp with time zone,
	"escalated_to" varchar(200),
	"escalated_at" timestamp with time zone,
	"visibility" varchar(40) DEFAULT 'internal' NOT NULL,
	"portal_visibility" jsonb,
	"authority_policy" jsonb,
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "workflow_runtime_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"task_key" varchar(160) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"state" varchar(80) DEFAULT 'open' NOT NULL,
	"priority" varchar(40) DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar(200),
	"assigned_role" varchar(100),
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workflow_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"subject_type" varchar(100) NOT NULL,
	"subject_id" varchar(200) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"from_state" varchar(100),
	"to_state" varchar(100),
	"actor_id" varchar(200) NOT NULL,
	"actor_name" varchar(200),
	"reason" text,
	"evidence_links" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workflow_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"recipient_id" varchar(200) NOT NULL,
	"channel" varchar(40) DEFAULT 'in_app' NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"delivery_status" varchar(40) DEFAULT 'queued' NOT NULL,
	"action_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_instances_subject_idx"
	ON "workflow_instances" ("workflow_key", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "workflow_instances_opportunity_idx" ON "workflow_instances" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "workflow_instances_status_idx" ON "workflow_instances" ("status");
CREATE INDEX IF NOT EXISTS "workflow_instances_state_idx" ON "workflow_instances" ("state");
CREATE INDEX IF NOT EXISTS "workflow_instances_assigned_idx" ON "workflow_instances" ("assigned_to");
CREATE INDEX IF NOT EXISTS "workflow_instances_due_idx" ON "workflow_instances" ("due_at");
CREATE INDEX IF NOT EXISTS "workflow_instances_visibility_idx" ON "workflow_instances" ("visibility");

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_runtime_tasks_key_idx"
	ON "workflow_runtime_tasks" ("workflow_instance_id", "task_key");
CREATE INDEX IF NOT EXISTS "workflow_runtime_tasks_instance_idx" ON "workflow_runtime_tasks" ("workflow_instance_id");
CREATE INDEX IF NOT EXISTS "workflow_runtime_tasks_state_idx" ON "workflow_runtime_tasks" ("state");
CREATE INDEX IF NOT EXISTS "workflow_runtime_tasks_assigned_idx" ON "workflow_runtime_tasks" ("assigned_to");
CREATE INDEX IF NOT EXISTS "workflow_runtime_tasks_due_idx" ON "workflow_runtime_tasks" ("due_at");

CREATE INDEX IF NOT EXISTS "workflow_audit_instance_idx" ON "workflow_audit_events" ("workflow_instance_id");
CREATE INDEX IF NOT EXISTS "workflow_audit_subject_idx" ON "workflow_audit_events" ("subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "workflow_audit_event_idx" ON "workflow_audit_events" ("event_type");
CREATE INDEX IF NOT EXISTS "workflow_audit_created_idx" ON "workflow_audit_events" ("created_at");

CREATE INDEX IF NOT EXISTS "workflow_notifications_instance_idx" ON "workflow_notifications" ("workflow_instance_id");
CREATE INDEX IF NOT EXISTS "workflow_notifications_recipient_idx" ON "workflow_notifications" ("recipient_id");
CREATE INDEX IF NOT EXISTS "workflow_notifications_status_idx" ON "workflow_notifications" ("delivery_status");
CREATE INDEX IF NOT EXISTS "workflow_notifications_created_idx" ON "workflow_notifications" ("created_at");
