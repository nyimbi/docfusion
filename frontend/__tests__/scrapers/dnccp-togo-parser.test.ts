import { describe, expect, it } from "vitest";

import {
	DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL,
	dnccpTogoParser,
	parseDnccpTogoPostsPayload,
} from "@/lib/scrapers/parsers/dnccp-togo";

const postsPayload = JSON.stringify([
	{
		id: 12941,
		date: "2026-03-03T15:53:49",
		link: "https://dnccp.gouv.tg/dnccp/avis-d-appel-d-offres/hpc-national-du-togo/",
		title: {
			rendered: "&nbsp;l&rsquo; Avis d&rsquo;Appel d&rsquo;Offres International (AOI) relatif a l&rsquo;acquisition et installation de materiels pour le supercalculateur national du Togo",
		},
		content: {
			rendered: `
				<p>l&rsquo; Avis d&rsquo;Appel d&rsquo;Offres International (AOI)</p>
				<a class="gkit-btn" href="https://dnccp.gouv.tg/dnccp/wp-content/uploads/2026/03/Avis-dAppel-dOffre-International_Acquisition_Materiels_Calculateur-DNCCP_0001.pdf">Telechargement</a>
			`,
		},
		excerpt: {
			rendered: "<p>l&rsquo; Avis d&rsquo;Appel d&rsquo;Offres International (AOI) Telechargement</p>",
		},
		categories: [105, 45],
	},
	{
		id: 12912,
		date: "2026-02-27T08:15:00",
		link: "https://dnccp.gouv.tg/dnccp/avis-d-appel-d-offres/prestation-intellectuelle/audit-platform/",
		title: {
			rendered: "Avis de manifestation d&rsquo;interet pour le recrutement d&rsquo;un consultant individuel",
		},
		content: {
			rendered: `
				<a href="https://dnccp.gouv.tg/dnccp/wp-content/uploads/2026/02/TDR-consultant-audit.docx">Telechargement</a>
				<a href="https://dnccp.gouv.tg/dnccp/wp-content/uploads/elementor/css/post-6324.css">theme css</a>
			`,
		},
		categories: [104],
	},
]);

describe("DNCCP Togo parser", () => {
	it("extracts WordPress API posts with direct procurement documents", () => {
		const opportunities = parseDnccpTogoPostsPayload(postsPayload, DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "l' Avis d'Appel d'Offres International (AOI) relatif a l'acquisition et installation de materiels pour le supercalculateur national du Togo",
			source: "dnccp_togo",
			sourceId: "dnccp-togo-12941",
			noticeId: "12941",
			organization: "Direction Nationale du Controle de la Commande Publique du Togo",
			countryRegion: "Togo",
			category: "Goods",
			opportunityType: "tender",
			publishedDate: new Date("2026-03-03T15:53:49.000Z"),
			portalUrl: "https://dnccp.gouv.tg/dnccp/avis-d-appel-d-offres/hpc-national-du-togo/",
			documentUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2026/03/Avis-dAppel-dOffre-International_Acquisition_Materiels_Calculateur-DNCCP_0001.pdf",
			tags: ["togo", "west-africa", "national-procurement", "source-api", "direct-documents"],
		});
		expect(opportunities[0].metadata.dnccpTogo.documentLinks).toHaveLength(1);
	});

	it("classifies consulting and expression-of-interest posts and ignores theme assets", () => {
		const opportunities = parseDnccpTogoPostsPayload(postsPayload, DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL);

		expect(opportunities[1]).toMatchObject({
			sourceId: "dnccp-togo-12912",
			category: "Consulting services",
			opportunityType: "eoi",
			documentUrl: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2026/02/TDR-consultant-audit.docx",
		});
		expect(opportunities[1].metadata.dnccpTogo.documentLinks).toEqual([
			{
				label: "Telechargement",
				url: "https://dnccp.gouv.tg/dnccp/wp-content/uploads/2026/02/TDR-consultant-audit.docx",
			},
		]);
	});

	it("uses the registered parser entrypoint", async () => {
		const result = await dnccpTogoParser.parse({
			url: DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL,
			html: postsPayload,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0].source).toBe("dnccp_togo");
	});

	it("promotes procurement content text when WordPress titles are terse acronyms", () => {
		const opportunities = parseDnccpTogoPostsPayload(JSON.stringify([
			{
				id: 12027,
				date: "2025-02-13T11:20:50",
				link: "https://dnccp.gouv.tg/dnccp/avis-d-appel-d-offres/prestation-intellectuelle/prmp-6/",
				title: { rendered: "PRMP" },
				content: {
					rendered: `
						<p>Avis d&rsquo;Appel International a Candidatures de prequalification AMII N deg 01/2025 relatif aux prestations de conseil et d'assistance technique pour la mise en oeuvre du projet.</p>
						<a href="https://dnccp.gouv.tg/dnccp/wp-content/uploads/2025/02/AVIS-DAPPEL-INTERNATIONAL-A-CANDIDATURE.pdf">Telechargement</a>
					`,
				},
				categories: [104],
			},
		]), DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL);

		expect(opportunities[0]).toMatchObject({
			sourceId: "dnccp-togo-12027",
			title: "Avis d'Appel International a Candidatures de prequalification AMII N deg 01/2025 relatif aux prestations de conseil et d'assistance technique pour la mise en oeuvre du projet.",
			category: "Consulting services",
			opportunityType: "rfp",
		});
	});
});
