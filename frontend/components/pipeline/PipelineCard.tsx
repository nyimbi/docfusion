/**
 * PipelineCard Component - DocFusion Capture Pipeline
 *
 * Individual capture card for the pipeline board with PWin indicator,
 * key dates, value, and health status. Supports drag-and-drop for
 * stage transitions.
 *
 * Accessibility: Keyboard accessible, proper ARIA roles for draggable items.
 */

"use client";

import * as React from "react";
import { useMemo } from "react";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Calendar,
	DollarSign,
	AlertTriangle,
	CheckCircle,
	Clock,
	TrendingUp,
	TrendingDown,
	Minus,
	Building2,
	User,
	Target,
	GripVertical,
} from "lucide-react";
import type { CapturePipeline, HealthStatus, PipelinePriority } from "@/lib/types/pipeline";

// ============================================================================
// Types
// ============================================================================

interface PipelineCardProps {
	/** Pipeline data */
	pipeline: CapturePipeline;
	/** Opportunity title */
	title: string;
	/** Customer/organization name */
	customer: string;
	/** Contract value */
	value: number | null;
	/** Proposal due date */
	dueDate: Date | null;
	/** Click handler */
	onClick?: () => void;
	/** Whether the card is draggable */
	draggable?: boolean;
	/** Drag start handler */
	onDragStart?: (e: React.DragEvent) => void;
	/** Whether to show compact view */
	compact?: boolean;
	/** Custom class name */
	className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPwinColor(pwin: number): string {
	if (pwin >= 70) return "text-green-600 dark:text-green-400";
	if (pwin >= 50) return "text-yellow-600 dark:text-yellow-400";
	if (pwin >= 30) return "text-orange-600 dark:text-orange-400";
	return "text-red-600 dark:text-red-400";
}

function getPwinBgColor(pwin: number): string {
	if (pwin >= 70) return "bg-green-500";
	if (pwin >= 50) return "bg-yellow-500";
	if (pwin >= 30) return "bg-orange-500";
	return "bg-red-500";
}

function getHealthIcon(status: HealthStatus | null): React.ReactNode {
	switch (status) {
		case "on_track":
			return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
		case "at_risk":
			return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
		case "critical":
			return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
		default:
			return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
	}
}

function getHealthLabel(status: HealthStatus | null): string {
	switch (status) {
		case "on_track":
			return "On Track";
		case "at_risk":
			return "At Risk";
		case "critical":
			return "Critical";
		default:
			return "Not Set";
	}
}

function getPriorityBadge(priority: PipelinePriority | null): {
	variant: "default" | "secondary" | "outline";
	label: string;
} {
	switch (priority) {
		case "high":
			return { variant: "default", label: "High" };
		case "medium":
			return { variant: "secondary", label: "Medium" };
		case "low":
			return { variant: "outline", label: "Low" };
		default:
			return { variant: "outline", label: "Unset" };
	}
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

function getDaysUntil(date: Date): number {
	const now = new Date();
	const diffTime = date.getTime() - now.getTime();
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getDeadlineStatus(dueDate: Date | null): {
	urgent: boolean;
	overdue: boolean;
	text: string;
	color: string;
} {
	if (!dueDate) {
		return { urgent: false, overdue: false, text: "No deadline", color: "text-muted-foreground" };
	}

	const daysUntil = getDaysUntil(dueDate);

	if (daysUntil < 0) {
		return {
			urgent: true,
			overdue: true,
			text: `${Math.abs(daysUntil)} days overdue`,
			color: "text-red-600 dark:text-red-400",
		};
	}

	if (daysUntil <= 7) {
		return {
			urgent: true,
			overdue: false,
			text: `${daysUntil} days left`,
			color: "text-orange-600 dark:text-orange-400",
		};
	}

	if (daysUntil <= 14) {
		return {
			urgent: false,
			overdue: false,
			text: `${daysUntil} days left`,
			color: "text-yellow-600 dark:text-yellow-400",
		};
	}

	return {
		urgent: false,
		overdue: false,
		text: formatDate(dueDate),
		color: "text-muted-foreground",
	};
}

// ============================================================================
// PWin Trend Indicator
// ============================================================================

function PWinTrend({ history }: { history?: Array<{ date: string; value: number }> }) {
	if (!history || history.length < 2) {
		return null;
	}

	const latest = history[history.length - 1].value;
	const previous = history[history.length - 2].value;
	const diff = latest - previous;

	if (diff > 0) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>
						<TrendingUp className="h-3 w-3 text-green-500" />
					</TooltipTrigger>
					<TooltipContent>
						<p>PWin increased by {diff}%</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	if (diff < 0) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>
						<TrendingDown className="h-3 w-3 text-red-500" />
					</TooltipTrigger>
					<TooltipContent>
						<p>PWin decreased by {Math.abs(diff)}%</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return null;
}

// ============================================================================
// Component
// ============================================================================

export function PipelineCard({
	pipeline,
	title,
	customer,
	value,
	dueDate,
	onClick,
	draggable = false,
	onDragStart,
	compact = false,
	className,
}: PipelineCardProps) {
	const pwin = pipeline.pwinCurrent ?? 0;
	const pwinHistory = pipeline.pwinHistory as Array<{ date: string; value: number }> | undefined;
	const deadlineStatus = useMemo(() => getDeadlineStatus(dueDate), [dueDate]);
	const priorityBadge = useMemo(() => getPriorityBadge(pipeline.priority as PipelinePriority | null), [pipeline.priority]);

	return (
		<Card
			className={cn(
				"group transition-all duration-200 cursor-pointer",
				"hover:shadow-md hover:border-border-strong",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				draggable && "active:cursor-grabbing",
				className
			)}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick?.();
				}
			}}
			tabIndex={0}
			role={draggable ? "listitem" : "button"}
			aria-label={`${title} - ${customer}`}
			draggable={draggable}
			onDragStart={onDragStart}
		>
			<CardContent className={cn("p-3", compact && "p-2")}>
				{/* Header with drag handle and priority */}
				<div className="flex items-start justify-between gap-2 mb-2">
					<div className="flex items-start gap-2 flex-1 min-w-0">
						{draggable && (
							<GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
						)}
						<div className="flex-1 min-w-0">
							<h4 className="font-medium text-sm leading-tight truncate">
								{title}
							</h4>
							<div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
								<Building2 className="h-3 w-3" />
								<span className="truncate">{customer}</span>
							</div>
						</div>
					</div>
					<Badge variant={priorityBadge.variant} className="text-[10px] px-1.5 py-0">
						{priorityBadge.label}
					</Badge>
				</div>

				{/* PWin Indicator */}
				<div className="mb-3">
					<div className="flex items-center justify-between mb-1">
						<div className="flex items-center gap-1.5">
							<Target className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">PWin</span>
						</div>
						<div className="flex items-center gap-1">
							<span className={cn("text-sm font-semibold", getPwinColor(pwin))}>
								{pwin}%
							</span>
							<PWinTrend history={pwinHistory} />
						</div>
					</div>
					<Progress
						value={pwin}
						className="h-1.5"
						aria-label={`Win probability: ${pwin}%`}
					/>
				</div>

				{/* Metrics Row */}
				{!compact && (
					<div className="flex items-center justify-between text-xs">
						{/* Value */}
						{value !== null && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1 text-muted-foreground">
											<DollarSign className="h-3 w-3" />
											<span>{formatCurrency(value)}</span>
										</div>
									</TooltipTrigger>
									<TooltipContent>
										<p>Contract Value: ${value.toLocaleString()}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}

						{/* Deadline */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div
										className={cn(
											"flex items-center gap-1",
											deadlineStatus.color
										)}
									>
										{deadlineStatus.overdue ? (
											<AlertTriangle className="h-3 w-3" />
										) : (
											<Calendar className="h-3 w-3" />
										)}
										<span>{deadlineStatus.text}</span>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										{dueDate
											? `Due: ${formatDate(dueDate)}`
											: "No deadline set"}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{/* Health Status */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex items-center gap-1">
										{getHealthIcon(pipeline.healthStatus as HealthStatus | null)}
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>Status: {getHealthLabel(pipeline.healthStatus as HealthStatus | null)}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				)}

				{/* Capture Manager */}
				{!compact && pipeline.captureManager && (
					<div className="flex items-center gap-1 mt-2 pt-2 border-t text-xs text-muted-foreground">
						<User className="h-3 w-3" />
						<span className="truncate">{pipeline.captureManager}</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default PipelineCard;
