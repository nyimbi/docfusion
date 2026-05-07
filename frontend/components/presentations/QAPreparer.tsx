"use client";

/**
 * QAPreparer Component - DocFusion
 *
 * Q&A preparation tool with AI-generated questions, answer drafting,
 * and evidence linking for oral presentation preparation.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	HelpCircle,
	Plus,
	Search,
	Filter,
	Wand2,
	RefreshCw,
	MoreHorizontal,
	Edit,
	Trash2,
	CheckCircle,
	AlertTriangle,
	User,
	FileText,
	Tag,
	ArrowUpDown,
	Eye,
} from "lucide-react";
import { QuestionCard } from "./QuestionCard";
import { anticipateQuestions, createQAItem, deleteQAItem } from "@/lib/actions/presentations";
import type {
	PresentationQA,
	PresentationSlide,
	QuestionCategory,
	QuestionDifficulty,
	QUESTION_CATEGORY_CONFIG,
} from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface QAPreparerProps {
	/** Presentation ID */
	presentationId: string;
	/** Existing Q&A items */
	qaItems: PresentationQA[];
	/** All slides for reference */
	slides: PresentationSlide[];
	/** Callback when Q&A items change */
	onQAChange?: (items: PresentationQA[]) => void;
	/** Additional class names */
	className?: string;
}

type SortOption = "priority" | "difficulty" | "category" | "created";
type FilterOption = "all" | QuestionCategory | QuestionDifficulty | "reviewed" | "unreviewed";

// ============================================================================
// Configuration
// ============================================================================

const CATEGORY_CONFIG: Record<QuestionCategory, { label: string; color: string; icon: typeof HelpCircle }> = {
	technical: { label: "Technical", color: "blue", icon: FileText },
	management: { label: "Management", color: "purple", icon: User },
	cost: { label: "Cost/Pricing", color: "green", icon: Tag },
	past_performance: { label: "Past Performance", color: "amber", icon: CheckCircle },
	clarification: { label: "Clarification", color: "gray", icon: HelpCircle },
};

const DIFFICULTY_CONFIG: Record<QuestionDifficulty, { label: string; color: string }> = {
	easy: { label: "Easy", color: "green" },
	medium: { label: "Medium", color: "yellow" },
	hard: { label: "Hard", color: "red" },
};

// ============================================================================
// Component
// ============================================================================

export function QAPreparer({
	presentationId,
	qaItems: initialQAItems,
	slides,
	onQAChange,
	className,
}: QAPreparerProps) {
	// State
	const [qaItems, setQAItems] = useState<PresentationQA[]>(initialQAItems);
	const [selectedQAId, setSelectedQAId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<FilterOption>("all");
	const [sortBy, setSortBy] = useState<SortOption>("priority");
	const [isGenerating, setIsGenerating] = useState(false);
	const [showNewForm, setShowNewForm] = useState(false);

	// Derived state
	const selectedQA = useMemo(
		() => qaItems.find((q) => q.id === selectedQAId) ?? null,
		[qaItems, selectedQAId]
	);

	const filteredQAItems = useMemo(() => {
		let items = [...qaItems];

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			items = items.filter(
				(q) =>
					q.likelyQuestion.toLowerCase().includes(query) ||
					(q.suggestedAnswer?.toLowerCase().includes(query) ?? false)
			);
		}

		// Category/difficulty filter
		if (filter !== "all") {
			if (filter === "reviewed") {
				items = items.filter((q) => q.isReviewed);
			} else if (filter === "unreviewed") {
				items = items.filter((q) => !q.isReviewed);
			} else if (Object.keys(CATEGORY_CONFIG).includes(filter)) {
				items = items.filter((q) => q.questionCategory === filter);
			} else if (Object.keys(DIFFICULTY_CONFIG).includes(filter)) {
				items = items.filter((q) => q.difficulty === filter);
			}
		}

		// Sort
		items.sort((a, b) => {
			switch (sortBy) {
				case "priority":
					// Higher probability = higher priority (sort descending)
					return (b.probability ?? 0) - (a.probability ?? 0);
				case "difficulty":
					const diffOrder: Record<string, number> = { hard: 0, medium: 1, easy: 2 };
					return (diffOrder[a.difficulty ?? "medium"] ?? 1) - (diffOrder[b.difficulty ?? "medium"] ?? 1);
				case "category":
					return (a.questionCategory ?? "").localeCompare(b.questionCategory ?? "");
				case "created":
					return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
				default:
					return 0;
			}
		});

		return items;
	}, [qaItems, searchQuery, filter, sortBy]);

	// Statistics
	const stats = useMemo(() => {
		const total = qaItems.length;
		const reviewed = qaItems.filter((q) => q.isReviewed).length;
		const byCategory = Object.keys(CATEGORY_CONFIG).reduce(
			(acc, cat) => {
				acc[cat as QuestionCategory] = qaItems.filter((q) => q.questionCategory === cat).length;
				return acc;
			},
			{} as Record<QuestionCategory, number>
		);
		const byDifficulty = Object.keys(DIFFICULTY_CONFIG).reduce(
			(acc, diff) => {
				acc[diff as QuestionDifficulty] = qaItems.filter((q) => q.difficulty === diff).length;
				return acc;
			},
			{} as Record<QuestionDifficulty, number>
		);

		return { total, reviewed, byCategory, byDifficulty };
	}, [qaItems]);

	// Handlers
	const handleGenerateQuestions = useCallback(async () => {
		setIsGenerating(true);
		try {
			const result = await anticipateQuestions(presentationId);
			if (result.success && result.data) {
				setQAItems((prev) => [...prev, ...result.data]);
				onQAChange?.([...qaItems, ...result.data]);
			}
		} finally {
			setIsGenerating(false);
		}
	}, [presentationId, qaItems, onQAChange]);

	const handleAddQuestion = useCallback(async (question: string, category: QuestionCategory) => {
		const result = await createQAItem(presentationId, {
			likelyQuestion: question,
			suggestedAnswer: "",
			questionCategory: category,
			difficulty: "medium",
		});

		if (result.success && result.data) {
			setQAItems((prev) => [...prev, result.data]);
			setSelectedQAId(result.data.id);
			setShowNewForm(false);
			onQAChange?.([...qaItems, result.data]);
		}
	}, [presentationId, qaItems, onQAChange]);

	const handleDeleteQuestion = useCallback(async (qaId: string) => {
		const result = await deleteQAItem(qaId);
		if (result.success) {
			const updated = qaItems.filter((q) => q.id !== qaId);
			setQAItems(updated);
			if (selectedQAId === qaId) {
				setSelectedQAId(null);
			}
			onQAChange?.(updated);
		}
	}, [qaItems, selectedQAId, onQAChange]);

	const handleUpdateQuestion = useCallback((qaId: string, updates: Partial<PresentationQA>) => {
		const updated = qaItems.map((q) =>
			q.id === qaId ? { ...q, ...updates } : q
		);
		setQAItems(updated);
		onQAChange?.(updated);
	}, [qaItems, onQAChange]);

	return (
		<TooltipProvider>
			<div className={cn("flex flex-col h-full", className)}>
				{/* Header */}
				<div className="p-3 border-b space-y-3">
					<div className="flex items-center justify-between">
						<h3 className="font-medium flex items-center gap-2">
							<HelpCircle className="h-4 w-4" />
							Q&A Preparation
						</h3>

						<Button
							variant="outline"
							size="sm"
							onClick={handleGenerateQuestions}
							disabled={isGenerating}
						>
							{isGenerating ? (
								<RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
							) : (
								<Wand2 className="h-3.5 w-3.5 mr-1" />
							)}
							Generate
						</Button>
					</div>

					{/* Stats */}
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="secondary" className="gap-1">
							{stats.total} questions
						</Badge>
						<Badge variant="outline" className="gap-1">
							<CheckCircle className="h-3 w-3" />
							{stats.reviewed} reviewed
						</Badge>
					</div>

					{/* Search & Filter */}
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								placeholder="Search questions..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-8 pl-7 text-sm"
							/>
						</div>

						<Select value={filter} onValueChange={(v) => setFilter(v as FilterOption)}>
							<SelectTrigger className="w-[120px] h-8">
								<Filter className="h-3.5 w-3.5 mr-1" />
								<SelectValue placeholder="Filter" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="reviewed">Reviewed</SelectItem>
								<SelectItem value="unreviewed">Unreviewed</SelectItem>
								{Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
									<SelectItem key={key} value={key}>
										{config.label}
									</SelectItem>
								))}
								{Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
									<SelectItem key={key} value={key}>
										{config.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
							<SelectTrigger className="w-[100px] h-8">
								<ArrowUpDown className="h-3.5 w-3.5 mr-1" />
								<SelectValue placeholder="Sort" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="priority">Priority</SelectItem>
								<SelectItem value="difficulty">Difficulty</SelectItem>
								<SelectItem value="category">Category</SelectItem>
								<SelectItem value="created">Created</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Question List */}
				<ScrollArea className="flex-1">
					<div className="p-3 space-y-2">
						{filteredQAItems.length === 0 ? (
							<Card>
								<CardContent className="py-8">
									<div className="text-center text-muted-foreground">
										<HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
										<p className="font-medium">No Questions Yet</p>
										<p className="text-sm mt-1">
											Click "Generate" to create AI-suggested questions
										</p>
										<Button
											variant="outline"
											size="sm"
											className="mt-4"
											onClick={() => setShowNewForm(true)}
										>
											<Plus className="h-4 w-4 mr-1" />
											Add Manually
										</Button>
									</div>
								</CardContent>
							</Card>
						) : (
							filteredQAItems.map((qa) => (
								<QuestionCard
									key={qa.id}
									qa={qa}
									isSelected={selectedQAId === qa.id}
									slides={slides}
									onSelect={() => setSelectedQAId(qa.id)}
									onUpdate={(updates) => handleUpdateQuestion(qa.id, updates)}
									onDelete={() => handleDeleteQuestion(qa.id)}
								/>
							))
						)}
					</div>
				</ScrollArea>

				{/* Add New Question */}
				{showNewForm ? (
					<NewQuestionForm
						onSubmit={handleAddQuestion}
						onCancel={() => setShowNewForm(false)}
					/>
				) : (
					<div className="p-3 border-t">
						<Button
							variant="outline"
							size="sm"
							className="w-full"
							onClick={() => setShowNewForm(true)}
						>
							<Plus className="h-4 w-4 mr-1" />
							Add Question
						</Button>
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}

// ============================================================================
// New Question Form
// ============================================================================

interface NewQuestionFormProps {
	onSubmit: (question: string, category: QuestionCategory) => void;
	onCancel: () => void;
}

function NewQuestionForm({ onSubmit, onCancel }: NewQuestionFormProps) {
	const [question, setQuestion] = useState("");
	const [category, setCategory] = useState<QuestionCategory>("technical");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (question.trim()) {
			onSubmit(question.trim(), category);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="p-3 border-t bg-muted/50 space-y-3">
			<Input
				placeholder="Enter anticipated question..."
				value={question}
				onChange={(e) => setQuestion(e.target.value)}
			/>

			<div className="flex items-center gap-2">
				<Select value={category} onValueChange={(v) => setCategory(v as QuestionCategory)}>
					<SelectTrigger className="flex-1">
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

				<Button type="submit" size="sm" disabled={!question.trim()}>
					Add
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</form>
	);
}
