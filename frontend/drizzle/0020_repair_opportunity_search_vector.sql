ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_search_vector_idx" ON "opportunities" USING gin ("search_vector");
