"use client";

/**
 * GenerationControlSurface - Fixed Bottom Control Bar per HDSI Specification
 *
 * Features:
 * - Phase indicator with tri-state toggle (Outline → Expansion → Revision)
 * - Generate Selected button (single node)
 * - Generate All button with progress tracking
 * - Quality score preview
 * - Keyboard shortcut hints
 *
 * Fixed height: 120px at bottom of layout
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Sparkles,
	Play,
	PlayCircle,
	RotateCcw,
	List,
	Layers,
	RefreshCw,
	CheckCircle2,
	AlertCircle,
	Loader2,
	Keyboard,
} from "lucide-react";
import type { GenerationPhase, PhaseState, DocumentCoherence } from "@/lib/hdsi/types";

// ============================================================================
// Types
// ============================================================================

export interface GenerationControlSurfaceProps {
	/** Current phase state */
	phaseState: PhaseState;
	/** Callback to change phase */
	onPhaseChange: (phase: GenerationPhase) => void;
	/** Document coherence metrics */
	coherence?: DocumentCoherence;
	/** Whether a node is currently selected */
	hasSelection: boolean;
	/** Name of selected node (for display) */
	selectedNodeName?: string;
	/** Callback to generate selected node */
	onGenerateSelected: () => void;
	/** Callback to generate all nodes */
	onGenerateAll: () => void;
	/** Whether generation is in progress */
	isGenerating: boolean;
	/** Current generation progress (0-100) */
	generationProgress?: number;
	/** Number of nodes being generated */
	generatingNodeCount?: number;
	/** Total nodes to generate */
	totalNodeCount?: number;
	/** Callback to cancel generation */
	onCancelGeneration?: () => void;
	/** Whether to show keyboard shortcuts */
	showShortcuts?: boolean;
	/** Additional className */
	className?: string;
}

// ============================================================================
// Phase Configuration
// ============================================================================

const PHASE_CONFIG: Record<
	GenerationPhase,
	{
		label: string;
		shortLabel: string;
		description: string;
		icon: React.ComponentType<{ className?: string }>;
	}
> = {
	outline_synthesis: {
		label: "Outline Synthesis",
		shortLabel: "Outline",
		description: "Create and refine document structure",
		icon: List,
	},
	sequential_expansion: {
		label: "Sequential Expansion",
		shortLabel: "Expand",
		description: "Generate content section by section",
		icon: Layers,
	},
	revision_cycle: {
		label: "Revision Cycle",
		shortLabel: "Revise",
		description: "Iterate and improve generated content",
		icon: RefreshCw,
	},
};

// ============================================================================
// Main Component
// ============================================================================

export function GenerationControlSurface({
	phaseState,
	onPhaseChange,
	coherence,
	hasSelection,
	selectedNodeName,
	onGenerateSelected,
	onGenerateAll,
	isGenerating,
	generationProgress = 0,
	generatingNodeCount = 0,
	totalNodeCount = 0,
	onCancelGeneration,
	showShortcuts = true,
	className,
}: GenerationControlSurfaceProps) {
	// Quality score from coherence
	const qualityScore = coherence?.overallScore ?? 1.0;
	const hasDebt = coherence?.debtNodes && coherence.debtNodes.length > 0;

	// Progress percentage for generation
	const progressPercent =
		totalNodeCount > 0
			? Math.round((generatingNodeCount / totalNodeCount) * 100)
			: generationProgress;

	return (
		<div
			className={cn(
				"h-full flex items-center justify-between px-4 gap-4",
				className
			)}
		>
			{/* Left: Phase Toggle */}
			<div className="flex items-center gap-3">
				<PhaseToggle
					currentPhase={phaseState.current}
					onPhaseChange={onPhaseChange}
					disabled={isGenerating}
				/>
				{phaseState.current === "revision_cycle" && phaseState.revisionIteration && (
					<Badge variant="secondary" className="text-xs">
						Iteration {phaseState.revisionIteration}
					</Badge>
				)}
			</div>

			{/* Center: Generation Controls */}
			<div className="flex items-center gap-3">
				{isGenerating ? (
					<GeneratingState
						progress={progressPercent}
						currentCount={generatingNodeCount}
						totalCount={totalNodeCount}
						onCancel={onCancelGeneration}
					/>
				) : (
					<>
						{/* Generate Selected */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={onGenerateSelected}
										disabled={!hasSelection}
										className="gap-2"
									>
										<Sparkles className="h-4 w-4" />
										Generate Selected
										{showShortcuts && (
											<kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
												⌘G
											</kbd>
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{hasSelection
										? `Generate content for "${selectedNodeName || "selected node"}"`
										: "Select a node first"}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{/* Generate All */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="primary"
										size="sm"
										onClick={onGenerateAll}
										disabled={totalNodeCount === 0}
										className="gap-2"
									>
										<PlayCircle className="h-4 w-4" />
										Generate All
										{totalNodeCount > 0 && (
											<Badge
												variant="secondary"
												className="bg-primary-foreground/20 text-primary-foreground text-[10px] px-1.5 py-0"
											>
												{totalNodeCount}
											</Badge>
										)}
										{showShortcuts && (
											<kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
												⌘⇧G
											</kbd>
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{totalNodeCount > 0
										? `Generate content for ${totalNodeCount} nodes`
										: "No nodes to generate"}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</>
				)}
			</div>

			{/* Right: Quality Score & Status */}
			<div className="flex items-center gap-4">
				<QualityIndicator
					score={qualityScore}
					hasDebt={hasDebt || false}
					debtCount={coherence?.debtNodes?.length || 0}
				/>
				<PhaseProgress phaseState={phaseState} />
			</div>
		</div>
	);
}

// ============================================================================
// Phase Toggle Component
// ============================================================================

interface PhaseToggleProps {
	currentPhase: GenerationPhase;
	onPhaseChange: (phase: GenerationPhase) => void;
	disabled?: boolean;
}

function PhaseToggle({
	currentPhase,
	onPhaseChange,
	disabled,
}: PhaseToggleProps) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[10px] text-muted-foreground uppercase tracking-wider">
				Phase
			</span>
			<ToggleGroup
				type="single"
				value={currentPhase}
				onValueChange={(value) => value && onPhaseChange(value as GenerationPhase)}
				disabled={disabled}
				className="gap-0.5"
			>
				{(
					["outline_synthesis", "sequential_expansion", "revision_cycle"] as GenerationPhase[]
				).map((phase) => {
					const config = PHASE_CONFIG[phase];
					const Icon = config.icon;
					const isActive = currentPhase === phase;

					return (
						<TooltipProvider key={phase}>
							<Tooltip>
								<TooltipTrigger asChild>
									<ToggleGroupItem
										value={phase}
										aria-label={config.label}
										className={cn(
											"h-8 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
										)}
									>
										<Icon className="h-3.5 w-3.5 mr-1.5" />
										<span className="text-xs">{config.shortLabel}</span>
									</ToggleGroupItem>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p className="font-medium">{config.label}</p>
									<p className="text-xs text-muted-foreground">
										{config.description}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					);
				})}
			</ToggleGroup>
		</div>
	);
}

// ============================================================================
// Generating State Component
// ============================================================================

interface GeneratingStateProps {
	progress: number;
	currentCount: number;
	totalCount: number;
	onCancel?: () => void;
}

function GeneratingState({
	progress,
	currentCount,
	totalCount,
	onCancel,
}: GeneratingStateProps) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex flex-col gap-1 min-w-[200px]">
				<div className="flex items-center justify-between text-xs">
					<span className="flex items-center gap-1.5 text-muted-foreground">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Generating...
					</span>
					<span className="font-medium">
						{currentCount} / {totalCount}
					</span>
				</div>
				<Progress value={progress} className="h-2" />
			</div>
			{onCancel && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								onClick={onCancel}
								className="text-destructive hover:text-destructive"
							>
								Cancel
							</Button>
						</TooltipTrigger>
						<TooltipContent>Stop generation (partial content preserved)</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}
		</div>
	);
}

// ============================================================================
// Quality Indicator Component
// ============================================================================

interface QualityIndicatorProps {
	score: number;
	hasDebt: boolean;
	debtCount: number;
}

function QualityIndicator({ score, hasDebt, debtCount }: QualityIndicatorProps) {
	const percentage = Math.round(score * 100);
	const isGood = score >= 0.8;
	const isWarning = score >= 0.6 && score < 0.8;
	const isPoor = score < 0.6;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"flex items-center gap-2 px-3 py-1.5 rounded-md border",
							isGood && "border-green-500/30 bg-green-500/10",
							isWarning && "border-amber-500/30 bg-amber-500/10",
							isPoor && "border-destructive/30 bg-destructive/10"
						)}
					>
						{isGood && <CheckCircle2 className="h-4 w-4 text-green-500" />}
						{isWarning && <AlertCircle className="h-4 w-4 text-amber-500" />}
						{isPoor && <AlertCircle className="h-4 w-4 text-destructive" />}
						<div className="flex flex-col">
							<span className="text-xs font-medium">{percentage}%</span>
							<span className="text-[10px] text-muted-foreground">Quality</span>
						</div>
						{hasDebt && (
							<Badge variant="destructive" className="text-[10px] px-1.5">
								{debtCount} issues
							</Badge>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p className="font-medium">Document Quality Score</p>
					<p className="text-xs text-muted-foreground">
						Based on coherence analysis across all sections
					</p>
					{hasDebt && (
						<p className="text-xs text-amber-500 mt-1">
							{debtCount} section(s) have coherence issues
						</p>
					)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Phase Progress Component
// ============================================================================

interface PhaseProgressProps {
	phaseState: PhaseState;
}

function PhaseProgress({ phaseState }: PhaseProgressProps) {
	const progressPercent =
		phaseState.totalCount > 0
			? Math.round((phaseState.processedCount / phaseState.totalCount) * 100)
			: 0;

	const elapsed = Date.now() - phaseState.startedAt.getTime();
	const elapsedFormatted = formatDuration(elapsed);

	return (
		<div className="flex flex-col items-end gap-0.5 min-w-[100px]">
			<div className="flex items-center gap-2 text-xs">
				<span className="text-muted-foreground">
					{phaseState.processedCount} / {phaseState.totalCount}
				</span>
				<span className="font-medium">{progressPercent}%</span>
			</div>
			<Progress value={progressPercent} className="h-1 w-full" />
			<span className="text-[10px] text-muted-foreground">{elapsedFormatted}</span>
		</div>
	);
}

// ============================================================================
// Keyboard Shortcut Hint
// ============================================================================

export function KeyboardShortcutHint({ className }: { className?: string }) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						className={cn(
							"flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors",
							className
						)}
					>
						<Keyboard className="h-3.5 w-3.5" />
						<span>Shortcuts</span>
					</button>
				</TooltipTrigger>
				<TooltipContent side="top" className="space-y-2 p-3">
					<p className="font-medium text-sm">Keyboard Shortcuts</p>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
						<kbd className="font-mono bg-muted px-1.5 py-0.5 rounded">⌘G</kbd>
						<span>Generate Selected</span>
						<kbd className="font-mono bg-muted px-1.5 py-0.5 rounded">⌘⇧G</kbd>
						<span>Generate All</span>
						<kbd className="font-mono bg-muted px-1.5 py-0.5 rounded">Tab</kbd>
						<span>Next Sibling</span>
						<kbd className="font-mono bg-muted px-1.5 py-0.5 rounded">⇧Tab</kbd>
						<span>Previous Sibling</span>
						<kbd className="font-mono bg-muted px-1.5 py-0.5 rounded">Enter</kbd>
						<span>Expand/Collapse</span>
						<kbd className="font-mono bg-muted px-1.5 py-0.5 rounded">Escape</kbd>
						<span>Deselect</span>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}

/**
 * Create initial phase state.
 */
export function createInitialPhaseState(
	phase: GenerationPhase = "outline_synthesis",
	totalCount: number = 0
): PhaseState {
	return {
		current: phase,
		processedCount: 0,
		totalCount,
		startedAt: new Date(),
	};
}

// ============================================================================
// Exports
// ============================================================================

export default GenerationControlSurface;
export { PHASE_CONFIG };
