import { describe, expect, it } from "vitest";

import {
	MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL,
	marchesPublicsNigerParser,
	parseMarchesPublicsNigerHtml,
} from "@/lib/scrapers/parsers/marches-publics-niger";

const listingHtml = `
	<div class="contentListeOffres">
		<ul>
			<li class="offre">
				<ul>
					<li><strong>Avis N&deg; :</strong> SC_ARES_UAM_029_1</li>
					<li><strong>Date de publication :</strong> 28/04/2026</li>
				</ul>
				<div class="infoOffre">
					<span class="date-response">27/05/2026</span>
					<h2 class="titre"><a href="appel-offre/1783/acquisition-et-installation-des-equipement-informatique">Acquisition et installation des &eacute;quipement informatique</a></h2>
					<ul>
						<li><strong>Autorit&eacute; contractante :</strong> Universite Abdou Moumouni</li>
						<li><strong>Secteur d'activit&eacute; :</strong> Fournitures</li>
						<li><strong>Mode de passation :</strong> Appel d'offres ouvert</li>
						<li><strong>Type de march&eacute; :</strong> Fournitures</li>
					</ul>
				</div>
			</li>
		</ul>
	</div>
	<div class="contentListeOffres">
		<ul>
			<li class="offre">
				<ul>
					<li><strong>Avis N&deg; :</strong> PI_DMP_DSP_013_1</li>
					<li><strong>Date de publication :</strong> 12/04/2026</li>
				</ul>
				<div class="infoOffre">
					<span class="date-response">13/06/2026</span>
					<h2 class="titre"><a href="/appel-offre/1792/modernisation-cellule-documentation-petroliere">Modernisation de la cellule de documentation petroliere</a></h2>
					<ul>
						<li><strong>Autorit&eacute; contractante :</strong> Ministere du Petrole</li>
						<li><strong>Secteur d'activit&eacute; :</strong> Prestations intellectuelles</li>
						<li><strong>Mode de passation :</strong> Avis a manifestation d'interet</li>
						<li><strong>Type de march&eacute; :</strong> Prestations intellectuelles</li>
					</ul>
				</div>
			</li>
		</ul>
	</div>
`;

describe("Niger public procurement portal parser", () => {
	it("extracts tender listing cards from the official portal HTML", () => {
		const opportunities = parseMarchesPublicsNigerHtml(listingHtml, MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL);

		expect(opportunities).toHaveLength(2);
		expect(opportunities[0]).toMatchObject({
			title: "Acquisition et installation des equipement informatique",
			source: "marches_publics_niger",
			sourceId: "marches-publics-niger-sc-ares-uam-029-1",
			noticeId: "SC_ARES_UAM_029_1",
			organization: "Universite Abdou Moumouni",
			countryRegion: "Niger",
			category: "Goods",
			opportunityType: "tender",
			publishedDate: new Date("2026-04-28T12:00:00.000Z"),
			deadline: new Date("2026-05-27T12:00:00.000Z"),
			portalUrl: "https://www.marchespublics.ne/appel-offre/1783/acquisition-et-installation-des-equipement-informatique",
			documentUrl: "https://www.marchespublics.ne/appel-offre/1783/acquisition-et-installation-des-equipement-informatique",
			tags: ["niger", "national-procurement", "west-africa", "source-api"],
		});
		expect(opportunities[1]).toMatchObject({
			sourceId: "marches-publics-niger-pi-dmp-dsp-013-1",
			category: "Consulting services",
			opportunityType: "eoi",
			organization: "Ministere du Petrole",
		});
		expect(opportunities[1].metadata.marchesPublicsNiger).toMatchObject({
			reference: "PI_DMP_DSP_013_1",
			sector: "Prestations intellectuelles",
			procurementMethod: "Avis a manifestation d'interet",
		});
	});

	it("uses the registered parser entrypoint", async () => {
		const result = await marchesPublicsNigerParser.parse({
			url: MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL,
			html: listingHtml,
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0].source).toBe("marches_publics_niger");
	});
});
