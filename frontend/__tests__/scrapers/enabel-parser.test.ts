import { describe, expect, it } from "vitest";

import { enabelParser } from "@/lib/scrapers/parsers/enabel";

const PROCUREMENT_URL = "https://www.enabel.be/public-procurement/";
const GRANTS_URL = "https://www.enabel.be/grants/";

describe("enabelParser", () => {
	it("extracts open public procurement cards with source documents", async () => {
		const result = await enabelParser.parse({
			url: PROCUREMENT_URL,
			html: `
				<div class="card--news card--tenders | font-normal group" data-open="false">
					<div class="news__botton">
						<p class="h5"><span>GIN23006-10058 &#8211; Marché public de services relatif au contrôle et surveillance des travaux</span></p>
						<p><strong>Country : </strong> Guinea</p>
						<p><strong>Closing date : </strong> 16 June 2099 11:00 </p>
						<div class="hidden__card hidden">
							<p><strong>Status :</strong> Open</p>
							<p><strong>Applicable legislation : </strong>Belge</p>
							<p><strong>Attachments : </strong></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/05/Cahier-des-charges-Gin23006-10058.pdf" download>Cahier des charges.pdf</a></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/05/Inventaire.xlsx" download>Inventaire.xlsx</a></p>
						</div>
					</div>
				</div>
				<div class="card--news card--tenders | font-normal group" data-open="false">
					<div class="news__botton">
						<p class="h5"><span>BDI23007-10166 &#8211; Closed support programme</span></p>
						<p><strong>Country : </strong> Burundi</p>
						<p><strong>Closing date : </strong> 19 November 2099 12:00 </p>
						<div class="hidden__card hidden">
							<p><strong>Status :</strong> Close</p>
							<p><strong>Attachments : </strong></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/10/closed.pdf" download>closed.pdf</a></p>
						</div>
					</div>
				</div>
				<div class="card--news card--tenders | font-normal group" data-open="false">
					<div class="news__botton">
						<p class="h5"><span>TZA23004-10010 &#8211; Information Session questions and answers</span></p>
						<p><strong>Country : </strong> Tanzania</p>
						<div class="hidden__card hidden">
							<p><strong>Attachments : </strong></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/11/questions.pdf" download>questions.pdf</a></p>
						</div>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Marché public de services relatif au contrôle et surveillance des travaux",
			source: "enabel",
			sourceId: "enabel-gin23006-10058",
			noticeId: "GIN23006-10058",
			organization: "Enabel",
			category: "Enabel public procurement",
			opportunityType: "tender",
			countryRegion: "Guinea",
			documentUrl: "https://www.enabel.be/app/uploads/2099/05/Cahier-des-charges-Gin23006-10058.pdf",
			rfpLink: "https://www.enabel.be/app/uploads/2099/05/Cahier-des-charges-Gin23006-10058.pdf",
			tags: ["enabel", "bilateral-donor", "source-scrape", "source-documents"],
		}));
		expect(result.opportunities[0]?.deadline).toEqual(new Date(2099, 5, 16));
		expect(result.opportunities[0]?.metadata?.enabel).toEqual(expect.objectContaining({
			reference: "GIN23006-10058",
			status: "Open",
			applicableLegislation: "Belge",
			documentLinks: [
				{
					url: "https://www.enabel.be/app/uploads/2099/05/Cahier-des-charges-Gin23006-10058.pdf",
					label: "Cahier des charges.pdf",
				},
				{
					url: "https://www.enabel.be/app/uploads/2099/05/Inventaire.xlsx",
					label: "Inventaire.xlsx",
				},
			],
		}));
	});

	it("extracts open grant cards and filters expired opportunities", async () => {
		const result = await enabelParser.parse({
			url: GRANTS_URL,
			html: `
				<div class="card--news card--tenders | font-normal group" data-open="false">
					<div class="news__botton">
						<p class="h5"><span>BDI23007-10156 &#8211; Appel à propositions pour appuyer l'entrepreneuriat féminin</span></p>
						<p><strong>Country : </strong> Burundi</p>
						<p><strong>Closing date : </strong> 06 July 2099 10:00 </p>
						<div class="hidden__card hidden">
							<p><strong>Status :</strong> Open</p>
							<p><strong>Description : </strong></p>
							Un appel à propositions ouvert pour financer des activités de terrain avec dossiers de candidature.
							<p><strong>Attachments : </strong></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/06/BDI23007-10156-Guidelines.pdf" download>Guidelines.pdf</a></p>
							<p><a href="https://www.enabel.be/app/uploads/2099/06/Application-File.docx" download>Application File.docx</a></p>
						</div>
					</div>
				</div>
				<div class="card--news card--tenders | font-normal group" data-open="false">
					<div class="news__botton">
						<p class="h5"><span>PSE220004-10069 &#8211; Expired grant</span></p>
						<p><strong>Country : </strong> Palestine</p>
						<p><strong>Closing date : </strong> 12 October 2020 13:00 </p>
						<div class="hidden__card hidden">
							<p><strong>Status :</strong> Open</p>
							<p><strong>Attachments : </strong></p>
							<p><a href="https://www.enabel.be/app/uploads/2020/09/expired.pdf" download>expired.pdf</a></p>
						</div>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			title: "Appel à propositions pour appuyer l'entrepreneuriat féminin",
			sourceId: "enabel-bdi23007-10156",
			category: "Enabel grant",
			opportunityType: "grant",
			countryRegion: "Burundi",
			documentUrl: "https://www.enabel.be/app/uploads/2099/06/BDI23007-10156-Guidelines.pdf",
			projectSummary: "Un appel à propositions ouvert pour financer des activités de terrain avec dossiers de candidature.",
		}));
	});
});
