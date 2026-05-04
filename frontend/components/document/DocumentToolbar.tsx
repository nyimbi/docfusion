"use client";

/**
 * Document Toolbar - Enhanced formatting toolbar with AI, diagram, and review features.
 *
 * Features:
 * - Text formatting (bold, italic, underline, strikethrough)
 * - Headings (H1-H6)
 * - Lists (bullet, numbered, task)
 * - Tables and media
 * - AI generation with dropdown menu
 * - Diagram insertion
 * - Comments and review toggles
 * - Icon-only mode support
 * - Comprehensive tooltips with keyboard shortcuts
 */

import * as React from "react";
import { type Editor } from "@tiptap/react";
import {
	Bold,
	Italic,
	Underline,
	Strikethrough,
	Code,
	List,
	ListOrdered,
	CheckSquare,
	Quote,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	Undo,
	Redo,
	Link,
	Image as ImageIcon,
	Table,
	Minus,
	AlignLeft,
	AlignCenter,
	AlignRight,
	AlignJustify,
	Sparkles,
	Maximize2,
	Minimize2,
	PenTool,
	MessageSquare,
	Share2,
	Download,
	ChevronDown,
	Type,
	Shapes,
	GitGraph,
	Wand2,
	TextSelect,
	Maximize,
	Minimize,
	TypeOutline,
	Highlighter,
	AlertCircle,
	BetweenHorizontalStart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuGroup,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useAIStore } from "@/lib/stores/ai-store";
import { useCommentStore } from "@/lib/stores/comment-store";
import { DiagramInsertDialog } from "./DiagramInsertDialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface DocumentToolbarProps {
	editor: Editor | null;
	/** Document ID. If not provided, document-specific features are hidden. */
	documentId?: string;
	onInsertDiagram?: () => void;
	/** Callback for uploading images. If not provided, images are inserted as base64. */
	onFileUpload?: (file: File) => Promise<string>;
	className?: string;
	/** Whether to show text labels alongside icons. Default: true */
	showText?: boolean;
	/** Minimal mode hides document-specific features (focus mode, comments, share, download). */
	minimal?: boolean;
}

export function DocumentToolbar({
	editor,
	documentId,
	onInsertDiagram,
	onFileUpload,
	className,
	showText = true,
	minimal = false,
}: DocumentToolbarProps) {
	const [isDiagramDialogOpen, setIsDiagramDialogOpen] = React.useState(false);
	const [isAIToolbarOpen, setIsAIToolbarOpen] = React.useState(false);
	
	const isVisible = useEditorStore((s) => s.toolbar.isVisible);
	const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);
	const focusMode = useEditorStore((s) => s.preferences.focusMode);
	
	const openAICommandPalette = useAIStore((s) => s.openCommandPalette);
	const isCommentsVisible = useCommentStore((s) => s.isCommentsVisible);
	const toggleComments = useCommentStore((s) => s.toggleComments);
	
	if (!isVisible || !editor) return null;

	// AI action handlers
	const handleAIImprove = () => {
		const selection = editor.state.selection;
		if (selection.empty) {
			toast.info("Please select text to improve");
			return;
		}
		openAICommandPalette("improve");
	};

	const handleAIExpand = () => {
		const selection = editor.state.selection;
		if (selection.empty) {
			toast.info("Please select text to expand");
			return;
		}
		openAICommandPalette("expand");
	};

	const handleAICondense = () => {
		const selection = editor.state.selection;
		if (selection.empty) {
			toast.info("Please select text to condense");
			return;
		}
		openAICommandPalette("condense");
	};

	const handleAISummarize = () => {
		const selection = editor.state.selection;
		if (selection.empty) {
			toast.info("Please select text to summarize");
			return;
		}
		openAICommandPalette("summarize");
	};

	const handleAIContinue = () => {
		openAICommandPalette("continue");
	};

	const handleAITone = (tone: "professional" | "friendly" | "technical") => {
		const selection = editor.state.selection;
		if (selection.empty) {
			toast.info("Please select text to change tone");
			return;
		}
		openAICommandPalette(`tone:${tone}`);
	};

	const handleInsertTable = () => {
		editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
	};

	// Insert heading at current position
	const insertHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
		editor.chain().focus().toggleHeading({ level }).run();
	};

	return (
		<div
			className={cn(
				"flex items-center gap-0.5 px-2 py-1.5 min-h-[44px]",
				"bg-[var(--background)]",
				"border-[var(--border)]",
				className
			)}
			role="toolbar"
			aria-label="Document formatting"
		>
			{/* Left: View & Structure */}
			{!minimal && (
				<>
					<ToolbarGroup>
						<ToolbarButton
							icon={focusMode ? Maximize2 : Minimize2}
							label={focusMode ? "Exit focus mode" : "Focus mode"}
							shortcut="Ctrl+Shift+F"
							onClick={toggleFocusMode}
							isActive={focusMode}
							showText={showText}
						/>
					</ToolbarGroup>

					<ToolbarDivider />
				</>
			)}

			{/* History */}
			<ToolbarGroup>
				<ToolbarButton
					icon={Undo}
					label="Undo"
					shortcut="Ctrl+Z"
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().undo()}
					showText={showText}
				/>
				<ToolbarButton
					icon={Redo}
					label="Redo"
					shortcut="Ctrl+Shift+Z"
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().redo()}
					showText={showText}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Headings */}
			<HeadingDropdown editor={editor} showText={showText} />

			<ToolbarDivider />

			{/* Text formatting */}
			<ToolbarGroup>
				<ToolbarButton
					icon={Bold}
					label="Bold"
					shortcut="Ctrl+B"
					onClick={() => editor.chain().focus().toggleBold().run()}
					isActive={editor.isActive("bold")}
					showText={showText}
				/>
				<ToolbarButton
					icon={Italic}
					label="Italic"
					shortcut="Ctrl+I"
					onClick={() => editor.chain().focus().toggleItalic().run()}
					isActive={editor.isActive("italic")}
					showText={showText}
				/>
				<ToolbarButton
					icon={Underline}
					label="Underline"
					shortcut="Ctrl+U"
					onClick={() => editor.chain().focus().toggleUnderline?.().run()}
					isActive={editor.isActive("underline")}
					disabled={!editor.can().toggleUnderline?.()}
					showText={showText}
				/>
				<ToolbarButton
					icon={Strikethrough}
					label="Strikethrough"
					shortcut="Ctrl+Shift+S"
					onClick={() => editor.chain().focus().toggleStrike().run()}
					isActive={editor.isActive("strike")}
					showText={showText}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Lists */}
			<ToolbarGroup>
				<ToolbarButton
					icon={List}
					label="Bullet list"
					shortcut="Ctrl+Shift+8"
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					isActive={editor.isActive("bulletList")}
					showText={showText}
				/>
				<ToolbarButton
					icon={ListOrdered}
					label="Numbered list"
					shortcut="Ctrl+Shift+7"
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					isActive={editor.isActive("orderedList")}
					showText={showText}
				/>
				<ToolbarButton
					icon={CheckSquare}
					label="Task list"
					shortcut="Ctrl+Shift+9"
					onClick={() => editor.chain().focus().toggleTaskList?.().run()}
					isActive={editor.isActive("taskList")}
					disabled={!editor.can().toggleTaskList?.()}
					showText={showText}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Alignment */}
			<AlignmentDropdown editor={editor} showText={showText} />

			<ToolbarDivider />

			{/* Block elements */}
			<ToolbarGroup>
				<ToolbarButton
					icon={Quote}
					label="Blockquote"
					shortcut="Ctrl+Shift+Q"
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					isActive={editor.isActive("blockquote")}
					showText={showText}
				/>
				<ToolbarButton
					icon={Code}
					label="Code block"
					shortcut="Ctrl+Alt+C"
					onClick={() => editor.chain().focus().toggleCodeBlock().run()}
					isActive={editor.isActive("codeBlock")}
					showText={showText}
				/>
				<ToolbarButton
					icon={Minus}
					label="Horizontal rule"
					shortcut="Ctrl+Alt+-"
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
					showText={showText}
				/>
				<CalloutButton editor={editor} showText={showText} />
				<ToolbarButton
					icon={BetweenHorizontalStart}
					label="Page break"
					onClick={() => editor.chain().focus().setPageBreak().run()}
					showText={showText}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Insert elements */}
			<InsertDropdown
				editor={editor}
				onInsertTable={handleInsertTable}
				onInsertDiagram={() => setIsDiagramDialogOpen(true)}
				onFileUpload={onFileUpload}
				showText={showText}
			/>

			<ToolbarDivider />

			{/* AI Tools - Prominent dropdown */}
			<AIToolbarDropdown
				onImprove={handleAIImprove}
				onExpand={handleAIExpand}
				onCondense={handleAICondense}
				onSummarize={handleAISummarize}
				onContinue={handleAIContinue}
				onTone={handleAITone}
				onOpenPalette={openAICommandPalette}
				showText={showText}
			/>

			<ToolbarDivider />

			{/* Review tools */}
			{!minimal && (
				<>
					<ToolbarGroup>
						<ToolbarButton
							icon={MessageSquare}
							label="Comments"
							shortcut="Ctrl+Alt+M"
							onClick={toggleComments}
							isActive={isCommentsVisible}
							showText={showText}
						/>
					</ToolbarGroup>

					{/* Spacer */}
					<div className="flex-1" />
				</>
			)}

			{/* Diagram Dialog */}
			<DiagramInsertDialog
				open={isDiagramDialogOpen}
				onOpenChange={setIsDiagramDialogOpen}
				editor={editor}
			/>
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

interface ToolbarGroupProps {
	children: React.ReactNode;
	className?: string;
}

function ToolbarGroup({ children, className }: ToolbarGroupProps) {
	return <div className={cn("flex items-center gap-0.5", className)}>{children}</div>;
}

function ToolbarDivider() {
	return <div className="w-px h-5 bg-[var(--border)] mx-1" />;
}

interface ToolbarButtonProps {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	shortcut?: string;
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	/** Whether to show text label alongside icon */
	showText?: boolean;
}

function ToolbarButton({
	icon: Icon,
	label,
	shortcut,
	onClick,
	isActive,
	disabled,
	showText = true,
}: ToolbarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					disabled={disabled}
					className={cn(
						"flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sm)] transition-all duration-&lsqb;var(--transition-fast)&rsqb;",
						"text-[var(--foreground-muted)]",
						isActive
							? "bg-[var(--accent-100)] text-[var(--accent-700)] dark:bg-[var(--accent-900)] dark:text-[var(--accent-200)]"
							: "hover:bg-[var(--background-muted)] hover:text-[var(--foreground)]",
						disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
					)}
					aria-label={label}
					aria-pressed={isActive}
				>
					<Icon className="h-4 w-4" />
					{showText && <span className="text-xs font-medium">{label}</span>}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="flex items-center gap-2">
				<span>{label}</span>
				{shortcut && (
					<kbd className="text-[10px] px-1 py-0.5 bg-[var(--background-muted)] rounded">
						{shortcut}
					</kbd>
				)}
			</TooltipContent>
		</Tooltip>
	);
}

// ============================================================================
// Headings Dropdown
// ============================================================================

interface HeadingDropdownProps {
	editor: Editor;
	showText?: boolean;
}

function HeadingDropdown({ editor, showText = true }: HeadingDropdownProps) {
	const headings = [
		{ level: 1 as const, label: "Heading 1", icon: Heading1, shortcut: "Ctrl+Alt+1" },
		{ level: 2 as const, label: "Heading 2", icon: Heading2, shortcut: "Ctrl+Alt+2" },
		{ level: 3 as const, label: "Heading 3", icon: Heading3, shortcut: "Ctrl+Alt+3" },
		{ level: 4 as const, label: "Heading 4", icon: Heading4, shortcut: "Ctrl+Alt+4" },
	];

	const isHeadingActive = editor.isActive("heading");
	const activeLevel = headings.find((h) => editor.isActive("heading", { level: h.level }));

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-sm)]",
								"text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-muted)]",
								"transition-all duration-&lsqb;var(--transition-fast)&rsqb;"
							)}
						>
							{activeLevel ? (
								<activeLevel.icon className="h-4 w-4" />
							) : (
								<Type className="h-4 w-4" />
							)}
							{showText && (
								<span className="text-xs font-medium">
									{activeLevel ? activeLevel.label : "Style"}
								</span>
							)}
							<ChevronDown className="h-3 w-3" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<span>Headings (Ctrl+Alt+1-4)</span>
				</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start">
				<DropdownMenuItem
					onClick={() => editor.chain().focus().setParagraph().run()}
					className={cn(!isHeadingActive && "bg-[var(--accent-100)] dark:bg-[var(--accent-900)]")}
				>
					<Type className="h-4 w-4 mr-2" />
					Paragraph
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{headings.map((heading) => (
					<DropdownMenuItem
						key={heading.level}
						onClick={() =>
							editor.chain().focus().toggleHeading({ level: heading.level }).run()
						}
						className={cn(
							editor.isActive("heading", { level: heading.level }) &&
								"bg-[var(--accent-100)] dark:bg-[var(--accent-900)]"
						)}
					>
						<heading.icon className="h-4 w-4 mr-2" />
						{heading.label}
						<kbd className="ml-auto text-[10px] px-1 py-0.5 bg-[var(--background-muted)] rounded">
							{heading.shortcut}
						</kbd>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Callout/alert box insertion button.
 */
function CalloutButton({ editor, showText }: { editor: Editor; showText?: boolean }) {
	const [isOpen, setIsOpen] = React.useState(false);

	const variants = [
		{ label: "Info", variant: "info" as const },
		{ label: "Warning", variant: "warning" as const },
		{ label: "Success", variant: "success" as const },
		{ label: "Danger", variant: "danger" as const },
	];

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"p-1.5 rounded transition-colors flex items-center gap-1",
								"hover:bg-[var(--background-muted)]",
								editor.isActive("callout") && "bg-[var(--background-muted)]"
							)}
							aria-label="Insert callout"
						>
							<AlertCircle className="h-4 w-4" />
							{showText && <span className="text-xs">Callout</span>}
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">Insert callout</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className="w-40">
				{variants.map((v) => (
					<DropdownMenuItem
						key={v.variant}
						onClick={() => {
							editor
								.chain()
								.focus()
								.toggleCallout({ variant: v.variant })
								.run();
							setIsOpen(false);
						}}
					>
						<AlertCircle className="h-4 w-4 mr-2" />
						{v.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// Alignment Dropdown
// ============================================================================

interface AlignmentDropdownProps {
	editor: Editor;
	showText?: boolean;
}

function AlignmentDropdown({ editor, showText = true }: AlignmentDropdownProps) {
	const alignments = [
		{ align: "left", icon: AlignLeft, label: "Align left", shortcut: "Ctrl+Shift+L" },
		{ align: "center", icon: AlignCenter, label: "Align center", shortcut: "Ctrl+Shift+E" },
		{ align: "right", icon: AlignRight, label: "Align right", shortcut: "Ctrl+Shift+R" },
		{ align: "justify", icon: AlignJustify, label: "Justify", shortcut: "Ctrl+Shift+J" },
	];

	const activeAlignment = alignments.find((a) =>
		editor.isActive({ textAlign: a.align })
	);

	const CurrentIcon = activeAlignment?.icon || AlignLeft;

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-sm)]",
								"text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-muted)]",
								"transition-all duration-&lsqb;var(--transition-fast)&rsqb;"
							)}
						>
							<CurrentIcon className="h-4 w-4" />
							{showText && <span className="text-xs font-medium">Align</span>}
							<ChevronDown className="h-3 w-3" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">Alignment</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start">
				{alignments.map((a) => (
					<DropdownMenuItem
						key={a.align}
						onClick={() =>
							editor.chain().focus().setTextAlign(a.align).run()
						}
						className={cn(
							editor.isActive({ textAlign: a.align }) &&
								"bg-[var(--accent-100)] dark:bg-[var(--accent-900)]"
						)}
					>
						<a.icon className="h-4 w-4 mr-2" />
						{a.label}
						<kbd className="ml-auto text-[10px] px-1 py-0.5 bg-[var(--background-muted)] rounded">
							{a.shortcut}
						</kbd>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// Insert Dropdown
// ============================================================================

interface InsertDropdownProps {
	editor: Editor;
	onInsertTable: () => void;
	onInsertDiagram: () => void;
	onFileUpload?: (file: File) => Promise<string>;
	showText?: boolean;
}

function InsertDropdown({
	editor,
	onInsertTable,
	onInsertDiagram,
	onFileUpload,
	showText = true,
}: InsertDropdownProps) {
	const [linkUrl, setLinkUrl] = React.useState("");
	const [isLinkOpen, setIsLinkOpen] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const handleLinkSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!linkUrl) return;
		editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
		setLinkUrl("");
		setIsLinkOpen(false);
	};

	const handleLinkRemove = () => {
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
		setIsLinkOpen(false);
	};

	const handleImageClick = () => {
		fileInputRef.current?.click();
	};

	const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			let url: string;
			if (onFileUpload) {
				url = await onFileUpload(file);
			} else {
				url = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = reject;
					reader.readAsDataURL(file);
				});
			}
			editor.chain().focus().setImage({ src: url }).run();
		} catch {
			toast.error("Failed to insert image");
		}
		// Reset input so the same file can be selected again
		e.target.value = "";
	};

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="gap-1">
							<span className="text-xs font-medium">Insert</span>
							<ChevronDown className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">Insert elements</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Table className="h-4 w-4 mr-2" />
						Table
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						{[2, 3, 4, 5].map((size) => (
							<DropdownMenuItem
								key={size}
								onClick={() =>
									editor.chain().focus().insertTable({
										rows: size,
										cols: size,
										withHeaderRow: true,
									}).run()
								}
							>
								{size} x {size} Table
							</DropdownMenuItem>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSeparator />

				<DropdownMenuSub open={isLinkOpen} onOpenChange={setIsLinkOpen}>
					<DropdownMenuSubTrigger>
						<Link className="h-4 w-4 mr-2" />
						Link
						<kbd className="ml-auto text-[10px] px-1 py-0.5 bg-[var(--background-muted)] rounded">
							Ctrl+K
						</kbd>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-72 p-2">
						<form onSubmit={handleLinkSubmit}>
							<input
								type="url"
								value={linkUrl}
								onChange={(e) => setLinkUrl(e.target.value)}
								placeholder="https://example.com"
								className={cn(
									"w-full px-2 py-1.5 text-sm border rounded",
									"focus:outline-none focus:ring-2 focus:ring-blue-500"
								)}
								// eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional focus for dropdown form UX
							autoFocus
							/>
							<div className="flex justify-end gap-2 mt-2">
								{editor.isActive("link") && (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={handleLinkRemove}
									>
										Remove
									</Button>
								)}
								<Button type="submit" size="sm" disabled={!linkUrl}>
									{editor.isActive("link") ? "Update" : "Insert"}
								</Button>
							</div>
						</form>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuItem onClick={handleImageClick}>
					<ImageIcon className="h-4 w-4 mr-2" aria-hidden="true" />
					Image
				</DropdownMenuItem>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleImageFile}
				/>

				<DropdownMenuSeparator />

				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Shapes className="h-4 w-4 mr-2" />
						Diagram
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem onClick={onInsertDiagram}>
							<GitGraph className="h-4 w-4 mr-2" />
							Insert Diagram...
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								editor
									.chain()
									.focus()
									.insertContent("```mermaid\nflowchart TD\nA --> B\n```")
									.run()
							}
						>
							Quick: Flowchart
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// AI Toolbar Dropdown
// ============================================================================

interface AIToolbarDropdownProps {
	onImprove: () => void;
	onExpand: () => void;
	onCondense: () => void;
	onSummarize: () => void;
	onContinue: () => void;
	onTone: (tone: "professional" | "friendly" | "technical") => void;
	onOpenPalette: (command?: string) => void;
	showText?: boolean;
}

function AIToolbarDropdown({
	onImprove,
	onExpand,
	onCondense,
	onSummarize,
	onContinue,
	onTone,
	onOpenPalette,
	showText = true,
}: AIToolbarDropdownProps) {
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]",
								"bg-gradient-to-r from-blue-500/10 to-purple-500/10",
								"border border-blue-500/20",
								"text-blue-600 dark:text-blue-400 hover:bg-blue-500/20",
								"transition-all duration-&lsqb;var(--transition-fast)&rsqb;"
							)}
						>
							<Sparkles className="h-4 w-4" />
							{showText && (
								<span className="text-xs font-semibold">AI</span>
							)}
							<ChevronDown className="h-3 w-3" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<span>AI commands (Ctrl+Shift+A)</span>
				</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuLabel>
					<span className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-blue-500" />
						AI Writing Assistant
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={onImprove}>
						<Wand2 className="h-4 w-4 mr-2 text-purple-500" />
						Improve Text
						<span className="ml-auto text-xs text-muted-foreground">Rewrite</span>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onExpand}>
						<Maximize className="h-4 w-4 mr-2 text-green-500" />
						Expand
						<span className="ml-auto text-xs text-muted-foreground">Add detail</span>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onCondense}>
						<Minimize className="h-4 w-4 mr-2 text-orange-500" />
						Condense
						<span className="ml-auto text-xs text-muted-foreground">Make concise</span>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onSummarize}>
						<TypeOutline className="h-4 w-4 mr-2 text-cyan-500" />
						Summarize
						<span className="ml-auto text-xs text-muted-foreground">Create summary</span>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onContinue}>
						<Highlighter className="h-4 w-4 mr-2 text-pink-500" />
						Continue Writing
						<span className="ml-auto text-xs text-muted-foreground">From cursor</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				
				<DropdownMenuSeparator />
				
				<DropdownMenuLabel>Change Tone</DropdownMenuLabel>
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={() => onTone("professional")}>
						<span className="h-4 w-4 mr-2 flex items-center justify-center text-xs">👔</span>
						Professional
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => onTone("friendly")}>
						<span className="h-4 w-4 mr-2 flex items-center justify-center text-xs">😊</span>
						Friendly
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => onTone("technical")}>
						<span className="h-4 w-4 mr-2 flex items-center justify-center text-xs">⚙️</span>
						Technical
					</DropdownMenuItem>
				</DropdownMenuGroup>
				
				<DropdownMenuSeparator />
				
				<DropdownMenuItem onClick={() => onOpenPalette()}>
					<TextSelect className="h-4 w-4 mr-2" />
					Open AI Command Palette...
					<kbd className="ml-auto text-[10px] px-1 py-0.5 bg-[var(--background-muted)] rounded">
						Ctrl+Shift+A
					</kbd>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
