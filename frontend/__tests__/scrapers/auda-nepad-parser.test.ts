import { describe, expect, it } from "vitest";

import {
	AUDA_NEPAD_TENDERS_URL,
	audaNepadParser,
	parseAudaNepadTendersHtml,
	parseAudaNepadTendersMarkdown,
} from "@/lib/scrapers/parsers/auda-nepad";

const tenderListingHtml = `
	<div class="views-row">
		<h3 class="views-field views-field-title"><span class="field-content">eoi - Experts to serve on the African Medicines Agency (AMA) Pool of Experts</span></h3>
		<div class="views-field views-field-nothing"><span class="event-label">Deadline: </span><time datetime="00Z">June 25, 2099</time></div>
		<div class="views-field views-field-nothing-1">
			<span class="file file--mime-application-pdf file--application-pdf">
				<a href="https://www.nepad.org/file-download/download/public/231822" type="application/pdf; length=299429" title="2. Expression of Interest for AMA Pool of Experts FR.pdf">Download File</a>
			</span>
		</div>
		<div class="views-field views-field-body detail-body"><div class="field-content">
			<p>Interested experts should submit applications to dg@au-ama.africa before the deadline.</p>
		</div></div>
	</div>
	<div class="views-row">
		<h3 class="views-field views-field-title"><span class="field-content">Expression of Interest for Africa Medicine Agency (AMA) Technical Committees</span></h3>
		<div class="views-field views-field-nothing"><span class="event-label">Deadline: </span><time datetime="00Z">June 18, 2099</time></div>
		<div class="views-field views-field-nothing-1">
			<a href="/file-download/download/public/231726" title="EN - Expression of Interest for AMA TCs_10MAY2026 RB.pdf">Download File</a>
			<a href="/file-download/download/public/231727" title="FR - Expression of Interest for AMA TCs_9MAY2026 RB FR.pdf">Download File</a>
		</div>
		<div class="views-field views-field-body detail-body"><div class="field-content">
			<p>Applications for technical committees should follow the linked notice.</p>
		</div></div>
	</div>
`;

describe("AUDA-NEPAD tenders parser", () => {
	it("extracts current AUDA-NEPAD notices with deadline and source documents", () => {
		const opportunities = parseAudaNepadTendersHtml(tenderListingHtml, AUDA_NEPAD_TENDERS_URL, new Date("2099-06-01T00:00:00Z"));

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "eoi - Experts to serve on the African Medicines Agency (AMA) Pool of Experts",
			source: "auda_nepad",
			sourceId: "auda-nepad-eoi-experts-to-serve-on-the-african-medicines-agency-ama-pool-of-experts",
			organization: "African Union Development Agency (AUDA-NEPAD)",
			countryRegion: "Africa",
			category: "Expression of interest",
			opportunityType: "eoi",
			deadline: new Date("2099-06-25T12:00:00.000Z"),
			documentUrl: "https://www.nepad.org/file-download/download/public/231822",
			rfpLink: "https://www.nepad.org/file-download/download/public/231822",
			submissionMethod: "Use the AUDA-NEPAD tender notice instructions; submission/contact email: dg@au-ama.africa.",
			tags: ["auda-nepad", "african-union", "africa", "source-documents"],
		});
		expect(opportunities[0].metadata.audaNepad).toEqual({
			sourceUrl: AUDA_NEPAD_TENDERS_URL,
			deadlineText: "June 25, 2099",
			contactEmail: "dg@au-ama.africa",
			documentLinks: [
				{
					label: "2. Expression of Interest for AMA Pool of Experts FR.pdf",
					url: "https://www.nepad.org/file-download/download/public/231822",
				},
			],
		});
		expect(opportunities[1].metadata.audaNepad.documentLinks).toEqual([
			{
				label: "EN - Expression of Interest for AMA TCs_10MAY2026 RB.pdf",
				url: "https://www.nepad.org/file-download/download/public/231726",
			},
			{
				label: "FR - Expression of Interest for AMA TCs_9MAY2026 RB FR.pdf",
				url: "https://www.nepad.org/file-download/download/public/231727",
			},
		]);
	});

	it("drops expired notices from listing pages", () => {
		const opportunities = parseAudaNepadTendersHtml(tenderListingHtml, AUDA_NEPAD_TENDERS_URL, new Date("2100-01-01T00:00:00Z"));

		expect(opportunities).toEqual([]);
	});

	it("falls back to Firecrawl markdown when HTML is unavailable", () => {
		const markdown = [
			"### Expression of Interest for Africa Medicine Agency (AMA) Technical Committees",
			"Deadline: June 18, 2099",
			"[Download File](https://www.nepad.org/file-download/download/public/231726 \"EN - Expression of Interest for AMA TCs_10MAY2026 RB.pdf\")",
			"Applications should be submitted to dg@au-ama.africa.",
		].join("\n\n");

		const opportunities = parseAudaNepadTendersMarkdown(markdown, AUDA_NEPAD_TENDERS_URL, new Date("2099-06-01T00:00:00Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			source: "auda_nepad",
			deadline: new Date("2099-06-18T12:00:00.000Z"),
			documentUrl: "https://www.nepad.org/file-download/download/public/231726",
		});
		expect(opportunities[0].metadata.audaNepad.contactEmail).toBe("dg@au-ama.africa");
	});

	it("uses Firecrawl-provided HTML before markdown in the parser registry", async () => {
		const result = await audaNepadParser.parse({
			url: AUDA_NEPAD_TENDERS_URL,
			html: tenderListingHtml,
			markdown: "### Ignored markdown\n\nDeadline: June 1, 2099",
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0].source).toBe("auda_nepad");
	});
});
