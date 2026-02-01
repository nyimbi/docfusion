/**
 * CriteriaThemeMapping - Map Themes to Evaluation Criteria
 *
 * Displays evaluation criteria with mapped themes, coverage scores,
 * drag-and-drop theme assignment, and weight visualization.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	ListChecks,
	RefreshCw,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronRight,
	Target,
	Plus,
	X,
	GripVertical,
	Sparkles,
	Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import type {
	CriteriaThemeMapping as CriteriaMappingType,
	WinTheme,
	MapThemesToCriteriaInput,
} from "@/lib/types/win-themes";
import {
	getCriteriaMappings,
	mapThemesToCriteria,
	suggestCriteriaMappings,
	getThemes,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface CriteriaThemeMappingProps {
	/** Opportunity ID */
	opportunityId: string;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function MappingSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-9 w-32" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="p-4 border rounded-lg space-y-3">
						<div className="flex items-center justify-between">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-2 w-full" />
						<div className="flex gap-2">
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-6 w-24" />
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Theme Tag Component
// =============================================================================

interface ThemeTagProps {
	themeId: string;
	themeName: string;
	relevanceScore: number;
	onRemove: () => void;
	onUpdateRelevance: (score: number) => void;
	isDraggable?: boolean;
}

function ThemeTag({
	themeId,
	themeName,
	relevanceScore,
	onRemove,
	onUpdateRelevance,
	isDraggable,
}: ThemeTagProps) {
	const [showRelevance, setShowRelevance] = useState(false);

	const getRelevanceColor = (score: number) => {
		if (score >= 80) return "bg-green-500";
		if (score >= 60) return "bg-amber-500";
		return "bg-red-500";
	};

	return (
		<TooltipProvider>
			<Tooltip open={showRelevance} onOpenChange={setShowRelevance}>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"inline-flex items-center gap-1 px-2 py-1 rounded border bg-background",
							isDraggable && "cursor-grab"
						)}
						draggable={isDraggable}
						onDragStart={(e) => {
							e.dataTransfer.setData("themeId", themeId);
						}}
					>
						{isDraggable && (
							<GripVertical className="h-3 w-3 text-muted-foreground" />
						)}
						<Target className="h-3 w-3 text-primary" />
						<span className="text-sm">{themeName}</span>
						<div
							className={cn(
								"h-2 w-2 rounded-full",
								getRelevanceColor(relevanceScore)
							)}
						/>
						<button
							onClick={(e) => {
								e.stopPropagation();
								onRemove();
							}}
							className="ml-1 text-muted-foreground hover:text-destructive"
						>
							<X className="h-3 w-3" />
						</button>
					</div>
				</TooltipTrigger>
				<TooltipContent className="w-48 p-3">
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium">Relevance</span>
							<span className="text-xs">{relevanceScore}%</span>
						</div>
						<Slider
							value={[relevanceScore]}
							min={0}
							max={100}
							step={5}
							onValueChange={([value]) => onUpdateRelevance(value)}
						/>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =============================================================================
// Criteria Card Component
// =============================================================================

interface CriteriaCardProps {
	mapping: CriteriaMappingType;
	availableThemes: WinTheme[];
	isExpanded: boolean;
	onToggleExpand: () => void;
	onAddTheme: (themeId: string, relevanceScore: number) => void;
	onRemoveTheme: (themeId: string) => void;
	onUpdateRelevance: (themeId: string, score: number) => void;
}

function CriteriaCard({
	mapping,
	availableThemes,
	isExpanded,
	onToggleExpand,
	onAddTheme,
	onRemoveTheme,
	onUpdateRelevance,
}: CriteriaCardProps) {
	const [showAddTheme, setShowAddTheme] = useState(false);

	// Themes not yet mapped to this criteria
	const unmappedThemes = availableThemes.filter(
		(t) => !mapping.mappedThemes.some((m) => m.themeId === t.id)
	);

	const getCoverageColor = (score: number) => {
		if (score >= 80) return "text-green-600";
		if (score >= 60) return "text-amber-600";
		return "text-red-600";
	};

	// Handle drag over
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.currentTarget.classList.add("ring-2", "ring-primary");
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.currentTarget.classList.remove("ring-2", "ring-primary");
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.currentTarget.classList.remove("ring-2", "ring-primary");
		const themeId = e.dataTransfer.getData("themeId");
		if (themeId && !mapping.mappedThemes.some((m) => m.themeId === themeId)) {
			onAddTheme(themeId, 70); // Default relevance
		}
	};

	return (
		<div
			className={cn(
				"border rounded-lg transition-all",
				mapping.isAdequate
					? "border-green-500/30"
					: mapping.coverageScore < 50
						? "border-red-500/30"
						: "border-border"
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
				<div className="p-4">
					<div className="flex items-start gap-3">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5">
								{isExpanded ? (
									<ChevronDown className="h-4 w-4" />
								) : (
									<ChevronRight className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>

						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-2">
								<h4 className="font-medium">{mapping.criteriaName}</h4>
								{mapping.criteriaWeight && (
									<Badge variant="outline" className="text-xs">
										{(mapping.criteriaWeight * 100).toFixed(0)}% weight
									</Badge>
								)}
								{mapping.isAdequate ? (
									<Badge className="text-xs bg-green-600">
										<Check className="h-3 w-3 mr-1" />
										Adequate
									</Badge>
								) : (
									<Badge variant="destructive" className="text-xs">
										Needs Work
									</Badge>
								)}
							</div>

							{/* Coverage Progress */}
							<div className="flex items-center gap-2">
								<Progress value={mapping.coverageScore} className="h-2 flex-1" />
								<span
									className={cn(
										"text-sm font-medium w-12 text-right",
										getCoverageColor(mapping.coverageScore)
									)}
								>
									{mapping.coverageScore}%
								</span>
							</div>

							{/* Mapped Themes Preview */}
							{mapping.mappedThemes.length > 0 && !isExpanded && (
								<div className="flex items-center gap-1 mt-2 flex-wrap">
									{mapping.mappedThemes.slice(0, 3).map((mt) => {
										const theme = availableThemes.find((t) => t.id === mt.themeId);
										return theme ? (
											<Badge
												key={mt.themeId}
												variant="secondary"
												className="text-xs"
											>
												{theme.shortVersion.slice(0, 20)}...
											</Badge>
										) : null;
									})}
									{mapping.mappedThemes.length > 3 && (
										<Badge variant="outline" className="text-xs">
											+{mapping.mappedThemes.length - 3} more
										</Badge>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				<CollapsibleContent>
					<div className="px-4 pb-4 space-y-4 border-t pt-4 ml-9">
						{/* Mapped Themes */}
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-2 block">
								Mapped Themes ({mapping.mappedThemes.length})
							</label>
							<div className="flex flex-wrap gap-2">
								{mapping.mappedThemes.map((mt) => {
									const theme = availableThemes.find((t) => t.id === mt.themeId);
									return theme ? (
										<ThemeTag
											key={mt.themeId}
											themeId={mt.themeId}
											themeName={theme.shortVersion}
											relevanceScore={mt.relevanceScore}
											onRemove={() => onRemoveTheme(mt.themeId)}
											onUpdateRelevance={(score) =>
												onUpdateRelevance(mt.themeId, score)
											}
										/>
									) : null;
								})}
								{mapping.mappedThemes.length === 0 && (
									<p className="text-sm text-muted-foreground italic">
										No themes mapped. Drag themes here or click Add.
									</p>
								)}
							</div>
						</div>

						{/* Add Theme Button */}
						{unmappedThemes.length > 0 && (
							<div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowAddTheme(!showAddTheme)}
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Theme
								</Button>

								{showAddTheme && (
									<div className="mt-2 p-2 border rounded bg-muted/30 space-y-2">
										<p className="text-xs text-muted-foreground">
											Available themes (click to add):
										</p>
										<div className="flex flex-wrap gap-2">
											{unmappedThemes.map((theme) => (
												<button
													key={theme.id}
													className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-background hover:bg-accent text-sm"
													onClick={() => {
														onAddTheme(theme.id, 70);
														setShowAddTheme(false);
													}}
												>
													<Target className="h-3 w-3" />
													{theme.shortVersion}
												</button>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function CriteriaThemeMapping({
	opportunityId,
	className,
}: CriteriaThemeMappingProps) {
	// State
	const [mappings, setMappings] = useState<CriteriaMappingType[]>([]);
	const [themes, setThemes] = useState<WinTheme[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSuggesting, setIsSuggesting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
	const [isSaving, setIsSaving] = useState(false);

	// Load data
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			const [mappingsResult, themesResult] = await Promise.all([
				getCriteriaMappings(opportunityId),
				getThemes(opportunityId),
			]);

			if (mappingsResult.success && mappingsResult.data) {
				setMappings(mappingsResult.data);
			}
			if (themesResult.success && themesResult.data) {
				setThemes(themesResult.data);
			}

			if (!mappingsResult.success) {
				setError(mappingsResult.error || "Failed to load mappings");
			}

			setIsLoading(false);
		}
		loadData();
	}, [opportunityId]);

	// Stats
	const stats = useMemo(() => {
		const total = mappings.length;
		const adequate = mappings.filter((m) => m.isAdequate).length;
		const avgCoverage =
			mappings.length > 0
				? mappings.reduce((sum, m) => sum + m.coverageScore, 0) / mappings.length
				: 0;
		return { total, adequate, avgCoverage };
	}, [mappings]);

	// Toggle criteria expansion
	const toggleExpanded = useCallback((criteriaId: string) => {
		setExpandedCriteria((prev) => {
			const next = new Set(prev);
			if (next.has(criteriaId)) {
				next.delete(criteriaId);
			} else {
				next.add(criteriaId);
			}
			return next;
		});
	}, []);

	// Add theme to criteria
	const handleAddTheme = useCallback(
		async (criteriaId: string, themeId: string, relevanceScore: number) => {
			const mapping = mappings.find((m) => m.criteriaId === criteriaId);
			if (!mapping) return;

			const newMappedThemes = [
				...mapping.mappedThemes,
				{ themeId, relevanceScore },
			];

			// Optimistic update
			setMappings((prev) =>
				prev.map((m) =>
					m.criteriaId === criteriaId
						? { ...m, mappedThemes: newMappedThemes }
						: m
				)
			);

			// Save to server
			const result = await mapThemesToCriteria({
				criteriaId,
				themeMappings: newMappedThemes,
			});

			if (!result.success) {
				// Revert on error
				setMappings((prev) =>
					prev.map((m) =>
						m.criteriaId === criteriaId
							? { ...m, mappedThemes: mapping.mappedThemes }
							: m
					)
				);
				setError(result.error || "Failed to add theme");
			}
		},
		[mappings]
	);

	// Remove theme from criteria
	const handleRemoveTheme = useCallback(
		async (criteriaId: string, themeId: string) => {
			const mapping = mappings.find((m) => m.criteriaId === criteriaId);
			if (!mapping) return;

			const newMappedThemes = mapping.mappedThemes.filter(
				(m) => m.themeId !== themeId
			);

			// Optimistic update
			setMappings((prev) =>
				prev.map((m) =>
					m.criteriaId === criteriaId
						? { ...m, mappedThemes: newMappedThemes }
						: m
				)
			);

			// Save to server
			const result = await mapThemesToCriteria({
				criteriaId,
				themeMappings: newMappedThemes,
			});

			if (!result.success) {
				// Revert on error
				setMappings((prev) =>
					prev.map((m) =>
						m.criteriaId === criteriaId
							? { ...m, mappedThemes: mapping.mappedThemes }
							: m
					)
				);
				setError(result.error || "Failed to remove theme");
			}
		},
		[mappings]
	);

	// Update theme relevance
	const handleUpdateRelevance = useCallback(
		async (criteriaId: string, themeId: string, relevanceScore: number) => {
			const mapping = mappings.find((m) => m.criteriaId === criteriaId);
			if (!mapping) return;

			const newMappedThemes = mapping.mappedThemes.map((m) =>
				m.themeId === themeId ? { ...m, relevanceScore } : m
			);

			// Optimistic update
			setMappings((prev) =>
				prev.map((m) =>
					m.criteriaId === criteriaId
						? { ...m, mappedThemes: newMappedThemes }
						: m
				)
			);

			// Save to server (debounced in real implementation)
			await mapThemesToCriteria({
				criteriaId,
				themeMappings: newMappedThemes,
			});
		},
		[mappings]
	);

	// Auto-suggest mappings
	const handleSuggestMappings = useCallback(async () => {
		setIsSuggesting(true);
		setError(null);

		try {
			const result = await suggestCriteriaMappings(opportunityId);
			if (result.success && result.data) {
				setMappings(result.data);
			} else {
				setError(result.error || "Failed to generate suggestions");
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setIsSuggesting(false);
		}
	}, [opportunityId]);

	// Loading state
	if (isLoading) {
		return <MappingSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<ListChecks className="h-5 w-5" />
						Criteria-Theme Mapping
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={handleSuggestMappings}
						disabled={isSuggesting}
					>
						{isSuggesting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Analyzing...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								Auto-Suggest
							</>
						)}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Stats */}
				<div className="grid grid-cols-3 gap-4 text-center">
					<div className="p-3 bg-muted/50 rounded-lg">
						<div className="text-lg font-bold">{stats.total}</div>
						<div className="text-xs text-muted-foreground">Criteria</div>
					</div>
					<div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
						<div className="text-lg font-bold text-green-600">
							{stats.adequate}/{stats.total}
						</div>
						<div className="text-xs text-muted-foreground">Adequate</div>
					</div>
					<div className="p-3 bg-muted/50 rounded-lg">
						<div className="text-lg font-bold">
							{stats.avgCoverage.toFixed(0)}%
						</div>
						<div className="text-xs text-muted-foreground">Avg Coverage</div>
					</div>
				</div>

				{/* Draggable Themes Pool */}
				{themes.length > 0 && (
					<div className="p-3 border rounded-lg bg-muted/30">
						<label className="text-xs font-medium text-muted-foreground mb-2 block">
							Drag themes to criteria:
						</label>
						<div className="flex flex-wrap gap-2">
							{themes.map((theme) => (
								<ThemeTag
									key={theme.id}
									themeId={theme.id}
									themeName={theme.shortVersion}
									relevanceScore={100}
									onRemove={() => {}}
									onUpdateRelevance={() => {}}
									isDraggable
								/>
							))}
						</div>
					</div>
				)}

				{/* Empty State */}
				{mappings.length === 0 && !error && (
					<div className="text-center py-8">
						<ListChecks className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No criteria found</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Import evaluation criteria from the RFP to map themes
						</p>
					</div>
				)}

				{/* Criteria List */}
				{mappings.length > 0 && (
					<div className="space-y-3">
						{mappings.map((mapping) => (
							<CriteriaCard
								key={mapping.criteriaId}
								mapping={mapping}
								availableThemes={themes}
								isExpanded={expandedCriteria.has(mapping.criteriaId)}
								onToggleExpand={() => toggleExpanded(mapping.criteriaId)}
								onAddTheme={(themeId, score) =>
									handleAddTheme(mapping.criteriaId, themeId, score)
								}
								onRemoveTheme={(themeId) =>
									handleRemoveTheme(mapping.criteriaId, themeId)
								}
								onUpdateRelevance={(themeId, score) =>
									handleUpdateRelevance(mapping.criteriaId, themeId, score)
								}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default CriteriaThemeMapping;
