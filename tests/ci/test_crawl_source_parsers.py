"""Pure-parser tests for crawl source payloads (World Bank procnotices, UNGM HTML)."""

from __future__ import annotations

from docfusion.workers.daily_crawl.runner import _parse_procnotices, _parse_ungm_rows

WB_SAMPLE = {
	"rows": 2,
	"procnotices": [
		{
			"id": "OP00461952",
			"notice_type": "Request for Expression of Interest",
			"noticedate": "12-Aug-2026",
			"notice_status": "Published",
			"submission_deadline_date": "2026-08-26T00:00:00Z",
			"project_ctry_name": "Lebanon",
			"project_id": "P180334",
			"project_name": "Green Agrifood Transformation",
			"bid_reference_no": "LB-KAFALAT-564926-CS-INDV",
			"bid_description": "Credit Administration Officer",
			"procurement_method_name": "Individual Consultant Selection",
		},
		{
			# Missing bid_description → skipped
			"id": "OP00000001",
			"notice_type": "Contract Award",
		},
	],
}


def test_parse_procnotices_maps_fields():
	opps = _parse_procnotices(WB_SAMPLE)
	assert len(opps) == 1
	o = opps[0]
	assert o.title == "Credit Administration Officer"
	assert o.source == "worldbank-procurement"
	assert o.organization == "Lebanon"
	assert o.deadline == "2026-08-26T00:00:00Z"
	assert o.reference == "LB-KAFALAT-564926-CS-INDV"
	assert "procurement-detail/OP00461952" in o.source_url
	assert "Request for Expression of Interest" in o.description


def test_parse_procnotices_empty_payload():
	assert _parse_procnotices({}) == []
	assert _parse_procnotices({"procnotices": []}) == []


UNGM_SAMPLE = """
<div role="row" tabindex="0" data-noticeid="311010" class="tableRow dataRow notice-table">
  <div role="cell" class="tableCell resultTitle">
    <span class="ungm-title ungm-title--small">
      Request for Proposal (RFP) for Dairy Cattle Breeding Services
    </span>
    <a target='_blank' href='/Public/Notice/311010'>link</a>
  </div>
  <div role="cell" class="tableCell resultInfo1 deadline" data-description="Deadline">
    <span>07-Sep-2026 15:00
(GMT 13.00)</span>
  </div>
  <div role="cell" class="tableCell"><span>14-Aug-2026</span></div>
  <div role="cell" class="tableCell resultAgency"><span>FAO</span></div>
  <div role="cell" class="tableCell"><span><label for='Invitation to bid'>Invitation to bid</label></span></div>
  <div role="cell" class="tableCell resultInfo1" data-description="Reference"><span>2026/SAPDD/137785</span></div>
  <div role="cell" class="tableCell"><span>Samoa</span></div>
</div>
<div role="row" tabindex="0" data-noticeid="311011" class="tableRow dataRow notice-table">
  <div role="cell" class="tableCell resultTitle">
    <span class="ungm-title ungm-title--small">Second Notice</span>
  </div>
  <div role="cell" class="tableCell resultAgency"><span>WHO</span></div>
</div>
"""


def test_parse_ungm_rows():
	opps = _parse_ungm_rows(UNGM_SAMPLE)
	assert len(opps) == 2
	first = opps[0]
	assert (
		first.title == "Request for Proposal (RFP) for Dairy Cattle Breeding Services"
	)
	assert first.source_url == "https://www.ungm.org/Public/Notice/311010"
	assert first.deadline == "07-Sep-2026"
	assert first.organization == "FAO"
	assert first.reference == "2026/SAPDD/137785"
	second = opps[1]
	assert second.title == "Second Notice"
	assert second.organization == "WHO"
	assert second.deadline == ""


def test_parse_ungm_rows_empty():
	assert _parse_ungm_rows("") == []
	assert _parse_ungm_rows("<html><body>no rows</body></html>") == []
