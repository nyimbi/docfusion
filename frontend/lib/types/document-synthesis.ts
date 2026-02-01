export type DocumentConfig = DocumentSpec;/**
 * Hierarchical Document Synthesis (HDS) Types - DocFusion
 *
 * Type definitions for the Hierarchical Document Synthesis Architecture (HDSA).
 * This system manages document generation through a structured tree approach with
 * controlled context assembly and coherence tracking.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Document specification for synthesis.
 * Defines the high-level requirements for document generation.
 */
export interface DocumentSpec {
	id: string;
	title: string;
	documentType: string;
	targetAudience: string;
	tone: "formal" | "professional" | "friendly" | "technical";
	wordCountTarget: number;
	requirements: string[];
	styleGuide?: string;
	complianceStandards?: string[];
}

/**
 * Node type in the structural tree hierarchy.
 */
export type NodeType = "chapter" | "section" | "subsection" | "paragraph";

/**
 * Generation status for a structural node.
 */
export type NodeStatus =
	| "pending"
	| "generating"
	| "completed"
	| "regenerating"
	| "failed";

/**
 * Metadata for node generation control and tracking.
 */
export interface NodeMetadata {
	/** Custom prompt for this specific node */
	customPrompt: string;
	/** Absolute token budget for this node */
	tokenBudget: number;
	/** Relative to parent (1.8x default) */
	lengthFactor?: number;
	/** Target density: propositions per 100 tokens */
	densityTarget: number;
	/** Semantic embedding of generated content */
	semanticEmbedding?: number[];
	/** Hash of generated content for change detection */
	generatedContentHash?: string;
	/** Estimated word count based on token budget */
	estimatedWordCount: number;
	/** Estimated reading time in minutes */
	estimatedReadingTime: number;
}

/**
 * Structural node representing a section of the document.
 */
export interface StructuralNode {
	/** Unique identifier */
	uuid: string;
	/** Path in hierarchy (e.g., "1.2.3") */
	path: string;
	/** Type of structural element */
	type: NodeType;
	/** Parent node ID (null for root nodes) */
	parentId: string | null;
	/** Child node UUIDs */
	children: string[];
	/** Node metadata with generation controls */
	metadata: NodeMetadata;
	/** Current generation status */
	status: NodeStatus;
	/** Generated content (when available) */
	content?: string;
	/** Generation timestamp */
	generatedAt?: string;
	/** Error message if generation failed */
	error?: string;
}

/**
 * Archived context entry for semantic retrieval.
 */
export interface ArchivedContext {
	/** Node UUID that generated this context */
	nodeId: string;
	/** Content summary for reference */
	summary: string;
	/** Semantic embedding for similarity search */
	embedding: number[];
	/** Original token count */
	tokenCount: number;
	/** Timestamp when archived */
	archivedAt: string;
}

/**
 * Context buffer for maintaining coherence during generation.
 */
export interface ContextBuffer {
	/** Sliding window of recent context (max 4k tokens) */
	slidingWindow: string;
	/** Archived context entries for semantic retrieval */
	archive: ArchivedContext[];
	/** Registered terminology for consistency */
	terminologicalRegistry: string[];
	/** Current rhetorical mode/style */
	rhetoricalMode: string;
}

/**
 * Document State Object (DSO) - The complete synthesis state.
 */
export interface DocumentStateObject {
	/** Original document specification */
	documentSpec: DocumentSpec;
	/** All structural nodes indexed by UUID */
	structuralTree: StructuralNode[];
	/** Context buffer for coherence */
	contextBuffer: ContextBuffer;
	/** Generation progress tracking */
	progress?: GenerationProgress;
}

// ============================================================================
// Generation Control Types
// ============================================================================

/**
 * Generation phase for progress tracking.
 */
export type GenerationPhase =
	| "outline"
	| "context_assembly"
	| "content_generation"
	| "validation"
	| "complete";

/**
 * Progress tracking for document synthesis.
 */
export interface GenerationProgress {
	/** Current phase */
	phase: GenerationPhase;
	/** Current node being processed */
	currentNodeId: string | null;
	/** Nodes completed */
	completedNodes: number;
	/** Total nodes to process */
	totalNodes: number;
	/** Percentage complete (0-100) */
	percentage: number;
	/** Estimated time remaining in seconds */
	estimatedTimeRemaining?: number;
	/** Started timestamp */
	startedAt: string;
	/** Completed timestamp */
	completedAt?: string;
}

/**
 * Context assembly result for a node.
 */
export interface AssembledContext {
	/** Full content of parent nodes */
	parentContent: string;
	/** Summaries of sibling nodes */
	siblingSummaries: string[];
	/** Semantically similar archived context */
	archivedSimilarContext: string[];
	/** Combined context string */
	fullContext: string;
	/** Total token count */
	tokenCount: number;
}

/**
 * Generation result with quality metrics.
 */
export interface GenerationResult {
	/** Generated content */
	content: string;
	/** Token count used */
	tokenCount: number;
	/** Coherence score vs parent (0-1) */
	coherenceScore: number;
	/** Semantic embedding of content */
	embedding: number[];
	/** Generation timestamp */
	generatedAt: string;
	/** Model/provider used */
	model: string;
	provider: string;
}

/**
 * Validation result for generated content.
 */
export interface ValidationResult {
	/** Whether content passed validation */
	isValid: boolean;
	/** Coherence score (0-1) */
	coherenceScore: number;
	/** Issues found */
	issues: ValidationIssue[];
	/** Suggested fixes */
	suggestions: string[];
}

/**
 * Validation issue type.
 */
export interface ValidationIssue {
	/** Issue type */
	type: "coherence" | "length" | "density" | "tone" | "redundancy";
	/** Severity level */
	severity: "critical" | "warning" | "info";
	/** Issue description */
	message: string;
	/** Location in content if applicable */
	location?: { start: number; end: number };
}

/**
 * Comprehensive quality metrics for generated content.
 * Provides multiple dimensions of content quality assessment.
 */
export interface QualityMetrics {
	/** Coherence with parent/context (0-1) - measures thematic connection */
	coherenceScore: number;
	/** Flesch-Kincaid readability score (0-100) - higher = more readable */
	readabilityScore: number;
	/** Sentence variety/fluency (0-1) - measures sentence length variation */
	fluencyScore: number;
	/** Paragraph balance (0-1) - measures consistency of paragraph lengths */
	structureScore: number;
	/** Weighted overall score (0-1) combining all metrics */
	overallScore: number;
}

// ============================================================================
// Synthesis Options & Configuration
// ============================================================================

/**
 * Synthesis engine options.
 */
export interface SynthesisOptions {
	/** Whether to stream generation */
	stream?: boolean;
	/** Coherence threshold for validation */
	coherenceThreshold?: number;
	/** Maximum iterations for refinement */
	maxRefinementIterations?: number;
	/** Temperature for generation */
	temperature?: number;
	/** Max tokens per node */
	maxTokens?: number;
	/** Provider preference */
	provider?: string;
}

/**
 * Synthesis configuration with defaults.
 */
export interface SynthesisConfig {
	/** Default token budget per node type */
	defaultTokenBudgets: Record<NodeType, number>;
	/** Default length factors per node type */
	defaultLengthFactors: Record<NodeType, number>;
	/** Default density target */
	defaultDensityTarget: number;
	/** Sliding window max tokens */
	slidingWindowMaxTokens: number;
	/** Archive similarity threshold */
	archiveSimilarityThreshold: number;
	/** Coherence similarity threshold */
	coherenceThreshold: number;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Drag-and-drop state for outline builder.
 */
export interface DragDropState {
	draggedNodeId: string | null;
	hoverTargetId: string | null;
	dropPosition: "before" | "after" | "inside" | null;
	isValidDrop: boolean;
}

/**
 * Node configuration panel state.
 */
export interface NodeEditorState {
	selectedNodeId: string | null;
	isEditing: boolean;
	expandedSections: string[];
}

/**
 * Coherence debt tracking.
 */
export interface CoherenceDebt {
	/** Nodes with coherence issues */
	nodesWithIssues: string[];
	/** Total debt score (cumulative) */
	totalDebt: number;
	/** Average coherence across nodes */
	averageCoherence: number;
	/** Warnings for user */
	warnings: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique UUID for nodes.
 */
export function generateNodeId(): string {
	return `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Calculate path from parent path and index.
 */
export function calculatePath(parentPath: string | null, index: number): string {
	if (!parentPath) return String(index + 1);
	return `${parentPath}.${index + 1}`;
}

/**
 * Estimate word count from token budget.
 * Approximation: ~0.75 words per token for English text.
 */
export function estimateWordCount(tokenBudget: number): number {
	return Math.round(tokenBudget * 0.75);
}

/**
 * Estimate reading time from word count.
 * Average reading speed: ~200 words per minute.
 */
export function estimateReadingTime(wordCount: number): number {
	return Math.ceil(wordCount / 200);
}

/**
 * Get default metadata for a node type.
 */
export function getDefaultMetadata(
	type: NodeType,
	config?: Partial<SynthesisConfig>
): NodeMetadata {
	const tokenBudgets: Record<NodeType, number> = {
		// ~3333 tokens ≈ 2500 words per section/subsection
		chapter: 4000,
		section: 3333,
		subsection: 3333,
		paragraph: 200,
	};

	const lengthFactors: Record<NodeType, number> = {
		chapter: 1.0,
		section: 1.5,
		subsection: 1.8,
		paragraph: 1.0,
	};

	const tokenBudget = config?.defaultTokenBudgets?.[type] ?? tokenBudgets[type];
	const wordCount = estimateWordCount(tokenBudget);

	return {
		customPrompt: "",
		tokenBudget,
		lengthFactor: config?.defaultLengthFactors?.[type] ?? lengthFactors[type],
		densityTarget: config?.defaultDensityTarget ?? 2.5,
		estimatedWordCount: wordCount,
		estimatedReadingTime: estimateReadingTime(wordCount),
	};
}

/**
 * Get display label for node type.
 */
export function getNodeTypeLabel(type: NodeType): string {
	const labels: Record<NodeType, string> = {
		chapter: "Chapter",
		section: "Section",
		subsection: "Subsection",
		paragraph: "Paragraph",
	};
	return labels[type];
}

/**
 * Get icon name for node type.
 */
export function getNodeTypeIcon(type: NodeType): string {
	const icons: Record<NodeType, string> = {
		chapter: "Book",
		section: "Section",
		subsection: "SubSection",
		paragraph: "Text",
	};
	return icons[type];
}

/**
 * Check if node type can contain children.
 */
export function canContainChildren(type: NodeType): boolean {
	return type !== "paragraph";
}

/**
 * Get allowed child types for a node type.
 */
export function getAllowedChildTypes(type: NodeType): NodeType[] {
	switch (type) {
		case "chapter":
			return ["section", "subsection", "paragraph"];
		case "section":
			return ["subsection", "paragraph"];
		case "subsection":
			return ["paragraph"];
		case "paragraph":
			return [];
		default:
			return [];
	}
}
