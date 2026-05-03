ALTER TABLE "template_snippets"
ADD COLUMN IF NOT EXISTS "placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL;
