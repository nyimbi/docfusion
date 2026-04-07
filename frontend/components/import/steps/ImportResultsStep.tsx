"use client";

/**
 * Import Results Step Component
 *
 * Final step in the import wizard. Displays the results
 * of the import operation with detailed statistics.
 *
 * Features:
 * - Success/failure summary
 * - Detailed statistics breakdown
 * - Error log with export capability
 * - Rollback option for failed imports
 * - Link to view imported records
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
	useImportStore,
	useImportResult,
	useIsLoading,
	useProgress,
	useParsedData,
	useMappings,
	useTargetTable,
	useOptions,
} from "@/lib/stores/import-store";
import { IMPORT_TARGETS } from "@/lib/import/table-schemas";
import type { ImportResult, ValidationIssue } from "@/lib/types/import";
import {
	AlertCircle,
	CheckCircle2,
	Download,
	ExternalLink,
	FileWarning,
	Loader2,
	PartyPopper,
	RefreshCw,
	RotateCcw,
	Trash2,
	XCircle,
} from "lucide-react";

/**
 * Import Results Step Component
 */
export function ImportResultsStep() {
	const [showRollbackDialog, setShowRollbackDialog] = useState(false);
	const [isRollingBack, setIsRollingBack] = useState(false);
	const [rollbackError, setRollbackError] = useState<string | null>(null);

	const {
		setResult: setImportResult,
		setLoading: setIsLoading,
		setError,
		setProgress,
	} = useImportStore();

	const importResult = useImportResult();
	const isLoading = useIsLoading();
	const progress = useProgress();
	const parsedData = useParsedData();
	const mappings = useMappings();
	const targetTable = useTargetTable();
	const options = useOptions();

	/**
	 * Execute the import
	 */
	const executeImport = useCallback(async () => {
		if (!parsedData || !targetTable || mappings.length === 0) return;

		setIsLoading(true);
		setError(null);
		setProgress({
			importId: "",
			status: "processing",
			totalRows: parsedData.totalRows,
			processedRows: 0,
			importedRows: 0,
			updatedRows: 0,
			skippedRows: 0,
			failedRows: 0,
			currentBatch: 0,
			totalBatches: Math.ceil(parsedData.totalRows / (options.batchSize || 100)),
			percentage: 0,
			errors: [],
			startedAt: new Date().toISOString(),
		});

		try {
			const response = await fetch("/api/v1/import/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					parsedData: {
						sampleRows: parsedData.sampleRows,
						totalRows: parsedData.totalRows,
						metadata: parsedData.metadata,
					},
					targetTable,
					mappings,
					options,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Import failed");
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || "Import failed");
			}

			setImportResult(data.result);
			setProgress({
				importId: data.result.importId,
				status: data.result.success ? "completed" : "failed",
				totalRows: data.result.totalRows,
				processedRows: data.result.totalRows,
				importedRows: data.result.importedRows,
				updatedRows: data.result.updatedRows,
				skippedRows: data.result.skippedRows,
				failedRows: data.result.failedRows,
				currentBatch: Math.ceil(data.result.totalRows / (options.batchSize || 100)),
				totalBatches: Math.ceil(data.result.totalRows / (options.batchSize || 100)),
				percentage: 100,
				errors: data.result.errors,
				startedAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import failed");
			setImportResult({
				success: false,
				importId: "",
				totalRows: parsedData.totalRows,
				importedRows: 0,
				updatedRows: 0,
				skippedRows: 0,
				failedRows: parsedData.totalRows,
				importedIds: [],
				durationMs: 0,
				errors: [
					{
						row: 0,
						message: err instanceof Error ? err.message : "Import failed",
						severity: "error",
					},
				],
			});
		} finally {
			setIsLoading(false);
		}
	}, [
		parsedData,
		targetTable,
		mappings,
		options,
		setIsLoading,
		setError,
		setProgress,
		setImportResult,
	]);

	// Execute import on mount
	useEffect(() => {
		if (!importResult) {
			executeImport();
		}
	}, [executeImport, importResult]);

	/**
	 * Handle rollback
	 */
	const handleRollback = useCallback(async () => {
		if (!importResult?.importId) return;

		setIsRollingBack(true);
		setRollbackError(null);

		try {
			const response = await fetch(
				`/api/v1/import/${importResult.importId}/rollback`,
				{ method: "POST", credentials: "include" }
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Rollback failed");
			}

			// Update result to show rollback
			setImportResult({
				...importResult,
				success: false,
				importedRows: 0,
				updatedRows: 0,
			});

			setShowRollbackDialog(false);
		} catch (err) {
			setRollbackError(
				err instanceof Error ? err.message : "Rollback failed"
			);
		} finally {
			setIsRollingBack(false);
		}
	}, [importResult, setImportResult]);

	/**
	 * Export errors as CSV
	 */
	const handleExportErrors = useCallback(() => {
		if (!importResult?.errors || importResult.errors.length === 0) return;

		const csv = [
			["Row", "Column", "Value", "Error"],
			...importResult.errors.map((err: ValidationIssue) => [
				String(err.row),
				err.column || "",
				String(err.value ?? ""),
				err.message,
			]),
		]
			.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
			.join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}, [importResult]);

	/**
	 * Get target table label
	 */
	const targetTableLabel =
		IMPORT_TARGETS.find((t) => t.value === targetTable)?.label || targetTable;

	/**
	 * Calculate success rate
	 */
	const successRate = useMemo(() => {
		if (!importResult || importResult.totalRows === 0) return 0;
		return Math.round(
			((importResult.importedRows + importResult.updatedRows) /
				importResult.totalRows) *
				100
		);
	}, [importResult]);

	// Loading/Processing state
	if (isLoading || !importResult) {
		return (
			<div className="flex flex-col items-center justify-center py-16 gap-6">
				<div className="relative">
					<Loader2 className="h-16 w-16 text-primary animate-spin" />
				</div>

				<div className="text-center">
					<h3 className="font-semibold text-lg mb-1">
						{progress?.status === "pending"
							? "Validating Data..."
							: "Importing Records..."}
					</h3>
					<p className="text-sm text-muted-foreground">
						{progress
							? `Processing ${progress.processedRows.toLocaleString()} of ${progress.totalRows.toLocaleString()} rows`
							: "Please wait while we process your data"}
					</p>
				</div>

				{progress && (
					<div className="w-full max-w-md space-y-2">
						<Progress
							value={
								progress.totalRows > 0
									? (progress.processedRows / progress.totalRows) * 100
									: 0
							}
						/>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>
								{progress.importedRows + progress.updatedRows} imported
							</span>
							<span>{progress.failedRows} failed</span>
						</div>
					</div>
				)}
			</div>
		);
	}

	// Success state
	const isSuccess =
		importResult.success &&
		importResult.importedRows + importResult.updatedRows > 0;

	return (
		<div className="space-y-8 max-w-3xl mx-auto">
			{/* Result Header */}
			<div className="flex flex-col items-center text-center py-8">
				{isSuccess ? (
					<>
						<div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
							<PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400" />
						</div>
						<h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
						<p className="text-muted-foreground">
							Successfully imported{" "}
							{(importResult.importedRows + importResult.updatedRows).toLocaleString()}{" "}
							records to {targetTableLabel}
						</p>
					</>
				) : importResult.failedRows === importResult.totalRows ? (
					<>
						<div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
							<XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
						</div>
						<h2 className="text-2xl font-bold mb-2">Import Failed</h2>
						<p className="text-muted-foreground">
							No records could be imported. Please check the errors below.
						</p>
					</>
				) : (
					<>
						<div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
							<FileWarning className="h-10 w-10 text-amber-600 dark:text-amber-400" />
						</div>
						<h2 className="text-2xl font-bold mb-2">Import Partially Complete</h2>
						<p className="text-muted-foreground">
							{(importResult.importedRows + importResult.updatedRows).toLocaleString()}{" "}
							records imported, {importResult.failedRows.toLocaleString()} failed
						</p>
					</>
				)}
			</div>

			{/* Statistics Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="p-5 bg-muted rounded-xl text-center">
					<div className="text-3xl font-bold">
						{importResult.totalRows.toLocaleString()}
					</div>
					<div className="text-sm text-muted-foreground mt-1">Total Rows</div>
				</div>
				<div className="p-5 bg-green-50 dark:bg-green-950/20 rounded-xl text-center">
					<div className="text-3xl font-bold text-green-600">
						{importResult.importedRows.toLocaleString()}
					</div>
					<div className="text-sm text-muted-foreground mt-1">Created</div>
				</div>
				<div className="p-5 bg-blue-50 dark:bg-blue-950/20 rounded-xl text-center">
					<div className="text-3xl font-bold text-blue-600">
						{importResult.updatedRows.toLocaleString()}
					</div>
					<div className="text-sm text-muted-foreground mt-1">Updated</div>
				</div>
				<div className="p-5 bg-red-50 dark:bg-red-950/20 rounded-xl text-center">
					<div className="text-3xl font-bold text-red-600">
						{importResult.failedRows.toLocaleString()}
					</div>
					<div className="text-sm text-muted-foreground mt-1">Failed</div>
				</div>
			</div>

			{/* Success Rate */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Success Rate</span>
					<span className="font-medium">{successRate}%</span>
				</div>
				<Progress
					value={successRate}
					className={cn(
						successRate >= 90
							? "[&>div]:bg-green-500"
							: successRate >= 50
								? "[&>div]:bg-amber-500"
								: "[&>div]:bg-red-500"
					)}
				/>
			</div>

			{/* Error List */}
			{importResult.errors && importResult.errors.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-red-500" />
							Errors ({importResult.errors.length})
						</h3>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExportErrors}
							className="gap-2"
						>
							<Download className="h-4 w-4" />
							Export Errors
						</Button>
					</div>

					<div className="border rounded-xl overflow-hidden">
						<ScrollArea className="h-[300px]">
							<Table>
								<TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
									<TableRow>
										<TableHead className="w-[60px]">Row</TableHead>
										<TableHead className="w-[100px]">Column</TableHead>
										<TableHead className="w-[150px]">Value</TableHead>
										<TableHead>Error</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{importResult.errors.slice(0, 100).map((error: ValidationIssue, index: number) => (
										<TableRow key={index}>
											<TableCell className="font-mono text-sm">
												{error.row}
											</TableCell>
											<TableCell className="font-mono text-sm text-muted-foreground">
												{error.column || "—"}
											</TableCell>
											<TableCell className="font-mono text-xs max-w-[150px] truncate text-muted-foreground" title={error.value ? String(error.value) : undefined}>
												{error.value ? (
													<span className="bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
														{String(error.value).slice(0, 30)}{String(error.value).length > 30 ? "..." : ""}
													</span>
												) : "—"}
											</TableCell>
											<TableCell className="text-sm text-red-600 dark:text-red-400">
												{error.message}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ScrollArea>
					</div>

					{importResult.errors.length > 100 && (
						<p className="text-sm text-muted-foreground text-center">
							Showing first 100 of {importResult.errors.length} errors.
							Export to see all.
						</p>
					)}
				</div>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between pt-4 border-t">
				{/* Rollback Button */}
				{importResult.importId &&
					(importResult.importedRows > 0 || importResult.updatedRows > 0) && (
						<Button
							variant="outline"
							onClick={() => setShowRollbackDialog(true)}
							className="gap-2 text-destructive hover:text-destructive"
						>
							<RotateCcw className="h-4 w-4" />
							Rollback Import
						</Button>
					)}

				{/* View Records Link */}
				{isSuccess && (
					<Button variant="outline" asChild className="gap-2">
						<a href={`/${targetTable}`}>
							<ExternalLink className="h-4 w-4" />
							View {targetTableLabel}
						</a>
					</Button>
				)}
			</div>

			{/* Rollback Confirmation Dialog */}
			<AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Rollback Import?</AlertDialogTitle>
						<AlertDialogDescription>
							This will delete all{" "}
							{(importResult.importedRows + importResult.updatedRows).toLocaleString()}{" "}
							records that were created or updated by this import. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>

					{rollbackError && (
						<p className="text-sm text-destructive">{rollbackError}</p>
					)}

					<AlertDialogFooter>
						<AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRollback}
							disabled={isRollingBack}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isRollingBack ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Rolling Back...
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4 mr-2" />
									Yes, Rollback
								</>
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export default ImportResultsStep;
