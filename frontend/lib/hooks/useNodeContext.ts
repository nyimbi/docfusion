/**
 * useNodeContext Hook - DocFusion
 *
 * Hook for assembling context for document synthesis nodes.
 * Retrieves parent content, computes sibling summaries,
 * and performs semantic similarity search.
 */

"use client";

import * as React from "react";
import {
	assembleContext,
	cosineSimilarity,
} from "@/lib/ai/document-synthesis-engine";
import type {
	StructuralNode,
	ContextBuffer,
	AssembledContext,
	SynthesisConfig,
} from "@/lib/types/document-synthesis";

// ============================================================================
// Types
// ============================================================================

export interface UseNodeContextOptions {
	/** All structural nodes */
	nodes: StructuralNode[];
	/** Current context buffer */
	buffer: ContextBuffer;
	/** Optional synthesis configuration */
	config?: SynthesisConfig;
}

export interface SiblingSummary {
	/** UUID of sibling node */
	nodeId: string;
	/** Sibling title/topic */
	title: string;
	/** Truncated summary */
	summary: string;
	/** Completion status */
	status: StructuralNode["status"];
	/** Generated timestamp */
	generatedAt?: string;
}

export interface ParentContext {
	/** UUID of parent node */
	parentId: string;
	/** Parent title/topic */
	title: string;
	/** Full parent content */
	content: string;
	/** Parent embedding for coherence check */
	embedding?: number[];
}

export interface SemanticMatch {
	/** UUID of matched archived context */
	archiveId: string;
	/** Original node ID */
	nodeId: string;
	/** Content summary */
	summary: string;
	/** Similarity score (0-1) */
	similarity: number;
	/** Archived timestamp */
	archivedAt: string;
}

export interface UseNodeContextReturn {
	/**
	 * Get assembled context for a specific node.
	 * Includes parent content, sibling summaries, and semantic matches.
	 * @param nodeId - UUID of node to get context for
	 */
	getContext: (nodeId: string) => AssembledContext | null;

	/**
	 * Get parent node(s) with full context.
	 * Returns chain from direct parent to root.
	 * @param nodeId - UUID of node to get parent context for
	 */
	getParentContext: (nodeId: string) => ParentContext[];

	/**
	 * Get sibling nodes with summaries.
	 * Excludes the target node itself.
	 * @param nodeId - UUID of node to get siblings for
	 */
	getSiblingSummaries: (nodeId: string) => SiblingSummary[];

	/**
	 * Search archive for semantically similar content.
	 * Uses cosine similarity on embeddings.
	 * @param queryEmbedding - Embedding vector to search with
	 * @param threshold - Minimum similarity score (0-1)
	 * @param limit - Maximum results to return
	 */
	searchArchive: (
		queryEmbedding: number[],
		threshold?: number,
		limit?: number
	) => SemanticMatch[];

	/**
	 * Get terminological registry (registered key terms).
	 */
	getTerminology: () => string[];

	/**
	 * Get current rhetorical mode/style.
	 */
	getRhetoricalMode: () => string;

	/**
	 * Get sliding window content.
	 */
	getSlidingWindow: () => string;

	/**
	 * Calculate semantic similarity between two contents.
	 * @param embeddingA - First embedding vector
	 * @param embeddingB - Second embedding vector
	 */
	calculateSimilarity: (embeddingA: number[], embeddingB: number[]) => number;

	/**
	 * Check if content is semantically coherent with parent.
	 * Returns similarity score between content and parent.
	 * @param nodeId - Node to check coherence for
	 */
	checkCoherence: (nodeId: string) => number;

	/**
	 * Get context size in tokens (estimated).
	 * @param nodeId - UUID of node to check context size for
	 */
	getContextSize: (nodeId: string) => number;

	/**
	 * Get all completed nodes (with embeddings available).
	 */
	getCompletedNodes: () => StructuralNode[];

	/**
	 * Refresh the context buffer.
	 * Call after nodes are updated.
	 */
	refreshBuffer: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useNodeContext(options: UseNodeContextOptions): UseNodeContextReturn {
	const { nodes, buffer, config } = options;
	const [localBuffer, setLocalBuffer] = React.useState<ContextBuffer>(buffer);
	const nodeMap = React.useMemo(() => new Map(nodes.map((n) => [n.uuid, n])), [nodes]);

	// Update local buffer when props change
	React.useEffect(() => {
		setLocalBuffer(buffer);
	}, [buffer]);

	// ============================================================================
	// Context Assembly
	// ============================================================================

	/**
	 * Get assembled context for a node.
	 */
	const getContext = React.useCallback(
		(nodeId: string): AssembledContext | null => {
			const node = nodeMap.get(nodeId);
			if (!node) return null;

			return assembleContext(node, nodes, localBuffer, config);
		},
		[nodeMap, nodes, localBuffer, config]
	);

	// ============================================================================
	// Parent Context
	// ============================================================================

	/**
	 * Get parent chain with full content.
	 */
	const getParentContext = React.useCallback(
		(nodeId: string): ParentContext[] => {
			const result: ParentContext[] = [];
			let currentId: string | null = nodeMap.get(nodeId)?.parentId ?? null;

			while (currentId) {
				const parent = nodeMap.get(currentId);
				if (!parent) break;

				result.push({
					parentId: currentId,
					title: parent.metadata.customPrompt.split(":")[1]?.trim() || "Untitled",
					content: parent.content || "",
					embedding: parent.metadata.semanticEmbedding,
				});

				currentId = parent.parentId;
			}

			return result.reverse(); // Root first
		},
		[nodeMap]
	);

	// ============================================================================
	// Sibling Summaries
	// ============================================================================

	/**
	 * Get sibling summaries.
	 */
	const getSiblingSummaries = React.useCallback(
		(nodeId: string): SiblingSummary[] => {
			const node = nodeMap.get(nodeId);
			if (!node?.parentId) return [];

			const parent = nodeMap.get(node.parentId);
			if (!parent) return [];

			return parent.children
				.filter((id) => id !== nodeId)
				.map((id) => {
					const sibling = nodeMap.get(id);
					if (!sibling) return null;

					return {
						nodeId: sibling.uuid,
						title: sibling.metadata.customPrompt.split(":")[0]?.trim() || "Untitled",
						summary: sibling.content
							? truncateToTokens(sibling.content, 150)
							: "Pending...",
						status: sibling.status,
						generatedAt: sibling.generatedAt,
					} as SiblingSummary;
				})
				.filter(Boolean) as SiblingSummary[];
		},
		[nodeMap]
	);

	// ============================================================================
	// Archive Search
	// ============================================================================

	/**
	 * Search archive for semantically similar content.
	 */
	const searchArchive = React.useCallback(
		(
			queryEmbedding: number[],
			threshold: number = 0.7,
			limit: number = 3
		): SemanticMatch[] => {
			if (!queryEmbedding || localBuffer.archive.length === 0) return [];

			// Calculate similarities
			const matches = localBuffer.archive.map((entry) => ({
				archiveId: `${entry.nodeId}_${entry.archivedAt}`,
				nodeId: entry.nodeId,
				summary: entry.summary,
				similarity: cosineSimilarity(queryEmbedding, entry.embedding),
				archivedAt: entry.archivedAt,
			}));

			// Filter, sort, and limit
			return matches
				.filter((m) => m.similarity >= threshold)
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, limit);
		},
		[localBuffer.archive]
	);

	// ============================================================================
	// Buffer Accessors
	// ============================================================================

	/**
	 * Get terminology registry.
	 */
	const getTerminology = React.useCallback((): string[] => {
		return [...localBuffer.terminologicalRegistry];
	}, [localBuffer.terminologicalRegistry]);

	/**
	 * Get rhetorical mode.
	 */
	const getRhetoricalMode = React.useCallback((): string => {
		return localBuffer.rhetoricalMode;
	}, [localBuffer.rhetoricalMode]);

	/**
	 * Get sliding window.
	 */
	const getSlidingWindow = React.useCallback((): string => {
		return localBuffer.slidingWindow;
	}, [localBuffer.slidingWindow]);

	// ============================================================================
	// Utility Functions
	// ============================================================================

	/**
	 * Calculate similarity between two embeddings.
	 */
	const calculateSimilarity = React.useCallback(
		(embeddingA: number[], embeddingB: number[]): number => {
			return cosineSimilarity(embeddingA, embeddingB);
		},
		[]
	);

	/**
	 * Check coherence with parent.
	 */
	const checkCoherence = React.useCallback(
		(nodeId: string): number => {
			const node = nodeMap.get(nodeId);
			if (!node || !node.parentId || !node.metadata.semanticEmbedding) return 1.0;

			const parent = nodeMap.get(node.parentId);
			if (!parent?.metadata.semanticEmbedding) return 1.0;

			return cosineSimilarity(node.metadata.semanticEmbedding, parent.metadata.semanticEmbedding);
		},
		[nodeMap]
	);

	/**
	 * Get estimated context size in tokens.
	 */
	const getContextSize = React.useCallback(
		(nodeId: string): number => {
			const context = getContext(nodeId);
			return context?.tokenCount ?? 0;
		},
		[getContext]
	);

	/**
	 * Get completed nodes.
	 */
	const getCompletedNodes = React.useCallback((): StructuralNode[] => {
		return nodes.filter((n) => n.status === "completed" && n.metadata.semanticEmbedding);
	}, [nodes]);

	/**
	 * Refresh buffer.
	 */
	const refreshBuffer = React.useCallback(() => {
		setLocalBuffer({ ...localBuffer });
	}, [localBuffer]);

	return {
		getContext,
		getParentContext,
		getSiblingSummaries,
		searchArchive,
		getTerminology,
		getRhetoricalMode,
		getSlidingWindow,
		calculateSimilarity,
		checkCoherence,
		getContextSize,
		getCompletedNodes,
		refreshBuffer,
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate text to approximately maxTokens.
 * Rough estimation: ~4 characters per token.
 */
function truncateToTokens(text: string, maxTokens: number): string {
	const maxChars = maxTokens * 4;
	if (text.length <= maxChars) return text;
	return text.substring(0, maxChars - 3) + "...";
}

export default useNodeContext;

