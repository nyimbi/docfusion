ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_opportunity_search_vector()
RETURNS TRIGGER AS $$
BEGIN
	NEW.search_vector :=
		setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
		setweight(to_tsvector('english', COALESCE(NEW.organization, '')), 'B') ||
		setweight(to_tsvector('english', COALESCE(NEW.project_summary, '')), 'C') ||
		setweight(to_tsvector('english', COALESCE(NEW.key_requirements, '')), 'C') ||
		setweight(to_tsvector('english', COALESCE(NEW.country_region, '')), 'D') ||
		setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D') ||
		setweight(to_tsvector('english', COALESCE(NEW.sector, '')), 'D');
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS opportunities_search_vector_update ON "opportunities";
--> statement-breakpoint
CREATE TRIGGER opportunities_search_vector_update
	BEFORE INSERT OR UPDATE ON "opportunities"
	FOR EACH ROW
	EXECUTE FUNCTION update_opportunity_search_vector();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_search_vector_idx" ON "opportunities" USING gin ("search_vector");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_title_trgm_idx" ON "opportunities" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_organization_trgm_idx" ON "opportunities" USING gin ("organization" gin_trgm_ops);
--> statement-breakpoint
UPDATE "opportunities" SET "search_vector" =
	setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
	setweight(to_tsvector('english', COALESCE("organization", '')), 'B') ||
	setweight(to_tsvector('english', COALESCE("project_summary", '')), 'C') ||
	setweight(to_tsvector('english', COALESCE("key_requirements", '')), 'C') ||
	setweight(to_tsvector('english', COALESCE("country_region", '')), 'D') ||
	setweight(to_tsvector('english', COALESCE("category", '')), 'D') ||
	setweight(to_tsvector('english', COALESCE("sector", '')), 'D')
WHERE "search_vector" IS NULL;
