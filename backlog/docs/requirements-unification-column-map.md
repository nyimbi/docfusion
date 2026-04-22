# Requirements Unification Column Map

| requirements (old)  | rfpRequirements (target) | Action           |
|---------------------|--------------------------|------------------|
| id                  | id                       | direct           |
| opportunityId       | opportunityId            | direct           |
| requirementId       | requirementNumber        | rename           |
| text                | requirementText          | rename           |
| source              | sourceQuote              | rename           |
| sourcePageRef       | sourcePage               | rename, cast     |
| category            | category                 | direct           |
| subcategory         | subcategory              | direct           |
| priority            | priority                 | direct           |
| complianceStatus    | complianceStatus         | direct           |
| responseStrategy    | responseStrategy         | direct           |
| assignedTo          | assignedTo               | direct           |
| dueDate             | dueDate                  | direct           |
| notes               | notes                    | direct           |
| riskLevel           | riskLevel                | direct           |
| aiAnalysis          | aiAnalysis               | NEW jsonb column |
| createdAt           | createdAt                | direct           |
| updatedAt           | updatedAt                | direct           |

## Schema changes made to rfpRequirements

- `rfpDocumentId`: changed from `notNull()` to nullable (opportunities UI doesn't always have an RFP document)
- `requirementNumber`: changed from `notNull()` to nullable (matches old schema)
- `category`: changed from `notNull()` to nullable
- `requirementType`: changed from `notNull()` to nullable with default
- `priority`: changed from `notNull()` to nullable with default
- `riskLevel`: changed from `notNull()` to nullable with default
- `aiAnalysis`: added as new nullable JSONB column

## Files changed

- `frontend/lib/db/schema-rfp.ts` — schema changes
- `frontend/lib/db/schema.ts` — removed `requirements` table and relations
- `frontend/lib/actions/requirements.ts` — reads/writes `rfpRequirements`
- `frontend/lib/actions/task-management.ts` — reads `rfpRequirements`
- `frontend/lib/actions/presentations.ts` — reads `rfpRequirements`
- `frontend/lib/actions/past-performance.ts` — reads `rfpRequirements`
- `frontend/drizzle/0013_unify_requirements.sql` — migration
