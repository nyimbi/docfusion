CREATE TABLE "comment_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"review_type" varchar(50) NOT NULL,
	"review_name" varchar(200),
	"description" text,
	"review_number" integer DEFAULT 1,
	"scheduled_date" timestamp with time zone,
	"scheduled_end_date" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'draft',
	"document_version_id" uuid,
	"document_snapshot" text,
	"scope_type" varchar(50) DEFAULT 'full',
	"scoped_sections" jsonb,
	"scoped_volumes" jsonb,
	"review_instructions" text,
	"focus_areas" jsonb,
	"evaluation_criteria_ids" jsonb,
	"overall_score" real,
	"max_possible_score" real,
	"recommendation" varchar(100),
	"executive_summary" text,
	"key_findings" jsonb,
	"total_comments" integer DEFAULT 0,
	"critical_issues" integer DEFAULT 0,
	"major_issues" integer DEFAULT 0,
	"minor_issues" integer DEFAULT 0,
	"editorial_issues" integer DEFAULT 0,
	"resolved_issues" integer DEFAULT 0,
	"strengths_identified" integer DEFAULT 0,
	"score_breakdown" jsonb,
	"previous_review_id" uuid,
	"improvement_from_previous" real,
	"last_exported_at" timestamp with time zone,
	"export_format" varchar(50),
	"created_by" varchar(200),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"item_text" text NOT NULL,
	"item_category" varchar(100),
	"sort_order" integer DEFAULT 0,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp with time zone,
	"completed_by" varchar(200),
	"notes" text,
	"is_required" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"section_id" uuid,
	"volume_id" uuid,
	"page_number" integer,
	"line_number" integer,
	"paragraph_number" integer,
	"selected_text" text,
	"text_range" jsonb,
	"comment_type" varchar(50) NOT NULL,
	"severity" varchar(50),
	"category" varchar(100),
	"subcategory" varchar(100),
	"title" varchar(300),
	"comment" text NOT NULL,
	"suggested_change" text,
	"rationale" text,
	"evaluation_criteria_id" uuid,
	"evaluation_criteria_ref" varchar(100),
	"impact_on_score" varchar(50),
	"related_win_theme_id" uuid,
	"theme_alignment" varchar(50),
	"tags" jsonb,
	"resolution_status" varchar(50) DEFAULT 'open',
	"resolution_notes" text,
	"resolution_action" varchar(100),
	"resolved_by" varchar(200),
	"resolved_at" timestamp with time zone,
	"verified_by" varchar(200),
	"verified_at" timestamp with time zone,
	"verification_notes" text,
	"parent_comment_id" uuid,
	"reply_count" integer DEFAULT 0,
	"duplicate_of_id" uuid,
	"is_duplicate" boolean DEFAULT false,
	"is_anonymous" boolean DEFAULT true,
	"priority_rank" integer,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"evaluation_criteria_id" uuid,
	"evaluation_criteria_ref" varchar(100),
	"evaluation_criteria_name" varchar(300),
	"section_id" uuid,
	"volume_id" uuid,
	"section_name" varchar(300),
	"score" real,
	"max_score" real,
	"normalized_score" real,
	"weight" real DEFAULT 1,
	"weighted_score" real,
	"rating_category" varchar(100),
	"confidence" real,
	"confidence_reason" text,
	"rationale" text,
	"strengths" jsonb,
	"weaknesses" jsonb,
	"improvements" jsonb,
	"supporting_comment_ids" jsonb,
	"expected_score" real,
	"score_delta" real,
	"previous_review_score" real,
	"score_change" real,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"review_type" varchar(50),
	"default_duration_days" integer DEFAULT 3,
	"default_instructions" text,
	"default_focus_areas" jsonb,
	"scoring_criteria" jsonb,
	"comment_categories" jsonb,
	"reviewer_checklist" jsonb,
	"requires_scoring" boolean DEFAULT true,
	"requires_conflict_check" boolean DEFAULT true,
	"requires_nda" boolean DEFAULT false,
	"allow_anonymous_comments" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_by" varchar(200),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" varchar(200) NOT NULL,
	"user_name" varchar(200),
	"user_email" varchar(300),
	"role" varchar(100),
	"expertise" jsonb,
	"years_experience" integer,
	"assigned_sections" jsonb,
	"assigned_volumes" jsonb,
	"assigned_criteria" jsonb,
	"reviewer_instructions" text,
	"expected_completion_date" timestamp with time zone,
	"status" varchar(50) DEFAULT 'pending',
	"accepted_at" timestamp with time zone,
	"declined_reason" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"sections_reviewed" integer DEFAULT 0,
	"total_assigned_sections" integer DEFAULT 0,
	"comments_submitted" integer DEFAULT 0,
	"scores_submitted" integer DEFAULT 0,
	"conflict_of_interest" boolean DEFAULT false,
	"conflict_notes" text,
	"conflict_acknowledged_at" timestamp with time zone,
	"nda_signed" boolean DEFAULT false,
	"nda_signed_at" timestamp with time zone,
	"last_reminder_sent_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oral_presentations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
	"organization_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"time_limit" integer,
	"qa_time_limit" integer,
	"format_requirements" text,
	"audience_description" text,
	"evaluation_criteria" jsonb,
	"source_proposal_id" uuid,
	"slide_count" integer DEFAULT 0,
	"total_duration" integer,
	"theme" varchar(50) DEFAULT 'default',
	"custom_branding" jsonb,
	"status" varchar(50) DEFAULT 'draft',
	"presentation_date" timestamp with time zone,
	"venue" varchar(200),
	"is_virtual" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "practice_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid,
	"recording_url" text,
	"recording_type" varchar(50),
	"duration" integer,
	"pacing_analysis" jsonb,
	"content_coverage" jsonb,
	"filler_word_analysis" jsonb,
	"overall_score" real,
	"ai_feedback" text,
	"recommendations" jsonb DEFAULT '[]'::jsonb,
	"recorded_at" timestamp with time zone DEFAULT now(),
	"recorded_by" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "presentation_qa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid,
	"likely_question" text NOT NULL,
	"question_category" varchar(100),
	"difficulty" varchar(20),
	"probability" real,
	"question_source" varchar(100),
	"related_slide_ids" jsonb DEFAULT '[]'::jsonb,
	"suggested_answer" text,
	"answer_outline" jsonb DEFAULT '[]'::jsonb,
	"key_points" jsonb DEFAULT '[]'::jsonb,
	"supporting_evidence" jsonb DEFAULT '[]'::jsonb,
	"things_to_avoid" jsonb DEFAULT '[]'::jsonb,
	"is_reviewed" boolean DEFAULT false,
	"reviewed_by" varchar(200),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "presentation_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid,
	"slide_number" integer NOT NULL,
	"slide_type" varchar(50),
	"title" varchar(200),
	"content" jsonb DEFAULT '[]'::jsonb,
	"layout" varchar(50) DEFAULT 'default',
	"background_image" text,
	"background_color" varchar(20),
	"speaker_notes" text,
	"speaker_notes_html" text,
	"estimated_duration" integer,
	"transition_type" varchar(50) DEFAULT 'none',
	"transition_duration" integer,
	"source_section_ids" jsonb DEFAULT '[]'::jsonb,
	"source_requirement_ids" jsonb DEFAULT '[]'::jsonb,
	"annotations" jsonb DEFAULT '[]'::jsonb,
	"is_hidden" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "presentation_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid,
	"user_id" uuid,
	"name" varchar(200) NOT NULL,
	"role" varchar(100),
	"assigned_slide_ids" jsonb DEFAULT '[]'::jsonb,
	"assigned_topics" jsonb DEFAULT '[]'::jsonb,
	"estimated_speaking_time" integer,
	"has_confirmed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "comment_reads" ADD CONSTRAINT "comment_reads_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reads" ADD CONSTRAINT "comment_reads_comment_id_document_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."document_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_checklists" ADD CONSTRAINT "review_checklists_review_id_proposal_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."proposal_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_checklists" ADD CONSTRAINT "review_checklists_reviewer_id_reviewers_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."reviewers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_proposal_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."proposal_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_reviewer_id_reviewers_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."reviewers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_review_id_proposal_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."proposal_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_reviewer_id_reviewers_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."reviewers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewers" ADD CONSTRAINT "reviewers_review_id_proposal_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."proposal_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reads_user_comment_idx" ON "comment_reads" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "comment_reads_document_idx" ON "comment_reads" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "comment_reads_user_idx" ON "comment_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comment_reads_comment_idx" ON "comment_reads" USING btree ("comment_id");