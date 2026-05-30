import { describe, expect, it } from "vitest";

import { mercyCorpsParser } from "@/lib/scrapers/parsers/mercy-corps";

describe("Mercy Corps parser", () => {
	it("extracts tender cards with country, deadline, and detail source document", async () => {
		const result = await mercyCorpsParser.parse({
			url: "https://www.mercycorps.org/tenders",
			html: `
				<div class="c-view__row">
					<div class="c-button-box">
						<a href="/tenders/it-hardware-rfi-care-plan-international-save-children-mercy-corps" class="c-button-box__link">
							<h3 class="c-button-box__title">IT Hardware RFI (CARE, Plan International, Save the Children, Mercy Corps).</h3>
						</a>
						<div class="c-button-box__summary">
							<div class="c-field c-field--name-field-tendering-office">
								<div class="c-field__label is-inline">Tendering office</div><div class="c-field__content">HQ - US</div>
							</div>
							<div class="c-field c-field--name-field-date">
								<div class="c-field__label is-inline">Open date</div><div class="c-field__content"><time datetime="2026-05-25T21:05:00Z">May 25, 2026, 2:05pm</time> to <time datetime="2026-06-13T06:55:00Z">Jun 12, 2026, 11:55pm</time></div>
							</div>
						</div>
					</div>
				</div>
			`,
		});

		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "IT Hardware RFI (CARE, Plan International, Save the Children, Mercy Corps).",
				source: "mercy_corps",
				sourceId: "mercy-corps-it-hardware-rfi-care-plan-international-save-children-mercy-corps",
				organization: "Mercy Corps",
				opportunityType: "tender",
				portalUrl: "https://www.mercycorps.org/tenders/it-hardware-rfi-care-plan-international-save-children-mercy-corps",
				documentUrl: "https://www.mercycorps.org/tenders/it-hardware-rfi-care-plan-international-save-children-mercy-corps",
				projectSummary: "Tendering office: HQ - US",
			}),
		]);
		expect(result.opportunities[0]?.deadline).toEqual(new Date("2026-06-13T06:55:00Z"));
	});
});
