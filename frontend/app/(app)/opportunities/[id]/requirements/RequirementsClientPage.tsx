/**
 * RequirementsClientPage Component - DocFusion
 *
 * Client component that handles interactive requirements management
 * including table, detail panel, and extraction dialog.
 */

"use client";

import { useState, useCallback } from "react";
import type { Requirement, RequirementStats } from "@/lib/types/opportunity";
import { RequirementsTable } from "@/components/requirements/RequirementsTable";
import { RequirementDetail } from "@/components/requirements/RequirementDetail";
import { RequirementExtractor } from "./RequirementExtractor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RequirementsClientPageProps {
	opportunityId: string;
	initialRequirements: Requirement[];
	initialStats: RequirementStats;
}

export function RequirementsClientPage({
	opportunityId,
	initialRequirements,
	initialStats,
}: RequirementsClientPageProps) {
	const [requirements, setRequirements] = useState(initialRequirements);
	const [stats, setStats] = useState(initialStats);
	const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
	const [showExtractor, setShowExtractor] = useState(false);

	const handleRequirementClick = useCallback((req: Requirement) => {
		setSelectedRequirement(req);
	}, []);

	const handleRequirementUpdate = useCallback((updated: Requirement) => {
		setRequirements((prev) =>
			prev.map((r) => (r.id === updated.id ? updated : r))
		);
		setSelectedRequirement(updated);

		// Update stats based on status change
		// This is a simplified update - in production you'd refetch stats
	}, []);

	const handleRequirementsChange = useCallback(() => {
		// Refetch stats when requirements change
		// For now, we'll handle this optimistically
	}, []);

	const handleExtracted = useCallback((newRequirements: Requirement[]) => {
		setRequirements((prev) => [...prev, ...newRequirements]);
		setStats((prev) => ({
			...prev,
			total: prev.total + newRequirements.length,
			byStatus: {
				...prev.byStatus,
				not_addressed: prev.byStatus.not_addressed + newRequirements.length,
			},
		}));
		setShowExtractor(false);
	}, []);

	return (
		<>
			{/* Action Bar */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h2 className="text-lg font-medium text-[var(--foreground)]">
						All Requirements
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => setShowExtractor(true)}>
						<UploadIcon className="h-4 w-4 mr-2" />
						Extract from RFP
					</Button>
				</div>
			</div>

			{/* Requirements Table */}
			{requirements.length > 0 ? (
				<Card>
					<CardContent className="p-0">
						<RequirementsTable
							requirements={requirements}
							onRequirementClick={handleRequirementClick}
							onRequirementsChange={handleRequirementsChange}
						/>
					</CardContent>
				</Card>
			) : (
				<EmptyState onExtract={() => setShowExtractor(true)} />
			)}

			{/* Requirement Detail Slide-over */}
			<RequirementDetail
				requirement={selectedRequirement}
				open={selectedRequirement !== null}
				onClose={() => setSelectedRequirement(null)}
				onUpdate={handleRequirementUpdate}
			/>

			{/* Requirement Extractor Dialog */}
			<RequirementExtractor
				opportunityId={opportunityId}
				open={showExtractor}
				onClose={() => setShowExtractor(false)}
				onExtracted={handleExtracted}
			/>
		</>
	);
}

// ============================================================================
// Sub-Components
// ============================================================================

function EmptyState({ onExtract }: { onExtract: () => void }) {
	return (
		<Card>
			<CardContent className="py-16">
				<div className="text-center">
					<div className="mx-auto h-12 w-12 rounded-full bg-[var(--background-muted)] flex items-center justify-center mb-4">
						<DocumentIcon className="h-6 w-6 text-[var(--foreground-muted)]" />
					</div>
					<h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
						No Requirements Yet
					</h3>
					<p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto mb-6">
						Extract requirements from your RFP document to start tracking compliance and managing your proposal response.
					</p>
					<Button variant="primary" onClick={onExtract}>
						<UploadIcon className="h-4 w-4 mr-2" />
						Extract from RFP
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Icons
// ============================================================================

function UploadIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
			/>
		</svg>
	);
}

function DocumentIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	);
}
