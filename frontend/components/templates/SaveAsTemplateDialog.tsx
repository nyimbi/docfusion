/**
 * Save as template dialog for DocFusion.
 *
 * Allows users to save their current document as a reusable template
 * with customizable placeholders, categories, and metadata.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
	CreateTemplateInput,
	TemplateCategory,
	TemplateVisibility,
	TemplatePlaceholder,
	PlaceholderType,
} from "@/lib/types/template";
import type { DocumentContent } from "@/lib/types/document";
import {
	useTemplateCategories,
	buildCategoryTree,
	type CategoryTreeNode,
} from "@/lib/query/hooks/useTemplates";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input, InputDescription, InputError } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	LayoutTemplate,
	Save,
	Loader2,
	Plus,
	Trash2,
	Variable,
	Tag,
	FolderTree,
	Eye,
	Lock,
	Users,
	Building2,
	Globe,
	AlertCircle,
	Info,
	ChevronDown,
	ChevronUp,
	GripVertical,
} from "lucide-react";

/**
 * Props for SaveAsTemplateDialog component.
 */
export interface SaveAsTemplateDialogProps {
	/** Current document content to save as template */
	content: DocumentContent;
	/** Current document title (used as default template name) */
	documentTitle?: string;
	/** Trigger element or render prop */
	trigger?: React.ReactNode;
	/** Callback on successful save */
	onSave?: (templateId: string) => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Visibility options with icons and descriptions.
 */
const visibilityOptions: {
	value: TemplateVisibility;
	label: string;
	icon: typeof Eye;
	description: string;
}[] = [
	{
		value: "private",
		label: "Private",
		icon: Lock,
		description: "Only you can see and use this template",
	},
	{
		value: "team",
		label: "Team",
		icon: Users,
		description: "Your team members can see and use this template",
	},
	{
		value: "organization",
		label: "Organization",
		icon: Building2,
		description: "Everyone in your organization can see and use this template",
	},
	{
		value: "public",
		label: "Public",
		icon: Globe,
		description: "Anyone can see and use this template",
	},
];

/**
 * Difficulty options.
 */
const difficultyOptions = [
	{ value: "beginner", label: "Beginner", description: "Simple, straightforward template" },
	{ value: "intermediate", label: "Intermediate", description: "Requires some domain knowledge" },
	{ value: "advanced", label: "Advanced", description: "Complex template with many options" },
] as const;

/**
 * Placeholder type options.
 */
const placeholderTypeOptions: { value: PlaceholderType; label: string }[] = [
	{ value: "text", label: "Text" },
	{ value: "textarea", label: "Long Text" },
	{ value: "number", label: "Number" },
	{ value: "date", label: "Date" },
	{ value: "email", label: "Email" },
	{ value: "url", label: "URL" },
	{ value: "currency", label: "Currency" },
	{ value: "boolean", label: "Yes/No" },
	{ value: "select", label: "Dropdown" },
	{ value: "multiselect", label: "Multi-select" },
];

/**
 * Save as template dialog component.
 */
export function SaveAsTemplateDialog({
	content,
	documentTitle,
	trigger,
	onSave,
	className,
}: SaveAsTemplateDialogProps) {
	const [open, setOpen] = React.useState(false);
	const [step, setStep] = React.useState<"details" | "placeholders" | "review">("details");

	// Form state
	const [name, setName] = React.useState(documentTitle ? `${documentTitle} Template` : "");
	const [description, setDescription] = React.useState("");
	const [visibility, setVisibility] = React.useState<TemplateVisibility>("private");
	const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
	const [tags, setTags] = React.useState<string[]>([]);
	const [tagInput, setTagInput] = React.useState("");
	const [difficulty, setDifficulty] = React.useState<"beginner" | "intermediate" | "advanced">();
	const [estimatedTime, setEstimatedTime] = React.useState<number>();
	const [placeholders, setPlaceholders] = React.useState<TemplatePlaceholder[]>([]);

	// Validation state
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);

	// Fetch categories
	const { data: categories = [] } = useTemplateCategories();
	const categoryTree = React.useMemo(
		() => buildCategoryTree(categories),
		[categories]
	);

	// Reset form when dialog opens
	React.useEffect(() => {
		if (open) {
			setName(documentTitle ? `${documentTitle} Template` : "");
			setDescription("");
			setVisibility("private");
			setCategoryIds([]);
			setTags([]);
			setDifficulty(undefined);
			setEstimatedTime(undefined);
			setPlaceholders([]);
			setStep("details");
			setErrors({});
		}
	}, [open, documentTitle]);

	// Add a tag
	const addTag = () => {
		const tag = tagInput.trim().toLowerCase();
		if (tag && !tags.includes(tag)) {
			setTags([...tags, tag]);
		}
		setTagInput("");
	};

	// Remove a tag
	const removeTag = (tag: string) => {
		setTags(tags.filter((t) => t !== tag));
	};

	// Add a placeholder
	const addPlaceholder = () => {
		const newPlaceholder: TemplatePlaceholder = {
			id: `placeholder-${Date.now()}`,
			name: "",
			variableName: "",
			type: "text",
			required: false,
		};
		setPlaceholders([...placeholders, newPlaceholder]);
	};

	// Update a placeholder
	const updatePlaceholder = (id: string, updates: Partial<TemplatePlaceholder>) => {
		setPlaceholders(
			placeholders.map((p) => (p.id === id ? { ...p, ...updates } : p))
		);
	};

	// Remove a placeholder
	const removePlaceholder = (id: string) => {
		setPlaceholders(placeholders.filter((p) => p.id !== id));
	};

	// Auto-generate variable name from placeholder name
	const generateVariableName = (name: string): string => {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "");
	};

	// Validate current step
	const validateStep = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (step === "details") {
			if (!name.trim()) {
				newErrors.name = "Template name is required";
			}
			if (!description.trim()) {
				newErrors.description = "Description is required";
			}
		}

		if (step === "placeholders") {
			for (const placeholder of placeholders) {
				if (!placeholder.name.trim()) {
					newErrors[`${placeholder.id}-name`] = "Name is required";
				}
				if (!placeholder.variableName.trim()) {
					newErrors[`${placeholder.id}-variable`] = "Variable name is required";
				} else if (!/^[a-z][a-z0-9_]*$/.test(placeholder.variableName)) {
					newErrors[`${placeholder.id}-variable`] =
						"Variable name must start with a letter and contain only lowercase letters, numbers, and underscores";
				}
			}

			// Check for duplicate variable names
			const varNames = placeholders.map((p) => p.variableName);
			const duplicates = varNames.filter((v, i) => varNames.indexOf(v) !== i);
			if (duplicates.length > 0) {
				for (const placeholder of placeholders) {
					if (duplicates.includes(placeholder.variableName)) {
						newErrors[`${placeholder.id}-variable`] = "Duplicate variable name";
					}
				}
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Handle next step
	const handleNext = () => {
		if (!validateStep()) return;

		if (step === "details") {
			setStep("placeholders");
		} else if (step === "placeholders") {
			setStep("review");
		}
	};

	// Handle previous step
	const handleBack = () => {
		if (step === "placeholders") {
			setStep("details");
		} else if (step === "review") {
			setStep("placeholders");
		}
	};

	// Handle form submission
	const handleSubmit = async () => {
		if (!validateStep()) return;

		setIsSubmitting(true);

		try {
			const input: CreateTemplateInput = {
				name,
				description,
				content,
				visibility,
				categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
				tags: tags.length > 0 ? tags : undefined,
				placeholders: placeholders.length > 0 ? placeholders : undefined,
				difficulty,
				estimatedTime,
			};

			const response = await fetch("/api/v1/templates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});

			if (!response.ok) {
				throw new Error("Failed to create template");
			}

			const data = await response.json();
			onSave?.(data.id);
			setOpen(false);
		} catch (error) {
			console.error("Create template error:", error);
			setErrors({ form: "Failed to create template. Please try again." });
		} finally {
			setIsSubmitting(false);
		}
	};

	// Step indicator
	const steps = [
		{ key: "details", label: "Details" },
		{ key: "placeholders", label: "Placeholders" },
		{ key: "review", label: "Review" },
	] as const;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button variant="outline" className={cn("gap-2", className)}>
						<LayoutTemplate className="h-4 w-4" />
						Save as Template
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<LayoutTemplate className="h-5 w-5" />
						Save as Template
					</DialogTitle>
					<DialogDescription>
						Create a reusable template from your document.
					</DialogDescription>
				</DialogHeader>

				{/* Step indicator */}
				<div className="flex items-center justify-center gap-2 py-4">
					{steps.map((s, i) => (
						<React.Fragment key={s.key}>
							{i > 0 && (
								<div
									className={cn(
										"h-0.5 w-8",
										steps.findIndex((x) => x.key === step) >= i
											? "bg-blue-500"
											: "bg-gray-200 dark:bg-gray-700"
									)}
								/>
							)}
							<div
								className={cn(
									"flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
									step === s.key
										? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
										: steps.findIndex((x) => x.key === step) > i
										? "text-blue-600 dark:text-blue-400"
										: "text-gray-500 dark:text-gray-400"
								)}
							>
								<span
									className={cn(
										"flex items-center justify-center h-5 w-5 rounded-full text-xs",
										step === s.key
											? "bg-blue-500 text-white"
											: steps.findIndex((x) => x.key === step) > i
											? "bg-blue-500 text-white"
											: "bg-gray-200 dark:bg-gray-700 text-gray-500"
									)}
								>
									{i + 1}
								</span>
								{s.label}
							</div>
						</React.Fragment>
					))}
				</div>

				{/* Form content */}
				<div className="py-4 max-h-[60vh] overflow-y-auto">
					{step === "details" && (
						<DetailsStep
							name={name}
							setName={setName}
							description={description}
							setDescription={setDescription}
							visibility={visibility}
							setVisibility={setVisibility}
							categoryIds={categoryIds}
							setCategoryIds={setCategoryIds}
							categoryTree={categoryTree}
							tags={tags}
							tagInput={tagInput}
							setTagInput={setTagInput}
							addTag={addTag}
							removeTag={removeTag}
							difficulty={difficulty}
							setDifficulty={setDifficulty}
							estimatedTime={estimatedTime}
							setEstimatedTime={setEstimatedTime}
							errors={errors}
						/>
					)}

					{step === "placeholders" && (
						<PlaceholdersStep
							placeholders={placeholders}
							addPlaceholder={addPlaceholder}
							updatePlaceholder={updatePlaceholder}
							removePlaceholder={removePlaceholder}
							generateVariableName={generateVariableName}
							errors={errors}
						/>
					)}

					{step === "review" && (
						<ReviewStep
							name={name}
							description={description}
							visibility={visibility}
							categories={categories.filter((c) => categoryIds.includes(c.id))}
							tags={tags}
							difficulty={difficulty}
							estimatedTime={estimatedTime}
							placeholders={placeholders}
						/>
					)}

					{/* Form error */}
					{errors.form && (
						<div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
							<p className="text-sm text-red-700 dark:text-red-300">
								{errors.form}
							</p>
						</div>
					)}
				</div>

				<DialogFooter>
					{step !== "details" && (
						<Button variant="outline" onClick={handleBack}>
							Back
						</Button>
					)}
					{step !== "review" ? (
						<Button onClick={handleNext}>
							Continue
						</Button>
					) : (
						<Button onClick={handleSubmit} disabled={isSubmitting}>
							{isSubmitting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Creating...
								</>
							) : (
								<>
									<Save className="h-4 w-4 mr-2" />
									Create Template
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Details step component.
 */
function DetailsStep({
	name,
	setName,
	description,
	setDescription,
	visibility,
	setVisibility,
	categoryIds,
	setCategoryIds,
	categoryTree,
	tags,
	tagInput,
	setTagInput,
	addTag,
	removeTag,
	difficulty,
	setDifficulty,
	estimatedTime,
	setEstimatedTime,
	errors,
}: {
	name: string;
	setName: (name: string) => void;
	description: string;
	setDescription: (description: string) => void;
	visibility: TemplateVisibility;
	setVisibility: (visibility: TemplateVisibility) => void;
	categoryIds: string[];
	setCategoryIds: (ids: string[]) => void;
	categoryTree: CategoryTreeNode[];
	tags: string[];
	tagInput: string;
	setTagInput: (input: string) => void;
	addTag: () => void;
	removeTag: (tag: string) => void;
	difficulty?: "beginner" | "intermediate" | "advanced";
	setDifficulty: (difficulty: "beginner" | "intermediate" | "advanced" | undefined) => void;
	estimatedTime?: number;
	setEstimatedTime: (time: number | undefined) => void;
	errors: Record<string, string>;
}) {
	return (
		<div className="space-y-6">
			{/* Name */}
			<div>
				<span className="text-sm font-medium text-gray-900 dark:text-white">
					Template Name <span className="text-red-500">*</span>
				</span>
				<Input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Enter template name"
					className={cn("mt-1", errors.name && "border-red-500")}
				 aria-label="Template Name"/>
				{errors.name && <InputError>{errors.name}</InputError>}
			</div>

			{/* Description */}
			<div>
				<span className="text-sm font-medium text-gray-900 dark:text-white">
					Description <span className="text-red-500">*</span>
				</span>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Describe what this template is for"
					rows={3}
					className={cn(
						"w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg",
						"bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
						"focus:outline-none focus:ring-2 focus:ring-blue-500",
						errors.description && "border-red-500"
					)}
				 aria-label="Description"/>
				{errors.description && <InputError>{errors.description}</InputError>}
			</div>

			{/* Visibility */}
			<div>
				<span className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
					Visibility
				</span>
				<div className="grid grid-cols-2 gap-3">
					{visibilityOptions.map((option) => {
						const Icon = option.icon;
						return (
							<button
								key={option.value}
								type="button"
								onClick={() => setVisibility(option.value)}
								className={cn(
									"flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
									visibility === option.value
										? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
										: "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
								)}
							>
								<Icon
									className={cn(
										"h-5 w-5 mt-0.5",
										visibility === option.value
											? "text-blue-500"
											: "text-gray-400"
									)}
								/>
								<div>
									<p
										className={cn(
											"font-medium",
											visibility === option.value
												? "text-blue-700 dark:text-blue-300"
												: "text-gray-900 dark:text-white"
										)}
									>
										{option.label}
									</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{option.description}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{/* Categories */}
			<div>
				<span className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
					Categories
				</span>
				<CategorySelector
					categories={categoryTree}
					selectedIds={categoryIds}
					onChange={setCategoryIds}
				/>
			</div>

			{/* Tags */}
			<div>
				<span className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
					Tags
				</span>
				<div className="flex flex-wrap items-center gap-2">
					{tags.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400"
						>
							{tag}
							<button
								type="button"
								onClick={() => removeTag(tag)}
								className="hover:text-blue-800 dark:hover:text-blue-200"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</span>
					))}
					<div className="flex items-center gap-1">
						<Input
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addTag();
								}
							}}
							placeholder="Add tag"
							className="w-24 h-8 text-sm"
						 aria-label="Tags"/>
						<Button type="button" variant="ghost" size="sm" onClick={addTag}>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Difficulty and estimated time */}
			<div className="grid grid-cols-2 gap-4">
				<div>
					<span className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
						Difficulty
					</span>
					<select
						value={difficulty ?? ""}
						onChange={(e) =>
							setDifficulty(
								e.target.value
									? (e.target.value as "beginner" | "intermediate" | "advanced")
									: undefined
							)
						}
						className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
					 aria-label="Difficulty">
						<option value="">Not specified</option>
						{difficultyOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<div>
					<span className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
						Estimated Time (minutes)
					</span>
					<Input
						type="number"
						value={estimatedTime ?? ""}
						onChange={(e) =>
							setEstimatedTime(e.target.value ? parseInt(e.target.value) : undefined)
						}
						placeholder="e.g., 30"
						min={1}
					 aria-label="Estimated Time (minutes)"/>
				</div>
			</div>
		</div>
	);
}

/**
 * Category selector component.
 */
function CategorySelector({
	categories,
	selectedIds,
	onChange,
}: {
	categories: CategoryTreeNode[];
	selectedIds: string[];
	onChange: (ids: string[]) => void;
}) {
	const toggleCategory = (id: string) => {
		if (selectedIds.includes(id)) {
			onChange(selectedIds.filter((i) => i !== id));
		} else {
			onChange([...selectedIds, id]);
		}
	};

	const renderCategory = (category: CategoryTreeNode, depth = 0) => (
		<div key={category.id}>
			<label
				className={cn(
					"flex items-center gap-2 py-1 cursor-pointer",
					depth > 0 && "ml-4"
				)}
			>
				<input
					type="checkbox"
					checked={selectedIds.includes(category.id)}
					onChange={() => toggleCategory(category.id)}
					className="rounded border-gray-300 dark:border-gray-600"
				/>
				<span className="text-sm text-gray-700 dark:text-gray-300">
					{category.name}
				</span>
			</label>
			{category.children.map((child) => renderCategory(child, depth + 1))}
		</div>
	);

	return (
		<div className="max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
			{categories.length === 0 ? (
				<p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
					No categories available
				</p>
			) : (
				categories.map((category) => renderCategory(category))
			)}
		</div>
	);
}

/**
 * Placeholders step component.
 */
function PlaceholdersStep({
	placeholders,
	addPlaceholder,
	updatePlaceholder,
	removePlaceholder,
	generateVariableName,
	errors,
}: {
	placeholders: TemplatePlaceholder[];
	addPlaceholder: () => void;
	updatePlaceholder: (id: string, updates: Partial<TemplatePlaceholder>) => void;
	removePlaceholder: (id: string) => void;
	generateVariableName: (name: string) => string;
	errors: Record<string, string>;
}) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-medium text-gray-900 dark:text-white">
						Placeholders
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Define fields that users will fill in when using this template.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={addPlaceholder}>
					<Plus className="h-4 w-4 mr-1" />
					Add Placeholder
				</Button>
			</div>

			{placeholders.length === 0 ? (
				<div className="p-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
					<Variable className="h-8 w-8 mx-auto text-gray-400 mb-2" />
					<p className="text-sm text-gray-500 dark:text-gray-400">
						No placeholders defined yet.
					</p>
					<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
						Add placeholders to create dynamic fields in your template.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{placeholders.map((placeholder, index) => (
						<PlaceholderEditor
							key={placeholder.id}
							placeholder={placeholder}
							index={index}
							onUpdate={(updates) => updatePlaceholder(placeholder.id, updates)}
							onRemove={() => removePlaceholder(placeholder.id)}
							generateVariableName={generateVariableName}
							errors={errors}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Placeholder editor component.
 */
function PlaceholderEditor({
	placeholder,
	index,
	onUpdate,
	onRemove,
	generateVariableName,
	errors,
}: {
	placeholder: TemplatePlaceholder;
	index: number;
	onUpdate: (updates: Partial<TemplatePlaceholder>) => void;
	onRemove: () => void;
	generateVariableName: (name: string) => string;
	errors: Record<string, string>;
}) {
	const [expanded, setExpanded] = React.useState(true);

	// Auto-generate variable name when name changes
	const handleNameChange = (name: string) => {
		onUpdate({
			name,
			variableName: placeholder.variableName || generateVariableName(name),
		});
	};

	return (
		<div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
			{/* Header */}
			<div
				className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
				onClick={() => setExpanded(!expanded)}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
				<div className="flex items-center gap-3">
					<GripVertical className="h-4 w-4 text-gray-400" />
					<span className="font-medium text-gray-900 dark:text-white">
						{placeholder.name || `Placeholder ${index + 1}`}
					</span>
					{placeholder.required && (
						<span className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
							Required
						</span>
					)}
					<span className="text-xs text-gray-400 font-mono">
						{`{{${placeholder.variableName || "..."}}}`}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							onRemove();
						}}
						className="text-red-500 hover:text-red-700"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
					{expanded ? (
						<ChevronUp className="h-4 w-4 text-gray-400" />
					) : (
						<ChevronDown className="h-4 w-4 text-gray-400" />
					)}
				</div>
			</div>

			{/* Body */}
			{expanded && (
				<div className="p-4 space-y-4">
					<div className="grid grid-cols-2 gap-4">
						{/* Name */}
						<div>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Name <span className="text-red-500">*</span>
							</span>
							<Input
								value={placeholder.name}
								onChange={(e) => handleNameChange(e.target.value)}
								placeholder="e.g., Company Name"
								className={cn(
									"mt-1",
									errors[`${placeholder.id}-name`] && "border-red-500"
								)}
							 aria-label="Name"/>
							{errors[`${placeholder.id}-name`] && (
								<InputError>{errors[`${placeholder.id}-name`]}</InputError>
							)}
						</div>

						{/* Variable name */}
						<div>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Variable Name <span className="text-red-500">*</span>
							</span>
							<Input
								value={placeholder.variableName}
								onChange={(e) => onUpdate({ variableName: e.target.value })}
								placeholder="e.g., company_name"
								className={cn(
									"mt-1 font-mono",
									errors[`${placeholder.id}-variable`] && "border-red-500"
								)}
							 aria-label="Variable Name"/>
							{errors[`${placeholder.id}-variable`] && (
								<InputError>{errors[`${placeholder.id}-variable`]}</InputError>
							)}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Type */}
						<div>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Type
							</span>
							<select
								value={placeholder.type}
								onChange={(e) => onUpdate({ type: e.target.value as PlaceholderType })}
								className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
							 aria-label="Type">
								{placeholderTypeOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						{/* Required */}
						<div className="flex items-end pb-2">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={placeholder.required}
									onChange={(e) => onUpdate({ required: e.target.checked })}
									className="rounded border-gray-300 dark:border-gray-600"
								/>
								<span className="text-sm text-gray-700 dark:text-gray-300">
									Required field
								</span>
							</label>
						</div>
					</div>

					{/* Description */}
					<div>
						<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
							Description
						</span>
						<Input
							value={placeholder.description ?? ""}
							onChange={(e) => onUpdate({ description: e.target.value || undefined })}
							placeholder="Help text for users"
							className="mt-1"
						 aria-label="Description"/>
					</div>

					{/* Default value */}
					<div>
						<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
							Default Value
						</span>
						<Input
							value={placeholder.defaultValue ?? ""}
							onChange={(e) => onUpdate({ defaultValue: e.target.value || undefined })}
							placeholder="Optional default value"
							className="mt-1"
						 aria-label="Default Value"/>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * Review step component.
 */
function ReviewStep({
	name,
	description,
	visibility,
	categories,
	tags,
	difficulty,
	estimatedTime,
	placeholders,
}: {
	name: string;
	description: string;
	visibility: TemplateVisibility;
	categories: TemplateCategory[];
	tags: string[];
	difficulty?: "beginner" | "intermediate" | "advanced";
	estimatedTime?: number;
	placeholders: TemplatePlaceholder[];
}) {
	const visibilityOption = visibilityOptions.find((v) => v.value === visibility);
	const Icon = visibilityOption?.icon ?? Eye;

	return (
		<div className="space-y-6">
			<div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
					{name}
				</h3>
				<p className="text-gray-600 dark:text-gray-400 mt-1">
					{description}
				</p>
			</div>

			<div className="grid grid-cols-2 gap-4 text-sm">
				<div>
					<span className="text-gray-500 dark:text-gray-400">Visibility</span>
					<div className="flex items-center gap-2 mt-1">
						<Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
						<span className="text-gray-900 dark:text-white">
							{visibilityOption?.label}
						</span>
					</div>
				</div>

				{difficulty && (
					<div>
						<span className="text-gray-500 dark:text-gray-400">Difficulty</span>
						<p className="text-gray-900 dark:text-white capitalize mt-1">
							{difficulty}
						</p>
					</div>
				)}

				{estimatedTime && (
					<div>
						<span className="text-gray-500 dark:text-gray-400">Estimated Time</span>
						<p className="text-gray-900 dark:text-white mt-1">
							{estimatedTime} minutes
						</p>
					</div>
				)}
			</div>

			{categories.length > 0 && (
				<div>
					<span className="text-sm text-gray-500 dark:text-gray-400">Categories</span>
					<div className="flex flex-wrap gap-2 mt-2">
						{categories.map((category) => (
							<span
								key={category.id}
								className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400"
							>
								{category.name}
							</span>
						))}
					</div>
				</div>
			)}

			{tags.length > 0 && (
				<div>
					<span className="text-sm text-gray-500 dark:text-gray-400">Tags</span>
					<div className="flex flex-wrap gap-2 mt-2">
						{tags.map((tag) => (
							<span
								key={tag}
								className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
			)}

			{placeholders.length > 0 && (
				<div>
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Placeholders ({placeholders.length})
					</span>
					<div className="mt-2 space-y-2">
						{placeholders.map((placeholder) => (
							<div
								key={placeholder.id}
								className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800/50"
							>
								<Variable className="h-4 w-4 text-purple-500" />
								<span className="text-gray-900 dark:text-white">
									{placeholder.name}
								</span>
								<span className="text-xs text-gray-400 font-mono">
									{`{{${placeholder.variableName}}}`}
								</span>
								<span className="text-xs text-gray-400 capitalize">
									{placeholder.type}
								</span>
								{placeholder.required && (
									<span className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
										Required
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
