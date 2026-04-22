-- Unify requirements tables: add aiAnalysis to rfpRequirements, drop legacy requirements

-- Add aiAnalysis column to rfpRequirements if not exists
ALTER TABLE "rfp_requirements" ADD COLUMN IF NOT EXISTS "ai_analysis" JSONB;

-- Drop legacy requirements table (no active users, no shadow-write needed)
DROP TABLE IF EXISTS "requirements" CASCADE;
