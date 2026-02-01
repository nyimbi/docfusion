"use client";

/**
 * Core HDSI Type Definitions
 * Shared types to avoid circular dependencies
 */

// ============================================================================
// Core Document Types
// ============================================================================

export interface DocumentStructure {
  id: string;
  type: "chapter" | "section" | "subsection" | "paragraph";
  title: string;
  order: number;
  children?: DocumentStructure[];
  length?: "brief" | "medium" | "comprehensive";
}

export interface HDSINode extends DocumentStructure {
  expanded: boolean;
  status: "outline" | "generating" | "generated" | "error" | "debt" | "deleted";
  tokenBudget: number;
  /** Timestamp when the node was soft-deleted */
  deletedAt?: string;
  customPrompt: string;
  densityTarget: number;
  coherenceScore: number;
  children: HDSINode[];
  generatedContent?: string;
  generationProgress?: number;
  depth: number;
  parentId?: string | null;
  aiConfig?: AIModelConfig;
  diagramData?: {
    name?: string;
    format?: string;
    code?: string;
    svg?: string;
  };
}

// ============================================================================
// Editor Types
// ============================================================================

export interface HDSIProps {
  initialStructure?: DocumentStructure[];
  template?: any; // Template type
  documentId?: string;
  onStructureChange?: (structure: HDSINode[]) => void;
  onSave?: (structure: HDSINode[]) => Promise<void>;
}

export interface AIModelConfig {
  provider: "azure" | "openai" | "anthropic" | "local";
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface TreeViewProps {
  nodes: HDSINode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onGenerate: (id: string) => void;
  virtualItems?: Array<{
    key: string;
    index: number;
    start: number;
    size: number;
  }>;
}

// ============================================================================
// History Types
// ============================================================================

export type CommandType = "add" | "delete" | "update" | "move" | "expand" | "generate";

export interface Command {
  id: string;
  type: CommandType;
  nodeId: string;
  payload: any;
  previousState: any;
  description: string;
  timestamp: number;
}

export interface HistoryState {
  commands: Command[];
  index: number;
  canUndo: boolean;
  canRedo: boolean;
}

// ============================================================================
// AI Generation Types
// ============================================================================

export interface ModelConfig {
  provider: "azure" | "openai" | "anthropic" | "local";
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface GenerationOptions {
  model?: ModelConfig;
  streaming?: boolean;
  onProgress?: (progress: GenerationProgress) => void;
  contextNodes?: HDSINode[];
  retryAttempts?: number;
  timeoutMs?: number;
}

export interface GenerationProgress {
  phase: "outline" | "content" | "refinement";
  nodeId: string;
  percentage: number;
  tokensUsed: number;
  chunk?: string;
}

export interface GenerationResult {
  content: string;
  tokensUsed: number;
  latencyMs: number;
  model: string;
  coherenceScore: number;
}

// ============================================================================
// Database Types
// ============================================================================

export interface HDSIDocument {
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

export interface HDSIVersion {
  id: string;
  documentId: string;
  structure: HDSINode[];
  author: string;
  description: string;
  timestamp: Date;
  isAutoSave: boolean;
}

export interface HDSISyncQueue {
  id: string;
  documentId: string;
  operation: "update" | "delete";
  payload: any;
  attempts: number;
  createdAt: Date;
  error?: string;
}

export interface HDSIYjsState {
  documentId: string;
  ydocState: Uint8Array;
  awarenessState?: any;
  updatedAt: Date;
}

// ============================================================================
// Hooks Types
// ============================================================================

export interface UseHDSIDocumentOptions {
  documentId?: string;
  autoSaveInterval?: number;
  onSaved?: (doc: HDSIDocument) => void;
}

export interface UseHDSIDocumentResult {
  document: HDSIDocument | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  save: (structure: HDSINode[], title?: string) => Promise<void>;
  triggerSave: () => void;
}

export interface UseHDSIVersionHistoryResult {
  versions: HDSIVersion[];
  isLoading: boolean;
  error: Error | null;
  restoreVersion: (version: HDSIVersion) => Promise<HDSIDocument>;
  compareVersions: (from: HDSIVersion, to: HDSIVersion) => Promise<any>;
}

export interface UseHDSIAllDocumentsResult {
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

// ============================================================================
// Phase 2: Collaboration Types
// ============================================================================

export interface CollaborationSession {
  documentId: string;
  provider: any; // WebrtcProvider
  ydoc: any; // Y.Doc
  awareness: any;
  localClientId: number;
}

export interface UserPresence {
  clientId: number;
  userId: string;
  userName: string;
  userColor: string;
  cursor: {
    nodeId: string | null;
    selection: { start: number; end: number } | null;
  } | null;
  lastSeen: Date;
}

// ============================================================================
// Phase 2: AI & Streaming Types
// ============================================================================

export interface TokenStream {
  token: string;
  alternatives?: { token: string; probability: number }[];
  confidence: number;
  isComplete: boolean;
}

export interface StreamProgress {
  tokensGenerated: number;
  tokensTotal: number;
  charactersGenerated: number;
  latencyMs: number;
}

export interface GenerationStream {
  content: string;
  isComplete: boolean;
  progress: StreamProgress;
  error?: string;
}

// ============================================================================
// Phase 2: Embeddings & RAG Types
// ============================================================================

export interface EmbeddingVector {
  nodeId: string;
  embedding: number[];
  metadata: {
    title: string;
    type: string;
    content: string;
    path: string[];
  };
  createdAt: Date;
}

export interface SearchResult {
  nodeId: string;
  score: number;
  metadata: EmbeddingVector["metadata"];
}

export interface SemanticCluster {
  id: string;
  centroid: number[];
  members: string[];
  coherence: number;
}

export interface RAGSource {
  type: "document" | "web" | "template" | "regulation";
  id: string;
  title: string;
  content: string;
  relevance: number;
  path?: string[];
}

export interface Citation {
  id: string;
  sourceId: string;
  text: string;
  url?: string;
}

export interface RAGContext {
  sources: RAGSource[];
  combinedPrompt: string;
  estimatedTokens: number;
  citations: Citation[];
}

// ============================================================================
// Phase 2: Coherence Types
// ============================================================================

export interface CoherenceReport {
  overallScore: number;
  termConsistency: number;
  thematicDrift: number;
  suggestions: string[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type FlattenedNode = {
  node: HDSINode;
  index: number;
  depth: number;
  parentId: string | null;
};

export type TreeDiff = {
  added: HDSINode[];
  removed: HDSINode[];
  modified: Array<{ node: HDSINode; changes: Partial<HDSINode> }>;
};

// ============================================================================
// Phase 3: Domain Model Types
// ============================================================================

export type DomainType = 
  | "far-compliance"
  | "dfars-compliance"
  | "technical-spec"
  | "academic"
  | "grant-proposal"
  | "medical-device"
  | "software-rfp"
  | "construction"
  | "general";

export interface DomainAdapter {
  id: DomainType;
  name: string;
  description: string;
  baseModel: string;
  adapterPath: string;
  triggerWords: string[];
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface DomainDetectionResult {
  detectedDomain: DomainType;
  confidence: number;
  triggerMatches: string[];
  suggestedAdapter: DomainAdapter;
}

export interface DomainGenerationOptions {
  domain: DomainType;
  prompt: string;
  nodeContext?: HDSINode;
  streaming?: boolean;
  onProgress?: (progress: { tokens: number; content: string }) => void;
}

export interface DomainGenerationResult {
  content: string;
  domain: DomainType;
  adapterUsed: DomainAdapter;
  tokensUsed: number;
  complianceScore?: number;
}

// ============================================================================
// Phase 3: Predictive Generation Types
// ============================================================================

export interface PredictionCandidate {
  nodeId: string;
  node: HDSINode;
  confidence: number;
  predictedDelay: number;
  priority: number;
}

export interface PredictedContent {
  nodeId: string;
  content: string;
  generatedAt: Date;
  model: string;
  tokensUsed: number;
  isStale: boolean;
}

export interface PredictionStats {
  totalPredictions: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatency: number;
  hitRate: number;
}

// ============================================================================
// Phase 3: Style Guide Types
// ============================================================================

export type RuleSeverity = "error" | "warning" | "suggestion";
export type RuleCategory = 
  | "tone"
  | "terminology"
  | "readability"
  | "bias"
  | "accessibility"
  | "grammar"
  | "consistency";

export interface Violation {
  ruleId: string;
  category: RuleCategory;
  severity: RuleSeverity;
  message: string;
  start: number;
  end: number;
  suggestion?: string;
  context: string;
}

export interface StyleReport {
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  readabilityScore: number;
  gradeLevel: number;
  avgSentenceLength: number;
  avgWordLength: number;
  passiveVoicePercent: number;
}

// ============================================================================
// Phase 3: Voice Interface Types
// ============================================================================

export type VoiceCommandType = 
  | "add_node"
  | "delete_node"
  | "move_node"
  | "rename_node"
  | "generate_content"
  | "expand_node"
  | "collapse_node"
  | "select_node"
  | "undo"
  | "redo"
  | "save"
  | "unknown";

export interface VoiceCommand {
  type: VoiceCommandType;
  confidence: number;
  rawText: string;
  entities: {
    targetNode?: string;
    newName?: string;
    parentNode?: string;
    position?: "before" | "after" | "child";
    nodeType?: "chapter" | "section" | "subsection" | "paragraph";
  };
  parsedAt: Date;
}

export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  lastCommand: VoiceCommand | null;
  error: string | null;
  permissions: "granted" | "denied" | "prompt" | "unknown";
}

// ============================================================================
// Phase 3: Diagram Generation Types
// ============================================================================

export type DiagramType = 
  | "architecture"
  | "flowchart"
  | "sequence"
  | "class"
  | "er"
  | "mindmap"
  | "gantt"
  | "state"
  | "infographic"
  | "concept";

export interface DiagramGeneration {
  type: DiagramType;
  prompt: string;
  format: "mermaid" | "svg" | "png" | "url";
  content: string;
  caption?: string;
  altText: string;
  generatedAt: Date;
  model: string;
}

// ============================================================================
// Phase 3: Compliance Types
// ============================================================================

export type RegulationType = "FAR" | "DFARS" | "FAR_NF" | "AI" | "GDPR" | "HIPAA" | "SOX" | "custom";

export interface RegulationClause {
  id: string;
  regulation: RegulationType;
  number: string;
  title: string;
  fullText?: string;
  applicability: "all" | "small_business" | "large_business" | "commercial" | "non_commercial";
  mandatory: boolean;
  flowDown: boolean;
  keywords: string[];
}

export interface ComplianceRequirement {
  clause: RegulationClause;
  citedInDocument: boolean;
  satisfiedBy: string[];
  status: "missing" | "partial" | "complete" | "exempt";
  gapDescription?: string;
}

export interface TraceabilityMatrix {
  requirements: ComplianceRequirement[];
  traceability: Map<string, string[]>;
  coverage: number;
  gaps: ComplianceRequirement[];
}

export interface ComplianceReport {
  documentId: string;
  regulation: RegulationType;
  analyzedAt: Date;
  matrix: TraceabilityMatrix;
  score: number;
  criticalGaps: number;
  recommendations: string[];
}

// ============================================================================
// Phase 3: Eye Tracking Types
// ============================================================================

export interface EyePosition {
  x: number;
  y: number;
  timestamp: number;
  confidence: number;
}

export interface GazeData {
  position: EyePosition;
  elementId: string | null;
  elementRect: DOMRect | null;
  fixationDuration: number;
  saccadeVelocity: number;
}

export interface AttentionMetrics {
  totalSessionTime: number;
  activeFocusTime: number;
  averageFocusDuration: number;
  attentionDrift: number;
  readingPattern: "linear" | "scanning" | "selective" | "unknown";
  fatigueScore: number;
  elementVisits: Map<string, { count: number; totalTime: number }>;
}

export interface EyeTrackingConfig {
  enabled: boolean;
  sampleRate: number;
  fixationThreshold: number;
  fatigueCheckInterval: number;
  expandOnGaze: boolean;
  preLoadDistance: number;
}

// ============================================================================
// Missing StyleRule type
// ============================================================================

export interface StyleRule {
  id: string;
  name: string;
  category: RuleCategory;
  description: string;
  severity: RuleSeverity;
  enabled: boolean;
  check: (text: string) => Violation[];
  autoFix?: (text: string, violation: Violation) => string;
}
