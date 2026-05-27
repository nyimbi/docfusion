import { describe, expect, it } from "vitest";
import {
	PLATFORM_PROOF_SCENARIOS,
	listProofScenarios,
	type ProofScenarioDefinition,
	validateProofScenarioManifest,
} from "@/scripts/platform-proof/scenarios";
import { formatProofCommand, runProofScenarios } from "@/scripts/platform-proof/runner";

function proofScenario(id: string): ProofScenarioDefinition {
	return {
		id,
		wave: 0,
		title: id,
		kind: "unit",
		proofTargets: ["F-000"],
		requiresLiveServices: false,
		description: id,
		command: {
			command: "npm",
			args: ["test", "--", `${id}.test.ts`],
		},
		expectedArtifacts: [`vitest:${id}`],
	};
}

describe("platform proof scenarios", () => {
	it("keeps the proof scenario manifest valid and uniquely addressable", () => {
		expect(validateProofScenarioManifest()).toEqual([]);
		expect(new Set(PLATFORM_PROOF_SCENARIOS.map((scenario) => scenario.id)).size).toBe(
			PLATFORM_PROOF_SCENARIOS.length,
		);
	});

	it("excludes live-safe scenarios by default and includes them explicitly", () => {
		const defaultScenarios = listProofScenarios();
		expect(defaultScenarios.every((scenario) => !scenario.requiresLiveServices)).toBe(true);
		expect(defaultScenarios.map((scenario) => scenario.id)).not.toContain("phase1-live-safe-control-plane");

		const withLive = listProofScenarios({ includeLiveSafe: true });
		expect(withLive.map((scenario) => scenario.id)).toContain("phase1-live-safe-control-plane");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-discovery-services");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-opportunity-response-readiness");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-persisted-import-response");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-source-discovery");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-undp-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-world-bank-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-afdb-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-comesa-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-unicef-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-dgmarket-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-kenya-ppip-source");
		expect(withLive.map((scenario) => scenario.id)).toContain("live-ungm-source");
	});

	it("filters by wave and requested ids", () => {
		expect(listProofScenarios({ wave: 0 }).map((scenario) => scenario.id)).toEqual([
			"wave0-proof-core-unit",
			"wave0-frontend-typecheck",
			"wave0-workflow-runtime-core",
		]);
		expect(listProofScenarios({ ids: ["wave0-workflow-runtime-core"] })).toEqual([
			expect.objectContaining({
				id: "wave0-workflow-runtime-core",
				proofTargets: expect.arrayContaining(["O-003", "O-016"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave1-control-plane-browser"] })).toEqual([
			expect.objectContaining({
				id: "wave1-control-plane-browser",
				proofTargets: expect.arrayContaining(["O-003A", "O-006B"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave1-audit-export-api"] })).toEqual([
			expect.objectContaining({
				id: "wave1-audit-export-api",
				proofTargets: expect.arrayContaining(["O-015A", "UX-021"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave1-role-homepage"] })).toEqual([
			expect.objectContaining({
				id: "wave1-role-homepage",
				proofTargets: expect.arrayContaining(["UX-010", "UX-011"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave1-portal-workflows-browser"] })).toEqual([
			expect.objectContaining({
				id: "wave1-portal-workflows-browser",
				proofTargets: expect.arrayContaining(["P-001", "P-002"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave2-rfp-upload-preflight"] })).toEqual([
			expect.objectContaining({
				id: "wave2-rfp-upload-preflight",
				proofTargets: expect.arrayContaining(["F-005B", "UX-002"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave2-rfp-parse-storage-lifecycle"] })).toEqual([
			expect.objectContaining({
				id: "wave2-rfp-parse-storage-lifecycle",
				proofTargets: expect.arrayContaining(["F-005", "O-007"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave3-compliance-evidence-readiness"] })).toEqual([
			expect.objectContaining({
				id: "wave3-compliance-evidence-readiness",
				proofTargets: expect.arrayContaining(["UX-004", "UX-016"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:compliance-cross-reference-suggestions",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave4-planning-collaboration-tasks"] })).toEqual([
			expect.objectContaining({
				id: "wave4-planning-collaboration-tasks",
				proofTargets: expect.arrayContaining(["F-013", "UX-011"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave5-ai-content-governance"] })).toEqual([
			expect.objectContaining({
				id: "wave5-ai-content-governance",
				proofTargets: expect.arrayContaining(["F-015", "UX-019"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave6-final-submission-gate"] })).toEqual([
			expect.objectContaining({
				id: "wave6-final-submission-gate",
				proofTargets: expect.arrayContaining(["F-021B", "UX-025"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave6-approval-production-corrections"] })).toEqual([
			expect.objectContaining({
				id: "wave6-approval-production-corrections",
				proofTargets: expect.arrayContaining(["F-018", "F-021"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:document-render-pdf",
					"vitest:formatting-scope",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave7-import-operations-governance"] })).toEqual([
			expect.objectContaining({
				id: "wave7-import-operations-governance",
				proofTargets: expect.arrayContaining(["F-022", "UX-022"]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave8-strategic-capability-workflows"] })).toEqual([
			expect.objectContaining({
				id: "wave8-strategic-capability-workflows",
				proofTargets: expect.arrayContaining(["S-001", "UX-018"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:crm-account-research-search",
					"vitest:win-themes-auth",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave9-discovery-rfp-response-bridge"] })).toEqual([
			expect.objectContaining({
				id: "wave9-discovery-rfp-response-bridge",
				proofTargets: expect.arrayContaining(["F-001", "F-005", "F-020"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:dgmarket-parser",
					"vitest:default-discovery-sources",
					"vitest:discovery-opportunity-import",
					"vitest:opportunity-documents-scope",
					"vitest:rfp-document-service",
					"vitest:proposal-documents-scope",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave9-discovery-to-submission-core"] })).toEqual([
			expect.objectContaining({
				id: "wave9-discovery-to-submission-core",
				proofTargets: expect.arrayContaining(["F-001", "F-021", "UX-025"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:opportunity-discovery-route",
					"vitest:rfp-parse-workflow",
					"vitest:opportunity-document-download-route",
					"vitest:document-render-pdf",
					"vitest:documents-final-artifact-route",
					"vitest:final-submission-checklist-workflow",
					"vitest:submission-workflow",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave9-response-readiness-package"] })).toEqual([
			expect.objectContaining({
				id: "wave9-response-readiness-package",
				proofTargets: expect.arrayContaining(["F-005", "F-008", "F-020"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:live-response-package",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["wave9-presentation-export-artifacts"] })).toEqual([
			expect.objectContaining({
				id: "wave9-presentation-export-artifacts",
				proofTargets: expect.arrayContaining(["F-020"]),
				expectedArtifacts: expect.arrayContaining([
					"vitest:presentations-export",
					"vitest:presentations-auth",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-discovery-services"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-discovery-services",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-opportunity-response-readiness"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-opportunity-response-readiness",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005", "F-020"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-opportunity-response-readiness-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-persisted-import-response"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-persisted-import-response",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005", "F-008", "F-020", "S-001"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-persisted-import-response-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-source-discovery"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-source-discovery",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-undp-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-undp-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-world-bank-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-world-bank-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-afdb-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-afdb-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-comesa-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-comesa-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-unicef-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-unicef-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-dgmarket-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-dgmarket-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001"]),
				command: expect.objectContaining({
					env: expect.objectContaining({
						LIVE_SOURCE_DISCOVERY_URL: "https://www.dgmarket.com",
					}),
				}),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-source-discovery-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-kenya-ppip-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-kenya-ppip-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-kenya-ppip-evidence.md",
				]),
			}),
		]);
		expect(listProofScenarios({ ids: ["live-ungm-source"], includeLiveSafe: true })).toEqual([
			expect.objectContaining({
				id: "live-ungm-source",
				kind: "live-safe",
				proofTargets: expect.arrayContaining(["F-001", "F-005"]),
				expectedArtifacts: expect.arrayContaining([
					".omx/state/platform-live-ungm-evidence.md",
				]),
			}),
		]);
	});

	it("prints scenario-specific environment for dry-run commands", () => {
		const [scenario] = listProofScenarios({ ids: ["live-dgmarket-source"], includeLiveSafe: true });

		expect(formatProofCommand(scenario)).toContain("LIVE_SOURCE_DISCOVERY_URL=https://www.dgmarket.com");
		expect(formatProofCommand(scenario)).toContain("npx tsx scripts/prove-live-source-discovery.ts");
	});

	it("keeps continue-on-failure sweeps failed when any scenario fails", async () => {
		const executed: string[] = [];
		const logs: string[] = [];
		const summary = await runProofScenarios(
			[proofScenario("first"), proofScenario("second"), proofScenario("third")],
			{
				continueOnFailure: true,
				log: (message) => logs.push(message),
				runScenario: async (scenario) => {
					executed.push(scenario.id);
					return scenario.id === "second" ? 7 : 0;
				},
			},
		);

		expect(executed).toEqual(["first", "second", "third"]);
		expect(summary.exitCode).toBe(7);
		expect(summary.failed).toEqual([{ scenarioId: "second", exitCode: 7 }]);
		expect(logs).toContain("[platform-proof] - second exited 7");
	});

	it("stops on the first failed scenario unless continue-on-failure is enabled", async () => {
		const executed: string[] = [];
		const summary = await runProofScenarios(
			[proofScenario("first"), proofScenario("second"), proofScenario("third")],
			{
				log: () => undefined,
				runScenario: async (scenario) => {
					executed.push(scenario.id);
					return scenario.id === "second" ? 3 : 0;
				},
			},
		);

		expect(executed).toEqual(["first", "second"]);
		expect(summary.exitCode).toBe(3);
		expect(summary.failed).toEqual([{ scenarioId: "second", exitCode: 3 }]);
	});
});
