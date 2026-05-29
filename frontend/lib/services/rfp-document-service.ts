/**
 * RFP Document Discovery and Management Service
 * 
 * Handles:
 * 1. Discovery of RFP documents using Firecrawl/scraping
 * 2. Downloading documents to local storage
 * 3. Managing document metadata in the database
 * 4. Extracting text content from downloaded documents
 */

import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import { db } from "@/lib/db";
import { opportunityDocuments, opportunities, userWorkspaces, type NewOpportunityDocument } from "@/lib/db/schema";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { eq, and, inArray } from "drizzle-orm";
import { mkdir, writeFile, readFile, access, unlink } from "fs/promises";
import { join, basename, extname } from "path";
import { createHash } from "crypto";
import { processRfpDocument, isSupportedFileType } from "@/lib/services/docling-client";
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";
import { cleanTextForUtf8Storage, extractReadableTextFromBinaryDocument } from "@/lib/documents/binary-text";
import {
	extractPdfTextWithPdftotext,
	extractPdfTextWithPdfParse,
} from "@/lib/documents/pdf-text";
import { extractXlsxText } from "@/lib/documents/spreadsheet-text";
import { recordWorkflowRuntimeTransition, upsertWorkflowRuntimeTask } from "@/lib/actions/workflow-runtime";
import { assertPublicHttpUrl, fetchPublicHttpUrl } from "@/lib/security/public-url";
import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";
import { scrapeWithCloakBrowser } from "@/lib/services/cloakbrowser-scraper-client";
import { searchSearxng } from "@/lib/services/searxng-client";
import {
  buildRfpObjectKey,
  downloadFromLinodeE3,
  getLinodeE3ConfigFromEnv,
  uploadToLinodeE3,
  type LinodeE3UploadResult,
} from "@/lib/storage/linode-e3";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Configuration
// ============================================================================

const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/rfp-documents";
const MAX_FILE_SIZE_MB = 100; // Maximum file size to download
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".zip", ".rar", ".html", ".htm"];
const DOCUMENT_INVALID_TLS_HOSTS = new Set(["tenders.go.ke"]);
const MIN_EXTRACTED_TEXT_LENGTH = 10;
const MIN_HTML_EXTRACTED_TEXT_LENGTH = 450;
const MIN_HTML_EXTRACTED_WORD_COUNT = 40;
const SOURCE_DOCUMENT_FETCH_TIMEOUT_MS = 60_000;
const SOURCE_DOCUMENT_FALLBACK_TIMEOUT_MS = 30_000;
const BROWSER_SCRAPER_URL = (process.env.STEALTH_SCRAPER_URL ?? "http://84.247.181.100:3003").replace(/\/$/, "");
const SOURCE_DOCUMENT_READER_FALLBACK_PREFIX =
  process.env.SOURCE_DOCUMENT_READER_FALLBACK_PREFIX ?? "https://r.jina.ai/http://r.jina.ai/http://";
const PDFTOTEXT_TIMEOUT_MS = 30_000;
const HTML_RFP_TEXT_SIGNAL =
  /(?:\brequests?\s+for\s+proposals?\b|\brfps?\b|\btenders?\b|\bbids?\b|\bbidding\b|\bprocurement\b|\bpre-?qualification\b|\bproposals?\b|\bsolicitations?\b|\bexpressions?\s+of\s+interest\b|\beois?\b|\binvitations?\s+to\s+bid\b|\bterms?\s+of\s+reference\b|\btors?\b|\brequests?\s+for\s+quotations?\b|\brfqs?\b|\bappel(?:s)?\s+d['’]offres?\b|\bavis\s+d['’]appel\b|\bmarch[eé]s?\b|\bconsultations?\b|\bacquisition\b|\brecrutement\b|\blicitaci[oó]n\b|\badquisici[oó]n\b|\bcontrataci[oó]n\b|закупк[а-яё]*|тендер[а-яё]*|конкурс[а-яё]*|поставк[а-яё]*|заявк[а-яё]*|предложени[а-яё]*)/iu;

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredDocument {
  name: string;
  url: string;
  type: "rfp" | "amendment" | "attachment" | "specification" | "evaluation" | "form" | "other";
  description?: string;
}

export interface DocumentDiscoveryResult {
  success: boolean;
  documents: DiscoveredDocument[];
  error?: string;
  sourceUrl: string;
}

export interface DownloadResult {
  success: boolean;
  documentId?: string;
  rfpDocumentId?: string;
  parsingJobId?: string;
  parsingStatus?: DownloadParseStatus;
  parsingError?: string;
  localPath?: string;
  storagePath?: string;
  storageReceipt?: RfpStorageReceipt;
  fileSize?: number;
  mimeType?: string;
  provenance?: RfpIngestProvenance;
  error?: string;
}

export type DownloadParseMode = "background" | "inline" | "queued";
export type DownloadParseStatus = "queued" | "completed" | "failed" | "duplicate" | "not_queued";

export interface DownloadDocumentOptions {
  parseMode?: DownloadParseMode;
}

export interface RfpStorageReceipt {
  provider: "linode_e3" | "local";
  storagePath: string;
  bucket?: string;
  key?: string;
  endpoint?: string;
  etag?: string | null;
  sha256: string;
  byteLength: number;
  contentType: string;
}

export interface RfpIngestProvenance {
  source: "opportunity_document_download";
  sourceOpportunityDocumentId: string;
  sourceUrl: string;
  originalSourceUrl?: string;
  downloadMethod?: SourceDocumentFetchMethod;
  downloadedBy: string;
  downloadedAt: string;
}

interface StoredFetchedRfpDocument {
  storagePath: string;
  receipt: RfpStorageReceipt;
}

type SourceDocumentFetchMethod =
  | "direct"
  | "searxng_direct"
  | "firecrawl_link"
  | "firecrawl_landing_page_html"
  | "browser_link"
  | "browser_landing_page_html"
  | "cloakbrowser_link"
  | "cloakbrowser_landing_page_html"
  | "reader_link"
  | "reader_landing_page_html";

type FetchedSourceDocument = {
  buffer: Buffer;
  mimeType: string;
  effectiveUrl: string;
  originalUrl: string;
  filename: string;
  extractionFilename: string;
  method: SourceDocumentFetchMethod;
};

type ExtractedDocumentText = {
  text: string;
  pageCount?: number;
  extractor: "docling" | "local_pdftotext" | "local_pdf_parse" | "local_docx_parse" | "local_doc_binary_text" | "local_html_text" | "local_xlsx_parse";
};

type SourceRecoveryScrape = {
  markdown?: string;
  html?: string;
  links?: string[];
  method: "firecrawl" | "browser" | "cloakbrowser" | "reader";
};

interface QueuedRfpParsing {
  rfpDocumentId?: string;
  parsingJobId?: string;
  duplicateOfRfpDocumentId?: string;
  parsingStatus?: DownloadParseStatus;
  parsingError?: string;
}

type OpportunityDocumentRow = typeof opportunityDocuments.$inferSelect;

export type OpportunityDocumentWithParseReference = OpportunityDocumentRow & {
  rfpDocumentId: string | null;
  parsingJobId: string | null;
  parsingStatus: string | null;
  parsingProgress: number | null;
};

export interface OpportunityDocumentAccessActor {
	userId: string;
	role?: string;
	roles?: string[];
}

export class OpportunityDocumentAccessError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "OpportunityDocumentAccessError";
		this.status = status;
	}
}

export class OpportunityDocumentIntegrityError extends OpportunityDocumentAccessError {
	constructor(message = "Document hash mismatch") {
		super(message, 409);
		this.name = "OpportunityDocumentIntegrityError";
	}
}

// ============================================================================
// Document Discovery
// ============================================================================

/**
 * Extract schema for document discovery using LLM
 */
const documentDiscoverySchema = {
  type: "object",
  properties: {
    documents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { 
            type: "string", 
            description: "Name/title of the document" 
          },
          url: { 
            type: "string", 
            description: "Direct URL to the document file (PDF, DOCX, XLSX, etc.)" 
          },
          type: { 
            type: "string", 
            enum: ["rfp", "amendment", "attachment", "specification", "evaluation", "form", "other"],
            description: "Type of document"
          },
          description: { 
            type: "string", 
            description: "Brief description of the document content" 
          },
        },
        required: ["name", "url", "type"],
      },
    },
  },
};

/**
 * Discover RFP documents on a given URL
 * Uses Firecrawl with LLM extraction to find document links
 */
export async function discoverDocuments(
  opportunityId: string,
  sourceUrl: string
): Promise<DocumentDiscoveryResult> {
  try {
    const safeSourceUrl = (await assertPublicHttpUrl(sourceUrl, "RFP source URL")).toString();
    const firecrawl = new FirecrawlClient();

    // First, try LLM-based extraction for best results
    const scrapeResult = await firecrawl.scrape(safeSourceUrl, {
      formats: ["markdown", "links", "html"],
      waitFor: 3000, // Wait for dynamic content
      extract: {
        schema: documentDiscoverySchema,
        systemPrompt: `You are an expert at analyzing tender/RFP portal pages. 
Extract all document links that are actual downloadable files (PDF, DOCX, XLSX, etc.).
Focus on:
1. Main RFP/Tender documents (type: "rfp")
2. Amendments or corrigendums (type: "amendment")  
3. Technical specifications (type: "specification")
4. Evaluation criteria (type: "evaluation")
5. Required forms (type: "form")
6. Other attachments (type: "attachment")

Ignore:
- Navigation links
- Portal help pages
- External website links
- Links to tender listings (not documents)

Return direct document URLs only.`,
      },
    });

    let documents: DiscoveredDocument[] = [];

    // Try LLM extraction first
    if (scrapeResult.success && scrapeResult.data?.extract?.documents) {
      const extractedDocs: unknown[] = Array.isArray(scrapeResult.data.extract.documents)
        ? scrapeResult.data.extract.documents
        : [];
      documents = extractedDocs
        .map((doc) => normalizeExtractedDocument(doc, safeSourceUrl))
        .filter((doc): doc is DiscoveredDocument => doc !== null);
    }

    // Fallback: Parse links from markdown if LLM extraction didn't find anything
    if (documents.length === 0 && scrapeResult.data?.markdown) {
      const linkDocs = extractDocumentsFromLinks(
        scrapeResult.data.markdown,
        scrapeResult.data.links || [],
        safeSourceUrl
      );
      documents = linkDocs;
    }

    if (documents.length === 0) {
      return {
        success: false,
        documents: [],
        error: "No downloadable RFP documents found",
        sourceUrl,
      };
    }

    // Store discovered documents in database
    const storedDocs = await storeDiscoveredDocuments(opportunityId, documents);

    // Update opportunity to mark documents as discovered
    await db.update(opportunities)
      .set({
        documentsDiscovered: true,
        documentsDiscoveredAt: new Date(),
        lastDocumentScanAt: new Date(),
      })
      .where(eq(opportunities.id, opportunityId));

    return {
      success: true,
      documents: storedDocs,
      sourceUrl,
    };
  } catch (error) {
    logger.error("Document discovery failed:", error);
    return {
      success: false,
      documents: [],
      error: error instanceof Error ? error.message : "Unknown error",
      sourceUrl,
    };
  }
}

/**
 * Extract document links from markdown and links array
 */
function extractDocumentsFromLinks(
  markdown: string,
  links: string[],
  baseUrl: string
): DiscoveredDocument[] {
  const documents: DiscoveredDocument[] = [];
  const seenUrls = new Set<string>();

  // Check each link
  for (const link of links) {
    const fullUrl = resolveUrl(link, baseUrl);
    
    if (seenUrls.has(fullUrl)) continue;
    if (!isValidDocumentUrl(fullUrl)) continue;

    seenUrls.add(fullUrl);

    // Determine document type from URL and context
    const type = classifyDocumentType(fullUrl, markdown);
    const name = extractDocumentName(fullUrl, markdown);

    documents.push({
      name,
      url: fullUrl,
      type,
    });
  }

  return documents;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeExtractedDocument(value: unknown, baseUrl: string): DiscoveredDocument | null {
  if (!isRecord(value)) return null;
  const rawUrl = nonBlankString(value.url);
  if (!rawUrl) return null;

  const resolvedUrl = resolveUrl(rawUrl, baseUrl);
  if (!isValidDocumentUrl(resolvedUrl)) return null;

  const extractedName = nonBlankString(value.name);
  const sanitizedName = extractedName ? sanitizeFilename(extractedName) : "";
  const extractedType = nonBlankString(value.type);
  return {
    name: sanitizedName || extractDocumentName(resolvedUrl, ""),
    url: resolvedUrl,
    type: extractedType ? validateDocumentType(extractedType) : classifyDocumentType(resolvedUrl, ""),
    description: nonBlankString(value.description) ?? undefined,
  };
}

/**
 * Check if URL points to a valid document
 */
function isValidDocumentUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check extension
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    if (hasValidExt) return true;

    // Check for common document patterns in URL
    const docPatterns = [
      /\.(pdf|docx?|xlsx?|zip|rar|html?)(\?|$)/i,
      /download/i,
      /document/i,
      /tender-doc/i,
      /rfp.*file/i,
    ];

    return docPatterns.some((pattern) => pattern.test(url));
  } catch {
    return false;
  }
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

/**
 * Classify document type based on URL and context
 */
function classifyDocumentType(url: string, context: string): DiscoveredDocument["type"] {
  const urlLower = url.toLowerCase();
  const contextLower = context.toLowerCase();
  const urlTokens = new Set(urlLower.split(/[^a-z0-9]+/).filter(Boolean));

  // Check URL patterns
  if (hasAnyToken(urlTokens, ["amendment", "amendments", "corrigendum", "corrigenda"])) {
    return "amendment";
  }
  if (hasAnyToken(urlTokens, ["specification", "specifications", "technical"])) {
    return "specification";
  }
  if (hasAnyToken(urlTokens, ["evaluation", "criteria"])) {
    return "evaluation";
  }
  if (hasAnyToken(urlTokens, ["form", "forms", "template", "templates"])) {
    return "form";
  }
  if (hasAnyToken(urlTokens, ["rfp", "tender", "bid", "bids", "bidding"])) {
    return "rfp";
  }

  // Check context around link in markdown
  const linkIndex = contextLower.indexOf(urlLower);
  if (linkIndex !== -1) {
    const surrounding = contextLower.substring(
      Math.max(0, linkIndex - 200),
      Math.min(context.length, linkIndex + 200)
    );

    if (surrounding.includes("amendment")) return "amendment";
    if (surrounding.includes("specification")) return "specification";
    if (surrounding.includes("evaluation")) return "evaluation";
    if (surrounding.includes("form")) return "form";
    if (surrounding.includes("main") || surrounding.includes("rfp")) return "rfp";
  }

  return "attachment";
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => tokens.has(candidate));
}

/**
 * Extract document name from URL or context
 */
function extractDocumentName(url: string, context: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = decodeURIComponent(urlObj.pathname);
    const filename = basename(pathname);
    
    if (filename && filename !== "/") {
      return sanitizeFilename(filename);
    }
  } catch {
    // Fall through to context-based extraction
  }

  // Try to find name from markdown link text
  const linkPattern = new RegExp(`\\[([^\\]]+)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`);
  const match = context.match(linkPattern);
  if (match) {
    return sanitizeFilename(match[1]);
  }

  // Fallback to URL-based name
  return `document-${Date.now()}`;
}

/**
 * Validate and normalize document type
 */
function validateDocumentType(type: string): DiscoveredDocument["type"] {
  const validTypes: DiscoveredDocument["type"][] = [
    "rfp", "amendment", "attachment", "specification", "evaluation", "form", "other"
  ];
  
  return validTypes.includes(type as DiscoveredDocument["type"]) 
    ? (type as DiscoveredDocument["type"]) 
    : "attachment";
}

/**
 * Sanitize filename for storage
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 200);
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Store discovered documents in the database
 */
async function storeDiscoveredDocuments(
  opportunityId: string,
  documents: DiscoveredDocument[]
): Promise<DiscoveredDocument[]> {
  const stored: DiscoveredDocument[] = [];
  const [opportunity] = await db
    .select({ organizationId: opportunities.organizationId })
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId))
    .limit(1);
  const organizationId = opportunity?.organizationId ?? null;

  for (const doc of documents) {
    try {
      // Check if document already exists
      const existing = await db.query.opportunityDocuments.findFirst({
        where: and(
          eq(opportunityDocuments.opportunityId, opportunityId),
          organizationId ? eq(opportunityDocuments.organizationId, organizationId) : undefined,
          eq(opportunityDocuments.sourceUrl, doc.url)
        ),
      });

      if (existing) {
        // Document already exists, skip
        continue;
      }

      // Insert new document
      await db.insert(opportunityDocuments).values({
        organizationId,
        opportunityId,
        documentName: doc.name,
        documentType: doc.type,
        description: doc.description,
        sourceUrl: doc.url,
        status: "discovered",
        isSelected: true,
      });

      stored.push(doc);
    } catch (error) {
      logger.error(`Failed to store document ${doc.name}:`, error);
    }
  }

  return stored;
}

/**
 * Get all documents for an opportunity
 */
export async function getOpportunityDocuments(opportunityId: string): Promise<OpportunityDocumentWithParseReference[]> {
  const docs = await db.query.opportunityDocuments.findMany({
    where: eq(opportunityDocuments.opportunityId, opportunityId),
    orderBy: (docs, { desc }) => [desc(docs.discoveredAt)],
  });

  const fileHashes = Array.from(new Set(
    docs
      .map((doc) => doc.fileHash)
      .filter((fileHash): fileHash is string => Boolean(fileHash))
  ));

  if (fileHashes.length === 0) {
    return docs.map((doc) => ({
      ...doc,
      rfpDocumentId: null,
      parsingJobId: null,
      parsingStatus: null,
      parsingProgress: null,
    }));
  }

  const linkedRfpDocuments = await db.query.rfpDocuments.findMany({
    where: and(
      eq(rfpDocuments.opportunityId, opportunityId),
      inArray(rfpDocuments.fileHash, fileHashes)
    ),
    orderBy: (rfpDocs, { desc }) => [desc(rfpDocs.createdAt)],
  });

  const rfpDocumentIds = linkedRfpDocuments.map((doc) => doc.id);
  const latestJobs = rfpDocumentIds.length > 0
    ? await db.query.rfpParsingJobs.findMany({
      where: inArray(rfpParsingJobs.rfpDocumentId, rfpDocumentIds),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    })
    : [];

  const rfpByHash = new Map<string, (typeof linkedRfpDocuments)[number]>();
  for (const rfpDocument of linkedRfpDocuments) {
    if (rfpDocument.fileHash && !rfpByHash.has(rfpDocument.fileHash)) {
      rfpByHash.set(rfpDocument.fileHash, rfpDocument);
    }
  }

  const latestJobByRfpId = new Map<string, (typeof latestJobs)[number]>();
  for (const job of latestJobs) {
    if (!latestJobByRfpId.has(job.rfpDocumentId)) {
      latestJobByRfpId.set(job.rfpDocumentId, job);
    }
  }

  return docs.map((doc) => {
    const rfpDocument = doc.fileHash ? rfpByHash.get(doc.fileHash) : undefined;
    const latestJob = rfpDocument ? latestJobByRfpId.get(rfpDocument.id) : undefined;

    return {
      ...doc,
      rfpDocumentId: rfpDocument?.id ?? null,
      parsingJobId: latestJob?.id ?? null,
      parsingStatus: latestJob?.status ?? rfpDocument?.parsingStatus ?? null,
      parsingProgress: latestJob?.progress ?? rfpDocument?.parsingProgress ?? null,
    };
  });
}

/**
 * Update document selection status
 */
export async function updateDocumentSelection(
  documentId: string,
  isSelected: boolean
) {
  return db.update(opportunityDocuments)
    .set({ 
      isSelected,
      updatedAt: new Date(),
    })
    .where(eq(opportunityDocuments.id, documentId))
    .returning();
}

/**
 * Select/deselect all documents for an opportunity
 */
export async function updateAllDocumentSelections(
  opportunityId: string,
  isSelected: boolean
) {
  return db.update(opportunityDocuments)
    .set({ 
      isSelected,
      updatedAt: new Date(),
    })
    .where(eq(opportunityDocuments.opportunityId, opportunityId));
}

// ============================================================================
// Document Download
// ============================================================================

/**
 * Download a document from source URL to local storage
 */
export async function downloadDocument(
  documentId: string,
  userId?: string,
  expectedOpportunityId?: string,
  options: DownloadDocumentOptions = {}
): Promise<DownloadResult> {
  try {
    // Get document from database
    const doc = await db.query.opportunityDocuments.findFirst({
      where: eq(opportunityDocuments.id, documentId),
    });

    if (!doc) {
      return { success: false, error: "Document not found" };
    }

    if (expectedOpportunityId && doc.opportunityId !== expectedOpportunityId) {
      return { success: false, documentId, error: "Document does not belong to this opportunity" };
    }

    if (!doc.sourceUrl) {
      return { success: false, error: "No source URL available" };
    }
    const safeSourceUrl = await assertPublicHttpUrl(doc.sourceUrl, "Document source URL");
    const safeSourceUrlString = safeSourceUrl.toString();

    // Update status to downloading
    await db.update(opportunityDocuments)
      .set({ 
        status: "downloading",
        downloadAttempts: doc.downloadAttempts + 1,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    let fetched = await prepareFetchedDocumentForIntake(
      await fetchSourceDocument(safeSourceUrl, doc.documentName)
    );

    // Extract text before queueing so the parser does not have to re-fetch
    // stored bytes. Cheap local extractors run before DocLing where available.
    let processedText = await extractFetchedDocumentText(fetched);
    if (!processedText && isFetchedHtmlDocument(fetched) && shouldRecoverUnusableFetchedHtmlDocument(fetched)) {
      const recoveredHtml = await recoverUnusableFetchedHtmlDocument(fetched, doc.documentName);
      if (recoveredHtml) {
        fetched = await prepareFetchedDocumentForIntake(recoveredHtml);
        processedText = await extractFetchedDocumentText(fetched);
      }
    }

    const { buffer, mimeType } = fetched;

    // Calculate hash
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // Store the fetched binary server-side. Linode E3 has no browser CORS,
    // so fetched RFPs are uploaded from this server process when configured.
    const stored = await storeFetchedRfpDocument({
      documentId: doc.id,
      opportunityId: doc.opportunityId,
      filename: fetched.filename,
      sourceUrl: fetched.effectiveUrl,
      buffer,
      mimeType,
      userId,
    });
    const localPath = stored.storagePath;

    const extractedText = processedText?.text;
    const pageCount = processedText?.pageCount;

    // Update database
    await db.update(opportunityDocuments)
      .set({
        localPath,
        fileSizeBytes: buffer.length,
        mimeType,
        fileHash,
        downloadedAt: new Date(),
        downloadedBy: userId || "system",
        status: "downloaded",
        lastError: null,
        extractedText,
        pageCount,
        extractedAt: extractedText ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    // Update opportunity download count
    await updateOpportunityDownloadCount(doc.opportunityId);

    const provenance: RfpIngestProvenance = {
      source: "opportunity_document_download",
      sourceOpportunityDocumentId: doc.id,
      sourceUrl: fetched.effectiveUrl,
      originalSourceUrl: fetched.effectiveUrl !== safeSourceUrlString ? safeSourceUrlString : undefined,
      downloadMethod: fetched.method,
      downloadedBy: userId || "system",
      downloadedAt: new Date().toISOString(),
    };
    const queued = await queueRfpParsingFromDownloadedDocument({
      document: doc,
      storagePath: localPath,
      storageReceipt: stored.receipt,
      provenance,
      fileSize: buffer.length,
      mimeType,
      fileHash,
      extractedText,
      pageCount,
      userId: userId || "system",
      parseMode: options.parseMode ?? "background",
      parserFilename: fetched.extractionFilename,
    });

    return {
      success: true,
      documentId,
      rfpDocumentId: queued.rfpDocumentId ?? queued.duplicateOfRfpDocumentId,
      parsingJobId: queued.parsingJobId,
      parsingStatus: queued.parsingStatus,
      parsingError: queued.parsingError,
      localPath,
      storagePath: localPath,
      storageReceipt: stored.receipt,
      fileSize: buffer.length,
      mimeType,
      provenance,
    };
  } catch (error) {
    logger.error(`Download failed for document ${documentId}:`, error);
    
    // Update with error status
    await db.update(opportunityDocuments)
      .set({
        status: "failed",
        lastError: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    const failedDoc = await db.query.opportunityDocuments.findFirst({
      where: eq(opportunityDocuments.id, documentId),
    }).catch(() => null);

    if (failedDoc) {
      await recordOpportunityDocumentIngestWorkflow({
        document: failedDoc,
        userId: userId || "system",
        toState: "download_failed",
        reason: error instanceof Error ? error.message : "Download failed",
        priority: "high",
      }).catch((workflowError) => {
        logger.warn("[RFP Document Service] Failed to persist failed ingest workflow:", workflowError);
      });
    }

    return {
      success: false,
      documentId,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

function invalidTlsHostsForDocumentSource(sourceUrl: URL): string[] | undefined {
  const host = sourceUrl.hostname.replace(/^www\./, "").toLowerCase();
  return DOCUMENT_INVALID_TLS_HOSTS.has(host) ? [host] : undefined;
}

/**
 * Download multiple selected documents
 */
export async function downloadSelectedDocuments(
  opportunityId: string,
  userId?: string
): Promise<{ success: number; failed: number; results: DownloadResult[] }> {
  const docs = await db.query.opportunityDocuments.findMany({
    where: and(
      eq(opportunityDocuments.opportunityId, opportunityId),
      eq(opportunityDocuments.isSelected, true),
      eq(opportunityDocuments.status, "discovered")
    ),
  });

  const results: DownloadResult[] = [];
  let success = 0;
  let failed = 0;

  // Download sequentially to avoid overwhelming the server
  for (const doc of docs) {
    const result = await downloadDocument(doc.id, userId);
    results.push(result);
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }

    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { success, failed, results };
}

/**
 * Update opportunity download count
 */
async function updateOpportunityDownloadCount(opportunityId: string) {
  const [opportunity] = await db
    .select({ organizationId: opportunities.organizationId })
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId))
    .limit(1);
  const organizationId = opportunity?.organizationId ?? null;
  const downloadedCount = await db.$count(
    opportunityDocuments,
    and(
      eq(opportunityDocuments.opportunityId, opportunityId),
      organizationId ? eq(opportunityDocuments.organizationId, organizationId) : undefined,
      eq(opportunityDocuments.status, "downloaded")
    )
  );

  await db.update(opportunities)
    .set({ documentsDownloadedCount: downloadedCount })
    .where(and(
      eq(opportunities.id, opportunityId),
      organizationId ? eq(opportunities.organizationId, organizationId) : undefined
    ));
}

// ============================================================================
// File Access
// ============================================================================

/**
 * Get file buffer for a downloaded document
 */
export async function getDocumentFile(documentId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  filename: string;
} | null> {
  const doc = await db.query.opportunityDocuments.findFirst({
    where: eq(opportunityDocuments.id, documentId),
  });

  if (!doc?.localPath) {
    return null;
  }

  try {
    const buffer = await readDocumentBuffer(doc.localPath, doc.fileHash ?? undefined);
    
    return {
      buffer,
      mimeType: doc.mimeType || "application/octet-stream",
      filename: doc.documentName,
    };
  } catch {
    return null;
  }
}

export async function getOpportunityDocumentFileForActor(
	actor: OpportunityDocumentAccessActor,
	opportunityId: string,
	documentId: string
): Promise<{
	buffer: Buffer;
	mimeType: string;
	filename: string;
} | null> {
	const [row] = await db
		.select({
			document: opportunityDocuments,
			opportunity: opportunities,
		})
		.from(opportunityDocuments)
		.innerJoin(opportunities, eq(opportunities.id, opportunityDocuments.opportunityId))
		.where(and(
			eq(opportunityDocuments.id, documentId),
			eq(opportunityDocuments.opportunityId, opportunityId)
		))
		.limit(1);

	if (!row) return null;
	if (!canReadOpportunityDocument(actor, row.document.downloadedBy, row.opportunity.assignedTo)) {
		throw new OpportunityDocumentAccessError("Forbidden", 403);
	}
	if (!row.document.localPath) return null;

	try {
		const buffer = await readDocumentBuffer(row.document.localPath, row.document.fileHash ?? undefined);
		return {
			buffer,
			mimeType: row.document.mimeType || "application/octet-stream",
			filename: row.document.documentName,
		};
	} catch (error) {
		if (error instanceof OpportunityDocumentAccessError) {
			throw error;
		}
		return null;
	}
}

function canReadOpportunityDocument(
	actor: OpportunityDocumentAccessActor,
	downloadedBy: string | null,
	opportunityAssignedTo: string | null
): boolean {
	const roles = new Set([actor.role, ...(actor.roles ?? [])].filter(Boolean));
	if (roles.has("admin") || roles.has("operations")) return true;
	if (downloadedBy && downloadedBy === actor.userId) return true;
	return Boolean(opportunityAssignedTo && opportunityAssignedTo === actor.userId);
}

/**
 * Delete a document from storage and database
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  try {
    const doc = await db.query.opportunityDocuments.findFirst({
      where: eq(opportunityDocuments.id, documentId),
    });

    if (doc?.localPath && !doc.localPath.startsWith("s3://")) {
      try {
        await unlink(doc.localPath);
      } catch {
        // File might not exist, continue
      }
    }

    await db.delete(opportunityDocuments)
      .where(eq(opportunityDocuments.id, documentId));

    if (doc?.opportunityId) {
      await updateOpportunityDownloadCount(doc.opportunityId);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to delete document ${documentId}:`, error);
    return false;
  }
}

// ============================================================================
// Text Extraction (for analysis) using DocLing
// ============================================================================

/**
 * Extract text from a downloaded document using DocLing
 */
export async function extractDocumentText(documentId: string): Promise<string | null> {
  const doc = await db.query.opportunityDocuments.findFirst({
    where: eq(opportunityDocuments.id, documentId),
  });

  if (!doc?.localPath || !doc.mimeType) {
    return null;
  }

  // If text was already extracted during download, return it
  if (doc.extractedText) {
    return doc.extractedText;
  }

  try {
    // Read file from Linode E3 or legacy local storage and process with DocLing.
    const buffer = await readDocumentBuffer(doc.localPath, doc.fileHash ?? undefined);
    
    const extractionFilename = filenameForExtraction(doc.documentName, doc.mimeType);
    if (!isSupportedFileType(extractionFilename)) {
      logger.debug(`[DocLing] File type not supported for extraction: ${extractionFilename}`);
      return null;
    }

    const processed = await extractSupportedDocumentText(buffer, extractionFilename);
    if (!processed) {
      return null;
    }
    
    // Update database with extracted text
    await db.update(opportunityDocuments)
      .set({
        extractedText: processed.text,
        pageCount: processed.pageCount,
        extractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    return processed.text;
  } catch (error) {
    logger.error(`[DocLing] Text extraction failed for ${documentId}:`, error);
    return null;
  }
}

async function fetchSourceDocument(
  sourceUrl: URL,
  documentName: string
): Promise<FetchedSourceDocument> {
  const direct = await tryFetchSourceDocumentUrl(sourceUrl, documentName, "direct");
  if (direct.ok) return direct.document;

  if (!shouldTrySourceRecovery(direct.status, direct.error)) {
    throw new Error(direct.error);
  }

  logger.warn("[RFP Document Service] Direct source document fetch failed; trying search/scrape recovery", {
    sourceUrl: sourceUrl.toString(),
    status: direct.status,
    error: direct.error,
  });

  const recovered = await recoverSourceDocumentViaSearchAndScrape(sourceUrl, documentName);
  if (recovered) return recovered;

  throw new Error(direct.error);
}

type SourceFetchAttempt =
  | { ok: true; document: FetchedSourceDocument }
  | { ok: false; status?: number; error: string };

async function tryFetchSourceDocumentUrl(
  url: URL,
  documentName: string,
  method: SourceDocumentFetchMethod
): Promise<SourceFetchAttempt> {
  const response = await fetchPublicHttpUrl(url, {
    headers: browserLikeDocumentHeaders(url),
    timeoutMs: SOURCE_DOCUMENT_FETCH_TIMEOUT_MS,
    allowInvalidTlsForHosts: invalidTlsHostsForDocumentSource(url),
  }, "Document source URL");

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const contentLength = response.headers.get("content-length");
  const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
  if (fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      ok: false,
      status: response.status,
      error: `File too large: ${(fileSize / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE_MB}MB)`,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  assertSourceDocumentBufferSize(buffer);
  if (isLikelyDirectDocumentUrl(url) && !isLikelyHtmlDocumentUrl(url) && isHtmlMimeType(mimeType) && looksLikeHtml(buffer)) {
    return {
      ok: false,
      status: response.status,
      error: `Unexpected HTML response while fetching document URL ${url.toString()}`,
    };
  }
  return {
    ok: true,
    document: {
      buffer,
      mimeType,
      effectiveUrl: url.toString(),
      originalUrl: url.toString(),
      filename: documentName,
      extractionFilename: documentName,
      method,
    },
  };
}

async function recoverSourceDocumentViaSearchAndScrape(
  sourceUrl: URL,
  documentName: string
): Promise<FetchedSourceDocument | undefined> {
  const attemptedUrls = new Set<string>([sourceUrl.toString()]);
  const candidates = await findSourceDocumentRecoveryCandidates(sourceUrl, documentName);

  for (const candidate of candidates) {
    const candidateUrl = await safeCandidateUrl(candidate.url, sourceUrl);
    if (!candidateUrl || attemptedUrls.has(candidateUrl.toString())) continue;
    attemptedUrls.add(candidateUrl.toString());

    if (isLikelyDirectDocumentUrl(candidateUrl)) {
      const direct = await tryFetchSourceDocumentUrl(candidateUrl, documentName, "searxng_direct");
      if (direct.ok) return direct.document;
    }

    const scraped = await scrapeRecoveryCandidate(candidateUrl);
    if (!scraped) continue;

    for (const link of extractDocumentLinksFromScrape(scraped, candidateUrl, sourceUrl, documentName)) {
      if (attemptedUrls.has(link.toString())) continue;
      attemptedUrls.add(link.toString());
      const linkMethod = sourceDocumentLinkMethod(scraped.method);
      const linked = await tryFetchSourceDocumentUrl(link, documentName, linkMethod);
      if (linked.ok) return linked.document;
    }

    const fallback = buildScrapedSourceDocument(candidateUrl, documentName, scraped);
    if (fallback) return fallback;
  }

  const scraped = await scrapeRecoveryCandidate(sourceUrl);
  if (scraped) {
    for (const link of extractDocumentLinksFromScrape(scraped, sourceUrl, sourceUrl, documentName)) {
      if (attemptedUrls.has(link.toString())) continue;
      attemptedUrls.add(link.toString());
      const linkMethod = sourceDocumentLinkMethod(scraped.method);
      const linked = await tryFetchSourceDocumentUrl(link, documentName, linkMethod);
      if (linked.ok) return linked.document;
    }

    const fallback = buildScrapedSourceDocument(sourceUrl, documentName, scraped);
    if (fallback) return fallback;
  }

  return undefined;
}

async function findSourceDocumentRecoveryCandidates(
  sourceUrl: URL,
  documentName: string
): Promise<Array<{ url: string; title?: string; content?: string }>> {
  const queries = buildSourceRecoveryQueries(sourceUrl, documentName);
  const candidates: Array<{ url: string; title?: string; content?: string }> =
    deterministicRecoveryCandidates(sourceUrl, documentName);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    seen.add(candidate.url);
  }

  for (const query of queries) {
    try {
      const response = await searchSearxng(query, {
        engines: ["brave", "bing"],
        language: "en",
        safesearch: 1,
        sendAcceptHeader: false,
      });
      for (const result of response.results.slice(0, 6)) {
        if (!result.url || seen.has(result.url)) continue;
        const candidate = {
          url: result.url,
          title: result.title,
          content: result.content,
        };
        if (!isAllowedRecoveryCandidate(candidate, sourceUrl, documentName)) continue;
        seen.add(result.url);
        candidates.push(candidate);
      }
    } catch (error) {
      logger.warn("[RFP Document Service] Source document recovery search failed", {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return candidates.sort((a, b) =>
    scoreRecoveryCandidate(b, sourceUrl, documentName) - scoreRecoveryCandidate(a, sourceUrl, documentName)
  );
}

function deterministicRecoveryCandidates(
  sourceUrl: URL,
  documentName: string
): Array<{ url: string; title?: string; content?: string }> {
  const slugs = slugifyDocumentTitleVariants(documentTitleForSearch(documentName));
  const candidates: Array<{ url: string; title?: string; content?: string }> = [];

  if (/\/media\/.+\/file\/[^/]+$/i.test(sourceUrl.pathname)) {
    for (const slug of slugs) {
      const documentPage = new URL(sourceUrl.toString());
      documentPage.pathname = documentPage.pathname.replace(/\/media\/.+\/file\/[^/]+$/i, `/documents/${slug}`);
      documentPage.search = "";
      documentPage.hash = "";
      candidates.push({
        url: documentPage.toString(),
        title: documentTitleForSearch(documentName),
        content: "same-host media-file document landing page",
      });
    }
  }

  if (isIomProcurementDocumentUrl(sourceUrl)) {
    const procurementPage = new URL("/procurement-opportunities", sourceUrl.origin);
    candidates.push({
      url: procurementPage.toString(),
      title: documentTitleForSearch(documentName),
      content: "IOM procurement opportunity listing for blocked procurement document",
    });
  }

  return candidates;
}

function isAllowedRecoveryCandidate(
  candidate: { url: string; title?: string; content?: string },
  sourceUrl: URL,
  documentName: string
): boolean {
  const candidateUrl = safeCandidateUrl(candidate.url, sourceUrl);
  if (!candidateUrl) return false;
  if (candidateUrl.hostname === sourceUrl.hostname) return true;
  return scoreRecoveryCandidate(candidate, sourceUrl, documentName) >= 12;
}

function buildSourceRecoveryQueries(sourceUrl: URL, documentName: string): string[] {
  const title = documentTitleForSearch(documentName);
  const host = sourceUrl.hostname.replace(/^www\./, "");
  const quotedTitle = `"${title}"`;
  return [
    `${quotedTitle} site:${host}`,
    `${quotedTitle} pdf`,
    `${title} ${host} pdf`,
  ];
}

async function scrapeRecoveryCandidate(candidateUrl: URL): Promise<SourceRecoveryScrape | undefined> {
  const firecrawl = new FirecrawlClient({ timeout: SOURCE_DOCUMENT_FALLBACK_TIMEOUT_MS });
  const result = await firecrawl.scrape(candidateUrl.toString(), {
    formats: ["markdown", "html", "links"],
    timeout: SOURCE_DOCUMENT_FALLBACK_TIMEOUT_MS,
  });
  if (result.success) {
    const scrape = {
      markdown: result.data?.markdown,
      html: result.data?.html ?? result.data?.rawHtml,
      links: result.data?.links,
      method: "firecrawl" as const,
    };
    if (isUsableRecoveryScrape(scrape)) {
      return scrape;
    }
    logger.warn("[RFP Document Service] Firecrawl recovery scrape returned unusable source content", {
      candidateUrl: candidateUrl.toString(),
    });
  } else {
    logger.warn("[RFP Document Service] Firecrawl recovery scrape failed", {
      candidateUrl: candidateUrl.toString(),
      error: result.error,
    });
  }

  const browser = await scrapeWithBrowserService(BROWSER_SCRAPER_URL, candidateUrl.toString(), {
    formats: ["markdown", "html", "links"],
    humanScroll: true,
    blockMedia: true,
    timeout: SOURCE_DOCUMENT_FALLBACK_TIMEOUT_MS,
  });
  if (!browser.success) {
    logger.warn("[RFP Document Service] Browser recovery scrape failed", {
      candidateUrl: candidateUrl.toString(),
      browserServiceUrl: BROWSER_SCRAPER_URL,
      error: browser.error,
    });
  } else {
    const scrape = {
      markdown: browser.data?.markdown,
      html: browser.data?.html,
      links: browser.data?.links,
      method: "browser" as const,
    };
    if (!isUsableRecoveryScrape(scrape)) {
      logger.warn("[RFP Document Service] Browser recovery scrape returned unusable source content", {
        candidateUrl: candidateUrl.toString(),
        browserServiceUrl: BROWSER_SCRAPER_URL,
      });
    } else {
      return scrape;
    }
  }

  const cloak = await scrapeWithCloakBrowser(candidateUrl.toString(), {
    humanScroll: true,
    blockMedia: true,
    timeout: SOURCE_DOCUMENT_FALLBACK_TIMEOUT_MS,
  });
  if (!cloak.success) {
    logger.warn("[RFP Document Service] CloakBrowser recovery scrape failed", {
      candidateUrl: candidateUrl.toString(),
      error: cloak.error,
    });
  } else {
    const cloakScrape = {
      markdown: cloak.data?.markdown,
      html: cloak.data?.html,
      links: cloak.data?.links,
      method: "cloakbrowser" as const,
    };
    if (isUsableRecoveryScrape(cloakScrape)) {
      return cloakScrape;
    }
    logger.warn("[RFP Document Service] CloakBrowser recovery scrape returned unusable source content", {
      candidateUrl: candidateUrl.toString(),
    });
  }

  const reader = await scrapeWithReaderFallback(candidateUrl);
  if (!reader.success) {
    logger.warn("[RFP Document Service] Reader recovery scrape failed", {
      candidateUrl: candidateUrl.toString(),
      error: reader.error,
    });
    return undefined;
  }
  const readerScrape = {
    markdown: reader.markdown,
    links: reader.links,
    method: "reader" as const,
  };
  if (!isUsableRecoveryScrape(readerScrape)) {
    logger.warn("[RFP Document Service] Reader recovery scrape returned unusable source content", {
      candidateUrl: candidateUrl.toString(),
    });
    return undefined;
  }
  return readerScrape;
}

async function scrapeWithReaderFallback(candidateUrl: URL): Promise<
  | { success: true; markdown: string; links: string[] }
  | { success: false; error: string }
> {
  const readerUrl = readerFallbackUrl(candidateUrl);
  if (!readerUrl) {
    return { success: false, error: "Reader fallback is disabled" };
  }

  const response = await fetchPublicHttpUrl(readerUrl, {
    headers: {
      "Accept": "text/markdown,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
    },
    timeoutMs: SOURCE_DOCUMENT_FALLBACK_TIMEOUT_MS,
  }, "Reader fallback URL");
  if (!response.ok) {
    return {
      success: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const markdown = cleanExtractedText(await response.text());
  if (isChallengeOrErrorPage(markdown) || markdown.length < 80) {
    return {
      success: false,
      error: "Reader fallback returned no usable page content",
    };
  }

  return {
    success: true,
    markdown,
    links: extractAbsoluteLinksFromText(markdown, candidateUrl),
  };
}

function readerFallbackUrl(candidateUrl: URL): URL | undefined {
  if (process.env.SOURCE_DOCUMENT_READER_FALLBACKS === "0") return undefined;
  const prefix = SOURCE_DOCUMENT_READER_FALLBACK_PREFIX.trim();
  if (!prefix) return undefined;
  const rawUrl = prefix.includes("{url}")
    ? prefix.replace("{url}", candidateUrl.toString())
    : `${prefix}${candidateUrl.toString()}`;
  return safeCandidateUrl(rawUrl, candidateUrl);
}

function extractAbsoluteLinksFromText(text: string, baseUrl: URL): string[] {
  const links = new Set<string>();
  for (const match of text.matchAll(/\((https?:\/\/[^)\s]+)\)|href=["']([^"']+)["']|(https?:\/\/[^\s<>"')]+)/gi)) {
    const url = safeCandidateUrl(match[1] || match[2] || match[3] || "", baseUrl);
    if (url) links.add(url.toString());
  }
  return [...links];
}

function extractDocumentLinksFromScrape(
  scraped: { markdown?: string; html?: string; links?: string[] },
  pageUrl: URL,
  sourceUrl: URL,
  documentName: string
): URL[] {
  const rawLinks = new Set<string>(scraped.links ?? []);
  for (const value of [scraped.markdown, scraped.html]) {
    if (!value) continue;
    for (const match of value.matchAll(/\((https?:\/\/[^)\s]+)\)|href=["']([^"']+)["']/gi)) {
      rawLinks.add(match[1] || match[2]);
    }
  }

  const titleTokens = new Set(tokenizeDocumentTitle(documentTitleForSearch(documentName)));
  return [...rawLinks]
    .map((link) => safeCandidateUrl(link, pageUrl))
    .filter((url): url is URL => Boolean(url))
    .filter((url) => isLikelyDirectDocumentUrl(url))
    .filter((url) => isAllowedRecoveredDocumentLink(url, pageUrl, sourceUrl, titleTokens))
    .sort((a, b) =>
      scoreDocumentLink(b, titleTokens) - scoreDocumentLink(a, titleTokens)
    );
}

function isAllowedRecoveredDocumentLink(
  url: URL,
  pageUrl: URL,
  sourceUrl: URL,
  titleTokens: Set<string>
): boolean {
  if (url.hostname === pageUrl.hostname || url.hostname === sourceUrl.hostname) return true;
  return scoreDocumentLink(url, titleTokens) >= Math.max(6, titleTokens.size * 2);
}

function buildScrapedSourceDocument(
  pageUrl: URL,
  documentName: string,
  scraped: SourceRecoveryScrape
): FetchedSourceDocument | undefined {
  const content = focusScrapedRecoveryContent(scraped.markdown || scraped.html || "", documentName);
  if (
    isChallengeOrErrorPage(content) ||
    !isUsableScrapedSourceContent(content)
  ) {
    return undefined;
  }

  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    `<title>${escapeHtml(documentName)} recovered source page</title>`,
    "</head><body>",
    `<h1>${escapeHtml(documentName)}</h1>`,
    `<p>Recovered from ${escapeHtml(pageUrl.toString())} after the original document binary was unavailable to server-side fetch.</p>`,
    `<pre>${escapeHtml(content)}</pre>`,
    "</body></html>",
  ].join("");
  const buffer = Buffer.from(html, "utf8");
  assertSourceDocumentBufferSize(buffer);

  return {
    buffer,
    mimeType: "text/html",
    effectiveUrl: pageUrl.toString(),
    originalUrl: pageUrl.toString(),
    filename: replaceFileExtension(documentName, ".html"),
    extractionFilename: replaceFileExtension(documentName, ".html"),
    method: sourceDocumentLandingPageMethod(scraped.method),
  };
}

function isIomProcurementDocumentUrl(sourceUrl: URL): boolean {
  const host = sourceUrl.hostname.replace(/^www\./, "").toLowerCase();
  return host === "iom.int"
    && /\/files\/procurement\//i.test(sourceUrl.pathname)
    && isLikelyDirectDocumentUrl(sourceUrl);
}

function focusScrapedRecoveryContent(content: string, documentName: string): string {
  const lines = content.split(/\n+/).map((line) => cleanExtractedText(line)).filter(Boolean);
  const cleanedContent = cleanExtractedText(content);

  const title = documentTitleForSearch(documentName).toLowerCase();
  const tokens = tokenizeDocumentTitle(title);
  const strongTokens = tokens.filter((token) =>
    token.length >= 5 || /^\d{5,}$/.test(token) || /^(rfp|itb|eoi|rfq)$/.test(token)
  );
  const matchingIndexes = lines
    .map((line, index) => ({ line: line.toLowerCase(), index }))
    .filter(({ line }) =>
      (title.length >= 8 && line.includes(title)) ||
      strongTokens.some((token) => line.includes(token))
    )
    .map(({ index }) => index);

  if (matchingIndexes.length === 0) return cleanedContent;

  const selected = new Set<number>();
  for (const index of matchingIndexes) {
    for (let cursor = Math.max(0, index - 1); cursor <= Math.min(lines.length - 1, index + 12); cursor++) {
      selected.add(cursor);
    }
  }

  const focused = [...selected].sort((a, b) => a - b).map((index) => lines[index]).join("\n");
  if (isUsableScrapedSourceContent(focused)) {
    return focused;
  }
  return cleanedContent;
}

function browserLikeDocumentHeaders(url: URL): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/pdf,application/octet-stream,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": `${url.origin}/`,
  };
}

function shouldTrySourceRecovery(status: number | undefined, error?: string): boolean {
  if (status === 401 || status === 403 || status === 404 || status === 429 || status === 503) {
    return true;
  }
  return status === 200 && error?.startsWith("Unexpected HTML response while fetching document URL") === true;
}

function sourceDocumentLinkMethod(method: SourceRecoveryScrape["method"]): SourceDocumentFetchMethod {
  if (method === "browser") return "browser_link";
  if (method === "cloakbrowser") return "cloakbrowser_link";
  if (method === "reader") return "reader_link";
  return "firecrawl_link";
}

function sourceDocumentLandingPageMethod(method: SourceRecoveryScrape["method"]): SourceDocumentFetchMethod {
  if (method === "browser") return "browser_landing_page_html";
  if (method === "cloakbrowser") return "cloakbrowser_landing_page_html";
  if (method === "reader") return "reader_landing_page_html";
  return "firecrawl_landing_page_html";
}

function scoreRecoveryCandidate(
  candidate: { url: string; title?: string; content?: string },
  sourceUrl: URL,
  documentName: string
): number {
  const haystack = `${candidate.url} ${candidate.title ?? ""} ${candidate.content ?? ""}`.toLowerCase();
  const candidateUrl = safeCandidateUrl(candidate.url, sourceUrl);
  let score = 0;
  if (candidate.url.includes(sourceUrl.hostname)) score += 20;
  if (candidateUrl && isLikelyDirectDocumentUrl(candidateUrl)) score += 10;
  for (const token of tokenizeDocumentTitle(documentTitleForSearch(documentName))) {
    if (haystack.includes(token)) score += 2;
  }
  if (/\b(tender|procurement|rfp|bid|calendar)\b/.test(haystack)) score += 6;
  return score;
}

function scoreDocumentLink(url: URL, titleTokens: Set<string>): number {
  const value = decodeURIComponent(url.pathname).toLowerCase();
  let score = 0;
  for (const token of titleTokens) {
    if (value.includes(token)) score += 3;
  }
  if (/\.(pdf|docx?|html?)$/i.test(url.pathname)) score += 5;
  return score;
}

function safeCandidateUrl(rawUrl: string, baseUrl: URL): URL | undefined {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isLikelyDirectDocumentUrl(url: URL): boolean {
  return /\.(pdf|docx?|xlsx?|zip|html?)$/i.test(url.pathname);
}

function isLikelyHtmlDocumentUrl(url: URL): boolean {
  return /\.html?$/i.test(url.pathname);
}

function isHtmlMimeType(mimeType: string): boolean {
  return /^text\/html\b/i.test(mimeType) || /\bhtml\b/i.test(mimeType);
}

function looksLikeHtml(buffer: Buffer): boolean {
  const prefix = buffer.toString("utf8", 0, Math.min(buffer.length, 512)).trimStart();
  return /^<!doctype html\b/i.test(prefix) || /^<html[\s>]/i.test(prefix);
}

function isUsableHtmlExtractedText(text: string): boolean {
  return (
    text.length >= MIN_HTML_EXTRACTED_TEXT_LENGTH &&
    countExtractedWords(text) >= MIN_HTML_EXTRACTED_WORD_COUNT &&
    HTML_RFP_TEXT_SIGNAL.test(text)
  );
}

function isUsableScrapedSourceContent(text: string): boolean {
  return (
    text.length >= 250 &&
    countExtractedWords(text) >= 25 &&
    HTML_RFP_TEXT_SIGNAL.test(text)
  );
}

function countExtractedWords(text: string): number {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0;
}

function isUsableExtractedTextForFilename(filename: string, text: string): boolean {
  const extension = extname(filename).toLowerCase();
  if (extension === ".html" || extension === ".htm") {
    return isUsableHtmlExtractedText(text);
  }
  return text.length >= MIN_EXTRACTED_TEXT_LENGTH;
}

function isUsableRecoveryScrape(scraped: { markdown?: string; html?: string; links?: string[] }): boolean {
  const content = cleanExtractedText(scraped.markdown || scraped.html || "");
  if (isChallengeOrErrorPage(content)) return false;
  if ((scraped.links?.length ?? 0) > 0) return true;
  return content.length >= 80;
}

function isChallengeOrErrorPage(content: string): boolean {
  const value = content.toLowerCase();
  return (
    value.includes("just a moment") ||
    value.includes("checking your browser") ||
    value.includes("challenge-platform") ||
    value.includes("cloudflare") ||
    value.includes("page not found") ||
    value.includes("access denied") ||
    value.includes("forbidden")
  );
}

function documentTitleForSearch(documentName: string): string {
  return basename(documentName)
    .replace(/\.[^.]+$/, "")
    .replace(/([a-z]{5,})and([a-z]{5,})/gi, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeDocumentTitle(value: string): string[] {
  return value.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) =>
      token.length >= 4 ||
      /^(rfp|rfq|eoi|itb)$/.test(token)
    );
}

function slugifyDocumentTitleVariants(value: string): string[] {
  const fullTokens = value.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 || /^q[1-4]$/.test(token) || /^[1-4]q$/.test(token));
  const variants: string[][] = [];

  const withoutTrailingYears = [...fullTokens];
  while (withoutTrailingYears.length > 1 && /^20\d{2}$/.test(withoutTrailingYears[withoutTrailingYears.length - 1])) {
    withoutTrailingYears.pop();
  }
  const withoutTrailingYearsAndQuarter = [...withoutTrailingYears];
  if (/^(q[1-4]|[1-4]q)$/.test(withoutTrailingYearsAndQuarter[withoutTrailingYearsAndQuarter.length - 1] ?? "")) {
    withoutTrailingYearsAndQuarter.pop();
  }
  variants.push(withoutTrailingYears, withoutTrailingYearsAndQuarter, fullTokens);

  if (withoutTrailingYears[0] === "unicef") {
    variants.push(withoutTrailingYears.slice(1));
  }
  if (withoutTrailingYearsAndQuarter[0] === "unicef") {
    variants.push(withoutTrailingYearsAndQuarter.slice(1));
  }
  if (fullTokens[0] === "unicef") {
    variants.push(fullTokens.slice(1));
  }

  const seen = new Set<string>();
  return variants
    .map((tokens) => tokens.join("-"))
    .filter((slug) => {
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
}

function replaceFileExtension(filename: string, extension: string): string {
  const current = extname(filename);
  if (!current) return `${filename}${extension}`;
  return `${filename.slice(0, -current.length)}${extension}`;
}

function filenameForExtraction(filename: string, mimeType: string | null | undefined): string {
  if (mimeType && isHtmlMimeType(mimeType)) return replaceFileExtension(filename, ".html");
  return filename;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assertSourceDocumentBufferSize(buffer: Buffer): void {
  if (buffer.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE_MB}MB)`);
  }
}

async function prepareFetchedDocumentForIntake(
  fetched: FetchedSourceDocument
): Promise<FetchedSourceDocument> {
  if (!isZipArchive(fetched.filename, fetched.mimeType, fetched.effectiveUrl)) {
    return fetched;
  }

  const extracted = await extractBestSupportedDocumentFromZip(fetched);
  return extracted ?? fetched;
}

async function extractFetchedDocumentText(
  fetched: FetchedSourceDocument
): Promise<ExtractedDocumentText | undefined> {
  if (!isSupportedFileType(fetched.extractionFilename)) return undefined;
  return extractSupportedDocumentText(fetched.buffer, fetched.extractionFilename);
}

function isFetchedHtmlDocument(fetched: FetchedSourceDocument): boolean {
  const extension = extname(fetched.extractionFilename).toLowerCase();
  return extension === ".html" || extension === ".htm" || isHtmlMimeType(fetched.mimeType);
}

function shouldRecoverUnusableFetchedHtmlDocument(fetched: FetchedSourceDocument): boolean {
  const html = fetched.buffer.toString("utf8", 0, Math.min(fetched.buffer.length, 20_000));
  const text = cleanExtractedText(
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
  if (isChallengeOrErrorPage(text)) return true;
  if (fetched.method !== "direct" && fetched.method !== "searxng_direct") return false;

  const lower = html.toLowerCase();
  const hasClientAppRoot =
    /\bid=["']__(next|nuxt)["']/i.test(html) ||
    /\bid=["'](root|app)["']/i.test(html) ||
    lower.includes("window.__next_data__");
  return hasClientAppRoot && text.length < 180 && countExtractedWords(text) < 25;
}

async function recoverUnusableFetchedHtmlDocument(
  fetched: FetchedSourceDocument,
  documentName: string
): Promise<FetchedSourceDocument | undefined> {
  let pageUrl: URL;
  try {
    pageUrl = new URL(fetched.effectiveUrl);
  } catch {
    return undefined;
  }

  logger.warn("[RFP Document Service] Direct HTML source had no usable RFP text; trying scrape recovery", {
    sourceUrl: pageUrl.toString(),
    documentName,
    downloadMethod: fetched.method,
  });

  const scraped = await scrapeRecoveryCandidate(pageUrl);
  if (!scraped) return undefined;
  return buildScrapedSourceDocument(pageUrl, documentName, scraped);
}

function isZipArchive(filename: string, mimeType: string, url: string): boolean {
  return extname(filename).toLowerCase() === ".zip" ||
    extname(new URL(url).pathname).toLowerCase() === ".zip" ||
    /\bzip\b/i.test(mimeType);
}

async function extractBestSupportedDocumentFromZip(
  fetched: FetchedSourceDocument
): Promise<FetchedSourceDocument | undefined> {
  try {
    const JSZip = (await import("jszip")).default;
    const archive = await JSZip.loadAsync(fetched.buffer);
    const entries = Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .filter((entry) => isSupportedZipMember(entry.name))
      .sort((a, b) => scoreZipMember(b.name) - scoreZipMember(a.name));
    const selected = entries[0];
    if (!selected) return undefined;

    const buffer = await selected.async("nodebuffer");
    assertSourceDocumentBufferSize(buffer);
    const filename = sanitizeFilename(basename(selected.name));
    return {
      ...fetched,
      buffer,
      mimeType: mimeTypeForFilename(filename) ?? "application/octet-stream",
      filename,
      extractionFilename: filename,
    };
  } catch (error) {
    logger.warn("[RFP Document Service] Failed to extract supported file from ZIP package", {
      sourceUrl: fetched.effectiveUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function isSupportedZipMember(name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("__MACOSX/")) return false;
  if (basename(normalized).startsWith(".")) return false;
  const extension = extname(normalized).toLowerCase();
  return [".pdf", ".docx", ".doc", ".html", ".htm", ".xlsx", ".xls"].includes(extension);
}

function scoreZipMember(name: string): number {
  const lower = name.toLowerCase();
  const extension = extname(lower);
  let score = 0;
  if (extension === ".pdf") score += 50;
  else if (extension === ".docx" || extension === ".doc") score += 45;
  else if (extension === ".html" || extension === ".htm") score += 35;
  else if (extension === ".xlsx" || extension === ".xls") score += 25;
  if (/\b(rfp|request-for-proposal|tender|bid|bidding|reoi|eoi|tor|terms-of-reference)\b/i.test(lower)) score += 30;
  if (/\b(addendum|corrigendum|amendment)\b/i.test(lower)) score -= 10;
  return score;
}

function mimeTypeForFilename(filename: string): string | undefined {
  switch (extname(filename).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".doc":
      return "application/msword";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".html":
    case ".htm":
      return "text/html";
    default:
      return undefined;
  }
}

async function extractSupportedDocumentText(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDocumentText | undefined> {
  if (!isSupportedFileType(filename)) {
    logger.debug(`[RFP Document Service] File type not supported for extraction: ${filename}`);
    return undefined;
  }

  const extension = extname(filename).toLowerCase();
  if (extension === ".pdf") {
    let localPdf: ExtractedDocumentText | undefined;
    try {
      localPdf = await extractPdfTextWithPdftotext(buffer, filename, {
        minLength: MIN_EXTRACTED_TEXT_LENGTH,
        timeoutMs: PDFTOTEXT_TIMEOUT_MS,
      });
    } catch (error) {
      logger.warn(`[RFP Document Service] pdftotext failed for ${filename}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (localPdf) {
      logger.debug(`[RFP Document Service] Used ${localPdf.extractor} for ${filename}`, {
        extractedTextLength: localPdf.text.length,
      });
      return localPdf;
    }
    logger.warn(`[RFP Document Service] pdftotext could not extract usable text from ${filename}; trying DocLing`);
  }

  if (extension === ".html" || extension === ".htm") {
    const localHtml = await extractDocumentTextLocally(buffer, filename);
    if (localHtml) {
      logger.debug(`[RFP Document Service] Used ${localHtml.extractor} for ${filename}`, {
        extractedTextLength: localHtml.text.length,
      });
      return localHtml;
    }
    logger.warn(`[RFP Document Service] Local HTML extraction could not extract usable text from ${filename}; trying DocLing`);
  }

  if (extension === ".docx" || extension === ".xlsx") {
    const localOfficeText = await extractDocumentTextLocally(buffer, filename);
    if (localOfficeText) {
      logger.debug(`[RFP Document Service] Used ${localOfficeText.extractor} for ${filename}`, {
        extractedTextLength: localOfficeText.text.length,
        pageCount: localOfficeText.pageCount,
      });
      return localOfficeText;
    }
    logger.warn(`[RFP Document Service] Local Office extraction could not extract usable text from ${filename}; trying DocLing`);
  }

  try {
    logger.debug(`[DocLing] Processing document: ${filename}`);
    const processed = await processRfpDocument(buffer, filename);
    const text = cleanExtractedText(processed.text);
    if (isUsableExtractedTextForFilename(filename, text)) {
      logger.debug(`[DocLing] Extracted ${processed.pageCount} pages, ${text.length} characters`);
      return {
        text,
        pageCount: processed.pageCount,
        extractor: "docling",
      };
    }
    logger.warn(`[DocLing] Extracted too little text from ${filename}; trying local fallback`, {
      extractedTextLength: text.length,
    });
  } catch (error) {
    logger.error(`[DocLing] Failed to process document:`, error);
  }

  const local = await extractDocumentTextLocally(buffer, filename);
  if (local) {
    logger.warn(`[RFP Document Service] Used ${local.extractor} fallback for ${filename}`, {
      extractedTextLength: local.text.length,
      pageCount: local.pageCount,
    });
  }
  return local;
}

async function extractDocumentTextLocally(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDocumentText | undefined> {
  const extension = extname(filename).toLowerCase();
  try {
    if (extension === ".pdf") {
      return await extractPdfTextWithPdfParse(buffer, {
        minLength: MIN_EXTRACTED_TEXT_LENGTH,
      });
    }

    if (extension === ".docx") {
      const mammoth = await import("mammoth");
      const extractRawText = mammoth.extractRawText ?? mammoth.default?.extractRawText;
      if (!extractRawText) return undefined;
      const result = await extractRawText({ buffer });
      const text = cleanExtractedText(result.value ?? "");
      if (text.length < MIN_EXTRACTED_TEXT_LENGTH) return undefined;
      return { text, extractor: "local_docx_parse" };
    }

    if (extension === ".doc") {
      const text = cleanExtractedText(
        extractReadableTextFromBinaryDocument(buffer, {
          minimumLength: 100,
          requireProcurementSignal: true,
        })
      );
      if (text.length < MIN_EXTRACTED_TEXT_LENGTH) return undefined;
      return { text, extractor: "local_doc_binary_text" };
    }

    if (extension === ".html" || extension === ".htm") {
      const text = cleanExtractedText(
        buffer.toString("utf8")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, "\"")
      );
      if (!isUsableHtmlExtractedText(text)) return undefined;
      return { text, extractor: "local_html_text" };
    }

    if (extension === ".xlsx") {
      const text = cleanExtractedText(await extractXlsxText(buffer));
      if (text.length < MIN_EXTRACTED_TEXT_LENGTH) return undefined;
      return { text, extractor: "local_xlsx_parse" };
    }
  } catch (error) {
    logger.error(`[RFP Document Service] Local text extraction failed for ${filename}:`, error);
  }

  return undefined;
}

function cleanExtractedText(value: string | undefined | null): string {
  return cleanTextForUtf8Storage(value);
}

async function storeFetchedRfpDocument(params: {
  documentId: string;
  opportunityId: string;
  filename: string;
  sourceUrl: string;
  buffer: Buffer;
  mimeType: string;
  userId?: string;
}): Promise<StoredFetchedRfpDocument> {
  const sha256 = createHash("sha256").update(params.buffer).digest("hex");
  const objectStoreConfig = getLinodeE3ConfigFromEnv();
  if (objectStoreConfig) {
    const objectKey = buildRfpObjectKey({
      documentId: params.documentId,
      filename: params.filename || extractDocumentName(params.sourceUrl, ""),
      opportunityId: params.opportunityId,
      prefix: objectStoreConfig.prefix,
    });
    const upload = await uploadToLinodeE3(objectStoreConfig, {
      key: objectKey,
      body: params.buffer,
      contentType: params.mimeType || "application/octet-stream",
      contentLength: params.buffer.length,
      metadata: {
        "document-id": params.documentId,
        "opportunity-id": params.opportunityId,
        "source-url-sha256": createHash("sha256").update(params.sourceUrl).digest("hex"),
        "downloaded-by": params.userId || "system",
      },
    });

    return {
      storagePath: upload.storagePath,
      receipt: buildLinodeStorageReceipt(upload, params, sha256),
    };
  }

  const opportunityDir = join(DOCUMENT_STORAGE_PATH, params.opportunityId);
  const fileExt = extname(params.filename) || extname(new URL(params.sourceUrl).pathname) || ".bin";
  const safeName = `${params.documentId}${fileExt}`;
  const localPath = join(opportunityDir, safeName);

  await mkdir(opportunityDir, { recursive: true });
  await writeFile(localPath, params.buffer);

  return {
    storagePath: localPath,
    receipt: {
      provider: "local",
      storagePath: localPath,
      sha256,
      byteLength: params.buffer.length,
      contentType: params.mimeType || "application/octet-stream",
    },
  };
}

function buildLinodeStorageReceipt(
  upload: LinodeE3UploadResult,
  params: {
    buffer: Buffer;
    mimeType: string;
  },
  sha256: string
): RfpStorageReceipt {
  return {
    provider: "linode_e3",
    storagePath: upload.storagePath,
    bucket: upload.bucket,
    key: upload.key,
    endpoint: upload.endpoint,
    etag: upload.etag,
    sha256,
    byteLength: params.buffer.length,
    contentType: params.mimeType || "application/octet-stream",
  };
}

async function readDocumentBuffer(storagePath: string, expectedSha256?: string): Promise<Buffer> {
  let buffer: Buffer;
  if (storagePath.startsWith("s3://")) {
    const objectStoreConfig = getLinodeE3ConfigFromEnv();
    if (!objectStoreConfig) {
      throw new Error("Linode E3 storage is not configured");
    }
    const object = await downloadFromLinodeE3(objectStoreConfig, storagePath);
    buffer = object.body;
  } else {
    await access(storagePath);
    buffer = await readFile(storagePath);
  }

  if (expectedSha256) {
    const actualSha256 = createHash("sha256").update(buffer).digest("hex");
    if (actualSha256 !== expectedSha256) {
      throw new OpportunityDocumentIntegrityError();
    }
  }
  return buffer;
}

async function queueRfpParsingFromDownloadedDocument(params: {
  document: typeof opportunityDocuments.$inferSelect;
  storagePath: string;
  storageReceipt: RfpStorageReceipt;
  provenance: RfpIngestProvenance;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  extractedText?: string;
  pageCount?: number;
  userId: string;
  parseMode: DownloadParseMode;
  parserFilename: string;
}): Promise<QueuedRfpParsing> {
  const fileType = inferRfpParserFileType(params.parserFilename, params.mimeType);
  if (!fileType) {
    await recordOpportunityDocumentIngestWorkflow({
      document: params.document,
      userId: params.userId,
      toState: "stored_unparseable",
      reason: "Downloaded document was stored, but its file type is not supported by the RFP parser.",
      priority: "medium",
      storageReceipt: params.storageReceipt,
    });
    return { parsingStatus: "not_queued" };
  }
  if ((fileType === "xlsx" || fileType === "xls" || fileType === "html") && !params.extractedText?.trim()) {
    const fileKind = fileType === "html" ? "HTML document" : "spreadsheet";
    await recordOpportunityDocumentIngestWorkflow({
      document: params.document,
      userId: params.userId,
      toState: "stored_unparseable",
      reason: `Downloaded ${fileKind} was stored, but no extracted text was available for the RFP parser.`,
      priority: "medium",
      storageReceipt: params.storageReceipt,
    });
    return { parsingStatus: "not_queued" };
  }

  try {
    const userWorkspace = await db.query.userWorkspaces.findFirst({
      where: and(
        eq(userWorkspaces.userId, params.userId),
        eq(userWorkspaces.isDefault, true),
      ),
    });
    const organizationId = userWorkspace?.organizationId
      ?? (params.userId === "system" ? params.document.organizationId : undefined);
    if (!organizationId) {
      logger.warn("[RFP Document Service] Aborting parse queue — user has no default workspace", { userId: params.userId });
      await recordOpportunityDocumentIngestWorkflow({
        document: params.document,
        userId: params.userId,
        toState: "parse_queue_failed",
        reason: "Downloaded document could not be queued because the user has no default workspace.",
        priority: "high",
        storageReceipt: params.storageReceipt,
      });
      return { parsingStatus: "failed", parsingError: "Downloaded document could not be queued because the user has no default workspace." };
    }

    const existing = await db.query.rfpDocuments.findFirst({
      where: and(
        eq(rfpDocuments.fileHash, params.fileHash),
        eq(rfpDocuments.organizationId, organizationId),
      ),
    });

    if (existing) {
      await recordOpportunityDocumentIngestWorkflow({
        document: params.document,
        userId: params.userId,
        toState: "duplicate_linked",
        reason: `Downloaded document matched existing RFP ${existing.id}.`,
        priority: "low",
        storageReceipt: params.storageReceipt,
        rfpDocumentId: existing.id,
      });
      return { duplicateOfRfpDocumentId: existing.id, parsingStatus: "duplicate" };
    }

    const [rfpDocument] = await db.insert(rfpDocuments).values({
      organizationId,
      opportunityId: params.document.opportunityId,
      filename: params.parserFilename,
      fileType,
      fileSize: params.fileSize,
      storagePath: params.storagePath,
      fileHash: params.fileHash,
      parsingStatus: "pending",
      parsingProgress: 0,
      extractedText: params.extractedText,
      pageCount: params.pageCount,
      uploadedBy: params.userId,
      metadata: {
        source: params.provenance.source,
        sourceOpportunityDocumentId: params.provenance.sourceOpportunityDocumentId,
        sourceUrl: params.provenance.sourceUrl,
        originalSourceUrl: params.provenance.originalSourceUrl,
        downloadMethod: params.provenance.downloadMethod,
        ingestWorkflow: {
          state: "queued_for_parse",
          source: params.provenance.source,
          sourceOpportunityDocumentId: params.provenance.sourceOpportunityDocumentId,
          originalSourceUrl: params.provenance.originalSourceUrl,
          downloadMethod: params.provenance.downloadMethod,
          downloadedBy: params.provenance.downloadedBy,
          downloadedAt: params.provenance.downloadedAt,
        },
        storage: params.storageReceipt,
        parserPolicy: {
          parser: "next_rfp_parser",
          confidenceGateThreshold: getParseConfidenceGateThreshold(),
          queuedAt: new Date().toISOString(),
        },
      },
    }).returning();

    const [parsingJob] = await db.insert(rfpParsingJobs).values({
      rfpDocumentId: rfpDocument.id,
      organizationId,
      status: "queued",
      currentStep: "Queued from discovered RFP download",
      progress: 0,
      initiatedBy: params.userId,
      parsingOptions: {
        extractRequirements: true,
        generateEmbeddings: true,
        detectSections: true,
        classifyRequirements: true,
      },
      metadata: {
        sourceOpportunityDocumentId: params.document.id,
        storagePath: params.storagePath,
        parser: "next_rfp_parser",
      },
    }).returning();

    await recordOpportunityDocumentIngestWorkflow({
      document: params.document,
      userId: params.userId,
      toState: "queued_for_parse",
      reason: "Discovered RFP document was fetched server-side, stored, linked to an RFP record, and queued for parsing.",
      priority: "high",
      storageReceipt: params.storageReceipt,
      rfpDocumentId: rfpDocument.id,
      parsingJobId: parsingJob.id,
    });

    if (params.parseMode === "queued") {
      return {
        rfpDocumentId: rfpDocument.id,
        parsingJobId: parsingJob.id,
        parsingStatus: "queued",
      };
    }

    const parseJob = processRfpParsingJob({
      jobId: parsingJob.id,
      rfpDocumentId: rfpDocument.id,
      tenantContext: {
        userId: params.userId,
        organizationId: rfpDocument.organizationId,
      },
    });
    if (params.parseMode === "inline") {
      try {
        const parseResult = await parseJob;
        if (parseResult?.status === "failed") {
          return {
            rfpDocumentId: rfpDocument.id,
            parsingJobId: parsingJob.id,
            parsingStatus: "failed",
            parsingError: parseResult.error ?? "RFP parser marked the job failed",
          };
        }
        return {
          rfpDocumentId: rfpDocument.id,
          parsingJobId: parsingJob.id,
          parsingStatus: "completed",
        };
      } catch (error) {
        const parsingError = error instanceof Error ? error.message : String(error);
        logger.error("[RFP Document Service] Inline parse failed:", error);
        return {
          rfpDocumentId: rfpDocument.id,
          parsingJobId: parsingJob.id,
          parsingStatus: "failed",
          parsingError,
        };
      }
    }

    parseJob.catch((error) => {
      logger.error("[RFP Document Service] Background parse failed:", error);
    });

    return {
      rfpDocumentId: rfpDocument.id,
      parsingJobId: parsingJob.id,
      parsingStatus: "queued",
    };
  } catch (error) {
    logger.warn("[RFP Document Service] Failed to queue downloaded document for parsing:", error);
    await recordOpportunityDocumentIngestWorkflow({
      document: params.document,
      userId: params.userId,
      toState: "parse_queue_failed",
      reason: error instanceof Error ? error.message : "Failed to queue parser",
      priority: "high",
      storageReceipt: params.storageReceipt,
    }).catch((workflowError) => {
      logger.warn("[RFP Document Service] Failed to persist parse queue failure workflow:", workflowError);
    });
    return {
      parsingStatus: "failed",
      parsingError: error instanceof Error ? error.message : "Failed to queue parser",
    };
  }
}

async function recordOpportunityDocumentIngestWorkflow(params: {
  document: typeof opportunityDocuments.$inferSelect;
  userId: string;
  toState:
    | "download_failed"
    | "stored_unparseable"
    | "duplicate_linked"
    | "queued_for_parse"
    | "parse_queue_failed";
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  storageReceipt?: RfpStorageReceipt;
  rfpDocumentId?: string;
  parsingJobId?: string;
}): Promise<void> {
  const dueAt = ["download_failed", "parse_queue_failed"].includes(params.toState)
    ? new Date(Date.now() + 12 * 60 * 60 * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const instance = await recordWorkflowRuntimeTransition({
    workflowKey: "discovery_rfp_ingest",
    subjectType: "opportunity_document",
    subjectId: params.document.id,
    opportunityId: params.document.opportunityId,
    fromState: params.document.status,
    toState: params.toState,
    eventType: `rfp_ingest_${params.toState}`,
    actorId: params.userId,
    reason: params.reason,
    priority: params.priority,
    assignedTo: ["download_failed", "parse_queue_failed", "stored_unparseable"].includes(params.toState)
      ? params.userId
      : null,
    assignedRole: "proposal_manager",
    assignedBy: params.userId,
    dueAt,
    visibility: "internal",
    authorityPolicy: {
      requiredRoles: ["proposal_manager", "capture_manager"],
      escalationRole: "operations",
    },
    metadata: {
      documentName: params.document.documentName,
      documentType: params.document.documentType,
      sourceUrl: params.document.sourceUrl,
      storageReceipt: params.storageReceipt,
      rfpDocumentId: params.rfpDocumentId,
      parsingJobId: params.parsingJobId,
    },
    terminal: params.toState === "duplicate_linked",
    actionUrl: `/opportunities/${params.document.opportunityId}`,
    notificationRecipients: ["download_failed", "parse_queue_failed", "stored_unparseable"].includes(params.toState)
      ? [params.userId]
      : [],
  });

  if (["download_failed", "parse_queue_failed", "stored_unparseable"].includes(params.toState)) {
    await upsertWorkflowRuntimeTask({
      workflowInstanceId: instance.id,
      taskKey: `rfp-ingest-remediation:${params.document.id}`,
      title: `Remediate RFP intake for ${params.document.documentName}`,
      description: params.reason,
      state: "open",
      priority: params.priority,
      assignedTo: params.userId,
      assignedRole: "proposal_manager",
      dueAt,
      metadata: {
        opportunityDocumentId: params.document.id,
        sourceUrl: params.document.sourceUrl,
        rfpDocumentId: params.rfpDocumentId,
        parsingJobId: params.parsingJobId,
      },
    });
  }
}

function getParseConfidenceGateThreshold(): number {
  const raw = process.env.RFP_PARSE_CONFIDENCE_GATE;
  if (!raw) return 80;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 80;
}

function inferRfpParserFileType(
  filename: string,
  mimeType?: string | null
): "pdf" | "docx" | "doc" | "html" | "xlsx" | "xls" | null {
  const extension = extname(filename).toLowerCase();
  if (mimeType === "text/html") return "html";
  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if (
    extension === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (extension === ".doc" || mimeType === "application/msword") return "doc";
  if (
    extension === ".xlsx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (extension === ".xls" || mimeType === "application/vnd.ms-excel") return "xls";
  if (extension === ".html" || extension === ".htm" || mimeType === "text/html") return "html";
  return null;
}
