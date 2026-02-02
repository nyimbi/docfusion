/**
 * PipelineBoard Component - DocFusion Capture Pipeline
 *
 * Kanban board for visualizing and managing capture pipeline stages.
 * Supports drag-and-drop stage transitions with validation and
 * visual indicators for PWin, value, and deadline status.
 *
 * Accessibility: Full keyboard navigation, ARIA live regions for updates.
 */

"use client";

import * as React from "react";
import { useState, useCallback, useTransition, useMemo } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Plus,
	Filter,
	LayoutGrid,
	List,
	ChevronRight,
	AlertTriangle,
	TrendingUp,
	DollarSign,
	Calendar,
	RefreshCw,
} from "lucide-react";
import { PipelineCard } from "./PipelineCard";
import { StageTransitionDialog } from "./StageTransitionDialog";
import { updatePipelineStage } from "@/lib/actions/pipeline";
import type {
	CapturePipeline,
	PipelineStage,
	StageConfig,
	STAGE_CONFIG,
} from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface PipelineBoardProps {
	/** Pipeline data grouped by stage */
	pipelines: CapturePipeline[];
	/** Related opportunities for display data */
	opportunities?: Map<string, { title: string; organization: string; budgetNumeric: number | null; deadline: Date | null }>;
	/** Callback when a card is clicked */
	onCardClick?: (pipeline: CapturePipeline) => void;
	/** Callback when stage changes */
	onStageChange?: (pipelineId: string, newStage: PipelineStage) => void;
	/** Callback when add button is clicked */
	onAddCapture?: () => void;
	/** Whether the board is loading */
	isLoading?: boolean;
	/** Show archived/terminal stages */
	showTerminalStages?: boolean;
	/** Custom class name */
	className?: string;
}

interface StageColumn {
	stage: PipelineStage;
	config: StageConfig;
	pipelines: CapturePipeline[];
	totalValue: number;
	avgPwin: number;
}

// ============================================================================
// Stage Configuration
// ============================================================================

const STAGE_CONFIGS: Record<PipelineStage, StageConfig> = {
	discovery: {
		name: "discovery",
		label: "Discovery",
		color: "slate",
		icon: "search",
		requiredGates: [],
		typicalDuration: 30,
	},
	qualification: {
		name: "qualification",
		label: "Qualification",
		color: "blue",
		icon: "filter",
		requiredGates: ["pursuit"],
		typicalDuration: 14,
	},
	capture: {
		name: "capture",
		label: "Capture",
		color: "indigo",
		icon: "target",
		requiredGates: ["bid_no_bid"],
		typicalDuration: 60,
	},
	proposal: {
		name: "proposal",
		label: "Proposal",
		color: "purple",
		icon: "file-text",
		requiredGates: ["proposal_ready", "pink_team", "red_team"],
		typicalDuration: 30,
	},
	submitted: {
		name: "submitted",
		label: "Submitted",
		color: "cyan",
		icon: "send",
		requiredGates: ["gold_team", "final_review"],
		typicalDuration: 0,
	},
	evaluation: {
		name: "evaluation",
		label: "Evaluation",
		color: "yellow",
		icon: "clock",
		requiredGates: [],
		typicalDuration: 60,
	},
	awarded: {
		name: "awarded",
		label: "Won",
		color: "green",
		icon: "trophy",
		requiredGates: [],
		typicalDuration: 0,
	},
	lost: {
		name: "lost",
		label: "Lost",
		color: "red",
		icon: "x-circle",
		requiredGates: [],
		typicalDuration: 0,
	},
	no_bid: {
		name: "no_bid",
		label: "No Bid",
		color: "slate",
		icon: "minus-circle",
		requiredGates: [],
		typicalDuration: 0,
	},
	cancelled: {
		name: "cancelled",
		label: "Cancelled",
		color: "slate",
		icon: "ban",
		requiredGates: [],
		typicalDuration: 0,
	},
};

// Active stages shown by default
const ACTIVE_STAGES: PipelineStage[] = [
	"discovery",
	"qualification",
	"capture",
	"proposal",
	"submitted",
	"evaluation",
];

// Terminal stages (hidden by default)
const TERMINAL_STAGES: PipelineStage[] = ["awarded", "lost", "no_bid", "cancelled"];

// ============================================================================
// Helper Functions
// ============================================================================

function getStageColorClasses(color: string): {
	bg: string;
	border: string;
	text: string;
	headerBg: string;
} {
	const colorMap: Record<string, { bg: string; border: string; text: string; headerBg: string }> = {
		slate: {
			bg: "bg-slate-50 dark:bg-slate-900/30",
			border: "border-slate-200 dark:border-slate-700",
			text: "text-slate-700 dark:text-slate-300",
			headerBg: "bg-slate-100 dark:bg-slate-800",
		},
		blue: {
			bg: "bg-blue-50 dark:bg-blue-900/20",
			border: "border-blue-200 dark:border-blue-700",
			text: "text-blue-700 dark:text-blue-300",
			headerBg: "bg-blue-100 dark:bg-blue-800",
		},
		indigo: {
			bg: "bg-indigo-50 dark:bg-indigo-900/20",
			border: "border-indigo-200 dark:border-indigo-700",
			text: "text-indigo-700 dark:text-indigo-300",
			headerBg: "bg-indigo-100 dark:bg-indigo-800",
		},
		purple: {
			bg: "bg-purple-50 dark:bg-purple-900/20",
			border: "border-purple-200 dark:border-purple-700",
			text: "text-purple-700 dark:text-purple-300",
			headerBg: "bg-purple-100 dark:bg-purple-800",
		},
		cyan: {
			bg: "bg-cyan-50 dark:bg-cyan-900/20",
			border: "border-cyan-200 dark:border-cyan-700",
			text: "text-cyan-700 dark:text-cyan-300",
			headerBg: "bg-cyan-100 dark:bg-cyan-800",
		},
		yellow: {
			bg: "bg-yellow-50 dark:bg-yellow-900/20",
			border: "border-yellow-200 dark:border-yellow-700",
			text: "text-yellow-700 dark:text-yellow-300",
			headerBg: "bg-yellow-100 dark:bg-yellow-800",
		},
		green: {
			bg: "bg-green-50 dark:bg-green-900/20",
			border: "border-green-200 dark:border-green-700",
			text: "text-green-700 dark:text-green-300",
			headerBg: "bg-green-100 dark:bg-green-800",
		},
		red: {
			bg: "bg-red-50 dark:bg-red-900/20",
			border: "border-red-200 dark:border-red-700",
			text: "text-red-700 dark:text-red-300",
			headerBg: "bg-red-100 dark:bg-red-800",
		},
	};

	return colorMap[color] || colorMap.slate;
}

function formatCurrency(value: number): string {
	if (value >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(1)}M`;
	}
	if (value >= 1_000) {
		return `$${(value / 1_000).toFixed(0)}K`;
	}
	return `$${value.toFixed(0)}`;
}

// ============================================================================
// Component
// ============================================================================

export function PipelineBoard({
	pipelines,
	opportunities,
	onCardClick,
	onStageChange,
	onAddCapture,
	isLoading = false,
	showTerminalStages = false,
	className,
}: PipelineBoardProps) {
	const [isPending, startTransition] = useTransition();
	const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
	const [transitionDialog, setTransitionDialog] = useState<{
		open: boolean;
		pipeline: CapturePipeline | null;
		targetStage: PipelineStage | null;
	}>({
		open: false,
		pipeline: null,
		targetStage: null,
	});

	// Group pipelines by stage
	const stageColumns = useMemo<StageColumn[]>(() => {
		const stagesToShow = showTerminalStages
			? [...ACTIVE_STAGES, ...TERMINAL_STAGES]
			: ACTIVE_STAGES;

		return stagesToShow.map((stage) => {
			const stagePipelines = pipelines.filter((p) => p.currentStage === stage);
			const totalValue = stagePipelines.reduce((sum, p) => {
				const opp = opportunities?.get(p.opportunityId || "");
				return sum + (opp?.budgetNumeric || 0);
			}, 0);
			const avgPwin = stagePipelines.length > 0
				? Math.round(
						stagePipelines.reduce((sum, p) => sum + (p.pwinCurrent || 0), 0) /
						stagePipelines.length
					)
				: 0;

			return {
				stage,
				config: STAGE_CONFIGS[stage],
				pipelines: stagePipelines,
				totalValue,
				avgPwin,
			};
		});
	}, [pipelines, opportunities, showTerminalStages]);

	// Handle stage transition
	const handleStageChange = useCallback(
		async (pipelineId: string, newStage: PipelineStage, notes?: string) => {
			startTransition(async () => {
				const result = await updatePipelineStage(pipelineId, newStage, notes);
				if (result.success) {
					onStageChange?.(pipelineId, newStage);
				} else {
					console.error("Failed to update stage:", result.error);
				}
			});
		},
		[onStageChange]
	);

	// Handle drag start
	const handleDragStart = useCallback((e: React.DragEvent, pipeline: CapturePipeline) => {
		e.dataTransfer.setData("pipelineId", pipeline.id);
		e.dataTransfer.effectAllowed = "move";
	}, []);

	// Handle drag over
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}, []);

	// Handle drop
	const handleDrop = useCallback(
		(e: React.DragEvent, targetStage: PipelineStage) => {
			e.preventDefault();
			const pipelineId = e.dataTransfer.getData("pipelineId");
			const pipeline = pipelines.find((p) => p.id === pipelineId);

			if (pipeline && pipeline.currentStage !== targetStage) {
				// Open transition dialog for confirmation and notes
				setTransitionDialog({
					open: true,
					pipeline,
					targetStage,
				});
			}
		},
		[pipelines]
	);

	// Handle transition confirmation
	const handleTransitionConfirm = useCallback(
		(notes?: string) => {
			if (transitionDialog.pipeline && transitionDialog.targetStage) {
				handleStageChange(
					transitionDialog.pipeline.id,
					transitionDialog.targetStage,
					notes
				);
			}
			setTransitionDialog({ open: false, pipeline: null, targetStage: null });
		},
		[transitionDialog, handleStageChange]
	);

	// Loading skeleton
	if (isLoading) {
		return (
			<div className={cn("flex gap-4 overflow-x-auto pb-4", className)}>
				{ACTIVE_STAGES.slice(0, 5).map((stage) => (
					<div
						key={stage}
						className="flex-shrink-0 w-72 rounded-lg border bg-card"
					>
						<div className="p-3 border-b">
							<Skeleton className="h-5 w-24 mb-2" />
							<Skeleton className="h-4 w-32" />
						</div>
						<div className="p-3 space-y-3">
							<Skeleton className="h-32 rounded-lg" />
							<Skeleton className="h-32 rounded-lg" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Toolbar */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button
						variant={viewMode === "kanban" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setViewMode("kanban")}
						aria-label="Kanban view"
					>
						<LayoutGrid className="h-4 w-4" />
					</Button>
					<Button
						variant={viewMode === "list" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setViewMode("list")}
						aria-label="List view"
					>
						<List className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm">
						<Filter className="h-4 w-4 mr-2" />
						Filter
					</Button>
				</div>
				<div className="flex items-center gap-2">
					{onAddCapture && (
						<Button variant="primary" size="sm" onClick={onAddCapture}>
							<Plus className="h-4 w-4 mr-2" />
							Add Capture
						</Button>
					)}
				</div>
			</div>

			{/* Kanban Board */}
			<div
				className="flex gap-4 overflow-x-auto pb-4"
				role="region"
				aria-label="Pipeline board"
			>
				{stageColumns.map((column) => {
					const colors = getStageColorClasses(column.config.color);

					return (
						<div
							key={column.stage}
							className={cn(
								"flex-shrink-0 w-72 rounded-lg border",
								colors.border,
								colors.bg
							)}
							onDragOver={handleDragOver}
							onDrop={(e) => handleDrop(e, column.stage)}
							role="list"
							aria-label={`${column.config.label} stage`}
						>
							{/* Column Header */}
							<div
								className={cn(
									"p-3 rounded-t-lg border-b",
									colors.headerBg,
									colors.border
								)}
							>
								<div className="flex items-center justify-between mb-1">
									<h3 className={cn("font-semibold text-sm", colors.text)}>
										{column.config.label}
									</h3>
									<Badge variant="secondary" className="text-xs">
										{column.pipelines.length}
									</Badge>
								</div>
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<DollarSign className="h-3 w-3" />
										{formatCurrency(column.totalValue)}
									</span>
									{column.avgPwin > 0 && (
										<span className="flex items-center gap-1">
											<TrendingUp className="h-3 w-3" />
											{column.avgPwin}% PWin
										</span>
									)}
								</div>
							</div>

							{/* Column Content */}
							<div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
								{column.pipelines.length === 0 ? (
									<div className="py-8 text-center text-sm text-muted-foreground">
										No captures in this stage
									</div>
								) : (
									column.pipelines.map((pipeline) => {
										const opp = opportunities?.get(pipeline.opportunityId || "");
										return (
											<PipelineCard
												key={pipeline.id}
												pipeline={pipeline}
												title={opp?.title || "Untitled"}
												customer={opp?.organization || "Unknown"}
												value={opp?.budgetNumeric || null}
												dueDate={opp?.deadline || null}
												onClick={() => onCardClick?.(pipeline)}
												draggable
												onDragStart={(e) => handleDragStart(e, pipeline)}
											/>
										);
									})
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Pending indicator */}
			{isPending && (
				<div
					className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
					role="status"
					aria-live="polite"
				>
					<RefreshCw className="h-4 w-4 animate-spin" />
					Updating pipeline...
				</div>
			)}

			{/* Stage Transition Dialog */}
			<StageTransitionDialog
				open={transitionDialog.open}
				onOpenChange={(open) =>
					setTransitionDialog({ ...transitionDialog, open })
				}
				pipeline={transitionDialog.pipeline}
				currentStage={transitionDialog.pipeline?.currentStage as PipelineStage}
				targetStage={transitionDialog.targetStage}
				onConfirm={handleTransitionConfirm}
			/>
		</div>
	);
}

export default PipelineBoard;
