import { describe, expect, it } from "vitest";
import { decideSandboxMutation, type SandboxRuntimeContext } from "@/lib/sandbox/runtime";

const liveContext: SandboxRuntimeContext = {
	mode: "live",
	label: "Live mode",
	runIdPrefix: "df-live-test",
	mutatingProofAllowed: false,
	fakeDispatch: false,
	cleanupRequired: true,
};

describe("sandbox runtime policy", () => {
	it("suppresses mutations for explicit preview-only requests", () => {
		const decision = decideSandboxMutation({
			requestedMode: "preview",
			operation: "import_execute",
			context: liveContext,
		});

		expect(decision).toMatchObject({
			requestedMode: "preview",
			runtimeMode: "live",
			mutationAllowed: false,
			mutationSuppressed: true,
			fakeDispatch: true,
			cleanupRequired: false,
		});
	});

	it("allows live mutations when no sandbox override is requested", () => {
		const decision = decideSandboxMutation({
			operation: "import_execute",
			context: liveContext,
		});

		expect(decision).toMatchObject({
			requestedMode: "live",
			mutationAllowed: true,
			mutationSuppressed: false,
			cleanupRequired: true,
		});
	});
});
