/**
 * FormatIssueList Component
 *
 * Filterable, sortable list of format issues with severity badges,
 * navigation capability, and bulk action buttons.
 */

"use client";

import * as React from "react";
import {
	AlertCircle,
	AlertTriangle,
	Info,
	Filter,
	ArrowUpDown,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	Wrench,
	Check,
	X,
	Search,
	RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

import type { FormatIssue, FormatIssueSeverity, IssueCategory } from "@/lib/types/formatting";

// =============================================================================
// Types
// =============================================================================

export interface FormatIssueListProps {
	/** Array of format issues to display */
	issues: FormatIssue[];
	/** Callback when an issue is clicked */
	onIssueClick?: (issue: FormatIssue) => void;
	/** Callback for bulk auto-fix */
	onAutoFix?: (issueIds: string[]) => void;
	/** Callback for bulk dismiss */
	onDismiss?: (issueIds: string[]) => void;
	/** Show severity filter */
	showFilter?: boolean;
	/** Show bulk actions */
	showBulkActions?: boolean;
	/** Additional CSS classes */
	className?: string;
}

type SortField = "severity" | "category" | "title";
type SortDirection = "asc" | "desc";

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_CONFIG: Record<
	FormatIssueSeverity,
	{ label: string; color: string; bgColor: string; icon: React.ElementType; order: number }
> = {
	critical: {
		label: "Critical",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		icon: AlertCircle,
		order: 0,
	},
	major: {
		label: "Major",
		color: "text-yellow-600 dark:text-yellow-400",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
		icon: AlertTriangle,
		order: 1,
	},
	minor: {
		label: "Minor",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		icon: Info,
		order: 2,
	},
};

const CATEGORY_LABELS: Record<IssueCategory, string> = {
	"page-limit": "Page Limits",
	margins: "Margins",
	font: "Typography",
	spacing: "Line Spacing",
	headers: "Headers",
	"page-numbers": "Page Numbers",
	accessibility: "Accessibility",
	structure: "Document Structure",
	figures: "Figures",
	tables: "Tables",
	"cross-references": "Cross-References",
	consistency: "Consistency",
	compliance: "Compliance",
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Severity badge component.
 */
function SeverityBadge({ severity }: { severity: FormatIssueSeverity }) {
	const config = SEVERITY_CONFIG[severity];
	const Icon = config.icon;

	return (
		<Badge
			variant="outline"
			className={cn("gap-1 text-xs", config.color, config.bgColor)}
		>
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	);
}

/**
 * Individual issue row component.
 */
interface IssueRowProps {
	issue: FormatIssue;
	isSelected: boolean;
	onSelect: (selected: boolean) => void;
	onClick?: () => void;
	showCheckbox: boolean;
}

function IssueRow({
	issue,
	isSelected,
	onSelect,
	onClick,
	showCheckbox,
}: IssueRowProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);
	const config = SEVERITY_CONFIG[issue.severity];
	const Icon = config.icon;

	return (
		<div
			className={cn(
				"border rounded-lg overflow-hidden transition-colors",
				isSelected && "ring-2 ring-primary",
				onClick && "cursor-pointer hover:bg-accent/30"
			)}
		>
			<div
				className="flex items-start gap-3 p-3"
				onClick={(e) => {
					if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
					if ((e.target as HTMLElement).closest("button")) return;
					onClick?.();
				}}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
				{showCheckbox && (
					<Checkbox
						checked={isSelected}
						onCheckedChange={onSelect}
						className="mt-1"
						aria-label={`Select issue: ${issue.title}`}
					/>
				)}

				<div className={cn("mt-0.5", config.color)}>
					<Icon className="h-5 w-5" />
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-medium text-sm">{issue.title}</span>
						<SeverityBadge severity={issue.severity} />
						{issue.category && (
							<Badge variant="secondary" className="text-xs">
								{CATEGORY_LABELS[issue.category]}
							</Badge>
						)}
						{issue.autoFixable && (
							<Badge variant="outline" className="text-xs gap-1 text-green-600">
								<Wrench className="h-3 w-3" />
								Auto-fixable
							</Badge>
						)}
					</div>

					<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
						{issue.description}
					</p>

					{issue.location && (
						<p className="text-xs text-muted-foreground mt-1">
							{issue.location.page && `Page ${issue.location.page}`}
							{issue.location.section && `, Section ${issue.location.section}`}
						</p>
					)}

					{/* Expandable details */}
					{(issue.suggestion || issue.regulatoryReference) && (
						<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="mt-2 h-7 text-xs"
									onClick={(e) => e.stopPropagation()}
								>
									{isExpanded ? (
										<ChevronDown className="h-3 w-3 mr-1" />
									) : (
										<ChevronRight className="h-3 w-3 mr-1" />
									)}
									Details
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-2 space-y-2">
								{issue.suggestion && (
									<div className="p-2 bg-muted/50 rounded text-sm">
										<span className="font-medium">Suggestion: </span>
										{issue.suggestion}
									</div>
								)}
								{issue.regulatoryReference && (
									<div className="flex items-center gap-1 text-xs text-muted-foreground">
										<ExternalLink className="h-3 w-3" />
										Reference: {issue.regulatoryReference}
									</div>
								)}
							</CollapsibleContent>
						</Collapsible>
					)}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function FormatIssueList({
	issues,
	onIssueClick,
	onAutoFix,
	onDismiss,
	showFilter = true,
	showBulkActions = true,
	className,
}: FormatIssueListProps) {
	// State
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = React.useState("");
	const [severityFilter, setSeverityFilter] = React.useState<Set<FormatIssueSeverity>>(
		new Set(["critical", "major", "minor"])
	);
	const [categoryFilter, setCategoryFilter] = React.useState<Set<IssueCategory>>(
		new Set()
	);
	const [sortField, setSortField] = React.useState<SortField>("severity");
	const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");

	// Get unique categories from issues
	const availableCategories = React.useMemo(() => {
		return Array.from(new Set(issues.map((i) => i.category).filter(Boolean))) as IssueCategory[];
	}, [issues]);

	// Filter and sort issues
	const filteredIssues = React.useMemo(() => {
		let result = issues.filter((issue) => {
			// Severity filter
			if (!severityFilter.has(issue.severity)) return false;

			// Category filter (if any categories selected)
			if (categoryFilter.size > 0 && issue.category && !categoryFilter.has(issue.category)) {
				return false;
			}

			// Search query
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					issue.title.toLowerCase().includes(query) ||
					issue.description.toLowerCase().includes(query) ||
					(issue.suggestion?.toLowerCase().includes(query) ?? false)
				);
			}

			return true;
		});

		// Sort
		result.sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "severity":
					comparison = SEVERITY_CONFIG[a.severity].order - SEVERITY_CONFIG[b.severity].order;
					break;
				case "category":
					comparison = (a.category || "").localeCompare(b.category || "");
					break;
				case "title":
					comparison = a.title.localeCompare(b.title);
					break;
			}

			return sortDirection === "asc" ? comparison : -comparison;
		});

		return result;
	}, [issues, severityFilter, categoryFilter, searchQuery, sortField, sortDirection]);

	// Selection helpers
	const allSelected = filteredIssues.length > 0 && filteredIssues.every((i) => selectedIds.has(i.id));
	const someSelected = filteredIssues.some((i) => selectedIds.has(i.id));
	const autoFixableSelected = Array.from(selectedIds).filter((id) =>
		issues.find((i) => i.id === id && i.autoFixable)
	);

	const toggleSelectAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredIssues.map((i) => i.id)));
		}
	};

	const toggleSelect = (id: string, selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	};

	const toggleSeverityFilter = (severity: FormatIssueSeverity) => {
		setSeverityFilter((prev) => {
			const next = new Set(prev);
			if (next.has(severity)) {
				next.delete(severity);
			} else {
				next.add(severity);
			}
			return next;
		});
	};

	const toggleCategoryFilter = (category: IssueCategory) => {
		setCategoryFilter((prev) => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	};

	const resetFilters = () => {
		setSearchQuery("");
		setSeverityFilter(new Set(["critical", "major", "minor"]));
		setCategoryFilter(new Set());
	};

	const handleAutoFix = () => {
		if (autoFixableSelected.length > 0) {
			onAutoFix?.(autoFixableSelected);
			setSelectedIds(new Set());
		}
	};

	const handleDismiss = () => {
		if (selectedIds.size > 0) {
			onDismiss?.(Array.from(selectedIds));
			setSelectedIds(new Set());
		}
	};

	// Issue counts by severity
	const counts = React.useMemo(() => {
		return {
			critical: issues.filter((i) => i.severity === "critical").length,
			major: issues.filter((i) => i.severity === "major").length,
			minor: issues.filter((i) => i.severity === "minor").length,
		};
	}, [issues]);

	// Empty state
	if (issues.length === 0) {
		return (
			<div className={cn("text-center py-12", className)}>
				<Check className="h-12 w-12 mx-auto text-green-500 mb-3" />
				<h3 className="font-medium text-lg">No Issues Found</h3>
				<p className="text-sm text-muted-foreground">
					Your document has no formatting issues.
				</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Summary */}
			<div className="flex items-center gap-3 flex-wrap">
				{(["critical", "major", "minor"] as FormatIssueSeverity[]).map((severity) => {
					const count = counts[severity];
					if (count === 0) return null;
					const config = SEVERITY_CONFIG[severity];
					const Icon = config.icon;

					return (
						<div
							key={severity}
							className={cn(
								"flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-opacity",
								config.bgColor,
								!severityFilter.has(severity) && "opacity-50"
							)}
							onClick={() => toggleSeverityFilter(severity)}

			role="button"
			tabIndex={0}
			onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
							<Icon className={cn("h-4 w-4", config.color)} />
							<span className={cn("text-sm font-medium", config.color)}>
								{count} {config.label}
							</span>
						</div>
					);
				})}
			</div>

			{/* Toolbar */}
			<div className="flex items-center gap-2 flex-wrap">
				{/* Search */}
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search issues..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Filters */}
				{showFilter && (
					<>
						{/* Severity Filter */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Filter className="h-4 w-4 mr-2" />
									Severity
									{severityFilter.size < 3 && (
										<Badge variant="secondary" className="ml-2 h-5 px-1.5">
											{severityFilter.size}
										</Badge>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{(["critical", "major", "minor"] as FormatIssueSeverity[]).map((severity) => (
									<DropdownMenuCheckboxItem
										key={severity}
										checked={severityFilter.has(severity)}
										onCheckedChange={() => toggleSeverityFilter(severity)}
									>
										<SeverityBadge severity={severity} />
										<span className="ml-2">({counts[severity]})</span>
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Category Filter */}
						{availableCategories.length > 0 && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										<Filter className="h-4 w-4 mr-2" />
										Category
										{categoryFilter.size > 0 && (
											<Badge variant="secondary" className="ml-2 h-5 px-1.5">
												{categoryFilter.size}
											</Badge>
										)}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
									{availableCategories.map((category) => (
										<DropdownMenuCheckboxItem
											key={category}
											checked={categoryFilter.has(category)}
											onCheckedChange={() => toggleCategoryFilter(category)}
										>
											{CATEGORY_LABELS[category]}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}

						{/* Sort */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<ArrowUpDown className="h-4 w-4 mr-2" />
									Sort
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Sort By</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={sortField === "severity"}
									onCheckedChange={() => setSortField("severity")}
								>
									Severity
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "category"}
									onCheckedChange={() => setSortField("category")}
								>
									Category
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "title"}
									onCheckedChange={() => setSortField("title")}
								>
									Title
								</DropdownMenuCheckboxItem>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={sortDirection === "asc"}
									onCheckedChange={() => setSortDirection("asc")}
								>
									Ascending
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortDirection === "desc"}
									onCheckedChange={() => setSortDirection("desc")}
								>
									Descending
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Reset Filters */}
						{(searchQuery || severityFilter.size < 3 || categoryFilter.size > 0) && (
							<Button variant="ghost" size="sm" onClick={resetFilters}>
								<RotateCcw className="h-4 w-4 mr-2" />
								Reset
							</Button>
						)}
					</>
				)}
			</div>

			{/* Bulk Actions */}
			{showBulkActions && (onAutoFix || onDismiss) && (
				<div className="flex items-center gap-3 py-2 px-3 bg-muted/30 rounded-lg">
					<Checkbox
						checked={allSelected ? true : (someSelected ? "indeterminate" : false)}
						onCheckedChange={toggleSelectAll}
						aria-label="Select all issues"
					/>
					<span className="text-sm text-muted-foreground">
						{selectedIds.size > 0
							? `${selectedIds.size} selected`
							: `${filteredIssues.length} issues`}
					</span>

					{selectedIds.size > 0 && (
						<div className="flex items-center gap-2 ml-auto">
							{onAutoFix && autoFixableSelected.length > 0 && (
								<Button variant="outline" size="sm" onClick={handleAutoFix}>
									<Wrench className="h-4 w-4 mr-2" />
									Auto-fix ({autoFixableSelected.length})
								</Button>
							)}
							{onDismiss && (
								<Button variant="ghost" size="sm" onClick={handleDismiss}>
									<X className="h-4 w-4 mr-2" />
									Dismiss
								</Button>
							)}
						</div>
					)}
				</div>
			)}

			{/* Issue List */}
			<div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
				{filteredIssues.map((issue) => (
					<IssueRow
						key={issue.id}
						issue={issue}
						isSelected={selectedIds.has(issue.id)}
						onSelect={(selected) => toggleSelect(issue.id, selected)}
						onClick={onIssueClick ? () => onIssueClick(issue) : undefined}
						showCheckbox={showBulkActions && (!!onAutoFix || !!onDismiss)}
					/>
				))}
			</div>

			{/* No Results */}
			{filteredIssues.length === 0 && issues.length > 0 && (
				<div className="text-center py-8 text-muted-foreground">
					<Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
					<p className="text-sm">No issues match your filters.</p>
					<Button variant="link" size="sm" onClick={resetFilters}>
						Reset filters
					</Button>
				</div>
			)}
		</div>
	);
}

export default FormatIssueList;
