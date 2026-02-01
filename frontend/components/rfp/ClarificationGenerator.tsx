/**
 * ClarificationGenerator Component
 *
 * AI-powered interface for generating clarification questions
 * for ambiguous RFP requirements.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	HelpCircle,
	Sparkles,
	Copy,
	Check,
	Plus,
	Trash2,
	Edit2,
	Send,
	RefreshCw,
	FileText,
	AlertTriangle,
	ChevronDown,
	ChevronRight,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface Requirement {
	id: string;
	requirementNumber: string;
	requirementText: string;
	category: string;
	priority: string;
	ambiguityFlag: boolean;
	ambiguityReason: string | null;
}

interface ClarificationQuestion {
	id: string;
	requirementId: string;
	question: string;
	rationale: string;
	status: "draft" | "approved" | "submitted" | "answered";
	answer?: string;
	createdAt: string;
	isAiGenerated: boolean;
}

interface ClarificationGeneratorProps {
	requirement: Requirement;
	existingQuestions?: ClarificationQuestion[];
	onGenerate: (requirementId: string) => Promise<ClarificationQuestion[]>;
	onSaveQuestion: (question: Omit<ClarificationQuestion, "id" | "createdAt">) => Promise<void>;
	onDeleteQuestion: (questionId: string) => Promise<void>;
	onSubmitQuestions?: (questionIds: string[]) => Promise<void>;
	isLoading?: boolean;
	className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ClarificationGenerator({
	requirement,
	existingQuestions = [],
	onGenerate,
	onSaveQuestion,
	onDeleteQuestion,
	onSubmitQuestions,
	isLoading = false,
	className,
}: ClarificationGeneratorProps) {
	const [questions, setQuestions] = useState<ClarificationQuestion[]>(existingQuestions);
	const [generating, setGenerating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");
	const [newQuestion, setNewQuestion] = useState("");
	const [newRationale, setNewRationale] = useState("");
	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [submitting, setSubmitting] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const handleGenerate = useCallback(async () => {
		setGenerating(true);
		try {
			const generatedQuestions = await onGenerate(requirement.id);
			setQuestions((prev) => [...prev, ...generatedQuestions]);
		} finally {
			setGenerating(false);
		}
	}, [onGenerate, requirement.id]);

	const handleAddQuestion = async () => {
		if (!newQuestion.trim()) return;
		await onSaveQuestion({
			requirementId: requirement.id,
			question: newQuestion,
			rationale: newRationale,
			status: "draft",
			isAiGenerated: false,
		});
		setNewQuestion("");
		setNewRationale("");
		setShowAddForm(false);
	};

	const handleSaveEdit = async (questionId: string) => {
		const question = questions.find((q) => q.id === questionId);
		if (!question || !editText.trim()) return;

		await onSaveQuestion({
			...question,
			question: editText,
		});

		setQuestions((prev) =>
			prev.map((q) => (q.id === questionId ? { ...q, question: editText } : q))
		);
		setEditingId(null);
		setEditText("");
	};

	const handleDelete = async (questionId: string) => {
		await onDeleteQuestion(questionId);
		setQuestions((prev) => prev.filter((q) => q.id !== questionId));
		setSelectedIds((prev) => {
			const next = new Set(prev);
			next.delete(questionId);
			return next;
		});
	};

	const handleSubmit = async () => {
		if (!onSubmitQuestions || selectedIds.size === 0) return;
		setSubmitting(true);
		try {
			await onSubmitQuestions(Array.from(selectedIds));
			setQuestions((prev) =>
				prev.map((q) =>
					selectedIds.has(q.id) ? { ...q, status: "submitted" as const } : q
				)
			);
			setSelectedIds(new Set());
		} finally {
			setSubmitting(false);
		}
	};

	const copyToClipboard = async (text: string, id: string) => {
		await navigator.clipboard.writeText(text);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const draftQuestions = questions.filter((q) => q.status === "draft");
	const submittedQuestions = questions.filter(
		(q) => q.status === "submitted" || q.status === "answered"
	);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Requirement Context */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-start gap-3">
					<FileText className="w-5 h-5 text-blue-600 mt-0.5" />
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span className="font-semibold">{requirement.requirementNumber}</span>
							{requirement.ambiguityFlag && (
								<span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
									<AlertTriangle className="w-3 h-3" />
									Ambiguous
								</span>
							)}
						</div>
						<p className="text-sm text-gray-700">{requirement.requirementText}</p>
						{requirement.ambiguityReason && (
							<p className="text-xs text-yellow-700 mt-2 p-2 bg-yellow-50 rounded">
								{requirement.ambiguityReason}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Generate Button */}
			<div className="bg-white rounded-lg border p-4">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-medium flex items-center gap-2">
							<Sparkles className="w-5 h-5 text-purple-600" />
							AI Question Generator
						</h3>
						<p className="text-sm text-gray-500">
							Generate clarification questions using AI analysis
						</p>
					</div>
					<Button
						variant="primary"
						onClick={handleGenerate}
						disabled={generating || isLoading}
					>
						{generating ? (
							<>
								<RefreshCw className="w-4 h-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="w-4 h-4 mr-2" />
								Generate Questions
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Draft Questions */}
			<div className="bg-white rounded-lg border">
				<div className="p-4 border-b flex items-center justify-between">
					<h3 className="font-medium">
						Draft Questions ({draftQuestions.length})
					</h3>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowAddForm(true)}
						>
							<Plus className="w-4 h-4 mr-1" />
							Add Manual
						</Button>
						{onSubmitQuestions && selectedIds.size > 0 && (
							<Button
								variant="primary"
								size="sm"
								onClick={handleSubmit}
								disabled={submitting}
							>
								{submitting ? (
									<RefreshCw className="w-4 h-4 mr-1 animate-spin" />
								) : (
									<Send className="w-4 h-4 mr-1" />
								)}
								Submit Selected ({selectedIds.size})
							</Button>
						)}
					</div>
				</div>

				{/* Add Form */}
				{showAddForm && (
					<div className="p-4 border-b bg-blue-50">
						<div className="space-y-3">
							<div>
								<label className="block text-sm font-medium mb-1">Question</label>
								<textarea
									value={newQuestion}
									onChange={(e) => setNewQuestion(e.target.value)}
									rows={2}
									className="w-full px-3 py-2 border rounded-md"
									placeholder="Enter your clarification question..."
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1">
									Rationale (optional)
								</label>
								<textarea
									value={newRationale}
									onChange={(e) => setNewRationale(e.target.value)}
									rows={2}
									className="w-full px-3 py-2 border rounded-md"
									placeholder="Why is this clarification needed?"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="primary" size="sm" onClick={handleAddQuestion}>
									Add Question
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setShowAddForm(false);
										setNewQuestion("");
										setNewRationale("");
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Questions List */}
				{draftQuestions.length === 0 ? (
					<div className="p-8 text-center text-gray-500">
						<HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p>No draft questions yet.</p>
						<p className="text-sm">
							Generate questions with AI or add them manually.
						</p>
					</div>
				) : (
					<div className="divide-y">
						{draftQuestions.map((question) => (
							<QuestionItem
								key={question.id}
								question={question}
								isSelected={selectedIds.has(question.id)}
								isExpanded={expandedIds.has(question.id)}
								isEditing={editingId === question.id}
								editText={editText}
								copiedId={copiedId}
								onToggleSelect={() => toggleSelect(question.id)}
								onToggleExpand={() => toggleExpand(question.id)}
								onStartEdit={() => {
									setEditingId(question.id);
									setEditText(question.question);
								}}
								onSaveEdit={() => handleSaveEdit(question.id)}
								onCancelEdit={() => {
									setEditingId(null);
									setEditText("");
								}}
								onEditTextChange={setEditText}
								onCopy={() => copyToClipboard(question.question, question.id)}
								onDelete={() => handleDelete(question.id)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Submitted/Answered Questions */}
			{submittedQuestions.length > 0 && (
				<div className="bg-white rounded-lg border">
					<div className="p-4 border-b">
						<h3 className="font-medium">
							Submitted Questions ({submittedQuestions.length})
						</h3>
					</div>
					<div className="divide-y">
						{submittedQuestions.map((question) => (
							<div key={question.id} className="p-4">
								<div className="flex items-start gap-3">
									<div
										className={cn(
											"px-2 py-0.5 text-xs rounded-full",
											question.status === "answered"
												? "bg-green-100 text-green-700"
												: "bg-blue-100 text-blue-700"
										)}
									>
										{question.status === "answered" ? "Answered" : "Submitted"}
									</div>
									<div className="flex-1">
										<p className="text-sm font-medium">{question.question}</p>
										{question.answer && (
											<div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
												<p className="text-sm text-gray-700">{question.answer}</p>
											</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface QuestionItemProps {
	question: ClarificationQuestion;
	isSelected: boolean;
	isExpanded: boolean;
	isEditing: boolean;
	editText: string;
	copiedId: string | null;
	onToggleSelect: () => void;
	onToggleExpand: () => void;
	onStartEdit: () => void;
	onSaveEdit: () => void;
	onCancelEdit: () => void;
	onEditTextChange: (text: string) => void;
	onCopy: () => void;
	onDelete: () => void;
}

function QuestionItem({
	question,
	isSelected,
	isExpanded,
	isEditing,
	editText,
	copiedId,
	onToggleSelect,
	onToggleExpand,
	onStartEdit,
	onSaveEdit,
	onCancelEdit,
	onEditTextChange,
	onCopy,
	onDelete,
}: QuestionItemProps) {
	return (
		<div className={cn("p-4", isSelected && "bg-blue-50")}>
			<div className="flex items-start gap-3">
				<input
					type="checkbox"
					checked={isSelected}
					onChange={onToggleSelect}
					className="mt-1 rounded"
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2 mb-1">
							{question.isAiGenerated && (
								<Sparkles className="w-4 h-4 text-purple-500" />
							)}
							<button
								onClick={onToggleExpand}
								className="text-gray-400 hover:text-gray-600"
							>
								{isExpanded ? (
									<ChevronDown className="w-4 h-4" />
								) : (
									<ChevronRight className="w-4 h-4" />
								)}
							</button>
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={onCopy}
								className="p-1"
							>
								{copiedId === question.id ? (
									<Check className="w-4 h-4 text-green-600" />
								) : (
									<Copy className="w-4 h-4" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={onStartEdit}
								className="p-1"
							>
								<Edit2 className="w-4 h-4" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={onDelete}
								className="p-1 text-red-600 hover:text-red-700"
							>
								<Trash2 className="w-4 h-4" />
							</Button>
						</div>
					</div>

					{isEditing ? (
						<div className="space-y-2">
							<textarea
								value={editText}
								onChange={(e) => onEditTextChange(e.target.value)}
								rows={3}
								className="w-full px-3 py-2 border rounded-md text-sm"
							/>
							<div className="flex items-center gap-2">
								<Button variant="primary" size="sm" onClick={onSaveEdit}>
									Save
								</Button>
								<Button variant="ghost" size="sm" onClick={onCancelEdit}>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<p className="text-sm">{question.question}</p>
					)}

					{isExpanded && question.rationale && (
						<div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
							<span className="font-medium">Rationale:</span> {question.rationale}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
