"use client";

/**
 * QuestionCard Component - DocFusion
 *
 * Individual Q&A card displaying question, answer, evidence,
 * and related metadata for oral presentation preparation.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	HelpCircle,
	ChevronDown,
	ChevronRight,
	MoreHorizontal,
	Edit,
	Trash2,
	CheckCircle,
	AlertTriangle,
	User,
	FileText,
	Link,
	Plus,
	Sparkles,
	RefreshCw,
	Copy,
	ExternalLink,
	BookOpen,
	Quote,
} from "lucide-react";
import { generateAnswerSuggestion } from "@/lib/actions/presentations";
import type {
	PresentationQA,
	PresentationSlide,
	QuestionCategory,
	QuestionDifficulty,
	SupportingEvidence,
} from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface QuestionCardProps {
	/** The Q&A item to display */
	qa: PresentationQA;
	/** Whether this card is selected */
	isSelected: boolean;
	/** All slides for linking */
	slides: PresentationSlide[];
	/** Callback when card is selected */
	onSelect: () => void;
	/** Callback when Q&A is updated */
	onUpdate: (updates: Partial<PresentationQA>) => void;
	/** Callback when Q&A is deleted */
	onDelete: () => void;
	/** Additional class names */
	className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CATEGORY_CONFIG: Record<QuestionCategory, { label: string; color: string; bgColor: string }> = {
	technical: {
		label: "Technical",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
	},
	management: {
		label: "Management",
		color: "text-purple-600 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
	},
	cost: {
		label: "Cost",
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	past_performance: {
		label: "Past Performance",
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
	},
	clarification: {
		label: "Clarification",
		color: "text-gray-600 dark:text-gray-400",
		bgColor: "bg-gray-100 dark:bg-gray-900/30",
	},
};

const DIFFICULTY_CONFIG: Record<QuestionDifficulty, { label: string; color: string; bgColor: string }> = {
	easy: {
		label: "Easy",
		color: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-100 dark:bg-green-900/30",
	},
	medium: {
		label: "Medium",
		color: "text-yellow-600 dark:text-yellow-400",
		bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
	},
	hard: {
		label: "Hard",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
	},
};

// ============================================================================
// Component
// ============================================================================

export function QuestionCard({
	qa,
	isSelected,
	slides,
	onSelect,
	onUpdate,
	onDelete,
	className,
}: QuestionCardProps) {
	// State
	const [isExpanded, setIsExpanded] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [editedQuestion, setEditedQuestion] = useState(qa.likelyQuestion);
	const [editedAnswer, setEditedAnswer] = useState(qa.suggestedAnswer ?? "");

	// Parse evidence
	const evidence: SupportingEvidence[] = Array.isArray(qa.supportingEvidence)
		? qa.supportingEvidence as SupportingEvidence[]
		: [];

	// Get related slides
	const relatedSlideIds = Array.isArray(qa.relatedSlideIds) ? qa.relatedSlideIds : [];
	const relatedSlides = slides.filter((s) => relatedSlideIds.includes(s.id));

	const categoryConfig = CATEGORY_CONFIG[qa.questionCategory as QuestionCategory] ?? CATEGORY_CONFIG.technical;
	const difficultyConfig = DIFFICULTY_CONFIG[qa.difficulty as QuestionDifficulty] ?? DIFFICULTY_CONFIG.medium;

	// Handlers
	const handleToggleReviewed = useCallback(() => {
		onUpdate({ isReviewed: !qa.isReviewed });
	}, [qa.isReviewed, onUpdate]);

	const handleGenerateAnswer = useCallback(async () => {
		setIsGenerating(true);
		try {
			const result = await generateAnswerSuggestion(qa.id);
			if (result.success && result.data) {
				onUpdate({
					suggestedAnswer: result.data,
				});
				setEditedAnswer(result.data);
			}
		} finally {
			setIsGenerating(false);
		}
	}, [qa.id, onUpdate]);

	const handleSaveEdit = useCallback(() => {
		onUpdate({
			likelyQuestion: editedQuestion,
			suggestedAnswer: editedAnswer,
		});
		setIsEditing(false);
	}, [editedQuestion, editedAnswer, onUpdate]);

	const handleCancelEdit = useCallback(() => {
		setEditedQuestion(qa.likelyQuestion);
		setEditedAnswer(qa.suggestedAnswer ?? "");
		setIsEditing(false);
	}, [qa.likelyQuestion, qa.suggestedAnswer]);

	const handleCopyAnswer = useCallback(() => {
		navigator.clipboard.writeText(qa.suggestedAnswer ?? "");
	}, [qa.suggestedAnswer]);

	const handleUpdateCategory = useCallback((category: QuestionCategory) => {
		onUpdate({ questionCategory: category });
	}, [onUpdate]);

	const handleUpdateDifficulty = useCallback((difficulty: QuestionDifficulty) => {
		onUpdate({ difficulty });
	}, [onUpdate]);

	return (
		<TooltipProvider>
			<Card
				className={cn(
					"transition-all cursor-pointer",
					isSelected && "ring-2 ring-primary",
					qa.isReviewed && "border-green-200 dark:border-green-800",
					className
				)}
				onClick={onSelect}
			>
				<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
					<CardHeader className="p-3 pb-2">
						<div className="flex items-start gap-2">
							{/* Expand/Collapse */}
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 shrink-0 mt-0.5"
									onClick={(e) => e.stopPropagation()}
								>
									{isExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
								</Button>
							</CollapsibleTrigger>

							{/* Question */}
							<div className="flex-1 min-w-0">
								{isEditing ? (
									<Input
										value={editedQuestion}
										onChange={(e) => setEditedQuestion(e.target.value)}
										className="text-sm font-medium"
										onClick={(e) => e.stopPropagation()}
									/>
								) : (
									<p className="text-sm font-medium leading-tight">
										{qa.likelyQuestion}
									</p>
								)}

								{/* Tags */}
								<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
									<Badge
										variant="outline"
										className={cn("text-[10px] h-5", categoryConfig.color, categoryConfig.bgColor)}
									>
										{categoryConfig.label}
									</Badge>

									<Badge
										variant="outline"
										className={cn("text-[10px] h-5", difficultyConfig.color, difficultyConfig.bgColor)}
									>
										{difficultyConfig.label}
									</Badge>

									{qa.isReviewed && (
										<Badge
											variant="outline"
											className="text-[10px] h-5 text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
										>
											<CheckCircle className="h-3 w-3 mr-0.5" />
											Reviewed
										</Badge>
									)}

									{qa.questionSource && (
										<Badge
											variant="outline"
											className="text-[10px] h-5"
										>
											<Sparkles className="h-3 w-3 mr-0.5" />
											AI
										</Badge>
									)}
								</div>
							</div>

							{/* Actions */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 shrink-0"
										onClick={(e) => e.stopPropagation()}
									>
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setIsEditing(true)}>
										<Edit className="h-4 w-4 mr-2" />
										Edit
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleToggleReviewed}>
										<CheckCircle className="h-4 w-4 mr-2" />
										{qa.isReviewed ? "Mark Unreviewed" : "Mark Reviewed"}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleCopyAnswer}>
										<Copy className="h-4 w-4 mr-2" />
										Copy Answer
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={onDelete} className="text-destructive">
										<Trash2 className="h-4 w-4 mr-2" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</CardHeader>

					<CollapsibleContent>
						<CardContent className="px-3 pb-3 pt-0 space-y-3">
							{/* Answer */}
							<div>
								<div className="flex items-center justify-between mb-1">
									<span className="text-xs font-medium text-muted-foreground">
										Answer
									</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 text-xs"
										onClick={handleGenerateAnswer}
										disabled={isGenerating}
									>
										{isGenerating ? (
											<RefreshCw className="h-3 w-3 mr-1 animate-spin" />
										) : (
											<Sparkles className="h-3 w-3 mr-1" />
										)}
										{isGenerating ? "Generating..." : "AI Generate"}
									</Button>
								</div>

								{isEditing ? (
									<Textarea
										value={editedAnswer}
										onChange={(e) => setEditedAnswer(e.target.value)}
										className="text-sm min-h-[100px]"
										placeholder="Enter prepared answer..."
										onClick={(e) => e.stopPropagation()}
									/>
								) : (
									<div className="text-sm p-2 bg-muted/50 rounded-md whitespace-pre-wrap">
										{qa.suggestedAnswer || (
											<span className="text-muted-foreground italic">
												No answer prepared. Click "AI Generate" to create one.
											</span>
										)}
									</div>
								)}
							</div>

							{/* Category & Difficulty Selectors (when editing) */}
							{isEditing && (
								<div className="flex items-center gap-2">
									<Select
										value={qa.questionCategory ?? "technical"}
										onValueChange={(v) => handleUpdateCategory(v as QuestionCategory)}
									>
										<SelectTrigger className="flex-1 h-8">
											<SelectValue placeholder="Category" />
										</SelectTrigger>
										<SelectContent>
											{Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
												<SelectItem key={key} value={key}>
													{config.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={qa.difficulty ?? "medium"}
										onValueChange={(v) => handleUpdateDifficulty(v as QuestionDifficulty)}
									>
										<SelectTrigger className="w-[100px] h-8">
											<SelectValue placeholder="Difficulty" />
										</SelectTrigger>
										<SelectContent>
											{Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
												<SelectItem key={key} value={key}>
													{config.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							{/* Supporting Evidence */}
							{evidence.length > 0 && (
								<div>
									<label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
										<BookOpen className="h-3 w-3" />
										Supporting Evidence ({evidence.length})
									</label>
									<div className="space-y-1.5">
										{evidence.map((ev, i) => (
											<div
												key={i}
												className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs"
											>
												<Quote className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
												<div className="flex-1 min-w-0">
													<p className="line-clamp-2">{ev.evidence}</p>
													{ev.source && (
														<p className="text-muted-foreground mt-0.5 truncate">
															Source: {ev.source}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Related Slides */}
							{relatedSlides.length > 0 && (
								<div>
									<label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
										<Link className="h-3 w-3" />
										Related Slides ({relatedSlides.length})
									</label>
									<div className="flex flex-wrap gap-1">
										{relatedSlides.map((slide) => (
											<Badge key={slide.id} variant="outline" className="gap-1 text-[10px]">
												<FileText className="h-2.5 w-2.5" />
												Slide {slide.slideNumber}
											</Badge>
										))}
									</div>
								</div>
							)}

							{/* Reviewer Info */}
							{qa.reviewedBy && (
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<User className="h-3 w-3" />
									<span>Reviewed by: {qa.reviewedBy}</span>
								</div>
							)}

							{/* Edit Actions */}
							{isEditing && (
								<div className="flex items-center gap-2 pt-2">
									<Button size="sm" onClick={handleSaveEdit}>
										Save
									</Button>
									<Button variant="ghost" size="sm" onClick={handleCancelEdit}>
										Cancel
									</Button>
								</div>
							)}
						</CardContent>
					</CollapsibleContent>
				</Collapsible>
			</Card>
		</TooltipProvider>
	);
}
