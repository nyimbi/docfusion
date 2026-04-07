/**
 * Test Factories for HDSI
 * 
 * Provides utilities for creating mock data in tests.
 * All factories guarantee valid HDSINode structures with sensible defaults.
 */

import type { 
  HDSINode, 
  HDSIDocument, 
  HDSIVersion,
  ContextBuffer,
  ContextBufferEntry,
  TokenBudgetConfig,
  DomainType,
  DomainAdapter,
  CoherenceDebt,
  DocumentCoherence,
  PhaseState,
  GenerationPhase,
} from "@/lib/hdsi/types";

// ============================================================================
// ID Generation
// ============================================================================

let idCounter = 0;

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createId(prefix: string = "test"): string {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`;
}

// ============================================================================
// Node Factories
// ============================================================================

export interface CreateNodeOptions {
  id?: string;
  type?: HDSINode["type"];
  title?: string;
  order?: number;
  expanded?: boolean;
  status?: HDSINode["status"];
  tokenBudget?: number;
  customPrompt?: string;
  densityTarget?: number;
  coherenceScore?: number;
  depth?: number;
  parentId?: string | null;
  generatedContent?: string;
  children?: HDSINode[];
}

export function createNode(options: CreateNodeOptions = {}): HDSINode {
  return {
    id: options.id ?? createId("node"),
    type: options.type ?? "section",
    title: options.title ?? `Test Section ${idCounter}`,
    order: options.order ?? idCounter,
    expanded: options.expanded ?? true,
    status: options.status ?? "outline",
    tokenBudget: options.tokenBudget ?? 500,
    customPrompt: options.customPrompt ?? "",
    densityTarget: options.densityTarget ?? 2.5,
    coherenceScore: options.coherenceScore ?? 1.0,
    depth: options.depth ?? 0,
    parentId: options.parentId ?? null,
    generatedContent: options.generatedContent,
    children: options.children ?? [],
  };
}

export function createChapter(options: CreateNodeOptions = {}): HDSINode {
  return createNode({
    type: "chapter",
    title: `Chapter ${idCounter}`,
    tokenBudget: 1000,
    ...options,
  });
}

export function createSection(options: CreateNodeOptions = {}): HDSINode {
  return createNode({
    type: "section",
    title: `Section ${idCounter}`,
    ...options,
  });
}

export function createSubsection(options: CreateNodeOptions = {}): HDSINode {
  return createNode({
    type: "subsection",
    title: `Subsection ${idCounter}`,
    tokenBudget: 300,
    ...options,
    depth: options.depth ?? 1,
  });
}

export function createParagraph(options: CreateNodeOptions = {}): HDSINode {
  return createNode({
    type: "paragraph",
    title: `Paragraph ${idCounter}`,
    tokenBudget: 150,
    ...options,
    depth: options.depth ?? 2,
  });
}

// ============================================================================
// Tree Factories
// ============================================================================

export interface CreateTreeOptions {
  depth?: number;
  breadth?: number; // Children per node
  prefix?: string;
}

export function createTree(options: CreateTreeOptions = {}): HDSINode[] {
  const { depth = 2, breadth = 2 } = options;
  
  function buildLevel(currentDepth: number, parentId: string | null): HDSINode[] {
    if (currentDepth > depth) return [];
    
    const nodes: HDSINode[] = [];
    const count = currentDepth === 0 ? Math.max(1, breadth - 1) : breadth;
    
    for (let i = 0; i < count; i++) {
      const nodeId = createId("node");
      const type: HDSINode["type"] = 
        currentDepth === 0 ? "chapter" :
        currentDepth === 1 ? "section" :
        currentDepth === 2 ? "subsection" : "paragraph";
      
      const node = createNode({
        id: nodeId,
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}`,
        order: i,
        depth: currentDepth,
        parentId,
        children: buildLevel(currentDepth + 1, nodeId),
      });
      
      nodes.push(node);
    }
    
    return nodes;
  }
  
  return buildLevel(0, null);
}

// ============================================================================
// Document Factories
// ============================================================================

export interface CreateDocumentOptions {
  id?: string;
  title?: string;
  structure?: HDSINode[];
  createdAt?: Date;
  updatedAt?: Date;
  syncVersion?: number;
  metadata?: HDSIDocument["metadata"];
}

export function createDocument(options: CreateDocumentOptions = {}): HDSIDocument {
  const now = new Date();
  
  return {
    id: options.id ?? createId("doc"),
    title: options.title ?? "Test Document",
    structure: options.structure ?? createTree({ depth: 2, breadth: 2 }),
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
    syncVersion: options.syncVersion ?? 0,
    metadata: options.metadata ?? {
      author: "Test Author",
    },
  };
}

// ============================================================================
// Version Factories
// ============================================================================

export interface CreateVersionOptions {
  id?: string;
  documentId?: string;
  structure?: HDSINode[];
  author?: string;
  description?: string;
  timestamp?: Date;
  isAutoSave?: boolean;
}

export function createVersion(options: CreateVersionOptions = {}): HDSIVersion {
  return {
    id: options.id ?? createId("ver"),
    documentId: options.documentId ?? createId("doc"),
    structure: options.structure ?? createTree({ depth: 1, breadth: 2 }),
    author: options.author ?? "Test Author",
    description: options.description ?? "Test version",
    timestamp: options.timestamp ?? new Date(),
    isAutoSave: options.isAutoSave ?? false,
  };
}

// ============================================================================
// Context Buffer Factories
// ============================================================================

export interface CreateContextEntryOptions {
  id?: string;
  tier?: "local" | "sibling" | "document";
  sourceNodeId?: string;
  sourceTitle?: string;
  content?: string;
  tokenCount?: number;
  relevanceScore?: number;
  embeddingDrift?: number;
  timestamp?: Date;
}

export function createContextEntry(options: CreateContextEntryOptions = {}): ContextBufferEntry {
  const tier = options.tier ?? "local";
  const content = options.content ?? `Test content for ${tier} context`;
  
  return {
    id: options.id ?? createId("ctx"),
    tier,
    sourceNodeId: options.sourceNodeId ?? createId("node"),
    sourceTitle: options.sourceTitle ?? `Source Node`,
    content,
    tokenCount: options.tokenCount ?? Math.ceil(content.length / 4),
    relevanceScore: options.relevanceScore ?? 0.8,
    embeddingDrift: options.embeddingDrift ?? 0,
    timestamp: options.timestamp ?? new Date(),
  };
}

export interface CreateContextBufferOptions {
  entries?: ContextBufferEntry[];
  totalTokens?: number;
  maxTokens?: number;
}

export function createContextBuffer(options: CreateContextBufferOptions = {}): ContextBuffer {
  const entries = options.entries ?? [
    createContextEntry({ tier: "local" }),
    createContextEntry({ tier: "sibling" }),
    createContextEntry({ tier: "document" }),
  ];
  
  const totalTokens = options.totalTokens ?? entries.reduce((sum, e) => sum + e.tokenCount, 0);
  
  return {
    entries,
    totalTokens,
    maxTokens: options.maxTokens ?? 3800,
    lastAssembled: new Date(),
    tokensByTier: {
      local: entries.filter(e => e.tier === "local").reduce((sum, e) => sum + e.tokenCount, 0),
      sibling: entries.filter(e => e.tier === "sibling").reduce((sum, e) => sum + e.tokenCount, 0),
      document: entries.filter(e => e.tier === "document").reduce((sum, e) => sum + e.tokenCount, 0),
    },
  };
}

// ============================================================================
// Domain Factories
// ============================================================================

export function createDomainAdapter(domain: DomainType = "general"): DomainAdapter {
  const adapters: Record<DomainType, Partial<DomainAdapter>> = {
    "far-compliance": {
      name: "FAR Compliance",
      description: "Federal Acquisition Regulation compliance",
      triggerWords: ["FAR", "clause", "contract"],
      temperature: 0.3,
    },
    "dfars-compliance": {
      name: "DFARS Compliance",
      description: "Defense Federal Acquisition Regulation",
      triggerWords: ["DFARS", "DoD", "security"],
      temperature: 0.3,
    },
    "technical-spec": {
      name: "Technical Specification",
      description: "Technical specifications",
      triggerWords: ["SYSML", "architecture", "system"],
      temperature: 0.4,
    },
    "academic": {
      name: "Academic Paper",
      description: "Academic writing",
      triggerWords: ["research", "study", "methodology"],
      temperature: 0.5,
    },
    "grant-proposal": {
      name: "Grant Proposal",
      description: "Funding proposals",
      triggerWords: ["grant", "funding", "NSF"],
      temperature: 0.5,
    },
    "medical-device": {
      name: "Medical Device FDA",
      description: "FDA submissions",
      triggerWords: ["FDA", "510(k)", "clinical"],
      temperature: 0.3,
    },
    "software-rfp": {
      name: "Software RFP",
      description: "Software procurement",
      triggerWords: ["software", "Agile", "API"],
      temperature: 0.4,
    },
    "construction": {
      name: "Construction",
      description: "Construction contracts",
      triggerWords: ["construction", "contractor", "AIA"],
      temperature: 0.4,
    },
    "general": {
      name: "General",
      description: "General writing",
      triggerWords: [],
      temperature: 0.7,
    },
  };
  
  const config = adapters[domain];
  
  return {
    id: domain,
    name: config.name ?? "General",
    description: config.description ?? "General purpose",
    baseModel: "gpt-4",
    adapterPath: `docfusion/lora-${domain}`,
    triggerWords: config.triggerWords ?? [],
    temperature: config.temperature ?? 0.7,
    maxTokens: 2000,
    systemPrompt: `You are a ${config.name} expert.`,
  };
}

// ============================================================================
// Coherence Factories
// ============================================================================

export interface CreateCoherenceDebtOptions {
  nodeId?: string;
  score?: number;
  pulseFrequency?: number;
  suggestions?: string[];
  reason?: CoherenceDebt["reason"];
  relatedNodeIds?: string[];
}

export function createCoherenceDebt(options: CreateCoherenceDebtOptions = {}): CoherenceDebt {
  const score = options.score ?? 0.5;
  
  return {
    nodeId: options.nodeId ?? createId("node"),
    score,
    pulseFrequency: options.pulseFrequency ?? (3.0 - (score / 0.6) * 2.5),
    suggestions: options.suggestions ?? ["Review content for consistency"],
    reason: options.reason ?? "low_similarity",
    relatedNodeIds: options.relatedNodeIds ?? [],
  };
}

export interface CreateDocumentCoherenceOptions {
  overallScore?: number;
  debtNodes?: CoherenceDebt[];
  isAnalyzing?: boolean;
}

export function createDocumentCoherence(options: CreateDocumentCoherenceOptions = {}): DocumentCoherence {
  return {
    overallScore: options.overallScore ?? 0.8,
    debtNodes: options.debtNodes ?? [],
    analyzedAt: new Date(),
    isAnalyzing: options.isAnalyzing ?? false,
  };
}

// ============================================================================
// Phase State Factories
// ============================================================================

export interface CreatePhaseStateOptions {
  current?: GenerationPhase;
  processedCount?: number;
  totalCount?: number;
  startedAt?: Date;
  revisionIteration?: number;
}

export function createPhaseState(options: CreatePhaseStateOptions = {}): PhaseState {
  return {
    current: options.current ?? "outline_synthesis",
    processedCount: options.processedCount ?? 0,
    totalCount: options.totalCount ?? 10,
    startedAt: options.startedAt ?? new Date(),
    revisionIteration: options.revisionIteration,
  };
}

// ============================================================================
// Token Budget Factories
// ============================================================================

export interface CreateTokenBudgetOptions {
  minimum?: number;
  maximum?: number;
  current?: number;
}

export function createTokenBudget(options: CreateTokenBudgetOptions = {}): TokenBudgetConfig {
  const min = options.minimum ?? 300;
  const max = options.maximum ?? 800;
  const current = options.current ?? Math.round((min + max) / 2);
  
  const WORDS_PER_TOKEN = 0.75;
  const READING_SPEED_WPM = 225;
  const TECHNICAL_FACTOR = 1.3;
  const words = current * WORDS_PER_TOKEN;
  const readingTimeMinutes = words / (READING_SPEED_WPM / TECHNICAL_FACTOR);
  
  return {
    minimum: min,
    maximum: max,
    current,
    readingTimeMinutes,
    absoluteCap: 3800,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flatten a tree of nodes into an array (pre-order traversal)
 */
export function flattenNodes(nodes: HDSINode[]): HDSINode[] {
  const result: HDSINode[] = [];
  
  function walk(nodeList: HDSINode[]) {
    for (const node of nodeList) {
      result.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }
  
  walk(nodes);
  return result;
}

/**
 * Find a node by ID in a tree
 */
export function findNodeById(nodes: HDSINode[], id: string): HDSINode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Count total nodes in a tree
 */
export function countNodes(nodes: HDSINode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
}

/**
 * Create a node map for O(1) lookups
 */
export function createNodeMap(nodes: HDSINode[]): Map<string, HDSINode> {
  const map = new Map<string, HDSINode>();

  function walk(nodeList: HDSINode[]) {
    for (const node of nodeList) {
      map.set(node.id, node);
      walk(node.children);
    }
  }

  walk(nodes);
  return map;
}

// ============================================================================
// Opportunity Factories
// ============================================================================

import type {
  Opportunity,
  OpportunityInput,
  OpportunityListItem,
  DecisionStatus,
  PriorityRank,
  RevenuePotential,
  OpportunityType,
  OpportunityImport,
  ImportStatus,
} from "@/lib/types/opportunity";

export interface CreateOpportunityOptions {
  id?: string;
  sourceId?: string | null;
  title?: string;
  category?: string | null;
  itCategory?: string | null;
  sector?: string | null;
  countryRegion?: string | null;
  organization?: string | null;
  funder?: string | null;
  deadline?: Date | null;
  daysLeft?: number | null;
  isExpired?: boolean;
  budgetValue?: string | null;
  budgetNumeric?: number | null;
  budgetCurrency?: string | null;
  projectSummary?: string | null;
  projectScope?: string | null;
  keyRequirements?: string | null;
  technicalRequirements?: string | null;
  submissionMethod?: string | null;
  submissionRequirements?: string | null;
  rfpLink?: string | null;
  sourcePlatform?: string | null;
  sourceFile?: string | null;
  opportunityType?: OpportunityType;
  priorityRank?: PriorityRank;
  fitScore?: number | null;
  winProbability?: number | null;
  revenuePotential?: RevenuePotential | null;
  strategicNotes?: string | null;
  decisionStatus?: DecisionStatus;
  decisionReason?: string | null;
  assignedTo?: string | null;
  isReviewed?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
  importedAt?: Date;
}

/**
 * Create a test Opportunity with sensible defaults.
 * All fields are overridable via options.
 */
export function createOpportunity(options: CreateOpportunityOptions = {}): Opportunity {
  const now = new Date();
  const deadline = options.deadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: options.id ?? createId("opp"),
    sourceId: options.sourceId ?? null,
    title: options.title ?? `Test Opportunity ${idCounter}`,
    category: options.category ?? "Technology",
    itCategory: options.itCategory ?? null,
    sector: options.sector ?? "Public",
    countryRegion: options.countryRegion ?? "Kenya",
    organization: options.organization ?? "Test Organization",
    funder: options.funder ?? null,
    deadline,
    daysLeft: options.daysLeft ?? 30,
    isExpired: options.isExpired ?? false,
    budgetValue: options.budgetValue ?? "$100,000",
    budgetNumeric: options.budgetNumeric ?? 100000,
    budgetCurrency: options.budgetCurrency ?? "USD",
    projectSummary: options.projectSummary ?? "Test project summary for opportunity.",
    projectScope: options.projectScope ?? null,
    keyRequirements: options.keyRequirements ?? null,
    technicalRequirements: options.technicalRequirements ?? null,
    submissionMethod: options.submissionMethod ?? "portal",
    submissionRequirements: options.submissionRequirements ?? null,
    rfpLink: options.rfpLink ?? "https://example.com/rfp/test",
    sourcePlatform: options.sourcePlatform ?? null,
    sourceFile: options.sourceFile ?? null,
    opportunityType: options.opportunityType ?? "rfp",
    priorityRank: options.priorityRank ?? 3,
    fitScore: options.fitScore ?? 75,
    winProbability: options.winProbability ?? null,
    revenuePotential: options.revenuePotential ?? "medium",
    strategicNotes: options.strategicNotes ?? null,
    decisionStatus: options.decisionStatus ?? "pending",
    decisionReason: options.decisionReason ?? null,
    assignedTo: options.assignedTo ?? null,
    isReviewed: options.isReviewed ?? false,
    tags: options.tags ?? [],
    metadata: options.metadata ?? null,
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
    importedAt: options.importedAt ?? now,
  };
}

/**
 * Create a test OpportunityListItem (subset of Opportunity for list views).
 */
export function createOpportunityListItem(
  options: Partial<OpportunityListItem> = {}
): OpportunityListItem {
  const full = createOpportunity(options as CreateOpportunityOptions);
  return {
    id: full.id,
    sourceId: full.sourceId,
    title: full.title,
    category: full.category,
    countryRegion: full.countryRegion,
    organization: full.organization,
    deadline: full.deadline,
    daysLeft: full.daysLeft,
    isExpired: full.isExpired,
    budgetValue: full.budgetValue,
    priorityRank: full.priorityRank,
    fitScore: full.fitScore,
    decisionStatus: full.decisionStatus,
    assignedTo: full.assignedTo,
    tags: full.tags,
    rfpLink: full.rfpLink,
    ...options,
  };
}

/**
 * Create a test OpportunityInput for create/update operations.
 */
export function createOpportunityInput(
  options: Partial<OpportunityInput> = {}
): OpportunityInput {
  return {
    title: options.title ?? `New Opportunity ${++idCounter}`,
    category: options.category ?? "Technology",
    countryRegion: options.countryRegion ?? "Kenya",
    organization: options.organization ?? "Test Organization",
    deadline: options.deadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    budgetValue: options.budgetValue ?? "$50,000",
    budgetNumeric: options.budgetNumeric ?? 50000,
    budgetCurrency: options.budgetCurrency ?? "USD",
    projectSummary: options.projectSummary ?? "Test project summary.",
    opportunityType: options.opportunityType ?? "rfp",
    ...options,
  };
}

/**
 * Create a test OpportunityImport record.
 */
export function createOpportunityImport(
  options: Partial<OpportunityImport> = {}
): OpportunityImport {
  const now = new Date();
  return {
    id: options.id ?? createId("import"),
    filename: options.filename ?? "test-import.xlsx",
    filePath: options.filePath ?? "/uploads/test-import.xlsx",
    totalRecords: options.totalRecords ?? 10,
    importedRecords: options.importedRecords ?? 8,
    updatedRecords: options.updatedRecords ?? 1,
    skippedRecords: options.skippedRecords ?? 1,
    failedRecords: options.failedRecords ?? 0,
    status: options.status ?? "completed",
    errors: options.errors ?? [],
    config: options.config ?? null,
    importedBy: options.importedBy ?? "test-user",
    startedAt: options.startedAt ?? now,
    completedAt: options.completedAt ?? now,
  };
}

// ============================================================================
// Batch Factory Helpers
// ============================================================================

/**
 * Create an array of test opportunities with incrementing properties.
 * Useful for testing list views, pagination, and filtering.
 */
export function createOpportunityBatch(
  count: number,
  baseOptions: CreateOpportunityOptions = {}
): Opportunity[] {
  return Array.from({ length: count }, (_, i) =>
    createOpportunity({
      title: `Opportunity ${i + 1}`,
      priorityRank: ((i % 5) + 1) as PriorityRank,
      ...baseOptions,
    })
  );
}
