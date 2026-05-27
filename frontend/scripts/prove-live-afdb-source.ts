import "./load-env";

import { createProofRunId } from "./platform-proof/core";

process.env.LIVE_SOURCE_DISCOVERY_URL ??= "https://www.afdb.org/en/projects-and-operations/procurement";
if (!process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID) {
	process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID = process.env.LIVE_AFDB_SOURCE_PROOF_RUN_ID ?? createProofRunId("live_afdb_source");
}

void import("./prove-live-source-discovery");
