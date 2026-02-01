"use client";

/**
 * Requirement Card Component
 *
 * Displays a single RFP requirement with its metadata, compliance status,
 * and actions. Supports inline editing and status updates.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	ChevronDown,
	ChevronRight,
	Edit2,
	MessageSquare,
	User,
	Calendar,
	AlertTriangle,
	CheckCircle2,
	Circle,
	Clock,
	FileText,
	Lightbulb,
	Link2,
	MoreHorizontal,
	ExternalLink,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
	RequirementCategory,
	RequirementPriority,
	RequirementType,
	ComplianceStatus,
	RiskLevel,
} from "@/lib/db/schema-rfp";

// ============================================================================
// Types
// ============================================================================

export interface Requirement {
	id: string;
	requirementNumber: string;
	title: string | null;
	requirementText: string;
	sourceQuote: string | null;
	sourcePage: number | null;
	sourceSection: string | null;
	category: RequirementCategory;
	subcategory: string | null;
	requirementType: RequirementType;
	priority: RequirementPriority;
	riskLevel: RiskLevel;
	evaluationWeight: number | null;
	extractionConfidence: number | null;
	isImplicit: boolean;
	ambiguityLevel: string | null;
	clarificationQuestions: string[];
	relatedRequirements: string[];
	keyTerms: string[];
	suggestedApproach: string | null;
	complianceStatus: ComplianceStatus;
	responseStrategy: string | null;
	assignedTo: string | null;
	dueDate: string | null;
	responseDocumentId: string | null;
	responseSection: string | null;
	notes: string | null;
	tags: string[];
}

interface RequirementCardProps {
	requirement: Requirement;
	isSelected?: boolean;
	isExpanded?: boolean;
	onSelect?: (id: string, selected: boolean) => void;
	onExpand?: (id: string) => void;
	onEdit?: (id: string) => void;
	onStatusChange?: (id: string, status: ComplianceStatus) => void;
	onAssign?: (id: string) => void;
	onViewResponse?: (id: string) => void;
	onAddClarification?: (id: string) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_COLORS: Record<RequirementCategory, string> = {
	technical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	management: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
	past_performance: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	cost: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	administrative: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
	personnel: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
	security: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
	compliance: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
	other: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

const PRIORITY_COLORS: Record<RequirementPriority, string> = {
	mandatory: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
	preferred: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
	optional: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
};

const COMPLIANCE_STATUS_CONFIG: Record<
	ComplianceStatus,
	{ label: string; color: string; icon: React.ReactNode }
> = {
	not_addressed: {
		label: "Not Addressed",
		color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
		icon: <Circle className="h-3 w-3" />,
	},
	in_progress: {
		label: "In Progress",
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
		icon: <Clock className="h-3 w-3" />,
	},
	addressed: {
		label: "Addressed",
		color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
		icon: <FileText className="h-3 w-3" />,
	},
	compliant: {
		label: "Compliant",
		color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
		icon: <CheckCircle2 className="h-3 w-3" />,
	},
	partial: {
		label: "Partial",
		color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	non_compliant: {
		label: "Non-Compliant",
		color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	not_applicable: {
		label: "N/A",
		color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
		icon: <Circle className="h-3 w-3" />,
	},
	pending: {
		label: "Pending",
		color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
		icon: <Clock className="h-3 w-3" />,
	},
};

const RISK_COLORS: Record<RiskLevel, string> = {
	critical: "text-red-600 dark:text-red-400",
	high: "text-orange-600 dark:text-orange-400",
	medium: "text-yellow-600 dark:text-yellow-400",
	low: "text-green-600 dark:text-green-400",
};

// ============================================================================
// Component
// ============================================================================

export function RequirementCard({
	requirement,
	isSelected = false,
	isExpanded = false,
	onSelect,
	onExpand,
	onEdit,
	onStatusChange,
	onAssign,
	onViewResponse,
	onAddClarification,
	className,
}: RequirementCardProps) {
	const statusConfig = COMPLIANCE_STATUS_CONFIG[requirement.complianceStatus];

	// Format due date
	const formatDueDate = (dateStr: string | null): string => {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		const now = new Date();
		const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
		if (diffDays === 0) return "Due today";
		if (diffDays === 1) return "Due tomorrow";
		if (diffDays < 7) return `${diffDays}d remaining`;
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	// Check if overdue
	const isOverdue = requirement.dueDate && new Date(requirement.dueDate) < new Date();

	return (
		<Card
			className={cn(
				"transition-all duration-200",
				isSelected && "ring-2 ring-primary",
				isExpanded && "shadow-md",
				className
			)}
		>
			<CardHeader className="p-3 pb-0">
				<div className="flex items-start gap-3">
					{/* Selection checkbox */}
					{onSelect && (
						<Checkbox
							checked={isSelected}
							onCheckedChange={(checked) => onSelect(requirement.id, !!checked)}
							className="mt-1"
						/>
					)}

					{/* Expand/collapse button */}
					{onExpand && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 shrink-0"
							onClick={() => onExpand(requirement.id)}
						>
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
					)}

					{/* Main content */}
					<div className="flex-1 min-w-0 space-y-1">
						{/* Header row */}
						<div className="flex items-center gap-2 flex-wrap">
							<span className="font-mono text-sm font-medium text-muted-foreground">
								{requirement.requirementNumber}
							</span>
							<Badge className={cn("text-xs", CATEGORY_COLORS[requirement.category])}>
								{requirement.category.replace("_", " ")}
							</Badge>
							<Badge
								variant="outline"
								className={cn("text-xs", PRIORITY_COLORS[requirement.priority])}
							>
								{requirement.priority}
							</Badge>
							{requirement.requirementType !== "shall" && (
								<Badge variant="outline" className="text-xs">
									{requirement.requirementType.toUpperCase()}
								</Badge>
							)}
							{requirement.isImplicit && (
								<Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
									Implicit
								</Badge>
							)}
						</div>

						{/* Title */}
						{requirement.title && (
							<h4 className="font-medium text-sm">{requirement.title}</h4>
						)}

						{/* Requirement text (truncated) */}
						<p
							className={cn(
								"text-sm text-muted-foreground",
								!isExpanded && "line-clamp-2"
							)}
						>
							{requirement.requirementText}
						</p>
					</div>

					{/* Status badge */}
					<div className="flex items-center gap-2">
						<Badge className={cn("flex items-center gap-1", statusConfig.color)}>
							{statusConfig.icon}
							{statusConfig.label}
						</Badge>

						{/* Actions menu */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{onEdit && (
									<DropdownMenuItem onClick={() => onEdit(requirement.id)}>
										<Edit2 className="h-4 w-4 mr-2" />
										Edit Requirement
									</DropdownMenuItem>
								)}
								{onAssign && (
									<DropdownMenuItem onClick={() => onAssign(requirement.id)}>
										<User className="h-4 w-4 mr-2" />
										Assign Owner
									</DropdownMenuItem>
								)}
								{onViewResponse && requirement.responseDocumentId && (
									<DropdownMenuItem onClick={() => onViewResponse(requirement.id)}>
										<ExternalLink className="h-4 w-4 mr-2" />
										View Response
									</DropdownMenuItem>
								)}
								{onAddClarification && (
									<DropdownMenuItem onClick={() => onAddClarification(requirement.id)}>
										<MessageSquare className="h-4 w-4 mr-2" />
										Add Clarification
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								{onStatusChange && (
									<>
										<DropdownMenuItem
											onClick={() => onStatusChange(requirement.id, "in_progress")}
										>
											<Clock className="h-4 w-4 mr-2" />
											Mark In Progress
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => onStatusChange(requirement.id, "compliant")}
										>
											<CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
											Mark Compliant
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => onStatusChange(requirement.id, "partial")}
										>
											<AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
											Mark Partial
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => onStatusChange(requirement.id, "non_compliant")}
										>
											<AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
											Mark Non-Compliant
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>

			<CardContent className="p-3 pt-2">
				{/* Metadata row */}
				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					{requirement.sourceSection && (
						<span className="flex items-center gap-1">
							<FileText className="h-3 w-3" />
							{requirement.sourceSection}
						</span>
					)}
					{requirement.sourcePage && (
						<span>Page {requirement.sourcePage}</span>
					)}
					{requirement.assignedTo && (
						<span className="flex items-center gap-1">
							<User className="h-3 w-3" />
							{requirement.assignedTo}
						</span>
					)}
					{requirement.dueDate && (
						<span
							className={cn(
								"flex items-center gap-1",
								isOverdue && "text-red-600 font-medium"
							)}
						>
							<Calendar className="h-3 w-3" />
							{formatDueDate(requirement.dueDate)}
						</span>
					)}
					{requirement.riskLevel !== "medium" && (
						<span className={cn("flex items-center gap-1", RISK_COLORS[requirement.riskLevel])}>
							<AlertTriangle className="h-3 w-3" />
							{requirement.riskLevel} risk
						</span>
					)}
					{requirement.extractionConfidence && (
						<span className="text-muted-foreground/60">
							{Math.round(requirement.extractionConfidence)}% confidence
						</span>
					)}
				</div>

				{/* Expanded content */}
				{isExpanded && (
					<div className="mt-4 pt-4 border-t space-y-4">
						{/* Source quote */}
						{requirement.sourceQuote && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Original Quote</p>
								<blockquote className="text-sm italic pl-3 border-l-2 border-muted-foreground/30">
									"{requirement.sourceQuote}"
								</blockquote>
							</div>
						)}

						{/* Key terms */}
						{requirement.keyTerms.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Key Terms</p>
								<div className="flex flex-wrap gap-1">
									{requirement.keyTerms.map((term, i) => (
										<Badge key={i} variant="secondary" className="text-xs">
											{term}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Suggested approach */}
						{requirement.suggestedApproach && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
									<Lightbulb className="h-3 w-3" />
									Suggested Approach
								</p>
								<p className="text-sm text-muted-foreground">
									{requirement.suggestedApproach}
								</p>
							</div>
						)}

						{/* Clarification questions */}
						{requirement.clarificationQuestions.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
									<MessageSquare className="h-3 w-3" />
									Clarification Questions
								</p>
								<ul className="text-sm space-y-1">
									{requirement.clarificationQuestions.map((q, i) => (
										<li key={i} className="flex items-start gap-2">
											<span className="text-muted-foreground">{i + 1}.</span>
											{q}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Related requirements */}
						{requirement.relatedRequirements.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
									<Link2 className="h-3 w-3" />
									Related Requirements
								</p>
								<div className="flex flex-wrap gap-1">
									{requirement.relatedRequirements.map((id, i) => (
										<Badge key={i} variant="outline" className="text-xs font-mono">
											{id}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Response strategy */}
						{requirement.responseStrategy && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Response Strategy</p>
								<p className="text-sm">{requirement.responseStrategy}</p>
							</div>
						)}

						{/* Notes */}
						{requirement.notes && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Notes</p>
								<p className="text-sm text-muted-foreground">{requirement.notes}</p>
							</div>
						)}

						{/* Tags */}
						{requirement.tags.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{requirement.tags.map((tag, i) => (
									<Badge key={i} variant="outline" className="text-xs">
										#{tag}
									</Badge>
								))}
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default RequirementCard;
