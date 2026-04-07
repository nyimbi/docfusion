"use client";

/**
 * Content Snippet Card Component
 *
 * Displays a content snippet with metadata, analytics,
 * win/loss statistics, and actions.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Copy,
	Edit2,
	MoreHorizontal,
	Star,
	Clock,
	AlertTriangle,
	CheckCircle2,
	TrendingUp,
	TrendingDown,
	Calendar,
	Tag,
	FileText,
	ExternalLink,
	Eye,
	Bookmark,
	BookmarkCheck,
} from "lucide-react";
import type { ContentType, FreshnessStatus } from "@/lib/db/schema-content-library";

// ============================================================================
// Types
// ============================================================================

export interface ContentSnippet {
	id: string;
	name: string;
	content: string;
	description: string | null;
	category: string | null;
	tags: string[];
	// Analytics
	aiTags: string[];
	keyTerms: string[];
	contentType: ContentType | null;
	topicCategory: string | null;
	sectors: string[];
	technologies: string[];
	complianceFrameworks: string[];
	freshnessStatus: FreshnessStatus;
	reviewDueDate: string | null;
	lastReviewedAt: string | null;
	qualityScore: number | null;
	wordCount: number;
	// Win/loss tracking
	winCount: number;
	lossCount: number;
	winRate: number | null;
	lastUsedAt: string | null;
	// Metadata
	createdAt: string;
	updatedAt: string;
}

interface ContentSnippetCardProps {
	snippet: ContentSnippet;
	isSelected?: boolean;
	isBookmarked?: boolean;
	isExpanded?: boolean;
	onSelect?: (id: string) => void;
	onExpand?: (id: string) => void;
	onCopy?: (id: string) => void;
	onEdit?: (id: string) => void;
	onInsert?: (id: string) => void;
	onBookmark?: (id: string, bookmarked: boolean) => void;
	onViewUsage?: (id: string) => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FRESHNESS_CONFIG: Record<
	FreshnessStatus,
	{ label: string; color: string; icon: React.ReactNode }
> = {
	current: {
		label: "Current",
		color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
		icon: <CheckCircle2 className="h-3 w-3" />,
	},
	review_needed: {
		label: "Review Needed",
		color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
		icon: <Clock className="h-3 w-3" />,
	},
	stale: {
		label: "Stale",
		color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
		icon: <AlertTriangle className="h-3 w-3" />,
	},
	archived: {
		label: "Archived",
		color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
		icon: <FileText className="h-3 w-3" />,
	},
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
	boilerplate: "Boilerplate",
	capability: "Capability",
	past_performance: "Past Performance",
	solution: "Solution",
	approach: "Approach",
	bio: "Bio/Resume",
	methodology: "Methodology",
	executive_summary: "Executive Summary",
	management_approach: "Management",
	technical_approach: "Technical",
	staffing: "Staffing",
	quality_assurance: "QA",
	risk_management: "Risk",
	transition: "Transition",
	other: "Other",
};

// ============================================================================
// Component
// ============================================================================

export function ContentSnippetCard({
	snippet,
	isSelected = false,
	isBookmarked = false,
	isExpanded = false,
	onSelect,
	onExpand,
	onCopy,
	onEdit,
	onInsert,
	onBookmark,
	onViewUsage,
	className,
}: ContentSnippetCardProps) {
	const freshnessConfig = FRESHNESS_CONFIG[snippet.freshnessStatus];
	const totalProposals = snippet.winCount + snippet.lossCount;
	const hasWinData = totalProposals > 0;

	// Format relative time
	const formatRelativeTime = (dateStr: string | null): string => {
		if (!dateStr) return "Never";
		const date = new Date(dateStr);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	};

	// Truncate content for preview
	const previewContent = snippet.content.length > 300
		? snippet.content.slice(0, 300) + "..."
		: snippet.content;

	return (
		<Card
			className={cn(
				"transition-all duration-200 hover:shadow-md cursor-pointer",
				isSelected && "ring-2 ring-primary",
				className
			)}
			onClick={() => onSelect?.(snippet.id)}
		>
			<CardHeader className="p-3 pb-0">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						{/* Header row */}
						<div className="flex items-center gap-2 flex-wrap mb-1">
							{snippet.contentType && (
								<Badge variant="secondary" className="text-xs">
									{CONTENT_TYPE_LABELS[snippet.contentType] ?? snippet.contentType}
								</Badge>
							)}
							<Badge className={cn("text-xs flex items-center gap-1", freshnessConfig.color)}>
								{freshnessConfig.icon}
								{freshnessConfig.label}
							</Badge>
							{snippet.qualityScore !== null && (
								<Badge
									variant="outline"
									className={cn(
										"text-xs",
										snippet.qualityScore >= 80
											? "border-green-300 text-green-700"
											: snippet.qualityScore >= 60
											? "border-yellow-300 text-yellow-700"
											: "border-red-300 text-red-700"
									)}
								>
									<Star className="h-3 w-3 mr-1" />
									{snippet.qualityScore.toFixed(0)}
								</Badge>
							)}
						</div>

						{/* Title */}
						<h4 className="font-medium text-sm truncate">{snippet.name}</h4>

						{/* Description */}
						{snippet.description && (
							<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
								{snippet.description}
							</p>
						)}
					</div>

					{/* Actions */}
					<div className="flex items-center gap-1">
						{/* Bookmark button */}
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={(e) => {
								e.stopPropagation();
								onBookmark?.(snippet.id, !isBookmarked);
							}}
							aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
						>
							{isBookmarked ? (
								<BookmarkCheck className="h-4 w-4 text-primary" />
							) : (
								<Bookmark className="h-4 w-4" />
							)}
						</Button>

						{/* Quick copy */}
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={(e) => {
								e.stopPropagation();
								onCopy?.(snippet.id);
							}}
							aria-label="Copy snippet"
						>
							<Copy className="h-4 w-4" />
						</Button>

						{/* More actions */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={(e) => e.stopPropagation()}
									aria-label="More actions"
								>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{onInsert && (
									<DropdownMenuItem onClick={() => onInsert(snippet.id)}>
										<FileText className="h-4 w-4 mr-2" />
										Insert into Document
									</DropdownMenuItem>
								)}
								{onEdit && (
									<DropdownMenuItem onClick={() => onEdit(snippet.id)}>
										<Edit2 className="h-4 w-4 mr-2" />
										Edit Snippet
									</DropdownMenuItem>
								)}
								{onViewUsage && (
									<DropdownMenuItem onClick={() => onViewUsage(snippet.id)}>
										<Eye className="h-4 w-4 mr-2" />
										View Usage History
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => onCopy?.(snippet.id)}>
									<Copy className="h-4 w-4 mr-2" />
									Copy Content
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>

			<CardContent className="p-3 pt-2 space-y-3">
				{/* Content preview */}
				<div
					className={cn(
						"text-sm text-muted-foreground bg-muted/50 rounded p-2",
						!isExpanded && "line-clamp-3"
					)}
					onClick={(e) => {
						e.stopPropagation();
						onExpand?.(snippet.id);
					}}
				>
					{isExpanded ? snippet.content : previewContent}
				</div>

				{/* Win/Loss stats */}
				{hasWinData && (
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">Win Rate:</span>
							<div className="flex items-center gap-1">
								{snippet.winRate !== null && snippet.winRate >= 50 ? (
									<TrendingUp className="h-3 w-3 text-green-500" />
								) : (
									<TrendingDown className="h-3 w-3 text-red-500" />
								)}
								<span
									className={cn(
										"text-sm font-medium",
										snippet.winRate !== null && snippet.winRate >= 50
											? "text-green-600"
											: "text-red-600"
									)}
								>
									{snippet.winRate !== null
										? `${snippet.winRate.toFixed(0)}%`
										: "N/A"}
								</span>
							</div>
						</div>
						<div className="flex items-center gap-3 text-xs text-muted-foreground">
							<span className="text-green-600">{snippet.winCount} wins</span>
							<span className="text-red-600">{snippet.lossCount} losses</span>
						</div>
					</div>
				)}

				{/* Tags row */}
				{(snippet.tags.length > 0 || snippet.aiTags.length > 0) && (
					<div className="flex flex-wrap gap-1">
						{snippet.tags.slice(0, 3).map((tag, i) => (
							<Badge key={`tag-${i}`} variant="outline" className="text-xs">
								<Tag className="h-2 w-2 mr-1" />
								{tag}
							</Badge>
						))}
						{snippet.aiTags.slice(0, 3).map((tag, i) => (
							<Badge
								key={`ai-${i}`}
								variant="outline"
								className="text-xs bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300"
							>
								{tag}
							</Badge>
						))}
						{snippet.tags.length + snippet.aiTags.length > 6 && (
							<Badge variant="outline" className="text-xs">
								+{snippet.tags.length + snippet.aiTags.length - 6} more
							</Badge>
						)}
					</div>
				)}

				{/* Metadata row */}
				<div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
					<div className="flex items-center gap-3">
						<span>{snippet.wordCount} words</span>
						{snippet.category && (
							<span className="capitalize">{snippet.category}</span>
						)}
					</div>
					<div className="flex items-center gap-1">
						<Calendar className="h-3 w-3" />
						Last used {formatRelativeTime(snippet.lastUsedAt)}
					</div>
				</div>

				{/* Expanded details */}
				{isExpanded && (
					<div className="pt-3 border-t space-y-3">
						{/* Key terms */}
						{snippet.keyTerms.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Key Terms</p>
								<div className="flex flex-wrap gap-1">
									{snippet.keyTerms.map((term, i) => (
										<Badge key={i} variant="secondary" className="text-xs">
											{term}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Sectors */}
						{snippet.sectors.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Industries/Sectors</p>
								<div className="flex flex-wrap gap-1">
									{snippet.sectors.map((sector, i) => (
										<Badge key={i} variant="outline" className="text-xs">
											{sector}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Technologies */}
						{snippet.technologies.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Technologies</p>
								<div className="flex flex-wrap gap-1">
									{snippet.technologies.map((tech, i) => (
										<Badge key={i} variant="outline" className="text-xs">
											{tech}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Compliance frameworks */}
						{snippet.complianceFrameworks.length > 0 && (
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Compliance</p>
								<div className="flex flex-wrap gap-1">
									{snippet.complianceFrameworks.map((framework, i) => (
										<Badge
											key={i}
											variant="outline"
											className="text-xs bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
										>
											{framework}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Review info */}
						{snippet.reviewDueDate && (
							<div className="flex items-center gap-2 text-xs">
								<Clock className="h-3 w-3" />
								<span className="text-muted-foreground">
									Review due: {new Date(snippet.reviewDueDate).toLocaleDateString()}
								</span>
								{snippet.lastReviewedAt && (
									<span className="text-muted-foreground">
										(Last reviewed: {formatRelativeTime(snippet.lastReviewedAt)})
									</span>
								)}
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default ContentSnippetCard;
