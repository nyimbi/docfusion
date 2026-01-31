"use client";

/**
 * Data Preview Step Component
 *
 * Fourth step in the import wizard. Shows a preview of
 * the transformed data with validation results.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useImportStore } from "@/lib/stores/import-store";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Loader2,
	RefreshCw,
	Search,
	XCircle,
} from "lucide-react";

const ROWS_PER_PAGE = 10;

interface PreviewRowData {
	sourceRow: number;
	targetValues: Record<string, unknown>;
	issues: Array<{ column?: string; message: string; severity: "error" | "warning" }>;
	hasError?: boolean;
	hasWarning?: boolean;
}

export function DataPreviewStep() {
	const [page, setPage] = useState(0);
	const [searchTerm, setSearchTerm] = useState("");
	const [localLoading, setLocalLoading] = useState(false);

	const mappings = useImportStore((s) => s.mappings);
	const parsedData = useImportStore((s) => s.parsedData);
	const targetTable = useImportStore((s) => s.targetTable);
	const previewData = useImportStore((s) => s.previewData);
	const setPreviewData = useImportStore((s) => s.setPreviewData);

	const fetchPreview = useCallback(async () => {
		if (!parsedData || !targetTable || mappings.length === 0) return;

		setLocalLoading(true);

		try {
			const response = await fetch("/api/v1/import/preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					parsedData: {
						headers: parsedData.headers,
						sampleRows: parsedData.sampleRows,
						totalRows: parsedData.totalRows,
					},
					targetTable,
					mappings,
					previewCount: 50,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to generate preview");
			}

			const data = await response.json();

			if (data.success && data.preview) {
				setPreviewData(data.preview);
			}
		} catch (err) {
			console.error("Preview error:", err);
		} finally {
			setLocalLoading(false);
		}
	}, [parsedData, targetTable, mappings, setPreviewData]);

	useEffect(() => {
		if (!previewData) {
			fetchPreview();
		}
	}, [fetchPreview, previewData]);

	const mappedColumns = useMemo(() => {
		return mappings.map((m) => m.targetColumn);
	}, [mappings]);

	const filteredRows = useMemo(() => {
		if (!previewData?.rows) return [];
		if (!searchTerm.trim()) return previewData.rows;

		const search = searchTerm.toLowerCase();
		return previewData.rows.filter((row: PreviewRowData) =>
			Object.values(row.targetValues || {}).some((value) =>
				String(value).toLowerCase().includes(search)
			)
		);
	}, [previewData?.rows, searchTerm]);

	const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE);
	const paginatedRows = filteredRows.slice(
		page * ROWS_PER_PAGE,
		(page + 1) * ROWS_PER_PAGE
	);

	const getRowValidationBadge = (row: PreviewRowData) => {
		if (row.issues.length === 0) {
			return (
				<Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
					<CheckCircle2 className="h-3 w-3" />
					Valid
				</Badge>
			);
		}

		const errors = row.issues.filter((i) => i.severity === "error");

		if (errors.length > 0) {
			return (
				<Badge variant="destructive" className="gap-1">
					<XCircle className="h-3 w-3" />
					{errors.length} error{errors.length > 1 ? "s" : ""}
				</Badge>
			);
		}

		return (
			<Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-700">
				<AlertTriangle className="h-3 w-3" />
				{row.issues.length} warning{row.issues.length > 1 ? "s" : ""}
			</Badge>
		);
	};

	if (localLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-12 gap-4">
				<Loader2 className="h-12 w-12 text-primary animate-spin" />
				<div className="text-center">
					<p className="font-medium">Generating Preview...</p>
					<p className="text-sm text-muted-foreground">
						Transforming and validating your data
					</p>
				</div>
			</div>
		);
	}

	if (!previewData) {
		return (
			<div className="flex flex-col items-center justify-center py-12 gap-4">
				<AlertCircle className="h-12 w-12 text-muted-foreground" />
				<div className="text-center">
					<p className="font-medium">No Preview Available</p>
					<p className="text-sm text-muted-foreground">
						Unable to generate preview. Please check your mappings.
					</p>
				</div>
				<Button onClick={fetchPreview} variant="outline" className="gap-2">
					<RefreshCw className="h-4 w-4" />
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Summary Stats */}
			<div className="grid grid-cols-4 gap-4">
				<div className="p-4 bg-muted rounded-lg">
					<div className="text-2xl font-bold">
						{parsedData?.totalRows.toLocaleString() || 0}
					</div>
					<div className="text-sm text-muted-foreground">Total Rows</div>
				</div>
				<div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
					<div className="text-2xl font-bold text-green-600">
						{previewData.rows.filter((r) => !r.hasError && !r.hasWarning).length}
					</div>
					<div className="text-sm text-muted-foreground">Valid Rows</div>
				</div>
				<div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
					<div className="text-2xl font-bold text-amber-600">
						{previewData.validation?.warningCount || 0}
					</div>
					<div className="text-sm text-muted-foreground">Warnings</div>
				</div>
				<div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
					<div className="text-2xl font-bold text-red-600">
						{previewData.validation?.errorCount || 0}
					</div>
					<div className="text-sm text-muted-foreground">Errors</div>
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center justify-between gap-4">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search preview..."
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setPage(0);
						}}
						className="pl-9"
					/>
				</div>

				<Button variant="outline" size="sm" onClick={fetchPreview} className="gap-2">
					<RefreshCw className="h-4 w-4" />
					Refresh
				</Button>
			</div>

			{/* Preview Table */}
			<div className="border rounded-xl overflow-hidden">
				<ScrollArea className="h-[400px]">
					<Table>
						<TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
							<TableRow>
								<TableHead className="w-[60px]">#</TableHead>
								<TableHead className="w-[120px]">Status</TableHead>
								{mappedColumns.map((col) => (
									<TableHead key={col} className="font-mono text-xs">
										{col}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{paginatedRows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={mappedColumns.length + 2}
										className="text-center py-8 text-muted-foreground"
									>
										{searchTerm ? "No matching rows found" : "No preview data"}
									</TableCell>
								</TableRow>
							) : (
								paginatedRows.map((row: PreviewRowData) => (
									<TableRow key={row.sourceRow}>
										<TableCell className="text-muted-foreground text-sm">
											{row.sourceRow}
										</TableCell>
										<TableCell>{getRowValidationBadge(row)}</TableCell>
										{mappedColumns.map((col) => {
											const value = row.targetValues?.[col];
											return (
												<TableCell key={col} className="font-mono text-xs max-w-[200px] truncate">
													{value !== undefined && value !== null
														? String(value)
														: <span className="text-muted-foreground">—</span>}
												</TableCell>
											);
										})}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</ScrollArea>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Showing {page * ROWS_PER_PAGE + 1} to{" "}
						{Math.min((page + 1) * ROWS_PER_PAGE, filteredRows.length)} of{" "}
						{filteredRows.length} rows
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={page === 0}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="text-sm">
							Page {page + 1} of {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={page >= totalPages - 1}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}

			{(previewData.validation?.errorCount || 0) > 0 && (
				<div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 rounded-lg">
					<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
					<div>
						<p className="font-medium">
							{previewData.validation?.errorCount} rows have validation errors
						</p>
						<p className="text-sm opacity-90">
							Rows with errors will be skipped during import unless you fix
							the source data or adjust the mappings.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

export default DataPreviewStep;
