/**
 * EvidencePicker - Inline Evidence Selector
 *
 * Compact evidence picker with search, filtering, quick results,
 * drag-and-drop support, and recently used section.
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
	Search,
	X,
	Clock,
	GripVertical,
	Star,
	Filter,
	ChevronDown,
	ChevronUp,
	FileText,
	BarChart3,
	Quote,
	Briefcase,
	Award,
	Settings2,
	Users,
	Loader2,
	Plus,
	Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type {
	Evidence,
	EvidenceType,
	EvidenceStrengthTier,
} from "@/lib/types/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidencePickerProps {
	/** Callback when evidence is selected */
	onSelect: (evidence: Evidence) => void;
	/** Context text to help with relevance scoring */
	context?: string;
	/** Pre-filter by types */
	allowedTypes?: EvidenceType[];
	/** Pre-filter by minimum strength tier */
	minStrengthTier?: EvidenceStrengthTier;
	/** Enable drag-and-drop mode */
	enableDragDrop?: boolean;
	/** Show recently used section */
	showRecentlyUsed?: boolean;
	/** Maximum number of results to show */
	maxResults?: number;
	/** Placeholder text for search input */
	placeholder?: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TYPE_ICONS: Record<string, typeof FileText> = {
	metric: BarChart3,
	testimonial: Quote,
	case_study: Briefcase,
	certification: Award,
	capability: Settings2,
	past_performance: FileText,
	reference: Users,
	award: Award,
	publication: FileText,
};

const TYPE_LABELS: Record<string, string> = {
	metric: "Metric",
	testimonial: "Testimonial",
	case_study: "Case Study",
	certification: "Certification",
	capability: "Capability",
	past_performance: "Past Perf.",
	reference: "Reference",
	award: "Award",
	publication: "Publication",
};

const TIER_CONFIG: Record<EvidenceStrengthTier, { color: string; label: string }> = {
	gold: { color: "text-yellow-600 bg-yellow-100", label: "Gold" },
	silver: { color: "text-gray-600 bg-gray-100", label: "Silver" },
	bronze: { color: "text-orange-600 bg-orange-100", label: "Bronze" },
};

const ALL_TYPES: EvidenceType[] = [
	"metric",
	"testimonial",
	"case_study",
	"certification",
	"capability",
	"past_performance",
	"reference",
];

// =============================================================================
// Evidence Item Component
// =============================================================================

interface EvidenceItemProps {
	evidence: Evidence;
	onSelect: () => void;
	enableDragDrop?: boolean;
	isSelected?: boolean;
	relevanceScore?: number;
}

function EvidenceItem({
	evidence,
	onSelect,
	enableDragDrop,
	isSelected,
	relevanceScore,
}: EvidenceItemProps) {
	// Use type with fallback chain for backward compatibility
	const evidenceType = evidence.type ?? evidence.evidenceType ?? "capability";
	const Icon = TYPE_ICONS[evidenceType] ?? FileText;
	// Use strengthTier with fallback to bronze
	const strengthTier = evidence.strengthTier ?? "bronze";
	const tierConfig = TIER_CONFIG[strengthTier] ?? TIER_CONFIG.bronze;
	// Use usageCount with fallback to useCount
	const usageCount = evidence.usageCount ?? evidence.useCount ?? 0;

	// Handle drag start
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.setData("application/json", JSON.stringify(evidence));
		e.dataTransfer.effectAllowed = "copy";
	};

	return (
		<div
			className={cn(
				"group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/70 cursor-pointer transition-colors",
				isSelected && "bg-primary/10 border border-primary/30"
			)}
			onClick={onSelect}
			draggable={enableDragDrop}
			onDragStart={handleDragStart}
		>
			{/* Drag handle */}
			{enableDragDrop && (
				<div className="flex items-center h-full pt-1 opacity-0 group-hover:opacity-50 cursor-grab">
					<GripVertical className="h-4 w-4" />
				</div>
			)}

			{/* Icon */}
			<div className="shrink-0 mt-0.5">
				<Icon className="h-4 w-4 text-muted-foreground" />
			</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-0.5">
					<span className="text-sm font-medium truncate">{evidence.title}</span>
					{relevanceScore !== undefined && relevanceScore >= 0.8 && (
						<Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
					)}
				</div>
				<p className="text-xs text-muted-foreground line-clamp-2">
					{evidence.content}
				</p>
				<div className="flex items-center gap-2 mt-1">
					<Badge
						variant="outline"
						className={cn("text-[10px] px-1.5 py-0", tierConfig.color)}
					>
						{tierConfig.label}
					</Badge>
					<Badge variant="outline" className="text-[10px] px-1.5 py-0">
						{TYPE_LABELS[evidenceType] ?? "Unknown"}
					</Badge>
					{usageCount > 0 && (
						<span className="text-[10px] text-muted-foreground">
							Used {usageCount}x
						</span>
					)}
				</div>
			</div>

			{/* Select indicator */}
			{isSelected && (
				<div className="shrink-0">
					<Check className="h-4 w-4 text-primary" />
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function PickerSkeleton() {
	return (
		<div className="space-y-3">
			<Skeleton className="h-9 w-full" />
			<div className="space-y-2">
				{[1, 2, 3].map((i) => (
					<div key={i} className="flex gap-2 p-2">
						<Skeleton className="h-4 w-4 shrink-0" />
						<div className="flex-1 space-y-1">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-full" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidencePicker({
	onSelect,
	context,
	allowedTypes,
	minStrengthTier,
	enableDragDrop = false,
	showRecentlyUsed = true,
	maxResults = 10,
	placeholder = "Search evidence...",
	className,
}: EvidencePickerProps) {
	// State
	const [searchQuery, setSearchQuery] = useState("");
	const [results, setResults] = useState<Evidence[]>([]);
	const [recentlyUsed, setRecentlyUsed] = useState<Evidence[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingRecent, setIsLoadingRecent] = useState(showRecentlyUsed);
	const [selectedTypes, setSelectedTypes] = useState<EvidenceType[]>(
		allowedTypes || ALL_TYPES
	);
	const [showFilters, setShowFilters] = useState(false);
	const [recentlyUsedExpanded, setRecentlyUsedExpanded] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const searchInputRef = useRef<HTMLInputElement>(null);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Focus search input on mount
	useEffect(() => {
		searchInputRef.current?.focus();
	}, []);

	// Load recently used evidence
	useEffect(() => {
		if (!showRecentlyUsed) return;

		async function loadRecentlyUsed() {
			setIsLoadingRecent(true);
			try {
				const { getMostUsedEvidence } = await import("@/lib/actions/evidence");
				const result = await getMostUsedEvidence(5);
				if (result.success && result.data) {
					setRecentlyUsed(result.data.map((r: { evidence: unknown }) => r.evidence as unknown as Evidence));
				}
			} catch (err) {
				console.error("Failed to load recently used evidence:", err);
			}
			setIsLoadingRecent(false);
		}

		loadRecentlyUsed();
	}, [showRecentlyUsed]);

	// Search evidence
	const performSearch = useCallback(
		async (query: string) => {
			if (!query.trim() && !context) {
				setResults([]);
				return;
			}

			setIsLoading(true);
			try {
				const { searchEvidence, listEvidence } = await import("@/lib/actions/evidence");

				let evidenceList: Evidence[];

				if (query.trim()) {
					// Search with query
					const searchFilters = {
						limit: maxResults,
					} as Record<string, unknown>;
					if (selectedTypes.length < ALL_TYPES.length) {
						searchFilters.evidenceType = selectedTypes;
					}
					const searchResult = await searchEvidence(query, searchFilters as Parameters<typeof searchEvidence>[1]);
					if (searchResult.success && searchResult.data) {
						evidenceList = searchResult.data.map((r: { evidence: unknown }) => r.evidence as unknown as Evidence);
					} else {
						evidenceList = [];
					}
				} else if (context) {
					// Get suggestions based on context
					const listFilters = {
						limit: maxResults * 2,
						orderBy: "strengthScore",
						orderDirection: "desc",
					} as Record<string, unknown>;
					if (selectedTypes.length < ALL_TYPES.length) {
						listFilters.evidenceType = selectedTypes;
					}
					const listResult = await listEvidence(listFilters as Parameters<typeof listEvidence>[0]);
					if (listResult.success && listResult.data) {
						// Simple relevance scoring based on context keywords
						const contextWords = context.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
						evidenceList = listResult.data
							.map((e: { title: string; content: string }) => ({
								evidence: e,
								score: contextWords.reduce((score: number, word: string) => {
									const content = `${e.title} ${e.content}`.toLowerCase();
									return score + (content.includes(word) ? 1 : 0);
								}, 0),
							}))
							.sort((a: { score: number }, b: { score: number }) => b.score - a.score)
							.slice(0, maxResults)
							.map((r: { evidence: unknown }) => r.evidence as unknown as Evidence);
					} else {
						evidenceList = [];
					}
				} else {
					evidenceList = [];
				}

				// Filter by minimum strength tier if specified
				if (minStrengthTier) {
					const tierOrder: EvidenceStrengthTier[] = ["bronze", "silver", "gold"];
					const minTierIndex = tierOrder.indexOf(minStrengthTier);
					evidenceList = evidenceList.filter((e) => {
						const tier = e.strengthTier ?? "bronze";
						const eTierIndex = tierOrder.indexOf(tier);
						return eTierIndex >= minTierIndex;
					});
				}

				setResults(evidenceList);
			} catch (err) {
				console.error("Search failed:", err);
				setResults([]);
			}
			setIsLoading(false);
		},
		[selectedTypes, maxResults, context, minStrengthTier]
	);

	// Debounced search
	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		debounceTimerRef.current = setTimeout(() => {
			performSearch(searchQuery);
		}, 300);

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [searchQuery, performSearch]);

	// Handle selection
	const handleSelect = useCallback(
		(evidence: Evidence) => {
			setSelectedId(evidence.id);
			onSelect(evidence);
		},
		[onSelect]
	);

	// Toggle type filter
	const toggleType = useCallback((type: EvidenceType) => {
		setSelectedTypes((prev) =>
			prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
		);
	}, []);

	// Clear search
	const clearSearch = useCallback(() => {
		setSearchQuery("");
		setResults([]);
		searchInputRef.current?.focus();
	}, []);

	// Calculate if we should show context suggestions
	const showContextSuggestions = !searchQuery.trim() && context && results.length > 0;

	return (
		<div className={cn("w-full space-y-3", className)}>
			{/* Search Input */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					ref={searchInputRef}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder={placeholder}
					className="pl-9 pr-20"
				/>
				<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
					{searchQuery && (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0"
							onClick={clearSearch}
						>
							<X className="h-3 w-3" />
						</Button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-6 w-6 p-0",
									selectedTypes.length < ALL_TYPES.length && "text-primary"
								)}
							>
								<Filter className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{ALL_TYPES.map((type) => {
								const Icon = TYPE_ICONS[type];
								const isDisabled = allowedTypes && !allowedTypes.includes(type);
								return (
									<DropdownMenuCheckboxItem
										key={type}
										checked={selectedTypes.includes(type)}
										onCheckedChange={() => toggleType(type)}
										disabled={isDisabled}
									>
										<Icon className="h-3 w-3 mr-2" />
										{TYPE_LABELS[type]}
									</DropdownMenuCheckboxItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Active Filters */}
			{selectedTypes.length < ALL_TYPES.length && (
				<div className="flex flex-wrap gap-1">
					{selectedTypes.map((type) => (
						<Badge
							key={type}
							variant="secondary"
							className="text-xs cursor-pointer hover:bg-destructive/20"
							onClick={() => toggleType(type)}
						>
							{TYPE_LABELS[type]}
							<X className="h-2 w-2 ml-1" />
						</Badge>
					))}
					<Button
						variant="ghost"
						size="sm"
						className="h-5 text-xs px-2"
						onClick={() => setSelectedTypes(allowedTypes || ALL_TYPES)}
					>
						Clear filters
					</Button>
				</div>
			)}

			<ScrollArea className="h-72">
				{/* Loading State */}
				{(isLoading || isLoadingRecent) && <PickerSkeleton />}

				{/* Context Suggestions */}
				{!isLoading && showContextSuggestions && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
							<Star className="h-3 w-3" />
							<span>Suggested for current context</span>
						</div>
						{results.map((evidence) => (
							<EvidenceItem
								key={evidence.id}
								evidence={evidence}
								onSelect={() => handleSelect(evidence)}
								enableDragDrop={enableDragDrop}
								isSelected={selectedId === evidence.id}
							/>
						))}
					</div>
				)}

				{/* Search Results */}
				{!isLoading && searchQuery.trim() && results.length > 0 && (
					<div className="space-y-1">
						<div className="flex items-center justify-between text-xs text-muted-foreground px-2">
							<span>{results.length} results</span>
						</div>
						{results.map((evidence) => (
							<EvidenceItem
								key={evidence.id}
								evidence={evidence}
								onSelect={() => handleSelect(evidence)}
								enableDragDrop={enableDragDrop}
								isSelected={selectedId === evidence.id}
							/>
						))}
					</div>
				)}

				{/* No Results */}
				{!isLoading && searchQuery.trim() && results.length === 0 && (
					<div className="text-center py-8 text-muted-foreground">
						<Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">No evidence found</p>
						<p className="text-xs mt-1">Try adjusting your search or filters</p>
					</div>
				)}

				{/* Recently Used */}
				{!isLoading &&
					!isLoadingRecent &&
					showRecentlyUsed &&
					!searchQuery.trim() &&
					!showContextSuggestions &&
					recentlyUsed.length > 0 && (
						<Collapsible
							open={recentlyUsedExpanded}
							onOpenChange={setRecentlyUsedExpanded}
						>
							<CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Clock className="h-4 w-4 text-muted-foreground" />
									Recently Used
								</div>
								{recentlyUsedExpanded ? (
									<ChevronUp className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								)}
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-1">
								{recentlyUsed.map((evidence) => (
									<EvidenceItem
										key={evidence.id}
										evidence={evidence}
										onSelect={() => handleSelect(evidence)}
										enableDragDrop={enableDragDrop}
										isSelected={selectedId === evidence.id}
									/>
								))}
							</CollapsibleContent>
						</Collapsible>
					)}

				{/* Empty State */}
				{!isLoading &&
					!isLoadingRecent &&
					!searchQuery.trim() &&
					!showContextSuggestions &&
					recentlyUsed.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							<FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p className="text-sm">Start typing to search evidence</p>
							{context && (
								<p className="text-xs mt-1">
									Or we'll suggest relevant evidence based on context
								</p>
							)}
						</div>
					)}
			</ScrollArea>

			{/* Drag Drop Hint */}
			{enableDragDrop && (
				<div className="text-xs text-center text-muted-foreground border-t pt-2">
					<GripVertical className="h-3 w-3 inline mr-1" />
					Drag evidence to insert into document
				</div>
			)}
		</div>
	);
}

export default EvidencePicker;
