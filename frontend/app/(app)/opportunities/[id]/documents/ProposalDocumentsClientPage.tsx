/**
 * ProposalDocumentsClientPage Component - DocFusion
 *
 * Client component that handles interactive document management
 * including list, creation dialog, and state updates.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ProposalDocument, ProposalProgress } from "@/lib/types/opportunity";
import { getProposalDocuments, getProposalProgress } from "@/lib/actions/proposal-documents";
import { ProposalDocumentList } from "@/components/proposals/ProposalDocumentList";
import { CreateProposalDialog } from "@/components/proposals/CreateProposalDialog";

interface ProposalDocumentsClientPageProps {
	opportunityId: string;
	initialDocuments: ProposalDocument[];
	initialProgress: ProposalProgress;
}

export function ProposalDocumentsClientPage({
	opportunityId,
	initialDocuments,
	initialProgress,
}: ProposalDocumentsClientPageProps) {
	const router = useRouter();
	const [documents, setDocuments] = useState(initialDocuments);
	const [progress, setProgress] = useState(initialProgress);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	useEffect(() => {
		setDocuments(initialDocuments);
		setProgress(initialProgress);
	}, [initialDocuments, initialProgress]);

	const refreshProposalState = useCallback(async () => {
		const [nextDocuments, nextProgress] = await Promise.all([
			getProposalDocuments(opportunityId),
			getProposalProgress(opportunityId),
		]);
		setDocuments(nextDocuments);
		setProgress(nextProgress);
		router.refresh();
	}, [opportunityId, router]);

	const handleDocumentUpdate = useCallback((updated: ProposalDocument) => {
		setDocuments((prev) =>
			prev.map((doc) => (doc.id === updated.id ? updated : doc))
		);
		void refreshProposalState();
	}, [refreshProposalState]);

	const handleDocumentRemove = useCallback((id: string) => {
		setDocuments((prev) => prev.filter((doc) => doc.id !== id));
		void refreshProposalState();
	}, [refreshProposalState]);

	const handleDocumentsCreated = useCallback((newDocs: ProposalDocument[]) => {
		setDocuments((prev) => [...prev, ...newDocs]);
		setShowCreateDialog(false);
		void refreshProposalState();
	}, [refreshProposalState]);

	return (
		<>
			<ProposalDocumentList
				documents={documents}
				progress={progress}
				onDocumentUpdate={handleDocumentUpdate}
				onDocumentRemove={handleDocumentRemove}
				onCreateNew={() => setShowCreateDialog(true)}
			/>

			<CreateProposalDialog
				opportunityId={opportunityId}
				open={showCreateDialog}
				onClose={() => setShowCreateDialog(false)}
				onCreated={handleDocumentsCreated}
			/>
		</>
	);
}
