import { describe, expect, it } from "vitest";

import { unicefParser } from "@/lib/scrapers/parsers/unicef";

const serviceContractsMarkdown = `
# Service contracts tender calendar

Suppliers interested in these bidding exercises should express interest to sd.servicecontracting@unicef.org.

| Description of tender | Estimated duration of LTA/Institutional Contract | Estimated time of tender issuance |
| --- | --- | --- |
| Institutional Contract - IF Consultant East Africa | 5 months | June |
| LTA for Conferencing Telephony Equipment (Ribbon hardware and software) - (ITB) | 4 years (2 +1+1) | Q3 |
| LTA for Mobile Satellite Devices and Services | 5 years (3+1+1) | Q4 |
`;

const tenderCalendarsMarkdown = `
# Tender calendars

### [Medicines tender calendar 2025-2026](https://www.unicef.org/supply/documents/medicines-tender-calendar)

UNICEF Supply Division publishes calendar dates for planned medicines tenders.

Files available for download (1)

[Medicines tender calendar 2025-2026](https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf)

### [Education tender calendar 2026](https://www.unicef.org/supply/documents/education-tender-calendar)

Planned procurement exercises for education supplies.

[Education tender calendar 2026](https://www.unicef.org/supply/media/24816/file/UNICEF-Education-Tender-Calendar-2026.pdf)
`;

describe("UNICEF Supply Division parser", () => {
	it("extracts service-contract tender calendar rows without fake deadlines", async () => {
		const result = await unicefParser.parse({
			url: "https://www.unicef.org/supply/service-contracts-tender-calendar",
			markdown: serviceContractsMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(3);
		expect(result.opportunities[0]).toMatchObject({
			title: "Institutional Contract - IF Consultant East Africa",
			source: "unicef",
			sourceId: "unicef-institutional-contract-if-consultant-east-africa",
			organization: "UNICEF Supply Division",
			countryRegion: "East Africa",
			category: "Service contract tender calendar",
			opportunityType: "eoi",
			portalUrl: "https://www.unicef.org/supply/service-contracts-tender-calendar",
			rfpLink: "https://www.unicef.org/supply/service-contracts-tender-calendar",
			submissionMethod: "Express interest by emailing sd.servicecontracting@unicef.org; suppliers should also be registered on UNGM.",
			tags: ["unicef", "un-procurement", "tender-calendar", "service-contract"],
		});
		expect(result.opportunities[0]?.deadline).toBeUndefined();
		expect(result.opportunities[1]).toMatchObject({
			opportunityType: "tender",
			tags: ["unicef", "un-procurement", "tender-calendar", "service-contract", "ict"],
			metadata: {
				unicef: expect.objectContaining({
					estimatedDuration: "4 years (2 +1+1)",
					estimatedIssuance: "Q3",
					contactEmail: "sd.servicecontracting@unicef.org",
				}),
			},
		});
	});

	it("extracts tender calendar document cards with PDF links", async () => {
		const result = await unicefParser.parse({
			url: "https://www.unicef.org/supply/tender-calendars",
			markdown: tenderCalendarsMarkdown,
			links: [],
		});

		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]).toMatchObject({
			title: "Medicines tender calendar 2025-2026",
			source: "unicef",
			category: "UNICEF tender calendar",
			countryRegion: "Global",
			opportunityType: "eoi",
			portalUrl: "https://www.unicef.org/supply/documents/medicines-tender-calendar",
			documentUrl: "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf",
			rfpLink: "https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf",
			tags: ["unicef", "un-procurement", "tender-calendar", "supply", "health-education"],
		});
		expect(result.opportunities[1]?.documentUrl).toBe("https://www.unicef.org/supply/media/24816/file/UNICEF-Education-Tender-Calendar-2026.pdf");
	});
});
