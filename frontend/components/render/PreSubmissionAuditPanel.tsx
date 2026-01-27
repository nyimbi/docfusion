/**
 * PreSubmissionAuditPanel Component - DocFusion
 *
 * Displays pre-submission audit results showing readiness status,
 * document checks, and recommendations.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PreSubmissionAudit, AuditCheck } from "@/lib/types/opportunity";
import { preSubmissionAudit } from "@/lib/actions/document-render";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PreSubmissionAuditPanelProps {
	opportunityId: string;
	opportunityTitle: string;
	initialAudit?: PreSubmissionAudit | null;
	onAuditComplete?: (audit: PreSubmissionAudit) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function PreSubmissionAuditPanel({
	opportunityId,
	opportunityTitle,
	initialAudit,
	onAuditComplete,
}: PreSubmissionAuditPanelProps) {
	const [audit, setAudit] = useState<PreSubmissionAudit | null>(initialAudit || null);
	const [isPending, startTransition] = useTransition();

	const handleRunAudit = () => {
		startTransition(async () => {
			const result = await preSubmissionAudit(opportunityId);
			setAudit(result);
			onAuditComplete?.(result);
		});
	};

	return (
		<div className="bg-[var(--background)] border border-[var(--border)] rounded-lg">
			{/* Header */}
			<div className="px-4 py-3 border-b border-[var(--border)]">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-[var(--foreground)]">
							Pre-Submission Audit
						</h3>
						<p className="text-sm text-[var(--foreground-muted)]">
							{opportunityTitle}
						</p>
					</div>
					<Button
						variant="secondary"
						size="sm"
						onClick={handleRunAudit}
						disabled={isPending}
						isLoading={isPending}
					>
						{audit ? "Re-run Audit" : "Run Audit"}
					</Button>
				</div>
			</div>

			{/* Content */}
			{audit ? (
				<div className="p-4 space-y-6">
					{/* Readiness Score */}
					<div className="flex items-center gap-4">
						<ReadinessGauge score={audit.readinessScore} isReady={audit.isReady} />
						<div>
							<h4 className="text-lg font-semibold text-[var(--foreground)]">
								{audit.isReady ? "Ready for Submission" : "Not Ready"}
							</h4>
							<p className="text-sm text-[var(--foreground-muted)]">
								{audit.readinessScore}% readiness score
							</p>
							{audit.auditedAt && (
								<p className="text-xs text-[var(--foreground-muted)] mt-1">
									Last audited: {new Date(audit.auditedAt).toLocaleString()}
								</p>
							)}
						</div>
					</div>

					{/* Issues */}
					{audit.issues.length > 0 && (
						<div>
							<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
								Issues ({audit.issues.length})
							</h4>
							<ul className="space-y-1">
								{audit.issues.map((issue, i) => (
									<li key={i} className="flex items-start gap-2 text-sm">
										<ErrorIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
										<span className="text-[var(--foreground-muted)]">{issue}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Missing Documents */}
					{audit.missingDocuments.length > 0 && (
						<div>
							<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
								Missing Documents
							</h4>
							<div className="flex flex-wrap gap-2">
								{audit.missingDocuments.map((type) => (
									<span
										key={type}
										className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
									>
										{formatDocumentType(type)}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Document Status */}
					{audit.documents.length > 0 && (
						<div>
							<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
								Documents ({audit.documents.length})
							</h4>
							<div className="space-y-2">
								{audit.documents.map((doc) => (
									<DocumentStatusRow key={doc.id} document={doc} />
								))}
							</div>
						</div>
					)}

					{/* Checks */}
					{audit.checks.length > 0 && (
						<div>
							<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
								Audit Checks
							</h4>
							<div className="space-y-1">
								{audit.checks.map((check) => (
									<CheckRow key={check.id} check={check} />
								))}
							</div>
						</div>
					)}

					{/* Recommendations */}
					{audit.recommendations.length > 0 && (
						<div>
							<h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
								Recommendations
							</h4>
							<ul className="space-y-1">
								{audit.recommendations.map((rec, i) => (
									<li key={i} className="flex items-start gap-2 text-sm">
										<LightbulbIcon className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
										<span className="text-[var(--foreground-muted)]">{rec}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			) : (
				<div className="p-8 text-center">
					<AuditIcon className="h-12 w-12 mx-auto mb-3 text-[var(--foreground-muted)] opacity-50" />
					<p className="text-sm text-[var(--foreground-muted)]">
						Run an audit to check if this proposal is ready for submission.
					</p>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ReadinessGauge({ score, isReady }: { score: number; isReady: boolean }) {
	const circumference = 2 * Math.PI * 36;
	const strokeDashoffset = circumference - (score / 100) * circumference;

	const color = isReady
		? "text-green-500"
		: score >= 60
			? "text-amber-500"
			: "text-red-500";

	return (
		<div className="relative w-20 h-20">
			<svg className="w-20 h-20 transform -rotate-90">
				{/* Background circle */}
				<circle
					cx="40"
					cy="40"
					r="36"
					fill="none"
					stroke="currentColor"
					strokeWidth="8"
					className="text-[var(--background-muted)]"
				/>
				{/* Progress circle */}
				<circle
					cx="40"
					cy="40"
					r="36"
					fill="none"
					stroke="currentColor"
					strokeWidth="8"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					className={cn("transition-all duration-500", color)}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("text-lg font-bold", color)}>{score}</span>
			</div>
		</div>
	);
}

function DocumentStatusRow({
	document,
}: {
	document: PreSubmissionAudit["documents"][0];
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 p-2 rounded-lg",
				document.isReady
					? "bg-green-50 dark:bg-green-950/30"
					: "bg-amber-50 dark:bg-amber-950/30"
			)}
		>
			{document.isReady ? (
				<CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
			) : (
				<WarningIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
			)}
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-[var(--foreground)] truncate">
					{document.title}
				</p>
				<p className="text-xs text-[var(--foreground-muted)]">
					{formatDocumentType(document.type)} • {document.status}
				</p>
			</div>
			{document.issues.length > 0 && (
				<span className="text-xs text-amber-600 dark:text-amber-400">
					{document.issues.length} issue{document.issues.length !== 1 ? "s" : ""}
				</span>
			)}
		</div>
	);
}

function CheckRow({ check }: { check: AuditCheck }) {
	const severityStyles = {
		error: "text-red-500",
		warning: "text-amber-500",
		info: "text-blue-500",
	};

	return (
		<div className="flex items-start gap-2 py-1">
			{check.passed ? (
				<CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
			) : (
				<span className={cn("flex-shrink-0 mt-0.5", severityStyles[check.severity])}>
					{check.severity === "error" ? (
						<ErrorIcon className="h-4 w-4" />
					) : (
						<WarningIcon className="h-4 w-4" />
					)}
				</span>
			)}
			<div className="flex-1 min-w-0">
				<p className="text-sm text-[var(--foreground)]">{check.name}</p>
				<p className="text-xs text-[var(--foreground-muted)]">{check.message}</p>
			</div>
		</div>
	);
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDocumentType(type: string): string {
	const labels: Record<string, string> = {
		technical_approach: "Technical Approach",
		management_plan: "Management Plan",
		past_performance: "Past Performance",
		cost_proposal: "Cost Proposal",
		cover_letter: "Cover Letter",
		executive_summary: "Executive Summary",
		staffing_plan: "Staffing Plan",
		quality_assurance: "Quality Assurance",
		risk_mitigation: "Risk Mitigation",
		appendix: "Appendix",
		other: "Other",
	};
	return labels[type] || type;
}

// ============================================================================
// Icons
// ============================================================================

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
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}

function WarningIcon({ className }: { className?: string }) {
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

function LightbulbIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
			/>
		</svg>
	);
}

function AuditIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
			/>
		</svg>
	);
}
