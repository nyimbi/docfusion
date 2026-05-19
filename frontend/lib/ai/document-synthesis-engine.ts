/**
 * Document Synthesis Engine - DocFusion
 *
 * AI-powered document generation with hierarchical structure,
 * context assembly, and coherence validation.
 *
 * Phase 1: Outline Generation - Creates structural tree
 * Phase 2: Context Assembly - Builds context for each node
 * Phase 3: Content Generation - Generates with validation
 */

import type {
	DocumentSpec,
	StructuralNode,
	DocumentStateObject,
	ContextBuffer,
	NodeMetadata,
	NodeStatus,
	NodeType,
	GenerationProgress,
	GenerationPhase,
	AssembledContext,
	GenerationResult,
	ValidationResult,
	SynthesisConfig,
	SynthesisOptions,
	CoherenceDebt,
	ValidationIssue,
	QualityMetrics,
	ArchivedContext,
} from "@/lib/types/document-synthesis";
import {
	generateNodeId,
	calculatePath,
	getDefaultMetadata,
	estimateWordCount,
	estimateReadingTime,
} from "@/lib/types/document-synthesis";
import { logger } from "@/lib/utils/logger";
import { TTLCache } from "@/lib/utils/ttl-cache";
import { chat, streamChat } from "@/lib/ai/client";
import { getProviderManager } from "@/lib/ai/providers";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: SynthesisConfig = {
	defaultTokenBudgets: {
		chapter: 2000,
		section: 1000,
		subsection: 500,
		paragraph: 200,
	},
	defaultLengthFactors: {
		chapter: 1.0,
		section: 1.5,
		subsection: 1.8,
		paragraph: 1.0,
	},
	defaultDensityTarget: 2.5,
	slidingWindowMaxTokens: 4000,
	archiveSimilarityThreshold: 0.7,
	coherenceThreshold: 0.85,
};

// ============================================================================
// Embedding Cache
// ============================================================================

/**
 * TTL cache for embeddings to avoid regenerating for same content.
 * Key: content hash, Value: embedding vector.
 * TTL and size eviction handled by TTLCache.
 */
const EMBEDDING_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_EMBEDDING_CACHE_SIZE = 100;
const embeddingCache = new TTLCache<string, number[]>(EMBEDDING_CACHE_TTL, MAX_EMBEDDING_CACHE_SIZE);

/**
 * Generate a simple hash for cache key purposes.
 * Uses djb2 algorithm for fast string hashing.
 */
function generateContentHash(content: string): string {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = (hash << 5) + hash + content.charCodeAt(i);
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash.toString(16);
}

/**
 * Get cached embedding if available and not expired.
 * @param contentHash - Hash of the content to look up
 * @returns Cached embedding or null if not found/expired
 */
function getCachedEmbedding(contentHash: string): number[] | null {
	return embeddingCache.get(contentHash) ?? null;
}

/**
 * Store embedding in cache.
 * TTL expiration and size eviction are handled by TTLCache.
 * @param contentHash - Hash of the content as cache key
 * @param embedding - Embedding vector to cache
 */
function setCachedEmbedding(contentHash: string, embedding: number[]): void {
	embeddingCache.set(contentHash, embedding);
}

// ============================================================================
// Phase 1: Outline Generation
// ============================================================================

/**
 * Generate a structural outline from document specification.
 * Creates the initial tree structure without content.
 */
export async function generateOutline(
	spec: DocumentSpec,
	config: SynthesisConfig = DEFAULT_CONFIG
): Promise<StructuralNode[]> {
	const nodes: StructuralNode[] = [];
	const nodeMap = new Map<string, StructuralNode>();

	// Build outline prompt
	const prompt = buildOutlinePrompt(spec);

	try {
		const result = await chat([
			{
				role: "system",
				content:
					"You are a document structure expert. Generate a hierarchical outline as a JSON array.",
			},
			{ role: "user", content: prompt },
		]);

		// Parse the outline JSON
		const outlineData = parseOutlineJSON(result.content);

		// Convert to structural nodes
		for (const item of outlineData) {
			buildNodesRecursive(item, null, nodes, nodeMap, config);
		}

		return nodes;
	} catch (error) {
		logger.error("Failed to generate outline:", error);
		// Fallback to minimal structure
		return createMinimalStructure(spec, config);
	}
}

/**
 * Build the outline generation prompt.
 */
function buildOutlinePrompt(spec: DocumentSpec): string {
	return `Create a detailed outline for a ${spec.documentType} titled "${spec.title}".

Document Type: ${spec.documentType}
Target Audience: ${spec.targetAudience || "General"}
Tone: ${spec.tone || "professional"}
Target Word Count: ${spec.wordCountTarget}
${spec.requirements?.length ? `Requirements:\n${spec.requirements.map(r => `- ${r}`).join("\n")}` : ""}

Provide the outline as a JSON array where each item has:
- type: "chapter" | "section" | "subsection" | "paragraph"
- title: string (descriptive title)
- description: string (brief description of content)
- children?: array of sub-items (for chapters, sections, subsections)

The outline should be comprehensive enough to produce approximately ${spec.wordCountTarget} words.
Include ${Math.max(3, Math.floor(spec.wordCountTarget / 2000))} chapters as top-level items.`;
}

/**
 * Parse outline JSON from AI response.
 */
function parseOutlineJSON(content: string): OutlineItemData[] {
	// Extract JSON from markdown code blocks if present
	const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
	const jsonContent = jsonMatch ? jsonMatch[1] : content;

	// Try to find JSON array
	const arrayMatch = jsonContent.match(/\[[\s\S]*\]/);
	if (arrayMatch) {
		try {
			return JSON.parse(arrayMatch[0]) as OutlineItemData[];
		} catch {
			// Parse failed
		}
	}

	// Fallback: try parsing the whole thing
	try {
		return JSON.parse(jsonContent) as OutlineItemData[];
	} catch {
		// Return minimal structure
		return [{ type: "chapter", title: "Main Content", description: "Document content" }];
	}
}

interface OutlineItemData {
	type: NodeType;
	title: string;
	description: string;
	children?: OutlineItemData[];
}

/**
 * Recursively build nodes from outline data.
 */
function buildNodesRecursive(
	item: OutlineItemData,
	parentId: string | null,
	nodes: StructuralNode[],
	nodeMap: Map<string, StructuralNode>,
	config: SynthesisConfig,
	index: number = 0
): StructuralNode {
	const id = generateNodeId();
	const path = calculatePath(parentId ? nodeMap.get(parentId)?.path ?? null : null, index);
	const metadata: NodeMetadata = {
		...getDefaultMetadata(item.type, config),
		customPrompt: `${item.title}: ${item.description}`,
	};

	const node: StructuralNode = {
		uuid: id,
		path,
		type: item.type,
		parentId,
		children: [],
		metadata,
		status: "pending",
	};

	nodes.push(node);
	nodeMap.set(id, node);

	// Process children
	if (item.children) {
		for (let i = 0; i < item.children.length; i++) {
			const child = buildNodesRecursive(
				item.children[i],
				id,
				nodes,
				nodeMap,
				config,
				i
			);
			node.children.push(child.uuid);
		}
	}

	return node;
}

/**
 * Create minimal fallback structure.
 */
function createMinimalStructure(
	spec: DocumentSpec,
	config: SynthesisConfig
): StructuralNode[] {
	return [
		{
			uuid: generateNodeId(),
			path: "1",
			type: "chapter",
			parentId: null,
			children: [],
			metadata: {
				...getDefaultMetadata("chapter", config),
				customPrompt: `Main content for: ${spec.title}`,
			},
			status: "pending",
		},
	];
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Sort nodes in topological order for generation.
 * Ensures parent nodes are processed before their children.
 */
export function topologicalSort(nodes: StructuralNode[]): string[] {
	const nodeMap = new Map(nodes.map((n) => [n.uuid, n]));
	const visited = new Set<string>();
	const result: string[] = [];

	function visit(nodeId: string, path: Set<string>) {
		if (path.has(nodeId)) {
			throw new Error(`Cyclic dependency detected: ${nodeId}`);
		}
		if (visited.has(nodeId)) return;

		path.add(nodeId);
		const node = nodeMap.get(nodeId);
		if (node) {
			// Visit all children first (depth-first)
			for (const childId of node.children) {
				visit(childId, path);
			}
			visited.add(nodeId);
			result.push(nodeId);
		}
		path.delete(nodeId);
	}

	// Process root nodes (those without parents)
	const rootNodes = nodes.filter((n) => n.parentId === null);
	for (const node of rootNodes) {
		visit(node.uuid, new Set());
	}

	return result.reverse(); // Reverse to get parent-before-children order
}

/**
 * Get generation order (parents before children).
 */
export function getGenerationOrder(nodes: StructuralNode[]): StructuralNode[] {
	const orderIds = topologicalSort(nodes);
	const nodeMap = new Map(nodes.map((n) => [n.uuid, n]));
	return orderIds.map((id) => nodeMap.get(id)!).filter(Boolean);
}

/**
 * Group nodes into batches for parallel generation.
 * Siblings with completed parents can be processed together.
 *
 * The algorithm:
 * 1. Process nodes in topological order (parents before children)
 * 2. When encountering a pending node, check if its parent is completed
 * 3. If parent is completed, batch this node with other pending siblings
 * 4. Nodes in the same batch can be generated in parallel
 *
 * @param nodes - All structural nodes in the document
 * @returns Array of batches, each batch contains nodes that can be processed in parallel
 */
export function getParallelGenerationBatches(nodes: StructuralNode[]): StructuralNode[][] {
	const nodeMap = new Map(nodes.map((n) => [n.uuid, n]));
	const batches: StructuralNode[][] = [];
	const processed = new Set<string>();

	// Process in topological order
	const order = topologicalSort(nodes);

	for (const nodeId of order) {
		if (processed.has(nodeId)) continue;

		const node = nodeMap.get(nodeId);
		if (!node) continue;

		// Skip non-pending nodes
		if (node.status !== "pending") {
			processed.add(nodeId);
			continue;
		}

		const batch: StructuralNode[] = [node];
		processed.add(nodeId);

		// Find siblings that can be processed in parallel
		if (node.parentId) {
			const parent = nodeMap.get(node.parentId);
			// Only batch siblings if parent is already completed
			if (parent && parent.status === "completed") {
				for (const siblingId of parent.children) {
					if (!processed.has(siblingId) && siblingId !== nodeId) {
						const sibling = nodeMap.get(siblingId);
						if (sibling && sibling.status === "pending") {
							batch.push(sibling);
							processed.add(siblingId);
						}
					}
				}
			}
		}

		if (batch.length > 0) {
			batches.push(batch);
		}
	}

	return batches;
}

/**
 * Generate a batch of nodes in parallel using Promise.all.
 * All nodes in the batch are assumed to have their dependencies satisfied.
 *
 * @param dso - Current document state object
 * @param batch - Array of nodes to generate concurrently
 * @param options - Synthesis options
 * @returns Updated document state object with all batch nodes generated
 */
export async function generateBatchParallel(
	dso: DocumentStateObject,
	batch: StructuralNode[],
	options: SynthesisOptions = {}
): Promise<DocumentStateObject> {
	const { structuralTree, contextBuffer } = dso;

	// Mark all nodes in batch as generating
	for (const node of batch) {
		node.status = "generating";
	}

	// Generate all nodes concurrently
	const results = await Promise.all(
		batch.map(async (node) => {
			const context = assembleContext(node, structuralTree, contextBuffer);
			const result = await generateWithRefinement(node, context, options, DEFAULT_CONFIG);
			return { node, result };
		})
	);

	// Apply results to all nodes
	for (const { node, result } of results) {
		// Validate
		const validation = validateContent(
			result.content,
			node,
			assembleContext(node, structuralTree, contextBuffer).parentContent,
			DEFAULT_CONFIG
		);

		node.content = result.content;
		node.status = validation.isValid ? "completed" : "failed";
		node.metadata.semanticEmbedding = result.embedding;
		node.metadata.generatedContentHash = hashContent(result.content);
		node.metadata.estimatedWordCount = estimateWordCount(result.tokenCount);
		node.metadata.estimatedReadingTime = estimateReadingTime(node.metadata.estimatedWordCount);
		node.generatedAt = result.generatedAt;

		if (!validation.isValid) {
			node.error = validation.issues.map((i) => i.message).join("; ");
		}

		// Update context buffer sliding window
		contextBuffer.slidingWindow = updateSlidingWindow(
			contextBuffer.slidingWindow,
			result.content
		);

		// Add to archive
		contextBuffer.archive.push({
			nodeId: node.uuid,
			summary: createSummary(result.content),
			embedding: result.embedding,
			tokenCount: result.tokenCount,
			archivedAt: new Date().toISOString(),
		});
	}

	// Optimize archive after batch processing
	contextBuffer.archive = optimizeArchive(contextBuffer.archive);

	// Update terminological registry
	for (const { result } of results) {
		contextBuffer.terminologicalRegistry = updateTerminologyRegistry(
			result.content,
			contextBuffer.terminologicalRegistry
		);
	}

	// Update progress
	const completedNodes = structuralTree.filter((n) => n.status === "completed").length;
	const progress = dso.progress
		? updateProgressNode(dso.progress, batch[batch.length - 1]?.uuid ?? null, completedNodes)
		: undefined;

	return {
		documentSpec: dso.documentSpec,
		structuralTree,
		contextBuffer,
		progress,
	};
}

// ============================================================================
// Phase 2a: Context Assembly
// ============================================================================

/**
 * Assemble context for a node.
 * Retrieves parent content, sibling summaries, and semantic matches.
 */
export function assembleContext(
	node: StructuralNode,
	structuralTree: StructuralNode[],
	buffer: ContextBuffer,
	config: SynthesisConfig = DEFAULT_CONFIG
): AssembledContext {
	const nodeMap = new Map(structuralTree.map((n) => [n.uuid, n]));

	// 1. Retrieve parent content (full)
	const parentContent = getParentContent(node, nodeMap);

	// 2. Retrieve sibling summaries (truncated)
	const siblingSummaries = getSiblingSummaries(node, nodeMap, config);

	// 3. Semantic similarity search in archive
	const similarContext = searchSimilarArchive(node, buffer, config);

	// Combine context
	const contextParts: string[] = [];

	if (parentContent) {
		contextParts.push(`Parent Context:\n${parentContent}`);
	}

	if (siblingSummaries.length > 0) {
		contextParts.push(`Sibling Sections:\n${siblingSummaries.join("\n\n")}`);
	}

	if (similarContext.length > 0) {
		contextParts.push(`Related Context:\n${similarContext.join("\n\n")}`);
	}

	if (buffer.terminologicalRegistry.length > 0) {
		contextParts.push(
			`Key Terms:\n${buffer.terminologicalRegistry.join(", ")}`
		);
	}

	if (buffer.rhetoricalMode) {
		contextParts.push(`Rhetorical Mode: ${buffer.rhetoricalMode}`);
	}

	const fullContext = contextParts.join("\n\n---\n\n");

	return {
		parentContent,
		siblingSummaries,
		archivedSimilarContext: similarContext,
		fullContext,
		tokenCount: estimateTokenCount(fullContext),
	};
}

/**
 * Get full content of parent nodes recursively.
 */
function getParentContent(
	node: StructuralNode,
	nodeMap: Map<string, StructuralNode>
): string {
	const parts: string[] = [];
	let currentId: string | null = node.parentId;

	while (currentId) {
		const parent = nodeMap.get(currentId);
		if (!parent) break;

		if (parent.content) {
			parts.unshift(`[${parent.path}] ${parent.metadata.customPrompt}\n${parent.content}`);
		}

		currentId = parent.parentId;
	}

	return parts.join("\n\n");
}

/**
 * Get summaries of sibling nodes (not including the current node).
 */
function getSiblingSummaries(
	node: StructuralNode,
	nodeMap: Map<string, StructuralNode>,
	config: SynthesisConfig
): string[] {
	if (!node.parentId) return [];

	const parent = nodeMap.get(node.parentId);
	if (!parent) return [];

	const summaries: string[] = [];
	for (const siblingId of parent.children) {
		if (siblingId === node.uuid) continue;

		const sibling = nodeMap.get(siblingId);
		if (sibling) {
			const summary = sibling.content
				? `[${sibling.path}] ${sibling.metadata.customPrompt}\n${truncateToTokens(sibling.content, 150)}`
				: `[${sibling.path}] ${sibling.metadata.customPrompt} (pending)`;
			summaries.push(summary);
		}
	}

	return summaries;
}

/**
 * Search archived context for semantically similar entries.
 */
function searchSimilarArchive(
	node: StructuralNode,
	buffer: ContextBuffer,
	config: SynthesisConfig
): string[] {
	// If no embedding available or empty archive, return empty
	if (!node.metadata.semanticEmbedding || buffer.archive.length === 0) {
		return [];
	}

	// Simple semantic similarity using cosine similarity
	const similarities = buffer.archive.map((entry) => ({
		entry,
		score: cosineSimilarity(node.metadata.semanticEmbedding!, entry.embedding),
	}));

	// Filter above threshold and sort by similarity
	return similarities
		.filter((s) => s.score >= config.archiveSimilarityThreshold)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((s) => s.entry.summary);
}

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) return 0;

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	if (normA === 0 || normB === 0) return 0;
	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Estimate token count (rough approximation: 4 chars per token).
 */
function estimateTokenCount(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximately maxTokens.
 */
function truncateToTokens(text: string, maxTokens: number): string {
	const maxChars = maxTokens * 4;
	if (text.length <= maxChars) return text;
	return text.substring(0, maxChars - 3) + "...";
}

// ============================================================================
// Phase 2b-c: Content Generation
// ============================================================================

/**
 * Generate content for a node with context.
 * Includes constrained decoding and validation.
 */
export async function generateNodeContent(
	node: StructuralNode,
	context: AssembledContext,
	options: SynthesisOptions = {},
	config: SynthesisConfig = DEFAULT_CONFIG
): Promise<GenerationResult> {
	const prompt = buildGenerationPrompt(node, context, config);

	const startTime = Date.now();

	// Calculate max tokens with constraint
	const maxTokens = Math.min(
		node.metadata.tokenBudget,
		options.maxTokens ?? config.defaultTokenBudgets[node.type]
	);

	try {
		// Generate content
		const result = await chat(
			[
				{
					role: "system",
					content: `You are a professional writing assistant. Generate concise, well-structured content. Output only the content, no meta-commentary. Maximum ~${maxTokens} tokens.`,
				},
				{ role: "user", content: prompt },
			],
			{
				temperature: options.temperature ?? 0.7,
				maxTokens,
			}
		);

		const content = result.content.trim();
		const tokenCount = estimateTokenCount(content);

		// Generate embedding using Azure OpenAI
		const embedding = await generateEmbedding(content);

		// Calculate coherence score
		const coherenceScore = calculateCoherenceScore(content, context.parentContent);

		return {
			content,
			tokenCount,
			coherenceScore,
			embedding,
			generatedAt: new Date().toISOString(),
			model: result.model,
			provider: result.provider,
		};
	} catch (error) {
		throw new Error(
			`Failed to generate content for node ${node.uuid}: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

/**
 * Generate content with iterative refinement for quality.
 * Retries up to maxIterations if coherence threshold not met.
 *
 * This implements the "auto-regenerate low coherence" feature by:
 * 1. Generating content with current context
 * 2. Checking coherence against threshold
 * 3. If below threshold, enriching context with feedback and retrying
 * 4. Returning best result after max iterations
 *
 * @param node - The structural node to generate content for
 * @param context - Assembled context from parent/sibling nodes
 * @param options - Synthesis options including refinement settings
 * @param config - Synthesis configuration
 * @returns The best generation result after refinement iterations
 */
async function generateWithRefinement(
	node: StructuralNode,
	context: AssembledContext,
	options: SynthesisOptions,
	config: SynthesisConfig
): Promise<GenerationResult> {
	const maxIterations = options.maxRefinementIterations ?? 3;
	const coherenceThreshold = options.coherenceThreshold ?? config.coherenceThreshold;

	let bestResult: GenerationResult | null = null;
	let currentContext = context;
	let iteration = 0;

	while (iteration < maxIterations) {
		const result = await generateNodeContent(node, currentContext, options, config);

		// Check if meets coherence threshold
		if (result.coherenceScore >= coherenceThreshold) {
			return result;
		}

		// Keep best result so far (highest coherence)
		if (!bestResult || result.coherenceScore > bestResult.coherenceScore) {
			bestResult = result;
		}

		// Enrich context with feedback for next iteration
		if (iteration < maxIterations - 1) {
			const coherencePercent = Math.round(result.coherenceScore * 100);
			const feedbackNote = `\n\n[REFINEMENT FEEDBACK - Iteration ${iteration + 1}/${maxIterations}]\n` +
				`Previous attempt scored ${coherencePercent}% coherence (threshold: ${Math.round(coherenceThreshold * 100)}%).\n` +
				`Please improve connection to the parent context by:\n` +
				`- Using more terminology from the parent section\n` +
				`- Better transitioning from previous content\n` +
				`- Maintaining consistent tone and style`;

			currentContext = {
				...currentContext,
				fullContext: currentContext.fullContext + feedbackNote,
				tokenCount: currentContext.tokenCount + estimateTokenCount(feedbackNote),
			};
		}

		iteration++;
	}

	// Return best result after all iterations
	return bestResult!;
}

/**
 * Generate content with streaming for real-time updates.
 */
export async function* generateNodeContentStream(
	node: StructuralNode,
	context: AssembledContext,
	options: SynthesisOptions = {},
	config: SynthesisConfig = DEFAULT_CONFIG
): AsyncGenerator<{ content: string; isComplete: boolean }, void, unknown> {
	const prompt = buildGenerationPrompt(node, context, config);
	const maxTokens = Math.min(
		node.metadata.tokenBudget,
		options.maxTokens ?? config.defaultTokenBudgets[node.type]
	);

	let accumulated = "";

	const stream = streamChat(
		[
			{
				role: "system",
				content: `You are a professional writing assistant. Generate concise, well-structured content. Maximum ~${maxTokens} tokens.`,
			},
			{ role: "user", content: prompt },
		],
		{
			temperature: options.temperature ?? 0.7,
			maxTokens,
		}
	);

	for await (const chunk of stream) {
		accumulated = chunk.accumulated;
		yield {
			content: accumulated,
			isComplete: chunk.isComplete,
		};
	}
}

/**
 * Build the generation prompt.
 */
function buildGenerationPrompt(
	node: StructuralNode,
	context: AssembledContext,
	config: SynthesisConfig
): string {
	const parts: string[] = [];

	// Document context
	if (context.parentContent) {
		parts.push(`Context:\n${context.parentContent}`);
	}

	// Sibling context
	if (context.siblingSummaries.length > 0) {
		parts.push(`Related sections:\n${context.siblingSummaries.join("\n")}`);
	}

	// Specific request
	parts.push(`Write the following ${node.type}:`);
	parts.push(`Title/Topic: ${node.metadata.customPrompt}`);

	// Length guidance
	const targetWords = estimateWordCount(node.metadata.tokenBudget);
	parts.push(`Target: Approximately ${targetWords} words. Be concise and professional.`);

	// Density guidance
	parts.push(`Information density: Aim for ${node.metadata.densityTarget} key points per 100 words.`);

	return parts.join("\n\n");
}

/**
 * Generate an embedding vector for content using Azure OpenAI embeddings API.
 * Returns a 1536-dimensional vector for text-embedding-ada-002.
 * Uses LRU cache to avoid regenerating embeddings for identical content.
 */
async function generateEmbedding(content: string): Promise<number[]> {
	// Check cache first
	const contentHash = generateContentHash(content);
	const cachedEmbedding = getCachedEmbedding(contentHash);
	if (cachedEmbedding) {
		return cachedEmbedding;
	}

	const manager = getProviderManager();
	await manager.initialize();

	if (!(await manager.isAvailable())) {
		// Fallback to simple embedding if no AI provider available
		const simpleEmbedding = generateSimpleEmbedding(content);
		setCachedEmbedding(contentHash, simpleEmbedding);
		return simpleEmbedding;
	}

	try {
		// Get the active provider to access config
		const provider = await manager.getActiveProvider();
		if (!provider || provider.name !== "azure-openai") {
			// Fallback for non-Azure providers
			const fallbackEmbed = generateSimpleEmbedding(content);
			setCachedEmbedding(contentHash, fallbackEmbed);
			return fallbackEmbed;
		}

		// Get Azure config from environment
		const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
		const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding-ada-002";
		const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";
		const apiKey = process.env.AZURE_OPENAI_API_KEY;

		if (!endpoint || !apiKey) {
			const fallbackEmbed = generateSimpleEmbedding(content);
			setCachedEmbedding(contentHash, fallbackEmbed);
			return fallbackEmbed;
		}

		// Call Azure OpenAI embeddings API
		const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": apiKey,
			},
			body: JSON.stringify({
				input: content.slice(0, 8000), // Limit input size
			}),
		});

		if (!response.ok) {
			logger.warn("[Embedding] Azure OpenAI API error:", response.status);
			const fallbackEmbed = generateSimpleEmbedding(content);
			setCachedEmbedding(contentHash, fallbackEmbed);
			return fallbackEmbed;
		}

		const data = await response.json();
		const embedding = data.data?.[0]?.embedding;

		if (!embedding || !Array.isArray(embedding)) {
			logger.warn("[Embedding] Invalid response format from Azure OpenAI");
			const fallbackEmbed = generateSimpleEmbedding(content);
			setCachedEmbedding(contentHash, fallbackEmbed);
			return fallbackEmbed;
		}

		// Cache the Azure OpenAI embedding
		setCachedEmbedding(contentHash, embedding);
		return embedding;
	} catch (error) {
		logger.warn("[Embedding] Error calling Azure OpenAI:", error);
		const fallbackEmbed = generateSimpleEmbedding(content);
		setCachedEmbedding(contentHash, fallbackEmbed);
		return fallbackEmbed;
	}
}

/**
 * Generate a simple embedding vector using word frequency analysis.
 * Fallback for when Azure OpenAI embeddings are not available.
 * Returns a 50-dimensional normalized vector based on word frequencies.
 */
function generateSimpleEmbedding(content: string): number[] {
	// Simple approach: word frequency vector (normalized)
	const words = content
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 2);

	// Use first 50 dimensions (simplified)
	const vector = new Array(50).fill(0);
	const wordSet = [...new Set(words)].slice(0, 50);

	for (let i = 0; i < wordSet.length; i++) {
		const count = words.filter((w) => w === wordSet[i]).length;
		vector[i] = count / words.length;
	}

	return vector;
}

/**
 * Calculate coherence score between content and parent context.
 * Returns 0-1 score where 1 is fully coherent.
 */
function calculateCoherenceScore(content: string, parentContent: string): number {
	if (!parentContent) return 1.0; // No parent = perfectly coherent

	// Extract key terms from parent
	const parentTerms = extractKeyTerms(parentContent);
	const contentTerms = extractKeyTerms(content);

	// Calculate overlap ratio
	if (parentTerms.length === 0) return 1.0;

	const overlap = contentTerms.filter((t) => parentTerms.includes(t)).length;
	const baseScore = overlap / Math.min(parentTerms.length, 10);

	// Weight by content similarity
	return Math.min(1.0, baseScore + 0.5);
}

/**
 * Extract key terms from text (simplified).
 */
function extractKeyTerms(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 4)
		.filter((w) => !commonStopWords.includes(w))
		.slice(0, 20);
}

const commonStopWords = [
	"about",
	"above",
	"after",
	"again",
	"against",
	"being",
	"below",
	"between",
	"during",
	"should",
	"through",
	"where",
	"which",
	"while",
	"would",
];

// ============================================================================
// Quality Metrics
// ============================================================================

/**
 * Count syllables in a word for readability calculations.
 * Uses a heuristic approach based on vowel patterns.
 *
 * @param word - The word to count syllables for
 * @returns Number of syllables (minimum 1)
 */
function countSyllables(word: string): number {
	word = word.toLowerCase().replace(/[^a-z]/g, "");
	if (word.length <= 3) return 1;

	// Remove silent e at end
	word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
	// Remove leading y
	word = word.replace(/^y/, "");
	// Count vowel groups
	const matches = word.match(/[aeiouy]{1,2}/g);
	return matches ? Math.max(1, matches.length) : 1;
}

/**
 * Calculate Flesch-Kincaid readability score.
 * Higher scores indicate easier readability:
 * - 90-100: Very easy (5th grade)
 * - 80-89: Easy (6th grade)
 * - 70-79: Fairly easy (7th grade)
 * - 60-69: Standard (8th-9th grade)
 * - 50-59: Fairly difficult (10th-12th grade)
 * - 30-49: Difficult (college)
 * - 0-29: Very difficult (college graduate)
 *
 * @param text - The text to analyze
 * @returns Readability score 0-100
 */
function calculateFleschKincaid(text: string): number {
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	const words = text.split(/\s+/).filter((w) => w.length > 0);

	if (sentences.length === 0 || words.length === 0) return 0;

	const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

	// Flesch Reading Ease formula
	const score =
		206.835 -
		1.015 * (words.length / sentences.length) -
		84.6 * (syllables / words.length);

	return Math.max(0, Math.min(100, score));
}

/**
 * Calculate sentence variety/fluency score.
 * Measures variation in sentence length - good writing has diverse sentence lengths.
 * Score based on standard deviation of sentence lengths.
 *
 * @param text - The text to analyze
 * @returns Fluency score 0-1
 */
function calculateFluencyScore(text: string): number {
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	if (sentences.length < 2) return 1.0; // Single sentence = no variance to measure

	const lengths = sentences.map((s) => s.split(/\s+/).filter((w) => w.length > 0).length);
	const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

	// Calculate variance and standard deviation
	const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
	const stdDev = Math.sqrt(variance);

	// Good writing has stdDev around 5-15 words
	// Too low = monotonous, too high = chaotic
	// Score peaks at stdDev of ~8
	const optimalStdDev = 8;
	const deviation = Math.abs(stdDev - optimalStdDev);

	return Math.max(0, Math.min(1.0, 1 - deviation / 20));
}

/**
 * Calculate paragraph structure balance score.
 * Measures how evenly distributed paragraph lengths are.
 * Well-structured documents have relatively consistent paragraph sizes.
 *
 * @param text - The text to analyze
 * @returns Structure score 0-1
 */
function calculateStructureScore(text: string): number {
	const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
	if (paragraphs.length === 0) return 0;
	if (paragraphs.length === 1) return 1.0; // Single paragraph = perfectly balanced

	const lengths = paragraphs.map((p) => p.length);
	const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

	if (avg === 0) return 0;

	// Calculate how far the max deviation is from average
	const maxDeviation = Math.max(...lengths.map((l) => Math.abs(l - avg)));

	// Score decreases as max deviation increases relative to average
	return Math.max(0, 1 - maxDeviation / (avg * 2));
}

/**
 * Calculate comprehensive quality metrics for generated content.
 * Combines coherence, readability, fluency, and structure into overall score.
 *
 * Weights:
 * - Coherence: 40% (most important for document synthesis)
 * - Readability: 20%
 * - Fluency: 20%
 * - Structure: 20%
 *
 * @param content - The generated content to evaluate
 * @param parentContent - Parent node content for coherence calculation
 * @returns Complete quality metrics
 */
export function calculateQualityMetrics(
	content: string,
	parentContent: string
): QualityMetrics {
	const coherence = calculateCoherenceScore(content, parentContent);
	const readability = calculateFleschKincaid(content);
	const fluency = calculateFluencyScore(content);
	const structure = calculateStructureScore(content);

	// Weighted overall score
	const overallScore =
		coherence * 0.4 +
		(readability / 100) * 0.2 +
		fluency * 0.2 +
		structure * 0.2;

	return {
		coherenceScore: coherence,
		readabilityScore: readability,
		fluencyScore: fluency,
		structureScore: structure,
		overallScore,
	};
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate generated content against quality criteria.
 */
export function validateContent(
	content: string,
	node: StructuralNode,
	parentContent?: string,
	config: SynthesisConfig = DEFAULT_CONFIG
): ValidationResult {
	const issues: ValidationIssue[] = [];
	let coherenceScore = 1.0;

	// Check coherence with parent
	if (parentContent) {
		coherenceScore = calculateCoherenceScore(content, parentContent);
		if (coherenceScore < config.coherenceThreshold) {
			issues.push({
				type: "coherence",
				severity: "warning",
				message: `Low coherence with parent section (${Math.round(coherenceScore * 100)}%). Consider adjusting content to better connect with context.`,
			});
		}
	}

	// Check length constraints
	const tokenCount = estimateTokenCount(content);
	const targetTokens = node.metadata.tokenBudget;
	const variance = Math.abs(tokenCount - targetTokens) / targetTokens;

	if (variance > 0.3) {
		issues.push({
			type: "length",
			severity: variance > 0.5 ? "critical" : "warning",
			message: `Length differs from target by ${Math.round(variance * 100)}% (target: ${targetTokens}, actual: ~${tokenCount}).`,
		});
	}

	// Check density (key points per unit)
	const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	const density = sentences.length / (tokenCount / 100);

	if (density < node.metadata.densityTarget * 0.5) {
		issues.push({
			type: "density",
			severity: "info",
			message: `Information density is low (${density.toFixed(1)} sentences per 100 tokens). Consider adding more detail.`,
		});
	}

	// Check for redundancy
	if (parentContent) {
		const redundancyScore = calculateRedundancy(content, parentContent);
		if (redundancyScore > 0.3) {
			issues.push({
				type: "redundancy",
				severity: redundancyScore > 0.5 ? "warning" : "info",
				message: `Content may be redundant with parent section (${Math.round(redundancyScore * 100)}% overlap).`,
			});
		}
	}

	return {
		isValid: issues.every((i) => i.severity !== "critical"),
		coherenceScore,
		issues,
		suggestions: issues.map((i) => i.message),
	};
}

/**
 * Calculate redundancy between content and parent content.
 */
function calculateRedundancy(content: string, parentContent: string): number {
	const contentWords = new Set(extractKeyTerms(content));
	const parentWords = new Set(extractKeyTerms(parentContent));

	if (contentWords.size === 0) return 0;

	let overlap = 0;
	for (const word of contentWords) {
		if (parentWords.has(word)) overlap++;
	}

	return overlap / contentWords.size;
}

// ============================================================================
// Coherence Debt Tracking
// ============================================================================

/**
 * Calculate coherence debt across all nodes.
 */
export function calculateCoherenceDebt(nodes: StructuralNode[]): CoherenceDebt {
	const nodesWithIssues: string[] = [];
	let totalDebt = 0;
	const scores: number[] = [];

	for (const node of nodes) {
		if (node.content) {
			// Calculate rough coherence if not stored
			let score = node.metadata.semanticEmbedding
				? estimateCoherenceFromEmbedding(node, nodes)
				: 0.85; // Default assumption

			if (score < DEFAULT_CONFIG.coherenceThreshold) {
				nodesWithIssues.push(node.uuid);
				totalDebt += (DEFAULT_CONFIG.coherenceThreshold - score) * 10;
			}
			scores.push(score);
		}
	}

	const averageCoherence = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 1.0;

	const warnings: string[] = [];
	if (nodesWithIssues.length > 0) {
		warnings.push(`${nodesWithIssues.length} sections have coherence issues.`);
	}
	if (averageCoherence < 0.75) {
		warnings.push("Document has low overall coherence. Consider regenerating affected sections.");
	}

	return {
		nodesWithIssues,
		totalDebt,
		averageCoherence,
		warnings,
	};
}

/**
 * Estimate coherence from semantic embeddings.
 */
function estimateCoherenceFromEmbedding(
	node: StructuralNode,
	allNodes: StructuralNode[]
): number {
	if (!node.metadata.semanticEmbedding || !node.parentId) return 1.0;

	const parent = allNodes.find((n) => n.uuid === node.parentId);
	if (!parent || !parent.metadata.semanticEmbedding) return 1.0;

	return cosineSimilarity(
		node.metadata.semanticEmbedding,
		parent.metadata.semanticEmbedding
	);
}

// ============================================================================
// Document Assembly
// ============================================================================

/**
 * Assemble all generated content into a single document.
 */
export function assembleDocument(nodes: StructuralNode[]): string {
	const nodeMap = new Map(nodes.map((n) => [n.uuid, n]));
	const sortedNodes = topologicalSort(nodes)
		.map((id) => nodeMap.get(id)!)
		.filter(Boolean);

	const parts: string[] = [];

	for (const node of sortedNodes) {
		if (node.content) {
			const headingLevel = getHeadingLevel(node.type);
			const heading = `${"#".repeat(headingLevel)} ${node.metadata.customPrompt.split(":")[0]}`;
			parts.push(`${heading}\n\n${node.content}`);
		}
	}

	return parts.join("\n\n---\n\n");
}

/**
 * Get heading markdown level for node type.
 */
function getHeadingLevel(type: NodeType): number {
	switch (type) {
		case "chapter":
			return 1;
		case "section":
			return 2;
		case "subsection":
			return 3;
		case "paragraph":
			return 4;
		default:
			return 2;
	}
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Initialize generation progress.
 */
export function initProgress(nodes: StructuralNode[]): GenerationProgress {
	return {
		phase: "outline",
		currentNodeId: null,
		completedNodes: 0,
		totalNodes: nodes.length,
		percentage: 0,
		startedAt: new Date().toISOString(),
	};
}

/**
 * Update progress for a phase change.
 */
export function updateProgressPhase(
	progress: GenerationProgress,
	phase: GenerationPhase
): GenerationProgress {
	return {
		...progress,
		phase,
		currentNodeId: phase === "content_generation" ? progress.currentNodeId : null,
	};
}

/**
 * Update progress for node completion.
 */
export function updateProgressNode(
	progress: GenerationProgress,
	nodeId: string | null,
	completedNodes: number
): GenerationProgress {
	const percentage = Math.round((completedNodes / progress.totalNodes) * 100);
	return {
		...progress,
		currentNodeId: nodeId,
		completedNodes,
		percentage,
	};
}

/**
 * Complete progress tracking.
 */
export function completeProgress(progress: GenerationProgress): GenerationProgress {
	return {
		...progress,
		phase: "complete",
		currentNodeId: null,
		completedNodes: progress.totalNodes,
		percentage: 100,
		completedAt: new Date().toISOString(),
	};
}

// ============================================================================
// Main Synthesis Functions
// ============================================================================

/**
 * Initialize a new document synthesis.
 */
export async function initDocumentSynthesis(
	spec: DocumentSpec,
	config: SynthesisConfig = DEFAULT_CONFIG
): Promise<DocumentStateObject> {
	const structuralTree = await generateOutline(spec, config);

	const buffer: ContextBuffer = {
		slidingWindow: "",
		archive: [],
		terminologicalRegistry: [],
		rhetoricalMode: spec.tone ?? "professional",
	};

	return {
		documentSpec: spec,
		structuralTree,
		contextBuffer: buffer,
		progress: initProgress(structuralTree),
	};
}

/**
 * Generate next node in sequence.
 */
export async function generateNextNode(
	dso: DocumentStateObject,
	options: SynthesisOptions = {}
): Promise<DocumentStateObject> {
	const { structuralTree, contextBuffer } = dso;

	// Get next pending node in topological order
	const order = getGenerationOrder(structuralTree);
	const nextNode = order.find((n) => n.status === "pending");

	if (!nextNode) {
		// All nodes complete
		return {
			...dso,
			progress: dso.progress ? completeProgress(dso.progress) : undefined,
		};
	}

	// Update node status
	nextNode.status = "generating";

	// Assemble context
	const context = assembleContext(nextNode, structuralTree, contextBuffer);

	// Generate content with iterative refinement for quality
	const result = await generateWithRefinement(
		nextNode,
		context,
		options,
		DEFAULT_CONFIG
	);

	// Validate
	const validation = validateContent(
		result.content,
		nextNode,
		context.parentContent,
		DEFAULT_CONFIG
	);

	// Update node with results
	nextNode.content = result.content;
	nextNode.status = validation.isValid ? "completed" : "failed";
	nextNode.metadata.semanticEmbedding = result.embedding;
	nextNode.metadata.generatedContentHash = hashContent(result.content);
	nextNode.metadata.estimatedWordCount = estimateWordCount(result.tokenCount);
	nextNode.metadata.estimatedReadingTime = estimateReadingTime(
		nextNode.metadata.estimatedWordCount
	);
	nextNode.generatedAt = result.generatedAt;

	if (!validation.isValid) {
		nextNode.error = validation.issues.map((i) => i.message).join("; ");
	}

	// Update context buffer
	contextBuffer.slidingWindow = updateSlidingWindow(
		contextBuffer.slidingWindow,
		result.content
	);

	contextBuffer.archive.push({
		nodeId: nextNode.uuid,
		summary: createSummary(result.content),
		embedding: result.embedding,
		tokenCount: result.tokenCount,
		archivedAt: new Date().toISOString(),
	});

	// Optimize archive to prevent unbounded growth
	contextBuffer.archive = optimizeArchive(contextBuffer.archive);

	// Update terminology registry with technical terms from generated content
	contextBuffer.terminologicalRegistry = updateTerminologyRegistry(
		result.content,
		contextBuffer.terminologicalRegistry
	);

	// Update progress
	const completedNodes = structuralTree.filter((n) => n.status === "completed").length;
	const progress = dso.progress
		? updateProgressNode(dso.progress, nextNode.uuid, completedNodes)
		: undefined;

	return {
		documentSpec: dso.documentSpec,
		structuralTree,
		contextBuffer,
		progress,
	};
}

/**
 * Update sliding window with new content.
 * Maintains max token limit by truncating old content.
 */
function updateSlidingWindow(currentWindow: string, newContent: string): string {
	const maxTokens = DEFAULT_CONFIG.slidingWindowMaxTokens;
	const newWindow = currentWindow + "\n\n" + newContent;
	const tokens = estimateTokenCount(newWindow);

	if (tokens <= maxTokens) return newWindow.trim();

	// Truncate to fit
	const maxChars = maxTokens * 4;
	return newWindow.slice(-maxChars).trim();
}

/**
 * Create a brief summary of content.
 */
function createSummary(content: string): string {
	const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	return sentences.slice(0, 2).join(". ") + ".";
}

/**
 * Simple content hash for change detection.
 */
function hashContent(content: string): string {
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return hash.toString(16);
}

// ============================================================================
// Archive and Terminology Management
// ============================================================================

/** Archive TTL: 1 hour (entries older than this are pruned) */
const ARCHIVE_TTL = 60 * 60 * 1000;
/** Maximum archive size to prevent unbounded growth */
const MAX_ARCHIVE_SIZE = 50;

/**
 * Optimize archive by removing expired entries and enforcing size limit.
 * Uses a two-step pruning strategy:
 * 1. Remove entries older than ARCHIVE_TTL
 * 2. If still over MAX_ARCHIVE_SIZE, keep only the most recent entries
 *
 * @param archive - Current archive entries
 * @returns Optimized archive with expired/excess entries removed
 */
function optimizeArchive(archive: ArchivedContext[]): ArchivedContext[] {
	const now = Date.now();

	// Step 1: Filter out expired entries
	let filtered = archive.filter((entry) => {
		const entryAge = now - new Date(entry.archivedAt).getTime();
		return entryAge < ARCHIVE_TTL;
	});

	// Step 2: If still too large, keep only most recent entries
	if (filtered.length > MAX_ARCHIVE_SIZE) {
		filtered = filtered
			.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())
			.slice(0, MAX_ARCHIVE_SIZE);
	}

	return filtered;
}

/** Maximum terms to track in the terminological registry */
const MAX_TERMINOLOGY_TERMS = 50;

/**
 * Extract and add technical terms to terminology registry.
 * Identifies technical terminology patterns:
 * - CamelCase words (e.g., "DocumentSpec", "SynthesisEngine")
 * - Acronyms (e.g., "API", "JSON", "DSO")
 * - Hyphenated technical terms (e.g., "context-assembly", "node-generation")
 *
 * @param content - Generated content to extract terms from
 * @param registry - Current terminology registry
 * @param maxTerms - Maximum terms to keep (default: 50)
 * @returns Updated terminology registry with new terms added
 */
function updateTerminologyRegistry(
	content: string,
	registry: string[],
	maxTerms: number = MAX_TERMINOLOGY_TERMS
): string[] {
	// Pattern matches:
	// 1. CamelCase words (at least 2 parts): MyClass, DocumentSpec
	// 2. Acronyms (2+ uppercase letters): API, JSON, DSO
	// 3. Hyphenated terms: context-assembly, node-generation
	const technicalTermPattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Z]{2,}|[a-z]+(?:-[a-z]+)+)\b/g;
	const matches = content.match(technicalTermPattern) || [];

	// Filter out common stop words and short terms
	const newTerms = matches.filter((term) => {
		const normalized = term.toLowerCase();
		return (
			term.length > 2 &&
			!commonStopWords.includes(normalized) &&
			!registry.includes(term) // Avoid duplicates
		);
	});

	// Merge with existing registry, deduplicate, limit size
	const updated = [...new Set([...registry, ...newTerms])];
	return updated.slice(0, maxTerms);
}

/**
 * Regenerate a specific node.
 */
export async function regenerateNode(
	dso: DocumentStateObject,
	nodeId: string,
	options: SynthesisOptions = {}
): Promise<DocumentStateObject> {
	const node = dso.structuralTree.find((n) => n.uuid === nodeId);
	if (!node) throw new Error(`Node ${nodeId} not found`);

	// Reset node status
	node.status = "regenerating";
	node.content = undefined;
	node.metadata.semanticEmbedding = undefined;
	node.metadata.generatedContentHash = undefined;

	// Regenerate
	const context = assembleContext(node, dso.structuralTree, dso.contextBuffer);
	const result = await generateNodeContent(node, context, options, DEFAULT_CONFIG);

	// Update node
	node.content = result.content;
	node.status = "completed";
	node.metadata.semanticEmbedding = result.embedding;
	node.metadata.generatedContentHash = hashContent(result.content);
	node.generatedAt = result.generatedAt;

	return { ...dso };
}
