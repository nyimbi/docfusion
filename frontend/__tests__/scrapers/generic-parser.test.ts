import { describe, expect, it } from "vitest";

import { genericParser } from "@/lib/scrapers/parsers/generic";

describe("generic tender parser", () => {
	it("normalizes field-packed procurement table links", async () => {
		const result = await genericParser.parse({
			url: "https://procurement-notices.undp.org",
			markdown: [
				"[Title\\ \\ Wool handloom value chain, Livelihood Enterprise Development & Community Cons\\ \\ Ref No\\ \\ UNDP-IND-00772,1\\ \\ UNDP Office/Country\\ \\ UNDP-IND/INDIA\\ \\ Process\\ \\ RFP - Request for proposal\\ \\ Deadline\\ \\ 09-Jun-26 \\ 08:00 AM (New York time)\\ \\ Posted\\ \\ 26-May-26](https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879)",
			].join("\n"),
			links: [],
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Wool handloom value chain, Livelihood Enterprise Development & Community Cons",
				noticeId: "UNDP-IND-00772,1",
				organization: "UNDP-IND",
				countryRegion: "INDIA",
				projectSummary: "Process: RFP - Request for proposal",
				portalUrl: "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=45879",
			}),
		]);
		expect(String(result.opportunities[0].title)).not.toContain("Ref No");
	});

	it("extracts browser fallback HTML tender cards", async () => {
		const result = await genericParser.parse({
			url: "https://www.savethechildren.net/tenders",
			markdown: `
				<div class="three_col-listing-card">
					<h3 class="three_col-listing-card__title_h3">
						Provision of technical expertise in carrying out high quality Household Economy Analysis (HEA)
					</h3>
					<div class="three_col-listing-card__description">
						<p>Save the Children International (SCI) is inviting proposals for the provision of technical expertise in carrying out high quality Household Economy Analysis.</p>
					</div>
					<div class="three_col-listing-card__start-date">26 May 2026</div>
					<div class="three_col-listing-card__country">Worldwide</div>
					<div class="three_col-listing-card__deadline">Deadline: 18 June 2026</div>
				</div>
			`,
			links: [],
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Provision of technical expertise in carrying out high quality Household Economy Analysis (HEA)",
				countryRegion: undefined,
				portalUrl: "https://www.savethechildren.net/tenders",
			}),
		]);
	});

	it("extracts raw HTML procurement table links with closing dates", async () => {
		const result = await genericParser.parse({
			url: "https://www.spc.int/procurement",
			markdown: `
				<table>
					<tr>
						<td>
							<a href="/tender/policy-dialogue-shared-decision-making-and-womens-leadership-in-the-pacific">
								Policy Dialogue on Shared Decision-Making and Women's Leadership in the Pacific
							</a>
							<p>Posting date: <time datetime="2026-03-09T00:28:38+00:00">9 March 2026</time><br>
							Closing Date: <time datetime="2026-03-20T12:00:00Z">20 March 2026</time></p>
							<h3>Extension to Deadline for submissions:</h3>
							<p>The Pacific Community hereby gives notice that the closing deadline for submissions is now until the 20/3/26.</p>
						</td>
						<td>Fiji</td>
					</tr>
				</table>
			`,
			links: [],
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Policy Dialogue on Shared Decision-Making and Women's Leadership in the Pacific",
				portalUrl: "https://www.spc.int/tender/policy-dialogue-shared-decision-making-and-womens-leadership-in-the-pacific",
			}),
		]);
	});

	it("does not treat contract awards as active tenders", async () => {
		const result = await genericParser.parse({
			url: "https://buyer.example/procurement",
			markdown: `
				<a href="/awards/case-management-platform">Contract Award: Case Management Platform</a>
				<p>Closing Date: 20 June 2026</p>
			`,
			links: [],
		});

		expect(result.opportunities).toEqual([]);
	});

	it("recognizes Spanish, French, and Portuguese Global South tender language", async () => {
		const result = await genericParser.parse({
			url: "https://global-south.example/procurement",
			markdown: `
				<a href="/procesos/123">Licitación publica para plataforma de datos</a>
				<p>Entidad contratante: Ministerio de Salud. Fecha límite: 20/06/2026.</p>

				<a href="/marches/456">Avis d'appel d'offres pour services de conseil</a>
				<p>Date limite: 21 Juin 2026. Pays: Senegal.</p>

				<a href="/compras/789">Pregão eletrônico para sistema de monitoramento</a>
				<p>Data limite: 22/06/2026.</p>
			`,
			links: [],
		});

		expect(result.opportunities).toEqual(expect.arrayContaining([
			expect.objectContaining({
				title: "Licitación publica para plataforma de datos",
				portalUrl: "https://global-south.example/procesos/123",
			}),
			expect.objectContaining({
				title: "Avis d'appel d'offres pour services de conseil",
				portalUrl: "https://global-south.example/marches/456",
			}),
			expect.objectContaining({
				title: "Pregão eletrônico para sistema de monitoramento",
				portalUrl: "https://global-south.example/compras/789",
			}),
		]));
	});
});
