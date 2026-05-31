import { afterEach, describe, expect, it, vi } from "vitest";

import { ircParser, parseIrcProcurementHtml } from "@/lib/scrapers/parsers/irc";

const SOURCE_URL = "https://www.rescue.org/procurement-policies-and-bid-opportunities";

const LISTING_HTML = `
	<ul>
		<li class="rpll-one-column-list__item">
			<div class="rplc-teaser-basic rplc-teaser-basic--date-before-summary">
				<a href="/rfp/it-equipment-opt-palestine" class="rplc-teaser-basic__wrapper-link" aria-label="IT Equipment for oPT, Palestine">
					<div class="rplc-teaser-basic__slug"><div>RFP</div></div>
					<h2 class="rplc-teaser-basic__title">IT Equipment for oPT, Palestine</h2>
					<div class="rplc-teaser-basic__date"><div>May 21, 2099</div></div>
					<div class="rplc-teaser-basic__summary"><div class="rpla-paragraph">Supply IT equipment for the IRC response.</div></div>
				</a>
			</div>
		</li>
	</ul>
`;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ircParser", () => {
	it("extracts IRC RFP cards from the procurement listing", () => {
		const opportunities = parseIrcProcurementHtml(LISTING_HTML, SOURCE_URL);

		expect(opportunities).toHaveLength(1);
		expect(opportunities[0]).toEqual(expect.objectContaining({
			title: "IT Equipment for oPT, Palestine",
			source: "irc",
			sourceId: "irc-it-equipment-opt-palestine",
			organization: "International Rescue Committee",
			publishedDate: new Date(2099, 4, 21),
			portalUrl: "https://www.rescue.org/rfp/it-equipment-opt-palestine",
			documentUrl: "https://www.rescue.org/rfp/it-equipment-opt-palestine",
			tags: ["irc", "ngo", "source-scrape", "source-documents"],
		}));
	});

	it("enriches cards with package links from detail redirects", async () => {
		const fetchMock = vi.fn(async (url: string) => {
			if (url === SOURCE_URL) {
				return new Response(LISTING_HTML, { status: 200, headers: { "content-type": "text/html" } });
			}
			return new Response("", {
				status: 302,
				headers: { location: "https://rescue.box.com/s/package123" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await ircParser.parse({ url: SOURCE_URL });

		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]).toEqual(expect.objectContaining({
			documentUrl: "https://rescue.box.com/s/package123",
			rfpLink: "https://rescue.box.com/s/package123",
			metadata: expect.objectContaining({
				irc: expect.objectContaining({
					documentLinks: [{ url: "https://rescue.box.com/s/package123", label: "https://rescue.box.com/s/package123" }],
				}),
			}),
		}));
		expect(fetchMock).toHaveBeenCalledWith(SOURCE_URL, expect.objectContaining({ method: "GET" }));
		expect(fetchMock).toHaveBeenCalledWith("https://www.rescue.org/rfp/it-equipment-opt-palestine", expect.objectContaining({ method: "GET" }));
	});
});
