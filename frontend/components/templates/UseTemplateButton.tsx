/**
 * Use template button and dialog for DocFusion.
 *
 * Provides a button that opens a dialog to create a new document
 * from a template, with placeholder value inputs.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type {
	Template,
	TemplateSummary,
	TemplatePlaceholder,
	UseTemplateInput,
	PlaceholderType,
} from "@/lib/types/template";
import { useTemplate } from "@/lib/query/hooks/useTemplates";
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
import {
	Sparkles,
	FileText,
	Loader2,
	Variable,
	Wand2,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";

/**
 * Props for UseTemplateButton component.
 */
export interface UseTemplateButtonProps {
	/** Template to use (summary or full) */
	template: TemplateSummary | Template;
	/** Button variant */
	variant?: "primary" | "outline" | "ghost" | "secondary";
	/** Button size */
	size?: "sm" | "md" | "lg" | "icon";
	/** Whether to show icon */
	showIcon?: boolean;
	/** Button label */
	label?: string;
	/** Additional CSS classes */
	className?: string;
	/** Children to render as button content */
	children?: React.ReactNode;
}

/**
 * Use template button with dialog.
 */
export function UseTemplateButton({
	template,
	variant = "primary",
	size = "md",
	showIcon = true,
	label = "Use Template",
	className,
	children,
}: UseTemplateButtonProps) {
	const [open, setOpen] = React.useState(false);
	const router = useRouter();

	// Fetch full template if we only have summary
	const { data: fullTemplate, isLoading: isLoadingTemplate } = useTemplate(
		open ? template.id : null
	);

	// Use full template data if available, otherwise use what we have
	const templateData = fullTemplate ?? (template as Template);
	const hasPlaceholders = "placeholders" in templateData && templateData.placeholders?.length > 0;

	// Handle successful document creation
	const handleSuccess = (documentId: string) => {
		setOpen(false);
		router.push(`/documents/${documentId}`);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={variant} size={size} className={cn("gap-2", className)}>
					{showIcon && <Sparkles className="h-4 w-4" />}
					{children ?? label}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{isLoadingTemplate ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
					</div>
				) : hasPlaceholders ? (
					<UseTemplateForm
						template={templateData}
						onSuccess={handleSuccess}
						onCancel={() => setOpen(false)}
					/>
				) : (
					<QuickUseTemplate
						template={templateData}
						onSuccess={handleSuccess}
						onCancel={() => setOpen(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

/**
 * Form for creating document with placeholder values.
 */
function UseTemplateForm({
	template,
	onSuccess,
	onCancel,
}: {
	template: Template;
	onSuccess: (documentId: string) => void;
	onCancel: () => void;
}) {
	const [title, setTitle] = React.useState(`New ${template.name}`);
	const [values, setValues] = React.useState<Record<string, string | number | boolean | string[]>>({});
	const [useAI, setUseAI] = React.useState(false);
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [aiFillingFields, setAIFillingFields] = React.useState<Set<string>>(new Set());

	// Initialize default values
	React.useEffect(() => {
		const defaults: Record<string, string | number | boolean | string[]> = {};
		for (const placeholder of template.placeholders) {
			if (placeholder.defaultValue !== undefined) {
				defaults[placeholder.variableName] = placeholder.defaultValue;
			} else if (placeholder.type === "boolean") {
				defaults[placeholder.variableName] = false;
			} else if (placeholder.type === "multiselect") {
				defaults[placeholder.variableName] = [];
			}
		}
		setValues(defaults);
	}, [template.placeholders]);

	// Update a single value
	const updateValue = (variableName: string, value: string | number | boolean | string[]) => {
		setValues((prev) => ({ ...prev, [variableName]: value }));
		// Clear error when value changes
		if (errors[variableName]) {
			setErrors((prev) => {
				const next = { ...prev };
				delete next[variableName];
				return next;
			});
		}
	};

	// Validate all required fields
	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (!title.trim()) {
			newErrors.title = "Document title is required";
		}

		for (const placeholder of template.placeholders) {
			if (placeholder.required) {
				const value = values[placeholder.variableName];
				if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
					newErrors[placeholder.variableName] = `${placeholder.name} is required`;
				}
			}

			// Additional validation based on type
			if (placeholder.validation) {
				const value = values[placeholder.variableName];
				if (typeof value === "string") {
					if (placeholder.validation.minLength && value.length < placeholder.validation.minLength) {
						newErrors[placeholder.variableName] = `Minimum ${placeholder.validation.minLength} characters`;
					}
					if (placeholder.validation.maxLength && value.length > placeholder.validation.maxLength) {
						newErrors[placeholder.variableName] = `Maximum ${placeholder.validation.maxLength} characters`;
					}
					if (placeholder.validation.pattern) {
						const regex = new RegExp(placeholder.validation.pattern);
						if (!regex.test(value)) {
							newErrors[placeholder.variableName] =
								placeholder.validation.patternMessage ?? "Invalid format";
						}
					}
				}
				if (typeof value === "number") {
					if (placeholder.validation.min !== undefined && value < placeholder.validation.min) {
						newErrors[placeholder.variableName] = `Minimum value is ${placeholder.validation.min}`;
					}
					if (placeholder.validation.max !== undefined && value > placeholder.validation.max) {
						newErrors[placeholder.variableName] = `Maximum value is ${placeholder.validation.max}`;
					}
				}
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Handle AI fill for a single field
	const handleAIFill = async (placeholder: TemplatePlaceholder) => {
		if (!placeholder.aiPrompt) return;

		setAIFillingFields((prev) => new Set([...prev, placeholder.variableName]));

		try {
			// Call AI API to fill the field
			const response = await fetch("/api/v1/ai/completion", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command: "fill-placeholder",
					context: {
						templateId: template.id,
						templateName: template.name,
						placeholderName: placeholder.name,
						placeholderPrompt: placeholder.aiPrompt,
						otherValues: values,
					},
				}),
			});

			if (response.ok) {
				const data = await response.json();
				updateValue(placeholder.variableName, data.result);
			}
		} catch (error) {
			console.error("AI fill error:", error);
		} finally {
			setAIFillingFields((prev) => {
				const next = new Set(prev);
				next.delete(placeholder.variableName);
				return next;
			});
		}
	};

	// Handle form submission
	const handleSubmit = async () => {
		if (!validate()) return;

		setIsSubmitting(true);

		try {
			const input: UseTemplateInput = {
				templateId: template.id,
				title,
				placeholderValues: values,
				useAIFill: useAI,
			};

			const response = await fetch("/api/v1/documents/from-template", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});

			if (!response.ok) {
				throw new Error("Failed to create document");
			}

			const data = await response.json();
			onSuccess(data.id);
		} catch (error) {
			console.error("Create document error:", error);
			setErrors((prev) => ({
				...prev,
				form: "Failed to create document. Please try again.",
			}));
		} finally {
			setIsSubmitting(false);
		}
	};

	// Group placeholders by required status
	const requiredPlaceholders = template.placeholders.filter((p) => p.required);
	const optionalPlaceholders = template.placeholders.filter((p) => !p.required);

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					Create from Template
				</DialogTitle>
				<DialogDescription>
					Fill in the details below to create a new document from "{template.name}".
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
				{/* Document title */}
				<div>
					<label className="text-sm font-medium text-gray-900 dark:text-white">
						Document Title <span className="text-red-500">*</span>
					</label>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Enter document title"
						className={cn("mt-1", errors.title && "border-red-500")}
					/>
					{errors.title && <InputError>{errors.title}</InputError>}
				</div>

				{/* AI auto-fill toggle */}
				{template.placeholders.some((p) => p.aiPrompt) && (
					<div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
						<div className="flex items-center gap-2">
							<Wand2 className="h-5 w-5 text-blue-500" />
							<div>
								<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
									AI Auto-fill Available
								</p>
								<p className="text-xs text-blue-700 dark:text-blue-300">
									Let AI fill some fields automatically
								</p>
							</div>
						</div>
						<label className="relative inline-flex items-center cursor-pointer">
							<input
								type="checkbox"
								checked={useAI}
								onChange={(e) => setUseAI(e.target.checked)}
								className="sr-only peer"
							/>
							<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
						</label>
					</div>
				)}

				{/* Required placeholders */}
				{requiredPlaceholders.length > 0 && (
					<div className="space-y-4">
						<h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
							<AlertCircle className="h-4 w-4 text-red-500" />
							Required Fields
						</h4>
						{requiredPlaceholders.map((placeholder) => (
							<PlaceholderInput
								key={placeholder.id}
								placeholder={placeholder}
								value={values[placeholder.variableName]}
								onChange={(value) => updateValue(placeholder.variableName, value)}
								error={errors[placeholder.variableName]}
								onAIFill={() => handleAIFill(placeholder)}
								isAIFilling={aiFillingFields.has(placeholder.variableName)}
							/>
						))}
					</div>
				)}

				{/* Optional placeholders */}
				{optionalPlaceholders.length > 0 && (
					<div className="space-y-4">
						<h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
							Optional Fields
						</h4>
						{optionalPlaceholders.map((placeholder) => (
							<PlaceholderInput
								key={placeholder.id}
								placeholder={placeholder}
								value={values[placeholder.variableName]}
								onChange={(value) => updateValue(placeholder.variableName, value)}
								error={errors[placeholder.variableName]}
								onAIFill={() => handleAIFill(placeholder)}
								isAIFilling={aiFillingFields.has(placeholder.variableName)}
							/>
						))}
					</div>
				)}

				{/* Form error */}
				{errors.form && (
					<div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
						<p className="text-sm text-red-700 dark:text-red-300">
							{errors.form}
						</p>
					</div>
				)}
			</div>

			<DialogFooter>
				<Button variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Creating...
						</>
					) : (
						<>
							<CheckCircle2 className="h-4 w-4 mr-2" />
							Create Document
						</>
					)}
				</Button>
			</DialogFooter>
		</>
	);
}

/**
 * Input component for a single placeholder.
 */
function PlaceholderInput({
	placeholder,
	value,
	onChange,
	error,
	onAIFill,
	isAIFilling,
}: {
	placeholder: TemplatePlaceholder;
	value: string | number | boolean | string[] | undefined;
	onChange: (value: string | number | boolean | string[]) => void;
	error?: string;
	onAIFill?: () => void;
	isAIFilling?: boolean;
}) {
	const id = `placeholder-${placeholder.id}`;

	return (
		<div>
			<div className="flex items-center justify-between">
				<label
					htmlFor={id}
					className="text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					{placeholder.name}
					{placeholder.required && <span className="text-red-500 ml-1">*</span>}
				</label>
				{placeholder.aiPrompt && onAIFill && (
					<button
						type="button"
						onClick={onAIFill}
						disabled={isAIFilling}
						className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
					>
						{isAIFilling ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<Wand2 className="h-3 w-3" />
						)}
						AI Fill
					</button>
				)}
			</div>

			{placeholder.description && (
				<InputDescription className="mt-0.5">
					{placeholder.description}
				</InputDescription>
			)}

			<div className="mt-1">
				{renderPlaceholderInput(placeholder, value, onChange, id, error)}
			</div>

			{error && <InputError>{error}</InputError>}
		</div>
	);
}

/**
 * Render appropriate input for placeholder type.
 */
function renderPlaceholderInput(
	placeholder: TemplatePlaceholder,
	value: string | number | boolean | string[] | undefined,
	onChange: (value: string | number | boolean | string[]) => void,
	id: string,
	error?: string
) {
	const inputClass = cn(error && "border-red-500");

	switch (placeholder.type) {
		case "textarea":
			return (
				<textarea
					id={id}
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder.defaultValue}
					rows={3}
					className={cn(
						"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg",
						"bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
						"focus:outline-none focus:ring-2 focus:ring-blue-500",
						inputClass
					)}
				/>
			);

		case "number":
			return (
				<Input
					id={id}
					type="number"
					value={(value as number) ?? ""}
					onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
					placeholder={placeholder.defaultValue}
					min={placeholder.validation?.min}
					max={placeholder.validation?.max}
					className={inputClass}
				/>
			);

		case "date":
			return (
				<Input
					id={id}
					type="date"
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					className={inputClass}
				/>
			);

		case "email":
			return (
				<Input
					id={id}
					type="email"
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder.defaultValue ?? "email@example.com"}
					className={inputClass}
				/>
			);

		case "url":
			return (
				<Input
					id={id}
					type="url"
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder.defaultValue ?? "https://"}
					className={inputClass}
				/>
			);

		case "currency":
			return (
				<div className="relative">
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
						$
					</span>
					<Input
						id={id}
						type="number"
						value={(value as number) ?? ""}
						onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
						placeholder="0.00"
						step="0.01"
						min={0}
						className={cn("pl-7", inputClass)}
					/>
				</div>
			);

		case "boolean":
			return (
				<label className="flex items-center gap-2 cursor-pointer">
					<input
						id={id}
						type="checkbox"
						checked={(value as boolean) ?? false}
						onChange={(e) => onChange(e.target.checked)}
						className="rounded border-gray-300 dark:border-gray-600"
					/>
					<span className="text-sm text-gray-600 dark:text-gray-400">
						{placeholder.defaultValue ?? "Yes"}
					</span>
				</label>
			);

		case "select":
			return (
				<select
					id={id}
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					className={cn(
						"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg",
						"bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
						"focus:outline-none focus:ring-2 focus:ring-blue-500",
						inputClass
					)}
				>
					<option value="">Select an option</option>
					{placeholder.options?.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			);

		case "multiselect":
			return (
				<div className="space-y-2">
					{placeholder.options?.map((option) => (
						<label
							key={option.value}
							className="flex items-center gap-2 cursor-pointer"
						>
							<input
								type="checkbox"
								checked={(value as string[])?.includes(option.value) ?? false}
								onChange={(e) => {
									const currentValues = (value as string[]) ?? [];
									if (e.target.checked) {
										onChange([...currentValues, option.value]);
									} else {
										onChange(currentValues.filter((v) => v !== option.value));
									}
								}}
								className="rounded border-gray-300 dark:border-gray-600"
							/>
							<span className="text-sm text-gray-600 dark:text-gray-400">
								{option.label}
							</span>
						</label>
					))}
				</div>
			);

		case "text":
		default:
			return (
				<Input
					id={id}
					type="text"
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder.defaultValue}
					minLength={placeholder.validation?.minLength}
					maxLength={placeholder.validation?.maxLength}
					className={inputClass}
				/>
			);
	}
}

/**
 * Quick use template (no placeholders).
 */
function QuickUseTemplate({
	template,
	onSuccess,
	onCancel,
}: {
	template: Template;
	onSuccess: (documentId: string) => void;
	onCancel: () => void;
}) {
	const [title, setTitle] = React.useState(`New ${template.name}`);
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [error, setError] = React.useState<string>();

	const handleSubmit = async () => {
		if (!title.trim()) {
			setError("Document title is required");
			return;
		}

		setIsSubmitting(true);
		setError(undefined);

		try {
			const response = await fetch("/api/v1/documents/from-template", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					templateId: template.id,
					title,
					placeholderValues: {},
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to create document");
			}

			const data = await response.json();
			onSuccess(data.id);
		} catch (err) {
			setError("Failed to create document. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					Create from Template
				</DialogTitle>
				<DialogDescription>
					Create a new document from "{template.name}".
				</DialogDescription>
			</DialogHeader>

			<div className="py-4">
				<label className="text-sm font-medium text-gray-900 dark:text-white">
					Document Title <span className="text-red-500">*</span>
				</label>
				<Input
					value={title}
					onChange={(e) => {
						setTitle(e.target.value);
						setError(undefined);
					}}
					placeholder="Enter document title"
					className={cn("mt-1", error && "border-red-500")}
				/>
				{error && <InputError>{error}</InputError>}
			</div>

			<DialogFooter>
				<Button variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Creating...
						</>
					) : (
						<>
							<Sparkles className="h-4 w-4 mr-2" />
							Create Document
						</>
					)}
				</Button>
			</DialogFooter>
		</>
	);
}
