DO $$ BEGIN
	CREATE TYPE "scraper_job_status" AS ENUM (
		'queued',
		'running',
		'completed',
		'failed',
		'cancelled',
		'retrying'
	);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scraper_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_key" varchar(50) NOT NULL,
	"source_name" varchar(200) NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"tier" integer DEFAULT 3 NOT NULL,
	"status" "scraper_job_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"batch_id" varchar(100),
	"run_db_id" uuid,
	"error" text,
	"result" jsonb,
	"locked_by" varchar(100),
	"locked_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "scraper_jobs" ADD CONSTRAINT "scraper_jobs_source_id_scraper_sources_id_fk"
		FOREIGN KEY ("source_id") REFERENCES "public"."scraper_sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_jobs_status_next_run_idx" ON "scraper_jobs" USING btree ("status","next_run_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_jobs_priority_idx" ON "scraper_jobs" USING btree ("priority","tier","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_jobs_batch_idx" ON "scraper_jobs" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_jobs_source_idx" ON "scraper_jobs" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_jobs_lease_idx" ON "scraper_jobs" USING btree ("lease_expires_at");
