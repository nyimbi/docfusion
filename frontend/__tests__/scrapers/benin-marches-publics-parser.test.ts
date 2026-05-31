import { afterEach, describe, expect, it, vi } from "vitest";

import {
	BENIN_MARCHES_PUBLICS_API_URL,
	beninMarchesPublicsParser,
	parseBeninMarchesPublicsJson,
} from "@/lib/scrapers/parsers/benin-marches-publics";

const apiJson = JSON.stringify({
	content: [
		{
			dosID: 1180578,
			appelsoffres: {
				apoID: 1180573,
				apoObjet: "Realisation des travaux de forages d'exploitation a gros debit",
				apoReference: "T_DPET_113324",
				typemarche: { code: "T", description: "Travaux", libelle: "Travaux" },
			},
			autoriteContractante: {
				denomination: "Agence Nationale d'Approvisionnement en Eau Potable en Milieu Rural",
				sigle: "ANAEPMR",
				typeautorite: { libelle: "AGENCES, ET OFFICES DE L'ETAT" },
			},
			dosDateCreation: "2026-05-18",
			dosDateLimiteDepot: "2026-07-03",
			dosDatePublication: "2026-05-28",
			dosFichier: "https://bi.marches-publics.bj/beninmp/fichiers/pj/forages.pdf",
			dosHeurelimitedepot: "10:00:00",
			doslieuacquisitiondao: "Secretariat permanent de l'ANAEPMR",
			dosLotDivisible: "OUI",
			dosNombreLots: 3,
			dosReference: "T_DPET_113324",
			dayLeft: 33,
			expired: false,
		},
		{
			dosID: 1178652,
			appelsoffres: {
				apoID: 1178650,
				apoObjet: "Recrutement d'un cabinet pour l'audit financier du projet",
				apoReference: "PI_PDCV-RT_121704",
				typemarche: { code: "PI", description: "Prestations Intellectuelles", libelle: "Prestations Intellectuelles" },
			},
			autoriteContractante: {
				denomination: "Projet de Developpement des Chaines de Valeur",
				sigle: "PDCV",
				typeautorite: { libelle: "PROJETS ET PROGRAMMES" },
			},
			dosDateLimiteDepot: "2026-06-23",
			dosDatePublication: "2026-05-20",
			dosFichier: "https://bi.marches-publics.bj/beninmp/fichiers/pj/audit.pdf",
			dosHeurelimitedepot: "10:00:00",
			dosReference: "PI_PDCV-RT_121704",
			expired: false,
		},
	],
	totalPages: 1,
	totalElements: 2,
	number: 0,
	size: 100,
});

describe("Benin public procurement portal parser", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("extracts active notices from the official API response", () => {
		const opportunities = parseBeninMarchesPublicsJson(apiJson, BENIN_MARCHES_PUBLICS_API_URL);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Realisation des travaux de forages d'exploitation a gros debit",
			source: "benin_marches_publics",
			sourceId: "benin-marches-publics-1180578-t-dpet-113324",
			noticeId: "T_DPET_113324",
			organization: "Agence Nationale d'Approvisionnement en Eau Potable en Milieu Rural",
			countryRegion: "Benin",
			category: "Works",
			opportunityType: "tender",
			publishedDate: new Date("2026-05-28T12:00:00.000Z"),
			deadline: new Date("2026-07-03T10:00:00.000Z"),
			portalUrl: "https://marches-publics.bj/appels-doffres?notice=1180578",
			documentUrl: "https://bi.marches-publics.bj/beninmp/fichiers/pj/forages.pdf",
			tags: ["benin", "national-procurement", "west-africa", "source-api", "direct-documents"],
		});
		expect(opportunities[0].metadata.beninMarchesPublics).toMatchObject({
			reference: "T_DPET_113324",
			typeCode: "T",
			typeDescription: "Travaux",
			authoritySigle: "ANAEPMR",
			totalLots: 3,
			expired: false,
		});
	});

	it("classifies prestations intellectuelles as RFPs", () => {
		const opportunities = parseBeninMarchesPublicsJson(apiJson, BENIN_MARCHES_PUBLICS_API_URL);

		expect(opportunities[1]).toMatchObject({
			sourceId: "benin-marches-publics-1178652-pi-pdcv-rt-121704",
			category: "Consulting services",
			opportunityType: "rfp",
			organization: "Projet de Developpement des Chaines de Valeur",
		});
	});

	it("uses the registered parser entrypoint for JSON content", async () => {
		const result = await beninMarchesPublicsParser.parse({
			url: BENIN_MARCHES_PUBLICS_API_URL,
			html: apiJson,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0].source).toBe("benin_marches_publics");
	});

	it("falls back to the API endpoint when invoked with the public portal URL", async () => {
		const fetchMock = vi.fn(async () => new Response(apiJson, {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}));
		vi.stubGlobal("fetch", fetchMock);

		const result = await beninMarchesPublicsParser.parse({
			url: "https://marches-publics.bj/appels-doffres",
		});

		expect(result.opportunities).toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.marches-publics.bj/v2/api/portail/appelsoffres?page=0&size=100&search=&status=0",
			expect.anything()
		);
	});
});
