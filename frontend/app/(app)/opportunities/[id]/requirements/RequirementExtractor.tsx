/**
 * RequirementExtractor Component - DocFusion
 *
 * Dialog for uploading RFP documents and extracting requirements using AI.
 * Features paste/upload support, preview of extracted requirements, and
 * confirmation before saving to database.
 */

"use client";

import { useState, useTransition, useRef } from "react";
import type { Requirement, ExtractedRequirement, ExtractionResult } from "@/lib/types/opportunity";
import { extractRequirements, saveExtractedRequirements } from "@/lib/actions/requirements";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface RequirementExtractorProps {
	opportunityId: string;
	open: boolean;
	onClose: () => void;
	onExtracted: (requirements: Requirement[]) => void;
}

type Step = "input" | "preview" | "saving";

export function RequirementExtractor({
	opportunityId,
	open,
	onClose,
	onExtracted,
}: RequirementExtractorProps) {
	const [step, setStep] = useState<Step>("input");
	const [content, setContent] = useState("");
	const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
	const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
	const [isPending, startTransition] = useTransition();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleExtract = () => {
		if (!content.trim()) return;

		startTransition(async () => {
			try {
				const result = await extractRequirements(opportunityId, content);
				setExtractionResult(result);
				// Select all by default
				setSelectedIndices(new Set(result.requirements.map((_, i) => i)));
				setStep("preview");
			} catch (error) {
				console.error("Extraction failed:", error);
			}
		});
	};

	const handleSave = () => {
		if (!extractionResult) return;

		const selectedRequirements = extractionResult.requirements.filter(
			(_, i) => selectedIndices.has(i)
		);

		if (selectedRequirements.length === 0) return;

		startTransition(async () => {
			try {
				setStep("saving");
				const saved = await saveExtractedRequirements(opportunityId, selectedRequirements);
				onExtracted(saved);
				handleReset();
			} catch (error) {
				console.error("Save failed:", error);
				setStep("preview");
			}
		});
	};

	const handleReset = () => {
		setStep("input");
		setContent("");
		setExtractionResult(null);
		setSelectedIndices(new Set());
	};

	const handleClose = () => {
		handleReset();
		onClose();
	};

	const toggleSelection = (index: number) => {
		const newSelected = new Set(selectedIndices);
		if (newSelected.has(index)) {
			newSelected.delete(index);
		} else {
			newSelected.add(index);
		}
		setSelectedIndices(newSelected);
	};

	const selectAll = () => {
		if (extractionResult) {
			setSelectedIndices(new Set(extractionResult.requirements.map((_, i) => i)));
		}
	};

	const selectNone = () => {
		setSelectedIndices(new Set());
	};

	if (!open) return null;

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
				aria-labelledby="extractor-title"
				className={cn(
					"fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
					"w-full max-w-3xl max-h-[90vh]",
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
							<h2 id="extractor-title" className="text-lg font-semibold text-[var(--foreground)]">
								{step === "input" && "Extract Requirements"}
								{step === "preview" && "Review Extracted Requirements"}
								{step === "saving" && "Saving Requirements..."}
							</h2>
							<p className="text-sm text-[var(--foreground-muted)] mt-0.5">
								{step === "input" && "Paste or type RFP content to extract requirements"}
								{step === "preview" &&
									`${extractionResult?.requirements.length ?? 0} requirements found • ${selectedIndices.size} selected`}
								{step === "saving" && "Please wait while we save your requirements"}
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

					{/* Progress Steps */}
					<div className="flex items-center gap-2 mt-4">
						<StepIndicator step={1} currentStep={step === "input" ? 1 : step === "preview" ? 2 : 3} label="Input" />
						<div className="flex-1 h-0.5 bg-[var(--border)]" />
						<StepIndicator step={2} currentStep={step === "input" ? 1 : step === "preview" ? 2 : 3} label="Review" />
						<div className="flex-1 h-0.5 bg-[var(--border)]" />
						<StepIndicator step={3} currentStep={step === "input" ? 1 : step === "preview" ? 2 : 3} label="Save" />
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					{step === "input" && (
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-[var(--foreground)] mb-2">
									RFP Content
								</label>
								<textarea
									ref={textareaRef}
									value={content}
									onChange={(e) => setContent(e.target.value)}
									placeholder="Paste the RFP document text here, or type/paste specific sections containing requirements...

Example:
3.1 Technical Requirements
The contractor shall provide the following:
- Must have 5+ years experience in cloud infrastructure
- System must support 99.9% uptime SLA
- Should integrate with existing Active Directory"
									rows={16}
									className="w-full px-4 py-3 text-sm font-mono border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
								/>
								<p className="text-xs text-[var(--foreground-muted)] mt-2">
									{content.length} characters • Supports plain text from PDFs, Word docs, or web pages
								</p>
							</div>

							<div className="bg-[var(--background-muted)] rounded-lg p-4">
								<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Tips for better extraction:</h4>
								<ul className="text-xs text-[var(--foreground-muted)] space-y-1">
									<li>• Include section headers (e.g., "Technical Requirements", "Legal Requirements")</li>
									<li>• Keep numbered lists and bullet points intact</li>
									<li>• Include key phrases like "must", "shall", "required", "should"</li>
									<li>• More context helps identify requirement priorities</li>
								</ul>
							</div>
						</div>
					)}

					{step === "preview" && extractionResult && (
						<div className="space-y-4">
							{/* Extraction Info */}
							<div className="flex items-center justify-between text-sm">
								<div className="flex items-center gap-4">
									<span className="text-[var(--foreground-muted)]">
										Confidence: {Math.round(extractionResult.confidence * 100)}%
									</span>
									<span className="text-[var(--foreground-muted)]">
										Processing time: {extractionResult.processingTime}ms
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Button variant="ghost" size="sm" onClick={selectAll}>
										Select All
									</Button>
									<Button variant="ghost" size="sm" onClick={selectNone}>
										Select None
									</Button>
								</div>
							</div>

							{/* Requirements List */}
							<div className="space-y-2 max-h-[400px] overflow-y-auto">
								{extractionResult.requirements.map((req, index) => (
									<ExtractedRequirementRow
										key={index}
										requirement={req}
										index={index}
										isSelected={selectedIndices.has(index)}
										onToggle={() => toggleSelection(index)}
									/>
								))}
							</div>

							{extractionResult.requirements.length === 0 && (
								<div className="text-center py-12">
									<p className="text-[var(--foreground-muted)]">
										No requirements could be extracted from the provided text.
									</p>
									<p className="text-sm text-[var(--foreground-muted)] mt-1">
										Try including more structured content with requirement keywords.
									</p>
								</div>
							)}
						</div>
					)}

					{step === "saving" && (
						<div className="flex flex-col items-center justify-center py-16">
							<LoadingSpinner className="h-8 w-8 text-[var(--accent-500)]" />
							<p className="text-[var(--foreground-muted)] mt-4">
								Saving {selectedIndices.size} requirements...
							</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
					{step === "input" && (
						<>
							<Button variant="ghost" onClick={handleClose}>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={handleExtract}
								disabled={!content.trim() || isPending}
								isLoading={isPending}
							>
								Extract Requirements
							</Button>
						</>
					)}

					{step === "preview" && (
						<>
							<Button variant="ghost" onClick={() => setStep("input")}>
								Back
							</Button>
							<Button
								variant="primary"
								onClick={handleSave}
								disabled={selectedIndices.size === 0 || isPending}
								isLoading={isPending}
							>
								Save {selectedIndices.size} Requirement{selectedIndices.size !== 1 ? "s" : ""}
							</Button>
						</>
					)}

					{step === "saving" && (
						<>
							<div />
							<Button variant="ghost" disabled>
								Please wait...
							</Button>
						</>
					)}
				</div>
			</div>
		</>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StepIndicator({
	step,
	currentStep,
	label,
}: {
	step: number;
	currentStep: number;
	label: string;
}) {
	const isComplete = currentStep > step;
	const isCurrent = currentStep === step;

	return (
		<div className="flex items-center gap-2">
			<div
				className={cn(
					"h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
					isComplete && "bg-green-500 text-white",
					isCurrent && "bg-[var(--accent-500)] text-white",
					!isComplete && !isCurrent && "bg-[var(--background-muted)] text-[var(--foreground-muted)]"
				)}
			>
				{isComplete ? <CheckIcon className="h-3 w-3" /> : step}
			</div>
			<span
				className={cn(
					"text-xs",
					isCurrent ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"
				)}
			>
				{label}
			</span>
		</div>
	);
}

function ExtractedRequirementRow({
	requirement,
	index,
	isSelected,
	onToggle,
}: {
	requirement: ExtractedRequirement;
	index: number;
	isSelected: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			className={cn(
				"flex gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
				isSelected
					? "border-[var(--accent-500)] bg-[var(--accent-50)] dark:bg-[var(--accent-950)]"
					: "border-[var(--border)] hover:bg-[var(--background-muted)]"
			)}
			onClick={onToggle}
		>
			<Checkbox checked={isSelected} onCheckedChange={onToggle} />
			<div className="flex-1 min-w-0">
				<p className="text-sm text-[var(--foreground)] line-clamp-2">{requirement.text}</p>
				<div className="flex items-center gap-2 mt-1.5 flex-wrap">
					{requirement.category && (
						<span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 capitalize">
							{requirement.category}
						</span>
					)}
					{requirement.priority && (
						<span
							className={cn(
								"px-1.5 py-0.5 text-[10px] font-medium rounded capitalize",
								requirement.priority === "mandatory"
									? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
									: requirement.priority === "preferred"
									? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
									: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
							)}
						>
							{requirement.priority}
						</span>
					)}
					{requirement.suggestedRiskLevel && (
						<span
							className={cn(
								"px-1.5 py-0.5 text-[10px] font-medium rounded capitalize",
								requirement.suggestedRiskLevel === "critical"
									? "bg-red-100 text-red-700"
									: requirement.suggestedRiskLevel === "high"
									? "bg-orange-100 text-orange-700"
									: requirement.suggestedRiskLevel === "medium"
									? "bg-yellow-100 text-yellow-700"
									: "bg-green-100 text-green-700"
							)}
						>
							{requirement.suggestedRiskLevel} risk
						</span>
					)}
				</div>
			</div>
		</div>
	);
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

function LoadingSpinner({ className }: { className?: string }) {
	return (
		<svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	);
}
