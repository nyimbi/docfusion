"use client";

/**
 * Bidirectional Links System
 * 
 * Features:
 * - Type [[ to trigger autocomplete for document links
 * - Click to navigate to linked document
 * - Backlinks panel showing all documents linking to current
 * - Link suggestions based on title and content
 * 
 * Inspired by Roam Research / Obsidian / Notion
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type { DocumentMetadata, DocumentType, DocumentObjective, DocumentStatus, DocumentStage } from "./document-organization";
import { hdsiDB } from "./db";

// ============================================================================
// Types
// ============================================================================

export interface BidirectionalLink {
  id: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  targetDocumentId: string;
  targetDocumentTitle: string;
  targetAnchor?: string;  // For linking to specific sections
  contextText: string;    // Surrounding text for context
  createdAt: Date;
}

export interface LinkSuggestion {
  id: string;
  title: string;
  type: "document" | "section" | "heading";
  matchScore: number;
  preview?: string;
}

export interface BacklinkInfo {
  documentId: string;
  documentTitle: string;
  contextSnippet: string;
  linkCount: number;
}

export interface LinkNode {
  documentId: string;
  title: string;
  outgoingLinks: string[];
  incomingLinks: string[];
}

// ============================================================================
// Link Parsing and Detection
// ============================================================================

const LINK_REGEX = /\[\[([^\]]+)\]\]/g;
const PARTIAL_LINK_REGEX = /\[\[([^\]]*)$/;

export function parseBidirectionalLinks(text: string): Array<{
  fullMatch: string;
  linkText: string;
  startIndex: number;
  endIndex: number;
  hasAnchor: boolean;
  anchor?: string;
}> {
  const links: Array<{
    fullMatch: string;
    linkText: string;
    startIndex: number;
    endIndex: number;
    hasAnchor: boolean;
    anchor?: string;
  }> = [];

  let match;
  while ((match = LINK_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const linkText = match[1].trim();
    
    // Check for anchor (e.g., "Document Title#Section Heading")
    const hasAnchor = linkText.includes("#");
    const [title, anchor] = hasAnchor 
      ? linkText.split("#").map(s => s.trim())
      : [linkText, undefined];

    links.push({
      fullMatch,
      linkText: title,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      hasAnchor,
      anchor,
    });
  }

  return links;
}

export function detectPartialLink(text: string, cursorIndex: number): {
  isInLink: boolean;
  query: string;
  startIndex: number;
} {
  // Get text before cursor
  const textBefore = text.slice(0, cursorIndex);
  
  // Check if we're inside or just after [[
  const partialMatch = textBefore.match(PARTIAL_LINK_REGEX);
  
  if (partialMatch) {
    return {
      isInLink: true,
      query: partialMatch[1],
      startIndex: textBefore.lastIndexOf("[["),
    };
  }

  // Check if cursor is right after [[
  if (text.slice(Math.max(0, cursorIndex - 2), cursorIndex) === "[[") {
    return {
      isInLink: true,
      query: "",
      startIndex: cursorIndex - 2,
    };
  }

  return { isInLink: false, query: "", startIndex: -1 };
}

// ============================================================================
// Suggestion Engine
// ============================================================================

export function generateLinkSuggestions(
  query: string,
  documents: DocumentMetadata[],
  currentDocumentId?: string,
  limit: number = 10
): LinkSuggestion[] {
  if (!query.trim()) {
    // Return recently updated documents when no query
    return documents
      .filter(d => d.id !== currentDocumentId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map(d => ({
        id: d.id,
        title: d.title,
        type: "document" as const,
        matchScore: 1,
        preview: d.tags.slice(0, 3).join(", "),
      }));
  }

  const normalizedQuery = query.toLowerCase().trim();
  const suggestions: LinkSuggestion[] = [];

  documents.forEach(doc => {
    if (doc.id === currentDocumentId) return;

    const title = doc.title.toLowerCase();
    let score = 0;

    // Exact match
    if (title === normalizedQuery) {
      score = 100;
    }
    // Starts with query
    else if (title.startsWith(normalizedQuery)) {
      score = 80;
    }
    // Contains query as word
    else if (title.includes(` ${normalizedQuery} `)) {
      score = 60;
    }
    // Contains query
    else if (title.includes(normalizedQuery)) {
      score = 40;
    }
    // Fuzzy match (simplified)
    else if (normalizedQuery.length > 3) {
      const queryWords = normalizedQuery.split(/\s+/);
      const titleWords = title.split(/\s+/);
      const matchCount = queryWords.filter(qw => 
        titleWords.some(tw => tw.includes(qw))
      ).length;
      score = (matchCount / queryWords.length) * 30;
    }

    // Boost by recent access
    const daysSinceUpdate = (Date.now() - doc.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceUpdate);

    if (score > 0) {
      suggestions.push({
        id: doc.id,
        title: doc.title,
        type: "document",
        matchScore: score,
        preview: doc.tags.slice(0, 3).join(", ") || doc.type,
      });
    }
  });

  // Sort by score and limit
  return suggestions
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

// ============================================================================
// Backlinks Calculation
// ============================================================================

export function calculateBacklinks(
  documentId: string,
  allDocuments: Array<{
    id: string;
    title: string;
    content: string;
  }>
): BacklinkInfo[] {
  const targetTitle = allDocuments.find(d => d.id === documentId)?.title;
  if (!targetTitle) return [];

  const backlinkMap = new Map<string, BacklinkInfo>();

  allDocuments.forEach(doc => {
    if (doc.id === documentId) return;

    const links = parseBidirectionalLinks(doc.content);
    const matchingLinks = links.filter(link => 
      link.linkText.toLowerCase() === targetTitle.toLowerCase() ||
      link.linkText === documentId
    );

    if (matchingLinks.length > 0) {
      // Create context snippet from first match
      const firstMatch = matchingLinks[0];
      const startIdx = Math.max(0, firstMatch.startIndex - 50);
      const endIdx = Math.min(doc.content.length, firstMatch.endIndex + 50);
      const contextSnippet = doc.content.slice(startIdx, endIdx).replace(/\[\[|\]\]/g, "");

      const existing = backlinkMap.get(doc.id);
      if (existing) {
        existing.linkCount += matchingLinks.length;
      } else {
        backlinkMap.set(doc.id, {
          documentId: doc.id,
          documentTitle: doc.title,
          contextSnippet: `...${contextSnippet}...`,
          linkCount: matchingLinks.length,
        });
      }
    }
  });

  return Array.from(backlinkMap.values()).sort((a, b) => b.linkCount - a.linkCount);
}

export async function getBacklinksForDocument(
  documentId: string
): Promise<BacklinkInfo[]> {
  // Fetch all documents from IndexedDB
  const allDocs = await hdsiDB.documents.toArray();
  
  const docsWithContent = allDocs.map(doc => ({
    id: doc.id,
    title: doc.title,
    content: doc.structure.map(s => s.generatedContent || s.title).join(" "),
  }));

  return calculateBacklinks(documentId, docsWithContent);
}

// ============================================================================
// Graph Building from Links
// ============================================================================

export function buildLinkGraph(
  documents: Array<{ id: string; title: string; content: string }>
): LinkNode[] {
  const nodes = new Map<string, LinkNode>();

  // Initialize nodes
  documents.forEach(doc => {
    nodes.set(doc.id, {
      documentId: doc.id,
      title: doc.title,
      outgoingLinks: [],
      incomingLinks: [],
    });
  });

  // Parse links and build connections
  documents.forEach(doc => {
    const links = parseBidirectionalLinks(doc.content);
    const sourceNode = nodes.get(doc.id);
    if (!sourceNode) return;

    links.forEach(link => {
      // Find target document by title
      const targetDoc = documents.find(d => 
        d.title.toLowerCase() === link.linkText.toLowerCase()
      );

      if (targetDoc) {
        sourceNode.outgoingLinks.push(targetDoc.id);
        
        const targetNode = nodes.get(targetDoc.id);
        if (targetNode) {
          targetNode.incomingLinks.push(doc.id);
        }
      }
    });
  });

  return Array.from(nodes.values());
}

// ============================================================================
// Tiptap/Editor Integration Helpers
// ============================================================================

export function insertLink(text: string, cursorIndex: number, documentTitle: string): {
  newText: string;
  newCursorIndex: number;
} {
  // Find the partial link
  const { isInLink, startIndex } = detectPartialLink(text, cursorIndex);
  
  if (!isInLink) {
    // Insert new link at cursor
    const newText = text.slice(0, cursorIndex) + `[[${documentTitle}]]` + text.slice(cursorIndex);
    return {
      newText,
      newCursorIndex: cursorIndex + documentTitle.length + 4, // After ]]
    };
  }

  // Replace partial link
  const endIndex = text.indexOf("]]", cursorIndex);
  const actualEndIndex = endIndex === -1 ? cursorIndex : endIndex + 2;
  
  const newText = text.slice(0, startIndex) + `[[${documentTitle}]]` + text.slice(actualEndIndex);
  return {
    newText,
    newCursorIndex: startIndex + documentTitle.length + 4,
  };
}

export function removeLink(text: string, linkText: string): string {
  const escapedLinkText = linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\[\\[${escapedLinkText}\\]\\]`, 'g');
  return text.replace(regex, linkText);
}

export function getAllLinkedDocumentIds(text: string): string[] {
  const links = parseBidirectionalLinks(text);
  return [...new Set(links.map(l => l.linkText))];
}

// ============================================================================
// React Hook
// ============================================================================

export function useBidirectionalLinks(currentDocumentId?: string) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);
  
  // Load documents
  useEffect(() => {
    const load = async () => {
      const allDocs = await hdsiDB.documents.toArray();
      const metadata = allDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        type: (doc.metadata?.type as DocumentType) || "draft",
        objectives: (doc.metadata?.objectives as DocumentObjective[]) || [],
        tags: doc.metadata?.tags || [],
        status: "draft" as DocumentStatus,
        stage: "outline" as DocumentStage,
        ownerId: doc.metadata?.author || "unknown",
        ownerName: doc.metadata?.author || "Unknown",
        collaborators: [],
        nodeCount: doc.structure?.length || 0,
        wordCount: 0,
        completionPercentage: 0,
        isFavorite: false,
        isPinned: false,
        isArchived: doc.isDeleted || false,
        priority: "medium" as const,
      } as DocumentMetadata));
      
      setDocuments(metadata);
      setIsLoading(false);
    };
    
    load();
  }, []);

  // Load backlinks when document changes
  useEffect(() => {
    if (!currentDocumentId) {
      setBacklinks([]);
      return;
    }

    const loadBacklinks = async () => {
      const links = await getBacklinksForDocument(currentDocumentId);
      setBacklinks(links);
    };

    loadBacklinks();
  }, [currentDocumentId]);

  const getSuggestions = useCallback((
    query: string,
    limit?: number
  ): LinkSuggestion[] => {
    return generateLinkSuggestions(query, documents, currentDocumentId, limit);
  }, [documents, currentDocumentId]);

  const detectActiveLink = useCallback((
    text: string,
    cursorIndex: number
  ): ReturnType<typeof detectPartialLink> => {
    return detectPartialLink(text, cursorIndex);
  }, []);

  const navigateToLink = useCallback((linkText: string): string | null => {
    const targetDoc = documents.find(d => 
      d.title.toLowerCase() === linkText.toLowerCase()
    );
    if (targetDoc) {
      return `/hdsi?id=${targetDoc.id}`;
    }
    return null;
  }, [documents]);

  return {
    documents,
    isLoading,
    backlinks,
    getSuggestions,
    detectActiveLink,
    navigateToLink,
    parseLinks: parseBidirectionalLinks,
    refreshBacklinks: async () => {
      if (currentDocumentId) {
        const links = await getBacklinksForDocument(currentDocumentId);
        setBacklinks(links);
      }
    },
  };
}

// ============================================================================
// Commands Integration
// ============================================================================

interface TiptapEditorLike {
  chain(): { focus(): { insertContent(content: string): { run(): void } } };
  state: {
    doc: { textBetween(from: number, to: number, separator: string): string };
    selection: { from: number };
  };
}

export const LINK_EDITOR_COMMANDS = {
  openLinkSuggestions: (editor: TiptapEditorLike) => {
    editor.chain().focus().insertContent("[[").run();
  },

  closeLinkSuggestions: (editor: TiptapEditorLike) => {
    const { state } = editor;
    const { selection } = state;
    const textBefore = state.doc.textBetween(0, selection.from, "\n");

    // Check if we're in a partial link and close it
    if (detectPartialLink(textBefore, textBefore.length).isInLink) {
      editor.chain().focus().insertContent("]]").run();
    }
  },

  navigateLink: (editor: TiptapEditorLike, onNavigate: (url: string) => void) => {
    const { state } = editor;
    const { selection } = state;
    const textBefore = state.doc.textBetween(0, selection.from, "\n");
    
    // Find link at cursor position
    const links = parseBidirectionalLinks(textBefore);
    const linkAtCursor = links.find(link => 
      selection.from >= link.startIndex && selection.from <= link.endIndex
    );
    
    if (linkAtCursor) {
      const url = `/hdsi?title=${encodeURIComponent(linkAtCursor.linkText)}`;
      onNavigate(url);
    }
  },
};
