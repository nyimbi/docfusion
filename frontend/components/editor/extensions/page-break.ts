/**
 * Page Break Extension for Tiptap.
 *
 * Inserts a visual page break marker that's respected during
 * PDF/DOCX export and print rendering.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface PageBreakOptions {
	HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		pageBreak: {
			/**
			 * Insert a page break
			 */
			setPageBreak: () => ReturnType;
		};
	}
}

export const PageBreak = Node.create<PageBreakOptions>({
	name: "pageBreak",
	group: "block",
	selectable: false,
	atom: true,

	addOptions() {
		return {
			HTMLAttributes: {},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-type="page-break"]',
			},
			{
				tag: 'hr[data-page-break]',
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(
				{
					"data-type": "page-break",
					class:
						"page-break flex items-center gap-3 my-6 select-none",
					contenteditable: "false",
				},
				this.options.HTMLAttributes,
				HTMLAttributes
			),
			[
				"span",
				{
					class:
						"flex-1 h-px bg-gray-300 dark:bg-gray-700",
				},
			],
			[
				"span",
				{
					class:
						"text-xs text-gray-400 dark:text-gray-600 uppercase tracking-wider px-2",
				},
				"Page Break",
			],
			[
				"span",
				{
					class:
						"flex-1 h-px bg-gray-300 dark:bg-gray-700",
				},
			],
		];
	},

	addNodeView() {
		return ({ HTMLAttributes }) => {
			const dom = document.createElement("div");
			dom.className =
				"page-break flex items-center gap-3 my-6 select-none";
			dom.setAttribute("data-type", "page-break");
			dom.setAttribute("contenteditable", "false");

			const leftLine = document.createElement("span");
			leftLine.className = "flex-1 h-px bg-gray-300 dark:bg-gray-700";

			const label = document.createElement("span");
			label.className =
				"text-xs text-gray-400 dark:text-gray-600 uppercase tracking-wider px-2";
			label.textContent = "Page Break";

			const rightLine = document.createElement("span");
			rightLine.className = "flex-1 h-px bg-gray-300 dark:bg-gray-700";

			dom.appendChild(leftLine);
			dom.appendChild(label);
			dom.appendChild(rightLine);

			return {
				dom,
				contentDOM: undefined,
			};
		};
	},

	addCommands() {
		return {
			setPageBreak:
				() =>
				({ chain }) => {
					return chain()
						.focus()
						.insertContent({ type: this.name })
						.run();
				},
		};
	},

	addKeyboardShortcuts() {
		return {
			"Mod-Shift-Enter": () => this.editor.commands.setPageBreak(),
		};
	},
});
