"use client";

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
	Quote,
	Heading1,
	Heading2,
	Heading3,
	Undo,
	Redo,
	Link,
	Image,
	Table,
	Minus,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Sparkles,
	ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
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
} from "@/components/ui/dropdown-menu";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useAIStore } from "@/lib/stores/ai-store";

interface EditorToolbarProps {
	editor: Editor | null;
	className?: string;
}

/**
 * Formatting toolbar for the Tiptap editor.
 *
 * Features:
 * - Text formatting (bold, italic, underline, etc.)
 * - Block types (headings, lists, quotes)
 * - Insert elements (links, images, tables)
 * - AI commands trigger
 * - Undo/redo
 */
export function EditorToolbar({ editor, className }: EditorToolbarProps) {
	const isVisible = useEditorStore((s) => s.toolbar.isVisible);
	const openAICommandPalette = useAIStore((s) => s.openCommandPalette);

	if (!isVisible || !editor) return null;

	return (
		<div
			className={cn(
				"flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white",
				"dark:border-gray-800 dark:bg-gray-950",
				className
			)}
			role="toolbar"
			aria-label="Editor formatting"
		>
			{/* History controls */}
			<ToolbarGroup>
				<ToolbarButton
					icon={Undo}
					label="Undo"
					shortcut="⌘Z"
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().undo()}
				/>
				<ToolbarButton
					icon={Redo}
					label="Redo"
					shortcut="⌘⇧Z"
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().redo()}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Heading dropdown */}
			<HeadingDropdown editor={editor} />

			<ToolbarDivider />

			{/* Text formatting */}
			<ToolbarGroup>
				<ToolbarButton
					icon={Bold}
					label="Bold"
					shortcut="⌘B"
					onClick={() => editor.chain().focus().toggleBold().run()}
					isActive={editor.isActive("bold")}
				/>
				<ToolbarButton
					icon={Italic}
					label="Italic"
					shortcut="⌘I"
					onClick={() => editor.chain().focus().toggleItalic().run()}
					isActive={editor.isActive("italic")}
				/>
				<ToolbarButton
					icon={Underline}
					label="Underline"
					shortcut="⌘U"
					onClick={() => editor.chain().focus().toggleUnderline?.().run()}
					isActive={editor.isActive("underline")}
					disabled={!editor.can().toggleUnderline?.()}
				/>
				<ToolbarButton
					icon={Strikethrough}
					label="Strikethrough"
					onClick={() => editor.chain().focus().toggleStrike().run()}
					isActive={editor.isActive("strike")}
				/>
				<ToolbarButton
					icon={Code}
					label="Inline code"
					shortcut="⌘E"
					onClick={() => editor.chain().focus().toggleCode().run()}
					isActive={editor.isActive("code")}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Lists */}
			<ToolbarGroup>
				<ToolbarButton
					icon={List}
					label="Bullet list"
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					isActive={editor.isActive("bulletList")}
				/>
				<ToolbarButton
					icon={ListOrdered}
					label="Numbered list"
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					isActive={editor.isActive("orderedList")}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Block elements */}
			<ToolbarGroup>
				<ToolbarButton
					icon={Quote}
					label="Blockquote"
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					isActive={editor.isActive("blockquote")}
				/>
				<ToolbarButton
					icon={Minus}
					label="Horizontal rule"
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
				/>
			</ToolbarGroup>

			<ToolbarDivider />

			{/* Insert elements */}
			<ToolbarGroup>
				<LinkButton editor={editor} />
				<ImageButton editor={editor} />
				<TableButton editor={editor} />
			</ToolbarGroup>

			{/* Spacer */}
			<div className="flex-1" />

			{/* AI Commands */}
			<ToolbarButton
				icon={Sparkles}
				label="AI Commands"
				shortcut="/"
				onClick={openAICommandPalette}
				className="text-blue-600 dark:text-blue-400"
			/>
		</div>
	);
}

/**
 * Toolbar button component with tooltip.
 */
interface ToolbarButtonProps {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	shortcut?: string;
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	className?: string;
}

function ToolbarButton({
	icon: Icon,
	label,
	shortcut,
	onClick,
	isActive = false,
	disabled = false,
	className,
}: ToolbarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					disabled={disabled}
					className={cn(
						"p-1.5 rounded transition-colors",
						"hover:bg-gray-100 dark:hover:bg-gray-800",
						"disabled:opacity-50 disabled:cursor-not-allowed",
						isActive && "bg-gray-200 dark:bg-gray-700",
						className
					)}
					aria-pressed={isActive}
					aria-label={label}
				>
					<Icon className="h-4 w-4" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="flex items-center gap-2">
				<span>{label}</span>
				{shortcut && (
					<kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded">
						{shortcut}
					</kbd>
				)}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Toolbar button group wrapper.
 */
function ToolbarGroup({ children }: { children: React.ReactNode }) {
	return <div className="flex items-center gap-0.5">{children}</div>;
}

/**
 * Vertical divider between button groups.
 */
function ToolbarDivider() {
	return <div className="w-px h-5 mx-1.5 bg-gray-200 dark:bg-gray-700" />;
}

/**
 * Heading level dropdown.
 */
function HeadingDropdown({ editor }: { editor: Editor }) {
	const getCurrentLevel = (): string => {
		if (editor.isActive("heading", { level: 1 })) return "Heading 1";
		if (editor.isActive("heading", { level: 2 })) return "Heading 2";
		if (editor.isActive("heading", { level: 3 })) return "Heading 3";
		return "Paragraph";
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-1 px-2 py-1.5 text-sm rounded",
						"hover:bg-gray-100 dark:hover:bg-gray-800",
						"min-w-[100px]"
					)}
				>
					<span>{getCurrentLevel()}</span>
					<ChevronDown className="h-3 w-3 opacity-50" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuItem
					onClick={() => editor.chain().focus().setParagraph().run()}
				>
					<span className="text-sm">Paragraph</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 1 }).run()
					}
				>
					<Heading1 className="h-4 w-4 mr-2" />
					<span className="text-lg font-bold">Heading 1</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
				>
					<Heading2 className="h-4 w-4 mr-2" />
					<span className="text-base font-bold">Heading 2</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
				>
					<Heading3 className="h-4 w-4 mr-2" />
					<span className="text-sm font-bold">Heading 3</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Link insertion button with URL input.
 */
function LinkButton({ editor }: { editor: Editor }) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [url, setUrl] = React.useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
		setUrl("");
		setIsOpen(false);
	};

	const handleRemove = () => {
		editor.chain().focus().unsetLink().run();
		setIsOpen(false);
	};

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"p-1.5 rounded transition-colors",
						"hover:bg-gray-100 dark:hover:bg-gray-800",
						editor.isActive("link") && "bg-gray-200 dark:bg-gray-700"
					)}
					aria-label="Insert link"
				>
					<Link className="h-4 w-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72 p-2">
				<form onSubmit={handleSubmit}>
					<input
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://example.com"
						className={cn(
							"w-full px-2 py-1.5 text-sm border rounded",
							"focus:outline-none focus:ring-2 focus:ring-blue-500"
						)}
						autoFocus
					/>
					<div className="flex justify-end gap-2 mt-2">
						{editor.isActive("link") && (
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={handleRemove}
							>
								Remove
							</Button>
						)}
						<Button type="submit" size="sm" disabled={!url}>
							{editor.isActive("link") ? "Update" : "Insert"}
						</Button>
					</div>
				</form>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Image insertion button (placeholder for now).
 */
function ImageButton({ editor }: { editor: Editor }) {
	const handleInsert = () => {
		const url = window.prompt("Enter image URL:");
		if (url) {
			editor.chain().focus().setImage?.({ src: url }).run();
		}
	};

	return (
		<ToolbarButton
			icon={Image}
			label="Insert image"
			onClick={handleInsert}
			disabled={!editor.can().setImage?.({ src: "" })}
		/>
	);
}

/**
 * Table insertion button.
 */
function TableButton({ editor }: { editor: Editor }) {
	const handleInsert = () => {
		editor
			.chain()
			.focus()
			.insertTable?.({ rows: 3, cols: 3, withHeaderRow: true })
			.run();
	};

	return (
		<ToolbarButton
			icon={Table}
			label="Insert table"
			onClick={handleInsert}
			disabled={!editor.can().insertTable?.({ rows: 3, cols: 3 })}
		/>
	);
}

export { ToolbarButton, ToolbarGroup, ToolbarDivider };
