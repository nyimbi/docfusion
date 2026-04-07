"use client";

/**
 * useDocumentState Hook
 * 
 * Manages core document state including:
 * - Document structure (HDSINode tree)
 * - Document title
 * - Persistence (auto-save to IndexedDB)
 * - Undo/redo history
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { hdsiDB, unflattenNodes } from "@/lib/hdsi/db";
import type { HDSINode, HDSIDocument } from "@/lib/hdsi/types";

export interface UseDocumentStateOptions {
  initialDocumentId?: string;
  initialTitle?: string;
  initialStructure?: HDSINode[];
  userName?: string;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

export interface UseDocumentStateResult {
  // Document state
  docId: string;
  title: string;
  structure: HDSINode[];
  setTitle: (title: string) => void;
  setStructure: React.Dispatch<React.SetStateAction<HDSINode[]>>;
  
  // Node operations
  findNodeById: (id: string) => HDSINode | null;
  updateNode: (id: string, updates: Partial<HDSINode>) => void;
  
  // Persistence
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveDocument: () => Promise<void>;
  
  // History
  undoStack: HDSINode[][];
  redoStack: HDSINode[][];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  
  // Stats
  totalNodeCount: number;
}

export function useDocumentState(options: UseDocumentStateOptions = {}): UseDocumentStateResult {
  const {
    initialDocumentId,
    initialTitle = "Untitled Document",
    initialStructure,
    userName = "Anonymous",
    enableAutoSave = true,
    autoSaveInterval = 30000,
  } = options;

  // Core state
  const [docId, setDocId] = useState(initialDocumentId ?? crypto.randomUUID());
  const [structure, setStructure] = useState<HDSINode[]>(initialStructure ?? []);
  const [title, setTitle] = useState(initialTitle);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // History for undo/redo
  const [undoStack, setUndoStack] = useState<HDSINode[][]>([]);
  const [redoStack, setRedoStack] = useState<HDSINode[][]>([]);
  
  // Refs for auto-save
  const structureRef = useRef(structure);
  structureRef.current = structure;
  const autoSaveRef = useRef<{ triggerSave: () => void; dispose: () => void } | null>(null);

  // Load document on mount
  useEffect(() => {
    const loadDocument = async () => {
      if (!docId || initialStructure) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const doc = await hdsiDB.getDocument(docId);
        if (doc && doc.structure && doc.structure.length > 0) {
          // Convert flat structure back to tree
          const treeNodes = unflattenNodes(doc.structure);
          
          // Ensure nodes have all required HDSI properties
          const normalizeNodes = (nodes: any[]): HDSINode[] => {
            return nodes.map((n, i) => ({
              ...n,
              children: normalizeNodes(n.children || []),
              expanded: n.expanded ?? true,
              order: n.order ?? i,
              status: n.status ?? "outline",
              tokenBudget: n.tokenBudget ?? 500,
              customPrompt: n.customPrompt ?? "",
              densityTarget: n.densityTarget ?? 2.5,
              coherenceScore: n.coherenceScore ?? 1.0,
              depth: n.depth ?? 0,
            }));
          };

          const normalizedNodes = normalizeNodes(treeNodes);
          if (normalizedNodes.length > 0) {
            setStructure(normalizedNodes);
            setTitle(doc.title);
          }
        }
      } catch (error) {
        console.error("[HDSI] Failed to load document:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [docId, initialStructure]);

  // Setup auto-save
  useEffect(() => {
    if (!enableAutoSave || !docId || structure.length === 0) return;

    autoSaveRef.current = hdsiDB.createAutoSave(
      docId,
      () => structureRef.current,
      autoSaveInterval
    );

    return () => {
      autoSaveRef.current?.dispose();
    };
  }, [docId, structure.length > 0, enableAutoSave, autoSaveInterval]);

  // Trigger auto-save on structure changes
  useEffect(() => {
    if (structure.length > 0 && autoSaveRef.current) {
      autoSaveRef.current.triggerSave();
    }
  }, [structure]);

  // Find node by ID
  const findNodeById = useCallback((id: string): HDSINode | null => {
    const search = (nodes: HDSINode[]): HDSINode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children.length > 0) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(structure);
  }, [structure]);

  // Update a specific node
  const updateNode = useCallback((id: string, updates: Partial<HDSINode>) => {
    setStructure(prev => {
      // Save to undo stack before modifying
      setUndoStack(stack => [...stack, JSON.parse(JSON.stringify(prev))]);
      setRedoStack([]);

      const updateInTree = (nodes: HDSINode[]): HDSINode[] => {
        return nodes.map(node => {
          if (node.id === id) {
            return { ...node, ...updates };
          }
          if (node.children.length > 0) {
            return { ...node, children: updateInTree(node.children) };
          }
          return node;
        });
      };

      return updateInTree(prev);
    });
  }, []);

  // Manual save
  const saveDocument = useCallback(async () => {
    if (!docId || structure.length === 0) return;

    setIsSaving(true);
    try {
      const savedDoc = await hdsiDB.saveDocument(docId, structure, title, {
        incrementVersion: true,
        author: userName,
        description: "Manual save",
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to save document:", error);
    } finally {
      setIsSaving(false);
    }
  }, [docId, structure, title, userName]);

  // Undo
  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack;
      
      const previous = stack[stack.length - 1];
      setRedoStack(redo => [JSON.parse(JSON.stringify(structure)), ...redo]);
      setStructure(previous);
      
      return stack.slice(0, -1);
    });
  }, [structure]);

  // Redo
  const redo = useCallback(() => {
    setRedoStack(stack => {
      if (stack.length === 0) return stack;
      
      const next = stack[0];
      setUndoStack(undo => [...undo, JSON.parse(JSON.stringify(structure))]);
      setStructure(next);
      
      return stack.slice(1);
    });
  }, [structure]);

  // Count total nodes
  const countNodes = useCallback((nodes: HDSINode[]): number => {
    return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
  }, []);

  const totalNodeCount = countNodes(structure);

  return {
    docId,
    title,
    structure,
    setTitle,
    setStructure,
    findNodeById,
    updateNode,
    isLoading,
    isSaving,
    lastSaved,
    saveDocument,
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undo,
    redo,
    totalNodeCount,
  };
}
