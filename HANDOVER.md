# Session Handover — 2026-05-18

## Summary

This session ran 2026-05-10 → 2026-05-18 and shipped a complete document-engine / ACL track of work in nine merged PRs (#8–#15 plus one standalone chore commit). Entry context was the just-closed RFP audit (PRs #1–#7) and the question "what's next?" — exit context is a document-engine pipeline that no longer fabricates quality scores, a frontend export flow that actually reaches the backend with proper tenant scoping, and an Agent Composition Language that has been honestly relabelled as experimental rather than pretending to be wired.

The throughline: **stop reporting fictional confidence**. Several subsystems were technically present and tested in isolation but reported success/quality numbers that the orchestration layer had fabricated. Each PR closes one such gap.

## Work Completed

### Tracks A → B → C (the original plan)

| Track | PR | Merge SHA | One-line summary |
|-------|----|-----------|------------------|
| infra | — | `e76878e` | weave entity-level merge driver configured (`.gitattributes`) |
| A.2 | #8 | `13fe342` | `RenderRequest.content_override` field; `DocumentActionsMenu` PDF/DOCX exports send live editor HTML |
| A.1 | #9 | `ffb440e` | BFF route at `/api/v1/documents/[documentId]/render` injects tenant headers; PublishingToolbar PDF/DOCX route through backend; shared client helpers extracted |
| B.fix.1+2+3 | #10 | `a34f4d7` | Phase 2–7 orchestration honesty: fallbacks now signal `phase_successful=False` / `quality_score=None`, real `validation_score` from CrossReferenceManager preserved, BrandFormatter failures propagate instead of being masked |
| C.3 | #11 | `3394709` | Agent Composition Language moved to `docfusion.experimental.composition`; dead `CompositionRunner()` instantiation in `template_endpoints.py` stripped |

### Finishing pass (PRs #12–#15)

| PR | Merge SHA | Closes |
|----|-----------|--------|
| #12 | `46e547f` | `chore(lint)`: dropped removed ruff `show-source = true` key — `make lint` works again |
| #13 | `79f99a2` | TASK-044 (BrandFormatter no-logo path) + TASK-045 (`Optional[float]` quality fields), bundled — three xfail tests now pass cleanly |
| #14 | `02601fd` | `fix(docs)`: PublishingToolbar "Print" routes through `exportToPDF` (print-scoped window) instead of `window.print()` (host-page chrome) |
| #15 | `f33c164` | B.fix.4 (formatter half): `DocumentFormatter.style_coverage` now flows through as `formatting_quality_score` on success path |

### Files created this session

| File | Purpose |
|------|---------|
| `frontend/app/api/v1/documents/[documentId]/render/route.ts` | BFF proxy injecting tenant headers |
| `frontend/lib/document/server-export.ts` | Shared helpers: `MAX_RENDER_CONTENT_BYTES`, `sanitizeRenderFilename`, `describeRenderError`, `triggerBlobDownload` |
| `frontend/__tests__/api/documents-render-route.test.ts` | 12 vitest cases for the BFF route |
| `frontend/__tests__/document/server-export.test.ts` | 13 vitest cases for the helpers |
| `tests/ci/test_render_content_override.py` | 8 pytest cases for the backend field + handler |
| `tests/ci/test_document_engine_phase_honesty.py` | 15 pytest cases pinning the orchestrator's honest-signal contract |
| `src/docfusion/experimental/__init__.py` | Documents the experimental-module promotion contract |
| `src/docfusion/experimental/composition/README.md` | Documents why ACL is parked here and what promotion looks like |
| `backlog/tasks/task-044 - ...md` | BrandFormatter no-logo bug (closed in #13) |
| `backlog/tasks/task-045 - ...md` | BrandFormattingResult typing (closed in #13) |
| `backlog/tasks/task-046 - ...md` | StructureBuilder quality metric (open) |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Tenant headers injected via Next.js BFF route, not raw rewrite | Mirrors `rfp/[rfpId]/parse/route.ts`. Discovered during A.1 review that the wildcard rewrite in `next.config.ts:48` forwards no auth context — both PR #8's `/render` call and PR #9's would silently 401 without an explicit BFF route. |
| `content_override: Optional[str]` with `min_length=1`, `max_length=2_000_000` | Bounds renderer work for authenticated callers — typical proposal HTML is well under 200KB so 10× headroom is ample without opening a DoS surface against pdflatex/Tectonic. |
| Single client-side `triggerBlobDownload` helper | Reviewer caught a Safari/Firefox bug where `URL.revokeObjectURL` in the same tick as `a.click()` drops the download. Helper does `appendChild → click → removeChild → setTimeout(revoke, 0)`. |
| Phase fallbacks return `phase_successful=False` + `quality_score=None` | "Graceful fallback that reports True" is just lying. Aggregator now skips None contributors and surfaces a `"Degraded phases: …"` warning naming each one. |
| `_contribute` aggregator refuses to guess success when no flag matches | Protects against malformed test doubles or future result shapes silently contributing placeholders — exactly the fictional-confidence regression the honesty pass exists to prevent. |
| BrandFormatter failures propagate (B.fix.3) | The previous `if not brand_result.formatting_successful: return synthetic True with 0.87` was the worst pattern in the codebase — masking a known failure as success. Now real failures flow through. |
| ACL moved to `experimental/` rather than deleted | ~2,900 LOC of internally-tested code may anchor a future agent-orchestration feature. The `experimental/` convention says: not a load-bearing dependency. Promotion gates documented in `src/docfusion/experimental/__init__.py`. |
| `Optional[float] = None` for BrandFormattingResult quality fields (TASK-045) | Typed contract now matches honest-signal contract. The orchestrator fallback no longer needs `brand_consistency_score=0.0` — the default flows through and the aggregator skips it via the `formatting_successful=False` gate. |
| Defer StructureBuilder quality scoring (TASK-046) | Picking a formula (coverage × depth × TOC weight) is a product decision, not a coding decision. Fabricating an answer would re-introduce the false-confidence regression that this whole track of work closed out. |
| `xfail(strict=True)` for tests pre-passing only due to masking | Forces the fixer to remove the marker when the underlying bug is closed. Three brand tests xfailed in #10 — all three removed in #13 when TASK-044 shipped. |
| Each PR reviewed by `code-review-expert` before merge | Self-review missed: infinite recursion, workflow ID reuse, path traversal, missing org predicates, the BFF-route 401 in A.2. Reviewer pass is load-bearing, not ceremonial. |

## Bugs & Fixes

| Issue | Cause | Solution | PR |
|-------|-------|----------|----|
| PDF/DOCX exports silently ship stale content | `DocumentActionsMenu` captured `editor.getHTML()` but did not send it to `/render` — backend rendered from storage only | Added `content_override` field on `RenderRequest`; menu sends `editor.getHTML()` | #8 |
| `/render` calls would 401 (latent) | No BFF route at `/api/v1/documents/[documentId]/render` — fetch fell through to wildcard rewrite with no auth headers | Added BFF route mirroring `rfp/parse` pattern with explicit `x-docfusion-user-id` / `x-docfusion-organization-id` injection | #9 |
| PublishingToolbar DOCX produces invalid OOXML | Client-side `exportToDOCX` in `frontend/lib/hdsi/export.ts` generates a 5-file OPC ZIP without proper section refs/numbering | Routed DOCX through `/render` (backend has the audit-fixed real DOCXRenderer) | #9 |
| Browsers drop downloads on Safari/Firefox | `URL.revokeObjectURL` called in same tick as `a.click()` | `triggerBlobDownload` helper defers revoke to next tick with `setTimeout(revoke, 0)` | #9 |
| `documentId` regex allowed path-traversal-like input | `/^[a-zA-Z0-9_.-]{1,128}$/` accepts `..`, `.`, dotfiles | Tightened to require alphanumeric first char: `/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/` | #9 |
| Wedged renderer pins Next.js worker | No timeout on upstream fetch | `AbortSignal.timeout(60_000)` + 504 response with retry-guidance toast | #9 |
| 422 Pydantic validator dumps leaked to user toasts | Frontend surfaced raw `{"detail":[{"loc":[...],"msg":...}]}` from server | `describeRenderError` maps status codes to friendly messages | #9 |
| All quality scores fabricated | Phases 2–7 fallbacks returned `phase_successful=True, score=0.75` regardless of what actually happened | Honesty pass — fallbacks return `False` and `None` | #10 |
| Three phases overwrote real component output | Orchestrator wrote hardcoded `0.85`, `0.89`, `1.0` after calling real components | B.fix.2: stop overwriting; read real `graph.validation_score` from CrossReferenceManager; emit `None` where component has no real measurement | #10 |
| BrandFormatter silently masked failures as success | Lines 711–718: `if not brand_result.formatting_successful: return synthetic True with 0.87` | B.fix.3: propagate the real failure, let the aggregator surface degradation | #10 |
| ACL claimed to be integrated but wasn't | `template_endpoints.py:50` instantiated `CompositionRunner()` that was never invoked; line 572 misleading comment | Strip the import + instantiation + comment; move ACL to `experimental/` | #11 |
| `make lint` broken | `pyproject.toml:275` had `show-source = true` (removed in ruff 0.5+) | Drop the line | #12 |
| BrandFormatter crashes on minimal brand specs | `place_logo` hard-asserts `'primary' in logo_variants` even when no logo configured | `_place_if_available` helper checks first, logs at INFO and skips when missing | #13 |
| BrandFormattingResult quality fields typed as `float = 0.0` despite "no measurement" semantics | Type contract didn't match honest-signal contract | Switched to `Optional[float] = None`; orchestrator fallback no longer needs `0.0` | #13 |
| "Print" menu printed app chrome instead of document | `window.print()` on host page | Route through `exportToPDF` which opens a print-scoped window | #14 |
| `formatting_quality_score` always None even when DocumentFormatter computed a real `style_coverage` | Orchestrator hardcoded `None` to "stay honest" but ignored the real signal that was right there | Read `formatting_result.style_coverage` on the success path | #15 |

## Lessons Learned

- **The wildcard fallback rewrite is a footgun.** `next.config.ts:48` forwards every `/api/v1/:path*` to FastAPI but injects no auth headers. The first reviewer round on A.1 caught that PR #8's freshly-shipped code had the same latent 401 — the BFF route in #9 transparently fixed both. Always add an explicit BFF route for tenant-scoped endpoints; never rely on the rewrite.
- **`code-review-expert` catches what static review misses.** Across this session it surfaced: missing BFF route, missing content-size guard, Safari/Firefox revoke race, regex accepting `..`, missing fetch timeout, `_contribute` defaulting to `True`, the cross-ref fallback indented wrong. Self-review would have missed at least four.
- **Honest `None` beats convenient `0.0`.** When a component has no real measurement, returning `None` lets the aggregator skip it; returning `0.0` averages a fake number in and drags a user-visible metric down. Worth changing typed fields from `float = 0.0` to `Optional[float] = None` even when it touches dataclass surfaces.
- **`xfail(strict=True)` is the right pattern for "test was passing under a now-fixed lie".** When the BrandFormatter masking was removed in #10, three tests started failing — they had been relying on the masking. Marking them `xfail(strict=True)` documents the gap, lets the suite stay green, and forces the next person who fixes the underlying bug to remove the xfail. #13 closed the bug; the markers came off.
- **Don't fabricate metrics to "finish" a track.** B.fix.4 had two halves — formatter had a real signal (`style_coverage`) and shipped in #15; structure didn't and was filed as TASK-046. Guessing a formula would have undone the honesty pass.
- **Working-tree `git status` always shows storage artifacts.** `storage/search/*.pkl`, `storage/documents/**`, `storage/indexes/**` regenerate every render-touching test run. Never `git add .` or `-A`; always stage explicit paths.
- **Pyright noise is heavy in this codebase.** Most files surface 5-15 pre-existing diagnostics (uuid7str resolution, FormattingResult monkey-patched attrs, Pydantic dataclass protocol mismatches). Filter by `error TS` / new diagnostics matching your changed files; ignore the rest.
- **`backlog` CLI closes cleanly.** `backlog task edit N -s Done --notes "..."` writes the notes to the markdown file and shows up in `task list`. Use for genuinely deferred work, not for minor in-PR observations (those go in the PR body).

## Current State

### Branch
`main` at `f33c164` (post-#15 merge). Clean working tree apart from auto-regenerated storage artifacts.

### Test posture
- **Backend** (`tests/ci/`): document-engine + render-adjacent passes — 70+ in the focused sweep, **0 xfailed** (down from 3 pre-#13). RFP-area tests have 15 pre-existing failures verified against clean `main` — same 15 fail there. Unrelated to any current work.
- **Frontend** (`frontend/__tests__/`): 656+ pass, no new regressions introduced this session.

### What's done
All A → B → C tracks shipped. All outstanding follow-ups from those tracks shipped except the structure half of B.fix.4 (filed as TASK-046).

### What's in progress
Nothing live in this session's tracks. Note: **TASK-012** (Phase 2: Unify `requirements` and `rfpRequirements` tables) is marked "In Progress" in the backlog from prior work — its status here is unchanged.

### What's blocked
Nothing.

## Outstanding Work — Full View

### From this session

| ID | Priority | What | What's needed |
|----|----------|------|--------------|
| TASK-046 | unset | StructureBuilder real quality score metric | **Product decision** on what "structure quality" means (coverage vs depth vs TOC vs validation). Implementation pattern is identical to PR #15. |

### Pre-existing backlog (not touched this session)

| ID | Priority | Status | Description |
|----|----------|--------|-------------|
| TASK-036 | HIGH | To Do | Phase 6: Execute inherited production-readiness plan |
| TASK-012 | HIGH | In Progress | Phase 2: Unify `requirements` and `rfpRequirements` tables — pre-existing carry-forward |
| TASK-042 | MEDIUM | To Do | Phase 6: Observability dashboards for runtime |
| TASK-041 | LOW | To Do | Phase 6: Agent memory TTL cleanup job |

### RFP audit carry-forwards from the closed 2026-05-10 work

Documented in `~/.claude/projects/-Users-nyimbiodero-src-pjs-docfusion/memory/audit-completion-2026-05.md`. None are this session's responsibility but the next session should be aware:

- **`proposalTasks` table needs `organization_id`** — TODO(W2) in `transitionRequirementWorkflow`
- **`workflow-domain.ts` non-RFP-domain tables** (`gateReviews`, `proposalReviews`, etc.) need tenant predicates — same pattern as W1 but for adjacent domains
- **Stakeholder dataclasses → Pydantic v2 conversion** (audit High #21)
- **DB-driven alerts in `_generate_alerts`** (sync→async cascade) — full DB query deferred
- **Blob storage swap** from local disk → `SecureStorageService` (W3c-carry; storage key already aligned)
- **Next.js write path decision** — legacy routes at `frontend/app/api/v1/rfp/...` still write to the same Postgres tables as the canonical Python path; delete or keep as fallback?

### Lingering local state

- **`stash@{0}`** from W0 setup (April 2026) — harmless ralph-state.json. `git stash drop stash@{0}` if it clutters output.

## Do's and Don'ts

### DO ✅

- **DO use the `code-review-expert` agent before every merge.** Every PR in this session passed through at least one reviewer round; multiple caught real blocking issues. Brief with: PR scope, what you specifically want checked, past reviewer wins to apply the same lens to. See #9 / #10 / #13 commit messages for examples.
- **DO add BFF routes for tenant-scoped endpoints.** Mirror `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`: `requireRouteTenantContext()` → upstream `fetch` with `x-docfusion-user-id` / `x-docfusion-organization-id` injected. Never rely on `next.config.ts`'s wildcard rewrite for auth.
- **DO use the shared helpers in `frontend/lib/document/server-export.ts`** when adding new server-rendered export flows. `triggerBlobDownload` handles the Safari/Firefox revoke race; `describeRenderError` masks raw Pydantic 422 leaks; `sanitizeRenderFilename` handles all-emoji / all-CJK / all-whitespace titles.
- **DO stage commits with explicit file paths.** `git add path/to/file` — never `git add .` or `-A`. The user is meticulous about diffs; storage artifacts will pollute commits if you stage broadly.
- **DO read recent memory before answering "what's next?"** `~/.claude/projects/-Users-nyimbiodero-src-pjs-docfusion/memory/MEMORY.md` is auto-loaded; linked files describe current architecture, past collaboration patterns, and infra. Verify memory against current code before asserting — it may have drifted.
- **DO update memory after a track ships.** Add a `<topic>-<yyyy-mm>.md` file under the memory dir, add a one-line pointer to `MEMORY.md`. Index lines stay under ~150 chars.
- **DO check the backlog CLI** (`backlog task list --plain`) when picking next work. Tasks 036, 041, 042 are pre-existing Phase-6 items the prior session was tracking but didn't touch.
- **DO honor user's terse-choice format.** The user picks scope by replying with a single letter / number / one short phrase. Lay out 2–4 labelled options with one-line tradeoffs and a recommendation. They reply with the label. Don't ask follow-up questions unless genuinely necessary.
- **DO match the project's tabs convention.** All Python source uses tabs (per `pjs/docfusion/CLAUDE.md`), which overrides ruff's `pyproject.toml` indentation setting. Preserve whatever's already in the file when editing; don't normalize.

### DON'T ❌

- **DON'T fabricate quality scores to "finish" a phase.** The whole document-engine honesty pass closed out a system that did exactly this. If a component has no real signal, emit `None` and let the aggregator skip it. File a backlog task for the missing metric.
- **DON'T mask failures as success in orchestration code.** The pattern `if not result.successful: return synthetic_True_result` was the worst bug class this session closed. Propagate the failure; let downstream consumers decide what to do.
- **DON'T `git add .` or `-A`.** Storage artifacts (`storage/search/*.pkl`, `storage/documents/06/9f/**`, `storage/indexes/catalog/*.json`) regenerate every test run. The `.gitattributes` weave config is now committed but the runtime artifacts must stay out.
- **DON'T re-introduce `window.print()`** on the host page in `PublishingToolbar`. PR #14 routed it through `exportToPDF` deliberately — printing the host page captures the app chrome.
- **DON'T touch `src/docfusion/experimental/composition/`** without explicit framing. It's deliberately parked. If a real composition workflow ships, the promotion contract in `src/docfusion/experimental/__init__.py` describes the gates (production caller + e2e test + deliberate decision).
- **DON'T propose hosted CI.** Per `memory/ci-removed-local-only.md`: GitHub Actions workflows were intentionally deleted (PR #7, 2026-05-10). Quality gates run locally. Ask before suggesting any CI/CD platform.
- **DON'T amend or admin-merge silently.** When a PR has CI failures unrelated to the diff, surface the cause and ask before `gh pr merge --admin`. The user has approved admin-merge in two specific cases (PR #6, PR #7) but expects it surfaced as an option, not as default.
- **DON'T propose new dependencies for one assertion.** `triggerBlobDownload` is not unit-tested because the project default vitest env is `node` without jsdom. Adding jsdom for one assertion was the wrong trade — the comment in `__tests__/document/server-export.test.ts` documents the gap.
- **DON'T leave dead code with comments claiming it's wired.** PR #11 removed a `CompositionRunner()` instantiation in `template_endpoints.py` and a "Generate document through composition runner if complex workflow" comment that lied about the actual code path. If a feature isn't wired, say so.
- **DON'T touch the lingering W0 stash** unless cleaning up explicitly. `stash@{0}` is harmless; the user knows about it.

## Important Files

### Backend (Python / FastAPI)
| File | Description |
|------|-------------|
| `src/docfusion/api/endpoints/document_endpoints.py` | FastAPI `/render` handler; uses `content_override` from `RenderRequest` |
| `src/docfusion/api/serializers/document_serializers.py` | `RenderRequest` model; `content_override: Optional[str]` with `min_length=1, max_length=2_000_000` |
| `src/docfusion/document_engine/document_engine.py` | Phase 2–7 orchestration with the honest aggregator (`_execute_quality_validation` + `_contribute` helper); fallbacks return `phase_successful=False, quality_score=None` |
| `src/docfusion/document_engine/formatter/brand_formatter.py` | `_apply_logo_placements` uses `_place_if_available` helper; `BrandFormattingResult` quality fields are `Optional[float] = None`; module-level `logger` added |
| `src/docfusion/document_engine/formatter/document_formatter.py` | Computes `style_coverage` at ~line 274; real signal that flows into `formatting_quality_score` |
| `src/docfusion/experimental/composition/` | Agent Composition Language (parked); promotion gates in `__init__.py` |
| `tests/ci/test_render_content_override.py` | 8 cases for the backend field + handler |
| `tests/ci/test_document_engine_phase_honesty.py` | 15 cases pinning the honest-signal contract |

### Frontend (Next.js + TypeScript)
| File | Description |
|------|-------------|
| `frontend/app/api/v1/documents/[documentId]/render/route.ts` | BFF proxy with tenant header injection, 60s timeout, sanitized `documentId` regex |
| `frontend/lib/document/server-export.ts` | Shared helpers: `MAX_RENDER_CONTENT_BYTES`, `sanitizeRenderFilename`, `describeRenderError`, `triggerBlobDownload` |
| `frontend/components/document/DocumentActionsMenu.tsx` | PDF/DOCX exports POST `content_override: editor.getHTML()` via the BFF; uses shared helpers |
| `frontend/components/document/PublishingToolbar.tsx` | PDF/DOCX exports POST via BFF; Print uses `exportToPDF` for print-scoped window |
| `frontend/lib/hdsi/export.ts` | Client-side HDSI serializer; `exportToHTML` is the document-shape transformer fed to the backend; `exportToPDF` opens print-scoped window |
| `frontend/__tests__/api/documents-render-route.test.ts` | 12 cases for the BFF route |
| `frontend/__tests__/document/server-export.test.ts` | 13 cases for the helpers |

### Config / Infra
| File | Description |
|------|-------------|
| `.gitattributes` | 45-pattern weave entity-level merge driver setup |
| `pyproject.toml` | ruff config (with `show-source` removed) |
| `frontend/next.config.ts` | Wildcard rewrite at line 48 — DO NOT rely on for auth |
| `frontend/lib/auth/route-tenant.ts` | `requireRouteTenantContext()` — the pattern every BFF route uses |
| `frontend/lib/auth/tenant-context.ts` | Resolves `userId` + `organizationId` from session |

### Backlog
| File | Status | Description |
|------|--------|-------------|
| `backlog/tasks/task-044 - BrandFormatter-must-handle-brand-specs-with-no-logo.md` | Done | Closed in #13 |
| `backlog/tasks/task-045 - BrandFormattingResult-quality-fields-should-be-Optionalfloat.md` | Done | Closed in #13 |
| `backlog/tasks/task-046 - StructureBuilder-needs-a-real-quality-score-metric.md` | To Do | Needs product decision |

## Notes for Next Claude

### Read these first
1. `~/.claude/projects/-Users-nyimbiodero-src-pjs-docfusion/memory/MEMORY.md` — auto-loaded index
2. `~/.claude/projects/-Users-nyimbiodero-src-pjs-docfusion/memory/document-engine-2026-05.md` — this session's track in detail
3. `~/.claude/projects/-Users-nyimbiodero-src-pjs-docfusion/memory/working-patterns.md` — how the user collaborates

### Honesty principle (most important)
The throughline of this session: **stop reporting fictional confidence**. Whenever you see a quality score, success flag, or metric, ask whether it's a real measurement from a component or a placeholder the orchestrator wrote. Placeholder → `None` (and skip in aggregation), not a plausible-looking constant.

This applies to every future addition to the document engine, not just historical cleanup.

### Reviewer cadence
Every PR in this session got at least one `code-review-expert` round. Several caught real bugs that would have shipped. Treat reviewer pass as load-bearing — when verdict is `NEEDS-CHANGES` or `BLOCK`, fix findings and re-dispatch. When `OK-WITH-NITS`, fix strong nits and decide on the rest. Self-approval is not a substitute.

### Push / merge authorization
The user has explicitly authorized push + merge for this session's tracks ("1" was their pick early, meaning "push, merge, then move on"). Per global CLAUDE.md, push is still an action that warrants surfacing — but the user has shown they want completion, not pause. Confirm via terse-choice format if a track's scope is unclear.

### Storage artifacts
The 489–709 "uncommitted changes" warnings from `gh pr create` were always `storage/search/*.pkl` + `storage/documents/06/9f/**` + `storage/indexes/catalog/*.json`. They regenerate on every test run. Leave alone.

### Brand formatter known gotcha
PR #13 fixed the no-logo path but `_apply_logo_placements` still only handles `primary` and `icon` variant names — those are hardcoded. If a future brand template wants other variant names (e.g., `wordmark`, `monogram`), the helper needs widening.

### B.fix.4 deferred half (TASK-046)
Needs a product decision before code. Options to surface to the user (when relevant):
- Pure coverage ratio: `sections_built / content_blocks_provided`
- Coverage + hierarchy bonus (sections at multiple depths > sections at one depth)
- Coverage + TOC bonus (`generated_toc` populated → +0.1)
- Validation-weighted: 1.0 minus 0.1 per warning, 0.0 if structure invalid

Don't pick one unilaterally. Surface tradeoffs and let the user choose.

### What "finish all outstanding work" means
The user said this twice this session, and both times it meant "address everything that's actionable now, defer everything that needs external input as a backlog task." Don't fabricate to close out work. The honesty pass is the model: ship the half you can defend, file the half you can't.

### Open RFP audit carry-forwards
Not this session's responsibility, but `memory/audit-completion-2026-05.md` lists six items the prior session deferred. Most likely to surface if the user picks RFP work next:
1. **proposalTasks needs organization_id** — TODO(W2) marker in `transitionRequirementWorkflow`
2. **Stakeholder dataclasses → Pydantic v2** — clean mechanical work
3. **Next.js write path decision** — legacy routes still write to the same tables as the canonical Python path
