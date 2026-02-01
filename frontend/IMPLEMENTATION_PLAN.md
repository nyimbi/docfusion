# DocuFusion Proposal Intelligence Platform - Implementation Plan

> **Scope:** Complete implementation of 20 enhancement capabilities across 5 phases
> **Timeline:** 6-9 months for full implementation
> **Team:** 3-5 full-stack engineers, 1-2 ML engineers, 1 product manager

---

## Table of Contents

1. [Phase 1: Foundation & Core Intelligence](#phase-1-foundation--core-intelligence)
2. [Phase 2: Content & Workflow Management](#phase-2-content--workflow-management)
3. [Phase 3: Advanced AI & Integration](#phase-3-advanced-ai--integration)
4. [Phase 4: Strategic Intelligence](#phase-4-strategic-intelligence)
5. [Phase 5: Predictive & Presentation](#phase-5-predictive--presentation)
6. [Database Schema Specifications](#database-schema-specifications)
7. [API Specifications](#api-specifications)
8. [Component Architecture](#component-architecture)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Plan](#deployment-plan)

---

## Phase 1: Foundation & Core Intelligence

**Duration:** 6-8 weeks
**Focus:** RFP parsing, content library, compliance validation

---

### 1.1 Intelligent RFP Parser & Requirements Extractor

#### Database Schema

```typescript
// lib/db/schema-rfp.ts

export const rfpDocuments = pgTable("rfp_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Document info
  filename: varchar("filename", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileSize: integer("file_size"),
  fileUrl: text("file_url"),

  // Parsing status
  parseStatus: varchar("parse_status", { length: 50 }).default("pending"),
  parseStartedAt: timestamp("parse_started_at", { withTimezone: true }),
  parseCompletedAt: timestamp("parse_completed_at", { withTimezone: true }),
  parseError: text("parse_error"),

  // Extracted metadata
  issuingAgency: varchar("issuing_agency", { length: 500 }),
  solicitationNumber: varchar("solicitation_number", { length: 100 }),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }),
  questionDeadline: timestamp("question_deadline", { withTimezone: true }),
  contractType: varchar("contract_type", { length: 100 }),
  naicsCode: varchar("naics_code", { length: 20 }),
  setAside: varchar("set_aside", { length: 100 }),
  estimatedValue: real("estimated_value"),

  // Raw extracted text
  rawText: text("raw_text"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const rfpRequirements = pgTable("rfp_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  rfpDocumentId: uuid("rfp_document_id").references(() => rfpDocuments.id, { onDelete: "cascade" }),

  // Requirement identification
  requirementId: varchar("requirement_id", { length: 100 }), // e.g., "L.5.2.1"
  sectionReference: varchar("section_reference", { length: 200 }), // "Section L, Para 5.2.1"

  // Content
  title: varchar("title", { length: 500 }),
  fullText: text("full_text").notNull(),
  summary: text("summary"),

  // Classification
  category: varchar("category", { length: 100 }).notNull(), // technical, management, past_performance, cost, administrative
  subcategory: varchar("subcategory", { length: 100 }),
  requirementType: varchar("requirement_type", { length: 50 }).notNull(), // mandatory, desirable, informational

  // Evaluation info
  evaluationWeight: real("evaluation_weight"),
  evaluationCriteria: text("evaluation_criteria"),
  scoringMethod: varchar("scoring_method", { length: 100 }),

  // AI analysis
  confidenceScore: real("confidence_score"),
  ambiguityFlag: boolean("ambiguity_flag").default(false),
  ambiguityReason: text("ambiguity_reason"),
  suggestedClarifications: jsonb("suggested_clarifications").$type<string[]>(),
  relatedRequirements: jsonb("related_requirements").$type<string[]>(),

  // Compliance tracking
  complianceStatus: varchar("compliance_status", { length: 50 }).default("not_started"),
  assignedSectionId: uuid("assigned_section_id"),
  responseLocation: varchar("response_location", { length: 200 }),

  // Metadata
  pageNumber: integer("page_number"),
  extractionMethod: varchar("extraction_method", { length: 50 }),
  manuallyEdited: boolean("manually_edited").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const complianceMatrix = pgTable("compliance_matrix", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Matrix metadata
  name: varchar("name", { length: 200 }).notNull(),
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),

  // Status tracking
  totalRequirements: integer("total_requirements").default(0),
  addressedRequirements: integer("addressed_requirements").default(0),
  partialRequirements: integer("partial_requirements").default(0),
  missingRequirements: integer("missing_requirements").default(0),

  // Export settings
  lastExportedAt: timestamp("last_exported_at", { withTimezone: true }),
  exportFormat: varchar("export_format", { length: 50 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const complianceEntries = pgTable("compliance_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  matrixId: uuid("matrix_id").references(() => complianceMatrix.id, { onDelete: "cascade" }),
  requirementId: uuid("requirement_id").references(() => rfpRequirements.id),

  // Response mapping
  proposalSectionId: uuid("proposal_section_id"),
  proposalVolumeId: uuid("proposal_volume_id"),
  responsePageNumber: varchar("response_page_number", { length: 50 }),
  responseParagraph: varchar("response_paragraph", { length: 100 }),

  // Compliance assessment
  complianceLevel: varchar("compliance_level", { length: 50 }).notNull(), // full, partial, none, not_applicable
  complianceNotes: text("compliance_notes"),
  verificationMethod: varchar("verification_method", { length: 100 }),

  // Review status
  reviewStatus: varchar("review_status", { length: 50 }).default("pending"),
  reviewedBy: varchar("reviewed_by", { length: 200 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/rfp-parser.ts

"use server";

import { z } from "zod";

// Input schemas
const ParseRFPInput = z.object({
  opportunityId: z.string().uuid(),
  fileUrl: z.string().url(),
  filename: z.string(),
  fileType: z.enum(["pdf", "docx", "doc", "html"]),
});

const ExtractRequirementsInput = z.object({
  rfpDocumentId: z.string().uuid(),
  extractionMode: z.enum(["auto", "section_l_m", "full_document"]).default("auto"),
});

// Actions to implement
export async function uploadRFPDocument(input: z.infer<typeof ParseRFPInput>);
export async function parseRFPDocument(rfpDocumentId: string);
export async function extractRequirements(input: z.infer<typeof ExtractRequirementsInput>);
export async function classifyRequirement(requirementId: string);
export async function generateComplianceMatrix(opportunityId: string);
export async function updateComplianceEntry(entryId: string, data: Partial<ComplianceEntry>);
export async function exportComplianceMatrix(matrixId: string, format: "xlsx" | "pdf" | "csv");
export async function detectAmbiguousRequirements(rfpDocumentId: string);
export async function suggestClarificationQuestions(requirementId: string);
export async function linkRequirementToSection(requirementId: string, sectionId: string);
```

#### Components

```
components/rfp/
├── RFPUploader.tsx              # Drag-drop upload with format detection
├── RFPParseProgress.tsx         # Real-time parsing progress indicator
├── RequirementsList.tsx         # Extracted requirements with filtering
├── RequirementCard.tsx          # Individual requirement display
├── RequirementEditor.tsx        # Manual requirement editing
├── ComplianceMatrix.tsx         # Interactive compliance matrix
├── ComplianceMatrixRow.tsx      # Single requirement-response mapping
├── ComplianceHeatMap.tsx        # Visual coverage indicator
├── ClarificationGenerator.tsx   # Question generation interface
├── RequirementCategorizer.tsx   # Batch categorization tool
└── index.ts
```

#### API Routes

```
app/api/v1/rfp/
├── upload/route.ts              # POST - Upload RFP document
├── [rfpId]/
│   ├── route.ts                 # GET, DELETE - RFP document
│   ├── parse/route.ts           # POST - Trigger parsing
│   ├── requirements/route.ts    # GET - List requirements
│   └── export/route.ts          # GET - Export parsed data
├── requirements/
│   ├── [reqId]/route.ts         # GET, PATCH - Single requirement
│   └── classify/route.ts        # POST - Batch classify
└── compliance/
    ├── matrix/route.ts          # GET, POST - Compliance matrices
    ├── [matrixId]/route.ts      # GET, PATCH, DELETE
    └── export/route.ts          # GET - Export matrix
```

#### AI Integration

```typescript
// lib/ai/rfp-parser.ts

export interface RFPParserConfig {
  model: string;
  extractionPrompt: string;
  classificationPrompt: string;
  ambiguityDetectionPrompt: string;
}

export async function parseRFPWithAI(text: string, config: RFPParserConfig): Promise<ParsedRFP>;
export async function classifyRequirementWithAI(requirement: string): Promise<RequirementClassification>;
export async function detectAmbiguityWithAI(requirement: string): Promise<AmbiguityAnalysis>;
export async function generateClarificationQuestions(requirement: string): Promise<string[]>;
export async function matchRequirementToContent(requirement: string, content: string): Promise<number>;
```

---

### 1.2 Semantic Content Library with Auto-Tagging

#### Database Schema

```typescript
// lib/db/schema-content-library.ts

export const contentBlocks = pgTable("content_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Content identification
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }),

  // Content
  content: text("content").notNull(),
  contentHtml: text("content_html"),
  contentPlain: text("content_plain"),
  wordCount: integer("word_count"),

  // Classification
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  contentType: varchar("content_type", { length: 50 }).notNull(), // boilerplate, technical, management, past_perf, resume, other

  // Auto-generated tags
  autoTags: jsonb("auto_tags").$type<string[]>().default([]),
  manualTags: jsonb("manual_tags").$type<string[]>().default([]),

  // Semantic search
  embedding: vector("embedding", { dimensions: 1536 }),
  embeddingModel: varchar("embedding_model", { length: 100 }),
  embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),

  // Source tracking
  sourceType: varchar("source_type", { length: 50 }), // proposal, template, manual, import
  sourceProposalId: uuid("source_proposal_id"),
  sourceDocumentId: uuid("source_document_id"),
  sourceUrl: text("source_url"),

  // Quality metrics
  qualityScore: real("quality_score"),
  useCount: integer("use_count").default(0),
  winCount: integer("win_count").default(0),
  lossCount: integer("loss_count").default(0),
  winRate: real("win_rate"),

  // Freshness
  freshnessScore: real("freshness_score"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  needsReview: boolean("needs_review").default(false),

  // Approval
  status: varchar("status", { length: 50 }).default("draft"), // draft, pending_approval, approved, archived
  approvedBy: varchar("approved_by", { length: 200 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  // Versioning
  version: integer("version").default(1),
  parentId: uuid("parent_id"),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const contentUsageLog = pgTable("content_usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentBlockId: uuid("content_block_id").references(() => contentBlocks.id),

  // Usage context
  proposalId: uuid("proposal_id"),
  documentId: uuid("document_id"),
  sectionId: varchar("section_id", { length: 100 }),

  // Usage details
  usageType: varchar("usage_type", { length: 50 }).notNull(), // inserted, referenced, modified
  modifications: text("modifications"),

  // Outcome tracking
  proposalOutcome: varchar("proposal_outcome", { length: 50 }), // win, loss, pending, no_bid
  outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),

  usedBy: varchar("used_by", { length: 200 }),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow(),
});

export const contentCollections = pgTable("content_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),

  // Collection type
  collectionType: varchar("collection_type", { length: 50 }).notNull(), // manual, smart, imported

  // Smart collection criteria (if smart)
  smartCriteria: jsonb("smart_criteria").$type<{
    tags?: string[];
    categories?: string[];
    minQualityScore?: number;
    minWinRate?: number;
    dateRange?: { start: string; end: string };
  }>(),

  isPublic: boolean("is_public").default(false),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const contentCollectionItems = pgTable("content_collection_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id").references(() => contentCollections.id, { onDelete: "cascade" }),
  contentBlockId: uuid("content_block_id").references(() => contentBlocks.id, { onDelete: "cascade" }),

  sortOrder: integer("sort_order").default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/content-library.ts

"use server";

export async function createContentBlock(data: CreateContentBlockInput);
export async function updateContentBlock(id: string, data: UpdateContentBlockInput);
export async function deleteContentBlock(id: string);
export async function searchContentBlocks(query: string, filters?: ContentFilters);
export async function semanticSearchContent(query: string, limit?: number);
export async function getContentSuggestions(context: string, sectionType: string);
export async function autoTagContent(contentId: string);
export async function bulkImportContent(source: "proposal" | "document", sourceId: string);
export async function updateContentEmbedding(contentId: string);
export async function recordContentUsage(contentId: string, context: UsageContext);
export async function recordProposalOutcome(proposalId: string, outcome: "win" | "loss");
export async function calculateFreshnessScores();
export async function getContentAnalytics(filters?: AnalyticsFilters);
export async function createCollection(data: CreateCollectionInput);
export async function addToCollection(collectionId: string, contentIds: string[]);
export async function refreshSmartCollection(collectionId: string);
```

#### Components

```
components/content-library/
├── ContentLibraryBrowser.tsx    # Main library interface
├── ContentBlockCard.tsx         # Content preview card
├── ContentBlockEditor.tsx       # Rich text editing
├── ContentBlockViewer.tsx       # Full content view
├── SemanticSearchBar.tsx        # AI-powered search
├── ContentFilters.tsx           # Filter panel
├── TagManager.tsx               # Tag editing interface
├── ContentSuggestions.tsx       # Contextual suggestions
├── ContentInsertDialog.tsx      # Insert into document
├── BulkImporter.tsx             # Import from proposals
├── ContentAnalytics.tsx         # Usage and win rate charts
├── CollectionManager.tsx        # Collection CRUD
├── FreshnessIndicator.tsx       # Staleness warnings
├── ApprovalWorkflow.tsx         # Content approval
└── index.ts
```

---

### 1.3 Compliance Cross-Reference Validator

#### Server Actions

```typescript
// lib/actions/compliance-validator.ts

"use server";

export interface ValidationResult {
  isValid: boolean;
  coverageScore: number;
  issues: ComplianceIssue[];
  suggestions: ComplianceSuggestion[];
}

export interface ComplianceIssue {
  type: "missing" | "partial" | "over_referenced" | "weak" | "mismatch";
  severity: "critical" | "high" | "medium" | "low";
  requirementId: string;
  description: string;
  location?: string;
}

export async function validateCompliance(opportunityId: string): Promise<ValidationResult>;
export async function validateBidirectional(matrixId: string): Promise<BidirectionalValidation>;
export async function detectMissingCrossReferences(documentId: string): Promise<MissingReference[]>;
export async function detectOverReferences(documentId: string): Promise<OverReference[]>;
export async function generateComplianceHeatMap(matrixId: string): Promise<HeatMapData>;
export async function suggestCrossReferenceLocations(requirementId: string): Promise<SuggestedLocation[]>;
export async function autoLinkRequirements(documentId: string): Promise<AutoLinkResult>;
export async function exportComplianceReport(matrixId: string, format: "pdf" | "xlsx"): Promise<string>;
```

#### Components

```
components/compliance/
├── ComplianceValidator.tsx      # Main validation interface
├── ValidationResults.tsx        # Results display
├── ComplianceIssueCard.tsx      # Individual issue
├── CoverageHeatMap.tsx          # Visual coverage
├── CrossReferenceEditor.tsx     # Manual linking
├── AutoLinker.tsx               # AI-assisted linking
├── BidirectionalView.tsx        # Two-way validation
├── ComplianceReport.tsx         # Printable report
└── index.ts
```

---

## Phase 2: Content & Workflow Management

**Duration:** 6-8 weeks
**Focus:** Past performance, resumes, task management, reviews, formatting

---

### 2.1 Past Performance Narrative Generator

#### Database Schema

```typescript
// lib/db/schema-past-performance.ts

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Basic info
  name: varchar("name", { length: 500 }).notNull(),
  contractNumber: varchar("contract_number", { length: 100 }),
  taskOrderNumber: varchar("task_order_number", { length: 100 }),

  // Customer info
  customerName: varchar("customer_name", { length: 500 }).notNull(),
  customerAgency: varchar("customer_agency", { length: 500 }),
  customerPOC: varchar("customer_poc", { length: 200 }),
  customerPOCEmail: varchar("customer_poc_email", { length: 200 }),
  customerPOCPhone: varchar("customer_poc_phone", { length: 50 }),

  // Contract details
  contractType: varchar("contract_type", { length: 100 }), // FFP, T&M, CPFF, IDIQ, etc.
  contractValue: real("contract_value"),
  periodOfPerformance: jsonb("period_of_performance").$type<{
    start: string;
    end: string;
    options?: { start: string; end: string }[];
  }>(),

  // Scope
  description: text("description"),
  scopeSummary: text("scope_summary"),
  technicalAreas: jsonb("technical_areas").$type<string[]>(),
  naicsCode: varchar("naics_code", { length: 20 }),

  // Team
  peakStaffing: integer("peak_staffing"),
  keyPersonnel: jsonb("key_personnel").$type<{
    name: string;
    role: string;
    personnelId?: string;
  }[]>(),

  // Performance metrics
  cparRatings: jsonb("cpar_ratings").$type<{
    quality: number;
    schedule: number;
    cost: number;
    management: number;
    smallBusiness?: number;
    overall: number;
  }>(),

  // Outcomes and achievements
  keyAccomplishments: jsonb("key_accomplishments").$type<string[]>(),
  quantifiedResults: jsonb("quantified_results").$type<{
    metric: string;
    value: string;
    context: string;
  }[]>(),

  // Classification
  securityLevel: varchar("security_level", { length: 50 }),
  isActive: boolean("is_active").default(true),

  // Reference status
  referenceStatus: varchar("reference_status", { length: 50 }).default("available"),
  lastReferenceCheck: timestamp("last_reference_check", { withTimezone: true }),

  // Auto-generated content
  cparNarrative: text("cpar_narrative"),
  briefDescription: text("brief_description"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const projectRelevanceScores = pgTable("project_relevance_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Scoring
  overallScore: real("overall_score").notNull(),
  recencyScore: real("recency_score"),
  sizeScore: real("size_score"),
  scopeScore: real("scope_score"),
  customerScore: real("customer_score"),

  // Matching details
  matchingRequirements: jsonb("matching_requirements").$type<string[]>(),
  gaps: jsonb("gaps").$type<string[]>(),

  // Generated narrative
  relevanceNarrative: text("relevance_narrative"),

  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/past-performance.ts

"use server";

export async function createProject(data: CreateProjectInput);
export async function updateProject(id: string, data: UpdateProjectInput);
export async function deleteProject(id: string);
export async function searchProjects(query: string, filters?: ProjectFilters);
export async function calculateRelevanceScores(opportunityId: string);
export async function generateCPARNarrative(projectId: string);
export async function generateBriefDescription(projectId: string, maxWords: number);
export async function generateRelevanceMatrix(opportunityId: string, projectIds: string[]);
export async function checkReferenceAvailability(projectId: string);
export async function exportPastPerformanceVolume(opportunityId: string, format: "docx" | "pdf");
export async function importProjectFromCPARS(cparData: CPARSImport);
export async function suggestProjects(opportunityId: string, limit?: number);
```

#### Components

```
components/past-performance/
├── ProjectDatabase.tsx          # Project listing
├── ProjectCard.tsx              # Project summary
├── ProjectEditor.tsx            # Full project editing
├── ProjectMetrics.tsx           # CPAR ratings display
├── RelevanceCalculator.tsx      # Match to opportunity
├── RelevanceMatrix.tsx          # Comparison matrix
├── NarrativeGenerator.tsx       # AI narrative generation
├── ReferenceTracker.tsx         # Reference status
├── ProjectImporter.tsx          # CPARS/bulk import
├── PastPerfVolume.tsx           # Volume assembly
└── index.ts
```

---

### 2.2 Resume & Qualification Database

#### Database Schema

```typescript
// lib/db/schema-personnel.ts

export const personnel = pgTable("personnel", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Basic info
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),

  // Employment
  employmentType: varchar("employment_type", { length: 50 }), // employee, contractor, consultant
  startDate: date("start_date"),
  department: varchar("department", { length: 100 }),
  currentTitle: varchar("current_title", { length: 200 }),

  // Resume content
  resumeFull: text("resume_full"),
  resumeBrief: text("resume_brief"),
  linkedInUrl: text("linkedin_url"),

  // Education
  education: jsonb("education").$type<{
    degree: string;
    field: string;
    institution: string;
    year: number;
  }[]>(),

  // Certifications
  certifications: jsonb("certifications").$type<{
    name: string;
    issuer: string;
    dateObtained: string;
    expirationDate?: string;
    certificationNumber?: string;
  }[]>(),

  // Clearance
  clearanceLevel: varchar("clearance_level", { length: 100 }),
  clearanceStatus: varchar("clearance_status", { length: 50 }),
  clearanceExpiration: date("clearance_expiration"),

  // Availability
  availability: varchar("availability", { length: 50 }).default("available"),
  availableDate: date("available_date"),
  currentProposals: jsonb("current_proposals").$type<string[]>().default([]),

  // Skills (linked to taxonomy)
  skills: jsonb("skills").$type<{
    skillId: string;
    proficiency: "beginner" | "intermediate" | "advanced" | "expert";
    yearsExperience: number;
  }[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const skillsTaxonomy = pgTable("skills_taxonomy", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),

  // Synonyms for matching
  synonyms: jsonb("synonyms").$type<string[]>().default([]),

  parentId: uuid("parent_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const personnelExperience = pgTable("personnel_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  personnelId: uuid("personnel_id").references(() => personnel.id, { onDelete: "cascade" }),

  // Position info
  title: varchar("title", { length: 200 }).notNull(),
  company: varchar("company", { length: 200 }),
  projectId: uuid("project_id").references(() => projects.id),

  // Duration
  startDate: date("start_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").default(false),

  // Description
  description: text("description"),
  accomplishments: jsonb("accomplishments").$type<string[]>(),

  // Skills used
  skillsUsed: jsonb("skills_used").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const positionRequirements = pgTable("position_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Position info
  positionTitle: varchar("position_title", { length: 200 }).notNull(),
  positionCategory: varchar("position_category", { length: 100 }),
  laborCategory: varchar("labor_category", { length: 100 }),

  // Requirements
  requiredSkills: jsonb("required_skills").$type<{
    skillId: string;
    minProficiency: string;
    required: boolean;
  }[]>(),
  requiredEducation: varchar("required_education", { length: 200 }),
  requiredExperience: integer("required_experience"),
  requiredClearance: varchar("required_clearance", { length: 100 }),
  requiredCertifications: jsonb("required_certifications").$type<string[]>(),

  // Staffing
  headcount: integer("headcount").default(1),
  startDate: date("start_date"),
  duration: integer("duration"),

  // Assigned personnel
  assignedPersonnelId: uuid("assigned_personnel_id").references(() => personnel.id),
  assignmentStatus: varchar("assignment_status", { length: 50 }).default("open"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/personnel.ts

"use server";

export async function createPersonnel(data: CreatePersonnelInput);
export async function updatePersonnel(id: string, data: UpdatePersonnelInput);
export async function deletePersonnel(id: string);
export async function searchPersonnel(query: string, filters?: PersonnelFilters);
export async function parseResume(file: File): Promise<ParsedResume>;
export async function bulkImportResumes(files: File[]);
export async function matchPersonnelToPosition(positionId: string): Promise<PersonnelMatch[]>;
export async function analyzeGaps(opportunityId: string): Promise<GapAnalysis>;
export async function generateResume(personnelId: string, format: "federal" | "commercial" | "brief");
export async function generateOrgChart(opportunityId: string): Promise<OrgChartData>;
export async function checkAvailability(personnelIds: string[], dates: DateRange);
export async function assignToPosition(personnelId: string, positionId: string);
export async function trackCertificationExpiration();
export async function generateStaffingMatrix(opportunityId: string);
```

#### Components

```
components/personnel/
├── PersonnelDatabase.tsx        # Personnel listing
├── PersonnelCard.tsx            # Person summary
├── PersonnelEditor.tsx          # Full profile editing
├── ResumeParser.tsx             # AI resume parsing
├── ResumeGenerator.tsx          # Format-specific output
├── SkillsManager.tsx            # Skills taxonomy
├── PositionMatcher.tsx          # Match to requirements
├── GapAnalyzer.tsx              # Staffing gaps
├── AvailabilityCalendar.tsx     # Scheduling view
├── OrgChartBuilder.tsx          # Visual org chart
├── CertificationTracker.tsx     # Expiration alerts
├── StaffingMatrix.tsx           # Position assignments
└── index.ts
```

---

### 2.3 Intelligent Task Assignment & Workload Balancer

#### Database Schema

```typescript
// lib/db/schema-tasks.ts

export const proposalTasks = pgTable("proposal_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Task identification
  taskNumber: varchar("task_number", { length: 50 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),

  // Categorization
  taskType: varchar("task_type", { length: 100 }).notNull(),
  sectionId: uuid("section_id"),
  requirementId: uuid("requirement_id"),

  // Assignment
  assignedTo: varchar("assigned_to", { length: 200 }),
  assignedBy: varchar("assigned_by", { length: 200 }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),

  // Timeline
  dueDate: timestamp("due_date", { withTimezone: true }),
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),

  // Dependencies
  dependsOn: jsonb("depends_on").$type<string[]>().default([]),
  blockedBy: jsonb("blocked_by").$type<string[]>().default([]),

  // Status
  status: varchar("status", { length: 50 }).default("pending"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Progress
  progress: integer("progress").default(0),
  wordCountTarget: integer("word_count_target"),
  wordCountCurrent: integer("word_count_current"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const authorExpertise = pgTable("author_expertise", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 200 }).notNull(),

  // Expertise areas
  expertiseAreas: jsonb("expertise_areas").$type<{
    area: string;
    proficiency: number;
    lastUsed: string;
  }[]>(),

  // Writing metrics
  averageWordsPerHour: real("average_words_per_hour"),
  qualityScoreAverage: real("quality_score_average"),
  onTimeDeliveryRate: real("on_time_delivery_rate"),

  // Preferences
  preferredTaskTypes: jsonb("preferred_task_types").$type<string[]>(),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(5),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const workloadSnapshots = pgTable("workload_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 200 }).notNull(),

  snapshotDate: date("snapshot_date").notNull(),

  // Current load
  activeTasks: integer("active_tasks"),
  totalEstimatedHours: real("total_estimated_hours"),
  dueThisWeek: integer("due_this_week"),
  overdueCount: integer("overdue_count"),

  // Capacity
  availableHours: real("available_hours"),
  utilizationRate: real("utilization_rate"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/task-management.ts

"use server";

export async function createTask(data: CreateTaskInput);
export async function updateTask(id: string, data: UpdateTaskInput);
export async function deleteTask(id: string);
export async function listTasks(opportunityId: string, filters?: TaskFilters);
export async function generateTasksFromCompliance(matrixId: string);
export async function suggestAssignment(taskId: string): Promise<AssignmentSuggestion[]>;
export async function bulkAssignTasks(assignments: TaskAssignment[]);
export async function calculateCriticalPath(opportunityId: string): Promise<CriticalPath>;
export async function getWorkloadSummary(userId: string): Promise<WorkloadSummary>;
export async function balanceWorkload(opportunityId: string): Promise<RebalanceResult>;
export async function detectBottlenecks(opportunityId: string): Promise<Bottleneck[]>;
export async function escalateOverdueTasks(opportunityId: string);
export async function generateProgressReport(opportunityId: string): Promise<ProgressReport>;
export async function updateAuthorExpertise(userId: string);
```

#### Components

```
components/task-management/
├── TaskBoard.tsx                # Kanban-style board
├── TaskList.tsx                 # List view
├── TaskCard.tsx                 # Individual task
├── TaskEditor.tsx               # Task details
├── AssignmentSuggester.tsx      # AI-suggested assignments
├── WorkloadDashboard.tsx        # Team workload view
├── WorkloadHeatMap.tsx          # Visual capacity
├── CriticalPathView.tsx         # Timeline with dependencies
├── BottleneckAlerts.tsx         # Warning indicators
├── ProgressTracker.tsx          # Completion tracking
├── TaskGenerator.tsx            # From compliance matrix
└── index.ts
```

---

### 2.4 Formal Review Process (Pink/Red/Gold Team)

#### Database Schema

```typescript
// lib/db/schema-reviews.ts

export const proposalReviews = pgTable("proposal_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Review identification
  reviewType: varchar("review_type", { length: 50 }).notNull(), // pink, red, gold, compliance, final
  reviewName: varchar("review_name", { length: 200 }),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Status
  status: varchar("status", { length: 50 }).default("scheduled"),

  // Document versions
  documentVersionId: uuid("document_version_id"),

  // Results summary
  overallScore: real("overall_score"),
  recommendation: varchar("recommendation", { length: 100 }),
  executiveSummary: text("executive_summary"),

  // Statistics
  totalComments: integer("total_comments").default(0),
  criticalIssues: integer("critical_issues").default(0),
  resolvedIssues: integer("resolved_issues").default(0),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const reviewers = pgTable("reviewers", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").references(() => proposalReviews.id, { onDelete: "cascade" }),

  userId: varchar("user_id", { length: 200 }).notNull(),
  role: varchar("role", { length: 100 }), // lead, technical, cost, compliance, general

  // Assignment
  assignedSections: jsonb("assigned_sections").$type<string[]>(),

  // Progress
  status: varchar("status", { length: 50 }).default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Conflict check
  conflictOfInterest: boolean("conflict_of_interest").default(false),
  conflictNotes: text("conflict_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const reviewComments = pgTable("review_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").references(() => proposalReviews.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => reviewers.id),

  // Location
  sectionId: uuid("section_id"),
  pageNumber: integer("page_number"),
  lineNumber: integer("line_number"),
  selectedText: text("selected_text"),

  // Comment content
  commentType: varchar("comment_type", { length: 50 }).notNull(), // strength, weakness, suggestion, question, critical
  severity: varchar("severity", { length: 50 }), // critical, major, minor, editorial
  category: varchar("category", { length: 100 }),

  comment: text("comment").notNull(),
  suggestedChange: text("suggested_change"),

  // Scoring
  evaluationCriteriaId: uuid("evaluation_criteria_id"),
  impactOnScore: varchar("impact_on_score", { length: 50 }),

  // Resolution
  resolutionStatus: varchar("resolution_status", { length: 50 }).default("open"),
  resolutionNotes: text("resolution_notes"),
  resolvedBy: varchar("resolved_by", { length: 200 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),

  // Anonymous for aggregation
  isAnonymous: boolean("is_anonymous").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const reviewScores = pgTable("review_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").references(() => proposalReviews.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => reviewers.id),

  // Scoring area
  evaluationCriteriaId: uuid("evaluation_criteria_id"),
  sectionId: uuid("section_id"),

  // Scores
  score: real("score"),
  maxScore: real("max_score"),
  confidence: real("confidence"),

  rationale: text("rationale"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/reviews.ts

"use server";

export async function createReview(data: CreateReviewInput);
export async function updateReview(id: string, data: UpdateReviewInput);
export async function deleteReview(id: string);
export async function listReviews(opportunityId: string);
export async function assignReviewers(reviewId: string, reviewers: ReviewerAssignment[]);
export async function checkConflictsOfInterest(reviewId: string);
export async function addReviewComment(reviewId: string, comment: CommentInput);
export async function resolveComment(commentId: string, resolution: ResolutionInput);
export async function submitReviewerScores(reviewerId: string, scores: ScoreInput[]);
export async function aggregateScores(reviewId: string): Promise<AggregatedScores>;
export async function generateReviewReport(reviewId: string): Promise<ReviewReport>;
export async function compareBeforeAfter(reviewId: string): Promise<BeforeAfterComparison>;
export async function trackReviewEffectiveness(): Promise<EffectivenessMetrics>;
export async function exportReviewPackage(reviewId: string, format: "pdf" | "xlsx");
```

#### Components

```
components/reviews/
├── ReviewDashboard.tsx          # Review management
├── ReviewScheduler.tsx          # Schedule reviews
├── ReviewerAssignment.tsx       # Assign reviewers
├── ReviewInterface.tsx          # Reviewer's workspace
├── CommentPanel.tsx             # Add/view comments
├── CommentCard.tsx              # Individual comment
├── ScoringRubric.tsx            # Evaluation scoring
├── ScoreAggregation.tsx         # Combined scores
├── ResolutionTracker.tsx        # Track fixes
├── ReviewReport.tsx             # Summary report
├── BeforeAfterView.tsx          # Change comparison
├── ReviewMetrics.tsx            # Effectiveness stats
└── index.ts
```

---

### 2.5 Government-Specific Formatting Engine

#### Database Schema

```typescript
// lib/db/schema-formatting.ts

export const formatTemplates = pgTable("format_templates", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Identification
  name: varchar("name", { length: 200 }).notNull(),
  agencyCode: varchar("agency_code", { length: 50 }),
  agencyName: varchar("agency_name", { length: 200 }),

  // Format specifications
  pageSize: varchar("page_size", { length: 50 }).default("letter"),
  orientation: varchar("orientation", { length: 50 }).default("portrait"),
  margins: jsonb("margins").$type<{
    top: number;
    bottom: number;
    left: number;
    right: number;
  }>(),

  // Typography
  bodyFont: varchar("body_font", { length: 100 }),
  bodyFontSize: real("body_font_size"),
  headingFont: varchar("heading_font", { length: 100 }),
  lineSpacing: real("line_spacing"),

  // Page limits
  pageLimits: jsonb("page_limits").$type<{
    volume?: string;
    limit: number;
    excludes?: string[];
  }[]>(),

  // Header/footer
  headerFormat: jsonb("header_format"),
  footerFormat: jsonb("footer_format"),

  // Numbering
  pageNumberFormat: varchar("page_number_format", { length: 100 }),
  sectionNumberFormat: varchar("section_number_format", { length: 100 }),

  // Front matter requirements
  frontMatterOrder: jsonb("front_matter_order").$type<string[]>(),

  // Accessibility
  requiresAccessibility: boolean("requires_accessibility").default(false),
  accessibilityLevel: varchar("accessibility_level", { length: 50 }),

  isDefault: boolean("is_default").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/formatting.ts

"use server";

export async function applyFormatTemplate(documentId: string, templateId: string);
export async function validateFormatCompliance(documentId: string): Promise<FormatValidation>;
export async function checkPageCount(documentId: string): Promise<PageCountCheck>;
export async function validateAccessibility(documentId: string): Promise<AccessibilityReport>;
export async function generateTOC(documentId: string): Promise<TOCData>;
export async function generateListOfFigures(documentId: string);
export async function generateListOfTables(documentId: string);
export async function generateAcronymList(documentId: string);
export async function applyHeaderFooter(documentId: string, settings: HeaderFooterSettings);
export async function formatForAgency(documentId: string, agencyCode: string);
export async function exportFormattedDocument(documentId: string, format: "pdf" | "docx");
```

#### Components

```
components/formatting/
├── FormatTemplateSelector.tsx   # Choose format
├── FormatValidator.tsx          # Validation results
├── PageCountTracker.tsx         # Page limits
├── AccessibilityChecker.tsx     # 508 compliance
├── TOCGenerator.tsx             # Auto TOC
├── ListGenerator.tsx            # Figures/tables/acronyms
├── HeaderFooterEditor.tsx       # Customize headers
├── FormatPreview.tsx            # Preview formatted
├── FormatIssueList.tsx          # Issues to fix
└── index.ts
```

---

## Phase 3: Advanced AI & Integration

**Duration:** 8-10 weeks
**Focus:** Win themes, evidence optimization, cost integration, graphics

---

### 3.1 Win Theme Orchestration Engine

#### Database Schema

```typescript
// lib/db/schema-win-themes.ts

export const winThemes = pgTable("win_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Theme content
  themeStatement: text("theme_statement").notNull(),
  shortVersion: varchar("short_version", { length: 200 }),

  // Classification
  themeType: varchar("theme_type", { length: 100 }), // value_prop, differentiator, proof_point, risk_mitigation
  priority: integer("priority").default(1),

  // Supporting elements
  supportingEvidence: jsonb("supporting_evidence").$type<string[]>(),
  relatedProjects: jsonb("related_projects").$type<string[]>(),

  // Evaluation mapping
  evaluationCriteriaIds: jsonb("evaluation_criteria_ids").$type<string[]>(),

  // Ghost themes (against competitors)
  ghostTheme: text("ghost_theme"),
  targetCompetitor: varchar("target_competitor", { length: 200 }),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const themeOccurrences = pgTable("theme_occurrences", {
  id: uuid("id").primaryKey().defaultRandom(),
  themeId: uuid("theme_id").references(() => winThemes.id, { onDelete: "cascade" }),

  // Location
  documentId: uuid("document_id"),
  sectionId: uuid("section_id"),
  pageNumber: integer("page_number"),

  // Occurrence details
  textExcerpt: text("text_excerpt"),
  strength: varchar("strength", { length: 50 }), // strong, moderate, weak, implicit

  // AI detection
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
  confidence: real("confidence"),
});
```

#### Server Actions

```typescript
// lib/actions/win-themes.ts

"use server";

export async function createWinTheme(data: CreateWinThemeInput);
export async function updateWinTheme(id: string, data: UpdateWinThemeInput);
export async function deleteWinTheme(id: string);
export async function listWinThemes(opportunityId: string);
export async function suggestWinThemes(opportunityId: string): Promise<ThemeSuggestion[]>;
export async function analyzeThemeConsistency(opportunityId: string): Promise<ConsistencyAnalysis>;
export async function findThemeInjectionPoints(themeId: string): Promise<InjectionPoint[]>;
export async function detectGhostThemes(opportunityId: string): Promise<GhostTheme[]>;
export async function generateThemeReinforcement(sectionId: string, themeId: string): Promise<string>;
export async function mapThemesToEvaluationCriteria(opportunityId: string);
export async function generateThemeHeatMap(opportunityId: string): Promise<HeatMapData>;
export async function generateThemeSummary(opportunityId: string): Promise<ThemeSummary>;
```

---

### 3.2 Evidence & Proof Point Optimizer

#### Database Schema

```typescript
// lib/db/schema-evidence.ts

export const evidenceLibrary = pgTable("evidence_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Evidence content
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),

  // Classification
  evidenceType: varchar("evidence_type", { length: 100 }).notNull(), // metric, testimonial, case_study, certification, award, publication
  category: varchar("category", { length: 100 }),

  // Quantification
  isQuantified: boolean("is_quantified").default(false),
  metric: varchar("metric", { length: 200 }),
  metricValue: varchar("metric_value", { length: 100 }),
  metricUnit: varchar("metric_unit", { length: 50 }),

  // Source
  sourceType: varchar("source_type", { length: 100 }), // internal, customer, third_party
  sourceReference: text("source_reference"),
  sourceDate: date("source_date"),

  // Strength rating
  strengthScore: real("strength_score"),

  // Usage tracking
  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

  // Embedding for semantic search
  embedding: vector("embedding", { dimensions: 1536 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const claimAnalysis = pgTable("claim_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id"),
  sectionId: uuid("section_id"),

  // Claim identification
  claimText: text("claim_text").notNull(),
  claimType: varchar("claim_type", { length: 100 }),

  // Analysis
  hasEvidence: boolean("has_evidence").default(false),
  evidenceStrength: varchar("evidence_strength", { length: 50 }),
  suggestedEvidence: jsonb("suggested_evidence").$type<string[]>(),

  // Status
  resolved: boolean("resolved").default(false),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/evidence.ts

"use server";

export async function createEvidence(data: CreateEvidenceInput);
export async function updateEvidence(id: string, data: UpdateEvidenceInput);
export async function deleteEvidence(id: string);
export async function searchEvidence(query: string, filters?: EvidenceFilters);
export async function analyzeClaimsInDocument(documentId: string): Promise<ClaimAnalysis[]>;
export async function suggestEvidenceForClaim(claimId: string): Promise<EvidenceSuggestion[]>;
export async function calculateEvidenceDistribution(documentId: string): Promise<DistributionAnalysis>;
export async function generateEvidenceMatrix(opportunityId: string): Promise<EvidenceMatrix>;
export async function quantifyClaim(claimText: string): Promise<QuantificationSuggestion>;
export async function rateEvidenceStrength(evidenceId: string): Promise<StrengthRating>;
```

---

### 3.3 Integrated Cost Volume Generator

#### Database Schema

```typescript
// lib/db/schema-pricing.ts

export const laborCategories = pgTable("labor_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Category identification
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }),

  // Rate info
  directRate: real("direct_rate"),
  fullyBurdenedRate: real("fully_burdened_rate"),
  effectiveDate: date("effective_date"),
  expirationDate: date("expiration_date"),

  // Escalation
  annualEscalation: real("annual_escalation"),

  // Requirements
  minEducation: varchar("min_education", { length: 100 }),
  minExperience: integer("min_experience"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const costElements = pgTable("cost_elements", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // WBS linkage
  wbsCode: varchar("wbs_code", { length: 100 }),
  wbsTitle: varchar("wbs_title", { length: 500 }),
  technicalSectionId: uuid("technical_section_id"),

  // Labor
  laborCategoryId: uuid("labor_category_id").references(() => laborCategories.id),
  hours: real("hours"),
  rate: real("rate"),
  laborCost: real("labor_cost"),

  // ODCs
  odcType: varchar("odc_type", { length: 100 }),
  odcAmount: real("odc_amount"),
  odcDescription: text("odc_description"),

  // Subcontractor
  subcontractorName: varchar("subcontractor_name", { length: 200 }),
  subcontractorCost: real("subcontractor_cost"),

  // Travel
  travelDescription: text("travel_description"),
  travelCost: real("travel_cost"),

  // Total
  totalCost: real("total_cost"),

  // Period
  periodNumber: integer("period_number"),
  periodType: varchar("period_type", { length: 50 }), // base, option

  // BOE
  boeNarrative: text("boe_narrative"),
  assumptions: jsonb("assumptions").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/pricing.ts

"use server";

export async function createLaborCategory(data: CreateLaborCategoryInput);
export async function updateLaborCategory(id: string, data: UpdateLaborCategoryInput);
export async function createCostElement(data: CreateCostElementInput);
export async function updateCostElement(id: string, data: UpdateCostElementInput);
export async function linkCostToTechnical(costElementId: string, technicalSectionId: string);
export async function estimateHoursFromTechnical(technicalSectionId: string): Promise<HoursEstimate>;
export async function generateBOENarrative(costElementId: string): Promise<string>;
export async function validateCostTechnicalAlignment(opportunityId: string): Promise<AlignmentReport>;
export async function calculateTotalPrice(opportunityId: string): Promise<PricingSummary>;
export async function applyEscalation(opportunityId: string, year: number);
export async function exportCostVolume(opportunityId: string, format: "xlsx" | "pdf");
export async function generateCostRealismNarrative(opportunityId: string): Promise<string>;
```

---

### 3.4 Smart Graphics Generator

#### Database Schema

```typescript
// lib/db/schema-graphics.ts

export const proposalGraphics = pgTable("proposal_graphics", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  documentId: uuid("document_id"),
  sectionId: uuid("section_id"),

  // Graphic identification
  title: varchar("title", { length: 500 }).notNull(),
  figureNumber: varchar("figure_number", { length: 50 }),

  // Type and format
  graphicType: varchar("graphic_type", { length: 100 }).notNull(), // org_chart, process_flow, schedule, infographic, diagram, chart
  format: varchar("format", { length: 50 }), // svg, png, mermaid, d2

  // Content
  sourceData: jsonb("source_data"),
  diagramCode: text("diagram_code"), // Mermaid/D2 code if applicable
  imageUrl: text("image_url"),

  // Caption
  caption: text("caption"),
  actionCaption: text("action_caption"), // Caption starting with action verb

  // Dimensions
  width: integer("width"),
  height: integer("height"),

  // Generation
  generatedBy: varchar("generated_by", { length: 50 }), // ai, manual, template
  generationPrompt: text("generation_prompt"),

  // Approval
  status: varchar("status", { length: 50 }).default("draft"),
  approvedBy: varchar("approved_by", { length: 200 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/graphics.ts

"use server";

export async function createGraphic(data: CreateGraphicInput);
export async function updateGraphic(id: string, data: UpdateGraphicInput);
export async function deleteGraphic(id: string);
export async function suggestGraphics(sectionId: string): Promise<GraphicSuggestion[]>;
export async function generateOrgChart(staffingData: StaffingData): Promise<GraphicResult>;
export async function generateProcessFlow(processDescription: string): Promise<GraphicResult>;
export async function generateSchedule(scheduleData: ScheduleData): Promise<GraphicResult>;
export async function generateInfographic(data: InfographicData): Promise<GraphicResult>;
export async function generateActionCaption(graphicId: string): Promise<string>;
export async function validateGraphicConsistency(opportunityId: string): Promise<ConsistencyReport>;
export async function exportGraphics(opportunityId: string, format: "zip" | "pdf");
```

---

## Phase 4: Strategic Intelligence

**Duration:** 6-8 weeks
**Focus:** Competitive intelligence, pipeline management, win/loss analysis

---

### 4.1 Competitive Intelligence & Discriminator Engine

#### Database Schema

```typescript
// lib/db/schema-competitors.ts

export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Basic info
  name: varchar("name", { length: 500 }).notNull(),
  legalName: varchar("legal_name", { length: 500 }),
  website: text("website"),

  // Classification
  competitorType: varchar("competitor_type", { length: 100 }), // prime, sub, both
  sizeStandard: varchar("size_standard", { length: 50 }), // small, large

  // Capabilities
  capabilities: jsonb("capabilities").$type<{
    area: string;
    strength: "strong" | "moderate" | "weak";
    notes?: string;
  }[]>(),

  // Certifications
  certifications: jsonb("certifications").$type<string[]>(),
  contractVehicles: jsonb("contract_vehicles").$type<string[]>(),

  // Strengths and weaknesses
  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),

  // Pricing tendencies
  pricingTendency: varchar("pricing_tendency", { length: 100 }), // aggressive, moderate, premium
  averageWinPrice: real("average_win_price"),

  // Track record
  winCount: integer("win_count").default(0),
  lossCount: integer("loss_count").default(0),
  winsAgainstUs: integer("wins_against_us").default(0),
  lossesToUs: integer("losses_to_us").default(0),

  // Last update
  lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const discriminators = pgTable("discriminators", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Discriminator content
  statement: text("statement").notNull(),
  shortVersion: varchar("short_version", { length: 200 }),

  // Classification
  discriminatorType: varchar("discriminator_type", { length: 100 }), // capability, experience, approach, team, cost, schedule

  // Supporting evidence
  supportingEvidence: jsonb("supporting_evidence").$type<string[]>(),

  // Competitor targeting
  effectiveAgainst: jsonb("effective_against").$type<string[]>(), // Competitor IDs

  // Usage tracking
  useCount: integer("use_count").default(0),
  winCount: integer("win_count").default(0),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const ghostThemes = pgTable("ghost_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id").references(() => competitors.id),

  // Ghost theme content
  weakness: text("weakness").notNull(),
  ghostLanguage: text("ghost_language").notNull(), // Non-specific competitor language

  // Classification
  category: varchar("category", { length: 100 }),

  // Usage
  useCount: integer("use_count").default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/competitive.ts

"use server";

export async function createCompetitor(data: CreateCompetitorInput);
export async function updateCompetitor(id: string, data: UpdateCompetitorInput);
export async function deleteCompetitor(id: string);
export async function searchCompetitors(query: string, filters?: CompetitorFilters);
export async function identifyLikelyCompetitors(opportunityId: string): Promise<CompetitorMatch[]>;
export async function generateSWOT(opportunityId: string): Promise<SWOTAnalysis>;
export async function suggestDiscriminators(opportunityId: string): Promise<DiscriminatorSuggestion[]>;
export async function generateGhostTheme(competitorId: string, weakness: string): Promise<string>;
export async function suggestTeamingPartners(opportunityId: string): Promise<TeamingSuggestion[]>;
export async function generateCompetitiveMatrix(opportunityId: string): Promise<CompetitiveMatrix>;
export async function trackCompetitorWinLoss(competitorId: string, outcome: "win" | "loss", opportunityId: string);
```

---

### 4.2 Capture-to-Proposal Pipeline Manager

#### Database Schema

```typescript
// lib/db/schema-pipeline.ts

export const capturePipeline = pgTable("capture_pipeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Stage tracking
  currentStage: varchar("current_stage", { length: 100 }).notNull(),
  stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }),

  // Stages: discovery, qualification, capture, proposal, submitted, awarded, lost

  // Qualification
  bidDecision: varchar("bid_decision", { length: 50 }), // bid, no_bid, pending
  bidDecisionDate: timestamp("bid_decision_date", { withTimezone: true }),
  bidDecisionRationale: text("bid_decision_rationale"),

  // Pwin tracking
  pwinCurrent: real("pwin_current"),
  pwinHistory: jsonb("pwin_history").$type<{
    date: string;
    value: number;
    reason: string;
  }[]>(),

  // Customer relationship
  customerRelationshipScore: integer("customer_relationship_score"),
  incumbentStatus: varchar("incumbent_status", { length: 50 }),

  // Investment tracking
  captureInvestment: real("capture_investment"),
  proposalInvestment: real("proposal_investment"),

  // Key dates
  anticipatedRfpDate: timestamp("anticipated_rfp_date", { withTimezone: true }),
  actualRfpDate: timestamp("actual_rfp_date", { withTimezone: true }),
  proposalDueDate: timestamp("proposal_due_date", { withTimezone: true }),
  anticipatedAwardDate: timestamp("anticipated_award_date", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const captureActivities = pgTable("capture_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Activity info
  activityType: varchar("activity_type", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("pending"),

  // Outcome
  outcome: text("outcome"),
  nextSteps: jsonb("next_steps").$type<string[]>(),

  // Participants
  participants: jsonb("participants").$type<string[]>(),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const gateReviews = pgTable("gate_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Gate info
  gateType: varchar("gate_type", { length: 100 }).notNull(), // pursuit, bid_no_bid, proposal_ready, final_review
  gateName: varchar("gate_name", { length: 200 }),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  conductedDate: timestamp("conducted_date", { withTimezone: true }),

  // Decision
  decision: varchar("decision", { length: 50 }), // pass, conditional_pass, fail, defer
  conditions: jsonb("conditions").$type<string[]>(),
  rationale: text("rationale"),

  // Participants
  reviewers: jsonb("reviewers").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/pipeline.ts

"use server";

export async function initializePipeline(opportunityId: string);
export async function updatePipelineStage(pipelineId: string, newStage: string);
export async function updatePwin(pipelineId: string, newPwin: number, reason: string);
export async function recordActivity(pipelineId: string, activity: ActivityInput);
export async function scheduleGateReview(pipelineId: string, gateType: string, date: Date);
export async function conductGateReview(gateReviewId: string, decision: GateDecision);
export async function generateBidDecisionPackage(pipelineId: string): Promise<BidDecisionPackage>;
export async function getPipelineAnalytics(): Promise<PipelineAnalytics>;
export async function forecastPipeline(): Promise<PipelineForecast>;
export async function identifyAtRiskOpportunities(): Promise<AtRiskOpportunity[]>;
```

---

### 4.3 Win/Loss Intelligence Platform

#### Database Schema

```typescript
// lib/db/schema-winloss.ts

export const debriefs = pgTable("debriefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Outcome
  outcome: varchar("outcome", { length: 50 }).notNull(), // win, loss, no_award

  // Debrief info
  debriefDate: timestamp("debrief_date", { withTimezone: true }),
  debriefType: varchar("debrief_type", { length: 50 }), // written, oral, none

  // Scores (if available)
  technicalScore: real("technical_score"),
  technicalMaxScore: real("technical_max_score"),
  managementScore: real("management_score"),
  managementMaxScore: real("management_max_score"),
  pastPerfScore: real("past_perf_score"),
  pastPerfMaxScore: real("past_perf_max_score"),
  costScore: real("cost_score"),
  costMaxScore: real("cost_max_score"),
  overallRanking: integer("overall_ranking"),
  totalBidders: integer("total_bidders"),

  // Winner info (if loss)
  winnerName: varchar("winner_name", { length: 500 }),
  winningPrice: real("winning_price"),

  // Feedback
  evaluatorFeedback: text("evaluator_feedback"),
  strengthsIdentified: jsonb("strengths_identified").$type<string[]>(),
  weaknessesIdentified: jsonb("weaknesses_identified").$type<string[]>(),

  // Internal analysis
  internalAnalysis: text("internal_analysis"),
  lessonsLearned: jsonb("lessons_learned").$type<string[]>(),
  actionItems: jsonb("action_items").$type<{
    item: string;
    assignee: string;
    dueDate: string;
    status: string;
  }[]>(),

  // ROI
  proposalInvestment: real("proposal_investment"),
  contractValue: real("contract_value"), // If won

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const winLossPatterns = pgTable("win_loss_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Pattern identification
  patternType: varchar("pattern_type", { length: 100 }).notNull(),
  patternName: varchar("pattern_name", { length: 200 }).notNull(),
  description: text("description"),

  // Statistics
  occurrenceCount: integer("occurrence_count").default(0),
  winCorrelation: real("win_correlation"),
  lossCorrelation: real("loss_correlation"),

  // Recommendations
  recommendations: jsonb("recommendations").$type<string[]>(),

  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/winloss.ts

"use server";

export async function createDebrief(data: CreateDebriefInput);
export async function updateDebrief(id: string, data: UpdateDebriefInput);
export async function analyzeWinLossPatterns(): Promise<PatternAnalysis>;
export async function getWinLossStatistics(filters?: WinLossFilters): Promise<WinLossStats>;
export async function generateLessonsLearnedReport(): Promise<LessonsReport>;
export async function calculateProposalROI(): Promise<ROIAnalysis>;
export async function identifyImprovementAreas(): Promise<ImprovementArea[]>;
export async function trackDebriefActionItems();
export async function compareToCompetitors(competitorId: string): Promise<CompetitorComparison>;
export async function exportWinLossReport(format: "pdf" | "xlsx"): Promise<string>;
```

---

## Phase 5: Predictive & Presentation

**Duration:** 4-6 weeks
**Focus:** Predictive analytics, oral presentations, final optimizations

---

### 5.1 Predictive Win Probability Engine

#### Database Schema

```typescript
// lib/db/schema-pwin.ts

export const pwinFactors = pgTable("pwin_factors", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Factor definition
  factorName: varchar("factor_name", { length: 200 }).notNull(),
  factorCategory: varchar("factor_category", { length: 100 }).notNull(),
  description: text("description"),

  // Scoring
  weight: real("weight").default(1),
  minScore: real("min_score").default(0),
  maxScore: real("max_score").default(10),

  // Correlation to outcomes
  winCorrelation: real("win_correlation"),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const pwinAssessments = pgTable("pwin_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Assessment timing
  assessedAt: timestamp("assessed_at", { withTimezone: true }).defaultNow(),
  assessedBy: varchar("assessed_by", { length: 200 }),

  // Factor scores
  factorScores: jsonb("factor_scores").$type<{
    factorId: string;
    score: number;
    notes?: string;
  }[]>(),

  // Calculated Pwin
  calculatedPwin: real("calculated_pwin"),
  confidenceInterval: jsonb("confidence_interval").$type<{
    lower: number;
    upper: number;
  }>(),

  // Sensitivity analysis
  sensitivityAnalysis: jsonb("sensitivity_analysis").$type<{
    factorId: string;
    impactIfImproved: number;
  }[]>(),

  // Recommendations
  recommendations: jsonb("recommendations").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pwinModelPerformance = pgTable("pwin_model_performance", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Model version
  modelVersion: varchar("model_version", { length: 50 }).notNull(),

  // Performance metrics
  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  auc: real("auc"),

  // Training data
  trainingSetSize: integer("training_set_size"),
  testSetSize: integer("test_set_size"),

  // Feature importance
  featureImportance: jsonb("feature_importance").$type<{
    factorId: string;
    importance: number;
  }[]>(),

  trainedAt: timestamp("trained_at", { withTimezone: true }).defaultNow(),
});
```

#### Server Actions

```typescript
// lib/actions/pwin.ts

"use server";

export async function assessPwin(opportunityId: string, scores: FactorScore[]): Promise<PwinAssessment>;
export async function getPwinHistory(opportunityId: string): Promise<PwinHistory>;
export async function runSensitivityAnalysis(opportunityId: string): Promise<SensitivityResult>;
export async function getRecommendationsToImprovePwin(opportunityId: string): Promise<Recommendation[]>;
export async function optimizePortfolio(): Promise<PortfolioOptimization>;
export async function compareOpportunities(opportunityIds: string[]): Promise<OpportunityComparison>;
export async function trainPwinModel(): Promise<ModelTrainingResult>;
export async function evaluateModelPerformance(): Promise<ModelPerformance>;
export async function forecastWinProbabilities(): Promise<ForecastResult>;
```

---

### 5.2 Oral Presentation Generator

#### Database Schema

```typescript
// lib/db/schema-presentations.ts

export const oralPresentations = pgTable("oral_presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),

  // Presentation info
  title: varchar("title", { length: 500 }).notNull(),

  // Requirements
  timeLimit: integer("time_limit"), // minutes
  formatRequirements: text("format_requirements"),

  // Source document
  sourceProposalId: uuid("source_proposal_id"),

  // Status
  status: varchar("status", { length: 50 }).default("draft"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const presentationSlides = pgTable("presentation_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id").references(() => oralPresentations.id, { onDelete: "cascade" }),

  // Slide info
  slideNumber: integer("slide_number").notNull(),
  title: varchar("title", { length: 200 }),

  // Content
  content: jsonb("content").$type<{
    type: "text" | "bullet" | "image" | "chart" | "table";
    data: any;
  }[]>(),

  // Speaker notes
  speakerNotes: text("speaker_notes"),
  estimatedDuration: integer("estimated_duration"), // seconds

  // Source mapping
  sourceSectionIds: jsonb("source_section_ids").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const presentationQA = pgTable("presentation_qa", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id").references(() => oralPresentations.id, { onDelete: "cascade" }),

  // Question
  likelyQuestion: text("likely_question").notNull(),
  questionCategory: varchar("question_category", { length: 100 }),
  probability: real("probability"),

  // Answer
  suggestedAnswer: text("suggested_answer"),
  keyPoints: jsonb("key_points").$type<string[]>(),
  supportingEvidence: jsonb("supporting_evidence").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const practiceRecordings = pgTable("practice_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id").references(() => oralPresentations.id, { onDelete: "cascade" }),

  // Recording info
  recordingUrl: text("recording_url"),
  duration: integer("duration"), // seconds

  // Analysis
  pacingAnalysis: jsonb("pacing_analysis"),
  contentCoverage: jsonb("content_coverage"),

  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  recordedBy: varchar("recorded_by", { length: 200 }),
});
```

#### Server Actions

```typescript
// lib/actions/presentations.ts

"use server";

export async function createPresentation(opportunityId: string): Promise<OralPresentation>;
export async function generateSlidesFromProposal(presentationId: string, proposalId: string): Promise<Slide[]>;
export async function updateSlide(slideId: string, data: UpdateSlideInput);
export async function generateSpeakerNotes(slideId: string): Promise<string>;
export async function anticipateQuestions(presentationId: string): Promise<QAItem[]>;
export async function generateAnswerSuggestion(questionId: string): Promise<string>;
export async function validateTimelimits(presentationId: string): Promise<TimingAnalysis>;
export async function exportPresentation(presentationId: string, format: "pptx" | "pdf" | "html");
export async function recordPractice(presentationId: string, recordingUrl: string);
export async function analyzePracticeRecording(recordingId: string): Promise<PracticeAnalysis>;
```

---

## Database Migration Plan

### Migration Order

```bash
# Phase 1
npx drizzle-kit generate:pg --name=rfp-parser
npx drizzle-kit generate:pg --name=content-library
npx drizzle-kit generate:pg --name=compliance-validator

# Phase 2
npx drizzle-kit generate:pg --name=past-performance
npx drizzle-kit generate:pg --name=personnel
npx drizzle-kit generate:pg --name=task-management
npx drizzle-kit generate:pg --name=reviews
npx drizzle-kit generate:pg --name=formatting

# Phase 3
npx drizzle-kit generate:pg --name=win-themes
npx drizzle-kit generate:pg --name=evidence
npx drizzle-kit generate:pg --name=pricing
npx drizzle-kit generate:pg --name=graphics

# Phase 4
npx drizzle-kit generate:pg --name=competitors
npx drizzle-kit generate:pg --name=pipeline
npx drizzle-kit generate:pg --name=winloss

# Phase 5
npx drizzle-kit generate:pg --name=pwin
npx drizzle-kit generate:pg --name=presentations
```

---

## Testing Strategy

### Unit Tests
- All server actions
- Database operations
- AI prompt construction
- Validation logic

### Integration Tests
- API endpoints
- Database transactions
- AI model responses
- File upload/processing

### E2E Tests
- Complete user workflows
- RFP upload to compliance matrix
- Content library search and insert
- Review workflow completion

### Performance Tests
- Large document parsing
- Semantic search at scale
- Concurrent user load

---

## Deployment Plan

### Phase 1 Deployment
1. Deploy database migrations
2. Deploy API routes
3. Deploy UI components
4. Enable feature flags for beta users
5. Monitor and iterate

### Rollback Plan
- Database rollback scripts
- Feature flag disable
- Previous deployment restoration

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| RFP analysis time | 6 hours | 30 min |
| Content search time | 2 hours | 10 min |
| Compliance accuracy | 85% | 99% |
| Review cycle time | 3 days | 1 day |
| Win rate | Current | +40% |
| Proposal cost | Current | -50% |

---

*Plan Version: 1.0*
*Created: February 2026*
*Total Estimated Effort: 6-9 months*
