/**
 * Proposal Document Labels - DocFusion
 *
 * Utility functions for getting display labels for proposal document types and statuses.
 * These are client-safe functions (no "use server").
 */

import type { ProposalDocumentType, ProposalDocumentStatus } from "@/lib/types/opportunity";

/**
 * Get display name for document type.
 */
export function getDocumentTypeLabel(type: ProposalDocumentType): string {
	const labels: Record<ProposalDocumentType, string> = {
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

/**
 * Get display name for status.
 */
export function getStatusLabel(status: ProposalDocumentStatus): string {
	const labels: Record<ProposalDocumentStatus, string> = {
		not_started: "Not Started",
		drafting: "Drafting",
		in_review: "In Review",
		revising: "Revising",
		approved: "Approved",
		final: "Final",
	};
	return labels[status] || status;
}

/**
 * Get color scheme for status.
 */
export function getStatusColor(status: ProposalDocumentStatus): {
	bg: string;
	text: string;
	border: string;
} {
	const colors: Record<ProposalDocumentStatus, { bg: string; text: string; border: string }> = {
		not_started: {
			bg: "bg-gray-100 dark:bg-gray-800",
			text: "text-gray-600 dark:text-gray-400",
			border: "border-gray-200 dark:border-gray-700",
		},
		drafting: {
			bg: "bg-blue-50 dark:bg-blue-950",
			text: "text-blue-600 dark:text-blue-400",
			border: "border-blue-200 dark:border-blue-800",
		},
		in_review: {
			bg: "bg-yellow-50 dark:bg-yellow-950",
			text: "text-yellow-600 dark:text-yellow-400",
			border: "border-yellow-200 dark:border-yellow-800",
		},
		revising: {
			bg: "bg-orange-50 dark:bg-orange-950",
			text: "text-orange-600 dark:text-orange-400",
			border: "border-orange-200 dark:border-orange-800",
		},
		approved: {
			bg: "bg-green-50 dark:bg-green-950",
			text: "text-green-600 dark:text-green-400",
			border: "border-green-200 dark:border-green-800",
		},
		final: {
			bg: "bg-emerald-100 dark:bg-emerald-900",
			text: "text-emerald-700 dark:text-emerald-300",
			border: "border-emerald-300 dark:border-emerald-700",
		},
	};
	return colors[status];
}
