/**
 * Template filters component for DocFusion.
 *
 * Provides filtering controls for the template gallery including
 * category selection, tag filtering, difficulty, and sorting.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
	TemplateCategory,
	TemplateListParams,
	TemplateVisibility,
} from "@/lib/types/template";
import {
	useTemplateCategories,
	buildCategoryTree,
	type CategoryTreeNode,
} from "@/lib/query/hooks/useTemplates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
	Search,
	SlidersHorizontal,
	ChevronDown,
	X,
	FolderTree,
	Tag,
	BarChart3,
	ArrowUpDown,
	Grid,
	List,
	LayoutGrid,
	Check,
	type LucideIcon,
} from "lucide-react";

/**
 * Props for TemplateFilters component.
 */
export interface TemplateFiltersProps {
	/** Current filter parameters */
	filters: TemplateListParams;
	/** Callback when filters change */
	onFiltersChange: (filters: TemplateListParams) => void;
	/** Current view mode */
	viewMode?: "grid" | "list";
	/** Callback when view mode changes */
	onViewModeChange?: (mode: "grid" | "list") => void;
	/** Available tags for filtering (from aggregated data) */
	availableTags?: string[];
	/** Whether to show the view mode toggle */
	showViewToggle?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Sort option configuration.
 */
interface SortOption {
	value: TemplateListParams["sortBy"];
	label: string;
	icon: LucideIcon;
}

const sortOptions: SortOption[] = [
	{ value: "createdAt", label: "Newest", icon: BarChart3 },
	{ value: "updatedAt", label: "Recently Updated", icon: BarChart3 },
	{ value: "name", label: "Name", icon: BarChart3 },
	{ value: "useCount", label: "Most Used", icon: BarChart3 },
	{ value: "rating", label: "Highest Rated", icon: BarChart3 },
];

/**
 * Difficulty options.
 */
const difficultyOptions = [
	{ value: "beginner", label: "Beginner", color: "text-green-600" },
	{ value: "intermediate", label: "Intermediate", color: "text-amber-600" },
	{ value: "advanced", label: "Advanced", color: "text-red-600" },
] as const;

/**
 * Visibility options.
 */
const visibilityOptions: { value: TemplateVisibility; label: string }[] = [
	{ value: "public", label: "Public" },
	{ value: "organization", label: "Organization" },
	{ value: "team", label: "Team" },
	{ value: "private", label: "Private" },
];

/**
 * Main template filters component.
 */
export function TemplateFilters({
	filters,
	onFiltersChange,
	viewMode = "grid",
	onViewModeChange,
	availableTags = [],
	showViewToggle = true,
	className,
}: TemplateFiltersProps) {
	const { data: categories = [] } = useTemplateCategories();
	const categoryTree = React.useMemo(
		() => buildCategoryTree(categories),
		[categories]
	);

	// Local search state with debounce
	const [searchInput, setSearchInput] = React.useState(filters.search ?? "");
	const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	// Debounced search update
	React.useEffect(() => {
		searchTimeoutRef.current = setTimeout(() => {
			if (searchInput !== filters.search) {
				onFiltersChange({ ...filters, search: searchInput || undefined });
			}
		}, 300);

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [searchInput, filters, onFiltersChange]);

	// Count active filters
	const activeFilterCount = [
		filters.categoryId,
		filters.difficulty,
		filters.visibility,
		filters.tags?.length,
	].filter(Boolean).length;

	// Update single filter
	const updateFilter = <K extends keyof TemplateListParams>(
		key: K,
		value: TemplateListParams[K]
	) => {
		onFiltersChange({ ...filters, [key]: value });
	};

	// Clear all filters
	const clearFilters = () => {
		setSearchInput("");
		onFiltersChange({});
	};

	// Get selected category name
	const selectedCategory = categories.find((c) => c.id === filters.categoryId);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Search and controls row */}
			<div className="flex items-center gap-3">
				{/* Search input */}
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
					<Input
						type="search"
						placeholder="Search templates..."
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						className="pl-9 pr-9"
					/>
					{searchInput && (
						<button
							type="button"
							onClick={() => setSearchInput("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Category dropdown */}
				<CategoryDropdown
					categories={categoryTree}
					selectedId={filters.categoryId}
					onSelect={(id) => updateFilter("categoryId", id)}
				/>

				{/* Filters dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="gap-2">
							<SlidersHorizontal className="h-4 w-4" />
							Filters
							{activeFilterCount > 0 && (
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
									{activeFilterCount}
								</span>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuLabel>Difficulty</DropdownMenuLabel>
						{difficultyOptions.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={filters.difficulty === option.value}
								onCheckedChange={(checked) =>
									updateFilter("difficulty", checked ? option.value : undefined)
								}
							>
								<span className={option.color}>{option.label}</span>
							</DropdownMenuCheckboxItem>
						))}

						<DropdownMenuSeparator />

						<DropdownMenuLabel>Visibility</DropdownMenuLabel>
						{visibilityOptions.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={filters.visibility === option.value}
								onCheckedChange={(checked) =>
									updateFilter("visibility", checked ? option.value : undefined)
								}
							>
								{option.label}
							</DropdownMenuCheckboxItem>
						))}

						{availableTags.length > 0 && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Tags</DropdownMenuLabel>
								{availableTags.slice(0, 10).map((tag) => (
									<DropdownMenuCheckboxItem
										key={tag}
										checked={filters.tags?.includes(tag)}
										onCheckedChange={(checked) => {
											const currentTags = filters.tags ?? [];
											const newTags = checked
												? [...currentTags, tag]
												: currentTags.filter((t) => t !== tag);
											updateFilter("tags", newTags.length > 0 ? newTags : undefined);
										}}
									>
										{tag}
									</DropdownMenuCheckboxItem>
								))}
							</>
						)}

						{activeFilterCount > 0 && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={clearFilters}>
									<X className="h-4 w-4 mr-2" />
									Clear all filters
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Sort dropdown */}
				<SortDropdown
					sortBy={filters.sortBy}
					sortOrder={filters.sortOrder}
					onChange={(sortBy, sortOrder) =>
						onFiltersChange({ ...filters, sortBy, sortOrder })
					}
				/>

				{/* View mode toggle */}
				{showViewToggle && onViewModeChange && (
					<div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
						<button
							type="button"
							onClick={() => onViewModeChange("grid")}
							className={cn(
								"p-2 rounded-l-lg transition-colors",
								viewMode === "grid"
									? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
									: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							)}
							aria-label="Grid view"
						>
							<LayoutGrid className="h-4 w-4" />
						</button>
						<button
							type="button"
							onClick={() => onViewModeChange("list")}
							className={cn(
								"p-2 rounded-r-lg transition-colors",
								viewMode === "list"
									? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
									: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							)}
							aria-label="List view"
						>
							<List className="h-4 w-4" />
						</button>
					</div>
				)}
			</div>

			{/* Active filters display */}
			{(activeFilterCount > 0 || filters.search) && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Active filters:
					</span>

					{filters.search && (
						<FilterChip
							label={`Search: "${filters.search}"`}
							onRemove={() => {
								setSearchInput("");
								updateFilter("search", undefined);
							}}
						/>
					)}

					{selectedCategory && (
						<FilterChip
							label={`Category: ${selectedCategory.name}`}
							onRemove={() => updateFilter("categoryId", undefined)}
						/>
					)}

					{filters.difficulty && (
						<FilterChip
							label={`Difficulty: ${filters.difficulty}`}
							onRemove={() => updateFilter("difficulty", undefined)}
						/>
					)}

					{filters.visibility && (
						<FilterChip
							label={`Visibility: ${filters.visibility}`}
							onRemove={() => updateFilter("visibility", undefined)}
						/>
					)}

					{filters.tags?.map((tag) => (
						<FilterChip
							key={tag}
							label={`Tag: ${tag}`}
							onRemove={() => {
								const newTags = filters.tags?.filter((t) => t !== tag);
								updateFilter("tags", newTags?.length ? newTags : undefined);
							}}
						/>
					))}

					<button
						type="button"
						onClick={clearFilters}
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
					>
						Clear all
					</button>
				</div>
			)}
		</div>
	);
}

/**
 * Category dropdown with tree structure.
 */
function CategoryDropdown({
	categories,
	selectedId,
	onSelect,
}: {
	categories: CategoryTreeNode[];
	selectedId?: string;
	onSelect: (id: string | undefined) => void;
}) {
	const flatCategories = React.useMemo(() => {
		const flat: TemplateCategory[] = [];
		const traverse = (items: CategoryTreeNode[], depth = 0) => {
			for (const item of items) {
				flat.push({ ...item, name: "  ".repeat(depth) + item.name });
				if (item.children.length > 0) {
					traverse(item.children, depth + 1);
				}
			}
		};
		traverse(categories);
		return flat;
	}, [categories]);

	const selectedCategory = flatCategories.find((c) => c.id === selectedId);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-2 min-w-[140px] justify-between">
					<div className="flex items-center gap-2">
						<FolderTree className="h-4 w-4" />
						<span className="truncate">
							{selectedCategory?.name.trim() ?? "All Categories"}
						</span>
					</div>
					<ChevronDown className="h-4 w-4 flex-shrink-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
				<DropdownMenuItem onClick={() => onSelect(undefined)}>
					<span className={cn(!selectedId && "font-medium")}>All Categories</span>
					{!selectedId && <Check className="h-4 w-4 ml-auto" />}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{flatCategories.map((category) => (
					<DropdownMenuItem
						key={category.id}
						onClick={() => onSelect(category.id)}
					>
						<span
							className={cn(
								"flex-1",
								category.id === selectedId && "font-medium"
							)}
						>
							{category.name}
						</span>
						<span className="text-xs text-gray-400 ml-2">
							{category.templateCount}
						</span>
						{category.id === selectedId && (
							<Check className="h-4 w-4 ml-2" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Sort dropdown component.
 */
function SortDropdown({
	sortBy,
	sortOrder,
	onChange,
}: {
	sortBy?: TemplateListParams["sortBy"];
	sortOrder?: TemplateListParams["sortOrder"];
	onChange: (
		sortBy: TemplateListParams["sortBy"],
		sortOrder: TemplateListParams["sortOrder"]
	) => void;
}) {
	const currentOption = sortOptions.find((o) => o.value === sortBy) ?? sortOptions[0];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-2">
					<ArrowUpDown className="h-4 w-4" />
					{currentOption.label}
					{sortOrder === "asc" && <span className="text-xs">(A-Z)</span>}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={sortBy ?? "createdAt"}
					onValueChange={(value) =>
						onChange(value as TemplateListParams["sortBy"], sortOrder)
					}
				>
					{sortOptions.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value!}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>

				<DropdownMenuSeparator />

				<DropdownMenuLabel>Order</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={sortOrder ?? "desc"}
					onValueChange={(value) =>
						onChange(sortBy, value as TemplateListParams["sortOrder"])
					}
				>
					<DropdownMenuRadioItem value="desc">
						Descending (newest first)
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="asc">
						Ascending (oldest first)
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Filter chip component for displaying active filters.
 */
function FilterChip({
	label,
	onRemove,
}: {
	label: string;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm">
			{label}
			<button
				type="button"
				onClick={onRemove}
				className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5"
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}

/**
 * Sidebar filter panel for template gallery.
 */
export function TemplateSidebarFilters({
	filters,
	onFiltersChange,
	className,
}: {
	filters: TemplateListParams;
	onFiltersChange: (filters: TemplateListParams) => void;
	className?: string;
}) {
	const { data: categories = [] } = useTemplateCategories();
	const categoryTree = React.useMemo(
		() => buildCategoryTree(categories),
		[categories]
	);

	const updateFilter = <K extends keyof TemplateListParams>(
		key: K,
		value: TemplateListParams[K]
	) => {
		onFiltersChange({ ...filters, [key]: value });
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Categories */}
			<div>
				<h3 className="font-semibold text-gray-900 dark:text-white mb-3">
					Categories
				</h3>
				<CategoryTree
					categories={categoryTree}
					selectedId={filters.categoryId}
					onSelect={(id) => updateFilter("categoryId", id)}
				/>
			</div>

			{/* Difficulty */}
			<div>
				<h3 className="font-semibold text-gray-900 dark:text-white mb-3">
					Difficulty
				</h3>
				<div className="space-y-2">
					{difficultyOptions.map((option) => (
						<label
							key={option.value}
							className="flex items-center gap-2 cursor-pointer"
						>
							<input
								type="checkbox"
								checked={filters.difficulty === option.value}
								onChange={(e) =>
									updateFilter(
										"difficulty",
										e.target.checked ? option.value : undefined
									)
								}
								className="rounded border-gray-300 dark:border-gray-600"
							/>
							<span className={cn("text-sm", option.color)}>
								{option.label}
							</span>
						</label>
					))}
				</div>
			</div>

			{/* Visibility */}
			<div>
				<h3 className="font-semibold text-gray-900 dark:text-white mb-3">
					Visibility
				</h3>
				<div className="space-y-2">
					{visibilityOptions.map((option) => (
						<label
							key={option.value}
							className="flex items-center gap-2 cursor-pointer"
						>
							<input
								type="checkbox"
								checked={filters.visibility === option.value}
								onChange={(e) =>
									updateFilter(
										"visibility",
										e.target.checked ? option.value : undefined
									)
								}
								className="rounded border-gray-300 dark:border-gray-600"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								{option.label}
							</span>
						</label>
					))}
				</div>
			</div>
		</div>
	);
}

/**
 * Category tree component for sidebar.
 */
function CategoryTree({
	categories,
	selectedId,
	onSelect,
	depth = 0,
}: {
	categories: CategoryTreeNode[];
	selectedId?: string;
	onSelect: (id: string | undefined) => void;
	depth?: number;
}) {
	return (
		<ul className={cn("space-y-1", depth > 0 && "ml-4 mt-1")}>
			{depth === 0 && (
				<li>
					<button
						type="button"
						onClick={() => onSelect(undefined)}
						className={cn(
							"w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors",
							!selectedId
								? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
								: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
						)}
					>
						All Templates
					</button>
				</li>
			)}
			{categories.map((category) => (
				<li key={category.id}>
					<button
						type="button"
						onClick={() => onSelect(category.id)}
						className={cn(
							"w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between",
							category.id === selectedId
								? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
								: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
						)}
					>
						<span>{category.name}</span>
						<span className="text-xs text-gray-400">
							{category.templateCount}
						</span>
					</button>
					{category.children.length > 0 && (
						<CategoryTree
							categories={category.children}
							selectedId={selectedId}
							onSelect={onSelect}
							depth={depth + 1}
						/>
					)}
				</li>
			))}
		</ul>
	);
}
