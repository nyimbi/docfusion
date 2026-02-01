"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TiptapEditor, EditorProvider } from "@/components/editor/TiptapEditor";
import { OutlinePanel } from "./OutlinePanel";
import { SectionReordering } from "./SectionReordering";
import { DragDropProvider } from "./DragDropProvider";
import { useOutline } from "@/lib/hooks/useOutline";
import type { Editor } from "@tiptap/react";
import type { DocumentContent } from "@/lib/types/document";

/**
 * Props for DocumentEditorWithOutline component
 */
export interface DocumentEditorWithOutlineProps {
	/** Initial document content */
	initialContent?: DocumentContent;
	/** Called when content changes */
	onContentChange?: (content: DocumentContent) => void;
	/** Document title */
	title?: string;
	/** Whether this is a read-only view */
	readOnly?: boolean;
	/** Custom className */
	className?: string;
	/** Called when editor is ready */
	onEditorReady?: (editor: Editor) => void;
}

/**
 * Complete document editor with outline panel, section reordering, and drag-and-drop support.
 *
 * This component integrates:
 * - Tiptap rich text editor
 * - Outline panel with navigation
 * - Section reordering UI
 * - Drag-and-drop document restructuring
 *
 * @example
 * <DocumentEditorWithOutline
 *   initialContent={document.content}
 *   onContentChange={saveDocument}
 *   title="My Document"
 * />
 */
export const DocumentEditorWithOutline = React.memo(function DocumentEditorWithOutline({
	initialContent,
	onContentChange,
	title = "Document",
	readOnly = false,
	className,
	onEditorReady,
}: DocumentEditorWithOutlineProps): React.ReactElement {
	const [editor, setEditor] = React.useState<Editor | null>(null);

	// Setup outline management
	const {
		outline,
		activeSectionId,
		collapsedSections,
		draggedItem,
		hoverTarget,
		isDropValid,
		navigateToSection,
		toggleSection,
		expandAll,
		startDrag,
		endDrag,
		handleDrop,
		setHoverTarget,
	} = useOutline({
		editor,
		maxDepth: 3, // Only track H1, H2, H3
	});

	// Handle content change
	const handleContentChange = React.useCallback(
		(content: DocumentContent) => {
			onContentChange?.(content);
		},
		[onContentChange]
	);

	// Handle editor ready
	const handleEditorReady = React.useCallback(
		(newEditor: Editor) => {
			setEditor(newEditor);
			onEditorReady?.(newEditor);
		},
		[onEditorReady]
	);

	return (
		<div
			className={cn(
				"flex flex-col lg:flex-row h-full gap-4",
				className
			)}
		>
			{/* Main editor area */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* Header with title and actions */}
				{title && (
					<div className="flex items-center justify-between p-4 border-b bg-card rounded-t-lg">
						<h1 className="text-xl font-semibold">{title}</h1>
						{outline && outline.flat.length > 0 && (
							<div className="text-sm text-muted-foreground">
								{outline.flat.length} sections
							</div>
						)}
					</div>
				)}

				{/* Editor */}
				<div className="flex-1 min-h-[500px] border rounded-b-lg bg-white dark:bg-gray-950">
					<TiptapEditor
						content={initialContent}
						onContentChange={handleContentChange}
						onEditorReady={handleEditorReady}
						readOnly={readOnly}
						showToolbar={!readOnly}
						placeholder="Start writing your document..."
						className="h-full"
					/>
				</div>
			</div>

			{/* Sidebar with outline and reordering */}
			<DragDropProvider
				editor={editor}
				outline={outline}
				onDrop={(source, target) => {
					// Drop succeeds if target is defined
					return !!target;
				}}
				className="w-full lg:w-72 xl:w-80 flex flex-col gap-4"
			>
				{/* Outline Panel */}
				{outline && outline.flat.length > 0 && (
					<OutlinePanel
						outline={outline}
						activeSectionId={activeSectionId}
						onSectionClick={navigateToSection}
						onToggleCollapse={toggleSection}
						draggedItemId={draggedItem?.id}
						hoverTarget={hoverTarget}
						isDropValid={isDropValid}
						collapsedSections={collapsedSections}
						onDragStart={startDrag}
						onDragEnd={endDrag}
						onDrop={handleDrop}
						enableDragDrop={!readOnly}
						maxDepth={3}
					/>
				)}

				{/* Section Reordering */}
				{!readOnly && (
					<SectionReordering
						editor={editor}
						outline={outline}
						selectedSectionId={activeSectionId}
					/>
				)}

				{/* Quick actions */}
				{outline && outline.flat.length > 0 && (
					<div className="border rounded-lg bg-card p-3">
						<h4 className="font-medium text-sm mb-2">Quick Actions</h4>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={expandAll}
								className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
							>
								Expand All
							</button>
							<button
								type="button"
								onClick={() => {
									// Collapse all sections
									for (const item of outline.flat) {
										if (item.children.length > 0) {
											toggleSection(item);
										}
									}
								}}
								className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
							>
								Collapse All
							</button>
						</div>
					</div>
				)}
			</DragDropProvider>
		</div>
	);
});

DocumentEditorWithOutline.displayName = "DocumentEditorWithOutline";

export default DocumentEditorWithOutline;
