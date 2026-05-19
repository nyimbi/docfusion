"use client";

/**
 * Comments Panel Component - DocFusion
 *
 * Side panel for displaying and managing document comments.
 * Features:
 * - Threaded comments view
 * - Section-specific comments (click on section to comment)
 * - Filtering by status, type, and user
 * - Comment statistics
 * - Add new comment
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import type {
	DocumentComment,
	CommentFilters,
	CommentStats,
	CommentType,
} from "@/lib/types/comments-workflow";
import {
	getComments,
	createComment,
	getCommentStats,
	resolveSectionComments,
} from "@/lib/actions/comments";
import { CommentThread } from "./CommentThread";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	MessageSquare,
	CheckCircle2,
	Circle,
	Filter,
	Search,
	Plus,
	X,
	MessageCircle,
	Sparkles,
	Check,
	XCircle,
	RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface CommentsPanelProps {
	documentId: string;
	/** Currently selected section ID (for section-specific comments) */
	selectedSectionId?: string | null;
	/** Callback when user selects a section for commenting */
	onSelectSectionForComment?: () => void;
	/** Current user ID */
	currentUserId: string;
	/** Current user info */
	currentUser?: { name: string; avatar?: string };
	/** Optional className */
	className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const COMMENT_TYPE_FILTERS: { value: CommentType | "all"; label: string; icon: React.ReactNode }[] = [
	{ value: "all", label: "All", icon: <MessageSquare className="h-4 w-4" /> },
	{ value: "comment", label: "Comments", icon: <MessageCircle className="h-4 w-4" /> },
	{ value: "suggestion", label: "Suggestions", icon: <Sparkles className="h-4 w-4" /> },
	{ value: "approval", label: "Approvals", icon: <Check className="h-4 w-4" /> },
	{ value: "rejection", label: "Rejections", icon: <XCircle className="h-4 w-4" /> },
];

// ============================================================================
// Components
// ============================================================================

export function CommentsPanel({
	documentId,
	selectedSectionId,
	onSelectSectionForComment,
	currentUserId,
	currentUser,
	className,
}: CommentsPanelProps) {
	const [comments, setComments] = useState<DocumentComment[]>([]);
	const [stats, setStats] = useState<CommentStats | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [newComment, setNewComment] = useState("");
	const [selectedCommentType, setSelectedCommentType] = useState<CommentType>("comment");

	// Filters
	const [showResolved, setShowResolved] = useState(false);
	const [selectedType, setSelectedType] = useState<CommentType | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch comments
	const fetchComments = useCallback(async () => {
		setIsLoading(true);
		try {
			const filters: CommentFilters = {
				documentId,
				parentId: null, // Get top-level comments only
				resolved: showResolved ? undefined : false,
				type: selectedType === "all" ? undefined : selectedType,
				search: searchQuery || undefined,
			};

			const result = await getComments(filters, { limit: 100 });
			setComments(result.comments);

			// Fetch stats
			const statsResult = await getCommentStats(documentId);
			setStats(statsResult);
		} finally {
			setIsLoading(false);
		}
	}, [documentId, showResolved, selectedType, searchQuery]);

	useEffect(() => {
		fetchComments();
	}, [fetchComments, documentId, showResolved, selectedType]);

	// Create new comment
	const handleCreateComment = async () => {
		if (!newComment.trim()) return;

		await createComment(
			{
				documentId,
				sectionId: selectedSectionId || undefined,
				content: newComment,
				type: selectedCommentType,
			},
			currentUserId
		);

		setNewComment("");
		setIsCreating(false);
		fetchComments();
	};

	// Resolve all in section
	const handleResolveSection = async () => {
		if (!selectedSectionId) return;
		await resolveSectionComments(selectedSectionId, currentUserId, documentId);
		fetchComments();
	};

	// Clear filters
	const handleClearFilters = () => {
		setShowResolved(false);
		setSelectedType("all");
		setSearchQuery("");
	};

	// Active filter count
	const activeFilterCount = [
		showResolved,
		selectedType !== "all",
		searchQuery,
	].filter(Boolean).length;

	return (
		<div className={cn("flex flex-col h-full bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b">
				<div className="flex items-center gap-2">
					<MessageSquare className="h-5 w-5 text-gray-500" />
					<h2 className="font-semibold text-gray-900">Comments</h2>
					{stats && (
						<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
							{stats.unresolved}
						</span>
						)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsCreating(!isCreating)}
					className="h-8 w-8 p-0"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			{/* Section indicator */}
			{selectedSectionId && (
				<div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
					<span className="text-sm text-blue-700">
						Showing comments for selected section
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							onSelectSectionForComment?.();
						}}
						className="text-blue-600 hover:text-blue-700"
					>
						Clear
					</Button>
				</div>
			)}

			{/* Filters */}
			<div className="px-4 py-3 border-b space-y-3">
				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search comments..."
						className="pl-9 h-9"
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="absolute right-3 top-1/2 -translate-y-1/2"
						>
							<X className="h-4 w-4 text-gray-400" />
						</button>
					)}
				</div>

				{/* Type filter */}
				<div className="flex flex-wrap gap-1">
					{COMMENT_TYPE_FILTERS.map((filter) => (
						<button
							key={filter.value}
							onClick={() => setSelectedType(filter.value)}
							className={cn(
								"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
								selectedType === filter.value
									? "bg-blue-100 text-blue-700"
									: "bg-gray-100 text-gray-600 hover:bg-gray-200"
							)}
						>
							{filter.icon}
							{filter.label}
						</button>
					))}
				</div>

				{/* Resolved filter */}
				<div className="flex items-center gap-2">
					<button
						onClick={() => setShowResolved(!showResolved)}
						className={cn(
							"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
							showResolved
								? "bg-green-100 text-green-700"
								: "bg-gray-100 text-gray-600 hover:bg-gray-200"
						)}
					>
						{showResolved ? (
							<CheckCircle2 className="h-3.5 w-3.5" />
						) : (
							<Circle className="h-3.5 w-3.5" />
						)}
						{showResolved ? "Showing resolved" : "Hide resolved"}
					</button>

					{activeFilterCount > 0 && (
						<button
							onClick={handleClearFilters}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100"
						>
							<RotateCcw className="h-3.5 w-3.5" />
							Clear filters
						</button>
					)}
				</div>

				{/* Stats */}
				{stats && (
					<div className="flex items-center gap-4 text-xs text-gray-500">
						<span>{stats.total} total</span>
						<span>{stats.resolved} resolved</span>
						<span>{stats.unresolved} pending</span>
					</div>
				)}
			</div>

			{/* Create comment form */}
			{isCreating && (
				<div className="p-4 border-b bg-gray-50">
					{!selectedSectionId && onSelectSectionForComment && (
						<div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
							Click on a section in the document to comment on it,
							or
							<button
								onClick={onSelectSectionForComment}
								className="font-medium underline ml-1"
							>
								add a general comment
							</button>
							.s
						</div>
					)}

					<Textarea
						value={newComment}
						onChange={(e) => setNewComment(e.target.value)}
						placeholder="Write your comment..."
						className="min-h-[100px] mb-3"
					/>

					{/* Comment type selector */}
					<div className="flex gap-2 mb-3">
						{["comment", "suggestion", "approval", "rejection"].map((type) => (
							<button
								key={type}
								onClick={() => setSelectedCommentType(type as CommentType)}
								className={cn(
									"px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize",
									selectedCommentType === type
										? "bg-blue-100 text-blue-700"
										: "bg-white border hover:bg-gray-50 text-gray-600"
								)}
							>
								{type}
							</button>
						))}
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handleCreateComment}
							disabled={!newComment.trim()}
						>
							Add Comment
						</Button>
					</div>
				</div>
			)}

			{/* Comments list */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{isLoading ? (
					<div className="flex items-center justify-center h-32">
						<div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full" />
					</div>
				) : comments.length === 0 ? (
					<div className="text-center py-8">
						<MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
						<p className="text-gray-500 text-sm">
							{activeFilterCount > 0
								? "No comments match your filters"
									: "No comments yet"}
						</p>
						{activeFilterCount > 0 ? (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleClearFilters}
								className="mt-2"
							>
								Clear filters
							</Button>
						) : (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsCreating(true)}
								className="mt-2"
							>
								Be the first to comment
							</Button>
						)}
					</div>
				) : (
					<div className="space-y-4">
						{comments.map((comment) => (
							<CommentThread
								key={comment.id}
								comment={comment}
								currentUserId={currentUserId}
								sectionId={selectedSectionId || undefined}
								onCommentUpdated={fetchComments}
								currentUser={currentUser}
							/>
						))}
					</div>
				)}
			</div>

			{/* Footer actions */}
			{selectedSectionId && (
				<div className="px-4 py-3 border-t bg-gray-50">
					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={handleResolveSection}
					>
						<CheckCircle2 className="h-4 w-4 mr-2" />
						Resolve all section comments
					</Button>
				</div>
			)}
		</div>
	);
}

export default CommentsPanel;
