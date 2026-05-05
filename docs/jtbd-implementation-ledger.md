# JTBD Implementation Ledger

Generated from `.omx/plans/full-jtbd-enhancements-implementation-plan.md` during Wave 0.

This ledger is the execution register for promoting JTBD and enhancements. It records the owning wave, dependency waves, domain owner, subject type, target surface, current support, implementation owner, and proof row. The facility pass authority remains canonical in `.omx/state/platform-e2e-facility-ledger.md`.

## Status Promotion Rule

Rows may move to `Live` only when the matching implementation wave has:

- implemented the workflow/state or explicit non-workflow rationale;
- surfaced the job in the relevant UI;
- enforced authz/authority and audit;
- projected tasks/work items where human action is required;
- implemented SLA, notifications, portal visibility, and reversal semantics where applicable;
- passed the proof target listed here and the corresponding facility-ledger row/subrow.

## JTBD Ledger

| ID | Current support | Primary wave | Dependency waves | Domain owner | Subject type | Target screen | Implementation owner | Proof target |
|---|---|---:|---|---|---|---|---|---|
| JTBD-001 | Partial | 2 | none | Discovery | scraper_source/run | Opportunity sources / operations | Wave 2 discovery lane | F-002, O-009 |
| JTBD-002 | Live | 2 | none | Discovery | opportunity_search/shortlist | Opportunities / command center | Wave 2 discovery lane | F-001 |
| JTBD-003 | Partial | 2 | none | Discovery / notifications | opportunity_digest | Inbox / notifications / digest settings | Wave 2 discovery lane | F-002, O-006 |
| JTBD-004 | Partial | 2 | none | Discovery to RFP | rfp_intake | Opportunity detail / RFP intake wizard | Wave 2 RFP lane | F-005B, F-007 |
| JTBD-005 | Partial | 2 | none | Discovery analysis | opportunity_analysis | Opportunity analysis panel | Wave 2 discovery lane | F-003, F-004A |
| JTBD-006 | Live | 2 | none | Capture pipeline | opportunity_stage | Pipeline / command center | Wave 2 capture lane | F-003 |
| JTBD-007 | Partial | 6 | none | Capture decision | bid_decision_package | Bid/no-bid package / gate cards | Wave 6 approval lane | F-003, F-014B |
| JTBD-008 | Partial | 6 | none | Gate reviews | gate_review | Gate review panel / inline approval cards | Wave 6 approval lane | F-014B |
| JTBD-009 | Live | 2 | 7 | Capture activities | capture_activity | Capture activity timeline | Wave 2 capture lane | F-003, F-015 |
| JTBD-010 | Partial | 2 | 7 | Milestones/deadlines | deadline/milestone | Calendar / command center timeline | Wave 2 deadline lane | F-003, O-005 |
| JTBD-011 | Partial | 2 | none | RFP intake | rfp_document | RFP intake wizard | Wave 2 RFP lane | F-005, F-006 |
| JTBD-012 | Partial | 2 | none | RFP parsing | rfp_parse_job | Parse review / source document viewer | Wave 2 RFP lane | F-006B, F-007 |
| JTBD-013 | Partial | 2 | none | Requirements | requirement | Requirements workspace | Wave 2 requirements lane | F-007 |
| JTBD-014 | Partial | 2 | 4 | Requirements assignment | requirement_assignment | Requirements detail / inbox | Wave 2 requirements lane | F-007, F-009 |
| JTBD-015 | Partial | 3 | none | Compliance | compliance_matrix/entry | Compliance matrix | Wave 3 compliance lane | F-008 |
| JTBD-016 | Partial | 3 | 6 | Compliance validation | compliance_gap | Compliance validator / readiness score | Wave 3 compliance lane | F-008, F-020 |
| JTBD-017 | Partial | 3 | none | Compliance reports | compliance_report_package | Compliance report / audit explorer | Wave 3 compliance lane | O-015B |
| JTBD-018 | Planned | 3 | none | Clarifications | clarification | Clarification tracker | Wave 3 compliance lane | F-007, F-008 |
| JTBD-019 | Partial | 4 | none | Proposal planning | proposal_plan | Proposal plan / command center | Wave 4 planning lane | F-009 |
| JTBD-020 | Partial | 4 | none | Task management | proposal_task | Operational inbox / tasks | Wave 4 planning lane | F-009 |
| JTBD-021 | Partial | 4 | none | Workload | assignment/workload_snapshot | Workload dashboard / assignment dialog | Wave 4 planning lane | F-009 |
| JTBD-022 | Live | 5 | none | Authoring | document_section | Document editor / section health | Wave 5 authoring lane | F-011 |
| JTBD-023 | Partial | 5 | none | AI writing | ai_draft | Context-aware writing assistant | Wave 5 authoring lane | F-011, O-013 |
| JTBD-024 | Partial | 5 | 6 | Quality improvement | content_suggestion | Quality improvement panel | Wave 5 authoring lane | F-011, F-014B |
| JTBD-025 | Partial | 4 | 5 | Collaboration | collaboration_session | Document editor / collaboration panel | Wave 4 collaboration lane | F-011, O-003A |
| JTBD-026 | Live | 4 | none | Comments | review_comment | Comments panel / inbox | Wave 4 collaboration lane | F-014A |
| JTBD-027 | Partial | 6 | none | Approvals | document_approval | Inline approval cards / document approval | Wave 6 approval lane | F-014B, F-020 |
| JTBD-028 | Live | 6 | none | Color-team reviews | review_package | Reviews workspace | Wave 6 approval lane | F-014B |
| JTBD-029 | Partial | 3 | none | Evidence | evidence_item | Evidence library / writing assistant | Wave 3 evidence lane | F-018A |
| JTBD-030 | Partial | 3 | none | Claim remediation | claim_gap | Claim remediation panel / inbox | Wave 3 evidence lane | F-018A, O-016A |
| JTBD-031 | Partial | 5 | none | Content library | content_block | Content library | Wave 5 content lane | F-013 |
| JTBD-032 | Live | 5 | none | Templates | template | Templates / template studio | Wave 5 content lane | O-004B, F-013 |
| JTBD-033 | Partial | 5 | none | Company knowledge | company_profile | Company workspace | Wave 5 knowledge lane | F-017, F-013 |
| JTBD-034 | Partial | 5 | none | Personnel | personnel_profile | Personnel workspace | Wave 5 knowledge lane | F-017 |
| JTBD-035 | Partial | 5 | none | Past performance | past_performance_project | Past performance workspace | Wave 5 knowledge lane | F-017 |
| JTBD-036 | Partial | 6 | none | Pricing | pricing_package | Pricing workspace | Wave 6 pricing lane | F-018C |
| JTBD-037 | Partial | 6 | none | Pricing approval | pricing_approval | Pricing approval cards | Wave 6 pricing lane | F-018C, F-021B |
| JTBD-038 | Partial | 5 | none | Competitive intelligence | competitor_profile | Competitive intelligence | Wave 5 strategy lane | F-018B |
| JTBD-039 | Partial | 5 | none | Win themes | win_theme | Win theme builder | Wave 5 strategy lane | F-018B, F-011 |
| JTBD-040 | Partial | 2 | none | PWin analytics | pwin_assessment | Pipeline analytics / command center | Wave 2 analytics lane | F-004A |
| JTBD-041 | Partial | 7 | none | Outcomes | proposal_outcome | Outcomes / lessons dashboard | Wave 7 reporting lane | F-022 |
| JTBD-042 | Partial | 7 | none | CRM | crm_account/contact/deal | CRM workspace | Wave 7 CRM lane | F-015 |
| JTBD-043 | Partial | 7 | none | Partners | partner | Partners workspace | Wave 7 partner lane | F-016 |
| JTBD-044 | Planned | 7 | none | Partner portal | partner_contribution | Partner portal | Wave 7 partner lane | F-016 |
| JTBD-045 | Partial | 6 | none | Presentations | presentation_package | Presentations workspace | Wave 6 production lane | F-018C, F-020 |
| JTBD-046 | Partial | 6 | none | Graphics | graphic_request | Graphics workspace / document insert | Wave 6 production lane | F-018C, F-020 |
| JTBD-047 | Partial | 6 | none | Production formatting | format_validation | Production formatting / final checklist | Wave 6 production lane | F-020 |
| JTBD-048 | Partial | 6 | none | Rendering/export | rendered_artifact | Render/export surface | Wave 6 production lane | F-020 |
| JTBD-049 | Partial | 6 | none | Submission | submission_package | Final submission checklist / concierge | Wave 6 submission lane | F-021B |
| JTBD-050 | Planned | 6 | none | E-signature | signature_request | E-signature workflow | Wave 6 submission lane | F-021B |
| JTBD-051 | Partial | 1 | none | Notifications | notification | Notification center / inbox | Wave 1 control-plane lane | O-006B |
| JTBD-052 | Partial | 2 | 7 | Calendar | calendar_event | Calendar | Wave 2 deadline lane | O-005, F-003 |
| JTBD-053 | Partial | 7 | none | Imports | import_job | Import wizard | Wave 7 integration lane | F-019 |
| JTBD-054 | Partial | 5 | none | Search/RAG | search_index | Search/RAG / writing assistant | Wave 5 AI/search lane | O-014A, F-013 |
| JTBD-055 | Partial | 5 | none | Agents | agent_task | Agent/task orchestration panel | Wave 5 AI/search lane | O-013 |
| JTBD-056 | Partial | 5 | none | AI governance | agent_memory | AI governance / memory settings | Wave 5 AI/search lane | O-013 |
| JTBD-057 | Partial | 1 | none | Workflow design | workflow_template | Workflow template studio | Wave 1 control-plane lane | O-004B |
| JTBD-058 | Partial | 1 | 7 | Workflow runtime | workflow_instance | Workflow runtime / operations | Wave 1 runtime lane | O-003A, O-005 |
| JTBD-059 | Partial | 1 | none | Auth/authorization | permission_policy | Settings / all APIs | Wave 1 security lane | O-001, O-002 |
| JTBD-060 | Partial | 1 | none | Audit/governance | audit_event | Audit explorer | Wave 1 audit lane | O-015A |
| JTBD-061 | Planned/Partial | 7 | none | Integrations | integration_sync | Integrations settings | Wave 7 integration lane | F-019, O-014B |
| JTBD-062 | Partial | 7 | none | API/webhooks | webhook_job | API/webhook admin | Wave 7 integration lane | O-010, O-014B |
| JTBD-063 | Partial | 7 | none | Reporting | dashboard_report | Analytics / command center / operations | Wave 7 reporting lane | F-004B, O-015C |
| JTBD-064 | Partial | 7 | none | Operations | operational_incident | Operations control plane | Wave 7 operations lane | O-010, O-011, O-012B |
| JTBD-065 | Partial | 2 | 7 | Data quality | data_quality_issue | Data quality / operations | Wave 2 data-quality lane | F-002, O-008 |
| JTBD-066 | Strategic | 8 | none | Rule packs | rule_pack | Rule/domain-pack studio | Wave 8 strategic lane | X-003 |
| JTBD-067 | Strategic/Planned | 8 | none | Mobile/offline | offline_action_batch | Mobile/offline surface | Wave 8 strategic lane | X-001 |
| JTBD-068 | Strategic | 8 | none | Finance | payment/revenue_event | Finance workflow | Wave 8 strategic lane | X-002 |
| JTBD-069 | Partial | 5 | none | AI governance | ai_provider_policy | AI governance | Wave 5 AI/search lane | O-013 |
| JTBD-070 | Partial | 3 | 6 | Readiness/accessibility | readiness_score | Readiness score / production checklist | Wave 3 readiness lane | O-016A, F-020, O-016B |
| JTBD-071 | Partial | 3 | none | Privacy/DLP | dlp_finding | Privacy/DLP / export gate | Wave 3 security lane | O-016A |
| JTBD-072 | Partial | 1 | 7 | Support/operations | exception_work_item | Operations inbox | Wave 1 control-plane lane | O-008, O-010 |
| JTBD-073 | Partial | 1 | 8 | Rules/configuration | configuration_rule | Rules/configuration studio | Wave 1 control-plane lane | O-004B, X-003 |
| JTBD-074 | Partial | 7 | none | Migration/remediation | migration_run | Migration/remediation console | Wave 7 operations lane | O-011, O-012B |
| JTBD-075 | Partial | 1 | 6 | Reopen/reversal | workflow_reversal | Workflow action panel / audit explorer | Wave 1 runtime lane | O-003A, O-003B |

## Enhancement Ledger

| ID | Priority | Primary wave | Dependency / extension waves | Target surface | Implementation owner | Proof target |
|---|---:|---:|---|---|---|---|
| UX-001 | P0 | 1 | none | Opportunity detail / command center | Wave 1 UX shell lane | Command-center authenticated browser proof |
| UX-002 | P0 | 2 | none | RFP intake wizard | Wave 2 RFP lane | Discovery-to-parse authenticated browser proof |
| UX-003 | P0 | 1 | 4 | Inbox / tasks | Wave 1 UX shell lane | Inbox E2E + DB proof |
| UX-004 | P0 | 3 | 6 | Command center / final checklist | Wave 3 readiness lane | Readiness blocked/pass tests |
| UX-005 | P0 | 6 | none | Submission concierge | Wave 6 submission lane | Final submission E2E |
| UX-006 | P0 | 1 | 3 | Command center / operations | Wave 1 UX shell lane | Blocker projection tests |
| UX-007 | P0 | 5 | none | Document editor | Wave 5 authoring lane | Editor browser E2E |
| UX-008 | P1 | 2 | none | Command center timeline | Wave 2 timeline lane | Timeline data-source test |
| UX-009 | P1 | 1 | 2, 3, 7 | Action panels | Wave 1 runtime lane | Action-panel E2E |
| UX-010 | P1 | 1 | 7 | Home/dashboard | Wave 1 UX shell lane | Role-based browser tests |
| UX-011 | P1 | 1 | 4 | Inbox | Wave 1 UX shell lane | Inbox integration/E2E |
| UX-012 | P1 | 6 | none | Documents/compliance/pricing/reviews/submission | Wave 6 approval lane | Approval E2E |
| UX-013 | P1 | 5 | none | Editor / AI governance | Wave 5 AI/search lane | AI provenance tests |
| UX-014 | P1 | 5 | none | Content insert dialog / editor | Wave 5 content lane | Snippet browser E2E |
| UX-015 | P1 | 4 | 5, 6 | Document outline / command center | Wave 4 planning lane | Section health E2E |
| UX-016 | P1 | 3 | 5 | Requirements / document / final artifact | Wave 3 traceability lane | Traceability proof |
| UX-017 | P1 | 7 | none | Portal / partners | Wave 7 partner lane | Portal scoped-access E2E |
| UX-018 | P1 | 3 | none | Clarifications workspace | Wave 3 compliance lane | Clarification lifecycle test |
| UX-019 | P1 | 4 | none | Comments / inbox | Wave 4 collaboration lane | Comment-to-task E2E |
| UX-020 | P1 | 1 | none | Workflow templates | Wave 1 control-plane lane | Template governance proof |
| UX-021 | P1 | 1 | 3, 7 | Audit explorer | Wave 1 audit lane | Run reconstruction proof |
| UX-022 | P1 | 1 | 7 | Admin / import / templates / parse | Wave 1 control-plane lane | Sandbox cleanup proof |
| UX-023 | P2 | 8 | 5 | AI governance / outcomes | Wave 8 strategic lane | Memory/outcome tests |
| UX-024 | P2 | 5 | 8 | Competitive / editor | Wave 5 strategy lane | Theme injection E2E |
| UX-025 | P2 | 6 | 8 | Submission | Wave 6 submission lane | Submission lifecycle proof |

## Facility Proof Subrows

The following expanded/split subrows are required proof targets and exist in `.omx/state/platform-e2e-facility-ledger.md` as blocked obligations until their owning waves provide evidence:

`F-004A`, `F-004B`, `F-005B`, `F-006B`, `F-006C`, `F-012B`, `F-014A`, `F-014B`, `F-018A`, `F-018B`, `F-018C`, `F-021B`, `O-003A`, `O-003B`, `O-004B`, `O-006B`, `O-012B`, `O-014A`, `O-014B`, `O-015A`, `O-015B`, `O-015C`, `O-016A`, `O-016B`.
