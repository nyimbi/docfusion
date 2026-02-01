/**
 * PageCountTracker Component
 *
 * Tracks document page count against limits with progress visualization,
 * per-volume breakdown, and warning indicators.
 */

"use client";

import * as React from "react";
import {
	FileText,
	AlertTriangle,
	CheckCircle2,
	XCircle,
	RefreshCw,
	ChevronDown,
	ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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

import type { PageCountInfo, VolumePageCount } from "@/lib/types/formatting";
import { usePageCount } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface PageCountTrackerProps {
	/** Document ID to track */
	documentId: string;
	/** Show per-volume breakdown */
	showVolumes?: boolean;
	/** Compact display mode */
	compact?: boolean;
	/** Callback when page count changes */
	onPageCountChange?: (info: PageCountInfo) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

type PageStatus = "ok" | "warning" | "exceeded";

/**
 * Get status color classes.
 */
function getStatusColors(status: PageStatus): {
	text: string;
	bg: string;
	progress: string;
	icon: React.ElementType;
} {
	switch (status) {
		case "ok":
			return {
				text: "text-green-600 dark:text-green-400",
				bg: "bg-green-100 dark:bg-green-900/30",
				progress: "[&>div]:bg-green-500",
				icon: CheckCircle2,
			};
		case "warning":
			return {
				text: "text-yellow-600 dark:text-yellow-400",
				bg: "bg-yellow-100 dark:bg-yellow-900/30",
				progress: "[&>div]:bg-yellow-500",
				icon: AlertTriangle,
			};
		case "exceeded":
			return {
				text: "text-red-600 dark:text-red-400",
				bg: "bg-red-100 dark:bg-red-900/30",
				progress: "[&>div]:bg-red-500",
				icon: XCircle,
			};
	}
}

/**
 * Get status label.
 */
function getStatusLabel(status: PageStatus): string {
	switch (status) {
		case "ok":
			return "Within Limit";
		case "warning":
			return "Approaching Limit";
		case "exceeded":
			return "Over Limit";
	}
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Page count progress bar with label.
 */
interface PageProgressProps {
	current: number;
	max: number | undefined;
	percentUsed: number;
	status: PageStatus;
	label?: string;
	showTooltip?: boolean;
}

function PageProgress({
	current,
	max,
	percentUsed,
	status,
	label,
	showTooltip = true,
}: PageProgressProps) {
	const colors = getStatusColors(status);
	const StatusIcon = colors.icon;

	const content = (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-sm">
				<div className="flex items-center gap-2">
					{label && <span className="font-medium">{label}</span>}
					<StatusIcon className={cn("h-4 w-4", colors.text)} />
				</div>
				<div className="flex items-center gap-2">
					<span className={cn("font-medium", colors.text)}>
						{current}
					</span>
					{max && (
						<span className="text-muted-foreground">/ {max} pages</span>
					)}
				</div>
			</div>
			<Progress
				value={Math.min(percentUsed, 100)}
				className={cn("h-2", colors.progress)}
			/>
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>{percentUsed.toFixed(0)}% used</span>
				{max && (
					<span>
						{max - current > 0
							? `${max - current} remaining`
							: `${current - max} over`}
					</span>
				)}
			</div>
		</div>
	);

	if (!showTooltip) return content;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="cursor-help">{content}</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>{getStatusLabel(status)}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Volume breakdown item.
 */
interface VolumeItemProps {
	volume: VolumePageCount;
}

function VolumeItem({ volume }: VolumeItemProps) {
	const colors = getStatusColors(volume.status);
	const StatusIcon = colors.icon;

	return (
		<div className={cn("p-3 rounded-lg border", colors.bg)}>
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<FileText className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium text-sm">{volume.volumeName}</span>
					<Badge variant="outline" className="text-xs">
						Vol. {volume.volumeNumber}
					</Badge>
				</div>
				<StatusIcon className={cn("h-4 w-4", colors.text)} />
			</div>
			<PageProgress
				current={volume.currentPages}
				max={volume.maxPages}
				percentUsed={volume.percentUsed}
				status={volume.status}
				showTooltip={false}
			/>
		</div>
	);
}

/**
 * Loading skeleton.
 */
function TrackerSkeleton({ compact }: { compact?: boolean }) {
	if (compact) {
		return (
			<div className="flex items-center gap-4 p-3 border rounded-lg">
				<Skeleton className="h-5 w-5" />
				<Skeleton className="h-4 flex-1" />
				<Skeleton className="h-5 w-20" />
			</div>
		);
	}

	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-4 w-48 mt-1" />
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-16" />
				<div className="grid gap-3">
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function PageCountTracker({
	documentId,
	showVolumes = true,
	compact = false,
	onPageCountChange,
	className,
}: PageCountTrackerProps) {
	// Use hook
	const { pageInfo, isLoading, error, refetch: fetchPageCount } = usePageCount(documentId);
	const [volumesExpanded, setVolumesExpanded] = React.useState(true);

	// Notify parent when page count changes
	React.useEffect(() => {
		if (pageInfo) {
			onPageCountChange?.(pageInfo);
		}
	}, [pageInfo, onPageCountChange]);

	// Loading state
	if (isLoading && !pageInfo) {
		return <TrackerSkeleton compact={compact} />;
	}

	// Error state
	if (error && !pageInfo) {
		return (
			<Card className={className}>
				<CardContent className="py-6">
					<div className="flex items-center justify-center gap-2 text-destructive">
						<XCircle className="h-5 w-5" />
						<span>{error}</span>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!pageInfo) return null;

	// Compact mode
	if (compact) {
		const colors = getStatusColors(pageInfo.status);
		const StatusIcon = colors.icon;

		return (
			<div
				className={cn(
					"flex items-center gap-4 p-3 border rounded-lg",
					colors.bg,
					className
				)}
			>
				<FileText className="h-5 w-5 text-muted-foreground" />
				<div className="flex-1">
					<Progress
						value={Math.min(pageInfo.percentUsed, 100)}
						className={cn("h-2", colors.progress)}
					/>
				</div>
				<div className="flex items-center gap-2">
					<span className={cn("font-medium text-sm", colors.text)}>
						{pageInfo.totalPages}
						{pageInfo.maxPages && `/${pageInfo.maxPages}`}
					</span>
					<StatusIcon className={cn("h-4 w-4", colors.text)} />
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={fetchPageCount}
					disabled={isLoading}
				>
					<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
				</Button>
			</div>
		);
	}

	// Full mode
	const colors = getStatusColors(pageInfo.status);

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Page Count
					</CardTitle>
					<CardDescription>Track document pages against limits</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={fetchPageCount}
					disabled={isLoading}
				>
					<RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
					Refresh
				</Button>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Main Progress */}
				<div className={cn("p-4 rounded-lg", colors.bg)}>
					<PageProgress
						current={pageInfo.countablePages}
						max={pageInfo.maxPages}
						percentUsed={pageInfo.percentUsed}
						status={pageInfo.status}
						label="Total Countable Pages"
					/>

					{/* Additional Info */}
					<div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-4 text-sm">
						<div>
							<span className="text-muted-foreground">Total Pages:</span>{" "}
							<span className="font-medium">{pageInfo.totalPages}</span>
						</div>
						<div>
							<span className="text-muted-foreground">Excluded:</span>{" "}
							<span className="font-medium">{pageInfo.excludedPages}</span>
						</div>
					</div>
				</div>

				{/* Status Badge */}
				<div className="flex justify-center">
					<Badge
						variant="outline"
						className={cn("gap-2 px-4 py-2", colors.text, colors.bg)}
					>
						{React.createElement(colors.icon, { className: "h-4 w-4" })}
						{getStatusLabel(pageInfo.status)}
					</Badge>
				</div>

				{/* Volume Breakdown */}
				{showVolumes &&
					pageInfo.volumeBreakdown &&
					pageInfo.volumeBreakdown.length > 0 && (
						<Collapsible
							open={volumesExpanded}
							onOpenChange={setVolumesExpanded}
						>
							<CollapsibleTrigger asChild>
								<Button variant="ghost" className="w-full justify-between">
									<span className="font-medium">Volume Breakdown</span>
									{volumesExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<div className="grid gap-3 mt-2">
									{pageInfo.volumeBreakdown.map((volume) => (
										<VolumeItem key={volume.volumeNumber} volume={volume} />
									))}
								</div>
							</CollapsibleContent>
						</Collapsible>
					)}

				{/* Last Updated */}
				<p className="text-xs text-muted-foreground text-center">
					Last updated: {new Date(pageInfo.updatedAt).toLocaleString()}
				</p>
			</CardContent>
		</Card>
	);
}

export default PageCountTracker;
