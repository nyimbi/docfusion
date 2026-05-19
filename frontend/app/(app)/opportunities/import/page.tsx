/**
 * Opportunity Import Page - DocFusion
 *
 * Upload and import opportunities from Excel spreadsheets.
 * Supports drag-and-drop, format detection, and preview.
 *
 * Design: "Command Center Elegance" - Dark theme
 * Note: Uses shared (app) layout for navigation.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { importFromBuffer, previewImportFromBuffer } from "@/lib/actions/import-opportunities";
import { getImportHistory } from "@/lib/actions/opportunities";
import type { NormalizedOpportunity, OpportunityImport } from "@/lib/types/opportunity";
import { Button } from "@/components/ui/Button";
import {
	ArrowLeft,
	Upload,
	FileSpreadsheet,
	Check,
	X,
	AlertCircle,
	Loader2,
	ChevronRight,
	Clock,
	FileText,
	RefreshCw,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type ImportStep = "upload" | "preview" | "importing" | "complete";

interface ImportState {
	step: ImportStep;
	file: File | null;
	preview: NormalizedOpportunity[];
	totalRows: number;
	results: {
		total: number;
		imported: number;
		updated: number;
		skipped: number;
		failed: number;
	} | null;
	error: string | null;
}

// ============================================================================
// Page Component
// ============================================================================

export default function ImportOpportunitiesPage() {
	const router = useRouter();
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const [state, setState] = React.useState<ImportState>({
		step: "upload",
		file: null,
		preview: [],
		totalRows: 0,
		results: null,
		error: null,
	});

	const [importHistory, setImportHistory] = React.useState<OpportunityImport[]>([]);
	const [isDragging, setIsDragging] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);

	// Load import history
	React.useEffect(() => {
		getImportHistory(10).then(setImportHistory).catch(console.error);
	}, []);

	// Handle file selection
	const handleFileSelect = async (file: File) => {
		if (!file.name.match(/\.(csv|tsv)$/i)) {
			setState((prev) => ({ ...prev, error: "Please upload a CSV or TSV file" }));
			return;
		}

		setIsLoading(true);
		setState((prev) => ({ ...prev, file, error: null }));

		try {
			const buffer = await file.arrayBuffer();
			const result = await previewImportFromBuffer(buffer, file.name, { updateExisting: true });
			setState((prev) => ({
				...prev,
				step: "preview",
				preview: result.preview,
				totalRows: result.totalRows,
			}));
		} catch (err) {
			setState((prev) => ({
				...prev,
				error: `Failed to read file: ${err}`,
			}));
		} finally {
			setIsLoading(false);
		}
	};

	// Handle import
	const handleImport = async () => {
		if (!state.file) return;

		setIsLoading(true);
		setState((prev) => ({ ...prev, step: "importing", error: null }));

		try {
			const buffer = await state.file.arrayBuffer();
			const result = await importFromBuffer(
				buffer,
				state.file.name,
				{ updateExisting: true }
			);

			setState((prev) => ({
				...prev,
				step: "complete",
				results: result.results,
			}));

			// Refresh history
			getImportHistory(10).then(setImportHistory).catch(console.error);
		} catch (err) {
			setState((prev) => ({
				...prev,
				step: "upload",
				error: `Import failed: ${err}`,
			}));
		} finally {
			setIsLoading(false);
		}
	};

	// Drag and drop handlers
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	// Reset
	const handleReset = () => {
		setState({
			step: "upload",
			file: null,
			preview: [],
			totalRows: 0,
			results: null,
			error: null,
		});
	};

	return (
		<div className="relative max-w-3xl mx-auto">
			{/* Page Header */}
			<div className="flex items-center gap-4 mb-8">
				<Link
					href="/opportunities"
					className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
				>
					<ArrowLeft className="h-5 w-5" />
				</Link>
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Import Opportunities
					</h1>
					<p className="text-sm text-muted-foreground">
						Upload CSV or TSV files to import RFPs, EOIs, and tenders
					</p>
				</div>
			</div>

			{/* Progress Steps */}
			<div className="flex items-center justify-center gap-4 mb-8">
				{(["upload", "preview", "importing", "complete"] as ImportStep[]).map(
					(step, index) => (
						<React.Fragment key={step}>
							<div
								className={cn(
									"flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
									state.step === step
										? "bg-primary/20 text-primary"
										: index < ["upload", "preview", "importing", "complete"].indexOf(state.step)
											? "text-green-500"
											: "text-muted-foreground"
								)}
							>
								{index <
									["upload", "preview", "importing", "complete"].indexOf(state.step) ? (
									<Check className="h-4 w-4" />
								) : (
									<span className="w-5 h-5 flex items-center justify-center rounded-full border border-current text-xs">
										{index + 1}
									</span>
								)}
								<span className="capitalize">{step}</span>
							</div>
						</React.Fragment>
					)
				)}
			</div>

			{/* Error Display */}
			{state.error && (
				<div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-3">
					<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
					<div>
						<p className="font-medium">Import Error</p>
						<p className="text-sm mt-1 text-destructive/80">{state.error}</p>
					</div>
				</div>
			)}

			{/* Upload Step */}
			{state.step === "upload" && (
				<div className="space-y-6">
					{/* Drop Zone */}
					<div
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={cn(
							"relative border-2 border-dashed rounded-2xl p-12",
							"transition-all duration-300",
							isDragging
								? "border-primary bg-primary/10"
								: "border-border hover:border-primary/50 hover:bg-muted"
						)}
					>
						<input
							ref={fileInputRef}
							type="file"
							accept=".csv,.tsv"
							onChange={(e) => {
								const files = e.target.files;
								if (files && files.length > 0) {
									handleFileSelect(files[0]);
								}
							}}
							className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
						/>

						<div className="text-center">
							<div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
								{isLoading ? (
									<Loader2 className="h-8 w-8 text-primary animate-spin" />
								) : (
									<FileSpreadsheet className="h-8 w-8 text-primary" />
								)}
							</div>
							<h3 className="text-lg font-semibold text-foreground mb-2">
								{isDragging ? "Drop your file here" : "Upload Spreadsheet"}
							</h3>
							<p className="text-muted-foreground mb-4">
								Drag and drop a CSV or TSV file, or click to browse
							</p>
							<Button
								variant="outline"
								disabled={isLoading}
							>
								<Upload className="h-4 w-4" />
								Choose File
							</Button>
							<p className="text-xs text-muted-foreground mt-4">
								Supports .csv and .tsv files
							</p>
						</div>
					</div>

					{/* Supported Formats */}
					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<h3 className="text-sm font-semibold text-foreground mb-1">
							Supported Formats
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							DocFusion automatically detects these column formats:
						</p>
						<ul className="space-y-2 text-sm">
							{[
								"Software Development RFPs/EOIs",
								"Africa NGO/INGO RFPs and EOIs",
								"Africa Software Development RFPs",
								"Africa Commercial/Corporate RFPs",
								"Custom formats (auto-detected column mapping)",
							].map((format) => (
								<li key={format} className="flex items-center gap-2 text-muted-foreground">
									<Check className="h-4 w-4 text-green-500" />
									<span>{format}</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{/* Preview Step */}
			{state.step === "preview" && state.file && (
				<div className="space-y-6">
					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<h3 className="text-sm font-semibold text-foreground mb-1">
							Ready to Import
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							File: {state.file.name} ({(state.file.size / 1024).toFixed(1)} KB)
						</p>
						<div className="mb-5 rounded-lg border bg-muted/30">
							<div className="flex items-center justify-between border-b px-4 py-3">
								<div>
									<p className="text-sm font-medium text-foreground">
										Preview
									</p>
									<p className="text-xs text-muted-foreground">
										Detected {state.totalRows} rows. Showing {Math.min(state.preview.length, 5)} sample rows.
									</p>
								</div>
								<span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
									{state.preview.length} parsed
								</span>
							</div>
							<div className="divide-y">
								{state.preview.slice(0, 5).map((opportunity, index) => (
									<div key={`${opportunity.title}-${index}`} className="px-4 py-3">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate text-sm font-medium text-foreground">
													{opportunity.title}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{opportunity.organization || "Unknown organization"}
													{opportunity.countryRegion ? ` · ${opportunity.countryRegion}` : ""}
												</p>
											</div>
											{opportunity.deadline && (
												<span className="shrink-0 text-xs text-muted-foreground">
													{new Date(opportunity.deadline).toLocaleDateString()}
												</span>
											)}
										</div>
									</div>
								))}
								{state.preview.length === 0 && (
									<div className="px-4 py-5 text-sm text-muted-foreground">
										No valid opportunity rows were detected in the preview.
									</div>
								)}
							</div>
						</div>
						<div className="flex items-center gap-4">
							<Button
								onClick={handleImport}
								disabled={isLoading || state.preview.length === 0}
							>
								{isLoading ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Processing...
									</>
								) : (
									<>
										<Upload className="h-4 w-4" />
										Start Import
									</>
								)}
							</Button>
							<Button
								variant="ghost"
								onClick={handleReset}
								disabled={isLoading}
								className="text-muted-foreground hover:text-foreground"
							>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Importing Step */}
			{state.step === "importing" && (
				<div className="text-center py-12">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
						<Loader2 className="h-10 w-10 text-primary animate-spin" />
					</div>
					<h2 className="text-xl font-bold text-foreground mb-2">
						Importing Opportunities
					</h2>
					<p className="text-muted-foreground">
						Please wait while we process your spreadsheet...
					</p>
				</div>
			)}

			{/* Complete Step */}
			{state.step === "complete" && state.results && (
				<div className="space-y-6">
					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
							<Check className="h-6 w-6 text-green-500" />
						</div>
						<h3 className="text-lg font-bold text-foreground mb-1">
							Import Complete!
						</h3>
						<p className="text-sm text-muted-foreground mb-6">
							Your opportunities have been successfully imported.
						</p>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
							<ResultStat label="Total Processed" value={state.results.total} />
							<ResultStat label="Imported" value={state.results.imported} color="success" />
							<ResultStat label="Updated" value={state.results.updated} color="info" />
							<ResultStat label="Failed" value={state.results.failed} color="error" />
						</div>

						<div className="flex items-center gap-4">
							<Link href="/opportunities">
								<Button>
									View Opportunities
								</Button>
							</Link>
							<Button
								variant="ghost"
								onClick={handleReset}
								className="text-muted-foreground hover:text-foreground"
							>
								<RefreshCw className="h-4 w-4" />
								Import Another
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Import History */}
			{importHistory.length > 0 && state.step === "upload" && (
				<div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
					<h3 className="text-sm font-semibold text-foreground mb-4">
						Recent Imports
					</h3>
					<div className="space-y-3">
						{importHistory.map((imp) => (
							<div
								key={imp.id}
								className="flex items-center justify-between py-2 border-b border-border last:border-0"
							>
								<div className="flex items-center gap-3">
									<FileText className="h-4 w-4 text-muted-foreground" />
									<div>
										<p className="text-sm font-medium text-foreground">
											{imp.filename}
										</p>
										<p className="text-xs text-muted-foreground">
											{new Date(imp.startedAt).toLocaleDateString()} ·{" "}
											{imp.importedRecords} imported, {imp.updatedRecords} updated
										</p>
									</div>
								</div>
								<span
									className={cn(
										"px-2 py-0.5 text-xs font-medium rounded-full",
										imp.status === "completed"
											? "bg-green-500/20 text-green-600"
											: imp.status === "failed"
												? "bg-destructive/20 text-destructive"
												: "bg-muted text-muted-foreground"
									)}
								>
									{imp.status}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Result Stat Component
// ============================================================================

function ResultStat({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color?: "success" | "error" | "info";
}) {
	const colorClasses = {
		success: "text-green-500",
		error: "text-destructive",
		info: "text-blue-500",
	};

	return (
		<div className="text-center p-4 rounded-xl bg-muted/50">
			<div
				className={cn(
					"text-2xl font-bold tabular-nums",
					color ? colorClasses[color] : "text-foreground"
				)}
			>
				{value}
			</div>
			<div className="text-xs text-muted-foreground mt-1">{label}</div>
		</div>
	);
}
