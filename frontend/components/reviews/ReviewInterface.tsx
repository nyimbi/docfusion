/**
 * ReviewInterface - Reviewer's Workspace
 *
 * Complete workspace for reviewers including document view, comment panel,
 * scoring rubric, and progress tracking.
 */

"use client";

import { useState, useCallback } from "react";
import {
	FileText,
	MessageSquare,
	BarChart3,
	CheckSquare,
	Clock,
	Save,
	Send,
	ChevronLeft,
	ChevronRight,
	Maximize2,
	Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { sanitizeHTML } from "@/lib/utils/sanitize";
import { CommentPanel } from "./CommentPanel";
import { ScoringRubric, type EvaluationCriteria, type CriteriaScore } from "./ScoringRubric";
import type { Comment } from "./CommentCard";

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewSession {
	id: string;
	reviewName: string;
	reviewType: string;
	status: string;
	dueDate?: string;
	instructions?: string;
	focusAreas?: string[];
}

export interface ReviewerProgress {
	sectionsReviewed: number;
	totalSections: number;
	commentsSubmitted: number;
	scoresSubmitted: number;
	totalCriteria: number;
}

export interface Section {
	id: string;
	name: string;
	content?: string;
	pageStart?: number;
	pageEnd?: number;
}

export interface ReviewInterfaceProps {
	review: ReviewSession;
	reviewerProgress: ReviewerProgress;
	sections: Section[];
	comments: Comment[];
	evaluationCriteria: EvaluationCriteria[];
	scores: CriteriaScore[];
	onUpdateScore?: (criteriaId: string, score: Partial<CriteriaScore>) => void;
	onSaveScores?: () => Promise<void>;
	onAddComment?: () => void;
	onResolveComment?: (commentId: string) => void;
	onCompleteReview?: () => void;
	onSaveDraft?: () => void;
	documentUrl?: string;
	className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REVIEW_TYPE_LABELS: Record<string, { label: string; color: string }> = {
	pink: { label: "Pink Team", color: "bg-pink-500" },
	red: { label: "Red Team", color: "bg-red-500" },
	gold: { label: "Gold Team", color: "bg-amber-500" },
	compliance: { label: "Compliance", color: "bg-blue-500" },
	final: { label: "Final", color: "bg-purple-500" },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewInterface({
	review,
	reviewerProgress,
	sections,
	comments,
	evaluationCriteria,
	scores,
	onUpdateScore,
	onSaveScores,
	onAddComment,
	onResolveComment,
	onCompleteReview,
	onSaveDraft,
	documentUrl,
	className,
}: ReviewInterfaceProps) {
	const [activeTab, setActiveTab] = useState<"comments" | "scoring" | "checklist">("comments");
	const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);

	const typeConfig = REVIEW_TYPE_LABELS[review.reviewType] || { label: review.reviewType, color: "bg-gray-500" };
	const currentSection = sections[currentSectionIndex];

	// Calculate progress percentage
	const progressPercent = reviewerProgress.totalSections > 0
		? (reviewerProgress.sectionsReviewed / reviewerProgress.totalSections) * 100
		: 0;

	const scoringPercent = reviewerProgress.totalCriteria > 0
		? (reviewerProgress.scoresSubmitted / reviewerProgress.totalCriteria) * 100
		: 0;

	// Navigation
	const goToPreviousSection = useCallback(() => {
		setCurrentSectionIndex((prev) => Math.max(0, prev - 1));
	}, []);

	const goToNextSection = useCallback(() => {
		setCurrentSectionIndex((prev) => Math.min(sections.length - 1, prev + 1));
	}, [sections.length]);

	// Format due date
	const formatDueDate = (dateStr?: string) => {
		if (!dateStr) return null;
		const date = new Date(dateStr);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

		if (days < 0) return { text: "Overdue", urgent: true };
		if (days === 0) return { text: "Due today", urgent: true };
		if (days === 1) return { text: "Due tomorrow", urgent: true };
		return { text: `${days} days left`, urgent: days <= 2 };
	};

	const dueInfo = formatDueDate(review.dueDate);

	// Filter comments for current section
	const sectionComments = comments.filter(
		(c) => !currentSection || c.sectionName === currentSection.name
	);

	return (
		<div className={cn("flex flex-col h-screen", className)}>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b bg-background shrink-0">
				<div className="flex items-center gap-4">
					<Badge className={typeConfig.color}>{typeConfig.label}</Badge>
					<div>
						<h1 className="font-semibold">{review.reviewName}</h1>
						<p className="text-sm text-muted-foreground">
							{reviewerProgress.sectionsReviewed} of {reviewerProgress.totalSections} sections reviewed
						</p>
					</div>
				</div>

				<div className="flex items-center gap-4">
					{/* Progress */}
					<div className="hidden md:flex items-center gap-4">
						<div className="text-right">
							<p className="text-sm font-medium">Review Progress</p>
							<Progress value={progressPercent} className="w-32 h-2" />
						</div>
						<div className="text-right">
							<p className="text-sm font-medium">Scoring</p>
							<Progress value={scoringPercent} className="w-32 h-2" />
						</div>
					</div>

					{/* Due date */}
					{dueInfo && (
						<Badge variant={dueInfo.urgent ? "destructive" : "secondary"} className="gap-1">
							<Clock className="h-3 w-3" />
							{dueInfo.text}
						</Badge>
					)}

					{/* Actions */}
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={onSaveDraft}>
							<Save className="h-4 w-4 mr-1" />
							Save Draft
						</Button>
						<Button size="sm" onClick={onCompleteReview}>
							<Send className="h-4 w-4 mr-1" />
							Submit Review
						</Button>
					</div>
				</div>
			</div>

			{/* Instructions Banner */}
			{review.instructions && (
				<div className="p-3 bg-muted border-b text-sm">
					<strong>Instructions:</strong> {review.instructions}
					{review.focusAreas && review.focusAreas.length > 0 && (
						<span className="ml-2">
							<strong>Focus areas:</strong> {review.focusAreas.join(", ")}
						</span>
					)}
				</div>
			)}

			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				<ResizablePanelGroup orientation="horizontal">
					{/* Document Panel */}
					<ResizablePanel defaultSize={60} minSize={30}>
						<div className="flex flex-col h-full">
							{/* Section Navigation */}
							<div className="flex items-center justify-between p-2 border-b bg-muted/30">
								<Button
									variant="ghost"
									size="sm"
									onClick={goToPreviousSection}
									disabled={currentSectionIndex === 0}
								>
									<ChevronLeft className="h-4 w-4 mr-1" />
									Previous
								</Button>

								<div className="flex items-center gap-2">
									<FileText className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium">
										{currentSection?.name || "Select a section"}
									</span>
									<Badge variant="outline">
										{currentSectionIndex + 1} / {sections.length}
									</Badge>
								</div>

								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setIsFullscreen(!isFullscreen)}
										aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
									>
										{isFullscreen ? (
											<Minimize2 className="h-4 w-4" />
										) : (
											<Maximize2 className="h-4 w-4" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={goToNextSection}
										disabled={currentSectionIndex === sections.length - 1}
									>
										Next
										<ChevronRight className="h-4 w-4 ml-1" />
									</Button>
								</div>
							</div>

							{/* Document Content */}
							<div className="flex-1 overflow-auto p-4">
								{documentUrl ? (
									<iframe
										src={documentUrl}
										className="w-full h-full border rounded-lg"
										title="Document Preview"
									/>
								) : currentSection?.content ? (
									<div className="prose dark:prose-invert max-w-none">
										<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentSection.content) }} />
									</div>
								) : (
									<div className="flex items-center justify-center h-full text-muted-foreground">
										<div className="text-center">
											<FileText className="h-12 w-12 mx-auto mb-4" />
											<p>Select a section to review</p>
										</div>
									</div>
								)}
							</div>

							{/* Section List */}
							<div className="border-t p-2 bg-muted/30">
								<div className="flex gap-1 overflow-x-auto pb-1">
									{sections.map((section, idx) => (
										<Button
											key={section.id}
											variant={idx === currentSectionIndex ? "primary" : "ghost"}
											size="sm"
											onClick={() => setCurrentSectionIndex(idx)}
											className="shrink-0"
										>
											{section.name}
										</Button>
									))}
								</div>
							</div>
						</div>
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Review Panel */}
					<ResizablePanel
						defaultSize={40}
						minSize={20}
						collapsible
						collapsedSize={0}
					>
						<div className="flex flex-col h-full">
							<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col h-full">
								<TabsList className="grid grid-cols-3 m-2">
									<TabsTrigger value="comments" className="gap-1">
										<MessageSquare className="h-4 w-4" />
										Comments
										<Badge variant="secondary" className="ml-1">
											{comments.length}
										</Badge>
									</TabsTrigger>
									<TabsTrigger value="scoring" className="gap-1">
										<BarChart3 className="h-4 w-4" />
										Scoring
									</TabsTrigger>
									<TabsTrigger value="checklist" className="gap-1">
										<CheckSquare className="h-4 w-4" />
										Checklist
									</TabsTrigger>
								</TabsList>

								<TabsContent value="comments" className="flex-1 overflow-hidden mt-0">
									<CommentPanel
										comments={sectionComments}
										sections={sections.map((s) => ({ id: s.id, name: s.name }))}
										onAddComment={onAddComment}
										onResolveComment={onResolveComment}
										className="h-full"
									/>
								</TabsContent>

								<TabsContent value="scoring" className="flex-1 overflow-auto mt-0 p-4">
									<ScoringRubric
										criteria={evaluationCriteria}
										scores={scores}
										onUpdateScore={onUpdateScore}
										onSaveAll={onSaveScores}
									/>
								</TabsContent>

								<TabsContent value="checklist" className="flex-1 overflow-auto mt-0 p-4">
									<div className="space-y-4">
										<h3 className="font-semibold">Review Checklist</h3>
										<div className="space-y-2">
											{[
												"Read all assigned sections thoroughly",
												"Identify strengths and document them",
												"Note all weaknesses with severity",
												"Check compliance with all requirements",
												"Verify win theme consistency",
												"Review graphics and visuals",
												"Check for spelling and grammar",
												"Validate all claims and statistics",
												"Complete scoring for all criteria",
												"Write executive summary of findings",
											].map((item, idx) => (
												<label
													key={idx}
													className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer"
												>
													<input type="checkbox" className="h-4 w-4 rounded" />
													<span className="text-sm">{item}</span>
												</label>
											))}
										</div>
									</div>
								</TabsContent>
							</Tabs>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>

			{/* Status Bar */}
			<div className="flex items-center justify-between p-2 border-t bg-muted/30 text-sm shrink-0">
				<div className="flex items-center gap-4">
					<span className="text-muted-foreground">
						{reviewerProgress.commentsSubmitted} comments
					</span>
					<span className="text-muted-foreground">
						{reviewerProgress.scoresSubmitted} / {reviewerProgress.totalCriteria} scores
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">Auto-saved</span>
					<Badge variant="outline" className="text-green-600">
						Draft
					</Badge>
				</div>
			</div>
		</div>
	);
}

export default ReviewInterface;
