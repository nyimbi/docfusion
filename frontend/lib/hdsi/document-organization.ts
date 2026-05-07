"use client";

/**
 * Document Organization System for HDSI
 * 
 * Provides comprehensive document taxonomy:
 * - Opportunity linkage (RFP/SOW connections)
 * - Folder/workspace hierarchy
 * - Multi-dimensional tagging (type, objective, project, client)
 * - Smart views and filters
 * - Clutter reduction through organization
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { hdsiDB } from "./db";
import type { HDSINode } from "./types";

// ============================================================================
// Document Taxonomy Types
// ============================================================================

export type DocumentType = 
  | "proposal"           // RFP responses, proposals
  | "sow"               // Statement of Work
  | "contract"          // Contracts and agreements
  | "compliance"        // Compliance docs (FAR/DFARS)
  | "technical"         // Technical specifications
  | "whitepaper"        // White papers/research
  | "presentation"      // Slide decks
  | "report"            // Reports and analysis
  | "template"          // Reusable templates
  | "draft";            // Work in progress

export type DocumentObjective =
  | "win-bid"           // Primary: win the contract
  | "compliance-only"   // Just meet requirements
  | "relationship"      // Build client relationship
  | "incumbent"         // Retain existing work
  | "strategic"         // Strategic positioning
  | "learning"          // learning/exploration
  | "reference";        // Reference architecture

export interface DocumentMetadata {
  // Core identification
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Organization - The 6 Dimensions
  opportunityId?: string;      // Link to RFP/Opportunity
  opportunityName?: string;    // Denormalized for display
  folderId?: string;           // Folder/workspace location
  folderPath?: string[];       // Full path for breadcrumbs
  
  // Taxonomy tags
  type: DocumentType;
  objectives: DocumentObjective[];
  projectId?: string;          // Internal project reference
  projectName?: string;
  clientId?: string;           // Client/Agency
  clientName?: string;
  tags: string[];              // Custom tags
  
  // Template tracking
  templateId?: string;
  templateName?: string;
  
  // Status workflow
  status: DocumentStatus;
  stage: DocumentStage;
  
  // AI/Generation metadata
  aiModel?: string;
  generationVersion?: string;
  lastGeneratedAt?: Date;
  
  // Team/Collaboration
  ownerId: string;
  ownerName: string;
  collaborators: string[];
  teamId?: string;
  
  // Content metrics
  nodeCount: number;
  wordCount: number;
  completionPercentage: number;
  
  // Smart features
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: Date;
}

export type DocumentStatus = 
  | "draft"
  | "in-review" 
  | "approved"
  | "submitted"
  | "won"
  | "lost"
  | "archived";

export type DocumentStage =
  | "outline"           // Just structure, no content
  | "content-drafting"  // Populating sections
  | "review"            // Editing/refining
  | "finalizing"        // Final polish
  | "complete";         // Ready for submission

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string[];           // Full path from root
  description?: string;
  color?: string;
  icon?: string;
  documentCount: number;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  isSystem?: boolean;       // Cannot delete (e.g., "All Documents")
}

export interface OpportunityLink {
  id: string;
  name: string;
  agency: string;
  solicitationNumber?: string;
  dueDate?: Date;
  status: "active" | "closed" | "awarded";
  documents: string[];      // Document IDs linked
}

// ============================================================================
// View/Filter System (Clutter Reduction)
// ============================================================================

export interface DocumentView {
  id: string;
  name: string;
  icon: string;
  filters: DocumentFilters;
  sortBy: SortOption;
  groupBy: GroupByOption | null;
  isSystem?: boolean;
}

export interface DocumentFilters {
  // Text search
  searchQuery?: string;
  
  // Taxonomy filters
  types?: DocumentType[];
  objectives?: DocumentObjective[];
  projects?: string[];
  clients?: string[];
  tags?: string[];
  opportunities?: string[];
  folders?: string[];
  
  // Status filters
  statuses?: DocumentStatus[];
  stages?: DocumentStage[];
  
  // Ownership
  ownerId?: string;
  teamId?: string;
  showOnlyMine?: boolean;
  
  // Smart filters
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  priority?: ("low" | "medium" | "high" | "urgent")[];
  dueBefore?: Date;
  dueAfter?: Date;
  
  // Completion
  minCompletion?: number;
  maxCompletion?: number;
}

export type SortOption =
  | "updated-desc" | "updated-asc"
  | "created-desc" | "created-asc"
  | "title-asc" | "title-desc"
  | "due-date-asc" | "due-date-desc"
  | "priority-desc"
  | "completion-desc";

export type GroupByOption =
  | "folder"
  | "type"
  | "objective"
  | "project"
  | "client"
  | "status"
  | "stage"
  | "opportunity"
  | "owner"
  | "due-date";  // Group by week/month

// ============================================================================
// Smart Views (Pre-configured to reduce clutter)
// ============================================================================

export const SMART_VIEWS: DocumentView[] = [
  {
    id: "active",
    name: "Active Work",
    icon: "Zap",
    filters: { isArchived: false, statuses: ["draft", "in-review"] },
    sortBy: "updated-desc",
    groupBy: "due-date",
    isSystem: true,
  },
  {
    id: "urgent",
    name: "Urgent & Due Soon",
    icon: "AlertCircle",
    filters: { 
      isArchived: false, 
      priority: ["high", "urgent"],
    },
    sortBy: "due-date-asc",
    groupBy: null,
    isSystem: true,
  },
  {
    id: "opportunities",
    name: "By Opportunity",
    icon: "Target",
    filters: { isArchived: false, opportunities: [] },  // Has opportunity
    sortBy: "updated-desc",
    groupBy: "opportunity",
    isSystem: true,
  },
  {
    id: "drafts",
    name: "Drafts & Outlines",
    icon: "FileEdit",
    filters: { stages: ["outline", "content-drafting"] },
    sortBy: "updated-desc",
    groupBy: "type",
    isSystem: true,
  },
  {
    id: "my-work",
    name: "My Documents",
    icon: "User",
    filters: { showOnlyMine: true, isArchived: false },
    sortBy: "updated-desc",
    groupBy: "folder",
    isSystem: true,
  },
  {
    id: "favorites",
    name: "Favorites",
    icon: "Star",
    filters: { isFavorite: true, isArchived: false },
    sortBy: "updated-desc",
    groupBy: null,
    isSystem: true,
  },
  {
    id: "templates",
    name: "Templates",
    icon: "LayoutTemplate",
    filters: { types: ["template"] },
    sortBy: "updated-desc",
    groupBy: "type",
    isSystem: true,
  },
  {
    id: "archived",
    name: "Archived",
    icon: "Archive",
    filters: { isArchived: true },
    sortBy: "updated-desc",
    groupBy: "type",
    isSystem: true,
  },
  {
    id: "all",
    name: "All Documents",
    icon: "Files",
    filters: {},
    sortBy: "updated-desc",
    groupBy: "folder",
    isSystem: true,
  },
];

// ============================================================================
// Default Folders
// ============================================================================

export const DEFAULT_FOLDERS: Omit<Folder, "id" | "createdAt" | "updatedAt" | "documentCount">[] = [
  { name: "Proposals", parentId: null, path: ["Proposals"], color: "#3b82f6", icon: "FileText", ownerId: "system" },
  { name: "Compliance", parentId: null, path: ["Compliance"], color: "#f59e0b", icon: "Shield", ownerId: "system" },
  { name: "Technical", parentId: null, path: ["Technical"], color: "#10b981", icon: "Code", ownerId: "system" },
  { name: "Contracts", parentId: null, path: ["Contracts"], color: "#8b5cf6", icon: "FileSignature", ownerId: "system" },
  { name: "Templates", parentId: null, path: ["Templates"], color: "#6b7280", icon: "LayoutTemplate", isSystem: true, ownerId: "system" },
  { name: "Archive", parentId: null, path: ["Archive"], color: "#9ca3af", icon: "Archive", isSystem: true, ownerId: "system" },
];

// ============================================================================
// Utility Functions
// ============================================================================

export function createDocumentMetadata(
  title: string,
  ownerId: string,
  ownerName: string,
  options?: Partial<DocumentMetadata>
): DocumentMetadata {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    type: options?.type || "draft",
    objectives: options?.objectives || [],
    tags: options?.tags || [],
    status: options?.status || "draft",
    stage: options?.stage || "outline",
    ownerId,
    ownerName,
    collaborators: options?.collaborators || [],
    nodeCount: 0,
    wordCount: 0,
    completionPercentage: 0,
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    priority: options?.priority || "medium",
    projectId: options?.projectId,
    projectName: options?.projectName,
    clientId: options?.clientId,
    clientName: options?.clientName,
    opportunityId: options?.opportunityId,
    opportunityName: options?.opportunityName,
    folderId: options?.folderId,
    folderPath: options?.folderPath,
    templateId: options?.templateId,
    templateName: options?.templateName,
    dueDate: options?.dueDate,
    ...options,
  };
}

export function matchesFilters(
  doc: DocumentMetadata,
  filters: DocumentFilters
): boolean {
  // Text search
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    const matches = 
      doc.title.toLowerCase().includes(query) ||
      doc.tags.some(t => t.toLowerCase().includes(query)) ||
      doc.clientName?.toLowerCase().includes(query) ||
      doc.projectName?.toLowerCase().includes(query) ||
      doc.opportunityName?.toLowerCase().includes(query);
    if (!matches) return false;
  }
  
  // Taxonomy
  if (filters.types?.length && !filters.types.includes(doc.type)) return false;
  if (filters.objectives?.length && !doc.objectives.some(o => filters.objectives?.includes(o))) return false;
  if (filters.projects?.length && !filters.projects.includes(doc.projectId || "")) return false;
  if (filters.clients?.length && !filters.clients.includes(doc.clientId || "")) return false;
  if (filters.tags?.length && !filters.tags.every(t => doc.tags.includes(t))) return false;
  if (filters.opportunities?.length && !filters.opportunities.includes(doc.opportunityId || "")) return false;
  if (filters.folders?.length && !filters.folders.includes(doc.folderId || "")) return false;
  
  // Status
  if (filters.statuses?.length && !filters.statuses.includes(doc.status)) return false;
  if (filters.stages?.length && !filters.stages.includes(doc.stage)) return false;
  
  // Ownership
  if (filters.showOnlyMine && doc.ownerId !== filters.ownerId) return false;
  if (filters.ownerId && doc.ownerId !== filters.ownerId) return false;
  
  // Smart
  if (filters.isFavorite !== undefined && doc.isFavorite !== filters.isFavorite) return false;
  if (filters.isPinned !== undefined && doc.isPinned !== filters.isPinned) return false;
  if (filters.isArchived !== undefined && doc.isArchived !== filters.isArchived) return false;
  if (filters.priority?.length && !filters.priority.includes(doc.priority)) return false;
  
  // Dates
  if (filters.dueBefore && doc.dueDate && doc.dueDate > filters.dueBefore) return false;
  if (filters.dueAfter && doc.dueDate && doc.dueDate < filters.dueAfter) return false;
  
  // Completion
  if (filters.minCompletion !== undefined && doc.completionPercentage < filters.minCompletion) return false;
  if (filters.maxCompletion !== undefined && doc.completionPercentage > filters.maxCompletion) return false;
  
  return true;
}

export function sortDocuments(
  docs: DocumentMetadata[],
  sortBy: SortOption
): DocumentMetadata[] {
  const sorted = [...docs];
  
  switch (sortBy) {
    case "updated-desc":
      return sorted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    case "updated-asc":
      return sorted.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    case "created-desc":
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "created-asc":
      return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "due-date-asc":
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    case "due-date-desc":
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return b.dueDate.getTime() - a.dueDate.getTime();
      });
    case "priority-desc":
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return sorted.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    case "completion-desc":
      return sorted.sort((a, b) => b.completionPercentage - a.completionPercentage);
    default:
      return sorted;
  }
}

export function groupDocuments(
  docs: DocumentMetadata[],
  groupBy: GroupByOption
): Map<string, DocumentMetadata[]> {
  const groups = new Map<string, DocumentMetadata[]>();
  
  const getGroupKey = (doc: DocumentMetadata): string => {
    switch (groupBy) {
      case "folder":
        return doc.folderPath?.join("/") || "Uncategorized";
      case "type":
        return doc.type;
      case "objective":
        return doc.objectives[0] || "No Objective";
      case "project":
        return doc.projectName || "No Project";
      case "client":
        return doc.clientName || "No Client";
      case "status":
        return doc.status;
      case "stage":
        return doc.stage;
      case "opportunity":
        return doc.opportunityName || "No Opportunity";
      case "owner":
        return doc.ownerName;
      case "due-date":
        if (!doc.dueDate) return "No Due Date";
        const days = Math.ceil((doc.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0) return "Overdue";
        if (days === 0) return "Due Today";
        if (days <= 7) return "This Week";
        if (days <= 30) return "This Month";
        return "Later";
      default:
        return "All";
    }
  };
  
  for (const doc of docs) {
    const key = getGroupKey(doc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(doc);
  }
  
  return groups;
}

// ============================================================================
// React Hooks
// ============================================================================

export function useDocumentOrganization() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeView, setActiveView] = useState<DocumentView>(SMART_VIEWS[0]);
  const [customFilters, setCustomFilters] = useState<DocumentFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Load documents from IndexedDB with auto-refresh
  useEffect(() => {
    let isMounted = true;
    
    const load = async () => {
      if (!isMounted) return;
      
      const allDocs = await hdsiDB.documents.toArray();
      const metadata = allDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        type: (doc.metadata?.type as DocumentType) || "draft",
        objectives: (doc.metadata?.objectives as DocumentObjective[]) || [],
        tags: doc.metadata?.tags || [],
        status: "draft" as DocumentStatus,  // Could be stored or derived
        stage: "outline" as DocumentStage,   // Could be stored or derived
        ownerId: doc.metadata?.author || "unknown",
        ownerName: doc.metadata?.author || "Unknown",
        collaborators: [],
        nodeCount: doc.structure?.length || 0,
        wordCount: 0,  // Calculate from structure
        completionPercentage: 0,
        isFavorite: false,
        isPinned: false,
        isArchived: doc.isDeleted || false,
        priority: "medium" as const,
        templateId: doc.templateId,
      } as DocumentMetadata));
      
      setDocuments(metadata);
      setIsLoading(false);
    };
    
    // Initial load
    load();
    
    // Auto-refresh every 2 seconds to catch new saves
    const interval = setInterval(load, 2000);
    
    // Also listen for visibility changes to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  
  // Filtered, sorted, grouped documents
  const organizedDocuments = useMemo(() => {
    const viewFilters = { ...activeView.filters, ...customFilters };
    
    // Apply filters
    let filtered = documents.filter(doc => matchesFilters(doc, viewFilters));
    
    // Sort
    filtered = sortDocuments(filtered, activeView.sortBy);
    
    // Group if needed
    if (activeView.groupBy) {
      return groupDocuments(filtered, activeView.groupBy);
    }
    
    return new Map([["All", filtered]]);
  }, [documents, activeView, customFilters]);
  
  // Actions
  const moveToFolder = useCallback(async (docId: string, folderId: string | null) => {
    // Update in IndexedDB
    await hdsiDB.documents.update(docId, { 
      // folderId would need to be added to schema
    });
    
    // Update local state
    setDocuments(prev => prev.map(d => 
      d.id === docId ? { ...d, folderId: folderId || undefined } : d
    ));
  }, []);
  
  const setTags = useCallback(async (docId: string, tags: string[]) => {
    const doc = await hdsiDB.documents.get(docId);
    if (doc) {
      await hdsiDB.documents.update(docId, {
        metadata: { ...doc.metadata, tags }
      });
      
      setDocuments(prev => prev.map(d => 
        d.id === docId ? { ...d, tags } : d
      ));
    }
  }, []);
  
  const setType = useCallback(async (docId: string, type: DocumentType) => {
    const doc = await hdsiDB.documents.get(docId);
    if (doc) {
      await hdsiDB.documents.update(docId, {
        metadata: { ...doc.metadata, type }
      });
      
      setDocuments(prev => prev.map(d => 
        d.id === docId ? { ...d, type } : d
      ));
    }
  }, []);
  
  const toggleFavorite = useCallback(async (docId: string) => {
    setDocuments(prev => prev.map(d => 
      d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d
    ));
  }, []);
  
  const archiveDocument = useCallback(async (docId: string) => {
    await hdsiDB.documents.update(docId, { isDeleted: true });
    setDocuments(prev => prev.map(d => 
      d.id === docId ? { ...d, isArchived: true } : d
    ));
  }, []);
  
  return {
    documents,
    folders,
    organizedDocuments,
    activeView,
    setActiveView,
    customFilters,
    setCustomFilters,
    isLoading,
    moveToFolder,
    setTags,
    setType,
    toggleFavorite,
    archiveDocument,
    smartViews: SMART_VIEWS,
  };
}

// ============================================================================
// Document Browser Component Hook
// ============================================================================

export interface DocumentBrowserOptions {
  initialView?: DocumentView;
  filterByOpportunity?: string;
  filterByProject?: string;
  filterByClient?: string;
  showArchived?: boolean;
}

export function useDocumentBrowser(options: DocumentBrowserOptions = {}) {
  const org = useDocumentOrganization();
  
  // Apply initial filters from options
  useEffect(() => {
    if (options.initialView) {
      org.setActiveView(options.initialView);
    }
    
    const filters: DocumentFilters = {};
    if (options.filterByOpportunity) filters.opportunities = [options.filterByOpportunity];
    if (options.filterByProject) filters.projects = [options.filterByProject];
    if (options.filterByClient) filters.clients = [options.filterByClient];
    if (options.showArchived !== undefined) filters.isArchived = options.showArchived;
    
    org.setCustomFilters(filters);
  }, [options.filterByClient, options.filterByOpportunity, options.filterByProject, options.initialView, options.showArchived, org]);
  
  return {
    ...org,
    totalCount: org.documents.length,
    filteredCount: Array.from(org.organizedDocuments.values()).flat().length,
  };
}
