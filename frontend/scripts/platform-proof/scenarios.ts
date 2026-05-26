export type ProofScenarioKind = "unit" | "typecheck" | "browser" | "integration" | "live-safe";

export interface ProofScenarioCommand {
	command: string;
	args: string[];
	cwd?: string;
}

export interface ProofScenarioDefinition {
	id: string;
	wave: number;
	title: string;
	kind: ProofScenarioKind;
	proofTargets: string[];
	requiresLiveServices: boolean;
	description: string;
	command: ProofScenarioCommand;
	expectedArtifacts: string[];
}

export const PLATFORM_PROOF_SCENARIOS: ProofScenarioDefinition[] = [
	{
		id: "wave0-proof-core-unit",
		wave: 0,
		title: "Wave 0 proof harness unit coverage",
		kind: "unit",
		proofTargets: ["wave0-proof-harness"],
		requiresLiveServices: false,
		description: "Validates proof run IDs, evidence rows, object-key namespacing, JSON artifacts, and cleanup summaries.",
		command: {
			command: "npm",
			args: ["test", "--", "platform-proof-core.test.ts"],
		},
		expectedArtifacts: ["vitest:platform-proof-core"],
	},
	{
		id: "wave0-frontend-typecheck",
		wave: 0,
		title: "Wave 0 frontend typecheck",
		kind: "typecheck",
		proofTargets: ["wave0-typecheck"],
		requiresLiveServices: false,
		description: "Ensures the platform proof harness and wired scripts compile under the frontend TypeScript project.",
		command: {
			command: "npx",
			args: ["tsc", "--noEmit", "--pretty", "false"],
		},
		expectedArtifacts: ["tsc:noEmit"],
	},
	{
		id: "wave0-workflow-runtime-core",
		wave: 0,
		title: "Wave 0 workflow runtime and API auth coverage",
		kind: "integration",
		proofTargets: ["O-003", "O-004", "O-011", "O-016"],
		requiresLiveServices: false,
		description: "Validates durable workflow runtime transitions, SLA escalation, portal visibility, scheduler auth, and workflow API authority denials.",
		command: {
			command: "npm",
			args: ["test", "--", "workflow-runtime.test.ts", "api-auth.test.ts", "workflow-start-route.test.ts"],
		},
		expectedArtifacts: ["vitest:workflow-runtime", "vitest:workflow-api-auth", "vitest:workflow-start-route"],
	},
	{
		id: "wave1-control-plane-browser",
		wave: 1,
		title: "Wave 1 control-plane browser coverage",
		kind: "browser",
		proofTargets: ["O-003A", "O-006B", "UX-003", "UX-009", "UX-011"],
		requiresLiveServices: false,
		description: "Exercises operational inbox acknowledgement/retry and workflow remediation actions in Playwright.",
		command: {
			command: "npm",
			args: ["run", "test:e2e", "--", "wave1-control-plane.spec.ts"],
		},
		expectedArtifacts: ["playwright:wave1-control-plane"],
	},
	{
		id: "wave1-audit-export-api",
		wave: 1,
		title: "Wave 1 audit export API coverage",
		kind: "integration",
		proofTargets: ["O-015A", "UX-021"],
		requiresLiveServices: false,
		description: "Validates scoped workflow audit CSV export and authorization failure handling.",
		command: {
			command: "npm",
			args: ["test", "--", "workflow-audit-export.test.ts", "workflow-audit-export-route.test.ts"],
		},
		expectedArtifacts: ["vitest:workflow-audit-export", "vitest:workflow-audit-export-route"],
	},
	{
		id: "wave1-role-homepage",
		wave: 1,
		title: "Wave 1 role homepage coverage",
		kind: "browser",
		proofTargets: ["UX-010", "UX-011"],
		requiresLiveServices: false,
		description: "Validates persona selection, role-focused work projection, quick links, and browser rendering for role homepages.",
		command: {
			command: "npm",
			args: ["run", "test:e2e", "--", "role-homepage.spec.ts"],
		},
		expectedArtifacts: ["playwright:role-homepage"],
	},
	{
		id: "wave1-portal-workflows-browser",
		wave: 1,
		title: "Wave 1 portal workflow browser coverage",
		kind: "browser",
		proofTargets: ["UX-010", "P-001", "P-002"],
		requiresLiveServices: false,
		description: "Validates portal-visible workflow summaries, scoped action labels, and partner action links in the portal queue.",
		command: {
			command: "npm",
			args: ["run", "test:e2e", "--", "portal-workflows.spec.ts"],
		},
		expectedArtifacts: ["playwright:portal-workflows"],
	},
	{
		id: "wave2-rfp-upload-preflight",
		wave: 2,
		title: "Wave 2 RFP upload preflight coverage",
		kind: "integration",
		proofTargets: ["F-005B", "F-006", "O-007", "UX-002"],
		requiresLiveServices: false,
		description: "Validates RFP upload metadata checks, security preflight findings, SHA-256 receipt metadata, and E3 handoff behavior.",
		command: {
			command: "npm",
			args: ["test", "--", "rfp-upload-validation.test.ts", "rfp-upload-route.test.ts"],
		},
		expectedArtifacts: ["vitest:rfp-upload-validation", "vitest:rfp-upload-route"],
	},
	{
		id: "wave2-rfp-parse-storage-lifecycle",
		wave: 2,
		title: "Wave 2 RFP parse and storage lifecycle coverage",
		kind: "integration",
		proofTargets: ["F-005", "F-006", "O-007", "UX-002"],
		requiresLiveServices: false,
		description: "Validates RFP parse workflow state, parse route behavior, Linode E3-backed document fetch/readback helpers, and object key safety.",
		command: {
			command: "npm",
			args: ["test", "--", "rfp-parse-workflow.test.ts", "rfp-parse-route.test.ts", "rfp-document-service.test.ts", "linode-e3.test.ts"],
		},
		expectedArtifacts: ["vitest:rfp-parse-workflow", "vitest:rfp-parse-route", "vitest:rfp-document-service", "vitest:linode-e3"],
	},
	{
		id: "wave3-compliance-evidence-readiness",
		wave: 3,
		title: "Wave 3 compliance, evidence, and readiness coverage",
		kind: "integration",
		proofTargets: ["F-009", "F-010", "F-011", "F-012", "UX-004", "UX-016"],
		requiresLiveServices: false,
		description: "Validates compliance entry lifecycle, requirement gates, evidence workflows, unsupported claim remediation, and DLP blocking behavior.",
		command: {
			command: "npm",
			args: ["test", "--", "compliance-entry-workflow.test.ts", "requirements-workflow.test.ts", "claim-remediation.test.ts", "evidence.test.ts", "dlp-policy.test.ts"],
		},
		expectedArtifacts: ["vitest:compliance-entry-workflow", "vitest:requirements-workflow", "vitest:claim-remediation", "vitest:evidence", "vitest:dlp-policy"],
	},
	{
		id: "wave4-planning-collaboration-tasks",
		wave: 4,
		title: "Wave 4 planning, collaboration, and task workflow coverage",
		kind: "integration",
		proofTargets: ["F-013", "F-014", "UX-003", "UX-011"],
		requiresLiveServices: false,
		description: "Validates proposal task workflow projection, review comment resolution, and clarification lifecycle handling.",
		command: {
			command: "npm",
			args: ["test", "--", "proposal-task-workflow.test.ts", "review-comment-workflow.test.ts", "clarification-workflow.test.ts"],
		},
		expectedArtifacts: ["vitest:proposal-task-workflow", "vitest:review-comment-workflow", "vitest:clarification-workflow"],
	},
	{
		id: "wave4-capture-pipeline-scope",
		wave: 4,
		title: "Wave 4 capture pipeline tenant-scope coverage",
		kind: "integration",
		proofTargets: ["F-013", "F-014", "UX-003"],
		requiresLiveServices: false,
		description: "Validates capture pipeline actions, analytics, gates, activities, milestones, and auth checks stay scoped through the owning opportunity tenant.",
		command: {
			command: "npm",
			args: ["test", "--", "pipeline-scope.test.ts", "pipeline-auth.test.ts"],
		},
		expectedArtifacts: ["vitest:pipeline-scope", "vitest:pipeline-auth"],
	},
	{
		id: "wave5-ai-content-governance",
		wave: 5,
		title: "Wave 5 AI and content governance coverage",
		kind: "integration",
		proofTargets: ["F-015", "F-016", "F-017", "UX-008", "UX-019"],
		requiresLiveServices: false,
		description: "Validates AI governance, LiteLLM provider behavior, content governance workflows, snippet provenance, and placeholder resolution.",
		command: {
			command: "npm",
			args: ["test", "--", "ai-governance.test.ts", "content-governance-workflow.test.ts", "snippet-expansion-provenance.test.ts", "snippet-placeholder-resolution.test.ts", "litellm-provider.test.ts"],
		},
		expectedArtifacts: ["vitest:ai-governance", "vitest:content-governance-workflow", "vitest:snippet-expansion-provenance", "vitest:snippet-placeholder-resolution", "vitest:litellm-provider"],
	},
	{
		id: "wave6-final-submission-gate",
		wave: 6,
		title: "Wave 6 final submission hard gate coverage",
		kind: "integration",
		proofTargets: ["F-020", "F-021B", "O-016B", "UX-005", "UX-025"],
		requiresLiveServices: false,
		description: "Validates final checklist blockers for required documents, approvals, artifact hashes, signatures, compliance lock, DLP, and submission creation.",
		command: {
			command: "npm",
			args: ["test", "--", "final-submission-checklist-workflow.test.ts", "submission-workflow.test.ts"],
		},
		expectedArtifacts: ["vitest:final-submission-checklist-workflow", "vitest:submission-workflow"],
	},
	{
		id: "wave6-approval-production-corrections",
		wave: 6,
		title: "Wave 6 approval, production, and correction coverage",
		kind: "integration",
		proofTargets: ["F-018", "F-019", "F-020", "F-021", "O-016"],
		requiresLiveServices: false,
		description: "Validates gate review enforcement, review packages, pricing approval, final artifact workflow, and submission correction semantics.",
		command: {
			command: "npm",
			args: ["test", "--", "gate-review-workflow.test.ts", "review-package-workflow.test.ts", "pricing-approval-workflow.test.ts", "final-artifact-workflow.test.ts", "submission-correction-workflow.test.ts"],
		},
		expectedArtifacts: ["vitest:gate-review-workflow", "vitest:review-package-workflow", "vitest:pricing-approval-workflow", "vitest:final-artifact-workflow", "vitest:submission-correction-workflow"],
	},
	{
		id: "wave7-import-operations-governance",
		wave: 7,
		title: "Wave 7 import and operations governance coverage",
		kind: "integration",
		proofTargets: ["F-022", "F-023", "O-012", "O-013", "O-014", "UX-022"],
		requiresLiveServices: false,
		description: "Validates import preview/execute/rollback governance, scraper workflow exceptions, operational exception sync, and admin route authorization.",
		command: {
			command: "npm",
			args: ["test", "--", "import-governance-workflow.test.ts", "import-execute-route.test.ts", "sandbox-runtime.test.ts", "scraper-workflows.test.ts", "operational-exceptions.test.ts", "competitive-import-route.test.ts", "scraper-admin-routes.test.ts"],
		},
		expectedArtifacts: ["vitest:import-governance-workflow", "vitest:import-execute-route", "vitest:sandbox-runtime", "vitest:scraper-workflows", "vitest:operational-exceptions", "vitest:competitive-import-route", "vitest:scraper-admin-routes"],
	},
	{
		id: "wave8-strategic-capability-workflows",
		wave: 8,
		title: "Wave 8 strategic capability workflow coverage",
		kind: "integration",
		proofTargets: ["S-001", "S-002", "S-003", "UX-018"],
		requiresLiveServices: false,
		description: "Validates competitive win themes, resource reuse, and search/RAG health workflows that support longer-term proposal memory and differentiation.",
		command: {
			command: "npm",
			args: ["test", "--", "competitive-win-theme-workflow.test.ts", "resource-reuse-workflow.test.ts", "search-rag-health.test.ts"],
		},
		expectedArtifacts: ["vitest:competitive-win-theme-workflow", "vitest:resource-reuse-workflow", "vitest:search-rag-health"],
	},
	{
		id: "wave9-discovery-rfp-response-bridge",
		wave: 9,
		title: "Wave 9 discovery-to-response package bridge proof",
		kind: "integration",
		proofTargets: ["F-001", "F-005", "F-008", "F-020"],
		requiresLiveServices: false,
		description: "Runs the focused non-live bridge from discovered opportunity import through source RFP document intake and accepted-requirement response package drafting.",
		command: {
			command: "npm",
			args: [
				"test",
				"--",
				"discovery-opportunity-import.test.ts",
				"opportunity-documents-scope.test.ts",
				"rfp-document-service.test.ts",
				"proposal-documents-scope.test.ts",
			],
		},
		expectedArtifacts: [
			"vitest:discovery-opportunity-import",
			"vitest:opportunity-documents-scope",
			"vitest:rfp-document-service",
			"vitest:proposal-documents-scope",
		],
	},
	{
		id: "wave9-discovery-to-submission-core",
		wave: 9,
		title: "Wave 9 discovery-to-submission core proof",
		kind: "integration",
		proofTargets: ["F-001", "F-005", "F-008", "F-020", "F-021", "UX-025"],
		requiresLiveServices: false,
		description: "Runs the non-live core proof path from opportunity discovery/import through RFP intake, accepted requirements, response package drafting, final artifact readiness, and submission dispatch gates.",
		command: {
			command: "npm",
			args: [
				"test",
				"--",
				"opportunity-discovery-route.test.ts",
				"discovery-opportunity-import.test.ts",
				"document-discovery-agent.test.ts",
				"rfp-document-service.test.ts",
				"rfp-parse-workflow.test.ts",
				"opportunity-document-download-route.test.ts",
				"requirements-workflow.test.ts",
				"proposal-documents-scope.test.ts",
				"final-artifact-workflow.test.ts",
				"documents-final-artifact-route.test.ts",
				"final-submission-checklist-workflow.test.ts",
				"submission-workflow.test.ts",
				"submissions-scope.test.ts",
			],
		},
		expectedArtifacts: [
			"vitest:opportunity-discovery-route",
			"vitest:discovery-opportunity-import",
			"vitest:document-discovery-agent",
			"vitest:rfp-document-service",
			"vitest:rfp-parse-workflow",
			"vitest:opportunity-document-download-route",
			"vitest:requirements-workflow",
			"vitest:proposal-documents-scope",
			"vitest:final-artifact-workflow",
			"vitest:documents-final-artifact-route",
			"vitest:final-submission-checklist-workflow",
			"vitest:submission-workflow",
			"vitest:submissions-scope",
		],
	},
	{
		id: "phase1-live-safe-control-plane",
		wave: 1,
		title: "Phase 1 live-safe control-plane proof",
		kind: "live-safe",
		proofTargets: ["F-006", "O-004", "O-006"],
		requiresLiveServices: true,
		description: "Runs authenticated disposable proof for parse remediation, Stalwart dispatch, and workflow template governance.",
		command: {
			command: "npm",
			args: ["run", "platform:proof:phase1"],
		},
		expectedArtifacts: [
			".omx/state/platform-completion-phase1-evidence.md",
			".omx/logs/platform-completion/<run_id>/raw-proof.json",
		],
	},
	{
		id: "live-discovery-services",
		wave: 9,
		title: "Live discovery search and scrape services proof",
		kind: "live-safe",
		proofTargets: ["F-001", "F-005"],
		requiresLiveServices: true,
		description: "Checks the configured live SearXNG, Firecrawl, and browser fallback services return usable search and scrape content.",
		command: {
			command: "npx",
			args: ["tsx", "scripts/prove-live-discovery-services.ts"],
		},
		expectedArtifacts: [
			".omx/state/platform-live-discovery-evidence.md",
			".omx/logs/platform-completion/live-discovery-<run_id>/live-discovery-services.json",
		],
	},
	{
		id: "live-source-discovery",
		wave: 9,
		title: "Live configured source discovery proof",
		kind: "live-safe",
		proofTargets: ["F-001"],
		requiresLiveServices: true,
		description: "Scrapes a configured procurement source with Firecrawl and verifies generic parser extraction returns normalized opportunity candidates.",
		command: {
			command: "npx",
			args: ["tsx", "scripts/prove-live-source-discovery.ts"],
		},
		expectedArtifacts: [
			".omx/state/platform-live-source-discovery-evidence.md",
			".omx/logs/platform-completion/live-source-discovery-<run_id>/live-source-discovery.json",
		],
	},
	{
		id: "live-kenya-ppip-source",
		wave: 9,
		title: "Live Kenya PPIP source API proof",
		kind: "live-safe",
		proofTargets: ["F-001", "F-005"],
		requiresLiveServices: true,
		description: "Calls Kenya PPIP's public JSON API and verifies mapped opportunity candidates include source document URLs.",
		command: {
			command: "npx",
			args: ["tsx", "scripts/prove-live-kenya-ppip-source.ts"],
		},
		expectedArtifacts: [
			".omx/state/platform-live-kenya-ppip-evidence.md",
			".omx/logs/platform-completion/live-kenya-ppip-<run_id>/live-kenya-ppip-source.json",
		],
	},
	{
		id: "live-ungm-source",
		wave: 9,
		title: "Live UNGM source API proof",
		kind: "live-safe",
		proofTargets: ["F-001", "F-005"],
		requiresLiveServices: true,
		description: "Calls UNGM's public notice endpoint and verifies mapped opportunity candidates include usable portal URLs.",
		command: {
			command: "npx",
			args: ["tsx", "scripts/prove-live-ungm-source.ts"],
		},
		expectedArtifacts: [
			".omx/state/platform-live-ungm-evidence.md",
			".omx/logs/platform-completion/live-ungm-<run_id>/live-ungm-source.json",
		],
	},
];

export function listProofScenarios(filters: {
	wave?: number;
	ids?: string[];
	includeLiveSafe?: boolean;
} = {}): ProofScenarioDefinition[] {
	const idSet = filters.ids?.length ? new Set(filters.ids) : null;
	return PLATFORM_PROOF_SCENARIOS.filter((scenario) => {
		if (filters.wave !== undefined && scenario.wave !== filters.wave) return false;
		if (idSet && !idSet.has(scenario.id)) return false;
		if (!filters.includeLiveSafe && scenario.requiresLiveServices) return false;
		return true;
	});
}

export function validateProofScenarioManifest(
	scenarios: ProofScenarioDefinition[] = PLATFORM_PROOF_SCENARIOS,
): string[] {
	const errors: string[] = [];
	const ids = new Set<string>();
	for (const scenario of scenarios) {
		if (ids.has(scenario.id)) errors.push(`Duplicate scenario id: ${scenario.id}`);
		ids.add(scenario.id);
		if (!scenario.proofTargets.length) errors.push(`${scenario.id} has no proof targets`);
		if (!scenario.command.command) errors.push(`${scenario.id} has no command`);
		if (scenario.wave < 0 || !Number.isInteger(scenario.wave)) errors.push(`${scenario.id} has invalid wave ${scenario.wave}`);
	}
	return errors;
}
