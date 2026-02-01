/**
 * BOEGenerator - Basis of Estimate Narrative Generator
 *
 * AI-powered generation of BOE narratives with template selection,
 * preview, and editing capabilities.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	FileText,
	Sparkles,
	AlertCircle,
	Loader2,
	Copy,
	Check,
	RefreshCw,
	Edit2,
	Save,
	X,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type {
	BoeTemplate,
	CostElement,
	CostElementType,
} from "@/lib/types/pricing";
import {
	listBOETemplates,
	generateBOENarrative,
	getCostElement,
	updateCostElement,
} from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface BOEGeneratorProps {
	/** Cost element ID to generate BOE for */
	costElementId?: string;
	/** Opportunity ID for context */
	opportunityId?: string;
	/** Pre-selected template ID */
	templateId?: string;
	/** Callback when BOE is saved */
	onSave?: (narrative: string) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function BOEGeneratorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-40" />
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-10 w-32" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function BOEGenerator({
	costElementId,
	opportunityId,
	templateId: initialTemplateId,
	onSave,
	className,
}: BOEGeneratorProps) {
	// State
	const [templates, setTemplates] = useState<BoeTemplate[]>([]);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(initialTemplateId);
	const [costElement, setCostElement] = useState<CostElement | null>(null);
	const [generatedContent, setGeneratedContent] = useState<string>("");
	const [editedContent, setEditedContent] = useState<string>("");
	const [isEditing, setIsEditing] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// Load templates and cost element
	useEffect(() => {
		async function loadData() {
			setIsLoading(true);
			setError(null);

			try {
				// Load templates
				const templatesResult = await listBOETemplates();
				if (templatesResult.success && templatesResult.data) {
					setTemplates(templatesResult.data);
					// Auto-select first template if none provided
					if (!initialTemplateId && templatesResult.data.length > 0) {
						const defaultTemplate = templatesResult.data.find(t => t.useCount && t.useCount > 0)
							|| templatesResult.data[0];
						if (defaultTemplate) {
							setSelectedTemplateId(defaultTemplate.id);
						}
					}
				}

				// Load cost element if ID provided
				if (costElementId) {
					const elementResult = await getCostElement(costElementId);
					if (elementResult.success && elementResult.data) {
						setCostElement(elementResult.data);
						// If element has existing BOE, show it
						if (elementResult.data.boeNarrative) {
							setGeneratedContent(elementResult.data.boeNarrative);
							setEditedContent(elementResult.data.boeNarrative);
						}
					}
				}
			} catch (err) {
				setError("Failed to load data");
			}

			setIsLoading(false);
		}
		loadData();
	}, [costElementId, initialTemplateId]);

	// Generate BOE narrative
	const handleGenerate = useCallback(async () => {
		if (!costElementId) {
			setError("No cost element selected");
			return;
		}

		setIsGenerating(true);
		setError(null);

		try {
			const result = await generateBOENarrative(costElementId);
			if (result.success && result.data) {
				setGeneratedContent(result.data);
				setEditedContent(result.data);
			} else if (!result.success) {
				setError(result.error || "Failed to generate narrative");
			}
		} catch (err) {
			setError("Failed to generate narrative");
		}

		setIsGenerating(false);
	}, [costElementId]);

	// Save BOE narrative
	const handleSave = useCallback(async () => {
		if (!costElementId) return;

		setIsSaving(true);
		setError(null);

		try {
			const result = await updateCostElement(costElementId, {
				boeNarrative: editedContent,
			});

			if (result.success) {
				setGeneratedContent(editedContent);
				setIsEditing(false);
				onSave?.(editedContent);
			} else if (!result.success) {
				setError(result.error || "Failed to save narrative");
			}
		} catch (err) {
			setError("Failed to save narrative");
		}

		setIsSaving(false);
	}, [costElementId, editedContent, onSave]);

	// Copy to clipboard
	const handleCopy = useCallback(async () => {
		const content = isEditing ? editedContent : generatedContent;
		await navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [isEditing, editedContent, generatedContent]);

	// Cancel editing
	const handleCancelEdit = useCallback(() => {
		setEditedContent(generatedContent);
		setIsEditing(false);
	}, [generatedContent]);

	// Loading state
	if (isLoading) {
		return <BOEGeneratorSkeleton />;
	}

	const displayContent = isEditing ? editedContent : generatedContent;
	const hasContent = displayContent.length > 0;

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					BOE Narrative Generator
					{costElement && (
						<Badge variant="secondary" className="ml-2">
							{costElement.elementType}
						</Badge>
					)}
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Cost Element Info */}
				{costElement && (
					<div className="p-3 bg-muted/50 rounded-lg text-sm">
						<div className="font-medium">
							{costElement.laborCategoryName || costElement.odcDescription || costElement.subcontractorName || "Cost Element"}
						</div>
						<div className="text-muted-foreground">
							Type: {costElement.elementType}
							{costElement.wbsCode && ` | WBS: ${costElement.wbsCode}`}
							{costElement.totalCost && ` | ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(costElement.totalCost)}`}
						</div>
					</div>
				)}

				{/* Template Selection */}
				{templates.length > 0 && (
					<div className="space-y-2">
						<Label>Template (Optional)</Label>
						<Select
							value={selectedTemplateId}
							onValueChange={setSelectedTemplateId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a template..." />
							</SelectTrigger>
							<SelectContent>
								{templates.map((template) => (
									<SelectItem key={template.id} value={template.id}>
										<div className="flex items-center gap-2">
											{template.name}
											{template.useCount && template.useCount > 0 && (
												<Badge variant="secondary" className="text-xs">
													Used {template.useCount}x
												</Badge>
											)}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<Separator />

				{/* Generate Button */}
				{!hasContent && (
					<div className="text-center py-8">
						<FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">Generate BOE Narrative</h3>
						<p className="text-sm text-muted-foreground mt-1">
							{costElementId
								? "Click below to generate an AI-powered narrative"
								: "Select a cost element to generate its BOE"}
						</p>
						{costElementId && (
							<Button
								onClick={handleGenerate}
								disabled={isGenerating}
								className="mt-4"
							>
								{isGenerating ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Generating...
									</>
								) : (
									<>
										<Sparkles className="h-4 w-4 mr-2" />
										Generate Narrative
									</>
								)}
							</Button>
						)}
					</div>
				)}

				{/* Content Display/Edit */}
				{hasContent && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<Label>Generated Narrative</Label>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={handleCopy}
								>
									{copied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
								{!isEditing ? (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsEditing(true)}
									>
										<Edit2 className="h-4 w-4 mr-1" />
										Edit
									</Button>
								) : (
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={handleCancelEdit}
										>
											<X className="h-4 w-4 mr-1" />
											Cancel
										</Button>
										<Button
											size="sm"
											onClick={handleSave}
											disabled={isSaving}
										>
											{isSaving ? (
												<Loader2 className="h-4 w-4 mr-1 animate-spin" />
											) : (
												<Save className="h-4 w-4 mr-1" />
											)}
											Save
										</Button>
									</div>
								)}
							</div>
						</div>

						{isEditing ? (
							<Textarea
								value={editedContent}
								onChange={(e) => setEditedContent(e.target.value)}
								className="min-h-[300px] font-mono text-sm"
							/>
						) : (
							<div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap text-sm">
								{displayContent}
							</div>
						)}

						{/* Regenerate option */}
						<div className="flex justify-end">
							<Button
								variant="outline"
								size="sm"
								onClick={handleGenerate}
								disabled={isGenerating}
							>
								<RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
								Regenerate
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default BOEGenerator;
