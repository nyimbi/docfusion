/**
 * CommentCard - Individual Review Comment Display
 *
 * Displays a single review comment with type, severity, resolution status,
 * and actions for resolving/editing comments.
 */

"use client";

import { useState, useCallback } from "react";
import {
	MessageSquare,
	CheckCircle2,
	Clock,
	Edit2,
	Trash2,
	Reply,
	Flag,
	MoreHorizontal,
	AlertTriangle,
	Lightbulb,
	HelpCircle,
	ThumbsUp,
	Link2,
	Copy,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export type CommentType =
	| "strength"
	| "weakness"
	| "suggestion"
	| "question"
	| "critical"
	| "compliment"
	| "compliance_gap"
	| "theme_opportunity";

export type CommentSeverity = "critical" | "major" | "minor" | "editorial";

export type ResolutionStatus =
	| "open"
	| "in_progress"
	| "resolved"
	| "wont_fix"
	| "deferred"
	| "duplicate";

export interface Comment {
	id: string;
	reviewerId?: string;
	reviewerName?: string;
	reviewerAvatar?: string;
	sectionId?: string;
	sectionName?: string;
	pageNumber?: number;
	lineNumber?: number;
	selectedText?: string;
	commentType: CommentType;
	severity?: CommentSeverity;
	category?: string;
	title?: string;
	comment: string;
	suggestedChange?: string;
	rationale?: string;
	evaluationCriteriaRef?: string;
	impactOnScore?: string;
	tags?: string[];
	resolutionStatus: ResolutionStatus;
	resolutionNotes?: string;
	resolutionAction?: string;
	resolvedBy?: string;
	resolvedAt?: string;
	isAnonymous: boolean;
	replyCount?: number;
	priorityRank?: number;
	createdAt: string;
}

export interface CommentCardProps {
	comment: Comment;
	variant?: "default" | "compact" | "expanded";
	showReviewer?: boolean;
	showLocation?: boolean;
	showActions?: boolean;
	isSelected?: boolean;
	onSelect?: (commentId: string) => void;
	onEdit?: (commentId: string) => void;
	onDelete?: (commentId: string) => void;
	onResolve?: (commentId: string) => void;
	onReply?: (commentId: string) => void;
	onMarkDuplicate?: (commentId: string) => void;
	onCopyLink?: (commentId: string) => void;
	onNavigateToLocation?: (comment: Comment) => void;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMMENT_TYPE_CONFIG: Record<
	CommentType,
	{ label: string; icon: typeof MessageSquare; color: string; bgColor: string }
> = {
	strength: {
		label: "Strength",
		icon: ThumbsUp,
		color: "text-green-700 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	weakness: {
		label: "Weakness",
		icon: AlertTriangle,
		color: "text-red-700 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
	suggestion: {
		label: "Suggestion",
		icon: Lightbulb,
		color: "text-blue-700 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	question: {
		label: "Question",
		icon: HelpCircle,
		color: "text-purple-700 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
	critical: {
		label: "Critical",
		icon: Flag,
		color: "text-red-800 dark:text-red-300",
		bgColor: "bg-red-200 dark:bg-red-900/50",
	},
	compliment: {
		label: "Compliment",
		icon: ThumbsUp,
		color: "text-emerald-700 dark:text-emerald-400",
		bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
	},
	compliance_gap: {
		label: "Compliance Gap",
		icon: AlertTriangle,
		color: "text-amber-700 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	theme_opportunity: {
		label: "Theme Opportunity",
		icon: Lightbulb,
		color: "text-indigo-700 dark:text-indigo-400",
		bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
	},
};

const SEVERITY_CONFIG: Record<
	CommentSeverity,
	{ label: string; color: string; borderColor: string }
> = {
	critical: {
		label: "Critical",
		color: "text-red-600",
		borderColor: "border-l-red-500",
	},
	major: {
		label: "Major",
		color: "text-orange-600",
		borderColor: "border-l-orange-500",
	},
	minor: {
		label: "Minor",
		color: "text-yellow-600",
		borderColor: "border-l-yellow-500",
	},
	editorial: {
		label: "Editorial",
		color: "text-blue-600",
		borderColor: "border-l-blue-500",
	},
};

const RESOLUTION_CONFIG: Record<
	ResolutionStatus,
	{ label: string; color: string; bgColor: string }
> = {
	open: {
		label: "Open",
		color: "text-amber-700",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	in_progress: {
		label: "In Progress",
		color: "text-blue-700",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	resolved: {
		label: "Resolved",
		color: "text-green-700",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	wont_fix: {
		label: "Won't Fix",
		color: "text-gray-700",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
	deferred: {
		label: "Deferred",
		color: "text-purple-700",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
	duplicate: {
		label: "Duplicate",
		color: "text-gray-500",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CommentCard({
	comment,
	variant = "default",
	showReviewer = true,
	showLocation = true,
	showActions = true,
	isSelected = false,
	onSelect,
	onEdit,
	onDelete,
	onResolve,
	onReply,
	onMarkDuplicate,
	onCopyLink,
	onNavigateToLocation,
	className,
}: CommentCardProps) {
	const [isExpanded, setIsExpanded] = useState(variant === "expanded");

	const typeConfig = COMMENT_TYPE_CONFIG[comment.commentType];
	const severityConfig = comment.severity ? SEVERITY_CONFIG[comment.severity] : null;
	const resolutionConfig = RESOLUTION_CONFIG[comment.resolutionStatus];
	const TypeIcon = typeConfig.icon;

	// Format date
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	};

	// Get reviewer initials
	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	// Handle card click
	const handleClick = useCallback(() => {
		onSelect?.(comment.id);
	}, [comment.id, onSelect]);

	// Compact variant
	if (variant === "compact") {
		return (
			<div
				className={cn(
					"flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
					"hover:bg-muted/50",
					isSelected && "bg-primary/10 ring-1 ring-primary",
					className
				)}
				onClick={handleClick}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
				<div className={cn("p-1.5 rounded", typeConfig.bgColor)}>
					<TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm truncate">
						{comment.title || comment.comment}
					</p>
				</div>
				{severityConfig && (
					<Badge variant="outline" className={cn("text-xs", severityConfig.color)}>
						{severityConfig.label}
					</Badge>
				)}
				<Badge
					variant="secondary"
					className={cn("text-xs", resolutionConfig.bgColor, resolutionConfig.color)}
				>
					{resolutionConfig.label}
				</Badge>
			</div>
		);
	}

	return (
		<Card
			className={cn(
				"overflow-hidden transition-all",
				severityConfig?.borderColor || "border-l-transparent",
				"border-l-4",
				isSelected && "ring-2 ring-primary",
				comment.resolutionStatus === "resolved" && "opacity-75",
				className
			)}
			onClick={handleClick}
		>
			<CardContent className="p-4">
				{/* Header */}
				<div className="flex items-start justify-between gap-3 mb-3">
					<div className="flex items-center gap-3">
						{/* Type Badge */}
						<div className={cn("p-2 rounded-lg", typeConfig.bgColor)}>
							<TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
						</div>

						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<Badge
									variant="secondary"
									className={cn(typeConfig.bgColor, typeConfig.color)}
								>
									{typeConfig.label}
								</Badge>

								{severityConfig && (
									<Badge variant="outline" className={severityConfig.color}>
										{severityConfig.label}
									</Badge>
								)}

								<Badge
									variant="secondary"
									className={cn(resolutionConfig.bgColor, resolutionConfig.color)}
								>
									{comment.resolutionStatus === "resolved" && (
										<CheckCircle2 className="h-3 w-3 mr-1" />
									)}
									{comment.resolutionStatus === "in_progress" && (
										<Clock className="h-3 w-3 mr-1" />
									)}
									{resolutionConfig.label}
								</Badge>
							</div>

							{/* Reviewer info */}
							{showReviewer && !comment.isAnonymous && comment.reviewerName && (
								<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
									<Avatar className="h-4 w-4">
										<AvatarImage src={comment.reviewerAvatar} />
										<AvatarFallback className="text-[8px]">
											{getInitials(comment.reviewerName)}
										</AvatarFallback>
									</Avatar>
									<span>{comment.reviewerName}</span>
									<span>·</span>
									<span>{formatDate(comment.createdAt)}</span>
								</div>
							)}

							{showReviewer && comment.isAnonymous && (
								<p className="text-xs text-muted-foreground mt-1">
									Anonymous · {formatDate(comment.createdAt)}
								</p>
							)}
						</div>
					</div>

					{/* Actions Menu */}
					{showActions && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={(e) => e.stopPropagation()}
								>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{comment.resolutionStatus !== "resolved" && (
									<DropdownMenuItem onClick={() => onResolve?.(comment.id)}>
										<CheckCircle2 className="h-4 w-4 mr-2" />
										Mark Resolved
									</DropdownMenuItem>
								)}
								<DropdownMenuItem onClick={() => onReply?.(comment.id)}>
									<Reply className="h-4 w-4 mr-2" />
									Reply
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onEdit?.(comment.id)}>
									<Edit2 className="h-4 w-4 mr-2" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onCopyLink?.(comment.id)}>
									<Copy className="h-4 w-4 mr-2" />
									Copy Link
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => onMarkDuplicate?.(comment.id)}>
									<Link2 className="h-4 w-4 mr-2" />
									Mark as Duplicate
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => onDelete?.(comment.id)}
									className="text-destructive"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>

				{/* Location */}
				{showLocation && (comment.sectionName || comment.pageNumber) && (
					<div
						className="flex items-center gap-2 text-xs text-muted-foreground mb-2 cursor-pointer hover:text-foreground"
						onClick={(e) => {
							e.stopPropagation();
							onNavigateToLocation?.(comment);
						}}

		role="button"
		tabIndex={0}
		onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
						<Link2 className="h-3 w-3" />
						{comment.sectionName && <span>{comment.sectionName}</span>}
						{comment.pageNumber && (
							<>
								{comment.sectionName && <span>·</span>}
								<span>Page {comment.pageNumber}</span>
							</>
						)}
						{comment.lineNumber && <span>Line {comment.lineNumber}</span>}
					</div>
				)}

				{/* Title */}
				{comment.title && (
					<h4 className="font-semibold mb-2">{comment.title}</h4>
				)}

				{/* Selected Text Quote */}
				{comment.selectedText && (
					<blockquote className="border-l-2 border-muted-foreground/30 pl-3 mb-3 text-sm italic text-muted-foreground">
						"{comment.selectedText}"
					</blockquote>
				)}

				{/* Comment Body */}
				<p className={cn("text-sm", !isExpanded && "line-clamp-3")}>
					{comment.comment}
				</p>

				{/* Expand/Collapse for long comments */}
				{comment.comment.length > 200 && (
					<Button
						variant="ghost"
						size="sm"
						className="mt-1 h-6 px-2 text-xs"
						onClick={(e) => {
							e.stopPropagation();
							setIsExpanded(!isExpanded);
						}}
					>
						{isExpanded ? (
							<>
								<ChevronUp className="h-3 w-3 mr-1" />
								Show less
							</>
						) : (
							<>
								<ChevronDown className="h-3 w-3 mr-1" />
								Show more
							</>
						)}
					</Button>
				)}

				{/* Suggested Change */}
				{comment.suggestedChange && (isExpanded || variant === "expanded") && (
					<div className="mt-3 p-3 bg-muted rounded-lg">
						<p className="text-xs font-medium text-muted-foreground mb-1">
							Suggested Change:
						</p>
						<p className="text-sm">{comment.suggestedChange}</p>
					</div>
				)}

				{/* Evaluation Criteria Reference */}
				{comment.evaluationCriteriaRef && (
					<div className="mt-2 flex items-center gap-2">
						<Badge variant="outline" className="text-xs">
							Criteria: {comment.evaluationCriteriaRef}
						</Badge>
						{comment.impactOnScore && (
							<Badge
								variant="outline"
								className={cn(
									"text-xs",
									comment.impactOnScore === "high"
										? "text-red-600"
										: comment.impactOnScore === "medium"
											? "text-amber-600"
											: "text-blue-600"
								)}
							>
								{comment.impactOnScore} impact
							</Badge>
						)}
					</div>
				)}

				{/* Tags */}
				{comment.tags && comment.tags.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{comment.tags.map((tag) => (
							<Badge key={tag} variant="secondary" className="text-xs">
								{tag}
							</Badge>
						))}
					</div>
				)}

				{/* Resolution Info */}
				{comment.resolutionStatus === "resolved" && comment.resolvedBy && (
					<div className="mt-3 pt-3 border-t">
						<div className="flex items-center gap-2 text-xs text-green-600">
							<CheckCircle2 className="h-3.5 w-3.5" />
							<span>
								Resolved by {comment.resolvedBy}
								{comment.resolvedAt && ` · ${formatDate(comment.resolvedAt)}`}
							</span>
						</div>
						{comment.resolutionNotes && (
							<p className="text-xs text-muted-foreground mt-1">
								{comment.resolutionNotes}
							</p>
						)}
					</div>
				)}

				{/* Reply count */}
				{comment.replyCount != null && comment.replyCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="mt-2 h-7 px-2 text-xs"
						onClick={(e) => {
							e.stopPropagation();
							onReply?.(comment.id);
						}}
					>
						<MessageSquare className="h-3 w-3 mr-1" />
						{comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

export default CommentCard;
