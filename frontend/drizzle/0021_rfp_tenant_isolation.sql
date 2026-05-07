-- 0021_rfp_tenant_isolation.sql
-- Add organization_id to all RFP tables, backfill from user_workspaces, set NOT NULL, index.
-- Backfill order: default workspace -> earliest workspace -> __MIGRATED_LEGACY__ sentinel.

BEGIN;

-- 1. Add columns nullable so backfill can run.
ALTER TABLE rfp_documents       ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE rfp_requirements    ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE rfp_parsing_jobs    ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE compliance_matrices ADD COLUMN IF NOT EXISTS organization_id varchar(100);
ALTER TABLE compliance_entries  ADD COLUMN IF NOT EXISTS organization_id varchar(100);

-- 2. Sentinel org for orphan rows. Ops can reassign later.
INSERT INTO organization_settings (organization_id, company_name, primary_color, secondary_color)
VALUES ('__MIGRATED_LEGACY__', 'Migrated Legacy Tenant', '#0066CC', '#00A3E0')
ON CONFLICT (organization_id) DO NOTHING;

-- 3. Backfill rfp_documents from the user's default workspace, then earliest workspace, then sentinel.
UPDATE rfp_documents d
SET organization_id = COALESCE(
    (SELECT uw.organization_id FROM user_workspaces uw
     WHERE uw.user_id = d.uploaded_by AND uw.is_default = true LIMIT 1),
    (SELECT uw.organization_id FROM user_workspaces uw
     WHERE uw.user_id = d.uploaded_by ORDER BY uw.joined_at ASC LIMIT 1),
    '__MIGRATED_LEGACY__'
)
WHERE d.organization_id IS NULL;

-- 4. Children inherit from rfp_documents.
UPDATE rfp_requirements r
SET organization_id = d.organization_id
FROM rfp_documents d
WHERE r.rfp_document_id = d.id AND r.organization_id IS NULL;

UPDATE rfp_parsing_jobs j
SET organization_id = d.organization_id
FROM rfp_documents d
WHERE j.rfp_document_id = d.id AND j.organization_id IS NULL;

-- compliance_matrices.rfp_document_id is nullable; fall back to created_by's default workspace.
UPDATE compliance_matrices m
SET organization_id = COALESCE(
    (SELECT d.organization_id FROM rfp_documents d WHERE d.id = m.rfp_document_id),
    (SELECT uw.organization_id FROM user_workspaces uw
     WHERE uw.user_id = m.created_by AND uw.is_default = true LIMIT 1),
    '__MIGRATED_LEGACY__'
)
WHERE m.organization_id IS NULL;

UPDATE compliance_entries e
SET organization_id = m.organization_id
FROM compliance_matrices m
WHERE e.matrix_id = m.id AND e.organization_id IS NULL;

-- 5. Lock down — every row must have an org now.
ALTER TABLE rfp_documents       ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE rfp_requirements    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE rfp_parsing_jobs    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE compliance_matrices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE compliance_entries  ALTER COLUMN organization_id SET NOT NULL;

-- 6. Per-table tenant index.
CREATE INDEX IF NOT EXISTS rfp_docs_org_idx            ON rfp_documents(organization_id);
CREATE INDEX IF NOT EXISTS rfp_reqs_org_idx            ON rfp_requirements(organization_id);
CREATE INDEX IF NOT EXISTS rfp_parsing_jobs_org_idx    ON rfp_parsing_jobs(organization_id);
CREATE INDEX IF NOT EXISTS compliance_matrices_org_idx ON compliance_matrices(organization_id);
CREATE INDEX IF NOT EXISTS compliance_entries_org_idx  ON compliance_entries(organization_id);

-- 7. Composite indexes for the most common access pattern (WHERE org = $1 AND id = $2).
CREATE INDEX IF NOT EXISTS rfp_docs_org_id_idx            ON rfp_documents(organization_id, id);
CREATE INDEX IF NOT EXISTS rfp_reqs_org_doc_idx           ON rfp_requirements(organization_id, rfp_document_id);
CREATE INDEX IF NOT EXISTS compliance_matrices_org_id_idx ON compliance_matrices(organization_id, id);

COMMIT;
