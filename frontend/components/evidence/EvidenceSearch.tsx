/**
 * EvidenceSearch - Advanced Search Interface
 *
 * Search evidence with instant results, filters panel, relevance scores,
 * and quick actions for adding evidence to documents.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Search,
	Filter,
	X,
	Plus,
	Award,
	TrendingUp,
	FileText,
	MessageSquareQuote,
	Briefcase,
	ShieldCheck,
	Zap,
	Users,
	ChevronDown,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type {
	Evidence,
	EvidenceType,
	EvidenceStrengthTier,
	EvidenceFilters,
	EvidenceSearchResult,
} from "@/lib/types/evidence";
import { searchEvidence } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceSearchProps {
	/** Callback when evidence is selected */
	onSelect?: (evidence: Evidence) => void;
	/** Pre-applied filters */
	preFilters?: EvidenceFilters;
	/** Placeholder text */
	placeholder?: string;
	/** Show filters panel */
	showFilters?: boolean;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EVIDENCE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Award }> = {
	metric: { label: "Metric", icon: TrendingUp },
	testimonial: { label: "Testimonial", icon: MessageSquareQuote },
	case_study: { label: "Case Study", icon: FileText },
	certification: { label: "Certification", icon: ShieldCheck },
	capability: { label: "Capability", icon: Zap },
	past_performance: { label: "Past Performance", icon: Briefcase },
	reference: { label: "Reference", icon: Users },
	award: { label: "Award", icon: Award },
	publication: { label: "Publication", icon: FileText },
};

const STRENGTH_TIERS: EvidenceStrengthTier[] = ["gold", "silver", "bronze"];

const TIER_COLORS: Record<EvidenceStrengthTier, string> = {
	gold: "text-yellow-600 bg-yellow-100 border-yellow-300",
	silver: "text-gray-600 bg-gray-100 border-gray-300",
	bronze: "text-orange-600 bg-orange-100 border-orange-300",
};

// =============================================================================
// Helper function to safely render highlighted content
// =============================================================================

/**
 * Parses highlighted content and returns safe React elements.
 * Converts **text** markers to highlighted spans without using dangerouslySetInnerHTML.
 */
function renderHighlightedContent(content: string): React.ReactNode[] {
	const parts = content.split(/\*\*(.*?)\*\*/g);
	return parts.map((part, index) => {
		// Odd indices are the matched groups (highlighted text)
		if (index % 2 === 1) {
			return (
				<mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
					{part}
				</mark>
			);
		}
		return part;
	});
}

// =============================================================================
// Search Result Item
// =============================================================================

interface SearchResultProps {
	result: EvidenceSearchResult;
	onSelect: () => void;
}

function SearchResult({ result, onSelect }: SearchResultProps) {
	// Use type with fallback chain for backward compatibility
	const evidenceType = result.type ?? result.evidenceType ?? "capability";
	const typeConfig = EVIDENCE_TYPE_CONFIG[evidenceType] ?? EVIDENCE_TYPE_CONFIG.capability;
	const TypeIcon = typeConfig.icon;

	// Get display content - use highlighted version if available
	const displayContent = result.highlightedContent
		? result.highlightedContent.substring(0, 150)
		: result.content.substring(0, 150);

	return (
		<div
			className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
			onClick={onSelect}
		>
			<div className="flex items-start justify-between gap-2 mb-2">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
					<span className="font-medium truncate">{result.title}</span>
				</div>
				<div className="flex items-center gap-1 shrink-0">
					<Badge
						variant="outline"
						className={cn("text-xs border", TIER_COLORS[result.strengthTier ?? "bronze"])}
					>
						{result.strengthTier ?? "bronze"}
					</Badge>
					<div className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
						{Math.round(result.relevanceScore)}%
					</div>
				</div>
			</div>

			{/* Safely rendered highlighted content */}
			<p className="text-sm text-muted-foreground line-clamp-2">
				{renderHighlightedContent(displayContent)}
				{displayContent.length >= 150 && "..."}
			</p>

			{/* Tags and matched fields */}
			<div className="flex items-center gap-2 mt-2">
				{result.matchedFields.length > 0 && (
					<span className="text-xs text-muted-foreground">
						Matched: {result.matchedFields.join(", ")}
					</span>
				)}
				{result.tags.length > 0 && (
					<div className="flex gap-1 ml-auto">
						{result.tags.slice(0, 2).map((tag) => (
							<Badge key={tag} variant="outline" className="text-xs">
								{tag}
							</Badge>
						))}
					</div>
				)}
			</div>

			{/* Add button */}
			<Button
				size="sm"
				className="mt-2 w-full opacity-0 group-hover:opacity-100 transition-opacity"
				onClick={(e) => {
					e.stopPropagation();
					onSelect();
				}}
			>
				<Plus className="h-3 w-3 mr-1" />
				Add to Document
			</Button>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceSearch({
	onSelect,
	preFilters,
	placeholder = "Search evidence...",
	showFilters = true,
	className,
}: EvidenceSearchProps) {
	// State
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<EvidenceSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);

	// Filters
	const [selectedTypes, setSelectedTypes] = useState<EvidenceType[]>(preFilters?.types || []);
	const [selectedTiers, setSelectedTiers] = useState<EvidenceStrengthTier[]>(preFilters?.strengthTiers || []);
	const [minScore, setMinScore] = useState(preFilters?.minStrengthScore || 0);

	// Search effect with debounce
	useEffect(() => {
		const timer = setTimeout(async () => {
			if (query.trim().length >= 2) {
				setIsSearching(true);
				const filters: EvidenceFilters = {
					...preFilters,
					types: selectedTypes.length > 0 ? selectedTypes : preFilters?.types,
					strengthTiers: selectedTiers.length > 0 ? selectedTiers : preFilters?.strengthTiers,
					minStrengthScore: minScore > 0 ? minScore : preFilters?.minStrengthScore,
				};
				const result = await searchEvidence(query, filters);
				if (result.success && result.data) {
					// Transform SearchResult[] to EvidenceSearchResult[]
					const searchResults: EvidenceSearchResult[] = result.data.map((r) => ({
						...r.evidence,
						relevanceScore: r.relevanceScore,
						matchedFields: r.matchedFields,
					} as EvidenceSearchResult));
					setResults(searchResults);
				}
				setIsSearching(false);
			} else {
				setResults([]);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [query, selectedTypes, selectedTiers, minScore, preFilters]);

	// Toggle type filter
	const toggleType = useCallback((type: EvidenceType) => {
		setSelectedTypes((prev) =>
			prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
		);
	}, []);

	// Toggle tier filter
	const toggleTier = useCallback((tier: EvidenceStrengthTier) => {
		setSelectedTiers((prev) =>
			prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
		);
	}, []);

	// Clear filters
	const clearFilters = useCallback(() => {
		setSelectedTypes([]);
		setSelectedTiers([]);
		setMinScore(0);
	}, []);

	// Handle select
	const handleSelect = useCallback(
		(evidence: Evidence) => {
			onSelect?.(evidence);
		},
		[onSelect]
	);

	const hasActiveFilters = selectedTypes.length > 0 || selectedTiers.length > 0 || minScore > 0;

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder={placeholder}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="pl-9 pr-8"
						/>
						{query && (
							<Button
								variant="ghost"
								size="icon"
								className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
								onClick={() => setQuery("")}
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
					{showFilters && (
						<Button
							variant={hasActiveFilters ? "secondary" : "outline"}
							size="icon"
							onClick={() => setFiltersOpen(!filtersOpen)}
						>
							<Filter className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Active filter badges */}
				{hasActiveFilters && (
					<div className="flex flex-wrap gap-1 mt-2">
						{selectedTypes.map((type) => (
							<Badge
								key={type}
								variant="secondary"
								className="gap-1 cursor-pointer"
								onClick={() => toggleType(type)}
							>
								{EVIDENCE_TYPE_CONFIG[type].label}
								<X className="h-3 w-3" />
							</Badge>
						))}
						{selectedTiers.map((tier) => (
							<Badge
								key={tier}
								variant="secondary"
								className={cn("gap-1 cursor-pointer", TIER_COLORS[tier])}
								onClick={() => toggleTier(tier)}
							>
								{tier}
								<X className="h-3 w-3" />
							</Badge>
						))}
						{minScore > 0 && (
							<Badge
								variant="secondary"
								className="gap-1 cursor-pointer"
								onClick={() => setMinScore(0)}
							>
								Min score: {minScore}
								<X className="h-3 w-3" />
							</Badge>
						)}
						<Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={clearFilters}>
							Clear all
						</Button>
					</div>
				)}
			</CardHeader>

			{/* Filters Panel */}
			{showFilters && (
				<Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
					<CollapsibleContent>
						<div className="px-6 pb-4 space-y-4 border-b">
							{/* Evidence Types */}
							<div className="space-y-2">
								<Label>Evidence Type</Label>
								<div className="flex flex-wrap gap-2">
									{Object.entries(EVIDENCE_TYPE_CONFIG).map(([type, config]) => {
										const Icon = config.icon;
										return (
											<Button
												key={type}
												variant={selectedTypes.includes(type as EvidenceType) ? "secondary" : "outline"}
												size="sm"
												className="gap-1"
												onClick={() => toggleType(type as EvidenceType)}
											>
												<Icon className="h-3 w-3" />
												{config.label}
											</Button>
										);
									})}
								</div>
							</div>

							{/* Strength Tiers */}
							<div className="space-y-2">
								<Label>Strength Tier</Label>
								<div className="flex gap-2">
									{STRENGTH_TIERS.map((tier) => (
										<Button
											key={tier}
											variant={selectedTiers.includes(tier) ? "secondary" : "outline"}
											size="sm"
											className={cn(
												selectedTiers.includes(tier) && TIER_COLORS[tier]
											)}
											onClick={() => toggleTier(tier)}
										>
											{tier.charAt(0).toUpperCase() + tier.slice(1)}
										</Button>
									))}
								</div>
							</div>

							{/* Minimum Score */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Minimum Strength Score</Label>
									<span className="text-sm text-muted-foreground">{minScore}</span>
								</div>
								<Slider
									value={[minScore]}
									min={0}
									max={100}
									step={10}
									onValueChange={([value]) => setMinScore(value)}
								/>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			)}

			<CardContent className="pt-4">
				{/* Loading State */}
				{isSearching && (
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="p-3 border rounded-lg space-y-2">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						))}
					</div>
				)}

				{/* No Query State */}
				{!isSearching && !query && (
					<div className="text-center py-8 text-muted-foreground">
						<Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">Start typing to search evidence</p>
						<p className="text-xs mt-1">Search by title, content, or tags</p>
					</div>
				)}

				{/* No Results */}
				{!isSearching && query && results.length === 0 && (
					<div className="text-center py-8 text-muted-foreground">
						<Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">No evidence found for "{query}"</p>
						<p className="text-xs mt-1">Try different keywords or adjust filters</p>
					</div>
				)}

				{/* Results */}
				{!isSearching && results.length > 0 && (
					<ScrollArea className="max-h-[400px]">
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground mb-3">
								{results.length} result{results.length !== 1 ? "s" : ""} found
							</p>
							{results.map((result) => (
								<SearchResult
									key={result.id}
									result={result}
									onSelect={() => handleSelect(result)}
								/>
							))}
						</div>
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	);
}

export default EvidenceSearch;
