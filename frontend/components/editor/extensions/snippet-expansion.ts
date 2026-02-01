/**
 * Snippet Expansion Extension for Tiptap.
 *
 * Handles shortcut expansion when users type "/shortcut" + Space/Enter.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { Node as PMNode } from "@tiptap/pm/model";
import type { SnippetSummary } from "@/lib/types/snippets";
import type { DocumentContent } from "@/lib/types/document";

/**
 * Options for the SnippetExpansion extension.
 */
export interface SnippetExpansionOptions {
  /**
   * Callback to resolve a shortcut to snippet content.
   * Return null if no snippet found for this shortcut.
   */
  onShortcutResolve: (shortcut: string) => Promise<SnippetSummary | null>;
  /**
   * Callback to get snippet content by ID.
   * Return null if snippet not found or inaccessible.
   */
  onGetSnippetContent: (snippet: SnippetSummary) => Promise<DocumentContent | null>;
  /**
   * Trigger character(s) before shortcut. Default: "/"
   */
  triggerChar?: string;
  /**
   * Characters that trigger expansion. Default: [" ", "\n"]
   */
  expansionTriggers?: string[];
  /**
   * Minimum shortcut length. Default: 1
   */
  minShortcutLength?: number;
  /**
   * Maximum shortcut length. Default: 50
   */
  maxShortcutLength?: number;
  /**
   * Called when a shortcut is expanded.
   */
  onExpand?: (shortcut: string, snippet: SnippetSummary) => void;
  /**
   * Called when shortcut expansion fails.
   */
  onError?: (shortcut: string, error: Error) => void;
}

/**
 * Extension that enables snippet expansion in the editor.
 *
 * Detects patterns like "/shortcut" followed by space/enter and
 * replaces them with the corresponding snippet content.
 */
export const SnippetExpansion = Extension.create<SnippetExpansionOptions>({
  name: "snippetExpansion",

  addOptions() {
    return {
      triggerChar: "/",
      expansionTriggers: [" ", "\n"],
      minShortcutLength: 1,
      maxShortcutLength: 50,
      onShortcutResolve: async () => null,
      onGetSnippetContent: async () => null,
    };
  },

  onBeforeCreate() {
    // Store options for plugin access
    this.storage.options = this.options;
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey("snippetExpansion"),

        handleTextInput: (view: EditorView, from: number, to: number, text: string) => {
          // Check if text input is an expansion trigger
          if (!options.expansionTriggers?.includes(text)) {
            return false;
          }

          const { state } = view;
          const { $from } = state.selection;

          // Get text before cursor
          const maxLookback = options.maxShortcutLength! + 1;
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - maxLookback),
            $from.parentOffset
          );

          // Match: trigger + shortcut chars at the end
          const pattern = new RegExp(
            `(${options.triggerChar!})([a-zA-Z0-9_-]{${options.minShortcutLength},${options.maxShortcutLength}})$`
          );

          const match = textBefore.match(pattern);
          if (!match) {
            return false;
          }

          const shortcutText = match[1] + match[2]; // Full shortcut including trigger
          const shortcutName = match[2]; // Just the name without trigger

          // Schedule expansion (must be async)
          Promise.resolve().then(async () => {
            try {
              const snippet = await options.onShortcutResolve(shortcutName);
              if (!snippet) {
                return;
              }

              const content = await options.onGetSnippetContent(snippet);
              if (!content) {
                return;
              }

              // Calculate the range to replace
              const shortcutStart = from - match[0].length;
              const shortcutEnd = to;

              // Create a transaction
              const tr = view.state.tr;

              // Delete the shortcut text (but keep the trigger character since we handled it)
              tr.delete(shortcutStart, shortcutEnd);

              // Parse and insert the snippet content
              try {
                const jsonContent = typeof content === "string" 
                  ? JSON.parse(content) 
                  : content;

                const nodes: PMNode[] = [];

                if (jsonContent.type === "doc" && Array.isArray(jsonContent.content)) {
                  // Insert each content block
                  jsonContent.content.forEach((nodeJson: unknown) => {
                    try {
                      const node = editor.schema.nodeFromJSON(nodeJson);
                      nodes.push(node);
                    } catch (e) {
                      console.warn("Failed to parse node:", nodeJson, e);
                    }
                  });
                } else if (jsonContent.type) {
                  // Single node
                  try {
                    const node = editor.schema.nodeFromJSON(jsonContent);
                    nodes.push(node);
                  } catch (e) {
                    console.warn("Failed to parse node:", jsonContent, e);
                  }
                }

                // Insert nodes
                let insertPos = shortcutStart;
                nodes.forEach((node) => {
                  tr.insert(insertPos, node);
                  insertPos += node.nodeSize;
                });

                // Dispatch transaction
                view.dispatch(tr);

                // Call onExpand callback
                options.onExpand?.(shortcutName, snippet);
              } catch (error) {
                console.error("Failed to insert snippet:", error);
                options.onError?.(shortcutName, error as Error);
              }
            } catch (error) {
              console.error("Snippet expansion error:", error);
              options.onError?.(shortcutName, error as Error);
            }
          });

          // Allow the trigger character to be typed
          return false;
        },

        // Handle Enter key for expansion
        handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
          if (event.key !== "Enter") {
            return false;
          }

          const { state, dispatch } = view;
          const { $from } = state.selection;

          // Get text before cursor
          const maxLookback = options.maxShortcutLength! + 1;
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - maxLookback),
            $from.parentOffset
          );

          // Match: trigger + shortcut chars at the end
          const pattern = new RegExp(
            `(${options.triggerChar!})([a-zA-Z0-9_-]{${options.minShortcutLength},${options.maxShortcutLength}})$`
          );

          const match = textBefore.match(pattern);
          if (!match) {
            return false;
          }

          // Prevent default Enter behavior
          event.preventDefault();

          const shortcutName = match[2];

          // Handle expansion asynchronously
          Promise.resolve().then(async () => {
            try {
              const snippet = await options.onShortcutResolve(shortcutName);
              if (!snippet) {
                // Not a valid shortcut, insert newline
                editor.chain().focus().insertContent("\n").run();
                return;
              }

              const content = await options.onGetSnippetContent(snippet);
              if (!content) {
                // No content, insert newline
                editor.chain().focus().insertContent("\n").run();
                return;
              }

              // Calculate the range to replace
              const shortcutStart = $from.pos - match[0].length;
              const shortcutEnd = $from.pos;

              // Create transaction
              const tr = view.state.tr;

              // Delete the shortcut text
              tr.delete(shortcutStart, shortcutEnd);

              // Parse and insert content
              try {
                const jsonContent = typeof content === "string" 
                  ? JSON.parse(content) 
                  : content;

                const nodes: PMNode[] = [];

                if (jsonContent.type === "doc" && Array.isArray(jsonContent.content)) {
                  jsonContent.content.forEach((nodeJson: unknown) => {
                    try {
                      const node = editor.schema.nodeFromJSON(nodeJson);
                      nodes.push(node);
                    } catch (e) {
                      console.warn("Failed to parse node:", nodeJson, e);
                    }
                  });
                } else if (jsonContent.type) {
                  try {
                    const node = editor.schema.nodeFromJSON(jsonContent);
                    nodes.push(node);
                  } catch (e) {
                    console.warn("Failed to parse node:", jsonContent, e);
                  }
                }

                // Insert nodes with newline at end if needed
                let insertPos = shortcutStart;
                nodes.forEach((node) => {
                  tr.insert(insertPos, node);
                  insertPos += node.nodeSize;
                });

                // Add newline after content
                const paragraphNode = editor.schema.nodes.paragraph?.create();
                if (paragraphNode) {
                  tr.insert(insertPos, paragraphNode);
                  tr.setSelection(Selection.near(tr.doc.resolve(insertPos)));
                }

                dispatch(tr);
                options.onExpand?.(shortcutName, snippet);
              } catch (error) {
                console.error("Failed to insert snippet:", error);
                options.onError?.(shortcutName, error as Error);
              }
            } catch (error) {
              console.error("Snippet expansion error:", error);
              options.onError?.(shortcutName, error as Error);
              // Fall back to newline
              editor.chain().focus().insertContent("\n").run();
            }
          });

          return true;
        },
      }),
    ];
  },
});

export default SnippetExpansion;
