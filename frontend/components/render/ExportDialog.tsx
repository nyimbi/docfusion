/**
 * ExportDialog Component - DocFusion
 *
 * Dialog for exporting documents to various formats (PDF, DOCX, PPTX, etc.)
 * with branding and formatting options.
 */

"use client";

import { useState, useTransition } from "react";
import type {
	ExportFormat,
	RenderOptions,
	RenderResult,
	BrandingConfig,
	PaperSize,
	PageOrientation,
} from "@/lib/types/opportunity";
import { renderDocument, getBrandingConfigs } from "@/lib/actions/document-render";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface ExportDialogProps {
	documentId: string;
	documentTitle: string;
	open: boolean;
	onClose: () => void;
	onExportComplete?: (result: RenderResult) => void;
}

// ============================================================================
// Constants
// ============================================================================

const FORMATS: { value: ExportFormat; label: string; icon: typeof PdfIcon; description: string }[] = [
	{
		value: "pdf",
		label: "PDF",
		icon: PdfIcon,
		description: "Professional PDF document via LaTeX",
	},
	{
		value: "docx",
		label: "Word",
		icon: DocxIcon,
		description: "Microsoft Word document",
	},
	{
		value: "pptx",
		label: "PowerPoint",
		icon: PptxIcon,
		description: "Presentation slides",
	},
	{
		value: "latex",
		label: "LaTeX",
		icon: LatexIcon,
		description: "LaTeX source file",
	},
	{
		value: "markdown",
		label: "Markdown",
		icon: MarkdownIcon,
		description: "Markdown text file",
	},
	{
		value: "html",
		label: "HTML",
		icon: HtmlIcon,
		description: "Web page format",
	},
];

const PAPER_SIZES: { value: PaperSize; label: string }[] = [
	{ value: "letter", label: "US Letter" },
	{ value: "a4", label: "A4" },
	{ value: "legal", label: "Legal" },
];

const SLIDE_TEMPLATES = [
	{ value: "default", label: "Default", description: "Standard presentation style" },
	{ value: "executive", label: "Executive", description: "Formal, professional style" },
	{ value: "technical", label: "Technical", description: "Detailed, data-focused" },
	{ value: "minimal", label: "Minimal", description: "Clean, simple design" },
];

// ============================================================================
// Main Component
// ============================================================================

export function ExportDialog({
	documentId,
	documentTitle,
	open,
	onClose,
	onExportComplete,
}: ExportDialogProps) {
	// State
	const [format, setFormat] = useState<ExportFormat>("pdf");
	const [paperSize, setPaperSize] = useState<PaperSize>("letter");
	const [orientation, setOrientation] = useState<PageOrientation>("portrait");
	const [includeToc, setIncludeToc] = useState(false);
	const [includePageNumbers, setIncludePageNumbers] = useState(true);
	const [includeHeader, setIncludeHeader] = useState(true);
	const [includeFooter, setIncludeFooter] = useState(true);
	const [watermark, setWatermark] = useState("");
	const [slideTemplate, setSlideTemplate] = useState<string>("default");
	const [selectedBranding, setSelectedBranding] = useState<string>("default");
	const [brandingConfigs, setBrandingConfigs] = useState<BrandingConfig[]>([]);
	const [result, setResult] = useState<RenderResult | null>(null);
	const [isPending, startTransition] = useTransition();

	// Load branding configs on mount
	useState(() => {
		getBrandingConfigs().then(setBrandingConfigs);
	});

	const handleExport = () => {
		const branding = brandingConfigs.find((b) => b.id === selectedBranding);

		const options: RenderOptions = {
			format,
			paperSize,
			orientation,
			branding,
			includeTableOfContents: includeToc,
			includePageNumbers,
			includeHeader,
			includeFooter,
			watermark: watermark || undefined,
			slideTemplate: slideTemplate as RenderOptions["slideTemplate"],
			metadata: {
				title: documentTitle,
				createdDate: new Date(),
			},
		};

		startTransition(async () => {
			const exportResult = await renderDocument(documentId, options);
			setResult(exportResult);

			if (exportResult.success && exportResult.data) {
				// Trigger download
				downloadFile(exportResult);
			}

			onExportComplete?.(exportResult);
		});
	};

	const downloadFile = (result: RenderResult) => {
		if (!result.data || !result.mimeType || !result.filename) return;

		const byteCharacters = atob(result.data);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], { type: result.mimeType });

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = result.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleClose = () => {
		setResult(null);
		onClose();
	};

	if (!open) return null;

	const showDocumentOptions = ["pdf", "docx", "latex", "html"].includes(format);
	const showSlideOptions = format === "pptx";

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0"
				onClick={handleClose}
				aria-hidden="true"
			/>

			{/* Dialog */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="export-dialog-title"
				className={cn(
					"fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
					"w-full max-w-2xl max-h-[90vh]",
					"bg-[var(--background)] rounded-lg shadow-xl",
					"animate-in fade-in-0 zoom-in-95",
					"flex flex-col"
				)}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 py-4 border-b border-[var(--border)]">
					<div className="flex items-center justify-between">
						<div>
							<h2
								id="export-dialog-title"
								className="text-lg font-semibold text-[var(--foreground)]"
							>
								Export Document
							</h2>
							<p className="text-sm text-[var(--foreground-muted)] mt-0.5">
								{documentTitle}
							</p>
						</div>
						<button
							onClick={handleClose}
							className="p-2 rounded-lg hover:bg-[var(--background-muted)] transition-colors"
							aria-label="Close"
						>
							<CloseIcon className="h-5 w-5 text-[var(--foreground-muted)]" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* Format Selection */}
					<div>
						<label className="block text-sm font-medium text-[var(--foreground)] mb-3">
							Export Format
						</label>
						<div className="grid grid-cols-3 gap-2">
							{FORMATS.map(({ value, label, icon: Icon, description }) => (
								<button
									key={value}
									onClick={() => setFormat(value)}
									className={cn(
										"flex flex-col items-center p-3 rounded-lg border text-center transition-all",
										format === value
											? "border-[var(--accent-500)] bg-[var(--accent-50)] dark:bg-[var(--accent-950)]"
											: "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--background-muted)]"
									)}
								>
									<Icon
										className={cn(
											"h-8 w-8 mb-2",
											format === value
												? "text-[var(--accent-600)]"
												: "text-[var(--foreground-muted)]"
										)}
									/>
									<span className="text-sm font-medium text-[var(--foreground)]">
										{label}
									</span>
									<span className="text-xs text-[var(--foreground-muted)] mt-0.5">
										{description}
									</span>
								</button>
							))}
						</div>
					</div>

					{/* Document Options */}
					{showDocumentOptions && (
						<div className="space-y-4">
							<h3 className="text-sm font-medium text-[var(--foreground)]">
								Page Settings
							</h3>

							{/* Paper Size & Orientation */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs text-[var(--foreground-muted)] mb-1.5">
										Paper Size
									</label>
									<select
										value={paperSize}
										onChange={(e) => setPaperSize(e.target.value as PaperSize)}
										className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
									>
										{PAPER_SIZES.map(({ value, label }) => (
											<option key={value} value={value}>
												{label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-[var(--foreground-muted)] mb-1.5">
										Orientation
									</label>
									<div className="flex gap-2">
										<button
											onClick={() => setOrientation("portrait")}
											className={cn(
												"flex-1 px-3 py-2 text-sm rounded-lg border transition-colors",
												orientation === "portrait"
													? "border-[var(--accent-500)] bg-[var(--accent-50)] text-[var(--accent-600)]"
													: "border-[var(--border)] hover:bg-[var(--background-muted)]"
											)}
										>
											Portrait
										</button>
										<button
											onClick={() => setOrientation("landscape")}
											className={cn(
												"flex-1 px-3 py-2 text-sm rounded-lg border transition-colors",
												orientation === "landscape"
													? "border-[var(--accent-500)] bg-[var(--accent-50)] text-[var(--accent-600)]"
													: "border-[var(--border)] hover:bg-[var(--background-muted)]"
											)}
										>
											Landscape
										</button>
									</div>
								</div>
							</div>

							{/* Toggles */}
							<div className="grid grid-cols-2 gap-3">
								<ToggleOption
									label="Table of Contents"
									checked={includeToc}
									onChange={setIncludeToc}
								/>
								<ToggleOption
									label="Page Numbers"
									checked={includePageNumbers}
									onChange={setIncludePageNumbers}
								/>
								<ToggleOption
									label="Header"
									checked={includeHeader}
									onChange={setIncludeHeader}
								/>
								<ToggleOption
									label="Footer"
									checked={includeFooter}
									onChange={setIncludeFooter}
								/>
							</div>

							{/* Watermark */}
							<div>
								<label className="block text-xs text-[var(--foreground-muted)] mb-1.5">
									Watermark (optional)
								</label>
								<input
									type="text"
									value={watermark}
									onChange={(e) => setWatermark(e.target.value)}
									placeholder="e.g., DRAFT, CONFIDENTIAL"
									className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
								/>
							</div>
						</div>
					)}

					{/* Slide Options */}
					{showSlideOptions && (
						<div>
							<label className="block text-sm font-medium text-[var(--foreground)] mb-3">
								Slide Template
							</label>
							<div className="grid grid-cols-2 gap-2">
								{SLIDE_TEMPLATES.map(({ value, label, description }) => (
									<button
										key={value}
										onClick={() => setSlideTemplate(value)}
										className={cn(
											"flex flex-col items-start p-3 rounded-lg border text-left transition-all",
											slideTemplate === value
												? "border-[var(--accent-500)] bg-[var(--accent-50)] dark:bg-[var(--accent-950)]"
												: "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--background-muted)]"
										)}
									>
										<span className="text-sm font-medium text-[var(--foreground)]">
											{label}
										</span>
										<span className="text-xs text-[var(--foreground-muted)] mt-0.5">
											{description}
										</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Branding */}
					{brandingConfigs.length > 0 && (
						<div>
							<label className="block text-sm font-medium text-[var(--foreground)] mb-3">
								Branding
							</label>
							<div className="flex gap-2">
								{brandingConfigs.map((config) => (
									<button
										key={config.id}
										onClick={() => setSelectedBranding(config.id)}
										className={cn(
											"flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
											selectedBranding === config.id
												? "border-[var(--accent-500)] bg-[var(--accent-50)]"
												: "border-[var(--border)] hover:bg-[var(--background-muted)]"
										)}
									>
										<span
											className="w-4 h-4 rounded-full"
											style={{ backgroundColor: config.primaryColor }}
										/>
										<span className="text-sm">{config.name}</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Result */}
					{result && (
						<div
							className={cn(
								"p-4 rounded-lg",
								result.success
									? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
									: "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
							)}
						>
							{result.success ? (
								<div className="flex items-center gap-3">
									<CheckIcon className="h-5 w-5 text-green-500" />
									<div>
										<p className="text-sm font-medium text-green-700 dark:text-green-300">
											Export successful!
										</p>
										<p className="text-xs text-green-600 dark:text-green-400">
											{result.filename} ({formatFileSize(result.size || 0)})
											{result.renderTimeMs && ` - ${result.renderTimeMs}ms`}
										</p>
									</div>
								</div>
							) : (
								<div className="flex items-center gap-3">
									<ErrorIcon className="h-5 w-5 text-red-500" />
									<div>
										<p className="text-sm font-medium text-red-700 dark:text-red-300">
											Export failed
										</p>
										<p className="text-xs text-red-600 dark:text-red-400">
											{result.error}
										</p>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
					<Button variant="ghost" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleExport}
						disabled={isPending}
						isLoading={isPending}
					>
						{isPending ? "Exporting..." : `Export as ${format.toUpperCase()}`}
					</Button>
				</div>
			</div>
		</>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ToggleOption({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex items-center gap-2 cursor-pointer">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent-500)] focus:ring-[var(--ring)]"
			/>
			<span className="text-sm text-[var(--foreground)]">{label}</span>
		</label>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Icons
// ============================================================================

function CloseIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
		</svg>
	);
}

function ErrorIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}

function PdfIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-4.75 7.75h1.5v-1.5h-1.5v1.5zm3.5 0h1.5v-1.5h-1.5v1.5z" />
		</svg>
	);
}

function DocxIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v1H8v-1zm0 3h8v1H8v-1z" />
		</svg>
	);
}

function PptxIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H6v-2h6v2zm4-4H6v-2h10v2zm0-4H6V7h10v2z" />
		</svg>
	);
}

function LatexIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M5 3h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm2 4v2h10V7H7zm0 4v2h8v-2H7zm0 4v2h10v-2H7z" />
		</svg>
	);
}

function MarkdownIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19V11.5l1.44 1.8 1.44-1.8v3.69h1.44V8.81H9.69l-1.44 1.8-1.44-1.8H5.37v6.38h1.44zm8.63-2.88l-2.16 2.88h1.44v-3.84h1.44v3.84h1.44l-2.16-2.88z" />
		</svg>
	);
}

function HtmlIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M4.5 3l1.41 15.09L12 21l6.09-2.91L19.5 3h-15zM17.28 7.37H8.19l.19 2.08h8.6l-.57 6.4-4.41 1.2-4.41-1.2-.28-3.18h2.04l.14 1.6 2.51.67 2.51-.67.27-2.94H7.76l-.57-6.04h9.7l-.11 2.08z" />
		</svg>
	);
}
