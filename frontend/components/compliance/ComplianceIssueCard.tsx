/**
 * ComplianceIssueCard Component
 *
 * Displays a single compliance issue with detailed information,
 * actions, and navigation to the source requirement.
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	CheckCircle,
	XCircle,
	AlertTriangle,
	AlertCircle,
	ExternalLink,
	Edit,
	ChevronRight,
	FileText,
	Lightbulb,
	Clock,
} from "lucide-react";
import type { ComplianceIssue } from "@/lib/actions/compliance-validator";

// ============================================================================
// Types
// ============================================================================

interface ComplianceIssueCardProps {
	issue: ComplianceIssue;
	onNavigate?: () => void;
	onResolve?: () => void;
	onEdit?: () => void;
	onDismiss?: () => void;
	showActions?: boolean;
	compact?: boolean;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG = {
	critical: {
		icon: XCircle,
		color: "text-red-600",
		bg: "bg-red-50",
		border: "border-red-200",
		label: "Critical",
		description: "Must be resolved before submission",
	},
	high: {
		icon: AlertTriangle,
		color: "text-orange-600",
		bg: "bg-orange-50",
		border: "border-orange-200",
		label: "High",
		description: "Should be addressed urgently",
	},
	medium: {
		icon: AlertCircle,
		color: "text-yellow-600",
		bg: "bg-yellow-50",
		border: "border-yellow-200",
		label: "Medium",
		description: "Recommended to address",
	},
	low: {
		icon: CheckCircle,
		color: "text-blue-600",
		bg: "bg-blue-50",
		border: "border-blue-200",
		label: "Low",
		description: "Minor improvement opportunity",
	},
};

const TYPE_CONFIG: Record<
	ComplianceIssue["type"],
	{ label: string; description: string; icon: typeof FileText }
> = {
	missing: {
		label: "Missing Response",
		description: "No response found for this requirement",
		icon: FileText,
	},
	partial: {
		label: "Partial Coverage",
		description: "Requirement is only partially addressed",
		icon: AlertCircle,
	},
	over_referenced: {
		label: "Over-Referenced",
		description: "Requirement is referenced in too many places",
		icon: ExternalLink,
	},
	weak: {
		label: "Weak Response",
		description: "Response quality does not meet expectations",
		icon: AlertTriangle,
	},
	mismatch: {
		label: "Non-Compliant",
		description: "Response does not align with requirement",
		icon: XCircle,
	},
};

// ============================================================================
// Component
// ============================================================================

export function ComplianceIssueCard({
	issue,
	onNavigate,
	onResolve,
	onEdit,
	onDismiss,
	showActions = true,
	compact = false,
	className,
}: ComplianceIssueCardProps) {
	const severityConfig = SEVERITY_CONFIG[issue.severity];
	const typeConfig = TYPE_CONFIG[issue.type];
	const SeverityIcon = severityConfig.icon;
	const TypeIcon = typeConfig.icon;

	if (compact) {
		return (
			<div
				className={cn(
					"flex items-center gap-3 p-3 rounded-lg border transition-colors",
					severityConfig.border,
					severityConfig.bg,
					onNavigate && "cursor-pointer hover:shadow-sm",
					className
				)}
				onClick={onNavigate}
			>
				<SeverityIcon className={cn("w-5 h-5 flex-shrink-0", severityConfig.color)} />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">{issue.requirementNumber}</span>
						<span className="text-xs text-gray-500">{typeConfig.label}</span>
					</div>
					<p className="text-xs text-gray-600 truncate">{issue.description}</p>
				</div>
				{onNavigate && (
					<ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
				)}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"rounded-lg border overflow-hidden",
				severityConfig.border,
				className
			)}
		>
			{/* Header */}
			<div className={cn("p-4", severityConfig.bg)}>
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3">
						<SeverityIcon
							className={cn("w-6 h-6 mt-0.5", severityConfig.color)}
						/>
						<div>
							<div className="flex items-center gap-2 mb-1">
								<span className="font-semibold text-lg">
									{issue.requirementNumber}
								</span>
								<span
									className={cn(
										"px-2 py-0.5 text-xs font-medium rounded-full",
										severityConfig.bg,
										severityConfig.color,
										"border",
										severityConfig.border
									)}
								>
									{severityConfig.label}
								</span>
							</div>
							<p className="text-sm text-gray-600">{severityConfig.description}</p>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="p-4 bg-white">
				{/* Issue Type */}
				<div className="flex items-center gap-2 mb-3">
					<TypeIcon className="w-4 h-4 text-gray-500" />
					<span className="text-sm font-medium">{typeConfig.label}</span>
					<span className="text-xs text-gray-500">— {typeConfig.description}</span>
				</div>

				{/* Description */}
				<div className="mb-4">
					<p className="text-gray-800">{issue.description}</p>
				</div>

				{/* Location */}
				{issue.location && (
					<div className="mb-4 p-3 bg-gray-50 rounded-lg">
						<div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
							<ExternalLink className="w-4 h-4" />
							<span className="font-medium">Location</span>
						</div>
						<p className="text-sm font-mono text-gray-700">{issue.location}</p>
					</div>
				)}

				{/* Suggestion */}
				{issue.suggestion && (
					<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<div className="flex items-center gap-2 text-sm text-blue-700 mb-1">
							<Lightbulb className="w-4 h-4" />
							<span className="font-medium">Suggested Action</span>
						</div>
						<p className="text-sm text-blue-800">{issue.suggestion}</p>
					</div>
				)}

				{/* Impact Assessment */}
				<div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
					<div className="flex items-center gap-1">
						<Clock className="w-3 h-3" />
						<span>
							Est. resolution:{" "}
							{issue.severity === "critical"
								? "< 1 hour"
								: issue.severity === "high"
								? "1-2 hours"
								: "30 mins"}
						</span>
					</div>
				</div>

				{/* Actions */}
				{showActions && (
					<div className="flex items-center gap-2 pt-3 border-t">
						{onNavigate && (
							<Button variant="outline" size="sm" onClick={onNavigate}>
								<ExternalLink className="w-4 h-4 mr-1" />
								View Requirement
							</Button>
						)}
						{onEdit && (
							<Button variant="outline" size="sm" onClick={onEdit}>
								<Edit className="w-4 h-4 mr-1" />
								Edit Response
							</Button>
						)}
						{onResolve && (
							<Button variant="primary" size="sm" onClick={onResolve}>
								<CheckCircle className="w-4 h-4 mr-1" />
								Mark Resolved
							</Button>
						)}
						{onDismiss && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onDismiss}
								className="ml-auto"
							>
								Dismiss
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
