"use client";

/**
 * Factor Editor Component
 *
 * Comprehensive editor for managing PWin factors including creating,
 * updating, and configuring scoring guidelines. Supports category
 * assignment, weight configuration, and detailed scoring rubrics.
 *
 * Features:
 * - CRUD operations for PWin factors
 * - Scoring guideline builder with score-description pairs
 * - Category and weight configuration
 * - Factor activation/deactivation
 * - Drag-and-drop guideline reordering
 *
 * @example
 * ```tsx
 * <FactorEditor
 *   factor={existingFactor}
 *   onSave={(factor) => console.log("Saved:", factor)}
 *   onCancel={() => setIsEditing(false)}
 * />
 * ```
 */

import { useState, useCallback, useMemo } from "react";
import {
	Save,
	Plus,
	Trash2,
	Loader2,
	AlertCircle,
	GripVertical,
	ChevronUp,
	ChevronDown,
	Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
	createPwinFactor,
	updatePwinFactor,
	deletePwinFactor,
} from "@/lib/actions/pwin";
import type {
	PwinFactor,
	FactorCategory,
} from "@/lib/types/pwin";

// ============================================================================
// Types
// ============================================================================

interface FactorEditorProps {
	factor?: PwinFactor;
	organizationId?: string;
	onSave?: (factor: PwinFactor) => void;
	onDelete?: () => void;
	onCancel?: () => void;
	className?: string;
}

interface ScoringGuideline {
	score: number;
	description: string;
}

interface FactorFormState {
	factorName: string;
	factorCategory: FactorCategory;
	description: string;
	weight: number;
	minScore: number;
	maxScore: number;
	scoringGuidelines: ScoringGuideline[];
	isActive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_OPTIONS: Array<{ value: FactorCategory; label: string; description: string }> = [
	{
		value: "customer",
		label: "Customer",
		description: "Customer relationship and engagement factors",
	},
	{
		value: "solution",
		label: "Solution",
		description: "Technical solution and capability factors",
	},
	{
		value: "competition",
		label: "Competition",
		description: "Competitive positioning and market factors",
	},
	{
		value: "team",
		label: "Team",
		description: "Personnel qualifications and availability",
	},
	{
		value: "price",
		label: "Price",
		description: "Pricing strategy and competitiveness",
	},
	{
		value: "contract",
		label: "Contract",
		description: "Contract terms and vehicle factors",
	},
];

const DEFAULT_GUIDELINES: ScoringGuideline[] = [
	{ score: 0, description: "Not applicable / No evidence" },
	{ score: 5, description: "Moderate / Average" },
	{ score: 10, description: "Excellent / Best-in-class" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getInitialFormState(factor?: PwinFactor): FactorFormState {
	if (factor) {
		return {
			factorName: factor.factorName,
			factorCategory: factor.factorCategory as FactorCategory,
			description: factor.description ?? "",
			weight: factor.weight ?? 1,
			minScore: factor.minScore ?? 0,
			maxScore: factor.maxScore ?? 10,
			scoringGuidelines: (factor.scoringGuidelines as ScoringGuideline[]) ?? DEFAULT_GUIDELINES,
			isActive: factor.isActive ?? true,
		};
	}

	return {
		factorName: "",
		factorCategory: "solution",
		description: "",
		weight: 1,
		minScore: 0,
		maxScore: 10,
		scoringGuidelines: [...DEFAULT_GUIDELINES],
		isActive: true,
	};
}

function validateForm(form: FactorFormState): string | null {
	if (!form.factorName.trim()) {
		return "Factor name is required";
	}
	if (form.factorName.length > 200) {
		return "Factor name must be 200 characters or less";
	}
	if (form.weight < 0 || form.weight > 10) {
		return "Weight must be between 0 and 10";
	}
	if (form.minScore >= form.maxScore) {
		return "Minimum score must be less than maximum score";
	}
	if (form.scoringGuidelines.length === 0) {
		return "At least one scoring guideline is required";
	}
	for (const guideline of form.scoringGuidelines) {
		if (guideline.score < form.minScore || guideline.score > form.maxScore) {
			return `Guideline score ${guideline.score} is outside the valid range`;
		}
		if (!guideline.description.trim()) {
			return "All guidelines must have a description";
		}
	}
	return null;
}

// ============================================================================
// Component
// ============================================================================

export function FactorEditor({
	factor,
	organizationId,
	onSave,
	onDelete,
	onCancel,
	className,
}: FactorEditorProps) {
	// State
	const [form, setForm] = useState<FactorFormState>(() => getInitialFormState(factor));
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Derived state
	const isEditing = !!factor;
	const formError = useMemo(() => validateForm(form), [form]);

	// Form field updaters
	const updateField = useCallback(<K extends keyof FactorFormState>(
		field: K,
		value: FactorFormState[K]
	) => {
		setForm(prev => ({ ...prev, [field]: value }));
		setError(null);
	}, []);

	// Guideline management
	const addGuideline = useCallback(() => {
		setForm(prev => ({
			...prev,
			scoringGuidelines: [
				...prev.scoringGuidelines,
				{ score: Math.floor((prev.minScore + prev.maxScore) / 2), description: "" },
			],
		}));
	}, []);

	const updateGuideline = useCallback((index: number, updates: Partial<ScoringGuideline>) => {
		setForm(prev => ({
			...prev,
			scoringGuidelines: prev.scoringGuidelines.map((g, i) =>
				i === index ? { ...g, ...updates } : g
			),
		}));
	}, []);

	const removeGuideline = useCallback((index: number) => {
		setForm(prev => ({
			...prev,
			scoringGuidelines: prev.scoringGuidelines.filter((_, i) => i !== index),
		}));
	}, []);

	const moveGuideline = useCallback((index: number, direction: "up" | "down") => {
		setForm(prev => {
			const newIndex = direction === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= prev.scoringGuidelines.length) {
				return prev;
			}
			const newGuidelines = [...prev.scoringGuidelines];
			[newGuidelines[index], newGuidelines[newIndex]] = [newGuidelines[newIndex], newGuidelines[index]];
			return { ...prev, scoringGuidelines: newGuidelines };
		});
	}, []);

	// Sort guidelines by score
	const sortGuidelinesByScore = useCallback(() => {
		setForm(prev => ({
			...prev,
			scoringGuidelines: [...prev.scoringGuidelines].sort((a, b) => a.score - b.score),
		}));
	}, []);

	// Save handler
	const handleSave = useCallback(async () => {
		const validationError = validateForm(form);
		if (validationError) {
			setError(validationError);
			return;
		}

		setIsSaving(true);
		setError(null);

		try {
			if (isEditing && factor) {
				const result = await updatePwinFactor(factor.id, {
					factorName: form.factorName,
					factorCategory: form.factorCategory,
					description: form.description || undefined,
					weight: form.weight,
					minScore: form.minScore,
					maxScore: form.maxScore,
					scoringGuidelines: form.scoringGuidelines,
					isActive: form.isActive,
				});

				if (result.success) {
					onSave?.(result.data);
				} else {
					setError(result.error);
				}
			} else {
				const result = await createPwinFactor({
					factorName: form.factorName,
					factorCategory: form.factorCategory,
					description: form.description || undefined,
					weight: form.weight,
					minScore: form.minScore,
					maxScore: form.maxScore,
					scoringGuidelines: form.scoringGuidelines,
					organizationId,
				});

				if (result.success) {
					onSave?.(result.data);
				} else {
					setError(result.error);
				}
			}
		} catch (err) {
			setError("An unexpected error occurred");
		}

		setIsSaving(false);
	}, [form, isEditing, factor, organizationId, onSave]);

	// Delete handler
	const handleDelete = useCallback(async () => {
		if (!factor || !window.confirm("Are you sure you want to delete this factor?")) {
			return;
		}

		setIsDeleting(true);
		setError(null);

		const result = await deletePwinFactor(factor.id);

		if (result.success) {
			onDelete?.();
		} else {
			setError(result.error);
		}

		setIsDeleting(false);
	}, [factor, onDelete]);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Settings2 className="h-5 w-5 text-primary" />
					{isEditing ? "Edit Factor" : "Create Factor"}
				</CardTitle>
				<CardDescription>
					{isEditing
						? "Modify factor settings and scoring guidelines"
						: "Define a new PWin assessment factor"}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Display */}
				{error && (
					<div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
						<AlertCircle className="h-4 w-4 flex-shrink-0" />
						<span className="text-sm">{error}</span>
					</div>
				)}

				{/* Basic Information */}
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="factor-name">Factor Name *</Label>
						<Input
							id="factor-name"
							value={form.factorName}
							onChange={(e) => updateField("factorName", e.target.value)}
							placeholder="e.g., Customer Relationship"
							maxLength={200}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="factor-category">Category *</Label>
						<Select
							value={form.factorCategory}
							onValueChange={(value) => updateField("factorCategory", value as FactorCategory)}
						>
							<SelectTrigger id="factor-category">
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								{CATEGORY_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										<div className="flex flex-col">
											<span>{opt.label}</span>
											<span className="text-xs text-muted-foreground">
												{opt.description}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={form.description}
							onChange={(e) => updateField("description", e.target.value)}
							placeholder="Describe what this factor measures and how it impacts PWin..."
							rows={3}
						/>
					</div>
				</div>

				<Separator />

				{/* Scoring Configuration */}
				<div className="space-y-4">
					<h4 className="font-medium">Scoring Configuration</h4>

					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label htmlFor="weight">Weight (0-10)</Label>
							<div className="flex items-center gap-2">
								<Slider
									id="weight"
									value={[form.weight]}
									onValueChange={([value]) => updateField("weight", value)}
									min={0}
									max={10}
									step={0.5}
									className="flex-1"
								/>
								<span className="w-10 text-center font-medium">{form.weight}</span>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="min-score">Min Score</Label>
							<Input
								id="min-score"
								type="number"
								value={form.minScore}
								onChange={(e) => updateField("minScore", parseInt(e.target.value) || 0)}
								min={0}
								max={form.maxScore - 1}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="max-score">Max Score</Label>
							<Input
								id="max-score"
								type="number"
								value={form.maxScore}
								onChange={(e) => updateField("maxScore", parseInt(e.target.value) || 10)}
								min={form.minScore + 1}
							/>
						</div>
					</div>

					{isEditing && (
						<div className="flex items-center gap-2">
							<Switch
								id="is-active"
								checked={form.isActive}
								onCheckedChange={(checked) => updateField("isActive", checked)}
							/>
							<Label htmlFor="is-active" className="cursor-pointer">
								Active
							</Label>
							{!form.isActive && (
								<Badge variant="secondary" className="ml-2">
									Inactive factors are not included in assessments
								</Badge>
							)}
						</div>
					)}
				</div>

				<Separator />

				{/* Scoring Guidelines */}
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h4 className="font-medium">Scoring Guidelines</h4>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={sortGuidelinesByScore}
								disabled={form.scoringGuidelines.length < 2}
							>
								Sort by Score
							</Button>
							<Button variant="outline" size="sm" onClick={addGuideline}>
								<Plus className="h-4 w-4 mr-1" />
								Add Guideline
							</Button>
						</div>
					</div>

					<div className="space-y-3">
						{form.scoringGuidelines.map((guideline, idx) => (
							<GuidelineRow
								key={idx}
								index={idx}
								guideline={guideline}
								minScore={form.minScore}
								maxScore={form.maxScore}
								totalCount={form.scoringGuidelines.length}
								onUpdate={updateGuideline}
								onRemove={removeGuideline}
								onMove={moveGuideline}
							/>
						))}

						{form.scoringGuidelines.length === 0 && (
							<div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
								<p>No scoring guidelines defined</p>
								<Button variant="link" onClick={addGuideline}>
									Add your first guideline
								</Button>
							</div>
						)}
					</div>
				</div>
			</CardContent>

			<CardFooter className="flex justify-between border-t pt-6">
				<div className="flex gap-2">
					{isEditing && onDelete && (
						<Button
							variant="danger"
							onClick={handleDelete}
							disabled={isDeleting || isSaving}
						>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</>
							)}
						</Button>
					)}
				</div>

				<div className="flex gap-2">
					{onCancel && (
						<Button
							variant="outline"
							onClick={onCancel}
							disabled={isSaving || isDeleting}
						>
							Cancel
						</Button>
					)}
					<Button
						onClick={handleSave}
						disabled={isSaving || isDeleting || !!formError}
					>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Save className="h-4 w-4 mr-2" />
								{isEditing ? "Update Factor" : "Create Factor"}
							</>
						)}
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}

// ============================================================================
// Guideline Row Sub-Component
// ============================================================================

interface GuidelineRowProps {
	index: number;
	guideline: ScoringGuideline;
	minScore: number;
	maxScore: number;
	totalCount: number;
	onUpdate: (index: number, updates: Partial<ScoringGuideline>) => void;
	onRemove: (index: number) => void;
	onMove: (index: number, direction: "up" | "down") => void;
}

function GuidelineRow({
	index,
	guideline,
	minScore,
	maxScore,
	totalCount,
	onUpdate,
	onRemove,
	onMove,
}: GuidelineRowProps) {
	return (
		<div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
			<div className="flex flex-col gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={() => onMove(index, "up")}
					disabled={index === 0}
				>
					<ChevronUp className="h-3 w-3" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={() => onMove(index, "down")}
					disabled={index === totalCount - 1}
				>
					<ChevronDown className="h-3 w-3" />
				</Button>
			</div>

			<div className="flex items-center gap-2 w-20">
				<Label className="text-xs text-muted-foreground">Score</Label>
				<Input
					type="number"
					value={guideline.score}
					onChange={(e) => onUpdate(index, { score: parseInt(e.target.value) || 0 })}
					min={minScore}
					max={maxScore}
					className="h-8 w-16"
				/>
			</div>

			<div className="flex-1">
				<Input
					value={guideline.description}
					onChange={(e) => onUpdate(index, { description: e.target.value })}
					placeholder="Description for this score level..."
					className="h-8"
				/>
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 text-muted-foreground hover:text-destructive"
				onClick={() => onRemove(index)}
				disabled={totalCount <= 1}
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}

export default FactorEditor;
