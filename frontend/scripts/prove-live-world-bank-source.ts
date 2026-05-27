import "./load-env";

import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import {
	fetchWorldBankNoticeDetail,
	worldBankNoticeIdFromUrl,
	worldBankParser,
	type WorldBankNoticeDetail,
} from "@/lib/scrapers/parsers/world-bank";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID
	?? process.env.LIVE_WORLD_BANK_SOURCE_PROOF_RUN_ID
	?? createProofRunId("live_world_bank_source");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://projects.worldbank.org/en/projects-operations/procurement";
const DETAIL_PROBE_LIMIT = 5;

interface LiveWorldBankSourceProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		url: string;
		title?: string;
		markdownLength: number;
		linkCount: number;
		opportunityCount: number;
		sampleOpportunities: Array<{
			title: string;
			noticeId?: string;
			organization?: string;
			countryRegion?: string;
			portalUrl?: string;
			category?: string;
		}>;
	};
	detailProbe?: {
		noticeTitle: string;
		noticeId?: string;
		portalUrl: string;
		projectId?: string;
		projectTitle?: string;
		borrowerBidReference?: string;
		procurementMethod?: string;
		organization?: string;
		contactEmail?: string;
		detailsLength: number;
	};
	error?: string;
}

async function main() {
	const proof: LiveWorldBankSourceProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			url: SOURCE_URL,
			markdownLength: 0,
			linkCount: 0,
			opportunityCount: 0,
			sampleOpportunities: [],
		},
	};

	try {
		const client = new FirecrawlClient({ timeout: 60000 });
		const sourceResult = await client.scrape(SOURCE_URL, {
			formats: ["markdown", "links"],
			timeout: 60000,
		});
		const markdown = sourceResult.data?.markdown ?? "";
		const links = sourceResult.data?.links ?? [];
		if (!sourceResult.success || markdown.trim().length === 0) {
			throw new Error(sourceResult.error ?? "Firecrawl returned no World Bank source content");
		}

		const parsed = await worldBankParser.parse({ markdown, links, url: SOURCE_URL });
		if (parsed.opportunities.length === 0) {
			throw new Error("World Bank parser returned no source opportunities");
		}
		if (parsed.opportunities.some((opportunity) => /\baward\b/i.test(opportunity.category ?? ""))) {
			throw new Error("World Bank parser returned award rows as active opportunity candidates");
		}

		proof.source = {
			url: SOURCE_URL,
			title: sourceResult.data?.metadata?.title,
			markdownLength: markdown.trim().length,
			linkCount: links.length,
			opportunityCount: parsed.opportunities.length,
			sampleOpportunities: parsed.opportunities.slice(0, 5).map((opportunity) => ({
				title: opportunity.title,
				noticeId: opportunity.noticeId ?? undefined,
				organization: opportunity.organization ?? undefined,
				countryRegion: opportunity.countryRegion ?? undefined,
				portalUrl: opportunity.portalUrl ?? undefined,
				category: opportunity.category ?? undefined,
			})),
		};

		for (const opportunity of parsed.opportunities.slice(0, DETAIL_PROBE_LIMIT)) {
			const noticeId = opportunity.noticeId ?? opportunity.sourceId ?? worldBankNoticeIdFromUrl(opportunity.portalUrl);
			if (!noticeId || !opportunity.portalUrl) continue;
			const detail = await fetchWorldBankNoticeDetail(noticeId).catch((): WorldBankNoticeDetail => ({}));
			if (!detail.details || !detail.borrowerBidReference || !detail.procurementMethod) continue;
			proof.detailProbe = {
				noticeTitle: opportunity.title,
				noticeId: opportunity.noticeId ?? undefined,
				portalUrl: opportunity.portalUrl,
				projectId: detail.projectId,
				projectTitle: detail.projectTitle,
				borrowerBidReference: detail.borrowerBidReference,
				procurementMethod: detail.procurementMethod,
				organization: detail.organization,
				contactEmail: detail.contactEmail,
				detailsLength: detail.details.length,
			};
			break;
		}

		if (!proof.detailProbe) {
			throw new Error("World Bank detail pages did not expose solicitation text and procurement metadata");
		}

		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function writeArtifacts(proof: LiveWorldBankSourceProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-world-bank-source.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			...(proof.detailProbe ? [
				`detail:${proof.detailProbe.portalUrl}`,
				...(proof.detailProbe.borrowerBidReference ? [`borrower-ref:${proof.detailProbe.borrowerBidReference}`] : []),
			] : []),
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe World Bank source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live World Bank source scrape returned normalized opportunities and solicitation metadata from a procurement detail page."
			: proof.error ?? "Live World Bank source discovery proof failed.",
	}], {
		title: "Platform Live Source Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
