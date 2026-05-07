import { describe, expect, it } from "vitest";
import {
	PLATFORM_PROOF_SCENARIOS,
	listProofScenarios,
	validateProofScenarioManifest,
} from "@/scripts/platform-proof/scenarios";

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
			}),
		]);
	});
});
