/**
 * ThemeEditor - Create/Edit Win Theme Form
 *
 * Comprehensive form for creating and editing win themes with rich text,
 * character limits, type selection, priority slider, evidence picker,
 * related projects, and ghost theme configuration.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Save,
	X,
	Target,
	Zap,
	Award,
	Shield,
	Plus,
	Trash2,
	AlertCircle,
	Loader2,
	Info,
	Search,
	Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type {
	WinTheme,
	WinThemeType,
	ThemePriority,
	GhostTheme,
	CreateWinThemeInput,
	UpdateWinThemeInput,
} from "@/lib/types/win-themes";
import { createTheme, updateTheme } from "@/lib/actions/win-themes";

// =============================================================================
// Types
// =============================================================================

export interface ThemeEditorProps {
	/** Opportunity ID for new themes */
	opportunityId: string;
	/** Existing theme to edit (undefined for create mode) */
	theme?: WinTheme;
	/** Callback when theme is saved */
	onSave?: (theme: WinTheme) => void;
	/** Callback when cancelled */
	onCancel?: () => void;
	/** Available past performance projects for selection */
	availableProjects?: { id: string; name: string; relevance?: number }[];
	/** Available competitors for ghost themes */
	availableCompetitors?: { id: string; name: string }[];
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const THEME_TYPES: {
	value: WinThemeType;
	label: string;
	icon: typeof Target;
	description: string;
}[] = [
	{
		value: "value_prop",
		label: "Value Proposition",
		icon: Target,
		description: "Core benefit or value you deliver to the customer",
	},
	{
		value: "differentiator",
		label: "Differentiator",
		icon: Zap,
		description: "What sets you apart from competitors",
	},
	{
		value: "proof_point",
		label: "Proof Point",
		icon: Award,
		description: "Evidence or validation of your claims",
	},
	{
		value: "risk_mitigation",
		label: "Risk Mitigation",
		icon: Shield,
		description: "How you reduce risk for the customer",
	},
];

const MAX_SHORT_VERSION_LENGTH = 100;

// =============================================================================
// Helper Components
// =============================================================================

interface CharacterCounterProps {
	current: number;
	max: number;
}

function CharacterCounter({ current, max }: CharacterCounterProps) {
	const percentage = (current / max) * 100;
	const isWarning = percentage >= 80 && percentage < 100;
	const isError = percentage >= 100;

	return (
		<span
			className={cn(
				"text-xs",
				isError && "text-destructive",
				isWarning && "text-amber-600",
				!isWarning && !isError && "text-muted-foreground"
			)}
		>
			{current}/{max}
		</span>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function ThemeEditor({
	opportunityId,
	theme,
	onSave,
	onCancel,
	availableProjects = [],
	availableCompetitors = [],
	className,
}: ThemeEditorProps) {
	const isEditMode = !!theme;

	// Form state
	const [statement, setStatement] = useState(theme?.statement || "");
	const [shortVersion, setShortVersion] = useState(theme?.shortVersion || "");
	const [themeType, setThemeType] = useState<WinThemeType>(theme?.type || "value_prop");
	const [priority, setPriority] = useState<ThemePriority>(theme?.priority || 3);
	const [supportingEvidence, setSupportingEvidence] = useState<string[]>(
		theme?.supportingEvidence || []
	);
	const [newEvidence, setNewEvidence] = useState("");
	const [relatedProjectIds, setRelatedProjectIds] = useState<string[]>(
		theme?.relatedProjectIds || []
	);
	const [keywords, setKeywords] = useState<string[]>(theme?.keywords || []);
	const [newKeyword, setNewKeyword] = useState("");

	// Ghost theme state
	const [hasGhostTheme, setHasGhostTheme] = useState(!!theme?.ghostTheme);
	const [ghostCompetitorId, setGhostCompetitorId] = useState(
		theme?.ghostTheme?.competitorId || ""
	);
	const [ghostCompetitorName, setGhostCompetitorName] = useState(
		theme?.ghostTheme?.competitorName || ""
	);
	const [ghostCounterPositioning, setGhostCounterPositioning] = useState(
		theme?.ghostTheme?.counterPositioning || ""
	);
	const [ghostSubtlety, setGhostSubtlety] = useState<1 | 2 | 3 | 4 | 5>(
		theme?.ghostTheme?.subtletyLevel || 3
	);
	const [ghostPhrasings, setGhostPhrasings] = useState<string[]>(
		theme?.ghostTheme?.phrasings || []
	);
	const [newPhrasing, setNewPhrasing] = useState("");

	// UI state
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [projectSearch, setProjectSearch] = useState("");

	// Validation
	const validationErrors = useMemo(() => {
		const errors: string[] = [];
		if (!statement.trim()) errors.push("Statement is required");
		if (!shortVersion.trim()) errors.push("Short version is required");
		if (shortVersion.length > MAX_SHORT_VERSION_LENGTH) {
			errors.push(`Short version exceeds ${MAX_SHORT_VERSION_LENGTH} characters`);
		}
		if (hasGhostTheme && !ghostCounterPositioning.trim()) {
			errors.push("Ghost theme counter-positioning is required");
		}
		return errors;
	}, [statement, shortVersion, hasGhostTheme, ghostCounterPositioning]);

	const isValid = validationErrors.length === 0;

	// Filter available projects by search
	const filteredProjects = useMemo(() => {
		if (!projectSearch.trim()) return availableProjects;
		const search = projectSearch.toLowerCase();
		return availableProjects.filter((p) =>
			p.name.toLowerCase().includes(search)
		);
	}, [availableProjects, projectSearch]);

	// Add evidence
	const handleAddEvidence = useCallback(() => {
		if (newEvidence.trim()) {
			setSupportingEvidence((prev) => [...prev, newEvidence.trim()]);
			setNewEvidence("");
		}
	}, [newEvidence]);

	// Remove evidence
	const handleRemoveEvidence = useCallback((index: number) => {
		setSupportingEvidence((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// Add keyword
	const handleAddKeyword = useCallback(() => {
		if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
			setKeywords((prev) => [...prev, newKeyword.trim()]);
			setNewKeyword("");
		}
	}, [newKeyword, keywords]);

	// Remove keyword
	const handleRemoveKeyword = useCallback((keyword: string) => {
		setKeywords((prev) => prev.filter((k) => k !== keyword));
	}, []);

	// Toggle project selection
	const handleToggleProject = useCallback((projectId: string) => {
		setRelatedProjectIds((prev) =>
			prev.includes(projectId)
				? prev.filter((id) => id !== projectId)
				: [...prev, projectId]
		);
	}, []);

	// Add ghost phrasing
	const handleAddPhrasing = useCallback(() => {
		if (newPhrasing.trim()) {
			setGhostPhrasings((prev) => [...prev, newPhrasing.trim()]);
			setNewPhrasing("");
		}
	}, [newPhrasing]);

	// Remove ghost phrasing
	const handleRemovePhrasing = useCallback((index: number) => {
		setGhostPhrasings((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// Handle save
	const handleSave = useCallback(async () => {
		if (!isValid) return;

		setIsSaving(true);
		setError(null);

		try {
			const ghostTheme: Omit<GhostTheme, "id"> | undefined = hasGhostTheme
				? {
						competitorId: ghostCompetitorId || undefined,
						competitorName: ghostCompetitorName || undefined,
						counterPositioning: ghostCounterPositioning,
						subtletyLevel: ghostSubtlety,
						phrasings: ghostPhrasings,
					}
				: undefined;

			if (isEditMode && theme) {
				const input: UpdateWinThemeInput = {
					statement,
					shortVersion,
					type: themeType,
					priority,
					supportingEvidence,
					relatedProjectIds,
					keywords,
					ghostTheme: hasGhostTheme ? ghostTheme : null,
				};

				const result = await updateTheme(theme.id, input);
				if (result.success && result.data) {
					onSave?.(result.data);
				} else {
					setError(result.error || "Failed to update theme");
				}
			} else {
				const input: CreateWinThemeInput = {
					opportunityId,
					statement,
					shortVersion,
					type: themeType,
					priority,
					supportingEvidence,
					relatedProjectIds,
					keywords,
					ghostTheme,
				};

				const result = await createTheme(input);
				if (result.success && result.data) {
					onSave?.(result.data);
				} else {
					setError(result.error || "Failed to create theme");
				}
			}
		} catch (err) {
			setError(`An error occurred: ${err}`);
		} finally {
			setIsSaving(false);
		}
	}, [
		isValid,
		isEditMode,
		theme,
		opportunityId,
		statement,
		shortVersion,
		themeType,
		priority,
		supportingEvidence,
		relatedProjectIds,
		keywords,
		hasGhostTheme,
		ghostCompetitorId,
		ghostCompetitorName,
		ghostCounterPositioning,
		ghostSubtlety,
		ghostPhrasings,
		onSave,
	]);

	// Get selected theme type info
	const selectedTypeInfo = THEME_TYPES.find((t) => t.value === themeType);
	const TypeIcon = selectedTypeInfo?.icon || Target;

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<TypeIcon className="h-5 w-5" />
						{isEditMode ? "Edit Win Theme" : "Create Win Theme"}
					</CardTitle>
					<Button variant="ghost" size="icon" onClick={onCancel}>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Theme Statement */}
				<div className="space-y-2">
					<Label htmlFor="statement">Theme Statement</Label>
					<Textarea
						id="statement"
						value={statement}
						onChange={(e) => setStatement(e.target.value)}
						placeholder="Enter the full win theme statement..."
						rows={4}
						className="resize-none"
					/>
					<p className="text-xs text-muted-foreground">
						The complete, persuasive statement that captures your theme
					</p>
				</div>

				{/* Short Version */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="shortVersion">Short Version</Label>
						<CharacterCounter
							current={shortVersion.length}
							max={MAX_SHORT_VERSION_LENGTH}
						/>
					</div>
					<Input
						id="shortVersion"
						value={shortVersion}
						onChange={(e) => setShortVersion(e.target.value)}
						placeholder="Brief version for quick reference..."
						maxLength={MAX_SHORT_VERSION_LENGTH + 10}
					/>
					<p className="text-xs text-muted-foreground">
						A concise summary used in lists and heat maps
					</p>
				</div>

				{/* Type and Priority Row */}
				<div className="grid grid-cols-2 gap-4">
					{/* Theme Type */}
					<div className="space-y-2">
						<Label>Theme Type</Label>
						<Select value={themeType} onValueChange={(v) => setThemeType(v as WinThemeType)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{THEME_TYPES.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										<div className="flex items-center gap-2">
											<type.icon className="h-4 w-4" />
											{type.label}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedTypeInfo && (
							<p className="text-xs text-muted-foreground">
								{selectedTypeInfo.description}
							</p>
						)}
					</div>

					{/* Priority */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label>Priority</Label>
							<Badge
								className={cn(
									priority === 5 && "bg-red-500",
									priority === 4 && "bg-orange-500",
									priority === 3 && "bg-yellow-500 text-black",
									priority === 2 && "bg-blue-500",
									priority === 1 && "bg-gray-400"
								)}
							>
								P{priority}
							</Badge>
						</div>
						<Slider
							value={[priority]}
							min={1}
							max={5}
							step={1}
							onValueChange={([v]) => setPriority(v as ThemePriority)}
						/>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>Lower</span>
							<span>Higher</span>
						</div>
					</div>
				</div>

				<Separator />

				{/* Supporting Evidence */}
				<div className="space-y-2">
					<Label>Supporting Evidence</Label>
					<div className="flex gap-2">
						<Input
							value={newEvidence}
							onChange={(e) => setNewEvidence(e.target.value)}
							placeholder="Add evidence..."
							onKeyDown={(e) => e.key === "Enter" && handleAddEvidence()}
						/>
						<Button variant="outline" size="icon" onClick={handleAddEvidence}>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
					{supportingEvidence.length > 0 && (
						<ul className="space-y-1 mt-2">
							{supportingEvidence.map((evidence, idx) => (
								<li
									key={idx}
									className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded"
								>
									<Check className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
									<span className="flex-1">{evidence}</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => handleRemoveEvidence(idx)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Keywords */}
				<div className="space-y-2">
					<Label>Keywords</Label>
					<div className="flex gap-2">
						<Input
							value={newKeyword}
							onChange={(e) => setNewKeyword(e.target.value)}
							placeholder="Add keyword..."
							onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
						/>
						<Button variant="outline" size="icon" onClick={handleAddKeyword}>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
					{keywords.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							{keywords.map((keyword) => (
								<Badge
									key={keyword}
									variant="secondary"
									className="gap-1 cursor-pointer hover:bg-destructive/20"
									onClick={() => handleRemoveKeyword(keyword)}
								>
									{keyword}
									<X className="h-3 w-3" />
								</Badge>
							))}
						</div>
					)}
					<p className="text-xs text-muted-foreground">
						Keywords help with theme detection and consistency analysis
					</p>
				</div>

				{/* Related Projects */}
				{availableProjects.length > 0 && (
					<div className="space-y-2">
						<Label>Related Past Performance</Label>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								value={projectSearch}
								onChange={(e) => setProjectSearch(e.target.value)}
								placeholder="Search projects..."
								className="pl-9"
							/>
						</div>
						<div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
							{filteredProjects.map((project) => (
								<div
									key={project.id}
									className={cn(
										"flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50",
										relatedProjectIds.includes(project.id) && "bg-primary/10"
									)}
									onClick={() => handleToggleProject(project.id)}

				role="button"
				tabIndex={0}
				onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
									<div
										className={cn(
											"h-4 w-4 border rounded flex items-center justify-center",
											relatedProjectIds.includes(project.id) &&
												"bg-primary border-primary"
										)}
									>
										{relatedProjectIds.includes(project.id) && (
											<Check className="h-3 w-3 text-primary-foreground" />
										)}
									</div>
									<span className="text-sm flex-1">{project.name}</span>
									{project.relevance && (
										<Badge variant="outline" className="text-xs">
											{project.relevance}% relevant
										</Badge>
									)}
								</div>
							))}
							{filteredProjects.length === 0 && (
								<p className="text-sm text-muted-foreground text-center py-2">
									No projects found
								</p>
							)}
						</div>
					</div>
				)}

				<Separator />

				{/* Ghost Theme Section */}
				<Collapsible open={hasGhostTheme} onOpenChange={setHasGhostTheme}>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="sm" className="gap-2">
									<Shield className="h-4 w-4" />
									Ghost Theme (Competitive Positioning)
								</Button>
							</CollapsibleTrigger>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger>
										<Info className="h-4 w-4 text-muted-foreground" />
									</TooltipTrigger>
									<TooltipContent className="max-w-[300px]">
										<p>
											Ghost themes subtly position against competitors without
											directly naming them. They highlight your strengths in areas
											where competitors are weak.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<Switch checked={hasGhostTheme} onCheckedChange={setHasGhostTheme} />
					</div>

					<CollapsibleContent className="space-y-4 mt-4">
						<div className="p-4 border rounded-lg space-y-4 bg-muted/30">
							{/* Competitor Selection */}
							<div className="grid grid-cols-2 gap-4">
								{availableCompetitors.length > 0 ? (
									<div className="space-y-2">
										<Label>Target Competitor</Label>
										<Select
											value={ghostCompetitorId}
											onValueChange={(v) => {
												setGhostCompetitorId(v);
												const comp = availableCompetitors.find((c) => c.id === v);
												setGhostCompetitorName(comp?.name || "");
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select competitor..." />
											</SelectTrigger>
											<SelectContent>
												{availableCompetitors.map((comp) => (
													<SelectItem key={comp.id} value={comp.id}>
														{comp.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								) : (
									<div className="space-y-2">
										<Label>Competitor Name</Label>
										<Input
											value={ghostCompetitorName}
											onChange={(e) => setGhostCompetitorName(e.target.value)}
											placeholder="Enter competitor name..."
										/>
									</div>
								)}

								{/* Subtlety Level */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label>Subtlety Level</Label>
										<Badge variant="outline">{ghostSubtlety}/5</Badge>
									</div>
									<Slider
										value={[ghostSubtlety]}
										min={1}
										max={5}
										step={1}
										onValueChange={([v]) =>
											setGhostSubtlety(v as 1 | 2 | 3 | 4 | 5)
										}
									/>
									<div className="flex justify-between text-xs text-muted-foreground">
										<span>Direct</span>
										<span>Very Subtle</span>
									</div>
								</div>
							</div>

							{/* Counter Positioning */}
							<div className="space-y-2">
								<Label>Counter-Positioning Statement</Label>
								<Textarea
									value={ghostCounterPositioning}
									onChange={(e) => setGhostCounterPositioning(e.target.value)}
									placeholder="How we position against this competitor's weakness..."
									rows={3}
								/>
							</div>

							{/* Alternative Phrasings */}
							<div className="space-y-2">
								<Label>Alternative Phrasings</Label>
								<div className="flex gap-2">
									<Input
										value={newPhrasing}
										onChange={(e) => setNewPhrasing(e.target.value)}
										placeholder="Add alternative phrasing..."
										onKeyDown={(e) => e.key === "Enter" && handleAddPhrasing()}
									/>
									<Button variant="outline" size="icon" onClick={handleAddPhrasing}>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								{ghostPhrasings.length > 0 && (
									<ul className="space-y-1 mt-2">
										{ghostPhrasings.map((phrasing, idx) => (
											<li
												key={idx}
												className="flex items-start gap-2 text-sm p-2 bg-background rounded border"
											>
												<span className="flex-1 italic">"{phrasing}"</span>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6"
													onClick={() => handleRemovePhrasing(idx)}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>

				{/* Validation Errors */}
				{validationErrors.length > 0 && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							<ul className="list-disc list-inside">
								{validationErrors.map((err, idx) => (
									<li key={idx}>{err}</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}

				{/* Actions */}
				<div className="flex justify-end gap-2 pt-4">
					<Button variant="outline" onClick={onCancel} disabled={isSaving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!isValid || isSaving}>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Save className="h-4 w-4 mr-2" />
								{isEditMode ? "Update Theme" : "Create Theme"}
							</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default ThemeEditor;
