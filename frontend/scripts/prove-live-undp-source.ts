import "./load-env";

import { createProofRunId } from "./platform-proof/core";

process.env.LIVE_SOURCE_DISCOVERY_URL ??= "https://procurement-notices.undp.org";
if (!process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID) {
	process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID = process.env.LIVE_UNDP_SOURCE_PROOF_RUN_ID ?? createProofRunId("live_undp_source");
}

void import("./prove-live-source-discovery");
