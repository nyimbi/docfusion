/**
 * Server Actions for Opportunity Document Management
 * 
 * Provides:
 * - Document discovery (using Firecrawl)
 * - Document download and storage
 * - Document selection management
 * - File serving
 */

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { opportunities, opportunityDocuments } from "@/lib/db/schema";
import { 
  discoverDocuments, 
  downloadDocument, 
  downloadSelectedDocuments,
  getOpportunityDocuments,
  updateDocumentSelection,
  updateAllDocumentSelections,
  getDocumentFile,
  deleteDocument,
  extractDocumentText,
  type DownloadResult,
} from "@/lib/services/rfp-document-service";
import { discoverDocumentsWithAgent } from "@/lib/services/document-discovery-agent";
import { logger } from "@/lib/utils/logger";

async function requireOpportunityDocumentUserId(): Promise<string> {
  const session = await requireServerSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

async function assertAssignedOpportunityAccess(
  opportunityId: string,
  userId: string
): Promise<void> {
  const [row] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.assignedTo, userId)))
    .limit(1);

  if (!row) {
    throw new Error("Opportunity not found or not permitted");
  }
}

async function assertAssignedDocumentAccess(
  documentId: string,
  userId: string
): Promise<{ opportunityId: string }> {
  const [row] = await db
    .select({
      id: opportunityDocuments.id,
      opportunityId: opportunityDocuments.opportunityId,
    })
    .from(opportunityDocuments)
    .innerJoin(opportunities, eq(opportunityDocuments.opportunityId, opportunities.id))
    .where(and(eq(opportunityDocuments.id, documentId), eq(opportunities.assignedTo, userId)))
    .limit(1);

  if (!row) {
    throw new Error("Document not found or not permitted");
  }

  return { opportunityId: row.opportunityId };
}

function assertDocumentBelongsToOpportunity(
  actualOpportunityId: string,
  expectedOpportunityId: string
): void {
  if (actualOpportunityId !== expectedOpportunityId) {
    throw new Error("Document does not belong to this opportunity");
  }
}

// ============================================================================
// Document Discovery - AI Agent
// ============================================================================

/**
 * Discover RFP documents using AI agent with multiple strategies
 * This is the PRIMARY discovery method - uses AI to intelligently find documents
 */
export async function discoverOpportunityDocuments(
  opportunityId: string,
  sourceUrl?: string
): Promise<{ 
  success: boolean; 
  documents: { name: string; url: string; type: string; confidence: number; source: string }[]; 
  strategiesAttempted: string[];
  strategiesSucceeded: string[];
  aiAnalysis?: string;
  error?: string;
}> {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedOpportunityAccess(opportunityId, userId);

    // Use the AI discovery agent
    const result = await discoverDocumentsWithAgent(opportunityId, 5, sourceUrl);

    if (result.success) {
      revalidatePath(`/opportunities/${opportunityId}`);
    }

    return {
      success: result.success,
      documents: result.sources.map(s => ({ 
        name: s.name, 
        url: s.url, 
        type: s.type,
        confidence: s.confidence,
        source: s.source,
      })),
      strategiesAttempted: result.strategiesAttempted,
      strategiesSucceeded: result.strategiesSucceeded,
      aiAnalysis: result.aiAnalysis,
      ...(result.success ? {} : { error: result.error || "Discovery failed" }),
    };
  } catch (error) {
    logger.error("Failed to discover documents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Discovery failed",
      documents: [],
      strategiesAttempted: [],
      strategiesSucceeded: [],
    };
  }
}

/**
 * Legacy discovery method - direct portal scraping
 * Use discoverOpportunityDocuments (AI agent) instead
 */
export async function discoverOpportunityDocumentsLegacy(
  opportunityId: string,
  sourceUrl: string
): Promise<{ 
  success: boolean; 
  documents: { name: string; url: string; type: string }[]; 
  sourceUrl: string;
  error?: string;
}> {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedOpportunityAccess(opportunityId, userId);

    const result = await discoverDocuments(opportunityId, sourceUrl);

    if (result.success) {
      revalidatePath(`/opportunities/${opportunityId}`);
    }

    return {
      success: result.success,
      documents: result.documents.map(d => ({ name: d.name, url: d.url, type: d.type })),
      sourceUrl: result.sourceUrl,
      ...(result.success ? {} : { error: result.error || "Discovery failed" }),
    };
  } catch (error) {
    logger.error("Failed to discover documents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Discovery failed",
      documents: [],
      sourceUrl,
    };
  }
}

// ============================================================================
// Document Retrieval
// ============================================================================

/**
 * Get all documents for an opportunity
 */
export async function getOpportunityDocumentsAction(opportunityId: string) {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedOpportunityAccess(opportunityId, userId);

    const documents = await getOpportunityDocuments(opportunityId);
    
    return {
      success: true,
      documents,
    };
  } catch (error) {
    logger.error("Failed to get documents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get documents",
    };
  }
}

// ============================================================================
// Document Download
// ============================================================================

/**
 * Download a single document
 */
export async function downloadOpportunityDocument(
  opportunityId: string,
  documentId: string
) {
  try {
    const userId = await requireOpportunityDocumentUserId();
    const documentAccess = await assertAssignedDocumentAccess(documentId, userId);
    assertDocumentBelongsToOpportunity(documentAccess.opportunityId, opportunityId);

    const result = await downloadDocument(documentId, userId, opportunityId);

    if (result.success) {
      revalidatePath(`/opportunities/${opportunityId}`);
    }

    return result;
  } catch (error) {
    logger.error("Failed to download document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

/**
 * Download all selected documents
 */
export async function downloadSelectedOpportunityDocuments(opportunityId: string): Promise<{
  success: boolean;
  error?: string;
  downloaded: number;
  failed: number;
  results: DownloadResult[];
}> {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedOpportunityAccess(opportunityId, userId);

    const result = await downloadSelectedDocuments(opportunityId, userId);

    revalidatePath(`/opportunities/${opportunityId}`);

    return {
      success: true,
      downloaded: result.success,
      failed: result.failed,
      results: result.results,
    };
  } catch (error) {
    logger.error("Failed to download selected documents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
      downloaded: 0,
      failed: 0,
      results: [],
    };
  }
}

// ============================================================================
// Document Selection Management
// ============================================================================

/**
 * Toggle document selection
 */
export async function toggleDocumentSelection(
  documentId: string,
  isSelected: boolean
) {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedDocumentAccess(documentId, userId);

    const result = await updateDocumentSelection(documentId, isSelected);
    
    return {
      success: true,
      document: result[0],
    };
  } catch (error) {
    logger.error("Failed to toggle selection:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

/**
 * Select/deselect all documents for an opportunity
 */
export async function toggleAllDocumentSelections(
  opportunityId: string,
  isSelected: boolean
) {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedOpportunityAccess(opportunityId, userId);

    await updateAllDocumentSelections(opportunityId, isSelected);

    revalidatePath(`/opportunities/${opportunityId}`);
    
    return {
      success: true,
      isSelected,
    };
  } catch (error) {
    logger.error("Failed to toggle all selections:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

// ============================================================================
// Document Deletion
// ============================================================================

/**
 * Delete a document
 */
export async function deleteOpportunityDocument(
  opportunityId: string,
  documentId: string
) {
  try {
    const userId = await requireOpportunityDocumentUserId();
    const documentAccess = await assertAssignedDocumentAccess(documentId, userId);
    assertDocumentBelongsToOpportunity(documentAccess.opportunityId, opportunityId);

    const success = await deleteDocument(documentId);

    if (success) {
      revalidatePath(`/opportunities/${opportunityId}`);
    }

    return {
      success,
    };
  } catch (error) {
    logger.error("Failed to delete document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Get text content of documents for analysis
 */
export async function getDocumentsForAnalysis(opportunityId: string) {
  try {
    const userId = await requireOpportunityDocumentUserId();
    await assertAssignedOpportunityAccess(opportunityId, userId);

    const documents = await getOpportunityDocuments(opportunityId);
    
    // Get downloaded documents
    const downloadedDocs = documents.filter(
      (doc) => doc.status === "downloaded" && doc.localPath
    );

    // Extract text from each document
    const extractedTexts = await Promise.all(
      downloadedDocs.map(async (doc) => {
        const text = await extractDocumentText(doc.id);
        return {
          id: doc.id,
          name: doc.documentName,
          type: doc.documentType,
          text: text || `[Binary content: ${doc.documentName}]`,
        };
      })
    );

    return {
      success: true,
      documents: extractedTexts,
    };
  } catch (error) {
    logger.error("Failed to get documents for analysis:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
  }
}
