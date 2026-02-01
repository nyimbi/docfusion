/**
 * ContentFilters Component
 *
 * Advanced filter panel for content library with category,
 * freshness, quality, and win rate filters.
 */

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Filter,
	X,
	Folder,
	Tag,
	Clock,
	TrendingUp,
	Star,
	ChevronDown,
	ChevronRight,
	RefreshCw,
	Check,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface FilterState {
	categories: string[];
	contentTypes: string[];
	tags: string[];
	freshnessStatus: string[];
	status: string[];
	minWinRate?: number;
	minQualityScore?: number;
	dateRange?: { start: string; end: string };
	searchIn: ("title" | "content" | "tags" | "description")[];
}

interface ContentFiltersProps {
	filters: FilterState;
	onChange: (filters: FilterState) => void;
	onReset: () => void;
	categories: { value: string; label: string; count?: number }[];
	contentTypes: { value: string; label: string; count?: number }[];
	availableTags: { name: string; count?: number }[];
	isExpanded?: boolean;
	onToggleExpand?: () => void;
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FRESHNESS_OPTIONS = [
	{ value: "current", label: "Current", color: "text-green-600 bg-green-50" },
	{ value: "stale", label: "Stale", color: "text-yellow-600 bg-yellow-50" },
	{ value: "needs_review", label: "Needs Review", color: "text-orange-600 bg-orange-50" },
	{ value: "expired", label: "Expired", color: "text-red-600 bg-red-50" },
];

const STATUS_OPTIONS = [
	{ value: "draft", label: "Draft" },
	{ value: "pending_approval", label: "Pending Approval" },
	{ value: "approved", label: "Approved" },
	{ value: "archived", label: "Archived" },
];

const SEARCH_IN_OPTIONS = [
	{ value: "title" as const, label: "Title" },
	{ value: "content" as const, label: "Content" },
	{ value: "tags" as const, label: "Tags" },
	{ value: "description" as const, label: "Description" },
];

// ============================================================================
// Component
// ============================================================================

export function ContentFilters({
	filters,
	onChange,
	onReset,
	categories,
	contentTypes,
	availableTags,
	isExpanded = true,
	onToggleExpand,
	className,
}: ContentFiltersProps) {
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(["categories", "freshness"])
	);
	const [tagSearch, setTagSearch] = useState("");

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	const toggleArrayFilter = (
		key: "categories" | "contentTypes" | "tags" | "freshnessStatus" | "status" | "searchIn",
		value: string
	) => {
		const current = filters[key] as string[];
		const updated = current.includes(value)
			? current.filter((v) => v !== value)
			: [...current, value];
		onChange({ ...filters, [key]: updated });
	};

	const activeFilterCount =
		filters.categories.length +
		filters.contentTypes.length +
		filters.tags.length +
		filters.freshnessStatus.length +
		filters.status.length +
		(filters.minWinRate ? 1 : 0) +
		(filters.minQualityScore ? 1 : 0) +
		(filters.dateRange ? 1 : 0);

	const filteredTags = tagSearch
		? availableTags.filter((t) =>
				t.name.toLowerCase().includes(tagSearch.toLowerCase())
		  )
		: availableTags;

	if (!isExpanded) {
		return (
			<button
				onClick={onToggleExpand}
				className={cn(
					"flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50",
					activeFilterCount > 0 && "bg-blue-50 border-blue-200",
					className
				)}
			>
				<Filter className="w-4 h-4" />
				<span className="text-sm">Filters</span>
				{activeFilterCount > 0 && (
					<span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
						{activeFilterCount}
					</span>
				)}
			</button>
		);
	}

	return (
		<div className={cn("bg-white border rounded-lg", className)}>
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b">
				<div className="flex items-center gap-2">
					<Filter className="w-5 h-5 text-gray-500" />
					<h3 className="font-medium">Filters</h3>
					{activeFilterCount > 0 && (
						<span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
							{activeFilterCount}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{activeFilterCount > 0 && (
						<Button variant="ghost" size="sm" onClick={onReset}>
							<RefreshCw className="w-4 h-4 mr-1" />
							Reset
						</Button>
					)}
					{onToggleExpand && (
						<button onClick={onToggleExpand} className="p-1 hover:bg-gray-100 rounded">
							<X className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			<div className="p-3 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
				{/* Categories */}
				<FilterSection
					title="Categories"
					icon={<Folder className="w-4 h-4" />}
					isExpanded={expandedSections.has("categories")}
					onToggle={() => toggleSection("categories")}
					count={filters.categories.length}
				>
					<div className="space-y-1">
						{categories.map((cat) => (
							<label
								key={cat.value}
								className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
							>
								<input
									type="checkbox"
									checked={filters.categories.includes(cat.value)}
									onChange={() => toggleArrayFilter("categories", cat.value)}
									className="rounded"
								/>
								<span className="text-sm flex-1">{cat.label}</span>
								{cat.count !== undefined && (
									<span className="text-xs text-gray-400">{cat.count}</span>
								)}
							</label>
						))}
					</div>
				</FilterSection>

				{/* Content Types */}
				<FilterSection
					title="Content Types"
					isExpanded={expandedSections.has("contentTypes")}
					onToggle={() => toggleSection("contentTypes")}
					count={filters.contentTypes.length}
				>
					<div className="space-y-1">
						{contentTypes.map((type) => (
							<label
								key={type.value}
								className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
							>
								<input
									type="checkbox"
									checked={filters.contentTypes.includes(type.value)}
									onChange={() => toggleArrayFilter("contentTypes", type.value)}
									className="rounded"
								/>
								<span className="text-sm flex-1">{type.label}</span>
								{type.count !== undefined && (
									<span className="text-xs text-gray-400">{type.count}</span>
								)}
							</label>
						))}
					</div>
				</FilterSection>

				{/* Freshness */}
				<FilterSection
					title="Freshness"
					icon={<Clock className="w-4 h-4" />}
					isExpanded={expandedSections.has("freshness")}
					onToggle={() => toggleSection("freshness")}
					count={filters.freshnessStatus.length}
				>
					<div className="flex flex-wrap gap-2">
						{FRESHNESS_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								onClick={() => toggleArrayFilter("freshnessStatus", opt.value)}
								className={cn(
									"px-2 py-1 rounded text-xs transition-colors",
									filters.freshnessStatus.includes(opt.value)
										? opt.color
										: "bg-gray-100 text-gray-600 hover:bg-gray-200"
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</FilterSection>

				{/* Status */}
				<FilterSection
					title="Status"
					isExpanded={expandedSections.has("status")}
					onToggle={() => toggleSection("status")}
					count={filters.status.length}
				>
					<div className="space-y-1">
						{STATUS_OPTIONS.map((opt) => (
							<label
								key={opt.value}
								className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
							>
								<input
									type="checkbox"
									checked={filters.status.includes(opt.value)}
									onChange={() => toggleArrayFilter("status", opt.value)}
									className="rounded"
								/>
								<span className="text-sm">{opt.label}</span>
							</label>
						))}
					</div>
				</FilterSection>

				{/* Tags */}
				<FilterSection
					title="Tags"
					icon={<Tag className="w-4 h-4" />}
					isExpanded={expandedSections.has("tags")}
					onToggle={() => toggleSection("tags")}
					count={filters.tags.length}
				>
					<input
						type="text"
						value={tagSearch}
						onChange={(e) => setTagSearch(e.target.value)}
						placeholder="Search tags..."
						className="w-full px-2 py-1 text-sm border rounded mb-2"
					/>
					<div className="max-h-32 overflow-y-auto space-y-1">
						{filteredTags.slice(0, 20).map((tag) => (
							<label
								key={tag.name}
								className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
							>
								<input
									type="checkbox"
									checked={filters.tags.includes(tag.name)}
									onChange={() => toggleArrayFilter("tags", tag.name)}
									className="rounded"
								/>
								<span className="text-sm flex-1">{tag.name}</span>
								{tag.count !== undefined && (
									<span className="text-xs text-gray-400">{tag.count}</span>
								)}
							</label>
						))}
					</div>
				</FilterSection>

				{/* Win Rate */}
				<FilterSection
					title="Win Rate"
					icon={<TrendingUp className="w-4 h-4" />}
					isExpanded={expandedSections.has("winRate")}
					onToggle={() => toggleSection("winRate")}
					count={filters.minWinRate ? 1 : 0}
				>
					<div>
						<input
							type="range"
							min="0"
							max="100"
							step="10"
							value={filters.minWinRate ?? 0}
							onChange={(e) =>
								onChange({
									...filters,
									minWinRate: parseInt(e.target.value) || undefined,
								})
							}
							className="w-full"
						/>
						<div className="flex justify-between text-xs text-gray-500">
							<span>Any</span>
							<span>{filters.minWinRate ?? 0}%+</span>
						</div>
					</div>
				</FilterSection>

				{/* Quality Score */}
				<FilterSection
					title="Quality Score"
					icon={<Star className="w-4 h-4" />}
					isExpanded={expandedSections.has("quality")}
					onToggle={() => toggleSection("quality")}
					count={filters.minQualityScore ? 1 : 0}
				>
					<div>
						<input
							type="range"
							min="0"
							max="100"
							step="10"
							value={filters.minQualityScore ?? 0}
							onChange={(e) =>
								onChange({
									...filters,
									minQualityScore: parseInt(e.target.value) || undefined,
								})
							}
							className="w-full"
						/>
						<div className="flex justify-between text-xs text-gray-500">
							<span>Any</span>
							<span>{filters.minQualityScore ?? 0}+</span>
						</div>
					</div>
				</FilterSection>

				{/* Date Range */}
				<FilterSection
					title="Date Range"
					isExpanded={expandedSections.has("dateRange")}
					onToggle={() => toggleSection("dateRange")}
					count={filters.dateRange ? 1 : 0}
				>
					<div className="space-y-2">
						<div>
							<label className="text-xs text-gray-500">From</label>
							<input
								type="date"
								value={filters.dateRange?.start ?? ""}
								onChange={(e) =>
									onChange({
										...filters,
										dateRange: e.target.value
											? { start: e.target.value, end: filters.dateRange?.end ?? "" }
											: undefined,
									})
								}
								className="w-full px-2 py-1 text-sm border rounded"
							/>
						</div>
						<div>
							<label className="text-xs text-gray-500">To</label>
							<input
								type="date"
								value={filters.dateRange?.end ?? ""}
								onChange={(e) =>
									onChange({
										...filters,
										dateRange: e.target.value
											? { start: filters.dateRange?.start ?? "", end: e.target.value }
											: undefined,
									})
								}
								className="w-full px-2 py-1 text-sm border rounded"
							/>
						</div>
					</div>
				</FilterSection>

				{/* Search In */}
				<FilterSection
					title="Search In"
					isExpanded={expandedSections.has("searchIn")}
					onToggle={() => toggleSection("searchIn")}
					count={filters.searchIn.length < 4 ? filters.searchIn.length : 0}
				>
					<div className="flex flex-wrap gap-2">
						{SEARCH_IN_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								onClick={() => toggleArrayFilter("searchIn", opt.value)}
								className={cn(
									"px-2 py-1 rounded text-xs transition-colors",
									filters.searchIn.includes(opt.value)
										? "bg-blue-100 text-blue-700"
										: "bg-gray-100 text-gray-600 hover:bg-gray-200"
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</FilterSection>
			</div>
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface FilterSectionProps {
	title: string;
	icon?: React.ReactNode;
	isExpanded: boolean;
	onToggle: () => void;
	count?: number;
	children: React.ReactNode;
}

function FilterSection({
	title,
	icon,
	isExpanded,
	onToggle,
	count,
	children,
}: FilterSectionProps) {
	return (
		<div className="border-b pb-3 last:border-b-0 last:pb-0">
			<button
				onClick={onToggle}
				className="w-full flex items-center justify-between py-1 hover:bg-gray-50 rounded"
			>
				<div className="flex items-center gap-2">
					{isExpanded ? (
						<ChevronDown className="w-4 h-4 text-gray-400" />
					) : (
						<ChevronRight className="w-4 h-4 text-gray-400" />
					)}
					{icon}
					<span className="text-sm font-medium">{title}</span>
				</div>
				{count !== undefined && count > 0 && (
					<span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
						{count}
					</span>
				)}
			</button>
			{isExpanded && <div className="mt-2 pl-6">{children}</div>}
		</div>
	);
}
