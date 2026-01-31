/**
 * Custom Variables Component - DocFusion
 *
 * Manage user-defined company variables for template substitution.
 * Variables are accessible in templates as {{custom.variable_name}}.
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Plus,
	Trash2,
	Edit2,
	Copy,
	Check,
	Variable,
	GripVertical,
	Search,
	Loader2,
	AlertCircle,
	Tag,
} from "lucide-react";
import {
	type CompanyVariable,
	type CreateVariableInput,
	type VariableValueType,
	type VariableCategory,
	VARIABLE_VALUE_TYPES,
	VARIABLE_CATEGORIES,
} from "@/lib/types/company";
import {
	getCompanyVariables,
	createCompanyVariable,
	updateCompanyVariable,
	deleteCompanyVariable,
	updateVariableSortOrder,
	validateVariableName,
} from "@/lib/actions/company-variables";

// ============================================================================
// Types
// ============================================================================

interface VariableFormData {
	name: string;
	label: string;
	value: string;
	description: string;
	valueType: VariableValueType;
	category: VariableCategory;
}

// ============================================================================
// Constants
// ============================================================================

const VALUE_TYPE_LABELS: Record<VariableValueType, string> = {
	text: "Text",
	number: "Number",
	date: "Date",
	url: "URL",
	email: "Email",
	phone: "Phone",
	currency: "Currency",
	boolean: "Yes/No",
};

const CATEGORY_LABELS: Record<VariableCategory, string> = {
	general: "General",
	contact: "Contact",
	legal: "Legal",
	branding: "Branding",
	financial: "Financial",
	custom: "Custom",
};

const CATEGORY_COLORS: Record<VariableCategory, string> = {
	general: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
	contact: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	legal: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
	branding: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
	financial: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	custom: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

const DEFAULT_FORM_DATA: VariableFormData = {
	name: "",
	label: "",
	value: "",
	description: "",
	valueType: "text",
	category: "custom",
};

// ============================================================================
// Helper Components
// ============================================================================

interface CopyButtonProps {
	text: string;
}

function CopyButton({ text }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [text]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={handleCopy}
				>
					{copied ? (
						<Check className="h-3.5 w-3.5 text-green-500" />
					) : (
						<Copy className="h-3.5 w-3.5" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				{copied ? "Copied!" : `Copy {{custom.${text}}}`}
			</TooltipContent>
		</Tooltip>
	);
}

interface VariableCardProps {
	variable: CompanyVariable;
	onEdit: () => void;
	onDelete: () => void;
	isDragging?: boolean;
}

function VariableCard({ variable, onEdit, onDelete, isDragging }: VariableCardProps) {
	const templateVar = `{{custom.${variable.name}}}`;
	const categoryColor = CATEGORY_COLORS[variable.category || "custom"];

	return (
		<div
			className={`group flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-all ${
				isDragging ? "opacity-50" : ""
			} ${!variable.isActive ? "opacity-60" : ""}`}
		>
			{/* Drag Handle */}
			<div className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
				<GripVertical className="h-4 w-4" />
			</div>

			{/* Variable Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm truncate">{variable.label}</span>
					<span className={`px-1.5 py-0.5 text-[10px] rounded ${categoryColor}`}>
						{CATEGORY_LABELS[variable.category || "custom"]}
					</span>
					{!variable.isActive && (
						<span className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
							Inactive
						</span>
					)}
				</div>
				<div className="flex items-center gap-2 mt-0.5">
					<code className="text-xs text-muted-foreground font-mono">
						{templateVar}
					</code>
					<CopyButton text={variable.name} />
				</div>
				{variable.value && (
					<p className="text-xs text-muted-foreground mt-1 truncate">
						= &quot;{variable.value}&quot;
					</p>
				)}
			</div>

			{/* Actions */}
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={onEdit}
						>
							<Edit2 className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Edit</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-destructive"
							onClick={onDelete}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Delete</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomVariables() {
	const [variables, setVariables] = useState<CompanyVariable[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterCategory, setFilterCategory] = useState<VariableCategory | "all">("all");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [formData, setFormData] = useState<VariableFormData>(DEFAULT_FORM_DATA);

	// Load data on mount
	useEffect(() => {
		async function loadData() {
			try {
				const data = await getCompanyVariables();
				setVariables(data);
			} catch (error) {
				console.error("Failed to load variables:", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadData();
	}, []);

	// Group variables by category
	const groupedVariables = useMemo(() => {
		let filtered = variables;

		// Apply search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(v) =>
					v.name.toLowerCase().includes(query) ||
					v.label.toLowerCase().includes(query) ||
					v.value?.toLowerCase().includes(query)
			);
		}

		// Apply category filter
		if (filterCategory !== "all") {
			filtered = filtered.filter((v) => v.category === filterCategory);
		}

		// Group by category
		const groups: Record<VariableCategory, CompanyVariable[]> = {
			general: [],
			contact: [],
			legal: [],
			branding: [],
			financial: [],
			custom: [],
		};

		filtered.forEach((v) => {
			const cat = v.category || "custom";
			groups[cat].push(v);
		});

		// Sort by sortOrder within each group
		Object.values(groups).forEach((group) =>
			group.sort((a, b) => a.sortOrder - b.sortOrder)
		);

		return groups;
	}, [variables, searchQuery, filterCategory]);

	// Check if any groups have variables
	const hasVariables = Object.values(groupedVariables).some((g) => g.length > 0);

	// Form handlers
	const resetForm = useCallback(() => {
		setFormData(DEFAULT_FORM_DATA);
		setEditingId(null);
		setFormError(null);
	}, []);

	const openCreateDialog = useCallback(() => {
		resetForm();
		setIsDialogOpen(true);
	}, [resetForm]);

	const openEditDialog = useCallback((variable: CompanyVariable) => {
		setFormData({
			name: variable.name,
			label: variable.label,
			value: variable.value || "",
			description: variable.description || "",
			valueType: variable.valueType,
			category: variable.category || "custom",
		});
		setEditingId(variable.id);
		setFormError(null);
		setIsDialogOpen(true);
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		// Validate name
		const validation = await validateVariableName(formData.name);
		if (!validation.valid) {
			setFormError(validation.error || "Invalid variable name");
			return;
		}

		setIsSubmitting(true);

		try {
			if (editingId) {
				// Update existing variable
				const updated = await updateCompanyVariable(editingId, {
					name: formData.name,
					label: formData.label,
					value: formData.value || null,
					description: formData.description || null,
					valueType: formData.valueType,
					category: formData.category,
				});
				setVariables((prev) =>
					prev.map((v) => (v.id === editingId ? updated : v))
				);
			} else {
				// Create new variable
				const created = await createCompanyVariable({
					name: formData.name,
					label: formData.label,
					value: formData.value || undefined,
					description: formData.description || undefined,
					valueType: formData.valueType,
					category: formData.category,
				});
				setVariables((prev) => [...prev, created]);
			}

			setIsDialogOpen(false);
			resetForm();
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : "An error occurred"
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteConfirmId) return;

		try {
			await deleteCompanyVariable(deleteConfirmId);
			setVariables((prev) => prev.filter((v) => v.id !== deleteConfirmId));
		} catch (error) {
			console.error("Failed to delete variable:", error);
		} finally {
			setDeleteConfirmId(null);
		}
	};

	// Auto-generate name from label
	const handleLabelChange = (label: string) => {
		setFormData((prev) => {
			const newData = { ...prev, label };
			// Only auto-generate name if creating new and name is empty or matches auto-generated pattern
			if (!editingId && (!prev.name || prev.name === toVariableName(prev.label))) {
				newData.name = toVariableName(label);
			}
			return newData;
		});
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h3 className="text-lg font-semibold flex items-center gap-2">
						<Variable className="h-5 w-5 text-primary" />
						Custom Variables
					</h3>
					<p className="text-sm text-muted-foreground">
						Define variables for use in document templates as{" "}
						<code className="px-1 py-0.5 bg-muted rounded text-xs">
							{"{{custom.variable_name}}"}
						</code>
					</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={openCreateDialog}>
							<Plus className="h-4 w-4 mr-2" />
							Add Variable
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>
								{editingId ? "Edit Variable" : "Create Variable"}
							</DialogTitle>
							<DialogDescription>
								{editingId
									? "Update the variable details."
									: "Create a new custom variable for templates."}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4 mt-4">
							{formError && (
								<div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
									<AlertCircle className="h-4 w-4 flex-shrink-0" />
									{formError}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="label">Label *</Label>
								<Input
									id="label"
									value={formData.label}
									onChange={(e) => handleLabelChange(e.target.value)}
									placeholder="e.g., Support Email"
									required
								/>
								<p className="text-xs text-muted-foreground">
									Human-readable name for the variable
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="name">Variable Name *</Label>
								<div className="flex items-center gap-2">
									<code className="text-sm text-muted-foreground">
										{"{{custom."}
									</code>
									<Input
										id="name"
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										placeholder="support_email"
										className="font-mono"
										required
									/>
									<code className="text-sm text-muted-foreground">{"}}"}</code>
								</div>
								<p className="text-xs text-muted-foreground">
									Use letters, numbers, and underscores only
								</p>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="valueType">Type</Label>
									<Select
										value={formData.valueType}
										onValueChange={(value) =>
											setFormData({
												...formData,
												valueType: value as VariableValueType,
											})
										}
									>
										<SelectTrigger id="valueType">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{VARIABLE_VALUE_TYPES.map((type) => (
												<SelectItem key={type} value={type}>
													{VALUE_TYPE_LABELS[type]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="category">Category</Label>
									<Select
										value={formData.category}
										onValueChange={(value) =>
											setFormData({
												...formData,
												category: value as VariableCategory,
											})
										}
									>
										<SelectTrigger id="category">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{VARIABLE_CATEGORIES.map((cat) => (
												<SelectItem key={cat} value={cat}>
													{CATEGORY_LABELS[cat]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="value">Value</Label>
								{formData.valueType === "text" ? (
									<Textarea
										id="value"
										value={formData.value}
										onChange={(e) =>
											setFormData({ ...formData, value: e.target.value })
										}
										placeholder="Enter value..."
										rows={2}
									/>
								) : (
									<Input
										id="value"
										type={getInputType(formData.valueType)}
										value={formData.value}
										onChange={(e) =>
											setFormData({ ...formData, value: e.target.value })
										}
										placeholder={getPlaceholder(formData.valueType)}
									/>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
									placeholder="Optional help text..."
									rows={2}
								/>
							</div>

							<div className="flex justify-end gap-2 pt-4">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsDialogOpen(false)}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									{editingId ? "Update" : "Create"}
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{/* Filters */}
			{variables.length > 0 && (
				<div className="flex flex-col sm:flex-row gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search variables..."
							className="pl-9"
						/>
					</div>
					<Select
						value={filterCategory}
						onValueChange={(value) =>
							setFilterCategory(value as VariableCategory | "all")
						}
					>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="All categories" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							{VARIABLE_CATEGORIES.map((cat) => (
								<SelectItem key={cat} value={cat}>
									{CATEGORY_LABELS[cat]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{/* Variables List */}
			{!hasVariables ? (
				<Card>
					<CardContent className="p-8 text-center">
						<Variable className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
						<p className="text-muted-foreground">
							{variables.length === 0
								? "No custom variables yet."
								: "No variables match your search."}
						</p>
						{variables.length === 0 && (
							<p className="text-sm text-muted-foreground mt-1">
								Create variables to use in your document templates.
							</p>
						)}
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6">
					{(Object.entries(groupedVariables) as [VariableCategory, CompanyVariable[]][]).map(
						([category, categoryVariables]) =>
							categoryVariables.length > 0 && (
								<div key={category} className="space-y-3">
									<div className="flex items-center gap-2">
										<Tag className="h-4 w-4 text-muted-foreground" />
										<h4 className="font-medium text-sm">
											{CATEGORY_LABELS[category]}
										</h4>
										<span className="text-xs text-muted-foreground">
											({categoryVariables.length})
										</span>
									</div>
									<div className="space-y-2">
										{categoryVariables.map((variable) => (
											<VariableCard
												key={variable.id}
												variable={variable}
												onEdit={() => openEditDialog(variable)}
												onDelete={() => setDeleteConfirmId(variable.id)}
											/>
										))}
									</div>
								</div>
							)
					)}
				</div>
			)}

			{/* Delete Confirmation */}
			<AlertDialog
				open={!!deleteConfirmId}
				onOpenChange={(open) => !open && setDeleteConfirmId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Variable?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this variable. Any templates using
							this variable will no longer be able to resolve it.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert a label to a valid variable name.
 */
function toVariableName(label: string): string {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.substring(0, 50);
}

/**
 * Get HTML input type for a value type.
 */
function getInputType(valueType: VariableValueType): string {
	switch (valueType) {
		case "number":
		case "currency":
			return "number";
		case "date":
			return "date";
		case "email":
			return "email";
		case "url":
			return "url";
		case "phone":
			return "tel";
		default:
			return "text";
	}
}

/**
 * Get placeholder text for a value type.
 */
function getPlaceholder(valueType: VariableValueType): string {
	switch (valueType) {
		case "email":
			return "email@example.com";
		case "url":
			return "https://...";
		case "phone":
			return "+1 (555) 123-4567";
		case "date":
			return "YYYY-MM-DD";
		case "currency":
			return "0.00";
		case "boolean":
			return "true or false";
		default:
			return "Enter value...";
	}
}
