/**
 * CreateProposalDialog Component - DocFusion
 *
 * Dialog for creating new proposal documents with document type selection,
 * optional template, deadline, and assignment.
 */

"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
	ProposalDocument,
	ProposalDocumentType,
} from "@/lib/types/opportunity";
import {
	createProposalDocument,
	createStandardProposalSet,
} from "@/lib/actions/proposal-documents";
import { getDocumentTypeLabel } from "@/lib/utils/proposal-labels";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// Validation schema for single document creation
const proposalDocumentSchema = z.object({
	documentType: z.enum([
		"cover_letter",
		"executive_summary",
		"technical_approach",
		"management_plan",
		"staffing_plan",
		"past_performance",
		"cost_proposal",
		"quality_assurance",
		"risk_mitigation",
		"appendix",
		"other",
	]),
	title: z.string().max(500, "Title must be 500 characters or less").optional(),
	assignedTo: z
		.string()
		.max(200, "Assignee must be 200 characters or less")
		.optional(),
	dueDate: z.string().optional(),
});

type ProposalDocumentFormValues = z.infer<typeof proposalDocumentSchema>;

interface CreateProposalDialogProps {
	opportunityId: string;
	open: boolean;
	onClose: () => void;
	onCreated: (documents: ProposalDocument[]) => void;
}

type Mode = "single" | "standard";

const DOCUMENT_TYPES: { type: ProposalDocumentType; description: string }[] = [
	{ type: "cover_letter", description: "Introductory letter to the evaluators" },
	{ type: "executive_summary", description: "High-level overview of the proposal" },
	{ type: "technical_approach", description: "Detailed technical solution and methodology" },
	{ type: "management_plan", description: "Project management and governance approach" },
	{ type: "staffing_plan", description: "Team composition and key personnel" },
	{ type: "past_performance", description: "Relevant experience and references" },
	{ type: "cost_proposal", description: "Pricing and cost breakdown" },
	{ type: "quality_assurance", description: "Quality control processes" },
	{ type: "risk_mitigation", description: "Risk identification and mitigation strategies" },
	{ type: "appendix", description: "Supporting documents and attachments" },
	{ type: "other", description: "Custom document type" },
];

const STANDARD_SET: ProposalDocumentType[] = [
	"cover_letter",
	"executive_summary",
	"technical_approach",
	"management_plan",
	"staffing_plan",
	"past_performance",
	"cost_proposal",
];

export function CreateProposalDialog({
	opportunityId,
	open,
	onClose,
	onCreated,
}: CreateProposalDialogProps) {
	const [mode, setMode] = useState<Mode>("single");
	const [isPending, startTransition] = useTransition();

	const {
		register,
		handleSubmit: handleFormSubmit,
		setValue,
		watch,
		formState: { errors },
		reset,
	} = useForm<ProposalDocumentFormValues>({
		resolver: zodResolver(proposalDocumentSchema),
		defaultValues: {
			documentType: undefined,
			title: "",
			assignedTo: "",
			dueDate: "",
		},
	});

	const selectedType = watch("documentType") ?? null;

	const handleCreateSingle = (data: ProposalDocumentFormValues) => {
		startTransition(async () => {
			try {
				const doc = await createProposalDocument({
					opportunityId,
					documentType: data.documentType,
					title: data.title || undefined,
					assignedTo: data.assignedTo || undefined,
					dueDate: data.dueDate || undefined,
				});
				onCreated([doc]);
				handleReset();
			} catch (error) {
				console.error("Failed to create document:", error);
			}
		});
	};

	const handleCreateStandardSet = () => {
		startTransition(async () => {
			try {
				const docs = await createStandardProposalSet(opportunityId, STANDARD_SET);
				onCreated(docs);
				handleReset();
			} catch (error) {
				console.error("Failed to create standard set:", error);
			}
		});
	};

	const handleReset = () => {
		setMode("single");
		reset();
		onClose();
	};

	if (!open) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0"
				onClick={handleReset}
				aria-hidden="true"
			/>

			{/* Dialog */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="create-dialog-title"
				className={cn(
					"fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
					"w-full max-w-2xl max-h-[90vh]",
					"bg-[var(--background)] rounded-lg shadow-xl",
					"animate-in fade-in-0 zoom-in-95",
					"flex flex-col"
				)}
			>
				{/* Header */}
				<div className="px-6 py-4 border-b border-[var(--border)]">
					<div className="flex items-center justify-between">
						<div>
							<h2
								id="create-dialog-title"
								className="text-lg font-semibold text-[var(--foreground)]"
							>
								Add Proposal Document
							</h2>
							<p className="text-sm text-[var(--foreground-muted)] mt-0.5">
								Create a new document or add a standard set
							</p>
						</div>
						<button
							onClick={handleReset}
							className="p-2 rounded-lg hover:bg-[var(--background-muted)] transition-colors"
							aria-label="Close"
						>
							<CloseIcon className="h-5 w-5 text-[var(--foreground-muted)]" />
						</button>
					</div>

					{/* Mode Tabs */}
					<div className="flex gap-1 mt-4 p-1 bg-[var(--background-muted)] rounded-lg w-fit">
						<button
							onClick={() => setMode("single")}
							className={cn(
								"px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
								mode === "single"
									? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
									: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
							)}
						>
							Single Document
						</button>
						<button
							onClick={() => setMode("standard")}
							className={cn(
								"px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
								mode === "standard"
									? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
									: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
							)}
						>
							Standard Set
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					{mode === "single" ? (
						<form id="create-proposal-form" onSubmit={handleFormSubmit(handleCreateSingle)} className="space-y-6">
							{/* Document Type Selection */}
							<div>
								<span className="block text-sm font-medium text-[var(--foreground)] mb-3">
									Document Type <span className="text-red-500">*</span>
								</span>
								<div className="grid grid-cols-2 gap-2">
									{DOCUMENT_TYPES.map(({ type, description }) => (
										<button
											key={type}
											type="button"
											onClick={() => {
												setValue("documentType", type, { shouldValidate: true });
											}}
											className={cn(
												"flex flex-col items-start p-3 rounded-lg border text-left transition-all",
												selectedType === type
													? "border-[var(--accent-500)] bg-[var(--accent-50)] dark:bg-[var(--accent-950)]"
													: "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--background-muted)]"
											)}
										>
											<span className="text-sm font-medium text-[var(--foreground)]">
												{getDocumentTypeLabel(type)}
											</span>
											<span className="text-xs text-[var(--foreground-muted)] mt-0.5 line-clamp-1">
												{description}
											</span>
										</button>
									))}
								</div>
								{errors.documentType && (
									<p className="text-sm text-red-500 mt-2">{errors.documentType.message}</p>
								)}
							</div>

							{/* Optional Fields */}
							{selectedType && (
								<div className="space-y-4 pt-4 border-t border-[var(--border)]">
									{/* Custom Title */}
									<div>
										<span className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
											Custom Title (optional)
										</span>
										<input
											type="text"
											{...register("title")}
											placeholder={`${getDocumentTypeLabel(selectedType)} - Draft`}
											className={cn(
												"w-full px-3 py-2 text-sm border rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
												errors.title ? "border-red-500" : "border-[var(--border)]"
											)}
										 aria-label="Custom Title (optional)"/>
										{errors.title && (
											<p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
										)}
									</div>

									{/* Due Date */}
									<div>
										<span className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
											Due Date (optional)
										</span>
										<input
											type="date"
											{...register("dueDate")}
											className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
										 aria-label="Due Date (optional)"/>
									</div>

									{/* Assigned To */}
									<div>
										<span className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
											Assign To (optional)
										</span>
										<input
											type="text"
											{...register("assignedTo")}
											placeholder="Enter username or email"
											className={cn(
												"w-full px-3 py-2 text-sm border rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
												errors.assignedTo ? "border-red-500" : "border-[var(--border)]"
											)}
										 aria-label="Assign To (optional)"/>
										{errors.assignedTo && (
											<p className="text-sm text-red-500 mt-1">{errors.assignedTo.message}</p>
										)}
									</div>
								</div>
							)}
						</form>
					) : (
						<div className="space-y-6">
							<div className="bg-[var(--background-muted)] rounded-lg p-4">
								<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
									Standard Proposal Set
								</h4>
								<p className="text-sm text-[var(--foreground-muted)] mb-4">
									Create all standard proposal documents at once. This includes:
								</p>
								<ul className="space-y-2">
									{STANDARD_SET.map((type) => (
										<li key={type} className="flex items-center gap-2 text-sm">
											<CheckIcon className="h-4 w-4 text-green-500" />
											<span className="text-[var(--foreground)]">
												{getDocumentTypeLabel(type)}
											</span>
										</li>
									))}
								</ul>
							</div>

							<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
								<div className="flex gap-3">
									<InfoIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
									<div>
										<h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
											Quick Start
										</h4>
										<p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
											The standard set covers the most common proposal sections. You can
											add or remove documents later as needed.
										</p>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
					<Button variant="ghost" onClick={handleReset}>
						Cancel
					</Button>
					{mode === "single" ? (
						<Button
							variant="primary"
							type="submit"
							form="create-proposal-form"
							disabled={isPending}
							isLoading={isPending}
						>
							Create Document
						</Button>
					) : (
						<Button
							variant="primary"
							onClick={handleCreateStandardSet}
							disabled={isPending}
							isLoading={isPending}
						>
							Create {STANDARD_SET.length} Documents
						</Button>
					)}
				</div>
			</div>
		</>
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

function InfoIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}
