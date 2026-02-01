/**
 * FreshnessIndicator Component
 *
 * Visual indicator for content freshness status with
 * review reminders and staleness warnings.
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Clock,
	AlertTriangle,
	CheckCircle,
	XCircle,
	RefreshCw,
	Calendar,
	Bell,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type FreshnessStatus = "current" | "stale" | "needs_review" | "expired";

interface FreshnessIndicatorProps {
	status: FreshnessStatus;
	lastReviewedAt?: string;
	reviewDueDate?: string;
	lastUsedAt?: string;
	daysUntilStale?: number;
	onRequestReview?: () => void;
	onMarkReviewed?: () => void;
	onSetReminder?: () => void;
	compact?: boolean;
	showDetails?: boolean;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
	FreshnessStatus,
	{
		icon: typeof CheckCircle;
		color: string;
		bg: string;
		border: string;
		label: string;
		description: string;
	}
> = {
	current: {
		icon: CheckCircle,
		color: "text-green-600",
		bg: "bg-green-50",
		border: "border-green-200",
		label: "Current",
		description: "Content is up to date",
	},
	stale: {
		icon: Clock,
		color: "text-yellow-600",
		bg: "bg-yellow-50",
		border: "border-yellow-200",
		label: "Stale",
		description: "Content may need updating",
	},
	needs_review: {
		icon: AlertTriangle,
		color: "text-orange-600",
		bg: "bg-orange-50",
		border: "border-orange-200",
		label: "Needs Review",
		description: "Content requires review",
	},
	expired: {
		icon: XCircle,
		color: "text-red-600",
		bg: "bg-red-50",
		border: "border-red-200",
		label: "Expired",
		description: "Content is outdated",
	},
};

// ============================================================================
// Component
// ============================================================================

export function FreshnessIndicator({
	status,
	lastReviewedAt,
	reviewDueDate,
	lastUsedAt,
	daysUntilStale,
	onRequestReview,
	onMarkReviewed,
	onSetReminder,
	compact = false,
	showDetails = false,
	className,
}: FreshnessIndicatorProps) {
	const config = STATUS_CONFIG[status];
	const StatusIcon = config.icon;

	// Calculate days since last review
	const daysSinceReview = lastReviewedAt
		? Math.floor(
				(Date.now() - new Date(lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24)
		  )
		: null;

	// Calculate days until due
	const daysUntilDue = reviewDueDate
		? Math.ceil(
				(new Date(reviewDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
		  )
		: null;

	if (compact) {
		return (
			<div
				className={cn(
					"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
					config.bg,
					config.color,
					className
				)}
				title={config.description}
			>
				<StatusIcon className="w-3 h-3" />
				{config.label}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"rounded-lg border p-3",
				config.bg,
				config.border,
				className
			)}
		>
			<div className="flex items-start gap-3">
				<StatusIcon className={cn("w-5 h-5 mt-0.5", config.color)} />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className={cn("font-medium", config.color)}>
							{config.label}
						</span>
						{daysUntilStale !== undefined && status === "current" && (
							<span className="text-xs text-gray-500">
								({daysUntilStale} days until stale)
							</span>
						)}
					</div>
					<p className="text-sm text-gray-600">{config.description}</p>

					{/* Details */}
					{showDetails && (
						<div className="mt-2 space-y-1 text-xs text-gray-500">
							{lastReviewedAt && (
								<div className="flex items-center gap-1">
									<Clock className="w-3 h-3" />
									<span>
										Last reviewed:{" "}
										{new Date(lastReviewedAt).toLocaleDateString()}
										{daysSinceReview !== null && ` (${daysSinceReview} days ago)`}
									</span>
								</div>
							)}
							{reviewDueDate && (
								<div className="flex items-center gap-1">
									<Calendar className="w-3 h-3" />
									<span>
										Review due: {new Date(reviewDueDate).toLocaleDateString()}
										{daysUntilDue !== null && (
											<span
												className={cn(
													daysUntilDue < 0
														? "text-red-600"
														: daysUntilDue < 7
														? "text-orange-600"
														: ""
												)}
											>
												{" "}
												({daysUntilDue < 0
													? `${Math.abs(daysUntilDue)} days overdue`
													: `${daysUntilDue} days left`})
											</span>
										)}
									</span>
								</div>
							)}
							{lastUsedAt && (
								<div className="flex items-center gap-1">
									<RefreshCw className="w-3 h-3" />
									<span>
										Last used: {new Date(lastUsedAt).toLocaleDateString()}
									</span>
								</div>
							)}
						</div>
					)}

					{/* Actions */}
					{(onRequestReview || onMarkReviewed || onSetReminder) && (
						<div className="mt-3 flex items-center gap-2">
							{status !== "current" && onMarkReviewed && (
								<Button variant="outline" size="sm" onClick={onMarkReviewed}>
									<CheckCircle className="w-4 h-4 mr-1" />
									Mark Reviewed
								</Button>
							)}
							{status !== "current" && onRequestReview && (
								<Button variant="ghost" size="sm" onClick={onRequestReview}>
									<RefreshCw className="w-4 h-4 mr-1" />
									Request Review
								</Button>
							)}
							{onSetReminder && (
								<Button variant="ghost" size="sm" onClick={onSetReminder}>
									<Bell className="w-4 h-4 mr-1" />
									Set Reminder
								</Button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Badge Variant
// ============================================================================

interface FreshnessBadgeProps {
	status: FreshnessStatus;
	size?: "sm" | "md";
	className?: string;
}

export function FreshnessBadge({
	status,
	size = "sm",
	className,
}: FreshnessBadgeProps) {
	const config = STATUS_CONFIG[status];
	const StatusIcon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full",
				size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
				config.bg,
				config.color,
				className
			)}
		>
			<StatusIcon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
			{config.label}
		</span>
	);
}

// ============================================================================
// Progress Ring Variant
// ============================================================================

interface FreshnessProgressProps {
	daysRemaining: number;
	totalDays: number;
	status: FreshnessStatus;
	size?: number;
	className?: string;
}

export function FreshnessProgress({
	daysRemaining,
	totalDays,
	status,
	size = 48,
	className,
}: FreshnessProgressProps) {
	const config = STATUS_CONFIG[status];
	const percentage = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100));
	const radius = (size - 8) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (percentage / 100) * circumference;

	return (
		<div className={cn("relative inline-flex", className)} style={{ width: size, height: size }}>
			<svg className="transform -rotate-90" width={size} height={size}>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="4"
					className="text-gray-200"
				/>
				{/* Progress circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="4"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className={config.color}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("text-xs font-medium", config.color)}>
					{daysRemaining}d
				</span>
			</div>
		</div>
	);
}
