import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPublicHttpUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/public-url", () => ({
	fetchPublicHttpUrl: fetchPublicHttpUrlMock,
}));

import { fetchUngmOpportunities, isUngmUrl } from "@/lib/services/ungm-client";

describe("UNGM client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fetchPublicHttpUrlMock.mockResolvedValueOnce(new Response(`
			<div role="row" data-noticeid="300726" class="tableRow dataRow notice-table">
				<div role="cell"></div>
				<div role="cell"><span class="ungm-title">Consulting services</span><a href="/Public/Notice/300726">Open</a></div>
				<div role="cell"><span>26-May-2026 15:30 (GMT -4.00)</span></div>
				<div role="cell"><span>13-May-2026</span></div>
				<div role="cell"><span>UNDP</span></div>
				<div role="cell"><span>Request for proposal</span></div>
				<div role="cell"><span>UNDP-001</span></div>
				<div role="cell"><span>Kenya</span></div>
			</div>
			<script>var noticeTotal = "42";</script>
		`, { status: 200 }));
		fetchPublicHttpUrlMock.mockResolvedValueOnce(new Response(`
			<div class="ungm-list-item ungm-background">
				<div class="title">Description</div>
				<div><p>Prepare a governance platform implementation proposal.</p></div>
			</div>
			<a href="mailto:procurement@example.org">procurement@example.org</a>
			<table id="tblLinks">
				<tr data-id="1">
					<td>https://undp.sharepoint.com/sites/Docs-Public/Procurement</td>
					<td>Negotiation Document(s)</td>
				</tr>
			</table>
		`, { status: 200 }));
	});

	it("recognizes UNGM public source URLs", () => {
		expect(isUngmUrl("https://www.ungm.org/Public/Notice")).toBe(true);
		expect(isUngmUrl("https://ungm.org/Public/Notice")).toBe(true);
		expect(isUngmUrl("https://example.org/Public/Notice")).toBe(false);
	});

	it("posts the public notice search payload and maps row fragments", async () => {
		const result = await fetchUngmOpportunities("https://www.ungm.org/Public/Notice?country=123&noticeType=RequestForProposal", {
			limit: 5,
			now: new Date(2026, 4, 26, 10, 0, 0),
			timeoutMs: 1000,
		});

		expect(fetchPublicHttpUrlMock).toHaveBeenNthCalledWith(1, "https://www.ungm.org/Public/Notice/Search", expect.objectContaining({
			method: "POST",
			timeoutMs: 1000,
			body: expect.stringContaining("\"PageSize\":5"),
		}), "UNGM notice search URL");
		const requestBody = JSON.parse(fetchPublicHttpUrlMock.mock.calls[0][1].body);
		expect(requestBody).toEqual(expect.objectContaining({
			Countries: [123],
			NoticeTypes: ["RequestForProposal"],
			PublishedTo: "26-May-26",
			DeadlineFrom: "26-May-26",
			IsActive: true,
		}));
		expect(fetchPublicHttpUrlMock).toHaveBeenNthCalledWith(2, "https://www.ungm.org/Public/Notice/Popup/300726", expect.objectContaining({
			method: "GET",
			timeoutMs: 1000,
		}), "UNGM notice detail URL");
		expect(result.total).toBe(42);
		expect(result.opportunities).toEqual([
			expect.objectContaining({
				title: "Consulting services",
				source: "ungm",
				sourceId: "300726",
				noticeId: "UNDP-001",
				organization: "UNDP",
				countryRegion: "Kenya",
				category: "Request for proposal",
				opportunityType: "rfp",
				projectSummary: "Prepare a governance platform implementation proposal.",
				submissionMethod: "Negotiation Document(s)",
				rfpLink: "https://undp.sharepoint.com/sites/Docs-Public/Procurement",
				metadata: expect.objectContaining({
					ungm: expect.objectContaining({
						contactEmail: "procurement@example.org",
						primaryLink: {
							url: "https://undp.sharepoint.com/sites/Docs-Public/Procurement",
							description: "Negotiation Document(s)",
						},
					}),
				}),
			}),
		]);
	});
});
