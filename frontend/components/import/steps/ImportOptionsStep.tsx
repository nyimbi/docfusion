"use client";

/**
 * Import Options Step Component
 *
 * Fifth step in the import wizard. Allows users to configure
 * import behavior and optionally save mapping templates.
 *
 * Features:
 * - Duplicate handling options (skip, update, create)
 * - Batch size configuration
 * - Template save functionality
 * - Load existing templates
 * - Import summary before execution
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	useImportStore,
	useMappings,
	useParsedData,
	useTargetTable,
	useOptions,
	useSelectedTemplateId,
	useTemplates,
	usePreviewData,
} from "@/lib/stores/import-store";
import { IMPORT_TARGETS } from "@/lib/import/table-schemas";
import type { ImportOptions, ImportMappingTemplate } from "@/lib/types/import";
import {
	Copy,
	FileDown,
	FileText,
	Layers,
	RefreshCw,
	Save,
	Settings2,
	SkipForward,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";

/**
 * Duplicate handling options
 */
const DUPLICATE_OPTIONS = [
	{
		value: "skip" as const,
		label: "Skip Duplicates",
		description: "Keep existing records, skip new ones with matching identifiers",
		icon: SkipForward,
	},
	{
		value: "update" as const,
		label: "Update Duplicates",
		description: "Update existing records with new data from the import",
		icon: RefreshCw,
	},
	{
		value: "create" as const,
		label: "Always Create",
		description: "Create new records even if duplicates exist",
		icon: Copy,
	},
];

/**
 * Batch size options
 */
const BATCH_SIZE_OPTIONS = [
	{ value: 50, label: "50 rows" },
	{ value: 100, label: "100 rows" },
	{ value: 250, label: "250 rows" },
	{ value: 500, label: "500 rows (faster)" },
	{ value: 1000, label: "1000 rows (fastest)" },
];

/**
 * Import Options Step Component
 */
export function ImportOptionsStep() {
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [templateName, setTemplateName] = useState("");
	const [templateDescription, setTemplateDescription] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const {
		setOptions,
		setSelectedTemplateId,
		setTemplates,
		applyTemplate,
	} = useImportStore();

	const mappings = useMappings();
	const parsedData = useParsedData();
	const targetTable = useTargetTable();
	const options = useOptions();
	const selectedTemplateId = useSelectedTemplateId();
	const templates = useTemplates();
	const previewData = usePreviewData();

	/**
	 * Fetch available templates
	 */
	const fetchTemplates = useCallback(async () => {
		try {
			const response = await fetch(
				`/api/v1/import/templates?targetTable=${targetTable}`,
				{ credentials: "include" }
			);
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					setTemplates(data.templates);
				}
			}
		} catch (error) {
			console.error("Failed to fetch templates:", error);
		}
	}, [targetTable, setTemplates]);

	// Fetch templates on mount
	useEffect(() => {
		if (targetTable) {
			fetchTemplates();
		}
	}, [targetTable, fetchTemplates]);

	/**
	 * Update a single option
	 */
	const updateOption = useCallback(
		<K extends keyof ImportOptions>(key: K, value: ImportOptions[K]) => {
			setOptions({ ...options, [key]: value });
		},
		[options, setOptions]
	);

	/**
	 * Handle template save
	 */
	const handleSaveTemplate = useCallback(async () => {
		if (!templateName.trim() || !targetTable) return;

		setIsSaving(true);
		setSaveError(null);

		try {
			const response = await fetch("/api/v1/import/templates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					name: templateName.trim(),
					description: templateDescription.trim() || undefined,
					targetTable,
					mappings,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to save template");
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || "Failed to save template");
			}

			// Refresh templates list
			await fetchTemplates();

			// Close dialog and reset
			setShowSaveDialog(false);
			setTemplateName("");
			setTemplateDescription("");
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Failed to save template");
		} finally {
			setIsSaving(false);
		}
	}, [templateName, templateDescription, targetTable, mappings, fetchTemplates]);

	/**
	 * Handle template load
	 */
	const handleLoadTemplate = useCallback(
		async (template: ImportMappingTemplate) => {
			// Fetch the full template details to get the mappings
			try {
				const response = await fetch(`/api/v1/import/templates/${template.id}`, {
					credentials: "include",
				});
				if (response.ok) {
					const data = await response.json();
					if (data.success && data.template?.mappings) {
						applyTemplate(template.id, data.template.mappings);
					}
				}
			} catch (error) {
				console.error("Failed to load template:", error);
			}
			setShowLoadDialog(false);
		},
		[applyTemplate]
	);

	/**
	 * Get target table label
	 */
	const targetTableLabel =
		IMPORT_TARGETS.find((t) => t.value === targetTable)?.label || targetTable;

	return (
		<div className="space-y-6 max-w-3xl mx-auto">
			{/* Import Summary Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<FileText className="h-5 w-5 text-primary" />
						Import Summary
					</CardTitle>
					<CardDescription>
						Review your import configuration before proceeding
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<span className="text-sm text-muted-foreground">File</span>
							<p className="font-medium truncate">
								{parsedData?.metadata?.filename || "Unknown"}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-sm text-muted-foreground">Target</span>
							<p className="font-medium">{targetTableLabel}</p>
						</div>
						<div className="space-y-1">
							<span className="text-sm text-muted-foreground">Total Rows</span>
							<p className="font-medium">
								{parsedData?.totalRows.toLocaleString() || 0}
							</p>
						</div>
						<div className="space-y-1">
							<span className="text-sm text-muted-foreground">Mappings</span>
							<p className="font-medium">{mappings.length} columns mapped</p>
						</div>
						{previewData && (
							<>
								<div className="space-y-1">
									<span className="text-sm text-muted-foreground">Valid Rows</span>
									<p className="font-medium text-green-600">
										{previewData.rows.filter((r) => !r.hasError && !r.hasWarning).length}
									</p>
								</div>
								<div className="space-y-1">
									<span className="text-sm text-muted-foreground">
										Rows with Issues
									</span>
									<p className="font-medium text-amber-600">
										{(previewData.validation?.warningCount || 0) + (previewData.validation?.errorCount || 0)}
									</p>
								</div>
							</>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Duplicate Handling */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Layers className="h-5 w-5 text-primary" />
						Duplicate Handling
					</CardTitle>
					<CardDescription>
						Choose how to handle records that already exist
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{DUPLICATE_OPTIONS.map((opt) => {
							const Icon = opt.icon;
							const isSelected = options.duplicateHandling === opt.value;

							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => updateOption("duplicateHandling", opt.value)}
									className={cn(
										"w-full flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
										isSelected
											? "border-primary bg-primary/5"
											: "border-border hover:border-primary/50"
									)}
								>
									<div
										className={cn(
											"flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
											isSelected
												? "bg-primary text-primary-foreground"
												: "bg-muted"
										)}
									>
										<Icon className="h-5 w-5" />
									</div>
									<div>
										<p className="font-medium">{opt.label}</p>
										<p className="text-sm text-muted-foreground">
											{opt.description}
										</p>
									</div>
								</button>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Advanced Options */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Settings2 className="h-5 w-5 text-primary" />
						Advanced Options
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Batch Size */}
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium text-sm">Batch Size</p>
							<p className="text-sm text-muted-foreground">
								Number of rows to process at once
							</p>
						</div>
						<Select
							value={String(options.batchSize)}
							onValueChange={(value) =>
								updateOption("batchSize", parseInt(value, 10))
							}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{BATCH_SIZE_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={String(opt.value)}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Skip Header Row */}
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium text-sm">Skip Header Row</p>
							<p className="text-sm text-muted-foreground">
								First row is treated as column headers
							</p>
						</div>
						<Checkbox
							checked={options.skipHeaderRow}
							onCheckedChange={(checked) =>
								updateOption("skipHeaderRow", checked === true)
							}
						/>
					</div>

					{/* Validate Before Insert */}
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium text-sm">Validate All First</p>
							<p className="text-sm text-muted-foreground">
								Validate all rows before inserting any
							</p>
						</div>
						<Checkbox
							checked={options.validateBeforeInsert}
							onCheckedChange={(checked) =>
								updateOption("validateBeforeInsert", checked === true)
							}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Template Management */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Sparkles className="h-5 w-5 text-primary" />
						Mapping Templates
					</CardTitle>
					<CardDescription>
						Save your mapping configuration for future imports
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							onClick={() => setShowSaveDialog(true)}
							className="gap-2"
						>
							<Save className="h-4 w-4" />
							Save as Template
						</Button>
						<Button
							variant="outline"
							onClick={() => setShowLoadDialog(true)}
							disabled={templates.length === 0}
							className="gap-2"
						>
							<FileDown className="h-4 w-4" />
							Load Template
							{templates.length > 0 && (
								<Badge variant="secondary" className="ml-1">
									{templates.length}
								</Badge>
							)}
						</Button>
					</div>

					{selectedTemplateId && (
						<div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
							<span>Using template:</span>
							<Badge variant="outline">
								{templates.find((t) => t.id === selectedTemplateId)?.name}
							</Badge>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Save Template Dialog */}
			<Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Mapping Template</DialogTitle>
						<DialogDescription>
							Save your current column mappings to reuse with similar files
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Template Name *</label>
							<Input
								value={templateName}
								onChange={(e) => setTemplateName(e.target.value)}
								placeholder="e.g., Partner Import from Excel"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">Description</label>
							<Textarea
								value={templateDescription}
								onChange={(e) => setTemplateDescription(e.target.value)}
								placeholder="Optional description for this template"
								rows={3}
							/>
						</div>

						{saveError && (
							<p className="text-sm text-destructive">{saveError}</p>
						)}
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowSaveDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSaveTemplate}
							disabled={!templateName.trim() || isSaving}
						>
							{isSaving ? "Saving..." : "Save Template"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Load Template Dialog */}
			<Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Load Mapping Template</DialogTitle>
						<DialogDescription>
							Select a saved template to apply its mappings
						</DialogDescription>
					</DialogHeader>

					<ScrollArea className="h-[300px] pr-4">
						<div className="space-y-2">
							{templates.map((template) => (
								<button
									key={template.id}
									type="button"
									onClick={() => handleLoadTemplate(template as unknown as ImportMappingTemplate)}
									className={cn(
										"w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-muted/30",
										selectedTemplateId === template.id &&
											"border-primary bg-primary/5"
									)}
								>
									<FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
									<div className="flex-1 min-w-0">
										<p className="font-medium">{template.name}</p>
										{template.description && (
											<p className="text-sm text-muted-foreground line-clamp-2">
												{template.description}
											</p>
										)}
										<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
											<span>Used {template.useCount || 0} times</span>
											{template.lastUsedAt && (
												<>
													<span>·</span>
													<span>
														Last used{" "}
														{new Date(template.lastUsedAt).toLocaleDateString()}
													</span>
												</>
											)}
										</div>
									</div>
								</button>
							))}
						</div>
					</ScrollArea>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowLoadDialog(false)}
						>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default ImportOptionsStep;
