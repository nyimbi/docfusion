/**
 * AssignPartnerDialog Component - DocFusion
 *
 * Dialog for assigning a partner to an opportunity.
 */

"use client";

import { useState, useTransition, useEffect } from "react";
import type {
	PartnerListItem,
	AssignPartnerInput,
	OpportunityPartner,
} from "@/lib/types/opportunity";
import { getPartners, assignPartnerToOpportunity } from "@/lib/actions/partners";
import { Button } from "@/components/ui/Button";
import { PartnerCard } from "./PartnerCard";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface AssignPartnerDialogProps {
	opportunityId: string;
	opportunityTitle: string;
	existingPartnerIds?: string[];
	onAssigned?: (assignment: OpportunityPartner) => void;
	onClose: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function AssignPartnerDialog({
	opportunityId,
	opportunityTitle,
	existingPartnerIds = [],
	onAssigned,
	onClose,
}: AssignPartnerDialogProps) {
	const [step, setStep] = useState<"select" | "configure">("select");
	const [partners, setPartners] = useState<PartnerListItem[]>([]);
	const [selectedPartner, setSelectedPartner] = useState<PartnerListItem | null>(
		null
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [role, setRole] = useState("");
	const [workShare, setWorkShare] = useState("");
	const [assignedSections, setAssignedSections] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Load partners
	useEffect(() => {
		setIsLoading(true);
		getPartners({ status: "active" })
			.then(setPartners)
			.finally(() => setIsLoading(false));
	}, []);

	// Filter partners
	const availablePartners = partners.filter(
		(p) =>
			!existingPartnerIds.includes(p.id) &&
			(searchQuery === "" ||
				p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.capabilities.some((c) =>
					c.toLowerCase().includes(searchQuery.toLowerCase())
				))
	);

	const handleSelectPartner = (partner: PartnerListItem) => {
		setSelectedPartner(partner);
		setStep("configure");
	};

	const handleBack = () => {
		setStep("select");
		setSelectedPartner(null);
		setRole("");
		setWorkShare("");
		setAssignedSections([]);
	};

	const handleAssign = () => {
		if (!selectedPartner) return;

		setError(null);
		startTransition(async () => {
			try {
				const assignment = await assignPartnerToOpportunity({
					opportunityId,
					partnerId: selectedPartner.id,
					role: role.trim() || undefined,
					workShare: workShare ? parseFloat(workShare) : undefined,
					assignedSections,
				});
				onAssigned?.(assignment);
				onClose();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to assign partner"
				);
			}
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50"
				onClick={onClose}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}/>

			{/* Dialog */}
			<div className="relative w-full max-w-2xl max-h-[90vh] bg-[var(--background)] rounded-lg shadow-xl flex flex-col">
				{/* Header */}
				<div className="px-6 py-4 border-b border-[var(--border)]">
					<h2 className="text-lg font-semibold text-[var(--foreground)]">
						{step === "select" ? "Select Partner" : "Configure Assignment"}
					</h2>
					<p className="text-sm text-[var(--foreground-muted)]">
						{opportunityTitle}
					</p>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					{step === "select" ? (
						<div className="space-y-4">
							{/* Search */}
							<div className="relative">
								<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--foreground-muted)]" />
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search partners by name or capability..."
									className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>

							{/* Partner List */}
							{isLoading ? (
								<div className="text-center py-12">
									<div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
									<p className="text-sm text-[var(--foreground-muted)] mt-2">
										Loading partners...
									</p>
								</div>
							) : availablePartners.length === 0 ? (
								<div className="text-center py-12">
									<TeamIcon className="h-12 w-12 mx-auto text-[var(--foreground-muted)] opacity-50 mb-3" />
									<p className="text-[var(--foreground-muted)]">
										{searchQuery
											? "No partners match your search"
											: "No available partners"}
									</p>
								</div>
							) : (
								<div className="space-y-2">
									{availablePartners.map((partner) => (
										<button
											key={partner.id}
											onClick={() => handleSelectPartner(partner)}
											className="w-full text-left"
										>
											<PartnerCard
												partner={partner}
												variant="compact"
												showActions={false}
											/>
										</button>
									))}
								</div>
							)}
						</div>
					) : (
						<div className="space-y-6">
							{/* Selected Partner */}
							<div className="bg-[var(--background-muted)] rounded-lg p-4">
								<p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide mb-2">
									Selected Partner
								</p>
								<p className="font-medium text-[var(--foreground)]">
									{selectedPartner?.name}
								</p>
							</div>

							{/* Role */}
							<div>
								<span className="block text-sm font-medium text-[var(--foreground)] mb-1">
									Role
								</span>
								<select
									value={role}
									onChange={(e) => setRole(e.target.value)}
									className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								 aria-label="Role">
									<option value="">Select a role...</option>
									<option value="lead">Lead Partner</option>
									<option value="support">Support Partner</option>
									<option value="specialist">Subject Matter Specialist</option>
									<option value="technical">Technical Resource</option>
									<option value="reviewer">Reviewer</option>
								</select>
							</div>

							{/* Work Share */}
							<div>
								<span className="block text-sm font-medium text-[var(--foreground)] mb-1">
									Work Share (%)
								</span>
								<input
									type="number"
									value={workShare}
									onChange={(e) => setWorkShare(e.target.value)}
									placeholder="e.g., 30"
									min="0"
									max="100"
									className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								 aria-label="Work Share (%)"/>
								<p className="text-xs text-[var(--foreground-muted)] mt-1">
									Percentage of total work assigned to this partner
								</p>
							</div>

							{/* Assigned Sections */}
							<div>
								<span className="block text-sm font-medium text-[var(--foreground)] mb-2">
									Assigned Sections
								</span>
								<div className="grid grid-cols-2 gap-2">
									{DOCUMENT_SECTIONS.map((section) => (
										<label
											key={section.value}
											className={cn(
												"flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
												assignedSections.includes(section.value)
													? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
													: "border-[var(--border)] hover:bg-[var(--background-muted)]"
											)}
										>
											<input
												type="checkbox"
												checked={assignedSections.includes(section.value)}
												onChange={(e) => {
													if (e.target.checked) {
														setAssignedSections([
															...assignedSections,
															section.value,
														]);
													} else {
														setAssignedSections(
															assignedSections.filter(
																(s) => s !== section.value
															)
														);
													}
												}}
												className="h-4 w-4 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
											/>
											<span className="text-sm text-[var(--foreground)]">
												{section.label}
											</span>
										</label>
									))}
								</div>
							</div>

							{/* Error */}
							{error && (
								<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
									{error}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-[var(--border)] flex justify-between">
					{step === "configure" ? (
						<Button variant="secondary" onClick={handleBack}>
							Back
						</Button>
					) : (
						<div />
					)}
					<div className="flex gap-2">
						<Button variant="secondary" onClick={onClose}>
							Cancel
						</Button>
						{step === "configure" && (
							<Button
								onClick={handleAssign}
								disabled={isPending}
								isLoading={isPending}
							>
								Assign Partner
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_SECTIONS = [
	{ value: "technical_approach", label: "Technical Approach" },
	{ value: "management_plan", label: "Management Plan" },
	{ value: "past_performance", label: "Past Performance" },
	{ value: "cost_proposal", label: "Cost Proposal" },
	{ value: "staffing_plan", label: "Staffing Plan" },
	{ value: "quality_assurance", label: "Quality Assurance" },
	{ value: "risk_mitigation", label: "Risk Mitigation" },
	{ value: "appendix", label: "Appendix" },
];

// ============================================================================
// Icons
// ============================================================================

function SearchIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
	);
}

function TeamIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
		</svg>
	);
}
