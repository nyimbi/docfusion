/**
 * Use Template Wizard - DocFusion
 *
 * Step-by-step wizard for creating a document from a template,
 * including placeholder input and AI-guided generation.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import type {
	Template,
	TemplateSummary,
	TemplatePlaceholder,
	UseTemplateInput,
} from "@/lib/types/template";
import { Button } from "@/components/ui/Button";
import {
	Input,
	Textarea,
	Label,
	InputError,
} from "@/components/ui/input";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	Sparkles,
	Loader2,
	FileText,
	Calendar,
	DollarSign,
	List,
	ToggleLeft,
	AlertCircle,
	Plus,
	Trash2,
	Edit3,
} from "lucide-react";
import { createDocumentFromTemplate } from "@/lib/actions/templates";

// ============================================================================
// Types
// ============================================================================

type WizardStep = "details" | "placeholders" | "review" | "generating" | "complete";

interface UseTemplateWizardProps {
	templateId?: string;
	template?: Template | TemplateSummary;
	onComplete?: () => void;
	onCancel?: () => void;
}

// Default template for fallback
const DEFAULT_TEMPLATE: Template = {
	id: "exec-sum-001",
	name: "Executive Summary Pro",
	description:
		"Create compelling executive summaries that win with value proposition framework and strategic positioning.",
	content: {
		type: "document",
		blocks: [],
	},
	status: "published",
	visibility: "organization",
	createdBy: "user-001",
	categoryIds: ["exec"],
	tags: ["executive", "summary", "strategy"],
	placeholders: [
		{
			id: "ph-1",
			name: "Proposal Title",
			variableName: "{{proposal_title}}",
			description: "The main title of your proposal",
			type: "text",
			required: true,
			defaultValue: "Technical Approach Proposal",
		},
		{
			id: "ph-2",
			name: "Company Name",
			variableName: "{{company_name}}",
			description: "Your company or organization name",
			type: "text",
			required: true,
		},
		{
			id: "ph-3",
			name: "Client Name",
			variableName: "{{client_name}}",
			description: "The client or agency name",
			type: "text",
			required: true,
		},
		{
			id: "ph-4",
			name: "Contract Value",
			variableName: "{{contract_value}}",
			description: "Estimated contract value for budget information",
			type: "currency",
			required: false,
		},
		{
			id: "ph-5",
			name: "Project Timeline",
			variableName: "{{project_timeline}}",
			description: "Expected project duration",
			type: "select",
			required: false,
			options: [
				{ value: "3_months", label: "3 months" },
				{ value: "6_months", label: "6 months" },
				{ value: "1_year", label: "1 year" },
				{ value: "2_years", label: "2+ years" },
			],
		},
		{
			id: "ph-6",
			name: "Use AI Enhancement",
			variableName: "{{use_ai}}",
			description: "Enable AI-powered content generation and improvement",
			type: "boolean",
			required: false,
			defaultValue: "true",
		},
	],
	aiInstructions: [],
	complianceRequirements: [],
	useCount: 342,
	createdAt: "2024-06-15T10:00:00Z",
	updatedAt: "2024-12-20T15:30:00Z",
	difficulty: "intermediate",
	estimatedTime: 45,
};

export function UseTemplateWizard({
	templateId,
	template: propTemplate,
	onComplete,
	onCancel,
}: UseTemplateWizardProps) {
	const router = useRouter();
	const [step, setStep] = React.useState<WizardStep>("details");
	const [isLoading, setIsLoading] = React.useState(false);
	const [createdDocumentId, setCreatedDocumentId] = React.useState<string | null>(null);
	const [createError, setCreateError] = React.useState<string | null>(null);
	// Convert TemplateSummary to full Template with defaults if needed
	const ensureFullTemplate = (t: Template | TemplateSummary | undefined): Template | null => {
		if (!t) return null;
		// If it has placeholders array, it's already a full Template
		if ('placeholders' in t && Array.isArray(t.placeholders)) {
			return t as Template;
		}
		// Convert TemplateSummary to Template with defaults
		return {
			...t,
			content: { type: 'doc', content: [] },
			createdBy: '',
			placeholders: [
				{
					id: 'title',
					name: 'Document Title',
					variableName: '{{document_title}}',
					type: 'text',
					required: true,
					description: 'Title of the document',
				}
			],
			aiInstructions: [],
			complianceRequirements: [],
		} as Template;
	};

	const [template, setTemplate] = React.useState<Template | null>(ensureFullTemplate(propTemplate));
	const [isEditingPlaceholders, setIsEditingPlaceholders] = React.useState(false);

	// Update template when prop changes
	React.useEffect(() => {
		setTemplate(ensureFullTemplate(propTemplate));
	}, [propTemplate]);

	// Placeholder editing functions
	const addPlaceholder = () => {
		if (!template) return;
		const newPlaceholder: TemplatePlaceholder = {
			id: `custom-${Date.now()}`,
			name: "New Field",
			variableName: `{{custom_${Date.now()}}}`,
			type: "text",
			required: false,
			description: "Custom template field",
		};
		setTemplate({
			...template,
			placeholders: [...template.placeholders, newPlaceholder],
		});
	};

	const updatePlaceholderDef = (id: string, updates: Partial<TemplatePlaceholder>) => {
		if (!template) return;
		setTemplate({
			...template,
			placeholders: template.placeholders.map((p) =>
				p.id === id ? { ...p, ...updates } : p
			),
		});
	};

	const removePlaceholder = (id: string) => {
		if (!template) return;
		setTemplate({
			...template,
			placeholders: template.placeholders.filter((p) => p.id !== id),
		});
	};
	const [errors, setErrors] = React.useState<Record<string, string>>({});

	// Form data
	const [title, setTitle] = React.useState("");
	const [placeholderValues, setPlaceholderValues] = React.useState<
		Record<string, string | number | boolean | string[]>
	>({});
	const [useAIFill, setUseAIFill] = React.useState(true);


	// Generate title from template
	React.useEffect(() => {
		if (template && !title) {
			setTitle(
				`${template.name} - ${formatDate(new Date(), {
					month: "short",
					year: "numeric",
				})}`
			);
		}
	}, [template, title]);

	// Step transitions
	const goToStep = (newStep: WizardStep) => {
		setStep(newStep);
	};

	const handleNext = () => {
		switch (step) {
			case "details":
				if (!title.trim()) {
					setErrors({ title: "Document title is required" });
					return;
				}
				setErrors({});
				goToStep("placeholders");
				break;
			case "placeholders":
				// Validate required placeholders
				const newErrors: Record<string, string> = {};
				template?.placeholders
					.filter((p) => p.required && p.type !== "boolean")
					.forEach((p) => {
						if (!placeholderValues[p.id]) {
							newErrors[p.id] = `${p.name} is required`;
						}
					});
				if (Object.keys(newErrors).length > 0) {
					setErrors(newErrors);
					return;
				}
				setErrors({});
				goToStep("review");
				break;
			case "review":
				handleCreate();
				break;
			default:
				break;
		}
	};

	const handleBack = () => {
		switch (step) {
			case "placeholders":
				goToStep("details");
				break;
			case "review":
				goToStep("placeholders");
				break;
			default:
				break;
		}
	};

	const handleCreate = async () => {
		if (!template) return;

		setIsLoading(true);
		setCreateError(null);
		goToStep("generating");

		try {
			const result = await createDocumentFromTemplate({
				templateId: template.id,
				title: title.trim(),
				placeholderValues: placeholderValues as Record<string, string>,
				useAIFill,
			});

			if (result.success && result.documentId) {
				setCreatedDocumentId(result.documentId);
				goToStep("complete");
			} else {
				throw new Error("Failed to create document");
			}
		} catch (error) {
			console.error("Failed to create document from template:", error);
			setCreateError(error instanceof Error ? error.message : "Failed to create document");
			goToStep("review"); // Go back to review step on error
		} finally {
			setIsLoading(false);
		}
	};

	const handleViewDocument = () => {
		if (createdDocumentId) {
			router.push(`/documents/${createdDocumentId}`);
		}
		onComplete?.();
	};

	const handleClose = () => {
		onCancel?.();
	};

	// Update placeholder value
	const updatePlaceholder = (
		id: string,
		value: string | number | boolean | string[]
	) => {
		setPlaceholderValues((prev) => ({ ...prev, [id]: value }));
		if (errors[id]) {
			setErrors((prev) => {
				const newErrors = { ...prev };
				delete newErrors[id];
				return newErrors;
			});
		}
	};

	// Get completed steps count
	const totalSteps = 3;
	const currentStepNumber = step === "details" ? 1 : step === "placeholders" ? 2 : 3;

	if (!template) {
		return (
			<div className="flex items-center justify-center py-24">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
				<span className="ml-3 text-muted-foreground">Loading template...</span>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Progress */}
			{step !== "generating" && step !== "complete" && (
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							Step {currentStepNumber} of {totalSteps}
						</span>
						<span className="font-medium text-foreground">
							{step === "details"
								? "Document Details"
								: step === "placeholders"
								? "Template Fields"
								: "Review"}
						</span>
					</div>
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all duration-300 ease-out"
							style={{
								width: `${(currentStepNumber / totalSteps) * 100}%`,
							}}
						/>
					</div>
				</div>
			)}

			{/* Step Content */}
			<div className="min-h-[400px]">
				{step === "details" && (
					<DetailsStep
						template={template}
						title={title}
						setTitle={setTitle}
						titleError={errors.title}
						useAIFill={useAIFill}
						setUseAIFill={setUseAIFill}
					/>
				)}
				{step === "placeholders" && (
					<PlaceholdersStep
						template={template}
						placeholderValues={placeholderValues}
						updatePlaceholder={updatePlaceholder}
						isEditing={isEditingPlaceholders}
						onToggleEdit={() => setIsEditingPlaceholders(!isEditingPlaceholders)}
						onAddPlaceholder={addPlaceholder}
						onUpdatePlaceholderDef={updatePlaceholderDef}
						onRemovePlaceholder={removePlaceholder}
					/>
				)}
				{step === "review" && (
					<ReviewStep
						template={template}
						title={title}
						placeholderValues={placeholderValues}
						useAIFill={useAIFill}
					/>
				)}
				{step === "generating" && <GeneratingStep template={template} />}
				{step === "complete" && (
					<CompleteStep template={template} onView={handleViewDocument} />
				)}
			</div>

			{/* Actions */}
			{step !== "generating" && step !== "complete" && (
				<div className="flex items-center justify-between pt-4 border-t border-border">
					<Button variant="ghost" onClick={handleClose}>
						Cancel
					</Button>
					<div className="flex items-center gap-3">
						{step !== "details" && (
							<Button variant="outline" onClick={handleBack}>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back
							</Button>
						)}
						<Button onClick={handleNext} isLoading={isLoading}>
							{step === "review" ? (
								<>
									<Sparkles className="h-4 w-4 mr-2" />
									{useAIFill ? "Create with AI" : "Create Document"}
								</>
							) : (
								<>
									Next
									<ArrowRight className="h-4 w-4 ml-2" />
								</>
							)}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Step Components
// ============================================================================

interface DetailsStepProps {
	template: Template;
	title: string;
	setTitle: (value: string) => void;
	titleError?: string;
	useAIFill: boolean;
	setUseAIFill: (value: boolean) => void;
}

function DetailsStep({
	template,
	title,
	setTitle,
	titleError,
	useAIFill,
	setUseAIFill,
}: DetailsStepProps) {
	return (
		<div className="space-y-6">
			{/* Template Info */}
			<div className="p-4 rounded-xl bg-accent/50 border border-border">
				<h3 className="font-semibold text-foreground mb-1">{template.name}</h3>
				<p className="text-sm text-muted-foreground">{template.description}</p>
			</div>

			{/* Document Title */}
			<div className="space-y-2">
				<Label htmlFor="document-title" required>
					Document Title
				</Label>
				<Input
					id="document-title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Enter a title for your document"
				/>
				{titleError && <InputError>{titleError}</InputError>}
				<p className="text-xs text-muted-foreground">
					This will be the title of your new document
				</p>
			</div>

			{/* AI Enhancement Option */}
			<div className="p-4 rounded-xl bg-muted/50">
				<div className="flex items-start gap-3">
					<div className="mt-0.5">
						<input
							type="checkbox"
							id="use-ai"
							checked={useAIFill}
							onChange={(e) => setUseAIFill(e.target.checked)}
							className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
						/>
					</div>
					<div className="flex-1">
						<label htmlFor="use-ai" className="font-medium text-foreground cursor-pointer">
							Enable AI Enhancement
						</label>
						<p className="text-sm text-muted-foreground mt-1">
							Let AI help generate and improve content based on template prompts
							and your responses.
						</p>
						{useAIFill && template.estimatedTime && (
							<p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
								<Sparkles className="h-3 w-3 text-amber-500" />
								Estimated {Math.ceil(template.estimatedTime * 0.6)} minutes with AI
								assistance
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

interface PlaceholdersStepProps {
	template: Template;
	placeholderValues: Record<
		string,
		string | number | boolean | string[]
	>;
	updatePlaceholder: (
		id: string,
		value: string | number | boolean | string[]
	) => void;
	errors?: Record<string, string>;
	isEditing?: boolean;
	onToggleEdit?: () => void;
	onAddPlaceholder?: () => void;
	onUpdatePlaceholderDef?: (id: string, updates: Partial<TemplatePlaceholder>) => void;
	onRemovePlaceholder?: (id: string) => void;
}

function PlaceholdersStep({
	template,
	placeholderValues,
	updatePlaceholder,
	errors,
	isEditing,
	onToggleEdit,
	onAddPlaceholder,
	onUpdatePlaceholderDef,
	onRemovePlaceholder,
}: PlaceholdersStepProps) {
	// Guard against undefined template
	if (!template) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				Loading template...
			</div>
		);
	}
	
	const placeholders = template.placeholders || [];
	
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="text-sm text-muted-foreground">
					{isEditing 
						? "Edit template fields or add new ones"
						: "Fill in the template fields below. Required fields are marked with an asterisk."
					}
				</div>
				<div className="flex items-center gap-2">
					{onToggleEdit && (
						<Button variant="outline" size="sm" onClick={onToggleEdit}>
							{isEditing ? "Done Editing" : "Edit Fields"}
						</Button>
					)}
					{isEditing && onAddPlaceholder && (
						<Button variant="outline" size="sm" onClick={onAddPlaceholder}>
							<Plus className="h-3.5 w-3.5 mr-1" />
							Add Field
						</Button>
					)}
				</div>
			</div>

			{placeholders.map((placeholder) => (
				<div key={placeholder.id} className="border rounded-lg p-4">
					{isEditing ? (
						<PlaceholderEditor
							placeholder={placeholder}
							onUpdate={(updates) => onUpdatePlaceholderDef?.(placeholder.id, updates)}
							onRemove={() => onRemovePlaceholder?.(placeholder.id)}
						/>
					) : (
						<PlaceholderField
							placeholder={placeholder}
							value={placeholderValues[placeholder.id]}
							onChange={(value) => updatePlaceholder(placeholder.id, value)}
							error={errors?.[placeholder.id]}
						/>
					)}
				</div>
			))}
		</div>
	);
}

interface PlaceholderFieldProps {
	placeholder: TemplatePlaceholder;
	value: string | number | boolean | string[];
	onChange: (value: string | number | boolean | string[]) => void;
	error?: string;
}


// Placeholder Editor Component
interface PlaceholderEditorProps {
	placeholder: TemplatePlaceholder;
	onUpdate: (updates: Partial<TemplatePlaceholder>) => void;
	onRemove: () => void;
}

function PlaceholderEditor({ placeholder, onUpdate, onRemove }: PlaceholderEditorProps) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-muted-foreground uppercase">Field Editor</span>
				<Button variant="ghost" size="sm" onClick={onRemove} className="h-7 text-destructive">
					<Trash2 className="h-3.5 w-3.5 mr-1" />
					Remove
				</Button>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<Label className="text-xs">Field Name</Label>
					<Input
						value={placeholder.name}
						onChange={(e) => onUpdate({ name: e.target.value })}
						className="h-8"
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Variable Name</Label>
					<Input
						value={placeholder.variableName}
						onChange={(e) => onUpdate({ variableName: e.target.value })}
						className="h-8 font-mono text-xs"
					/>
				</div>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Description</Label>
				<Input
					value={placeholder.description || ""}
					onChange={(e) => onUpdate({ description: e.target.value })}
					className="h-8"
				/>
			</div>
			<div className="grid grid-cols-3 gap-3">
				<div className="space-y-1">
					<Label className="text-xs">Type</Label>
					<select
						value={placeholder.type}
						onChange={(e) => onUpdate({ type: e.target.value as TemplatePlaceholder["type"] })}
						className="h-8 w-full rounded border bg-background px-2 text-sm"
					>
						<option value="text">Text</option>
						<option value="textarea">Textarea</option>
						<option value="number">Number</option>
						<option value="select">Select</option>
						<option value="boolean">Boolean</option>
						<option value="currency">Currency</option>
						<option value="date">Date</option>
					</select>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Default Value</Label>
					<Input
						value={placeholder.defaultValue || ""}
						onChange={(e) => onUpdate({ defaultValue: e.target.value })}
						className="h-8"
					/>
				</div>
				<div className="flex items-end pb-2">
					<label className="flex items-center gap-2 text-sm cursor-pointer">
						<input
							type="checkbox"
							checked={placeholder.required}
							onChange={(e) => onUpdate({ required: e.target.checked })}
							className="rounded border-border"
						/>
						<span>Required</span>
					</label>
				</div>
			</div>
		</div>
	);
}

function PlaceholderField({
	placeholder,
	value,
	onChange,
	error,
}: PlaceholderFieldProps) {
	const Icon = getPlaceholderIcon(placeholder.type);

	const input = (
		<div className="relative">
			<div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
				<Icon className="h-4 w-4" />
			</div>
			{placeholder.type === "textarea" ? (
				<Textarea
					value={(value as string) || ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder.description}
					rows={3}
					className="pl-10"
				/>
			) : placeholder.type === "select" ? (
				<select
					value={(value as string) || ""}
					onChange={(e) => onChange(e.target.value)}
					className={cn(
						"flex h-10 w-full rounded-lg border bg-background pl-10 pr-3 py-2 text-sm",
						"ring-offset-background placeholder:text-muted-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:cursor-not-allowed disabled:opacity-50",
						error
							? "border-destructive focus-visible:ring-destructive"
							: "border-input hover:border-border-strong focus-visible:border-primary"
					)}
				>
					<option value="">Select {placeholder.name.toLowerCase()}...</option>
					{placeholder.options?.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			) : placeholder.type === "boolean" ? (
				<div className="flex items-center gap-3">
					<input
						type="checkbox"
						id={`ph-${placeholder.id}`}
						checked={Boolean(value)}
						onChange={(e) => onChange(e.target.checked)}
						className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
					/>
					<label
						htmlFor={`ph-${placeholder.id}`}
						className="text-sm text-foreground cursor-pointer"
					>
						Yes, enable {placeholder.name.toLowerCase()}
					</label>
				</div>
			) : placeholder.type === "number" ? (
				<Input
					type="number"
					value={(value as number) || ""}
					onChange={(e) => onChange(Number(e.target.value) || 0)}
					placeholder={placeholder.description}
					className="pl-10"
				/>
			) : (
				<Input
					type={placeholder.type}
					value={(value as string) || ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder.description}
					className="pl-10"
				/>
			)}
		</div>
	);

	return (
		<div className="space-y-2">
			<Label htmlFor={`ph-${placeholder.id}`} required={placeholder.required}>
				{placeholder.name}
			</Label>
			{placeholder.description && (
				<p className="text-xs text-muted-foreground">{placeholder.description}</p>
			)}
			{input}
			{error && <InputError>{error}</InputError>}
			{placeholder.defaultValue && !value && (
				<p className="text-xs text-muted-foreground">
					Default: {placeholder.defaultValue}
				</p>
			)}
		</div>
	);
}

function getPlaceholderIcon(
	type: string
): React.ComponentType<{ className?: string }> {
	switch (type) {
		case "number":
		case "currency":
			return DollarSign;
		case "date":
			return Calendar;
		case "select":
			return List;
		case "boolean":
			return ToggleLeft;
		case "textarea":
			return FileText;
		default:
			return FileText;
	}
}

interface ReviewStepProps {
	template: Template;
	title: string;
	placeholderValues: Record<
		string,
		string | number | boolean | string[]
	>;
	useAIFill: boolean;
}

function ReviewStep({
	template,
	title,
	placeholderValues,
	useAIFill,
}: ReviewStepProps) {
	return (
		<div className="space-y-6">
			<h3 className="font-semibold text-foreground">Review and Confirm</h3>

			<div className="space-y-4 rounded-xl bg-muted/50 p-4">
				<div>
					<span className="text-xs text-muted-foreground uppercase tracking-wider">
						Document Title
					</span>
					<p className="text-foreground font-medium mt-1">{title}</p>
				</div>

				<div>
					<span className="text-xs text-muted-foreground uppercase tracking-wider">
						Template
					</span>
					<p className="text-foreground mt-1">{template.name}</p>
				</div>

				<div>
					<span className="text-xs text-muted-foreground uppercase tracking-wider">
						AI Enhancement
					</span>
					<p className="text-foreground mt-1 flex items-center gap-2">
						{useAIFill ? (
							<>
								<Check className="h-4 w-4 text-success" />
								Enabled
							</>
						) : (
							<>
								<AlertCircle className="h-4 w-4 text-muted-foreground" />
								Disabled
							</>
						)}
					</p>
				</div>

				<div>
					<span className="text-xs text-muted-foreground uppercase tracking-wider">
						Fields Filled
					</span>
					<p className="text-foreground mt-1">
						{Object.keys(placeholderValues).filter(
							(k) => placeholderValues[k]
						).length}{" "}
						of {template.placeholders.length}
					</p>
				</div>
			</div>

			<div className="rounded-xl border border-border p-4">
				<h4 className="font-medium text-foreground mb-3">Field Summary</h4>
				<div className="space-y-2">
					{template.placeholders.map((ph) => (
						<div
							key={ph.id}
							className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0"
						>
							<span className="text-muted-foreground">{ph.name}</span>
							<span className="font-medium text-foreground">
								{ph.type === "boolean"
									? placeholderValues[ph.id]
										? "Yes"
										: "No"
									: placeholderValues[ph.id] || (
											ph.required ? (
												<span className="text-destructive">Required</span>
											) : (
												<span className="text-muted-foreground italic">
													Default
												</span>
											)
										)}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

interface GeneratingStepProps {
	template: Template;
}

function GeneratingStep({ template }: GeneratingStepProps) {
	const steps = [
		"Creating document structure",
		"Applying template format",
		"Filling placeholders",
		"Enhancing with AI...",
		"Finalizing document",
	];
	const [currentStep, setCurrentStep] = React.useState(0);

	React.useEffect(() => {
		const interval = setInterval(() => {
			setCurrentStep((prev) => {
				if (prev >= steps.length - 1) {
					clearInterval(interval);
					return prev;
				}
				return prev + 1;
			});
		}, 500);

		return () => clearInterval(interval);
	}, [steps.length]);

	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="relative w-24 h-24 mb-8">
				<div className="absolute inset-0 rounded-full border-4 border-muted" />
				<div
					className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
					style={{ animationDuration: "1s" }}
				/>
				<div className="absolute inset-0 flex items-center justify-center">
					<Sparkles className="h-10 w-10 text-primary" />
				</div>
			</div>

			<h3 className="text-xl font-semibold text-foreground mb-2">
				Generating Document
			</h3>
			<p className="text-muted-foreground mb-6">
				Creating your document from {template.name} template
			</p>

			<div className="w-full max-w-md">
				<div className="space-y-2">
					{steps.map((step, i) => (
						<div
							key={i}
							className={cn(
								"flex items-center gap-3 text-sm transition-colors",
								i <= currentStep
									? "text-foreground"
									: "text-muted-foreground"
								)}
						>
							<div
								className={cn(
									"flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
									i < currentStep
										? "bg-success text-success-foreground"
										: i === currentStep
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground"
									)}
							>
								{i < currentStep ? (
									<Check className="h-3.5 w-3.5" />
								) : (
									<span className="text-xs">{i + 1}</span>
								)}
							</div>
							<span>{step}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

interface CompleteStepProps {
	template: Template;
	onView: () => void;
}

function CompleteStep({ template, onView }: CompleteStepProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
				<div className="relative w-20 h-20 rounded-full bg-success flex items-center justify-center">
					<Check className="h-10 w-10 text-success-foreground" />
				</div>
			</div>

			<h3 className="text-xl font-semibold text-foreground mb-2">
				Document Created
			</h3>
			<p className="text-muted-foreground text-center mb-8 max-w-sm">
				Your document has been successfully created from the {template.name}{" "}
				template.
			</p>

			<div className="flex items-center gap-4">
				<Button onClick={onView}>
					<FileText className="h-4 w-4 mr-2" />
					View Document
				</Button>
			</div>
		</div>
	);
}
