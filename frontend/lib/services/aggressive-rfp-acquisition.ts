import {
	DEFAULT_DISCOVERY_SEARCH_ENGINES,
} from "@/lib/services/default-discovery-sources";
import type { DiscoveryImportInput } from "@/lib/services/opportunity-discovery-import";

export type AggressiveRfpAcquisitionCampaign = {
	id: string;
	label: string;
	queries?: string[];
	sourceUrls?: string[];
};

export type AggressiveRfpAcquisitionOptions = {
	campaignIds?: string[];
	limitPerQuery: number;
	searchPages: number;
	sourceScrapeLimit: number;
	scrapeLimit: number;
	browserFallbackLimit: number;
	downloadLimit: number;
	downloadParseMode: NonNullable<DiscoveryImportInput["downloadParseMode"]>;
};

export type AggressiveRfpAcquisitionRunInput = {
	campaign: AggressiveRfpAcquisitionCampaign;
	input: DiscoveryImportInput;
};

const SOURCE_URLS: Record<string, string> = {
	kenyaPpip: "https://tenders.go.ke/tenders",
	ungm: "https://www.ungm.org/Public/Notice",
	unops: "https://www.unops.org/business-opportunities",
	iom: "https://www.iom.int/procurement-opportunities",
	who: "https://www.who.int/about/accountability/procurement",
	ilo: "https://www.ilo.org/about-ilo/procurement",
	fao: "https://www.fao.org/unfao/procurement/en/",
	ifad: "https://www.ifad.org/en/corporate-procurement",
	unesco: "https://www.unesco.org/en/procurement",
	undp: "https://procurement-notices.undp.org",
	worldBank: "https://projects.worldbank.org/en/projects-operations/procurement",
	afdb: "https://www.afdb.org/en/projects-and-operations/procurement",
	adb: "https://www.adb.org/business/institutional-procurement/notices",
	africanUnion: "https://au.int/en/bids",
	aiib: "https://www.aiib.org/en/opportunities/business/project-procurement/list.html",
	isdb: "https://www.isdb.org/project-procurement/tenders",
	ebrd: "https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html",
	comesa: "https://www.comesa.int/category/open-tenders/",
	unProcurement: "https://www.un.org/procurement/solicitations-opportunities",
	unicef: "https://www.unicef.org/supply/service-contracts-tender-calendar",
	cdb: "https://www.caribank.org/work-with-us/procurement/procurement-notices",
	cebMauritius: "https://ceb.mu/procurement/tender",
	samRfp: "https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22",
	samUsaid: "https://sam.gov/search/?index=opp&keywords=USAID",
	euFunding: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal",
	southAfrica: "https://ocds-api.etenders.gov.za/api/OCDSReleases",
	tanzania: "https://nest.go.tz/gateway/nest-data-portal-api/api/releases",
	uganda: "https://cdn.ppda.go.ug/api/bid-invitations",
	rwanda: "https://www.umucyo.gov.rw/eb/bav/selectListAdvertisingListForGU.do?menuId=EB01020100&leftTopFlag=l&recordCountPerPage=50",
	ghana: "https://www.ghaneps.gov.gh/epps/quickSearchAction.do?searchSelect=6",
	zambia: "https://eprocure.zppa.org.zm/epps/quickSearchAction.do?searchSelect=6",
	malawi: "https://maneps.mw/rms/api/tender-notices/active-tenders-search",
	nigeria: "https://nocopo.bpp.gov.ng/Open-Data",
	namibia: "https://www.cpbn.com.na/index/external/2",
	eswatini: "https://esppra.co.sz/sppra/tender.php",
	gizGhana: "https://www.giz.de/en/regions/africa/ghana/tenders",
	gizSouthAfrica: "https://www.giz.de/en/regions/africa/south-africa/tenders",
	ukContractsFinder: "https://www.contractsfinder.service.gov.uk/Search",
	canadaBuys: "https://canadabuys.canada.ca/en/tender-opportunities",
	australiaAusTender: "https://www.tenders.gov.au/atm",
	newZealandGets: "https://www.gets.govt.nz/ExternalIndex.htm",
	usGrants: "https://www.grants.gov/search-grants",
	usaidBusinessForecast: "https://www.usaid.gov/business-forecast",
	mercyCorpsTenders: "https://www.mercycorps.org/tenders",
	crsBidOpportunities: "https://www.crs.org/bid-opportunities",
	saveChildrenIntlTenders: "https://www.savethechildren.net/tenders",
	planInternationalTenders: "https://plan-international.org/calls-tender/",
	daiSupplierPortal: "https://www.dai.com/our-work/supplier-registration-portal",
	fcdoProcurement: "https://www.gov.uk/government/organisations/foreign-commonwealth-development-office/about/procurement",
	fcdoServicesSupplier: "https://www.fcdoservices.gov.uk/why-choose-us/becoming-a-supplier/",
	gtaiTenders: "https://www.gtai.de/en/trade/tenders",
	idbProcurementNotices: "https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices",
	idbCorporateProcurement: "https://www.iadb.org/en/how-we-can-work-together/procurement/corporate-procurement/corporate-procurement-opportunities",
	pacificCommunityProcurement: "https://www.spc.int/procurement",
};

export const DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS: AggressiveRfpAcquisitionCampaign[] = [
	{
		id: "un_multilateral",
		label: "UN and multilateral procurement portals",
		sourceUrls: [
			SOURCE_URLS.ungm,
			SOURCE_URLS.unops,
			SOURCE_URLS.iom,
			SOURCE_URLS.who,
			SOURCE_URLS.ilo,
			SOURCE_URLS.fao,
			SOURCE_URLS.ifad,
			SOURCE_URLS.unesco,
			SOURCE_URLS.undp,
			SOURCE_URLS.unProcurement,
			SOURCE_URLS.unicef,
		],
	},
	{
		id: "development_banks",
		label: "Development-bank and donor procurement portals",
		sourceUrls: [
			SOURCE_URLS.worldBank,
			SOURCE_URLS.afdb,
			SOURCE_URLS.adb,
			SOURCE_URLS.aiib,
			SOURCE_URLS.isdb,
			SOURCE_URLS.ebrd,
			SOURCE_URLS.cdb,
			SOURCE_URLS.cebMauritius,
			SOURCE_URLS.euFunding,
		],
	},
	{
		id: "africa_national",
		label: "African national procurement portals",
		sourceUrls: [
			SOURCE_URLS.kenyaPpip,
			SOURCE_URLS.southAfrica,
			SOURCE_URLS.tanzania,
			SOURCE_URLS.uganda,
			SOURCE_URLS.rwanda,
			SOURCE_URLS.ghana,
			SOURCE_URLS.zambia,
			SOURCE_URLS.malawi,
			SOURCE_URLS.nigeria,
			SOURCE_URLS.namibia,
			SOURCE_URLS.eswatini,
			SOURCE_URLS.africanUnion,
			SOURCE_URLS.comesa,
			SOURCE_URLS.gizGhana,
			SOURCE_URLS.gizSouthAfrica,
		],
	},
	{
		id: "high_intent_search",
		label: "High-intent RFP search fanout",
		queries: [
			"\"request for proposals\" \"submission deadline\" ICT OR software OR data",
			"\"terms of reference\" consultancy \"submission deadline\" Africa",
			"\"expression of interest\" \"consulting services\" \"deadline\" Africa",
			"\"request for quotations\" ICT procurement deadline Africa",
			"\"call for proposals\" digital health Africa deadline",
			"\"grant management system\" tender OR RFP",
			"\"ERP implementation\" tender \"deadline\"",
			"\"monitoring and evaluation\" \"request for proposals\" deadline",
			"\"request for proposals\" \"questions\" \"proposal due\"",
			"\"solicitation\" \"proposal due date\" \"consulting services\"",
			"\"tender document\" \"submission deadline\" \"software\"",
			"\"request for proposals\" \"data platform\" \"deadline\"",
			"\"request for proposals\" \"AI\" OR \"artificial intelligence\" procurement",
		],
	},
	{
		id: "document_search",
		label: "Direct RFP document search fanout",
		queries: [
			"filetype:pdf \"request for proposals\" \"submission deadline\"",
			"filetype:pdf \"terms of reference\" proposal deadline",
			"filetype:pdf \"expression of interest\" \"consulting services\" deadline",
			"filetype:docx \"request for proposals\" procurement",
			"site:worldbank.org \"request for expressions of interest\"",
			"site:ungm.org \"Request for Proposal\" \"Published\"",
			"site:procurement-notices.undp.org \"RFP\" \"Deadline\"",
			"site:sam.gov \"request for proposal\" \"response date\"",
			"filetype:pdf \"solicitation\" \"proposal due date\"",
			"filetype:pdf \"invitation for bids\" \"deadline for submission\"",
			"filetype:pdf \"call for proposals\" \"application deadline\"",
			"filetype:pdf \"tender document\" \"closing date\" \"ICT\"",
		],
	},
	{
		id: "global_public_sector",
		label: "Global public-sector procurement portals",
		sourceUrls: [
			SOURCE_URLS.samRfp,
			SOURCE_URLS.samUsaid,
			SOURCE_URLS.usaidBusinessForecast,
			SOURCE_URLS.usGrants,
			SOURCE_URLS.ukContractsFinder,
			SOURCE_URLS.canadaBuys,
			SOURCE_URLS.australiaAusTender,
			SOURCE_URLS.newZealandGets,
		],
		queries: [
			"site:sam.gov \"request for proposal\" \"response date\"",
			"site:sam.gov \"solicitation\" \"proposal due\"",
			"site:usaid.gov \"request for proposals\" \"deadline\"",
			"site:grants.gov \"forecasted\" \"opportunity\" \"deadline\"",
			"site:contractsfinder.service.gov.uk \"tender\" \"closing date\"",
			"site:canadabuys.canada.ca \"request for proposal\" \"closing date\"",
			"site:tenders.gov.au \"ATM\" \"close date\" \"request for tender\"",
			"site:gets.govt.nz \"Request for Proposal\" \"deadline\"",
		],
	},
	{
		id: "global_regional_search",
		label: "Regional and non-Africa RFP search fanout",
		sourceUrls: [
			SOURCE_URLS.idbProcurementNotices,
			SOURCE_URLS.idbCorporateProcurement,
			SOURCE_URLS.pacificCommunityProcurement,
		],
		queries: [
			"\"request for proposals\" \"submission deadline\" \"Latin America\"",
			"\"request for proposals\" \"submission deadline\" Caribbean",
			"\"expression of interest\" \"consulting services\" \"Asia\" deadline",
			"\"request for proposals\" \"Middle East\" procurement deadline",
			"\"request for proposals\" \"Pacific\" \"closing date\"",
			"\"tender notice\" \"software development\" \"closing date\" \"Europe\"",
			"\"call for proposals\" \"digital transformation\" deadline global",
			"\"terms of reference\" \"consultancy\" \"deadline\" \"international\"",
			"site:iadb.org procurement \"request for proposals\"",
			"site:spc.int/procurement \"request for proposal\"",
		],
	},
	{
		id: "donor_ngo_search",
		label: "Donor and NGO procurement search fanout",
		sourceUrls: [
			SOURCE_URLS.mercyCorpsTenders,
			SOURCE_URLS.crsBidOpportunities,
			SOURCE_URLS.saveChildrenIntlTenders,
			SOURCE_URLS.planInternationalTenders,
			SOURCE_URLS.daiSupplierPortal,
			SOURCE_URLS.fcdoProcurement,
			SOURCE_URLS.fcdoServicesSupplier,
			SOURCE_URLS.gtaiTenders,
		],
		queries: [
			"site:giz.de \"tenders\" \"deadline\" \"request for proposals\"",
			"site:kfw-entwicklungsbank.de \"tender\" \"deadline\"",
			"site:fcdoservices.gov.uk \"tender\" \"deadline\"",
			"site:chemonics.com \"request for proposals\" \"deadline\"",
			"site:dai.com \"request for proposals\" \"deadline\"",
			"site:dai.com/uploads \"request for proposals\" DAI",
			"site:dai.com/uploads \"request for expressions of interest\" DAI",
			"site:mercycorps.org \"tender\" \"deadline\"",
			"site:crs.org \"request for proposals\" \"deadline\"",
			"site:savethechildren.net \"request for proposal\" procurement",
			"site:plan-international.org/calls-tender tender deadline",
		],
	},
];

export function selectAggressiveRfpAcquisitionCampaigns(
	campaignIds: string[] | undefined,
	campaigns = DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS
): AggressiveRfpAcquisitionCampaign[] {
	if (!campaignIds?.length) return campaigns;
	const requested = new Set(campaignIds.map((id) => id.trim()).filter(Boolean));
	return campaigns.filter((campaign) => requested.has(campaign.id));
}

export function buildAggressiveRfpAcquisitionInputs(
	options: AggressiveRfpAcquisitionOptions,
	campaigns = DEFAULT_AGGRESSIVE_RFP_ACQUISITION_CAMPAIGNS
): AggressiveRfpAcquisitionRunInput[] {
	const selected = selectAggressiveRfpAcquisitionCampaigns(options.campaignIds, campaigns);
	return selected.map((campaign) => {
		const hasQueries = Boolean(campaign.queries?.length);
		const hasSources = Boolean(campaign.sourceUrls?.length);
		return {
			campaign,
			input: {
				queries: hasQueries ? campaign.queries : [],
				sourceUrls: hasSources ? campaign.sourceUrls : [],
				engines: [...DEFAULT_DISCOVERY_SEARCH_ENGINES],
				searchEngineFanout: true,
				searchPages: options.searchPages,
				limitPerQuery: options.limitPerQuery,
				sourceScrapeLimit: options.sourceScrapeLimit,
				scrapeTopResults: hasQueries,
				scrapeLimit: hasQueries ? options.scrapeLimit : 0,
				browserFallback: true,
				browserFallbackLimit: options.browserFallbackLimit,
				downloadDiscoveredDocuments: options.downloadLimit > 0,
				downloadLimit: options.downloadLimit,
				downloadParseMode: options.downloadParseMode,
			},
		};
	});
}
