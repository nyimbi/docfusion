/**
 * AI Document Discovery Agent
 * 
 * An intelligent agent that finds RFP documents using multiple strategies:
 * 1. AI-generated search queries based on opportunity analysis
 * 2. Web search via SearXNG (100+ search engines)
 * 3. Specialized tender databases
 * 4. Alternative portal sources
 * 5. Direct download with retry logic
 * 6. Archive/cache searches (Wayback Machine)
 * 7. AI-powered URL pattern guessing
 * 
 * The agent is persistent - it tries multiple approaches until documents are found
 * or all options are exhausted.
 */

import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";
import { searchSearxng, searchDocuments, searchMultiple } from "@/lib/services/searxng-client";
import { convertDocumentFromUrl, processRfpDocument, isSupportedFileType } from "@/lib/services/docling-client";
import { db } from "@/lib/db";
import { opportunityDocuments, opportunities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { quickComplete, prompt } from "@/lib/ai/providers/factory";
import { logger } from "@/lib/utils/logger";

const DEFAULT_STEALTH_SCRAPER_URL = "http://84.247.181.100:3003";

// ============================================================================
// Types
// ============================================================================

export interface DiscoveryStrategy {
  name: string;
  priority: number;
  execute: (context: DiscoveryContext) => Promise<DiscoveredSource[]>;
}

export interface DiscoveryContext {
  opportunityId: string;
  title: string;
  organization?: string | null;
  sourceUrl?: string | null;
  noticeId?: string | null;
  country?: string | null;
  deadline?: Date | null;
  category?: string | null;
  previousAttempts: string[];
}

export interface DiscoveredSource {
  url: string;
  name: string;
  type: "rfp" | "amendment" | "specification" | "evaluation" | "form" | "attachment";
  confidence: number; // 0-100
  source: string; // e.g., "primary_portal", "web_search", "alternative_portal", "archive"
  discoveryMethod: string;
  description?: string;
  fileSize?: number;
  fileType?: string;
  requiresAuth?: boolean;
  alternativeUrls?: string[]; // Mirror/alternative sources
}

export interface DiscoveryResult {
  success: boolean;
  sources: DiscoveredSource[];
  strategiesAttempted: string[];
  strategiesSucceeded: string[];
  aiAnalysis?: string;
  error?: string;
}

// ============================================================================
// AI-Powered Search Query Generator
// ============================================================================

/**
 * Generate intelligent search queries using AI
 */
async function generateSearchQueries(context: DiscoveryContext): Promise<string[]> {
  try {
    const systemPrompt = `You are an expert at finding RFP/tender documents via Google and DuckDuckGo search. Generate targeted search queries using advanced operators.

Respond ONLY with a JSON object in this exact format:
{
  "queries": [
    {"query": "search query with operators", "purpose": "what this finds", "priority": 10, "engine": "google"},
    {"query": "another query", "purpose": "what this finds", "priority": 9, "engine": "both"}
  ],
  "alternativeSources": ["website1.com", "website2.org"],
  "keywords": ["key1", "key2", "key3"],
  "fileTypeQueries": ["query with filetype:pdf", "another filetype query"]
}

Use these search operators effectively:
- filetype:pdf OR filetype:docx - for document files
- site:gov OR site:org - to search specific domains
- intitle:tender OR intitle:rfp - for title matching
- "exact phrase in quotes" - for precise matching`;

    const userPrompt = `Analyze this opportunity and generate 8-12 targeted search queries for Google and DuckDuckGo:

Title: ${context.title}
Organization: ${context.organization || "Unknown"}
Notice ID: ${context.noticeId || "Unknown"}
Country: ${context.country || "Unknown"}
Category: ${context.category || "Unknown"}
Original URL: ${context.sourceUrl || "Not provided"}

Generate queries that:
1. Use filetype:pdf, filetype:docx, filetype:doc operators
2. Include organization name + tender/RFP keywords
3. Use notice/reference numbers if available
4. Target specific document types (specifications, evaluation criteria, forms)
5. Include country-specific search terms
6. Use intitle: operators for better matching

Previous failed strategies: ${context.previousAttempts.join(", ") || "None"}`;

    const response = await quickComplete([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { temperature: 0.3, maxTokens: 2500 });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const queries = (parsed.queries || [])
        .sort((a: { priority: number }, b: { priority: number }) => b.priority - a.priority)
        .map((q: { query: string }) => q.query);
      
      // Add filetype-specific queries for better document discovery
      const fileTypeQueries = parsed.fileTypeQueries || [];
      
      // Combine and deduplicate
      const allQueries = [...new Set([...fileTypeQueries, ...queries])];
      
      logger.debug(`[Discovery Agent] AI generated ${allQueries.length} search queries`);
      return allQueries.slice(0, 12); // Max 12 queries
    }
    
    return generateEnhancedFallbackQueries(context);
  } catch (error) {
    logger.error("Failed to generate AI search queries:", error);
    return generateEnhancedFallbackQueries(context);
  }
}

function generateFallbackQueries(context: DiscoveryContext): string[] {
  return generateEnhancedFallbackQueries(context);
}

function generateEnhancedFallbackQueries(context: DiscoveryContext): string[] {
  const queries: string[] = [];
  const org = context.organization || "";
  const title = context.title || "";
  const noticeId = context.noticeId || "";
  const country = context.country || "";
  
  // Notice ID queries (highest priority)
  if (noticeId) {
    queries.push(`"${noticeId}" filetype:pdf`);
    queries.push(`"${noticeId}" tender document`);
    queries.push(`"${noticeId}" "${org}" filetype:pdf`);
    queries.push(`intitle:"${noticeId}"`);
  }
  
  // Organization-based queries
  if (org) {
    queries.push(`"${org}" tender rfp filetype:pdf`);
    queries.push(`"${org}" procurement document filetype:pdf`);
    queries.push(`"${org}" "request for proposal" filetype:pdf`);
    queries.push(`site:${org.toLowerCase().replace(/\s+/g, "")}.org tender`);
  }
  
  // Title-based queries (extract key terms)
  const titleTerms = title.split(" ").slice(0, 4).join(" ");
  queries.push(`"${titleTerms}" filetype:pdf tender`);
  queries.push(`"${titleTerms}" rfp filetype:docx`);
  queries.push(`intitle:"${titleTerms.split(" ").slice(0, 2).join(" ")}" tender`);
  
  // Country-specific queries
  if (country) {
    queries.push(`"${org}" "${country}" tender filetype:pdf`);
    queries.push(`"${titleTerms}" "${country}" procurement`);
  }
  
  // Document type specific queries
  queries.push(`"${org}" technical specifications filetype:pdf`);
  queries.push(`"${org}" evaluation criteria filetype:pdf`);
  queries.push(`"${org}" tender forms filetype:docx`);
  
  return [...new Set(queries)].slice(0, 15); // Deduplicate and limit
}

// ============================================================================
// Search Strategies
// ============================================================================

/**
 * Strategy 1: Search primary portal using Firecrawl
 */
async function searchPrimaryPortal(context: DiscoveryContext): Promise<DiscoveredSource[]> {
  if (!context.sourceUrl) return [];
  
  logger.debug(`[Discovery Agent] Searching primary portal: ${context.sourceUrl}`);
  
  let fallbackReason = "Firecrawl returned no downloadable document links";

  try {
    const firecrawl = new FirecrawlClient();
    
    const result = await firecrawl.scrape(context.sourceUrl, {
      formats: ["markdown", "links"],
      waitFor: 5000,
      extract: {
        schema: {
          type: "object",
          properties: {
            documents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  type: { type: "string", enum: ["rfp", "amendment", "specification", "evaluation", "form", "attachment"] },
                  description: { type: "string" },
                },
                required: ["name", "url", "type"],
              },
            },
          },
        },
        systemPrompt: `Extract all document download links from this tender/RFP page. Focus on actual downloadable files (PDF, DOCX, XLSX, ZIP). Return the direct document URLs.`,
      },
    });

    if (!result.success || !result.data?.extract?.documents) {
      // Try link-based extraction as fallback
      fallbackReason = result.error || fallbackReason;
      const linkSources = extractFromLinks(result.data?.links || [], result.data?.markdown || "", context.sourceUrl);
      if (linkSources.length > 0) return linkSources;

      const browserSources = await searchPrimaryPortalWithBrowserFallback(context.sourceUrl, fallbackReason);
      if (browserSources.length > 0) return browserSources;
      return [];
    }

    const docs = result.data.extract.documents as Array<{
      name: string;
      url: string;
      type: string;
      description?: string;
    }>;

    const extractedSources = docs
      .map(doc => ({
        ...doc,
        url: resolveUrl(doc.url, context.sourceUrl!),
      }))
      .filter(doc => isDocumentUrl(doc.url))
      .map(doc => ({
        url: doc.url,
        name: doc.name,
        type: validateDocumentType(doc.type),
        confidence: 95,
        source: "primary_portal",
        discoveryMethod: "firecrawl_llm_extraction",
        description: doc.description,
      }));

    if (extractedSources.length > 0) return extractedSources;

    const linkSources = extractFromLinks(result.data?.links || [], result.data?.markdown || "", context.sourceUrl);
    if (linkSources.length > 0) return linkSources;

    const browserSources = await searchPrimaryPortalWithBrowserFallback(context.sourceUrl, fallbackReason);
    if (browserSources.length > 0) return browserSources;
    return [];
  } catch (error) {
    logger.error("[Discovery Agent] Primary portal search failed:", error);
    fallbackReason = error instanceof Error ? error.message : String(error);
    return searchPrimaryPortalWithBrowserFallback(context.sourceUrl, fallbackReason);
  }
}

async function searchPrimaryPortalWithBrowserFallback(
  sourceUrl: string,
  fallbackReason: string
): Promise<DiscoveredSource[]> {
  const stealthUrl = (process.env.STEALTH_SCRAPER_URL || DEFAULT_STEALTH_SCRAPER_URL).replace(/\/$/, "");

  try {
    logger.debug(`[Discovery Agent] Trying browser fallback for primary portal: ${sourceUrl}`);
    const result = await scrapeWithBrowserService(stealthUrl, sourceUrl, {
      timeout: 15000,
      humanScroll: true,
      blockMedia: true,
    });

    if (!result.success || !result.data) {
      logger.error(
        `[Discovery Agent] Browser fallback returned no primary portal content for ${sourceUrl}: ${result.error || "unknown error"}`
      );
      return [];
    }

    return extractFromLinks(result.data.links || [], result.data.markdown || "", sourceUrl)
      .map(source => ({
        ...source,
        confidence: Math.max(source.confidence, 80),
        discoveryMethod: `browser_fallback_link_extraction: ${fallbackReason}`,
      }));
  } catch (error) {
    logger.error("[Discovery Agent] Browser fallback failed for primary portal:", error);
    return [];
  }
}

/**
 * Strategy 2: Web Search using SearXNG
 * Composes multiple queries and searches across 100+ engines via SearXNG
 */
async function searchWeb(context: DiscoveryContext): Promise<DiscoveredSource[]> {
  const queries = await generateSearchQueries(context);
  const sources: DiscoveredSource[] = [];
  const seenUrls = new Set<string>();
  
  logger.debug(`[Discovery Agent] Web search with SearXNG (${queries.length} AI-generated queries)`);
  logger.debug(`[Discovery Agent] Queries:`, queries);
  
  // Search with multiple queries in parallel using SearXNG
  const searchPromises = queries.slice(0, 8).map(async (query) => {
    const querySources: DiscoveredSource[] = [];
    
    try {
      logger.debug(`[Discovery Agent] SearXNG search: ${query}`);
      
      // Use SearXNG for search - it queries 100+ search engines
      const response = await searchSearxng(query, {
        categories: ["general", "files"],
        language: "en",
      });

      logger.debug(`[Discovery Agent] SearXNG returned ${response.results.length} results for: ${query}`);

      for (const result of response.results) {
        const normalizedUrl = result.url.toLowerCase().replace(/\?.*$/, "");
        if (seenUrls.has(normalizedUrl)) continue;
        
        // Check if it's a document URL and relevant
        if (isDocumentUrl(result.url) && isRelevantLink(result.url, context)) {
          seenUrls.add(normalizedUrl);
          querySources.push({
            url: result.url,
            name: result.title || extractFilenameFromUrl(result.url),
            type: classifyDocumentFromUrl(result.url),
            confidence: Math.min(85, 60 + (result.score || 0)),
            source: "searxng_search",
            discoveryMethod: `searxng_query: "${query}" (engine: ${result.engine})`,
            description: result.content?.substring(0, 200),
          });
        }
      }
    } catch (error) {
      logger.error(`[Discovery Agent] SearXNG search failed for "${query}":`, error);
    }
    
    return querySources;
  });
  
  // Also do a dedicated document search
  try {
    const docQuery = `${context.title} ${context.organization || ""} tender rfp`;
    logger.debug(`[Discovery Agent] SearXNG document search: ${docQuery}`);
    
    const docResults = await searchDocuments(docQuery, ["pdf", "docx", "doc"]);
    
    for (const result of docResults) {
      const normalizedUrl = result.url.toLowerCase().replace(/\?.*$/, "");
      if (seenUrls.has(normalizedUrl)) continue;
      
      if (isRelevantLink(result.url, context)) {
        seenUrls.add(normalizedUrl);
        sources.push({
          url: result.url,
          name: result.title || extractFilenameFromUrl(result.url),
          type: classifyDocumentFromUrl(result.url),
          confidence: 80,
          source: "searxng_documents",
          discoveryMethod: `searxng_document_search: "${docQuery}"`,
          description: result.content?.substring(0, 200),
        });
      }
    }
  } catch (error) {
    logger.error(`[Discovery Agent] SearXNG document search failed:`, error);
  }
  
  // Collect all results
  const allResults = await Promise.all(searchPromises);
  for (const result of allResults) {
    sources.push(...result);
  }
  
  logger.debug(`[Discovery Agent] SearXNG search complete. Found ${sources.length} unique sources`);
  return sources;
}

/**
 * Strategy 3: Check alternative tender portals
 */
async function searchAlternativePortals(context: DiscoveryContext): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  
  // Generate alternative portal URLs based on organization/country
  const alternativePortals = generateAlternativePortals(context);
  
  logger.debug(`[Discovery Agent] Checking ${alternativePortals.length} alternative portals`);
  
  const firecrawl = new FirecrawlClient();
  
  for (const portal of alternativePortals.slice(0, 3)) {
    try {
      const result = await firecrawl.scrape(portal.url, {
        formats: ["markdown", "links"],
        waitFor: 3000,
      });

      if (result.success && result.data?.links) {
        // Look for documents related to this opportunity
        const relevantLinks = result.data.links.filter(link => {
          const linkLower = link.toLowerCase();
          const titleLower = context.title.toLowerCase();
          const orgLower = (context.organization || "").toLowerCase();
          
          return linkLower.includes(titleLower.slice(0, 20)) ||
                 linkLower.includes(orgLower.slice(0, 15)) ||
                 (context.noticeId && linkLower.includes(context.noticeId.toLowerCase()));
        });

        for (const link of relevantLinks) {
          if (isDocumentUrl(link)) {
            sources.push({
              url: resolveUrl(link, portal.url),
              name: extractFilenameFromUrl(link),
              type: classifyDocumentFromUrl(link),
              confidence: 60,
              source: "alternative_portal",
              discoveryMethod: `portal: ${portal.name}`,
              alternativeUrls: [portal.url],
            });
          }
        }
      }
    } catch (error) {
      logger.error(`[Discovery Agent] Alternative portal failed: ${portal.url}`, error);
    }
  }
  
  return sources;
}

/**
 * Strategy 4: Check Internet Archive (Wayback Machine)
 */
async function searchArchive(context: DiscoveryContext): Promise<DiscoveredSource[]> {
  if (!context.sourceUrl) return [];
  
  logger.debug(`[Discovery Agent] Checking Internet Archive for: ${context.sourceUrl}`);
  
  try {
    // Query Wayback Machine for archived versions
    const waybackUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(context.sourceUrl)}&output=json&fl=original,timestamp`;
    
    const response = await fetch(waybackUrl, { 
      signal: AbortSignal.timeout(10000) 
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    // Get the most recent archived version
    if (Array.isArray(data) && data.length > 1) {
      const latest = data[data.length - 1];
      const archivedUrl = `https://web.archive.org/web/${latest[1]}/${latest[0]}`;
      
      // Try to scrape the archived version
      const firecrawl = new FirecrawlClient();
      const result = await firecrawl.scrape(archivedUrl, {
        formats: ["links"],
        waitFor: 5000,
      });

      if (result.success && result.data?.links) {
        return result.data.links
          .filter(isDocumentUrl)
          .map(link => ({
            url: link,
            name: extractFilenameFromUrl(link),
            type: classifyDocumentFromUrl(link),
            confidence: 50,
            source: "archive",
            discoveryMethod: "wayback_machine",
            alternativeUrls: [archivedUrl],
          }));
      }
    }
  } catch (error) {
    logger.error("[Discovery Agent] Archive search failed:", error);
  }
  
  return [];
}

/**
 * Strategy 5: AI-powered URL pattern guessing
 */
async function guessDocumentUrls(context: DiscoveryContext): Promise<DiscoveredSource[]> {
  if (!context.sourceUrl) return [];
  
  logger.debug(`[Discovery Agent] AI pattern guessing for: ${context.sourceUrl}`);
  
  try {
    const systemPrompt = `You are an expert at guessing document URLs on tender portals. Given a portal URL and opportunity details, guess the likely direct URLs to documents.

Respond ONLY with a JSON object in this format:
{
  "guessedUrls": [
    {"url": "https://...", "name": "Document Name", "type": "rfp", "confidence": 80, "reasoning": "why this URL"}
  ]
}`;

    const userPrompt = `Given this tender portal URL: ${context.sourceUrl}

Opportunity details:
- Title: ${context.title}
- Organization: ${context.organization || "Unknown"}
- Notice ID: ${context.noticeId || "Unknown"}

Guess the likely direct URLs to the following documents:
1. Main RFP/Tender document (PDF)
2. Technical Specifications
3. Evaluation Criteria
4. Any amendment notices
5. Required forms

Based on common patterns for tender portals, construct likely direct download URLs.`;

    const response = await quickComplete([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { temperature: 0.3, maxTokens: 2000 });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.guessedUrls || []).map((guess: { 
        url: string; 
        name: string; 
        type: string; 
        confidence: number;
        reasoning: string;
      }) => ({
        url: guess.url,
        name: guess.name,
        type: validateDocumentType(guess.type),
        confidence: (guess.confidence || 50) * 0.6, // Reduce confidence for guesses
        source: "ai_guessed",
        discoveryMethod: `ai_pattern_match: ${guess.reasoning}`,
      }));
    }
    
    return [];
  } catch (error) {
    logger.error("[Discovery Agent] URL guessing failed:", error);
    return [];
  }
}

// ============================================================================
// Discovery Agent Main Function
// ============================================================================

export async function discoverDocumentsWithAgent(
  opportunityId: string,
  maxStrategies: number = 5,
  sourceUrlOverride?: string | null
): Promise<DiscoveryResult> {
  logger.debug(`[Discovery Agent] Starting discovery for opportunity: ${opportunityId}`);
  
  // Get opportunity details
  const opportunity = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  });

  if (!opportunity) {
    return {
      success: false,
      sources: [],
      strategiesAttempted: [],
      strategiesSucceeded: [],
      error: "Opportunity not found",
    };
  }

  const context: DiscoveryContext = {
    opportunityId,
    title: opportunity.title,
    organization: opportunity.organization,
    sourceUrl: sourceUrlOverride || opportunity.portalUrl || opportunity.rfpLink,
    noticeId: opportunity.noticeId || opportunity.sourceId,
    country: opportunity.countryRegion,
    deadline: opportunity.deadline,
    category: opportunity.category,
    previousAttempts: [],
  };

  const strategies: DiscoveryStrategy[] = [
    { name: "primary_portal", priority: 1, execute: searchPrimaryPortal },
    { name: "web_search", priority: 2, execute: searchWeb },
    { name: "alternative_portals", priority: 3, execute: searchAlternativePortals },
    { name: "archive_search", priority: 4, execute: searchArchive },
    { name: "ai_url_guessing", priority: 5, execute: guessDocumentUrls },
  ];

  const allSources: DiscoveredSource[] = [];
  const strategiesAttempted: string[] = [];
  const strategiesSucceeded: string[] = [];

  // Try strategies in order until we have sufficient documents
  for (const strategy of strategies.slice(0, maxStrategies)) {
    logger.debug(`[Discovery Agent] Attempting strategy: ${strategy.name}`);
    
    strategiesAttempted.push(strategy.name);
    
    try {
      const sources = await strategy.execute(context);
      
      if (sources.length > 0) {
        logger.debug(`[Discovery Agent] Strategy ${strategy.name} found ${sources.length} sources`);
        strategiesSucceeded.push(strategy.name);
        allSources.push(...sources);
        
        // If we found high-confidence RFP document, we can stop
        const hasMainRfp = sources.some(s => 
          s.type === "rfp" && s.confidence >= 80
        );
        
        if (hasMainRfp && allSources.length >= 3) {
          logger.debug("[Discovery Agent] Found main RFP document, stopping discovery");
          break;
        }
      }
    } catch (error) {
      logger.error(`[Discovery Agent] Strategy ${strategy.name} failed:`, error);
      context.previousAttempts.push(strategy.name);
    }
  }

  // Deduplicate sources by URL
  const uniqueSources = deduplicateSources(allSources);
  
  // Sort by confidence
  uniqueSources.sort((a, b) => b.confidence - a.confidence);

  // Store discovered sources in database
  const storedCount = await storeDiscoveredSources(
    opportunityId,
    uniqueSources,
    opportunity.organizationId ?? null
  );
  
  logger.debug(`[Discovery Agent] Discovery complete. Stored ${storedCount} unique sources`);

  return {
    success: storedCount > 0,
    sources: uniqueSources,
    strategiesAttempted,
    strategiesSucceeded,
    aiAnalysis: generateDiscoveryAnalysis(uniqueSources, strategiesAttempted, strategiesSucceeded),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a search result link is relevant to the opportunity
 */
function isRelevantLink(link: string, context: DiscoveryContext): boolean {
  const linkLower = link.toLowerCase();
  const titleLower = context.title.toLowerCase();
  const orgLower = (context.organization || "").toLowerCase();
  const noticeId = (context.noticeId || "").toLowerCase();
  
  // Extract key terms from title (remove common words)
  const stopWords = new Set(["the", "a", "an", "for", "of", "in", "on", "at", "to", "and", "or", "services", "provision", "supply"]);
  const titleTerms = titleLower
    .split(/\s+/)
    .filter(term => term.length > 3 && !stopWords.has(term))
    .slice(0, 5); // Top 5 meaningful terms
  
  // Check for relevance
  const hasOrgMatch = orgLower.length > 3 && linkLower.includes(orgLower);
  const hasNoticeIdMatch = noticeId.length > 3 && linkLower.includes(noticeId);
  const hasTermMatch = titleTerms.some(term => linkLower.includes(term));
  
  // Also check for document-related keywords
  const docKeywords = ["tender", "rfp", "bid", "procurement", "document", "download", "attachment"];
  const hasDocKeyword = docKeywords.some(kw => linkLower.includes(kw));
  
  // Must have at least one strong match or document keyword + term match
  return hasOrgMatch || hasNoticeIdMatch || (hasTermMatch && hasDocKeyword) || hasTermMatch;
}

function generateAlternativePortals(context: DiscoveryContext): Array<{ name: string; url: string }> {
  const portals: Array<{ name: string; url: string }> = [];
  const country = context.country?.toLowerCase() || "";
  const org = context.organization?.toLowerCase() || "";
  
  // Country-specific portals
  if (country.includes("kenya")) {
    portals.push({ name: "PPIP Kenya", url: "https://www.ppip.go.ke/tenders" });
    portals.push({ name: "MyGov Kenya", url: "https://tenders.go.ke" });
  }
  if (country.includes("south africa")) {
    portals.push({ name: "eTenders SA", url: "https://www.etenders.gov.za" });
  }
  if (country.includes("nigeria")) {
    portals.push({ name: "BPP Nigeria", url: "https://www.bpp.gov.ng" });
  }
  
  // Organization-specific portals
  if (org.includes("world bank") || org.includes("ibrd")) {
    portals.push({ name: "World Bank Projects", url: "https://projects.worldbank.org/en/projects-operations/procurement" });
  }
  if (org.includes("african development bank") || org.includes("afdb")) {
    portals.push({ name: "AfDB Procurement", url: "https://www.afdb.org/en/about-us/corporate-procurement" });
  }
  if (org.includes("un") || org.includes("united nations")) {
    portals.push({ name: "UNGM", url: "https://www.ungm.org" });
  }
  
  // General international portals
  portals.push({ name: "DGMarket", url: "https://www.dgmarket.com" });
  portals.push({ name: "TendersInfo", url: "https://www.tendersinfo.com" });
  portals.push({ name: "Development Business", url: "https://www.devbusiness.com" });
  
  return portals;
}

function isDocumentUrl(url: string): boolean {
  const docExtensions = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".zip", ".rar"];
  const urlLower = url.toLowerCase();
  return docExtensions.some(ext => urlLower.includes(ext)) ||
         urlLower.includes("/download") ||
         urlLower.includes("/document");
}

function classifyDocumentFromUrl(url: string): DiscoveredSource["type"] {
  const urlLower = url.toLowerCase();
  const tokens = new Set(urlLower.split(/[^a-z0-9]+/).filter(Boolean));
  
  if (hasAnyToken(tokens, ["amendment", "amendments", "corrigendum", "corrigenda"])) return "amendment";
  if (hasAnyToken(tokens, ["specification", "specifications", "technical"])) return "specification";
  if (hasAnyToken(tokens, ["evaluation", "criteria"])) return "evaluation";
  if (hasAnyToken(tokens, ["form", "forms", "template", "templates"])) return "form";
  if (hasAnyToken(tokens, ["rfp", "tender", "bid", "bids", "bidding"])) return "rfp";
  
  return "attachment";
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some(candidate => tokens.has(candidate));
}

function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() || "document";
    return decodeURIComponent(filename);
  } catch {
    return "document";
  }
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function validateDocumentType(type: string): DiscoveredSource["type"] {
  const validTypes: DiscoveredSource["type"][] = [
    "rfp", "amendment", "specification", "evaluation", "form", "attachment"
  ];
  return validTypes.includes(type as DiscoveredSource["type"]) 
    ? (type as DiscoveredSource["type"]) 
    : "attachment";
}

function extractFromLinks(links: string[], markdown: string, baseUrl: string): DiscoveredSource[] {
  const sources: DiscoveredSource[] = [];
  const seen = new Set<string>();
  
  for (const link of links) {
    const resolvedUrl = resolveUrl(link, baseUrl);
    const normalized = resolvedUrl.toLowerCase().replace(/\?.*$/, "");
    if (seen.has(normalized)) continue;
    if (!isDocumentUrl(resolvedUrl)) continue;
    
    seen.add(normalized);
    sources.push({
      url: resolvedUrl,
      name: extractFilenameFromUrl(resolvedUrl),
      type: classifyDocumentFromUrl(resolvedUrl),
      confidence: 75,
      source: "primary_portal",
      discoveryMethod: "link_extraction",
    });
  }
  
  return sources;
}

function deduplicateSources(sources: DiscoveredSource[]): DiscoveredSource[] {
  const seen = new Map<string, DiscoveredSource>();
  
  for (const source of sources) {
    const normalizedUrl = source.url.toLowerCase().replace(/\?.*$/, "");
    
    if (seen.has(normalizedUrl)) {
      // Keep the one with higher confidence
      const existing = seen.get(normalizedUrl)!;
      if (source.confidence > existing.confidence) {
        seen.set(normalizedUrl, source);
      }
    } else {
      seen.set(normalizedUrl, source);
    }
  }
  
  return Array.from(seen.values());
}

async function storeDiscoveredSources(
  opportunityId: string, 
  sources: DiscoveredSource[],
  organizationId: string | null
): Promise<number> {
  let stored = 0;
  
  for (const source of sources) {
    try {
      // Check if already exists
      const existing = await db.query.opportunityDocuments.findFirst({
        where: and(
          eq(opportunityDocuments.opportunityId, opportunityId),
          organizationId ? eq(opportunityDocuments.organizationId, organizationId) : undefined,
          eq(opportunityDocuments.sourceUrl, source.url)
        ),
      });
      
      if (existing) continue;
      
      await db.insert(opportunityDocuments).values({
        organizationId,
        opportunityId,
        documentName: source.name,
        documentType: source.type,
        description: source.description || `${source.discoveryMethod} (confidence: ${source.confidence}%)`,
        sourceUrl: source.url,
        status: "discovered",
        isSelected: source.confidence >= 60, // Auto-select high confidence sources
      });
      
      stored++;
    } catch (error) {
      logger.error("Failed to store discovered source:", error);
    }
  }
  
  // Update opportunity status
  if (stored > 0) {
    await db.update(opportunities)
      .set({
        documentsDiscovered: true,
        documentsDiscoveredAt: new Date(),
        lastDocumentScanAt: new Date(),
      })
      .where(and(
        eq(opportunities.id, opportunityId),
        organizationId ? eq(opportunities.organizationId, organizationId) : undefined
      ));
  }
  
  return stored;
}

function generateDiscoveryAnalysis(
  sources: DiscoveredSource[],
  attempted: string[],
  succeeded: string[]
): string {
  const rfpCount = sources.filter(s => s.type === "rfp").length;
  const bySource = sources.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return `Discovery Analysis:
- Total sources found: ${sources.length}
- Main RFP documents: ${rfpCount}
- Strategies attempted: ${attempted.length} (${attempted.join(", ")})
- Strategies succeeded: ${succeeded.length} (${succeeded.join(", ")})
- Sources by type: ${Object.entries(bySource).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Average confidence: ${sources.length > 0 ? Math.round(sources.reduce((a, s) => a + s.confidence, 0) / sources.length) : 0}%`;
}
