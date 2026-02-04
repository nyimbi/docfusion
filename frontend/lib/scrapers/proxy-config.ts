/**
 * Proxy Configuration for Anti-Bot Circumvention
 *
 * Government tender portals often block datacenter IPs.
 * Solutions:
 *
 * 1. RESIDENTIAL PROXIES (Recommended)
 *    - Bright Data, Oxylabs, SmartProxy
 *    - IPs from real ISPs, not blocked by anti-bot
 *    - Cost: ~$10-15 per GB
 *
 * 2. SELF-HOSTED FIRECRAWL WITH PROXY
 *    - Configure Firecrawl to use proxy
 *    - Set PROXY_SERVER env var in Firecrawl deployment
 *
 * 3. CRAWL4AI (Alternative to Firecrawl)
 *    - Real Chrome browser with stealth
 *    - Better for heavily protected sites
 *    - https://github.com/unclecode/crawl4ai
 *
 * 4. OFFICIAL APIs (Best when available)
 *    - SAM.gov API (US federal)
 *    - TED Europa API (EU)
 *    - UNGM API (UN system)
 */

// ============================================================================
// Proxy Configuration Types
// ============================================================================

export interface ProxyConfig {
	/** Proxy server URL (http://user:pass@host:port) */
	server: string;
	/** Proxy type */
	type: "http" | "https" | "socks5";
	/** Countries to use for geo-targeting */
	countries?: string[];
	/** Rotate IPs per request */
	rotate?: boolean;
}

export interface AntiDetectionConfig {
	/** Use residential proxies */
	useResidentialProxy?: boolean;
	/** Rotate user agents */
	rotateUserAgent?: boolean;
	/** Add random delays between requests */
	randomDelay?: { min: number; max: number };
	/** Use browser fingerprint evasion */
	stealthMode?: boolean;
}

// ============================================================================
// Proxy Providers (Examples)
// ============================================================================

/**
 * Example proxy configurations for common providers
 * Replace with your actual credentials
 */
export const PROXY_PROVIDERS = {
	brightData: {
		residential: "http://USER:PASS@brd.superproxy.io:22225",
		datacenter: "http://USER:PASS@brd.superproxy.io:22225",
		// Supports country targeting: brd-customer-USER-country-ke
	},
	oxylabs: {
		residential: "http://USER:PASS@pr.oxylabs.io:7777",
		datacenter: "http://USER:PASS@dc.pr.oxylabs.io:10000",
	},
	smartProxy: {
		residential: "http://USER:PASS@gate.smartproxy.com:7000",
	},
};

// ============================================================================
// Source-Specific Configurations
// ============================================================================

/**
 * Sites that need special handling
 */
export const SITE_REQUIREMENTS: Record<string, {
	needsProxy: boolean;
	needsResidential: boolean;
	needsBrowser: boolean;  // Use crawl4ai instead of Firecrawl
	country?: string;       // Geo-targeting for better success
	notes: string;
}> = {
	// East African Government Portals
	"kenya_ppip": {
		needsProxy: true,
		needsResidential: true,
		needsBrowser: true,
		country: "KE",
		notes: "Vue.js SPA, blocks datacenter IPs",
	},
	"tanzania_taneps": {
		needsProxy: true,
		needsResidential: true,
		needsBrowser: true,
		country: "TZ",
		notes: "Requires JavaScript, geo-blocked",
	},
	"uganda_gpp": {
		needsProxy: true,
		needsResidential: true,
		needsBrowser: false,
		country: "UG",
		notes: "Static HTML but blocks scrapers",
	},
	"rwanda_umucyo": {
		needsProxy: true,
		needsResidential: true,
		needsBrowser: true,
		country: "RW",
		notes: "Modern SPA, anti-bot",
	},

	// Aggregators (Usually work without proxy)
	"dgmarket": {
		needsProxy: false,
		needsResidential: false,
		needsBrowser: false,
		notes: "Aggregator, scraper-friendly",
	},
	"ungm": {
		needsProxy: false,
		needsResidential: false,
		needsBrowser: true,
		notes: "JavaScript-heavy but allows scraping",
	},
	"ted_europa": {
		needsProxy: false,
		needsResidential: false,
		needsBrowser: false,
		notes: "Has official API - prefer that",
	},
};

// ============================================================================
// Recommended Strategy
// ============================================================================

/**
 * Recommended approach for 2000+ sources:
 *
 * TIER 1: Aggregators (30 sources, 70% coverage)
 * - DGMarket, UNGM, TED, DevBusiness, etc.
 * - Custom parsers, no proxy needed
 * - These already scrape government sites for you
 *
 * TIER 2: LLM Extraction (500+ sources)
 * - Use Firecrawl's LLM extraction
 * - Define schema once, works everywhere
 * - May need residential proxy for some
 *
 * TIER 3: Official APIs (50+ sources)
 * - SAM.gov, TED Europa, UNGM APIs
 * - Most reliable, no anti-bot issues
 * - Structured data, no parsing needed
 *
 * TIER 4: High-value manual (20-30 sources)
 * - Kenya, Tanzania, Uganda, Rwanda, Ethiopia
 * - Custom parsers + residential proxies
 * - Worth the investment for local market
 *
 * SKIP: Low-value sources
 * - Small countries with few tenders
 * - Sites that actively block all scraping
 * - Focus resources on high-ROI sources
 */

export const SCRAPING_STRATEGY = {
	tier1_aggregators: [
		"dgmarket",
		"ungm",
		"ted_europa",
		"devbusiness",
		"afdb_procurement",
		"worldbank_projects",
		"adb_procurement",
		"idb_procurement",
		"ebrd_procurement",
		"giz_procurement",
	],

	tier2_llm_extraction: [
		// Use LLM extraction for these
		// No custom parser needed
	],

	tier3_official_apis: [
		{ source: "sam_gov", api: "https://api.sam.gov/opportunities/v2/search" },
		{ source: "ted_europa", api: "https://ted.europa.eu/api/v3.0" },
		// Add more as discovered
	],

	tier4_manual_parsers: [
		"kenya_ppip",
		"tanzania_taneps",
		"uganda_gpp",
		"rwanda_umucyo",
		"ethiopia_egp",
		"south_africa_etenders",
		"nigeria_nocopo",
	],
};
