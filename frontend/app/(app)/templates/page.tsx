/**
 * Templates Page - DocFusion
 *
 * "Document Atelier" - A sophisticated template gallery experience
 * inspired by luxury stationery catalogs and editorial design.
 *
 * Features:
 * - Masonry-style gallery with featured specimens
 * - Refined filtering with animated transitions
 * - Editorial typography and vermillion accents
 * - Staggered reveal animations
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type {
	TemplateSummary,
	TemplateCategory,
	TemplateStatus,
	TemplateVisibility,
} from "@/lib/types/template";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UseTemplateWizard } from "@/components/templates/UseTemplateWizard";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import {
	LayoutTemplate,
	Plus,
	Search,
	Star,
	Grid3X3,
	List,
	ChevronDown,
	SlidersHorizontal,
	TrendingUp,
	Clock,
	Bookmark,
	RefreshCw,
	X,
	Sparkles,
	Award,
	Flame,
	ArrowUpDown,
} from "lucide-react";
import {
	getTemplates,
	getTemplateCategories,
	getTemplateStats,
	getAllTemplateTags,
} from "@/lib/actions/templates";

// ============================================================================
// Types
// ============================================================================

type ViewMode = "gallery" | "list";
type SortOption = "popular" | "newest" | "rating" | "name";

interface TemplateFilters {
	search: string;
	categoryId: string | null;
	difficulty: "beginner" | "intermediate" | "advanced" | null;
	visibility: TemplateVisibility | null;
	status: TemplateStatus | null;
	tags: string[];
}

interface TemplateStatsData {
	total: number;
	published: number;
	draft: number;
	archived: number;
	totalUses: number;
	avgRating: number;
	categoriesCount: number;
}

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	accent?: "primary" | "amber" | "emerald" | "violet";
	index?: number;
}

function StatCard({
	icon,
	label,
	value,
	accent = "primary",
	index = 0,
}: StatCardProps) {
	const accentClasses = {
		primary: "text-primary bg-primary/10 border-primary/20",
		amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
		emerald:
			"text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
		violet:
			"text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.1, duration: 0.4 }}
			className="flex items-center gap-3"
		>
			<div
				className={cn(
					"flex items-center justify-center w-10 h-10 rounded-xl border",
					accentClasses[accent]
				)}
			>
				{icon}
			</div>
			<div>
				<div
					className={cn(
						"text-lg font-display font-semibold tabular-nums",
						accent === "primary" ? "text-primary" : accentClasses[accent].split(" ")[0]
					)}
				>
					{value}
				</div>
				<div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
					{label}
				</div>
			</div>
		</motion.div>
	);
}

// ============================================================================
// Category Filter Button
// ============================================================================

interface CategoryButtonProps {
	category: TemplateCategory | { id: null; name: string; templateCount: number };
	isActive: boolean;
	onClick: () => void;
}

function CategoryButton({ category, isActive, onClick }: CategoryButtonProps) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"w-full flex items-center justify-between px-3 py-2.5 rounded-lg",
				"text-sm font-medium transition-all duration-200",
				"group",
				isActive
					? "bg-primary text-primary-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground hover:bg-muted"
			)}
		>
			<span className="truncate">{category.name}</span>
			<span
				className={cn(
					"text-xs tabular-nums px-2 py-0.5 rounded-full transition-colors",
					isActive
						? "bg-primary-foreground/20 text-primary-foreground"
						: "bg-muted text-muted-foreground group-hover:bg-border"
				)}
			>
				{category.templateCount}
			</span>
		</button>
	);
}

// ============================================================================
// Filter Chip Component
// ============================================================================

interface FilterChipProps {
	label: string;
	isActive: boolean;
	onClick: () => void;
	variant?: "default" | "difficulty";
	difficulty?: "beginner" | "intermediate" | "advanced";
}

function FilterChip({
	label,
	isActive,
	onClick,
	variant = "default",
	difficulty,
}: FilterChipProps) {
	const difficultyColors = {
		beginner: isActive
			? "bg-emerald-500 text-white border-emerald-500"
			: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
		intermediate: isActive
			? "bg-amber-500 text-white border-amber-500"
			: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50",
		advanced: isActive
			? "bg-rose-500 text-white border-rose-500"
			: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/50",
	};

	return (
		<button
			onClick={onClick}
			className={cn(
				"px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200",
				variant === "difficulty" && difficulty
					? difficultyColors[difficulty]
					: isActive
					? "bg-primary text-primary-foreground border-primary"
					: "bg-muted text-muted-foreground border-border hover:bg-muted-foreground/10 hover:text-foreground"
			)}
		>
			{label}
		</button>
	);
}

// ============================================================================
// Active Filter Badge
// ============================================================================

interface ActiveFilterBadgeProps {
	label: string;
	onRemove: () => void;
}

function ActiveFilterBadge({ label, onRemove }: ActiveFilterBadgeProps) {
	return (
		<motion.span
			initial={{ scale: 0.8, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			exit={{ scale: 0.8, opacity: 0 }}
			className={cn(
				"inline-flex items-center gap-1 px-2 py-1 rounded-md",
				"text-xs font-medium",
				"bg-primary/10 text-primary border border-primary/20"
			)}
		>
			{label}
			<button
				onClick={onRemove}
				className="p-0.5 rounded-sm hover:bg-primary/20 transition-colors"
			>
				<X className="h-3 w-3" />
			</button>
		</motion.span>
	);
}

// ============================================================================
// Sort Options
// ============================================================================

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
	{ value: "popular", label: "Most Used", icon: <Flame className="h-4 w-4" /> },
	{ value: "newest", label: "Newest", icon: <Clock className="h-4 w-4" /> },
	{ value: "rating", label: "Top Rated", icon: <Star className="h-4 w-4" /> },
	{ value: "name", label: "Name A-Z", icon: <ArrowUpDown className="h-4 w-4" /> },
];

// ============================================================================
// Main Page Component
// ============================================================================

export default function TemplatesPage() {
	const router = useRouter();
	const [viewMode, setViewMode] = React.useState<ViewMode>("gallery");
	const [sortBy, setSortBy] = React.useState<SortOption>("popular");
	const [filters, setFilters] = React.useState<TemplateFilters>({
		search: "",
		categoryId: null,
		difficulty: null,
		visibility: null,
		status: null,
		tags: [],
	});
	const [selectedTemplate, setSelectedTemplate] =
		React.useState<TemplateSummary | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [templates, setTemplates] = React.useState<TemplateSummary[]>([]);
	const [categories, setCategories] = React.useState<TemplateCategory[]>([]);
	const [stats, setStats] = React.useState<TemplateStatsData>({
		total: 0,
		published: 0,
		draft: 0,
		archived: 0,
		totalUses: 0,
		avgRating: 0,
		categoriesCount: 0,
	});
	const [allTags, setAllTags] = React.useState<string[]>([]);
	const [error, setError] = React.useState<string | null>(null);

	// Debounced search
	const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	// Fetch templates from database
	const fetchTemplates = React.useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [templatesResult, categoriesResult, statsResult, tagsResult] =
				await Promise.all([
					getTemplates({
						sortBy,
						filters: {
							search: filters.search || undefined,
							categoryId: filters.categoryId || undefined,
							difficulty: filters.difficulty || undefined,
							visibility: filters.visibility || undefined,
							status: filters.status || undefined,
							tags: filters.tags.length > 0 ? filters.tags : undefined,
						},
						pageSize: 200,
					}),
					getTemplateCategories(),
					getTemplateStats(),
					getAllTemplateTags(),
				]);

			setTemplates(templatesResult.templates);
			setCategories(categoriesResult);
			setStats(statsResult);
			setAllTags(tagsResult);
		} catch (err) {
			console.error("Failed to fetch templates:", err);
			setError("Failed to load templates. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}, [sortBy, filters]);

	// Fetch on mount and when sort/filter changes
	React.useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	// Filtered templates with client-side search for responsiveness
	const filteredTemplates = React.useMemo(() => {
		let result = [...templates];

		if (filters.search) {
			const query = filters.search.toLowerCase();
			result = result.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.description.toLowerCase().includes(query) ||
					t.tags.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		return result;
	}, [templates, filters.search]);

	// Handlers
	const handleUseTemplate = (template: TemplateSummary) => {
		setSelectedTemplate(template);
	};

	const handleCreateTemplate = () => {
		router.push("/templates/new");
	};

	const handleSearchChange = (value: string) => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}
		searchTimeoutRef.current = setTimeout(() => {
			setFilters((f) => ({ ...f, search: value }));
		}, 150);
	};

	const clearFilters = () => {
		setFilters({
			search: "",
			categoryId: null,
			difficulty: null,
			visibility: null,
			status: null,
			tags: [],
		});
	};

	const hasActiveFilters = Boolean(
		filters.categoryId ||
			filters.difficulty ||
			filters.visibility ||
			filters.tags.length > 0
	);

	const activeFiltersCount =
		(filters.categoryId ? 1 : 0) +
		(filters.difficulty ? 1 : 0) +
		(filters.visibility ? 1 : 0) +
		filters.tags.length;

	const currentSort = sortOptions.find((s) => s.value === sortBy);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.4 }}
			className="h-full flex flex-col overflow-hidden bg-background"
		>
			{/* ================================================================
			    Page Header
			    ================================================================ */}
			<motion.header
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="border-b bg-card/50 backdrop-blur-sm flex-shrink-0"
			>
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-8">
					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
						{/* Title Section */}
						<div className="flex items-start gap-4">
							<div className="relative">
								<div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
								<div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
									<LayoutTemplate className="h-7 w-7 text-primary-foreground" />
								</div>
							</div>
							<div>
								<h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
									Template Atelier
								</h1>
								<p className="text-muted-foreground mt-1 max-w-xl leading-relaxed">
									Curated templates with AI-powered placeholders for accelerated
									proposal development.
								</p>
							</div>
						</div>

						{/* Create Button */}
						<Button
							onClick={handleCreateTemplate}
							size="lg"
							className="self-start lg:self-auto gap-2 shadow-lg shadow-primary/20"
						>
							<Plus className="h-5 w-5" />
							<span className="font-semibold">Create Template</span>
						</Button>
					</div>
				</div>
			</motion.header>

			{/* ================================================================
			    Stats Strip
			    ================================================================ */}
			<div className="border-b bg-muted/30 flex-shrink-0">
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-5">
					<div className="flex items-center gap-10 overflow-x-auto scrollbar-none">
						<StatCard
							icon={<LayoutTemplate className="h-5 w-5" />}
							label="Templates"
							value={stats.total}
							accent="primary"
							index={0}
						/>
						<StatCard
							icon={<Bookmark className="h-5 w-5" />}
							label="Categories"
							value={stats.categoriesCount}
							accent="violet"
							index={1}
						/>
						<StatCard
							icon={<TrendingUp className="h-5 w-5" />}
							label="Total Uses"
							value={stats.totalUses.toLocaleString()}
							accent="emerald"
							index={2}
						/>
						<StatCard
							icon={<Star className="h-5 w-5" />}
							label="Avg Rating"
							value={stats.avgRating.toFixed(1)}
							accent="amber"
							index={3}
						/>
					</div>
				</div>
			</div>

			{/* ================================================================
			    Main Content
			    ================================================================ */}
			<div className="flex-1 overflow-y-auto scrollbar-thin">
				<div className="max-w-[1800px] mx-auto px-6 lg:px-10 py-8">
					<div className="flex flex-col lg:flex-row gap-8">
						{/* ============================================================
						    Sidebar Filters
						    ============================================================ */}
						<motion.aside
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
							className="lg:w-72 flex-shrink-0 space-y-8"
						>
							{/* Categories */}
							<div>
								<h3 className="text-sm font-display font-semibold text-foreground mb-4 flex items-center gap-2">
									<Bookmark className="h-4 w-4 text-primary" />
									Categories
								</h3>
								<div className="space-y-1">
									<CategoryButton
										category={{
											id: null,
											name: "All Templates",
											templateCount: stats.total,
										}}
										isActive={!filters.categoryId}
										onClick={() =>
											setFilters((f) => ({ ...f, categoryId: null }))
										}
									/>
									{categories.map((cat) => (
										<CategoryButton
											key={cat.id}
											category={cat}
											isActive={filters.categoryId === cat.id}
											onClick={() =>
												setFilters((f) => ({ ...f, categoryId: cat.id }))
											}
										/>
									))}
								</div>
							</div>

							{/* Difficulty Filter */}
							<div>
								<h3 className="text-sm font-display font-semibold text-foreground mb-4 flex items-center gap-2">
									<Award className="h-4 w-4 text-primary" />
									Difficulty
								</h3>
								<div className="flex flex-wrap gap-2">
									{(
										["beginner", "intermediate", "advanced"] as const
									).map((level) => (
										<FilterChip
											key={level}
											label={
												level === "beginner"
													? "Starter"
													: level === "intermediate"
													? "Standard"
													: "Expert"
											}
											isActive={filters.difficulty === level}
											onClick={() =>
												setFilters((f) => ({
													...f,
													difficulty: f.difficulty === level ? null : level,
												}))
											}
											variant="difficulty"
											difficulty={level}
										/>
									))}
								</div>
							</div>

							{/* Tags Filter */}
							{allTags.length > 0 && (
								<div>
									<h3 className="text-sm font-display font-semibold text-foreground mb-4 flex items-center gap-2">
										<SlidersHorizontal className="h-4 w-4 text-primary" />
										Popular Tags
									</h3>
									<div className="flex flex-wrap gap-2">
										{allTags.slice(0, 12).map((tag) => (
											<FilterChip
												key={tag}
												label={tag}
												isActive={filters.tags.includes(tag)}
												onClick={() =>
													setFilters((f) => ({
														...f,
														tags: f.tags.includes(tag)
															? f.tags.filter((t) => t !== tag)
															: [...f.tags, tag],
													}))
												}
											/>
										))}
									</div>
								</div>
							)}

							{/* Clear Filters */}
							<AnimatePresence>
								{hasActiveFilters && (
									<motion.div
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: "auto" }}
										exit={{ opacity: 0, height: 0 }}
									>
										<button
											onClick={clearFilters}
											className={cn(
												"w-full flex items-center justify-center gap-2 py-2.5 rounded-lg",
												"text-sm font-medium text-primary",
												"bg-primary/5 hover:bg-primary/10 border border-primary/20",
												"transition-colors duration-200"
											)}
										>
											<X className="h-4 w-4" />
											Clear all filters
											<span className="px-1.5 py-0.5 rounded bg-primary/20 text-xs">
												{activeFiltersCount}
											</span>
										</button>
									</motion.div>
								)}
							</AnimatePresence>
						</motion.aside>

						{/* ============================================================
						    Main Content Area
						    ============================================================ */}
						<div className="flex-1 min-w-0">
							{/* Toolbar */}
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
								{/* Search */}
								<div className="relative flex-1 max-w-lg">
									<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<input
										type="search"
										placeholder="Search templates..."
										defaultValue={filters.search}
										onChange={(e) => handleSearchChange(e.target.value)}
										className={cn(
											"w-full h-11 pl-11 pr-4 rounded-xl",
											"bg-card border border-input",
											"text-sm text-foreground placeholder:text-muted-foreground",
											"focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
											"transition-all duration-200"
										)}
									/>
								</div>

								{/* Right Controls */}
								<div className="flex items-center gap-3">
									{/* Sort Dropdown */}
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												className="gap-2 min-w-[140px] justify-between"
											>
												<span className="flex items-center gap-2">
													{currentSort?.icon}
													<span className="hidden sm:inline">
														{currentSort?.label}
													</span>
												</span>
												<ChevronDown className="h-4 w-4 opacity-50" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-48">
											{sortOptions.map((option) => (
												<DropdownMenuItem
													key={option.value}
													onClick={() => setSortBy(option.value)}
													className={cn(
														"gap-2",
														sortBy === option.value && "bg-accent"
													)}
												>
													{option.icon}
													{option.label}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>

									{/* View Toggle */}
									<div className="flex items-center p-1 rounded-lg bg-muted border border-border">
										<button
											onClick={() => setViewMode("gallery")}
											className={cn(
												"p-2.5 rounded-md transition-all duration-200",
												viewMode === "gallery"
													? "bg-card text-foreground shadow-sm"
													: "text-muted-foreground hover:text-foreground"
											)}
											title="Gallery view"
										>
											<Grid3X3 className="h-4 w-4" />
										</button>
										<button
											onClick={() => setViewMode("list")}
											className={cn(
												"p-2.5 rounded-md transition-all duration-200",
												viewMode === "list"
													? "bg-card text-foreground shadow-sm"
													: "text-muted-foreground hover:text-foreground"
											)}
											title="List view"
										>
											<List className="h-4 w-4" />
										</button>
									</div>
								</div>
							</div>

							{/* Active Filters Display */}
							<AnimatePresence>
								{hasActiveFilters && (
									<motion.div
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: "auto" }}
										exit={{ opacity: 0, height: 0 }}
										className="flex flex-wrap items-center gap-2 mb-6"
									>
										<span className="text-xs text-muted-foreground font-medium">
											Active filters:
										</span>
										{filters.categoryId && (
											<ActiveFilterBadge
												label={
													categories.find((c) => c.id === filters.categoryId)
														?.name || "Category"
												}
												onRemove={() =>
													setFilters((f) => ({ ...f, categoryId: null }))
												}
											/>
										)}
										{filters.difficulty && (
											<ActiveFilterBadge
												label={filters.difficulty}
												onRemove={() =>
													setFilters((f) => ({ ...f, difficulty: null }))
												}
											/>
										)}
										{filters.tags.map((tag) => (
											<ActiveFilterBadge
												key={tag}
												label={tag}
												onRemove={() =>
													setFilters((f) => ({
														...f,
														tags: f.tags.filter((t) => t !== tag),
													}))
												}
											/>
										))}
									</motion.div>
								)}
							</AnimatePresence>

							{/* Results Count */}
							<div className="mb-6 flex items-center justify-between">
								<p className="text-sm text-muted-foreground">
									<span className="font-semibold text-foreground">
										{filteredTemplates.length}
									</span>{" "}
									{filteredTemplates.length === 1 ? "template" : "templates"}
									{hasActiveFilters && " matching your filters"}
								</p>
							</div>

							{/* Error State */}
							{error && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									className="flex flex-col items-center justify-center py-16"
								>
									<div className="text-destructive mb-4 text-center">
										{error}
									</div>
									<Button variant="outline" onClick={fetchTemplates}>
										<RefreshCw className="h-4 w-4 mr-2" />
										Try Again
									</Button>
								</motion.div>
							)}

							{/* Template Gallery */}
							{!error && (
								<TemplateGallery
									templates={filteredTemplates}
									categories={categories}
									onUseTemplate={handleUseTemplate}
									isLoading={isLoading}
									viewMode={viewMode}
								/>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* ================================================================
			    Use Template Wizard Dialog
			    ================================================================ */}
			<Dialog
				open={!!selectedTemplate}
				onOpenChange={() => setSelectedTemplate(null)}
			>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-3 font-display">
							<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
								<Sparkles className="h-4 w-4 text-primary" />
							</div>
							{selectedTemplate?.name || "Use Template"}
						</DialogTitle>
						<DialogDescription>
							Create a new document from this template. Fill in the required
							placeholders below.
						</DialogDescription>
					</DialogHeader>
					{selectedTemplate && (
						<UseTemplateWizard
							template={selectedTemplate}
							onComplete={() => setSelectedTemplate(null)}
							onCancel={() => setSelectedTemplate(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</motion.div>
	);
}
