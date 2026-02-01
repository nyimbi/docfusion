"use client";

/**
 * HDSI React Hooks - Simplified interface for components
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { hdsiDB } from "./db";
import type { HDSIVersion, HDSINode } from "./types";

// Re-define HDSIDocument type to match stored type
interface HDSIDocument {
  id: string;
  remoteId?: string;
  title: string;
  structure: HDSINode[];
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
  lastSyncedAt?: Date;
  isDeleted?: boolean;
  templateId?: string;
  metadata: {
    author?: string;
    organization?: string;
    tags?: string[];
    aiModel?: string;
    generationVersion?: string;
  };
}

interface UseHDSIDocumentOptions {
  documentId?: string;
  autoSaveInterval?: number;
  onSaved?: (doc: HDSIDocument) => void;
}

interface UseHDSIDocumentResult {
  document: HDSIDocument | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  save: (structure: HDSINode[], title?: string) => Promise<void>;
  triggerSave: () => void;
}

/**
 * Hook for managing a single HDSI document with auto-save
 */
export function useHDSIDocument(options: UseHDSIDocumentOptions = {}): UseHDSIDocumentResult {
  const { documentId, autoSaveInterval, onSaved } = options;

  const [document, setDocument] = useState<HDSIDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const pendingSave = useRef<{ structure: HDSINode[]; title?: string } | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load document on mount
  useEffect(() => {
    if (!documentId) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const doc = await hdsiDB.getDocument(documentId!);
        if (mounted) {
          // Convert stored document structure
          setDocument(doc as unknown as HDSIDocument);
          setLastSaved(doc ? new Date(doc.updatedAt) : null);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to load document"));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [documentId]);

  // Execute save
  const executeSave = useCallback(async () => {
    if (!documentId || !pendingSave.current || isSaving) return;

    try {
      setIsSaving(true);
      const { structure, title } = pendingSave.current;

      // Convert HDSINode[] to DocumentStructure[] via serialization
      const simplifiedStructure = JSON.parse(JSON.stringify(structure));
      const saved = await hdsiDB.saveDocument(documentId, simplifiedStructure, title);
      
      setDocument(saved as unknown as HDSIDocument);
      setLastSaved(new Date());
      onSaved?.(saved as unknown as HDSIDocument);
      pendingSave.current = null;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save"));
    } finally {
      setIsSaving(false);
    }
  }, [documentId, isSaving, onSaved]);

  // Queue a save
  const save = useCallback(async (structure: HDSINode[], title?: string) => {
    pendingSave.current = { structure, title };

    if (autoSaveInterval) {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(executeSave, autoSaveInterval);
    } else {
      await executeSave();
    }
  }, [autoSaveInterval, executeSave]);

  // Trigger immediate save
  const triggerSave = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    executeSave();
  }, [executeSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, []);

  return {
    document,
    isLoading,
    isSaving,
    lastSaved,
    error,
    save,
    triggerSave,
  };
}

interface UseHDSIVersionHistoryResult {
  versions: HDSIVersion[];
  isLoading: boolean;
  error: Error | null;
  restoreVersion: (version: HDSIVersion) => Promise<HDSIDocument>;
  compareVersions: (from: HDSIVersion, to: HDSIVersion) => Promise<any>;
}

/**
 * Hook for version history management
 */
export function useHDSIVersionHistory(documentId?: string): UseHDSIVersionHistoryResult {
  const [versions, setVersions] = useState<HDSIVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) return;

    let mounted = true;

    async function loadVersions() {
      setIsLoading(true);
      try {
        const docs = await hdsiDB.getDocumentVersions(documentId!, 50);
        if (mounted) {
          setVersions(docs);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to load versions"));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadVersions();

    return () => {
      mounted = false;
    };
  }, [documentId]);

  const restoreVersion = useCallback(async (version: HDSIVersion): Promise<HDSIDocument> => {
    const restored = await hdsiDB.restoreVersion(documentId!, version.structure);
    const fresh = await hdsiDB.getDocumentVersions(documentId!, 50);
    setVersions(fresh);
    return restored as unknown as HDSIDocument;
  }, [documentId]);

  const compareVersions = useCallback(async (from: HDSIVersion, to: HDSIVersion): Promise<any> => {
    return {
      from,
      to,
      added: [],
      removed: [],
      modified: [],
    };
  }, []);

  return {
    versions,
    isLoading,
    error,
    restoreVersion,
    compareVersions,
  };
}

interface UseHDSIAllDocumentsResult {
  documents: Array<{
    id: string;
    title: string;
    updatedAt: Date;
    nodeCount: number;
    totalTokens: number;
  }>;
  isLoading: boolean;
  deleteDocument: (id: string) => Promise<void>;
  searchDocuments: (query: string) => Promise<void>;
}

/**
 * Hook for listing all HDSI documents
 */
export function useHDSIAllDocuments(): UseHDSIAllDocumentsResult {
  const [documents, setDocuments] = useState<UseHDSIAllDocumentsResult["documents"]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDocuments = useCallback(async (searchQuery?: string) => {
    setIsLoading(true);
    try {
      const docs = await hdsiDB.listDocuments()
        .then(docs => docs.filter(d => 
          !searchQuery || 
          d.title.toLowerCase().includes(searchQuery.toLowerCase())
        ));
      
      const enriched = await Promise.all(
        docs.map(async (doc) => {
          const nodeCount = await hdsiDB.getNodeCount(doc.id);
          const totalTokens = doc.structure.reduce((acc, n) => 
            acc + (n.tokenBudget ?? 0), 0
          );
          return {
            id: doc.id,
            title: doc.title,
            updatedAt: new Date(doc.updatedAt),
            nodeCount,
            totalTokens,
          };
        })
      );

      setDocuments(enriched);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const deleteDocument = useCallback(async (id: string) => {
    await hdsiDB.deleteDocument(id);
    await loadDocuments();
  }, [loadDocuments]);

  const searchDocuments = useCallback(async (query: string) => {
    await loadDocuments(query);
  }, [loadDocuments]);

  return {
    documents,
    isLoading,
    deleteDocument,
    searchDocuments,
  };
}
