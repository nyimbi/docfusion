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
		]);
		expect(listProofScenarios({ ids: ["wave1-control-plane-browser"] })).toEqual([
			expect.objectContaining({
				id: "wave1-control-plane-browser",
				proofTargets: expect.arrayContaining(["O-003A", "O-006B"]),
			}),
		]);
	});
});

