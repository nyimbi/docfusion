import "./load-env";

import { createProofRunId } from "./platform-proof/core";

process.env.LIVE_SOURCE_DISCOVERY_URL ??= "https://www.comesa.int/category/open-tenders/";
if (!process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID) {
	process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID = process.env.LIVE_COMESA_SOURCE_PROOF_RUN_ID ?? createProofRunId("live_comesa_source");
}

void import("./prove-live-source-discovery");
