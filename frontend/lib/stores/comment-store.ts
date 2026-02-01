"use client";

/**
 * Comment Store - State management for document comments.
 *
 * Manages comment state including:
 * - Active comments
 * - Comment visibility toggle
 * - New comment creation
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type CommentStatus = "draft" | "published" | "resolved";

export interface Comment {
	id: string;
	authorId: string;
	authorName: string;
	authorAvatar?: string;
	content: string;
	documentId: string;
	sectionId?: string;
	blockId?: string;
	position?: {
		from: number;
		to: number;
	};
	status: CommentStatus;
	parentId?: string;
	createdAt: string;
	updatedAt: string;
	resolved: boolean;
	replies?: Comment[];
}

interface CommentState {
	// State
	comments: Comment[];
	isCommentsVisible: boolean;
	isEditingComment: boolean;
	activeCommentId: string | null;
	selectedBlockId: string | null;
	
	// Actions
	toggleComments: () => void;
	showComments: () => void;
	hideComments: () => void;
	addComment: (comment: Omit<Comment, "id" | "createdAt" | "updatedAt">) => void;
	runComment: (commentId: string) => void;
	resolveComment: (commentId: string) => void;
	deleteComment: (commentId: string) => void;
	setActiveComment: (commentId: string | null) => void;
	setEditingComment: (isEditing: boolean) => void;
	setSelectedBlock: (blockId: string | null) => void;
	setComments: (comments: Comment[]) => void;
}

const initialComments: Comment[] = [
	// Example comments - would be fetched from API
];

export const useCommentStore = create<CommentState>()(
	immer((set) => ({
		// Initial state
		comments: initialComments,
		isCommentsVisible: true,
		isEditingComment: false,
		activeCommentId: null,
		selectedBlockId: null,

		// Actions
		toggleComments: () =>
			set((state) => {
				state.isCommentsVisible = !state.isCommentsVisible;
			}),

		showComments: () =>
			set((state) => {
				state.isCommentsVisible = true;
			}),

		hideComments: () =>
			set((state) => {
				state.isCommentsVisible = false;
			}),

		addComment: (commentData) =>
			set((state) => {
				const now = new Date().toISOString();
				const comment: Comment = {
					...commentData,
					id: `c_${Date.now()}`,
					createdAt: now,
					updatedAt: now,
				};
				state.comments.push(comment);
				state.isEditingComment = false;
			}),

		runComment: (commentId) =>
			set((state) => {
				const comment = state.comments.find((c) => c.id === commentId);
				if (comment) {
					comment.status = "published";
					comment.updatedAt = new Date().toISOString();
				}
			}),

		resolveComment: (commentId) =>
			set((state) => {
				const comment = state.comments.find((c) => c.id === commentId);
				if (comment) {
					comment.resolved = true;
					comment.status = "resolved";
					comment.updatedAt = new Date().toISOString();
				}
			}),

		deleteComment: (commentId) =>
			set((state) => {
				state.comments = state.comments.filter((c) => c.id !== commentId);
			}),

		setActiveComment: (commentId) =>
			set((state) => {
				state.activeCommentId = commentId;
			}),

		setEditingComment: (isEditing) =>
			set((state) => {
				state.isEditingComment = isEditing;
			}),

		setSelectedBlock: (blockId) =>
			set((state) => {
				state.selectedBlockId = blockId;
			}),

		setComments: (comments) =>
			set((state) => {
				state.comments = comments;
			}),
	}))
);
