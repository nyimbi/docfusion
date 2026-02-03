"use client";

/**
 * Content Library Browser Component
 *
 * Main browsing interface for the semantic content library with
 * search, filtering, and analytics display.
 */

import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Search,
	Filter,
	SortAsc,
	SortDesc,
	Plus,
	RefreshCw,
	LayoutGrid,
	List,
	Sparkles,
	TrendingUp,
	Clock,
	AlertTriangle,
	BookMarked,
	FolderOpen,
} from "lucide-react";
import { ContentSnippetCard, type ContentSnippet } from "./ContentSnippetCard";
import { useToast } from "@/lib/hooks/use-toast";
import type { ContentType, FreshnessStatus } from "@/lib/db/schema-content-library";
import { generateContentSuggestions } from "@/lib/actions/content-library";

// ============================================================================
// Types
// ============================================================================

interface ContentLibraryBrowserProps {
	/** Initial snippets (if already loaded) */
	initialSnippets?: ContentSnippet[];
	/** Callback when snippet is selected for insertion */
	onInsertSnippet?: (snippet: ContentSnippet) => void;
	/** Callback to create new snippet */
	onCreateSnippet?: () => void;
	/** Callback when snippet is edited */
	onEditSnippet?: (id: string) => void;
	/** Document ID for context (enables AI suggestions) */
	documentId?: string;
	/** Custom class name */
	className?: string;
}

type SortField = "name" | "winRate" | "qualityScore" | "lastUsedAt" | "updatedAt" | "wordCount";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";
type TabValue = "all" | "starred" | "recent" | "stale" | "suggestions";

interface FilterState {
	search: string;
	contentType: ContentType | "";
	freshnessStatus: FreshnessStatus | "";
	category: string;
	minWinRate: number | null;
	minQualityScore: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const CONTENT_TYPES: ContentType[] = [
	"boilerplate",
	"capability",
	"past_performance",
	"solution",
	"approach",
	"bio",
	"methodology",
	"executive_summary",
	"management_approach",
	"technical_approach",
	"staffing",
	"quality_assurance",
	"risk_management",
	"transition",
	"other",
];

const FRESHNESS_STATUSES: FreshnessStatus[] = [
	"current",
	"review_needed",
	"stale",
	"archived",
];

// ============================================================================
// Component
// ============================================================================

export function ContentLibraryBrowser({
	initialSnippets = [],
	onInsertSnippet,
	onCreateSnippet,
	onEditSnippet,
	documentId,
	className,
}: ContentLibraryBrowserProps) {
	const { toast } = useToast();
	const [snippets, setSnippets] = useState<ContentSnippet[]>(initialSnippets);
	const [isLoading, setIsLoading] = useState(!initialSnippets.length);
	const [error, setError] = useState<string | null>(null);

	// View state
	const [activeTab, setActiveTab] = useState<TabValue>("all");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [sortField, setSortField] = useState<SortField>("lastUsedAt");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
	const [showFilters, setShowFilters] = useState(false);

	// Filter state
	const [filters, setFilters] = useState<FilterState>({
		search: "",
		contentType: "",
		freshnessStatus: "",
		category: "",
		minWinRate: null,
		minQualityScore: null,
	});

	// Selection state
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

	// AI suggestions state
	const [suggestions, setSuggestions] = useState<ContentSnippet[]>([]);
	const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
	const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
	const [hasFetchedSuggestions, setHasFetchedSuggestions] = useState(false);

	// Fetch AI suggestions for the document
	const fetchSuggestions = useCallback(async () => {
		if (!documentId) return;

		setIsSuggestionsLoading(true);
		setSuggestionsError(null);

		try {
			// Get document context for better suggestions
			const docResponse = await fetch(`/api/v1/documents/${documentId}`);
			let contextText = "";
			let opportunityId: string | undefined;

			if (docResponse.ok) {
				const docData = await docResponse.json();
				// Use document title, description, or content as context
				contextText = [
					docData.title,
					docData.description,
					typeof docData.content === "string" ? docData.content.slice(0, 2000) : "",
				].filter(Boolean).join(". ");
				opportunityId = docData.opportunityId;
			}

			// If no document context, use a generic prompt
			if (!contextText) {
				contextText = "General proposal content for government contracting";
			}

			// Generate AI suggestions
			const suggestionRows = await generateContentSuggestions({
				documentId,
				opportunityId,
				contextText,
				limit: 10,
			});

			// If we got suggestion rows with snippetIds, fetch the full snippet data
			if (suggestionRows.length > 0) {
				const snippetIds = suggestionRows
					.map(s => s.snippetId)
					.filter((id): id is string => id !== null);

				if (snippetIds.length > 0) {
					// Fetch full snippet data
					const snippetsResponse = await fetch("/api/v1/content/snippets?" + new URLSearchParams({
						ids: snippetIds.join(","),
					}));

					if (snippetsResponse.ok) {
						const snippetsData = await snippetsResponse.json();
						// Sort by relevance score from suggestions
						const snippetMap = new Map(snippetsData.snippets.map((s: ContentSnippet) => [s.id, s]));
						const sortedSuggestions = suggestionRows
							.map(row => snippetMap.get(row.snippetId))
							.filter((s): s is ContentSnippet => s !== undefined);
						setSuggestions(sortedSuggestions);
					} else {
						// Fallback: use basic search results
						setSuggestions([]);
					}
				} else {
					setSuggestions([]);
				}
			} else {
				// No AI suggestions, try semantic search fallback
				const searchResponse = await fetch("/api/v1/content/search?" + new URLSearchParams({
					query: contextText.slice(0, 500),
					limit: "10",
				}));

				if (searchResponse.ok) {
					const searchData = await searchResponse.json();
					setSuggestions(searchData.snippets || []);
				} else {
					setSuggestions([]);
				}
			}

			setHasFetchedSuggestions(true);
		} catch (err) {
			console.error("Failed to fetch AI suggestions:", err);
			setSuggestionsError(err instanceof Error ? err.message : "Failed to load suggestions");
			setSuggestions([]);
		} finally {
			setIsSuggestionsLoading(false);
		}
	}, [documentId]);

	// Fetch suggestions when tab is selected (lazy loading)
	React.useEffect(() => {
		if (activeTab === "suggestions" && documentId && !hasFetchedSuggestions && !isSuggestionsLoading) {
			fetchSuggestions();
		}
	}, [activeTab, documentId, hasFetchedSuggestions, isSuggestionsLoading, fetchSuggestions]);

	// Reset suggestions when documentId changes
	React.useEffect(() => {
		setHasFetchedSuggestions(false);
		setSuggestions([]);
		setSuggestionsError(null);
	}, [documentId]);

	// Fetch snippets
	const fetchSnippets = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/v1/content/snippets");
			if (!response.ok) {
				throw new Error("Failed to fetch content library");
			}
			const data = await response.json();
			setSnippets(data.snippets);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load content");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load snippets on mount
	React.useEffect(() => {
		if (!initialSnippets.length) {
			fetchSnippets();
		}
	}, [initialSnippets.length, fetchSnippets]);

	// Filter snippets by tab
	const tabFilteredSnippets = useMemo(() => {
		switch (activeTab) {
			case "starred":
				return snippets.filter((s) => bookmarkedIds.has(s.id));
			case "recent":
				const oneWeekAgo = new Date();
				oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
				return snippets.filter(
					(s) => s.lastUsedAt && new Date(s.lastUsedAt) > oneWeekAgo
				);
			case "stale":
				return snippets.filter(
					(s) => s.freshnessStatus === "stale" || s.freshnessStatus === "review_needed"
				);
			case "suggestions":
				return suggestions;
			default:
				return snippets;
		}
	}, [snippets, suggestions, activeTab, bookmarkedIds]);

	// Apply filters
	const filteredSnippets = useMemo(() => {
		return tabFilteredSnippets.filter((snippet) => {
			// Search filter
			if (filters.search) {
				const searchLower = filters.search.toLowerCase();
				const matchesSearch =
					snippet.name.toLowerCase().includes(searchLower) ||
					snippet.content.toLowerCase().includes(searchLower) ||
					snippet.description?.toLowerCase().includes(searchLower) ||
					snippet.tags.some((t) => t.toLowerCase().includes(searchLower)) ||
					snippet.aiTags.some((t) => t.toLowerCase().includes(searchLower)) ||
					snippet.keyTerms.some((t) => t.toLowerCase().includes(searchLower));
				if (!matchesSearch) return false;
			}

			// Content type filter
			if (filters.contentType && snippet.contentType !== filters.contentType) {
				return false;
			}

			// Freshness filter
			if (filters.freshnessStatus && snippet.freshnessStatus !== filters.freshnessStatus) {
				return false;
			}

			// Category filter
			if (filters.category && snippet.category !== filters.category) {
				return false;
			}

			// Win rate filter
			if (
				filters.minWinRate !== null &&
				(snippet.winRate === null || snippet.winRate < filters.minWinRate)
			) {
				return false;
			}

			// Quality score filter
			if (
				filters.minQualityScore !== null &&
				(snippet.qualityScore === null || snippet.qualityScore < filters.minQualityScore)
			) {
				return false;
			}

			return true;
		});
	}, [tabFilteredSnippets, filters]);

	// Sort snippets
	const sortedSnippets = useMemo(() => {
		return [...filteredSnippets].sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "name":
					comparison = a.name.localeCompare(b.name);
					break;
				case "winRate":
					comparison = (a.winRate ?? -1) - (b.winRate ?? -1);
					break;
				case "qualityScore":
					comparison = (a.qualityScore ?? -1) - (b.qualityScore ?? -1);
					break;
				case "lastUsedAt": {
					const dateA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
					const dateB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
					comparison = dateA - dateB;
					break;
				}
				case "updatedAt": {
					const dateA = new Date(a.updatedAt).getTime();
					const dateB = new Date(b.updatedAt).getTime();
					comparison = dateA - dateB;
					break;
				}
				case "wordCount":
					comparison = a.wordCount - b.wordCount;
					break;
			}

			return sortOrder === "asc" ? comparison : -comparison;
		});
	}, [filteredSnippets, sortField, sortOrder]);

	// Get unique categories
	const categories = useMemo(() => {
		const cats = new Set<string>();
		snippets.forEach((s) => {
			if (s.category) cats.add(s.category);
		});
		return Array.from(cats).sort();
	}, [snippets]);

	// Handlers
	const handleCopy = useCallback((id: string) => {
		const snippet = snippets.find((s) => s.id === id);
		if (snippet) {
			navigator.clipboard.writeText(snippet.content);
			toast("Content copied to clipboard", { variant: "success" });
		}
	}, [snippets, toast]);

	const handleBookmark = useCallback((id: string, bookmarked: boolean) => {
		setBookmarkedIds((prev) => {
			const next = new Set(prev);
			if (bookmarked) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}, []);

	const handleInsert = useCallback((id: string) => {
		const snippet = snippets.find((s) => s.id === id);
		if (snippet && onInsertSnippet) {
			onInsertSnippet(snippet);
		}
	}, [snippets, onInsertSnippet]);

	// Clear filters
	const clearFilters = useCallback(() => {
		setFilters({
			search: "",
			contentType: "",
			freshnessStatus: "",
			category: "",
			minWinRate: null,
			minQualityScore: null,
		});
	}, []);

	// Count active filters
	const activeFilterCount = useMemo(() => {
		let count = 0;
		if (filters.search) count++;
		if (filters.contentType) count++;
		if (filters.freshnessStatus) count++;
		if (filters.category) count++;
		if (filters.minWinRate !== null) count++;
		if (filters.minQualityScore !== null) count++;
		return count;
	}, [filters]);

	// Calculate stats
	const stats = useMemo(() => {
		const total = snippets.length;
		const stale = snippets.filter(
			(s) => s.freshnessStatus === "stale" || s.freshnessStatus === "review_needed"
		).length;
		const highPerformers = snippets.filter(
			(s) => s.winRate !== null && s.winRate >= 70
		).length;

		return { total, stale, highPerformers };
	}, [snippets]);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<FolderOpen className="h-5 w-5" />
							Content Library
						</CardTitle>
						<CardDescription className="flex items-center gap-4 mt-1">
							<span>{stats.total} snippets</span>
							<span className="flex items-center gap-1 text-green-600">
								<TrendingUp className="h-3 w-3" />
								{stats.highPerformers} high performers
							</span>
							{stats.stale > 0 && (
								<span className="flex items-center gap-1 text-yellow-600">
									<AlertTriangle className="h-3 w-3" />
									{stats.stale} need review
								</span>
							)}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={fetchSnippets}
							disabled={isLoading}
						>
							<RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
							Refresh
						</Button>
						{onCreateSnippet && (
							<Button size="sm" onClick={onCreateSnippet}>
								<Plus className="h-4 w-4 mr-2" />
								New Snippet
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Tabs */}
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
					<TabsList>
						<TabsTrigger value="all">
							All
						</TabsTrigger>
						<TabsTrigger value="starred" className="gap-1">
							<BookMarked className="h-3 w-3" />
							Starred
							{bookmarkedIds.size > 0 && (
								<Badge variant="secondary" className="ml-1 h-5 px-1.5">
									{bookmarkedIds.size}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="recent" className="gap-1">
							<Clock className="h-3 w-3" />
							Recent
						</TabsTrigger>
						<TabsTrigger value="stale" className="gap-1">
							<AlertTriangle className="h-3 w-3" />
							Needs Review
							{stats.stale > 0 && (
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-yellow-100 text-yellow-700">
									{stats.stale}
								</Badge>
							)}
						</TabsTrigger>
						{documentId && (
							<TabsTrigger value="suggestions" className="gap-1">
								<Sparkles className="h-3 w-3" />
								AI Suggestions
								{isSuggestionsLoading && (
									<RefreshCw className="h-3 w-3 ml-1 animate-spin" />
								)}
								{suggestions.length > 0 && !isSuggestionsLoading && (
									<Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-purple-100 text-purple-700">
										{suggestions.length}
									</Badge>
								)}
							</TabsTrigger>
						)}
					</TabsList>
				</Tabs>

				{/* Toolbar */}
				<div className="flex items-center gap-2 flex-wrap">
					{/* Search */}
					<div className="relative flex-1 min-w-[200px] max-w-md">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={filters.search}
							onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
							placeholder="Search content, tags, key terms..."
							className="pl-9"
						/>
					</div>

					{/* Filter toggle */}
					<Button
						variant={showFilters ? "secondary" : "outline"}
						size="sm"
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className="h-4 w-4 mr-2" />
						Filters
						{activeFilterCount > 0 && (
							<Badge variant="secondary" className="ml-2">
								{activeFilterCount}
							</Badge>
						)}
					</Button>

					{/* Sort */}
					<Select
						value={sortField}
						onValueChange={(value) => setSortField(value as SortField)}
					>
						<SelectTrigger className="w-[150px]">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="lastUsedAt">Last Used</SelectItem>
							<SelectItem value="updatedAt">Last Updated</SelectItem>
							<SelectItem value="winRate">Win Rate</SelectItem>
							<SelectItem value="qualityScore">Quality Score</SelectItem>
							<SelectItem value="name">Name</SelectItem>
							<SelectItem value="wordCount">Word Count</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
					>
						{sortOrder === "asc" ? (
							<SortAsc className="h-4 w-4" />
						) : (
							<SortDesc className="h-4 w-4" />
						)}
					</Button>

					{/* View mode */}
					<div className="flex items-center border rounded-md">
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-r-none"
							onClick={() => setViewMode("grid")}
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === "list" ? "secondary" : "ghost"}
							size="icon"
							className="rounded-l-none"
							onClick={() => setViewMode("list")}
						>
							<List className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Filter panel */}
				{showFilters && (
					<div className="p-4 border rounded-lg bg-muted/30 space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-medium">Filters</h4>
							<Button variant="ghost" size="sm" onClick={clearFilters}>
								Clear all
							</Button>
						</div>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{/* Content type */}
							<div className="space-y-2">
								<label className="text-xs font-medium text-muted-foreground">
									Content Type
								</label>
								<Select
									value={filters.contentType}
									onValueChange={(v) =>
										setFilters((prev) => ({ ...prev, contentType: v as ContentType | "" }))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="All types" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All types</SelectItem>
										{CONTENT_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{type.replace("_", " ")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Freshness status */}
							<div className="space-y-2">
								<label className="text-xs font-medium text-muted-foreground">
									Freshness
								</label>
								<Select
									value={filters.freshnessStatus}
									onValueChange={(v) =>
										setFilters((prev) => ({
											...prev,
											freshnessStatus: v as FreshnessStatus | "",
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="All statuses" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All statuses</SelectItem>
										{FRESHNESS_STATUSES.map((status) => (
											<SelectItem key={status} value={status}>
												{status.replace("_", " ")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Category */}
							<div className="space-y-2">
								<label className="text-xs font-medium text-muted-foreground">
									Category
								</label>
								<Select
									value={filters.category}
									onValueChange={(v) =>
										setFilters((prev) => ({ ...prev, category: v }))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="All categories" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">All categories</SelectItem>
										{categories.map((cat) => (
											<SelectItem key={cat} value={cat}>
												{cat}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Min win rate */}
							<div className="space-y-2">
								<label className="text-xs font-medium text-muted-foreground">
									Min Win Rate
								</label>
								<Select
									value={filters.minWinRate?.toString() ?? ""}
									onValueChange={(v) =>
										setFilters((prev) => ({
											...prev,
											minWinRate: v ? parseInt(v) : null,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Any" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Any</SelectItem>
										<SelectItem value="50">50%+</SelectItem>
										<SelectItem value="60">60%+</SelectItem>
										<SelectItem value="70">70%+</SelectItem>
										<SelectItem value="80">80%+</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				)}

				{/* Error state */}
				{error && (
					<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
						{error}
					</div>
				)}

				{/* Suggestions error state */}
				{activeTab === "suggestions" && suggestionsError && (
					<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
						<span>{suggestionsError}</span>
						<Button variant="outline" size="sm" onClick={fetchSuggestions}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</div>
				)}

				{/* Loading state */}
				{(isLoading || (activeTab === "suggestions" && isSuggestionsLoading)) && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
						))}
						{activeTab === "suggestions" && (
							<div className="col-span-full text-center text-sm text-muted-foreground">
								<Sparkles className="h-5 w-5 mx-auto mb-2 animate-pulse text-purple-500" />
								Analyzing document context and finding relevant content...
							</div>
						)}
					</div>
				)}

				{/* Empty state */}
				{!isLoading && !(activeTab === "suggestions" && isSuggestionsLoading) && sortedSnippets.length === 0 && (
					<div className="text-center py-12">
						{activeTab === "suggestions" ? (
							<>
								<Sparkles className="h-12 w-12 mx-auto text-purple-300 mb-4" />
								<p className="text-muted-foreground mb-2">
									{!hasFetchedSuggestions
										? "Click to generate AI-powered content suggestions"
										: "No suggestions available for this document context"}
								</p>
								<p className="text-xs text-muted-foreground mb-4">
									AI analyzes your document to recommend relevant content from your library
								</p>
								<Button onClick={fetchSuggestions} disabled={isSuggestionsLoading}>
									<Sparkles className="h-4 w-4 mr-2" />
									{hasFetchedSuggestions ? "Refresh Suggestions" : "Generate Suggestions"}
								</Button>
							</>
						) : (
							<>
								<FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
								<p className="text-muted-foreground">
									{filteredSnippets.length === 0 && activeFilterCount > 0
										? "No snippets match the current filters"
										: "No content snippets yet"}
								</p>
								{activeFilterCount > 0 && (
									<Button variant="link" onClick={clearFilters} className="mt-2">
										Clear filters
									</Button>
								)}
								{onCreateSnippet && activeFilterCount === 0 && (
									<Button onClick={onCreateSnippet} className="mt-4">
										<Plus className="h-4 w-4 mr-2" />
										Create Your First Snippet
									</Button>
								)}
							</>
						)}
					</div>
				)}

				{/* Suggestions header */}
				{activeTab === "suggestions" && suggestions.length > 0 && !isSuggestionsLoading && (
					<div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
						<div className="flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-purple-600" />
							<span className="text-sm font-medium text-purple-900 dark:text-purple-100">
								AI-Recommended Content
							</span>
							<span className="text-xs text-purple-600 dark:text-purple-400">
								Based on your document context
							</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setHasFetchedSuggestions(false);
								fetchSuggestions();
							}}
							disabled={isSuggestionsLoading}
							className="text-purple-700 hover:text-purple-900 hover:bg-purple-100"
						>
							<RefreshCw className={cn("h-4 w-4 mr-2", isSuggestionsLoading && "animate-spin")} />
							Refresh
						</Button>
					</div>
				)}

				{/* Snippets grid/list */}
				{!isLoading && !(activeTab === "suggestions" && isSuggestionsLoading) && sortedSnippets.length > 0 && (
					<div
						className={cn(
							viewMode === "grid"
								? "grid grid-cols-1 md:grid-cols-2 gap-4"
								: "space-y-3"
						)}
					>
						{sortedSnippets.map((snippet) => (
							<ContentSnippetCard
								key={snippet.id}
								snippet={snippet}
								isSelected={selectedId === snippet.id}
								isBookmarked={bookmarkedIds.has(snippet.id)}
								isExpanded={expandedId === snippet.id}
								onSelect={setSelectedId}
								onExpand={setExpandedId}
								onCopy={handleCopy}
								onEdit={onEditSnippet}
								onInsert={onInsertSnippet ? handleInsert : undefined}
								onBookmark={handleBookmark}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default ContentLibraryBrowser;
