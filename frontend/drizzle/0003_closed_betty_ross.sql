CREATE TABLE "ai_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"organization_id" varchar(100),
	"primary_model" varchar(100) DEFAULT 'gpt-4' NOT NULL,
	"fallback_model" varchar(100) DEFAULT 'gpt-3.5-turbo' NOT NULL,
	"temperature" real DEFAULT 0.7 NOT NULL,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"streaming_enabled" boolean DEFAULT true NOT NULL,
	"auto_suggest" boolean DEFAULT true NOT NULL,
	"suggestion_frequency" varchar(20) DEFAULT 'medium' NOT NULL,
	"custom_instructions" text,
	"writing_style" varchar(50) DEFAULT 'formal' NOT NULL,
	"response_format" varchar(20) DEFAULT 'mixed' NOT NULL,
	"features" jsonb DEFAULT '{"completion":true,"editing":true,"summarization":true,"analysis":true,"generation":true,"translation":true,"evaluation":true}'::jsonb NOT NULL,
	"usage_limits" jsonb DEFAULT '{"dailyRequests":100,"totalBudget":null}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"organization_id" varchar(100),
	"name" varchar(200) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"scopes" jsonb DEFAULT '["read","write"]'::jsonb NOT NULL,
	"rate_limit" integer DEFAULT 60 NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"ip_restrictions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(500) NOT NULL,
	"legal_name" varchar(500),
	"registration_number" varchar(100),
	"tax_id" varchar(100),
	"duns_number" varchar(20),
	"cage_code" varchar(10),
	"sam_uei" varchar(20),
	"naics_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industry_description" text,
	"year_founded" integer,
	"employee_count" integer,
	"annual_revenue" varchar(100),
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"website" varchar(500),
	"address_line_1" varchar(500),
	"address_line_2" varchar(500),
	"city" varchar(200),
	"state_province" varchar(100),
	"postal_code" varchar(50),
	"country" varchar(100),
	"primary_contact_name" varchar(200),
	"primary_contact_title" varchar(200),
	"primary_contact_email" varchar(200),
	"primary_contact_phone" varchar(50),
	"contracts_contact_name" varchar(200),
	"contracts_contact_email" varchar(200),
	"contracts_contact_phone" varchar(50),
	"core_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"differentiators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"past_performance_summary" text,
	"company_boilerplate" text,
	"logo_url" text,
	"primary_color" varchar(10),
	"secondary_color" varchar(10),
	"default_branding" jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"export_type" varchar(50) NOT NULL,
	"data_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format" varchar(20) DEFAULT 'json' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"download_url" text,
	"file_size" integer,
	"expires_at" timestamp with time zone,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_defaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"organization_id" varchar(100),
	"default_paper_size" varchar(20) DEFAULT 'A4' NOT NULL,
	"default_orientation" varchar(20) DEFAULT 'portrait' NOT NULL,
	"default_font" varchar(100) DEFAULT 'Inter' NOT NULL,
	"default_font_size" real DEFAULT 11 NOT NULL,
	"default_line_spacing" varchar(20) DEFAULT '1.5' NOT NULL,
	"default_margins" jsonb DEFAULT '{"top":72,"bottom":72,"left":72,"right":72}'::jsonb NOT NULL,
	"default_template_id" uuid,
	"page_numbering" boolean DEFAULT true NOT NULL,
	"page_number_position" varchar(50) DEFAULT 'bottom-center' NOT NULL,
	"default_header" text,
	"default_footer" text,
	"default_cover_page" boolean DEFAULT false NOT NULL,
	"default_cover_page_template" varchar(100),
	"watermark_text" varchar(200),
	"export_formats" jsonb DEFAULT '{"pdf":true,"docx":true,"xlsx":true,"pptx":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"company_name" varchar(500) NOT NULL,
	"tagline" varchar(500),
	"website" varchar(500),
	"primary_color" varchar(10) DEFAULT '#0066CC' NOT NULL,
	"secondary_color" varchar(10) DEFAULT '#00A3E0' NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"custom_css" text,
	"default_template_id" uuid,
	"default_language" varchar(10) DEFAULT 'en' NOT NULL,
	"default_currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"default_date_format" varchar(50) DEFAULT 'MMM d, yyyy' NOT NULL,
	"proposal_expiry_days" integer DEFAULT 30 NOT NULL,
	"auto_archive" boolean DEFAULT false NOT NULL,
	"archive_after_days" integer,
	"require_approval" boolean DEFAULT true NOT NULL,
	"default_sharing" varchar(50) DEFAULT 'private' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "template_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"changes" jsonb NOT NULL,
	"version_number" integer,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_partials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"content" jsonb NOT NULL,
	"placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage" jsonb DEFAULT '{"templateIds":[],"useCount":0}'::jsonb NOT NULL,
	"created_by" varchar(100) NOT NULL,
	"organization_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"shortcut" varchar(50) NOT NULL,
	"content" jsonb NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" varchar(100),
	"created_by" varchar(100) NOT NULL,
	"organization_id" varchar(100),
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change_description" text,
	"created_by" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"theme" varchar(20) DEFAULT 'system' NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"push_notifications" boolean DEFAULT false NOT NULL,
	"in_app_notifications" boolean DEFAULT true NOT NULL,
	"digest_frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"date_format" varchar(50) DEFAULT 'MMM d, yyyy' NOT NULL,
	"time_format" varchar(10) DEFAULT '12h' NOT NULL,
	"week_start" varchar(20) DEFAULT 'monday' NOT NULL,
	"density" varchar(20) DEFAULT 'comfortable' NOT NULL,
	"font_size" varchar(20) DEFAULT 'medium' NOT NULL,
	"accent_color" varchar(20) DEFAULT 'blue' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"ai_config" jsonb,
	"notification_types" jsonb DEFAULT '{"email":true,"push":false,"documentShared":true,"documentComment":true,"opportunityAlert":true,"deadlineReminder":true,"systemUpdate":true,"teamActivity":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"token" varchar(500) NOT NULL,
	"device_name" varchar(200),
	"device_type" varchar(20),
	"os" varchar(100),
	"browser" varchar(100),
	"ip_address" varchar(45),
	"location" varchar(200),
	"is_current" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '{"canCreateDocuments":true,"canEditTemplates":false,"canManageUsers":false,"canViewAnalytics":false,"canManageSettings":false,"canDeleteContent":false}'::jsonb NOT NULL,
	"config" jsonb,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"organization_id" varchar(100),
	"name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" varchar(500),
	"content_type" varchar(50) DEFAULT 'application/json' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ssl_verify" boolean DEFAULT true NOT NULL,
	"retry_count" integer DEFAULT 3 NOT NULL,
	"last_delivery_at" timestamp with time zone,
	"last_delivery_status" varchar(20),
	"deliveries" jsonb DEFAULT '{"successCount":0,"failureCount":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo" text,
	"website" text,
	"industry" text,
	"size" text,
	"location" text,
	"founded_year" text,
	"contact_email" text,
	"contact_phone" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"organization_id" text,
	"role" text DEFAULT 'member' NOT NULL,
	"department" text,
	"job_title" text,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"bio" text,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(500) NOT NULL,
	"industry" varchar(200),
	"size" varchar(100),
	"location" varchar(300),
	"contact_name" varchar(200),
	"contact_email" varchar(200),
	"contact_phone" varchar(50),
	"relationship_type" varchar(100),
	"contract_value" real,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" varchar(20) DEFAULT 'prospect' NOT NULL,
	"notes" text,
	"projects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"mission" text,
	"vision" text,
	"founded" integer,
	"employees" varchar(100),
	"revenue" varchar(100),
	"website" varchar(500),
	"industry" varchar(200),
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"awards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_clients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(100),
	"organization_id" varchar(100) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"title" varchar(200),
	"summary" text,
	"experience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"education" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"projects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email" varchar(200),
	"phone" varchar(50),
	"linkedin_url" text,
	"portfolio_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(500) NOT NULL,
	"category" varchar(200),
	"description" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing" text,
	"availability" varchar(100),
	"documentation" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"department" varchar(200),
	"level" varchar(50),
	"responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills_required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(500) NOT NULL,
	"category" varchar(200),
	"description" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing" text,
	"turnaround" varchar(200),
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"reaction" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"section_id" uuid,
	"proposal_document_id" uuid,
	"stage" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(100) NOT NULL,
	"sequence_order" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"rejection_reason" text,
	"previous_approval_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"section_id" uuid,
	"user_id" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(20) DEFAULT 'comment' NOT NULL,
	"parent_id" uuid,
	"position" jsonb,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(100),
	"is_edited" varchar(10) DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" varchar(10) DEFAULT 'false' NOT NULL,
	"organization_id" varchar(100),
	"document_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"workflow_id" uuid,
	"stage" varchar(20) NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"sequence_order" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"is_active" varchar(10) DEFAULT 'true' NOT NULL,
	"assigned_by" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_edits" ADD CONSTRAINT "template_edits_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_document_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."document_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_section_id_document_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."document_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_proposal_document_id_proposal_documents_id_fk" FOREIGN KEY ("proposal_document_id") REFERENCES "public"."proposal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_section_id_document_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."document_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_workflow_id_document_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."document_workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_prefs_user_idx" ON "ai_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_prefs_org_idx" ON "ai_preferences" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prefs_user_org_idx" ON "ai_preferences" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_org_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "exports_user_idx" ON "data_exports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exports_status_idx" ON "data_exports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "doc_defaults_user_idx" ON "document_defaults" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doc_defaults_org_idx" ON "document_defaults" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_defaults_user_org_idx" ON "document_defaults" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "org_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "edits_template_idx" ON "template_edits" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "edits_user_idx" ON "template_edits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "edits_type_idx" ON "template_edits" USING btree ("type");--> statement-breakpoint
CREATE INDEX "edits_created_idx" ON "template_edits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "partials_created_by_idx" ON "template_partials" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "partials_org_idx" ON "template_partials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "snippets_created_by_idx" ON "template_snippets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "snippets_org_idx" ON "template_snippets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "snippets_category_idx" ON "template_snippets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "snippets_use_count_idx" ON "template_snippets" USING btree ("use_count");--> statement-breakpoint
CREATE INDEX "snippets_is_public_idx" ON "template_snippets" USING btree ("is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "snippets_shortcut_org_idx" ON "template_snippets" USING btree ("shortcut","organization_id");--> statement-breakpoint
CREATE INDEX "template_versions_template_idx" ON "template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_number_idx" ON "template_versions" USING btree ("template_id","version_number");--> statement-breakpoint
CREATE INDEX "preferences_user_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "user_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "workspaces_user_idx" ON "user_workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_org_idx" ON "user_workspaces" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_user_org_slug_idx" ON "user_workspaces" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "webhooks_user_idx" ON "webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webhooks_org_idx" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhooks_active_idx" ON "webhooks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_org_idx" ON "user" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "clients_org_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_industry_idx" ON "clients" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "company_profiles_org_idx" ON "company_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cvs_user_idx" ON "cvs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cvs_org_idx" ON "cvs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cvs_active_idx" ON "cvs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "products_org_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "roles_org_idx" ON "roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "roles_department_idx" ON "roles" USING btree ("department");--> statement-breakpoint
CREATE INDEX "services_org_idx" ON "services" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "services_status_idx" ON "services" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_comment_user_idx" ON "comment_reactions" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "reactions_comment_idx" ON "comment_reactions" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "approvals_document_idx" ON "document_approvals" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "approvals_section_idx" ON "document_approvals" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "approvals_proposal_doc_idx" ON "document_approvals" USING btree ("proposal_document_id");--> statement-breakpoint
CREATE INDEX "approvals_stage_idx" ON "document_approvals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "document_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approvals_assigned_idx" ON "document_approvals" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "approvals_due_date_idx" ON "document_approvals" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "approvals_completed_idx" ON "document_approvals" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "comments_document_idx" ON "document_comments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "comments_section_idx" ON "document_comments" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "document_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "document_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_type_idx" ON "document_comments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "comments_resolved_idx" ON "document_comments" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "comments_created_idx" ON "document_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflows_org_idx" ON "document_workflows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflows_default_idx" ON "document_workflows" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "workflows_type_idx" ON "document_workflows" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "assignments_document_idx" ON "workflow_assignments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "assignments_workflow_idx" ON "workflow_assignments" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "assignments_stage_idx" ON "workflow_assignments" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "assignments_user_idx" ON "workflow_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_doc_stage_seq_idx" ON "workflow_assignments" USING btree ("document_id","stage","sequence_order");