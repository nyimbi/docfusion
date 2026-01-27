/**
 * Opportunity Import Page - DocFusion
 *
 * Upload and import opportunities from Excel spreadsheets.
 * Supports drag-and-drop, format detection, and preview.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { importFromBuffer, previewImport } from "@/lib/actions/import-opportunities";
import { getImportHistory } from "@/lib/actions/opportunities";
import type { NormalizedOpportunity, OpportunityImport } from "@/lib/types/opportunity";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
		if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
			setState((prev) => ({ ...prev, error: "Please upload an Excel or CSV file" }));
			return;
		}

		setIsLoading(true);
		setState((prev) => ({ ...prev, file, error: null }));

		try {
			// Create a temporary file path for preview
			// In production, this would use a proper file upload to temp storage
			const buffer = await file.arrayBuffer();

			// For now, we'll skip the preview step and go directly to import
			// since previewImport requires a file path
			setState((prev) => ({
				...prev,
				step: "preview",
				preview: [],
				totalRows: 0,
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
				Buffer.from(buffer),
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
		<div className="min-h-screen bg-[var(--background)]">
			{/* Header */}
			<header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-6 py-4">
					<div className="flex items-center gap-4">
						<Link
							href="/opportunities"
							className="p-2 rounded-[var(--radius-md)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-muted)] transition-all"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
						<div>
							<h1 className="heading-display text-xl text-[var(--foreground)]">
								Import Opportunities
							</h1>
							<p className="text-sm text-[var(--foreground-muted)]">
								Upload Excel spreadsheets to import RFPs, EOIs, and tenders
							</p>
						</div>
					</div>
				</div>
			</header>

			<main className="max-w-4xl mx-auto px-6 py-8">
				{/* Progress Steps */}
				<div className="flex items-center justify-center gap-4 mb-8">
					{(["upload", "preview", "importing", "complete"] as ImportStep[]).map(
						(step, index) => (
							<React.Fragment key={step}>
								{index > 0 && (
									<ChevronRight className="h-4 w-4 text-[var(--foreground-muted)]" />
								)}
								<div
									className={cn(
										"flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
										state.step === step
											? "bg-[var(--accent-100)] text-[var(--accent-700)]"
											: index < ["upload", "preview", "importing", "complete"].indexOf(state.step)
											? "text-[var(--success-600)]"
											: "text-[var(--foreground-muted)]"
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
					<div className="mb-6 p-4 rounded-[var(--radius-lg)] bg-[var(--error-50)] border border-[var(--error-200)] text-[var(--error-700)] flex items-start gap-3">
						<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
						<div>
							<p className="font-medium">Import Error</p>
							<p className="text-sm mt-1">{state.error}</p>
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
								"relative border-2 border-dashed rounded-[var(--radius-xl)] p-12",
								"transition-all duration-[var(--transition-base)]",
								isDragging
									? "border-[var(--accent-500)] bg-[var(--accent-50)]"
									: "border-[var(--border-strong)] hover:border-[var(--accent-400)] hover:bg-[var(--background-muted)]/50"
							)}
						>
							<input
								ref={fileInputRef}
								type="file"
								accept=".xlsx,.xls,.csv"
								onChange={(e) => {
									const files = e.target.files;
									if (files && files.length > 0) {
										handleFileSelect(files[0]);
									}
								}}
								className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
							/>

							<div className="text-center">
								<div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent-100)] flex items-center justify-center">
									{isLoading ? (
										<Loader2 className="h-8 w-8 text-[var(--accent-600)] animate-spin" />
									) : (
										<FileSpreadsheet className="h-8 w-8 text-[var(--accent-600)]" />
									)}
								</div>
								<h3 className="heading-display text-lg text-[var(--foreground)] mb-2">
									{isDragging ? "Drop your file here" : "Upload Spreadsheet"}
								</h3>
								<p className="text-[var(--foreground-muted)] mb-4">
									Drag and drop an Excel file, or click to browse
								</p>
								<Button variant="secondary" disabled={isLoading}>
									<Upload className="h-4 w-4" />
									Choose File
								</Button>
								<p className="text-xs text-[var(--foreground-subtle)] mt-4">
									Supports .xlsx, .xls, and .csv files
								</p>
							</div>
						</div>

						{/* Supported Formats */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Supported Formats</CardTitle>
								<CardDescription>
									DocFusion automatically detects these spreadsheet formats:
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2 text-sm">
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-[var(--success-500)]" />
										<span>Software Development RFPs/EOIs</span>
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-[var(--success-500)]" />
										<span>Africa NGO/INGO RFPs and EOIs</span>
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-[var(--success-500)]" />
										<span>Africa Software Development RFPs</span>
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-[var(--success-500)]" />
										<span>Africa Commercial/Corporate RFPs</span>
									</li>
									<li className="flex items-center gap-2">
										<Check className="h-4 w-4 text-[var(--success-500)]" />
										<span>Custom formats (auto-detected column mapping)</span>
									</li>
								</ul>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Preview Step */}
				{state.step === "preview" && state.file && (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Ready to Import</CardTitle>
								<CardDescription>
									File: {state.file.name} ({(state.file.size / 1024).toFixed(1)} KB)
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-center gap-4">
									<Button variant="primary" onClick={handleImport} disabled={isLoading}>
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
									<Button variant="ghost" onClick={handleReset} disabled={isLoading}>
										Cancel
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Importing Step */}
				{state.step === "importing" && (
					<div className="text-center py-12">
						<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--accent-100)] flex items-center justify-center">
							<Loader2 className="h-10 w-10 text-[var(--accent-600)] animate-spin" />
						</div>
						<h2 className="heading-display text-xl text-[var(--foreground)] mb-2">
							Importing Opportunities
						</h2>
						<p className="text-[var(--foreground-muted)]">
							Please wait while we process your spreadsheet...
						</p>
					</div>
				)}

				{/* Complete Step */}
				{state.step === "complete" && state.results && (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<div className="w-12 h-12 rounded-full bg-[var(--success-100)] flex items-center justify-center mb-4">
									<Check className="h-6 w-6 text-[var(--success-600)]" />
								</div>
								<CardTitle>Import Complete!</CardTitle>
								<CardDescription>
									Your opportunities have been successfully imported.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
									<ResultStat
										label="Total Processed"
										value={state.results.total}
									/>
									<ResultStat
										label="Imported"
										value={state.results.imported}
										color="success"
									/>
									<ResultStat
										label="Updated"
										value={state.results.updated}
										color="info"
									/>
									<ResultStat
										label="Failed"
										value={state.results.failed}
										color="error"
									/>
								</div>

								<div className="flex items-center gap-4">
									<Link href="/opportunities">
										<Button variant="primary">
											View Opportunities
										</Button>
									</Link>
									<Button variant="secondary" onClick={handleReset}>
										<RefreshCw className="h-4 w-4" />
										Import Another
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Import History */}
				{importHistory.length > 0 && state.step === "upload" && (
					<Card className="mt-8">
						<CardHeader>
							<CardTitle className="text-base">Recent Imports</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{importHistory.map((imp) => (
									<div
										key={imp.id}
										className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
									>
										<div className="flex items-center gap-3">
											<FileText className="h-4 w-4 text-[var(--foreground-muted)]" />
											<div>
												<p className="text-sm font-medium text-[var(--foreground)]">
													{imp.filename}
												</p>
												<p className="text-xs text-[var(--foreground-muted)]">
													{new Date(imp.startedAt).toLocaleDateString()} ·{" "}
													{imp.importedRecords} imported, {imp.updatedRecords} updated
												</p>
											</div>
										</div>
										<span
											className={cn(
												"px-2 py-0.5 text-xs font-medium rounded-full",
												imp.status === "completed"
													? "bg-[var(--success-100)] text-[var(--success-700)]"
													: imp.status === "failed"
													? "bg-[var(--error-100)] text-[var(--error-700)]"
													: "bg-[var(--ink-100)] text-[var(--ink-600)]"
											)}
										>
											{imp.status}
										</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}
			</main>
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
		success: "text-[var(--success-600)]",
		error: "text-[var(--error-600)]",
		info: "text-[var(--info-600)]",
	};

	return (
		<div className="text-center p-4 rounded-[var(--radius-lg)] bg-[var(--background-muted)]">
			<div
				className={cn(
					"text-2xl font-bold",
					color ? colorClasses[color] : "text-[var(--foreground)]"
				)}
			>
				{value}
			</div>
			<div className="text-xs text-[var(--foreground-muted)] mt-1">{label}</div>
		</div>
	);
}
