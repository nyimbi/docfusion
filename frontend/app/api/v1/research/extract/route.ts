/**
 * Research Extract API
 *
 * Searches the web, scrapes results, and uses AI to extract
 * structured account information with commercial insights and value propositions.
 *
 * Key Features:
 * - Multi-strategy web search and scraping
 * - AI-powered data extraction
 * - Commercial opportunity identification
 * - Value proposition generation combining our offerings with their needs
 * - AI thinking traces for human review
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIClient } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { companySettings } from "@/lib/db/schema";
import { products, services } from "@/lib/db/schema-company";
import { eq } from "drizzle-orm";
import type { CommercialInsights } from "@/lib/db/schema-crm";

// ============================================================================
// Configuration
// ============================================================================

const FIRECRAWL_URL = process.env.FIRECRAWL_URL || "http://20.84.71.33:3002";
const MAX_SCRAPE_URLS = 8;
const MAX_CONTENT_LENGTH = 12000;
const ORGANIZATION_ID = "datacraft";

// ============================================================================
// Types
// ============================================================================

interface ExtractRequest {
	accountName: string;
	website?: string;
	country?: string;
	currentData?: {
		industry?: string;
		description?: string;
	};
}

interface ExtractedInfo {
	website?: string;
	email?: string;
	phone?: string;
	headquarters?: string;
	address?: string;
	keyLeadership?: string;
	description?: string;
	industry?: string;
	sector?: string;
	employeeCount?: string;
	foundedYear?: string;
	linkedinUrl?: string;
	twitterUrl?: string;
	notableClients?: string;
	annualRevenue?: string;
	coreCapabilities?: string;
}

interface ResearchFindings {
	summary: string;
	keyInsights: string[];
	opportunities: string[];
	risks: string[];
	nextSteps: string[];
	confidenceScore: number;
}

interface OurCompanyData {
	name: string;
	description?: string;
	areaOfBusiness?: string;
	coreCapabilities: string[];
	differentiators: string[];
	products: Array<{
		name: string;
		category?: string;
		description?: string;
		features: string[];
	}>;
	services: Array<{
		name: string;
		category?: string;
		description?: string;
		capabilities: string[];
	}>;
}

interface ExtractResponse {
	success: boolean;
	extracted: ExtractedInfo;
	findings: ResearchFindings | null;
	commercialInsights: CommercialInsights | null;
	valueProposition: string | null;
	thinkingTrace: string | null;
	sources: Array<{ url: string; title: string }>;
	error?: string;
}

// ============================================================================
// Company Data Fetching
// ============================================================================

/**
 * Fetch our company's settings, products, and services for value proposition generation
 */
async function fetchOurCompanyData(): Promise<OurCompanyData | null> {
	try {
		// Fetch company settings
		const settings = await db.query.companySettings.findFirst();

		// Fetch active products
		const productList = await db
			.select()
			.from(products)
			.where(eq(products.organizationId, ORGANIZATION_ID));

		// Fetch active services
		const serviceList = await db
			.select()
			.from(services)
			.where(eq(services.organizationId, ORGANIZATION_ID));

		return {
			name: settings?.companyName || "Our Company",
			description: settings?.industryDescription || undefined,
			areaOfBusiness: settings?.areaOfBusiness || undefined,
			coreCapabilities: (settings?.coreCapabilities as string[]) || [],
			differentiators: (settings?.differentiators as string[]) || [],
			products: productList.map((p) => ({
				name: p.name,
				category: p.category || undefined,
				description: p.description || p.shortDescription || undefined,
				features: (p.features as string[]) || [],
			})),
			services: serviceList.map((s) => ({
				name: s.name,
				category: s.category || undefined,
				description: s.description || undefined,
				capabilities: (s.capabilities as string[]) || [],
			})),
		};
	} catch (error) {
		console.error("Error fetching company data:", error);
		return null;
	}
}

// ============================================================================
// Firecrawl Functions
// ============================================================================

async function firecrawlSearch(query: string, limit = 8): Promise<Array<{ url: string; title: string; description?: string }>> {
	try {
		const response = await fetch(`${FIRECRAWL_URL}/v1/search`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, limit }),
		});

		if (!response.ok) return [];

		const data = await response.json();
		return (data.data || []).map((item: { url: string; title?: string; description?: string }) => ({
			url: item.url,
			title: item.title || "Untitled",
			description: item.description,
		}));
	} catch (error) {
		console.error("Search error:", error);
		return [];
	}
}

async function firecrawlScrape(url: string): Promise<{ content: string; title: string } | null> {
	try {
		const response = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url,
				formats: ["markdown"],
				onlyMainContent: true,
			}),
		});

		if (!response.ok) return null;

		const data = await response.json();
		if (data.success && data.data) {
			return {
				content: data.data.markdown || data.data.content || "",
				title: data.data.metadata?.title || url,
			};
		}
		return null;
	} catch (error) {
		console.error("Scrape error:", error);
		return null;
	}
}

// ============================================================================
// AI Extraction
// ============================================================================

const EXTRACTION_PROMPT = `You are an expert business intelligence analyst extracting company information from multiple web sources.

Your task: Synthesize information from ALL provided sources to build a comprehensive company profile.
Cross-reference data across sources for accuracy. Prefer official company sources over third-party.

EXTRACTION RULES:
1. Extract ALL available information - be thorough
2. Combine information from multiple sources (e.g., CEO name from one source, their title from another)
3. For leadership, extract ALL mentioned executives with their full titles
4. For contact info, look for patterns like "contact@", "info@", phone numbers with country codes
5. For clients, extract any mentioned customers, partners, or case studies
6. Infer industry/sector from the company description if not explicitly stated
7. Look for founding dates, employee counts, and revenue in company profiles and news

Fields to extract (include ALL you can find):
- website: Official company website URL (look for canonical URLs)
- email: General contact email (info@, contact@, hello@)
- phone: Main phone number with country code
- headquarters: "City, Country" format
- address: Full street address if available
- keyLeadership: Format as "Name - Title, Name - Title" (extract ALL executives mentioned)
- description: 2-3 sentence summary of what the company does
- industry: Primary industry (Technology, Healthcare, Finance, Consulting, etc.)
- sector: Specific sector (Enterprise Software, Biotech, Investment Banking, etc.)
- employeeCount: Number or range (e.g., "50-100", "500+", "1000-5000")
- foundedYear: Year founded (4 digits)
- linkedinUrl: Full LinkedIn company page URL
- twitterUrl: Full Twitter/X profile URL
- notableClients: Comma-separated list of clients/customers mentioned
- annualRevenue: Revenue if mentioned (e.g., "$10M-50M", "€5 million")
- coreCapabilities: Key products, services, technologies, or specializations

Company Name: {companyName}
{additionalContext}

=== WEB CONTENT FROM MULTIPLE SOURCES ===
{content}
=== END OF CONTENT ===

CRITICAL: Return ONLY a valid JSON object. No markdown, no explanation, no text outside the JSON.
Extract as much as possible - more data is better. Synthesize across all sources.

JSON:`;

async function extractWithAI(
	companyName: string,
	scrapedContent: Array<{ content: string; title: string; url: string }>,
	currentData?: ExtractRequest["currentData"]
): Promise<ExtractedInfo> {
	let combinedContent = scrapedContent
		.map((s) => `=== Source: ${s.title} (${s.url}) ===\n${s.content}`)
		.join("\n\n---\n\n");

	if (combinedContent.length > MAX_CONTENT_LENGTH) {
		combinedContent = combinedContent.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]";
	}

	const additionalContext = currentData?.industry
		? `Current known industry: ${currentData.industry}`
		: "";

	const prompt = EXTRACTION_PROMPT
		.replace("{companyName}", companyName)
		.replace("{additionalContext}", additionalContext)
		.replace("{content}", combinedContent);

	try {
		const client = getAIClient();
		const result = await client.chat([
			{
				role: "system",
				content: "You are a precise data extraction assistant. Always return valid JSON only.",
			},
			{ role: "user", content: prompt },
		], {
			temperature: 0.1,
			maxTokens: 2000,
		});

		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			const cleaned: ExtractedInfo = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (value && typeof value === "string" && value.trim()) {
					(cleaned as Record<string, string>)[key] = value.trim();
				}
			}
			return cleaned;
		}

		return {};
	} catch (error) {
		console.error("AI extraction error:", error);
		return {};
	}
}

// ============================================================================
// Commercial Insights & Value Proposition Generation
// ============================================================================

const COMMERCIAL_INSIGHTS_PROMPT = `You are a senior business development strategist analyzing a potential account.

## YOUR MISSION
Generate ACTIONABLE commercial insights by matching OUR capabilities to THEIR needs.
Think deeply about synergies, partnership opportunities, and how we can create value for them.

## OUR COMPANY
{ourCompanyData}

## TARGET ACCOUNT: {accountName}
{accountData}

## WEB RESEARCH CONTENT
{contentSnippets}

## ANALYSIS REQUIRED

Think through these questions carefully (your thinking will be saved for human review):

1. **NEEDS ANALYSIS**: What challenges, pain points, or goals does this account have?
   - What problems are they trying to solve?
   - What are they currently investing in?
   - Where might they be underserved?

2. **CAPABILITY MATCHING**: Which of our products/services address their needs?
   - Direct matches (obvious fits)
   - Indirect matches (could be adapted)
   - Novel applications (creative solutions)

3. **VALUE CREATION**: What unique value can WE specifically provide?
   - How do our differentiators matter to them?
   - What would success look like for them?
   - What ROI could we demonstrate?

4. **PARTNERSHIP POTENTIAL**: Are there mutual benefit opportunities?
   - Joint ventures or collaborations
   - Referral relationships
   - Technology partnerships
   - Channel partnerships

5. **ENGAGEMENT STRATEGY**: How should we approach them?
   - Who to contact and why
   - What message resonates
   - What proof points matter

## OUTPUT FORMAT (JSON)

Return a JSON object with this structure:
{
  "opportunities": [
    {
      "title": "Clear opportunity name",
      "description": "What we can offer and why it matters to them",
      "potentialValue": "Estimated value or impact (e.g., '$50K-100K', 'High strategic value')",
      "timeframe": "Near-term, Medium-term, or Long-term",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "partnerships": [
    {
      "type": "Type of partnership (Reseller, Technology, Joint Venture, etc.)",
      "description": "What the partnership could look like",
      "synergies": ["Synergy 1", "Synergy 2"],
      "nextSteps": "Concrete next step to explore"
    }
  ],
  "productsToOffer": [
    {
      "productName": "Our product/service name",
      "relevance": "Why this is relevant to them",
      "painPointAddressed": "What problem it solves",
      "suggestedApproach": "How to position this offering"
    }
  ],
  "valuePropositionSummary": "A compelling 2-3 sentence value proposition tailored to this account",
  "talkingPoints": [
    "Key talking point 1",
    "Key talking point 2",
    "Key talking point 3"
  ],
  "competitivePositioning": "How we compare to alternatives they might consider"
}

CRITICAL RULES:
- Be SPECIFIC to this account - no generic statements
- Every opportunity must tie to THEIR documented needs or our research findings
- Products to offer must be from OUR actual product/service list
- Value proposition must address THEIR specific situation
- Include confidence levels based on how much evidence supports each opportunity

Return ONLY the JSON object. No markdown formatting.`;

async function generateCommercialInsights(
	accountName: string,
	extracted: ExtractedInfo,
	scrapedContent: Array<{ content: string; title: string; url: string }>,
	ourCompany: OurCompanyData | null
): Promise<{ insights: CommercialInsights | null; valueProposition: string | null; thinkingTrace: string | null }> {
	try {
		// Format our company data
		const ourCompanyText = ourCompany
			? `
Company Name: ${ourCompany.name}
Area of Business: ${ourCompany.areaOfBusiness || "N/A"}
Description: ${ourCompany.description || "N/A"}

Core Capabilities:
${ourCompany.coreCapabilities.map((c) => `- ${c}`).join("\n") || "- Not specified"}

Differentiators:
${ourCompany.differentiators.map((d) => `- ${d}`).join("\n") || "- Not specified"}

Products:
${ourCompany.products.map((p) => `- ${p.name}: ${p.description || "No description"}`).join("\n") || "- No products listed"}

Services:
${ourCompany.services.map((s) => `- ${s.name}: ${s.description || "No description"}`).join("\n") || "- No services listed"}
`
			: "Company data not available. Focus on general opportunity identification.";

		// Format account data
		const accountText = Object.entries(extracted)
			.filter(([, value]) => value)
			.map(([key, value]) => `${key}: ${value}`)
			.join("\n") || "Limited data available";

		// Get snippets from content
		const snippets = scrapedContent
			.slice(0, 5)
			.map((s) => `[${s.title}]: ${s.content.slice(0, 400)}...`)
			.join("\n\n");

		const prompt = COMMERCIAL_INSIGHTS_PROMPT
			.replace("{ourCompanyData}", ourCompanyText)
			.replace("{accountName}", accountName)
			.replace("{accountData}", accountText)
			.replace("{contentSnippets}", snippets || "No web content available");

		const client = getAIClient();

		// Check if the client supports extended thinking for detailed analysis
		// For now, use regular completion with a thinking-encouraging prompt
		const result = await client.chat(
			[
				{
					role: "system",
					content: `You are an expert business development analyst.

IMPORTANT: Before generating your JSON output, write out your thinking process in detail.
Start with "## My Analysis:" and think through each aspect of the business opportunity.
After your analysis, write "## JSON Output:" followed by the JSON.

Your thinking will be saved for human review to understand your reasoning.`,
				},
				{ role: "user", content: prompt },
			],
			{
				temperature: 0.4,
				maxTokens: 4000,
			}
		);

		// Extract thinking trace and JSON separately
		let thinkingTrace: string | null = null;
		let jsonContent = result.content;

		// Check if there's a thinking section
		const thinkingMatch = result.content.match(/## My Analysis:([\s\S]*?)## JSON Output:/i);
		if (thinkingMatch) {
			thinkingTrace = thinkingMatch[1].trim();
			jsonContent = result.content.slice(result.content.indexOf("## JSON Output:") + 15);
		}

		// Parse the JSON
		const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);

			const insights: CommercialInsights = {
				opportunities: parsed.opportunities || [],
				partnerships: parsed.partnerships || [],
				productsToOffer: parsed.productsToOffer || [],
				valuePropositionSummary: parsed.valuePropositionSummary || "",
				talkingPoints: parsed.talkingPoints || [],
				competitivePositioning: parsed.competitivePositioning || undefined,
			};

			return {
				insights,
				valueProposition: parsed.valuePropositionSummary || null,
				thinkingTrace,
			};
		}

		return { insights: null, valueProposition: null, thinkingTrace };
	} catch (error) {
		console.error("Commercial insights generation error:", error);
		return { insights: null, valueProposition: null, thinkingTrace: null };
	}
}

// ============================================================================
// Research Findings Generation
// ============================================================================

const FINDINGS_PROMPT = `You are a senior business development strategist conducting deep account research.

Your goal: Generate HIGH-VALUE, ACTIONABLE insights that help close deals or build partnerships.

COMPANY: {companyName}
EXTRACTED DATA:
{extractedData}

WEB CONTENT:
{contentSnippets}

Generate strategic findings as JSON:

1. "summary": (3-5 sentences)
   - WHO they are (founding story, mission, market position)
   - WHAT they do (core business, key products/services)
   - WHY they matter (market impact, competitive differentiation)
   - Current trajectory (growing, stable, pivoting, struggling)

2. "keyInsights": (4-6 insights, be SPECIFIC and STRATEGIC)
   Include insights about:
   - Decision-making structure (who has budget authority?)
   - Technology stack or methodology (what do they use/prefer?)
   - Pain points or challenges mentioned in news/content
   - Recent changes (new hires, funding, pivots, launches)
   - Company culture indicators (values, work style)
   - Competitive positioning (who do they compete with?)

3. "opportunities": (3-5 actionable opportunities)
   Be specific about:
   - HOW to engage (through which channel/person)
   - WHAT to offer (specific value proposition)
   - WHEN to approach (timing considerations)
   - WHY it would resonate (based on their needs)

4. "risks": (2-4 realistic concerns)
   Consider:
   - Financial stability indicators
   - Leadership changes or instability
   - Competitive threats to their business
   - Market/regulatory challenges
   - Red flags in news or reviews

5. "nextSteps": (4-6 prioritized actions)
   Concrete, actionable steps like:
   - "Research [specific person] on LinkedIn - likely decision maker for [area]"
   - "Monitor for [specific trigger event] as buying signal"
   - "Prepare case study relevant to their [industry/challenge]"
   - "Connect through [mutual connection/event/channel]"

6. "confidenceScore": (0-100)
   - 80-100: Multiple authoritative sources, recent data, clear picture
   - 60-79: Good sources but some gaps, moderately recent
   - 40-59: Limited sources, older data, significant unknowns
   - 0-39: Very limited info, mostly inferred

CRITICAL: Every insight must be:
- SPECIFIC (names, numbers, dates when available)
- ACTIONABLE (can be acted upon)
- RELEVANT (directly useful for business development)

Return ONLY valid JSON.

JSON:`;

async function generateFindings(
	companyName: string,
	extracted: ExtractedInfo,
	scrapedContent: Array<{ content: string; title: string; url: string }>
): Promise<ResearchFindings | null> {
	try {
		const extractedSummary = Object.entries(extracted)
			.filter(([, value]) => value)
			.map(([key, value]) => `${key}: ${value}`)
			.join("\n");

		const snippets = scrapedContent
			.slice(0, 5)
			.map((s) => `[${s.title}]: ${s.content.slice(0, 300)}...`)
			.join("\n\n");

		const prompt = FINDINGS_PROMPT
			.replace("{companyName}", companyName)
			.replace("{extractedData}", extractedSummary || "No structured data extracted")
			.replace("{contentSnippets}", snippets || "No content available");

		const client = getAIClient();
		const result = await client.chat(
			[
				{
					role: "system",
					content: "You are a business analyst. Return only valid JSON.",
				},
				{ role: "user", content: prompt },
			],
			{
				temperature: 0.3,
				maxTokens: 1500,
			}
		);

		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				summary: parsed.summary || "",
				keyInsights: parsed.keyInsights || [],
				opportunities: parsed.opportunities || [],
				risks: parsed.risks || [],
				nextSteps: parsed.nextSteps || [],
				confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 50)),
			};
		}

		return null;
	} catch (error) {
		console.error("Findings generation error:", error);
		return null;
	}
}

// ============================================================================
// Gap Analysis & Targeted Search
// ============================================================================

function identifyMissingFields(extracted: ExtractedInfo): string[] {
	const criticalFields: Array<keyof ExtractedInfo> = [
		"email",
		"phone",
		"keyLeadership",
		"description",
		"linkedinUrl",
	];

	const missing: string[] = [];
	for (const field of criticalFields) {
		if (!extracted[field]) {
			missing.push(field);
		}
	}
	return missing;
}

function getTargetedSearchQuery(
	companyName: string,
	field: string,
	locationContext: string
): string | null {
	const strategies: Record<string, string> = {
		email: `${companyName} contact email address`,
		phone: `${companyName} phone number contact`,
		keyLeadership: `${companyName} CEO founder executives management team`,
		description: `${companyName} company about what does do`,
		linkedinUrl: `site:linkedin.com/company ${companyName}`,
		headquarters: `${companyName}${locationContext} headquarters office location`,
		employeeCount: `${companyName} employees team size headcount`,
		foundedYear: `${companyName} founded established year history`,
		notableClients: `${companyName} customers clients case studies`,
		industry: `${companyName} industry sector business`,
	};

	return strategies[field] || null;
}

function mergeExtractedData(
	first: ExtractedInfo,
	second: ExtractedInfo
): ExtractedInfo {
	const merged: ExtractedInfo = { ...first };

	for (const [key, value] of Object.entries(second)) {
		if (value && typeof value === "string" && value.trim()) {
			const existingValue = (merged as Record<string, string | undefined>)[key];
			if (!existingValue || value.length > existingValue.length) {
				(merged as Record<string, string>)[key] = value;
			}
		}
	}

	return merged;
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
	// Verify authentication
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json(
			{
				success: false,
				extracted: {},
				findings: null,
				commercialInsights: null,
				valueProposition: null,
				thinkingTrace: null,
				sources: [],
				error: "Authentication required",
			},
			{ status: 401 }
		);
	}

	try {
		const body: ExtractRequest = await request.json();
		const { accountName, website, country, currentData } = body;

		if (!accountName) {
			return NextResponse.json(
				{
					success: false,
					extracted: {},
					findings: null,
					commercialInsights: null,
					valueProposition: null,
					thinkingTrace: null,
					sources: [],
					error: "Account name is required",
				},
				{ status: 400 }
			);
		}

		const sources: Array<{ url: string; title: string }> = [];
		const scrapedContent: Array<{ content: string; title: string; url: string }> = [];

		// 1. Scrape company website if provided
		if (website) {
			console.log(`Scraping company website: ${website}`);
			const mainPage = await firecrawlScrape(website);
			if (mainPage) {
				sources.push({ url: website, title: mainPage.title });
				scrapedContent.push({ ...mainPage, url: website });
			}

			for (const page of ["/about", "/about-us", "/contact", "/team", "/leadership"]) {
				try {
					const pageUrl = new URL(page, website).toString();
					const pageContent = await firecrawlScrape(pageUrl);
					if (pageContent && pageContent.content.length > 100) {
						sources.push({ url: pageUrl, title: pageContent.title });
						scrapedContent.push({ ...pageContent, url: pageUrl });
					}
				} catch {
					// Skip invalid URLs
				}
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
			}
		}

		// 2. Multi-strategy search
		const locationContext = country ? ` ${country}` : "";

		const allQueries = [
			`${accountName}${locationContext} company about profile overview`,
			`${accountName}${locationContext} CEO founder leadership team executives`,
			`${accountName} contact email phone address headquarters`,
			`site:linkedin.com/company ${accountName}`,
			`site:crunchbase.com ${accountName}`,
			`site:bloomberg.com/profile/company ${accountName}`,
			`${accountName}${locationContext} news funding announcement 2024 2025 2026`,
			`${accountName} press release latest`,
			`${accountName}${locationContext} company profile dnb hoovers`,
			`${accountName} employees revenue glassdoor`,
			`${accountName}${locationContext} clients customers portfolio`,
		];

		const seenUrls = new Set(scrapedContent.map((s) => s.url));

		for (const query of allQueries) {
			if (scrapedContent.length >= MAX_SCRAPE_URLS) break;

			console.log(`Searching: ${query}`);
			const searchResults = await firecrawlSearch(query, 3);

			for (const result of searchResults) {
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
				if (seenUrls.has(result.url)) continue;

				const urlLower = result.url.toLowerCase();
				if (
					urlLower.includes("login") ||
					urlLower.includes("signin") ||
					urlLower.includes("signup") ||
					urlLower.includes("/search?") ||
					urlLower.includes("google.com/search")
				) {
					continue;
				}

				console.log(`Scraping: ${result.url}`);
				const content = await firecrawlScrape(result.url);
				if (content && content.content.length > 100) {
					sources.push({ url: result.url, title: content.title });
					scrapedContent.push({ ...content, url: result.url });
					seenUrls.add(result.url);
				}
			}
		}

		// 3. Fallback searches if needed
		if (scrapedContent.length < 4) {
			console.log("Running fallback searches...");
			const fallbackQueries = [
				`"${accountName}" official website`,
				`${accountName} company information`,
				`who is the CEO of ${accountName}`,
			];

			for (const query of fallbackQueries) {
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;

				const results = await firecrawlSearch(query, 2);
				for (const result of results) {
					if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
					if (seenUrls.has(result.url)) continue;

					const content = await firecrawlScrape(result.url);
					if (content && content.content.length > 100) {
						sources.push({ url: result.url, title: content.title });
						scrapedContent.push({ ...content, url: result.url });
						seenUrls.add(result.url);
					}
				}
			}
		}

		// 4. Extract information using AI
		console.log(`Extracting info from ${scrapedContent.length} sources using AI...`);
		let extracted = await extractWithAI(accountName, scrapedContent, currentData);

		// 5. Gap analysis and targeted searches
		const missingCritical = identifyMissingFields(extracted);

		if (missingCritical.length > 0 && scrapedContent.length < MAX_SCRAPE_URLS) {
			console.log(`Missing fields: ${missingCritical.join(", ")}. Running targeted searches...`);

			const additionalContent: Array<{ content: string; title: string; url: string }> = [];

			for (const field of missingCritical) {
				if (additionalContent.length >= 3) break;

				const targetedQuery = getTargetedSearchQuery(accountName, field, locationContext);
				if (!targetedQuery) continue;

				console.log(`Targeted search for ${field}: ${targetedQuery}`);
				const results = await firecrawlSearch(targetedQuery, 2);

				for (const result of results) {
					if (additionalContent.length >= 3) break;
					if (seenUrls.has(result.url)) continue;

					const content = await firecrawlScrape(result.url);
					if (content && content.content.length > 100) {
						sources.push({ url: result.url, title: content.title });
						additionalContent.push({ ...content, url: result.url });
						seenUrls.add(result.url);
					}
				}
			}

			if (additionalContent.length > 0) {
				console.log(`Re-extracting with ${additionalContent.length} additional sources...`);
				const allContent = [...scrapedContent, ...additionalContent];
				const newExtracted = await extractWithAI(accountName, allContent, currentData);
				extracted = mergeExtractedData(extracted, newExtracted);
			}
		}

		// 6. Fetch our company data for value proposition generation
		console.log("Fetching our company data for value proposition...");
		const ourCompanyData = await fetchOurCompanyData();

		// 7. Generate research findings
		console.log("Generating research findings...");
		const findings = await generateFindings(accountName, extracted, scrapedContent);

		// 8. Generate commercial insights and value proposition
		console.log("Generating commercial insights and value proposition...");
		const { insights: commercialInsights, valueProposition, thinkingTrace } =
			await generateCommercialInsights(accountName, extracted, scrapedContent, ourCompanyData);

		return NextResponse.json({
			success: true,
			extracted,
			findings,
			commercialInsights,
			valueProposition,
			thinkingTrace,
			sources,
		});
	} catch (error) {
		console.error("Extract API error:", error);
		return NextResponse.json(
			{
				success: false,
				extracted: {},
				findings: null,
				commercialInsights: null,
				valueProposition: null,
				thinkingTrace: null,
				sources: [],
				error: error instanceof Error ? error.message : "Extraction failed",
			},
			{ status: 500 }
		);
	}
}

export async function GET(): Promise<NextResponse> {
	// Verify authentication
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401 }
		);
	}

	return NextResponse.json({
		message: "Research Extract API - AI-powered information extraction with commercial insights",
		usage: "POST with { accountName, website?, country?, currentData? }",
		returns: {
			extracted: "Company profile data",
			findings: "Strategic research findings",
			commercialInsights: "Commercial opportunities, partnerships, products to offer",
			valueProposition: "Tailored value proposition statement",
			thinkingTrace: "AI reasoning for human review",
			sources: "URLs used for research",
		},
	});
}
