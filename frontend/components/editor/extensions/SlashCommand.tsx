/**
 * Slash command Tiptap extension for DocFusion.
 *
 * Triggers a command palette when user types "/" at the start
 * of a line or after a space. Integrates with the AI command registry.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { AICommand } from "@/lib/types/ai";

/** Plugin key for slash command state */
export const slashCommandPluginKey = new PluginKey("slashCommand");

/**
 * State for the slash command plugin.
 */
export interface SlashCommandState {
	/** Whether the command menu is open */
	isOpen: boolean;
	/** Current query (text after "/") */
	query: string;
	/** Position where "/" was typed */
	position: number;
	/** DOM coordinates for positioning the menu */
	rect: DOMRect | null;
}

/**
 * Options for the slash command extension.
 */
export interface SlashCommandOptions {
	/** Callback when command menu should open */
	onOpen?: (state: SlashCommandState) => void;
	/** Callback when command menu should close */
	onClose?: () => void;
	/** Callback when query changes */
	onQueryChange?: (query: string) => void;
	/** Callback when a command is selected */
	onSelectCommand?: (command: AICommand) => void;
	/** Custom trigger character (default: "/") */
	triggerChar?: string;
	/** Whether to require start of line or space before trigger */
	requireBoundary?: boolean;
}

/**
 * Slash command extension for Tiptap.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
	name: "slashCommand",

	addOptions() {
		return {
			triggerChar: "/",
			requireBoundary: true,
			onOpen: undefined,
			onClose: undefined,
			onQueryChange: undefined,
			onSelectCommand: undefined,
		};
	},

	addProseMirrorPlugins() {
		const extension = this;

		return [
			new Plugin({
				key: slashCommandPluginKey,

				state: {
					init(): SlashCommandState {
						return {
							isOpen: false,
							query: "",
							position: 0,
							rect: null,
						};
					},

					apply(tr, state): SlashCommandState {
						const meta = tr.getMeta(slashCommandPluginKey);
						if (meta) {
							return { ...state, ...meta };
						}

						// If selection changed and menu is open, check if we should close
						if (state.isOpen && tr.selectionSet) {
							const { from } = tr.selection;
							// Close if cursor moved before the trigger position
							if (from < state.position) {
								extension.options.onClose?.();
								return { ...state, isOpen: false, query: "" };
							}
						}

						return state;
					},
				},

				props: {
					handleKeyDown(view: EditorView, event: KeyboardEvent) {
						const state = slashCommandPluginKey.getState(view.state) as SlashCommandState;

						// Handle escape to close menu
						if (state.isOpen && event.key === "Escape") {
							view.dispatch(
								view.state.tr.setMeta(slashCommandPluginKey, {
									isOpen: false,
									query: "",
								})
							);
							extension.options.onClose?.();
							return true;
						}

						// Handle enter to confirm (handled by menu component)
						if (state.isOpen && (event.key === "Enter" || event.key === "Tab")) {
							// Let the menu component handle this
							return false;
						}

						// Handle arrow keys for menu navigation (handled by menu component)
						if (state.isOpen && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
							return false;
						}

						return false;
					},

					handleTextInput(view: EditorView, from: number, to: number, text: string) {
						const { triggerChar, requireBoundary, onOpen, onQueryChange } = extension.options;
						const state = slashCommandPluginKey.getState(view.state) as SlashCommandState;

						// Check if we're typing the trigger character
						if (text === triggerChar) {
							// Check boundary requirement
							if (requireBoundary) {
								const $pos = view.state.doc.resolve(from);
								const textBefore = $pos.parent.textContent.slice(0, $pos.parentOffset);
								const isValidBoundary = textBefore.length === 0 || /\s$/.test(textBefore);

								if (!isValidBoundary) {
									return false;
								}
							}

							// Get DOM coordinates for menu positioning
							const coords = view.coordsAtPos(from);
							const rect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);

							// Open the menu
							const newState: SlashCommandState = {
								isOpen: true,
								query: "",
								position: from,
								rect,
							};

							// Schedule the state update after the text is inserted
							setTimeout(() => {
								view.dispatch(
									view.state.tr.setMeta(slashCommandPluginKey, newState)
								);
								onOpen?.(newState);
							}, 0);

							return false; // Let the character be inserted
						}

						// If menu is open, update the query
						if (state.isOpen) {
							const { position } = state;
							const currentQuery = state.query + text;

							// Check if this is a valid command character
							if (/^[a-zA-Z0-9-_]$/.test(text)) {
								setTimeout(() => {
									const newState = { ...state, query: currentQuery };
									view.dispatch(
										view.state.tr.setMeta(slashCommandPluginKey, newState)
									);
									onQueryChange?.(currentQuery);
								}, 0);
							} else if (text === " ") {
								// Space ends the command query
								// The command will be executed by the menu
							}

							return false;
						}

						return false;
					},

					handleDOMEvents: {
						// Close menu on blur
						blur(view: EditorView) {
							const state = slashCommandPluginKey.getState(view.state) as SlashCommandState;
							if (state.isOpen) {
								// Small delay to allow clicking menu items
								setTimeout(() => {
									view.dispatch(
										view.state.tr.setMeta(slashCommandPluginKey, {
											isOpen: false,
											query: "",
										})
									);
									extension.options.onClose?.();
								}, 200);
							}
							return false;
						},
					},
				},
			}),
		];
	},

	addKeyboardShortcuts() {
		return {
			// Delete key should update query if menu is open
			Backspace: ({ editor }) => {
				const state = slashCommandPluginKey.getState(editor.state) as SlashCommandState | undefined;

				if (state?.isOpen && state.query.length > 0) {
					const newQuery = state.query.slice(0, -1);
					editor.view.dispatch(
						editor.state.tr.setMeta(slashCommandPluginKey, {
							...state,
							query: newQuery,
						})
					);
					this.options.onQueryChange?.(newQuery);
					return false; // Let default behavior handle the actual deletion
				}

				// If query is empty and backspace is pressed, close the menu
				if (state?.isOpen && state.query.length === 0) {
					editor.view.dispatch(
						editor.state.tr.setMeta(slashCommandPluginKey, {
							isOpen: false,
							query: "",
						})
					);
					this.options.onClose?.();
					return false;
				}

				return false;
			},
		};
	},
});

/**
 * Helper to close the slash command menu programmatically.
 */
export function closeSlashCommandMenu(editor: {
	view: EditorView;
}): void {
	const { state } = editor.view;
	const tr = state.tr.setMeta(slashCommandPluginKey, {
		isOpen: false,
		query: "",
	});
	editor.view.dispatch(tr);
}

/**
 * Helper to get the current slash command state.
 */
export function getSlashCommandState(editor: {
	state: unknown;
}): SlashCommandState | undefined {
	return slashCommandPluginKey.getState(editor.state as Parameters<typeof slashCommandPluginKey.getState>[0]) as SlashCommandState | undefined;
}

/**
 * Helper to delete the slash command text from the editor.
 * Called after a command is selected to remove the "/command" text.
 */
export function deleteSlashCommandText(
	editor: { commands: { deleteRange: (range: { from: number; to: number }) => boolean }; state: { selection: { from: number } } },
	state: SlashCommandState
): void {
	const { position, query } = state;
	// Delete from "/" position to current cursor
	editor.commands.deleteRange({
		from: position,
		to: position + 1 + query.length, // "/" + query
	});
}
