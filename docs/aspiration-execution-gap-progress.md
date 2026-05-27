# Aspiration Execution Gap Progress

## Objective

Close the aspiration execution gap and rapidly reach a fully functional platform that reliably finds opportunities and creates winning responses to them. The target state includes working opportunity discovery, search/download, scraping, RFP intake, response generation, governance, verification, and deployment readiness.

## Operating Rules

- Keep the full objective intact; do not redefine completion around partial slices.
- Track every concrete slice here.
- Commit and push coherent, verified work regularly.
- Use SearXNG at `https://search.lindela.io` for web search.
- Use Firecrawl at `http://84.247.181.100:3002` for scraping.
- Use the Playwright/headless browser service at `http://84.247.181.100:3003` for pages that require browser/stealth behavior.
- Do not connect app/session/cache traffic to the connectivity-local Redis on `84.247.181.100`; that Redis is for Firecrawl/SearXNG internals only.

## Progress Log

### 2026-05-27 - Unusable AI Win Theme Artifact Fallbacks

Status: implemented and verified.

Purpose: keep response strategy support from treating non-empty AI arrays with blank or malformed win-theme artifacts as usable generated content.

Changes in this slice:
- Validate AI win-theme suggestions for non-empty statement text before returning them.
- Validate AI ghost-theme suggestions for non-empty counter-positioning statements, normalize phrasings, and clamp subtlety.
- Validate AI reinforcement options for non-empty text, safe tone, and finite word count.
- Reuse deterministic win-theme, ghost-theme, and reinforcement fallbacks when AI arrays contain no usable artifacts.

Verification:
- `npm test -- win-themes-auth.test.ts --run` passed with 20 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 154 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - AI Discovery Query Fallbacks

Status: implemented and verified.

Purpose: keep document discovery from spending SearXNG searches on blank or malformed AI-generated query rows when deterministic tender identifiers are available.

Changes in this slice:
- Validate AI discovery query rows for non-empty query text before sorting and searching.
- Trim accepted AI query strings and file-type query strings before deduplication.
- Fall back to deterministic enhanced tender queries when AI output contains no usable queries.
- Reset per-test service mock implementations in document discovery coverage to prevent cross-case query leakage.

Verification:
- `npm test -- document-discovery-agent.test.ts --run` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 137 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Competitive Discriminator Fallbacks

Status: implemented and verified.

Purpose: keep competitive differentiation support from accepting syntactically valid but empty AI discriminator rows that suppress deterministic discriminator suggestions.

Changes in this slice:
- Validate AI discriminator suggestions for non-empty statement and rationale before accepting them.
- Trim accepted AI discriminator fields, normalize `effectiveAgainst`, and clamp confidence.
- Reuse deterministic discriminator suggestions when AI returns only unusable suggestion objects.
- Add regression coverage for an AI discriminator response of `[{}]`.

Verification:
- `npm test -- competitive.test.ts --run` passed with 80 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 151 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Win/Loss Insight Fallbacks

Status: implemented and verified.

Purpose: keep win/loss strategy support from returning a successful empty insight list when AI returns only blank strings.

Changes in this slice:
- Treat AI win/loss insight arrays as unusable when trimming leaves zero substantive insights.
- Reuse heuristic win/loss insights when blank AI output is unusable and observed evidence exists.
- Add regression coverage for all-blank AI insight arrays.

Verification:
- `npm test -- winloss-auth.test.ts --run` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 150 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Document Analysis Finding Guards

Status: implemented and verified.

Purpose: keep document quality analysis from saving blank AI issues or suggestions as actionable proposal-improvement findings.

Changes in this slice:
- Drop AI analysis issues with blank messages before creating analysis findings.
- Drop AI suggestions with blank text before saving improvement guidance.
- Normalize invalid issue severity, suggestion type, and suggestion impact values to safe defaults.
- Add regression coverage for blank issue/suggestion rows from an available AI provider.

Verification:
- `npm test -- document-analysis-scope.test.ts --run` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 43 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Opportunity Factor Fallbacks

Status: implemented and verified.

Purpose: keep opportunity fit, win-probability, and risk scoring from accepting valid JSON factor arrays that contain no usable scoring factors.

Changes in this slice:
- Validate AI score factors for non-empty factor names, finite weights/scores, and non-empty reasoning.
- Clamp accepted AI weights and scores into supported ranges.
- Reuse heuristic scoring when AI fit, win, or risk factor arrays contain no usable factors.
- Add regression coverage for an AI factor response of `{ "factors": [{}] }`.

Verification:
- `npm test -- opportunity-ai-scope.test.ts --run` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 42 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Presentation Q&A Fallbacks

Status: implemented and verified.

Purpose: keep oral-presentation preparation from returning zero anticipated questions when AI returns an empty or unusable JSON array despite available slide or requirement context.

Changes in this slice:
- Normalize AI-generated anticipated questions to require non-empty question text.
- Clamp probability and default optional classification fields when usable question text exists.
- Fall back to deterministic Q&A generation when contextual presentations receive no usable AI questions.
- Add presentation scope coverage to the Wave 9 presentation proof manifest.

Verification:
- `npm test -- presentations-scope.test.ts --run` passed with 7 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 17 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Section Content Fallbacks

Status: implemented and verified.

Purpose: keep generated proposal sections from turning valid but empty AI paragraph JSON into successful documents containing raw JSON instead of proposal prose.

Changes in this slice:
- Filter AI-generated section paragraphs to non-empty text before creating document content.
- Treat parsed JSON with no usable paragraphs as unusable and reuse deterministic section prose.
- Preserve raw-text fallback for non-JSON provider responses while avoiding raw empty JSON artifacts.
- Add regression coverage for empty paragraph strings.

Verification:
- `npm test -- document-generation-auth.test.ts --run` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 41 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI PWin Recommendation Fallbacks

Status: implemented and verified.

Purpose: keep AI PWin recommendation generation from suppressing useful heuristic recommendations when the provider returns non-empty but unusable objects.

Changes in this slice:
- Validate AI PWin recommendation rows for non-empty recommendation/factor text, finite expected impact, and supported priority/effort/timeframe values.
- Ignore unusable AI recommendation rows and fall back to heuristic recommendations when none remain.
- Trim accepted AI recommendation text and factor names before mapping factor IDs.
- Add regression coverage for an AI response of `[{}]`.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts --run` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 149 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Win-Theme Fallbacks

Status: implemented and verified.

Purpose: keep response strategy support from returning successful empty win-theme artifacts when AI returns valid JSON with empty lists.

Changes in this slice:
- Treat empty AI theme-suggestion lists as unusable and reuse deterministic theme suggestions.
- Treat empty AI reinforcement options as unusable and reuse deterministic reinforcement text.
- Treat empty AI ghost-theme lists as unusable and reuse deterministic ghost theme suggestions.
- Treat empty AI injection-suggestion lists as unusable and reuse deterministic injection drafts.
- Add regression coverage for all four empty-list cases.

Verification:
- `npm test -- win-themes-auth.test.ts --run` passed with 17 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 148 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Capture Pipeline Fallbacks

Status: implemented and verified.

Purpose: keep capture pipeline decision support from treating syntactically valid but content-free AI output as successful PWin confidence or bid-decision analysis.

Changes in this slice:
- Keep suggested PWin confidence finite when AI returns empty JSON or a non-numeric confidence value.
- Treat bid-decision AI responses with blank executive summary, blank competitive position, or invalid recommendation as unusable.
- Reuse deterministic bid-decision analysis for unusable AI responses and trim accepted AI fields.
- Add regression coverage for empty AI JSON in suggested PWin and bid-decision generation.

Verification:
- `npm test -- pipeline-scope.test.ts --run` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave4-capture-pipeline-scope` passed with 13 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Document Generation Fallbacks

Status: implemented and verified.

Purpose: keep document structure and diagram generation from returning successful empty artifacts when AI returns valid but content-free output.

Changes in this slice:
- Treat AI document-structure responses with an empty array as unusable and reuse the existing deterministic outline fallback.
- Treat blank Mermaid diagram code after code-fence cleanup as unusable and reuse deterministic diagram generation.
- Add regression coverage for empty structure arrays and blank diagram code.

Verification:
- `npm test -- document-generation-auth.test.ts --run` passed with 7 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 40 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Pricing Production Fallbacks

Status: implemented and verified.

Purpose: prevent pricing production support from returning successful but unusable cost realism or WBS artifacts when AI returns valid JSON with missing substantive content.

Changes in this slice:
- Treat parsed AI cost-realism responses as unusable unless they include assessment, numeric score, factors, and non-empty narrative.
- Treat parsed AI WBS responses with zero flattened items as unusable.
- Reuse deterministic cost-realism and WBS fallbacks for these structurally empty AI responses.
- Add regression coverage for empty cost-realism JSON and empty WBS item arrays.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` passed the full non-live proof manifest before this slice.
- `npm test -- pricing.test.ts --run` passed with 101 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 281 tests.

Remaining after this slice:
- Continue auditing response-production paths for structurally valid but unusable AI output.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Pricing Fallbacks

Status: implemented and verified.

Purpose: keep pricing support from accepting syntactically valid but empty AI output as successful cost suggestions or staffing estimates.

Changes in this slice:
- Treat parsed AI cost-suggestion responses with no suggestions as unusable and reuse deterministic cost suggestions.
- Treat parsed AI technical-hours responses with no usable hours or staffing as unusable and reuse deterministic hours estimates.
- Apply the same empty-staffing guard to scope-based hours estimation.
- Add pricing engine coverage to the Wave 6 production proof manifest.

Verification:
- `npm test -- pricing.test.ts --run` passed with 99 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 279 tests.

Remaining after this slice:
- Continue auditing pricing and response-production paths for structurally valid but unusable AI output.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Past-Performance Narrative Fallbacks

Status: implemented and verified.

Purpose: stop past-performance support narratives from being saved as successful empty artifacts when an AI provider returns blank content.

Changes in this slice:
- Treat blank AI CPAR narrative output as unusable and reuse the deterministic CPAR fallback.
- Treat blank AI brief-description output as unusable and reuse the deterministic brief-description fallback.
- Treat blank AI relevance-narrative output as unusable and reuse the deterministic relevance fallback.
- Add regression coverage for all three blank-AI narrative paths.

Verification:
- `npm test -- past-performance-scope.test.ts --run` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 144 tests.

Remaining after this slice:
- Continue auditing response-support generation paths for blank AI output that can still be reported as successful.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Ghost Theme Fallback

Status: implemented and verified.

Purpose: stop competitive ghost-theme generation from returning a successful empty response when an AI provider returns blank content.

Changes in this slice:
- Treat blank AI ghost-theme text as unusable.
- Reuse the existing deterministic ghost-language fallback for the supplied competitor weakness.
- Add regression coverage proving blank AI output still returns a non-empty evaluator-facing ghost theme.

Verification:
- `npm test -- competitive.test.ts --run` passed with 79 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 141 tests.

Remaining after this slice:
- Continue closing successful-empty response-support paths where AI returns syntactically valid but unusable content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Command Center Readiness Dimension Resilience

Status: implemented and verified.

Purpose: keep the opportunity command center from crashing when a readiness-dimension projection omits optional detail rows.

Changes in this slice:
- Default readiness dimension details to an empty list at render time.
- Preserve existing Response Readiness cards and action links when older or harnessed projections do not include detail arrays.
- Use the broad non-live proof manifest to identify the failure, then rerun the failing Wave 1 browser scenario after the fix.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` ran the full non-live proof manifest; every scenario passed except the pre-fix `wave1-control-plane-browser` command-center crash.
- `npm run platform:proof -- --run wave1-control-plane-browser` passed with 3 browser tests after the fix.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue non-DB hardening while live persistence remains blocked by PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-27 - Firecrawl-Enriched SearXNG Discovery Results

Status: implemented and verified.

Purpose: move default opportunity discovery from thin SearXNG result cards toward usable RFP intake material by scraping top search hits through Firecrawl.

Changes in this slice:
- Add bounded Firecrawl enrichment to `DefaultDiscoveryService.discover_opportunities` after SearXNG candidate discovery.
- Capture clean markdown, metadata, scraped links, extraction payload, truncation status, and likely RFP/document links on enriched opportunities.
- Keep enrichment configurable through `enrich` and `enrich_limit` filters plus `DISCOVERY_FIRECRAWL_ENRICH_LIMIT`.
- Add Firecrawl to discovery source listing alongside SearXNG.
- Add regression coverage proving SearXNG results are enriched, cached, and produce absolute RFP document links without live network calls.

Verification:
- `uv run pytest tests/ci/test_discovery_service_contract.py tests/ci/test_search_infrastructure_config.py -q` passed with 7 tests.
- `uv run pytest tests/ci/test_discovery_service_contract.py tests/ci/test_search_infrastructure_config.py tests/ci/test_intelligence_service_contract.py -q` passed with 10 tests.
- `python -m py_compile src/docfusion/services/discovery_service.py tests/ci/test_discovery_service_contract.py` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue connecting enriched discovery output into persisted import/intake flows and live proof once PostgreSQL connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Speaker Notes on Blank AI

Status: implemented and verified.

Purpose: keep oral-presentation rehearsal notes usable when an AI provider returns blank speaker-note text.

Changes in this slice:
- Treat blank AI speaker-note responses as unusable instead of saving empty slide notes.
- Reuse the existing deterministic speaker-note fallback from slide title, timing, and bullet/text content.
- Add regression coverage proving blank AI output writes reviewable speaker notes back to the scoped slide.

Verification:
- `npm test -- presentations-scope.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing successful-empty response rehearsal artifacts and broaden proof where platform scenarios include those paths.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Presentation Slides on Empty AI

Status: implemented and verified.

Purpose: keep oral-presentation deck generation usable when an AI provider returns a valid but empty slide array.

Changes in this slice:
- Treat empty AI slide arrays as unusable instead of creating a successful presentation with zero slides.
- Reuse the existing deterministic slide-deck fallback from presentation context and proposal document text.
- Add regression coverage proving empty AI output still inserts a reviewable title/agenda fallback deck and updates the presentation slide count.

Verification:
- `npm test -- presentations-scope.test.ts` passed with 5 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing successful-empty response artifacts, especially where providers return syntactically valid but unusable output.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Presentation Q&A Answers on Blank AI

Status: implemented and verified.

Purpose: keep oral-presentation Q&A preparation usable when an AI provider returns blank answer text.

Changes in this slice:
- Treat blank AI answer suggestions as unusable instead of saving empty Q&A answers.
- Reuse the existing deterministic answer fallback from stored question key points.
- Add regression coverage proving blank AI output writes a reviewable answer back to the scoped Q&A item.

Verification:
- `npm test -- presentations-scope.test.ts` passed with 4 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing blank or malformed provider paths in response rehearsal and final presentation workflows.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Heuristic SWOT Fallback on Malformed AI

Status: implemented and verified.

Purpose: keep competitive SWOT analysis usable when an AI provider is available but returns malformed analysis output.

Changes in this slice:
- Reuse the existing evidence-based heuristic SWOT generator when AI SWOT parsing fails.
- Preserve AI-generated SWOT output when valid and the heuristic path when AI is unavailable.
- Store malformed-AI fallbacks as `system-heuristic` analyses instead of failing the whole action.
- Add regression coverage proving provider-available malformed AI still persists and returns a heuristic SWOT with evidence-based insights.

Verification:
- `npm test -- competitive.test.ts` passed with 78 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 140 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing malformed-provider strategic analysis paths where heuristic evidence already exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic BOE Narrative Fallbacks

Status: implemented and verified.

Purpose: keep cost-volume Basis of Estimate drafting usable when AI narrative generation is unavailable but structured cost element data is already available.

Changes in this slice:
- Add deterministic BOE narrative generation for labor, ODC, subcontract, travel, and generic cost elements.
- Preserve AI-generated BOE narratives when available while falling back on blank or failed AI responses.
- Use existing WBS, labor category, hours, rates, direct costs, vendor, quote, subcontractor, and travel fields to draft auditable review text.
- Add regression coverage proving unavailable AI still writes a BOE narrative back to the scoped cost element.

Verification:
- `npm test -- pricing.test.ts` passed with 97 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing pricing and response-production paths where structured records can produce deterministic draft artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Discriminator Suggestions

Status: implemented and verified.

Purpose: keep competitive positioning actionable when AI discriminator generation is unavailable but linked competitor weaknesses are already recorded.

Changes in this slice:
- Add deterministic discriminator suggestions from assigned opportunity context and visible competitor weaknesses.
- Classify weakness signals into cost, schedule, team, past-performance, innovation, approach, or capability discriminator types.
- Avoid duplicating active discriminator statements while preserving existing relevant discriminator suggestions.
- Add regression coverage proving unavailable AI still returns reviewable discriminator suggestions effective against the linked competitor.

Verification:
- `npm test -- competitive.test.ts` passed with 77 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 139 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing successful-empty strategic planning paths where recorded opportunity or competitor evidence can produce operator actions.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Graphic Action Captions

Status: implemented and verified.

Purpose: keep proposal graphics captioning usable when AI caption generation is unavailable or fails.

Changes in this slice:
- Add deterministic action caption generation from stored graphic title, type, caption, and diagram context.
- Preserve AI-generated captions when available while normalizing them to start with proposal action verbs.
- Fall back to type-aware captions for process flows, org charts, schedules, timelines, infographics, charts, and generic diagrams.
- Add regression coverage proving unavailable AI still writes a reviewable action caption to the graphic record.

Verification:
- `npm test -- graphics-scope.test.ts` passed with 12 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 180 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing AI-only response-support paths where stored proposal artifacts can produce deterministic review content.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Document Diagram Fallbacks

Status: implemented and verified.

Purpose: keep response-authoring visuals available when AI diagram generation is unavailable or fails.

Changes in this slice:
- Add deterministic Mermaid generation for flowchart, sequence, state, gantt, mindmap, class, and ER diagram requests.
- Preserve napkin sketch generation without requiring AI.
- Return deterministic diagrams when the AI provider is unavailable or generation fails, instead of returning an error-only diagram.
- Add regression coverage proving unavailable AI still produces a reviewable flowchart without calling the provider.

Verification:
- `npm test -- document-generation-auth.test.ts` passed with 5 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 38 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing response-authoring gaps where draft artifacts can be generated deterministically from structured inputs.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Document Structure Auto-Fill Creation

Status: implemented and verified.

Purpose: remove the deferred document-generation auto-fill path so generated response outlines can immediately become editable draft documents with generated section content.

Changes in this slice:
- Implement `createDocumentFromStructure(..., { autoFill: true })` by generating content for each structure node during document creation.
- Preserve editable outline creation for `autoFill: false`.
- Add per-section deterministic fallback content if AI section generation fails, so one failed section does not block draft creation.
- Store generated content and word count in the created document and initial version.
- Add document-generation auto-fill coverage to Wave 5 AI/content governance proof.

Verification:
- `npm test -- document-generation-auth.test.ts` passed with 4 tests.
- `npm test -- platform-proof-scenarios.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 37 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing response-generation paths where authoring features are still unavailable or only partially wired.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Partner Sourcing Actions for Capability Gaps

Status: implemented and verified.

Purpose: keep capture planning actionable when opportunity capability gaps exist but no active partner or teaming-capable competitor currently matches them.

Changes in this slice:
- Add partner-sourcing fallback suggestions for uncovered capability gaps.
- Preserve existing matched partner recommendations and append sourcing actions only for gaps not covered by any recommendation.
- Return bounded, low-confidence sourcing actions without fabricating partner IDs.
- Add regression coverage proving security and cloud gaps produce explicit sourcing actions when no partner records match.

Verification:
- `npm test -- competitive.test.ts` passed with 76 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 138 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing silent successful-empty capture/response support paths where scoped gaps can produce operator actions.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Ghost Theme Fallbacks

Status: implemented and verified.

Purpose: keep competitive ghost-theme generation usable when AI output is malformed but scoped competitor weaknesses and our differentiators are available.

Changes in this slice:
- Add deterministic ghost-theme suggestions from competitor weakness and our differentiator fields.
- Preserve competitor linkage, subtlety level, phrasings, rationale, and pending review status.
- Return deterministic ghost themes after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces reviewable ghost-theme suggestions.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 137 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining successful-empty response-support paths where scoped evidence can produce deterministic artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Win-Theme Reinforcement Fallbacks

Status: implemented and verified.

Purpose: keep section-level win-theme reinforcement usable when AI reinforcement output is malformed but the active theme and supporting evidence are available.

Changes in this slice:
- Add deterministic reinforcement text options from theme statement, short version, supporting evidence, requested tone, and option count.
- Return placement guidance and bounded word counts with generated reinforcement options.
- Return deterministic reinforcement text after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces reviewable reinforcement options.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 12 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 136 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing AI-only competitive/ghost-theme paths where scoped competitor context can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Win-Theme Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep strategic win-theme generation usable when AI suggestion output is malformed but competitor weaknesses and operator context already contain theme signals.

Changes in this slice:
- Add deterministic win-theme suggestions from competitor weaknesses, past-performance proof, value/cost language, and differentiation context.
- Avoid duplicating existing theme statements and respect requested theme-type filters.
- Generate bounded confidence, rationale, keywords, and pending review status from explicit context signals.
- Return deterministic theme suggestions after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces reviewable win-theme suggestions.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 135 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing AI-only win-theme and response-reinforcement paths where scoped context can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Cost Realism Fallbacks

Status: implemented and verified.

Purpose: keep pricing review usable when AI cost-realism output is malformed but calculated pricing totals, labor mix, and cost elements are already available.

Changes in this slice:
- Add deterministic cost-realism analysis from calculated pricing summary, cost elements, labor hours, labor rate, direct-cost mix, and indirect-rate signals.
- Generate bounded scores, factor assessments, risks, mitigations, and narrative from explicit pricing evidence.
- Return deterministic analysis after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces a reviewable cost-realism assessment.

Verification:
- `npm test -- pricing.test.ts` passed with 96 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only pricing and BOE paths where calculated cost data can support deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic WBS Generation Fallback

Status: implemented and verified.

Purpose: keep cost-volume work breakdown structure generation usable when AI WBS output is malformed but assigned technical tracking records are already available.

Changes in this slice:
- Add deterministic WBS generation from technical tracking section names.
- Build a level-1 program delivery root with level-2 work packages linked to technical section IDs.
- Return deterministic WBS items after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still returns reviewable WBS items.

Verification:
- `npm test -- pricing.test.ts` passed with 95 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only pricing/BOE paths where scoped technical records can produce deterministic artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Hours Estimate Fallbacks

Status: implemented and verified.

Purpose: keep BOE staffing work moving when AI hour-estimate output is malformed but technical scope and active labor categories are available.

Changes in this slice:
- Add deterministic hours estimates from scope length, complexity keywords, active labor categories, and explicit complexity multipliers.
- Return fallback hour estimates for both technical-section estimates and freeform scope estimates after AI parse failure.
- Persist implied staffing on technical tracking records when deterministic technical estimates are used.
- Add regression coverage proving malformed AI output still stores implied staffing and returns a reviewable estimate.

Verification:
- `npm test -- pricing.test.ts` passed with 94 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only BOE and pricing analysis paths where existing cost/technical records can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Cost Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep cost-technical alignment work moving when AI cost-suggestion output is malformed but the technical section and active labor categories already provide enough pricing signals.

Changes in this slice:
- Add deterministic cost suggestions from section content, active labor categories, rates, and direct-cost keywords.
- Map technical sections to likely labor categories and estimate bounded fallback hours.
- Add ODC, travel, and subcontract suggestions from explicit section signals.
- Return reviewable fallback suggestions after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces labor, ODC, and travel suggestions.

Verification:
- `npm test -- pricing.test.ts` passed with 93 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only pricing and BOE generation failures where existing technical/cost inputs can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Process Flow Generation Fallback

Status: implemented and verified.

Purpose: keep process-flow graphics generation usable when AI output is malformed but the submitted process description already contains enough ordered steps to create a Mermaid diagram.

Changes in this slice:
- Derive process-flow steps from the provided description using sentence, line, and transition-word boundaries.
- Build deterministic Mermaid `flowchart TD` output with sanitized labels when AI output cannot be parsed or contains no usable diagram.
- Preserve existing raw Mermaid extraction when AI returns a flowchart outside JSON.
- Add regression coverage proving malformed AI output still returns a non-empty process flow without touching persistence when no opportunity is supplied.

Verification:
- `npm test -- graphics-scope.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 179 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing AI-only generation failures where user-supplied structured text can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Graphics Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep proposal sections from receiving a successful empty graphics suggestion set when AI output is malformed but section content contains visualizable evidence.

Changes in this slice:
- Add deterministic graphics suggestions from section keywords for process flow, schedule, team structure, metrics chart, and summary infographic cases.
- Return evidence-based fallback suggestions when AI graphic suggestion JSON parsing fails.
- Preserve suggestion ordering by confidence and cap fallback output to five reviewable items.
- Add regression coverage proving malformed AI output still returns non-empty graphics suggestions for workflow, milestone, team, and metric evidence.

Verification:
- `npm test -- graphics-scope.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 178 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing response-production paths where malformed AI output hides deterministic review artifacts behind successful empty results.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Win-Theme Injection Fallbacks

Status: implemented and verified.

Purpose: keep generated responses able to reinforce active win themes when AI injection suggestion output is malformed.

Changes in this slice:
- Add deterministic win-theme injection drafts from active theme statement, target sections, supporting evidence, keywords, and mapped criteria.
- Avoid suggesting a deterministic injection into sections where the same theme already has an occurrence.
- Persist deterministic fallback injections as pending review items with evidence-based rationale and bounded impact score.
- Convert malformed AI injection output into deterministic suggestions instead of a failed generation response.
- Add regression coverage proving malformed AI output still creates a reviewable injection suggestion.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 134 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing response-generation paths where malformed AI output blocks deterministic, evidence-backed review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Actionable PWin Recommendation Fallbacks

Status: implemented and verified.

Purpose: stop PWin improvement fallback generation from returning a successful empty recommendation set when moderate but actionable factor weaknesses are present.

Changes in this slice:
- Generate heuristic recommendations for all actionable sensitivity factors, not only high-priority/high-impact factors.
- Fall back to scored factor gaps when stored sensitivity rows are missing or incomplete.
- Include expected PWin impact and current factor score in deterministic recommendation text.
- Preserve prioritization by factor priority and impact while limiting output to the top three actions.
- Add regression coverage proving moderate sensitivity evidence produces persisted recommendations instead of an empty success.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts` passed with 8 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing successful empty response-support outputs where the domain has enough evidence to produce actionable guidance.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Win/Loss Pattern Confidence

Status: implemented and verified.

Purpose: stop heuristic win/loss pattern analysis from assigning fixed confidence and correlation values instead of reflecting observed debrief evidence.

Changes in this slice:
- Derive strength and weakness pattern correlations from win-versus-loss occurrence rates.
- Derive heuristic pattern confidence from sample size, occurrence count, and outcome evidence.
- Derive pricing pattern confidence from sample size, scored-debrief coverage, and cost-score separation.
- Replace the fixed heuristic overall confidence with the average confidence of generated patterns.
- Add regression coverage proving persisted pattern confidence and correlation values come from observed win/loss evidence.

Verification:
- `npm test -- winloss-auth.test.ts` passed with 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 132 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic confidence values in response-support analysis paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Competitive SWOT Fallbacks

Status: implemented and verified.

Purpose: stop competitive SWOT fallback analysis from storing a generic heuristic insight with fixed confidence instead of showing which competitive evidence supported the recommendation.

Changes in this slice:
- Replace the generic `Analysis generated using heuristic methods` SWOT insight with evidence-specific insight rows for company capabilities, linked competitors, and opportunity metadata.
- Derive heuristic confidence from available signal counts and cap it below AI-backed confidence.
- Stop inventing an `Established track record` strength when company capability evidence is missing; the fallback now records that no capability strength evidence is present.
- Add regression coverage proving heuristic SWOT insights are evidence-specific, bounded, and persisted.
- Add competitive SWOT coverage to the Wave 8 strategic capability proof manifest.

Verification:
- `npm test -- competitive.test.ts` passed with 75 tests.
- `npm test -- competitive.test.ts platform-proof-scenarios.test.ts` passed with 81 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 131 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic confidence values in response-support analysis paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Metadata-Backed Opportunity Summaries

Status: implemented and verified.

Purpose: stop opportunity summary generation from returning generic unavailable text when AI is unavailable or a provider call fails despite having useful opportunity metadata.

Changes in this slice:
- Generate deterministic opportunity summaries from title, buyer, category, budget, deadline, project summary, and key requirements.
- Load the scoped opportunity before provider availability checks so no-provider runs can still return actionable metadata-backed summaries.
- Use the same metadata-backed summary when prompt execution fails instead of returning "try again later" text.
- Add regression coverage proving unavailable AI returns metadata-backed content without calling the prompt.
- Add opportunity AI scope coverage to the Wave 5 AI/content governance proof manifest.

Verification:
- `npm test -- opportunity-ai-scope.test.ts platform-proof-scenarios.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 33 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic unavailable copy in user-facing response-support paths with either evidence-backed deterministic output or explicit failed action states.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Honest Win/Loss Insight Fallbacks

Status: implemented and verified.

Purpose: stop malformed AI win/loss insight output from returning a successful generic placeholder as if it were actionable strategy.

Changes in this slice:
- Extract deterministic win/loss heuristic insights for reuse when the AI provider is unavailable or returns malformed output.
- Parse AI insight output defensively and reject non-array or non-string payloads.
- Return heuristic insights when there is real debrief or pattern evidence, and return an explicit unavailable error when there is no evidence to synthesize.
- Add regression coverage proving malformed AI output falls back to measured win/loss evidence instead of the generic unavailable string.
- Add win/loss auth and fallback coverage to the Wave 8 strategic capability proof manifest.

Verification:
- `npm test -- winloss-auth.test.ts` passed with 12 tests.
- `npm test -- winloss-auth.test.ts platform-proof-scenarios.test.ts` passed with 18 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 56 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing response-support analysis paths for success responses that contain placeholders instead of actionable evidence or explicit unavailable states.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Discovery Source Confidence

Status: implemented and verified.

Purpose: make non-primary document discovery strategies explain their confidence instead of assigning generic scores to SearXNG, alternative portal, archive, and AI-guessed URLs.

Changes in this slice:
- Replace fixed SearXNG document confidence with scoring from source type, document URL evidence, procurement terms, opportunity token matches, notice ID matches, and search engine score.
- Replace fixed alternative portal and archive confidence with evidence scoring capped below primary portal confidence.
- Keep AI-guessed URLs lower-confidence by source cap while still preserving the model's stated confidence as an auditable signal.
- Store confidence-signal descriptions for these discovered documents so operators can audit why a source was trusted.
- Add regression coverage for SearXNG document results and alternative portal results.

Verification:
- `npm test -- document-discovery-agent.test.ts` passed with 4 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 135 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic confidence values in downstream response-support analysis paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Search Zero-Candidate Discovery Warnings

Status: implemented and verified.

Purpose: make SearXNG-backed discovery runs explicitly report when a query produces no accepted opportunity candidates instead of appearing as a clean zero-result import.

Changes in this slice:
- Add `search_no_candidates` discovery warnings for each query that returns no accepted opportunity-like results.
- Persist the zero-candidate warnings into the import audit config alongside engine degradation and scraper warnings.
- Preserve existing source scraping behavior so configured sources can still recover candidates after weak search results.
- Add regression coverage for a degraded SearXNG search with no accepted results.

Verification:
- `npm test -- discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts` passed with 28 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue improving source discovery fallback and ranking when web search quality is low.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Portal Document Link Confidence

Status: implemented and verified.

Purpose: make source-document discovery explain why a portal link is trusted instead of assigning generic confidence to every extracted document URL.

Changes in this slice:
- Replace fixed primary-portal link confidence with scoring from direct document extension, same-host evidence, document type, procurement terms, opportunity token matches, and notice ID matches.
- Carry confidence signals into stored opportunity document descriptions for both Firecrawl link extraction and browser fallback recovery.
- Stop browser fallback from blindly forcing extracted links to a generic confidence; it now boosts the measured link score slightly and preserves the signal explanation.
- Add regression coverage proving stored discovered documents include confidence signals and remain auto-selected only through measured confidence.

Verification:
- `npm test -- document-discovery-agent.test.ts` passed with 2 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing fixed confidence values in discovery and response-support ranking paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Explicit Document Analysis AI Fallbacks

Status: implemented and verified.

Purpose: prevent the older document-analysis workflow from silently assigning neutral scores when AI factor analysis is unavailable or malformed.

Changes in this slice:
- Replace silent `75` scores for unavailable AI analysis with deterministic structural/evidence fallback scoring.
- Add explicit informational issues and suggestions when a factor uses fallback scoring, so approval gates can distinguish measured heuristics from unavailable AI analysis.
- Treat malformed AI responses without a numeric score as fallback-scored instead of defaulting to neutral confidence.
- Replace random analysis issue IDs with monotonic timestamp IDs.
- Add regression coverage proving unavailable AI analysis records fallback findings and non-neutral scores.
- Add document-analysis fallback coverage to the Wave 5 AI/content governance proof manifest.

Verification:
- `npm test -- document-analysis-scope.test.ts document-analysis-auth.test.ts platform-proof-scenarios.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 29 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing response-support analysis paths for any remaining generic confidence values.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Quality Assessment Scoring

Status: implemented and verified.

Purpose: prevent document quality assessment from reporting random or placeholder scores while response drafts and review artifacts are being hardened.

Changes in this slice:
- Replace placeholder fact-accuracy and source-credibility descriptions with measurable evidence-signal language.
- Fix the sentence-structure factor key so sentence variety no longer falls through to generic scoring.
- Replace random default factor scoring with deterministic, evidence-based heuristics for flow, key message clarity, citations, hierarchy, transitions, data presentation, tone, jargon, format, visual consistency, compliance, audience alignment, risk mitigation, timeline, budget, and team qualification signals.
- Keep unverified fact claims as explicit review warnings instead of fabricated neutral confidence.
- Add regression coverage proving repeated assessments produce identical scores and no placeholder quality claims appear in measured factor output.
- Add deterministic quality assessment coverage to the Wave 5 AI/content governance proof manifest.

Verification:
- `npm test -- quality-assessment.test.ts quality-assessment-auth.test.ts quality-assessment-scope.test.ts platform-proof-scenarios.test.ts` passed with 16 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 24 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 11 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing any response-support quality paths that still depend on generic confidence or unavailable-state placeholders.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Response Readiness Revalidation

Status: passed.

Purpose: revalidate the live opportunity-to-response draft path after citation and final artifact hardening.

Result:
- Ran `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe`.
- Proof run `live_response_readiness_20260527T082922Z` found 10 UNGM software opportunities and selected UN Secretariat notice `300700`.
- Downloaded the source PDF successfully (`171406` bytes), extracted `3070` characters with Docling, and generated six Datacraft response draft artifacts.
- Response readiness passed with source requirement coverage `1`, evidence cue coverage `1`, source citation coverage `1`, evidence citation coverage `1`, review gate coverage `1`, and `5527` total draft words.

Remaining after this revalidation:
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Final Artifact Storage Readback Receipts

Status: implemented and verified.

Purpose: prove rendered final artifacts can be read back from object storage before they are stored as submission-ready manifests.

Changes in this slice:
- Read final artifact objects back from Linode E3 immediately after upload.
- Verify readback hash and size against the rendered artifact bytes before workflow state is updated.
- Store readback hash, size, and timestamp receipts in final artifact manifests and proposal document summaries.
- Require readback receipts in final submission checklist artifact gates and submission attachment locking.
- Add regression coverage for corrupt storage readback rejection and missing readback receipt blockers.

Verification:
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts submission-workflow.test.ts proposal-documents-scope.test.ts` passed with 51 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` passed with 23 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 177 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Persisted Import-Response Proof Recheck

Status: blocked by database connectivity.

Purpose: recheck whether the previously blocked live persisted import-to-response proof can now complete after the latest response-readiness hardening.

Result:
- Ran `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Proof run `live_persisted_import_response_20260527T082025Z` failed before persistence with `connect ECONNREFUSED 88.80.188.224:5432`.
- The generated evidence ledger recorded zero persisted opportunity, source document, RFP document, requirement, proposal document, response document, and win-theme rows for this failed run.

Remaining after this recheck:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Keep the full aspiration execution goal active; this is an external connectivity blocker for the live persisted proof, not a completed platform proof.

### 2026-05-27 - Response Citation Coverage Through Final Gates

Status: implemented and verified.

Purpose: keep source and Datacraft evidence citation guarantees intact from generated response sections through final artifact and submission readiness gates.

Changes in this slice:
- Add `Source Citation Map` and `Datacraft Evidence Citation Map` sections to generated requirement-aware response drafts.
- Track source and evidence citation coverage across standard response package readiness metrics.
- Propagate citation coverage into opportunity document summaries and final artifact readiness snapshots.
- Add a final submission checklist gate that blocks submission when response citation coverage is incomplete.
- Extend regression coverage for draft readiness metrics, final artifact snapshots, final submission blockers, and win-theme review fixtures.

Verification:
- `npm test -- proposal-documents-scope.test.ts final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` passed with 40 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` passed with 22 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 176 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 131 tests.
- `npm test -- ProposalDocumentsWinThemeSeedReview.test.ts` passed with 1 test.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 44 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue strengthening rendered artifact readback checks and live persisted import-response proof once database connectivity is stable.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Projected Workload Rebalancing Metrics

Status: implemented and verified.

Purpose: make proposal workload balancing report defensible projected utilization improvements instead of mutating current workload records and labeling the result simulated.

Changes in this slice:
- Track proposed reassignment impact in a separate projected utilization map.
- Stop proposed moves once the overloaded author is no longer over the target threshold.
- Avoid proposed moves that would push the receiving author above the elevated-workload threshold.
- Calculate after variance, max utilization, and overloaded-member count from projected reassignments.
- Extend the Wave 4 planning/collaboration proof manifest with workload balancing coverage.

Verification:
- `npm test -- task-management-auth.test.ts` from `frontend/` passed, running 12 tests.
- `npm test -- task-management-auth.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 18 tests.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` from `frontend/` passed, running 30 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Capture-Stage PWin Ranking

Status: implemented and verified.

Purpose: make PWin opportunity rankings filter by real capture pipeline stage instead of using opportunity category as a stage proxy.

Changes in this slice:
- Add an assigned-opportunity existence predicate for PWin helper queries.
- Query `capture_pipeline.current_stage` when a ranking stage filter is provided.
- Scope pipeline-stage filtering to the actor's organization and assigned opportunities.
- Filter ranked opportunities by matching pipeline opportunity IDs and return the real capture stage in ranking results.
- Extend the Wave 8 strategic capability proof manifest with PWin opportunity scope coverage.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts` from `frontend/` passed, running 7 tests.
- `npm test -- pwin-opportunity-scope.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 42 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Outcome-Backed Review Effectiveness

Status: implemented and verified.

Purpose: make review effectiveness analytics correlate review recommendations with actual submitted outcomes instead of hard-coded win-rate assumptions.

Changes in this slice:
- Query submission outcomes for completed review opportunities within the reporting timeframe.
- Scope outcome correlation to the actor's organization and assigned opportunities.
- Bucket actual won/lost outcomes by review recommendation and calculate observed win rates.
- Preserve zero-sample buckets for standard recommendation categories so the analytics shape remains stable.
- Extend the Wave 6 approval/production proof manifest with review effectiveness coverage.

Verification:
- `npm test -- reviews.test.ts` from `frontend/` passed, running 111 tests.
- `npm test -- reviews.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 117 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 163 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Outcome-Backed Past Performance Analytics

Status: implemented and verified.

Purpose: make past-performance analytics report actual win correlation from submitted proposal outcomes instead of estimating win rate from high CPAR ratings.

Changes in this slice:
- Join submissions to project relevance records and visible past-performance projects to identify submitted opportunities that cited past performance.
- Scope the outcome query to the actor's assigned opportunities, organization submissions, and visible projects.
- De-duplicate submissions before calculating wins and losses so multiple cited projects do not inflate the sample.
- Return actual past-performance submission count, wins, losses, and rounded win rate.
- Extend the Wave 8 strategic capability proof manifest with past-performance analytics coverage.

Verification:
- `npm test -- past-performance-scope.test.ts` from `frontend/` passed, running 7 tests.
- `npm test -- past-performance-scope.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 35 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Content-Aware Formatting Compliance

Status: implemented and verified.

Purpose: make final formatting validation inspect document content for explicit font and spacing violations instead of trusting template metadata alone.

Changes in this slice:
- Extract text style runs from Tiptap-style document content, including text-style marks and node attributes.
- Flag body text that uses a font outside the required body font and text below the minimum font size.
- Extract paragraph/heading/list/table spacing attributes and flag line-spacing deviations from the applied template.
- Persist non-compliant fonts and spacing violation sections in the validation payload.
- Extend the Wave 6 approval/production proof manifest with formatting compliance coverage.

Verification:
- `npm test -- formatting-scope.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 11 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 52 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Deterministic Practice Recording Analysis

Status: implemented and verified.

Purpose: make oral presentation practice analysis produce repeatable timing and filler-word evidence instead of random simulated scores.

Changes in this slice:
- Replace random practice recording analysis with deterministic scoring from recording duration, planned slide timing, and transcript-like feedback text.
- Allocate actual slide durations by estimated slide duration share and compute coverage scores from target variance.
- Count filler words from available feedback text and explicitly recommend transcript-backed notes when filler evidence is unavailable.
- Add regression coverage for deterministic pacing, slide coverage, filler counts, and persisted analysis payloads.
- Extend the Wave 9 presentation proof manifest with presentation auth/practice analysis coverage.

Verification:
- `npm test -- presentations-auth.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 11 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` from `frontend/` passed, running 9 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Evaluation Criteria Mapping Suggestions

Status: implemented and verified.

Purpose: make criteria mapping suggestions connect active win themes to accepted evaluator criteria instead of echoing only mappings that already exist.

Changes in this slice:
- Replace the criteria suggestion placeholder with deterministic scoring against accepted evaluation requirements.
- Preserve direct criteria-theme mappings as score-100 results.
- Suggest additional active themes by matching evaluator criteria, response strategy, theme statement, evidence, and keywords.
- Return criterion names, weights, coverage scores, adequacy flags, relevance scores, and mapping notes for operator review.
- Add regression coverage for direct and suggested criteria mappings.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed, running 9 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 28 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Deterministic Win Theme Suggestions

Status: implemented and verified.

Purpose: make win-theme suggestions produce evaluator-aware candidate themes from accepted RFP requirements instead of returning an empty placeholder.

Changes in this slice:
- Reuse the accepted-requirement win-theme seed pipeline for pending theme suggestions.
- Convert reviewable response seeds into `ThemeSuggestion` records with confidence scores, rationale, evidence sources, and suggested keywords.
- Filter suggestions against existing theme statements and already-covered evaluation criteria before returning them.
- Add regression coverage for populated pending suggestions and suppression of already-covered criteria.
- Extend the Wave 8 strategic capability proof manifest with win-theme authorization and suggestion coverage.

Verification:
- `npm test -- win-themes-auth.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 14 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 27 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - CRM Account Live Research

Status: implemented and verified.

Purpose: make account research gather live web intelligence server-side instead of returning empty client-populated placeholders.

Changes in this slice:
- Wire CRM account research to the existing SearXNG client for server-side company, contact, leadership, client, social, news, and general searches.
- Return normalized research items with source domains, snippets, URLs, engine metadata, relevance scores, and query timestamps.
- Keep successful category results when another category search fails, while surfacing the degradation in the research summary.
- Derive suggested account updates for website, LinkedIn URL, email, phone, leadership, description, and notable clients from returned sources without mutating the account.
- Add regression coverage proving SearXNG-backed research replaces empty placeholders and tolerates category-level search failures.
- Extend the Wave 8 strategic capability proof manifest with CRM account research coverage.

Verification:
- `npm test -- crm-account-research-search.test.ts crm-account-research-auth.test.ts` from `frontend/` passed, running 3 tests.
- `npm test -- platform-proof-scenarios.test.ts crm-account-research-search.test.ts crm-account-research-auth.test.ts` from `frontend/` passed, running 9 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 19 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Compliance Cross-Reference Suggestions

Status: implemented and verified.

Purpose: make compliance reviewers receive concrete response-section suggestions for unlinked requirements instead of an empty placeholder list.

Changes in this slice:
- Replace empty cross-reference suggestions with deterministic matching against proposal documents for the requirement's opportunity.
- Split Tiptap response documents into heading-based sections and fall back to stored plain text when structured content is absent.
- Rank suggested sections by requirement-term overlap across requirement number, category, section title, document type, and section body.
- Scope proposal-document reads to the user's organization while preserving legacy null-organization proposal documents.
- Add regression coverage for ranked section suggestions, organization/opportunity scoping, and no-match behavior.
- Extend the Wave 3 compliance/evidence proof manifest with the cross-reference suggestion regression.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts compliance-entry-workflow.test.ts` from `frontend/` passed, running 11 tests.
- `npm test -- compliance-cross-reference-suggestions.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 8 tests.
- `npm test -- platform-proof-scenarios.test.ts compliance-cross-reference-suggestions.test.ts compliance-entry-workflow.test.ts` from `frontend/` passed, running 17 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 79 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Document PDF Render Artifacts

Status: implemented and verified.

Purpose: make document PDF rendering produce actual PDF artifacts for final response packages instead of reporting success while returning LaTeX source.

Changes in this slice:
- Replace the `renderToPDF` LaTeX placeholder path with an actual PDF buffer generated through the existing `jspdf` dependency.
- Preserve document structure for PDF output, including headings, paragraphs, lists, block quotes, code blocks, table rows, rules, brand colors, metadata, headers, footers, and page numbers.
- Preserve PDF export options for table of contents and watermark output.
- Preserve inline text marks and image references so final artifacts do not silently flatten or drop response content.
- Return `application/pdf`, `.pdf` filenames, byte size, and page count for PDF render results.
- Add regression coverage proving direct and unified PDF rendering return a real `%PDF-` artifact and never LaTeX source.
- Add regression coverage for multi-page pagination, table of contents, watermarks, marked text, and image references.
- Extend Wave 6 production/finalization proof and Wave 9 discovery-to-submission proof manifests with the real PDF render regression.

Verification:
- `npm test -- document-render-pdf.test.ts document-render-auth.test.ts document-render-scope.test.ts final-artifact-workflow.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 24 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed, running 6 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 47 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 130 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Presentation Export Artifacts

Status: implemented and verified.

Purpose: make oral presentation exports produce real downloadable artifacts for response delivery instead of returning inert placeholder export routes.

Changes in this slice:
- Replace the presentation export placeholder URL with generated data-download artifacts.
- Generate self-contained HTML decks with slide content, speaker notes, team members, branding colors, and print styling.
- Generate PDF deck exports from the same slide content using the existing PDF dependency.
- Generate editable PPTX deck exports using the existing PowerPoint dependency and include speaker notes.
- Return artifact filename and MIME type metadata to the exporter UI.
- Add focused regression coverage for HTML, PDF, and PPTX data artifacts and decoded HTML content.
- Add a dedicated Wave 9 platform proof scenario for presentation export artifacts.

Verification:
- `npm test -- presentations-export.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 10 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` from `frontend/` passed, running the new presentation export proof.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - DGMarket Dedicated Live Proof

Status: implemented and verified.

Purpose: make DGMarket live-source verification repeatable through the platform proof manifest instead of relying on ad hoc shell environment variables.

Changes in this slice:
- Add scenario-specific environment support to the platform proof runner and dry-run command formatting.
- Add a dedicated `live-dgmarket-source` live-safe proof scenario that targets `https://www.dgmarket.com`.
- Allow the generic live configured-source proof script to use a scenario-provided run ID prefix.
- Add proof-manifest coverage for the DGMarket scenario and environment-aware command formatting.

Verification:
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed, running 6 tests.
- `npm run platform:proof -- --include-live-safe --run live-dgmarket-source` from `frontend/` passed; the scenario produced run `live_dgmarket_source_20260527T044441Z` with 16 normalized DGMarket opportunities.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - DGMarket Default Discovery Coverage

Status: implemented and verified.

Purpose: expand configured opportunity discovery with DGMarket coverage while keeping parser output normalized enough for response-package intake.

Changes in this slice:
- Add DGMarket to the default configured discovery source list.
- Harden the DGMarket parser for rendered listing HTML from the connectivity-host scrape path.
- Preserve detail links from DGMarket markdown table rows as both `portalUrl` and `documentUrl`.
- Filter DGMarket category/navigation links so they do not become false opportunity records.
- Route the live configured-source proof harness to the DGMarket parser and preserve Firecrawl HTML separately from markdown.
- Add live proof guards for empty titles and country fields polluted with rendered markup or URLs.
- Extend the Wave 9 discovery bridge proof to include DGMarket parser and default-source coverage.

Verification:
- `npm test -- dgmarket-parser.test.ts default-discovery-sources.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 10 focused tests.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 60 Wave 9 discovery bridge tests.
- `LIVE_SOURCE_DISCOVERY_URL=https://www.dgmarket.com npm run platform:proof -- --include-live-safe --run live-source-discovery` from `frontend/` passed; Firecrawl returned 16 normalized DGMarket opportunities with stable titles, notice IDs, countries, and portal URLs.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Documents Page Win Theme Review Surface

Status: implemented and verified.

Purpose: make generated response win-theme seed approval visible on the response package documents surface, not only on the requirements page.

Changes in this slice:
- Move the generated win-theme review panel into a shared `ResponseWinThemeReviewPanel` component.
- Reuse the shared panel on the requirements workflow without changing existing behavior.
- Load response win-theme seed review data on the opportunity documents page alongside proposal documents and response readiness.
- Refresh documents, progress, response readiness, and seed-review state together after generated seeds are persisted.
- Add component coverage proving the response package documents surface renders pending seed review evidence, evaluator criteria, target document types, requirement mappings, and proposal documents together.
- Extend the Wave 8 strategic capability proof manifest to cover both requirements-page and documents-page seed review surfaces.

Verification:
- `npm test -- RequirementsWinThemeSeedReview.test.ts ProposalDocumentsWinThemeSeedReview.test.ts` from `frontend/` passed, running 2 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, now running 17 strategic capability tests including both generated seed review surfaces.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Final Package Authority Denial Visibility

Status: implemented and verified.

Purpose: make final package approval authority failures visible in the operator UI instead of only logging them to the browser console.

Changes in this slice:
- Add document-scoped inline error state to the proposal final package panel.
- Show blocked finalization messages for authority, readiness, stale-artifact, and other expected final package blockers.
- Avoid console-error noise for expected operator blockers while preserving console logging for unexpected failures.
- Add a Playwright browser harness proving a blocked final artifact approval surfaces the authority denial inline and does not mark the document updated.
- Add the browser proof as a dedicated Wave 6 finalization authority scenario.

Verification:
- `npm run test:e2e -- proposal-finalization-authority.spec.ts` from `frontend/` passed, running 1 Playwright test.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-finalization-authority-browser` from `frontend/` passed, running the new Playwright proof through the platform manifest.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Browser Proof For Win Theme Seed Review

Status: implemented and verified.

Purpose: prove generated win-theme seed review works in a real browser interaction, including operator approve/reject decisions and reviewed persistence payloads.

Changes in this slice:
- Add a Playwright browser harness for the response win-theme seed review panel.
- Stub only the server action boundary while exercising the real client component, buttons, reviewer notes, counts, success message, and `onCreated` callback.
- Verify persisted payloads include `reviewRequired: true`, approved reviewer notes, and rejected seed decisions.
- Add the browser proof as a dedicated Wave 8 strategic capability scenario.

Verification:
- `npm run test:e2e -- requirements-win-theme-seed-review.spec.ts` from `frontend/` passed, running 1 Playwright test.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-browser` from `frontend/` passed, running the new Playwright proof through the platform manifest.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Requirements Page Win Theme Review Proof

Status: implemented and verified.

Purpose: keep the operator requirements workflow covered by an automated proof that generated win-theme seeds are visible before final response approval.

Changes in this slice:
- Add a requirements-page operator-surface test that renders the generated response win-theme seed review panel.
- Verify the panel exposes generated seed statements, evaluator criteria IDs, target document types, requirement mappings, approval counts, and disabled persistence before operator decisions.
- Add the new operator-surface proof to the Wave 8 strategic capability manifest so future platform proof runs include it.

Verification:
- `npm test -- RequirementsWinThemeSeedReview.test.ts` from `frontend/` passed, running 1 test.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, now running 16 strategic capability tests including requirements-page seed review coverage.

Remaining after this slice:
- Browser-level seed review interaction is now covered by the Wave 8 strategic capability browser proof.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Requirement Page Win Theme Seed Review

Status: implemented and verified.

Purpose: make generated response win-theme seed approval part of the operator requirements workflow, so accepted requirements can become reviewed strategy themes before final response approval.

Changes in this slice:
- Add `getResponseWinThemeSeedReview`, a server action that derives reviewable win-theme seeds from accepted opportunity requirements.
- Treat weighted or evaluation/scoring-sourced accepted requirements as evaluator criteria for generated seed coverage.
- Filter out seeds whose statements or evaluator criteria are already covered by existing opportunity win themes.
- Load initial seed-review data on the opportunity requirements page.
- Refresh seed-review data with requirements/compliance state and after response-package drafting.
- Keep operators on the requirements page to approve generated win-theme seeds when response-package drafting produces pending strategy seeds.
- Reuse the `ResponseWinThemeSeedReview` component directly in the requirements workflow.
- Add regression coverage proving accepted requirements create reviewable seed data with evaluator criteria and target document mappings.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed, running 6 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Add a browser-level operator proof for the requirements-page seed review panel once an authenticated seeded opportunity is available.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Evaluator Criteria Evidence Traceability

Status: implemented and verified.

Purpose: carry evaluator criteria IDs through response readiness, final checklist evidence, and review-comment task projection so comments and submission blockers can point at the same scoring criteria.

Changes in this slice:
- Add evaluator criteria ID sets to live response readiness assessments, including draft-covered, win-theme-covered, and missing criteria IDs.
- Parse those readiness criteria IDs into the final submission checklist workflow.
- Show evaluator, covered, and missing criteria IDs in the evaluator win-theme coverage checklist details when the readiness workflow reports them.
- Carry review-comment evaluator criteria IDs, references, related win-theme IDs, and theme alignment into workflow transition metadata.
- Project review-comment resolution tasks with `evaluationCriteriaIds` and stable criteria/win-theme tags.
- Add regression coverage for live readiness criteria ID evidence, final checklist criteria detail rows, and review-comment task metadata.

Verification:
- `npm test -- live-response-package.test.ts final-submission-checklist-workflow.test.ts review-comment-workflow.test.ts` from `frontend/` passed, running 24 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate --run wave9-response-readiness-package` from `frontend/` passed, running 30 tests across final submission and response-readiness proof targets.

Remaining after this slice:
- Wire the seed review component into the response package review screen when that screen is selected as the primary operator surface.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Win Theme Seed Review Approval

Status: implemented and verified.

Purpose: require human review decisions before generated response-package win-theme seeds are bulk-persisted, while preserving the existing legacy import path for trusted callers.

Changes in this slice:
- Add reviewed seed fields for approve/reject decisions and reviewer notes.
- Gate `createThemesFromResponseSeeds` with `reviewRequired`, so only approved seeds become durable win themes and rejected/pending seeds are counted separately.
- Preserve backward-compatible bulk persistence for callers that do not require review.
- Add a reusable `ResponseWinThemeSeedReview` UI component that shows evaluator criteria, requirements, evidence, reviewer notes, and persists only approved seeds.
- Export the review component and reviewed seed types through the win-theme component barrel.
- Add regression coverage proving rejected and pending-review seeds are not inserted.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed, running 5 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Wire the seed review component into the response package review screen when that screen is selected as the primary operator surface.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Command Center Shows Win Theme Readiness

Status: implemented and verified.

Purpose: surface evaluator win-theme coverage before operators reach the submission form, so command-center readiness cards expose the response strategy gap early.

Changes in this slice:
- Include evaluator win-theme criteria coverage and seed count in proposal response package workflow descriptions.
- Carry readiness dimension detail lines into command-center readiness cards.
- Prevent detail text from making a response-readiness workflow match unrelated readiness dimensions.
- Add command-center and projection coverage for blocked response-readiness win-theme gaps.

Verification:
- `npm test -- projections.test.ts work-items-command-center.test.ts` from `frontend/` passed, running 6 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Final Checklist Shows Win Theme Coverage

Status: implemented and verified.

Purpose: make the final submission blocker for evaluator-to-win-theme coverage visible and actionable in the submission UI instead of only appearing as a flat checklist message.

Changes in this slice:
- Add structured checklist detail rows for evaluator criteria win-theme coverage, seed count, and response-readiness workflow ID.
- Preserve those details when converting the enforced final submission gate into pre-submission checklist items.
- Render a dedicated evaluator win-theme coverage panel in the submission form with covered, blocking, or advisory state.
- Keep non-win-theme checklist details renderable as compact evidence badges.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts submissions-scope.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 21 tests across final checklist and submission workflows.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - UN Procurement Live Source Recovery

Status: implemented and verified.

Purpose: add a parser and live proof for the UN Procurement solicitations page that Firecrawl can fetch but cannot currently normalize into opportunities without browser-rendered HTML.

Changes in this slice:
- Add a UN Procurement parser for browser-rendered Drupal solicitation cards.
- Route `www.un.org/procurement/...` configured sources to the UN Procurement parser.
- Extend the live configured-source proof to use browser fallback when Firecrawl fails or returns content that the source parser cannot extract.
- Add the live-proven UN Procurement URL to the default discovery source list.
- Add focused parser and import coverage for UN Procurement browser-rendered source imports.

Verification:
- `npm test -- default-discovery-sources.test.ts un-procurement-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 30 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 55 tests across discovery import, opportunity documents, RFP document service, and proposal document scope.
- `LIVE_SOURCE_DISCOVERY_URL=https://www.un.org/procurement/solicitations-opportunities npm run platform:proof -- --include-live-safe --run live-source-discovery` from `frontend/` passed. It used browser fallback through `http://84.247.181.100:3003`, parsed 22 UN Procurement opportunities, and wrote live evidence run `live_source_discovery_20260527T030921Z`.

Remaining after this slice:
- If UN Procurement publishes detail links per solicitation in a future page variant, enrich `portalUrl`/`rfpLink` to point at those detail pages instead of the listing page.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Configured Source Browser Fallback

Status: implemented and verified.

Purpose: recover configured procurement source imports when Firecrawl cannot fetch the listing page directly, using the platform browser service before declaring the source unavailable.

Changes in this slice:
- Route configured source scrape failures and empty parser passes through the existing Playwright/browser fallback when fallback is enabled.
- Preserve the fallback reason on imported opportunity metadata and audit warnings.
- Record source-candidate scrape method as `browser_fallback` when rendered content produced the opportunity.
- Keep the existing `browserFallback: false` behavior available for callers that want Firecrawl-only source scraping.
- Add regression coverage for a configured source where Firecrawl returns a DNS failure but browser fallback returns a tender listing.

Verification:
- `npm test -- discovery-opportunity-import.test.ts` from `frontend/` passed, running 21 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 54 tests across discovery import, opportunity documents, RFP document service, and proposal document scope.

Remaining after this slice:
- Keep adding source-specific parsers when browser-rendered configured sources expose structured listings that generic markdown parsing cannot read reliably.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Live Discovery Health Refresh

Status: verified.

Purpose: confirm the currently configured live discovery stack still works after the response-generation and governance changes, and keep evidence current for the opportunity-finding side of the platform.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` from `frontend/` passed. It scraped `https://www.comesa.int/category/open-tenders/`, returned 2 normalized COMESA opportunities, and proved tender package document `https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx`.
- `npm run platform:proof -- --include-live-safe --run live-ungm-source` from `frontend/` passed. It called UNGM public notices, saw 1,657 total notices, mapped 10 opportunities, detail-enriched 5 sampled notices, and fetched a UNGM portal page with HTTP 200.
- `npm run platform:proof -- --include-live-safe --run live-discovery-services` from `frontend/` passed. It verified SearXNG health/results, Firecrawl scrape output, and Playwright/browser fallback content from the connectivity host.

Remaining after this slice:
- Investigate blocked or DNS-restricted sources such as `www.un.org/procurement/solicitations-opportunities`; direct fetch returned CloudFront 403 and Firecrawl reported DNS safety verification failure for `www.un.org`.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Final Checklist Enforces Evaluator Win Themes

Status: implemented and verified.

Purpose: prevent final submission from passing when response readiness reports that evaluator criteria are not mapped to win-theme strategy coverage.

Changes in this slice:
- Extend final submission checklist readiness parsing with optional `winThemeCriteriaCoverage` and `winThemeSeedCount` metrics.
- Add an evaluator criteria win-theme coverage checklist item.
- Treat missing evaluator/win-theme coverage metrics as advisory for older response-readiness receipts.
- Block final submission when a current response-readiness receipt reports partial evaluator-to-win-theme coverage.
- Add focused regression coverage for a 50% evaluator criteria win-theme mapping gap.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 12 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 21 tests across final checklist and submission workflows.

Remaining after this slice:
- Add the same evaluator/win-theme coverage summary to opportunity command-center readiness cards so capture managers see the gap before opening the submission form.
- Rerun persisted live database proof when PostgreSQL is reachable.

### 2026-05-27 - Persisted Proof Covers Win Themes

Status: implemented and code-verified; live PostgreSQL proof blocked by database connectivity.

Purpose: extend the live persisted import-to-response proof so it verifies not only opportunity, source document, RFP, requirements, and response draft persistence, but also generated win-theme strategy rows.

Changes in this slice:
- Persist live response package win-theme seeds as `win_themes` rows during the live persisted import-response proof.
- Verify persisted win-theme rows and their evaluator criteria IDs alongside tenant-scoped opportunity, source document, RFP, requirement, proposal document, and response document rows.
- Include win-theme rows in cleanup verification so live proof runs leave no strategy rows behind.
- Add win-theme row and criteria counts to proof evidence artifact IDs.
- Update the live persisted proof scenario contract to include strategic capability target `S-001`.

Verification:
- `npm test -- platform-proof-scenarios.test.ts live-response-package.test.ts win-themes-auth.test.ts` from `frontend/` passed, running 18 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Attempted `npm run platform:proof -- --include-live-safe --run live-persisted-import-response` from `frontend/`, but the PostgreSQL endpoint refused the connection: `connect ECONNREFUSED 88.80.188.224:5432`. No passing live evidence was recorded for this slice.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable so win-theme row persistence is proven against the live database.
- Add UI review/approval for generated win-theme seeds before bulk persistence.

### 2026-05-27 - Persist Response Win Theme Seeds

Status: implemented and verified.

Purpose: turn generated live response win-theme seeds into durable opportunity win-theme records, closing the path from source document criteria to reusable strategy objects.

Changes in this slice:
- Add response win-theme seed input/result types to the win-theme API surface.
- Add a server action that validates live response package seed records, verifies opportunity assignment scope, skips duplicate theme statements or already-covered evaluator criteria, and inserts new win-theme rows.
- Persist seed evaluator criteria IDs, target response document types, supporting evidence, keywords, and rationale into win-theme fields.
- Add regression coverage proving generated seed data is inserted with criteria mappings and target sections intact.

Verification:
- `npm test -- win-themes-auth.test.ts live-response-package.test.ts` from `frontend/` passed, running 13 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Add UI review/approval for generated win-theme seeds before bulk persistence.
- Connect review comments and final checklist evidence to the same evaluator criteria IDs.

### 2026-05-27 - Live Response Win Theme Seeds

Status: implemented and verified.

Purpose: generate initial win-theme strategy seeds directly from live response packages, so source requirements and evaluator criteria immediately become reusable proposal strategy inputs.

Changes in this slice:
- Add `LiveResponseWinThemeSeed` records to live response packages.
- Generate criteria-driven win-theme seeds from evaluator/scoring signals, preserving evaluator criteria IDs, related requirement IDs, target response document types, supporting evidence, keywords, and rationale.
- Generate requirement-driven fallback win-theme seeds when a live source document has no explicit scoring criteria.
- Add readiness metrics and blockers for evaluator criteria that are not represented in win-theme seeds.
- Record win-theme seed count and win-theme criteria coverage in live response readiness proof evidence.
- Add focused coverage for win-theme seed generation and readiness blocking when seed coverage is removed.

Verification:
- `npm test -- live-response-package.test.ts` from `frontend/` passed, running 9 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` from `frontend/` passed. It downloaded and parsed live UNGM source PDF `eoi24414.pdf`, generated all six response drafts, produced 3,897 total draft words, generated 2 requirement-derived win-theme seeds for the no-explicit-criteria source, and returned `ready_for_review`.

Remaining after this slice:
- Add a server-side action that persists response-package win-theme seeds into approved or draft win-theme rows for an opportunity.
- Surface generated win-theme seeds in the response package review UI before final rendering.

### 2026-05-27 - Win Theme Criteria Persistence

Status: implemented and verified.

Purpose: let evaluator criteria extracted from live response packages become durable win-theme mappings instead of staying only in generated response-package metadata.

Changes in this slice:
- Add evaluation criteria IDs to the public win-theme API type.
- Allow win-theme create and update inputs to carry `evaluationCriteriaIds`.
- Persist evaluation criteria IDs when creating or updating win themes.
- Return evaluation criteria IDs from database win-theme rows through the action mapper.
- Add regression coverage proving criteria mappings are preserved through theme update patches and response data.

Verification:
- `npm test -- win-themes-auth.test.ts live-response-package.test.ts` from `frontend/` passed, running 10 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Add a direct import/generation path that converts live response package evaluator criteria into initial win-theme records for an opportunity.
- Connect review comments and final checklist evidence to the same evaluator criteria IDs.

### 2026-05-27 - Evaluator Criteria Response Alignment

Status: implemented and verified.

Purpose: move generated live response packages from requirement coverage alone toward score-aware response drafting by extracting explicit evaluator/scoring criteria and requiring drafts to map those criteria into win-response plans.

Changes in this slice:
- Add evaluator criteria signals alongside source requirement signals in live response packages.
- Extract scoring/evaluation lines from solicitation sections such as evaluation criteria, including point/percent/mark weights when present.
- Add evaluator criteria IDs to every generated draft document and include an `Evaluator Alignment Plan` section with score-aware response strategy bullets.
- Add readiness metrics and blockers for missing evaluator criteria coverage, while allowing source documents with no published criteria to remain ready with an explicit warning.
- Add focused regression coverage for evaluator extraction, draft inclusion, readiness metrics, and blocked readiness when criteria mappings are removed.

Verification:
- `npm test -- live-response-package.test.ts` from `frontend/` passed, running 7 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` from `frontend/` passed. It downloaded and parsed live UNGM source PDF `eoi24414.pdf`, generated all six response drafts, produced 3,897 total draft words, covered 8 source requirement signals, matched 85 Datacraft evidence snippets, and returned `ready_for_review` with a warning that no explicit evaluator scoring criteria were present in that source.

Remaining after this slice:
- Connect extracted evaluator criteria to persisted win-theme and review workflows so downstream scoring, comments, and final submission checks can reference the same IDs.
- Continue improving response-generation quality from aligned plans toward final artifact rendering and reviewer-approved submission packages.

### 2026-05-27 - AFDB Detail Document Enrichment

Status: implemented and verified.

Purpose: make AFDB configured-source opportunities response-ready by resolving AFDB document detail pages to the actual downloadable procurement PDFs instead of seeding only AFDB HTML notice pages.

Changes in this slice:
- Add AFDB detail-page parsing that ranks downloadable procurement documents and ignores social/navigation links.
- Enrich bounded AFDB configured-source imports with primary detail-page document URLs, updating `documentUrl`, `rfpLink`, source-document seeding, and AFDB metadata.
- Replace the generic AFDB live proof wrapper with a source-specific proof that verifies listing extraction plus a live detail-page document.
- Update AFDB parser/import/proof coverage.

Verification:
- `npm test -- afdb-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 27 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-afdb-source` from `frontend/` passed. It scraped `https://www.afdb.org/en/projects-and-operations/procurement`, returned 13 normalized AFDB opportunities, and proved a downloadable detail-page PDF at `https://www.afdb.org/sites/default/files/documents/project-related-procurement/spn_bridep.pdf`.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 53 tests.

Remaining after this slice:
- Continue adding detail/document enrichment for source pages that expose stable procurement package attachments.
- Continue proving document download and parsing for live source documents that are now seeded from configured sources.

### 2026-05-27 - Configured Source Retry Resilience

Status: implemented and verified.

Purpose: prevent transient Firecrawl/source-parser misses from making high-value configured sources appear empty after one bad scrape, which would skip opportunity and source-document intake for that run.

Changes in this slice:
- Add a bounded retry loop around configured-source Firecrawl scrape plus parser extraction.
- Retry both failed source scrapes and successful scrapes that parse to zero opportunities before emitting a source warning.
- Add the same retry behavior to the live UNICEF source proof script, which exposed the transient empty-source behavior during live verification.
- Add regression coverage proving a source import recovers when the first UNICEF scrape parses empty and the second scrape returns opportunities.

Verification:
- `npm test -- discovery-opportunity-import.test.ts` from `frontend/` passed, running 20 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 53 tests.
- `npm run platform:proof -- --include-live-safe --run live-unicef-source` from `frontend/` passed after the proof retry update, returning 9 UNICEF service-contract opportunities and the UNICEF medicines tender calendar PDF link.

Remaining after this slice:
- Continue adding durable live proofs for scheduled discovery runs under service credentials.
- Continue tightening source-specific document extraction for sources that expose detail pages or calendar PDFs.

### 2026-05-27 - Discovery Runtime Defaults Preserve Source Documents

Status: implemented and verified.

Purpose: keep scheduled/API-key discovery and legacy saved presets aligned with the operator default path that seeds and downloads source documents, so discovery does not stop at opportunity metadata when RFP or tender documents are available.

Changes in this slice:
- Centralize default live discovery source URLs, source scrape limit, enrichment, browser fallback, seeded-document download, and download limit.
- Apply those runtime defaults to direct discovery API runs after request validation.
- Apply those runtime defaults to scheduled discovery preset runs and dry-run output, while preserving explicit preset overrides such as empty source URL lists or disabled downloads.
- Update the discovery dialog preset application path so older presets that lack source/document fields inherit the current source-document defaults instead of silently disabling downloads.
- Add focused coverage for legacy preset/runtime default behavior.

Verification:
- `npm test -- default-discovery-sources.test.ts opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts discovery-opportunity-import.test.ts discovery-presets.test.ts` from `frontend/` passed, running 35 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 17 discovery-to-response/submission test files and 174 tests.

Remaining after this slice:
- Continue proving scheduled live discovery runs against production-like service credentials and persisted tenant records.
- Continue closing source document parsing gaps for newly added live sources.

### 2026-05-27 - UNICEF Tender Calendar Source Discovery

Status: implemented and verified.

Purpose: add UNICEF Supply Division as a live configured source so the platform captures early UN procurement demand signals, including ICT service contract calendar rows, without pretending month/quarter issuance windows are exact deadlines.

Changes in this slice:
- Add a UNICEF Supply Division parser for service-contract tender calendar tables and tender-calendar document cards.
- Preserve UNICEF source identity, platform name, UN procurement tags, service duration, issuance window, and contact channel through configured-source imports.
- Preserve parser-emitted source tags through configured-source imports so useful qualifiers such as `ict` and `service-contract` survive persistence.
- Add UNICEF's service contracts tender calendar and downloadable tender-calendar document page to the default live discovery source list.
- Add a `live-unicef-source` platform proof that verifies live Firecrawl scrape extraction, ICT row detection, metadata preservation, and no fabricated deadlines.
- Extend the UNICEF live proof to verify a downloadable UNICEF tender calendar PDF link.
- Add focused parser, configured-source import, proof-manifest, and default-source regression coverage.

Verification:
- `npm test -- unicef-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` from `frontend/` passed, running 26 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-unicef-source` from `frontend/` passed. It scraped `https://www.unicef.org/supply/service-contracts-tender-calendar`, returned 9 normalized UNICEF opportunities, and proved the ICT telephony/software row with Q3 issuance metadata and UNICEF contact email.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 51 tests.
- Follow-up tag preservation check: `npm test -- discovery-opportunity-import.test.ts` from `frontend/` passed, running 18 tests.
- Follow-up tag preservation check: `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Default tender-calendar document check: `npm test -- unicef-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` from `frontend/` passed, running 27 tests.
- Default tender-calendar document check: `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Default tender-calendar document check: `npm run platform:proof -- --include-live-safe --run live-unicef-source` from `frontend/` passed. It proved the UNICEF service-contract rows plus `https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf` from the tender calendars page.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise and useful source documents.
- Review whether UNICEF calendar PDF sources should be imported as secondary default sources once their rows map cleanly to actionable tender follow-up workflows.

### 2026-05-27 - UNDP Detail Document Enrichment

Status: implemented and verified.

Purpose: move UNDP configured-source imports beyond portal-only links by extracting procurement document links from live notice detail pages, so discovered opportunities can seed source documents for downstream RFP parsing and response work.

Changes in this slice:
- Parse UNDP notice detail markdown for contact email, procurement document links, and the primary negotiation-document link.
- Enrich the first bounded set of UNDP configured-source opportunities with detail-page document URLs during import.
- Update the source document URL and `rfpLink` to the primary UNDP negotiation document link when available.
- Tighten the `live-undp-source` proof so it verifies both normalized UNDP list opportunities and a live detail-page document link.
- Add focused parser/import/proof coverage for UNDP detail enrichment.

Verification:
- `npm test -- undp-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts generic-parser.test.ts` from `frontend/` passed, running 25 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-undp-source` from `frontend/` passed. It scraped `https://procurement-notices.undp.org`, returned 589 normalized UNDP opportunities, and proved a SharePoint `Negotiation Document(s)` link from a live detail page.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 50 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise and source documents.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - UNDP Source-Preserving Live Discovery

Status: implemented and verified.

Purpose: keep the default UNDP live source from degrading into generic source-scrape records by preserving UNDP notice IDs, office/country metadata, process type, and UN procurement tags through configured-source imports.

Changes in this slice:
- Add a UNDP procurement parser for Firecrawl's field-packed notice links.
- Wire `procurement-notices.undp.org` into configured-source parser selection, import platform naming, source preservation, and tags.
- Add a source-specific `live-undp-source` platform proof while keeping the generic live source proof backed by configured parser selection.
- Add parser, import, generic-regression, and proof-manifest coverage.

Verification:
- `npm test -- undp-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts generic-parser.test.ts` from `frontend/` passed, running 24 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-undp-source` from `frontend/` passed. It scraped `https://procurement-notices.undp.org` and returned 589 normalized UNDP opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 50 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - World Bank Live Source Discovery

Status: implemented and verified.

Purpose: add World Bank procurement notices as a high-volume live source using the site's current notices table instead of the low-recall generic parser.

Changes in this slice:
- Add a World Bank procurement table parser that extracts procurement-detail rows and skips award rows.
- Wire World Bank source URLs into configured-source discovery so imports preserve `source: "world_bank"`, platform metadata, project metadata, and global-procurement tags.
- Add a source-specific `live-world-bank-source` platform proof and include World Bank in the default discovery source list.
- Add parser, import, proof-manifest, and default-source regression coverage.

Verification:
- `npm test -- world-bank-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` from `frontend/` passed, running 23 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-world-bank-source` from `frontend/` passed. It scraped `https://projects.worldbank.org/en/projects-operations/procurement` and returned 18 normalized World Bank opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 49 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - Discovery Defaults Include AFDB And COMESA

Status: implemented and verified.

Purpose: put the newly live-proven AFDB and COMESA sources into the default operator discovery dialog instead of requiring manual URL entry.

Changes in this slice:
- Move default configured-source URLs into a shared discovery source module.
- Add AFDB and COMESA to the default live discovery source list alongside Kenya PPIP, UNGM, and UNDP.
- Expand the source URL textarea to show the full default source set without hiding the newly added sources.
- Add focused coverage for the default source list.

Verification:
- `npm test -- default-discovery-sources.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - AFDB Live Source Discovery

Status: implemented and verified.

Purpose: add a higher-signal regional development-bank source to live opportunity discovery without counting AFDB policy, navigation, procurement-plan, or award links as active opportunities.

Changes in this slice:
- Add an AFDB procurement parser that extracts dated document notices for actionable prefixes such as EOI, SPN, AOI, AMI, GPN, and IFB.
- Wire AFDB source URLs into configured-source discovery so imports preserve `source: "afdb"`, African Development Bank platform metadata, and regional-procurement tags.
- Add a source-specific `live-afdb-source` platform proof and source-specific run IDs for AFDB and COMESA live wrappers.
- Add parser, import, and proof-manifest regression coverage.

Verification:
- `npm test -- afdb-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 21 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-afdb-source` from `frontend/` passed. It scraped `https://www.afdb.org/en/projects-and-operations/procurement` and returned 13 normalized AFDB opportunities.
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` from `frontend/` passed after the wrapper run-ID change, returning 2 normalized COMESA opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 48 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - COMESA Live Source Discovery

Status: implemented and verified.

Purpose: expand reliable live opportunity discovery beyond UNDP/UNGM/Kenya by adding a COMESA parser for regional open tenders.

Changes in this slice:
- Add a COMESA open-tenders parser that extracts dated tender posts and filters navigation/category links that the generic parser treated as opportunities.
- Wire COMESA source URLs into configured-source discovery so imports preserve `source: "comesa"`, COMESA platform metadata, and regional-procurement tags.
- Add a live-safe `live-comesa-source` platform proof scenario.
- Add parser, import, and proof-manifest regression coverage.

Verification:
- `npm test -- comesa-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 20 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` from `frontend/` passed. It scraped `https://www.comesa.int/category/open-tenders/` and returned 2 normalized COMESA opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 47 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - Command Center Response Quality Resolver Links

Status: implemented and verified.

Purpose: make response package readiness blockers in the opportunity command center directly actionable from the operator surface.

Changes in this slice:
- Route `proposal_response_package` workflow blockers to the opportunity documents/final-package surface instead of the generic opportunity overview.
- Update command-center projection coverage so response-quality blockers resolve to `/opportunities/{id}/documents`.
- Extend browser control-plane coverage so the command center visibly shows the response-quality blocker and its documents resolver link.

Verification:
- `npm test -- work-items-command-center.test.ts projections.test.ts` from `frontend/` passed, running 6 tests.
- `npm run test:e2e -- wave1-control-plane.spec.ts` from `frontend/` passed, running 3 Playwright tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave1-control-plane-browser --run wave4-planning-collaboration-tasks` from `frontend/` passed.

Remaining after this slice:
- Continue closing non-DB operator gaps while live persisted proof waits on reachable PostgreSQL.

### 2026-05-27 - Final Submission Artifact Readiness Receipt Gate

Status: implemented and verified.

Purpose: prevent stale final artifacts rendered before response-readiness enforcement from passing final submission gates.

Changes in this slice:
- Require approved final artifact receipts to include a render-time response package readiness snapshot.
- Treat missing response-readiness artifact receipts as final submission blockers that require re-rendering after response readiness passes.
- Add regression coverage for an otherwise approved artifact that lacks response readiness proof.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts final-artifact-workflow.test.ts submission-workflow.test.ts` from `frontend/` passed, running 32 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate --run wave9-discovery-to-submission-core` from `frontend/` passed, running 2 Wave 6 final-submission files and 13 Wave 9 discovery-to-submission files.

Remaining after this slice:
- Existing artifacts rendered before this receipt requirement must be re-rendered after response readiness passes before they can satisfy final submission gates.
- Live persisted proof remains blocked until PostgreSQL is reachable.

### 2026-05-27 - Final Artifact Response Readiness Evidence

Status: implemented and verified.

Purpose: carry the response-readiness proof enforced at final render into the artifact, approval, signoff, and workflow evidence trail.

Changes in this slice:
- Capture the tenant-scoped response package readiness snapshot before final render/request-render.
- Persist the snapshot into final artifact workflow metadata and rendered artifact manifests.
- Include response readiness status/workflow identifiers in stored object metadata.
- Preserve the readiness snapshot when approving the final artifact and when recording executive/legal signoff.
- Extend final artifact workflow coverage to assert response readiness evidence survives render, approval, signoff, task projection, and runtime transition metadata.

Verification:
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections --run wave9-discovery-to-submission-core` from `frontend/` passed, running 5 Wave 6 workflow files and 13 Wave 9 discovery-to-submission files.

Remaining after this slice:
- Persisted live end-to-end proof remains blocked until PostgreSQL is reachable.
- Continue using live-safe source and response-readiness proofs while DB-backed tenant persistence is unavailable.

### 2026-05-27 - Live-Safe Proof Failure Accounting

Status: implemented and verified.

Purpose: prevent broad platform proof sweeps from hiding failed live-safe scenarios when `--continue-on-failure` is used.

Changes in this slice:
- Move platform-proof scenario execution into a testable runner.
- Preserve `--continue-on-failure` by running later scenarios after a failure, but return a non-zero final exit code when any scenario fails.
- Print a compact final failure summary so the failed scenario is visible after long mixed sweeps.
- Add regression coverage for both continue-on-failure and fail-fast scenario execution.

Verification:
- `npm run platform:proof -- --include-live-safe --all --continue-on-failure` from `frontend/` ran the full non-live and live-safe sweep. Non-live waves passed; live SearXNG, Firecrawl, browser fallback, Docling-backed response readiness, UNDP source discovery, Kenya PPIP, and UNGM checks passed. The DB-backed `phase1-live-safe-control-plane` scenario failed during disposable user insert, matching the known PostgreSQL connectivity blocker.
- `npm test -- platform-proof-scenarios.test.ts platform-proof-core.test.ts` from `frontend/` passed, running 8 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run phase1-live-safe-control-plane --run live-discovery-services --continue-on-failure` from `frontend/` ran the second scenario after the phase1 failure, then exited 1 with `phase1-live-safe-control-plane exited 1`.

Remaining after this slice:
- Live search/scrape/source/response readiness services are reachable and producing current evidence.
- DB-backed live control-plane and persisted end-to-end proofs remain blocked until PostgreSQL at `88.80.188.224:5432` is reachable.

### 2026-05-27 - Full Non-Live Platform Proof Refresh

Status: verified.

Purpose: re-run the complete non-live proof manifest after response readiness, final-render gating, documents UI, workflow task projection, and command-center readiness changes.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` from `frontend/` passed.
- The proof covered Wave 0 through Wave 9 non-live scenarios, including typecheck, API/action tests, workflow tests, browser E2E control-plane tests, discovery-to-response bridge coverage, response package readiness, and discovery-to-submission core coverage.
- The final scenario, `wave9-discovery-to-submission-core`, passed 13 test files and 115 tests.

Remaining after this slice:
- Live-safe proofs remain separate from this non-live manifest.
- Persisted live end-to-end proof still depends on a reachable PostgreSQL endpoint.

### 2026-05-27 - Command Center Response Quality Blockers

Status: implemented and verified.

Purpose: make blocked response package readiness visible in the opportunity command center so operators see response-quality blockers in the same place as evidence, review, production, and dispatch blockers.

Changes in this slice:
- Project blocked, missing, or unrecognized `proposal_response_package` readiness metadata as command-center workflow blockers.
- Add response-readiness descriptions with requirement coverage, review gate coverage, and win-theme coverage.
- Add a dedicated `Response quality` readiness dimension keyed to response package, win theme, review gate, evidence checklist, and placeholder signals.
- Extend the Wave 4 planning/collaboration proof scenario to include command-center and work-item projection coverage.

Verification:
- `npm test -- work-items-command-center.test.ts` from `frontend/` passed, running 3 tests.
- `npm test -- projections.test.ts` from `frontend/` passed, running 3 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` from `frontend/` passed, running 5 test files and 18 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check -- frontend/lib/actions/work-items.ts frontend/lib/work-items/projections.ts frontend/__tests__/actions/work-items-command-center.test.ts frontend/scripts/platform-proof/scenarios.ts` passed.

Remaining after this slice:
- Continue connecting final approval evidence and live persisted proof once PostgreSQL is reachable.
- Consider adding browser-level command-center visual coverage after the next UI change.

### 2026-05-27 - Response Package Quality Readiness Metrics

Status: implemented and verified.

Purpose: move response package readiness beyond requirement coverage so generated response packages also carry quality evidence needed for winning responses.

Changes in this slice:
- Add draft quality metrics to tenant-backed response package readiness: total draft words, minimum drafted document words, evidence checklist coverage, review gate coverage, win-theme coverage, and unresolved placeholder count.
- Block readiness when generated response drafts are too thin, miss evidence checklists, miss review gates, or retain unresolved placeholders.
- Warn when drafted response documents lack approved win themes so operators can improve evaluator-facing differentiation without blocking legacy opportunities that have not yet configured themes.
- Surface review-gate coverage in the final package UI readiness label.
- Extend proposal document action coverage to prove the quality metrics are persisted and scoped with the response readiness summary.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 15 tests.
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 46 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 workflow test files and 43 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 workflow test files and 19 tests.
- `git diff --check -- frontend/lib/actions/proposal-documents.ts frontend/lib/types/opportunity.ts frontend/components/proposals/ProposalDocumentList.tsx frontend/__tests__/actions/proposal-documents-scope.test.ts` passed.

Remaining after this slice:
- Continue connecting response quality review outcomes into command-center dimensions and final approval evidence.
- Persisted live end-to-end proof remains blocked until PostgreSQL is reachable.

### 2026-05-27 - Response Readiness Task Projection

Status: implemented and verified.

Purpose: prevent workflow tasks from inviting final package rendering when response package readiness is already blocked.

Changes in this slice:
- Promote blocked response package readiness to critical workflow priority.
- Mark response-package review tasks as blocked with readiness blocker details when draft coverage is incomplete.
- Mark final-package render tasks as blocked until response readiness passes.
- Persist readiness metadata on the final-package render task so operators see the same blocker evidence as the final render and submission gates.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 15 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 46 tests.
- `git diff --check -- frontend/lib/actions/proposal-documents.ts` passed.

Live DB re-check:
- `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` from `frontend/` is still blocked by `ECONNREFUSED 88.80.188.224:5432` during fixture insert and cleanup.

Remaining after this slice:
- Persisted live end-to-end proof remains blocked until PostgreSQL is reachable.
- Continue closing response quality review surfaces and final approval evidence.

### 2026-05-27 - Documents UI Response Readiness Visibility

Status: implemented and verified.

Purpose: show response package readiness in the operator-facing documents/final-package UI so render blockers are visible before a user attempts final artifact production.

Changes in this slice:
- Add a tenant-scoped `getResponsePackageReadiness` server action for the opportunity documents page.
- Thread response readiness through the server page, client refresh flow, and proposal document list.
- Display response readiness coverage or blocker text in each final package panel.
- Disable final render/re-render controls when response readiness is missing, blocked, or unrecognized.
- Add action coverage proving the documents page readiness summary is scoped to the assigned opportunity and organization.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 15 tests.
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 46 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 workflow test files and 43 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 workflow test files and 19 tests.
- `git diff --check -- docs/aspiration-execution-gap-progress.md frontend/lib/actions/proposal-documents.ts frontend/lib/types/opportunity.ts frontend/app/(app)/opportunities/[id]/documents/page.tsx frontend/app/(app)/opportunities/[id]/documents/ProposalDocumentsClientPage.tsx frontend/components/proposals/ProposalDocumentList.tsx frontend/__tests__/actions/proposal-documents-scope.test.ts` passed.

Remaining after this slice:
- Add persisted live end-to-end proof from discovered opportunity into tenant workflow records when PostgreSQL is reachable.
- Continue closing operator review surfaces for response quality and final package approvals.

### 2026-05-27 - Final Artifact Response Readiness Gate

Status: implemented and verified.

Purpose: stop weak response packages before final artifact rendering instead of waiting until the submission checklist catches them.

Changes in this slice:
- Require `proposal_response_package` workflow readiness before final artifact request-render or render actions tied to an opportunity.
- Block missing, blocked, or unrecognized response readiness before object storage or document rendering is invoked.
- Preserve the existing `allowDraftRender` path for intentional draft/pre-final renders.
- Add regression coverage proving blocked response readiness prevents storage, renderer, upload, and database mutation side effects.

Verification:
- `npm test -- final-artifact-workflow.test.ts` from `frontend/` passed, running 12 tests.
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts submission-workflow.test.ts` from `frontend/` passed, running 31 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 workflow test files and 43 tests.
- `git diff --check -- frontend/lib/actions/final-artifact-workflow.ts frontend/__tests__/actions/final-artifact-workflow.test.ts` passed.

Remaining after this slice:
- Continue surfacing response readiness blockers in operator-facing review/final-render UI before users attempt the render action.
- Tenant-persisted live proof still needs a reachable PostgreSQL endpoint.

### 2026-05-27 - Final Submission Response Readiness Gate

Status: implemented and verified.

Purpose: prevent a final submission checklist from passing when the response package workflow has missing or blocked readiness evidence.

Changes in this slice:
- Load the tenant-scoped `proposal_response_package` workflow instance during final submission checklist evaluation.
- Add a required response package readiness checklist item that passes only when workflow metadata reports `ready_for_review`.
- Block final submission when response package readiness is missing, blocked, or has an unrecognized status.
- Surface response package coverage metrics and blocker summaries in final checklist messages and workflow metadata.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 10 tests.
- `npm test -- final-submission-checklist-workflow.test.ts submission-workflow.test.ts` from `frontend/` passed, running 19 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 final-submission test files and 19 tests.
- `git diff --check -- frontend/lib/actions/final-submission-checklist-workflow.ts frontend/__tests__/actions/final-submission-checklist-workflow.test.ts` passed.

Remaining after this slice:
- Continue connecting response readiness evidence into operator review/final-render UX so blockers are visible before the final checklist.
- Tenant-persisted live proof still needs a reachable PostgreSQL endpoint.

### 2026-05-27 - Response Package Workflow Readiness Metrics

Status: implemented and verified.

Purpose: carry response readiness evidence into the tenant-backed response package action result and workflow metadata so operators can see whether accepted requirements actually reached drafted response documents.

Changes in this slice:
- Add deterministic readiness metrics to `createAndDraftStandardProposalSet`.
- Measure accepted requirement count, drafted requirement count, requirement coverage, documents drafted, sections drafted, and compliance entries created.
- Return blockers and missing requirement IDs when accepted requirements are not represented in drafted response documents, while preserving warnings for compliance-matrix entry gaps.
- Persist the readiness object into the response-package workflow transition metadata.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 14 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 45 tests.

Live DB re-check:
- `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` from `frontend/` is still blocked by `ECONNREFUSED 88.80.188.224:5432` during fixture insert and cleanup.

Remaining after this slice:
- Tenant-persisted live proof still needs a reachable PostgreSQL endpoint.
- Continue wiring readiness metrics through the review/final-render/submission surfaces so weak response packages cannot silently advance.

### 2026-05-27 - Response Readiness Platform Proof Scenario

Status: implemented and verified.

Purpose: make deterministic source-driven response package readiness part of the durable non-live platform proof manifest instead of only an ad hoc unit command and live-safe proof.

Changes in this slice:
- Add `wave9-response-readiness-package` to the platform-proof scenario manifest.
- Cover the live response package builder's source requirement extraction, Datacraft snippet selection, six-document draft generation, readiness metrics, blocker behavior, and unresolved-placeholder checks.
- Add manifest regression coverage so the scenario remains uniquely addressable under Wave 9 response-generation proof targets.

Verification:
- `npm run platform:proof -- --run wave9-response-readiness-package` from `frontend/` passed, running `live-response-package.test.ts`.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue closing the live path from draft artifacts into tenant-persisted opportunity, document, workflow, final rendering, and submission records once database connectivity is available.

### 2026-05-27 - Live Opportunity Response Readiness Proof

Status: implemented and verified.

Purpose: prove a live procurement opportunity can move beyond discovery into source-document extraction and concrete response-package draft artifacts using the configured UNGM and Docling services.

Changes in this slice:
- Fix the Docling client to call the live Docling Serve `/v1/convert/file` multipart endpoint with the `files` field and Docling Serve response normalization.
- Add `live-opportunity-response-readiness` to the platform-proof live-safe manifest.
- Add a reusable live response package builder that turns extracted source text into six draft markdown response documents with requirement coverage and Datacraft evidence cues.
- Add a deterministic readiness assessment that blocks incomplete packages based on document type coverage, source requirement coverage, mandatory requirement coverage, evidence cue coverage, review gates, unresolved placeholders, and minimum draft depth.
- Add a live-safe proof script that finds a software/security UNGM opportunity, fetches its source PDF, extracts procurement text with Docling, writes response-package draft artifacts, and verifies the resulting package.

Verification:
- `npm test -- live-response-package.test.ts searxng-client-config.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 13 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` from `frontend/` passed.
- The live proof selected the UN Secretariat goAML software penetration-testing EOI, fetched a 171,406-byte PDF, extracted 3,070 text characters through Docling with status `success`, found procurement indicators, extracted 8 source requirement signals, and wrote 6 response draft artifacts totaling 3,203 words with 22 section seeds and 85 relevant Datacraft snippets.
- The readiness assessment returned `ready_for_review` with zero blockers, 100% document type coverage, 100% source requirement coverage, 100% mandatory requirement coverage, 100% evidence cue coverage, 100% review gate coverage, and zero unresolved placeholders. It recorded warnings that `management_plan` and `past_performance` had no directly assigned source requirement signals in the short EOI source text.

Remaining after this slice:
- The environment-backed live database persistence proof is still blocked until the configured PostgreSQL endpoint is reachable.
- Continue closing the live path from draft artifacts into tenant-persisted opportunity, document, workflow, final rendering, and submission records once database connectivity is available.

### 2026-05-27 - Live DB Persistence Probe Blocked

Status: blocked by database connectivity.

Purpose: check whether the environment-backed RFP tenant persistence proof can now run against the configured migrated database.

Verification attempted:
- `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` from `frontend/` attempted to run the gated DB-backed tenant-isolation suite.
- The suite could not connect to the configured PostgreSQL host `88.80.188.224:5432`; both fixture insert and cleanup attempts failed with `ECONNREFUSED`.

Outcome:
- No live persistence proof was collected in this environment.
- The remaining live database gap is external connectivity/configuration, not skipped local test coverage.

Next condition to unblock:
- Provide a reachable migrated PostgreSQL endpoint through `DATABASE_URL`, then rerun `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts`.

### 2026-05-27 - Discovery-to-Response Bridge Proof Scenario

Status: implemented and verified.

Purpose: make the discovered-opportunity to RFP intake and response-package bridge a focused platform proof instead of relying only on the larger discovery-to-submission manifest.

Changes in this slice:
- Add `wave9-discovery-rfp-response-bridge` to the platform-proof scenario manifest.
- Cover the bridge from discovery import and source document seeding through direct RFP intake, RFP storage/extraction service behavior, and accepted-requirement response package drafting.
- Add manifest coverage so the focused scenario remains uniquely addressable and advertises its expected Vitest artifacts.

Verification:
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 45 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Add an environment-backed live persistence proof only when a reachable migrated database is available.
- Keep source-specific live proofs as the stronger evidence for real external opportunity feeds.

### 2026-05-27 - Opportunity-Relevant Live Search Proof

Status: implemented and verified.

Purpose: harden the live discovery-services proof so SearXNG must return opportunity-relevant results, not just any generic search result.

Changes in this slice:
- Replace the generic `tender` live proof query with procurement-source query candidates and an explicit Bing engine default, matching the currently responsive SearXNG upstream.
- Filter SearXNG samples to procurement source hosts or tender/RFP/bid-style opportunity language with procurement context.
- Record both total SearXNG results and opportunity-relevant SearXNG results in live evidence artifacts.
- Use the shared Firecrawl/browser scrape timeout default instead of the previous 20-second proof-specific timeout.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-discovery-services` from `frontend/` passed.
- The live proof returned 4 opportunity-relevant SearXNG results out of 10 total results for `tenders.go.ke` through Bing, Firecrawl scraped `https://example.com` into 180 markdown characters, and the browser fallback scraped 528 content characters.

Remaining after this slice:
- SearXNG upstream quality is still uneven: Google, DuckDuckGo, Brave, and Startpage reported access/CAPTCHA limits during probing, so this proof intentionally targets the responsive Bing path.
- Keep the direct PPIP, UNGM, and UNDP source proofs as the stronger evidence for source-specific opportunity discovery.

### 2026-05-27 - Full Non-Live Platform Proof

Status: verified.

Purpose: prove the complete non-live frontend platform proof manifest is green after tenant-scope remediation, live discovery validation, and discovery import persistence coverage.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` from `frontend/` passed every non-live scenario.
- Covered Wave 0 proof harness/typecheck/workflow runtime, Wave 1 browser control-plane and portal flows, Wave 2 RFP upload/parse/storage, Wave 3 compliance/evidence/readiness, Wave 4 planning/collaboration/capture pipeline, Wave 5 AI/content governance, Wave 6 submission/approval/production, Wave 7 import/operations, Wave 8 strategic capability workflows, and Wave 9 discovery-to-submission core.
- Browser e2e scenarios passed for control-plane interactions, role homepage, and portal workflow queue.

Remaining after this slice:
- Live-safe proofs are green for search/scrape/source discovery; still need an environment-backed live database persistence proof when a reachable migrated database is available.
- Keep extending platform-proof scenarios as new user-facing workflows are added.

### 2026-05-27 - Capture Pipeline Platform Proof Scenario

Status: implemented and verified.

Purpose: make capture pipeline tenant-scope and auth coverage part of the durable platform-proof manifest instead of leaving it as an ad hoc test command.

Changes in this slice:
- Add `wave4-capture-pipeline-scope` to the platform-proof scenario manifest.
- Cover `pipeline-scope.test.ts` and `pipeline-auth.test.ts` under the Wave 4 planning/capture proof family.
- Close the earlier pipeline slice's gap that noted there was no dedicated platform-proof scenario for pipeline coverage.

Verification:
- `npm run platform:proof -- --run wave4-capture-pipeline-scope` from `frontend/` passed, running 2 pipeline test files and 11 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed, running 3 manifest tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Prove a selected discovered opportunity can drive RFP/document intake and response-package generation end to end.
- Add an environment-backed persistence proof only when a reachable test database is available.

### 2026-05-27 - Discovery Import Tenant Persistence Proof

Status: implemented and verified.

Purpose: prove scheduled/API-key discovery imports persist discovered opportunities under the explicit service tenant rather than relying on the ambient interactive session.

Changes in this slice:
- Add regression coverage for `executeOpportunityDiscoveryImport` when the active user context differs from the supplied import actor and organization.
- Assert import record creation, opportunity creation, and import record completion all receive the explicit `{ actorId, organizationId }` override.
- Keep the discovery route proof aligned with the service path used for API-key discovery runs.

Verification:
- `npm test -- discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts` from `frontend/` passed, running 19 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 112 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Prove a selected discovered opportunity can drive RFP/document intake and response-package generation end to end.
- Add an environment-backed persistence proof only when a reachable test database is available.

### 2026-05-27 - Live Discovery Source Proofs

Status: verified against live services.

Purpose: prove the platform can use the configured search/scrape infrastructure and live procurement sources to find opportunity candidates and fetch source material.

Live proofs:
- `live-discovery-services`: SearXNG at `https://search.lindela.io` returned 28 results for `tender`; Firecrawl scraped `https://example.com` into 180 markdown characters; browser fallback at `http://84.247.181.100:3003` scraped 528 markdown characters.
- `live-source-discovery`: Firecrawl scraped `https://procurement-notices.undp.org`, returning 201,672 markdown characters, 592 links, and 376 normalized opportunity candidates.
- `live-kenya-ppip-source`: Kenya PPIP returned 940 total active tenders, mapped 10 sampled opportunities, and fetched a source PDF byte range with HTTP 206 and `application/pdf`.
- `live-ungm-source`: UNGM returned 1,652 total notices, mapped 10 sampled opportunities, enriched 5 sampled details with public links, and fetched a portal page with HTTP 200.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-discovery-services` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-source-discovery` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-kenya-ppip-source` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-ungm-source` from `frontend/` passed.

Remaining after this slice:
- Prove the discovered candidates can be persisted through the authenticated import path into tenant-scoped opportunity records.
- Prove a selected live opportunity can drive RFP/document intake and response-package generation end to end.

### 2026-05-27 - Opportunity Assignment Predicate Scan

Status: audited and verified; no code change required.

Purpose: confirm the remediated workflow surfaces no longer leave assignment-only opportunity predicates in frontend server actions.

Findings:
- Scanned `frontend/lib/actions` for every raw `opportunities.assigned_to` predicate.
- No remaining occurrence lacked a nearby `opportunities.organization_id` tenant predicate in the same visibility clause or subquery.
- Previously remediated surfaces now cover work items, calendar, reviews, document render audits, final artifacts, review packages, pricing approvals, claim remediation, resource reuse, workflow domain, submissions, pipeline, task management, pricing, and proposal documents.

Verification:
- `python3` assignment-predicate scan over `frontend/lib/actions` reported no missing nearby organization predicates.
- Full frontend proof is green after the test-health recovery: `npm test -- --run` passed with 1,249 tests and 4 DB integration tests intentionally skipped unless `RUN_DB_INTEGRATION_TESTS=1`.

Remaining after this slice:
- Move from tenant-scope remediation back to end-to-end functional gaps: live discovery/search/scrape validation, opportunity download/import paths, response-package generation, and deployment-readiness proof.

### 2026-05-27 - Full Vitest Suite Test-Health Recovery

Status: implemented and verified.

Purpose: restore the broad frontend Vitest proof after the tenant-scope remediation exposed unrelated test-health blockers.

Changes in this slice:
- Update the opportunity import auth test mock to include `requireUserContext`, matching the current discovery import auth path.
- Gate the DB-backed RFP tenant isolation integration suite behind `RUN_DB_INTEGRATION_TESTS=1` so ordinary full-suite runs do not depend on an external Postgres host.
- Document the opt-in requirement directly in the RFP tenant isolation test header.

Verification:
- `npm test -- import-opportunities-auth.test.ts rfp-tenant-isolation.test.ts` from `frontend/` passed, running 4 import auth tests and intentionally skipping 4 DB integration tests without the opt-in flag.
- `npm test -- --run` from `frontend/` passed, running 1,249 tests with 4 DB integration tests skipped.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Run `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` only in an environment with reachable `DATABASE_URL` and migration `0021_rfp_tenant_isolation.sql` applied.
- Continue scanning for other assignment-only opportunity predicates outside the already remediated workflow surfaces.

### 2026-05-27 - Win Theme Tenant Predicate Audit

Status: audited and verified; no code change required.

Purpose: confirm win-theme and competitive strategy workflows already bind opportunity-derived reads and writes to the caller's organization through the owning opportunity.

Findings:
- `win-themes.ts` already applies opportunity organization predicates, with legacy null-opportunity fallback, to theme, occurrence, injection, and proposal-document scan visibility paths.
- `competitive-win-theme-workflow.ts` already applies opportunity organization predicates to strategy workflow visibility paths.
- Existing tests already assert both `opportunities.organization_id` and `opportunities.assigned_to` for the win-theme paths.

Verification:
- `npm test -- win-themes-auth.test.ts competitive-win-theme-workflow.test.ts` from `frontend/` passed, running 8 tests.

Remaining after this slice:
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.
- Continue scanning for other assignment-only opportunity predicates outside the already remediated workflow surfaces.

### 2026-05-27 - Proposal Documents Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal document creation, section drafting, requirement linking, win-theme reads, bulk document updates, and response-package generation scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to proposal-document assigned-opportunity helpers.
- Thread organization-aware opportunity predicates through opportunity, requirement, win-theme, proposal-document, section, and bulk-update visibility paths.
- Add the opportunity tenant boundary to proposal-document section subqueries that join through the owning proposal document and opportunity.
- Extend proposal document scope tests to assert opportunity organization predicates across create, read, update, section, draft, link, and bulk status paths.

Verification:
- `npm test -- proposal-documents-scope.test.ts proposal-documents-auth.test.ts` from `frontend/` passed, running 16 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as win themes.
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.

### 2026-05-27 - Pricing Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep cost elements, pricing summaries, cost-technical tracking, and pricing creation preflights scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to direct assigned-opportunity pricing preflights.
- Add the same opportunity tenant boundary to shared pricing `exists` predicates used by cost elements, pricing summaries, cost-technical tracking, and WBS-derived reads.
- Preserve pricing row organization predicates while adding the missing opportunity tenant boundary.
- Extend pricing tests to assert opportunity organization predicates on cost element creation, pricing summary reads/updates, and cost-technical tracking reads.

Verification:
- `npm test -- pricing.test.ts` from `frontend/` passed, running 92 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production test files and 42 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as proposal documents and win themes.
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.

### 2026-05-27 - Task Management Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal task generation, reads, updates, deletes, activity reads, time logging, workload metrics, and summary maintenance scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to task-management assigned-opportunity visibility checks.
- Add the same opportunity tenant boundary to task-activity visibility subqueries.
- Preserve proposal task row organization predicates while adding the missing opportunity tenant boundary.
- Extend task-management auth/scope tests to assert opportunity organization predicates across requirements, task reads/writes, summaries, activity, time logging, workload, and author metrics paths.

Verification:
- `npm test -- task-management-auth.test.ts` from `frontend/` passed, running 11 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` from `frontend/` passed, running 3 planning/collaboration test files and 12 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as pricing, proposal documents, and win themes.
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.

### 2026-05-27 - Pipeline Opportunity Tenant Predicates

Status: implemented and focused verified; broad Vitest suite still has unrelated blockers.

Purpose: keep capture pipeline, activity, gate, milestone, partner, analytics, forecast, and risk reads/writes scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require pipeline opportunity predicates to use the organization-aware pipeline context.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to assigned-opportunity and assigned-pipeline visibility helpers.
- Preserve capture pipeline, gate review, and milestone row predicates while adding the missing opportunity tenant boundary.
- Extend pipeline scope tests to assert opportunity organization predicates across pipeline, activity, gate, milestone, partner, analytics, forecast, risk, and summary paths.

Verification:
- `npm test -- pipeline-scope.test.ts` from `frontend/` passed, running 9 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --list` from `frontend/` showed no dedicated pipeline/capture platform-proof scenario.
- `npm test -- --run` from `frontend/` was attempted; pipeline coverage passed, but the full suite remained red because `rfp-tenant-isolation.test.ts` could not connect to `88.80.188.224:5432` and `import-opportunities-auth.test.ts` has an existing `requireUserContext` auth-utils mock mismatch.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, pricing, proposal documents, and win themes.
- Add a dedicated pipeline/capture platform-proof scenario so pipeline tenant isolation is covered by the proof harness instead of only the action scope test.

### 2026-05-27 - Submissions Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep final submission creation, attachment selection, status updates, outcome updates, analytics, and recent submission reads scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require submission opportunity predicates to use the typed organization-aware submission context.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to submission, opportunity, analytics, recent-submission, and attachment proposal-document visibility checks.
- Preserve submission row organization predicates while adding the missing opportunity tenant boundary.
- Extend submissions scope tests to assert opportunity organization predicates across read, write, analytics, recent, and outcome paths.

Verification:
- `npm test -- submissions-scope.test.ts submissions-auth.test.ts` from `frontend/` passed, running 11 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 final-submission test files and 18 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Workflow Domain Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep domain workflow starts and compensation writes scoped to the caller's organization through the owning opportunity before mutating opportunity, proposal task, review, document, approval, submission, claim, pricing, and partner assignment state.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to workflow-domain shared opportunity helpers.
- Bind workflow start opportunity access checks and domain compensation predicates to the tenant context already required by the workflow domain action.
- Add opportunity tenant predicates for proposal document/document approval joins and pipeline/review existence joins used by compensation.
- Extend workflow-domain tests to assert opportunity organization predicates across pricing, task, gate, claim, and final-document compensation paths.

Verification:
- `npm test -- workflow-domain.test.ts` from `frontend/` passed, running 24 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave0-workflow-runtime-core` from `frontend/` passed, running 4 workflow/runtime/auth test files and 27 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Work Items Claim Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep command-center high-risk claim blockers scoped to the caller's organization through the owning opportunity before projecting readiness blockers.

Changes in this slice:
- Thread workflow viewer organization context into command-center claim blocker queries.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to work-item claim visibility checks.
- Extend command-center tests to assert opportunity organization predicates for claim blocker reads.

Verification:
- `npm test -- work-items-command-center.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, workflow domain, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Calendar Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep calendar deadline and milestone aggregation scoped to the caller's organization through the relevant opportunity before exposing proposal deadlines.

Changes in this slice:
- Use full user context for deadline range and milestone reads instead of user id only.
- Require organization context for opportunity-based calendar reads.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to deadline and milestone source queries.
- Extend calendar auth/scope tests to assert organization-aware opportunity predicates.

Verification:
- `npm test -- calendar-scope.test.ts calendar-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Reviews Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep formal review create, list, reviewer-management, reporting, analytics, and status-transition paths scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to review opportunity and review existence helpers.
- Require organization-aware actor context across review/reviewer/scores/report/export/status paths that use shared review visibility predicates.
- Preserve existing review and comment organization predicates while adding the missing opportunity tenant boundary.
- Extend reviews tests to assert opportunity organization predicates in review scope checks.

Verification:
- `npm test -- reviews.test.ts` from `frontend/` passed, running 110 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Document Render Audit Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep pre-submission audit reads scoped to the caller's organization through the target opportunity before reporting readiness across proposal documents.

Changes in this slice:
- Use full user context for pre-submission audit instead of user id only.
- Require organization context for opportunity-based audit reads.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to audit opportunity and proposal document visibility checks.
- Extend document render auth/scope tests to assert organization-aware opportunity predicates.

Verification:
- `npm test -- document-render-scope.test.ts document-render-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, and win themes.

### 2026-05-27 - Final Artifact Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep final artifact render, approval, signoff, and reopen transitions scoped to the caller's organization through the owning opportunity before document/proposal finalization or runtime task updates.

Changes in this slice:
- Require final artifact opportunity predicates to use the typed organization-aware user context.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to proposal document and document visibility checks.
- Include organization context in final artifact runtime transition and task metadata.
- Extend final artifact tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- final-artifact-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Review Package Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep review package gate transitions scoped to the caller's organization through both the proposal review rows and the owning opportunity before review state, reviewer state, or runtime task updates.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to review package opportunity joins.
- Preserve existing proposal review and review comment organization predicates.
- Include organization context in review package runtime transition and task metadata.
- Extend review package tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- review-package-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, final artifacts, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Pricing Approval Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep cost-element pricing reviews and pricing-package approval transitions scoped to the caller's organization through the owning opportunity before pricing state or runtime task updates.

Changes in this slice:
- Require typed organization context for pricing approval workflows.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to cost element, pricing summary, cost element collection, and cost-technical tracking visibility checks.
- Include organization context in pricing approval workflow runtime transitions and task metadata.
- Extend pricing approval tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- pricing-approval-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, review package, final artifacts, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Claim Remediation Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep unsupported-claim remediation transitions scoped to the caller's organization through the owning opportunity before updating claim state or projecting remediation tasks.

Changes in this slice:
- Require organization context for claim remediation transitions.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to claim visibility checks used by read and update paths.
- Include organization context in claim remediation workflow runtime transitions and task metadata.
- Extend claim remediation tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- claim-remediation.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 6 compliance/evidence readiness test files and 77 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, pricing approval, review package, final artifacts, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Resource Reuse Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep personnel reuse and past-performance reuse transitions scoped to the caller's organization through the target opportunity while preserving organization ownership for personnel and project rows.

Changes in this slice:
- Require organization context for resource reuse workflows.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to position and relevance-score visibility checks.
- Include organization context in personnel and past-performance reuse workflow runtime transitions.
- Extend resource reuse tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- resource-reuse-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing larger remaining surfaces such as task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, rendering, and final artifact workflows.

### 2026-05-26 - Personnel Staffing Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep staffing gap analysis, opportunity org charts, staffing matrices, and position listings scoped to the caller's organization through the target opportunity.

Changes in this slice:
- Require organization context for personnel actions that read opportunity position requirements.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to position-requirement opportunity visibility checks.
- Preserve non-opportunity personnel CRUD/auth behavior while tightening staffing views.
- Extend personnel scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- personnel-scope.test.ts personnel-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing larger remaining surfaces such as task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, rendering, and final artifact workflows.

### 2026-05-26 - Content Library Outcome Tenant Predicates

Status: implemented and verified.

Purpose: keep snippet/template proposal outcome recording and win-rate recalculation scoped to the caller's organization through the associated opportunity.

Changes in this slice:
- Require organization context for proposal outcome recording in the content library.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to snippet/template usage outcome update and read predicates.
- Extend content-library outcome tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- content-library-outcome-scope.test.ts content-library-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing larger remaining surfaces such as task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, rendering, and final artifact workflows.

### 2026-05-26 - DLP Export Policy Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep DLP export clearance, blocking finding workflows, and security review task projection scoped to the caller's organization through the target opportunity.

Changes in this slice:
- Require organization context for DLP export policy evaluation.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to DLP proposal-document source queries.
- Include organization context in DLP workflow runtime transition records.
- Extend DLP policy action tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- dlp-policy.test.ts` from `frontend/` passed, covering the action workflow and scanner.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Clarification Workflow Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep requirement clarification drafting, approval, submission, answer capture, incorporation, and runtime task projection scoped to the caller's organization through the requirement's owning opportunity.

Changes in this slice:
- Require organization context for clarification workflow transitions.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to requirement visibility checks.
- Include organization context in recorded clarification workflow runtime transitions.
- Extend clarification workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- clarification-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Proposal Task Workflow Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal task lifecycle transitions, task activity, and runtime task mirroring scoped to the caller's organization through the task's owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to proposal task workflow visibility checks.
- Thread full task workflow user context through task read and update predicates.
- Extend proposal task workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- proposal-task-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Final Submission Checklist Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep final submission readiness checks for proposal documents, compliance matrices, claim evidence, win-theme consistency, and DLP gate state scoped to the caller's organization through the target opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to final checklist source queries.
- Thread full user context through proposal document, compliance, claim, and win-theme visibility helpers.
- Extend final checklist tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Submission Correction Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep post-dispatch correction requests, corrected submission receipts, withdrawal compensation, and opportunity decision updates scoped to the caller's organization through the submitted opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to submission correction visibility helpers.
- Scope compensating opportunity decision updates through the same tenant-aware opportunity predicate.
- Extend submission correction workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- submission-correction-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Document Authoring Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep template-driven document creation, proposal document links, section edits, linked requirement readiness checks, and document authoring workflow transitions scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require organization context for document authoring workflows.
- Add tenant predicates, with legacy null-opportunity fallback, to proposal-document, section, requirement, and opportunity visibility helpers.
- Preserve document owner checks while threading full action context through opportunity-mediated source checks.
- Extend document authoring workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- document-authoring-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing any remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Review Comment Workflow Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep review comment resolution, projected proposal tasks, runtime workflow state, and review-comment activity scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to review-comment workflow opportunity existence checks.
- Ensure visible comment, review, and task predicates all require both the review/comment organization and the owning opportunity tenant.
- Extend review-comment workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- review-comment-workflow.test.ts review-package-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to document authoring and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Partner Assignment Tenant Predicates

Status: implemented and verified.

Purpose: keep partner assignment, opportunity partner lists, active-opportunity counts, partner opportunity history, and partner performance metrics scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require organization context for partner actions that read or mutate opportunity assignments.
- Add tenant predicates, with legacy null-opportunity fallback, to shared partner-assignment opportunity visibility helpers.
- Keep the global partner directory behavior unchanged because partner rows do not currently carry an organization column.
- Extend partner scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- partners-scope.test.ts partners-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to review comments, document authoring, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Presentation Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep oral presentation creation, slide generation, proposal source reads, requirement context, and anticipated Q&A scoped to the caller's organization through assigned opportunities and proposal documents.

Changes in this slice:
- Require source opportunity predicates to include both assignment and the caller's organization, preserving the legacy null-opportunity fallback.
- Thread the full presentation action context through proposal-document, source-document, opportunity, and requirement visibility helpers.
- Extend presentation scope tests to assert organization predicates as well as assignment predicates.

Verification:
- `npm test -- presentations-scope.test.ts presentations-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to partners, review comments, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Graphics Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal graphics, figure numbering, captions, feedback, exports, template-derived graphics, and graphics consistency checks scoped to the caller's organization through assigned opportunities and proposal documents.

Changes in this slice:
- Require organization context for graphics actions.
- Add tenant predicates, with legacy null-opportunity fallback, to shared opportunity, graphic, proposal document, section, and document visibility helpers.
- Scope library-template graphic creation through the target opportunity before inserting generated graphics.
- Extend graphics scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- graphics-scope.test.ts graphics-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to presentations, partners, review comments, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - PWin Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep PWin assessment, ranking, portfolio optimization, comparison, metrics, forecast, calibration, and prediction flows scoped to the caller's organization through their assigned opportunities.

Changes in this slice:
- Require organization context for PWin actions.
- Add tenant predicates, with legacy null-opportunity fallback, to shared opportunity visibility and assigned-opportunity list helpers.
- Make PWin organization inserts non-optional once the user context is established.
- Extend PWin scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts pwin-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to graphics, presentations, partners, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Past Performance Tenant Boundaries

Status: implemented and verified.

Purpose: keep past-performance projects, relevance scoring, narratives, exports, analytics, and portfolio gap analysis scoped to the caller's organization as well as the assigned opportunity.

Changes in this slice:
- Require full user organization context for past-performance actions.
- Store `organization_id` on newly created, duplicated, and CPARS-imported past-performance projects.
- Add organization predicates, with legacy null-row fallback, to project owner checks and assigned opportunity subqueries.
- Extend past-performance scope tests to assert opportunity organization predicates and project organization predicates in addition to assignment and creator predicates.

Verification:
- `npm test -- past-performance-scope.test.ts past-performance-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 6 compliance/evidence/readiness test files and 77 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to PWin, graphics, presentations, partners, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Competitive Utility Tenant Boundaries

Status: implemented and verified.

Purpose: close the remaining competitive-intelligence mutation and dashboard paths that could act on raw competitor, link, analysis, or import identifiers without tenant predicates.

Changes in this slice:
- Scope competitor-opportunity creation and updates through assigned opportunity tenant predicates and visible competitor ownership.
- Scope win/loss tracking, win/loss analysis, ghost-theme usage, teaming competitor candidates, and intelligence summary counts to the current organization.
- Import competitive intelligence rows into the current organization and check duplicates only inside that tenant before updating.
- Add regression coverage for scoped link mutations, win/loss reads and writes, summary counts, ghost-theme usage, CI imports, and teaming competitor candidates.

Verification:
- `npm test -- competitive.test.ts competitive-win-theme-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to past performance, PWin, graphics, presentations, partners, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Competitive Analysis Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep competitor opportunity links, SWOT generation, discriminator suggestions, competitive matrices, latest analysis reads, and competitive strategy workflow transitions scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require organization context for competitive intelligence actions and strategy workflow transitions.
- Add tenant predicates, with legacy null-opportunity fallback, to assigned opportunity and competitor-opportunity subqueries.
- Thread full user tenant context through competitive analysis, competitor-opportunity, win-theme workflow, theme injection, and theme consistency visibility helpers.
- Extend competitive analysis and strategy workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- competitive.test.ts competitive-win-theme-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to win/loss tracking, partner/team suggestions, past performance, PWin, graphics, presentations, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Win Theme Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep win themes, theme occurrences, injection points, competitor profiles, theme analysis, and proposal-document scans scoped to the current organization through the owning opportunity.

Changes in this slice:
- Require organization context for win-theme actions.
- Add tenant predicates, with legacy null-opportunity fallback, to assigned opportunity and assigned theme subqueries.
- Thread full user tenant context through theme, occurrence, injection, competitor, proposal document, and analysis visibility helpers.
- Extend win-theme authorization tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed.
- `npm test -- competitive-win-theme-workflow.test.ts win-themes-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to competitive analysis and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - Evidence Claim Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep evidence usage, claim analysis, claim remediation support, matrices, reports, and claims summaries scoped to the caller's organization through their opportunity boundary.

Changes in this slice:
- Add tenant predicates, with legacy null-opportunity fallback, to the shared evidence opportunity subquery.
- Thread full evidence context through document claims, section claims, direct claim lookup/update, evidence suggestions, coverage analysis, matrix lookup, reports, and claims summaries.
- Keep organization-owned evidence library predicates in place while aligning claim/matrix/usage opportunity gates to the same tenant boundary.
- Extend evidence scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- evidence.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 6 compliance/evidence/readiness test files and 77 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to win themes, competitive analysis, and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - Requirements Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep requirement CRUD, extraction, gap analysis, workflow acceptance, and projected writing-task gates tied to the current organization as well as the assigned opportunity.

Changes in this slice:
- Add tenant predicates, with legacy null-opportunity fallback, to the shared assigned-opportunity helpers used by requirement actions.
- Scope requirement creation, bulk creation, extraction, save-from-extraction, batch acceptance, projected-task lookup/update, and opportunity existence checks by organization.
- Preserve existing `rfp_requirements.organization_id` and `proposal_tasks.organization_id` row predicates while aligning their opportunity subqueries to the same tenant boundary.
- Extend requirements scope/workflow tests to assert opportunity organization predicates and mock auth utilities cleanly in isolated action tests.

Verification:
- `npm test -- requirements-scope.test.ts requirements-workflow.test.ts requirements-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to evidence, win themes, competitive analysis, and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - Opportunity AI Score Tenant Predicates

Status: implemented and verified.

Purpose: keep AI fit, win-probability, risk, summary, and score-history flows scoped to the caller's organization instead of relying only on assigned opportunity checks.

Changes in this slice:
- Require full tenant context for opportunity AI actions.
- Add tenant predicates, with legacy null-row fallback, to opportunity reads, score-history/detail reads, score writes, and opportunity score updates.
- Persist `organization_id` on newly generated heuristic and LLM-backed AI score rows.
- Scope client relationship/history lookups by opportunity organization so win-probability factors cannot mix same-named customers across tenants.
- Extend opportunity AI scope and auth tests to assert organization predicates and inserted score ownership.

Verification:
- `npm test -- opportunity-ai-scope.test.ts opportunity-ai-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to requirements, evidence, win themes, competitive analysis, and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - RFP Upload Opportunity Tenant Gate

Status: implemented and verified.

Purpose: ensure uploaded RFP documents can only be attached to opportunities in the caller's organization, not merely opportunities assigned to the caller.

Changes in this slice:
- Add the current organization to the RFP upload route's opportunity access check.
- Preserve legacy null-row fallback while deployed opportunity rows are being backfilled.

Verification:
- `npm test -- rfp-upload-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to AI scoring, requirements, evidence, and response-support modules.

### 2026-05-26 - Opportunity Document Action Tenant Predicates

Status: implemented and verified.

Purpose: keep source-document discovery, download, selection, deletion, and analysis action gates scoped to the current organization now that opportunity document rows carry tenant context.

Changes in this slice:
- Require organization context for opportunity document actions.
- Add tenant predicates, with legacy null-row fallback, to opportunity and opportunity-document access checks.
- Persist `organization_id` when creating a source opportunity document directly from an opportunity link.
- Scope source-document lookup and opportunity discovery metadata updates by organization.
- Extend opportunity document scope tests to assert organization predicates and inserted source-document ownership.

Verification:
- `npm test -- opportunity-documents-scope.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to RFP upload, AI scoring, requirements, and specialized response-support modules.

### 2026-05-26 - Opportunity Vote Tenant Predicates

Status: implemented and verified.

Purpose: use the new opportunity tenant root to keep go/no-go vote reads, writes, summaries, and auto-decision updates scoped to the current organization.

Changes in this slice:
- Require organization context for opportunity vote actors.
- Persist `organization_id` on newly cast opportunity votes.
- Add tenant predicates, with legacy null-row fallback, to vote lookup, summary, delete, bulk-summary, and automatic opportunity status update paths.
- Extend vote scope tests to assert both assigned-opportunity and organization predicates.

Verification:
- `npm test -- opportunity-votes-scope.test.ts opportunity-votes-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to other specialized response modules that still use assignment-only checks.

### 2026-05-26 - Opportunity Root Tenant Anchors

Status: implemented and verified.

Purpose: give discovery, opportunity CRUD, import audit records, votes, and source-document intake a tenant root so downstream RFP intake and response workflows no longer inherit tenant identity only from assignment checks.

Changes in this slice:
- Add nullable `organization_id` anchors and indexes for `opportunities`, `opportunity_imports`, `opportunity_votes`, and `opportunity_documents`, plus an organization index for existing AI score rows.
- Replace global opportunity source/fingerprint uniqueness with tenant-aware unique indexes so separate organizations can discover the same public notice independently.
- Backfill opportunity roots from assigned user workspaces, import records from importing user workspaces, and votes/documents from their opportunity tenant.
- Persist and enforce organization context in modern opportunity actions, legacy CRUD actions, import audit records, live discovery import, scheduled/API-key discovery, and source-document seeding.
- Require `DISCOVERY_IMPORT_ORGANIZATION_ID` for service-user/API-key discovery runs so scheduled imports are explicit about tenant ownership.

Verification:
- `npm test -- opportunities.test.ts opportunities-crud-scope.test.ts opportunities-crud-auth.test.ts discovery-opportunity-import.test.ts opportunity-documents-scope.test.ts rfp-document-service.test.ts document-discovery-agent.test.ts` from `frontend/` passed.
- `npm test -- opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue replacing assignment-only joins in specialized modules with tenant-aware opportunity predicates now that `opportunities.organization_id` exists.
- Remove legacy null-row fallback after deployed opportunity/import/document rows are fully backfilled.

### 2026-05-26 - Proposal Package Artifact Tenant Anchors

Status: implemented and verified.

Purpose: close the proposal-package and final-artifact tenant boundary so generated response package rows, document sections, and final artifact workflow transitions stay bound to the current organization rather than relying only on assigned-opportunity checks.

Changes in this slice:
- Add nullable `organization_id` anchors and indexes for `proposal_documents` and `document_sections`, with migration backfill from existing proposal rows and single-tenant installs.
- Persist organization IDs on new proposal documents, linked existing documents, seeded package sections, and manually created document sections.
- Require current organization context for proposal package and final artifact mutations, with legacy null-row fallback during migration.
- Scope proposal document, document section, bulk package, and final artifact visibility helpers by tenant while retaining assigned-opportunity predicates.
- Thread organization IDs through response package draft and final artifact workflow runtime transitions.

Verification:
- `npm test -- proposal-documents-scope.test.ts proposal-documents-auth.test.ts final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts submissions-scope.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 110 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing any remaining workflow/runtime row boundaries that can still rely on assignment-only checks or tenant-null migration fallbacks.

### 2026-05-26 - Pricing Row Tenant Anchors

Status: implemented and verified.

Purpose: close the pricing/cost tenant boundary so cost elements, pricing rollups, and cost-technical alignment records cannot move through proposal pricing workflows on assignment-only checks.

Changes in this slice:
- Add nullable `organization_id` anchors and indexes for `cost_elements`, `pricing_summaries`, and `cost_technical_tracking`, with migration backfill from existing cost elements and single-tenant installs.
- Persist organization IDs on new cost elements, duplicated cost elements, and pricing summary creation.
- Require tenant predicates, with legacy null-row fallback, in cost element, pricing summary, WBS, and cost-technical tracking visibility helpers.
- Scope labor-category usage checks and pricing workflow-domain compensation through the same pricing tenant boundary.
- Extend pricing and workflow-domain regression tests to assert tenant predicates are present.

Verification:
- `npm test -- pricing.test.ts workflow-domain.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing any remaining assignment-only row boundaries outside pricing, especially generated artifact/package records that participate in submission readiness.

### 2026-05-26 - Capture Pipeline Gate Tenant Anchors

Status: implemented and verified.

Purpose: close a tenant-isolation gap in the capture execution path so pipeline rows, gate reviews, and gate workflow compensation stay bound to the current organization as responses move through bid/no-bid governance.

Changes in this slice:
- Add `organization_id` columns and indexes for `capture_pipeline` and `gate_reviews`, with a migration backfill for single-tenant installs and gate rows inheriting their pipeline tenant.
- Persist organization IDs when initializing capture pipelines and scheduling gate reviews.
- Thread current organization scope through pipeline, activity, milestone, gate-review, analytics, forecast, at-risk, and summary reads/writes that depend on `capture_pipeline`.
- Scope capture gate workflow runtime transitions and domain compensation by tenant while preserving assigned-opportunity checks.
- Add regression assertions for no-bid gate decisions and gate workflow compensation predicates.

Verification:
- `npm test -- gate-review-workflow.test.ts pipeline-scope.test.ts workflow-domain.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 test files and 42 approval/production/correction tests.

Remaining after this slice:
- Continue closing generated artifact/package row boundaries that participate in submission readiness.

### 2026-05-26 - UNGM Notice Detail Enrichment

Status: implemented and verified.

Purpose: improve UNGM opportunity quality by enriching listing rows with public notice detail descriptions, contact email, and procurement/document links.

Changes in this slice:
- Parse UNGM popup detail panels for description text, contact email, and `tblLinks` procurement URLs.
- Fetch notice details for a bounded number of UNGM search results and merge detail summaries, submission method labels, and best public procurement link into the canonical opportunity data.
- Rank UNGM links so actual SharePoint negotiation-document URLs beat helper login links.
- Tighten the live UNGM proof so it fails if sampled notice details do not contribute public links.

Verification:
- `npm test -- ungm-parser.test.ts ungm-client.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-ungm-source --include-live-safe` from `frontend/` passed, returning 10 mapped opportunities, 5 detail-enriched sampled notices, and SharePoint negotiation-document links for the sampled UNGM notices.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 test files and 110 tests across discovery/import through submission gates.

Remaining after this slice:
- Live persisted import-to-parse proof still depends on target database connectivity; current DB connection attempts return connection refused.

### 2026-05-26 - Discovery Defaults Include Live UNGM

Status: implemented and verified.

Purpose: put the newly live-proven UNGM source into the default operator discovery surface so it is used without manual URL entry.

Changes in this slice:
- Add `https://www.ungm.org/Public/Notice` to the live discovery dialog's default configured source URLs.

Verification:
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue toward a live import-to-parse proof once the target database is reachable from this environment.

### 2026-05-26 - UNGM Public Notice Source Discovery

Status: implemented and verified.

Purpose: make UNGM a first-class live configured source using its public notice search endpoint instead of depending on rendered-page scraping.

Changes in this slice:
- Add a UNGM public notice client for `https://www.ungm.org/Public/Notice/Search`.
- Parse UNGM row fragments into canonical opportunity data with notice ID, reference, organization, country, notice type, deadline, published date, and portal URL.
- Prefer the UNGM public endpoint before Firecrawl for `ungm.org` configured source URLs, while retaining Firecrawl fallback if the endpoint fails.
- Preserve UNGM source metadata through import so downstream deduplication and audit records use `ungm` identifiers.
- Add a live-safe `live-ungm-source` platform proof scenario and evidence artifact.

Verification:
- `npm test -- ungm-parser.test.ts ungm-client.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npx tsx scripts/prove-live-ungm-source.ts` from `frontend/` passed, returning 10 mapped opportunities from 1,658 active UNGM notices and fetching the first live notice portal page with HTTP 200.
- `npm run platform:proof -- --run live-ungm-source --include-live-safe` from `frontend/` passed with the same live UNGM acquisition and portal-fetch proof.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed after the UNGM import-path change, running 13 test files and 110 tests across discovery/import through submission gates.

Remaining after this slice:
- Wire this live UNGM acquisition into the next import-to-parse proof once database connectivity to the target environment is available.

### 2026-05-26 - Current Discovery-To-Submission Proof Refresh

Status: verified.

Purpose: re-run the broad non-live platform proof after the live-source and document-intake changes so current evidence covers the discovery-to-response path, not just individual slices.

Verification:
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed.
- The proof ran 13 test files and 109 tests covering discovery route/import, document discovery, source document download, RFP parse workflow, requirements, proposal documents, final artifact routes/workflow, final submission checklist, submission workflow, and submission scope.

Remaining after this slice:
- Add a live-safe proof that runs configured-source discovery with bounded source-document download against current live services and persists auditable import/download evidence.

### 2026-05-26 - Discovery Presets Preserve Document Intake

Status: implemented and verified.

Purpose: keep live configured-source discovery moving into source-document intake when operators save or schedule reusable discovery presets.

Changes in this slice:
- Persist `downloadDiscoveredDocuments` and bounded `downloadLimit` in discovery presets.
- Default the live discovery dialog to download seeded source documents with the existing bounded download limit.

Verification:
- `npm run test -- discovery-presets.test.ts discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue toward live import-to-parse proof.

### 2026-05-26 - Live-Proven Discovery Source Defaults

Status: implemented and verified.

Purpose: make the default live discovery dialog use sources that have current proof, rather than relying only on degraded metasearch engine results.

Changes in this slice:
- Preload the live discovery dialog with `https://tenders.go.ke/tenders` and `https://procurement-notices.undp.org` as configured source URLs.
- Keep operators able to edit or replace the source list before running or saving a preset.

Verification:
- `npm run test -- discovery-presets.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue toward a full configured-source import plus document intake proof.

### 2026-05-26 - Kenya PPIP Document Download TLS Handling

Status: implemented and verified.

Purpose: let source-document intake fetch Kenya PPIP PDFs after PPIP opportunities are discovered, without weakening TLS validation for generic external downloads.

Changes in this slice:
- Add an explicit invalid-TLS host allowlist option to the SSRF-safe public URL fetch helper.
- Pass that exception only for `tenders.go.ke` source document downloads.
- Extend the live Kenya PPIP proof to fetch a byte range from a real PPIP PDF document URL.

Verification:
- `npm run test -- public-url.test.ts rfp-document-service.test.ts prove-live-kenya-ppip-source.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-kenya-ppip-source --include-live-safe` from `frontend/` passed, returning 928 active tenders and fetching 1,024 bytes from a live PPIP PDF with HTTP 206 and `application/pdf`.

Remaining after this slice:
- Prove the full configured-source import path with bounded document download, parse queueing, and response readiness against a realistic live opportunity.

### 2026-05-26 - Kenya PPIP API Source Discovery

Status: implemented and verified.

Purpose: make Kenya PPIP a live configured source even though its public SPA shell and scraper/browser paths are sparse or unreliable.

Changes in this slice:
- Add a Kenya PPIP public JSON API client for `tenders.go.ke` configured-source discovery.
- Map PPIP API tenders into canonical opportunity data with tender reference, procuring entity, category, deadline, published date, portal URL, and source document URL.
- Prefer the PPIP API path before Firecrawl for `tenders.go.ke` source URLs, while retaining Firecrawl fallback if the API fails.
- Preserve PPIP source metadata through import so downstream deduplication and source-document seeding use `kenya_ppip` identifiers.
- Add a live-safe `live-kenya-ppip-source` platform proof scenario and evidence artifact.

Verification:
- `npm run test -- kenya-ppip-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-kenya-ppip-source --include-live-safe` from `frontend/` passed, returning 928 active tenders from `https://tenders.go.ke/api/active-tenders?perpage=10&page=1` and 10 mapped sample opportunities with source document URLs.

Remaining after this slice:
- Continue toward realistic opportunity-to-winning-response proof after live Kenya acquisition is durable.

### 2026-05-26 - Kenya PPIP Parser Readiness

Status: implemented and verified.

Purpose: prepare configured-source discovery for Kenya PPIP table content so that high-value Kenya public procurement listings can use source-specific extraction instead of the generic parser when the portal content is available.

Changes in this slice:
- Add a frontend Kenya PPIP parser for `tenders.go.ke` tender table rows.
- Parse tender number, description, procuring entity, procurement method/category, close date, publish date, and action links from HTML tables.
- Parse equivalent markdown table rows when scraper output is table-like markdown.
- Select source-specific parsers for configured source URLs, currently routing `tenders.go.ke` to `kenya_ppip` and `dgmarket.com` to `dgmarket`.
- Include HTML in configured-source Firecrawl scrape requests so source-specific parsers can inspect table markup.

Verification:
- `npm run test -- kenya-ppip-parser.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Live `https://tenders.go.ke` access still returns sparse or failed content through the current Firecrawl/browser services, so the parser is ready but not yet live-proven. The next step is a portal-specific browser adapter, alternate endpoint, or Cloak-style browser path for Kenya PPIP content acquisition.

### 2026-05-26 - Live Source Discovery Proof Scenario

Status: implemented and verified.

Purpose: make configured-source opportunity discovery part of the durable platform proof manifest instead of relying on ad hoc live smoke commands.

Changes in this slice:
- Add `prove-live-source-discovery.ts`, which scrapes a configured procurement source with Firecrawl and verifies the generic parser returns normalized opportunity candidates.
- Add the `live-source-discovery` live-safe platform proof scenario.
- Record live configured-source evidence in `.omx/state/platform-live-source-discovery-evidence.md`.

Verification:
- `npm run test -- platform-proof-scenarios.test.ts generic-parser.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-source-discovery --include-live-safe` from `frontend/` passed, returning 202,015 markdown characters, 593 links, and 375 normalized opportunities from `https://procurement-notices.undp.org`.

Remaining after this slice:
- Extend live source proof coverage to additional high-value sources after Kenya PPIP and UNGM have dedicated parser/browser handling.

### 2026-05-26 - Generic Parser Source Title Normalization

Status: implemented and verified.

Purpose: improve the quality of source-scraped opportunity records from table-heavy procurement pages so they are usable for downstream qualification and response workflows.

Changes in this slice:
- Normalize escaped field-packed tender link text before generic parser extraction.
- Extract `Title`, `Ref No`, `UNDP Office/Country`, `Process`, and `Deadline` fields from inline procurement table rows.
- Store cleaner opportunity titles, notice IDs, organization, country/region, and process summaries for field-packed links.
- Add parser regression coverage for UNDP-style procurement notice links.

Verification:
- `npm run test -- generic-parser.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Live Firecrawl/parser smoke for `https://procurement-notices.undp.org` returned 375 parsed opportunities, with the first opportunity normalized to title `SAFE ROOM REINFORCEMENT & FIRE ALARM SYSTEM INSTALLATION FOR PLATEAU OFFICE`, notice ID `UNDP-NGA-01432`, organization `UNDP-NGA`, and country `NIGERIA`.

Remaining after this slice:
- Add dedicated parsers for other high-value portals whose rendered output does not fit the generic parser, especially Kenya PPIP and UNGM.

### 2026-05-26 - Configured Source Discovery

Status: implemented and verified.

Purpose: make live discovery less dependent on generic metasearch by allowing configured procurement source URLs to be scraped with Firecrawl and parsed directly into opportunity candidates.

Changes in this slice:
- Add `sourceUrls` and `sourceScrapeLimit` to live discovery input.
- Skip default metasearch queries when a run is source-only, so operators can run direct source discovery without spending SearXNG calls.
- Scrape configured sources with Firecrawl and parse tender-like records with the existing generic tender parser.
- Persist source-scraped opportunities with source-specific metadata, source tags, and normal dedupe/import handling.
- Accept source URLs through the discovery API route, saved discovery presets, and the live discovery dialog.

Verification:
- `npm run test -- discovery-opportunity-import.test.ts discovery-presets.test.ts opportunity-discovery-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Live Firecrawl/parser smoke for `https://procurement-notices.undp.org` returned 202,007 markdown characters, 593 links, and 370 tender-like parsed opportunities.

Remaining after this slice:
- `https://tenders.go.ke` currently returns sparse Firecrawl content and `https://www.ungm.org/Public/Notice` did not produce generic-parser candidates, so source-specific parsers or browser/site adapters are still needed for those portals.
- Source-scraped titles from table-heavy pages can be noisy; improve source-specific normalization before treating every generic-parser result as evaluator-ready opportunity data.

### 2026-05-26 - Discovery Engine Targeting

Status: implemented and verified.

Purpose: let operators route live discovery searches through explicit SearXNG engines when the default engine mix is degraded by CAPTCHA, access-denied, or rate-limit failures.

Changes in this slice:
- Add `engines` to frontend SearXNG search options and discovery import input.
- Pass selected engines from discovery imports into SearXNG requests.
- Accept engine lists through the discovery run API route.
- Persist engine selections in reusable discovery presets.
- Add an Engines control to the live discovery dialog.

Verification:
- `npm run test -- discovery-opportunity-import.test.ts searxng-client-config.test.ts discovery-presets.test.ts opportunity-discovery-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Engine targeting gives operators a mitigation lever, but it does not repair blocked upstream engines or guarantee result quality from any single available engine.

### 2026-05-26 - SearXNG Engine Degradation Telemetry

Status: implemented and verified.

Purpose: make live discovery runs report SearXNG engine degradation such as CAPTCHA, access-denied, and rate-limit responses, even when the search request itself succeeds or returns zero opportunity results.

Changes in this slice:
- Model SearXNG `unresponsive_engines` responses in the frontend search client.
- Convert unresponsive engine details into `searxng_engine_degraded` discovery warnings.
- Persist those warnings into discovery import audit config and return them in the discovery result.
- Add regression coverage proving degraded engines are surfaced without creating opportunity rows.

Verification:
- `npm run test -- discovery-opportunity-import.test.ts searxng-client-config.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- This makes degradation visible but does not fix the underlying SearXNG engine blocks. Engine health and opportunity-query quality still need remediation before live discovery can be considered production-reliable.

### 2026-05-26 - Browser Fallback Compatibility Consolidation

Status: implemented and verified.

Purpose: prevent scraper runtime and LLM fallback paths from breaking against the deployed browser service while preserving cancellation and status metadata for long-running scrape jobs.

Changes in this slice:
- Extend the shared browser scraper client with caller abort-signal support and normalized status-code metadata.
- Move the scraper fetcher stealth fallback through the shared browser scraper client instead of a direct `/v1/scrape` call.
- Move the LLM extractor stealth fallback through the shared browser scraper client.
- Add focused browser scraper client coverage for legacy `/v1/scrape` and deployed `/scrape` response contracts.
- Add scraper fetcher coverage proving stealth fallback uses the shared browser scraper client.

Verification:
- `npm run test -- browser-scraper-client.test.ts fetcher-public-url.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run test -- discovery-opportunity-import.test.ts document-discovery-agent.test.ts browser-scraper-client.test.ts fetcher-public-url.test.ts` from `frontend/` passed.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` from `frontend/` passed with SearXNG returning one basic `tender` result, Firecrawl returning 180 markdown characters for `https://example.com`, and browser fallback returning 528 content characters for `https://example.com`.

Remaining after this slice:
- The browser fallback endpoint compatibility issue is now centralized, but SearXNG engine health and opportunity-query quality are still unresolved.

### 2026-05-26 - Live Discovery Services Proof

Status: implemented and verified.

Purpose: prove that the deployed discovery connectivity tier can perform live search, standard scraping, and browser-backed scraping, while keeping application discovery paths compatible with the live browser service.

Changes in this slice:
- Add a shared browser scraper client that supports both the app's existing `/v1/scrape` contract and the deployed browser service's `/scrape` contract.
- Route opportunity discovery imports and primary-portal document discovery through the shared browser scraper client instead of direct `/v1/scrape` calls.
- Add a `live-discovery-services` live-safe platform proof scenario for SearXNG, Firecrawl, and browser fallback connectivity.
- Record live discovery evidence in `.omx/state/platform-live-discovery-evidence.md`.

Verification:
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run test -- discovery-opportunity-import.test.ts document-discovery-agent.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` from `frontend/` passed with SearXNG returning one basic `tender` result, Firecrawl returning 180 markdown characters for `https://example.com`, and browser fallback returning 528 content characters for `https://example.com`.
- `git diff --check` passed.

Remaining after this slice:
- This proof confirms discovery-service availability and scrape connectivity, not high-quality opportunity retrieval. Useful SearXNG opportunity queries remain degraded because major engines are currently returning CAPTCHA, access-denied, rate-limit, or empty-result responses.
- Continue remediating SearXNG engine health and opportunity-query quality before treating live discovery as reliable enough for production opportunity finding.

### 2026-05-26 - Wave 9 Discovery-To-Submission Proof

Status: verified.

Purpose: prove the current core path from opportunity discovery through submission readiness has executable regression coverage after the latest intake, requirement, response, and build-readiness slices.

Verification:
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed.
- The proof ran 13 test files and 105 tests covering opportunity discovery routes/import, document discovery, document download, RFP document service, RFP parse workflow, requirement workflow, proposal document drafting, final artifact routes/workflow, final submission checklist, submission workflow, and submission scoping.

Remaining after this slice:
- Continue expanding from core regression proof into live-service proof with SearXNG/Firecrawl, deployed scraping, and end-to-end generated response evidence against realistic opportunities.

### 2026-05-26 - Workflow Templates Build Readiness

Status: implemented and verified.

Purpose: keep production builds independent of live workflow-template database connectivity while preserving live workflow-template data at request time.

Changes in this slice:
- Mark `/workflows/templates` as a dynamic route because it reads workflow-template rows from the database.
- Prevent Next.js static prerender from querying `workflow_templates` during `next build`.

Verification:
- `npm run build` from `frontend/` passed.
- Build output marks `/workflows/templates` as dynamic.

Remaining after this slice:
- Continue expanding proof coverage for the full opportunity discovery, RFP intake, response drafting, final package, and submission path.

### 2026-05-26 - Frontend TypeScript Gate Restored

Status: implemented and verified.

Purpose: restore the frontend TypeScript gate so platform reliability work is not hidden behind stale test-fixture and context-type drift.

Changes in this slice:
- Preserve role information in pricing user context instead of narrowing it away after authentication.
- Narrow the RFP parse reject workflow through the authority-aware context path before checking reject authority.
- Update workflow test fixtures to match the current role-aware user-context contract.
- Align final artifact, RFP document service, and submission attachment fixtures with current storage, Buffer, and proposal document type contracts.

Verification:
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run test -- __tests__/actions/content-governance-workflow.test.ts __tests__/actions/document-authoring-workflow.test.ts __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/pricing-approval-workflow.test.ts __tests__/actions/rfp-parse-workflow.test.ts __tests__/services/rfp-document-service.test.ts __tests__/submissions/attachment-receipts.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Keep the TypeScript gate clean while continuing to harden opportunity discovery, intake, response generation, final packaging, and submission readiness.

### 2026-05-26 - Response Package Follow-Up Tasks

Status: implemented and verified.

Purpose: make response-package drafting produce explicit operational follow-ups for package review and final rendering instead of leaving the next governance steps implicit.

Changes in this slice:
- Create a response-package review workflow task after standard response package drafting records its runtime transition.
- Create a final-package rendering workflow task tied to the drafted proposal document IDs, document IDs, compliance matrix, and latest version number.
- Keep response-package drafting non-blocking when workflow task persistence is unavailable, matching the existing telemetry-failure behavior.
- Extend response-package drafting coverage to prove both follow-up tasks are emitted with package evidence.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.
- `npx tsc --noEmit --pretty false` remains blocked by pre-existing unrelated diagnostics in workflow/pricing/RFP/parser test fixtures and typing. No diagnostics pointed at the response-package task files changed in this slice.

Testing scope note:
- Full TypeScript checking is currently blocked by unrelated repository diagnostics listed above; focused proposal document workflow coverage verifies the added task emission.

Remaining after this slice:
- Continue hardening final package rendering/signoff evidence and submission package readiness checks.

### 2026-05-26 - Parsed Requirement Batch Acceptance

Status: implemented and verified.

Purpose: reduce the manual gap between parser-completed requirements and response-package drafting by giving operators a bounded batch path to accept parsed requirements into the response plan.

Changes in this slice:
- Add `acceptParsedRequirementsForResponsePlan`, which promotes review-state parsed requirements through the existing requirement acceptance workflow in a bounded batch.
- Preserve the existing acceptance gate, writing-task projection, workflow history, and evidence links for every accepted requirement.
- Default batch owner and due date from the visible opportunity, falling back to the reviewer and a 7-day due date when needed.
- Add an "Accept Parsed Requirements" control to the opportunity requirements page before response-package drafting.
- Extend requirements workflow coverage to prove batch acceptance uses the normal gated transition and parser evidence links.

Verification:
- `npm run test -- __tests__/actions/requirements-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.
- `npx tsc --noEmit --pretty false` was attempted from `frontend/` and failed on pre-existing unrelated diagnostics in content/document authoring workflow tests, final artifact test config, pricing user-context typing, RFP parser tenant-context typing, RFP document service Buffer typing, and an attachment receipt fixture. No diagnostics pointed at the requirements batch acceptance files changed in this slice.

Testing scope note:
- Battery constraints are no longer active. Full TypeScript checking is currently blocked by unrelated repository diagnostics listed above; focused requirements workflow tests cover the changed server-action behavior.

Remaining after this slice:
- Continue reducing the final handoff from accepted requirements into response-package drafting, governance checks, and submission-ready package evidence.

### 2026-05-26 - Bounded Discovery Source Document Download

Status: implemented and verified.

Purpose: reduce the manual gap between live opportunity discovery and RFP parser intake by allowing discovery runs to download newly seeded source documents under an explicit small limit.

Changes in this slice:
- Add `downloadDiscoveredDocuments` and `downloadLimit` to the live discovery import contract and API route.
- Download only newly seeded source-document rows, bounded by the configured limit, so successful downloads continue into the existing storage and parser queue path.
- Return source-document download attempted/succeeded/failed counts from discovery import results.
- Surface bounded download controls and intake download counts in the live discovery dialog.
- Record download failures as discovery warnings without marking the opportunity import failed.
- Update the opportunity discovery runbook with the bounded download option and operating guidance.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.
- `npx tsc --noEmit` was attempted from `frontend/` and failed on pre-existing unrelated diagnostics in content/document authoring workflow tests, final artifact test config, pricing user-context typing, RFP parser tenant-context typing, RFP document service Buffer typing, and an attachment receipt fixture. No diagnostics pointed at the discovery files changed in this slice.

Testing scope note:
- Battery constraints are no longer active. Full TypeScript checking is currently blocked by unrelated repository diagnostics listed above; focused discovery action/API tests cover the changed behavior in this slice.

Remaining after this slice:
- Continue connecting successful parser output into requirements acceptance and response-package generation with fewer manual handoffs.

### 2026-05-26 - Discovery Source Document Seeding Warning Telemetry

Status: implemented and verified.

Purpose: keep live discovery imports honest when an opportunity is created or updated but its source-document handoff row cannot be seeded.

Changes in this slice:
- Make source-document row seeding non-blocking after a successful opportunity create/update.
- Add `source_document_seed_failed` discovery warnings with query, title, document URL, and failure reason.
- Persist source-document seeding warnings into the import record audit config alongside Firecrawl/browser fallback warnings.
- Extend focused discovery import coverage to prove an opportunity remains imported while the source-document seeding failure is reported.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies warning telemetry with the focused discovery import action test.

Remaining after this slice:
- Continue reducing manual steps from source-document records into bounded download/parse orchestration and generated response package proof.

### 2026-05-26 - Discovery Source Document Count Visibility

Status: implemented and verified.

Purpose: make the discovery-to-intake bridge visible to operators by reporting how many source-document rows were seeded from discovered RFP/tender document URLs.

Changes in this slice:
- Return `sourceDocumentsCreated` and `sourceDocumentsExisting` from the live discovery import result.
- Count newly seeded and already-linked source-document rows separately when opportunities are created or updated.
- Surface source-document seeding counts in the live discovery dialog summary.
- Extend focused discovery import coverage to prove direct document-link imports report seeded source-document rows.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the result contract with the focused discovery import action test; the UI change is a small typed consumer of that result.

Remaining after this slice:
- Continue reducing manual steps from seeded source-document rows into bounded download/parse orchestration and response-package generation.

### 2026-05-26 - Discovery Document Row Auto-Seeding

Status: implemented and verified.

Purpose: move live opportunity discovery closer to RFP intake by creating the selected source-document row as soon as discovery identifies a direct RFP/tender document URL.

Changes in this slice:
- Create an `opportunity_documents` record for discovered `documentUrl` values during SearXNG/Firecrawl opportunity import.
- Avoid duplicate source-document rows by checking the opportunity/source URL pair before insert.
- Infer document name and RFP/attachment type from the discovered URL, mark it selected, and preserve the opportunity `documentUrl` handoff.
- Extend focused discovery import coverage to prove extracted RFP document links now create selected source-document records.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the discovery import bridge with the focused action test.

Remaining after this slice:
- Continue reducing manual steps from discovered source-document records into download, parse acceptance, requirements approval, and response package drafting.

### 2026-05-26 - Final Checklist Win Theme Consistency Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from ignoring known critical win-theme consistency gaps that would weaken evaluator-facing response quality.

Changes in this slice:
- Load opportunity theme analysis snapshots as part of the final submission checklist evaluation.
- Add a win-theme consistency checklist item that blocks known critical gaps and surfaces missing, major, or minor gaps as warnings.
- Include the latest theme analysis ID, gap summary, and capture-manager ownership in the checklist item.
- Extend focused final submission checklist coverage to prove critical theme gaps block readiness while clean theme analysis still allows final readiness.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the final checklist gate logic with the focused final submission workflow action test.

Remaining after this slice:
- Continue strengthening final package evidence, submission packaging receipts, and the live opportunity discovery-to-response proof path.

### 2026-05-26 - Regenerated Section Win Theme Seeding

Status: implemented and verified.

Purpose: keep regenerated requirement-aware section drafts aligned with approved capture strategy after the initial proposal document draft is refreshed.

Changes in this slice:
- Load active win themes for the assigned opportunity when regenerating a requirement-aware proposal section draft.
- Add approved win-theme guidance to regenerated section draft content before the evaluator win angle and evidence checklist.
- Store regenerated section draft win theme IDs in document metadata and return them from the section draft action result.
- Extend focused proposal document coverage to prove regenerated section drafts include active win themes and preserve traceability metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice reuses the focused proposal documents action test because it exercises both initial proposal seeding and regenerated section drafting.

Remaining after this slice:
- Continue hardening final package readiness, win-theme consistency checks, and submission review gates.

### 2026-05-26 - Win Theme Response Draft Seeding

Status: implemented and verified.

Purpose: make generated proposal drafts carry active win themes so response package content starts from approved capture strategy rather than generic proof points alone.

Changes in this slice:
- Load active win themes for the assigned opportunity when seeding a new proposal document draft.
- Add an "Approved Win Themes To Weave In" response-plan section with theme statement, short version, type, priority, and supporting evidence.
- Store seeded win theme IDs in document metadata alongside seeded requirement IDs for traceability.
- Extend focused proposal document coverage to prove active win themes appear in generated draft text and metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies proposal draft seed content with the focused proposal documents action test.

Remaining after this slice:
- Continue hardening win-theme injection into regenerated section drafts and final review gates.

### 2026-05-26 - Response Package Draft Runtime Evidence

Status: implemented and verified.

Purpose: make generated standard response packages visible in workflow runtime/audit evidence instead of only creating proposal documents and compliance rows.

Changes in this slice:
- Record a `proposal_response_package` workflow transition after standard response package drafting completes.
- Link the workflow event directly to the generated compliance matrix, accepted requirements, proposal document rows, document rows, and document version.
- Preserve drafting behavior when workflow telemetry is unavailable so response generation is not blocked by audit persistence.
- Extend focused response-package coverage to assert runtime evidence links and metadata for the generated draft.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies response-package workflow evidence with the focused proposal documents action test.

Remaining after this slice:
- Continue hardening generated response quality, win-theme injection, and final package readiness evidence.

### 2026-05-26 - Discovered Document URL Intake Handoff

Status: implemented and verified.

Purpose: ensure scraped discovery document links are the URLs operators view and ingest into the RFP parser pipeline.

Changes in this slice:
- Prefer `opportunity.documentUrl` over portal/RFP page links for the opportunity detail page direct RFP link and source ingest controls.
- Keep the portal/RFP link fallback for opportunities that do not yet have a direct document URL.
- Extend opportunity document action coverage to prove source intake creates the discovered source document from `documentUrl`, not the portal page.

Verification:
- `npm run test -- __tests__/actions/opportunity-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the server-action intake source selection and applies a small page wiring change.

Remaining after this slice:
- Continue closing gaps between discovered RFP documents, requirements extraction, and response package generation.

### 2026-05-26 - Discovery Scrape Document URL Extraction

Status: implemented and verified.

Purpose: make live opportunity discovery carry usable RFP/tender document links from scraped portal pages instead of only saving the portal URL.

Changes in this slice:
- Extract likely PDF/DOC/DOCX/XLS/XLSX/ZIP document links from Firecrawl or browser-fallback markdown.
- Resolve relative document links against the discovered portal URL and strip fragments before persistence.
- Prefer links whose labels or URLs indicate RFP, tender, bid, solicitation, download, attachment, or terms-of-reference content.
- Store the selected document URL on `OpportunityInput.documentUrl` and in discovery metadata for auditability.
- Add focused discovery import coverage for a portal page containing multiple document links.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the document-link extraction behavior with mocked discovery services.

Remaining after this slice:
- Continue strengthening the discovery-to-RFP-intake bridge, especially automatic document download/parse handoff from discovered `documentUrl` values.

### 2026-05-26 - Submission Runtime Artifact Evidence Links

Status: implemented and verified.

Purpose: make production submission workflow events reconstructable from the recorded portal receipt back to submitted final artifact storage and source receipts.

Changes in this slice:
- Expand submission workflow runtime evidence links to include the raw receipt, namespaced submission receipt, artifact SHA-256, artifact storage path, and source document SHA-256.
- Preserve the full locked attachment receipt metadata on the workflow event.
- Extend focused submission workflow coverage to assert evidence links and metadata include the final artifact receipt chain.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the submission workflow runtime evidence payload only.

Remaining after this slice:
- Continue focused proof-path hardening until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Submission History Artifact Receipt Visibility

Status: implemented and verified.

Purpose: make submitted package history show the stored final artifact receipts that are already locked into submission attachments.

Changes in this slice:
- Add a pure submission attachment receipt formatter for file size, artifact hash, storage location, source freshness, approval, and lock receipts.
- Show receipt details and final artifact download links in the submission history attachment list.
- Preserve legacy attachment display by falling back to document title and storage path when newer receipt fields are absent.
- Add focused coverage for rich final artifact receipts and legacy attachment fallback formatting.

Verification:
- `npm run test -- __tests__/submissions/attachment-receipts.test.ts __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies receipt formatting plus the existing submission workflow receipt-locking path.

Remaining after this slice:
- Add audit explorer reconstruction proof from submitted package receipt back to final stored artifacts when the power budget allows.

### 2026-05-26 - RFP Parser Stored Hash Guard

Status: implemented and verified.

Purpose: prevent parse jobs from extracting requirements from corrupted or mismatched stored RFP bytes.

Changes in this slice:
- Pass the recorded RFP document `fileHash` into parser text extraction when stored text is not already available.
- Verify the fetched local, HTTP, storage-key, or Linode E3 bytes against the recorded SHA-256 before PDF/DOCX/HTML parsing or AI extraction.
- Preserve existing unreadable-document fallback behavior while allowing hash mismatch failures to stop the parse job explicitly.
- Add focused workflow coverage proving mismatched stored bytes fail before AI extraction.
- Add the parser workflow test to `wave9-discovery-to-submission-core` so the aggregate non-live path covers RFP parse integrity.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies parser integrity behavior and proof manifest wiring only.

Remaining after this slice:
- Continue closing discovery-to-submission integrity gaps with focused checks until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Opportunity Document Download Route Integrity Coverage

Status: implemented and verified.

Purpose: prove the RFP document download API surfaces scoped storage integrity failures cleanly and remains part of the aggregate proof lane.

Changes in this slice:
- Add focused API coverage for successful opportunity document downloads, authorization denials, and hash-mismatch conflict responses.
- Update the route comment to reflect server-side storage rather than local-only storage.
- Add `opportunity-document-download-route.test.ts` to `wave9-discovery-to-submission-core`.
- Add the route proof artifact to the wave9 expected artifact list.

Verification:
- `npm run test -- __tests__/api/opportunity-document-download-route.test.ts __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice verifies route behavior and proof manifest wiring only.

Remaining after this slice:
- Continue adding focused proof for discovery-to-submission integrity until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - RFP Document Read Integrity Guard

Status: implemented and verified.

Purpose: prevent stored RFP documents from being served or parsed if the bytes no longer match the recorded download hash.

Changes in this slice:
- Verify downloaded RFP bytes against `fileHash` when reading from Linode E3 or legacy local storage.
- Preserve a 409 `OpportunityDocumentIntegrityError` for scoped route callers when stored bytes do not match the recorded hash.
- Apply hash verification to document download serving and later Docling extraction reads.
- Add focused coverage for rejecting mismatched stored bytes before serving a scoped opportunity document.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets RFP document read integrity with one focused service test file and whitespace validation.

Remaining after this slice:
- Add route-level coverage for the opportunity document download endpoint and include it in the aggregate proof lane.

### 2026-05-26 - Proof Lane Artifact Download Coverage

Status: implemented and verified.

Purpose: keep the aggregate discovery-to-submission proof lane aligned with the final artifact retrieval guard.

Changes in this slice:
- Add `documents-final-artifact-route.test.ts` to `wave9-discovery-to-submission-core`.
- Add the final artifact route proof artifact to the wave9 expected artifact list.
- Extend manifest coverage so the aggregate scenario asserts this route guard remains included.

Verification:
- `npm run test -- __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- The aggregate proof scenario itself remains intentionally unrun while on battery. This slice only verifies manifest wiring.

Remaining after this slice:
- Run `wave9-discovery-to-submission-core` when power allows and use failures to drive the next remediation chunks.

### 2026-05-26 - Submission Attachment Live Source Lock

Status: implemented and verified.

Purpose: prevent a selected submission attachment from being locked after the final checklist if its artifact receipt no longer matches the live document.

Changes in this slice:
- Refetch selected proposal documents with title, content, plain text, and current version before submission persistence.
- Recompute the live source hash during submission attachment locking.
- Require selected final artifact receipts to match the live document source version and hash before inserting the submission record.
- Preserve stored approval/source receipt metadata on locked submission attachments.
- Add focused coverage for a stale selected attachment after checklist success.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets submission attachment locking with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue closing discovery-to-submission integrity gaps with focused checks until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Final Checklist Live Source Freshness

Status: implemented and verified.

Purpose: prevent the final submission checklist from passing artifacts whose source receipts no longer match the live document.

Changes in this slice:
- Load document `plainText` and `currentVersion` with final checklist proposal documents.
- Hash the live document title, structured content, and plain text during checklist evaluation.
- Require approved final artifact source version and source hash to match the live document before the artifact gate passes.
- Return an explicit stale-artifact blocker directing operators to re-render the current document version.
- Add focused coverage for stale final artifacts after a document version change.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets final checklist source freshness with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue closing the discovery-to-submission path with focused remediation until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Final Artifact Download Freshness Guard

Status: implemented and verified.

Purpose: prevent final artifact downloads from streaming stale or unapproved stored objects after document source changes.

Changes in this slice:
- Load the current document source version and content when resolving final artifact downloads.
- Require approved final artifacts to include approval metadata and source freshness receipts before object storage access.
- Require rendered artifact previews to match the current document source before object storage access.
- Reject stale or incomplete artifact receipts with a 409 re-render response before downloading from Linode E3.
- Add focused API coverage for approved download success, stale receipt rejection, and missing approval receipt rejection.

Verification:
- `npm run test -- __tests__/api/documents-final-artifact-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets final artifact retrieval with one focused API test file and whitespace validation.

Remaining after this slice:
- Continue tightening final checklist freshness against live document content, then run `wave9-discovery-to-submission-core` when power allows.

### 2026-05-26 - Discovery-to-Submission Proof Scenario

Status: implemented and verified.

Purpose: make the non-live proof harness explicitly represent the core journey from opportunity discovery through final submission gates.

Changes in this slice:
- Add `wave9-discovery-to-submission-core` as an aggregate platform proof scenario.
- Route the scenario through focused tests for opportunity discovery/import, document discovery, RFP intake, requirements, response package drafting, final artifact readiness, final checklist, submission dispatch, and submission scoping.
- Record expected proof artifacts for each covered test lane.
- Extend manifest coverage so the aggregate scenario remains uniquely addressable.

Verification:
- `npm run test -- __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- The aggregate proof scenario itself was not executed while on battery. Only the manifest test and whitespace validation were run in this slice.

Remaining after this slice:
- Execute `wave9-discovery-to-submission-core` when power allows, then use failures to drive the next remediation chunks.

### 2026-05-26 - Submission Mutation Authority Preflight

Status: implemented and verified.

Purpose: prevent assigned-but-unauthorized users from changing submitted package status, outcome, or receipt confirmation state.

Changes in this slice:
- Require proposal manager or executive submission authority before direct submission status updates.
- Require the same submission authority before recording win/loss/withdrawn/no-award outcomes.
- Require explicit correction workflow authority before confirming a post-dispatch submission receipt.
- Add focused coverage that unauthorized mutation attempts stop before submission row reads or writes.

Verification:
- `npm run test -- __tests__/actions/submissions-scope.test.ts __tests__/actions/submission-correction-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets submission mutation authority with two focused action test files and whitespace validation.

Remaining after this slice:
- Continue hardening submission artifact retrieval and end-to-end discovery-to-submission proof.

### 2026-05-26 - Final Submission Artifact Freshness Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from accepting a stored artifact that lacks approval or source freshness receipts.

Changes in this slice:
- Require final submission checklist artifacts to include storage, approval, source document version, and source content hash receipts.
- Require selected submission attachments to carry the same approval and source freshness receipts before locking them into a submission record.
- Snapshot artifact approval and source freshness metadata on submission attachments.
- Surface final artifact source freshness metadata in proposal document summaries.
- Add focused coverage for missing final artifact freshness and attachment receipt metadata.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final submission artifact readiness with two focused action test files and whitespace validation.

Remaining after this slice:
- Continue hardening submission package retrieval, correction/withdrawal compensation, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Final Artifact Stale Render Guard

Status: implemented and verified.

Purpose: prevent an obsolete rendered proposal artifact from being approved after the source document changes.

Changes in this slice:
- Store the source document version and source content hash on rendered final artifact manifests.
- Require final artifact approval to match the current document version and content hash.
- Block approval with a re-render error when a late document edit makes the rendered artifact stale.
- Add focused final-artifact coverage for stale render rejection while preserving normal render, approval, signoff, and reopen behavior.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final artifact readiness with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue hardening final submission checklist coverage, submission artifact retrieval, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Accepted-Only Response Package Seeding

Status: implemented and verified.

Purpose: prevent unaccepted or draft-only requirements from leaking into automatically generated response-package draft content.

Changes in this slice:
- Add an accepted-only requirement seeding option for proposal document creation.
- Use accepted-only seeding when `createAndDraftStandardProposalSet` creates standard response-package documents.
- Preserve standalone proposal document creation behavior, which can still seed applicable document-type requirements for planning.
- Mark generated document metadata with the requirement seed policy and seeded requirement IDs.
- Add focused coverage with one accepted and one unaccepted same-type requirement to prove only the accepted requirement appears in package draft seed content.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets response-package draft relevance with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue hardening response-generation workflow visibility, final artifact readiness, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Response Package Compliance Link Refresh

Status: implemented and verified.

Purpose: ensure generated response-package compliance entries trace to the proposal document and section after requirements are linked.

Changes in this slice:
- Refetch accepted requirements after standard proposal sections are linked.
- Build or update compliance matrix entries from fresh requirement rows instead of stale pre-link rows.
- Preserve response-package drafting behavior while ensuring `responseDocumentId` and `responseReference` are available for compliance traceability.
- Update focused coverage so an initially unlinked accepted requirement creates a compliance row with the generated response document and section reference.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets response-package traceability with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue hardening response-generation workflow visibility, final artifact readiness, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Legacy Document Classifier Token Matching

Status: implemented and verified.

Purpose: prevent the legacy RFP document discovery service from misclassifying `platform` URLs as form documents.

Changes in this slice:
- Replace raw substring URL checks with token-based document type matching in `discoverDocuments`.
- Preserve amendment, specification, evaluation, form, and RFP classification behavior for delimited URL keywords.
- Add focused coverage for `Records-Platform-RFP.pdf` being stored as an RFP document.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets legacy document discovery classification with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening parse retry coverage and response-generation readiness after RFP intake.

### 2026-05-26 - Parse Queue Remediation for Missing Workspace

Status: implemented and verified.

Purpose: prevent downloaded RFPs from silently stopping after storage when parser queueing cannot resolve a default workspace.

Changes in this slice:
- Record `parse_queue_failed` ingest workflow state when a downloaded document cannot be queued because the user has no default workspace.
- Create the existing remediation task for proposal/capture follow-up instead of only logging the condition.
- Preserve downloaded-document success semantics while making the parse-queue gap operationally visible.
- Add focused coverage for the missing-workspace queue path.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets parser queue remediation visibility with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening document classification, parse retry coverage, and response-generation readiness after RFP intake.

### 2026-05-26 - Post-Download RFP Size Guard

Status: implemented and verified.

Purpose: prevent oversized RFP payloads from entering storage, Docling extraction, or parser queueing when a source omits or understates `content-length`.

Changes in this slice:
- Re-check downloaded byte length after reading the response body.
- Fail oversized downloads before hashing, object storage upload, Docling processing, or parser job creation.
- Preserve existing failure status and ingest workflow recording behavior.
- Add focused coverage for an oversized response with no `content-length` header without allocating a large test buffer.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets downloaded RFP intake safety with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening document classification, parse queue recovery, and response-generation readiness after RFP intake.

### 2026-05-26 - Primary Portal Browser Fallback for Document Discovery

Status: implemented and verified.

Purpose: keep RFP document discovery productive when Firecrawl cannot scrape a primary portal or returns no downloadable document links.

Changes in this slice:
- Add Playwright/headless browser fallback for primary portal document discovery using the configured stealth scraper service defaulting to `http://84.247.181.100:3003`.
- Reuse existing primary-portal link extraction and persistence behavior for browser-discovered document links.
- Avoid browser fallback calls when Firecrawl link extraction already finds documents.
- Tighten URL document-type classification so words like `platform` no longer get misclassified as `form`.
- Add focused service coverage for blocked Firecrawl recovery and no-extra-browser-call Firecrawl link extraction.

Verification:
- `npm run test -- __tests__/services/document-discovery-agent.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets primary portal document discovery recovery with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening the discovery-to-response path, especially document download/intake resilience and response generation readiness after discovered source persistence.

### 2026-05-26 - Compliance Governance Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from inspecting compliance entry or matrix state before approval, waiver, bulk approval, final lock, rejection, or reopen authority is enforced.

Changes in this slice:
- Require compliance entry authority before entering the entry workflow transaction for all non-submit actions.
- Require compliance matrix authority before entering the matrix workflow transaction for all non-submit matrix actions.
- Preserve submit-for-review behavior for assigned writers and preserve existing workflow gates for authorized compliance/proposal reviewers.
- Add focused coverage that unauthorized entry approval and matrix final-lock attempts stop before transactions, DB reads, or mutations.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts __tests__/api/compliance-workflow-routes.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets compliance governance authority preflight behavior with focused action/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate discovery, response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Unsupported Claim Waiver Authority Check

Status: implemented and verified.

Purpose: prevent unsupported proposal claims from being accepted as-is unless the authenticated actor has proposal, capture, or compliance risk authority.

Changes in this slice:
- Require `proposal_manager`, `capture_manager`, `compliance_officer`, or admin authority before loading claim state for waiver actions.
- Preserve evidence-addition, rewrite, removal, start, and reopen remediation paths for assigned opportunity response workers.
- Stop unauthorized claim waiver attempts before DB reads, claim updates, workflow runtime recording, or task projection.
- Add focused coverage for denied claim waivers and authorized proposal-manager waivers.

Verification:
- `npm run test -- __tests__/actions/claim-remediation.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets unsupported-claim risk acceptance with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Win Strategy Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from approving competitive intelligence, win themes, theme injection text, or consistency signoff before proposal strategy authority is enforced.

Changes in this slice:
- Require `proposal_strategist`, `capture_manager`, `proposal_manager`, or admin authority before terminal competitive-intelligence approval.
- Require the same strategy authority before terminal win-theme approval/archive, theme injection accept/modify/reject, and theme consistency approval.
- Preserve non-terminal strategy review, stale-flagging, activation, gap-flagging, and reopen behavior for assigned opportunity users.
- Add focused coverage that unauthorized terminal win-theme decisions stop before DB reads, mutations, workflow runtime recording, or task projection.

Verification:
- `npm run test -- __tests__/actions/competitive-win-theme-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets win strategy authority preflight behavior with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Submission Correction Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from inspecting or mutating submitted proposal packages before post-dispatch correction and withdrawal authority is enforced.

Changes in this slice:
- Require submission authority before loading submitted package state for `apply_correction`.
- Require submission authority before loading submitted package state for `withdraw`.
- Preserve existing receipt, attachment, opportunity compensation, and runtime task behavior for authorized correction and withdrawal actions.
- Add focused coverage that unauthorized correction and withdrawal attempts stop before database reads or mutations.

Verification:
- `npm run test -- __tests__/actions/submission-correction-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets submission correction authority preflight behavior with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Pricing Approval Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from inspecting or mutating cost element and pricing package approval state before the pricing authority gate is enforced.

Changes in this slice:
- Require pricing approval authority before loading cost elements for approval.
- Require pricing approval authority before loading pricing package state for lock or reopen actions.
- Preserve existing status, BOE, approved-cost, and critical alignment gates for authorized pricing approvers.
- Add focused coverage that unauthorized pricing approval and lock attempts stop before database reads or mutations.

Verification:
- `npm run test -- __tests__/actions/pricing-approval-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets pricing authority preflight behavior with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Reusable Content Governance Authority Check

Status: implemented and verified.

Purpose: prevent reusable response-library content from being approved as current or archived unless the authenticated actor has content-governance or proposal-management authority.

Changes in this slice:
- Require `content_governor`, `proposal_manager`, or admin authority for terminal reusable-content `approve_current` and `archive` actions before snippet lookup or analytics mutation.
- Preserve mark-review-needed, mark-stale, and reopen-review behavior for visible organization snippets.
- Stop unauthorized reusable-content approval before DB reads, analytics updates/inserts, workflow runtime recording, or task projection.
- Add focused coverage for non-authority reusable-content approval attempts.

Verification:
- `npm run test -- __tests__/actions/content-governance-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets reusable content governance authority with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Customer Clarification Authority Check

Status: implemented and verified.

Purpose: prevent customer-facing clarification approval and submission from changing requirement clarification metadata unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Require `proposal_manager`, `capture_manager`, or admin authority for clarification `approve` and `submit` actions before requirement lookup or mutation.
- Preserve draft, approval-request, answer-recording, incorporation, and reopen behavior for assigned opportunity users.
- Stop unauthorized customer-facing clarification submission before DB reads, metadata updates, workflow runtime recording, or task projection.
- Add focused coverage for non-authority clarification submission attempts.

Verification:
- `npm run test -- __tests__/actions/clarification-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets customer-facing clarification authority with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Opportunity Digest Authority Check

Status: implemented and verified.

Purpose: prevent opportunity digest delivery workflows from evaluating saved-search matches and queueing notifications unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context for opportunity digest execution.
- Preserve the existing self-only digest guard while adding `proposal_manager`, `capture_manager`, or admin authority before saved-search reads.
- Stop unauthorized digest attempts before saved-search evaluation, opportunity matching, notification queueing, or workflow runtime recording.
- Add focused coverage for non-authority digest attempts.

Verification:
- `npm run test -- __tests__/actions/opportunity-digest.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets opportunity-digest authority with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Final Submission Authority Check

Status: implemented and verified.

Purpose: prevent final submission recording from inserting submission receipts and marking opportunities submitted unless the authenticated actor has proposal or executive authority.

Changes in this slice:
- Require `proposal_manager`, `executive`, or admin authority before running final submission readiness workflows or database mutations.
- Stop unauthorized submission attempts before opportunity lookup, pre-submission audit, final checklist evaluation, submission insert, opportunity status update, or runtime transition.
- Preserve existing audit, checklist, required-attachment, and final-artifact gates for authorized submitters.
- Add focused coverage for unauthorized submission recording and update submission auth/scope mocks for role-aware authorization.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts __tests__/actions/submissions-scope.test.ts __tests__/actions/submissions-auth.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final-submission authority with focused submission action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - RFP Parse Reject Authority Check

Status: implemented and verified.

Purpose: prevent terminal RFP parse rejection from changing parsing job and document workflow metadata unless the authenticated actor has proposal or operations authority.

Changes in this slice:
- Resolve role-bearing user context for explicit parse rejection.
- Require `proposal_manager`, `operations`, or admin authority before opening the parse workflow transaction.
- Throw the shared workflow authority-denied error so the existing parse API returns a 403 denial.
- Preserve retry, cancel, and manual extraction behavior on the existing tenant-context path.
- Add focused coverage for unauthorized parse rejection before mutation.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/api/rfp-parse-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets parse-reject authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - RFP Amendment Impact Authority Check

Status: implemented and verified.

Purpose: prevent amendment impact processing from changing RFP document metadata, requirement workflow state, or impact-review tasks unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context before applying RFP amendment supersession or supplement impact.
- Require `proposal_manager`, `capture_manager`, or admin authority before opening the amendment-impact transaction.
- Return a non-mutating authority failure for writer or other non-authority roles.
- Preserve existing amendment metadata updates, requirement impact review projection, and runtime task creation for authorized reviewers.
- Add focused coverage for unauthorized amendment impact attempts.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/api/rfp-parse-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets amendment-impact authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Parser Confidence Review Authority Check

Status: implemented and verified.

Purpose: prevent parser confidence review acceptance or correction requests from mutating RFP document review metadata unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context in `reviewRfpParseConfidence`.
- Require `proposal_manager`, `capture_manager`, or admin authority before loading or updating parser review metadata.
- Return a non-mutating authority failure when a writer or other non-authority role attempts parser confidence review.
- Preserve completed-parse gating and existing review workflow/task recording for authorized reviewers.
- Add focused coverage for unauthorized parser confidence review.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/api/rfp-parse-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets parser confidence-review authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Requirement Acceptance Authority Check

Status: implemented and verified.

Purpose: prevent accepted requirements from projecting proposal writing tasks unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context in `transitionRequirementWorkflow`.
- Require `proposal_manager`, `capture_manager`, or admin authority before accepting a requirement.
- Stop unauthorized acceptance before opening the transaction, creating proposal tasks, updating requirement workflow metadata, or writing task activity.
- Keep reject and reopen behavior on the existing assigned-opportunity path.
- Add focused coverage for unauthorized acceptance and mock `revalidatePath` in the workflow test harness.

Verification:
- `npm run test -- __tests__/actions/requirements-workflow.test.ts __tests__/actions/proposal-task-workflow.test.ts __tests__/api/rfp-requirements-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets requirement acceptance authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - RFP Parse Authority Denial Response

Status: implemented and verified.

Purpose: make explicit RFP parse workflow actions return 403 when workflow authority is denied instead of surfacing those denials as generic 500 parse errors.

Changes in this slice:
- Map `WorkflowAuthorityDeniedError` from `transitionRfpParseWorkflow` to a generic 403 `Forbidden` response.
- Preserve existing parse queue, retry, manual extraction, legacy proxy, and internal-error behavior for non-authority paths.
- Add focused route coverage for authority-denied explicit parse workflow actions.

Verification:
- `npm run test -- __tests__/api/rfp-parse-route.test.ts __tests__/actions/rfp-parse-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets RFP parse workflow authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate discovery, intake, or response workflow state without corresponding authority checks or clear 403 mappings.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Scraper Source Delete Authority Check

Status: implemented and verified.

Purpose: prevent broad scraper-operator access from deleting discovery sources directly through the scraper batch API.

Changes in this slice:
- Require `operations` or `admin` scraper access before batch `delete` fetches or deletes scraper sources.
- Preserve broader scraper-operator access for non-destructive batch run/enable/disable requests that flow through workflow guards.
- Add focused route coverage for denied scraper-operator deletes and allowed operations deletes.

Verification:
- `npm run test -- __tests__/api/scraper-batch-route.test.ts __tests__/api/scraper-run-routes.test.ts __tests__/actions/scraper-workflows.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets destructive scraper source deletion authority with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate discovery, intake, or response workflow state without corresponding authority checks.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Live Import Execution Authority Check

Status: implemented and verified.

Purpose: prevent the direct live import execution API from bypassing the import governance workflow's approval-authority requirement while preserving non-mutating preview sandbox behavior.

Changes in this slice:
- Resolve full user context, including roles, in the import execute route.
- Require `import_approver` authority, or admin authority through the shared helper, before live import mutation.
- Keep sandbox/preview mode available to authenticated tenant users without import approval authority because it does not mutate records.
- Return a generic 403 `Forbidden` response for unauthorized live import execution.
- Extend route coverage for unauthenticated, no-organization, preview-only, unauthorized-live, and authorized-live import execution paths.

Verification:
- `npm run test -- __tests__/api/import-execute-route.test.ts __tests__/api/import-rollback-route.test.ts __tests__/actions/import-governance-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets live import execution authority with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate governed workflow state without going through the corresponding authority checks.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Direct Import Rollback Authority Check

Status: implemented and verified.

Purpose: prevent the direct import rollback API from bypassing the import governance workflow's approval-authority requirement for destructive rollbacks.

Changes in this slice:
- Resolve full user context, including roles, in the import rollback route.
- Require `import_approver` authority, or admin authority through the shared helper, before calling `rollbackImport`.
- Return a generic 403 `Forbidden` response for unauthorized rollback attempts without exposing required role details.
- Add route coverage for denied and authorized rollback requests.

Verification:
- `npm run test -- __tests__/api/import-rollback-route.test.ts __tests__/actions/import-governance-workflow.test.ts __tests__/api/import-execute-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets direct import rollback authority with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate governed workflow state without going through the corresponding authority checks.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Scraper Run Authority Denial Responses

Status: implemented and verified.

Purpose: make individual scraper run and cancel API routes return explicit 403 responses when the workflow authority layer denies the operation instead of surfacing authority failures as generic 500 errors.

Changes in this slice:
- Map manual scraper run `WorkflowAuthorityDeniedError` failures to generic 403 `Forbidden` responses.
- Map scraper job cancellation authority denials to generic 403 `Forbidden` responses.
- Add focused route coverage for run and cancel authority denial responses.

Verification:
- `npm run test -- __tests__/api/scraper-run-routes.test.ts __tests__/api/scraper-batch-route.test.ts __tests__/actions/scraper-workflows.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets scraper run/cancel API authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue checking API routes that wrap authority-enforced workflows and currently collapse authorization denials into generic success/error envelopes.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Scraper Batch Authority Denial Response

Status: implemented and verified.

Purpose: make scraper batch operations return an explicit 403 when the workflow authority layer denies a bulk run/enable/disable operation instead of hiding the denial inside a 200 batch result.

Changes in this slice:
- Propagate `WorkflowAuthorityDeniedError` out of per-source scraper batch processing.
- Map scraper batch workflow authority denials to a generic 403 `Forbidden` response.
- Preserve ordinary per-source workflow failures as batch result entries for recoverable operational errors.
- Add route coverage for authority-denied and non-authority scraper batch failures.

Verification:
- `npm run test -- __tests__/api/scraper-batch-route.test.ts __tests__/actions/scraper-workflows.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets scraper batch API authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue checking API routes that wrap authority-enforced workflows and currently collapse authorization denials into generic success/error envelopes.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Actor-Scoped Opportunity Import Telemetry

Status: implemented and verified.

Purpose: keep opportunity import history and discovery warning telemetry scoped to the actor or service assignee that ran the import instead of mixing import records globally.

Changes in this slice:
- Scope opportunity import history reads to the current opportunity user.
- Persist `importedBy` when spreadsheet, scraper-export, and SearXNG discovery imports create import records.
- Finalize import records only for the same actor that created the import record.
- Pass the scheduled discovery assignee through import creation/finalization so service-run warning telemetry stays attached to that assignee.
- Apply the same owner-scoped import-history contract to the opportunity repository helper.
- Add focused coverage for actor-scoped import history, current-user import record creation, explicit service-run owners, and discovery import record finalization.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/actions/opportunities.test.ts __tests__/actions/import-opportunities-auth.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets opportunity import/discovery telemetry ownership with focused action tests and whitespace validation.

Remaining after this slice:
- Continue scanning opportunity import/export and discovery surfaces for direct tenant-wide reads or writes that should be actor-scoped.
- Continue closing gaps between discovery results, RFP intake, and response-generation workflows.

### 2026-05-26 - Compliance API Authority Denial Responses

Status: implemented and verified.

Purpose: make compliance workflow API routes return explicit 403 responses for server-enforced authority failures instead of generic 500 workflow failures.

Changes in this slice:
- Raise the shared `WorkflowAuthorityDeniedError` from compliance workflow role gates.
- Map compliance matrix workflow authority denials to a generic 403 without leaking required role names.
- Map compliance entry workflow authority denials to a generic 403 without leaking required role names.
- Add focused API coverage for matrix and entry authority denial responses while preserving non-authority failures as workflow errors.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts __tests__/api/compliance-workflow-routes.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets compliance API authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue adding explicit 403 mapping to any API route that directly exposes hardened workflow server actions.
- Continue closing direct approval/status mutation surfaces outside the final-mile workflow.

### 2026-05-26 - Document Authoring Ready Approval Authority Checks

Status: implemented and verified.

Purpose: prevent the authoring workflow from marking proposal documents approved through `mark_ready` without proposal approval authority.

Changes in this slice:
- Require proposal or capture authority before authoring `mark_ready` can set document/proposal status to approved.
- Require the same authority before authoring `reopen` clears approval fields.
- Require linked requirements to be addressed, compliant, or not applicable before authoring `mark_ready` can approve a proposal document.
- Preserve drafting, persistence, review submission, and AI accept/reject transitions for writer sessions.
- Add focused denial, readiness-blocker, and authorized-ready coverage for the authoring workflow.

Verification:
- `npm run test -- __tests__/actions/document-authoring-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets authoring ready-approval authority with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct approval/status mutation surfaces outside the hardened final-mile workflows.
- Add explicit 403 response mapping for API routes that surface authority-denied workflow errors.

### 2026-05-26 - Proposal Document Direct Approval Authority Checks

Status: implemented and verified.

Purpose: prevent direct proposal document status updates from bypassing finalization approval workflows and marking documents approved/final through assignment scope alone.

Changes in this slice:
- Require proposal approval authority before direct single-document transitions to approved or final status.
- Require proposal approval authority before bulk status transitions to approved or final status.
- Keep drafting and review status updates on the existing assigned-opportunity path.
- Preserve linked-requirement readiness checks for final statuses and add bulk readiness checks before bulk final updates.
- Add focused denial coverage for unauthorized direct and bulk proposal document approval attempts.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets direct proposal document approval authority with focused action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct approval/status mutation surfaces outside the final-mile workflow.
- Add explicit 403 response mapping for API routes that surface authority-denied workflow errors.

### 2026-05-26 - Compliance Workflow Server Authority Checks

Status: implemented and verified.

Purpose: prevent compliance entry approvals, waivers, bulk approvals, final matrix locks, and privileged reopens from relying on tenant membership alone.

Changes in this slice:
- Enforce compliance/proposal authority roles before entry approval, rejection, waiver, and reopen transitions mutate compliance state.
- Enforce compliance authority before bulk ready-entry approval, and compliance/proposal authority before final matrix lock and privileged matrix reopen transitions.
- Preserve submit-for-review as a tenant-scoped non-approval flow so writers can still advance evidence for review.
- Add focused denial coverage for unauthorized entry approval and final matrix lock attempts.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets compliance workflow authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue scanning non-workflow approval surfaces such as direct proposal document status updates.
- Surface authorization failures as explicit 403 responses in compliance API routes instead of generic workflow failures.

### 2026-05-26 - Review Waiver Server Authority Checks

Status: implemented and verified.

Purpose: prevent review finding waivers from trusting a client-supplied authority role.

Changes in this slice:
- Enforce the shared server-side authority-role helper before review findings can be waived.
- Preserve waiver runtime metadata while ensuring the claimed authority role belongs to the authenticated session.
- Add focused forged-authority and authorized-waiver coverage for review package transitions.

Verification:
- `npm run test -- __tests__/actions/review-package-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets review waiver authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue scanning for privileged exception workflows that still accept client-supplied authority metadata.
- Surface authority denial states in review and command-center work items where the UI does not already distinguish authorization failure.

### 2026-05-26 - Import Governance Server Authority Checks

Status: implemented and verified.

Purpose: prevent import execution approval, rollback, and cancellation from trusting a client-supplied import authority role.

Changes in this slice:
- Enforce the shared server-side authority-role helper in import approval, rollback, and cancel transitions.
- Preserve role-aware user context through rollback execution so destructive import compensation remains scoped and auditable.
- Add focused forged-authority coverage for import execution approval.

Verification:
- `npm run test -- __tests__/actions/import-governance-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets import governance authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Apply the shared authority helper to review waivers and any remaining privileged exception workflows.
- Surface import governance blockers in the operational inbox where they are not already projected.

### 2026-05-26 - Pricing Approval Server Authority Checks

Status: implemented and verified.

Purpose: prevent cost element approval and final pricing package lock/reopen from trusting a client-supplied pricing authority role.

Changes in this slice:
- Enforce the shared server-side authority-role helper in cost element pricing approval.
- Enforce the shared authority helper in pricing package lock and reopen transitions.
- Preserve existing workflow authority-policy metadata while ensuring it reflects a role the session actually holds.
- Add focused forged-authority coverage for cost element approval and package lock.

Verification:
- `npm run test -- __tests__/actions/pricing-approval-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets pricing authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue applying the same role-authority helper to import governance, review waivers, and any remaining authorityRole workflow surfaces.
- Connect pricing lock status into final submission readiness and command-center blockers where not already projected.

### 2026-05-26 - Final-Mile Server Authority Checks

Status: implemented and verified.

Purpose: prevent final artifact approval, executive signoff, artifact reopen, submission correction, and submission withdrawal from trusting a client-supplied authority role.

Changes in this slice:
- Add normalized session role capture to `requireUserContext`.
- Add reusable authority-role checks with admin bypass and executive/legal alias handling.
- Enforce server-side authority in final artifact approve, signoff, and reopen transitions.
- Enforce server-side authority in submission correction apply and withdrawal transitions.
- Add focused forged-authority tests for final artifact approval and submission correction.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/submission-correction-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets authority enforcement in final-mile workflows with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue applying the same role-authority helper to pricing, import governance, review waiver, and other authorityRole workflows.
- Surface authority denial states in inline approval cards and command-center work items.

### 2026-05-26 - Submission Attachments Bind Stored Artifacts

Status: implemented and verified.

Purpose: ensure recorded submissions point to the exact approved final artifact receipt instead of hashing mutable document content at dispatch time.

Changes in this slice:
- Replace submission attachment content hashing with final artifact manifest binding.
- Persist artifact filename, MIME type, size, download URL, Linode E3 storage path, bucket, key, ETag, endpoint, and SHA-256 hash into each submission attachment.
- Fail submission recording if a selected final package document lacks an approved stored final artifact manifest.
- Extend submission attachment types and focused submission workflow tests for stored artifact receipts.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets submission attachment evidence binding and used the focused submission workflow test plus whitespace validation.

Remaining after this slice:
- Surface stored artifact receipt details in the submission history UI.
- Add audit explorer reconstruction proof from submitted package receipt back to final stored artifacts when the power budget allows.

### 2026-05-26 - Final Artifact Object Storage Receipt

Status: implemented and verified.

Purpose: make production render artifacts durable and auditable before they can satisfy final submission readiness.

Changes in this slice:
- Require Linode E3 object storage before running final artifact renders, avoiding expensive render work when final artifact storage is not configured.
- Upload rendered final artifact bytes to Linode E3 and persist storage path, bucket, key, ETag, endpoint, SHA-256 hash, and download route in artifact metadata.
- Add an authenticated final-artifact download route that reads the stored object, verifies the SHA-256 hash, and enforces owner or assigned-opportunity document access.
- Require final submission checklist artifacts to include an object-storage receipt, not just a hash.
- Preserve storage receipt fields in proposal document summaries.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final-artifact storage and final-checklist readiness gates with focused tests.

Remaining after this slice:
- Continue wiring the submission concierge to surface the stored final artifact receipt and signed artifact evidence inline.
- Add route-level final artifact download tests and authenticated browser proof when the power budget allows.

### 2026-05-26 - Submission Page Scoped Data Loading

Status: implemented and verified.

Purpose: prevent the submission tracking page from bypassing assigned-opportunity scoping when loading proposal documents and submission history.

Changes in this slice:
- Replace direct submission-page database reads by raw opportunity ID with scoped `getOpportunity`, `getProposalDocuments`, and `getSubmissionsByOpportunity` action calls.
- Preserve the submission client contract while taking proposal document titles and submission records from action-level transformers.
- Mock Next route revalidation in the focused submission scope test so mutation scoping can be verified outside the Next runtime.

Verification:
- Targeted source check found no direct DB/Drizzle reads left in `frontend/app/(app)/opportunities/[id]/submission/page.tsx`.
- `npm run test -- __tests__/actions/submissions-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a focused page data-boundary slice covered by source verification, existing action scoping tests, and whitespace validation.

Remaining after this slice:
- Continue connecting final submission UI to render artifact, signature, approval, and receipt blockers.
- Add broader authenticated submission-page browser proof when the power budget allows.

### 2026-05-26 - Command Center Claim Blocker Projection

Status: implemented and verified.

Purpose: make opportunity command-center readiness expose unresolved high-risk proposal claims before final submission workflows are run.

Changes in this slice:
- Load unresolved high-risk `claimAnalysis` rows directly into the opportunity command-center projection under assigned-opportunity scope.
- Project blocking claims as critical command-center work items with document deep links and evidence/claim ownership.
- Make readiness labels hard-block whenever any blocker exists, even if the numeric score would otherwise be in watch range.
- Add focused command-center coverage for open versus resolved high-risk claims.

Verification:
- `npm run test -- __tests__/actions/work-items-command-center.test.ts __tests__/work-items/projections.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a focused command-center/readiness projection slice covered by affected projection tests and whitespace validation.

Remaining after this slice:
- Continue connecting command-center readiness to other final-gate blockers such as signature, render artifact, and submission receipt state.
- Add authenticated browser proof for the command center when the power budget allows.

### 2026-05-26 - Final Submission Claim Evidence Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from passing while high-risk unsupported proposal claims remain unresolved.

Changes in this slice:
- Add claim-analysis state to the final submission checklist under the same assigned-opportunity scope as documents and compliance matrices.
- Add a required evidence gate that blocks unresolved high-risk claims and points operators to the first blocking claim.
- Map the new evidence checklist category into the existing pre-submission checklist category model.
- Repair the submission workflow test harness so route revalidation is mocked during focused submission tests.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a focused final-gate/evidence-claim blocker slice covered by the directly affected workflow tests and whitespace validation.

Remaining after this slice:
- Continue auditing evidence matrix coverage and claim remediation handoff into writer tasks.
- Add broader authenticated discovery-to-receipt proof when the power budget allows.

### 2026-05-26 - Final Submission Compliance Gap Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from passing on a locked/approved compliance matrix that still reports unresolved or mandatory compliance gaps.

Changes in this slice:
- Tighten the final submission checklist compliance item to require approval, zero unresolved compliance counts, and 100% mandatory compliance.
- Return explicit blocker messages when a locked matrix still has unresolved gaps or incomplete mandatory compliance.
- Add focused workflow coverage proving a stale final matrix cannot make the opportunity submission-ready.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow submission readiness gate covered by the affected workflow test file and whitespace validation.

Remaining after this slice:
- Continue auditing final submission and compliance lock workflows for stale matrix counters or waiver-authority gaps.
- Add broader browser proof for discovery-to-receipt once power budget allows.

### 2026-05-26 - RFP Upload Starts Real Parse Jobs

Status: implemented and verified.

Purpose: make browser/API RFP upload actually start the queued parser instead of returning a "Parsing started" success response while leaving the job idle.

Changes in this slice:
- Wire the local/E3-backed RFP upload route to `processRfpParsingJob` after the document and parsing job are persisted.
- Preserve Python fallback behavior for validated uploads when local object storage is absent.
- Add focused route assertions that invalid, unauthorized, out-of-scope, and proxied uploads do not start local parsing.
- Add focused route coverage that E3-backed uploads start the real parser with tenant context.

Verification:
- `npm run test -- __tests__/api/rfp-upload-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow upload-to-parse wiring slice covered by the affected API route tests and whitespace validation.

Remaining after this slice:
- Continue auditing discovery-to-RFP intake so discovered source documents can reach the same E3-backed parser path without manual re-upload.
- Review stale docs that still describe the parse route as simulated.

### 2026-05-26 - Empty RFP Text Extraction Failure Gate

Status: implemented and verified.

Purpose: prevent failed or empty RFP text extraction from flowing into AI parsing and creating unreliable parse, requirements, or compliance state.

Changes in this slice:
- Remove stale simulated-extraction comments from the active RFP parsing job.
- Normalize cached and newly extracted RFP text before parsing.
- Fail the parsing job and document with audit metadata when extraction produces no readable text.
- Add focused workflow coverage that proves blank extraction does not call `parseRFPWithAI`.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow parser failure-gate slice covered by the affected workflow test file and whitespace validation.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether extraction errors should expose source-specific remediation hints in operator UI.

### 2026-05-26 - Proposal Task Workflow Revalidation

Status: implemented and verified.

Purpose: keep proposal task and opportunity workflow views fresh after task creation, updates, deletion, compliance-task generation, assignment, and escalation.

Changes in this slice:
- Replace task-management revalidation of the literal `/opportunities/[id]/tasks` route token with real route invalidation.
- Revalidate `/tasks`, the affected opportunity overview, and the affected opportunity requirements page after task mutations that know the opportunity ID.
- Keep bulk assignment revalidation on the global task list while each successful `updateTask` call refreshes its own opportunity workflow paths.
- Add focused assertions that task creation/update/delete refresh real paths and do not call the stale dynamic-route token.

Verification:
- `npm run test -- __tests__/actions/task-management-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.
- Targeted search found no stale `revalidatePath("/opportunities/[id]/tasks", "page")` calls in task management.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a proposal task workflow invalidation slice covered by focused action tests and TypeScript.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether opportunity overview pages should expose richer task summary freshness now that server invalidation reaches them.

### 2026-05-26 - Structure Document Creation Without Fake Content

Status: implemented and verified.

Purpose: prevent AI-generated document outlines from becoming draft documents that contain invented placeholder section text.

Changes in this slice:
- Replace generated structure placeholder paragraphs like `(medium content for technical approach)` with editable blank paragraphs.
- Make the unused `autoFill` option fail explicitly instead of silently creating placeholder-filled documents.
- Update the structure creation description so it no longer claims inline AI content filling.
- Add focused tests for unauthorized owner spoofing, explicit auto-fill rejection, and blank outline content.

Verification:
- `npm run test -- __tests__/actions/document-generation-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow response-generation honesty fix covered by focused action tests and TypeScript.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Wire any future structure auto-fill path to real section generation instead of reintroducing template placeholder prose.

### 2026-05-26 - Service Fallback Honesty Wording

Status: implemented and verified.

Purpose: keep service diagnostics aligned with the current behavior after discovery and intelligence wrappers were changed from placeholder responses to live fallback or honest unavailable states.

Changes in this slice:
- Replace stale discovery-service logging that said missing discovery modules would return stubs.
- Replace stale intelligence-service logging that said missing intelligence modules would return stubs.
- Reword the intelligence wrapper comment for `OpportunityData` from "minimal stub" to "minimal typed reference".

Verification:
- `uv run python -m py_compile src/docfusion/services/discovery_service.py src/docfusion/services/intelligence_service.py` passed.
- `git diff --check` passed.
- Targeted search found no stale `service will return stubs`, `minimal stub`, `not_implemented`, or `placeholder` wording in the two service wrappers.

Testing scope note:
- Broader Python tests remain intentionally skipped while on battery. This was a diagnostics/comment honesty slice with no behavior change.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Prefer service responses that expose real fallback data or explicit unavailable states over any new placeholder wording or success claims.

### 2026-05-26 - Requirement Workflow Refresh Integrity

Status: implemented and verified.

Purpose: keep requirement edits, extraction, acceptance workflow changes, and response-package creation synchronized with authoritative requirement statistics and compliance matrix state.

Changes in this slice:
- Add route revalidation to requirement create, bulk create, update, bulk update, assignment, workflow transition, and delete actions.
- Extend proposal-package revalidation to include the opportunity requirements page.
- Replace simplified requirements-page stats updates with server-backed requirements, statistics, and compliance-matrix refreshes.
- Sync the requirements table's internal row state when refreshed parent data arrives.
- Remove the local compliance matrix projection used after response-package creation and refresh the real matrix list instead.

Verification:
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.
- Targeted search found no simplified requirements refresh placeholder or full-page reload in the touched requirements surfaces.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a requirements workflow refresh integrity slice verified with TypeScript, whitespace validation, and targeted source search.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review remaining non-opportunity placeholder/simplified paths separately unless they directly block response production.

### 2026-05-26 - Opportunity Workflow Refresh Integrity

Status: implemented and verified.

Purpose: keep proposal-document, RFP-document, and submission workflow screens synchronized with authoritative server state without full browser reloads or partial client-side progress guesses.

Changes in this slice:
- Add route revalidation to proposal-document mutations for opportunity overview, proposal documents, and submission pages.
- Add route revalidation to submission status, submission recording, and outcome recording actions.
- Replace opportunity document discovery full-page reloads with App Router refreshes and server-backed document refreshes.
- Replace submission completion reload with local submission insertion plus App Router refresh.
- Replace proposal-document progress recalculation with server-backed document and progress refreshes.
- Remove a dead header-level discovery handler that still contained a full browser reload.

Verification:
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.
- Targeted search found no `window.location.reload()` or simplified progress placeholder in the touched opportunity workflow surfaces.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a client/server refresh integrity slice verified with TypeScript, whitespace validation, and targeted source search.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review remaining non-opportunity reloads in CRM/document error surfaces separately if they affect response workflows.

### 2026-05-26 - Discovery Infrastructure Alignment

Status: implemented and verified.

Purpose: make the product's configured search/scraping infrastructure match the available services, so opportunity discovery work starts from the correct live endpoints instead of stale host defaults.

Changes in this slice:
- Point Python SearXNG defaults to `https://search.lindela.io`.
- Point Next.js SearXNG defaults to `https://search.lindela.io`.
- Keep Firecrawl defaults on the connectivity host at `http://84.247.181.100:3002`.
- Move Docling default to the same connectivity host at `http://84.247.181.100:3600`.
- Update infrastructure docs and environment examples to reflect the search/scrape host topology.
- Add config regression tests so SearXNG does not drift back to raw IP/port defaults.

Verification:
- `npm run test -- __tests__/services/searxng-client-config.test.ts` passed.
- `PYTHONPATH=src uv run pytest tests/ci/test_search_infrastructure_config.py tests/ci/test_secrets_manager_docling.py -q` passed.
- `npm run lint -- --max-warnings=0` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Live SearXNG probe returned JSON search results from `https://search.lindela.io/search?q=rfp&format=json`.
- Live Firecrawl probe successfully scraped `https://example.com` through `http://84.247.181.100:3002/v1/scrape`.

Testing scope note:
- Full-suite tests and production build were intentionally skipped for this slice because the machine is on battery. Prefer focused tests and lightweight checks until power is available or a larger code chunk warrants broader verification.
- `ruff check` on touched Python files is not currently a useful narrow gate: it reports a large set of pre-existing style/docstring/import diagnostics in `src/docfusion/api/dependencies.py`, `src/docfusion/config/secrets.py`, and `src/docfusion/infrastructure/searxng_client.py`.

Remaining after this slice:
- Connect discovery search results to a durable opportunity ingestion workflow where gaps remain.
- Add or strengthen fallback behavior for browser-only sources, including CloakHQ/cloakbrowser only if existing Firecrawl/Playwright paths cannot handle a target source.
- Continue auditing the full opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - SearXNG Opportunity Ingestion

Status: implemented and verified.

Purpose: connect live external search results to durable opportunity records instead of leaving web discovery as a document-only helper.

Changes in this slice:
- Add `discoverAndImportOpportunities`, a server action that searches SearXNG, filters likely opportunity notices, deduplicates by normalized URL fingerprint and source ID, and records an audited import job.
- Support optional Firecrawl enrichment for top search results so high-value runs can store cleaner titles and summaries without making every search import expensive.
- Assign discovered opportunities to the importing user and store provenance metadata including search query, engine, score, normalized URL, and Firecrawl scrape status.
- Persist scraper/discovery identity fields in `createOpportunity` so `source`, `fingerprint`, `portalUrl`, `documentUrl`, and scrape dates are not dropped on new records.
- Add focused tests for SearXNG ingestion, Firecrawl enrichment, duplicate update handling, and unauthenticated access blocking.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/actions/import-opportunities-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally deferred while on battery. This slice used focused Vitest coverage plus TypeScript checking because the changed surface is a server action boundary.

Remaining after this slice:
- Wire the discovery import action into scheduled/source workflows or an operator UI so target query sets can run without a developer console.
- Add browser-only fallback behavior for pages Firecrawl cannot scrape cleanly, using the existing Playwright service first and CloakHQ/cloakbrowser only if needed.
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - Operator Discovery Run Endpoint

Status: implemented and verified.

Purpose: make live opportunity discovery triggerable through an operational API surface, not only as an internal server action.

Changes in this slice:
- Add `POST /api/opportunities/discovery/run` for scraper-operator/admin controlled discovery runs.
- Validate discovery request fields before any live search work starts.
- Route authorized requests into `discoverAndImportOpportunities` so the same audited import, dedupe, SearXNG, and optional Firecrawl enrichment path is used.
- Add route tests for unauthorized access, malformed request bodies, and successful operator-triggered discovery imports.

Verification:
- `npm run test -- __tests__/api/opportunity-discovery-route.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used focused route/action tests and TypeScript checking.

Remaining after this slice:
- Add scheduled discovery execution with a service actor or configured assignee, rather than requiring an interactive operator session.
- Add browser-only fallback behavior for pages Firecrawl cannot scrape cleanly, using the existing Playwright service first and CloakHQ/cloakbrowser only if needed.
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - Scheduled Discovery Assignee Path

Status: implemented and verified.

Purpose: let cron/API-key discovery runs persist opportunities under an explicit configured assignee while keeping the interactive server action bound to the authenticated user.

Changes in this slice:
- Move live discovery import execution into a reusable server-side service that accepts an explicit assignee user ID.
- Keep `discoverAndImportOpportunities` authenticated: it still derives the assignee from the current user before calling the service.
- Allow `POST /api/opportunities/discovery/run` to accept `SCRAPER_API_KEY` authorization for scheduled runs when `DISCOVERY_IMPORT_USER_ID` is configured.
- Return a clear `503` configuration error when an API-key discovery run is attempted without `DISCOVERY_IMPORT_USER_ID`.
- Extend route tests to cover session-triggered runs, API-key scheduled runs, missing service assignee configuration, invalid request bodies, and unauthorized access.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/actions/import-opportunities-auth.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used focused action/route coverage plus TypeScript checking.

Remaining after this slice:
- Add browser-only fallback behavior for pages Firecrawl cannot scrape cleanly, using the existing Playwright service first and CloakHQ/cloakbrowser only if needed.
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - Browser Fallback for Discovery Enrichment

Status: implemented and verified.

Purpose: keep live opportunity ingestion useful when Firecrawl cannot scrape a high-value result cleanly by falling back to the available Playwright/stealth browser service before considering any new browser dependency.

Changes in this slice:
- Add browser fallback enrichment to `executeOpportunityDiscoveryImport` when `scrapeTopResults` is enabled and Firecrawl fails or returns sparse content.
- Default the stealth browser service to `http://84.247.181.100:3003`, while still honoring `STEALTH_SCRAPER_URL`.
- Record whether enrichment came from Firecrawl or browser fallback in discovery metadata, including the fallback reason.
- Expose `browserFallback` and `browserFallbackLimit` through the operator discovery API request parser.
- Align frontend scraper fallback defaults and `.env.example` with the connectivity host Playwright service.
- Add a focused regression test proving a Firecrawl failure is recovered through the browser service and persisted with browser fallback provenance.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted action/route tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Consider CloakHQ/cloakbrowser only after a real target source fails both Firecrawl and the existing Playwright/stealth service.

### 2026-05-26 - Requirement-Traceable Proposal Package Creation

Status: implemented and verified.

Purpose: move the response-generation path beyond generic document creation by making the standard proposal set idempotent and immediately traceable to extracted RFP requirements.

Changes in this slice:
- Make `createStandardProposalSet` skip already-created standard document types instead of duplicating proposal documents on repeated package creation.
- Link actionable RFP requirements to matching proposal document sections by category, preserving existing section requirement IDs.
- Update each linked requirement with the response document and section that will address it.
- Keep all requirement and section updates scoped through the assigned opportunity.
- Add focused tests covering unauthenticated access, assigned-opportunity scoping, duplicate avoidance, requirement-to-section linking, and traceability updates.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen generation quality by using opportunity context, accepted requirements, win themes, past performance, and compliance gaps to seed section-specific draft content.

### 2026-05-26 - Requirement-Aware Proposal Draft Seeding

Status: implemented and verified.

Purpose: make newly created proposal documents start from opportunity-specific response guidance instead of generic Datacraft boilerplate alone.

Changes in this slice:
- Enrich new proposal documents with an opportunity-specific response plan covering client context, sector, region, deadline, budget, fit score, win probability, scope, submission signals, and strategic notes.
- Pull actionable extracted RFP requirements for the document type and seed requirement-by-requirement response cues directly into the draft content.
- Add Datacraft proof points tailored by document type so writers can connect requirements to Lindela, MeGuard, Wakala, delivery governance, cost logic, and past performance evidence.
- Add compliance gap closure prompts for requirements that are not yet addressed or compliant.
- Store seeded requirement IDs and a response-plan version in document metadata for traceability.
- Add focused tests that capture the inserted document payload and verify that matching technical requirements are seeded while unrelated cost requirements are excluded.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen downstream section generation/review so accepted requirement links can drive per-section drafting, evaluator scoring checks, and final compliance verification.

### 2026-05-26 - Requirement-Aware Section Draft Persistence

Status: implemented and verified.

Purpose: turn linked proposal-section requirements into persisted draft content and compliance progress, rather than leaving the links as passive metadata.

Changes in this slice:
- Add a requirement-aware section draft action that loads the scoped proposal section, proposal document, underlying document, opportunity context, and linked requirements.
- Generate section-level draft content with direct requirement responses, evaluator win angle, evidence checklist, and review gate prompts.
- Persist the generated section draft into the underlying document while replacing any previous generated draft for the same section to avoid repeated duplicate blocks.
- Create a new document version for the persisted draft.
- Update section word count/status and mark linked not-addressed requirements as partially covered with response document/section traceability.
- Store generated section draft metadata on the document for later audit and refresh logic.
- Add focused tests covering document persistence, version creation, section progress, requirement status advancement, and assigned-opportunity scoping.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Connect the requirement-aware section draft action to an operator-visible UI/control path or response package workflow.
- Strengthen final review so compliance status is promoted from partial to compliant only after evidence and evaluator-readiness checks pass.

### 2026-05-26 - Operator Control for Requirement-Aware Drafting

Status: implemented and verified.

Purpose: make requirement-aware drafting accessible from the proposal document workflow instead of leaving it as a server-only capability.

Changes in this slice:
- Add a document-level requirement-aware draft action that drafts every section in a proposal document and returns drafted section/requirement coverage.
- Mark the proposal document as drafting after linked section drafts are generated.
- Add a visible `Draft` control to proposal document cards and a matching dropdown action for operator workflows.
- Wire the UI control to the server action and update the local document status after generation.

Verification:
- `npx tsc --noEmit` passed.
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add final evaluator-readiness/compliance promotion checks so drafts become submission-ready only after evidence, cross-reference, and review gates pass.

### 2026-05-26 - Requirement-Gated Proposal Approval

Status: implemented and verified.

Purpose: prevent draft-generation progress from being mistaken for final response readiness.

Changes in this slice:
- Add an approval/final-status gate for proposal documents with linked requirements.
- Before a proposal document can be marked approved or final, load its linked section requirements through the assigned-opportunity scope.
- Block approval when linked requirements remain partial, not addressed, non-compliant, or otherwise unresolved.
- Allow final status only when linked requirements are addressed, compliant, or not applicable.
- Add focused coverage proving unresolved linked requirements prevent proposal document approval and no update is written.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add evidence-aware promotion workflows so compliant status can be earned from verified response evidence instead of manual status changes alone.

### 2026-05-26 - Evidence-Backed Requirement Promotion

Status: implemented and verified.

Purpose: let requirements legitimately move from drafted/partial coverage to compliant after compliance review verifies response evidence.

Changes in this slice:
- Strengthen compliance entry approval so approval promotes the entry to `compliant` instead of leaving reviewed evidence at `partial`.
- Sync approved compliance entries back to the underlying RFP requirement, setting its compliance status to `compliant`.
- Sync waived compliance entries back to the underlying requirement as `not_applicable`.
- Reopen previously compliant requirements back to partial coverage when compliance review is reopened.
- Preserve existing compliance justifications when approval occurs, while using the review reason as a fallback.
- Update focused compliance workflow tests to verify matrix statistics, entry updates, and underlying requirement promotion.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted compliance/proposal workflow tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add operator-visible review controls that make the evidence promotion path easy to use from proposal/compliance screens.

### 2026-05-26 - Operator Matrix Final Lock Controls

Status: implemented and verified.

Purpose: make final compliance review and matrix locking accessible to operators, not only available as an internal server action.

Changes in this slice:
- Add a tenant-scoped matrix workflow API route for submitting a matrix for review, locking the final matrix, and reopening it.
- Add a `Matrix Review` control to the compliance matrix UI.
- Show valid matrix workflow actions by current matrix state: draft matrices can be submitted for review, review matrices can be locked or reopened, and final/submitted matrices can be reopened.
- Reuse the existing workflow reason dialog so matrix lock decisions preserve an explicit audit reason.
- Surface server-side matrix lock blockers directly in the UI error message.

Verification:
- `npx tsc --noEmit` passed.
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used the focused compliance workflow test and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add route-level tests for the new matrix workflow API when broader API testing is worth the battery cost.

### 2026-05-26 - Operator Live Discovery Control

Status: implemented and verified.

Purpose: make live SearXNG/Firecrawl opportunity discovery runnable from the product UI, not only through server actions or API calls.

Changes in this slice:
- Add a `Discover` control to the Opportunities command center header.
- Add a live discovery dialog that accepts multiple SearXNG queries, optional region/category hints, result limits, enrichment limits, Firecrawl enrichment, browser fallback, and broad-match inclusion.
- Wire the dialog to the authenticated `discoverAndImportOpportunities` server action.
- Show created/updated/skipped/failed import counts after a run.
- Refresh opportunity list/stat query caches after discovery completes.

Verification:
- `npx tsc --noEmit` passed.
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used TypeScript checking plus focused discovery action/API tests.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add persisted discovery run presets/schedules in the UI so repeated searches can be operated without re-entering query sets.

### 2026-05-26 - Persisted Discovery Run Presets

Status: implemented and verified.

Purpose: make repeated live opportunity searches operable without re-entering the same SearXNG query sets and enrichment settings.

Changes in this slice:
- Reuse the existing `saved_searches` table for discovery run presets through a tagged JSON payload, avoiding a new migration.
- Add authenticated server actions to create, list, and delete discovery presets.
- Keep normal saved searches separate from discovery presets so saved opportunity filters do not show live-discovery run configurations.
- Add preset save/load/delete controls to the live discovery dialog.
- Persist multi-query input, region/category hints, result limits, enrichment limits, Firecrawl enrichment, browser fallback, broad-match inclusion, and update behavior.
- Add focused tests for discovery preset persistence and unauthenticated access.

Verification:
- `npm run test -- __tests__/actions/saved-searches-auth.test.ts __tests__/actions/discovery-presets.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused saved-search/discovery action tests plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add scheduled execution for saved discovery presets so recurring searches can run unattended under a configured assignee.

### 2026-05-26 - Scheduled Discovery Preset Runs

Status: implemented and verified.

Purpose: let recurring opportunity discovery run unattended from saved presets under the configured import assignee.

Changes in this slice:
- Add `POST /api/opportunities/discovery/presets/run` for cron/API-key scheduled discovery.
- Load discovery presets owned by `DISCOVERY_IMPORT_USER_ID`, with optional `presetIds`, `limit`, and `dryRun` request controls.
- Run presets sequentially through `executeOpportunityDiscoveryImport` so scheduled search does not fan out aggressively while on constrained compute.
- Return per-preset import results and continue running later presets if one preset fails.
- Add dry-run output that reports the exact saved preset inputs without contacting SearXNG/Firecrawl.
- Add focused route tests for unauthorized access, missing assignee configuration, dry-run behavior, scheduled execution, and request validation.

Verification:
- `npm run test -- __tests__/api/opportunity-discovery-presets-route.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused route tests plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add operator-facing documentation or a settings surface for wiring cron to discovery preset runs.

### 2026-05-26 - Discovery Operations Runbook

Status: implemented and verified.

Purpose: make the live and scheduled discovery controls operable by deployment operators without reverse-engineering endpoint details.

Changes in this slice:
- Add an opportunity discovery operations runbook under technical runbooks.
- Document required app environment for SearXNG, Firecrawl, browser fallback, API-key auth, and scheduled import ownership.
- Document manual API-key discovery runs and scheduled preset dry-run/execution calls.
- Add an example cron entry and operating guidance for bounded search/enrichment settings.
- Link the runbook from the technical runbooks index.

Verification:
- `git diff --check` passed.

Testing scope note:
- This was a documentation-only slice, so no code tests or TypeScript checks were run.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add an operator settings/status surface for discovery scheduler health if UI visibility is needed beyond the runbook and API responses.

### 2026-05-26 - Direct Opportunity Source RFP Intake

Status: implemented and verified.

Purpose: close the discovery-to-RFP intake gap when a discovered opportunity already has a direct RFP/document source link.

Changes in this slice:
- Add an authenticated `ingestOpportunitySourceDocument` action that scopes access to the assigned opportunity.
- Create an `opportunity_documents` record from `documentUrl` or `rfpLink` when the source document has not already been discovered.
- Reuse the existing server-side download, storage receipt, duplicate detection, workflow audit, and parser queue path from `downloadDocument`.
- Return an idempotent success when the matching source document is already downloaded.
- Add an `Ingest Source Link` control to the empty RFP documents panel so operators can bridge a discovered opportunity into RFP intake without manual upload.
- Add focused action coverage for the direct source-ingest path.

Verification:
- `npm run test -- __tests__/actions/opportunity-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused opportunity-document action tests plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Improve post-ingest UI visibility for parser progress after source-link ingestion, if operators need live status without refreshing.

### 2026-05-26 - Source Intake Queue Feedback

Status: implemented and verified.

Purpose: keep parser-queue evidence visible immediately after direct source-link ingestion.

Changes in this slice:
- Stop refreshing the opportunity page immediately after source-link ingest succeeds.
- Show the existing RFP intake step tracker in the empty documents state when source-link ingestion returns a result.
- Surface stored/queued counts from the returned storage path and parsing job instead of hiding them behind a reload.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice used TypeScript checking for the small UI state change.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add persisted parser progress polling on the opportunity detail page if source-link ingestion needs live background status updates.

### 2026-05-26 - Opportunity Parser Progress Visibility

Status: implemented and verified.

Purpose: keep RFP parser status visible on the opportunity detail page after source-link or document ingestion, including after navigation or refresh.

Changes in this slice:
- Enrich opportunity document reads with linked `rfpDocumentId`, latest `parsingJobId`, parser status, and parser progress by matching downloaded document hashes to RFP documents and latest parse jobs.
- Render the existing RFP parse progress card below the opportunity document panel whenever linked parser records exist.
- Keep completion/error toasts limited to fresh intake results so reloading an opportunity with an already-completed parse does not fire stale notifications.
- Return linked parser references when direct source ingestion is retried against an already-downloaded source document.
- Make `RFPParseProgress` understand the human-readable parser step strings currently stored by the backend, falling back to progress percentages when no exact step text is available.

Verification:
- `npm run test -- __tests__/actions/opportunity-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused action coverage plus TypeScript checking because it touches one read model and two client surfaces.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add a broader joined parse/status test for `getOpportunityDocuments` when running on power, or when a service-level test harness for this DB read model is already active.

### 2026-05-26 - Parser to Requirements Handoff

Status: implemented and verified.

Purpose: let operators continue directly from completed RFP parsing into requirements review from the opportunity detail page.

Changes in this slice:
- Add optional completion destination props to `RFPParseProgress`.
- Render a `Review Requirements` action when parser status is completed and a completion URL is supplied.
- Point opportunity detail parser progress cards to `/opportunities/{id}/requirements`.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice is a small UI handoff addition verified by TypeScript and whitespace checks.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen the requirements review page next if accepted requirements do not yet reliably trigger response-package work.

### 2026-05-26 - Accepted Requirements Response Package Handoff

Status: implemented and verified.

Purpose: turn reviewed requirements into the next response-package workflow step without letting unreviewed parser output drive proposal sections.

Changes in this slice:
- Add a `Build Response Package` control to the opportunity requirements page.
- Route the control through the existing `createStandardProposalSet` action, then send operators to the proposal documents workspace.
- Gate the requirements-page response-package action on at least one accepted requirement.
- Restrict standard proposal section linking to accepted, applicable requirements instead of every extracted actionable requirement.
- Update focused proposal-document coverage so linked package creation uses accepted requirement workflow metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice used the existing proposal-document server-action test plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Consider an explicit one-click "draft all linked sections" orchestration after response package creation, so accepted requirements can proceed from package creation into initial narrative without per-document manual drafting.

### 2026-05-26 - One Click Response Package Drafting

Status: implemented and verified.

Purpose: move accepted requirements from review directly into drafted response content, not just empty proposal package records.

Changes in this slice:
- Add `createAndDraftStandardProposalSet`, a server action that requires accepted applicable requirements before orchestration starts.
- Reuse standard package creation/linking, then draft every standard proposal document with linked sections.
- Return created document count, drafted document count, drafted section count, linked requirement IDs, document IDs, and the latest version number.
- Change the requirements page handoff to build and draft the response package in one operator action.
- Add focused coverage for the create/link/draft orchestration path.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and broad proposal workflow tests remain intentionally skipped while on battery. This slice used focused proposal action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen final evaluator/compliance review so generated drafts are promoted only after evidence, compliance, and readiness gates pass.

### 2026-05-26 - Response Package Compliance Matrix Seeding

Status: implemented and verified.

Purpose: produce compliance proof rows at the same time accepted requirements are drafted into the response package.

Changes in this slice:
- Extend `createAndDraftStandardProposalSet` to create or reuse an opportunity compliance matrix for accepted applicable requirements.
- Add missing compliance entries for accepted requirements, carrying response document, response section, owner, due date, risk, and response summary into the matrix rows.
- Refresh matrix counts and store response-package synchronization metadata.
- Return `complianceMatrixId` and `complianceEntriesCreated` from the create/link/draft orchestration.
- Surface the number of compliance rows added in the requirements-page success toast.
- Extend focused proposal-document action coverage for the matrix seeding path.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and broad compliance workflow tests remain intentionally skipped while on battery. This slice used focused proposal action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Expose the generated compliance matrix from the opportunity requirements/documents workflow if operators need a first-class navigation target before final lock/review.

### 2026-05-26 - Opportunity Compliance Matrix Visibility

Status: implemented and verified.

Purpose: make generated compliance proof reviewable in the opportunity requirements workflow instead of leaving it hidden behind APIs.

Changes in this slice:
- Load latest compliance matrices for the opportunity requirements page.
- Pass compliance matrix summaries into the requirements client surface.
- Render the existing `ComplianceMatrix` review component inline when a matrix exists.
- Update the requirements-page create/link/draft action to reveal newly created matrix IDs immediately after orchestration succeeds.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice is a UI visibility/read-model change verified with TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen the final document approval/render/submission path so compliance matrix lock and document finalization are required before submission.

### 2026-05-26 - Final Submission Checklist Alignment

Status: implemented and verified.

Purpose: ensure the submission UI shows the same readiness blockers that the server enforces before recording a submission.

Changes in this slice:
- Replace the legacy pre-submission checklist source with `evaluateFinalSubmissionChecklistWorkflow`.
- Map final checklist categories into the existing submission checklist UI model.
- Preserve hard-gate status, required flags, messages, and assigned roles from the enforced final checklist.
- Add focused coverage proving the operator checklist is loaded from the final submission gate.

Verification:
- `npm run test -- __tests__/actions/submissions-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and broad submission workflow tests remain intentionally skipped while on battery. This slice used focused submission action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Improve the submission form interaction so final-gate items are clearly system-verified rather than manually toggleable checklist items.

### 2026-05-26 - System Verified Submission Checklist Items

Status: implemented and verified.

Purpose: prevent operators from thinking final submission gates can be satisfied by manually checking boxes in the UI.

Changes in this slice:
- Add an `isSystemVerified` flag to pre-submission checklist items.
- Mark final-gate checklist rows returned by `getPreSubmissionChecklist` as system verified.
- Disable manual toggling for system-verified rows in the submission form.
- Add a visible `System checked` badge for those rows.
- Extend focused submission action coverage for the new flag.

Verification:
- `npm run test -- __tests__/actions/submissions-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice used focused submission action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen final artifact/signoff creation paths if operators cannot yet produce the metadata required by the final submission gate.

### 2026-05-26 - Proposal Final Package Signoff Path

Status: implemented and verified.

Purpose: give operators a first-class path to produce the artifact hash and executive/legal signoff metadata required by the enforced final submission gate.

Changes in this slice:
- Add a `signoff` transition to the final artifact workflow that requires authority, only runs after an approved final artifact exists, and records `finalSubmissionSignoff` metadata.
- Clear final submission signoff metadata when a final artifact is reopened for correction.
- Surface rendered artifact, approved artifact, and signoff summaries on proposal document records.
- Add a proposal-document finalization server action that renders/approves/signs/reopens a final package and returns the refreshed proposal document.
- Add final package controls to the opportunity proposal document cards for render, approve, sign off, and reopen actions.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts` passed.
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused final artifact/proposal action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check whether compliance matrix final lock/approval is similarly reachable from the operator workflow before final submission.

### 2026-05-26 - Valid Compliance Entry Seeding

Status: implemented and verified.

Purpose: keep generated compliance matrices on the review/lock path by avoiding invalid seeded entry statuses.

Changes in this slice:
- Seed accepted requirement compliance entries with `compliant` instead of the unsupported `full` status.
- Extend response-package coverage to assert compliant accepted requirements create reviewable compliance entries with response evidence and strong assessment metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow data-shape fix covered by the touched proposal action test and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-27 - World Bank Detail Enrichment

Status: implemented and verified.

Purpose: make World Bank discovery candidates immediately useful for qualification and response drafting by enriching listing rows with procurement-detail metadata and solicitation text.

Changes in this slice:
- Add World Bank procurement detail parsing for both markdown detail pages and the public `search.worldbank.org/api/procnotices` JSON endpoint.
- Enrich configured World Bank imports with organization, deadline, publication date, procurement method, borrower reference, contact email, project metadata, and solicitation text.
- Update the live World Bank proof so it verifies normalized listing rows plus a detail probe backed by the World Bank API.

Verification:
- `npm test -- world-bank-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --include-live-safe --run live-world-bank-source` passed with run `live_world_bank_source_20260527T005255Z`, returning 18 live opportunities and a detail probe for `OP00300362`.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed 50 non-live bridge tests.

Testing scope note:
- Battery constraints were lifted for this slice. Verification included focused parser/import/proof-manifest tests, TypeScript checking, and the live-safe World Bank proof.
- Full frontend suite and production build were not rerun for this source-specific backend enrichment slice.

Remaining after this slice:
- Continue adding live sources and detail/document enrichment for sources that reliably expose procurement packages.

### 2026-05-27 - COMESA Detail Package Enrichment

Status: implemented and verified.

Purpose: turn COMESA archive rows into response-ready opportunities by following detail pages to the actual tender package attachments.

Changes in this slice:
- Add COMESA detail-page parsing that ranks document attachments and filters unrelated site PDFs such as privacy policy links.
- Enrich configured COMESA imports with primary tender package URLs, source document links, submission labels, and metadata for discovered package attachments.
- Replace the generic COMESA live proof with a source-specific proof that verifies both archive parsing and a detail-page package document.

Verification:
- `npm test -- comesa-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` passed with run `live_comesa_source_20260527T010114Z`, returning 2 live opportunities and `RFP-Medical-Scheme-2026-Final.docx`.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed 50 non-live bridge tests.

Testing scope note:
- Verification included focused parser/import/proof-manifest tests, TypeScript checking, the live-safe COMESA proof, and the non-live bridge proof.
- Full frontend suite and production build were not rerun for this source-specific enrichment slice.

Remaining after this slice:
- Continue adding live source detail/document enrichment where source pages expose stable procurement packages.

### 2026-05-27 - Warning-Free Live Response Readiness

Status: implemented and verified.

Purpose: make live response-package drafts fully source-grounded even when an EOI exposes mostly administrative and submission requirements rather than neatly sectioned management or past-performance clauses.

Changes in this slice:
- Adapt mandatory source requirement signals into section-specific response plans for document types that have no direct source clause.
- Remove generic "no source requirement assigned" filler from management-plan and past-performance drafts when the source document still has mandatory response signals.
- Add regression coverage for EOI-style sources that lack explicit management/past-performance requirements.

Verification:
- `npm test -- live-response-package.test.ts platform-proof-scenarios.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` passed with run `live_response_readiness_20260527T011242Z`; readiness was `ready_for_review` with zero warnings and 3,657 draft words.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed.

Testing scope note:
- Verification included focused response-package tests, TypeScript checking, the live-safe UNGM response-readiness proof, and the non-live response-readiness scenario.
- Full frontend suite and production build were not rerun for this deterministic response-package grounding change.

Remaining after this slice:
- Continue replacing narrow proofs with broader source coverage and keep pursuing a persisted DB-backed import-to-response proof when database connectivity is available.

### 2026-05-27 - Discovery-to-Submission Core Proof Sweep

Status: verified.

Purpose: re-check the non-live core path after live source enrichment and response-package grounding changes.

Verification:
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed.
- The proof ran 13 focused test files and 120 tests covering opportunity discovery, configured import, document discovery, RFP document intake, parse workflow, requirements workflow, proposal document scope, final artifact workflow, final artifact route, final submission checklist, submission workflow, and submission scoping.

Testing scope note:
- This was a broader non-live proof sweep, not a production build or full frontend suite.
- At the time of this sweep, the live persisted DB import-to-response proof still needed a live schema repair and proof run.

Remaining after this slice:
- Continue closing live/persisted gaps that are not covered by mocked non-live proof scenarios.

### 2026-05-27 - Live Persisted Import-to-Response Proof

Status: implemented and verified.

Purpose: prove the platform can take a live discovered opportunity all the way into persisted response-workspace records, then clean the proof rows back out of PostgreSQL.

Changes in this slice:
- Add a live-safe platform proof scenario for persisted import-to-response coverage.
- Add an idempotent live tenant repair migration for opportunity/proposal persistence tables whose live schema predated the app's tenant-scoped writes.
- Add a schema preflight to the live proof so future drift fails before source fetching or Docling extraction.

Verification:
- Applied `frontend/drizzle/0032_live_response_persistence_tenant_repair.sql` to the live database; it added/backfilled opportunity, opportunity document, proposal document, document section, vote/import, and AI-score tenant columns and rebuilt opportunity uniqueness indexes as tenant-scoped indexes.
- Live schema check confirmed all 2,602 existing opportunities had `organization_id`, and the expected tenant indexes were present.
- `npm test -- platform-proof-scenarios.test.ts live-response-package.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `set -a; source .env.local; set +a; npm run platform:proof -- --include-live-safe --run live-persisted-import-response` passed with run `live_persisted_import_response_20260527T013517Z`.
- The live proof used UNGM notice `300700`, fetched `eoi24414.pdf`, extracted 3,070 characters through Docling, persisted one opportunity row, one source-document row, one RFP document row, eight requirement rows, six proposal-document rows, and six response-document rows.
- Cleanup verification reported zero remaining proof rows across all persisted tables.

Testing scope note:
- This was a live-safe disposable-row proof, not a full production migration audit or full frontend suite.
- The platform proof required explicitly sourcing `frontend/.env.local` because an ambient shell `DATABASE_URL` pointed at an unreachable stale endpoint.

Remaining after this slice:
- Continue broadening live source coverage and add operational migration tracking for manual live schema repairs.

### 2026-05-27 - Live Migration Ledger Recording

Status: implemented and verified.

Purpose: prevent applied live schema repairs from remaining invisible to the Drizzle migration ledger.

Changes in this slice:
- Add `npm run db:record-migration -- <migration.sql>` to record an already-applied SQL migration in `drizzle.__drizzle_migrations`.
- Compute the same SHA-256 hash Drizzle uses for migration files and use the migration journal timestamp when available, falling back to the SQL file mtime for manual repair files.
- Make the recorder idempotent with a `--dry-run` path that reports whether a row would be inserted or is already recorded.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- `set -a; source .env.local; set +a; npm run db:record-migration -- 0032_live_response_persistence_tenant_repair.sql --dry-run` reported `would-insert` before recording.
- `set -a; source .env.local; set +a; npm run db:record-migration -- 0032_live_response_persistence_tenant_repair.sql` inserted the live ledger row.
- `psql` confirmed `drizzle.__drizzle_migrations` now contains hash `28b827ba64784d8af4bdb674c11bcb7073a269eb18bf096200e628028bc4b5f3` for created_at `1779845173133`.
- A follow-up dry run reported `already-recorded`.

Testing scope note:
- This records the already-applied repair in the migration ledger; it does not retrofit the older missing Drizzle journal entries.

Remaining after this slice:
- Reconcile older manual migrations with `frontend/drizzle/meta/_journal.json` before relying on `drizzle-kit migrate` for fresh database rebuilds.

### 2026-05-27 - Drizzle Journal Reconciliation

Status: implemented and verified.

Purpose: make migration metadata match the SQL files in the repo so missing journal entries cannot silently hide schema work.

Changes in this slice:
- Add `0010` through `0032` to `frontend/drizzle/meta/_journal.json`, preserving the live-recorded `0032` created_at value.
- Add a regression test that requires every `frontend/drizzle/*.sql` file to appear in the journal with sequential indexes and increasing timestamps.
- Move `CREATE EXTENSION IF NOT EXISTS pg_trgm` ahead of the trigram indexes in the full-text-search migration so fresh replay has the extension before index creation.

Verification:
- `npm test -- drizzle-migration-journal.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- Drizzle's `readMigrationFiles({ migrationsFolder: 'frontend/drizzle' })` returned 33 migrations and resolved the final `0032` hash to `28b827ba64784d8af4bdb674c11bcb7073a269eb18bf096200e628028bc4b5f3`.
- `set -a; source .env.local; set +a; npm run db:record-migration -- 0032_live_response_persistence_tenant_repair.sql --dry-run` now reports source `journal` and status `already-recorded`.

Testing scope note:
- This validates metadata coverage and Drizzle migration-file parsing; it is not a full empty-database replay.

Remaining after this slice:
- Add a disposable empty-database migration replay once a cheap isolated PostgreSQL target is available.

### 2026-05-26 - Workflow Runtime Tenant Anchor

Status: implemented and verified.

Purpose: prevent cross-tenant workflow transition and read-model bleed by giving durable workflow instances an organization anchor and threading that anchor through domain workflow transitions.

Changes in this slice:
- Add nullable `organization_id` support to `workflow_instances`, with migration backfill for single-tenant deployments and an organization index.
- Persist `organizationId` on workflow runtime transitions when tenant-aware domain workflows start or advance.
- Scope domain workflow instance lookup and reversal by organization context while preserving nullable global/control-plane workflow records.
- Carry organization context into workflow viewer scopes so dashboard and portal reads are bounded to the caller organization plus global workflow records.
- Constrain scraper-run domain compensation with workflow metadata `sourceId` when available, avoiding run-ID-only projection.
- Harden workflow-domain tests by resetting one-shot DB mocks between tests so SQL scoping assertions cannot leak across cases.

Verification:
- `npm test -- workflow-domain.test.ts workflow-runtime.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave0-workflow-runtime-core` passed.
- `npm run platform:proof -- --run wave7-import-operations-governance` passed.

Testing scope note:
- Battery constraints are lifted. This slice ran focused boundary tests, TypeScript checking, diff whitespace checks, and the relevant workflow-runtime plus import/operations platform proof waves.

Remaining after this slice:
- Continue auditing opportunity-linked workflow domain tables that still scope through opportunity assignment because their tables do not yet carry organization IDs.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - Submission Tenant Anchor

Status: implemented and verified.

Purpose: keep final submission dispatch, correction, outcome, and analytics records tenant-bound instead of relying only on assigned opportunity checks.

Changes in this slice:
- Add nullable `organization_id` support to `submissions`, with migration backfill for single-tenant deployments and an organization index.
- Persist the caller organization on new submission rows and production submission workflow instances.
- Scope submission reads, lists, status updates, outcome updates, win/loss analytics, recent submissions, correction workflows, and workflow-domain submission compensation by submission organization plus assigned opportunity.
- Carry organization context into final submission checklist workflow runtime records.
- Extend submission scope and workflow tests to assert tenant predicates and tenant persistence.

Verification:
- `npm test -- submissions-scope.test.ts submission-workflow.test.ts submission-correction-workflow.test.ts final-submission-checklist-workflow.test.ts workflow-domain.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed.

Testing scope note:
- Battery constraints are lifted. This slice ran focused submission coverage, TypeScript checking, diff whitespace checks, and both Wave 6 final-submission proof scenarios.

Remaining after this slice:
- Continue auditing proposal reviews, review comments, gate reviews, and cost/pricing records for first-class organization anchors.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - Review Workflow Tenant Anchors

Status: implemented and verified.

Purpose: keep proposal review gates and review comment resolution workflows tenant-bound while preserving assigned-opportunity access checks.

Changes in this slice:
- Add nullable `organization_id` support to `proposal_reviews` and `review_comments`, with migration backfill from the single organization or the parent review.
- Scope review package transitions, reviewer/comment reads, review updates, and workflow-domain proposal review/comment compensation by organization plus assigned opportunity.
- Scope review comment workflow reads/updates by review/comment organization and carry organization context into review package/comment workflow runtime instances.
- Extend review package and review comment workflow tests to assert tenant predicates and workflow runtime organization propagation.

Verification:
- `npm test -- review-package-workflow.test.ts review-comment-workflow.test.ts workflow-domain.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed.

Testing scope note:
- Battery constraints are lifted. This slice ran focused review workflow coverage, TypeScript checking, diff whitespace checks, and the relevant Wave 4/Wave 6 proof scenarios.

Remaining after this slice:
- Continue auditing general review management (`frontend/lib/actions/reviews.ts`), gate reviews, and cost/pricing records for first-class organization anchors.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - General Review Management Tenant Scoping

Status: implemented and verified.

Purpose: close the row-level tenant gap in the broader review-management actions after anchoring the workflow-specific review paths.

Changes in this slice:
- Require organization context for direct review/comment creation and mutation paths in `frontend/lib/actions/reviews.ts`.
- Persist `organizationId` on newly created proposal reviews and review comments.
- Scope review creation numbering, review list/delete operations, all-review listing, comment add/update/delete/resolve/verify/list operations, and parent reply count changes by organization plus assigned opportunity.
- Extend the review action test harness with tenant context mocks and assertions for review/comment organization persistence and scoped review listing.

Verification:
- `npm test -- reviews.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed.

Testing scope note:
- The full general review action suite passed (110 tests). The proof wave covers adjacent review package, approval, pricing, final artifact, and submission correction workflows.

Remaining after this slice:
- Continue auditing gate reviews/capture pipeline and cost/pricing records for first-class organization anchors.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - Persistent Discovery Warning History

Status: implemented and verified.

Purpose: preserve discovery enrichment warning telemetry after the run dialog closes so operators can audit degraded Firecrawl/browser fallback runs from import history.

Changes in this slice:
- Add non-blocking import audit warnings to opportunity import config metadata.
- Persist SearXNG discovery warnings when finalizing the import record.
- Show warning counts and the first warning message in Recent Imports without counting them as failed rows.
- Add focused assertions that browser fallback usage and Firecrawl/browser fallback degradation are stored in the import record.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, component tests, browser checks, and production build remain intentionally skipped while on battery. This slice used focused discovery import coverage, TypeScript checking, and whitespace validation.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether import history needs a detail drawer for full warning/error inspection beyond the first warning line.

### 2026-05-26 - Final Package Attachment Guard

Status: implemented and verified.

Purpose: prevent a recorded submission from passing final readiness gates while omitting required final-package documents from the selected attachments.

Changes in this slice:
- Add a server-side submission guard that compares selected attachment IDs against required final-package document IDs from the final checklist.
- Reject submission recording when an operator deselects a required final document after the checklist has passed.
- Add focused regression coverage for the missing-required-attachment path.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow server-side gate change covered by focused submission workflow coverage and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review simplified client-side state refreshes on proposal documents and submission pages so workflow projections refresh without full-page reloads.

### 2026-05-26 - Python Discovery Service SearXNG Fallback

Status: implemented and verified.

Purpose: make the Python discovery service contract perform real search-backed discovery instead of returning empty or `not_implemented` placeholders while the frontend discovery path is live.

Changes in this slice:
- Add a SearXNG JSON-search fallback to `DefaultDiscoveryService`, defaulting to `https://search.lindela.io`.
- Normalize opportunity-like search results into cached discovery records for later details lookup.
- Route discovery analysis and qualification through cached opportunity data when analyzers are available.
- Return honest `unavailable` details when analysis is requested for an uncached opportunity instead of returning `status: not_implemented`.
- Expose SearXNG through `list_sources`.
- Add focused service-contract coverage without importing heavier agent modules.

Verification:
- `uv run pytest tests/ci/test_discovery_service_contract.py -q` passed.
- `uv run python -m py_compile src/docfusion/services/discovery_service.py tests/ci/test_discovery_service_contract.py` passed.
- `git diff --check` passed.

Testing scope note:
- Full Python suite and live network checks remain intentionally skipped while on battery. The new test uses a mocked `httpx.AsyncClient` to verify request shape, result normalization, cache use, and honest unavailable states.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Consider whether the Python intelligence service should consume this cache or database-backed opportunity details before replacing its remaining `not_implemented` placeholders.

### 2026-05-26 - Python Intelligence Service Contract Wiring

Status: implemented and verified.

Purpose: remove intelligence service `not_implemented` placeholders from competitive, strategic, and content recommendation methods while preserving honest unavailable states when required data or optional ML modules are absent.

Changes in this slice:
- Add an opportunity-details cache path and discovery-service lookup for intelligence wrapper methods.
- Route competitive assessment through cached opportunity data when a competitive analyzer is available.
- Route strategic recommendations through a real opportunity context when a strategy recommender is available.
- Route content recommendations through the content recommender when section text and optional section models are available.
- Return `status: unavailable` instead of placeholder success for missing details, missing recommenders, empty section text, or unavailable optional model imports.
- Add focused service-contract coverage using fakes to avoid importing heavier ML dependencies.

Verification:
- `uv run pytest tests/ci/test_intelligence_service_contract.py -q` passed.
- `uv run python -m py_compile src/docfusion/services/intelligence_service.py tests/ci/test_intelligence_service_contract.py` passed.
- `git diff --check` passed.

Testing scope note:
- Full Python suite and live intelligence integrations remain intentionally skipped while on battery. This slice verifies the wrapper contract without loading optional heavy ML modules such as `joblib`.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether API endpoints or agents should share persisted frontend opportunity records with these Python service caches.

### 2026-05-26 - Bulk Compliance Entry Approval

Status: implemented and verified.

Purpose: make final compliance matrix lock operational at large RFP scale by avoiding one-by-one approval for generated compliant entries that already have response evidence.

Changes in this slice:
- Add a `approve_ready_entries` compliance matrix workflow action.
- Bulk-approve compliant/addressed entries that have response evidence, update linked requirement compliance, recalculate matrix statistics, and record runtime evidence.
- Expose the action through the existing compliance matrix workflow API and Matrix Review menu.
- Block the bulk action after a matrix is locked and report when no ready entries exist.
- Add focused workflow coverage for bulk approval behavior and runtime evidence.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite, component tests, and production build remain intentionally skipped while on battery. This slice used the focused compliance workflow test plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check opportunity discovery/intake for current SearXNG and Firecrawl configuration drift.

### 2026-05-26 - SearXNG Health Probe Fallback

Status: implemented and verified.

Purpose: keep discovery health checks aligned with the live Lindela SearXNG deployment, where `/health` is unavailable but JSON search is operational.

Changes in this slice:
- Normalize the configured SearXNG base URL before building request paths.
- Keep `/health` as the first health probe when deployments expose it.
- Fall back to a lightweight `search?q=rfp&format=json` probe when `/health` is unavailable.
- Add config coverage for the fallback behavior.

Verification:
- Live probe: `https://search.lindela.io/health` returned `404`.
- Live probe: `https://search.lindela.io/search?q=rfp&format=json` returned `200`.
- `npm run test -- __tests__/services/searxng-client-config.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow discovery health-check fix covered by service config tests, TypeScript checking, and live service probes.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check Firecrawl scrape health and discovery run telemetry for similarly misleading readiness signals.

### 2026-05-26 - Firecrawl Environment Alias Hardening

Status: implemented and verified.

Purpose: prevent discovery enrichment from silently losing Firecrawl when operators follow older runbook wording.

Changes in this slice:
- Keep `FIRECRAWL_URL` as the canonical frontend Firecrawl environment variable.
- Accept legacy `FIRECRAWL_API_URL` when `FIRECRAWL_URL` is absent.
- Update the opportunity discovery runbook to document `FIRECRAWL_URL`.
- Add Firecrawl client configuration coverage for default host, canonical override, and legacy alias fallback.

Verification:
- Live probe: `http://84.247.181.100:3002/v1/scrape` successfully scraped `https://example.com` and returned `200`.
- `npm run test -- __tests__/services/firecrawl-client-config.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow Firecrawl configuration fix covered by service config tests, TypeScript checking, and a live scrape probe.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check discovery run telemetry and UI surfacing for partial SearXNG/Firecrawl failures.

### 2026-05-26 - Discovery Partial Failure Telemetry

Status: implemented and verified.

Purpose: make live discovery runs operationally honest by surfacing enrichment warnings and failed records instead of showing only aggregate created/updated counts.

Changes in this slice:
- Add `warnings` to discovery import results for Firecrawl failures, browser fallback failures, and browser fallback recoveries.
- Preserve imports when search metadata is sufficient while reporting enrichment degradation separately from hard row failures.
- Surface discovery warnings and failed record details in the live discovery dialog.
- Update the discovery action return type so callers can consume the warning telemetry.
- Add focused coverage for browser fallback recovery warnings and Firecrawl/browser fallback failure warnings.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite, component tests, and production build remain intentionally skipped while on battery. This slice used focused discovery import coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Improve discovery run/import history so warning telemetry remains visible after the dialog closes.

### 2026-05-26 - Actionable DLP Checklist Details

Status: implemented and verified.

Purpose: make final submission privacy blockers actionable by showing which documents and DLP rules caused the gate to fail.

Changes in this slice:
- Include DLP severity summary in the final submission checklist privacy row.
- Include the first matching document/rule details for blocking and advisory DLP findings.
- Add focused checklist coverage for the document/rule detail in the DLP row.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow checklist-message change covered by the touched workflow test and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-26 - Final Gate Task Navigation

Status: implemented and verified.

Purpose: send operators from workflow tasks to the opportunity screens where final submission and compliance blockers can actually be resolved.

Changes in this slice:
- Point final submission checklist workflow tasks to `/opportunities/{id}/submission`.
- Point compliance matrix final-lock workflow tasks to the opportunity requirements page when the matrix is opportunity-scoped.
- Add focused assertions for both workflow action URLs.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` passed.
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow workflow metadata fix covered by focused action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-26 - Submission Checklist Refresh

Status: implemented and verified.

Purpose: let operators re-check final submission readiness after fixing artifact, signoff, compliance, or DLP blockers without leaving the submission form.

Changes in this slice:
- Add a refresh action to the pre-submission checklist panel.
- Show checklist refresh loading state and prevent submission while readiness is being refreshed.
- Preserve server-derived final gate rows as system-verified checklist evidence.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, component tests, and production build remain intentionally skipped while on battery. This was a narrow client interaction change verified with TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-27 - Past Performance Volume Export Artifacts

Status: implemented and verified.

Purpose: make past-performance volume export produce real downloadable evidence artifacts instead of a placeholder document-generation URL.

Changes in this slice:
- Generate PDF past-performance volumes as base64 `data:application/pdf` artifacts with opportunity, project, relevance, CPAR, accomplishment, result, and matched-requirement details.
- Generate DOCX past-performance volumes as base64 OpenXML artifacts using the existing `docx` dependency.
- Preserve the existing `volumeData` response so downstream templates and UI callers can continue reading structured export data.
- Add regression coverage that decodes both exported formats and checks file signatures instead of accepting an inert `/api/documents/generate` route.

Verification:
- `npm test -- past-performance-scope.test.ts` passed with 9 tests.
- `npm test -- past-performance-scope.test.ts platform-proof-scenarios.test.ts` passed with 15 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 44 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing placeholder export URLs in adjacent response artifacts, especially compliance and review package exports.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Compliance Report Export Artifacts

Status: implemented and verified.

Purpose: make compliance report export produce real PDF/XLSX artifacts instead of returning a nonexistent document-generation URL.

Changes in this slice:
- Generate PDF compliance reports with matrix summary, coverage status, sectioned requirements, response references, and notes.
- Generate XLSX compliance reports as a minimal OpenXML workbook using the existing `jszip` dependency.
- Preserve the existing `reportData` response for downstream workflow and UI consumers.
- Add regression coverage that decodes both exported formats and verifies file signatures instead of accepting `/api/documents/generate`.

Verification:
- `npm test -- compliance-entry-workflow.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 81 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing placeholder export URLs in review package and presentation handout exports where no backing artifact path exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Review Package Export Artifacts

Status: implemented and verified.

Purpose: make review package export produce real PDF/XLSX/DOCX artifacts instead of advertising an API export URL.

Changes in this slice:
- Generate PDF review reports with review metadata, score summary, executive summary, reviewers, key findings, and compliance gaps.
- Generate XLSX review reports as a minimal OpenXML workbook using the existing `jszip` dependency.
- Generate DOCX review reports using the existing `docx` dependency.
- Keep export tracking on `proposal_reviews` while replacing the inert `/api/reviews/{id}/export` URL with immediate data URL artifacts.
- Update export tests to decode all three formats and verify file signatures.

Verification:
- `npm test -- reviews.test.ts` passed with 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 163 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining placeholder exports such as presentation handout and evidence export paths where no backing artifact exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Presentation Handout Export Artifact

Status: implemented and verified.

Purpose: make audience handout generation return a real PDF artifact instead of a placeholder `/api/presentations/handout` URL.

Changes in this slice:
- Generate handout PDFs directly from presentation title, agenda, visible slide summaries, and team details.
- Return a base64 `data:application/pdf` URL with the actual generated page count.
- Add regression coverage that decodes the handout and verifies the `%PDF-` signature.

Verification:
- `npm test -- presentations-export.test.ts` passed with 5 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining placeholder exports such as evidence and graphics export paths where no backing artifact exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence Library Export Artifacts

Status: implemented and verified.

Purpose: make evidence library export return real CSV/JSON artifacts instead of a placeholder `/api/evidence/export` URL.

Changes in this slice:
- Generate JSON evidence exports as base64 `data:application/json` artifacts.
- Generate CSV evidence exports as base64 `data:text/csv` artifacts with quoted field handling.
- Preserve the existing action response shape `{ url }` while replacing the inert API route.
- Add regression coverage that decodes both formats and verifies exported evidence content.

Verification:
- `npm test -- evidence.test.ts` passed with 51 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 83 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining placeholder exports such as graphics export paths where no backing artifact exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Graphics Export Artifacts

Status: implemented and verified.

Purpose: make proposal graphics export return real ZIP/PDF artifacts instead of a placeholder `/api/exports/graphics` path.

Changes in this slice:
- Generate ZIP graphics exports containing diagram/source files, captions, and `metadata.json`.
- Generate PDF graphics exports with figure titles, types, statuses, captions, and source snippets.
- Preserve export tracking through `graphic_feedback` while replacing the inert download path with data URL artifacts.
- Add graphics export signature coverage and wire the graphics tests into the Wave 6 platform proof manifest.

Verification:
- `npm test -- graphics-scope.test.ts graphics-auth.test.ts` passed with 11 tests.
- `npm test -- graphics-scope.test.ts graphics-auth.test.ts platform-proof-scenarios.test.ts` passed with 17 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 174 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing remaining export/download paths for placeholders versus durable artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Formatted Document Export Artifacts

Status: implemented and verified.

Purpose: make formatted document export return real PDF/DOCX artifacts instead of a placeholder `/api/documents/export` URL.

Changes in this slice:
- Generate PDF formatted document exports from the scoped document title/content and applied format metadata.
- Generate DOCX formatted document exports using the existing `docx` dependency.
- Preserve the existing `{ url, filename }` response shape while replacing the inert route with data URL artifacts.
- Add regression coverage that decodes both formats and verifies file signatures.

Verification:
- `npm test -- formatting-scope.test.ts` passed with 7 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 176 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing remaining export/download paths for placeholders versus durable artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Durable Certification Reminder Tracking

Status: implemented and verified.

Purpose: make personnel certification reminders create auditable reminder state instead of only counting eligible email addresses.

Changes in this slice:
- Scope certification reminder reads and writes to the caller's organization.
- Record reminder metadata on active certifications with expiration dates, including sent time, actor, recipient, channel, and reminder count.
- Skip personnel without email and certifications that are not active renewal candidates.
- Add focused regression coverage for reminder metadata persistence and organization scoping.
- Wire personnel reminder/auth tests into the Wave 4 planning and collaboration proof manifest.

Verification:
- `npm test -- personnel-reminders.test.ts personnel-auth.test.ts` passed with 3 tests.
- `npm test -- personnel-reminders.test.ts personnel-auth.test.ts platform-proof-scenarios.test.ts` passed with 9 tests.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` passed with 33 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing staffing workflows for unscoped reads and non-durable operational actions.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence Suggestion Scoring

Status: implemented and verified.

Purpose: make claim evidence suggestions rank proof by multiple proposal-relevant signals instead of keyword overlap alone.

Changes in this slice:
- Score candidate evidence against claim text using title, content, summary, tags, metrics, capability context, agency context, quantification, source verification, and strength score.
- Return evidence-specific reasons that expose matched claim terms, tags, metrics, verified source state, and quantified proof.
- Keep unrelated evidence out of suggestions even when it has high strength and source verification.
- Add focused regression coverage for ranking and unrelated-evidence rejection.

Verification:
- `npm test -- evidence.test.ts` passed with 53 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 85 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue improving section and criteria-level evidence suggestions so they use the same richer scoring signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Criteria-Aware Evidence Suggestions

Status: implemented and verified.

Purpose: make evaluation-criteria evidence suggestions use the actual scoped criterion text instead of returning generic high-strength approved evidence.

Changes in this slice:
- Read the requested evaluation criterion from `rfpRequirements` with organization and assigned-opportunity scoping.
- Build criteria scoring text from requirement number, title, body, source section, category, key terms, suggested approach, and tags.
- Reuse the multi-signal evidence scorer with criteria-specific reason text.
- Return no suggestions when the criterion is not visible and exclude unrelated high-strength evidence.

Verification:
- `npm test -- evidence.test.ts` passed with 55 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 87 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue improving section-level aggregation so duplicate evidence can preserve the strongest per-claim rationale.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Section Evidence Rationale Aggregation

Status: implemented and verified.

Purpose: make section-level evidence suggestions preserve the strongest rationale for duplicate evidence across all claims in the section.

Changes in this slice:
- Aggregate section suggestions by evidence ID with a map instead of first-seen duplicate suppression.
- Replace an existing duplicate suggestion when a later claim produces a higher relevance score.
- Preserve the top-10 relevance sort after duplicate consolidation.
- Add regression coverage where the stronger duplicate rationale arrives after a weaker one.

Verification:
- `npm test -- evidence.test.ts` passed with 56 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 88 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing evidence and readiness workflows for generic placeholder logic that can produce plausible but unsupported recommendations.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Requirement-Aware Evidence Matrices

Status: implemented and verified.

Purpose: make generated evidence matrices reflect the opportunity's actual RFP requirements instead of hardcoded generic rows.

Changes in this slice:
- Build requirements and evaluation-criteria matrix rows from scoped `rfpRequirements` for the opportunity.
- Fall back to generic rows only when no extracted requirements are available.
- Match evidence cells by both evidence type and row-specific requirement text using the deterministic evidence scorer.
- Store cell notes with the top matching rationale and preserve assigned-opportunity scoping for requirement, usage, and matrix reads.

Verification:
- `npm test -- evidence.test.ts` passed with 57 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 89 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing generated readiness artifacts for hardcoded demo defaults that should come from opportunity-specific data.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Context-Aware Claim Quantification

Status: implemented and verified.

Purpose: make claim quantification suggestions deterministic and evaluator-facing instead of emitting unresolved metric placeholder text.

Changes in this slice:
- Use optional context when detecting claim quantification patterns such as uptime, availability, savings, and efficiency.
- Generate quantified uptime and savings wording even when the original claim lacks replaceable adjectives.
- Replace the generic `(add specific metrics here)` fallback with dated performance record, delivery example, and outcome-data language.
- Add regression coverage for context-driven metric selection and placeholder-free fallback output.

Verification:
- `npm test -- evidence.test.ts` passed with 59 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 91 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing generated response-support text for unresolved placeholders or generic evaluator-facing claims.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Compliance Cross-Reference Gap Detection

Status: implemented and verified.

Purpose: make compliance cross-reference diagnostics inspect scoped response document sections instead of returning empty placeholder findings.

Changes in this slice:
- Load response documents through scoped `proposalDocuments` joins before compliance cross-reference analysis.
- Populate missing-reference findings with ranked suggested response sections using the existing requirement-section scorer.
- Detect over-referenced requirements by counting requirement-number mentions across response sections.
- Add regression coverage for suggested missing-reference sections and duplicate reference detection.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 4 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 93 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing compliance automation placeholders, especially automatic link creation for high-confidence requirement-section matches.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Compliance Auto-Linking

Status: implemented and verified.

Purpose: make automatic requirement linking create scoped compliance references for high-confidence response-section matches instead of returning a zero-result stub.

Changes in this slice:
- Load the scoped response document and active compliance matrix for the document's opportunity.
- Score unlinked compliance entries against response sections with the existing requirement-section matcher.
- Persist high-confidence links to compliance entries and matching RFP requirements with response document, section, confidence, and rationale metadata.
- Return explicit unlinked reasons for already-linked, not-applicable, no-match, and below-threshold requirements.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 95 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing compliance automation for stale matrix statistics after bulk auto-link operations.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Auto-Link Matrix Statistics Refresh

Status: implemented and verified.

Purpose: keep compliance matrix summary counters current after automatic response-section linking.

Changes in this slice:
- Recalculate compliance matrix statistics after successful automatic links.
- Reuse the existing centralized matrix stats helper instead of duplicating counter logic.
- Extend auto-link regression coverage to prove partial counts and mandatory coverage are refreshed after linking.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 95 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing bidirectional compliance validation for orphaned response sections and unresolved cross-reference targets.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Bidirectional Compliance Section Analysis

Status: implemented and verified.

Purpose: make bidirectional compliance validation analyze actual response sections and unknown requirement references instead of only reporting requirements with missing response references.

Changes in this slice:
- Load scoped response documents for the compliance matrix opportunity.
- Populate missing-response requirements with ranked suggested response sections.
- Identify response sections that have no matching requirement in the matrix.
- Detect requirement-number references in response text that do not correspond to a matrix requirement.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 7 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 96 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing generic proposal/support narratives with opportunity-specific evidence and source references.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Response Source Citation Maps

Status: implemented and verified.

Purpose: make deterministic live response drafts carry explicit source citation maps instead of relying on a review reminder to replace generic claims later.

Changes in this slice:
- Add a `Source Citation Map` section to every generated live response draft.
- List source requirement IDs, source sections, evaluator criterion IDs, evaluation weights, and quoted source text per draft.
- Replace the generic “replace generic claims” review gate with a concrete requirement to verify the source citation map against the compliance matrix and response narrative.
- Add regression coverage proving generated drafts include source citation maps and no longer contain the generic-claim gate text.

Verification:
- `npm test -- live-response-package.test.ts` passed with 9 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue strengthening generated live response drafts with deeper evidence citation and rendered artifact checks.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Source Citation Readiness Gate

Status: implemented and verified.

Purpose: prevent live response packages from being marked ready when generated drafts lose their source citation maps.

Changes in this slice:
- Add `sourceCitationCoverage` to live response readiness metrics.
- Require every draft to include a `Source Citation Map` containing its assigned source requirement and evaluator criterion IDs.
- Block readiness and emit warnings when any draft has incomplete citation mapping.
- Add regression coverage proving missing citation maps block readiness.

Verification:
- `npm test -- live-response-package.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue strengthening generated live response drafts with richer evidence citations and rendered artifact checks.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence Citation Readiness Gate

Status: implemented and verified.

Purpose: make generated live response drafts carry auditable Datacraft evidence citations and fail readiness if those citations are missing.

Changes in this slice:
- Add a `Datacraft Evidence Citation Map` section to every generated live response draft.
- Tie each assigned snippet shortcut to its evidence name, category, and intended use in the response.
- Add `evidenceCitationCoverage` to response readiness metrics.
- Block readiness and emit warnings when any draft lacks complete evidence citation mapping.

Verification:
- `npm test -- live-response-package.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue strengthening generated live response packages with rendered artifact checks and persistence proof once database connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Firecrawl Document Link Intake

Status: implemented and verified.

Purpose: keep Firecrawl-enriched opportunity discovery from losing tender attachment links before the RFP intake and response bridge can use them.

Changes in this slice:
- Request Firecrawl `links` for top SearXNG result enrichment.
- Preserve ranked discovered document links in opportunity discovery metadata.
- Seed bounded source-document rows for high-signal discovered tender attachments, while keeping low-signal documents out of selected intake.
- Retain the highest-ranked document link as the opportunity `documentUrl` for existing downstream RFP workflows.

Verification:
- `npm test -- __tests__/actions/discovery-opportunity-import.test.ts --run` passed with 23 tests.
- `npm test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts __tests__/api/opportunity-discovery-presets-route.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/services/rfp-document-service.test.ts --run` passed with 48 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed with 61 tests.

Remaining after this slice:
- Continue strengthening source-document intake with live persisted proof once database connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Response Draft Artifact Integrity

Status: implemented and verified.

Purpose: ensure generated live response packages cannot be marked ready when draft artifact manifests are missing or stale.

Changes in this slice:
- Add deterministic markdown artifact manifests to every generated live response draft.
- Track draft artifact filename, hash, byte size, and generation timestamp alongside each draft.
- Add `draftArtifactIntegrityCoverage` to response package readiness metrics and block readiness when draft content no longer matches its artifact manifest.
- Make the live response-readiness proof write, read back, and hash-check each draft artifact before recording proof evidence.

Verification:
- `npm test -- __tests__/services/live-response-package.test.ts --run` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 12 tests.

Remaining after this slice:
- Continue extending artifact integrity checks into DB-backed persisted import-response proof once PostgreSQL connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Persisted Import-Response Recheck

Status: externally blocked.

Purpose: recheck whether the DB-backed live persisted import-to-response proof can now complete after discovery intake and response artifact integrity hardening.

Result:
- Ran `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Proof run `live_persisted_import_response_20260527T114834Z` failed before source discovery or persistence because PostgreSQL refused the connection: `connect ECONNREFUSED 88.80.188.224:5432`.
- No cleanup rows were needed because the proof failed before inserts.

Remaining after this recheck:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Continue non-DB hardening while the persisted live proof remains externally blocked.

### 2026-05-27 - Persisted Response Draft Integrity Gate

Status: implemented and verified.

Purpose: carry draft artifact integrity from generated live response packages into the tenant-backed response package readiness, final rendering, and final submission gates.

Changes in this slice:
- Add draft artifact manifests to requirement-aware persisted proposal drafts.
- Add `draftArtifactIntegrityCoverage` to tenant response package readiness metrics.
- Block response package readiness when a persisted draft artifact manifest is missing or stale.
- Require current draft artifact integrity receipts before final artifact rendering.
- Add a final submission checklist item for response draft artifact integrity.

Verification:
- `npm test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/final-submission-checklist-workflow.test.ts --run` passed with 42 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate --run wave9-response-readiness-package` passed with 35 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 180 tests.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue non-DB hardening around live discovery, source intake, response quality, and submission gates.

### 2026-05-27 - Draft Integrity Operator Visibility

Status: implemented and verified.

Purpose: make response draft artifact integrity visible in operator surfaces, not only enforced by backend readiness and submission gates.

Changes in this slice:
- Include draft artifact integrity coverage in response package workflow readiness descriptions.
- Route draft artifact integrity language into the command-center response-quality readiness dimension.
- Include draft artifact integrity in the proposal document readiness label shown before final rendering.

Verification:
- `npm test -- __tests__/actions/work-items-command-center.test.ts __tests__/work-items/projections.test.ts __tests__/components/ProposalDocumentsWinThemeSeedReview.test.ts --run` passed with 7 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue hardening operator-visible proof and remediation loops while DB-backed live persistence remains blocked by PostgreSQL connectivity.
