CREATE TABLE "data_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255),
	"filename" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_size" integer,
	"sheet_name" varchar(200),
	"target_table" varchar(100) NOT NULL,
	"template_id" uuid,
	"mappings_used" jsonb,
	"total_rows" integer DEFAULT 0,
	"imported_rows" integer DEFAULT 0,
	"updated_rows" integer DEFAULT 0,
	"skipped_rows" integer DEFAULT 0,
	"failed_rows" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'pending',
	"errors" jsonb DEFAULT '[]'::jsonb,
	"duplicate_handling" varchar(30) DEFAULT 'skip',
	"batch_size" integer DEFAULT 100,
	"imported_ids" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"imported_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_mapping_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255),
	"name" varchar(200) NOT NULL,
	"description" text,
	"target_table" varchar(100) NOT NULL,
	"mappings" jsonb NOT NULL,
	"source_column_patterns" jsonb,
	"use_count" integer DEFAULT 0,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_template_id_import_mapping_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."import_mapping_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_imports_org_idx" ON "data_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_imports_target_idx" ON "data_imports" USING btree ("target_table");--> statement-breakpoint
CREATE INDEX "data_imports_status_idx" ON "data_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_imports_started_idx" ON "data_imports" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "data_imports_imported_by_idx" ON "data_imports" USING btree ("imported_by");--> statement-breakpoint
CREATE INDEX "import_templates_org_idx" ON "import_mapping_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "import_templates_target_idx" ON "import_mapping_templates" USING btree ("target_table");--> statement-breakpoint
CREATE INDEX "import_templates_use_count_idx" ON "import_mapping_templates" USING btree ("use_count");--> statement-breakpoint
CREATE UNIQUE INDEX "import_templates_org_name_idx" ON "import_mapping_templates" USING btree ("organization_id","name");