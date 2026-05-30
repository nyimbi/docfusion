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
