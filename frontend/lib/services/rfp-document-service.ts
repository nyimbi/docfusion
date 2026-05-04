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
import { opportunityDocuments, opportunities, type NewOpportunityDocument } from "@/lib/db/schema";
import { rfpDocuments, rfpParsingJobs } from "@/lib/db/schema-rfp";
import { eq, and } from "drizzle-orm";
import { mkdir, writeFile, readFile, access, unlink } from "fs/promises";
import { join, basename, extname } from "path";
import { createHash } from "crypto";
import { processRfpDocument, isSupportedFileType } from "@/lib/services/docling-client";
import { processRfpParsingJob } from "@/lib/actions/rfp-parser";
import {
  buildRfpObjectKey,
  downloadFromLinodeE3,
  getLinodeE3ConfigFromEnv,
  uploadToLinodeE3,
} from "@/lib/storage/linode-e3";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Configuration
// ============================================================================

const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/rfp-documents";
const MAX_FILE_SIZE_MB = 100; // Maximum file size to download
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".zip", ".rar"];

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
  localPath?: string;
  storagePath?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

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
    const firecrawl = new FirecrawlClient();

    // First, try LLM-based extraction for best results
    const scrapeResult = await firecrawl.scrape(sourceUrl, {
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
      const extractedDocs = scrapeResult.data.extract.documents as Array<{
        name: string;
        url: string;
        type: string;
        description?: string;
      }>;
      
      documents = extractedDocs
        .map((doc) => ({
          ...doc,
          url: resolveUrl(doc.url, sourceUrl),
        }))
        .filter((doc) => isValidDocumentUrl(doc.url))
        .map((doc) => ({
          name: sanitizeFilename(doc.name),
          url: doc.url,
          type: validateDocumentType(doc.type),
          description: doc.description,
        }));
    }

    // Fallback: Parse links from markdown if LLM extraction didn't find anything
    if (documents.length === 0 && scrapeResult.data?.markdown) {
      const linkDocs = extractDocumentsFromLinks(
        scrapeResult.data.markdown,
        scrapeResult.data.links || [],
        sourceUrl
      );
      documents = linkDocs;
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
      /\.(pdf|docx?|xlsx?|zip|rar)(\?|$)/i,
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

  // Check URL patterns
  if (urlLower.includes("amendment") || urlLower.includes("corrigendum")) {
    return "amendment";
  }
  if (urlLower.includes("specification") || urlLower.includes("technical")) {
    return "specification";
  }
  if (urlLower.includes("evaluation") || urlLower.includes("criteria")) {
    return "evaluation";
  }
  if (urlLower.includes("form") || urlLower.includes("template")) {
    return "form";
  }
  if (urlLower.includes("rfp") || urlLower.includes("tender") || urlLower.includes("bid")) {
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

  for (const doc of documents) {
    try {
      // Check if document already exists
      const existing = await db.query.opportunityDocuments.findFirst({
        where: and(
          eq(opportunityDocuments.opportunityId, opportunityId),
          eq(opportunityDocuments.sourceUrl, doc.url)
        ),
      });

      if (existing) {
        // Document already exists, skip
        continue;
      }

      // Insert new document
      await db.insert(opportunityDocuments).values({
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
export async function getOpportunityDocuments(opportunityId: string) {
  return db.query.opportunityDocuments.findMany({
    where: eq(opportunityDocuments.opportunityId, opportunityId),
    orderBy: (docs, { desc }) => [desc(docs.discoveredAt)],
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
  userId?: string
): Promise<DownloadResult> {
  try {
    // Get document from database
    const doc = await db.query.opportunityDocuments.findFirst({
      where: eq(opportunityDocuments.id, documentId),
    });

    if (!doc) {
      return { success: false, error: "Document not found" };
    }

    if (!doc.sourceUrl) {
      return { success: false, error: "No source URL available" };
    }

    // Update status to downloading
    await db.update(opportunityDocuments)
      .set({ 
        status: "downloading",
        downloadAttempts: doc.downloadAttempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    // Download the file
    const response = await fetch(doc.sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    // Check file size
    if (fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`File too large: ${(fileSize / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE_MB}MB)`);
    }

    // Get mime type
    const mimeType = response.headers.get("content-type") || "application/octet-stream";

    // Read file data
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate hash
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // Store the fetched binary server-side. Linode E3 has no browser CORS,
    // so fetched RFPs are uploaded from this server process when configured.
    const localPath = await storeFetchedRfpDocument({
      documentId: doc.id,
      opportunityId: doc.opportunityId,
      filename: doc.documentName,
      sourceUrl: doc.sourceUrl,
      buffer,
      mimeType,
      userId,
    });

    // Process document with DocLing for text extraction
    let extractedText: string | undefined;
    let pageCount: number | undefined;
    
    if (isSupportedFileType(doc.documentName)) {
      try {
        logger.debug(`[DocLing] Processing document: ${doc.documentName}`);
        const processed = await processRfpDocument(buffer, doc.documentName);
        extractedText = processed.text;
        pageCount = processed.pageCount;
        logger.debug(`[DocLing] Extracted ${pageCount} pages, ${extractedText?.length || 0} characters`);
      } catch (error) {
        logger.error(`[DocLing] Failed to process document:`, error);
        // Continue without extraction - document is still downloaded
      }
    }

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
        extractedText,
        pageCount,
        extractedAt: extractedText ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    // Update opportunity download count
    await updateOpportunityDownloadCount(doc.opportunityId);

    await queueRfpParsingFromDownloadedDocument({
      document: doc,
      storagePath: localPath,
      fileSize: buffer.length,
      mimeType,
      fileHash,
      extractedText,
      pageCount,
      userId: userId || "system",
    });

    return {
      success: true,
      documentId,
      localPath,
      storagePath: localPath,
      fileSize: buffer.length,
      mimeType,
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

    return {
      success: false,
      documentId,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
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
  const downloadedCount = await db.$count(
    opportunityDocuments,
    and(
      eq(opportunityDocuments.opportunityId, opportunityId),
      eq(opportunityDocuments.status, "downloaded")
    )
  );

  await db.update(opportunities)
    .set({ documentsDownloadedCount: downloadedCount })
    .where(eq(opportunities.id, opportunityId));
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
    const buffer = await readDocumentBuffer(doc.localPath);
    
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
		const buffer = await readDocumentBuffer(row.document.localPath);
		return {
			buffer,
			mimeType: row.document.mimeType || "application/octet-stream",
			filename: row.document.documentName,
		};
	} catch {
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
    const buffer = await readDocumentBuffer(doc.localPath);
    
    if (!isSupportedFileType(doc.documentName)) {
      logger.debug(`[DocLing] File type not supported for extraction: ${doc.documentName}`);
      return null;
    }

    logger.debug(`[DocLing] Extracting text from: ${doc.documentName}`);
    const processed = await processRfpDocument(buffer, doc.documentName);
    
    // Update database with extracted text
    await db.update(opportunityDocuments)
      .set({
        extractedText: processed.text,
        pageCount: processed.pageCount,
        extractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(opportunityDocuments.id, documentId));

    logger.debug(`[DocLing] Extracted ${processed.pageCount} pages, ${processed.text.length} characters`);
    return processed.text;
  } catch (error) {
    logger.error(`[DocLing] Text extraction failed for ${documentId}:`, error);
    return null;
  }
}

async function storeFetchedRfpDocument(params: {
  documentId: string;
  opportunityId: string;
  filename: string;
  sourceUrl: string;
  buffer: Buffer;
  mimeType: string;
  userId?: string;
}): Promise<string> {
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

    return upload.storagePath;
  }

  const opportunityDir = join(DOCUMENT_STORAGE_PATH, params.opportunityId);
  const fileExt = extname(new URL(params.sourceUrl).pathname) || extname(params.filename) || ".bin";
  const safeName = `${params.documentId}${fileExt}`;
  const localPath = join(opportunityDir, safeName);

  await mkdir(opportunityDir, { recursive: true });
  await writeFile(localPath, params.buffer);

  return localPath;
}

async function readDocumentBuffer(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith("s3://")) {
    const objectStoreConfig = getLinodeE3ConfigFromEnv();
    if (!objectStoreConfig) {
      throw new Error("Linode E3 storage is not configured");
    }
    const object = await downloadFromLinodeE3(objectStoreConfig, storagePath);
    return object.body;
  }

  await access(storagePath);
  return readFile(storagePath);
}

async function queueRfpParsingFromDownloadedDocument(params: {
  document: typeof opportunityDocuments.$inferSelect;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  extractedText?: string;
  pageCount?: number;
  userId: string;
}): Promise<void> {
  const fileType = inferRfpParserFileType(params.document.documentName, params.mimeType);
  if (!fileType) {
    return;
  }

  try {
    const existing = await db.query.rfpDocuments.findFirst({
      where: eq(rfpDocuments.fileHash, params.fileHash),
    });

    if (existing) {
      return;
    }

    const [rfpDocument] = await db.insert(rfpDocuments).values({
      opportunityId: params.document.opportunityId,
      filename: params.document.documentName,
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
        source: "opportunity_document_download",
        sourceOpportunityDocumentId: params.document.id,
        sourceUrl: params.document.sourceUrl,
      },
    }).returning();

    const [parsingJob] = await db.insert(rfpParsingJobs).values({
      rfpDocumentId: rfpDocument.id,
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
      },
    }).returning();

    processRfpParsingJob(parsingJob.id, rfpDocument.id).catch((error) => {
      logger.error("[RFP Document Service] Background parse failed:", error);
    });
  } catch (error) {
    logger.warn("[RFP Document Service] Failed to queue downloaded document for parsing:", error);
  }
}

function inferRfpParserFileType(
  filename: string,
  mimeType?: string | null
): "pdf" | "docx" | "doc" | "html" | null {
  const extension = extname(filename).toLowerCase();
  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if (
    extension === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (extension === ".doc" || mimeType === "application/msword") return "doc";
  if (extension === ".html" || extension === ".htm" || mimeType === "text/html") return "html";
  return null;
}
