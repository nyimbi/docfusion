/**
 * EvidenceEditor - Create/Edit Evidence Form
 *
 * Comprehensive form for creating and editing evidence with rich fields,
 * quantification section, source information, and strength preview.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
	Save,
	X,
	Plus,
	Trash2,
	AlertCircle,
	Loader2,
	Info,
	Award,
	TrendingUp,
	Calendar,
	Link as LinkIcon,
	User,
	Building,
	Check,
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type {
	Evidence,
	EvidenceType,
	EvidenceCategory,
	EvidenceQuantification,
	CreateEvidenceInput,
	UpdateEvidenceInput,
} from "@/lib/types/evidence";
import { createEvidence, updateEvidence } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceEditorProps {
	/** Existing evidence to edit (undefined for create mode) */
	evidence?: Evidence;
	/** Callback when evidence is saved */
	onSave?: (evidence: Evidence) => void;
	/** Callback when cancelled */
	onCancel?: () => void;
	/** Available capabilities for selection */
	availableCapabilities?: { id: string; name: string }[];
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EVIDENCE_TYPES: { value: EvidenceType; label: string; description: string }[] = [
	{ value: "metric", label: "Metric", description: "Quantifiable measurements and statistics" },
	{ value: "testimonial", label: "Testimonial", description: "Customer quotes and endorsements" },
	{ value: "case_study", label: "Case Study", description: "Detailed project narratives" },
	{ value: "certification", label: "Certification", description: "Industry certifications and awards" },
	{ value: "capability", label: "Capability", description: "Technical or organizational capabilities" },
	{ value: "past_performance", label: "Past Performance", description: "Previous contract/project results" },
	{ value: "reference", label: "Reference", description: "Customer references" },
];

const EVIDENCE_CATEGORIES: { value: EvidenceCategory; label: string }[] = [
	{ value: "technical", label: "Technical" },
	{ value: "management", label: "Management" },
	{ value: "past_performance", label: "Past Performance" },
	{ value: "corporate", label: "Corporate" },
	{ value: "staffing", label: "Staffing" },
	{ value: "cost", label: "Cost" },
	{ value: "risk", label: "Risk" },
	{ value: "innovation", label: "Innovation" },
];

const SOURCE_TYPES = [
	{ value: "internal", label: "Internal Document" },
	{ value: "external", label: "External Source" },
	{ value: "customer", label: "Customer" },
	{ value: "third_party", label: "Third Party" },
];

// =============================================================================
// Helper Components
// =============================================================================

interface StrengthPreviewProps {
	score: number;
}

function StrengthPreview({ score }: StrengthPreviewProps) {
	const tier = score >= 80 ? "gold" : score >= 60 ? "silver" : "bronze";
	const tierColors = {
		gold: "text-yellow-600 bg-yellow-100",
		silver: "text-gray-600 bg-gray-100",
		bronze: "text-orange-600 bg-orange-100",
	};

	return (
		<div className="p-4 bg-muted/50 rounded-lg space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">Strength Score</span>
				<Badge className={cn("font-bold", tierColors[tier])}>
					{tier.charAt(0).toUpperCase() + tier.slice(1)} ({score})
				</Badge>
			</div>
			<Progress value={score} className="h-2" />
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>Bronze (0-59)</span>
				<span>Silver (60-79)</span>
				<span>Gold (80-100)</span>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceEditor({
	evidence,
	onSave,
	onCancel,
	availableCapabilities = [],
	className,
}: EvidenceEditorProps) {
	const isEditMode = !!evidence;

	// Form state
	const [title, setTitle] = useState(evidence?.title || "");
	const [content, setContent] = useState(evidence?.content || "");
	const [evidenceType, setEvidenceType] = useState<EvidenceType>(evidence?.type || "metric");
	const [category, setCategory] = useState<EvidenceCategory>(evidence?.category || "technical");
	const [subcategory, setSubcategory] = useState(evidence?.subcategory || "");
	const [tags, setTags] = useState<string[]>(evidence?.tags || []);
	const [newTag, setNewTag] = useState("");

	// Quantification state
	const [hasQuantification, setHasQuantification] = useState(!!evidence?.quantification);
	const [metric, setMetric] = useState(evidence?.quantification?.metric || "");
	const [metricValue, setMetricValue] = useState<number | "">(evidence?.quantification?.value || "");
	const [unit, setUnit] = useState(evidence?.quantification?.unit || "");
	const [context, setContext] = useState(evidence?.quantification?.context || "");
	const [baseline, setBaseline] = useState<number | "">(evidence?.quantification?.baseline || "");
	const [improvement, setImprovement] = useState<number | "">(evidence?.quantification?.improvement || "");
	const [timeframe, setTimeframe] = useState(evidence?.quantification?.timeframe || "");

	// Source state
	const [hasSource, setHasSource] = useState(!!evidence?.source);
	const [sourceType, setSourceType] = useState(evidence?.source?.type || "internal");
	const [sourceName, setSourceName] = useState(evidence?.source?.name || "");
	const [sourceDocument, setSourceDocument] = useState(evidence?.source?.document || "");
	const [sourceUrl, setSourceUrl] = useState(evidence?.source?.url || "");
	const [sourceContact, setSourceContact] = useState(evidence?.source?.contactInfo || "");

	// Related capabilities
	const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(
		evidence?.relatedCapabilities || []
	);

	// Expiration
	const [hasExpiration, setHasExpiration] = useState(!!evidence?.expiresAt);
	const [expiresAt, setExpiresAt] = useState(
		evidence?.expiresAt ? new Date(evidence.expiresAt).toISOString().split("T")[0] : ""
	);

	// UI state
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Calculate estimated strength score
	const estimatedScore = useMemo(() => {
		let score = 50;
		if (hasQuantification && metric && metricValue) {
			score += 15;
			if (baseline && improvement) score += 10;
		}
		if (hasSource && sourceName) {
			score += 10;
			if (sourceType === "customer" || sourceType === "third_party") score += 5;
		}
		if (content.length > 500) score += 5;
		if (selectedCapabilities.length > 0) score += 5;
		return Math.min(100, Math.max(0, score));
	}, [hasQuantification, metric, metricValue, baseline, improvement, hasSource, sourceName, sourceType, content, selectedCapabilities]);

	// Validation
	const validationErrors = useMemo(() => {
		const errors: string[] = [];
		if (!title.trim()) errors.push("Title is required");
		if (title.length < 3) errors.push("Title must be at least 3 characters");
		if (!content.trim()) errors.push("Content is required");
		if (content.length < 10) errors.push("Content must be at least 10 characters");
		if (hasQuantification && (!metric || metricValue === "")) {
			errors.push("Metric name and value are required for quantification");
		}
		if (hasSource && !sourceName) {
			errors.push("Source name is required");
		}
		return errors;
	}, [title, content, hasQuantification, metric, metricValue, hasSource, sourceName]);

	const isValid = validationErrors.length === 0;

	// Add tag
	const handleAddTag = useCallback(() => {
		if (newTag.trim() && !tags.includes(newTag.trim())) {
			setTags((prev) => [...prev, newTag.trim()]);
			setNewTag("");
		}
	}, [newTag, tags]);

	// Remove tag
	const handleRemoveTag = useCallback((tag: string) => {
		setTags((prev) => prev.filter((t) => t !== tag));
	}, []);

	// Toggle capability
	const handleToggleCapability = useCallback((capId: string) => {
		setSelectedCapabilities((prev) =>
			prev.includes(capId) ? prev.filter((id) => id !== capId) : [...prev, capId]
		);
	}, []);

	// Handle save
	const handleSave = useCallback(async () => {
		if (!isValid) return;

		setIsSaving(true);
		setError(null);

		try {
			const quantification: EvidenceQuantification | undefined = hasQuantification
				? {
						metric,
						value: Number(metricValue),
						unit,
						context: context || undefined,
						baseline: baseline ? Number(baseline) : undefined,
						improvement: improvement ? Number(improvement) : undefined,
						timeframe: timeframe || undefined,
					}
				: undefined;

			const source = hasSource
				? {
						type: sourceType as "internal" | "external" | "customer" | "third_party",
						name: sourceName,
						document: sourceDocument || undefined,
						url: sourceUrl || undefined,
						contactInfo: sourceContact || undefined,
					}
				: undefined;

			if (isEditMode && evidence) {
				const input: UpdateEvidenceInput = {
					title,
					content,
					type: evidenceType,
					category,
					subcategory: subcategory || undefined,
					tags,
					quantification,
					source,
					relatedCapabilities: selectedCapabilities,
					expiresAt: hasExpiration && expiresAt ? new Date(expiresAt) : undefined,
				};

				const result = await updateEvidence(evidence.id, input);
				if (result.success && result.data) {
					onSave?.(result.data);
				} else if (!result.success) {
					setError(result.error);
				}
			} else {
				const input: CreateEvidenceInput = {
					title,
					content,
					type: evidenceType,
					category,
					subcategory: subcategory || undefined,
					tags,
					quantification,
					source,
					relatedCapabilities: selectedCapabilities,
					expiresAt: hasExpiration && expiresAt ? new Date(expiresAt) : undefined,
				};

				const result = await createEvidence(input);
				if (result.success && result.data) {
					onSave?.(result.data);
				} else if (!result.success) {
					setError(result.error);
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
		evidence,
		title,
		content,
		evidenceType,
		category,
		subcategory,
		tags,
		hasQuantification,
		metric,
		metricValue,
		unit,
		context,
		baseline,
		improvement,
		timeframe,
		hasSource,
		sourceType,
		sourceName,
		sourceDocument,
		sourceUrl,
		sourceContact,
		selectedCapabilities,
		hasExpiration,
		expiresAt,
		onSave,
	]);

	const selectedTypeInfo = EVIDENCE_TYPES.find((t) => t.value === evidenceType);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Award className="h-5 w-5" />
						{isEditMode ? "Edit Evidence" : "Create Evidence"}
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

				{/* Title */}
				<div className="space-y-2">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Enter evidence title..."
						maxLength={200}
					/>
				</div>

				{/* Content */}
				<div className="space-y-2">
					<Label htmlFor="content">Content</Label>
					<Textarea
						id="content"
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Enter the full evidence description..."
						rows={5}
						className="resize-none"
					/>
					<p className="text-xs text-muted-foreground">
						{content.length} characters - Detailed evidence scores higher
					</p>
				</div>

				{/* Type and Category Row */}
				<div className="grid grid-cols-2 gap-4">
					{/* Evidence Type */}
					<div className="space-y-2">
						<Label>Evidence Type</Label>
						<Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EVIDENCE_TYPES.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedTypeInfo && (
							<p className="text-xs text-muted-foreground">{selectedTypeInfo.description}</p>
						)}
					</div>

					{/* Category */}
					<div className="space-y-2">
						<Label>Category</Label>
						<Select value={category} onValueChange={(v) => setCategory(v as EvidenceCategory)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EVIDENCE_CATEGORIES.map((cat) => (
									<SelectItem key={cat.value} value={cat.value}>
										{cat.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Subcategory */}
				<div className="space-y-2">
					<Label htmlFor="subcategory">Subcategory (Optional)</Label>
					<Input
						id="subcategory"
						value={subcategory}
						onChange={(e) => setSubcategory(e.target.value)}
						placeholder="E.g., Cloud Infrastructure, Data Security..."
					/>
				</div>

				{/* Tags */}
				<div className="space-y-2">
					<Label>Tags</Label>
					<div className="flex gap-2">
						<Input
							value={newTag}
							onChange={(e) => setNewTag(e.target.value)}
							placeholder="Add tag..."
							onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
						/>
						<Button variant="outline" size="icon" onClick={handleAddTag}>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							{tags.map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="gap-1 cursor-pointer hover:bg-destructive/20"
									onClick={() => handleRemoveTag(tag)}
								>
									{tag}
									<X className="h-3 w-3" />
								</Badge>
							))}
						</div>
					)}
				</div>

				<Separator />

				{/* Quantification Section */}
				<Collapsible open={hasQuantification} onOpenChange={setHasQuantification}>
					<div className="flex items-center justify-between">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="gap-2">
								<TrendingUp className="h-4 w-4" />
								Quantification
							</Button>
						</CollapsibleTrigger>
						<Switch checked={hasQuantification} onCheckedChange={setHasQuantification} />
					</div>

					<CollapsibleContent className="space-y-4 mt-4">
						<div className="p-4 border rounded-lg space-y-4 bg-muted/30">
							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label>Metric Name</Label>
									<Input
										value={metric}
										onChange={(e) => setMetric(e.target.value)}
										placeholder="E.g., Cost Savings"
									/>
								</div>
								<div className="space-y-2">
									<Label>Value</Label>
									<Input
										type="number"
										value={metricValue}
										onChange={(e) => setMetricValue(e.target.value ? Number(e.target.value) : "")}
										placeholder="E.g., 25"
									/>
								</div>
								<div className="space-y-2">
									<Label>Unit</Label>
									<Input
										value={unit}
										onChange={(e) => setUnit(e.target.value)}
										placeholder="E.g., %, $, hours"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Context (Optional)</Label>
								<Input
									value={context}
									onChange={(e) => setContext(e.target.value)}
									placeholder="E.g., compared to previous system"
								/>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label>Baseline (Optional)</Label>
									<Input
										type="number"
										value={baseline}
										onChange={(e) => setBaseline(e.target.value ? Number(e.target.value) : "")}
										placeholder="Starting value"
									/>
								</div>
								<div className="space-y-2">
									<Label>Improvement (Optional)</Label>
									<Input
										type="number"
										value={improvement}
										onChange={(e) => setImprovement(e.target.value ? Number(e.target.value) : "")}
										placeholder="% improvement"
									/>
								</div>
								<div className="space-y-2">
									<Label>Timeframe (Optional)</Label>
									<Input
										value={timeframe}
										onChange={(e) => setTimeframe(e.target.value)}
										placeholder="E.g., Q1 2024"
									/>
								</div>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>

				<Separator />

				{/* Source Section */}
				<Collapsible open={hasSource} onOpenChange={setHasSource}>
					<div className="flex items-center justify-between">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="sm" className="gap-2">
								<Building className="h-4 w-4" />
								Source Information
							</Button>
						</CollapsibleTrigger>
						<Switch checked={hasSource} onCheckedChange={setHasSource} />
					</div>

					<CollapsibleContent className="space-y-4 mt-4">
						<div className="p-4 border rounded-lg space-y-4 bg-muted/30">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Source Type</Label>
									<Select value={sourceType} onValueChange={(v) => setSourceType(v as typeof sourceType)}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{SOURCE_TYPES.map((type) => (
												<SelectItem key={type.value} value={type.value}>
													{type.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Source Name</Label>
									<Input
										value={sourceName}
										onChange={(e) => setSourceName(e.target.value)}
										placeholder="E.g., ABC Corporation"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Document Reference (Optional)</Label>
									<Input
										value={sourceDocument}
										onChange={(e) => setSourceDocument(e.target.value)}
										placeholder="E.g., Contract #12345"
									/>
								</div>
								<div className="space-y-2">
									<Label>URL (Optional)</Label>
									<Input
										value={sourceUrl}
										onChange={(e) => setSourceUrl(e.target.value)}
										placeholder="https://..."
										type="url"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Contact Info (Optional)</Label>
								<Input
									value={sourceContact}
									onChange={(e) => setSourceContact(e.target.value)}
									placeholder="E.g., John Smith, john@abc.com"
								/>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>

				{/* Related Capabilities */}
				{availableCapabilities.length > 0 && (
					<>
						<Separator />
						<div className="space-y-2">
							<Label>Related Capabilities</Label>
							<div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
								{availableCapabilities.map((cap) => (
									<div
										key={cap.id}
										className={cn(
											"flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50",
											selectedCapabilities.includes(cap.id) && "bg-primary/10"
										)}
										onClick={() => handleToggleCapability(cap.id)}

				role="button"
				tabIndex={0}
				onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
										<div
											className={cn(
												"h-4 w-4 border rounded flex items-center justify-center",
												selectedCapabilities.includes(cap.id) && "bg-primary border-primary"
											)}
										>
											{selectedCapabilities.includes(cap.id) && (
												<Check className="h-3 w-3 text-primary-foreground" />
											)}
										</div>
										<span className="text-sm">{cap.name}</span>
									</div>
								))}
							</div>
						</div>
					</>
				)}

				{/* Expiration */}
				<Separator />
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<Label>Set Expiration Date</Label>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger>
									<Info className="h-4 w-4 text-muted-foreground" />
								</TooltipTrigger>
								<TooltipContent>
									<p>Evidence may become outdated. Set an expiration to remind for review.</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<Switch checked={hasExpiration} onCheckedChange={setHasExpiration} />
				</div>
				{hasExpiration && (
					<Input
						type="date"
						value={expiresAt}
						onChange={(e) => setExpiresAt(e.target.value)}
					/>
				)}

				<Separator />

				{/* Strength Preview */}
				<StrengthPreview score={estimatedScore} />

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
								{isEditMode ? "Update Evidence" : "Create Evidence"}
							</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default EvidenceEditor;
