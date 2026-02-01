/**
 * CommentPanel - Comment Management Panel
 *
 * Panel for viewing, filtering, and managing review comments.
 * Includes filtering, sorting, and bulk operations.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
	MessageSquare,
	Filter,
	SortAsc,
	SortDesc,
	Search,
	Plus,
	CheckCircle2,
	AlertTriangle,
	Download,
	ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentCard, Comment, CommentType, CommentSeverity, ResolutionStatus } from "./CommentCard";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface CommentPanelProps {
	comments: Comment[];
	sections?: { id: string; name: string }[];
	reviewers?: { id: string; name: string }[];
	onAddComment?: () => void;
	onEditComment?: (commentId: string) => void;
	onDeleteComment?: (commentId: string) => void;
	onResolveComment?: (commentId: string) => void;
	onReplyToComment?: (commentId: string) => void;
	onBulkResolve?: (commentIds: string[]) => void;
	onExportComments?: (format: "xlsx" | "csv") => void;
	onNavigateToLocation?: (comment: Comment) => void;
	className?: string;
}

type SortField = "createdAt" | "severity" | "type" | "section" | "status";
type SortDirection = "asc" | "desc";

// ============================================================================
// CONSTANTS
// ============================================================================

const COMMENT_TYPES: { value: CommentType; label: string }[] = [
	{ value: "strength", label: "Strength" },
	{ value: "weakness", label: "Weakness" },
	{ value: "suggestion", label: "Suggestion" },
	{ value: "question", label: "Question" },
	{ value: "critical", label: "Critical" },
	{ value: "compliance_gap", label: "Compliance Gap" },
	{ value: "theme_opportunity", label: "Theme Opportunity" },
];

const SEVERITY_OPTIONS: { value: CommentSeverity; label: string }[] = [
	{ value: "critical", label: "Critical" },
	{ value: "major", label: "Major" },
	{ value: "minor", label: "Minor" },
	{ value: "editorial", label: "Editorial" },
];

const RESOLUTION_OPTIONS: { value: ResolutionStatus; label: string }[] = [
	{ value: "open", label: "Open" },
	{ value: "in_progress", label: "In Progress" },
	{ value: "resolved", label: "Resolved" },
	{ value: "wont_fix", label: "Won't Fix" },
	{ value: "deferred", label: "Deferred" },
	{ value: "duplicate", label: "Duplicate" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function CommentPanel({
	comments,
	sections = [],
	reviewers = [],
	onAddComment,
	onEditComment,
	onDeleteComment,
	onResolveComment,
	onReplyToComment,
	onBulkResolve,
	onExportComments,
	onNavigateToLocation,
	className,
}: CommentPanelProps) {
	// State
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
	const [typeFilters, setTypeFilters] = useState<CommentType[]>([]);
	const [severityFilters, setSeverityFilters] = useState<CommentSeverity[]>([]);
	const [sectionFilter, setSectionFilter] = useState<string>("all");
	const [reviewerFilter, setReviewerFilter] = useState<string>("all");
	const [sortField, setSortField] = useState<SortField>("createdAt");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());

	// Filter and sort comments
	const filteredComments = useMemo(() => {
		let filtered = [...comments];

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(c) =>
					c.comment.toLowerCase().includes(query) ||
					c.title?.toLowerCase().includes(query) ||
					c.suggestedChange?.toLowerCase().includes(query) ||
					c.tags?.some((t) => t.toLowerCase().includes(query))
			);
		}

		// Status filter
		if (statusFilter === "open") {
			filtered = filtered.filter(
				(c) => c.resolutionStatus === "open" || c.resolutionStatus === "in_progress"
			);
		} else if (statusFilter === "resolved") {
			filtered = filtered.filter(
				(c) =>
					c.resolutionStatus === "resolved" ||
					c.resolutionStatus === "wont_fix" ||
					c.resolutionStatus === "duplicate"
			);
		}

		// Type filter
		if (typeFilters.length > 0) {
			filtered = filtered.filter((c) => typeFilters.includes(c.commentType));
		}

		// Severity filter
		if (severityFilters.length > 0) {
			filtered = filtered.filter((c) => c.severity && severityFilters.includes(c.severity));
		}

		// Section filter
		if (sectionFilter !== "all") {
			filtered = filtered.filter((c) => c.sectionId === sectionFilter);
		}

		// Reviewer filter
		if (reviewerFilter !== "all") {
			filtered = filtered.filter((c) => c.reviewerId === reviewerFilter);
		}

		// Sort
		filtered.sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "createdAt":
					comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
				case "severity": {
					const severityOrder = { critical: 0, major: 1, minor: 2, editorial: 3 };
					const aOrder = a.severity ? severityOrder[a.severity] : 4;
					const bOrder = b.severity ? severityOrder[b.severity] : 4;
					comparison = aOrder - bOrder;
					break;
				}
				case "type":
					comparison = a.commentType.localeCompare(b.commentType);
					break;
				case "section":
					comparison = (a.sectionName || "").localeCompare(b.sectionName || "");
					break;
				case "status": {
					const statusOrder = {
						open: 0,
						in_progress: 1,
						resolved: 2,
						wont_fix: 3,
						deferred: 4,
						duplicate: 5,
					};
					comparison = statusOrder[a.resolutionStatus] - statusOrder[b.resolutionStatus];
					break;
				}
			}

			return sortDirection === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [
		comments,
		searchQuery,
		statusFilter,
		typeFilters,
		severityFilters,
		sectionFilter,
		reviewerFilter,
		sortField,
		sortDirection,
	]);

	// Statistics
	const stats = useMemo(() => {
		const total = comments.length;
		const open = comments.filter(
			(c) => c.resolutionStatus === "open" || c.resolutionStatus === "in_progress"
		).length;
		const resolved = comments.filter(
			(c) =>
				c.resolutionStatus === "resolved" ||
				c.resolutionStatus === "wont_fix" ||
				c.resolutionStatus === "duplicate"
		).length;
		const critical = comments.filter((c) => c.severity === "critical").length;

		return { total, open, resolved, critical };
	}, [comments]);

	// Toggle type filter
	const toggleTypeFilter = useCallback((type: CommentType) => {
		setTypeFilters((prev) =>
			prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
		);
	}, []);

	// Toggle severity filter
	const toggleSeverityFilter = useCallback((severity: CommentSeverity) => {
		setSeverityFilters((prev) =>
			prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
		);
	}, []);

	// Toggle comment selection
	const toggleCommentSelection = useCallback((commentId: string) => {
		setSelectedComments((prev) => {
			const next = new Set(prev);
			if (next.has(commentId)) {
				next.delete(commentId);
			} else {
				next.add(commentId);
			}
			return next;
		});
	}, []);

	// Select all open comments
	const selectAllOpen = useCallback(() => {
		const openIds = filteredComments
			.filter((c) => c.resolutionStatus === "open" || c.resolutionStatus === "in_progress")
			.map((c) => c.id);
		setSelectedComments(new Set(openIds));
	}, [filteredComments]);

	// Clear selection
	const clearSelection = useCallback(() => {
		setSelectedComments(new Set());
	}, []);

	// Handle bulk resolve
	const handleBulkResolve = useCallback(() => {
		if (selectedComments.size > 0) {
			onBulkResolve?.(Array.from(selectedComments));
			clearSelection();
		}
	}, [selectedComments, onBulkResolve, clearSelection]);

	// Toggle sort direction
	const toggleSortDirection = useCallback(() => {
		setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
	}, []);

	// Clear all filters
	const clearFilters = useCallback(() => {
		setSearchQuery("");
		setStatusFilter("all");
		setTypeFilters([]);
		setSeverityFilters([]);
		setSectionFilter("all");
		setReviewerFilter("all");
	}, []);

	const hasActiveFilters =
		searchQuery ||
		statusFilter !== "all" ||
		typeFilters.length > 0 ||
		severityFilters.length > 0 ||
		sectionFilter !== "all" ||
		reviewerFilter !== "all";

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header */}
			<div className="p-4 border-b space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<MessageSquare className="h-5 w-5" />
						<h3 className="font-semibold">Comments</h3>
						<Badge variant="secondary">{stats.total}</Badge>
					</div>

					<div className="flex items-center gap-2">
						{selectedComments.size > 0 && (
							<>
								<span className="text-sm text-muted-foreground">
									{selectedComments.size} selected
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={handleBulkResolve}
								>
									<CheckCircle2 className="h-4 w-4 mr-2" />
									Resolve Selected
								</Button>
								<Button variant="ghost" size="sm" onClick={clearSelection}>
									Clear
								</Button>
							</>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Download className="h-4 w-4 mr-2" />
									Export
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuLabel>Export Format</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									onClick={() => onExportComments?.("xlsx")}
								>
									Excel (.xlsx)
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									onClick={() => onExportComments?.("csv")}
								>
									CSV (.csv)
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button size="sm" onClick={onAddComment}>
							<Plus className="h-4 w-4 mr-2" />
							Add Comment
						</Button>
					</div>
				</div>

				{/* Quick Stats */}
				<div className="flex items-center gap-4">
					<Tabs
						value={statusFilter}
						onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
					>
						<TabsList>
							<TabsTrigger value="all">All ({stats.total})</TabsTrigger>
							<TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
							<TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
						</TabsList>
					</Tabs>

					{stats.critical > 0 && (
						<Badge variant="destructive" className="gap-1">
							<AlertTriangle className="h-3 w-3" />
							{stats.critical} Critical
						</Badge>
					)}
				</div>

				{/* Search and Filters */}
				<div className="flex items-center gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search comments..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					{/* Type Filter */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Filter className="h-4 w-4 mr-2" />
								Type
								{typeFilters.length > 0 && (
									<Badge variant="secondary" className="ml-2">
										{typeFilters.length}
									</Badge>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{COMMENT_TYPES.map((type) => (
								<DropdownMenuCheckboxItem
									key={type.value}
									checked={typeFilters.includes(type.value)}
									onCheckedChange={() => toggleTypeFilter(type.value)}
								>
									{type.label}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Severity Filter */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Filter className="h-4 w-4 mr-2" />
								Severity
								{severityFilters.length > 0 && (
									<Badge variant="secondary" className="ml-2">
										{severityFilters.length}
									</Badge>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{SEVERITY_OPTIONS.map((sev) => (
								<DropdownMenuCheckboxItem
									key={sev.value}
									checked={severityFilters.includes(sev.value)}
									onCheckedChange={() => toggleSeverityFilter(sev.value)}
								>
									{sev.label}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Section Filter */}
					{sections.length > 0 && (
						<Select value={sectionFilter} onValueChange={setSectionFilter}>
							<SelectTrigger className="w-[150px]">
								<SelectValue placeholder="Section" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Sections</SelectItem>
								{sections.map((section) => (
									<SelectItem key={section.id} value={section.id}>
										{section.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}

					{/* Sort */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								{sortDirection === "asc" ? (
									<SortAsc className="h-4 w-4 mr-2" />
								) : (
									<SortDesc className="h-4 w-4 mr-2" />
								)}
								Sort
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuLabel>Sort By</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{[
								{ value: "createdAt", label: "Date" },
								{ value: "severity", label: "Severity" },
								{ value: "type", label: "Type" },
								{ value: "section", label: "Section" },
								{ value: "status", label: "Status" },
							].map((option) => (
								<DropdownMenuCheckboxItem
									key={option.value}
									checked={sortField === option.value}
									onCheckedChange={() => setSortField(option.value as SortField)}
								>
									{option.label}
								</DropdownMenuCheckboxItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem
								checked={sortDirection === "asc"}
								onCheckedChange={toggleSortDirection}
							>
								Ascending
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Clear Filters */}
					{hasActiveFilters && (
						<Button variant="ghost" size="sm" onClick={clearFilters}>
							Clear Filters
						</Button>
					)}
				</div>

				{/* Bulk Selection */}
				{statusFilter !== "resolved" && (
					<div className="flex items-center gap-2 text-sm">
						<Button variant="ghost" size="sm" onClick={selectAllOpen}>
							Select All Open
						</Button>
					</div>
				)}
			</div>

			{/* Comments List */}
			<ScrollArea className="flex-1">
				<div className="p-4 space-y-3">
					{filteredComments.length > 0 ? (
						filteredComments.map((comment) => (
							<CommentCard
								key={comment.id}
								comment={comment}
								isSelected={selectedComments.has(comment.id)}
								onSelect={toggleCommentSelection}
								onEdit={onEditComment}
								onDelete={onDeleteComment}
								onResolve={onResolveComment}
								onReply={onReplyToComment}
								onNavigateToLocation={onNavigateToLocation}
							/>
						))
					) : (
						<div className="text-center py-12">
							<MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
							<h3 className="font-medium mb-1">No comments found</h3>
							<p className="text-sm text-muted-foreground">
								{hasActiveFilters
									? "Try adjusting your filters"
									: "Add your first comment to get started"}
							</p>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Footer with summary */}
			<div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground">
				Showing {filteredComments.length} of {stats.total} comments
				{hasActiveFilters && " (filtered)"}
			</div>
		</div>
	);
}

export default CommentPanel;
