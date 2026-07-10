"use client";

/* eslint-disable jsx-a11y/no-autofocus -- Custom editor component, not native input */

/**
 * Document Editor Page - DocFusion
 *
 * A comprehensive, feature-rich document editing interface with
 * dual-pane editing, AI commands, outline navigation, collaboration,
 * and elegant "Ink & Paper" aesthetic.
 */

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
import { useAIStore } from "@/lib/stores/ai-store";
import { useCollaborationStore } from "@/lib/stores/collaboration-store";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { MarkdownPane } from "@/components/editor/MarkdownPane";
import { SplitPane } from "@/components/editor/SplitPane";
import { EditorStatusBar } from "@/components/editor/EditorStatusBar";
import { SearchReplacePanel } from "@/components/editor/SearchReplacePanel";
import { DocumentToolbar } from "@/components/document/DocumentToolbar";
import { OutlinePanel } from "@/components/document/OutlinePanel";
import { DocumentSidebar } from "@/components/document/DocumentSidebar";
import { AIAssistantPanel } from "@/components/document/AIAssistantPanel";
import { DocumentActionsMenu } from "@/components/document/DocumentActionsMenu";
import { CollaboratorCursors, useEditorCoords } from "@/components/editor/CollaboratorCursors";
import { useOutline } from "@/lib/hooks/useOutline";
import { Button, IconButton } from "@/components/ui/Button";
import type { Editor } from "@tiptap/react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DocumentContent, Document } from "@/lib/types/document";
import type { OutlineItem } from "@/lib/editor/extensions/outline";
import {
	ArrowLeft,
	Save,
	Share2,
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
	PanelLeft,
	PanelRight,
	Bot,
	Search,
	MessageSquare,
} from "lucide-react";

// ============================================================================
// Main Component
// ============================================================================

export default function DocumentPage() {
	const params = useParams();
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

// ============================================================================
// Loading State
// ============================================================================

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
				<div className="w-64 border-r border-[var(--border)] bg-[var(--background-subtle)] animate-pulse" />
				<div className="flex-1 p-8">
					<div className="max-w-3xl mx-auto space-y-4">
						<div className="h-8 w-3/4 rounded bg-[var(--background-muted)] animate-pulse" />
						<div className="h-4 w-full rounded bg-[var(--background-muted)] animate-pulse" />
						<div className="h-4 w-full rounded bg-[var(--background-muted)] animate-pulse" />
						<div className="h-4 w-2/3 rounded bg-[var(--background-muted)] animate-pulse" />
					</div>
				</div>
				<div className="w-72 border-l border-[var(--border)] bg-[var(--background-subtle)] animate-pulse" />
			</main>
		</div>
	);
}

// ============================================================================
// Not Found State
// ============================================================================

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
					The document you&apos;re looking for doesn&apos;t exist or you don&apos;t have
					permission to access it.
				</p>
				<Button onClick={() => router.push("/documents")} variant="primary">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Documents
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Main Document Editor
// ============================================================================

interface DocumentEditorProps {
	document: Document;
}

function DocumentEditor({ document }: DocumentEditorProps) {
	const router = useRouter();
	const documentId = document.id;

	// State
	const [content, setContent] = React.useState<DocumentContent>(
		document.content ?? { type: "doc", content: [{ type: "paragraph" }] }
	);
	const [title, setTitle] = React.useState(document.title);
	const [isEditingTitle, setIsEditingTitle] = React.useState(false);
	const [text, setText] = React.useState(document.plainText ?? "");
	const [editor, setEditor] = React.useState<Editor | null>(null);
	const [showSearchPanel, setShowSearchPanel] = React.useState(false);
	const [isLeftSidebarOpen, setIsLeftSidebarOpen] = React.useState(true);
	const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(true);
	const [isAIPanelOpen, setIsAIPanelOpen] = React.useState(false);

	const titleInputRef = React.useRef<HTMLInputElement>(null);
	const editorContainerRef = React.useRef<HTMLDivElement>(null);

	// Store state
	const activePanel = useEditorStore((s) => s.activePanel);
	const setActivePanel = useEditorStore((s) => s.setActivePanel);
	const isFocusMode = useEditorStore((s) => s.preferences.focusMode);
	const openAICommandPalette = useAIStore((s) => s.openCommandPalette);

	// Collaboration
	const collaborators = useCollaborationStore((s) => s.collaborators);
	const userPresence = useCollaborationStore((s) => s.userPresence);
	const currentUser = useCollaborationStore((s) => s.currentUser);
	const positionToCoords = useEditorCoords(editor, editorContainerRef);

	// Mutations
	const saveMutation = useSaveDocumentContent(documentId);
	const updateMutation = useUpdateDocument(documentId);

	// Autosave
	const {
		status: saveStatus,
		error: saveError,
		scheduleSave,
		hasUnsavedChanges,
	} = useAutosave(documentId, async (_id, docContent) => {
		await saveMutation.mutateAsync(docContent);
	});

	// Warn on navigation with unsaved changes
	useUnsavedChangesWarning(hasUnsavedChanges());

	// Setup outline management
	const {
		outline,
		activeSectionId,
		collapsedSections,
		navigateToSection,
		toggleSection,
		expandAll,
		collapseAll,
	} = useOutline({
		editor,
		maxDepth: 4,
	});

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

	// Handle title save
	const handleTitleSave = async () => {
		if (title !== document.title) {
			try {
				await updateMutation.mutateAsync({ title });
			} catch (err) {
				console.error("Failed to update title:", err);
				setTitle(document.title);
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

	// Keyboard shortcuts
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl/Cmd + S: Save
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
				if (editor && !editor.isDestroyed) {
					const currentContent = editor.getJSON();
					scheduleSave(currentContent);
				}
			}
			// Ctrl/Cmd + F: Search/Replace
			if ((e.ctrlKey || e.metaKey) && e.key === "f") {
				e.preventDefault();
				setShowSearchPanel(true);
			}
			// Ctrl/Cmd + K: Insert link
			if ((e.ctrlKey || e.metaKey) && e.key === "k") {
				e.preventDefault();
				if (editor && !editor.isDestroyed) {
					const previousUrl = editor.getAttributes("link").href;
					const url = window.prompt("Enter URL:", previousUrl || "https://");
					if (url === null) return;
					if (url === "") {
						editor.chain().focus().extendMarkRange("link").unsetLink().run();
					} else {
						editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
					}
				}
			}
			// Ctrl/Cmd + Shift + A: Open AI command palette
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
				e.preventDefault();
				openAICommandPalette();
			}
			// Ctrl/Cmd + /: Toggle AI assistant
			if ((e.ctrlKey || e.metaKey) && e.key === "/") {
				e.preventDefault();
				setIsAIPanelOpen((prev) => !prev);
			}
			// Ctrl/Cmd + Shift + O: Toggle outline
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "O") {
				e.preventDefault();
				setIsLeftSidebarOpen((prev) => !prev);
			}
			// Escape: Close panels
			if (e.key === "Escape") {
				setShowSearchPanel(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [editor, scheduleSave, openAICommandPalette]);

	// Calculate word count
	const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
	const characterCount = text.length;

	// Focus mode: hide sidebars
	const effectiveLeftOpen = isFocusMode ? false : isLeftSidebarOpen;
	const effectiveRightOpen = isFocusMode ? false : isRightSidebarOpen;

	return (
		<div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden">
			{/* Header */}
			<header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm z-30">
				<div className="flex items-center justify-between px-4 h-14">
					{/* Left: Navigation and title */}
					<div className="flex items-center gap-3 min-w-0 flex-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Link
									href="/documents"
									className={cn(
										"p-2 rounded-[var(--radius-md)]",
										"text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
										"hover:bg-[var(--background-muted)]",
										"transition-all duration-&lsqb;var(--transition-fast)&rsqb;"
									)}
								>
									<ArrowLeft className="h-5 w-5" />
								</Link>
							</TooltipTrigger>
							<TooltipContent side="bottom">Back to documents</TooltipContent>
						</Tooltip>

						{/* Toggle outline */}
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
									active={isLeftSidebarOpen}
									aria-label="Toggle outline"
								>
									<PanelLeft className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Toggle outline (Ctrl+Shift+O)</TooltipContent>
						</Tooltip>

						{/* Editable title */}
						<div className="flex-1 min-w-0 mx-2">
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
										"transition-colors duration-&lsqb;var(--transition-fast)&rsqb;",
										"text-left"
									)}
								>
									{title}
								</button>
							)}
						</div>

						{/* Save status */}
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
						{/* Search */}
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									onClick={() => setShowSearchPanel(true)}
									aria-label="Search"
								>
									<Search className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Search (Ctrl+F)</TooltipContent>
						</Tooltip>

						{/* AI Assistant */}
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
									active={isAIPanelOpen}
									aria-label="AI Assistant"
									className={cn(isAIPanelOpen && "text-blue-500")}
								>
									<Bot className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">AI Assistant (Ctrl+/)</TooltipContent>
						</Tooltip>

						{/* Comments */}
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton aria-label="Comments">
									<MessageSquare className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Comments</TooltipContent>
						</Tooltip>

						{/* Toggle right sidebar */}
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
									active={isRightSidebarOpen}
									aria-label="Toggle sidebar"
								>
									<PanelRight className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">Toggle sidebar</TooltipContent>
						</Tooltip>

						{/* Document actions */}
						<DocumentActionsMenu document={document} />
					</div>
				</div>
			</header>

			{/* Main content area */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left sidebar: Outline + Comments */}
				{!isFocusMode && effectiveLeftOpen && (
					<aside
						className={cn(
							"w-72 flex-shrink-0 border-r border-[var(--border)]",
							"bg-[var(--background)] flex flex-col",
							"transition-all duration-300 ease-in-out"
						)}
					>
						<OutlinePanel
							outline={outline}
							activeSectionId={activeSectionId}
							onSectionClick={navigateToSection}
							onToggleCollapse={toggleSection}
							collapsedSections={collapsedSections}
							onExpandAll={expandAll}
							onCollapseAll={collapseAll}
							maxDepth={4}
							editor={editor}
							className="flex-1"
						/>
					</aside>
				)}

				{/* Main editor */}
				<main
					className={cn(
						"flex-1 flex flex-col min-w-0 bg-[var(--paper-background)] dark:bg-[var(--background)]",
						"transition-all duration-500",
						isFocusMode && "bg-gradient-to-b from-background to-background-muted"
					)}
				>
					{/* Toolbar */}
					<div className="flex-shrink-0 z-20">
						<DocumentToolbar
							editor={editor}
							documentId={documentId}
							onInsertDiagram={() => {
								// Handled internally by Dialog
							}}
							showText={false}
							className="border-b border-[var(--border)]"
						/>
					</div>

					{/* Editor with collaboration cursors */}
					<div
						className={cn(
							"flex-1 overflow-hidden relative",
							isFocusMode && "flex items-start justify-center pt-8"
						)}
					>
						<SplitPane
							leftPane={
								<div
									ref={editorContainerRef}
									className={cn(
										"relative h-full",
										isFocusMode && "max-w-3xl mx-auto shadow-2xl rounded-lg bg-card border border-border/50"
									)}
								>
									<TiptapEditor
										content={content}
										onContentChange={handleContentChange}
										onTextChange={handleTextChange}
										onEditorReady={handleEditorReady}
										showToolbar={false}
										autoFocus
										documentId={documentId}
										enableCollaboration={true}
										collaborationUser={
											currentUser
												? {
														name: currentUser.name,
														color: userPresence?.color ?? "#3b82f6",
													}
												: undefined
										}
									/>
									<CollaboratorCursors
										editorRef={editorContainerRef}
										positionToCoords={positionToCoords}
									/>
								</div>
							}
							rightPane={
								<MarkdownPane
									content={content}
									onContentChange={handleMarkdownContentChange}
								/>
							}
							minWidth={300}
						/>
					</div>

					{/* Search/Replace Panel */}
					{editor && (
						<SearchReplacePanel
							isOpen={showSearchPanel}
							onClose={() => setShowSearchPanel(false)}
							editor={editor}
						/>
					)}
				</main>

				{/* Right sidebar: Document info */}
				{!isFocusMode && effectiveRightOpen && (
					<aside
						className={cn(
							"w-80 flex-shrink-0 border-l border-[var(--border)]",
							"bg-[var(--background)] flex flex-col",
							"transition-all duration-300 ease-in-out"
						)}
					>
						<DocumentSidebar
							document={document}
							wordCount={wordCount}
							characterCount={characterCount}
							saveStatus={saveStatus as string}
							saveError={saveError?.message ?? null}
							className="h-full"
						/>
					</aside>
				)}

				{/* AI Panel - floating or sidebar based on preference */}
				<Sheet open={isAIPanelOpen} onOpenChange={setIsAIPanelOpen}>
					<SheetContent className="w-96 sm:max-w-96">
						<AIAssistantPanel
							documentId={documentId}
							editor={editor}
							documentTitle={title}
							documentMetadata={document.metadata}
							onClose={() => setIsAIPanelOpen(false)}
						/>
					</SheetContent>
				</Sheet>
			</div>

			{/* Status bar */}
			{!isFocusMode && (
				<footer className="flex-shrink-0">
					<EditorStatusBar
						wordCount={wordCount}
						characterCount={characterCount}
						saveStatus={saveStatus}
						saveError={saveError}
					/>
				</footer>
			)}
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

interface SaveIndicatorProps {
	status: string;
}

function SaveIndicator({ status }: SaveIndicatorProps) {
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

interface ViewModeButtonProps {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	active: boolean;
	onClick: () => void;
}

function ViewModeButton({ icon: Icon, label, active, onClick }: ViewModeButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className={cn(
						"p-1.5 rounded-[var(--radius-sm)]",
						"transition-all duration-&lsqb;var(--transition-fast)&rsqb;",
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
