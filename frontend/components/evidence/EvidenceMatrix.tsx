/**
 * EvidenceMatrix - Coverage Matrix View
 *
 * Interactive grid showing evidence coverage across evaluation criteria
 * or requirements, with color-coded cells and gap highlighting.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Grid3X3,
	Maximize2,
	Minimize2,
	Download,
	RefreshCw,
	AlertCircle,
	Loader2,
	Plus,
	Eye,
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type {
	EvidenceMatrix as EvidenceMatrixData,
	EvidenceMatrixCell,
	MatrixType,
} from "@/lib/types/evidence";
import { getEvidenceMatrix } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface EvidenceMatrixProps {
	/** Opportunity ID for the matrix */
	opportunityId: string;
	/** Type of matrix to display */
	matrixType?: MatrixType;
	/** Callback when cell is clicked */
	onCellClick?: (cell: EvidenceMatrixCell, rowName: string, colName: string) => void;
	/** Callback to add evidence to a cell */
	onAddEvidence?: (rowId: string, columnId: string) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const COVERAGE_COLORS = {
	strong: "bg-green-500 hover:bg-green-600",
	moderate: "bg-yellow-500 hover:bg-yellow-600",
	weak: "bg-orange-500 hover:bg-orange-600",
	none: "bg-red-500 hover:bg-red-600",
};

const COVERAGE_TEXT = {
	strong: "Strong coverage",
	moderate: "Moderate coverage",
	weak: "Weak coverage",
	none: "No coverage (Gap)",
};

// =============================================================================
// Loading Skeleton
// =============================================================================

function MatrixSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-32" />
						<Skeleton className="h-9 w-9" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{[1, 2, 3, 4, 5].map((row) => (
						<div key={row} className="flex gap-2">
							<Skeleton className="h-12 w-32" />
							{[1, 2, 3, 4].map((col) => (
								<Skeleton key={col} className="h-12 w-24" />
							))}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Matrix Cell Component
// =============================================================================

interface MatrixCellProps {
	cell: EvidenceMatrixCell;
	rowName: string;
	colName: string;
	onClick: () => void;
	onAddEvidence: () => void;
}

function MatrixCell({ cell, rowName, colName, onClick, onAddEvidence }: MatrixCellProps) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						className={cn(
							"w-full h-12 rounded transition-all relative group",
							COVERAGE_COLORS[cell.coverage],
							cell.isGap && "ring-2 ring-red-300 ring-offset-1"
						)}
						onClick={onClick}
					>
						<span className="text-white text-xs font-medium">
							{cell.evidenceIds.length > 0 ? cell.evidenceIds.length : "-"}
						</span>
						{cell.isGap && (
							<div className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full" />
						)}
						<Button
							size="icon"
							variant="secondary"
							className="absolute inset-0 m-auto h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
							onClick={(e) => {
								e.stopPropagation();
								onAddEvidence();
							}}
						>
							<Plus className="h-3 w-3" />
						</Button>
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<div className="text-sm">
						<p className="font-medium">{rowName} / {colName}</p>
						<p className="text-muted-foreground">{COVERAGE_TEXT[cell.coverage]}</p>
						<p className="text-muted-foreground">
							{cell.evidenceIds.length} evidence item{cell.evidenceIds.length !== 1 ? "s" : ""}
						</p>
						<p className="text-muted-foreground">Score: {cell.coverageScore}%</p>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =============================================================================
// Cell Detail Dialog
// =============================================================================

interface CellDetailDialogProps {
	cell: EvidenceMatrixCell | null;
	rowName: string;
	colName: string;
	open: boolean;
	onClose: () => void;
	onAddEvidence: () => void;
}

function CellDetailDialog({
	cell,
	rowName,
	colName,
	open,
	onClose,
	onAddEvidence,
}: CellDetailDialogProps) {
	if (!cell) return null;

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{rowName} / {colName}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex items-center gap-4">
						<Badge
							variant="outline"
							className={cn(
								"text-sm",
								cell.coverage === "strong" && "bg-green-100 text-green-700",
								cell.coverage === "moderate" && "bg-yellow-100 text-yellow-700",
								cell.coverage === "weak" && "bg-orange-100 text-orange-700",
								cell.coverage === "none" && "bg-red-100 text-red-700"
							)}
						>
							{COVERAGE_TEXT[cell.coverage]}
						</Badge>
						<span className="text-sm text-muted-foreground">
							Score: {cell.coverageScore}%
						</span>
					</div>

					{cell.isGap && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Coverage Gap</AlertTitle>
							<AlertDescription>
								This cell needs more evidence to meet coverage requirements.
							</AlertDescription>
						</Alert>
					)}

					<div>
						<h4 className="text-sm font-medium mb-2">
							Evidence Items ({cell.evidenceIds.length})
						</h4>
						{cell.evidenceIds.length === 0 ? (
							<p className="text-sm text-muted-foreground">No evidence linked</p>
						) : (
							<ul className="space-y-1">
								{cell.evidenceIds.map((id) => (
									<li key={id} className="text-sm p-2 bg-muted rounded flex items-center gap-2">
										<Eye className="h-3 w-3 text-muted-foreground" />
										{id.substring(0, 20)}...
									</li>
								))}
							</ul>
						)}
					</div>

					<Button onClick={onAddEvidence} className="w-full">
						<Plus className="h-4 w-4 mr-2" />
						Add Evidence
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function EvidenceMatrix({
	opportunityId,
	matrixType = "evaluation_criteria",
	onCellClick,
	onAddEvidence,
	className,
}: EvidenceMatrixProps) {
	// State
	const [matrix, setMatrix] = useState<EvidenceMatrixData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedType, setSelectedType] = useState<MatrixType>(matrixType);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [selectedCell, setSelectedCell] = useState<{
		cell: EvidenceMatrixCell;
		rowName: string;
		colName: string;
	} | null>(null);

	// Load matrix
	const loadMatrix = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const result = await getEvidenceMatrix(opportunityId, selectedType);
		if (result.success && result.data) {
			// Transform cells from schema format (colId) to types format (columnId)
			// and add computed coverage and isGap fields
			const transformedCells: EvidenceMatrixCell[] = result.data.cells.map((cell) => {
				// Get schema cell which uses colId
				const schemaCell = cell as unknown as { rowId: string; colId: string; evidenceIds: string[]; coverageScore: number };
				// Determine coverage level from score
				const coverageScore = schemaCell.coverageScore ?? 0;
				const coverage: "strong" | "moderate" | "weak" | "none" =
					coverageScore >= 75 ? "strong" :
					coverageScore >= 50 ? "moderate" :
					coverageScore > 0 ? "weak" : "none";
				const isGap = coverage === "none";

				return {
					rowId: schemaCell.rowId,
					columnId: schemaCell.colId,
					evidenceIds: schemaCell.evidenceIds ?? [],
					coverage,
					coverageScore,
					isGap,
				};
			});

			// Transform EvidenceMatrixResult to EvidenceMatrix format
			const matrixData: EvidenceMatrixData = {
				id: result.data.id,
				opportunityId,
				matrixType: selectedType,
				name: result.data.name ?? undefined,
				rows: result.data.rows,
				columns: result.data.columns,
				cells: transformedCells,
				overallCoverage: result.data.overallCoverage ?? undefined,
				gaps: result.data.gaps,
				summary: {
					totalCells: transformedCells.length,
					strongCoverage: transformedCells.filter((c) => c.coverage === "strong").length,
					moderateCoverage: transformedCells.filter((c) => c.coverage === "moderate").length,
					weakCoverage: transformedCells.filter((c) => c.coverage === "weak").length,
					gaps: transformedCells.filter((c) => c.isGap).length,
					overallScore: result.data.overallCoverage ?? 0,
				},
				generatedAt: new Date(),
			};
			setMatrix(matrixData);
		} else if (!result.success) {
			setError(result.error);
		}

		setIsLoading(false);
	}, [opportunityId, selectedType]);

	useEffect(() => {
		loadMatrix();
	}, [loadMatrix]);

	// Get cell for row/column
	const getCell = useCallback(
		(rowId: string, colId: string): EvidenceMatrixCell | undefined => {
			return matrix?.cells.find((c) => c.rowId === rowId && c.columnId === colId);
		},
		[matrix]
	);

	// Handle cell click
	const handleCellClick = useCallback(
		(cell: EvidenceMatrixCell, rowName: string, colName: string) => {
			setSelectedCell({ cell, rowName, colName });
			onCellClick?.(cell, rowName, colName);
		},
		[onCellClick]
	);

	// Handle add evidence
	const handleAddEvidence = useCallback(
		(rowId: string, colId: string) => {
			onAddEvidence?.(rowId, colId);
		},
		[onAddEvidence]
	);

	// Export matrix
	const handleExport = useCallback(() => {
		if (!matrix) return;

		// Create CSV content
		let csv = "," + matrix.columns.map((c) => c.name).join(",") + "\n";
		matrix.rows.forEach((row) => {
			csv += row.name;
			matrix.columns.forEach((col) => {
				const cell = getCell(row.id, col.id);
				csv += "," + (cell?.coverageScore || 0);
			});
			csv += "\n";
		});

		// Download
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `evidence-matrix-${opportunityId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}, [matrix, opportunityId, getCell]);

	if (isLoading) {
		return <MatrixSkeleton />;
	}

	return (
		<>
			<Card className={cn("w-full", isFullscreen && "fixed inset-4 z-50", className)}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Grid3X3 className="h-5 w-5" />
							Evidence Coverage Matrix
							{matrix && matrix.summary && (
								<Badge variant="secondary">
									{matrix.summary.overallScore}% coverage
								</Badge>
							)}
						</CardTitle>

						<div className="flex items-center gap-2">
							<Select value={selectedType} onValueChange={(v) => setSelectedType(v as MatrixType)}>
								<SelectTrigger className="w-44">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="evaluation_criteria">Evaluation Criteria</SelectItem>
									<SelectItem value="requirements">Requirements</SelectItem>
									<SelectItem value="sections">Sections</SelectItem>
								</SelectContent>
							</Select>

							<Button variant="outline" size="icon" onClick={loadMatrix}>
								<RefreshCw className="h-4 w-4" />
							</Button>

							<Button variant="outline" size="icon" onClick={handleExport}>
								<Download className="h-4 w-4" />
							</Button>

							<Button
								variant="outline"
								size="icon"
								onClick={() => setIsFullscreen(!isFullscreen)}
							>
								{isFullscreen ? (
									<Minimize2 className="h-4 w-4" />
								) : (
									<Maximize2 className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent>
					{/* Error */}
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Matrix */}
					{matrix && (
						<div className="space-y-4">
							{/* Summary */}
							{matrix.summary && (
								<div className="flex items-center gap-4 text-sm">
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded bg-green-500" />
										<span>Strong ({matrix.summary.strongCoverage})</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded bg-yellow-500" />
										<span>Moderate ({matrix.summary.moderateCoverage})</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded bg-orange-500" />
										<span>Weak ({matrix.summary.weakCoverage})</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded bg-red-500" />
										<span>Gaps ({matrix.summary.gaps})</span>
									</div>
								</div>
							)}

							{/* Matrix Grid */}
							<ScrollArea className="w-full">
								<div className="min-w-max">
									{/* Header Row */}
									<div className="flex gap-1 mb-1">
										<div className="w-40 shrink-0" />
										{matrix.columns.map((col) => (
											<div
												key={col.id}
												className="w-24 text-center text-xs font-medium p-2 bg-muted rounded"
											>
												{col.name}
											</div>
										))}
									</div>

									{/* Data Rows */}
									{matrix.rows.map((row) => (
										<div key={row.id} className="flex gap-1 mb-1">
											<div className="w-40 shrink-0 text-sm p-2 bg-muted rounded flex items-center justify-between">
												<span className="truncate">{row.name}</span>
												{row.weight && (
													<Badge variant="outline" className="text-xs ml-1">
														{row.weight}%
													</Badge>
												)}
											</div>
											{matrix.columns.map((col) => {
												const cell = getCell(row.id, col.id);
												if (!cell) {
													return (
														<div
															key={col.id}
															className="w-24 h-12 bg-muted/50 rounded"
														/>
													);
												}
												return (
													<div key={col.id} className="w-24">
														<MatrixCell
															cell={cell}
															rowName={row.name}
															colName={col.name}
															onClick={() => handleCellClick(cell, row.name, col.name)}
															onAddEvidence={() => handleAddEvidence(row.id, col.id)}
														/>
													</div>
												);
											})}
										</div>
									))}
								</div>
								<ScrollBar orientation="horizontal" />
							</ScrollArea>

							{/* Gap Alert */}
							{matrix.summary && matrix.summary.gaps > 0 && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Coverage Gaps Detected</AlertTitle>
									<AlertDescription>
										{matrix.summary.gaps} cell{matrix.summary.gaps !== 1 ? "s" : ""} lack adequate evidence coverage.
										Click on red cells to add supporting evidence.
									</AlertDescription>
								</Alert>
							)}
						</div>
					)}

					{/* Empty State */}
					{!error && !matrix && (
						<div className="text-center py-8">
							<Grid3X3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
							<h3 className="mt-4 font-medium">No Matrix Data</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Unable to generate coverage matrix
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Cell Detail Dialog */}
			<CellDetailDialog
				cell={selectedCell?.cell || null}
				rowName={selectedCell?.rowName || ""}
				colName={selectedCell?.colName || ""}
				open={!!selectedCell}
				onClose={() => setSelectedCell(null)}
				onAddEvidence={() => {
					if (selectedCell) {
						handleAddEvidence(selectedCell.cell.rowId, selectedCell.cell.columnId);
					}
				}}
			/>
		</>
	);
}

export default EvidenceMatrix;
