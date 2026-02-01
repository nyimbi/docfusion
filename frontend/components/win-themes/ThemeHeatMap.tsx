/**
 * ThemeHeatMap - Visual Theme Coverage Matrix
 *
 * Displays a grid/matrix view of themes vs sections with color-coded cells
 * indicating coverage strength. Supports volume grouping and cell click details.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	Grid3X3,
	RefreshCw,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronRight,
	Maximize2,
	Minimize2,
	Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type {
	ThemeHeatMap as HeatMapData,
	HeatMapCell,
	HeatMapSection,
	HeatMapVolume,
	WinTheme,
	ThemeStrength,
} from "@/lib/types/win-themes";
import { getThemeHeatMap, getHeatMapCellDetails } from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeHeatMapProps {
	/** Opportunity ID */
	opportunityId: string;
	/** Callback when a cell is clicked */
	onCellClick?: (themeId: string, sectionId: string) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STRENGTH_CONFIG: Record<
	ThemeStrength,
	{ label: string; color: string; bgColor: string }
> = {
	strong: {
		label: "Strong",
		color: "text-green-700 dark:text-green-300",
		bgColor: "bg-green-500",
	},
	moderate: {
		label: "Moderate",
		color: "text-yellow-700 dark:text-yellow-300",
		bgColor: "bg-yellow-500",
	},
	weak: {
		label: "Weak",
		color: "text-red-700 dark:text-red-300",
		bgColor: "bg-red-400",
	},
	missing: {
		label: "Missing",
		color: "text-gray-500",
		bgColor: "bg-gray-200 dark:bg-gray-700",
	},
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function HeatMapSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<div className="flex gap-2">
						<Skeleton className="h-8 w-32" />
						{[1, 2, 3, 4, 5].map((i) => (
							<Skeleton key={i} className="h-8 w-16" />
						))}
					</div>
					{[1, 2, 3, 4].map((row) => (
						<div key={row} className="flex gap-2">
							<Skeleton className="h-10 w-32" />
							{[1, 2, 3, 4, 5].map((col) => (
								<Skeleton key={col} className="h-10 w-16" />
							))}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Cell Component
// =============================================================================

interface CellProps {
	cell: HeatMapCell | null;
	theme: WinTheme;
	section: HeatMapSection;
	onClick: () => void;
	isSelected: boolean;
}

function Cell({ cell, theme, section, onClick, isSelected }: CellProps) {
	const strength = cell?.strength || "missing";
	const config = STRENGTH_CONFIG[strength];

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						onClick={onClick}
						className={cn(
							"w-16 h-10 rounded transition-all",
							config.bgColor,
							strength !== "missing" && "opacity-80 hover:opacity-100",
							strength === "missing" && "hover:opacity-60",
							isSelected && "ring-2 ring-primary ring-offset-2"
						)}
					>
						{cell && cell.occurrenceCount > 0 && (
							<span
								className={cn(
									"text-xs font-medium",
									strength === "strong" && "text-white",
									strength === "moderate" && "text-black",
									strength === "weak" && "text-white",
									strength === "missing" && "text-muted-foreground"
								)}
							>
								{cell.occurrenceCount}
							</span>
						)}
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<div className="space-y-1">
						<p className="font-medium">{theme.shortVersion}</p>
						<p className="text-muted-foreground">{section.name}</p>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className={cn("text-xs", config.color)}>
								{config.label}
							</Badge>
							{cell && (
								<span className="text-xs">
									{cell.occurrenceCount} occurrence{cell.occurrenceCount !== 1 && "s"}
								</span>
							)}
						</div>
						{cell && cell.qualityScore > 0 && (
							<p className="text-xs text-muted-foreground">
								Quality: {cell.qualityScore}%
							</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =============================================================================
// Legend Component
// =============================================================================

function Legend() {
	return (
		<div className="flex items-center gap-4 text-xs">
			<span className="text-muted-foreground">Coverage:</span>
			{(Object.entries(STRENGTH_CONFIG) as [ThemeStrength, typeof STRENGTH_CONFIG.strong][]).map(
				([strength, config]) => (
					<div key={strength} className="flex items-center gap-1">
						<div className={cn("w-4 h-4 rounded", config.bgColor)} />
						<span>{config.label}</span>
					</div>
				)
			)}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeHeatMap({
	opportunityId,
	onCellClick,
	className,
}: ThemeHeatMapProps) {
	// State
	const [heatMap, setHeatMap] = useState<HeatMapData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedCell, setSelectedCell] = useState<{
		themeId: string;
		sectionId: string;
	} | null>(null);
	const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [visibleThemeTypes, setVisibleThemeTypes] = useState<Set<string>>(
		new Set(["value_prop", "differentiator", "proof_point", "risk_mitigation"])
	);

	// Load heat map
	useEffect(() => {
		async function loadHeatMap() {
			setIsLoading(true);
			setError(null);
			const result = await getThemeHeatMap(opportunityId);
			if (result.success && result.data) {
				setHeatMap(result.data);
				// Expand all volumes by default
				if (result.data.volumes) {
					setExpandedVolumes(new Set(result.data.volumes.map((v) => v.id)));
				}
			} else {
				setError(result.error || "Failed to load heat map");
			}
			setIsLoading(false);
		}
		loadHeatMap();
	}, [opportunityId]);

	// Get cell for theme and section
	const getCell = useCallback(
		(themeId: string, sectionId: string): HeatMapCell | null => {
			if (!heatMap) return null;
			return (
				heatMap.cells.find(
					(c) => c.themeId === themeId && c.sectionId === sectionId
				) || null
			);
		},
		[heatMap]
	);

	// Handle cell click
	const handleCellClick = useCallback(
		(themeId: string, sectionId: string) => {
			setSelectedCell({ themeId, sectionId });
			onCellClick?.(themeId, sectionId);
		},
		[onCellClick]
	);

	// Toggle volume expansion
	const toggleVolume = useCallback((volumeId: string) => {
		setExpandedVolumes((prev) => {
			const next = new Set(prev);
			if (next.has(volumeId)) {
				next.delete(volumeId);
			} else {
				next.add(volumeId);
			}
			return next;
		});
	}, []);

	// Refresh heat map
	const handleRefresh = useCallback(async () => {
		setIsLoading(true);
		const result = await getThemeHeatMap(opportunityId);
		if (result.success && result.data) {
			setHeatMap(result.data);
		}
		setIsLoading(false);
	}, [opportunityId]);

	// Filter themes by visible types
	const visibleThemes = useMemo(() => {
		if (!heatMap) return [];
		return heatMap.themes.filter((t) => visibleThemeTypes.has(t.type));
	}, [heatMap, visibleThemeTypes]);

	// Group sections by volume
	const sectionsByVolume = useMemo(() => {
		if (!heatMap) return [];

		if (heatMap.volumes && heatMap.volumes.length > 0) {
			return heatMap.volumes;
		}

		// If no volumes, create a single "default" volume
		return [
			{
				id: "default",
				name: "Document",
				sections: heatMap.sections,
			},
		];
	}, [heatMap]);

	// Loading state
	if (isLoading) {
		return <HeatMapSkeleton />;
	}

	return (
		<Card className={cn("w-full", isFullscreen && "fixed inset-4 z-50", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Grid3X3 className="h-5 w-5" />
						Theme Coverage Heat Map
					</CardTitle>
					<div className="flex items-center gap-2">
						{/* Filter by theme type */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Filter className="h-4 w-4 mr-2" />
									Filter
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuLabel>Theme Types</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{["value_prop", "differentiator", "proof_point", "risk_mitigation"].map(
									(type) => (
										<DropdownMenuCheckboxItem
											key={type}
											checked={visibleThemeTypes.has(type)}
											onCheckedChange={(checked) => {
												setVisibleThemeTypes((prev) => {
													const next = new Set(prev);
													if (checked) {
														next.add(type);
													} else {
														next.delete(type);
													}
													return next;
												});
											}}
										>
											{type.replace("_", " ")}
										</DropdownMenuCheckboxItem>
									)
								)}
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Refresh */}
						<Button
							variant="outline"
							size="icon"
							onClick={handleRefresh}
							disabled={isLoading}
						>
							<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
						</Button>

						{/* Fullscreen toggle */}
						<Button
							variant="outline"
							size="icon"
							onClick={() => setIsFullscreen(!isFullscreen)}
						>
							{isFullscreen ? (
								<Minimize2 className="h-4 w-4" />
							) : (
								<Maximize2 className="h-4 w-4" />
							)}
						</Button>
					</div>
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

				{/* Empty State */}
				{!heatMap || visibleThemes.length === 0 ? (
					<div className="text-center py-8">
						<Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No data to display</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Create themes and analyze documents to see coverage
						</p>
					</div>
				) : (
					<>
						{/* Summary Stats */}
						{heatMap.summary && (
							<div className="grid grid-cols-5 gap-2 text-center">
								<div className="p-2 bg-muted/50 rounded">
									<div className="text-lg font-bold">{heatMap.summary.totalCells}</div>
									<div className="text-xs text-muted-foreground">Total Cells</div>
								</div>
								<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
									<div className="text-lg font-bold text-green-600">
										{heatMap.summary.strongCells}
									</div>
									<div className="text-xs text-muted-foreground">Strong</div>
								</div>
								<div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
									<div className="text-lg font-bold text-yellow-600">
										{heatMap.summary.moderateCells}
									</div>
									<div className="text-xs text-muted-foreground">Moderate</div>
								</div>
								<div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
									<div className="text-lg font-bold text-red-600">
										{heatMap.summary.weakCells}
									</div>
									<div className="text-xs text-muted-foreground">Weak</div>
								</div>
								<div className="p-2 bg-muted/50 rounded">
									<div className="text-lg font-bold">
										{heatMap.summary.overallCoverage.toFixed(0)}%
									</div>
									<div className="text-xs text-muted-foreground">Coverage</div>
								</div>
							</div>
						)}

						{/* Legend */}
						<Legend />

						{/* Heat Map Grid */}
						<ScrollArea className="w-full">
							<div className="min-w-max">
								{/* Header Row - Theme Names */}
								<div className="flex gap-1 mb-2 sticky top-0 bg-background z-10">
									<div className="w-40 shrink-0" /> {/* Spacer for row headers */}
									{visibleThemes.map((theme) => (
										<TooltipProvider key={theme.id}>
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="w-16 text-center">
														<div className="text-xs font-medium truncate px-1">
															{theme.shortVersion.slice(0, 10)}...
														</div>
														<Badge variant="outline" className="text-[10px] mt-0.5">
															P{theme.priority}
														</Badge>
													</div>
												</TooltipTrigger>
												<TooltipContent>
													<p className="font-medium">{theme.shortVersion}</p>
													<p className="text-xs text-muted-foreground">
														{theme.type.replace("_", " ")}
													</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									))}
								</div>

								{/* Volume/Section Rows */}
								{sectionsByVolume.map((volume) => (
									<Collapsible
										key={volume.id}
										open={expandedVolumes.has(volume.id)}
										onOpenChange={() => toggleVolume(volume.id)}
									>
										{/* Volume Header */}
										{sectionsByVolume.length > 1 && (
											<CollapsibleTrigger asChild>
												<Button
													variant="ghost"
													className="w-full justify-start h-8 mb-1"
												>
													{expandedVolumes.has(volume.id) ? (
														<ChevronDown className="h-4 w-4 mr-2" />
													) : (
														<ChevronRight className="h-4 w-4 mr-2" />
													)}
													<span className="font-medium">{volume.name}</span>
													<Badge variant="secondary" className="ml-2">
														{volume.sections.length} sections
													</Badge>
												</Button>
											</CollapsibleTrigger>
										)}

										{/* Section Rows */}
										<CollapsibleContent>
											<div className="space-y-1">
												{volume.sections.map((section) => (
													<div key={section.id} className="flex gap-1 items-center">
														{/* Section Name */}
														<div className="w-40 shrink-0 pr-2">
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<span className="text-sm truncate block">
																			{section.name}
																		</span>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>{section.name}</p>
																		{section.startPage && section.endPage && (
																			<p className="text-xs text-muted-foreground">
																				Pages {section.startPage}-{section.endPage}
																			</p>
																		)}
																		{section.wordCount && (
																			<p className="text-xs text-muted-foreground">
																				{section.wordCount.toLocaleString()} words
																			</p>
																		)}
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</div>

														{/* Cells */}
														{visibleThemes.map((theme) => (
															<Cell
																key={`${theme.id}-${section.id}`}
																cell={getCell(theme.id, section.id)}
																theme={theme}
																section={section}
																onClick={() =>
																	handleCellClick(theme.id, section.id)
																}
																isSelected={
																	selectedCell?.themeId === theme.id &&
																	selectedCell?.sectionId === section.id
																}
															/>
														))}
													</div>
												))}
											</div>
										</CollapsibleContent>
									</Collapsible>
								))}
							</div>
							<ScrollBar orientation="horizontal" />
						</ScrollArea>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default ThemeHeatMap;
