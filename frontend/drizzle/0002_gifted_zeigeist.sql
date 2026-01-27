CREATE TABLE "document_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"proposal_document_id" uuid,
	"overall_score" real NOT NULL,
	"category_scores" jsonb NOT NULL,
	"factor_scores" jsonb NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_count" integer NOT NULL,
	"paragraph_count" integer NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_version" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "document_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_document_id" uuid NOT NULL,
	"section_name" varchar(200) NOT NULL,
	"section_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'not_started' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"target_word_count" integer,
	"assigned_to" varchar(200),
	"due_date" timestamp with time zone,
	"requirement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_ai_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"score_type" varchar(50) NOT NULL,
	"score" real NOT NULL,
	"factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_version" varchar(50),
	"reasoning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"role" varchar(100),
	"work_share" real,
	"assigned_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"nda_signed" boolean DEFAULT false NOT NULL,
	"teaming_agreement_signed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"user_name" varchar(200),
	"vote" varchar(20) NOT NULL,
	"confidence" integer,
	"justification" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paragraph_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"paragraph_index" integer NOT NULL,
	"text" text NOT NULL,
	"score" real NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" varchar(50),
	"contact_name" varchar(200),
	"contact_email" varchar(200),
	"contact_phone" varchar(50),
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"past_collaborations" integer DEFAULT 0 NOT NULL,
	"performance_rating" real,
	"notes" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"section_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'not_started' NOT NULL,
	"assigned_to" varchar(200),
	"due_date" timestamp with time zone,
	"reviewer_id" varchar(200),
	"approved_by" varchar(200),
	"approved_at" timestamp with time zone,
	"ai_analysis_score" real,
	"ai_analysis_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"requirement_id" varchar(50),
	"category" varchar(100),
	"subcategory" varchar(100),
	"text" text NOT NULL,
	"source" text,
	"source_page_ref" varchar(50),
	"priority" varchar(20),
	"compliance_status" varchar(30) DEFAULT 'not_addressed' NOT NULL,
	"response_strategy" text,
	"assigned_to" varchar(200),
	"due_date" timestamp with time zone,
	"notes" text,
	"risk_level" varchar(20),
	"ai_analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"submitted_by" varchar(200) NOT NULL,
	"submission_method" varchar(100),
	"confirmation_number" varchar(200),
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"status" varchar(30) DEFAULT 'submitted' NOT NULL,
	"outcome" varchar(20),
	"outcome_date" timestamp with time zone,
	"outcome_notes" text,
	"evaluator_feedback" text,
	"lessons_learned" text,
	"contract_value" real,
	"contract_duration" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_proposal_document_id_proposal_documents_id_fk" FOREIGN KEY ("proposal_document_id") REFERENCES "public"."proposal_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_proposal_document_id_proposal_documents_id_fk" FOREIGN KEY ("proposal_document_id") REFERENCES "public"."proposal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_ai_scores" ADD CONSTRAINT "opportunity_ai_scores_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_partners" ADD CONSTRAINT "opportunity_partners_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_partners" ADD CONSTRAINT "opportunity_partners_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_votes" ADD CONSTRAINT "opportunity_votes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paragraph_analyses" ADD CONSTRAINT "paragraph_analyses_analysis_id_document_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."document_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_documents" ADD CONSTRAINT "proposal_documents_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_documents" ADD CONSTRAINT "proposal_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_document_idx" ON "document_analyses" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "analyses_proposal_doc_idx" ON "document_analyses" USING btree ("proposal_document_id");--> statement-breakpoint
CREATE INDEX "analyses_analyzed_at_idx" ON "document_analyses" USING btree ("analyzed_at");--> statement-breakpoint
CREATE INDEX "doc_sections_proposal_idx" ON "document_sections" USING btree ("proposal_document_id");--> statement-breakpoint
CREATE INDEX "doc_sections_status_idx" ON "document_sections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_scores_opportunity_idx" ON "opportunity_ai_scores" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "ai_scores_type_idx" ON "opportunity_ai_scores" USING btree ("score_type");--> statement-breakpoint
CREATE INDEX "ai_scores_created_idx" ON "opportunity_ai_scores" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opp_partners_opportunity_idx" ON "opportunity_partners" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opp_partners_partner_idx" ON "opportunity_partners" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "opp_partners_status_idx" ON "opportunity_partners" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "opp_partner_unique_idx" ON "opportunity_partners" USING btree ("opportunity_id","partner_id");--> statement-breakpoint
CREATE INDEX "votes_opportunity_idx" ON "opportunity_votes" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_opportunity_user_idx" ON "opportunity_votes" USING btree ("opportunity_id","user_id");--> statement-breakpoint
CREATE INDEX "paragraph_analysis_idx" ON "paragraph_analyses" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "paragraph_index_idx" ON "paragraph_analyses" USING btree ("paragraph_index");--> statement-breakpoint
CREATE INDEX "partners_status_idx" ON "partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partners_type_idx" ON "partners" USING btree ("type");--> statement-breakpoint
CREATE INDEX "proposal_docs_opportunity_idx" ON "proposal_documents" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "proposal_docs_document_idx" ON "proposal_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "proposal_docs_status_idx" ON "proposal_documents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_docs_opp_doc_idx" ON "proposal_documents" USING btree ("opportunity_id","document_id");--> statement-breakpoint
CREATE INDEX "requirements_opportunity_idx" ON "requirements" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "requirements_category_idx" ON "requirements" USING btree ("category");--> statement-breakpoint
CREATE INDEX "requirements_status_idx" ON "requirements" USING btree ("compliance_status");--> statement-breakpoint
CREATE INDEX "requirements_priority_idx" ON "requirements" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "requirements_assigned_idx" ON "requirements" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "submissions_opportunity_idx" ON "submissions" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_outcome_idx" ON "submissions" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "submissions_submitted_at_idx" ON "submissions" USING btree ("submitted_at");