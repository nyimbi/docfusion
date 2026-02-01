import type { Change } from "diff";"use client";

/**
 * AI Diff Preview System
 * 
 * Cursor-style edit preview showing AI edits as diffs before applying.
 * Users can accept or reject each individual change.
 * 
 * Features:
 * - Sentence/paragraph level granularity
 * - Accept/reject individual changes
 * - Accept all / reject all
 * - Side-by-side or inline diff view
 * - Animated transitions
 */

import { useState, useCallback, useMemo } from "react";
import * as diffLib from "diff";

// ============================================================================
// Types
// ============================================================================

export type ChangeType = "added" | "removed" | "unchanged";

export interface TextChange {
  id: string;
  type: ChangeType;
  value: string;
  originalValue?: string;  // For modified text, stores the original
  granularity: "sentence" | "paragraph" | "word";
  startIndex: number;
  endIndex: number;
  isAccepted: boolean | null;  // null = pending, true = accepted, false = rejected
  confidence?: number;  // AI confidence score
  explanation?: string;  // Why this change was made
}

export interface DiffResult {
  original: string;
  modified: string;
  changes: TextChange[];
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
    unchanged: number;
    total: number;
  };
}

export interface PreviewSession {
  id: string;
  nodeId: string;
  nodeTitle: string;
  originalText: string;
  generatedText: string;
  diffResult: DiffResult;
  createdAt: Date;
  appliedAt?: Date;
}

export interface GranularityOptions {
  level: "word" | "sentence" | "paragraph";
  contextLines: number;
}

// ============================================================================
// Diff Generation
// ============================================================================

export function generateDiff(
  original: string,
  modified: string,
  options: GranularityOptions = { level: "sentence", contextLines: 2 }
): DiffResult {
  let changes: TextChange[] = [];
  
  switch (options.level) {
    case "word":
      changes = generateWordLevelDiff(original, modified);
      break;
    case "sentence":
      changes = generateSentenceLevelDiff(original, modified);
      break;
    case "paragraph":
      changes = generateParagraphLevelDiff(original, modified);
      break;
  }
  
  // Calculate stats
  const stats = {
    additions: changes.filter(c => c.type === "added").length,
    deletions: changes.filter(c => c.type === "removed").length,
    modifications: changes.filter(c => 
      c.type === "removed" && changes.some(a => 
        a.type === "added" && a.isAccepted === null && c.isAccepted === null
      )
    ).length,
    unchanged: changes.filter(c => c.type === "unchanged").length,
    total: changes.length,
  };
  
  return {
    original,
    modified,
    changes,
    stats,
  };
}

function generateWordLevelDiff(original: string, modified: string): TextChange[] {
  const diffs = diffLib.diffWords(original, modified);
  const changes: TextChange[] = [];
  let index = 0;
  
  diffs.forEach((part: Change, i: number) => {
    const change: TextChange = {
      id: `word-${i}`,
      type: part.added ? "added" : part.removed ? "removed" : "unchanged",
      value: part.value,
      granularity: "word",
      startIndex: index,
      endIndex: index + part.value.length,
      isAccepted: null,
    };
    changes.push(change);
    index += part.value.length;
  });
  
  return changes;
}

function generateSentenceLevelDiff(original: string, modified: string): TextChange[] {
  // Split into sentences
  const originalSentences = splitIntoSentences(original);
  const modifiedSentences = splitIntoSentences(modified);
  
  const changes: TextChange[] = [];
  let origIndex = 0;
  let modIndex = 0;
  
  // Use LCS (Longest Common Subsequence) for sentence matching
  const lcsMatrix = computeLCS(originalSentences, modifiedSentences);
  
  let i = 0, j = 0;
  while (i < originalSentences.length || j < modifiedSentences.length) {
    if (i < originalSentences.length && j < modifiedSentences.length && 
        originalSentences[i] === modifiedSentences[j]) {
      // Unchanged sentence
      changes.push({
        id: `sent-${changes.length}`,
        type: "unchanged",
        value: modifiedSentences[j],
        originalValue: originalSentences[i],
        granularity: "sentence",
        startIndex: origIndex,
        endIndex: origIndex + originalSentences[i].length,
        isAccepted: null,
      });
      origIndex += originalSentences[i].length;
      i++;
      j++;
    } else if (j < modifiedSentences.length && 
               (i >= originalSentences.length || 
                (j + 1 < modifiedSentences.length && 
                 originalSentences[i] === modifiedSentences[j + 1]))) {
      // Added sentence
      changes.push({
        id: `sent-${changes.length}`,
        type: "added",
        value: modifiedSentences[j],
        granularity: "sentence",
        startIndex: origIndex,
        endIndex: origIndex,
        isAccepted: null,
      });
      j++;
    } else if (i < originalSentences.length) {
      // Removed sentence
      changes.push({
        id: `sent-${changes.length}`,
        type: "removed",
        value: originalSentences[i],
        granularity: "sentence",
        startIndex: origIndex,
        endIndex: origIndex + originalSentences[i].length,
        isAccepted: null,
      });
      origIndex += originalSentences[i].length;
      i++;
    } else {
      j++;
    }
  }
  
  return changes;
}

function generateParagraphLevelDiff(original: string, modified: string): TextChange[] {
  const originalParas = original.split(/\n\n+/).filter(p => p.trim());
  const modifiedParas = modified.split(/\n\n+/).filter(p => p.trim());
  
  const changes: TextChange[] = [];
  let origIndex = 0;
  
  let i = 0, j = 0;
  while (i < originalParas.length || j < modifiedParas.length) {
    if (i < originalParas.length && j < modifiedParas.length && 
        areParagraphsSimilar(originalParas[i], modifiedParas[j])) {
      // Modified/unchanged paragraph
      const hasChanges = originalParas[i] !== modifiedParas[j];
      changes.push({
        id: `para-${changes.length}`,
        type: hasChanges ? "removed" : "unchanged",  // Will add new version
        value: modifiedParas[j],
        originalValue: originalParas[i],
        granularity: "paragraph",
        startIndex: origIndex,
        endIndex: origIndex + originalParas[i].length,
        isAccepted: null,
        explanation: hasChanges ? "Paragraph modified" : undefined,
      });
      origIndex += originalParas[i].length + 2; // +2 for \n\n
      i++;
      j++;
    } else if (j < modifiedParas.length && 
               (i >= originalParas.length || 
                !originalParas.some(p => areParagraphsSimilar(p, modifiedParas[j])))) {
      // Added paragraph
      changes.push({
        id: `para-${changes.length}`,
        type: "added",
        value: modifiedParas[j],
        granularity: "paragraph",
        startIndex: origIndex,
        endIndex: origIndex,
        isAccepted: null,
        explanation: "New paragraph added",
      });
      j++;
    } else if (i < originalParas.length) {
      // Removed paragraph
      changes.push({
        id: `para-${changes.length}`,
        type: "removed",
        value: originalParas[i],
        granularity: "paragraph",
        startIndex: origIndex,
        endIndex: origIndex + originalParas[i].length,
        isAccepted: null,
        explanation: "Paragraph removed",
      });
      origIndex += originalParas[i].length + 2;
      i++;
    } else {
      j++;
    }
  }
  
  return changes;
}

// Helper: Split text into sentences
function splitIntoSentences(text: string): string[] {
  // Simple sentence tokenizer - handles common cases
  return text
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Helper: Compute LCS matrix
function computeLCS<T>(a: T[], b: T[]): number[][] {
  const matrix: number[][] = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(0));
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }
  
  return matrix;
}

// Helper: Check if paragraphs are similar (for matching)
function areParagraphsSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => 
    s.toLowerCase().replace(/[^\w\s]/g, "").trim();
  
  const normA = normalize(a);
  const normB = normalize(b);
  
  // Check exact match or significant overlap
  if (normA === normB) return true;
  
  // Calculate word overlap ratio
  const wordsA = new Set(normA.split(/\s+/));
  const wordsB = new Set(normB.split(/\s+/));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const smaller = Math.min(wordsA.size, wordsB.size);
  
  return smaller > 0 && intersection.size / smaller > 0.6; // 60% similarity
}

// ============================================================================
// Preview Assembly
// ============================================================================

export function assemblePreviewText(changes: TextChange[]): string {
  // Build text from accepted/pending changes
  return changes
    .filter(c => c.isAccepted !== false)  // Exclude rejected
    .map(c => c.value)
    .join(
      changes[0]?.granularity === "word" ? "" : 
      changes[0]?.granularity === "sentence" ? " " : "\n\n"
    );
}

export function assembleFinalText(changes: TextChange[], original: string): string {
  let result = "";
  let lastIndex = 0;
  
  // Process in order
  const sortedChanges = [...changes].sort((a, b) => a.startIndex - b.startIndex);
  
  for (const change of sortedChanges) {
    if (change.isAccepted === false) {
      // Rejected - skip this change
      continue;
    }
    
    if (change.isAccepted === true || change.isAccepted === null) {
      // Accepted or pending (treat as accepted for final assembly)
      if (change.type === "added") {
        result += change.value;
      } else if (change.type === "removed") {
        // Skip - don't add removed text
      } else if (change.type === "unchanged") {
        result += change.value;
      }
    }
  }
  
  return result || original;
}

// ============================================================================
// React Hook
// ============================================================================

export function useAIDiffPreview() {
  const [sessions, setSessions] = useState<PreviewSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);
  
  const createSession = useCallback((
    nodeId: string,
    nodeTitle: string,
    originalText: string,
    generatedText: string,
    granularity: GranularityOptions["level"] = "sentence"
  ): PreviewSession => {
    const diffResult = generateDiff(originalText, generatedText, { 
      level: granularity, 
      contextLines: 2 
    });
    
    const session: PreviewSession = {
      id: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      nodeTitle,
      originalText,
      generatedText,
      diffResult,
      createdAt: new Date(),
    };
    
    setSessions(prev => [...prev, session]);
    setActiveSessionId(session.id);
    
    return session;
  }, []);
  
  const updateChangeStatus = useCallback((
    sessionId: string,
    changeId: string,
    isAccepted: boolean
  ) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      
      return {
        ...session,
        diffResult: {
          ...session.diffResult,
          changes: session.diffResult.changes.map(change =>
            change.id === changeId ? { ...change, isAccepted } : change
          ),
        },
      };
    }));
  }, []);
  
  const acceptAll = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      
      return {
        ...session,
        diffResult: {
          ...session.diffResult,
          changes: session.diffResult.changes.map(change => ({
            ...change,
            isAccepted: change.isAccepted === null ? true : change.isAccepted,
          })),
        },
      };
    }));
  }, []);
  
  const rejectAll = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== sessionId) return session;
      
      return {
        ...session,
        diffResult: {
          ...session.diffResult,
          changes: session.diffResult.changes.map(change => ({
            ...change,
            isAccepted: change.isAccepted === null ? false : change.isAccepted,
          })),
        },
      };
    }));
  }, []);
  
  const applySession = useCallback((sessionId: string): string | null => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    
    const finalText = assembleFinalText(
      session.diffResult.changes, 
      session.originalText
    );
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, appliedAt: new Date() } : s
    ));
    
    return finalText;
  }, [sessions]);
  
  const closeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId]);
  
  const getAcceptanceStats = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    
    const { changes } = session.diffResult;
    return {
      accepted: changes.filter(c => c.isAccepted === true).length,
      rejected: changes.filter(c => c.isAccepted === false).length,
      pending: changes.filter(c => c.isAccepted === null).length,
      total: changes.length,
    };
  }, [sessions]);
  
  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    updateChangeStatus,
    acceptAll,
    rejectAll,
    applySession,
    closeSession,
    getAcceptanceStats,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateChangeExplanation(
  original: string,
  modified: string,
  type: ChangeType
): string {
  if (type === "added") {
    return "AI added new content to improve clarity or completeness.";
  } else if (type === "removed") {
    return "AI removed redundant or unclear content.";
  } else {
    return "AI preserved this content without changes.";
  }
}

export function estimateReadingImpact(
  original: string,
  modified: string
): { estimatedTime: string; wordCountDelta: number } {
  const origWords = original.split(/\s+/).length;
  const modWords = modified.split(/\s+/).length;
  const delta = modWords - origWords;
  
  // Rough estimate: 200 words per minute
  const readingTime = Math.ceil(modWords / 200);
  
  return {
    estimatedTime: readingTime === 1 ? "~1 min" : `~${readingTime} mins`,
    wordCountDelta: delta,
  };
}
