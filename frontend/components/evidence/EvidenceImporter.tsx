/**
 * EvidenceImporter - Bulk Import Evidence
 *
 * CSV/Excel upload with column mapping interface, preview before import,
 * progress tracking, and error handling with skip/retry options.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import {
	Upload,
	FileSpreadsheet,
	Loader2,
	AlertCircle,
	CheckCircle2,
	X,
	ChevronRight,
	FileWarning,
	ArrowRight,
	RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { Evidence, ImportResult, ImportColumnMapping, ImportPreviewRow } from "@/lib/types/evidence";
import { previewImport, executeImport } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceImporterProps {
	/** Callback when import completes */
	onComplete?: (result: ImportResult) => void;
	/** Callback to cancel */
	onCancel?: () => void;
	/** Additional CSS classes */
	className?: string;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

// =============================================================================
// Constants
// =============================================================================

const TARGET_FIELDS = [
	{ value: "title", label: "Title", required: true },
	{ value: "content", label: "Content", required: true },
	{ value: "type", label: "Evidence Type", required: false },
	{ value: "category", label: "Category", required: false },
	{ value: "subcategory", label: "Subcategory", required: false },
	{ value: "tags", label: "Tags (comma-separated)", required: false },
];

// =============================================================================
// Step Indicator
// =============================================================================

interface StepIndicatorProps {
	currentStep: ImportStep;
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
	const steps: { step: ImportStep; label: string }[] = [
		{ step: "upload", label: "Upload" },
		{ step: "mapping", label: "Map Columns" },
		{ step: "preview", label: "Preview" },
		{ step: "importing", label: "Import" },
		{ step: "complete", label: "Complete" },
	];

	const currentIndex = steps.findIndex((s) => s.step === currentStep);

	return (
		<div className="flex items-center justify-between mb-6">
			{steps.map((step, index) => (
				<div key={step.step} className="flex items-center">
					<div
						className={cn(
							"flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-medium",
							index < currentIndex && "bg-primary border-primary text-primary-foreground",
							index === currentIndex && "border-primary text-primary",
							index > currentIndex && "border-muted text-muted-foreground"
						)}
					>
						{index < currentIndex ? (
							<CheckCircle2 className="h-4 w-4" />
						) : (
							index + 1
						)}
					</div>
					<span
						className={cn(
							"ml-2 text-sm hidden sm:inline",
							index <= currentIndex ? "text-foreground" : "text-muted-foreground"
						)}
					>
						{step.label}
					</span>
					{index < steps.length - 1 && (
						<ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
					)}
				</div>
			))}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceImporter({
	onComplete,
	onCancel,
	className,
}: EvidenceImporterProps) {
	// State
	const [step, setStep] = useState<ImportStep>("upload");
	const [rawData, setRawData] = useState<Record<string, string>[]>([]);
	const [columns, setColumns] = useState<string[]>([]);
	const [mappings, setMappings] = useState<ImportColumnMapping[]>([]);
	const [previews, setPreviews] = useState<ImportPreviewRow[]>([]);
	const [importResult, setImportResult] = useState<ImportResult | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [importProgress, setImportProgress] = useState(0);

	const fileInputRef = useRef<HTMLInputElement>(null);

	// Handle file upload
	const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setError(null);
		setIsProcessing(true);

		try {
			const text = await file.text();
			const lines = text.split("\n").filter((line) => line.trim());

			if (lines.length < 2) {
				throw new Error("File must have at least a header row and one data row");
			}

			// Parse CSV (simple parser - in production use a library)
			const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
			const data: Record<string, string>[] = [];

			for (let i = 1; i < lines.length; i++) {
				const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
				const row: Record<string, string> = {};
				headers.forEach((header, idx) => {
					row[header] = values[idx] || "";
				});
				data.push(row);
			}

			setColumns(headers);
			setRawData(data);

			// Initialize mappings with best guesses
			const initialMappings: ImportColumnMapping[] = headers.map((col) => {
				const colLower = col.toLowerCase();
				let targetField: ImportColumnMapping["targetField"] = null;

				if (colLower.includes("title") || colLower.includes("name")) {
					targetField = "title";
				} else if (colLower.includes("content") || colLower.includes("description") || colLower.includes("text")) {
					targetField = "content";
				} else if (colLower.includes("type")) {
					targetField = "type";
				} else if (colLower.includes("category")) {
					targetField = "category";
				} else if (colLower.includes("tag")) {
					targetField = "tags";
				}

				return {
					sourceColumn: col,
					targetField,
					transform: "none" as const,
				};
			});

			setMappings(initialMappings);
			setStep("mapping");
		} catch (err) {
			setError(`Failed to parse file: ${err}`);
		} finally {
			setIsProcessing(false);
		}
	}, []);

	// Update mapping
	const handleMappingChange = useCallback((sourceColumn: string, targetField: string | null) => {
		setMappings((prev) =>
			prev.map((m) =>
				m.sourceColumn === sourceColumn
					? { ...m, targetField: targetField as ImportColumnMapping["targetField"] }
					: m
			)
		);
	}, []);

	// Generate preview
	const handleGeneratePreview = useCallback(async () => {
		setIsProcessing(true);
		setError(null);

		// Convert rawData back to CSV format for the action
		const csvHeader = columns.join(",");
		const csvRows = rawData.map((row) =>
			columns.map((col) => `"${(row[col] || "").replace(/"/g, '""')}"`).join(",")
		);
		const csvData = [csvHeader, ...csvRows].join("\n");

		const result = await previewImport(csvData, "csv");
		if (result.success && result.data) {
			const data = result.data;
			// Transform ImportPreview to ImportPreviewRow[] for state
			// The action returns preview[] not rows[]
			const previewRows: ImportPreviewRow[] = (data.preview ?? []).map((evidence, index) => {
				const rowNum = index + 1;
				const rowErrors = data.errors
					.filter((e) => {
						// Check both row and rowNumber for compatibility
						const errRow = (e as { row?: number; rowNumber?: number }).row ?? (e as { rowNumber?: number }).rowNumber;
						return errRow === rowNum;
					})
					.map((e) => {
						// Use message if available, fallback to error or default
						const err = e as { message?: string; error?: string };
						return err.message ?? err.error ?? "Unknown error";
					});
				return {
					rowNumber: rowNum,
					data: rawData[index] ?? {},
					evidence: evidence as Partial<Evidence>,
					errors: rowErrors,
					warnings: [],
					status: rowErrors.length > 0 ? "error" : "valid" as const,
				};
			});
			setPreviews(previewRows);
			setStep("preview");
		} else if (!result.success) {
			setError(result.error);
		}

		setIsProcessing(false);
	}, [rawData, mappings, columns]);

	// Execute import
	const handleExecuteImport = useCallback(async () => {
		setStep("importing");
		setIsProcessing(true);
		setError(null);

		// Simulate progress
		const progressInterval = setInterval(() => {
			setImportProgress((prev) => Math.min(prev + 10, 90));
		}, 200);

		// Convert rawData back to CSV format for the action
		const csvHeader = columns.join(",");
		const csvRows = rawData.map((row) =>
			columns.map((col) => `"${(row[col] || "").replace(/"/g, '""')}"`).join(",")
		);
		const csvData = [csvHeader, ...csvRows].join("\n");

		const result = await executeImport(csvData, "csv", true);

		clearInterval(progressInterval);
		setImportProgress(100);

		if (result.success && result.data) {
			setImportResult(result.data);
			setStep("complete");
			onComplete?.(result.data);
		} else if (!result.success) {
			setError(result.error);
			setStep("preview");
		}

		setIsProcessing(false);
	}, [columns, rawData, onComplete]);

	// Reset
	const handleReset = useCallback(() => {
		setStep("upload");
		setRawData([]);
		setColumns([]);
		setMappings([]);
		setPreviews([]);
		setImportResult(null);
		setError(null);
		setImportProgress(0);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, []);

	// Check if mappings are valid
	const hasRequiredMappings = mappings.some((m) => m.targetField === "title") &&
		mappings.some((m) => m.targetField === "content");

	// Preview stats
	const previewStats = {
		valid: previews.filter((p) => p.status === "valid").length,
		warning: previews.filter((p) => p.status === "warning").length,
		error: previews.filter((p) => p.status === "error").length,
	};

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileSpreadsheet className="h-5 w-5" />
					Import Evidence
				</CardTitle>
				<CardDescription>
					Import evidence from CSV or Excel files
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				<StepIndicator currentStep={step} />

				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Step: Upload */}
				{step === "upload" && (
					<div className="space-y-4">
						<div
							className={cn(
								"border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors",
								isProcessing && "pointer-events-none opacity-50"
							)}
							onClick={() => fileInputRef.current?.click()}
						>
							<input
								ref={fileInputRef}
								type="file"
								accept=".csv,.xlsx,.xls"
								className="hidden"
								onChange={handleFileUpload}
							/>
							<Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="font-medium">Upload CSV or Excel File</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Click to browse or drag and drop
							</p>
							<p className="text-xs text-muted-foreground mt-2">
								Supported formats: .csv, .xlsx, .xls
							</p>
						</div>

						{isProcessing && (
							<div className="flex items-center justify-center gap-2 text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span>Processing file...</span>
							</div>
						)}
					</div>
				)}

				{/* Step: Mapping */}
				{step === "mapping" && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-medium">Map Columns</h3>
								<p className="text-sm text-muted-foreground">
									{rawData.length} rows found. Map columns to evidence fields.
								</p>
							</div>
							<Badge variant="outline">
								{columns.length} columns
							</Badge>
						</div>

						<ScrollArea className="h-64 border rounded-lg">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Source Column</TableHead>
										<TableHead>Sample Data</TableHead>
										<TableHead className="w-48">Map To</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{columns.map((col) => (
										<TableRow key={col}>
											<TableCell className="font-medium">{col}</TableCell>
											<TableCell className="text-muted-foreground truncate max-w-32">
												{rawData[0]?.[col]?.substring(0, 50) || "-"}
											</TableCell>
											<TableCell>
												<Select
													value={mappings.find((m) => m.sourceColumn === col)?.targetField || ""}
													onValueChange={(v) => handleMappingChange(col, v || null)}
												>
													<SelectTrigger>
														<SelectValue placeholder="Skip this column" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="">Skip</SelectItem>
														{TARGET_FIELDS.map((field) => (
															<SelectItem key={field.value} value={field.value}>
																{field.label}
																{field.required && " *"}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ScrollArea>

						{!hasRequiredMappings && (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									Title and Content fields are required. Please map these columns.
								</AlertDescription>
							</Alert>
						)}

						<div className="flex justify-between">
							<Button variant="outline" onClick={handleReset}>
								<X className="h-4 w-4 mr-2" />
								Cancel
							</Button>
							<Button
								onClick={handleGeneratePreview}
								disabled={!hasRequiredMappings || isProcessing}
							>
								{isProcessing ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Processing...
									</>
								) : (
									<>
										Preview
										<ArrowRight className="h-4 w-4 ml-2" />
									</>
								)}
							</Button>
						</div>
					</div>
				)}

				{/* Step: Preview */}
				{step === "preview" && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-medium">Preview Import</h3>
								<p className="text-sm text-muted-foreground">
									Review data before importing
								</p>
							</div>
							<div className="flex gap-2">
								<Badge variant="secondary" className="bg-green-100 text-green-700">
									{previewStats.valid} valid
								</Badge>
								{previewStats.warning > 0 && (
									<Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
										{previewStats.warning} warnings
									</Badge>
								)}
								{previewStats.error > 0 && (
									<Badge variant="secondary" className="bg-red-100 text-red-700">
										{previewStats.error} errors
									</Badge>
								)}
							</div>
						</div>

						<ScrollArea className="h-64 border rounded-lg">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">Row</TableHead>
										<TableHead className="w-20">Status</TableHead>
										<TableHead>Title</TableHead>
										<TableHead>Issues</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{previews.slice(0, 50).map((preview) => (
										<TableRow key={preview.rowNumber}>
											<TableCell>{preview.rowNumber}</TableCell>
											<TableCell>
												{preview.status === "valid" && (
													<CheckCircle2 className="h-4 w-4 text-green-600" />
												)}
												{preview.status === "warning" && (
													<FileWarning className="h-4 w-4 text-yellow-600" />
												)}
												{preview.status === "error" && (
													<AlertCircle className="h-4 w-4 text-red-600" />
												)}
											</TableCell>
											<TableCell className="truncate max-w-48">
												{preview.evidence?.title || preview.data.title || "-"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{preview.errors.length > 0 && (
													<span className="text-red-600">{preview.errors.join("; ")}</span>
												)}
												{preview.warnings.length > 0 && (
													<span className="text-yellow-600">{preview.warnings.join("; ")}</span>
												)}
												{preview.errors.length === 0 && preview.warnings.length === 0 && "-"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ScrollArea>

						{previews.length > 50 && (
							<p className="text-sm text-muted-foreground text-center">
								Showing first 50 rows of {previews.length}
							</p>
						)}

						<div className="flex justify-between">
							<Button variant="outline" onClick={() => setStep("mapping")}>
								Back to Mapping
							</Button>
							<Button
								onClick={handleExecuteImport}
								disabled={previewStats.valid === 0}
							>
								Import {previewStats.valid} Items
								<ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</div>
					</div>
				)}

				{/* Step: Importing */}
				{step === "importing" && (
					<div className="space-y-4 py-8 text-center">
						<Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
						<h3 className="font-medium">Importing Evidence...</h3>
						<Progress value={importProgress} className="w-64 mx-auto" />
						<p className="text-sm text-muted-foreground">
							Please wait while your evidence is being imported
						</p>
					</div>
				)}

				{/* Step: Complete */}
				{step === "complete" && importResult && (
					<div className="space-y-4 py-8 text-center">
						<CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
						<h3 className="font-medium">Import Complete</h3>
						<div className="flex justify-center gap-4">
							<Badge variant="secondary" className="bg-green-100 text-green-700">
								{importResult.successCount} imported
							</Badge>
							{(importResult.errorCount ?? 0) > 0 && (
								<Badge variant="secondary" className="bg-red-100 text-red-700">
									{importResult.errorCount} failed
								</Badge>
							)}
							{(importResult.skippedCount ?? 0) > 0 && (
								<Badge variant="secondary">
									{importResult.skippedCount} skipped
								</Badge>
							)}
						</div>

						{importResult.errors.length > 0 && (
							<div className="mt-4 text-left">
								<h4 className="text-sm font-medium mb-2">Errors:</h4>
								<ScrollArea className="h-32 border rounded p-2">
									{importResult.errors.map((err, idx) => (
										<p key={idx} className="text-xs text-red-600">
											Row {err.rowNumber}: {err.error}
										</p>
									))}
								</ScrollArea>
							</div>
						)}

						<div className="flex justify-center gap-2 mt-6">
							<Button variant="outline" onClick={handleReset}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Import More
							</Button>
							<Button onClick={onCancel}>
								Done
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default EvidenceImporter;
