import { describe, expect, it } from "vitest";

import {
	DGMP_MALI_AMI_URL,
	DGMP_MALI_APPELS_OFFRES_URL,
	dgmpMaliParser,
	parseDgmpMaliHtml,
} from "@/lib/scrapers/parsers/dgmp-mali";

const appelsOffresHtml = `
	<table class="responstable DataTable">
		<tbody>
			<tr>
				<td>AUTORITE MALIENNE DE REGULATION DES TELECOMMUNICATIONS/TIC ET DES POSTES</td>
				<td>AUTORITE MALIENNE DE REGULATION DES TELECOMMUNICATIONS/TIC ET DES POSTES</td>
				<td>Conception d'un systeme de gestion des infrastructures telecoms</td>
				<td align="center">19/05/2026</td>
				<td align="center"><a href="./sites/default/files/DATA_IN/229871_AAO_616443.docx" title="Telecharger le document">Telecharger</a></td>
			</tr>
			<tr>
				<td>MINISTERE DE L'EDUCATION NATIONALE</td>
				<td>DIRECTION FINANCES ET MATERIEL</td>
				<td>Fourniture de pieces de rechange pour vehicules</td>
				<td align="center">20/01/2021</td>
				<td align="center"><a href="./sites/default/files/DATA_IN/79029_AAO_287517.pdf" title="Telecharger le document">Telecharger</a></td>
			</tr>
		</tbody>
	</table>
`;

const amiHtml = `
	<table class="responstable DataTable">
		<tbody>
			<tr>
				<td>MINISTERE DE L'ECONOMIE ET DES FINANCES</td>
				<td>DIRECTION DES FINANCES ET DU MATERIEL</td>
				<td>Recrutement d'un consultant individuel pour l'animation de sessions de formation sur les procedures de passation</td>
				<td align="center">08/05/2026</td>
				<td align="center"><a href="./sites/default/files/DATA_IN/228785_AMI_623579.docx" title="Telecharger le document">Telecharger</a></td>
			</tr>
		</tbody>
	</table>
`;

describe("DGMP Mali parser", () => {
	it("extracts current-year direct-document tenders and skips stale historical rows", () => {
		const opportunities = parseDgmpMaliHtml(appelsOffresHtml, DGMP_MALI_APPELS_OFFRES_URL, { currentYear: 2026 });

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			title: "Conception d'un systeme de gestion des infrastructures telecoms",
			source: "dgmp_mali",
			sourceId: "dgmp-mali-229871-aao-616443",
			noticeId: "229871-aao-616443",
			organization: "AUTORITE MALIENNE DE REGULATION DES TELECOMMUNICATIONS/TIC ET DES POSTES",
			countryRegion: "Mali",
			category: "ICT services",
			opportunityType: "tender",
			publishedDate: new Date("2026-05-19T12:00:00.000Z"),
			portalUrl: DGMP_MALI_APPELS_OFFRES_URL,
			documentUrl: "https://www.dgmp.gouv.ml/sites/default/files/DATA_IN/229871_AAO_616443.docx",
			tags: ["mali", "national-procurement", "west-africa", "source-api", "direct-documents"],
		});
	});

	it("classifies manifestation d'interet rows as RFP consulting opportunities", () => {
		const opportunities = parseDgmpMaliHtml(amiHtml, DGMP_MALI_AMI_URL, { currentYear: 2026 });

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toMatchObject({
			sourceId: "dgmp-mali-228785-ami-623579",
			category: "Consulting services",
			opportunityType: "rfp",
		});
		expect(opportunities[0].metadata.dgmpMali).toMatchObject({
			sourceSection: "manifestation_interet",
			documentId: "228785-ami-623579",
		});
	});

	it("uses the registered parser entrypoint", async () => {
		const result = await dgmpMaliParser.parse({
			url: DGMP_MALI_AMI_URL,
			html: amiHtml,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0].source).toBe("dgmp_mali");
	});
});
