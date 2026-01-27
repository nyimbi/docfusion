CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar(50),
	"title" varchar(1000) NOT NULL,
	"category" varchar(200),
	"it_category" varchar(200),
	"sector" varchar(100),
	"country_region" varchar(200),
	"organization" varchar(500),
	"funder" varchar(500),
	"deadline" timestamp with time zone,
	"days_left" integer,
	"is_expired" boolean DEFAULT false NOT NULL,
	"budget_value" varchar(200),
	"budget_numeric" real,
	"budget_currency" varchar(10),
	"project_summary" text,
	"project_scope" text,
	"key_requirements" text,
	"technical_requirements" text,
	"submission_method" varchar(200),
	"submission_requirements" text,
	"rfp_link" text,
	"source_platform" varchar(200),
	"source_file" varchar(500),
	"opportunity_type" varchar(50) DEFAULT 'rfp' NOT NULL,
	"priority_rank" integer DEFAULT 3,
	"fit_score" real,
	"win_probability" real,
	"revenue_potential" varchar(20),
	"strategic_notes" text,
	"decision_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"assigned_to" varchar(200),
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_path" text,
	"total_records" integer DEFAULT 0 NOT NULL,
	"imported_records" integer DEFAULT 0 NOT NULL,
	"updated_records" integer DEFAULT 0 NOT NULL,
	"skipped_records" integer DEFAULT 0 NOT NULL,
	"failed_records" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"config" jsonb,
	"imported_by" varchar(200) DEFAULT 'system' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "opportunities_deadline_idx" ON "opportunities" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "opportunities_category_idx" ON "opportunities" USING btree ("category");--> statement-breakpoint
CREATE INDEX "opportunities_country_idx" ON "opportunities" USING btree ("country_region");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("decision_status");--> statement-breakpoint
CREATE INDEX "opportunities_priority_idx" ON "opportunities" USING btree ("priority_rank");--> statement-breakpoint
CREATE INDEX "opportunities_fit_score_idx" ON "opportunities" USING btree ("fit_score");--> statement-breakpoint
CREATE INDEX "opportunities_source_idx" ON "opportunities" USING btree ("source_file");--> statement-breakpoint
CREATE INDEX "opportunities_expired_idx" ON "opportunities" USING btree ("is_expired");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_source_id_file_idx" ON "opportunities" USING btree ("source_id","source_file");--> statement-breakpoint
CREATE INDEX "imports_status_idx" ON "opportunity_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "imports_started_idx" ON "opportunity_imports" USING btree ("started_at");