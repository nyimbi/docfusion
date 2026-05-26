ALTER TABLE "proposal_reviews" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
ALTER TABLE "review_comments" ADD COLUMN IF NOT EXISTS "organization_id" varchar(100);--> statement-breakpoint
UPDATE "proposal_reviews"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "organization_settings"
	ORDER BY "created_at" ASC
	LIMIT 1
)
WHERE "organization_id" IS NULL
	AND (SELECT count(*) FROM "organization_settings") = 1;--> statement-breakpoint
UPDATE "review_comments"
SET "organization_id" = (
	SELECT "organization_id"
	FROM "proposal_reviews"
	WHERE "proposal_reviews"."id" = "review_comments"."review_id"
	LIMIT 1
)
WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_reviews_organization_idx" ON "proposal_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_comments_organization_idx" ON "review_comments" USING btree ("organization_id");
