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
