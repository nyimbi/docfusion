import { afterEach, describe, expect, it, vi } from "vitest";
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
	afterEach(() => {
		vi.unstubAllEnvs();
	});

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

	it("rejects fake dispatch outside test environments", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("ENVIRONMENT", "production");

		expect(() => decideSandboxMutation({
			requestedMode: "preview",
			operation: "import_execute",
			context: liveContext,
		})).toThrow("fakeDispatch outside NODE_ENV=test or ENVIRONMENT=test");
	});

	it("allows fake dispatch when ENVIRONMENT=test", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("ENVIRONMENT", "test");

		const decision = decideSandboxMutation({
			requestedMode: "preview",
			operation: "import_execute",
			context: liveContext,
		});

		expect(decision.fakeDispatch).toBe(true);
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
