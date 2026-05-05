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
