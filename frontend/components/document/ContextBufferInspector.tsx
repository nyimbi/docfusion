"use client";

/**
 * ContextBufferInspector - 3-Tier Context Provenance Visualization
 *
 * Displays the AI context buffer with:
 * - Three-tier provenance: Local (current node), Sibling (adjacent), Document (parent/global)
 * - Token count progress bars per tier
 * - Embedding drift indicators (content staleness)
 * - 3,800 token cap visualization
 * - Collapsible entries for detailed inspection
 *
 * Uses chart colors from design system:
 * - Local: chart-1 (vermillion)
 * - Sibling: chart-2 (green)
 * - Document: chart-4 (blue)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	FileText,
	GitBranch,
	Layers,
	RefreshCw,
	Info,
	Zap,
} from "lucide-react";
import type {
	ContextBuffer,
	ContextBufferEntry,
	ContextTier,
} from "@/lib/hdsi/types";

// ============================================================================
// Types
// ============================================================================

export interface ContextBufferInspectorProps {
	/** The context buffer to display */
	buffer: ContextBuffer;
	/** Currently selected node ID (for highlighting) */
	selectedNodeId?: string;
	/** Callback when an entry is clicked */
	onEntryClick?: (entry: ContextBufferEntry) => void;
	/** Callback to refresh/rebuild the context */
	onRefresh?: () => void;
	/** Whether context is currently being assembled */
	isLoading?: boolean;
	/** Additional className */
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum tokens per HDSI specification */
const MAX_TOKENS = 3800;

/** Tier configuration with colors and icons */
const TIER_CONFIG: Record<
	ContextTier,
	{
		label: string;
		description: string;
		colorClass: string;
		bgClass: string;
		progressClass: string;
		icon: React.ComponentType<{ className?: string }>;
	}
> = {
	local: {
		label: "Local",
		description: "Content from the current node being generated",
		colorClass: "text-[hsl(var(--chart-1))]",
		bgClass: "bg-[hsl(var(--chart-1))]/10",
		progressClass: "bg-[hsl(var(--chart-1))]",
		icon: FileText,
	},
	sibling: {
		label: "Sibling",
		description: "Content from adjacent nodes at the same level",
		colorClass: "text-[hsl(var(--chart-2))]",
		bgClass: "bg-[hsl(var(--chart-2))]/10",
		progressClass: "bg-[hsl(var(--chart-2))]",
		icon: GitBranch,
	},
	document: {
		label: "Document",
		description: "Content from parent nodes and document-level context",
		colorClass: "text-[hsl(var(--chart-4))]",
		bgClass: "bg-[hsl(var(--chart-4))]/10",
		progressClass: "bg-[hsl(var(--chart-4))]",
		icon: Layers,
	},
};

/** Drift threshold for staleness warning */
const DRIFT_WARNING_THRESHOLD = 0.15;

// ============================================================================
// Main Component
// ============================================================================

export function ContextBufferInspector({
	buffer,
	selectedNodeId,
	onEntryClick,
	onRefresh,
	isLoading = false,
	className,
}: ContextBufferInspectorProps) {
	const [expandedTiers, setExpandedTiers] = React.useState<Set<ContextTier>>(
		new Set(["local", "sibling"])
	);

	// Group entries by tier
	const entriesByTier = React.useMemo(() => {
		const grouped: Record<ContextTier, ContextBufferEntry[]> = {
			local: [],
			sibling: [],
			document: [],
		};
		for (const entry of buffer.entries) {
			grouped[entry.tier].push(entry);
		}
		return grouped;
	}, [buffer.entries]);

	// Calculate utilization percentage
	const utilizationPercent = Math.round(
		(buffer.totalTokens / buffer.maxTokens) * 100
	);
	const isNearCapacity = utilizationPercent > 85;

	// Toggle tier expansion
	const toggleTier = (tier: ContextTier) => {
		setExpandedTiers((prev) => {
			const next = new Set(prev);
			if (next.has(tier)) {
				next.delete(tier);
			} else {
				next.add(tier);
			}
			return next;
		});
	};

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header with utilization summary */}
			<div className="p-3 border-b space-y-3">
				{/* Token utilization bar */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Buffer Utilization</span>
						<span
							className={cn(
								"font-medium",
								isNearCapacity && "text-amber-500"
							)}
						>
							{buffer.totalTokens.toLocaleString()} / {buffer.maxTokens.toLocaleString()} tokens
						</span>
					</div>
					<Progress
						value={utilizationPercent}
						className={cn(
							"h-2",
							isNearCapacity && "[&>div]:bg-amber-500"
						)}
					/>
					{isNearCapacity && (
						<p className="text-[10px] text-amber-500 flex items-center gap-1">
							<AlertTriangle className="h-3 w-3" />
							Near capacity - consider reducing context
						</p>
					)}
				</div>

				{/* Tier breakdown bars */}
				<div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-muted">
					{(["local", "sibling", "document"] as ContextTier[]).map((tier) => {
						const tokens = buffer.tokensByTier[tier];
						const percent = (tokens / buffer.maxTokens) * 100;
						if (percent === 0) return null;
						return (
							<TooltipProvider key={tier}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div
											className={cn(TIER_CONFIG[tier].progressClass, "h-full transition-all")}
											style={{ width: `${percent}%` }}
										/>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="text-xs">
										{TIER_CONFIG[tier].label}: {tokens.toLocaleString()} tokens ({Math.round(percent)}%)
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						);
					})}
				</div>

				{/* Last assembled time + refresh */}
				<div className="flex items-center justify-between text-[10px] text-muted-foreground">
					<span>
						Assembled {formatRelativeTime(buffer.lastAssembled)}
					</span>
					{onRefresh && (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-[10px]"
							onClick={onRefresh}
							disabled={isLoading}
						>
							<RefreshCw
								className={cn(
									"h-3 w-3 mr-1",
									isLoading && "animate-spin"
								)}
							/>
							Refresh
						</Button>
					)}
				</div>
			</div>

			{/* Tier sections */}
			<ScrollArea className="flex-1">
				<div className="p-2 space-y-1">
					{(["local", "sibling", "document"] as ContextTier[]).map((tier) => {
						const entries = entriesByTier[tier];
						const config = TIER_CONFIG[tier];
						const isExpanded = expandedTiers.has(tier);
						const tierTokens = buffer.tokensByTier[tier];
						const Icon = config.icon;

						return (
							<Collapsible
								key={tier}
								open={isExpanded}
								onOpenChange={() => toggleTier(tier)}
							>
								<CollapsibleTrigger asChild>
									<button
										className={cn(
											"w-full flex items-center justify-between p-2 rounded-md",
											"hover:bg-accent/50 transition-colors text-left",
											isExpanded && "bg-accent/30"
										)}
									>
										<div className="flex items-center gap-2">
											{isExpanded ? (
												<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
											) : (
												<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
											)}
											<Icon className={cn("h-4 w-4", config.colorClass)} />
											<span className="text-sm font-medium">
												{config.label}
											</span>
											<Badge
												variant="secondary"
												className="h-5 px-1.5 text-[10px]"
											>
												{entries.length}
											</Badge>
										</div>
										<span className="text-xs text-muted-foreground">
											{tierTokens.toLocaleString()} tokens
										</span>
									</button>
								</CollapsibleTrigger>

								<CollapsibleContent>
									<div className="ml-6 mt-1 space-y-1">
										{entries.length === 0 ? (
											<p className="text-xs text-muted-foreground italic p-2">
												No {tier} context loaded
											</p>
										) : (
											entries.map((entry) => (
												<ContextEntry
													key={entry.id}
													entry={entry}
													config={config}
													isSelected={entry.sourceNodeId === selectedNodeId}
													onClick={() => onEntryClick?.(entry)}
												/>
											))
										)}
									</div>
								</CollapsibleContent>
							</Collapsible>
						);
					})}
				</div>
			</ScrollArea>

			{/* Footer legend */}
			<div className="p-2 border-t bg-muted/30">
				<div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
					{(["local", "sibling", "document"] as ContextTier[]).map((tier) => {
						const config = TIER_CONFIG[tier];
						return (
							<TooltipProvider key={tier}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1 cursor-help">
											<div
												className={cn(
													"w-2 h-2 rounded-full",
													config.progressClass
												)}
											/>
											<span>{config.label}</span>
										</div>
									</TooltipTrigger>
									<TooltipContent side="top" className="text-xs max-w-[200px]">
										{config.description}
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Context Entry Component
// ============================================================================

interface ContextEntryProps {
	entry: ContextBufferEntry;
	config: (typeof TIER_CONFIG)[ContextTier];
	isSelected?: boolean;
	onClick?: () => void;
}

function ContextEntry({
	entry,
	config,
	isSelected,
	onClick,
}: ContextEntryProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);
	const hasHighDrift = entry.embeddingDrift > DRIFT_WARNING_THRESHOLD;

	return (
		<div
			className={cn(
				"rounded-md border transition-colors",
				isSelected && "border-primary/50 bg-primary/5",
				!isSelected && "border-border/50 hover:border-border"
			)}
		>
			<button
				className="w-full p-2 text-left"
				onClick={() => {
					setIsExpanded(!isExpanded);
					onClick?.();
				}}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<p className="text-xs font-medium truncate">
							{entry.sourceTitle}
						</p>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-[10px] text-muted-foreground">
								{entry.tokenCount} tokens
							</span>
							<span className="text-[10px] text-muted-foreground">
								•
							</span>
							<span className="text-[10px] text-muted-foreground">
								{Math.round(entry.relevanceScore * 100)}% relevant
							</span>
						</div>
					</div>
					<div className="flex items-center gap-1">
						{/* Drift indicator */}
						{hasHighDrift && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-0.5 text-amber-500">
											<Zap className="h-3 w-3" />
											<span className="text-[10px]">
												{Math.round(entry.embeddingDrift * 100)}%
											</span>
										</div>
									</TooltipTrigger>
									<TooltipContent side="left" className="text-xs">
										High embedding drift - content may be stale
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
						{/* Relevance bar */}
						<div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
							<div
								className={cn(config.progressClass, "h-full transition-all")}
								style={{ width: `${entry.relevanceScore * 100}%` }}
							/>
						</div>
					</div>
				</div>
			</button>

			{/* Expanded content preview */}
			{isExpanded && (
				<div className="px-2 pb-2">
					<div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
						<p className="line-clamp-4 font-mono text-[10px] leading-relaxed">
							{entry.content.slice(0, 500)}
							{entry.content.length > 500 && "..."}
						</p>
					</div>
					<div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
						<span>Source: {entry.sourceNodeId.slice(0, 8)}...</span>
						<span>{formatRelativeTime(entry.timestamp)}</span>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Empty State
// ============================================================================

export function ContextBufferEmpty({
	onRefresh,
	isLoading,
}: {
	onRefresh?: () => void;
	isLoading?: boolean;
}) {
	return (
		<div className="flex flex-col items-center justify-center h-full p-6 text-center">
			<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
				<Layers className="h-6 w-6 text-muted-foreground" />
			</div>
			<p className="text-sm font-medium">No Context Loaded</p>
			<p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
				Select a node and generate content to see the context buffer
			</p>
			{onRefresh && (
				<Button
					variant="outline"
					size="sm"
					className="mt-4"
					onClick={onRefresh}
					disabled={isLoading}
				>
					<RefreshCw
						className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")}
					/>
					Assemble Context
				</Button>
			)}
		</div>
	);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a date as relative time (e.g., "2 min ago").
 */
function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin} min ago`;
	if (diffHour < 24) return `${diffHour} hr ago`;
	return date.toLocaleDateString();
}

/**
 * Create an empty context buffer.
 */
export function createEmptyBuffer(): ContextBuffer {
	return {
		entries: [],
		totalTokens: 0,
		maxTokens: MAX_TOKENS,
		lastAssembled: new Date(),
		tokensByTier: {
			local: 0,
			sibling: 0,
			document: 0,
		},
	};
}

// ============================================================================
// Exports
// ============================================================================

export default ContextBufferInspector;
export { MAX_TOKENS, TIER_CONFIG, DRIFT_WARNING_THRESHOLD };
