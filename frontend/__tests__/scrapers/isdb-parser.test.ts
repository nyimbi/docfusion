import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ISDB_TENDERS_URL,
	isdbParser,
	parseIsdbTenderDetailHtml,
	parseIsdbTendersHtml,
} from "@/lib/scrapers/parsers/isdb";

const isdbListingHtml = `
	<article role="article" about="/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform" data-nid="9901" class="display-teaser teaser type-tender">
		<div class="field-title mt-4"><h2><a href="/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform">BCC2099-001 - Digital Health Platform Evaluation</a></h2></div>
		<div class="tender-badges">
			<div class="field field--name-field-tender-status field--type-entity-reference field--label-hidden field--item"><div>Active</div></div>
			<div class="field field--name-field-tender-type field--type-entity-reference field--label-hidden field--item"><div>Expression of Interest</div></div>
			<div class="field field--name-field-world-country field--type-entity-reference field--label-hidden field--item">Nigeria</div>
			<div class="field field--name-field-close-date field--type-datetime field--label-hidden field--item"><time datetime="00Z">24 August 2099</time></div>
		</div>
	</article>
	<article role="article" about="/project-procurement/tenders/2099/contract-award/closed-award" data-nid="9902" class="display-teaser teaser type-tender">
		<div class="field-title mt-4"><h2><a href="/project-procurement/tenders/2099/contract-award/closed-award">Closed Award</a></h2></div>
		<div class="field field--name-field-tender-type field--type-entity-reference field--label-hidden field--item"><div>Contract Award</div></div>
	</article>
`;

const isdbDetailHtml = `
	<div class="field field--name-field-tender-status field--type-entity-reference field--label-hidden field--item"><div>Active</div></div>
	<div class="details pdf-icons">
		<div class="field field--name-field-notice-type field--type-entity-reference field--label-inline">
			<div class="field--label">Notice Type</div><div class="field--item">International Competitive Bidding</div>
		</div>
		<div class="field field--name-field-issue-date field--type-datetime field--label-inline">
			<div class="field--label">Issue Date</div><div class="field--item"><time datetime="2099-08-07T12:00:00Z">7 August 2099</time></div>
		</div>
		<div class="field field--name-field-close-date field--type-datetime field--label-inline">
			<div class="field--label">Last date of submission</div><div class="field--item"><time datetime="2099-08-24T12:00:00Z">24 August 2099</time></div>
		</div>
		<div class="field field--name-field-tender-type field--type-entity-reference field--label-inline">
			<div class="field--label">Tender Type</div><div class="field--item">Expression of Interest</div>
		</div>
		<div class="field field--name-field-email field--type-email field--label-inline">
			<div class="field--label">Email</div><div class="field--item">submissions@example.org</div>
		</div>
		<div class="field field--name-field-documents field--type-file field--label-inline">
			<div class="field--label">Documents</div>
			<div class="field--items"><div class="field--item"><a href="/project-procurement/sites/pproc/files/2099-08/ToR-Digital-Health.pdf">ToR Digital Health.pdf</a></div></div>
		</div>
	</div>
	<div class="field field--name-field-description field--type-text-long field--label-hidden field--item">
		<p>The Islamic Development Bank invites eligible consultants to submit an Expression of Interest.</p>
	</div>
`;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.ISDB_PAGE_LIMIT;
	delete process.env.ISDB_DETAIL_LIMIT;
});

describe("IsDB project procurement parser", () => {
	it("extracts tender-like listing rows and skips contract awards", () => {
		const rows = parseIsdbTendersHtml(isdbListingHtml, ISDB_TENDERS_URL);

		expect(rows).toEqual([
			expect.objectContaining({
				title: "BCC2099-001 - Digital Health Platform Evaluation",
				portalUrl: "https://www.isdb.org/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform",
				sourceId: "9901",
				status: "Active",
				tenderType: "Expression of Interest",
				countryRegion: "Nigeria",
				deadlineText: "24 August 2099",
				deadline: new Date("2099-08-24T12:00:00.000Z"),
			}),
		]);
	});

	it("extracts detail document packages and submission metadata", () => {
		const detail = parseIsdbTenderDetailHtml(
			isdbDetailHtml,
			"https://www.isdb.org/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform"
		);

		expect(detail).toEqual(expect.objectContaining({
			noticeType: "International Competitive Bidding",
			issueDate: new Date("2099-08-07T12:00:00.000Z"),
			issueDateText: "7 August 2099",
			deadline: new Date("2099-08-24T12:00:00.000Z"),
			deadlineText: "24 August 2099",
			tenderType: "Expression of Interest",
			email: "submissions@example.org",
			documentLinks: [{
				label: "ToR Digital Health.pdf",
				url: "https://www.isdb.org/project-procurement/sites/pproc/files/2099-08/ToR-Digital-Health.pdf",
			}],
		}));
	});

	it("fetches bounded listing pages and enriches rows with detail PDFs", async () => {
		process.env.ISDB_PAGE_LIMIT = "1";
		process.env.ISDB_DETAIL_LIMIT = "1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === ISDB_TENDERS_URL) {
				return new Response(isdbListingHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			if (requestedUrl === "https://www.isdb.org/project-procurement/tenders/2099/eoi/bcc2099-001-digital-health-platform") {
				return new Response(isdbDetailHtml, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await isdbParser.parse({ url: ISDB_TENDERS_URL });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			source: "isdb",
			sourceId: "isdb-9901",
			organization: "Islamic Development Bank (IsDB)",
			countryRegion: "Nigeria",
			opportunityType: "eoi",
			documentUrl: "https://www.isdb.org/project-procurement/sites/pproc/files/2099-08/ToR-Digital-Health.pdf",
			tags: ["isdb", "development-bank", "global-south", "project-procurement", "source-documents"],
		}));
	});
});
