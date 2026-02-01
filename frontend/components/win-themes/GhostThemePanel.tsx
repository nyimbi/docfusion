/**
 * GhostThemePanel - Competitive Positioning
 *
 * Manages competitor profiles and generates ghost theme suggestions
 * for subtle competitive positioning in proposals.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Ghost,
	Plus,
	Edit2,
	Trash2,
	RefreshCw,
	AlertCircle,
	Loader2,
	ChevronDown,
	ChevronRight,
	Target,
	Shield,
	AlertTriangle,
	Check,
	Sparkles,
	MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type {
	Competitor,
	CreateCompetitorInput,
	GhostThemeSuggestion,
} from "@/lib/types/win-themes";
import {
	getCompetitors,
	createCompetitor,
	updateCompetitor,
	deleteCompetitor,
	generateGhostThemeSuggestions,
} from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface GhostThemePanelProps {
	/** Opportunity ID */
	opportunityId: string;
	/** Callback when a ghost theme is added to themes */
	onAddToThemes?: (suggestion: GhostThemeSuggestion) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const THREAT_LEVEL_CONFIG: Record<
	Competitor["threatLevel"],
	{ label: string; color: string; bgColor: string }
> = {
	high: {
		label: "High Threat",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
	medium: {
		label: "Medium Threat",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	low: {
		label: "Low Threat",
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function PanelSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-32" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{[1, 2].map((i) => (
					<div key={i} className="p-4 border rounded-lg space-y-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-5 w-20" />
						</div>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Competitor Card Component
// =============================================================================

interface CompetitorCardProps {
	competitor: Competitor;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onGenerateGhost: () => void;
	isGenerating: boolean;
}

function CompetitorCard({
	competitor,
	isExpanded,
	onToggleExpand,
	onEdit,
	onDelete,
	onGenerateGhost,
	isGenerating,
}: CompetitorCardProps) {
	const threatConfig = THREAT_LEVEL_CONFIG[competitor.threatLevel];

	return (
		<div className="border rounded-lg">
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
							<div className="flex items-center gap-2 mb-1">
								<h4 className="font-medium">{competitor.name}</h4>
								<Badge
									variant="secondary"
									className={cn("text-xs", threatConfig.bgColor, threatConfig.color)}
								>
									<AlertTriangle className="h-3 w-3 mr-1" />
									{threatConfig.label}
								</Badge>
							</div>

							{/* Quick stats */}
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								{competitor.weaknesses.length > 0 && (
									<span>{competitor.weaknesses.length} weaknesses</span>
								)}
								{competitor.ourAdvantages.length > 0 && (
									<span>{competitor.ourAdvantages.length} advantages</span>
								)}
							</div>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={onGenerateGhost} disabled={isGenerating}>
									<Sparkles className="h-4 w-4 mr-2" />
									Generate Ghost Themes
								</DropdownMenuItem>
								<DropdownMenuItem onClick={onEdit}>
									<Edit2 className="h-4 w-4 mr-2" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={onDelete} className="text-destructive">
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				<CollapsibleContent>
					<div className="px-4 pb-4 space-y-4 border-t pt-4 ml-9">
						{/* Weaknesses */}
						{competitor.weaknesses.length > 0 && (
							<div>
								<label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
									<Target className="h-3 w-3 text-red-500" />
									Their Weaknesses
								</label>
								<ul className="mt-1 space-y-1">
									{competitor.weaknesses.map((weakness, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<span className="text-red-500">-</span>
											{weakness}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Our Advantages */}
						{competitor.ourAdvantages.length > 0 && (
							<div>
								<label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
									<Shield className="h-3 w-3 text-green-500" />
									Our Advantages
								</label>
								<ul className="mt-1 space-y-1">
									{competitor.ourAdvantages.map((advantage, idx) => (
										<li key={idx} className="text-sm flex items-start gap-2">
											<Check className="h-3 w-3 text-green-500 mt-1 shrink-0" />
											{advantage}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Their Likely Themes */}
						{competitor.likelyThemes.length > 0 && (
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									Their Likely Themes
								</label>
								<div className="flex flex-wrap gap-1 mt-1">
									{competitor.likelyThemes.map((theme, idx) => (
										<Badge key={idx} variant="outline" className="text-xs">
											{theme}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Notes */}
						{competitor.notes && (
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									Notes
								</label>
								<p className="text-sm text-muted-foreground mt-1">
									{competitor.notes}
								</p>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Ghost Suggestion Card Component
// =============================================================================

interface GhostSuggestionCardProps {
	suggestion: GhostThemeSuggestion;
	onAddToThemes: () => void;
}

function GhostSuggestionCard({ suggestion, onAddToThemes }: GhostSuggestionCardProps) {
	return (
		<div className="p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
			<div className="flex items-start gap-3">
				<Ghost className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-2">
						{suggestion.competitorName && (
							<Badge variant="outline" className="text-xs">
								vs {suggestion.competitorName}
							</Badge>
						)}
						<Badge variant="secondary" className="text-xs">
							Subtlety: {suggestion.subtletyLevel}/5
						</Badge>
						{suggestion.status !== "pending" && (
							<Badge
								variant={suggestion.status === "accepted" ? "default" : "outline"}
							>
								{suggestion.status === "accepted" ? "Added" : "Dismissed"}
							</Badge>
						)}
					</div>

					<p className="text-sm font-medium italic">"{suggestion.statement}"</p>

					{suggestion.rationale && (
						<p className="text-xs text-muted-foreground mt-2">
							{suggestion.rationale}
						</p>
					)}

					{/* Alternative Phrasings */}
					{suggestion.phrasings.length > 0 && (
						<div className="mt-3">
							<label className="text-xs font-medium text-muted-foreground">
								Alternative Phrasings
							</label>
							<div className="space-y-1 mt-1">
								{suggestion.phrasings.slice(0, 2).map((phrasing, idx) => (
									<p key={idx} className="text-xs text-muted-foreground italic">
										"{phrasing}"
									</p>
								))}
							</div>
						</div>
					)}

					{suggestion.status === "pending" && (
						<Button size="sm" onClick={onAddToThemes} className="mt-3">
							<Plus className="h-3 w-3 mr-1" />
							Add to Themes
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Competitor Form Dialog
// =============================================================================

interface CompetitorFormDialogProps {
	isOpen: boolean;
	onClose: () => void;
	competitor?: Competitor;
	onSave: (data: CreateCompetitorInput) => Promise<void>;
	isSaving: boolean;
}

function CompetitorFormDialog({
	isOpen,
	onClose,
	competitor,
	onSave,
	isSaving,
}: CompetitorFormDialogProps) {
	const isEditMode = !!competitor;

	const [name, setName] = useState(competitor?.name || "");
	const [threatLevel, setThreatLevel] = useState<Competitor["threatLevel"]>(
		competitor?.threatLevel || "medium"
	);
	const [weaknesses, setWeaknesses] = useState(competitor?.weaknesses.join("\n") || "");
	const [likelyThemes, setLikelyThemes] = useState(
		competitor?.likelyThemes.join("\n") || ""
	);
	const [ourAdvantages, setOurAdvantages] = useState(
		competitor?.ourAdvantages.join("\n") || ""
	);
	const [notes, setNotes] = useState(competitor?.notes || "");

	// Reset form when competitor changes
	useEffect(() => {
		if (competitor) {
			setName(competitor.name);
			setThreatLevel(competitor.threatLevel);
			setWeaknesses(competitor.weaknesses.join("\n"));
			setLikelyThemes(competitor.likelyThemes.join("\n"));
			setOurAdvantages(competitor.ourAdvantages.join("\n"));
			setNotes(competitor.notes || "");
		} else {
			setName("");
			setThreatLevel("medium");
			setWeaknesses("");
			setLikelyThemes("");
			setOurAdvantages("");
			setNotes("");
		}
	}, [competitor]);

	const handleSubmit = async () => {
		const data: CreateCompetitorInput = {
			opportunityId: "", // Will be set by parent
			name,
			threatLevel,
			weaknesses: weaknesses
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean),
			likelyThemes: likelyThemes
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean),
			ourAdvantages: ourAdvantages
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean),
			notes: notes.trim() || undefined,
		};
		await onSave(data);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEditMode ? "Edit Competitor" : "Add Competitor"}
					</DialogTitle>
					<DialogDescription>
						Profile a competitor to generate targeted ghost themes
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="name">Competitor Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Enter name..."
							/>
						</div>
						<div className="space-y-2">
							<Label>Threat Level</Label>
							<Select
								value={threatLevel}
								onValueChange={(v) =>
									setThreatLevel(v as Competitor["threatLevel"])
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="high">High Threat</SelectItem>
									<SelectItem value="medium">Medium Threat</SelectItem>
									<SelectItem value="low">Low Threat</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="weaknesses">Their Weaknesses (one per line)</Label>
						<Textarea
							id="weaknesses"
							value={weaknesses}
							onChange={(e) => setWeaknesses(e.target.value)}
							placeholder="Enter weaknesses to exploit..."
							rows={3}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="advantages">Our Advantages (one per line)</Label>
						<Textarea
							id="advantages"
							value={ourAdvantages}
							onChange={(e) => setOurAdvantages(e.target.value)}
							placeholder="Enter our strengths vs this competitor..."
							rows={3}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="likelyThemes">Their Likely Themes (one per line)</Label>
						<Textarea
							id="likelyThemes"
							value={likelyThemes}
							onChange={(e) => setLikelyThemes(e.target.value)}
							placeholder="What themes will they likely emphasize?"
							rows={2}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">Notes</Label>
						<Textarea
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Additional notes..."
							rows={2}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isSaving}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : isEditMode ? (
							"Save Changes"
						) : (
							"Add Competitor"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function GhostThemePanel({
	opportunityId,
	onAddToThemes,
	className,
}: GhostThemePanelProps) {
	// State
	const [competitors, setCompetitors] = useState<Competitor[]>([]);
	const [suggestions, setSuggestions] = useState<GhostThemeSuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(
		new Set()
	);
	const [generatingFor, setGeneratingFor] = useState<string | null>(null);

	// Form dialog state
	const [formDialog, setFormDialog] = useState<{
		isOpen: boolean;
		competitor?: Competitor;
	}>({ isOpen: false });
	const [isSaving, setIsSaving] = useState(false);

	// Delete confirmation
	const [deleteConfirm, setDeleteConfirm] = useState<Competitor | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Load competitors
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);
			const result = await getCompetitors(opportunityId);
			if (result.success && result.data) {
				setCompetitors(result.data);
			} else {
				setError(result.error || "Failed to load competitors");
			}
			setIsLoading(false);
		}
		loadData();
	}, [opportunityId]);

	// Toggle competitor expansion
	const toggleExpanded = useCallback((competitorId: string) => {
		setExpandedCompetitors((prev) => {
			const next = new Set(prev);
			if (next.has(competitorId)) {
				next.delete(competitorId);
			} else {
				next.add(competitorId);
			}
			return next;
		});
	}, []);

	// Save competitor (create or update)
	const handleSaveCompetitor = useCallback(
		async (data: CreateCompetitorInput) => {
			setIsSaving(true);
			setError(null);

			try {
				if (formDialog.competitor) {
					const result = await updateCompetitor(formDialog.competitor.id, data);
					if (result.success && result.data) {
						setCompetitors((prev) =>
							prev.map((c) => (c.id === formDialog.competitor!.id ? result.data! : c))
						);
						setFormDialog({ isOpen: false });
					} else {
						setError(result.error || "Failed to update competitor");
					}
				} else {
					const result = await createCompetitor({
						...data,
						opportunityId,
					});
					if (result.success && result.data) {
						setCompetitors((prev) => [...prev, result.data!]);
						setFormDialog({ isOpen: false });
					} else {
						setError(result.error || "Failed to create competitor");
					}
				}
			} catch (err) {
				setError(`An error occurred: ${err}`);
			} finally {
				setIsSaving(false);
			}
		},
		[opportunityId, formDialog.competitor]
	);

	// Delete competitor
	const handleDeleteCompetitor = useCallback(async () => {
		if (!deleteConfirm) return;

		setIsDeleting(true);
		const result = await deleteCompetitor(deleteConfirm.id);
		if (result.success) {
			setCompetitors((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
			setDeleteConfirm(null);
		} else {
			setError(result.error || "Failed to delete competitor");
		}
		setIsDeleting(false);
	}, [deleteConfirm]);

	// Generate ghost themes for a competitor
	const handleGenerateGhost = useCallback(
		async (competitorId?: string) => {
			setGeneratingFor(competitorId || "all");
			setError(null);

			try {
				const result = await generateGhostThemeSuggestions(
					opportunityId,
					competitorId
				);
				if (result.success && result.data) {
					setSuggestions((prev) => [...result.data!, ...prev]);
				} else {
					setError(result.error || "Failed to generate ghost themes");
				}
			} catch (err) {
				setError(`An error occurred: ${err}`);
			} finally {
				setGeneratingFor(null);
			}
		},
		[opportunityId]
	);

	// Add ghost theme suggestion to themes
	const handleAddToThemes = useCallback(
		(suggestion: GhostThemeSuggestion) => {
			setSuggestions((prev) =>
				prev.map((s) =>
					s.id === suggestion.id ? { ...s, status: "accepted" as const } : s
				)
			);
			onAddToThemes?.(suggestion);
		},
		[onAddToThemes]
	);

	// Loading state
	if (isLoading) {
		return <PanelSkeleton />;
	}

	return (
		<>
			<Card className={cn("w-full", className)}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Ghost className="h-5 w-5 text-purple-500" />
							Competitive Positioning
						</CardTitle>
						<Button
							size="sm"
							onClick={() => setFormDialog({ isOpen: true })}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Competitor
						</Button>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Error Alert */}
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Competitors */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium flex items-center gap-2">
								<Target className="h-4 w-4" />
								Competitors
								<Badge variant="secondary">{competitors.length}</Badge>
							</h3>
							{competitors.length > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleGenerateGhost()}
									disabled={generatingFor !== null}
								>
									{generatingFor === "all" ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Generating...
										</>
									) : (
										<>
											<Sparkles className="h-4 w-4 mr-2" />
											Generate All Ghost Themes
										</>
									)}
								</Button>
							)}
						</div>

						{competitors.length === 0 ? (
							<div className="text-center py-6 border rounded-lg bg-muted/30">
								<Target className="h-8 w-8 mx-auto text-muted-foreground/50" />
								<p className="text-sm text-muted-foreground mt-2">
									No competitors profiled yet
								</p>
								<Button
									size="sm"
									variant="outline"
									className="mt-3"
									onClick={() => setFormDialog({ isOpen: true })}
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Competitor
								</Button>
							</div>
						) : (
							competitors.map((competitor) => (
								<CompetitorCard
									key={competitor.id}
									competitor={competitor}
									isExpanded={expandedCompetitors.has(competitor.id)}
									onToggleExpand={() => toggleExpanded(competitor.id)}
									onEdit={() => setFormDialog({ isOpen: true, competitor })}
									onDelete={() => setDeleteConfirm(competitor)}
									onGenerateGhost={() => handleGenerateGhost(competitor.id)}
									isGenerating={generatingFor === competitor.id}
								/>
							))
						)}
					</div>

					<Separator />

					{/* Ghost Theme Suggestions */}
					<div className="space-y-3">
						<h3 className="text-sm font-medium flex items-center gap-2">
							<Ghost className="h-4 w-4" />
							Ghost Theme Suggestions
							{suggestions.filter((s) => s.status === "pending").length > 0 && (
								<Badge variant="secondary">
									{suggestions.filter((s) => s.status === "pending").length}
								</Badge>
							)}
						</h3>

						{suggestions.length === 0 ? (
							<div className="text-center py-6 border rounded-lg bg-muted/30">
								<Ghost className="h-8 w-8 mx-auto text-muted-foreground/50" />
								<p className="text-sm text-muted-foreground mt-2">
									No ghost theme suggestions yet
								</p>
								{competitors.length > 0 && (
									<Button
										size="sm"
										variant="outline"
										className="mt-3"
										onClick={() => handleGenerateGhost()}
										disabled={generatingFor !== null}
									>
										<Sparkles className="h-4 w-4 mr-2" />
										Generate Suggestions
									</Button>
								)}
							</div>
						) : (
							<div className="space-y-3">
								{suggestions
									.filter((s) => s.status === "pending")
									.map((suggestion) => (
										<GhostSuggestionCard
											key={suggestion.id}
											suggestion={suggestion}
											onAddToThemes={() => handleAddToThemes(suggestion)}
										/>
									))}

								{/* Processed suggestions */}
								{suggestions.filter((s) => s.status !== "pending").length > 0 && (
									<Collapsible>
										<CollapsibleTrigger asChild>
											<Button
												variant="ghost"
												className="w-full justify-start text-muted-foreground"
											>
												<ChevronRight className="h-4 w-4 mr-2" />
												Processed suggestions (
												{suggestions.filter((s) => s.status !== "pending").length})
											</Button>
										</CollapsibleTrigger>
										<CollapsibleContent className="space-y-3 mt-2">
											{suggestions
												.filter((s) => s.status !== "pending")
												.map((suggestion) => (
													<GhostSuggestionCard
														key={suggestion.id}
														suggestion={suggestion}
														onAddToThemes={() => handleAddToThemes(suggestion)}
													/>
												))}
										</CollapsibleContent>
									</Collapsible>
								)}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Competitor Form Dialog */}
			<CompetitorFormDialog
				isOpen={formDialog.isOpen}
				onClose={() => setFormDialog({ isOpen: false })}
				competitor={formDialog.competitor}
				onSave={handleSaveCompetitor}
				isSaving={isSaving}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Competitor</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteConfirm?.name}"? This will also
							remove any ghost themes associated with this competitor.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteConfirm(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleDeleteCompetitor}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

export default GhostThemePanel;
