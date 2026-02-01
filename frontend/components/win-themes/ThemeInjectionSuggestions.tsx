/**
 * ThemeInjectionSuggestions - AI Injection Points
 *
 * Displays AI-suggested locations for injecting themes into the document
 * with before/after preview, impact scores, and accept/reject actions.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	Wand2,
	RefreshCw,
	Check,
	X,
	Edit2,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronUp,
	ArrowRight,
	Filter,
	Zap,
	Target,
	FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type {
	InjectionPoint,
	InjectionImpact,
	InjectionFilters,
	WinTheme,
} from "@/lib/types/win-themes";
import {
	getInjectionSuggestions,
	generateInjectionSuggestions,
	acceptInjection,
	rejectInjection,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeInjectionSuggestionsProps {
	/** Theme ID to filter suggestions (optional) */
	themeId?: string;
	/** Opportunity ID */
	opportunityId: string;
	/** Callback when an injection is accepted */
	onAccept?: (injection: InjectionPoint) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const IMPACT_CONFIG: Record<
	InjectionImpact,
	{ label: string; color: string; bgColor: string }
> = {
	high: {
		label: "High Impact",
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	medium: {
		label: "Medium Impact",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	low: {
		label: "Low Impact",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function InjectionsSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-44" />
					<Skeleton className="h-9 w-32" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="p-4 border rounded-lg space-y-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-24" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-20 w-full" />
						<div className="flex gap-2">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-20" />
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Before/After Preview Component
// =============================================================================

interface BeforeAfterPreviewProps {
	originalText: string;
	previewText: string;
}

function BeforeAfterPreview({ originalText, previewText }: BeforeAfterPreviewProps) {
	return (
		<div className="grid grid-cols-2 gap-4">
			<div className="space-y-2">
				<div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
					<FileText className="h-3 w-3" />
					Before
				</div>
				<div className="p-3 bg-muted/50 rounded text-sm max-h-40 overflow-y-auto">
					{originalText}
				</div>
			</div>
			<div className="space-y-2">
				<div className="text-xs font-medium text-green-600 flex items-center gap-1">
					<Wand2 className="h-3 w-3" />
					After
				</div>
				<div className="p-3 bg-green-50 dark:bg-green-950/30 rounded text-sm max-h-40 overflow-y-auto border border-green-200 dark:border-green-800">
					{previewText}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Injection Card Component
// =============================================================================

interface InjectionCardProps {
	injection: InjectionPoint;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onAccept: () => void;
	onReject: () => void;
	onModify: () => void;
	isProcessing: boolean;
}

function InjectionCard({
	injection,
	isExpanded,
	onToggleExpand,
	onAccept,
	onReject,
	onModify,
	isProcessing,
}: InjectionCardProps) {
	const impactConfig = IMPACT_CONFIG[injection.impactLevel];

	return (
		<div
			className={cn(
				"border rounded-lg transition-all",
				injection.status === "pending"
					? "border-border"
					: injection.status === "accepted"
						? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
						: "border-muted bg-muted/30 opacity-60"
			)}
		>
			<Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
				<div className="p-4">
					{/* Header */}
					<div className="flex items-start gap-3">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5">
								{isExpanded ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>

						<div className="flex-1 min-w-0">
							{/* Badges */}
							<div className="flex items-center gap-2 mb-2 flex-wrap">
								<Badge
									variant="secondary"
									className={cn("gap-1", impactConfig.bgColor, impactConfig.color)}
								>
									<Zap className="h-3 w-3" />
									{impactConfig.label}
								</Badge>
								<Badge variant="outline" className="text-xs">
									<Target className="h-3 w-3 mr-1" />
									{injection.themeName}
								</Badge>
								<Badge variant="outline" className="text-xs">
									<FileText className="h-3 w-3 mr-1" />
									{injection.sectionName}
								</Badge>
								{injection.status !== "pending" && (
									<Badge
										variant={injection.status === "accepted" ? "default" : "outline"}
									>
										{injection.status === "accepted" ? "Accepted" : "Rejected"}
									</Badge>
								)}
							</div>

							{/* Suggested Text Preview */}
							<p className="text-sm line-clamp-2">{injection.suggestedText}</p>

							{/* Impact Score */}
							<div className="flex items-center gap-2 mt-2">
								<span className="text-xs text-muted-foreground">Impact Score:</span>
								<div className="flex-1 max-w-[100px] bg-muted rounded-full h-2 overflow-hidden">
									<div
										className={cn(
											"h-full rounded-full",
											injection.impactScore >= 80
												? "bg-green-500"
												: injection.impactScore >= 50
													? "bg-amber-500"
													: "bg-blue-500"
										)}
										style={{ width: `${injection.impactScore}%` }}
									/>
								</div>
								<span className="text-xs font-medium">{injection.impactScore}</span>
							</div>
						</div>
					</div>

					{/* Actions (only for pending) */}
					{injection.status === "pending" && (
						<div className="flex items-center gap-2 mt-3 ml-9">
							<Button
								size="sm"
								onClick={onAccept}
								disabled={isProcessing}
								className="gap-1"
							>
								{isProcessing ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<Check className="h-3 w-3" />
								)}
								Accept
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={onReject}
								disabled={isProcessing}
								className="gap-1"
							>
								<X className="h-3 w-3" />
								Reject
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={onModify}
								disabled={isProcessing}
								className="gap-1"
							>
								<Edit2 className="h-3 w-3" />
								Modify
							</Button>
						</div>
					)}
				</div>

				{/* Expanded Content */}
				<CollapsibleContent>
					<div className="px-4 pb-4 space-y-4 border-t pt-4 ml-9">
						{/* Before/After Preview */}
						<BeforeAfterPreview
							originalText={injection.originalText}
							previewText={injection.previewText}
						/>

						{/* Rationale */}
						<div>
							<label className="text-xs font-medium text-muted-foreground">
								Rationale
							</label>
							<p className="text-sm mt-1 text-muted-foreground">
								{injection.rationale}
							</p>
						</div>

						{/* Insert Position */}
						<div className="flex items-center gap-4 text-sm">
							<span className="text-muted-foreground">Position:</span>
							<Badge variant="outline" className="capitalize">
								{injection.insertPosition.replace("_", " ")}
							</Badge>
							<span className="text-muted-foreground">
								Paragraph {injection.paragraphIndex + 1}
							</span>
						</div>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeInjectionSuggestions({
	themeId,
	opportunityId,
	onAccept,
	className,
}: ThemeInjectionSuggestionsProps) {
	// State
	const [injections, setInjections] = useState<InjectionPoint[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedInjections, setExpandedInjections] = useState<Set<string>>(
		new Set()
	);
	const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

	// Filter state
	const [filterTheme, setFilterTheme] = useState<string>(themeId || "all");
	const [filterSection, setFilterSection] = useState<string>("all");
	const [filterImpact, setFilterImpact] = useState<InjectionImpact | "all">("all");

	// Modify dialog state
	const [modifyDialog, setModifyDialog] = useState<{
		injection: InjectionPoint;
		modifiedText: string;
	} | null>(null);

	// Load injections
	useEffect(() => {
		async function loadInjections() {
			setIsLoading(true);
			setError(null);
			const filters: InjectionFilters = {};
			if (themeId) filters.themeId = themeId;
			const result = await getInjectionSuggestions(opportunityId, filters);
			if (result.success && result.data) {
				setInjections(result.data);
			} else {
				setError(result.error || "Failed to load injection suggestions");
			}
			setIsLoading(false);
		}
		loadInjections();
	}, [opportunityId, themeId]);

	// Get unique themes and sections for filters
	const filterOptions = useMemo(() => {
		const themes = new Map<string, string>();
		const sections = new Map<string, string>();

		injections.forEach((inj) => {
			themes.set(inj.themeId, inj.themeName);
			sections.set(inj.sectionId, inj.sectionName);
		});

		return {
			themes: Array.from(themes.entries()),
			sections: Array.from(sections.entries()),
		};
	}, [injections]);

	// Filtered injections
	const filteredInjections = useMemo(() => {
		return injections.filter((inj) => {
			if (filterTheme !== "all" && inj.themeId !== filterTheme) return false;
			if (filterSection !== "all" && inj.sectionId !== filterSection) return false;
			if (filterImpact !== "all" && inj.impactLevel !== filterImpact) return false;
			return true;
		});
	}, [injections, filterTheme, filterSection, filterImpact]);

	// Toggle injection expansion
	const toggleExpanded = useCallback((injectionId: string) => {
		setExpandedInjections((prev) => {
			const next = new Set(prev);
			if (next.has(injectionId)) {
				next.delete(injectionId);
			} else {
				next.add(injectionId);
			}
			return next;
		});
	}, []);

	// Generate new injections
	const handleGenerate = useCallback(async () => {
		setIsGenerating(true);
		setError(null);

		try {
			const result = await generateInjectionSuggestions({
				opportunityId,
				themeId: themeId || undefined,
			});

			if (result.success && result.data) {
				setInjections((prev) => [...result.data!, ...prev]);
			} else {
				setError(result.error || "Failed to generate suggestions");
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setIsGenerating(false);
		}
	}, [opportunityId, themeId]);

	// Accept injection
	const handleAccept = useCallback(
		async (injection: InjectionPoint, modifiedText?: string) => {
			setProcessingIds((prev) => new Set(prev).add(injection.id));

			try {
				const result = await acceptInjection(injection.id, modifiedText);
				if (result.success) {
					setInjections((prev) =>
						prev.map((i) =>
							i.id === injection.id
								? {
										...i,
										status: "accepted" as const,
										modifiedText,
									}
								: i
						)
					);
					onAccept?.(injection);
					setModifyDialog(null);
				} else {
					setError(result.error || "Failed to accept injection");
				}
			} catch (err) {
				setError(`An error occurred: ${err}`);
			} finally {
				setProcessingIds((prev) => {
					const next = new Set(prev);
					next.delete(injection.id);
					return next;
				});
			}
		},
		[onAccept]
	);

	// Reject injection
	const handleReject = useCallback(async (injectionId: string) => {
		setProcessingIds((prev) => new Set(prev).add(injectionId));

		try {
			const result = await rejectInjection(injectionId);
			if (result.success) {
				setInjections((prev) =>
					prev.map((i) =>
						i.id === injectionId ? { ...i, status: "rejected" as const } : i
					)
				);
			} else {
				setError(result.error || "Failed to reject injection");
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setProcessingIds((prev) => {
				const next = new Set(prev);
				next.delete(injectionId);
				return next;
			});
		}
	}, []);

	// Open modify dialog
	const handleOpenModify = useCallback((injection: InjectionPoint) => {
		setModifyDialog({
			injection,
			modifiedText: injection.suggestedText,
		});
	}, []);

	// Pending count
	const pendingCount = injections.filter((i) => i.status === "pending").length;

	// Loading state
	if (isLoading) {
		return <InjectionsSkeleton />;
	}

	return (
		<>
			<Card className={cn("w-full", className)}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Wand2 className="h-5 w-5 text-purple-500" />
							Injection Suggestions
							{pendingCount > 0 && (
								<Badge variant="secondary">{pendingCount} pending</Badge>
							)}
						</CardTitle>
						<Button
							variant="outline"
							size="sm"
							onClick={handleGenerate}
							disabled={isGenerating}
						>
							{isGenerating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<RefreshCw className="h-4 w-4 mr-2" />
									Generate
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

					{/* Filters */}
					{injections.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap">
							<Filter className="h-4 w-4 text-muted-foreground" />
							<Select value={filterTheme} onValueChange={setFilterTheme}>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder="Filter by theme" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Themes</SelectItem>
									{filterOptions.themes.map(([id, name]) => (
										<SelectItem key={id} value={id}>
											{name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={filterSection} onValueChange={setFilterSection}>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder="Filter by section" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Sections</SelectItem>
									{filterOptions.sections.map(([id, name]) => (
										<SelectItem key={id} value={id}>
											{name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select
								value={filterImpact}
								onValueChange={(v) => setFilterImpact(v as InjectionImpact | "all")}
							>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder="Impact" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Impact</SelectItem>
									<SelectItem value="high">High</SelectItem>
									<SelectItem value="medium">Medium</SelectItem>
									<SelectItem value="low">Low</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Empty State */}
					{injections.length === 0 && !error && (
						<div className="text-center py-8">
							<Wand2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
							<h3 className="mt-4 font-medium">No injection suggestions</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Generate AI suggestions for where to reinforce themes
							</p>
							<Button onClick={handleGenerate} className="mt-4" disabled={isGenerating}>
								<Wand2 className="h-4 w-4 mr-2" />
								Generate Suggestions
							</Button>
						</div>
					)}

					{/* Injections List */}
					{filteredInjections.length > 0 && (
						<div className="space-y-3">
							{filteredInjections
								.filter((i) => i.status === "pending")
								.map((injection) => (
									<InjectionCard
										key={injection.id}
										injection={injection}
										isExpanded={expandedInjections.has(injection.id)}
										onToggleExpand={() => toggleExpanded(injection.id)}
										onAccept={() => handleAccept(injection)}
										onReject={() => handleReject(injection.id)}
										onModify={() => handleOpenModify(injection)}
										isProcessing={processingIds.has(injection.id)}
									/>
								))}

							{/* Processed injections */}
							{filteredInjections.filter((i) => i.status !== "pending").length > 0 && (
								<Collapsible>
									<CollapsibleTrigger asChild>
										<Button
											variant="ghost"
											className="w-full justify-start text-muted-foreground"
										>
											<ChevronDown className="h-4 w-4 mr-2" />
											Processed suggestions (
											{filteredInjections.filter((i) => i.status !== "pending").length}
											)
										</Button>
									</CollapsibleTrigger>
									<CollapsibleContent className="space-y-3 mt-2">
										{filteredInjections
											.filter((i) => i.status !== "pending")
											.map((injection) => (
												<InjectionCard
													key={injection.id}
													injection={injection}
													isExpanded={expandedInjections.has(injection.id)}
													onToggleExpand={() => toggleExpanded(injection.id)}
													onAccept={() => handleAccept(injection)}
													onReject={() => handleReject(injection.id)}
													onModify={() => handleOpenModify(injection)}
													isProcessing={processingIds.has(injection.id)}
												/>
											))}
									</CollapsibleContent>
								</Collapsible>
							)}
						</div>
					)}

					{/* No results with filters */}
					{injections.length > 0 && filteredInjections.length === 0 && (
						<div className="text-center py-8">
							<p className="text-sm text-muted-foreground">
								No suggestions match your filters
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Modify Dialog */}
			<Dialog open={!!modifyDialog} onOpenChange={() => setModifyDialog(null)}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Modify Injection Text</DialogTitle>
						<DialogDescription>
							Edit the suggested text before accepting
						</DialogDescription>
					</DialogHeader>

					{modifyDialog && (
						<div className="space-y-4">
							{/* Original Context */}
							<div>
								<label className="text-sm font-medium">Original Text</label>
								<div className="mt-1 p-3 bg-muted/50 rounded text-sm max-h-24 overflow-y-auto">
									{modifyDialog.injection.originalText}
								</div>
							</div>

							{/* Modified Text */}
							<div>
								<label className="text-sm font-medium">Modified Injection</label>
								<Textarea
									value={modifyDialog.modifiedText}
									onChange={(e) =>
										setModifyDialog((prev) =>
											prev ? { ...prev, modifiedText: e.target.value } : null
										)
									}
									rows={6}
									className="mt-1"
								/>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button variant="outline" onClick={() => setModifyDialog(null)}>
							Cancel
						</Button>
						<Button
							onClick={() =>
								modifyDialog &&
								handleAccept(modifyDialog.injection, modifyDialog.modifiedText)
							}
							disabled={
								!modifyDialog ||
								processingIds.has(modifyDialog.injection.id)
							}
						>
							{modifyDialog && processingIds.has(modifyDialog.injection.id) ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Accepting...
								</>
							) : (
								<>
									<Check className="h-4 w-4 mr-2" />
									Accept Modified
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

export default ThemeInjectionSuggestions;
