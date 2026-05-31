import { afterEach, describe, expect, it, vi } from "vitest";

import {
	BADEA_PROCUREMENT_URL,
	badeaParser,
	parseBadeaProcurementHtml,
} from "@/lib/scrapers/parsers/badea";

const badeaListingHtml = `
	<div class="elementor-widget-heading"><h2 class="elementor-heading-title elementor-size-default">AVIS DE MARCHES</h2></div>
	<div class="elementor-widget-container">
		<h1 class="elementor-heading-title elementor-size-default">Projet de Developpement de la Chaine de Valeur Riz</h1>
	</div>
	<a class="elementor-button" href="https://badea-media.9ten.online/wp-content/uploads/2099/02/Avis-dappel-doffres-signe-16-fevrier-2099.pdf">Download</a>
	<div class="elementor-widget-container">
		<h1 class="elementor-heading-title elementor-size-default">Consultancy Service TOR, EOI and Procurement Plan - Kalabo Sikongo - Zambia</h1>
	</div>
	<a href="https://badea-media.9ten.online/wp-content/uploads/2099/09/CONSTRUCTION-OF-THE-KALABO-SIKONGO-ANGOLA-BORDER-ROAD-PROJECT.pdf">Download</a>
`;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.BADEA_PAGE_LIMIT;
});

describe("BADEA procurement parser", () => {
	it("extracts static procurement notice PDF packages from the BADEA archive", () => {
		const opportunities = parseBadeaProcurementHtml(badeaListingHtml, BADEA_PROCUREMENT_URL);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			title: "Projet de Developpement de la Chaine de Valeur Riz",
			source: "badea",
			organization: "Arab Bank for Economic Development in Africa (BADEA)",
			countryRegion: "Africa",
			category: "Tender notice",
			opportunityType: "tender",
			publishedDate: new Date("2099-02-01T00:00:00.000Z"),
			portalUrl: BADEA_PROCUREMENT_URL,
			documentUrl: "https://badea-media.9ten.online/wp-content/uploads/2099/02/Avis-dappel-doffres-signe-16-fevrier-2099.pdf",
			rfpLink: "https://badea-media.9ten.online/wp-content/uploads/2099/02/Avis-dappel-doffres-signe-16-fevrier-2099.pdf",
			tags: ["badea", "development-bank", "africa", "source-documents"],
		}));
		expect(opportunities[0].metadata.badea).toEqual({
			sourceUrl: BADEA_PROCUREMENT_URL,
			publishedMonth: "2099-02",
			documentLinks: [{
				label: "Procurement notice PDF",
				url: "https://badea-media.9ten.online/wp-content/uploads/2099/02/Avis-dappel-doffres-signe-16-fevrier-2099.pdf",
			}],
		});
		expect(opportunities[1]).toEqual(expect.objectContaining({
			title: "Consultancy Service TOR, EOI and Procurement Plan - Kalabo Sikongo - Zambia",
			countryRegion: "Zambia",
			category: "Expression of interest",
			opportunityType: "eoi",
		}));
	});

	it("fetches bounded paginated archive pages and deduplicates linked PDFs", async () => {
		process.env.BADEA_PAGE_LIMIT = "2";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === BADEA_PROCUREMENT_URL) {
				return new Response(`<div data-max-page="2"></div>${badeaListingHtml}`, {
					status: 200,
					headers: { "content-type": "text/html" },
				});
			}
			if (requestedUrl === "https://www.badea.org/fr/procurement-notice-fr/2/") {
				return new Response(`
					<h2 class="elementor-heading-title">RE-TENDERING - REHABILITATION AND EXPANSION OF MNAZI MMOJA HOSPITAL, ZANZIBAR</h2>
					<a href="https://badea-media.9ten.online/wp-content/uploads/2099/05/SPN-Rehabilitation-and-Expansion-of-MMH.pdf">Download</a>
					<h2 class="elementor-heading-title">Duplicate notice</h2>
					<a href="https://badea-media.9ten.online/wp-content/uploads/2099/05/SPN-Rehabilitation-and-Expansion-of-MMH.pdf">Download</a>
				`, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await badeaParser.parse({ url: BADEA_PROCUREMENT_URL });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.opportunities).toHaveLength(3);
		expect(result.opportunities[2]).toEqual(expect.objectContaining({
			title: "RE-TENDERING - REHABILITATION AND EXPANSION OF MNAZI MMOJA HOSPITAL, ZANZIBAR",
			countryRegion: "Tanzania",
			documentUrl: "https://badea-media.9ten.online/wp-content/uploads/2099/05/SPN-Rehabilitation-and-Expansion-of-MMH.pdf",
		}));
	});
});
