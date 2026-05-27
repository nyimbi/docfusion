import "./load-env";

process.env.LIVE_SOURCE_DISCOVERY_URL ??= "https://www.comesa.int/category/open-tenders/";
if (!process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID && process.env.LIVE_COMESA_SOURCE_PROOF_RUN_ID) {
	process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID = process.env.LIVE_COMESA_SOURCE_PROOF_RUN_ID;
}

void import("./prove-live-source-discovery");
