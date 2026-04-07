"use client";

/**
 * External File Extension for Tiptap
 * 
 * Allows linking to external files and attachments
 * Supports drag-and-drop file uploads
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { logger } from "@/lib/utils/logger";

export interface ExternalFileOptions {
  HTMLAttributes: Record<string, any>;
  onFileUpload?: (file: File) => Promise<string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    externalFile: {
      insertExternalFile: (attrs: ExternalFileAttributes) => ReturnType;
    };
  }
}

export interface ExternalFileAttributes {
  url: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  description?: string;
}

export const ExternalFile = Node.create<ExternalFileOptions>({
  name: "externalFile",

  group: "block",

  selectable: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "external-file-attachment",
      },
    };
  },

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url"),
        renderHTML: (attributes) => ({
          "data-url": attributes.url,
        }),
      },
      filename: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-filename"),
        renderHTML: (attributes) => ({
          "data-filename": attributes.filename,
        }),
      },
      fileType: {
        default: "application/octet-stream",
        parseHTML: (element) => element.getAttribute("data-filetype"),
        renderHTML: (attributes) => ({
          "data-filetype": attributes.fileType,
        }),
      },
      fileSize: {
        default: 0,
        parseHTML: (element) => parseInt(element.getAttribute("data-filesize") || "0"),
        renderHTML: (attributes) => ({
          "data-filesize": String(attributes.fileSize),
        }),
      },
      description: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-description"),
        renderHTML: (attributes) => ({
          "data-description": attributes.description,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="external-file"]',
      },
      {
        tag: 'a[href][data-file]',
        getAttrs: (element) => ({
          url: element.getAttribute("href"),
          filename: element.getAttribute("data-file") || element.textContent,
          fileType: element.getAttribute("data-type") || "application/octet-stream",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const fileTypeIcon = getFileTypeIcon(HTMLAttributes.fileType);
    const fileSizeFormatted = formatFileSize(HTMLAttributes.fileSize);
    
    return [
      "div",
      mergeAttributes(
        { "data-type": "external-file" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      [
        "a",
        {
          href: HTMLAttributes.url,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "file-link",
        },
        [
          "span",
          { class: "file-icon" },
          fileTypeIcon,
        ],
        [
          "span",
          { class: "file-info" },
          [
            "span",
            { class: "file-name" },
            HTMLAttributes.filename,
          ],
          [
            "span",
            { class: "file-meta" },
            `${HTMLAttributes.fileType}${fileSizeFormatted ? ` · ${fileSizeFormatted}` : ""}`,
          ],
          HTMLAttributes.description && [
            "span",
            { class: "file-description" },
            HTMLAttributes.description,
          ],
        ],
      ],
    ];
  },

  addCommands() {
    return {
      insertExternalFile:
        (attrs: ExternalFileAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addProseMirrorPlugins() {
    const { onFileUpload } = this.options;
    
    if (!onFileUpload) return [];

    return [
      new Plugin({
        key: new PluginKey("externalFileDrop"),
        props: {
          handleDrop: (view, event) => {
            const files = event.dataTransfer?.files;
            if (!files?.length) return false;

            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            
            if (!coordinates) return false;

            Array.from(files).forEach(async (file) => {
              try {
                const url = await onFileUpload(file);
                
                view.dispatch(
                  view.state.tr.insert(
                    coordinates.pos,
                    this.type.create({
                      url,
                      filename: file.name,
                      fileType: file.type,
                      fileSize: file.size,
                    })
                  )
                );
              } catch (error) {
                logger.error("File upload failed:", error);
              }
            });

            return true;
          },
        },
      }),
    ];
  },
});

function getFileTypeIcon(fileType: string): string {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.includes("pdf")) return "📄";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  if (fileType.includes("excel") || fileType.includes("spreadsheet")) return "📊";
  if (fileType.includes("powerpoint") || fileType.includes("presentation")) return "📽️";
  if (fileType.includes("zip") || fileType.includes("compressed")) return "🗜️";
  if (fileType.startsWith("video/")) return "🎬";
  if (fileType.startsWith("audio/")) return "🎵";
  if (fileType.includes("code") || fileType.includes("javascript") || fileType.includes("json")) return "💻";
  return "📎";
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
