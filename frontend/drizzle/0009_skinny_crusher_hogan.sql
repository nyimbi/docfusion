CREATE TYPE "public"."scraper_health_status" AS ENUM('healthy', 'degraded', 'failing', 'unknown', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."scraper_run_status" AS ENUM('pending', 'running', 'success', 'partial', 'failed', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scraper_source_type" AS ENUM('mdb', 'un_agency', 'aggregator', 'government', 'regional', 'bilateral', 'ngo', 'commercial');--> statement-breakpoint
CREATE TABLE "bibliography_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"cite_key" varchar(100) NOT NULL,
	"entry_type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"editors" jsonb,
	"journal" varchar(500),
	"booktitle" varchar(500),
	"publisher" varchar(500),
	"year" integer NOT NULL,
	"month" varchar(20),
	"volume" varchar(50),
	"number" varchar(50),
	"pages" varchar(50),
	"edition" varchar(50),
	"series" varchar(200),
	"chapter" varchar(100),
	"doi" varchar(200),
	"isbn" varchar(50),
	"issn" varchar(50),
	"url" text,
	"arxiv_id" varchar(50),
	"pmid" varchar(20),
	"abstract" text,
	"keywords" jsonb,
	"note" text,
	"address" varchar(500),
	"institution" varchar(500),
	"school" varchar(500),
	"organization" varchar(500),
	"citation_count" integer DEFAULT 0 NOT NULL,
	"last_cited_at" timestamp with time zone,
	"ai_summary" text,
	"ai_key_terms" jsonb,
	"relevance_score" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citation_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"user_id" uuid,
	"organization_id" uuid,
	"default_style" varchar(20) DEFAULT 'apa' NOT NULL,
	"include_url" boolean DEFAULT true NOT NULL,
	"include_doi" boolean DEFAULT true NOT NULL,
	"include_access_date" boolean DEFAULT false NOT NULL,
	"sort_order" varchar(20) DEFAULT 'author' NOT NULL,
	"custom_settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"bibliography_entry_id" uuid NOT NULL,
	"citation_style" varchar(20),
	"formatted_citation" text,
	"in_text_citation" text,
	"section_id" varchar(100),
	"page_number" integer,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_key" varchar(50) NOT NULL,
	"run_id" varchar(100) NOT NULL,
	"batch_id" varchar(100),
	"trigger_type" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_seconds" real,
	"status" "scraper_run_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"opportunities_found" integer DEFAULT 0 NOT NULL,
	"opportunities_new" integer DEFAULT 0 NOT NULL,
	"opportunities_updated" integer DEFAULT 0 NOT NULL,
	"opportunities_skipped" integer DEFAULT 0 NOT NULL,
	"opportunities_failed" integer DEFAULT 0 NOT NULL,
	"pages_scraped" integer DEFAULT 0 NOT NULL,
	"requests_made" integer DEFAULT 0 NOT NULL,
	"rate_limit_hits" integer DEFAULT 0 NOT NULL,
	"bytes_downloaded" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_type" varchar(50),
	"error_log" jsonb,
	"warnings" jsonb,
	"data_quality_score" real,
	"sample_data" jsonb,
	"run_config" jsonb,
	"performance_metrics" jsonb
);
--> statement-breakpoint
CREATE TABLE "scraper_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"cron_expression" varchar(50) NOT NULL,
	"description" text,
	"max_concurrent" integer DEFAULT 3 NOT NULL,
	"timeout_minutes" integer DEFAULT 30 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraper_schedules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scraper_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"source_type" "scraper_source_type" DEFAULT 'aggregator' NOT NULL,
	"coverage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" varchar(10) DEFAULT 'en',
	"scraper_class" varchar(200),
	"rate_limit" real DEFAULT 1 NOT NULL,
	"timeout" integer DEFAULT 30 NOT NULL,
	"max_pages" integer DEFAULT 10 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"requires_javascript" boolean DEFAULT false NOT NULL,
	"requires_auth" boolean DEFAULT false NOT NULL,
	"requires_proxy" boolean DEFAULT false NOT NULL,
	"schedule_tier" integer DEFAULT 3 NOT NULL,
	"cron_expression" varchar(50),
	"priority" integer DEFAULT 2 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"health_status" "scraper_health_status" DEFAULT 'unknown' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_error" text,
	"total_opportunities_scraped" integer DEFAULT 0 NOT NULL,
	"last_opportunities_count" integer DEFAULT 0,
	"successful_runs" integer DEFAULT 0 NOT NULL,
	"failed_runs" integer DEFAULT 0 NOT NULL,
	"avg_run_duration_seconds" real,
	"success_rate" real,
	"avg_opportunities_per_run" real,
	"unique_opportunities_contributed" integer DEFAULT 0 NOT NULL,
	"data_quality_score" real,
	"value_score" real,
	"notes" text,
	"config" jsonb,
	"auth_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraper_sources_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "source" varchar(50);--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "notice_id" varchar(100);--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "portal_url" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "document_url" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "published_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "citation_preferences" ADD CONSTRAINT "citation_preferences_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_citations" ADD CONSTRAINT "document_citations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_citations" ADD CONSTRAINT "document_citations_bibliography_entry_id_bibliography_entries_id_fk" FOREIGN KEY ("bibliography_entry_id") REFERENCES "public"."bibliography_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_runs" ADD CONSTRAINT "scraper_runs_source_id_scraper_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."scraper_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bib_entries_org_idx" ON "bibliography_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bib_entries_type_idx" ON "bibliography_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "bib_entries_year_idx" ON "bibliography_entries" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "bib_entries_cite_key_org_idx" ON "bibliography_entries" USING btree ("cite_key","organization_id");--> statement-breakpoint
CREATE INDEX "cite_prefs_doc_idx" ON "citation_preferences" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "cite_prefs_user_idx" ON "citation_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doc_citations_doc_idx" ON "document_citations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_citations_entry_idx" ON "document_citations" USING btree ("bibliography_entry_id");--> statement-breakpoint
CREATE INDEX "scraper_runs_source_idx" ON "scraper_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "scraper_runs_source_key_idx" ON "scraper_runs" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "scraper_runs_run_id_idx" ON "scraper_runs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "scraper_runs_batch_idx" ON "scraper_runs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "scraper_runs_status_idx" ON "scraper_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scraper_runs_started_idx" ON "scraper_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scraper_sources_source_id_idx" ON "scraper_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "scraper_sources_type_idx" ON "scraper_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "scraper_sources_tier_idx" ON "scraper_sources" USING btree ("schedule_tier");--> statement-breakpoint
CREATE INDEX "scraper_sources_enabled_idx" ON "scraper_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "scraper_sources_health_idx" ON "scraper_sources" USING btree ("health_status");--> statement-breakpoint
CREATE INDEX "scraper_sources_last_run_idx" ON "scraper_sources" USING btree ("last_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_fingerprint_idx" ON "opportunities" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "opportunities_source_source_id_idx" ON "opportunities" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "opportunities_scraped_at_idx" ON "opportunities" USING btree ("scraped_at");