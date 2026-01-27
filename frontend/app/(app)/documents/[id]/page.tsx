/**
 * Document Editor Page - DocFusion
 *
 * A sophisticated, distraction-free writing environment with
 * split-pane editing, AI commands, and elegant micro-interactions.
 */

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDocument } from "@/lib/query/hooks/useDocuments";
import {
	useSaveDocumentContent,
	useUpdateDocument,
} from "@/lib/query/mutations/useDocumentMutation";
import { useAutosave, useUnsavedChangesWarning } from "@/lib/editor/autosave";
import { useEditorStore } from "@/lib/stores/editor-store";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { MarkdownPane } from "@/components/editor/MarkdownPane";
import { SplitPane } from "@/components/editor/SplitPane";
import { EditorStatusBar } from "@/components/editor/EditorStatusBar";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import type { DocumentContent, Document } from "@/lib/types/document";
import type { Editor } from "@tiptap/react";
import {
	ArrowLeft,
	Save,
	Share2,
	Settings,
	MoreHorizontal,
	Download,
	Printer,
	History,
	Users,
	FileText,
	Eye,
	Edit3,
	Columns,
	Check,
	Cloud,
	CloudOff,
	Loader2,
} from "lucide-react";
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
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Document editor page.
 */
export default function DocumentPage() {
	const params = useParams();
	const router = useRouter();
	const documentId = params.id as string;

	// Fetch document
	const { data: document, isLoading, error } = useDocument(documentId);

	if (isLoading) {
		return <EditorSkeleton />;
	}

	if (error || !document) {
		return <DocumentNotFound />;
	}

	return <DocumentEditor document={document} />;
}

/**
 * Loading skeleton for the editor.
 */
function EditorSkeleton() {
	return (
		<div className="h-screen flex flex-col bg-[var(--background)]">
			{/* Header skeleton */}
			<header className="flex-shrink-0 h-14 border-b border-[var(--border)] flex items-center px-4 gap-4">
				<div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--background-muted)] animate-pulse" />
				<div className="h-6 w-48 rounded bg-[var(--background-muted)] animate-pulse" />
				<div className="flex-1" />
				<div className="flex gap-2">
					<div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--background-muted)] animate-pulse" />
					<div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--background-muted)] animate-pulse" />
				</div>
			</header>

			{/* Editor skeleton */}
			<main className="flex-1 flex">
				<div className="flex-1 p-8">
					<div className="max-w-3xl mx-auto space-y-4">
						<div className="h-8 w-3/4 rounded bg-[var(--background-muted)] animate-pulse" />
						<div className="h-4 w-full rounded bg-[var(--background-muted)] animate-pulse" />
						<div className="h-4 w-full rounded bg-[var(--background-muted)] animate-pulse" />
						<div className="h-4 w-2/3 rounded bg-[var(--background-muted)] animate-pulse" />
					</div>
				</div>
			</main>

			{/* Status bar skeleton */}
			<footer className="flex-shrink-0 h-8 border-t border-[var(--border)] bg-[var(--background-subtle)]" />
		</div>
	);
}

/**
 * Document not found state.
 */
function DocumentNotFound() {
	const router = useRouter();

	return (
		<div className="h-screen flex items-center justify-center bg-[var(--background)]">
			<div className="text-center animate-fade-up">
				<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--background-muted)] flex items-center justify-center">
					<FileText className="h-10 w-10 text-[var(--foreground-subtle)]" />
				</div>
				<h2 className="heading-display text-2xl text-[var(--foreground)] mb-3">
					Document not found
				</h2>
				<p className="text-[var(--foreground-muted)] max-w-sm mx-auto mb-8">
					The document you're looking for doesn't exist or you don't have
					permission to access it.
				</p>
				<Button onClick={() => router.push("/documents")} variant="primary">
					<ArrowLeft className="h-4 w-4" />
					Back to Documents
				</Button>
			</div>
		</div>
	);
}

/**
 * Document editor component with all state management.
 */
function DocumentEditor({ document }: { document: Document }) {
	const router = useRouter();
	const [content, setContent] = React.useState<DocumentContent>(
		document.content ?? { type: "doc", content: [{ type: "paragraph" }] }
	);
	const [title, setTitle] = React.useState(document.title);
	const [isEditingTitle, setIsEditingTitle] = React.useState(false);
	const [text, setText] = React.useState(document.plainText ?? "");
	const [editor, setEditor] = React.useState<Editor | null>(null);
	const titleInputRef = React.useRef<HTMLInputElement>(null);

	// Store state
	const activePanel = useEditorStore((s) => s.activePanel);
	const setActivePanel = useEditorStore((s) => s.setActivePanel);

	// Mutations
	const saveMutation = useSaveDocumentContent(document.id);
	const updateMutation = useUpdateDocument(document.id);

	// Autosave hook
	const {
		status: saveStatus,
		error: saveError,
		scheduleSave,
		hasUnsavedChanges,
	} = useAutosave(document.id, async (_id, content) => {
		await saveMutation.mutateAsync(content);
	});

	// Warn on navigation with unsaved changes
	useUnsavedChangesWarning(hasUnsavedChanges());

	// Handle content change from Tiptap
	const handleContentChange = React.useCallback(
		(newContent: DocumentContent) => {
			setContent(newContent);
			scheduleSave(newContent);
		},
		[scheduleSave]
	);

	// Handle content change from Markdown pane
	const handleMarkdownContentChange = React.useCallback(
		(newContent: DocumentContent) => {
			setContent(newContent);
			// Update the Tiptap editor
			if (editor && !editor.isDestroyed) {
				editor.commands.setContent(
					newContent as Parameters<typeof editor.commands.setContent>[0]
				);
			}
			scheduleSave(newContent);
		},
		[editor, scheduleSave]
	);

	// Handle text change for word count
	const handleTextChange = React.useCallback((newText: string) => {
		setText(newText);
	}, []);

	// Handle editor ready
	const handleEditorReady = React.useCallback((ed: Editor) => {
		setEditor(ed);
	}, []);

	// Handle title change
	const handleTitleSave = async () => {
		if (title !== document.title) {
			try {
				await updateMutation.mutateAsync({ title });
			} catch (err) {
				console.error("Failed to update title:", err);
				setTitle(document.title); // Revert on error
			}
		}
		setIsEditingTitle(false);
	};

	// Focus title input when editing
	React.useEffect(() => {
		if (isEditingTitle && titleInputRef.current) {
			titleInputRef.current.focus();
			titleInputRef.current.select();
		}
	}, [isEditingTitle]);

	// Calculate word count
	const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
	const characterCount = text.length;

	return (
		<div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden">
			{/* Header */}
			<header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm z-10">
				<div className="flex items-center justify-between px-4 h-14">
					{/* Left: Back button and title */}
					<div className="flex items-center gap-3 min-w-0 flex-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Link
									href="/documents"
									className={cn(
										"p-2 rounded-[var(--radius-md)]",
										"text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
										"hover:bg-[var(--background-muted)]",
										"transition-all duration-[var(--transition-fast)]"
									)}
								>
									<ArrowLeft className="h-5 w-5" />
								</Link>
							</TooltipTrigger>
							<TooltipContent side="bottom">Back to documents</TooltipContent>
						</Tooltip>

						{/* Editable title */}
						<div className="flex-1 min-w-0">
							{isEditingTitle ? (
								<Input
									ref={titleInputRef}
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									onBlur={handleTitleSave}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleTitleSave();
										if (e.key === "Escape") {
											setTitle(document.title);
											setIsEditingTitle(false);
										}
									}}
									className="text-lg font-semibold max-w-lg border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
								/>
							) : (
								<button
									type="button"
									onClick={() => setIsEditingTitle(true)}
									className={cn(
										"text-lg font-semibold text-[var(--foreground)] truncate max-w-lg",
										"hover:text-[var(--accent-600)]",
										"transition-colors duration-[var(--transition-fast)]",
										"text-left"
									)}
								>
									{title}
								</button>
							)}
						</div>

						{/* Save status indicator */}
						<SaveIndicator status={saveStatus} />
					</div>

					{/* Center: View mode toggle */}
					<div className="hidden md:flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] p-1 bg-[var(--background-subtle)]">
						<ViewModeButton
							icon={Edit3}
							label="Editor only"
							active={activePanel === "editor"}
							onClick={() => setActivePanel("editor")}
						/>
						<ViewModeButton
							icon={Columns}
							label="Split view"
							active={activePanel === "both"}
							onClick={() => setActivePanel("both")}
						/>
						<ViewModeButton
							icon={Eye}
							label="Preview only"
							active={activePanel === "markdown"}
							onClick={() => setActivePanel("markdown")}
						/>
					</div>

					{/* Right: Actions */}
					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton aria-label="Share">
									<Share2 className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Share</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton aria-label="Collaborators">
									<Users className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Collaborators</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton aria-label="Version history">
									<History className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Version history</TooltipContent>
						</Tooltip>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<IconButton aria-label="More options">
									<MoreHorizontal className="h-4 w-4" />
								</IconButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem>
									<Download className="h-4 w-4 mr-2" />
									Export
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Printer className="h-4 w-4 mr-2" />
									Print
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<Settings className="h-4 w-4 mr-2" />
									Document Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			{/* Editor area */}
			<main className="flex-1 overflow-hidden">
				<SplitPane
					leftPane={
						<TiptapEditor
							content={content}
							onContentChange={handleContentChange}
							onTextChange={handleTextChange}
							onEditorReady={handleEditorReady}
							showToolbar
							autoFocus
						/>
					}
					rightPane={
						<MarkdownPane
							content={content}
							onContentChange={handleMarkdownContentChange}
						/>
					}
				/>
			</main>

			{/* Status bar */}
			<EditorStatusBar
				wordCount={wordCount}
				characterCount={characterCount}
				saveStatus={saveStatus}
				saveError={saveError}
			/>
		</div>
	);
}

/**
 * Save status indicator.
 */
function SaveIndicator({ status }: { status: string }) {
	const config = {
		idle: {
			icon: Cloud,
			text: "Saved",
			className: "text-[var(--success-500)]",
		},
		saving: {
			icon: Loader2,
			text: "Saving",
			className: "text-[var(--foreground-muted)] animate-spin",
		},
		saved: {
			icon: Check,
			text: "Saved",
			className: "text-[var(--success-500)]",
		},
		error: {
			icon: CloudOff,
			text: "Error",
			className: "text-[var(--error-500)]",
		},
	};

	const current = config[status as keyof typeof config] || config.idle;
	const Icon = current.icon;

	return (
		<div className="hidden sm:flex items-center gap-1.5 text-xs">
			<Icon className={cn("h-3.5 w-3.5", current.className)} />
			<span className="text-[var(--foreground-muted)]">{current.text}</span>
		</div>
	);
}

/**
 * View mode toggle button.
 */
function ViewModeButton({
	icon: Icon,
	label,
	active,
	onClick,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className={cn(
						"p-1.5 rounded-[var(--radius-sm)]",
						"transition-all duration-[var(--transition-fast)]",
						active
							? "bg-[var(--background)] text-[var(--foreground)] shadow-[var(--shadow-xs)]"
							: "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/50"
					)}
					aria-pressed={active}
					aria-label={label}
				>
					<Icon className="h-4 w-4" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
