"use client";

/**
 * Comment Thread Component - DocFusion
 *
 * Displays a thread of comments with reply functionality.
 * Supports different comment types (comment, suggestion, approval, rejection)
 * and reactions.
 */

import React, { useState, useCallback, useMemo } from "react";
import type { DocumentComment, CommentType, AvailableReaction } from "@/lib/types/comments-workflow";
import {
	createComment,
	updateComment,
	deleteComment,
	resolveComment,
	addCommentReaction,
	removeCommentReaction,
	getCommentReactions,
} from "@/lib/actions/comments";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import {
	MessageCircle,
	Check,
	X,
	Edit2,
	Trash2,
	CornerDownRight,
	Reply,
	ThumbsUp,
	ThumbsDown,
	Heart,
	Sparkles,
	Eye,
	HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface CommentThreadProps {
	/** Root comment with nested replies */
	comment: DocumentComment;
	/** Current user ID */
	currentUserId: string;
	/** Optional section ID for context */
	sectionId?: string;
	/** Callback when comment changes */
	onCommentUpdated?: () => void;
	/** Depth level for nesting styling */
	depth?: number;
	/** Maximum nesting depth */
	maxDepth?: number;
	/** Current user's name/avatar for replies */
	currentUser?: { name: string; avatar?: string };
}

interface CommentItemProps {
	comment: DocumentComment;
	currentUserId: string;
	depth: number;
	maxDepth: number;
	isReply?: boolean;
	onReply?: () => void;
	currentUser?: { name: string; avatar?: string };
}

// ============================================================================
// Constants
// ============================================================================

const COMMENT_TYPE_STYLES: Record<
	CommentType,
	{ icon: React.ReactNode; color: string; bg: string; label: string }
> = {
	comment: {
		icon: <MessageCircle className="h-3.5 w-3.5" />,
		color: "text-blue-600",
		bg: "bg-blue-50",
		label: "Comment",
	},
	suggestion: {
		icon: <Sparkles className="h-3.5 w-3.5" />,
		color: "text-purple-600",
		bg: "bg-purple-50",
		label: "Suggestion",
	},
	approval: {
		icon: <Check className="h-3.5 w-3.5" />,
		color: "text-green-600",
		bg: "bg-green-50",
		label: "Approval",
	},
	rejection: {
		icon: <X className="h-3.5 w-3.5" />,
		color: "text-red-600",
		bg: "bg-red-50",
		label: "Rejection",
	},
};

const AVAILABLE_REACTIONS: { emoji: AvailableReaction; icon: React.ReactNode }[] = [
	{ emoji: "👍", icon: <ThumbsUp className="h-4 w-4" /> },
	{ emoji: "👎", icon: <ThumbsDown className="h-4 w-4" /> },
	{ emoji: "❤️", icon: <Heart className="h-4 w-4" /> },
	{ emoji: "✅", icon: <Check className="h-4 w-4" /> },
	{ emoji: "🤔", icon: <Eye className="h-4 w-4" /> },
	{ emoji: "❓", icon: <HelpCircle className="h-4 w-4" /> },
];

// ============================================================================
// Comment Item Component
// ============================================================================

function CommentItem({
	comment,
	currentUserId,
	depth,
	maxDepth,
	isReply = false,
	onReply,
	currentUser,
}: CommentItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showReactions, setShowReactions] = useState(false);
	const [reactions, setReactions] = useState<Record<string, number>>({});
	const [hasLoadedReactions, setHasLoadedReactions] = useState(false);

	const isAuthor = comment.userId === currentUserId;
	const isResolved = comment.resolvedAt !== null;
	const canEdit = isAuthor && !isResolved;
	const timeAgo = useMemo(
		() => formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }),
		[comment.createdAt]
	);
	const typeStyle = COMMENT_TYPE_STYLES[comment.type];

	// Load reactions on hover
	const handleMouseEnter = useCallback(async () => {
		if (!hasLoadedReactions) {
			const reactionData = await getCommentReactions(comment.id);
			setReactions(reactionData);
			setHasLoadedReactions(true);
		}
	}, [comment.id, hasLoadedReactions]);

	const handleSaveEdit = async () => {
		if (!editContent.trim()) return;
		setIsSubmitting(true);
		try {
			await updateComment(comment.id, { content: editContent }, currentUserId);
			setIsEditing(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this comment?")) return;
		await deleteComment(comment.id, currentUserId);
	};

	const handleResolve = async () => {
		await resolveComment(comment.id, { resolved: !isResolved }, currentUserId);
	};

	const handleReaction = async (emoji: AvailableReaction) => {
		// Toggle reaction
		if (reactions[emoji] && reactions[emoji] > 0) {
			await removeCommentReaction(comment.id, currentUserId);
			setReactions((prev) => ({ ...prev, [emoji]: (prev[emoji] || 1) - 1 }));
		} else {
			await addCommentReaction(comment.id, emoji, currentUserId);
			setReactions((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
		}
		setShowReactions(false);
	};

	return (
		<div
			className={cn(
				"group relative",
				isReply && "pl-0",
				depth > 0 && "border-l-2 border-gray-200 pl-4"
			)}
			onMouseEnter={handleMouseEnter}
		>
			{/* Thread connector line for replies */}
			{isReply && (
				<div className="absolute -left-4 top-0 bottom-0 w-4">
					<div className="absolute left-0 top-6 w-4 h-px bg-gray-300" />
					<CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-gray-400" />
				</div>
			)}

			<div
				className={cn(
					"flex gap-3 p-3 rounded-lg transition-colors",
					isResolved ? "bg-gray-50 opacity-75" : "bg-white hover:bg-gray-50"
				)}
			>
				{/* Avatar */}
				<div className="flex-shrink-0">
					<div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
						{comment.userName?.charAt(0).toUpperCase() || "U"}
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Header */}
					<div className="flex items-center gap-2 mb-1">
						<span className="font-medium text-sm text-gray-900">
							{comment.userName || comment.userId}
						</span>
						<span className="text-xs text-gray-500">{timeAgo}</span>
						{comment.isEdited && (
							<span className="text-xs text-gray-400">(edited)</span>
						)}
						{/* Type badge */}
						<span
							className={cn(
								"inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
								typeStyle.bg,
								typeStyle.color
							)}
						>
							{typeStyle.icon}
							{typeStyle.label}
						</span>
						{isResolved && (
							<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
								<Check className="h-3 w-3" />
								Resolved
							</span>
						)}
					</div>

					{/* Content */}
					{isEditing ? (
						<div className="space-y-2">
							<Textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								className="min-h-[80px] text-sm"
								placeholder="Edit your comment..."
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									onClick={handleSaveEdit}
									disabled={isSubmitting || !editContent.trim()}
								>
									Save
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setIsEditing(false);
										setEditContent(comment.content);
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="text-sm text-gray-700 whitespace-pre-wrap">
							{comment.content}
						</div>
					)}

					{/* Reactions */}
					{Object.entries(reactions).some(([, count]) => count > 0) && (
						<div className="flex flex-wrap gap-1 mt-2">
							{Object.entries(reactions).map(
								([emoji, count]) =>
									count > 0 && (
										<button
											key={emoji}
											onClick={() => handleReaction(emoji as AvailableReaction)}
											className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs transition-colors"
										>
											<span>{emoji}</span>
											<span>{count}</span>
										</button>
										)
							)}
						</div>
					)}

					{/* Actions */}
					{!isEditing && (
						<div className="flex items-center gap-1 mt-2">
							{/* Reply button */}
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={onReply}
							>
								<Reply className="h-3.5 w-3.5 mr-1" />
								Reply
							</Button>

							{/* Reaction picker */}
							<div className="relative">
								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs"
									onClick={() => setShowReactions(!showReactions)}
								>
									<ThumbsUp className="h-3.5 w-3.5 mr-1" />
									React
								</Button>
								{showReactions && (
									<div className="absolute top-full left-0 mt-1 flex gap-1 p-2 bg-white rounded-lg shadow-lg border z-10">
										{AVAILABLE_REACTIONS.map(({ emoji, icon }) => (
											<button
												key={emoji}
												onClick={() => handleReaction(emoji)}
												className={cn(
													"p-1.5 rounded hover:bg-gray-100 transition-colors",
													reactions[emoji] && "bg-blue-50"
												)}
												title={emoji}
											>
												{icon}
											</button>
										))}
									</div>
								)}
							</div>

							{/* Resolve button */}
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={handleResolve}
							>
								{isResolved ? (
									<>
										<X className="h-3.5 w-3.5 mr-1" />
										Unresolve
									</>
								) : (
									<>
										<Check className="h-3.5 w-3.5 mr-1" />
										Resolve
									</>
								)}
							</Button>

							{/* Edit/Delete (author only) */}
							{canEdit && (
								<>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100"
										onClick={() => setIsEditing(true)}
									>
										<Edit2 className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-xs text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100"
										onClick={handleDelete}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Reply Editor Component
// ============================================================================

function ReplyEditor({
	onSubmit,
	onCancel,
	placeholder = "Write a reply...",
	currentUser,
}: {
	onSubmit: (content: string, type?: CommentType) => void;
	onCancel: () => void;
	placeholder?: string;
	currentUser?: { name: string; avatar?: string };
}) {
	const [content, setContent] = useState("");
	const [selectedType, setSelectedType] = useState<CommentType>("comment");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!content.trim()) return;
		setIsSubmitting(true);
		try {
			onSubmit(content, selectedType);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
			<div className="flex-shrink-0">
				<div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
					{currentUser?.name?.charAt(0).toUpperCase() || "Y"}
				</div>
			</div>
			<div className="flex-1 space-y-2">
				{/* Comment type selector */}
				<div className="flex gap-1">
					{(Object.keys(COMMENT_TYPE_STYLES) as CommentType[]).map((type) => (
						<button
							key={type}
							onClick={() => setSelectedType(type)}
							className={cn(
								"px-2 py-1 rounded text-xs font-medium transition-colors",
								selectedType === type
									? "bg-blue-100 text-blue-700"
									: "bg-white text-gray-600 hover:bg-gray-100"
							)}
						>
							{COMMENT_TYPE_STYLES[type].label}
						</button>
					))}
				</div>

				<Textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder={placeholder}
					className="min-h-[80px] text-sm"
				/>

				<div className="flex justify-between items-center">
					<span className="text-xs text-gray-500">
						Posting as{" "}
						<span className="font-medium">{currentUser?.name || "You"}</span>
					</span>
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="ghost"
							onClick={onCancel}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handleSubmit}
							disabled={!content.trim() || isSubmitting}
						>
							Reply
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Main CommentThread Component
// ============================================================================

export function CommentThread({
	comment,
	currentUserId,
	sectionId,
	onCommentUpdated,
	depth = 0,
	maxDepth = 5,
	currentUser,
}: CommentThreadProps) {
	const [replyingTo, setReplyingTo] = useState<string | null>(null);

	// Flatten replies for display, respecting max depth
	const displayComment = useMemo(() => {
		return comment;
	}, [comment]);

	// Update callback when comment changes
	const handleUpdate = useCallback(() => {
		onCommentUpdated?.();
	}, [onCommentUpdated]);

	// Handle reply submission
	const handleReply = async (parentId: string, content: string, type?: CommentType) => {
		await createComment(
			{
				documentId: comment.documentId,
				sectionId,
				content,
				type,
				parentId,
			},
			currentUserId
		);
		setReplyingTo(null);
		handleUpdate();
	};

	const replies = comment.replies || [];

	return (
		<div className={cn("space-y-3", depth > 0 && "ml-0")}>
			{/* Main comment */}
			<CommentItem
				comment={displayComment}
				currentUserId={currentUserId}
				depth={depth}
				maxDepth={maxDepth}
				onReply={() => setReplyingTo(comment.id)}
				currentUser={currentUser}
			/>

			{/* Reply input for main comment */}
			{replyingTo === comment.id && (
				<div className={cn("ml-0", depth < maxDepth && "ml-4")}>
					<ReplyEditor
						onSubmit={(content, type) => handleReply(comment.id, content, type)}
						onCancel={() => setReplyingTo(null)}
						placeholder="Write a reply..."
						currentUser={currentUser}
					/>
				</div>
			)}

			{/* Replies */}
			{replies.length > 0 && (
				<div className={cn("space-y-2", depth < maxDepth && "ml-4 border-l-2 border-gray-200 pl-4")}>
					{replies.map((reply) =>
						depth < maxDepth ? (
							<CommentThread
								key={reply.id}
								comment={reply}
								currentUserId={currentUserId}
								sectionId={sectionId}
								onCommentUpdated={handleUpdate}
								depth={depth + 1}
								maxDepth={maxDepth}
								currentUser={currentUser}
							/>
						) : (
							<CommentItem
								key={reply.id}
								comment={reply}
								currentUserId={currentUserId}
								depth={depth}
								maxDepth={maxDepth}
								isReply
								currentUser={currentUser}
							/>
						)
					)}
				</div>
			)}
		</div>
	);
}

export default CommentThread;
