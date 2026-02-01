CREATE TABLE "company_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"value" text,
	"description" text,
	"value_type" varchar(20) DEFAULT 'text' NOT NULL,
	"category" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_size" integer,
	"total_records" integer DEFAULT 0,
	"imported_records" integer DEFAULT 0,
	"updated_records" integer DEFAULT 0,
	"skipped_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'pending',
	"errors" jsonb DEFAULT '[]'::jsonb,
	"field_mapping" jsonb,
	"import_options" jsonb,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"imported_by" varchar(255) NOT NULL,
	"organization_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "short_name" varchar(100);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "colloquial_name" varchar(200);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "logo_image_url" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "logo_icon_url" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "area_of_business" varchar(200);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "registration_country" varchar(100);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "vat_number" varchar(50);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "address_suite" varchar(100);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "general_email" varchar(200);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "general_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "contracts_contact_title" varchar(200);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description" varchar(500);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "long_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "phone" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "headquarters" varchar(255);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "category" varchar(200);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "sub_category" varchar(200);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "organization_type" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "notable_clients" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "risk_assessment" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "fit_justification" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "annual_giving" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "focus_areas" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "grant_range" varchar(200);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "geographic_focus" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "application_process" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "grant_history" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "impact_score" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "research_findings" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_research_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "research_confidence" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "research_sources" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "value_proposition" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "commercial_insights" jsonb;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "ai_thinking_trace" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "how_we_met" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "meeting_context" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "meeting_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "referred_by" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "current_projects" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "interests" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "skills" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "publications" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "research_findings" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "research_sources" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_research_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "research_confidence" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "career_history" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "education_history" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "social_profiles" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "value_proposition" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "ai_thinking_trace" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "photos" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday" date;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "anniversary" date;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "personal_email" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "personal_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "home_address" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "preferred_name" varchar(100);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "pronouns" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "family" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "certifications" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "languages" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "awards" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "volunteer_work" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "patents" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "courses" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "communication_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "personal_interests" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "favorite_sports_teams" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "alma_mater" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "graduation_year" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "military_service" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "pets" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "vacation_spots" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "dietary_restrictions" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "religious_observances" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "communication_style" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "decision_making_style" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "motivators" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "stressors" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "topics_to_avoid" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "gift_policy" varchar(100);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "gift_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "entertainment_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "introduced_by" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "introduced_to" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "favors_given" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "favors_received" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "shared_experiences" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "gifts_given" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "reporting_to" varchar(200);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "direct_reports" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "budget_authority" varchar(100);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "budget_cycle" varchar(100);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "key_influencers" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "internal_champions" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "internal_blockers" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "current_challenges" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "career_goals" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "kpis_tracked" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "previous_vendors" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "competitors_considering" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_frequency" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "relationship_score" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "next_touchpoint_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "follow_up_reason" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "important_dates" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "talking_points" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "recent_wins" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "visibility" varchar(20) DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "shared_with" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "organization_id" varchar(255);--> statement-breakpoint
CREATE INDEX "company_variables_org_idx" ON "company_variables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "company_variables_category_idx" ON "company_variables" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "company_variables_org_name_idx" ON "company_variables" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "contact_imports_status_idx" ON "contact_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_imports_imported_by_idx" ON "contact_imports" USING btree ("imported_by");--> statement-breakpoint
CREATE INDEX "contact_imports_org_idx" ON "contact_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_imports_created_idx" ON "contact_imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accounts_impact_score_idx" ON "accounts" USING btree ("impact_score");--> statement-breakpoint
CREATE INDEX "accounts_category_idx" ON "accounts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "accounts_org_type_idx" ON "accounts" USING btree ("organization_type");--> statement-breakpoint
CREATE INDEX "contacts_owner_idx" ON "contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "contacts_visibility_idx" ON "contacts" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "contacts_org_idx" ON "contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contacts_referred_by_idx" ON "contacts" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "contacts_how_we_met_idx" ON "contacts" USING btree ("how_we_met");--> statement-breakpoint
CREATE INDEX "contacts_birthday_idx" ON "contacts" USING btree ("birthday");--> statement-breakpoint
CREATE INDEX "contacts_next_touchpoint_idx" ON "contacts" USING btree ("next_touchpoint_date");