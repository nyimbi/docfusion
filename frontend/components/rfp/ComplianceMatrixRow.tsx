/**
 * ComplianceMatrixRow Component
 *
 * Displays a single row in the compliance matrix showing the mapping
 * between a requirement and its response section.
 */

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	ChevronDown,
	ChevronRight,
	ExternalLink,
	Edit2,
	Link,
	Unlink,
	AlertTriangle,
	CheckCircle,
	Clock,
	XCircle,
	AlertCircle,
	MessageSquare,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ComplianceEntry {
	id: string;
	requirementId: string;
	requirementNumber: string;
	requirementTitle: string | null;
	requirementText: string;
	category: string;
	priority: string;
	complianceStatus: string;
	complianceJustification: string | null;
	responseReference: string | null;
	responseSummary: string | null;
	strengthAssessment: string | null;
	riskLevel: string | null;
	assignedTo: string | null;
	dueDate: string | null;
	completionPercent: number;
}

interface ComplianceMatrixRowProps {
	entry: ComplianceEntry;
	isSelected?: boolean;
	isExpanded?: boolean;
	onSelect?: (id: string) => void;
	onToggleExpand?: (id: string) => void;
	onEdit?: (entry: ComplianceEntry) => void;
	onLinkSection?: (requirementId: string) => void;
	onUnlink?: (entryId: string) => void;
	onNavigateToResponse?: (reference: string) => void;
	onAddComment?: (entryId: string) => void;
	showCategory?: boolean;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
	string,
	{ icon: typeof CheckCircle; color: string; bg: string; label: string }
> = {
	compliant: {
		icon: CheckCircle,
		color: "text-green-600",
		bg: "bg-green-50",
		label: "Compliant",
	},
	addressed: {
		icon: CheckCircle,
		color: "text-green-600",
		bg: "bg-green-50",
		label: "Addressed",
	},
	partial: {
		icon: AlertCircle,
		color: "text-yellow-600",
		bg: "bg-yellow-50",
		label: "Partial",
	},
	pending: {
		icon: Clock,
		color: "text-blue-600",
		bg: "bg-blue-50",
		label: "Pending",
	},
	not_addressed: {
		icon: XCircle,
		color: "text-red-600",
		bg: "bg-red-50",
		label: "Not Addressed",
	},
	non_compliant: {
		icon: XCircle,
		color: "text-red-600",
		bg: "bg-red-50",
		label: "Non-Compliant",
	},
	not_applicable: {
		icon: AlertCircle,
		color: "text-gray-500",
		bg: "bg-gray-50",
		label: "N/A",
	},
};

const STRENGTH_CONFIG: Record<string, { color: string; label: string }> = {
	strong: { color: "text-green-600", label: "Strong" },
	moderate: { color: "text-yellow-600", label: "Moderate" },
	weak: { color: "text-orange-600", label: "Weak" },
	gap: { color: "text-red-600", label: "Gap" },
};

const RISK_CONFIG: Record<string, { color: string; label: string }> = {
	low: { color: "text-green-600", label: "Low" },
	medium: { color: "text-yellow-600", label: "Medium" },
	high: { color: "text-orange-600", label: "High" },
	critical: { color: "text-red-600", label: "Critical" },
};

// ============================================================================
// Component
// ============================================================================

export function ComplianceMatrixRow({
	entry,
	isSelected = false,
	isExpanded = false,
	onSelect,
	onToggleExpand,
	onEdit,
	onLinkSection,
	onUnlink,
	onNavigateToResponse,
	onAddComment,
	showCategory = true,
	className,
}: ComplianceMatrixRowProps) {
	const statusConfig = STATUS_CONFIG[entry.complianceStatus] ?? STATUS_CONFIG.pending;
	const StatusIcon = statusConfig.icon;
	const strengthConfig = entry.strengthAssessment
		? STRENGTH_CONFIG[entry.strengthAssessment]
		: null;
	const riskConfig = entry.riskLevel ? RISK_CONFIG[entry.riskLevel] : null;

	return (
		<div
			className={cn(
				"border-b transition-colors",
				isSelected && "bg-blue-50",
				className
			)}
		>
			{/* Main Row */}
			<div className="flex items-stretch">
				{/* Selection & Expand */}
				<div className="flex items-center gap-1 px-2 border-r bg-gray-50">
					{onSelect && (
						<input
							type="checkbox"
							checked={isSelected}
							onChange={() => onSelect(entry.id)}
							className="rounded"
						/>
					)}
					{onToggleExpand && (
						<button
							onClick={() => onToggleExpand(entry.id)}
							className="p-1 hover:bg-gray-200 rounded"
						>
							{isExpanded ? (
								<ChevronDown className="w-4 h-4" />
							) : (
								<ChevronRight className="w-4 h-4" />
							)}
						</button>
					)}
				</div>

				{/* Requirement Number */}
				<div className="w-28 px-3 py-2 border-r flex items-center">
					<span className="font-mono text-sm font-medium">
						{entry.requirementNumber}
					</span>
				</div>

				{/* Category (optional) */}
				{showCategory && (
					<div className="w-28 px-3 py-2 border-r flex items-center">
						<span className="text-xs text-gray-600 capitalize">
							{entry.category.replace(/_/g, " ")}
						</span>
					</div>
				)}

				{/* Priority */}
				<div className="w-24 px-3 py-2 border-r flex items-center">
					<span
						className={cn(
							"px-2 py-0.5 text-xs font-medium rounded-full",
							entry.priority === "mandatory"
								? "bg-red-100 text-red-700"
								: entry.priority === "important"
								? "bg-orange-100 text-orange-700"
								: "bg-blue-100 text-blue-700"
						)}
					>
						{entry.priority}
					</span>
				</div>

				{/* Requirement Text */}
				<div className="flex-1 px-3 py-2 border-r min-w-0">
					<p className="text-sm line-clamp-2">
						{entry.requirementTitle && (
							<span className="font-medium">{entry.requirementTitle}: </span>
						)}
						{entry.requirementText}
					</p>
				</div>

				{/* Response Reference */}
				<div className="w-40 px-3 py-2 border-r flex items-center">
					{entry.responseReference ? (
						<button
							onClick={() =>
								onNavigateToResponse?.(entry.responseReference!)
							}
							className="text-sm text-blue-600 hover:underline flex items-center gap-1"
						>
							<span className="truncate">{entry.responseReference}</span>
							<ExternalLink className="w-3 h-3 flex-shrink-0" />
						</button>
					) : (
						<span className="text-sm text-gray-400 italic">Not linked</span>
					)}
				</div>

				{/* Status */}
				<div className="w-32 px-3 py-2 border-r flex items-center">
					<div
						className={cn(
							"flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
							statusConfig.bg,
							statusConfig.color
						)}
					>
						<StatusIcon className="w-3.5 h-3.5" />
						{statusConfig.label}
					</div>
				</div>

				{/* Completion */}
				<div className="w-20 px-3 py-2 border-r flex items-center">
					<div className="w-full">
						<div className="text-xs text-gray-600 mb-1">
							{entry.completionPercent}%
						</div>
						<div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
							<div
								className={cn(
									"h-full transition-all",
									entry.completionPercent >= 100
										? "bg-green-500"
										: entry.completionPercent >= 50
										? "bg-yellow-500"
										: "bg-red-500"
								)}
								style={{ width: `${Math.min(entry.completionPercent, 100)}%` }}
							/>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="w-28 px-2 py-2 flex items-center justify-center gap-1">
					{onEdit && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onEdit(entry)}
							className="p-1"
						>
							<Edit2 className="w-4 h-4" />
						</Button>
					)}
					{entry.responseReference ? (
						onUnlink && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onUnlink(entry.id)}
								className="p-1 text-red-600 hover:text-red-700"
							>
								<Unlink className="w-4 h-4" />
							</Button>
						)
					) : (
						onLinkSection && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onLinkSection(entry.requirementId)}
								className="p-1 text-blue-600 hover:text-blue-700"
							>
								<Link className="w-4 h-4" />
							</Button>
						)
					)}
					{onAddComment && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onAddComment(entry.id)}
							className="p-1"
						>
							<MessageSquare className="w-4 h-4" />
						</Button>
					)}
				</div>
			</div>

			{/* Expanded Details */}
			{isExpanded && (
				<div className="px-4 py-3 bg-gray-50 border-t space-y-3">
					{/* Full Requirement Text */}
					<div>
						<h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
							Full Requirement
						</h4>
						<p className="text-sm">{entry.requirementText}</p>
					</div>

					{/* Response Summary */}
					{entry.responseSummary && (
						<div>
							<h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
								Response Summary
							</h4>
							<p className="text-sm">{entry.responseSummary}</p>
						</div>
					)}

					{/* Compliance Justification */}
					{entry.complianceJustification && (
						<div>
							<h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
								Compliance Justification
							</h4>
							<p className="text-sm">{entry.complianceJustification}</p>
						</div>
					)}

					{/* Assessment & Risk */}
					<div className="flex items-center gap-6">
						{strengthConfig && (
							<div className="flex items-center gap-2">
								<span className="text-xs text-gray-500">Strength:</span>
								<span className={cn("text-sm font-medium", strengthConfig.color)}>
									{strengthConfig.label}
								</span>
							</div>
						)}
						{riskConfig && (
							<div className="flex items-center gap-2">
								<AlertTriangle className={cn("w-4 h-4", riskConfig.color)} />
								<span className="text-xs text-gray-500">Risk:</span>
								<span className={cn("text-sm font-medium", riskConfig.color)}>
									{riskConfig.label}
								</span>
							</div>
						)}
						{entry.assignedTo && (
							<div className="flex items-center gap-2">
								<span className="text-xs text-gray-500">Assigned:</span>
								<span className="text-sm">{entry.assignedTo}</span>
							</div>
						)}
						{entry.dueDate && (
							<div className="flex items-center gap-2">
								<Clock className="w-4 h-4 text-gray-400" />
								<span className="text-xs text-gray-500">Due:</span>
								<span className="text-sm">
									{new Date(entry.dueDate).toLocaleDateString()}
								</span>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
