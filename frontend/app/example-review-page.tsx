"use client";

/**
 * Example Page - Document Review Workflow
 *
 * Demonstrates how to use the comments and review workflow components together.
 *
 * This is an example and should be adapted to fit your actual document editing page.
 */

import React, { useState } from "react";
import {
	CommentsPanel,
	ApprovalWorkflow,
	ReviewToolbar,
} from "@/components/document";
import { Button } from "@/components/ui/Button";
import { PanelLeft, PanelRight, MessageSquare, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Example Page Component
// ============================================================================

interface ReviewPageProps {
	documentId: string;
	proposalDocumentId?: string;
	currentUserId: string;
	currentUserName: string;
}

export default function ExampleReviewPage({
	documentId,
	proposalDocumentId,
	currentUserId,
	currentUserName,
}: ReviewPageProps) {
	const [showComments, setShowComments] = useState(true);
	const [showWorkflow, setShowWorkflow] = useState(true);
	const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
	const [documentContent, setDocumentContent] = useState([
		{ id: "intro", title: "Introduction", selected: false },
		{ id: "approach", title: "Technical Approach", selected: false },
		{ id: "management", title: "Management Plan", selected: false },
		{ id: "budget", title: "Budget", selected: false },
	]);

	// Simulate section selection
	const handleSelectSection = (sectionId: string) => {
		setSelectedSectionId(sectionId);
		setShowComments(true);
	};

	// Refresh workflow status after review action
	const handleReviewSubmitted = () => {
		// Refetch workflow status
		console.log("Review submitted, refreshing...");
	};

	return (
		<div className="flex h-screen bg-gray-100">
			{/* Left sidebar - Document outline */}
			<div className="w-64 bg-white border-r flex flex-col">
				<div className="p-4 border-b">
					<h2 className="font-semibold">Document Sections</h2>
				</div>
				<div className="flex-1 overflow-y-auto p-2 space-y-1">
					{documentContent.map((section) => (
						<button
							key={section.id}
							onClick={() => handleSelectSection(section.id)}
							className={cn(
								"w-full text-left px-3 py-2 rounded text-sm transition-colors",
								selectedSectionId === section.id
									? "bg-blue-50 text-blue-700"
									: "hover:bg-gray-50 text-gray-700"
							)}
						>
							{section.title}
						</button>
					))}
				</div>
			</div>

			{/* Main content area */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* Toolbar */}
				<div className="h-14 bg-white border-b flex items-center px-4 gap-2">
					<div className="flex-1 flex items-center gap-2">
						<h1 className="font-semibold text-lg">Document Title</h1>
						<span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
							Draft
						</span>
					</div>

					{/* Review toolbar for users assigned to review */}
					<div className="flex items-center gap-2">
						<ReviewToolbar
							documentId={documentId}
							currentUserId={currentUserId}
							onReviewSubmitted={handleReviewSubmitted}
						/>
					</div>

					<div className="flex items-center gap-1 ml-4 border-l pl-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowComments(!showComments)}
							className={cn(
								"relative",
								showComments && "bg-blue-50 text-blue-600"
							)}
						>
							<MessageSquare className="h-4 w-4 mr-1.5" />
							Comments
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowWorkflow(!showWorkflow)}
							className={cn(
								"relative",
								showWorkflow && "bg-green-50 text-green-600"
							)}
						>
							<CheckCircle className="h-4 w-4 mr-1.5" />
							Workflow
						</Button>
					</div>
				</div>

				{/* Document editor area */}
				<div className="flex-1 overflow-y-auto p-8">
					<div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8 min-h-[800px]">
						<h1 className="text-3xl font-bold mb-8">Proposal Response</h1>

						{/* Section with comment button */}
						<section
							className={cn(
								"group relative p-4 rounded-lg transition-colors",
								selectedSectionId === "intro"
									? "ring-2 ring-blue-500 bg-blue-50"
									: "hover:bg-gray-50"
							)}
						>
							<button
								onClick={() => handleSelectSection("intro")}
								className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-blue-600"
								title="Comment on this section"
							>
								<MessageSquare className="h-4 w-4" />
							</button>
							<h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
							<p className="text-gray-700 leading-relaxed">
								This is an example document section. Click on the comment icon to
								add a section-specific comment. The comments panel will open on the
								right side.
							</p>
						</section>

						<section
							className={cn(
								"group relative p-4 rounded-lg transition-colors mt-8",
								selectedSectionId === "approach"
									? "ring-2 ring-blue-500 bg-blue-50"
									: "hover:bg-gray-50"
							)}
						>
							<button
								onClick={() => handleSelectSection("approach")}
								className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-blue-600"
							>
								<MessageSquare className="h-4 w-4" />
							</button>
							<h2 className="text-xl font-semibold mb-4">2. Technical Approach</h2>
							<p className="text-gray-700 leading-relaxed">
								Our technical approach leverages modern technologies to deliver
								high-quality solutions...
							</p>
						</section>

						{/* Example inline comment thread */}
						<div className="mt-8 p-4 bg-gray-50 rounded-lg">
							<p className="text-sm text-gray-500">
								Select a section above to see section-specific comments, or use
								the Comments panel for general document feedback.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Right sidebar - Comments and Workflow */}
			{(showComments || showWorkflow) && (
				<div className="w-96 bg-white border-l flex flex-col overflow-hidden">
					{/* Comments Panel */}
					{showComments && (
						<div className={cn("overflow-hidden", showWorkflow ? "h-1/2 border-b" : "flex-1")}>
							<CommentsPanel
								documentId={documentId}
								selectedSectionId={selectedSectionId}
								onSelectSectionForComment={() => setSelectedSectionId(null)}
								currentUserId={currentUserId}
								currentUser={{ name: currentUserName }}
								className="h-full border-0 rounded-none"
							/>
						</div>
					)}

					{/* Workflow Panel */}
					{showWorkflow && (
						<div className={showComments ? "h-1/2" : "flex-1"}>
							<ApprovalWorkflow
								documentId={documentId}
								proposalDocumentId={proposalDocumentId}
								currentUserId={currentUserId}
								onStatusChange={handleReviewSubmitted}
								className="h-full border-0 rounded-none"
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
