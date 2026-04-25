/**
 * Callout/Alert Box Extension for Tiptap.
 *
 * Provides styled alert boxes for RFP responses:
 * - info (blue)
 * - warning (amber)
 * - success (green)
 * - danger (red)
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface CalloutOptions {
	HTMLAttributes: Record<string, unknown>;
}

export interface CalloutAttributes {
	variant: "info" | "warning" | "success" | "danger";
	title?: string;
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		callout: {
			/**
			 * Set a callout node
			 */
			setCallout: (attributes?: CalloutAttributes) => ReturnType;
			/**
			 * Toggle a callout node
			 */
			toggleCallout: (attributes?: CalloutAttributes) => ReturnType;
			/**
			 * Unset a callout node
			 */
			unsetCallout: () => ReturnType;
		};
	}
}

const variantClasses: Record<string, string> = {
	info: "callout-info bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100",
	warning:
		"callout-warning bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100",
	success:
		"callout-success bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100",
	danger:
		"callout-danger bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100",
};

export const Callout = Node.create<CalloutOptions>({
	name: "callout",
	group: "block",
	content: "block+",
	draggable: true,

	addOptions() {
		return {
			HTMLAttributes: {},
		};
	},

	addAttributes() {
		return {
			variant: {
				default: "info",
				parseHTML: (element) =>
					element.getAttribute("data-variant") || "info",
				renderHTML: (attributes) => ({
					"data-variant": attributes.variant,
				}),
			},
			title: {
				default: null,
				parseHTML: (element) =>
					element.getAttribute("data-title") || undefined,
				renderHTML: (attributes) =>
					attributes.title ? { "data-title": attributes.title } : {},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-type="callout"]',
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const variant = (node.attrs.variant as string) || "info";
		const classes = variantClasses[variant] || variantClasses.info;

		return [
			"div",
			mergeAttributes(
				{
					"data-type": "callout",
					class: `callout border-l-4 rounded-r p-4 my-4 ${classes}`,
				},
				this.options.HTMLAttributes,
				HTMLAttributes
			),
			0,
		];
	},

	addCommands() {
		return {
			setCallout:
				(attributes) =>
				({ commands }) => {
					return commands.wrapIn(this.name, attributes);
				},
			toggleCallout:
				(attributes) =>
				({ commands }) => {
					return commands.toggleWrap(this.name, attributes);
				},
			unsetCallout:
				() =>
				({ commands }) => {
					return commands.lift(this.name);
				},
		};
	},

	addKeyboardShortcuts() {
		return {
			"Mod-Shift-C": () => this.editor.commands.toggleCallout(),
		};
	},
});
