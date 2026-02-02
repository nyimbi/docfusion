"use client";

/**
 * Coherence Detection Service for HDSI
 *
 * Provides semantic coherence analysis between document nodes:
 * - Coherence debt detection (score < 0.6 threshold)
 * - Pulse frequency calculation (0.5-3 Hz based on urgency)
 * - Embedding drift measurement (content change detection)
 * - Terminology consistency analysis
 *
 * Uses cosineSimilarity from embeddings.ts for vector comparisons.
 */

import { cosineSimilarity } from "./embeddings";
import type {
	HDSINode,
	CoherenceDebt,
	DocumentCoherence,
	CoherenceReport,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

/** Coherence score below which debt is triggered */
const DEBT_THRESHOLD = 0.6;

/** Minimum coherence score (floor for calculations) */
const MIN_COHERENCE = 0.0;

/** Maximum coherence score (ceiling) */
const MAX_COHERENCE = 1.0;

/** Pulse frequency range in Hz */
const PULSE_FREQUENCY = {
	min: 0.5, // Slowest pulse for scores near threshold
	max: 3.0, // Fastest pulse for lowest scores
};

/** Embedding drift threshold for staleness detection */
const DRIFT_THRESHOLD = 0.15;

/** Weight factors for coherence calculation */
const COHERENCE_WEIGHTS = {
	semanticSimilarity: 0.4,
	terminologyConsistency: 0.3,
	thematicAlignment: 0.2,
	styleConsistency: 0.1,
};

// ============================================================================
// Core Coherence Functions
// ============================================================================

/**
 * Detect coherence debt for a node based on its relationship with siblings and context.
 *
 * @param node - The node to analyze
 * @param siblings - Adjacent nodes at the same level
 * @param parentEmbedding - Embedding vector of the parent node (if available)
 * @param nodeEmbedding - Embedding vector of the target node
 * @param siblingEmbeddings - Embedding vectors of sibling nodes
 * @returns CoherenceDebt if debt detected, null otherwise
 */
export function detectCoherenceDebt(
	node: HDSINode,
	siblings: HDSINode[],
	nodeEmbedding?: number[],
	siblingEmbeddings?: Map<string, number[]>,
	parentEmbedding?: number[]
): CoherenceDebt | null {
	// Skip if node has no generated content
	if (!node.generatedContent || node.status === "outline") {
		return null;
	}

	// Calculate coherence score
	const score = calculateCoherenceScore(
		node,
		siblings,
		nodeEmbedding,
		siblingEmbeddings,
		parentEmbedding
	);

	// No debt if above threshold
	if (score >= DEBT_THRESHOLD) {
		return null;
	}

	// Determine debt reason
	const reason = determineDebtReason(
		node,
		siblings,
		nodeEmbedding,
		siblingEmbeddings
	);

	// Generate improvement suggestions
	const suggestions = generateSuggestions(reason, node, siblings);

	// Find related nodes contributing to the debt
	const relatedNodeIds = findRelatedDebtNodes(
		node,
		siblings,
		nodeEmbedding,
		siblingEmbeddings
	);

	return {
		nodeId: node.id,
		score,
		pulseFrequency: calculatePulseFrequency(score),
		suggestions,
		reason,
		relatedNodeIds,
	};
}

/**
 * Calculate overall coherence score for a node.
 *
 * Combines multiple factors:
 * - Semantic similarity with siblings
 * - Terminology consistency
 * - Thematic alignment with parent
 * - Style consistency
 */
export function calculateCoherenceScore(
	node: HDSINode,
	siblings: HDSINode[],
	nodeEmbedding?: number[],
	siblingEmbeddings?: Map<string, number[]>,
	parentEmbedding?: number[]
): number {
	const scores: number[] = [];

	// 1. Semantic similarity with siblings (if embeddings available)
	if (nodeEmbedding && siblingEmbeddings && siblingEmbeddings.size > 0) {
		const siblingScores: number[] = [];
		for (const [siblingId, embedding] of siblingEmbeddings) {
			if (siblingId !== node.id) {
				const similarity = cosineSimilarity(nodeEmbedding, embedding);
				siblingScores.push(similarity);
			}
		}
		if (siblingScores.length > 0) {
			const avgSimilarity =
				siblingScores.reduce((a, b) => a + b, 0) / siblingScores.length;
			// Normalize to 0.5-1.0 range (some dissimilarity is expected)
			scores.push(
				Math.min(1.0, 0.5 + avgSimilarity * 0.5) *
					COHERENCE_WEIGHTS.semanticSimilarity
			);
		}
	}

	// 2. Terminology consistency (text-based analysis)
	const termScore = calculateTerminologyConsistency(node, siblings);
	scores.push(termScore * COHERENCE_WEIGHTS.terminologyConsistency);

	// 3. Thematic alignment with parent
	if (nodeEmbedding && parentEmbedding) {
		const parentSimilarity = cosineSimilarity(nodeEmbedding, parentEmbedding);
		scores.push(parentSimilarity * COHERENCE_WEIGHTS.thematicAlignment);
	} else {
		// Default to reasonable score if no parent embedding
		scores.push(0.8 * COHERENCE_WEIGHTS.thematicAlignment);
	}

	// 4. Style consistency (length, complexity)
	const styleScore = calculateStyleConsistency(node, siblings);
	scores.push(styleScore * COHERENCE_WEIGHTS.styleConsistency);

	// Sum weighted scores (already weighted above)
	const totalWeight =
		scores.length > 0
			? Object.values(COHERENCE_WEIGHTS)
					.slice(0, scores.length)
					.reduce((a, b) => a + b, 0)
			: 1;

	const rawScore = scores.reduce((a, b) => a + b, 0);
	const normalizedScore = rawScore / totalWeight;

	// Clamp to valid range
	return Math.max(MIN_COHERENCE, Math.min(MAX_COHERENCE, normalizedScore));
}

/**
 * Calculate pulse frequency based on coherence score.
 *
 * Lower scores = faster pulsing (more urgent visual feedback).
 * Score 0.0 → 3.0 Hz (very urgent)
 * Score 0.6 → 0.5 Hz (threshold)
 */
export function calculatePulseFrequency(score: number): number {
	// Clamp score to debt range [0, DEBT_THRESHOLD]
	const clampedScore = Math.max(0, Math.min(DEBT_THRESHOLD, score));

	// Linear interpolation: 0 → max Hz, threshold → min Hz
	const t = clampedScore / DEBT_THRESHOLD;
	return PULSE_FREQUENCY.max - t * (PULSE_FREQUENCY.max - PULSE_FREQUENCY.min);
}

/**
 * Convert pulse frequency to CSS animation duration in milliseconds.
 */
export function frequencyToMs(hz: number): number {
	return Math.round(1000 / hz);
}

/**
 * Calculate embedding drift between current and previous content.
 *
 * @param currentEmbedding - Current content embedding
 * @param previousEmbedding - Previous content embedding
 * @returns Drift percentage (0-1, higher = more drift)
 */
export function calculateEmbeddingDrift(
	currentEmbedding: number[],
	previousEmbedding: number[]
): number {
	if (
		!currentEmbedding ||
		!previousEmbedding ||
		currentEmbedding.length !== previousEmbedding.length
	) {
		return 0;
	}

	const similarity = cosineSimilarity(currentEmbedding, previousEmbedding);
	// Drift is inverse of similarity
	return 1 - similarity;
}

/**
 * Check if content has drifted significantly (potentially stale).
 */
export function isContentStale(drift: number): boolean {
	return drift > DRIFT_THRESHOLD;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate terminology consistency score based on shared terms.
 */
function calculateTerminologyConsistency(
	node: HDSINode,
	siblings: HDSINode[]
): number {
	if (!node.generatedContent) return 0.5;

	// Extract significant terms (words > 4 chars, lowercase)
	const nodeTerms = extractTerms(node.generatedContent);

	if (nodeTerms.size === 0 || siblings.length === 0) return 0.5;

	// Collect terms from siblings
	const siblingTermSets = siblings
		.filter((s) => s.id !== node.id && s.generatedContent)
		.map((s) => extractTerms(s.generatedContent || ""));

	if (siblingTermSets.length === 0) return 0.5;

	// Calculate Jaccard similarity with each sibling
	const similarities = siblingTermSets.map((sibTerms) => {
		const intersection = new Set([...nodeTerms].filter((t) => sibTerms.has(t)));
		const union = new Set([...nodeTerms, ...sibTerms]);
		return union.size > 0 ? intersection.size / union.size : 0;
	});

	// Return average similarity, normalized to 0.5-1.0 range
	const avgSimilarity =
		similarities.reduce((a, b) => a + b, 0) / similarities.length;
	return 0.5 + avgSimilarity * 0.5;
}

/**
 * Extract significant terms from text.
 */
function extractTerms(text: string): Set<string> {
	const words = text
		.toLowerCase()
		.replace(/[^\w\s]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 4);

	return new Set(words);
}

/**
 * Calculate style consistency (content length and complexity).
 */
function calculateStyleConsistency(
	node: HDSINode,
	siblings: HDSINode[]
): number {
	if (!node.generatedContent) return 0.5;

	const nodeLength = node.generatedContent.length;
	const siblingLengths = siblings
		.filter((s) => s.id !== node.id && s.generatedContent)
		.map((s) => s.generatedContent!.length);

	if (siblingLengths.length === 0) return 0.5;

	// Calculate average sibling length
	const avgLength =
		siblingLengths.reduce((a, b) => a + b, 0) / siblingLengths.length;

	// Calculate relative difference
	const diff = Math.abs(nodeLength - avgLength) / Math.max(avgLength, 1);

	// Score: 1.0 for same length, decreasing with difference
	// Difference of 100% → 0.5 score
	return Math.max(0, 1 - diff);
}

/**
 * Determine the primary reason for coherence debt.
 */
function determineDebtReason(
	node: HDSINode,
	siblings: HDSINode[],
	nodeEmbedding?: number[],
	siblingEmbeddings?: Map<string, number[]>
): CoherenceDebt["reason"] {
	// Check semantic similarity first
	if (nodeEmbedding && siblingEmbeddings) {
		let avgSimilarity = 0;
		let count = 0;
		for (const [id, emb] of siblingEmbeddings) {
			if (id !== node.id) {
				avgSimilarity += cosineSimilarity(nodeEmbedding, emb);
				count++;
			}
		}
		if (count > 0 && avgSimilarity / count < 0.5) {
			return "low_similarity";
		}
	}

	// Check terminology
	const termScore = calculateTerminologyConsistency(node, siblings);
	if (termScore < 0.6) {
		return "terminology_mismatch";
	}

	// Check style
	const styleScore = calculateStyleConsistency(node, siblings);
	if (styleScore < 0.6) {
		return "style_inconsistency";
	}

	// Default to thematic drift
	return "thematic_drift";
}

/**
 * Generate improvement suggestions based on debt reason.
 */
function generateSuggestions(
	reason: CoherenceDebt["reason"],
	node: HDSINode,
	siblings: HDSINode[]
): string[] {
	const suggestions: string[] = [];

	switch (reason) {
		case "low_similarity":
			suggestions.push("Review content against sibling sections for alignment");
			suggestions.push("Consider regenerating with more context from adjacent sections");
			break;

		case "terminology_mismatch":
			suggestions.push("Use consistent terminology with other sections");
			if (siblings.length > 0) {
				const sibTerms = siblings
					.filter((s) => s.generatedContent)
					.flatMap((s) => [...extractTerms(s.generatedContent!)])
					.slice(0, 5);
				if (sibTerms.length > 0) {
					suggestions.push(`Consider using terms: ${sibTerms.join(", ")}`);
				}
			}
			break;

		case "thematic_drift":
			suggestions.push("Content may have drifted from the section's purpose");
			suggestions.push("Review the custom prompt and regenerate");
			break;

		case "style_inconsistency":
			suggestions.push("Adjust content length to match sibling sections");
			suggestions.push("Consider the density target setting");
			break;
	}

	return suggestions;
}

/**
 * Find sibling nodes contributing most to the debt.
 */
function findRelatedDebtNodes(
	node: HDSINode,
	siblings: HDSINode[],
	nodeEmbedding?: number[],
	siblingEmbeddings?: Map<string, number[]>
): string[] {
	if (!nodeEmbedding || !siblingEmbeddings) {
		return [];
	}

	// Find siblings with lowest similarity
	const similarityScores: Array<{ id: string; score: number }> = [];

	for (const [id, emb] of siblingEmbeddings) {
		if (id !== node.id) {
			similarityScores.push({
				id,
				score: cosineSimilarity(nodeEmbedding, emb),
			});
		}
	}

	// Return IDs of nodes with lowest similarity
	return similarityScores
		.sort((a, b) => a.score - b.score)
		.slice(0, 3)
		.map((s) => s.id);
}

// ============================================================================
// Document-Level Analysis
// ============================================================================

/**
 * Analyze coherence across entire document structure.
 */
export function analyzeDocumentCoherence(
	nodes: HDSINode[],
	embeddings?: Map<string, number[]>
): DocumentCoherence {
	const debtNodes: CoherenceDebt[] = [];

	// Recursive analysis
	function analyzeLevel(
		levelNodes: HDSINode[],
		parentEmbedding?: number[]
	): void {
		for (const node of levelNodes) {
			const nodeEmbedding = embeddings?.get(node.id);

			// Get sibling embeddings
			const siblingEmbeddings = new Map<string, number[]>();
			for (const sibling of levelNodes) {
				const sibEmb = embeddings?.get(sibling.id);
				if (sibEmb) {
					siblingEmbeddings.set(sibling.id, sibEmb);
				}
			}

			// Detect debt for this node
			const debt = detectCoherenceDebt(
				node,
				levelNodes,
				nodeEmbedding,
				siblingEmbeddings,
				parentEmbedding
			);

			if (debt) {
				debtNodes.push(debt);
			}

			// Recurse into children
			if (node.children.length > 0) {
				analyzeLevel(node.children, nodeEmbedding);
			}
		}
	}

	analyzeLevel(nodes);

	// Calculate overall score
	const allScores = nodes
		.flatMap(function collectScores(n: HDSINode): number[] {
			const scores = [n.coherenceScore];
			if (n.children.length > 0) {
				scores.push(...n.children.flatMap(collectScores));
			}
			return scores;
		})
		.filter((s) => s > 0);

	const overallScore =
		allScores.length > 0
			? allScores.reduce((a, b) => a + b, 0) / allScores.length
			: 1.0;

	return {
		overallScore,
		debtNodes,
		analyzedAt: new Date(),
		isAnalyzing: false,
	};
}

/**
 * Generate a comprehensive coherence report.
 */
export function generateCoherenceReport(
	nodes: HDSINode[],
	embeddings?: Map<string, number[]>
): CoherenceReport {
	const documentCoherence = analyzeDocumentCoherence(nodes, embeddings);

	// Calculate term consistency across document
	const allTerms: Set<string>[] = [];
	function collectTerms(levelNodes: HDSINode[]) {
		for (const node of levelNodes) {
			if (node.generatedContent) {
				allTerms.push(extractTerms(node.generatedContent));
			}
			if (node.children.length > 0) {
				collectTerms(node.children);
			}
		}
	}
	collectTerms(nodes);

	// Calculate overall term overlap
	let termConsistency = 1.0;
	if (allTerms.length > 1) {
		const commonTerms = allTerms.reduce((common, terms) => {
			return new Set([...common].filter((t) => terms.has(t)));
		});
		const allUniqueTerms = new Set(allTerms.flatMap((t) => [...t]));
		termConsistency =
			allUniqueTerms.size > 0 ? commonTerms.size / allUniqueTerms.size : 1.0;
	}

	// Calculate thematic drift (standard deviation of scores)
	const scores = documentCoherence.debtNodes.map((d) => d.score);
	const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 1.0;
	const variance = scores.length > 0
		? scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
		: 0;
	const thematicDrift = Math.sqrt(variance);

	// Generate suggestions
	const suggestions: string[] = [];
	if (documentCoherence.overallScore < 0.7) {
		suggestions.push("Consider reviewing document structure for better coherence");
	}
	if (termConsistency < 0.3) {
		suggestions.push("Establish consistent terminology across sections");
	}
	if (thematicDrift > 0.2) {
		suggestions.push("Some sections may have drifted from the main theme");
	}

	return {
		overallScore: documentCoherence.overallScore,
		termConsistency,
		thematicDrift,
		suggestions,
	};
}

// ============================================================================
// React Hook for Coherence Tracking
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react";

export interface UseCoherenceOptions {
	/** Debounce delay in ms for analysis */
	debounceMs?: number;
	/** Whether to auto-analyze on structure changes */
	autoAnalyze?: boolean;
}

export function useCoherence(
	nodes: HDSINode[],
	embeddings?: Map<string, number[]>,
	options: UseCoherenceOptions = {}
) {
	const { debounceMs = 500, autoAnalyze = true } = options;

	const [coherence, setCoherence] = useState<DocumentCoherence>({
		overallScore: 1.0,
		debtNodes: [],
		analyzedAt: new Date(),
		isAnalyzing: false,
	});

	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const analyze = useCallback(() => {
		setCoherence((prev) => ({ ...prev, isAnalyzing: true }));

		// Run analysis asynchronously
		setTimeout(() => {
			const result = analyzeDocumentCoherence(nodes, embeddings);
			setCoherence(result);
		}, 0);
	}, [nodes, embeddings]);

	// Auto-analyze with debounce
	useEffect(() => {
		if (!autoAnalyze) return;

		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = setTimeout(() => {
			analyze();
		}, debounceMs);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [nodes, embeddings, autoAnalyze, debounceMs, analyze]);

	const getNodeDebt = useCallback(
		(nodeId: string): CoherenceDebt | undefined => {
			return coherence.debtNodes.find((d) => d.nodeId === nodeId);
		},
		[coherence.debtNodes]
	);

	const hasDebt = useCallback(
		(nodeId: string): boolean => {
			return coherence.debtNodes.some((d) => d.nodeId === nodeId);
		},
		[coherence.debtNodes]
	);

	return {
		coherence,
		analyze,
		getNodeDebt,
		hasDebt,
		isAnalyzing: coherence.isAnalyzing,
	};
}

// ============================================================================
// Exports
// ============================================================================

export {
	DEBT_THRESHOLD,
	PULSE_FREQUENCY,
	DRIFT_THRESHOLD,
	COHERENCE_WEIGHTS,
};
