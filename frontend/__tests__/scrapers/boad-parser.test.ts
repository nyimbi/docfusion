import { afterEach, describe, expect, it, vi } from "vitest";

import {
	BOAD_TENDERS_URL,
	boadParser,
	parseBoadTenderDetailHtml,
	parseBoadTendersHtml,
} from "@/lib/scrapers/parsers/boad";

function inertiaHtml(props: Record<string, unknown>): string {
	return `<div id="app" data-page="${JSON.stringify({ component: "Page", props }).replace(/"/g, "&quot;")}"></div>`;
}

const boadListingRow = {
	id: 2931,
	external_id: 572296,
	type: "tender",
	slug: "ami-taxe-carbone-accord-paris-rdc-consultants",
	link: "/fr/opportunites/appels-doffre/ami-taxe-carbone-accord-paris-rdc-consultants/",
	title: "Avis à Manifestation d'Intérêt - Recrutement de consultant pour la mise en œuvre de la taxe carbone et Accord de Paris en RDC",
	acf: {
		presentation: {
			title: null,
			text: "<p>Les candidats intéressés sont invités à soumettre leur dossier.</p><p><strong>Date limite de soumission : 15 juin 2099</strong></p>",
		},
		start_at: "21/05/2099",
		end_at: "15/06/2099",
		files: [572291],
	},
};

const boadDetailProps = {
	page: boadListingRow,
	blocks: [{
		acf_fc_layout: "tender_header_block",
		component: "TenderHeaderBlock",
		data: {
			title: boadListingRow.title,
			presentation: boadListingRow.acf.presentation,
			tags: {
				start_at: "21/05/2099",
				end_at: "15/06/2099",
			},
			files: [{
				title: "Termes de Références - Recrutement de consultant",
				acf: {
					file: {
						title: "TERMES DE REFERENCE_OPERATIONNALISATION TAXE CARBONE RDC_FRANCAIS",
						filename: "TERMES-DE-REFERENCE_OPERATIONNALISATION-TAXE-CARBONE-RDC_FRANCAIS.pdf",
						mime_type: "application/pdf",
						url: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE_OPERATIONNALISATION-TAXE-CARBONE-RDC_FRANCAIS.pdf",
					},
				},
			}],
		},
	}],
};

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.BOAD_PAGE_LIMIT;
	delete process.env.BOAD_DETAIL_LIMIT;
});

describe("BOAD tenders parser", () => {
	it("extracts Inertia listing records with French deadline metadata", () => {
		const opportunities = parseBoadTendersHtml(inertiaHtml({
			tenders: {
				current_page: 1,
				last_page: 1,
				data: [boadListingRow],
			},
		}), BOAD_TENDERS_URL, new Date("2099-05-31T00:00:00.000Z"));

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			title: boadListingRow.title,
			source: "boad",
			sourceId: "boad-572296",
			noticeId: "AMI",
			organization: "Banque Ouest Africaine de Développement (BOAD)",
			countryRegion: "Democratic Republic of the Congo",
			category: "Avis de manifestation d'intérêt",
			opportunityType: "eoi",
			portalUrl: "https://www.boad.org/fr/opportunites/appels-doffre/ami-taxe-carbone-accord-paris-rdc-consultants/",
			tags: expect.arrayContaining(["boad", "west-africa", "source-documents"]),
		}));
		expect(opportunities[0]?.deadline).toEqual(new Date("2099-06-15T23:59:59.000Z"));
	});

	it("extracts tender document links from detail-page blocks", () => {
		const [opportunity] = parseBoadTenderDetailHtml(
			inertiaHtml(boadDetailProps),
			"https://www.boad.org/fr/opportunites/appels-doffre/ami-taxe-carbone-accord-paris-rdc-consultants/",
			new Date("2099-05-31T00:00:00.000Z")
		);

		expect(opportunity).toEqual(expect.objectContaining({
			source: "boad",
			documentUrl: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE_OPERATIONNALISATION-TAXE-CARBONE-RDC_FRANCAIS.pdf",
			rfpLink: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE_OPERATIONNALISATION-TAXE-CARBONE-RDC_FRANCAIS.pdf",
			metadata: {
				boad: expect.objectContaining({
					documentLinks: [{
						label: "TERMES DE REFERENCE_OPERATIONNALISATION TAXE CARBONE RDC_FRANCAIS",
						url: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE_OPERATIONNALISATION-TAXE-CARBONE-RDC_FRANCAIS.pdf",
					}],
				}),
			},
		}));
	});

	it("fetches listing pages and enriches the first records with detail documents", async () => {
		process.env.BOAD_PAGE_LIMIT = "1";
		process.env.BOAD_DETAIL_LIMIT = "1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestedUrl = String(url);
			if (requestedUrl === BOAD_TENDERS_URL) {
				return new Response(inertiaHtml({
					tenders: {
						current_page: 1,
						last_page: 1,
						data: [boadListingRow],
					},
				}), { status: 200, headers: { "content-type": "text/html" } });
			}
			if (requestedUrl === "https://www.boad.org/fr/opportunites/appels-doffre/ami-taxe-carbone-accord-paris-rdc-consultants/") {
				return new Response(inertiaHtml(boadDetailProps), { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await boadParser.parse({ url: BOAD_TENDERS_URL });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			source: "boad",
			documentUrl: "https://admin.boad.org/wp-content/uploads/2099/05/TERMES-DE-REFERENCE_OPERATIONNALISATION-TAXE-CARBONE-RDC_FRANCAIS.pdf",
		}));
	});
});
