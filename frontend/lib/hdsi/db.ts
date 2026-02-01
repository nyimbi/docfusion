"use client";

/**
 * Dexie-based IndexedDB persistence for HDSI
 * Provides: auto-save, version history, offline sync, and Yjs collaboration storage
 */

import Dexie, { type EntityTable } from "dexie";
import type { HDSIVersion, HDSISyncQueue, HDSIYjsState, DocumentStructure as DS } from "./types";

// ============================================================================
// Simplified Node Structure for Storage (no recursion in DB types)
// ============================================================================

interface StoredNode {
  id: string;
  type: "chapter" | "section" | "subsection" | "paragraph";
  title: string;
  order: number;
  length?: "brief" | "medium" | "comprehensive";
  expanded: boolean;
  status: "outline" | "generating" | "generated" | "error" | "debt" | "deleted";
  tokenBudget: number;
  customPrompt: string;
  densityTarget: number;
  coherenceScore: number;
  generatedContent?: string;
  generationProgress?: number;
  depth: number;
  childrenIds: string[];
}

/**
 * Enhanced Discovery Analysis - Strategic Blueprint for AI Document Generation
 * Captures comprehensive audience psychology, content strategy, and success metrics
 * Preserved for future reviewers to understand generation context and intent
 */
export interface StoredDiscoveryAnalysis {
  // Document Identification & Strategic Purpose
  documentIdentification: {
    type: string;
    primaryGoal: string;
    context: string;
  };
  suggestedTitle: string;
  // Audience Deep Dive
  audienceAnalysis: {
    primaryAudience: {
      description: string;
      priorities: string[];
      painPoints: string[];
      knowledgeLevel: string;
    };
    secondaryAudiences: string[];
    keyInformationNeeds: string[];
    criticalQuestions: string[];
    emotionalDrivers: string[];
  };
  // Content Architecture
  contentStrategy: {
    centralThesis: string;
    themes: {
      mustHave: string[];
      shouldHave: string[];
      couldHave: string[];
    };
  };
  // Persuasion & Credibility Framework
  persuasionStrategy: {
    evidenceTypes: string[];
    authorityElements: string[];
    potentialObjections: string[];
  };
  // Voice, Style, and Experience
  stylisticGuidance: {
    recommendedTone: string;
    styleAndComplexity: string;
    formattingSuggestions: string[];
  };
  // Success Metrics & Constraints
  successCriteria: {
    metrics: string[];
    constraints: string[];
  };
  estimatedSections: number;
  originalBrief: string;
  analyzedAt: Date;
}

interface HDSIStoredDocument {
  id: string;
  remoteId?: string;
  title: string;
  structure: StoredNode[];
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
  lastSyncedAt?: Date;
  isDeleted?: boolean;
  templateId?: string;
  /** Semantic version: "0.0-gen" for initial AI generation, then "0.1.0", "0.2.0", etc. */
  version: string;
  /** Discovery analysis from AI generation phase - preserved for reviewers */
  discoveryAnalysis?: StoredDiscoveryAnalysis;
  metadata: {
    author?: string;
    organization?: string;
    tags?: string[];
    aiModel?: string;
    generationVersion?: string;
    type?: "proposal" | "sow" | "contract" | "compliance" | "technical" | "whitepaper" | "presentation" | "report" | "template" | "draft";
    objectives?: string[];
  };
}

// ============================================================================
// Database Definition
// ============================================================================

class HDSIDatabase extends Dexie {
  documents!: EntityTable<HDSIStoredDocument, "id">;
  versions!: EntityTable<HDSIVersion, "id">;
  syncQueue!: EntityTable<HDSISyncQueue, "id">;
  yjsStates!: EntityTable<HDSIYjsState, "documentId">;

  constructor() {
    super("hdsi_v1");

    this.version(1).stores({
      documents: "id, [isDeleted+updatedAt], syncVersion, lastSyncedAt",
      versions: "id, documentId, [documentId+timestamp], isAutoSave",
      syncQueue: "id, [documentId+createdAt], attempts",
      yjsStates: "documentId",
    });
  }

  // ========================================================================
  // Document CRUD
  // ========================================================================

  async createDocument(
    title: string,
    structure: DS[],
    options?: {
      templateId?: string;
      metadata?: HDSIStoredDocument["metadata"];
      discoveryAnalysis?: StoredDiscoveryAnalysis;
      isAiGenerated?: boolean;
    }
  ): Promise<HDSIStoredDocument> {
    const id = crypto.randomUUID();
    const doc: HDSIStoredDocument = {
      id,
      title,
      structure: flattenStructure(structure),
      createdAt: new Date(),
      updatedAt: new Date(),
      syncVersion: 0,
      templateId: options?.templateId,
      // Initial version: "0.0-gen" for AI-generated, "0.1.0" for manual/template
      version: options?.isAiGenerated ? "0.0-gen" : "0.1.0",
      discoveryAnalysis: options?.discoveryAnalysis,
      metadata: options?.metadata || {},
    };

    await this.documents.add(doc);
    return doc;
  }

  async getDocument(id: string): Promise<HDSIStoredDocument | null> {
    return (await this.documents.get(id)) || null;
  }

  async saveDocument(
    id: string,
    structure: DS[],
    title?: string,
    options?: { incrementVersion?: boolean; author?: string; description?: string }
  ): Promise<HDSIStoredDocument> {
    const existing = await this.documents.get(id);
    if (!existing) {
      throw new Error(`Document ${id} not found`);
    }

    // Increment semantic version if requested (manual saves)
    const newVersion = options?.incrementVersion
      ? incrementSemanticVersion(existing.version)
      : existing.version;

    const updates = {
      structure: flattenStructure(structure),
      syncVersion: existing.syncVersion + 1,
      version: newVersion,
      updatedAt: new Date(),
      ...(title !== undefined ? { title } : {}),
    };

    await this.documents.update(id, updates);

    // Also create a version entry
    await this.createVersion(id, structure, {
      author: options?.author || "user",
      description: options?.description || "Auto-save",
      isAutoSave: !options?.incrementVersion,
    });

    return (await this.documents.get(id))!;
  }

  async deleteDocument(id: string, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.documents.get(id);
      if (existing) {
        await this.documents.update(id, { 
          isDeleted: true, 
          syncVersion: existing.syncVersion + 1,
          updatedAt: new Date(),
        });
      }
    } else {
      await this.documents.delete(id);
      await this.versions.where("documentId").equals(id).delete();
      await this.yjsStates.delete(id);
    }
  }

  async listDocuments(options?: { includeDeleted?: boolean; limit?: number }): Promise<HDSIStoredDocument[]> {
    const allDocs = await this.documents.toArray();
    let result = allDocs;

    if (!options?.includeDeleted) {
      result = result.filter((d) => !d.isDeleted);
    }

    result = result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  // ========================================================================
  // Version History
  // ========================================================================

  async createVersion(
    documentId: string,
    structure: DS[],
    options: {
      author: string;
      description?: string;
      isAutoSave?: boolean;
    }
  ): Promise<HDSIVersion> {
    if (options.isAutoSave) {
      await this.pruneAutoSaves(documentId);
    }

    const version: HDSIVersion = {
      id: crypto.randomUUID(),
      documentId,
      structure: JSON.parse(JSON.stringify(structure)),
      author: options.author,
      description: options.description || (options.isAutoSave ? "Auto-save" : "Manual save"),
      timestamp: new Date(),
      isAutoSave: options.isAutoSave || false,
    };

    await this.versions.add(version);
    return version;
  }

  private async pruneAutoSaves(documentId: string, keepCount = 20): Promise<void> {
    const autoSaves = await this.versions
      .filter(v => v.documentId === documentId && v.isAutoSave)
      .sortBy("timestamp");

    if (autoSaves.length > keepCount) {
      const toDelete = autoSaves.slice(0, autoSaves.length - keepCount);
      await Promise.all(toDelete.map((v) => this.versions.delete(v.id)));
    }
  }

  async getDocumentVersions(documentId: string, limit = 50): Promise<HDSIVersion[]> {
    const versions = await this.versions
      .filter(v => v.documentId === documentId)
      .sortBy("timestamp");
    return versions.reverse().slice(0, limit);
  }

  async restoreVersion(documentId: string, versionStructure: DS[]): Promise<HDSIStoredDocument> {
    const doc = await this.documents.get(documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Create a restore point of current state
    await this.createVersion(documentId, unflattenNodes(doc.structure), {
      author: "system",
      description: "Pre-restore checkpoint",
      isAutoSave: false,
    });

    // Restore the version
    return this.saveDocument(documentId, versionStructure, `Restored: ${doc.title}`);
  }

  // ========================================================================
  // Sync Queue
  // ========================================================================

  async queueForSync(documentId: string, operation: HDSISyncQueue["operation"], payload: any): Promise<void> {
    const queueItem: HDSISyncQueue = {
      id: crypto.randomUUID(),
      documentId,
      operation,
      payload,
      attempts: 0,
      createdAt: new Date(),
    };

    await this.syncQueue.add(queueItem);
  }

  async getPendingSync(): Promise<HDSISyncQueue[]> {
    return this.syncQueue.toArray();
  }

  async markSyncComplete(id: string): Promise<void> {
    await this.syncQueue.delete(id);
  }

  async markSyncFailed(id: string, error: string): Promise<void> {
    const item = await this.syncQueue.get(id);
    if (item) {
      await this.syncQueue.update(id, {
        attempts: item.attempts + 1,
        error,
      });
    }
  }

  async retryFailedSync(maxAttempts = 3): Promise<{ success: string[]; failed: string[] }> {
    const allQueue = await this.syncQueue.toArray();
    const failed = allQueue.filter(q => q.attempts >= maxAttempts - 1);
    const success: string[] = [];
    const stillFailed: string[] = [];

    for (const item of failed) {
      try {
        await this.markSyncComplete(item.id);
        success.push(item.id);
      } catch {
        stillFailed.push(item.id);
      }
    }

    return { success, failed: stillFailed };
  }

  // ========================================================================
  // Yjs Collaboration
  // ========================================================================

  async saveYjsState(documentId: string, ydocState: Uint8Array, awareness?: any): Promise<void> {
    const state: HDSIYjsState = {
      documentId,
      ydocState,
      awarenessState: awareness,
      updatedAt: new Date(),
    };

    await this.yjsStates.put(state);
  }

  async getYjsState(documentId: string): Promise<HDSIYjsState | null> {
    return (await this.yjsStates.get(documentId)) || null;
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  async getNodeCount(documentId: string): Promise<number> {
    const doc = await this.getDocument(documentId);
    return doc?.structure.length || 0;
  }

  createAutoSave(
    documentId: string,
    getStructure: () => DS[],
    intervalMs: number = 30000
  ) {
    let timeout: NodeJS.Timeout | null = null;
    let lastStructure = JSON.stringify(getStructure());

    const saveIfChanged = async () => {
      const current = JSON.stringify(getStructure());
      if (current !== lastStructure) {
        try {
          await this.saveDocument(documentId, getStructure());
          lastStructure = current;
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }
    };

    const triggerSave = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(saveIfChanged, 1000);
    };

    const interval = setInterval(saveIfChanged, intervalMs);

    const dispose = () => {
      if (timeout) clearTimeout(timeout);
      clearInterval(interval);
      saveIfChanged();
    };

    return { triggerSave, dispose };
  }

  async exportDocument(id: string): Promise<string> {
    const doc = await this.getDocument(id);
    if (!doc) throw new Error("Document not found");

    return JSON.stringify(
      {
        ...doc,
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
      },
      null,
      2
    );
  }

  async importDocument(json: string): Promise<HDSIStoredDocument> {
    const data = JSON.parse(json);

    if (!data.structure || !Array.isArray(data.structure)) {
      throw new Error("Invalid document structure");
    }

    const doc: HDSIStoredDocument = {
      id: crypto.randomUUID(),
      title: data.title || "Imported Document",
      structure: data.structure,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncVersion: 0,
      version: data.version || "0.1.0",
      metadata: data.metadata || {},
    };

    await this.documents.add(doc);
    return doc;
  }

  async getStats(): Promise<{
    documentCount: number;
    versionCount: number;
    syncQueueSize: number;
    storageEstimate: number;
  }> {
    const [documentCount, versionCount, syncQueueSize] = await Promise.all([
      this.documents.count(),
      this.versions.count(),
      this.syncQueue.count(),
    ]);

    const docs = await this.documents.toArray();
    const storageEstimate = docs.reduce(
      (acc, d) => acc + JSON.stringify(d).length * 2,
      0
    );

    return {
      documentCount,
      versionCount,
      syncQueueSize,
      storageEstimate,
    };
  }
}

// Instantiate singleton
export const hdsiDB = new HDSIDatabase();

// Global for debugging
if (typeof window !== "undefined") {
  (window as any).__hdsiDB = hdsiDB;
}

// ============================================================================
// Semantic Versioning Utilities
// ============================================================================

/**
 * Increment semantic version following semver conventions
 * - "0.0-gen" (AI generated) -> "0.1.0" (first edit)
 * - "0.1.0" -> "0.2.0" (minor increment for content changes)
 * - "0.9.0" -> "0.10.0" (no limit on minor)
 * - Manual major bumps (1.0.0) reserved for explicit release
 */
function incrementSemanticVersion(currentVersion: string): string {
  // Handle initial AI-generated version
  if (currentVersion === "0.0-gen") {
    return "0.1.0";
  }

  // Parse semver: major.minor.patch
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    // Invalid format, start fresh
    return "0.1.0";
  }

  const [, major, minor, patch] = match;
  const majorNum = parseInt(major, 10);
  const minorNum = parseInt(minor, 10);
  const patchNum = parseInt(patch, 10);

  // Increment minor version for content changes (patch stays 0 until explicit release)
  return `${majorNum}.${minorNum + 1}.${patchNum}`;
}

/**
 * Parse version string into components for comparison
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number; isGenerated: boolean } {
  if (version === "0.0-gen") {
    return { major: 0, minor: 0, patch: 0, isGenerated: true };
  }

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return { major: 0, minor: 1, patch: 0, isGenerated: false };
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    isGenerated: false,
  };
}

/**
 * Compare two versions (returns -1, 0, or 1)
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;
  if (va.isGenerated && !vb.isGenerated) return -1;
  if (!va.isGenerated && vb.isGenerated) return 1;
  return 0;
}

// ============================================================================
// Structure Transformations
// ============================================================================

function flattenStructure(nodes: DS[], result: StoredNode[] = [], parentId?: string): StoredNode[] {
  for (const node of nodes) {
    const storedNode: StoredNode = {
      id: node.id,
      type: node.type,
      title: node.title,
      order: node.order,
      length: (node as any).length,
      expanded: (node as any).expanded ?? true,
      status: (node as any).status ?? "outline",
      tokenBudget: (node as any).tokenBudget ?? 500,
      customPrompt: (node as any).customPrompt ?? "",
      densityTarget: (node as any).densityTarget ?? 2.5,
      coherenceScore: (node as any).coherenceScore ?? 1.0,
      generatedContent: (node as any).generatedContent,
      generationProgress: (node as any).generationProgress,
      depth: (node as any).depth ?? 0,
      childrenIds: node.children?.map(c => c.id) ?? [],
    };
    
    result.push(storedNode);
    
    if (node.children) {
      flattenStructure(node.children, result, node.id);
    }
  }
  
  return result;
}

function unflattenNodes(flatNodes: StoredNode[]): DS[] {
  const nodeMap = new Map<string, DS & { _childrenIds: string[] }>();
  const roots: DS[] = [];
  
  // First pass: create all nodes
  for (const fn of flatNodes) {
    const node = {
      id: fn.id,
      type: fn.type,
      title: fn.title,
      order: fn.order,
      length: fn.length,
      children: [] as DS[],
      // HDSI properties
      expanded: fn.expanded,
      status: fn.status,
      tokenBudget: fn.tokenBudget,
      customPrompt: fn.customPrompt,
      densityTarget: fn.densityTarget,
      coherenceScore: fn.coherenceScore,
      generatedContent: fn.generatedContent,
      generationProgress: fn.generationProgress,
      depth: fn.depth,
      // Internal tracking
      _childrenIds: fn.childrenIds,
    };
    
    nodeMap.set(fn.id, node);
  }
  
  // Second pass: link children
  const list = Array.from(nodeMap.values());
  for (const node of list) {
    for (const childId of node._childrenIds) {
      const child = nodeMap.get(childId);
      if (child && node.children) {
        node.children.push(child);
      }
    }
    
    // Remove tracking property
    delete (node as any)._childrenIds;
    
    // Add to roots if no parent references it
    const hasParent = Array.from(nodeMap.values()).some(n => 
      n.children && n.children.includes(node as unknown as DS)
    );
    
    if (!hasParent) {
      roots.push(node as unknown as DS);
    }
  }
  
  // Sort by order
  roots.sort((a, b) => a.order - b.order);
  const allNodes = Array.from(nodeMap.values());
  for (const node of allNodes) {
    if (node.children) {
      node.children.sort((a, b) => a.order - b.order);
    }
  }
  
  return roots;
}