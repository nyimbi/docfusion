import "./load-env";

import { createProofRunId } from "./platform-proof/core";

process.env.LIVE_SOURCE_DISCOVERY_URL ??= "https://projects.worldbank.org/en/projects-operations/procurement";
if (!process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID) {
	process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID = process.env.LIVE_WORLD_BANK_SOURCE_PROOF_RUN_ID ?? createProofRunId("live_world_bank_source");
}

void import("./prove-live-source-discovery");
