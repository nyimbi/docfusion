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
  // HDSI-specific fields (optional for backward compatibility)
  expanded?: boolean;
  status?: "outline" | "generating" | "generated" | "error" | "debt" | "deleted";
  tokenBudget?: number;
  customPrompt?: string;
  densityTarget?: number;
  coherenceScore?: number;
  generatedContent?: string;
  generationProgress?: number;
  depth?: number;
  parentId?: string | null;
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

export interface HDSITemplate {
  id: string;
  name: string;
  description?: string;
  structure: DocumentStructure[];
  metadata?: Record<string, unknown>;
}

export interface HDSIProps {
  initialStructure?: DocumentStructure[];
  template?: HDSITemplate;
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
  payload: Partial<HDSINode> & Record<string, unknown>;
  previousState: Partial<HDSINode> & Record<string, unknown>;
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
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: Date;
  error?: string;
}

export interface HDSIYjsState {
  documentId: string;
  ydocState: Uint8Array;
  awarenessState?: Record<string, unknown>;
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
  compareVersions: (from: HDSIVersion, to: HDSIVersion) => Promise<VersionComparison>;
}

export interface VersionComparison {
  from: HDSIVersion;
  to: HDSIVersion;
  added: HDSINode[];
  removed: HDSINode[];
  modified: Array<{ node: HDSINode; changes: Partial<HDSINode> }>;
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
  provider: unknown; // WebrtcProvider instance
  ydoc: unknown; // Y.Doc instance
  awareness: unknown; // Awareness instance
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
// Context Buffer Types (HDSI Specification Conformance)
// ============================================================================

/**
 * Provenance tier for context buffer entries.
 * - local: Content from the current node being generated
 * - sibling: Content from adjacent nodes at the same level
 * - document: Content from parent or document-level context
 */
export type ContextTier = "local" | "sibling" | "document";

/**
 * Individual entry in the context buffer with full provenance tracking.
 * Enables users to understand exactly what context the AI is using.
 */
export interface ContextBufferEntry {
  /** Unique identifier for this entry */
  id: string;
  /** Provenance tier (local, sibling, document) */
  tier: ContextTier;
  /** ID of the source node this content came from */
  sourceNodeId: string;
  /** Title of the source node for display */
  sourceTitle: string;
  /** The actual content included in context */
  content: string;
  /** Token count for this entry */
  tokenCount: number;
  /** Relevance score 0-1 based on embedding similarity */
  relevanceScore: number;
  /** Embedding drift: how much content has changed since last generation */
  embeddingDrift: number;
  /** When this entry was added to the buffer */
  timestamp: Date;
}

/**
 * Complete context buffer state with capacity tracking.
 * The 3800 token cap reserves space for system prompts and response.
 */
export interface ContextBuffer {
  /** All entries currently in the buffer */
  entries: ContextBufferEntry[];
  /** Total tokens currently in buffer */
  totalTokens: number;
  /** Maximum tokens allowed (3800 spec default) */
  maxTokens: number;
  /** Timestamp of last context assembly */
  lastAssembled: Date;
  /** Tokens by tier for visualization */
  tokensByTier: {
    local: number;
    sibling: number;
    document: number;
  };
}

// ============================================================================
// Generation Phase State Machine
// ============================================================================

/**
 * Three-phase generation state machine per HDSI specification.
 * - outline_synthesis: Creating document structure
 * - sequential_expansion: Generating content node-by-node
 * - revision_cycle: Iterating on generated content
 */
export type GenerationPhase =
  | "outline_synthesis"
  | "sequential_expansion"
  | "revision_cycle";

/**
 * Extended phase state with metadata for UI display.
 */
export interface PhaseState {
  /** Current phase */
  current: GenerationPhase;
  /** Nodes processed in current phase */
  processedCount: number;
  /** Total nodes to process in current phase */
  totalCount: number;
  /** Timestamp when phase started */
  startedAt: Date;
  /** Number of revision iterations (only for revision_cycle) */
  revisionIteration?: number;
}

// ============================================================================
// Coherence Debt Types
// ============================================================================

/**
 * Represents detected coherence debt for a node.
 * Triggers visual warning when score < 0.6.
 */
export interface CoherenceDebt {
  /** Node ID with debt */
  nodeId: string;
  /** Coherence score 0-1 (debt when < 0.6) */
  score: number;
  /** Pulse frequency in Hz (0.5-3, higher = more urgent) */
  pulseFrequency: number;
  /** Improvement suggestions from analysis */
  suggestions: string[];
  /** Reason for debt detection */
  reason: "low_similarity" | "terminology_mismatch" | "thematic_drift" | "style_inconsistency";
  /** Related node IDs contributing to the debt */
  relatedNodeIds: string[];
}

/**
 * Document-level coherence metrics.
 */
export interface DocumentCoherence {
  /** Overall document coherence 0-1 */
  overallScore: number;
  /** Nodes with detected debt */
  debtNodes: CoherenceDebt[];
  /** Last analysis timestamp */
  analyzedAt: Date;
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
}

// ============================================================================
// Token Budget Configuration
// ============================================================================

/**
 * Token budget configuration with dual-slider support.
 * Reading time formula: tokens / (225 * 1.3) minutes
 */
export interface TokenBudgetConfig {
  /** Minimum token budget */
  minimum: number;
  /** Maximum token budget */
  maximum: number;
  /** Current target within range */
  current: number;
  /** Estimated reading time in minutes */
  readingTimeMinutes: number;
  /** Absolute cap (3800 for context buffer) */
  absoluteCap: number;
}

/**
 * Calculate reading time from token count.
 * Based on average reading speed of 225 WPM with 1.3x factor for technical content.
 */
export function calculateReadingTime(tokens: number): number {
  const WORDS_PER_TOKEN = 0.75; // Approximate
  const READING_SPEED_WPM = 225;
  const TECHNICAL_FACTOR = 1.3;
  const words = tokens * WORDS_PER_TOKEN;
  return words / (READING_SPEED_WPM / TECHNICAL_FACTOR);
}

/**
 * Create a token budget config with calculated reading time.
 */
export function createTokenBudgetConfig(
  minimum: number,
  maximum: number,
  current?: number
): TokenBudgetConfig {
  const actualCurrent = current ?? Math.round((minimum + maximum) / 2);
  return {
    minimum,
    maximum,
    current: actualCurrent,
    readingTimeMinutes: calculateReadingTime(actualCurrent),
    absoluteCap: 3800,
  };
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
