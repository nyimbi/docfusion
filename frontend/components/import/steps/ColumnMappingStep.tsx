"use client";

/**
 * Column Mapping Step Component
 *
 * Third step in the import wizard. Provides a visual interface
 * for mapping source columns to target fields with support for
 * column concatenation.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useImportStore } from "@/lib/stores/import-store";
import type { ColumnMapping, MappingSuggestion, ColumnTransform } from "@/lib/types/import";
import {
	ArrowRight,
	Plus,
	X,
	Wand2,
	RotateCcw,
	Link2,
	AlertCircle,
	CheckCircle2,
	Sparkles,
	Combine,
	Type,
	Hash,
	Calendar,
	Mail,
	Phone,
	Globe,
	ToggleLeft,
	Edit3,
	GripVertical,
} from "lucide-react";

/**
 * Separator options for concatenation
 */
const SEPARATOR_OPTIONS = [
	{ value: " ", label: "Space" },
	{ value: ", ", label: "Comma + Space" },
	{ value: " - ", label: "Dash" },
	{ value: " | ", label: "Pipe" },
	{ value: "\n", label: "New Line" },
	{ value: "", label: "None" },
];

/**
 * Column Mapping Step Component
 */
export function ColumnMappingStep() {
	const [showConcatDialog, setShowConcatDialog] = useState(false);
	const [editingTargetColumn, setEditingTargetColumn] = useState<string | null>(null);
	const [concatColumns, setConcatColumns] = useState<string[]>([]);
	const [concatSeparator, setConcatSeparator] = useState(" ");
	const [customSeparator, setCustomSeparator] = useState("");

	// Get store state and actions
	const mappings = useImportStore((s) => s.mappings);
	const parsedData = useImportStore((s) => s.parsedData);
	const targetSchema = useImportStore((s) => s.targetSchema);
	const suggestedMappings = useImportStore((s) => s.mappingSuggestions);
	const addMapping = useImportStore((s) => s.addMapping);
	const removeMappingByTarget = useImportStore((s) => s.removeMappingByTarget);
	const clearMappings = useImportStore((s) => s.clearMappings);
	const autoDetectMappings = useImportStore((s) => s.autoDetectMappings);

	/**
	 * Get list of unmapped source columns
	 */
	const unmappedSourceColumns = useMemo(() => {
		if (!parsedData) return [];
		const mappedSources = new Set(mappings.flatMap((m) => m.sourceColumns));
		return parsedData.headers.filter((h: string) => !mappedSources.has(h));
	}, [parsedData, mappings]);

	/**
	 * Get missing required fields
	 */
	const missingRequired = useMemo(() => {
		if (!targetSchema) return [];
		const mappedTargets = new Set(mappings.map((m) => m.targetColumn));
		return targetSchema.columns.filter(
			(c) => c.required && !mappedTargets.has(c.name)
		);
	}, [targetSchema, mappings]);

	/**
	 * Handle auto-detect mappings
	 */
	const handleAutoDetect = useCallback(() => {
		autoDetectMappings();
	}, [autoDetectMappings]);

	/**
	 * Handle clear all mappings
	 */
	const handleClearAll = useCallback(() => {
		clearMappings();
	}, [clearMappings]);

	/**
	 * Handle adding a simple mapping
	 */
	const handleAddSimpleMapping = useCallback(
		(sourceColumn: string, targetColumn: string) => {
			const columnSchema = targetSchema?.columns.find((c) => c.name === targetColumn);
			addMapping({
				targetColumn,
				sourceColumns: [sourceColumn],
				separator: ", ",
				transform: "trim",
				defaultValue: "",
				required: columnSchema?.required || false,
			});
		},
		[addMapping, targetSchema]
	);

	/**
	 * Handle opening concatenation dialog
	 */
	const handleOpenConcatDialog = useCallback(
		(targetColumn: string) => {
			const existing = mappings.find((m) => m.targetColumn === targetColumn);
			if (existing) {
				setConcatColumns(existing.sourceColumns);
				setConcatSeparator(existing.separator || " ");
			} else {
				setConcatColumns([]);
				setConcatSeparator(" ");
			}
			setEditingTargetColumn(targetColumn);
			setShowConcatDialog(true);
		},
		[mappings]
	);

	/**
	 * Handle saving concatenation
	 */
	const handleSaveConcatenation = useCallback(() => {
		if (!editingTargetColumn || concatColumns.length === 0) return;

		const separator =
			concatSeparator === "custom" ? customSeparator : concatSeparator;

		// Remove existing mapping for this target
		removeMappingByTarget(editingTargetColumn);

		const columnSchema = targetSchema?.columns.find((c) => c.name === editingTargetColumn);

		// Add new mapping
		addMapping({
			targetColumn: editingTargetColumn,
			sourceColumns: concatColumns,
			separator: concatColumns.length > 1 ? separator : ", ",
			transform: "trim",
			defaultValue: "",
			required: columnSchema?.required || false,
		});

		setShowConcatDialog(false);
		setEditingTargetColumn(null);
		setConcatColumns([]);
	}, [editingTargetColumn, concatColumns, concatSeparator, customSeparator, addMapping, removeMappingByTarget, targetSchema]);

	/**
	 * Get confidence badge color
	 */
	const getConfidenceBadge = (confidence: number) => {
		if (confidence >= 80) {
			return { variant: "default" as const, label: "High" };
		} else if (confidence >= 50) {
			return { variant: "secondary" as const, label: "Medium" };
		} else {
			return { variant: "outline" as const, label: "Low" };
		}
	};

	/**
	 * Get suggestion for a target column
	 */
	const getSuggestion = useCallback(
		(targetColumn: string): MappingSuggestion | undefined => {
			return suggestedMappings?.find((s) => s.targetColumn === targetColumn);
		},
		[suggestedMappings]
	);

	// Auto-detect on mount if no mappings exist
	useEffect(() => {
		if (mappings.length === 0 && parsedData && targetSchema) {
			autoDetectMappings();
		}
	}, [mappings.length, parsedData, targetSchema, autoDetectMappings]);

	return (
		<TooltipProvider>
			<div className="space-y-6">
				{/* Header Actions */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Badge variant="outline" className="text-base font-normal px-3 py-1">
							{mappings.length} mappings
						</Badge>
						{missingRequired.length > 0 && (
							<Badge variant="destructive" className="gap-1">
								<AlertCircle className="h-3 w-3" />
								{missingRequired.length} required missing
							</Badge>
						)}
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleClearAll}
							disabled={mappings.length === 0}
							className="gap-2"
						>
							<RotateCcw className="h-4 w-4" />
							Clear All
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleAutoDetect}
							className="gap-2"
						>
							<Wand2 className="h-4 w-4" />
							Auto-Detect
						</Button>
					</div>
				</div>

				{/* Mapping Interface */}
				<div className="grid grid-cols-[1fr,auto,1fr] gap-4">
					{/* Source Columns Panel */}
					<div className="border rounded-xl overflow-hidden">
						<div className="bg-muted/50 px-4 py-3 border-b">
							<h3 className="font-semibold text-sm">
								Source Columns ({parsedData?.headers.length || 0})
							</h3>
						</div>
						<ScrollArea className="h-[400px]">
							<div className="p-3 space-y-2">
								{parsedData?.headers.map((header: string) => {
									const isMapped = mappings.some((m) =>
										m.sourceColumns.includes(header)
									);

									return (
										<div
											key={header}
											className={cn(
												"flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
												isMapped
													? "bg-primary/10 border border-primary/20"
													: "bg-muted/30 hover:bg-muted/50 cursor-grab"
											)}
										>
											<GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
											<span className="font-mono flex-1 truncate">{header}</span>
											{isMapped && (
												<CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
											)}
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</div>

					{/* Connector Column */}
					<div className="flex flex-col items-center justify-center py-8">
						<div className="w-px h-full bg-border relative">
							<ArrowRight className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground bg-background" />
						</div>
					</div>

					{/* Target Columns Panel */}
					<div className="border rounded-xl overflow-hidden">
						<div className="bg-muted/50 px-4 py-3 border-b">
							<h3 className="font-semibold text-sm">
								Target Fields ({targetSchema?.columns.length || 0})
							</h3>
						</div>
						<ScrollArea className="h-[400px]">
							<div className="p-3 space-y-2">
								{targetSchema?.columns.map((column) => {
									const mapping = mappings.find(
										(m) => m.targetColumn === column.name
									);
									const suggestion = getSuggestion(column.name);

									return (
										<div
											key={column.name}
											className={cn(
												"relative rounded-lg text-sm transition-all",
												column.required && !mapping
													? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
													: mapping
														? "bg-primary/10 border border-primary/20"
														: "bg-muted/30 border border-transparent"
											)}
										>
											{/* Main Row */}
											<div className="flex items-center gap-2 px-3 py-2">
												{/* Required Indicator */}
												<div
													className={cn(
														"w-2 h-2 rounded-full flex-shrink-0",
														column.required
															? "bg-amber-500"
															: "bg-muted-foreground/30"
													)}
												/>

												{/* Field Name */}
												<span className="font-mono flex-1 truncate">
													{column.name}
												</span>

												{/* Mapped Sources */}
												{mapping && (
													<div className="flex items-center gap-1 flex-shrink-0">
														<Badge variant="secondary" className="gap-1 text-xs">
															{mapping.sourceColumns.length > 1 && (
																<Combine className="h-3 w-3" />
															)}
															{mapping.sourceColumns.join(
																mapping.separator
																	? ` ${mapping.separator.trim()} `
																	: " + "
															)}
														</Badge>
														<Button
															variant="ghost"
															size="sm"
															className="h-6 w-6 p-0"
															onClick={() => handleOpenConcatDialog(column.name)}
														>
															<Edit3 className="h-3 w-3" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="h-6 w-6 p-0 text-destructive"
															onClick={() => removeMappingByTarget(column.name)}
														>
															<X className="h-3 w-3" />
														</Button>
													</div>
												)}

												{/* Suggestion */}
												{!mapping && suggestion && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 px-2 gap-1 text-xs"
																onClick={() =>
																	handleAddSimpleMapping(
																		suggestion.sourceColumn,
																		column.name
																	)
																}
															>
																<Sparkles className="h-3 w-3 text-amber-500" />
																{suggestion.sourceColumn}
																<Badge
																	variant={getConfidenceBadge(suggestion.confidence).variant}
																	className="text-[10px] px-1 py-0"
																>
																	{suggestion.confidence}%
																</Badge>
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															<p>
																Suggested mapping: {suggestion.reason}
															</p>
														</TooltipContent>
													</Tooltip>
												)}

												{/* Add Mapping Button */}
												{!mapping && (
													<Button
														variant="ghost"
														size="sm"
														className="h-6 w-6 p-0"
														onClick={() => handleOpenConcatDialog(column.name)}
													>
														<Plus className="h-4 w-4" />
													</Button>
												)}
											</div>

											{/* Description */}
											{column.description && !mapping && (
												<p className="px-3 pb-2 text-xs text-muted-foreground">
													{column.description}
												</p>
											)}
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</div>
				</div>

				{/* Missing Required Warning */}
				{missingRequired.length > 0 && (
					<div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 rounded-lg">
						<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
						<div>
							<p className="font-medium">Missing Required Fields</p>
							<p className="text-sm opacity-90">
								The following required fields are not mapped:{" "}
								<span className="font-mono">
									{missingRequired.map((c) => c.name).join(", ")}
								</span>
							</p>
						</div>
					</div>
				)}

				{/* Concatenation Dialog */}
				<Dialog open={showConcatDialog} onOpenChange={setShowConcatDialog}>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Link2 className="h-5 w-5" />
								Map to: {editingTargetColumn}
							</DialogTitle>
							<DialogDescription>
								Select one or more source columns. Multiple columns will be
								concatenated with the chosen separator.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							{/* Source Column Selection */}
							<div className="space-y-2">
								<span className="text-sm font-medium">Source Columns</span>
								<div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
									{concatColumns.map((col, index) => (
										<Badge
											key={col}
											variant="secondary"
											className="gap-1 text-sm"
										>
											{index > 0 && (
												<span className="text-muted-foreground">
													{concatSeparator === "custom"
														? customSeparator || "·"
														: concatSeparator || "·"}
												</span>
											)}
											{col}
											<button
												type="button"
												onClick={() =>
													setConcatColumns((prev) =>
														prev.filter((c) => c !== col)
													)
												}
												className="ml-1 hover:text-destructive"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
									{concatColumns.length === 0 && (
										<span className="text-sm text-muted-foreground">
											Click columns below to add
										</span>
									)}
								</div>
							</div>

							{/* Available Columns */}
							<div className="space-y-2">
								<span className="text-sm font-medium">
									Available Columns
								</span>
								<ScrollArea className="h-[150px] border rounded-lg p-2">
									<div className="flex flex-wrap gap-2">
										{parsedData?.headers
											.filter((h: string) => !concatColumns.includes(h))
											.map((header: string) => (
												<button
													key={header}
													type="button"
													onClick={() =>
														setConcatColumns((prev) => [...prev, header])
													}
													className="px-2 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md font-mono transition-colors"
												>
													{header}
												</button>
											))}
									</div>
								</ScrollArea>
							</div>

							{/* Separator Selection */}
							{concatColumns.length > 1 && (
								<div className="space-y-2">
									<span className="text-sm font-medium">Separator</span>
									<div className="flex items-center gap-2">
										<Select
											value={concatSeparator}
											onValueChange={setConcatSeparator}
										>
											<SelectTrigger className="flex-1" aria-label="Separator">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{SEPARATOR_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
												<SelectItem value="custom">Custom...</SelectItem>
											</SelectContent>
										</Select>
										{concatSeparator === "custom" && (
											<Input
												value={customSeparator}
												onChange={(e) => setCustomSeparator(e.target.value)}
												placeholder="Enter separator"
												className="w-32"
											/>
										)}
									</div>
								</div>
							)}

							{/* Preview */}
							{concatColumns.length > 0 && parsedData?.sampleRows?.[0] && (
								<div className="space-y-2">
									<span className="text-sm font-medium">Preview</span>
									<div className="p-3 bg-muted rounded-lg font-mono text-sm">
										{concatColumns
											.map((col) => String(parsedData.sampleRows[0][col] || ""))
											.join(
												concatSeparator === "custom"
													? customSeparator
													: concatSeparator
											)}
									</div>
								</div>
							)}
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setShowConcatDialog(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSaveConcatenation}
								disabled={concatColumns.length === 0}
							>
								Save Mapping
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	);
}

export default ColumnMappingStep;
