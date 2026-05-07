/**
 * useDocumentSynthesis Hook - DocFusion
 *
 * Main hook for document synthesis with Hierarchical Document State Object (DSO).
 * Manages generation state, orchestration, and coherence debt tracking.
 */

"use client";

import * as React from "react";
import {
	initDocumentSynthesis,
	generateNextNode,
	regenerateNode,
	getGenerationOrder,
	calculateCoherenceDebt,
	assembleDocument,
	topologicalSort,
	getParallelGenerationBatches,
	generateBatchParallel,
	calculateQualityMetrics,
} from "@/lib/ai/document-synthesis-engine";
import type {
	DocumentSpec,
	DocumentStateObject,
	StructuralNode,
	GenerationPhase,
	CoherenceDebt,
	SynthesisOptions,
	DocumentConfig,
	QualityMetrics,
} from "@/lib/types/document-synthesis";

// ============================================================================
// Types
// ============================================================================

export interface UseDocumentSynthesisOptions {
	/** Initial document specification */
	spec?: DocumentSpec;
	/** Auto-start generation after initialization */
	autoStart?: boolean;
	/** Callback when generation completes */
	onComplete?: () => void;
	/** Callback when error occurs */
	onError?: (error: Error) => void;
	/** Synthesis configuration */
	options?: SynthesisOptions;
	/** Custom config */
	config?: DocumentConfig;
	/** Enable parallel generation of sibling nodes (default: false) */
	parallelGeneration?: boolean;
}

export interface UseDocumentSynthesisReturn {
	// State
	/** Current document state object */
	dso: DocumentStateObject | null;
	/** Whether initializing outline */
	isInitializing: boolean;
	/** Whether generating content */
	isGenerating: boolean;
	/** Whether any operation is in progress */
	isLoading: boolean;
	/** Error state */
	error: Error | null;

	// Progress
	/** Current generation phase */
	currentPhase: GenerationPhase;
	/** Overall progress percentage (0-100) */
	progress: number;
	/** Current node being processed */
	currentNode: StructuralNode | null;
	/** Total nodes */
	totalNodes: number;
	/** Completed nodes */
	completedNodes: number;

	// Coherence Tracking
	/** Coherence debt across all nodes */
	coherenceDebt: CoherenceDebt;

	// Quality Metrics
	/** Comprehensive quality metrics for the current document */
	qualityMetrics: QualityMetrics | null;

	// Actions
	/** Initialize synthesis with document spec */
	initialize: (spec: DocumentSpec) => Promise<void>;
	/** Generate next pending node */
	generateNext: () => Promise<void>;
	/** Generate all remaining nodes */
	generateAll: () => Promise<void>;
	/** Regenerate a specific node */
	regenerateNode: (nodeId: string) => Promise<void>;
	/** Regenerate all nodes with issues */
	regenerateWithIssues: () => Promise<void>;
	/** Cancel ongoing generation */
	cancel: () => void;

	// Utilities
	/** Get assembled document content */
	getDocumentContent: () => string;
	/** Get nodes in generation order */
	getGenerationOrder: () => StructuralNode[];
	/** Get nodes with status */
	getNodesByStatus: (status: StructuralNode["status"]) => StructuralNode[];
	/** Reset synthesis */
	reset: () => void;
	/**
 * Update a node's metadata.
	 * @param nodeId - UUID of node to update
	 * @param updates - Partial metadata to update
	 */
	updateNodeMetadata: (
		nodeId: string,
		updates: Partial<StructuralNode["metadata"]>
	) => void;
	/**
 * Add a child node to a parent.
	 * @param parentId - Parent node UUID
	 * @param nodeType - Type of new node
	 * @param customPrompt - Custom prompt for new node
	 */
	addChildNode: (
		parentId: string,
		nodeType: StructuralNode["type"],
		customPrompt: string
	) => void;
	/**
 * Remove a node from the tree.
	 * @param nodeId - UUID of node to remove
	 * @returns Whether removal was successful
	 */
	removeNode: (nodeId: string) => boolean;
	/**
 * Move a node to a new position.
	 * @param nodeId - UUID of node to move
	 * @param targetParentId - New parent UUID, or null to make root
	 * @param targetIndex - Position within new parent's children
	 */
	moveNode: (
		nodeId: string,
		targetParentId: string | null,
		targetIndex?: number
	) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentSynthesis(
	options: UseDocumentSynthesisOptions = {}
): UseDocumentSynthesisReturn {
	const {
		autoStart = false,
		onComplete,
		onError,
		options: synthOptions = {},
		parallelGeneration = false,
	} = options;

	// State
	const [dso, setDso] = React.useState<DocumentStateObject | null>(null);
	const [isInitializing, setIsInitializing] = React.useState(false);
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [error, setError] = React.useState<Error | null>(null);

	// Refs for cancellation
	const abortRef = React.useRef(false);
	const generateAllRef = React.useRef<(() => Promise<void>) | null>(null);

	// Derived state
	const currentPhase = dso?.progress?.phase ?? "outline";
	const progress = dso?.progress?.percentage ?? 0;
	const currentNode = React.useMemo(() => {
		if (!dso || !dso.progress?.currentNodeId) return null;
		return dso.structuralTree.find((n) => n.uuid === dso.progress!.currentNodeId) ?? null;
	}, [dso]);
	const totalNodes = dso?.structuralTree.length ?? 0;
	const completedNodes = dso?.structuralTree.filter((n) => n.status === "completed").length ?? 0;

	// Coherence tracking
	const coherenceDebt = React.useMemo(() => {
		if (!dso?.structuralTree) {
			return {
				nodesWithIssues: [],
				totalDebt: 0,
				averageCoherence: 1,
				warnings: [],
			};
		}
		return calculateCoherenceDebt(dso.structuralTree);
	}, [dso?.structuralTree]);

	// Quality metrics - calculate overall document quality
	const qualityMetrics = React.useMemo((): QualityMetrics | null => {
		if (!dso?.structuralTree) return null;

		// Get all completed nodes with content
		const completedWithContent = dso.structuralTree.filter(
			(n) => n.status === "completed" && n.content
		);

		if (completedWithContent.length === 0) return null;

		// Calculate aggregate metrics across all completed nodes
		let totalCoherence = 0;
		let totalReadability = 0;
		let totalFluency = 0;
		let totalStructure = 0;

		for (const node of completedWithContent) {
			// Get parent content for coherence calculation
			const parent = node.parentId
				? dso.structuralTree.find((n) => n.uuid === node.parentId)
				: null;
			const parentContent = parent?.content ?? "";

			const nodeMetrics = calculateQualityMetrics(node.content!, parentContent);
			totalCoherence += nodeMetrics.coherenceScore;
			totalReadability += nodeMetrics.readabilityScore;
			totalFluency += nodeMetrics.fluencyScore;
			totalStructure += nodeMetrics.structureScore;
		}

		const count = completedWithContent.length;
		const avgCoherence = totalCoherence / count;
		const avgReadability = totalReadability / count;
		const avgFluency = totalFluency / count;
		const avgStructure = totalStructure / count;

		return {
			coherenceScore: avgCoherence,
			readabilityScore: avgReadability,
			fluencyScore: avgFluency,
			structureScore: avgStructure,
			overallScore:
				avgCoherence * 0.4 +
				(avgReadability / 100) * 0.2 +
				avgFluency * 0.2 +
				avgStructure * 0.2,
		};
	}, [dso?.structuralTree]);

	// ============================================================================
	// Actions
	// ============================================================================

	/**
	 * Initialize synthesis with document spec.
	 */
	const initialize = React.useCallback(
		async (spec: DocumentSpec) => {
			setIsInitializing(true);
			setError(null);
			abortRef.current = false;

			try {
				const newDso = await initDocumentSynthesis(spec);
				setDso(newDso);

				if (autoStart && !abortRef.current) {
					setIsInitializing(false);
					await generateAllRef.current?.();
				}
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				onError?.(error);
			} finally {
				setIsInitializing(false);
			}
		},
		[autoStart, onError]
	);

	/**
	 * Generate next pending node.
	 */
	const generateNext = React.useCallback(async () => {
		if (!dso || abortRef.current) return;

		setIsGenerating(true);
		setError(null);

		try {
			const updatedDso = await generateNextNode(dso, synthOptions);
			setDso(updatedDso);

			// Check if complete
			const allCompleted = updatedDso.structuralTree.every(
				(n) => n.status === "completed"
			);
			if (allCompleted) {
				onComplete?.();
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
			onError?.(error);
		} finally {
			setIsGenerating(false);
		}
	}, [dso, synthOptions, onComplete, onError]);

	/**
	 * Generate all remaining nodes.
	 * Supports both sequential and parallel generation modes.
	 *
	 * Sequential mode (default): Processes nodes one at a time in topological order.
	 * Parallel mode: Groups sibling nodes into batches and processes each batch concurrently.
	 */
	const generateAll = React.useCallback(async () => {
		if (!dso || abortRef.current) return;

		setIsGenerating(true);
		setError(null);

		try {
			if (parallelGeneration) {
				// Parallel mode: Process nodes in batches
				let currentDso = dso;
				const batches = getParallelGenerationBatches(currentDso.structuralTree);

				for (const batch of batches) {
					if (abortRef.current) break;

					// Skip batches with no pending nodes
					const pendingInBatch = batch.filter((n) => n.status === "pending");
					if (pendingInBatch.length === 0) continue;

					const updatedDso = await generateBatchParallel(currentDso, pendingInBatch, synthOptions);
					currentDso = updatedDso;
					setDso({ ...currentDso });
				}
			} else {
				// Sequential mode: Process nodes one at a time
				let currentDso = dso;
				while (!abortRef.current) {
					const pendingNodes = currentDso.structuralTree.filter((n) => n.status === "pending");
					if (pendingNodes.length === 0) break;

					const updatedDso = await generateNextNode(currentDso, synthOptions);
					currentDso = updatedDso;
					setDso({ ...currentDso });
				}
			}

			if (!abortRef.current) {
				onComplete?.();
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
			onError?.(error);
		} finally {
			setIsGenerating(false);
		}
	}, [dso, synthOptions, parallelGeneration, onComplete, onError]);
	generateAllRef.current = generateAll;

	/**
	 * Regenerate a specific node.
	 */
	const regenerate = React.useCallback(
		async (nodeId: string) => {
			if (!dso) return;

			setIsGenerating(true);
			setError(null);

			try {
				const updatedDso = await regenerateNode(dso, nodeId, synthOptions);
				setDso(updatedDso);
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				onError?.(error);
			} finally {
				setIsGenerating(false);
			}
		},
		[dso, synthOptions, onError]
	);

	/**
	 * Regenerate nodes with coherence issues.
	 */
	const regenerateWithIssues = React.useCallback(async () => {
		if (!dso || coherenceDebt.nodesWithIssues.length === 0) return;

		setIsGenerating(true);
		setError(null);

		for (const nodeId of coherenceDebt.nodesWithIssues) {
			if (abortRef.current) break;
			try {
				const updatedDso = await regenerateNode(dso, nodeId, synthOptions);
				setDso({ ...updatedDso });
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);
				onError?.(error);
				break;
			}
		}

		setIsGenerating(false);
	}, [dso, coherenceDebt.nodesWithIssues, synthOptions, onError]);

	/**
	 * Cancel ongoing generation.
	 */
	const cancel = React.useCallback(() => {
		abortRef.current = true;
		setIsGenerating(false);
	}, []);

	// ============================================================================
	// Utilities
	// ============================================================================

	/**
	 * Get assembled document content.
	 */
	const getDocumentContent = React.useCallback(() => {
		if (!dso) return "";
		return assembleDocument(dso.structuralTree);
	}, [dso]);

	/**
	 * Get nodes in generation order.
	 */
	const getOrderedNodes = React.useCallback((): StructuralNode[] => {
		if (!dso) return [];
		return getGenerationOrder(dso.structuralTree);
	}, [dso]);

	/**
	 * Get nodes by status.
	 */
	const getNodesByStatus = React.useCallback(
		(status: StructuralNode["status"]): StructuralNode[] => {
			if (!dso) return [];
			return dso.structuralTree.filter((n) => n.status === status);
		},
		[dso]
	);

	/**
	 * Reset synthesis state.
	 */
	const reset = React.useCallback(() => {
		cancel();
		setDso(null);
		setError(null);
		setIsInitializing(false);
		setIsGenerating(false);
	}, [cancel]);

	/**
	 * Update node metadata.
	 */
	const updateNodeMetadata = React.useCallback(
		(nodeId: string, updates: Partial<StructuralNode["metadata"]>) => {
			if (!dso) return;

			setDso((prev) => {
				if (!prev) return null;
				return {
					...prev,
					structuralTree: prev.structuralTree.map((node) =>
						node.uuid === nodeId
							? {
									...node,
									metadata: { ...node.metadata, ...updates },
								}
							: node
					),
				};
			});
		},
		[dso]
	);

	/**
	 * Add a new child node.
	 */
	const addChildNode = React.useCallback(
		(parentId: string, nodeType: StructuralNode["type"], customPrompt: string) => {
			if (!dso) return;

			const parent = dso.structuralTree.find((n) => n.uuid === parentId);
			if (!parent) return;

			const newNode: StructuralNode = {
				uuid: `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
				path: `${parent.path}.${parent.children.length + 1}`,
				type: nodeType,
				parentId,
				children: [],
				metadata: {
					customPrompt,
					tokenBudget: 3333,
					densityTarget: 2.5,
					estimatedWordCount: 2500,
					estimatedReadingTime: 2,
				},
				status: "pending",
			};

			setDso((prev) => {
				if (!prev) return null;
				return {
					...prev,
					structuralTree: [
						...prev.structuralTree,
						newNode,
						{
							...parent,
							children: [...parent.children, newNode.uuid],
						},
					],
				};
			});
		},
		[dso]
	);

	/**
	 * Remove a node and its descendants.
	 */
	const removeNode = React.useCallback(
		(nodeId: string): boolean => {
			if (!dso) return false;

			const target = dso.structuralTree.find((n) => n.uuid === nodeId);
			if (!target) return false;

			// Get all descendants to remove
			const toRemove = new Set<string>();
			const collectDescendants = (id: string) => {
				const node = dso.structuralTree.find((n) => n.uuid === id);
				if (!node) return;
				toRemove.add(id);
				for (const childId of node.children) {
					collectDescendants(childId);
				}
			};
			collectDescendants(nodeId);

			setDso((prev) => {
				if (!prev) return null;

				// Remove the node and update parent's children
				const newTree = prev.structuralTree
					.filter((n) => !toRemove.has(n.uuid))
					.map((n) =>
						n.uuid === target.parentId
							? { ...n, children: n.children.filter((id) => id !== nodeId) }
							: n
					);

				return { ...prev, structuralTree: newTree };
			});

			return true;
		},
		[dso]
	);

	/**
	 * Move a node to a new position.
	 */
	const moveNode = React.useCallback(
		(nodeId: string, targetParentId: string | null, targetIndex?: number) => {
			if (!dso) return;

			const node = dso.structuralTree.find((n) => n.uuid === nodeId);
			if (!node) return;

			// Remove from current parent
			let newTree = dso.structuralTree.map((n) =>
				n.uuid === node.parentId
					? { ...n, children: n.children.filter((id) => id !== nodeId) }
					: n
			);

			// Add to new parent
			if (targetParentId) {
				newTree = newTree.map((n) =>
					n.uuid === targetParentId
						? {
								...n,
								children: [
									...n.children.slice(0, targetIndex ?? n.children.length),
									nodeId,
									...n.children.slice(targetIndex ?? n.children.length),
								],
							}
							: n
				);
			}

			// Update node's parent
			newTree = newTree.map((n) => (n.uuid === nodeId ? { ...n, parentId: targetParentId } : n));

			// Recalculate paths
			const recalculatePaths = (nodes: StructuralNode[]): StructuralNode[] => {
				const nodeMap = new Map(nodes.map((n) => [n.uuid, n]));
				const result = [...nodes];

				const calculatePath = (node: StructuralNode, index: number): string => {
					if (!node.parentId) return String(index + 1);
					const parent = nodeMap.get(node.parentId);
					if (!parent) return String(index + 1);
					const parentIndex = parent.children.indexOf(node.uuid);
					return `${parent.path}.${parentIndex + 1}`;
				};

				return result.map((n) => {
					const parent = n.parentId ? nodeMap.get(n.parentId) : null;
					const index = parent ? parent.children.indexOf(n.uuid) : 0;
					return { ...n, path: calculatePath(n, index) };
				});
			};

			setDso((prev) => {
				if (!prev) return null;
				return { ...prev, structuralTree: recalculatePaths(newTree) };
			});
		},
		[dso]
	);

	return {
		// State
		dso,
		isInitializing,
		isGenerating,
		isLoading: isInitializing || isGenerating,
		error,

		// Progress
		currentPhase,
		progress,
		currentNode,
		totalNodes,
		completedNodes,

		// Coherence
		coherenceDebt,

		// Quality Metrics
		qualityMetrics,

		// Actions
		initialize,
		generateNext,
		generateAll,
		regenerateNode: regenerate,
		regenerateWithIssues,
		cancel,

		// Utilities
		getDocumentContent,
		getGenerationOrder: getOrderedNodes,
		getNodesByStatus,
		reset,
		updateNodeMetadata,
		addChildNode,
		removeNode,
		moveNode,
	};
}

export default useDocumentSynthesis;
