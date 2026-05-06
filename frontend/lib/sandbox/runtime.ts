export interface SandboxRuntimeContext {
	mode: "live" | "sandbox";
	label: string;
	runIdPrefix: string;
	mutatingProofAllowed: boolean;
	fakeDispatch: boolean;
	cleanupRequired: boolean;
}

export function getSandboxRuntimeContext(): SandboxRuntimeContext {
	const mode = process.env.DOCFUSION_SANDBOX_MODE === "true" || process.env.NODE_ENV !== "production"
		? "sandbox"
		: "live";
	const runIdPrefix = process.env.DOCFUSION_SANDBOX_RUN_PREFIX
		?? `df-${mode}-${new Date().toISOString().slice(0, 10)}`;
	return {
		mode,
		label: mode === "sandbox" ? "Sandbox mode" : "Live mode",
		runIdPrefix,
		mutatingProofAllowed: mode === "sandbox" || process.env.DOCFUSION_ALLOW_LIVE_PROOF === "true",
		fakeDispatch: process.env.DOCFUSION_FAKE_DISPATCH === "true" || mode === "sandbox",
		cleanupRequired: true,
	};
}

export type SandboxRequestMode = "live" | "sandbox" | "preview";

export interface SandboxMutationDecision {
	requestedMode: SandboxRequestMode;
	runtimeMode: SandboxRuntimeContext["mode"];
	mutationAllowed: boolean;
	mutationSuppressed: boolean;
	fakeDispatch: boolean;
	cleanupRequired: boolean;
	runIdPrefix: string;
	reason: string;
}

export function decideSandboxMutation(input: {
	requestedMode?: unknown;
	operation: string;
	context?: SandboxRuntimeContext;
}): SandboxMutationDecision {
	const context = input.context ?? getSandboxRuntimeContext();
	const requestedMode = normalizeRequestedMode(input.requestedMode);
	if (requestedMode === "preview") {
		return {
			requestedMode,
			runtimeMode: context.mode,
			mutationAllowed: false,
			mutationSuppressed: true,
			fakeDispatch: true,
			cleanupRequired: false,
			runIdPrefix: context.runIdPrefix,
			reason: `${input.operation} is running in preview-only sandbox mode`,
		};
	}

	const mutationAllowed = requestedMode === "sandbox"
		? context.mutatingProofAllowed
		: context.mode === "live" || context.mutatingProofAllowed;
	return {
		requestedMode,
		runtimeMode: context.mode,
		mutationAllowed,
		mutationSuppressed: !mutationAllowed,
		fakeDispatch: context.fakeDispatch || requestedMode === "sandbox",
		cleanupRequired: context.cleanupRequired && mutationAllowed,
		runIdPrefix: context.runIdPrefix,
		reason: mutationAllowed
			? `${input.operation} is allowed in ${requestedMode} mode`
			: `${input.operation} is suppressed by sandbox policy`,
	};
}

function normalizeRequestedMode(value: unknown): SandboxRequestMode {
	if (value === "preview" || value === "sandbox" || value === "live") return value;
	return "live";
}
