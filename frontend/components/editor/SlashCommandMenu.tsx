/**
 * Slash command menu component for DocFusion.
 *
 * Displays a command palette UI when user triggers a slash command.
 * Shows available AI commands with filtering and keyboard navigation.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AICommand, AICommandCategory } from "@/lib/types/ai";
import { getCommandSuggestions, getCommandsByCategories } from "@/lib/ai/command-registry";
import type { SlashCommandState } from "./extensions/SlashCommand";
import {
	Sparkles,
	Maximize2,
	FileText,
	MessageSquare,
	Languages,
	PenLine,
	HelpCircle,
	Shield,
	type LucideIcon,
} from "lucide-react";

/** Icon map for commands */
const iconMap: Record<string, LucideIcon> = {
	Sparkles,
	Maximize2,
	FileText,
	MessageSquare,
	Languages,
	PenLine,
	HelpCircle,
	Shield,
};

/**
 * Props for SlashCommandMenu.
 */
export interface SlashCommandMenuProps {
	/** Menu state from the extension */
	state: SlashCommandState;
	/** Whether there is text selected in the editor */
	hasSelection: boolean;
	/** Callback when a command is selected */
	onSelect: (command: AICommand) => void;
	/** Callback when the menu should close */
	onClose: () => void;
	/** Container element for positioning */
	containerRef?: React.RefObject<HTMLElement>;
}

/**
 * Slash command menu component.
 */
export const SlashCommandMenu = React.memo(function SlashCommandMenu({
	state,
	hasSelection,
	onSelect,
	onClose,
	containerRef,
}: SlashCommandMenuProps) {
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const menuRef = React.useRef<HTMLDivElement>(null);

	// Get filtered commands
	const commands = React.useMemo(() => {
		if (state.query) {
			return getCommandSuggestions(state.query, hasSelection);
		}
		return getCommandsByCategories()
			.flatMap((cat) => cat.commands)
			.filter((cmd) => !cmd.requiresSelection || hasSelection);
	}, [state.query, hasSelection]);

	// Group commands by category when no query
	const groupedCommands = React.useMemo(() => {
		if (state.query) {
			return null; // Show flat list when searching
		}
		return getCommandsByCategories()
			.map((cat) => ({
				...cat,
				commands: cat.commands.filter((cmd) => !cmd.requiresSelection || hasSelection),
			}))
			.filter((cat) => cat.commands.length > 0);
	}, [state.query, hasSelection]);

	// Reset selection when commands change
	React.useEffect(() => {
		setSelectedIndex(0);
	}, [state.query]);

	// Keyboard navigation
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!state.isOpen) return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((i) => (i + 1) % commands.length);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
					break;
				case "Enter":
				case "Tab":
					e.preventDefault();
					if (commands[selectedIndex]) {
						onSelect(commands[selectedIndex]);
					}
					break;
				case "Escape":
					e.preventDefault();
					onClose();
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [state.isOpen, commands, selectedIndex, onSelect, onClose]);

	// Scroll selected item into view
	React.useEffect(() => {
		if (menuRef.current) {
			const selectedEl = menuRef.current.querySelector(`[data-index="${selectedIndex}"]`);
			selectedEl?.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIndex]);

	// Calculate position
	const position = React.useMemo(() => {
		if (!state.rect) return { top: 0, left: 0 };

		let top = state.rect.bottom + 8;
		let left = state.rect.left;

		// Adjust if container provided
		if (containerRef?.current) {
			const containerRect = containerRef.current.getBoundingClientRect();
			top -= containerRect.top;
			left -= containerRect.left;
		}

		return { top, left };
	}, [state.rect, containerRef]);

	if (!state.isOpen || commands.length === 0) {
		return null;
	}

	return (
		<div
			ref={menuRef}
			role="listbox"
			aria-label="AI command suggestions"
			aria-activedescendant={commands[selectedIndex] ? `slash-cmd-${commands[selectedIndex].id}` : undefined}
			className="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
			style={{
				top: position.top,
				left: position.left,
			}}
		>
			{/* Query hint */}
			{state.query && (
				<div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
					Searching: <span className="font-mono">/{state.query}</span>
				</div>
			)}

			{/* Flat list (when searching) */}
			{!groupedCommands && (
				<div className="py-1">
					{commands.map((command, index) => (
						<CommandItem
							key={command.id}
							command={command}
							isSelected={index === selectedIndex}
							dataIndex={index}
							onSelect={() => onSelect(command)}
							onHover={() => setSelectedIndex(index)}
						/>
					))}
				</div>
			)}

			{/* Grouped list (when not searching) */}
			{groupedCommands && (
				<div className="py-1">
					{groupedCommands.map((category, catIndex) => {
						const startIndex = groupedCommands
							.slice(0, catIndex)
							.reduce((acc, cat) => acc + cat.commands.length, 0);

						return (
							<div key={category.category}>
								<div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{category.label}
								</div>
								{category.commands.map((command, cmdIndex) => {
									const index = startIndex + cmdIndex;
									return (
										<CommandItem
											key={command.id}
											command={command}
											isSelected={index === selectedIndex}
											dataIndex={index}
											onSelect={() => onSelect(command)}
											onHover={() => setSelectedIndex(index)}
										/>
									);
								})}
							</div>
						);
					})}
				</div>
			)}

			{/* No results */}
			{commands.length === 0 && state.query && (
				<div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
					No commands found for "{state.query}"
				</div>
			)}

			{/* Footer hint */}
			<div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
				<span className="inline-flex items-center gap-1">
					<kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px]">↑↓</kbd>
					navigate
				</span>
				<span className="mx-2">·</span>
				<span className="inline-flex items-center gap-1">
					<kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px]">↵</kbd>
					select
				</span>
				<span className="mx-2">·</span>
				<span className="inline-flex items-center gap-1">
					<kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px]">esc</kbd>
					close
				</span>
			</div>
		</div>
	);
});

SlashCommandMenu.displayName = "SlashCommandMenu";

/**
 * Individual command item.
 */
function CommandItem({
	command,
	isSelected,
	dataIndex,
	onSelect,
	onHover,
	idPrefix = "slash-cmd",
}: {
	command: AICommand;
	isSelected: boolean;
	dataIndex: number;
	onSelect: () => void;
	onHover: () => void;
	idPrefix?: string;
}) {
	const Icon = iconMap[command.icon] ?? Sparkles;

	return (
		<button
			type="button"
			id={`${idPrefix}-${command.id}`}
			role="option"
			aria-selected={isSelected}
			data-index={dataIndex}
			className={cn(
				"flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
				isSelected
					? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100"
					: "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
			)}
			onClick={onSelect}
			onMouseEnter={onHover}
		>
			<div
				className={cn(
					"flex h-8 w-8 items-center justify-center rounded-lg",
					isSelected
						? "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300"
						: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
				)}
			>
				<Icon className="h-4 w-4" />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium">/{command.name}</span>
					{command.requiresSelection && (
						<span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
							Needs selection
						</span>
					)}
				</div>
				<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
					{command.description}
				</p>
			</div>
			{command.shortcut && (
				<kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
					{command.shortcut}
				</kbd>
			)}
		</button>
	);
}

/**
 * Hook to manage slash command menu state with the editor.
 */
export function useSlashCommandMenu(editor: {
	state: { selection: { empty: boolean; from: number; to: number } };
	view: { state: unknown };
} | null) {
	const [menuState, setMenuState] = React.useState<SlashCommandState>({
		isOpen: false,
		query: "",
		position: 0,
		rect: null,
	});

	const hasSelection = !editor?.state.selection.empty;

	const onOpen = React.useCallback((state: SlashCommandState) => {
		setMenuState(state);
	}, []);

	const onClose = React.useCallback(() => {
		setMenuState((prev) => ({ ...prev, isOpen: false, query: "" }));
	}, []);

	const onQueryChange = React.useCallback((query: string) => {
		setMenuState((prev) => ({ ...prev, query }));
	}, []);

	return {
		menuState,
		hasSelection,
		onOpen,
		onClose,
		onQueryChange,
	};
}

/**
 * Standalone command palette (triggered by keyboard shortcut).
 */
export function CommandPalette({
	isOpen,
	onClose,
	onSelect,
	hasSelection,
}: {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (command: AICommand) => void;
	hasSelection: boolean;
}) {
	const [query, setQuery] = React.useState("");
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const inputRef = React.useRef<HTMLInputElement>(null);

	const commands = React.useMemo(() => {
		return getCommandSuggestions(query, hasSelection);
	}, [query, hasSelection]);

	// Focus input when opened
	React.useEffect(() => {
		if (isOpen) {
			setQuery("");
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [isOpen]);

	// Keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((i) => (i + 1) % commands.length);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
				break;
			case "Enter":
				e.preventDefault();
				if (commands[selectedIndex]) {
					onSelect(commands[selectedIndex]);
				}
				break;
			case "Escape":
				e.preventDefault();
				onClose();
				break;
		}
	};

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
			role="dialog"
			aria-modal="true"
			aria-label="AI command palette"
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Modal */}
			<div className="relative w-full max-w-lg mx-4 rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
				{/* Search input */}
				<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
					<Sparkles className="h-5 w-5 text-gray-400" aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						role="combobox"
						aria-expanded="true"
						aria-controls="command-palette-list"
						aria-activedescendant={commands[selectedIndex] ? `palette-cmd-${commands[selectedIndex].id}` : undefined}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleKeyDown}
						placeholder="Search AI commands..."
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
					/>
					<kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-500">
						esc
					</kbd>
				</div>

				{/* Command list */}
				<div
					id="command-palette-list"
					role="listbox"
					aria-label="Available AI commands"
					className="max-h-80 overflow-y-auto py-2"
				>
					{commands.length === 0 ? (
						<div className="px-4 py-8 text-center text-sm text-gray-500" role="status">
							No commands found
						</div>
					) : (
						commands.map((command, index) => (
							<CommandItem
								key={command.id}
								command={command}
								isSelected={index === selectedIndex}
								dataIndex={index}
								onSelect={() => onSelect(command)}
								onHover={() => setSelectedIndex(index)}
								idPrefix="palette-cmd"
							/>
						))
					)}
				</div>
			</div>
		</div>
	);
}
