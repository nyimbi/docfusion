CREATE TABLE "document_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"role" varchar(20) DEFAULT 'editor' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "partner_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"communication_type" varchar(50) NOT NULL,
	"direction" varchar(20) DEFAULT 'outbound' NOT NULL,
	"subject" varchar(500),
	"content" text,
	"summary" text,
	"our_participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"partner_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logged_by" varchar(100) DEFAULT 'system' NOT NULL,
	"communication_date" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"outcome" text,
	"action_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_steps" text,
	"follow_up_date" timestamp with time zone,
	"follow_up_completed" boolean DEFAULT false NOT NULL,
	"sentiment" varchar(20),
	"opportunity_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_reference" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_imports" (
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
CREATE TABLE "partner_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"content" text NOT NULL,
	"note_type" varchar(30) DEFAULT 'general' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"author_id" varchar(100) NOT NULL,
	"author_name" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"previous_stage" varchar(50),
	"new_stage" varchar(50) NOT NULL,
	"previous_type" varchar(50),
	"new_type" varchar(50),
	"changed_by" varchar(255),
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" varchar(50) NOT NULL,
	"industry" varchar(100),
	"sector" varchar(100),
	"sub_sector" varchar(100),
	"company_size" varchar(50),
	"country" varchar(100),
	"region" varchar(100),
	"city" varchar(100),
	"address" text,
	"timezone" varchar(50),
	"primary_language" varchar(50) DEFAULT 'en',
	"additional_languages" jsonb DEFAULT '[]'::jsonb,
	"preferred_contact_method" varchar(50),
	"description" text,
	"website" varchar(500),
	"linkedin_url" varchar(500),
	"founded_year" integer,
	"employee_count" varchar(50),
	"annual_revenue" varchar(100),
	"fiscal_year_end" varchar(20),
	"partner_tier" integer,
	"partnership_fit_score" real,
	"core_capabilities" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"corporate_status" varchar(100),
	"customer_since" timestamp with time zone,
	"contract_value" real,
	"contract_currency" varchar(10) DEFAULT 'USD',
	"contract_renewal_date" timestamp with time zone,
	"customer_health_score" integer,
	"churn_risk" varchar(20),
	"stage" varchar(50) DEFAULT 'new',
	"status" varchar(50) DEFAULT 'active',
	"owner_id" varchar(255),
	"owner_name" varchar(255),
	"team_id" varchar(255),
	"last_contact_date" timestamp with time zone,
	"next_follow_up_date" timestamp with time zone,
	"engagement_score" integer,
	"lead_score" integer,
	"lead_source" varchar(100),
	"lead_source_detail" varchar(255),
	"qualification_status" varchar(50),
	"key_leadership" text,
	"pitching_angle" text,
	"priority_tier" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb,
	"source" varchar(100),
	"source_file" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"contact_id" uuid,
	"deal_id" uuid,
	"opportunity_id" uuid,
	"type" varchar(50) NOT NULL,
	"subject" varchar(500),
	"description" text,
	"outcome" text,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_minutes" integer,
	"direction" varchar(20),
	"status" varchar(50) DEFAULT 'scheduled',
	"priority" varchar(20) DEFAULT 'normal',
	"participants" jsonb,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp with time zone,
	"follow_up_notes" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"external_id" varchar(255),
	"source" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"full_name" varchar(255),
	"salutation" varchar(20),
	"title" varchar(200),
	"department" varchar(100),
	"role" varchar(100),
	"seniority" varchar(50),
	"email" varchar(255),
	"email_secondary" varchar(255),
	"phone" varchar(50),
	"phone_mobile" varchar(50),
	"phone_work" varchar(50),
	"linkedin_url" varchar(500),
	"country" varchar(100),
	"city" varchar(100),
	"timezone" varchar(50),
	"preferred_language" varchar(50) DEFAULT 'en',
	"preferred_contact_method" varchar(50),
	"best_time_to_contact" varchar(100),
	"do_not_contact" boolean DEFAULT false,
	"do_not_email" boolean DEFAULT false,
	"do_not_call" boolean DEFAULT false,
	"is_primary_contact" boolean DEFAULT false,
	"relationship_strength" varchar(20),
	"influence" varchar(20),
	"sentiment" varchar(20),
	"last_contact_date" timestamp with time zone,
	"next_follow_up_date" timestamp with time zone,
	"total_interactions" integer DEFAULT 0,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "crm_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"contact_id" uuid,
	"deal_id" uuid,
	"activity_id" uuid,
	"name" varchar(500) NOT NULL,
	"type" varchar(50) NOT NULL,
	"file_name" varchar(500),
	"file_size" integer,
	"mime_type" varchar(100),
	"storage_url" text,
	"description" text,
	"version" integer DEFAULT 1,
	"previous_version_id" uuid,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"issued_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"previous_stage" varchar(50),
	"new_stage" varchar(50) NOT NULL,
	"value_at_change" real,
	"changed_by" varchar(255),
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"primary_contact_id" uuid,
	"opportunity_id" uuid,
	"name" varchar(500) NOT NULL,
	"description" text,
	"value" real,
	"currency" varchar(10) DEFAULT 'USD',
	"recurring_value" real,
	"recurring_period" varchar(20),
	"pipeline_id" varchar(100) DEFAULT 'default',
	"stage" varchar(50) DEFAULT 'qualification' NOT NULL,
	"stage_probability" integer,
	"expected_close_date" timestamp with time zone,
	"actual_close_date" timestamp with time zone,
	"status" varchar(50) DEFAULT 'open',
	"loss_reason" varchar(100),
	"loss_reason_detail" text,
	"competitor_lost_to" varchar(255),
	"win_reason" text,
	"owner_id" varchar(255),
	"owner_name" varchar(255),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "type" SET DEFAULT 'prospect';--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "contact_phone" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "status" SET DEFAULT 'prospect';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "country" varchar(100);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "region" varchar(100);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "corporate_status" varchar(100);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "founding_date" varchar(50);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "website" varchar(500);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "leadership" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "notable_clients" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "revenue_estimate" varchar(100);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "employee_count" varchar(50);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "funding_status" varchar(200);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "core_capabilities" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "sectors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "competitor_relationships" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "risk_assessment" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "partnership_fit_score" real;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "fit_justification" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "tier" integer;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "priority_actions" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "source" varchar(100);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "source_file" varchar(500);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "document_collaborators" ADD CONSTRAINT "document_collaborators_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_communications" ADD CONSTRAINT "partner_communications_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_stage_history" ADD CONSTRAINT "account_stage_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_documents" ADD CONSTRAINT "crm_documents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_documents" ADD CONSTRAINT "crm_documents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_documents" ADD CONSTRAINT "crm_documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_documents" ADD CONSTRAINT "crm_documents_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_primary_contact_id_contacts_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaborators_document_idx" ON "document_collaborators" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "collaborators_user_idx" ON "document_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_document_user_idx" ON "document_collaborators" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "partner_comms_partner_idx" ON "partner_communications" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_comms_type_idx" ON "partner_communications" USING btree ("communication_type");--> statement-breakpoint
CREATE INDEX "partner_comms_date_idx" ON "partner_communications" USING btree ("communication_date");--> statement-breakpoint
CREATE INDEX "partner_comms_logged_by_idx" ON "partner_communications" USING btree ("logged_by");--> statement-breakpoint
CREATE INDEX "partner_comms_opportunity_idx" ON "partner_communications" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "partner_comms_follow_up_idx" ON "partner_communications" USING btree ("follow_up_date");--> statement-breakpoint
CREATE INDEX "partner_imports_status_idx" ON "partner_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partner_imports_started_idx" ON "partner_imports" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "partner_notes_partner_idx" ON "partner_notes" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_notes_type_idx" ON "partner_notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "partner_notes_pinned_idx" ON "partner_notes" USING btree ("is_pinned");--> statement-breakpoint
CREATE INDEX "partner_notes_author_idx" ON "partner_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "stage_history_account_idx" ON "account_stage_history" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "stage_history_new_stage_idx" ON "account_stage_history" USING btree ("new_stage");--> statement-breakpoint
CREATE INDEX "stage_history_created_idx" ON "account_stage_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stage_history_account_date_idx" ON "account_stage_history" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_stage_idx" ON "accounts" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "accounts_country_idx" ON "accounts" USING btree ("country");--> statement-breakpoint
CREATE INDEX "accounts_region_idx" ON "accounts" USING btree ("region");--> statement-breakpoint
CREATE INDEX "accounts_industry_idx" ON "accounts" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "accounts_owner_idx" ON "accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "accounts_lead_score_idx" ON "accounts" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "accounts_partner_tier_idx" ON "accounts" USING btree ("partner_tier");--> statement-breakpoint
CREATE INDEX "accounts_fit_score_idx" ON "accounts" USING btree ("partnership_fit_score");--> statement-breakpoint
CREATE INDEX "accounts_health_score_idx" ON "accounts" USING btree ("customer_health_score");--> statement-breakpoint
CREATE INDEX "accounts_priority_tier_idx" ON "accounts" USING btree ("priority_tier");--> statement-breakpoint
CREATE INDEX "accounts_last_contact_idx" ON "accounts" USING btree ("last_contact_date");--> statement-breakpoint
CREATE INDEX "accounts_next_followup_idx" ON "accounts" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "accounts_created_idx" ON "accounts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accounts_updated_idx" ON "accounts" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "accounts_type_status_idx" ON "accounts" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "accounts_type_stage_idx" ON "accounts" USING btree ("type","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_name_country_type_idx" ON "accounts" USING btree ("name","country","type");--> statement-breakpoint
CREATE INDEX "activities_account_idx" ON "activities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "activities_contact_idx" ON "activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "activities_deal_idx" ON "activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "activities_opportunity_idx" ON "activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "activities_type_idx" ON "activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "activities_status_idx" ON "activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activities_priority_idx" ON "activities" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "activities_scheduled_idx" ON "activities" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "activities_completed_idx" ON "activities" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "activities_followup_idx" ON "activities" USING btree ("follow_up_date");--> statement-breakpoint
CREATE INDEX "activities_created_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activities_account_date_idx" ON "activities" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "contacts_account_idx" ON "contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "contacts_primary_idx" ON "contacts" USING btree ("is_primary_contact");--> statement-breakpoint
CREATE INDEX "contacts_role_idx" ON "contacts" USING btree ("role");--> statement-breakpoint
CREATE INDEX "contacts_seniority_idx" ON "contacts" USING btree ("seniority");--> statement-breakpoint
CREATE INDEX "contacts_last_contact_idx" ON "contacts" USING btree ("last_contact_date");--> statement-breakpoint
CREATE INDEX "contacts_next_followup_idx" ON "contacts" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "contacts_created_idx" ON "contacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "crm_docs_account_idx" ON "crm_documents" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "crm_docs_contact_idx" ON "crm_documents" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_docs_deal_idx" ON "crm_documents" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "crm_docs_activity_idx" ON "crm_documents" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "crm_docs_type_idx" ON "crm_documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "crm_docs_valid_to_idx" ON "crm_documents" USING btree ("valid_to");--> statement-breakpoint
CREATE INDEX "crm_docs_created_idx" ON "crm_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deal_history_deal_idx" ON "deal_stage_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_history_new_stage_idx" ON "deal_stage_history" USING btree ("new_stage");--> statement-breakpoint
CREATE INDEX "deal_history_created_idx" ON "deal_stage_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deals_account_idx" ON "deals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "deals_contact_idx" ON "deals" USING btree ("primary_contact_id");--> statement-breakpoint
CREATE INDEX "deals_opportunity_idx" ON "deals" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "deals_pipeline_idx" ON "deals" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deals_value_idx" ON "deals" USING btree ("value");--> statement-breakpoint
CREATE INDEX "deals_expected_close_idx" ON "deals" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "deals_actual_close_idx" ON "deals" USING btree ("actual_close_date");--> statement-breakpoint
CREATE INDEX "deals_owner_idx" ON "deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "deals_created_idx" ON "deals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deals_pipeline_stage_idx" ON "deals" USING btree ("pipeline_id","stage");--> statement-breakpoint
CREATE INDEX "deals_status_stage_idx" ON "deals" USING btree ("status","stage");--> statement-breakpoint
CREATE INDEX "partners_country_idx" ON "partners" USING btree ("country");--> statement-breakpoint
CREATE INDEX "partners_region_idx" ON "partners" USING btree ("region");--> statement-breakpoint
CREATE INDEX "partners_tier_idx" ON "partners" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "partners_fit_score_idx" ON "partners" USING btree ("partnership_fit_score");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_name_country_idx" ON "partners" USING btree ("name","country");