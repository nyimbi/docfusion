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
import { importFromBuffer, previewImport } from "@/lib/actions/import-opportunities";
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
		if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
			setState((prev) => ({ ...prev, error: "Please upload an Excel or CSV file" }));
			return;
		}

		setIsLoading(true);
		setState((prev) => ({ ...prev, file, error: null }));

		try {
			const buffer = await file.arrayBuffer();
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
		<div className="relative max-w-3xl mx-auto">
			{/* Page Header */}
			<div className="flex items-center gap-4 mb-8">
				<Link
					href="/opportunities"
					className="p-2 rounded-xl text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50 transition-all"
				>
					<ArrowLeft className="h-5 w-5" />
				</Link>
				<div>
					<h1 className="heading-display text-2xl text-[var(--ink-100)]">
						Import Opportunities
					</h1>
					<p className="text-sm text-[var(--ink-500)]">
						Upload Excel spreadsheets to import RFPs, EOIs, and tenders
					</p>
				</div>
			</div>

			{/* Progress Steps */}
			<div className="flex items-center justify-center gap-4 mb-8">
				{(["upload", "preview", "importing", "complete"] as ImportStep[]).map(
					(step, index) => (
						<React.Fragment key={step}>
							{index > 0 && (
								<ChevronRight className="h-4 w-4 text-[var(--ink-600)]" />
							)}
							<div
								className={cn(
									"flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
									state.step === step
										? "bg-[var(--accent-500)]/20 text-[var(--accent-400)]"
										: index < ["upload", "preview", "importing", "complete"].indexOf(state.step)
										? "text-[var(--success-500)]"
										: "text-[var(--ink-500)]"
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
				<div className="mb-6 p-4 rounded-xl bg-[var(--error-500)]/10 border border-[var(--error-500)]/30 text-[var(--error-400)] flex items-start gap-3">
					<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
					<div>
						<p className="font-medium">Import Error</p>
						<p className="text-sm mt-1 text-[var(--error-400)]/80">{state.error}</p>
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
								? "border-[var(--accent-500)] bg-[var(--accent-500)]/10"
								: "border-[var(--ink-700)] hover:border-[var(--accent-500)]/50 hover:bg-[var(--ink-800)]/30"
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
							<div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center">
								{isLoading ? (
									<Loader2 className="h-8 w-8 text-white animate-spin" />
								) : (
									<FileSpreadsheet className="h-8 w-8 text-white" />
								)}
							</div>
							<h3 className="heading-display text-lg text-[var(--ink-100)] mb-2">
								{isDragging ? "Drop your file here" : "Upload Spreadsheet"}
							</h3>
							<p className="text-[var(--ink-500)] mb-4">
								Drag and drop an Excel file, or click to browse
							</p>
							<Button
								variant="secondary"
								disabled={isLoading}
								className="bg-[var(--ink-800)] border-[var(--ink-700)] text-[var(--ink-200)] hover:bg-[var(--ink-700)]"
							>
								<Upload className="h-4 w-4" />
								Choose File
							</Button>
							<p className="text-xs text-[var(--ink-600)] mt-4">
								Supports .xlsx, .xls, and .csv files
							</p>
						</div>
					</div>

					{/* Supported Formats */}
					<div className="rounded-xl border border-[var(--ink-800)]/50 bg-[var(--ink-900)]/30 p-6">
						<h3 className="text-sm font-semibold text-[var(--ink-200)] mb-1">
							Supported Formats
						</h3>
						<p className="text-sm text-[var(--ink-500)] mb-4">
							DocFusion automatically detects these spreadsheet formats:
						</p>
						<ul className="space-y-2 text-sm">
							{[
								"Software Development RFPs/EOIs",
								"Africa NGO/INGO RFPs and EOIs",
								"Africa Software Development RFPs",
								"Africa Commercial/Corporate RFPs",
								"Custom formats (auto-detected column mapping)",
							].map((format) => (
								<li key={format} className="flex items-center gap-2 text-[var(--ink-400)]">
									<Check className="h-4 w-4 text-[var(--success-500)]" />
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
					<div className="rounded-xl border border-[var(--ink-800)]/50 bg-[var(--ink-900)]/30 p-6">
						<h3 className="text-sm font-semibold text-[var(--ink-200)] mb-1">
							Ready to Import
						</h3>
						<p className="text-sm text-[var(--ink-500)] mb-4">
							File: {state.file.name} ({(state.file.size / 1024).toFixed(1)} KB)
						</p>
						<div className="flex items-center gap-4">
							<Button
								onClick={handleImport}
								disabled={isLoading}
								className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)]"
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
								className="text-[var(--ink-400)] hover:text-[var(--ink-200)]"
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
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent-500)] to-[var(--accent-700)] flex items-center justify-center">
						<Loader2 className="h-10 w-10 text-white animate-spin" />
					</div>
					<h2 className="heading-display text-xl text-[var(--ink-100)] mb-2">
						Importing Opportunities
					</h2>
					<p className="text-[var(--ink-500)]">
						Please wait while we process your spreadsheet...
					</p>
				</div>
			)}

			{/* Complete Step */}
			{state.step === "complete" && state.results && (
				<div className="space-y-6">
					<div className="rounded-xl border border-[var(--ink-800)]/50 bg-[var(--ink-900)]/30 p-6">
						<div className="w-12 h-12 rounded-full bg-[var(--success-500)]/20 flex items-center justify-center mb-4">
							<Check className="h-6 w-6 text-[var(--success-500)]" />
						</div>
						<h3 className="heading-display text-lg text-[var(--ink-100)] mb-1">
							Import Complete!
						</h3>
						<p className="text-sm text-[var(--ink-500)] mb-6">
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
								<Button className="bg-[var(--accent-500)] hover:bg-[var(--accent-400)] text-[var(--ink-950)]">
									View Opportunities
								</Button>
							</Link>
							<Button
								variant="ghost"
								onClick={handleReset}
								className="text-[var(--ink-400)] hover:text-[var(--ink-200)]"
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
				<div className="mt-8 rounded-xl border border-[var(--ink-800)]/50 bg-[var(--ink-900)]/30 p-6">
					<h3 className="text-sm font-semibold text-[var(--ink-200)] mb-4">
						Recent Imports
					</h3>
					<div className="space-y-3">
						{importHistory.map((imp) => (
							<div
								key={imp.id}
								className="flex items-center justify-between py-2 border-b border-[var(--ink-800)]/50 last:border-0"
							>
								<div className="flex items-center gap-3">
									<FileText className="h-4 w-4 text-[var(--ink-500)]" />
									<div>
										<p className="text-sm font-medium text-[var(--ink-200)]">
											{imp.filename}
										</p>
										<p className="text-xs text-[var(--ink-500)]">
											{new Date(imp.startedAt).toLocaleDateString()} ·{" "}
											{imp.importedRecords} imported, {imp.updatedRecords} updated
										</p>
									</div>
								</div>
								<span
									className={cn(
										"px-2 py-0.5 text-xs font-medium rounded-full",
										imp.status === "completed"
											? "bg-[var(--success-500)]/20 text-[var(--success-500)]"
											: imp.status === "failed"
											? "bg-[var(--error-500)]/20 text-[var(--error-500)]"
											: "bg-[var(--ink-700)] text-[var(--ink-400)]"
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
		success: "text-[var(--success-500)]",
		error: "text-[var(--error-500)]",
		info: "text-[var(--info-500)]",
	};

	return (
		<div className="text-center p-4 rounded-xl bg-[var(--ink-800)]/30">
			<div
				className={cn(
					"text-2xl font-bold tabular-nums",
					color ? colorClasses[color] : "text-[var(--ink-200)]"
				)}
			>
				{value}
			</div>
			<div className="text-xs text-[var(--ink-500)] mt-1">{label}</div>
		</div>
	);
}
