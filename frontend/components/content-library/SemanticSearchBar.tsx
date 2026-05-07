/**
 * SemanticSearchBar Component
 *
 * AI-powered search bar for content library with semantic matching,
 * filters, and search suggestions.
 */

"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Search,
	X,
	Sparkles,
	Clock,
	TrendingUp,
	Filter,
	ChevronDown,
	Tag,
	Folder,
	Sliders,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SearchFilters {
	categories?: string[];
	contentTypes?: string[];
	tags?: string[];
	minWinRate?: number;
	freshnessStatus?: string[];
	dateRange?: { start: string; end: string };
}

interface SearchSuggestion {
	type: "recent" | "trending" | "semantic";
	query: string;
	metadata?: string;
}

interface SemanticSearchBarProps {
	value: string;
	onChange: (value: string) => void;
	onSearch: (query: string, filters: SearchFilters) => void;
	filters: SearchFilters;
	onFiltersChange: (filters: SearchFilters) => void;
	suggestions?: SearchSuggestion[];
	onFetchSuggestions?: (query: string) => Promise<SearchSuggestion[]>;
	categories?: { value: string; label: string }[];
	contentTypes?: { value: string; label: string }[];
	availableTags?: string[];
	placeholder?: string;
	showSemanticIndicator?: boolean;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SemanticSearchBar({
	value,
	onChange,
	onSearch,
	filters,
	onFiltersChange,
	suggestions: initialSuggestions = [],
	onFetchSuggestions,
	categories = [],
	contentTypes = [],
	availableTags = [],
	placeholder = "Search content library...",
	showSemanticIndicator = true,
	className,
}: SemanticSearchBarProps) {
	const [isFocused, setIsFocused] = useState(false);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>(initialSuggestions);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Fetch suggestions on query change
	useEffect(() => {
		if (!onFetchSuggestions || !value.trim()) {
			setSuggestions(initialSuggestions);
			return;
		}

		const timeoutId = setTimeout(async () => {
			setLoadingSuggestions(true);
			try {
				const newSuggestions = await onFetchSuggestions(value);
				setSuggestions(newSuggestions);
			} finally {
				setLoadingSuggestions(false);
			}
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [value, onFetchSuggestions, initialSuggestions]);

	// Handle click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setShowSuggestions(false);
				setShowFilters(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSearch(value, filters);
		setShowSuggestions(false);
	};

	const handleSuggestionClick = (suggestion: SearchSuggestion) => {
		onChange(suggestion.query);
		onSearch(suggestion.query, filters);
		setShowSuggestions(false);
	};

	const handleClear = () => {
		onChange("");
		inputRef.current?.focus();
	};

	const toggleFilter = (
		filterKey: "categories" | "contentTypes" | "tags" | "freshnessStatus",
		value: string
	) => {
		const current = filters[filterKey] ?? [];
		const updated = current.includes(value)
			? current.filter((v) => v !== value)
			: [...current, value];
		onFiltersChange({ ...filters, [filterKey]: updated.length > 0 ? updated : undefined });
	};

	const activeFilterCount = [
		filters.categories?.length ?? 0,
		filters.contentTypes?.length ?? 0,
		filters.tags?.length ?? 0,
		filters.minWinRate ? 1 : 0,
		filters.freshnessStatus?.length ?? 0,
	].reduce((a, b) => a + b, 0);

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			{/* Search Form */}
			<form onSubmit={handleSubmit}>
				<div
					className={cn(
						"flex items-center gap-2 px-4 py-2 bg-white border rounded-lg transition-all",
						isFocused && "ring-2 ring-blue-500 border-blue-500"
					)}
				>
					{showSemanticIndicator ? (
						<Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />
					) : (
						<Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
					)}
					<input
						ref={inputRef}
						type="text"
						value={value}
						onChange={(e) => onChange(e.target.value)}
						onFocus={() => {
							setIsFocused(true);
							setShowSuggestions(true);
						}}
						onBlur={() => setIsFocused(false)}
						placeholder={placeholder}
						className="flex-1 bg-transparent outline-none text-sm"
					/>
					{value && (
						<button
							type="button"
							onClick={handleClear}
							className="p-1 hover:bg-gray-100 rounded"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					)}
					<button
						type="button"
						onClick={() => setShowFilters(!showFilters)}
						className={cn(
							"flex items-center gap-1 px-2 py-1 rounded text-sm",
							showFilters || activeFilterCount > 0
								? "bg-blue-100 text-blue-700"
								: "hover:bg-gray-100 text-gray-600"
						)}
					>
						<Filter className="w-4 h-4" />
						{activeFilterCount > 0 && (
							<span className="text-xs">{activeFilterCount}</span>
						)}
					</button>
					<Button type="submit" variant="primary" size="sm">
						Search
					</Button>
				</div>
			</form>

			{/* Suggestions Dropdown */}
			{showSuggestions && (value || suggestions.length > 0) && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
					{loadingSuggestions ? (
						<div className="p-4 text-center text-gray-500 text-sm">
							<Sparkles className="w-5 h-5 mx-auto mb-2 animate-pulse text-purple-500" />
							Finding relevant content...
						</div>
					) : suggestions.length > 0 ? (
						<>
							{/* Group by type */}
							{["recent", "trending", "semantic"].map((type) => {
								const typeSuggestions = suggestions.filter((s) => s.type === type);
								if (typeSuggestions.length === 0) return null;

								return (
									<div key={type}>
										<div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 flex items-center gap-1">
											{type === "recent" && <Clock className="w-3 h-3" />}
											{type === "trending" && <TrendingUp className="w-3 h-3" />}
											{type === "semantic" && <Sparkles className="w-3 h-3" />}
											{type === "recent"
												? "Recent Searches"
												: type === "trending"
												? "Trending"
												: "Semantic Matches"}
										</div>
										{typeSuggestions.map((suggestion, index) => (
											<button
												key={`${type}-${index}`}
												onClick={() => handleSuggestionClick(suggestion)}
												className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
											>
												<span className="text-sm">{suggestion.query}</span>
												{suggestion.metadata && (
													<span className="text-xs text-gray-500">
														{suggestion.metadata}
													</span>
												)}
											</button>
										))}
									</div>
								);
							})}
						</>
					) : value ? (
						<div className="p-4 text-center text-gray-500 text-sm">
							Press Enter to search for &quot;{value}&quot;
						</div>
					) : null}
				</div>
			)}

			{/* Filters Panel */}
			{showFilters && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 p-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Sliders className="w-5 h-5 text-gray-500" />
							<h3 className="font-medium">Search Filters</h3>
						</div>
						{activeFilterCount > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onFiltersChange({})}
							>
								Clear All
							</Button>
						)}
					</div>

					<div className="space-y-4">
						{/* Categories */}
						{categories.length > 0 && (
							<div>
								<span className="block text-sm font-medium mb-2 flex items-center gap-1">
									<Folder className="w-4 h-4" />
									Categories
								</span>
								<div className="flex flex-wrap gap-2">
									{categories.map((cat) => (
										<button
											key={cat.value}
											onClick={() => toggleFilter("categories", cat.value)}
											className={cn(
												"px-3 py-1 rounded-full text-sm transition-colors",
												filters.categories?.includes(cat.value)
													? "bg-blue-100 text-blue-700"
													: "bg-gray-100 text-gray-600 hover:bg-gray-200"
											)}
										>
											{cat.label}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Content Types */}
						{contentTypes.length > 0 && (
							<div>
								<span className="block text-sm font-medium mb-2">
									Content Types
								</span>
								<div className="flex flex-wrap gap-2">
									{contentTypes.map((type) => (
										<button
											key={type.value}
											onClick={() => toggleFilter("contentTypes", type.value)}
											className={cn(
												"px-3 py-1 rounded-full text-sm transition-colors",
												filters.contentTypes?.includes(type.value)
													? "bg-blue-100 text-blue-700"
													: "bg-gray-100 text-gray-600 hover:bg-gray-200"
											)}
										>
											{type.label}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Tags */}
						{availableTags.length > 0 && (
							<div>
								<span className="block text-sm font-medium mb-2 flex items-center gap-1">
									<Tag className="w-4 h-4" />
									Tags
								</span>
								<div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
									{availableTags.slice(0, 20).map((tag) => (
										<button
											key={tag}
											onClick={() => toggleFilter("tags", tag)}
											className={cn(
												"px-2 py-0.5 rounded text-xs transition-colors",
												filters.tags?.includes(tag)
													? "bg-blue-100 text-blue-700"
													: "bg-gray-100 text-gray-600 hover:bg-gray-200"
											)}
										>
											{tag}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Freshness */}
						<div>
							<span className="block text-sm font-medium mb-2">
								Freshness Status
							</span>
							<div className="flex flex-wrap gap-2">
								{["current", "stale", "needs_review", "expired"].map((status) => (
									<button
										key={status}
										onClick={() => toggleFilter("freshnessStatus", status)}
										className={cn(
											"px-3 py-1 rounded-full text-sm capitalize transition-colors",
											filters.freshnessStatus?.includes(status)
												? "bg-blue-100 text-blue-700"
												: "bg-gray-100 text-gray-600 hover:bg-gray-200"
										)}
									>
										{status.replace(/_/g, " ")}
									</button>
								))}
							</div>
						</div>

						{/* Min Win Rate */}
						<div>
							<span className="block text-sm font-medium mb-2">
								Minimum Win Rate
							</span>
							<input
								type="range"
								min="0"
								max="100"
								step="10"
								value={filters.minWinRate ?? 0}
								onChange={(e) =>
									onFiltersChange({
										...filters,
										minWinRate: parseInt(e.target.value) || undefined,
									})
								}
								className="w-full"
							 aria-label="Minimum Win Rate"/>
							<div className="flex justify-between text-xs text-gray-500">
								<span>Any</span>
								<span>{filters.minWinRate ?? 0}%+</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Active Filters Pills */}
			{activeFilterCount > 0 && !showFilters && (
				<div className="flex flex-wrap gap-2 mt-2">
					{filters.categories?.map((cat) => (
						<span
							key={cat}
							className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
						>
							<Folder className="w-3 h-3" />
							{categories.find((c) => c.value === cat)?.label ?? cat}
							<button onClick={() => toggleFilter("categories", cat)}>
								<X className="w-3 h-3" />
							</button>
						</span>
					))}
					{filters.tags?.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
						>
							<Tag className="w-3 h-3" />
							{tag}
							<button onClick={() => toggleFilter("tags", tag)}>
								<X className="w-3 h-3" />
							</button>
						</span>
					))}
					{filters.minWinRate && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
							Win rate ≥ {filters.minWinRate}%
							<button
								onClick={() => onFiltersChange({ ...filters, minWinRate: undefined })}
							>
								<X className="w-3 h-3" />
							</button>
						</span>
					)}
				</div>
			)}
		</div>
	);
}
