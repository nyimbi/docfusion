"use client";

/**
 * Equation Extension for Tiptap
 * 
 * Supports inline math ($...$) and block equations ($$...$$)
 * Uses KaTeX for rendering
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface EquationOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    equation: {
      insertEquation: (content: string) => ReturnType;
      toggleEquation: () => ReturnType;
    };
  }
}

export const Equation = Node.create<EquationOptions>({
  name: "equation",

  group: "block",

  content: "text*",

  marks: "",

  selectable: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "equation-block",
      },
    };
  },

  addAttributes() {
    return {
      content: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-content"),
        renderHTML: (attributes) => ({
          "data-content": attributes.content,
        }),
      },
      displayMode: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-display") === "true",
        renderHTML: (attributes) => ({
          "data-display": String(attributes.displayMode),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="equation"]',
      },
      {
        tag: "math",
        getAttrs: (element) => ({
          content: element.textContent || "",
          displayMode: true,
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": "equation" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      HTMLAttributes.content || "",
    ];
  },

  addCommands() {
    return {
      insertEquation:
        (content: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { content, displayMode: true },
          });
        },
      toggleEquation:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, "paragraph");
        },
    };
  },


});

export interface InlineEquationOptions {
  HTMLAttributes: Record<string, any>;
}

export const InlineEquation = Node.create<InlineEquationOptions>({
  name: "inlineEquation",

  group: "inline",

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "equation-inline",
      },
    };
  },

  addAttributes() {
    return {
      content: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-content"),
        renderHTML: (attributes) => ({
          "data-content": attributes.content,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-equation"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": "inline-equation" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      HTMLAttributes.content || "",
    ];
  },
});
