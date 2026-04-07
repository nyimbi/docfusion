-- Migration: Add full-text search for opportunities
-- Creates tsvector columns and GIN indexes for fast text search

-- ============================================================================
-- Add search vector column
-- ============================================================================

-- Add tsvector column for full-text search
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
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
        setweight(to_tsvector('english', COALESCE(NEW.sector, ''), 'D'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS opportunities_search_vector_update ON opportunities;
CREATE TRIGGER opportunities_search_vector_update
    BEFORE INSERT OR UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_opportunity_search_vector();

-- Create GIN index for fast full-text search
DROP INDEX IF EXISTS opportunities_search_vector_idx;
CREATE INDEX opportunities_search_vector_idx ON opportunities USING GIN (search_vector);

-- Create trigram index for LIKE searches (fallback)
DROP INDEX IF EXISTS opportunities_title_trgm_idx;
CREATE INDEX opportunities_title_trgm_idx ON opportunities USING GIN (title gin_trgm_ops);

DROP INDEX IF EXISTS opportunities_organization_trgm_idx;
CREATE INDEX opportunities_organization_trgm_idx ON opportunities USING GIN (organization gin_trgm_ops);

-- Populate search vector for existing records
UPDATE opportunities SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(organization, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(project_summary, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(key_requirements, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(country_region, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(category, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(sector, '')), 'D')
WHERE search_vector IS NULL;

-- ============================================================================
-- Create search function with ranking
-- ============================================================================

CREATE OR REPLACE FUNCTION search_opportunities(
    query text,
    filter_categories text[] DEFAULT '{}',
    filter_sectors text[] DEFAULT '{}',
    filter_countries text[] DEFAULT '{}',
    filter_organizations text[] DEFAULT '{}',
    filter_statuses text[] DEFAULT '{}',
    filter_priority_ranks int[] DEFAULT '{}',
    filter_is_expired boolean DEFAULT false,
    filter_deadline_from timestamp DEFAULT NULL,
    filter_deadline_to timestamp DEFAULT NULL,
    filter_budget_min real DEFAULT NULL,
    filter_budget_max real DEFAULT NULL,
    filter_fit_score_min real DEFAULT NULL,
    filter_fit_score_max real DEFAULT NULL,
    sort_field text DEFAULT 'relevance',
    sort_direction text DEFAULT 'desc',
    page_offset int DEFAULT 0,
    page_limit int DEFAULT 25
)
RETURNS TABLE (
    id uuid,
    title varchar,
    organization varchar,
    category varchar,
    country_region varchar,
    deadline timestamp,
    budget_value varchar,
    priority_rank int,
    fit_score real,
    decision_status varchar,
    search_rank real,
    total_count bigint
) AS $$
DECLARE
    tsquery_text tsquery;
BEGIN
    -- Convert search query to tsquery
    tsquery_text := plainto_tsquery('english', query);

    RETURN QUERY
    SELECT
        o.id,
        o.title,
        o.organization,
        o.category,
        o.country_region,
        o.deadline,
        o.budget_value,
        o.priority_rank,
        o.fit_score,
        o.decision_status,
        ts_rank_cd(o.search_vector, tsquery_text) AS search_rank,
        COUNT(*) OVER () AS total_count
    FROM opportunities o
    WHERE
        o.search_vector @@ tsquery_text
        AND (cardinality(filter_categories) = 0 OR o.category = ANY(filter_categories))
        AND (cardinality(filter_sectors) = 0 OR o.sector = ANY(filter_sectors))
        AND (cardinality(filter_countries) = 0 OR o.country_region = ANY(filter_countries))
        AND (cardinality(filter_organizations) = 0 OR o.organization = ANY(filter_organizations))
        AND (cardinality(filter_statuses) = 0 OR o.decision_status = ANY(filter_statuses))
        AND (cardinality(filter_priority_ranks) = 0 OR o.priority_rank = ANY(filter_priority_ranks))
        AND (filter_is_expired IS NULL OR filter_is_expired = false OR (filter_is_expired = true AND o.deadline < NOW()))
        AND (filter_deadline_from IS NULL OR o.deadline >= filter_deadline_from)
        AND (filter_deadline_to IS NULL OR o.deadline <= filter_deadline_to)
        AND (filter_budget_min IS NULL OR o.budget_numeric >= filter_budget_min)
        AND (filter_budget_max IS NULL OR o.budget_numeric <= filter_budget_max)
        AND (filter_fit_score_min IS NULL OR o.fit_score >= filter_fit_score_min)
        AND (filter_fit_score_max IS NULL OR o.fit_score <= filter_fit_score_max)
    ORDER BY
        CASE WHEN sort_field = 'relevance' AND sort_direction = 'desc' THEN ts_rank_cd(o.search_vector, tsquery_text) END DESC,
        CASE WHEN sort_field = 'relevance' AND sort_direction = 'asc' THEN ts_rank_cd(o.search_vector, tsquery_text) END ASC,
        CASE WHEN sort_field = 'deadline' AND sort_direction = 'asc' THEN o.deadline END ASC NULLS LAST,
        CASE WHEN sort_field = 'deadline' AND sort_direction = 'desc' THEN o.deadline END DESC NULLS LAST,
        CASE WHEN sort_field = 'priority_rank' AND sort_direction = 'desc' THEN o.priority_rank END DESC,
        CASE WHEN sort_field = 'priority_rank' AND sort_direction = 'asc' THEN o.priority_rank END ASC,
        CASE WHEN sort_field = 'fit_score' AND sort_direction = 'desc' THEN o.fit_score END DESC,
        CASE WHEN sort_field = 'fit_score' AND sort_direction = 'asc' THEN o.fit_score END ASC,
        CASE WHEN sort_field = 'budget_numeric' AND sort_direction = 'desc' THEN o.budget_numeric END DESC,
        CASE WHEN sort_field = 'budget_numeric' AND sort_direction = 'asc' THEN o.budget_numeric END ASC,
        o.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Add trigram extension if not exists
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;