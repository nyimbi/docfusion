CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "vector";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfp_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action,
	"filename" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"file_hash" varchar(64),
	"rfp_format" varchar(50),
	"parsing_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"parsing_progress" integer DEFAULT 0 NOT NULL,
	"parsing_error" text,
	"parsing_started_at" timestamp with time zone,
	"parsing_completed_at" timestamp with time zone,
	"extracted_title" varchar(1000),
	"issuing_organization" varchar(500),
	"solicitation_number" varchar(200),
	"response_deadline" timestamp with time zone,
	"questions_deadline" timestamp with time zone,
	"pre_proposal_date" timestamp with time zone,
	"contract_type" varchar(100),
	"naics_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"set_aside_type" varchar(100),
	"estimated_value" real,
	"period_of_performance" integer,
	"place_of_performance" text,
	"submission_instructions" text,
	"page_count" integer,
	"word_count" integer,
	"detected_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"section_l_content" text,
	"section_m_content" text,
	"statement_of_work" text,
	"ai_summary" text,
	"key_themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluation_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parsing_confidence" real,
	"extracted_text" text,
	"embedding" vector(1536),
	"uploaded_by" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfp_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_document_id" uuid REFERENCES "public"."rfp_documents"("id") ON DELETE cascade ON UPDATE no action,
	"opportunity_id" uuid REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action,
	"requirement_number" varchar(50),
	"title" varchar(500),
	"requirement_text" text NOT NULL,
	"source_quote" text,
	"source_page" integer,
	"source_section" varchar(100),
	"category" varchar(50),
	"subcategory" varchar(100),
	"requirement_type" varchar(20) DEFAULT 'shall',
	"priority" varchar(20) DEFAULT 'mandatory',
	"risk_level" varchar(20) DEFAULT 'medium',
	"evaluation_weight" real,
	"extraction_confidence" real,
	"ai_analysis" jsonb,
	"is_implicit" boolean DEFAULT false NOT NULL,
	"ambiguity_level" varchar(30),
	"clarification_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_approach" text,
	"embedding" vector(1536),
	"compliance_status" varchar(30) DEFAULT 'not_addressed' NOT NULL,
	"response_strategy" text,
	"assigned_to" varchar(100),
	"due_date" timestamp with time zone,
	"response_document_id" uuid REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action,
	"response_section" varchar(200),
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_matrices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action,
	"rfp_document_id" uuid REFERENCES "public"."rfp_documents"("id") ON DELETE set null ON UPDATE no action,
	"name" varchar(200) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"total_requirements" integer DEFAULT 0 NOT NULL,
	"mandatory_count" integer DEFAULT 0 NOT NULL,
	"compliant_count" integer DEFAULT 0 NOT NULL,
	"partial_count" integer DEFAULT 0 NOT NULL,
	"non_compliant_count" integer DEFAULT 0 NOT NULL,
	"not_addressed_count" integer DEFAULT 0 NOT NULL,
	"compliance_score" real,
	"mandatory_compliance_score" real,
	"reviewed_by" varchar(100),
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"approved_by" varchar(100),
	"approved_at" timestamp with time zone,
	"category_groups" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_columns" jsonb DEFAULT '["requirementNumber","title","category","priority","complianceStatus","responseSection","assignedTo"]'::jsonb NOT NULL,
	"export_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL REFERENCES "public"."compliance_matrices"("id") ON DELETE cascade ON UPDATE no action,
	"requirement_id" uuid NOT NULL REFERENCES "public"."rfp_requirements"("id") ON DELETE cascade ON UPDATE no action,
	"compliance_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"compliance_justification" text,
	"response_document_id" uuid REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action,
	"response_reference" varchar(200),
	"response_summary" text,
	"strength_assessment" varchar(20),
	"risk_level" varchar(20),
	"mitigation_strategy" text,
	"evidence_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"reviewer_notes" text,
	"reviewed_by" varchar(100),
	"reviewed_at" timestamp with time zone,
	"approved_by" varchar(100),
	"approved_at" timestamp with time zone,
	"assigned_to" varchar(100),
	"due_date" timestamp with time zone,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfp_parsing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_document_id" uuid NOT NULL REFERENCES "public"."rfp_documents"("id") ON DELETE cascade ON UPDATE no action,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"current_step" varchar(50),
	"progress" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_stack" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"pages_processed" integer,
	"requirements_extracted" integer,
	"processing_time_ms" integer,
	"parsing_options" jsonb DEFAULT '{"extractRequirements":true,"generateEmbeddings":true,"detectSections":true,"classifyRequirements":true}'::jsonb NOT NULL,
	"model_version" varchar(50),
	"initiated_by" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_docs_opportunity_idx" ON "rfp_documents" USING btree ("opportunity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_docs_status_idx" ON "rfp_documents" USING btree ("parsing_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_docs_format_idx" ON "rfp_documents" USING btree ("rfp_format");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_docs_deadline_idx" ON "rfp_documents" USING btree ("response_deadline");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_docs_uploaded_by_idx" ON "rfp_documents" USING btree ("uploaded_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_docs_created_idx" ON "rfp_documents" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rfp_docs_hash_idx" ON "rfp_documents" USING btree ("file_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_document_idx" ON "rfp_requirements" USING btree ("rfp_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_opportunity_idx" ON "rfp_requirements" USING btree ("opportunity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_category_idx" ON "rfp_requirements" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_priority_idx" ON "rfp_requirements" USING btree ("priority");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_status_idx" ON "rfp_requirements" USING btree ("compliance_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_assigned_idx" ON "rfp_requirements" USING btree ("assigned_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_reqs_risk_idx" ON "rfp_requirements" USING btree ("risk_level");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rfp_reqs_number_doc_idx" ON "rfp_requirements" USING btree ("rfp_document_id","requirement_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_matrix_opportunity_idx" ON "compliance_matrices" USING btree ("opportunity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_matrix_rfp_idx" ON "compliance_matrices" USING btree ("rfp_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_matrix_status_idx" ON "compliance_matrices" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_matrix_created_by_idx" ON "compliance_matrices" USING btree ("created_by");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_matrix_opp_version_idx" ON "compliance_matrices" USING btree ("opportunity_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_entry_matrix_idx" ON "compliance_entries" USING btree ("matrix_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_entry_req_idx" ON "compliance_entries" USING btree ("requirement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_entry_status_idx" ON "compliance_entries" USING btree ("compliance_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_entry_assigned_idx" ON "compliance_entries" USING btree ("assigned_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_entry_doc_idx" ON "compliance_entries" USING btree ("response_document_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_entry_matrix_req_idx" ON "compliance_entries" USING btree ("matrix_id","requirement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_jobs_document_idx" ON "rfp_parsing_jobs" USING btree ("rfp_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_jobs_status_idx" ON "rfp_parsing_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_jobs_initiated_by_idx" ON "rfp_parsing_jobs" USING btree ("initiated_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfp_jobs_queued_idx" ON "rfp_parsing_jobs" USING btree ("queued_at");
