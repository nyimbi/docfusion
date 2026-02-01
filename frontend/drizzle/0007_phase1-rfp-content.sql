CREATE TABLE "compliance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"compliance_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"compliance_justification" text,
	"response_document_id" uuid,
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
CREATE TABLE "compliance_matrices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"rfp_document_id" uuid,
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
CREATE TABLE "rfp_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
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
CREATE TABLE "rfp_parsing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_document_id" uuid NOT NULL,
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
CREATE TABLE "rfp_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_document_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"requirement_number" varchar(50) NOT NULL,
	"title" varchar(500),
	"requirement_text" text NOT NULL,
	"source_quote" text,
	"source_page" integer,
	"source_section" varchar(100),
	"category" varchar(50) NOT NULL,
	"subcategory" varchar(100),
	"requirement_type" varchar(20) DEFAULT 'shall' NOT NULL,
	"priority" varchar(20) DEFAULT 'mandatory' NOT NULL,
	"risk_level" varchar(20) DEFAULT 'medium' NOT NULL,
	"evaluation_weight" real,
	"extraction_confidence" real,
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
	"response_document_id" uuid,
	"response_section" varchar(200),
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"snippet_id" uuid,
	"template_id" uuid,
	"document_section" varchar(200),
	"context_text" text,
	"relevance_score" real NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"reasoning" text,
	"user_action" varchar(20) DEFAULT 'pending' NOT NULL,
	"action_at" timestamp with time zone,
	"action_by" varchar(100),
	"was_helpful" boolean,
	"model_version" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partial_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partial_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"plain_text" text NOT NULL,
	"model_version" varchar(50) DEFAULT 'text-embedding-ada-002' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippet_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snippet_id" uuid NOT NULL,
	"ai_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_type" varchar(50),
	"topic_category" varchar(100),
	"sectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compliance_frameworks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"freshness_status" varchar(20) DEFAULT 'current' NOT NULL,
	"review_due_date" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"quality_score" real,
	"word_count" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"loss_count" integer DEFAULT 0 NOT NULL,
	"win_rate" real,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippet_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snippet_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"plain_text" text NOT NULL,
	"model_version" varchar(50) DEFAULT 'text-embedding-ada-002' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippet_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snippet_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"usage_type" varchar(30) DEFAULT 'inserted' NOT NULL,
	"document_section" varchar(200),
	"was_modified" boolean DEFAULT false NOT NULL,
	"proposal_outcome" varchar(30) DEFAULT 'pending' NOT NULL,
	"outcome_recorded_at" timestamp with time zone,
	"used_by" varchar(100) NOT NULL,
	"discovery_method" varchar(30),
	"search_query" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"ai_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rfp_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"loss_count" integer DEFAULT 0 NOT NULL,
	"win_rate" real,
	"average_evaluator_score" real,
	"average_quality_score" real,
	"user_satisfaction" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"plain_text" text NOT NULL,
	"model_version" varchar(50) DEFAULT 'text-embedding-ada-002' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"proposal_outcome" varchar(30) DEFAULT 'pending' NOT NULL,
	"outcome_recorded_at" timestamp with time zone,
	"evaluator_feedback" text,
	"used_by" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_entries" ADD CONSTRAINT "compliance_entries_matrix_id_compliance_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "public"."compliance_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_entries" ADD CONSTRAINT "compliance_entries_requirement_id_rfp_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."rfp_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_entries" ADD CONSTRAINT "compliance_entries_response_document_id_documents_id_fk" FOREIGN KEY ("response_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_matrices" ADD CONSTRAINT "compliance_matrices_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_matrices" ADD CONSTRAINT "compliance_matrices_rfp_document_id_rfp_documents_id_fk" FOREIGN KEY ("rfp_document_id") REFERENCES "public"."rfp_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_documents" ADD CONSTRAINT "rfp_documents_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_parsing_jobs" ADD CONSTRAINT "rfp_parsing_jobs_rfp_document_id_rfp_documents_id_fk" FOREIGN KEY ("rfp_document_id") REFERENCES "public"."rfp_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_requirements" ADD CONSTRAINT "rfp_requirements_rfp_document_id_rfp_documents_id_fk" FOREIGN KEY ("rfp_document_id") REFERENCES "public"."rfp_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_requirements" ADD CONSTRAINT "rfp_requirements_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_requirements" ADD CONSTRAINT "rfp_requirements_response_document_id_documents_id_fk" FOREIGN KEY ("response_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_snippet_id_template_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."template_snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partial_embeddings" ADD CONSTRAINT "partial_embeddings_partial_id_template_partials_id_fk" FOREIGN KEY ("partial_id") REFERENCES "public"."template_partials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet_analytics" ADD CONSTRAINT "snippet_analytics_snippet_id_template_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."template_snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet_embeddings" ADD CONSTRAINT "snippet_embeddings_snippet_id_template_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."template_snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet_usage_log" ADD CONSTRAINT "snippet_usage_log_snippet_id_template_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."template_snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet_usage_log" ADD CONSTRAINT "snippet_usage_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet_usage_log" ADD CONSTRAINT "snippet_usage_log_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_analytics" ADD CONSTRAINT "template_analytics_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_embeddings" ADD CONSTRAINT "template_embeddings_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_usage_log" ADD CONSTRAINT "template_usage_log_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_usage_log" ADD CONSTRAINT "template_usage_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_usage_log" ADD CONSTRAINT "template_usage_log_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_entry_matrix_idx" ON "compliance_entries" USING btree ("matrix_id");--> statement-breakpoint
CREATE INDEX "compliance_entry_req_idx" ON "compliance_entries" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "compliance_entry_status_idx" ON "compliance_entries" USING btree ("compliance_status");--> statement-breakpoint
CREATE INDEX "compliance_entry_assigned_idx" ON "compliance_entries" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "compliance_entry_doc_idx" ON "compliance_entries" USING btree ("response_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_entry_matrix_req_idx" ON "compliance_entries" USING btree ("matrix_id","requirement_id");--> statement-breakpoint
CREATE INDEX "compliance_matrix_opportunity_idx" ON "compliance_matrices" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "compliance_matrix_rfp_idx" ON "compliance_matrices" USING btree ("rfp_document_id");--> statement-breakpoint
CREATE INDEX "compliance_matrix_status_idx" ON "compliance_matrices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compliance_matrix_created_by_idx" ON "compliance_matrices" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_matrix_opp_version_idx" ON "compliance_matrices" USING btree ("opportunity_id","version");--> statement-breakpoint
CREATE INDEX "rfp_docs_opportunity_idx" ON "rfp_documents" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "rfp_docs_status_idx" ON "rfp_documents" USING btree ("parsing_status");--> statement-breakpoint
CREATE INDEX "rfp_docs_format_idx" ON "rfp_documents" USING btree ("rfp_format");--> statement-breakpoint
CREATE INDEX "rfp_docs_deadline_idx" ON "rfp_documents" USING btree ("response_deadline");--> statement-breakpoint
CREATE INDEX "rfp_docs_uploaded_by_idx" ON "rfp_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "rfp_docs_created_idx" ON "rfp_documents" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rfp_docs_hash_idx" ON "rfp_documents" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "rfp_jobs_document_idx" ON "rfp_parsing_jobs" USING btree ("rfp_document_id");--> statement-breakpoint
CREATE INDEX "rfp_jobs_status_idx" ON "rfp_parsing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rfp_jobs_initiated_by_idx" ON "rfp_parsing_jobs" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX "rfp_jobs_queued_idx" ON "rfp_parsing_jobs" USING btree ("queued_at");--> statement-breakpoint
CREATE INDEX "rfp_reqs_document_idx" ON "rfp_requirements" USING btree ("rfp_document_id");--> statement-breakpoint
CREATE INDEX "rfp_reqs_opportunity_idx" ON "rfp_requirements" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "rfp_reqs_category_idx" ON "rfp_requirements" USING btree ("category");--> statement-breakpoint
CREATE INDEX "rfp_reqs_priority_idx" ON "rfp_requirements" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "rfp_reqs_status_idx" ON "rfp_requirements" USING btree ("compliance_status");--> statement-breakpoint
CREATE INDEX "rfp_reqs_assigned_idx" ON "rfp_requirements" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "rfp_reqs_risk_idx" ON "rfp_requirements" USING btree ("risk_level");--> statement-breakpoint
CREATE UNIQUE INDEX "rfp_reqs_number_doc_idx" ON "rfp_requirements" USING btree ("rfp_document_id","requirement_number");--> statement-breakpoint
CREATE INDEX "suggestions_document_idx" ON "content_suggestions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "suggestions_snippet_idx" ON "content_suggestions" USING btree ("snippet_id");--> statement-breakpoint
CREATE INDEX "suggestions_template_idx" ON "content_suggestions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "suggestions_action_idx" ON "content_suggestions" USING btree ("user_action");--> statement-breakpoint
CREATE INDEX "suggestions_relevance_idx" ON "content_suggestions" USING btree ("relevance_score");--> statement-breakpoint
CREATE UNIQUE INDEX "partial_embeddings_partial_idx" ON "partial_embeddings" USING btree ("partial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snippet_analytics_snippet_idx" ON "snippet_analytics" USING btree ("snippet_id");--> statement-breakpoint
CREATE INDEX "snippet_analytics_type_idx" ON "snippet_analytics" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "snippet_analytics_freshness_idx" ON "snippet_analytics" USING btree ("freshness_status");--> statement-breakpoint
CREATE INDEX "snippet_analytics_quality_idx" ON "snippet_analytics" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "snippet_analytics_win_rate_idx" ON "snippet_analytics" USING btree ("win_rate");--> statement-breakpoint
CREATE UNIQUE INDEX "snippet_embeddings_snippet_idx" ON "snippet_embeddings" USING btree ("snippet_id");--> statement-breakpoint
CREATE INDEX "snippet_embeddings_generated_idx" ON "snippet_embeddings" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "snippet_usage_snippet_idx" ON "snippet_usage_log" USING btree ("snippet_id");--> statement-breakpoint
CREATE INDEX "snippet_usage_document_idx" ON "snippet_usage_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "snippet_usage_opportunity_idx" ON "snippet_usage_log" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "snippet_usage_outcome_idx" ON "snippet_usage_log" USING btree ("proposal_outcome");--> statement-breakpoint
CREATE INDEX "snippet_usage_used_by_idx" ON "snippet_usage_log" USING btree ("used_by");--> statement-breakpoint
CREATE INDEX "snippet_usage_created_idx" ON "snippet_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "template_analytics_template_idx" ON "template_analytics" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_analytics_win_rate_idx" ON "template_analytics" USING btree ("win_rate");--> statement-breakpoint
CREATE UNIQUE INDEX "template_embeddings_template_idx" ON "template_embeddings" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_usage_template_idx" ON "template_usage_log" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_usage_document_idx" ON "template_usage_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "template_usage_opportunity_idx" ON "template_usage_log" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "template_usage_outcome_idx" ON "template_usage_log" USING btree ("proposal_outcome");