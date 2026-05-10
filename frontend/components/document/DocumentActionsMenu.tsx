"use client";

/**
 * Document Actions Menu - File menu with document management actions.
 *
 * Features:
 * - Duplicate document
 * - Apply template
 * - Export (PDF, DOCX, Markdown, HTML)
 * - Share document
 * - View versions
 * - Document settings
 */

import * as React from "react";
import { type Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
	MoreHorizontal,
	FileText,
	Copy,
	Share2,
	Download,
	History,
	Settings,
	FileJson,
	File as FileIconMarkdown,
	FileCode,
	FileImage,
	Folder,
	Trash2,
	Archive,
	ExternalLink,
	Printer,
	FileOutput,
	LayoutTemplate,
	FileCheck,
} from "lucide-react";
import type { Document, DocumentId } from "@/lib/types/document";
import {
	duplicateDocument,
	applyTemplateToDocument,
	archiveDocument,
} from "@/lib/actions/documents-enhanced";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentActionsMenuProps {
	document: Document;
	editor?: Editor | null;
	className?: string;
}

export function DocumentActionsMenu({
	document,
	editor,
	className,
}: DocumentActionsMenuProps) {
	const router = useRouter();
	const [isTemplateDialogOpen, setIsTemplateDialogOpen] = React.useState(false);
	const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
	const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
	const [selectedTemplate, setSelectedTemplate] = React.useState("");
	const [templateMode, setTemplateMode] = React.useState<"replace" | "append" | "interleave">("append");

	const handleDuplicateDocument = React.useCallback(async () => {
		try {
			const newDoc = await duplicateDocument(document.id);
			toast.success("Document duplicated");
			router.push(`/documents/${newDoc.id}`);
		} catch (error) {
			toast.error("Failed to duplicate document");
		}
	}, [document.id, router]);

	const handleApplyTemplate = React.useCallback(async () => {
		if (!selectedTemplate) return;
		try {
			await applyTemplateToDocument(document.id, selectedTemplate, templateMode);
			toast.success("Template applied");
			setIsTemplateDialogOpen(false);
		} catch (error) {
			toast.error("Failed to apply template");
		}
	}, [document.id, selectedTemplate, templateMode]);

	const handleExport = React.useCallback(async (format: "pdf" | "docx" | "markdown" | "html" | "json") => {
		try {
			// Get document content from editor
			const content = editor?.getHTML() ?? "";

			if (format === "markdown") {
				// Convert HTML to markdown and download
				const blob = new Blob([content], { type: "text/markdown" });
				const url = URL.createObjectURL(blob);
				const a = window.document.createElement("a");
				a.href = url;
				a.download = `${document.title}.md`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success("Exported as Markdown");
			} else if (format === "html") {
				// Export as HTML
				const fullHtml = `<!DOCTYPE html><html><head><title>${document.title}</title></head><body>${content}</body></html>`;
				const blob = new Blob([fullHtml], { type: "text/html" });
				const url = URL.createObjectURL(blob);
				const a = window.document.createElement("a");
				a.href = url;
				a.download = `${document.title}.html`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success("Exported as HTML");
			} else if (format === "json") {
				// Export document data as JSON
				const json = JSON.stringify({ title: document.title, content }, null, 2);
				const blob = new Blob([json], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = window.document.createElement("a");
				a.href = url;
				a.download = `${document.title}.json`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success("Exported as JSON");
			} else if (format === "pdf" || format === "docx") {
				// Server-side conversion via backend DocumentEngine. When the
				// editor is mounted, send its current HTML as content_override
				// so the export reflects unsaved edits (Bug 1, A.2). When no
				// editor is mounted (e.g. invoked from a document list), omit
				// the field and the backend uses the persisted body. Tiptap
				// returns "<p></p>" for an empty editor, never "", so the
				// server's min_length=1 guard isn't reachable in practice.
				const response = await fetch(`/api/v1/documents/${document.id}/render`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						output_format: format,
						...(editor ? { content_override: editor.getHTML() } : {}),
					}),
				});
				if (!response.ok) {
					const errorText = await response.text().catch(() => "Unknown error");
					throw new Error(`Server error: ${errorText}`);
				}
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				const a = window.document.createElement("a");
				a.href = url;
				a.download = `${document.title}.${format}`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success(`Exported as ${format.toUpperCase()}`);
			}
		} catch (error) {
			toast.error("Export failed");
		}
	}, [document.id, document.title, editor]);

	const handleShare = React.useCallback(async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success("Link copied to clipboard");
		} catch (error) {
			toast.error("Failed to copy link");
		}
	}, []);

	const handlePrint = React.useCallback(() => {
		try {
			window.print();
		} catch (error) {
			toast.error("Print failed");
		}
	}, []);

	const handleDocumentSettings = React.useCallback(() => {
		router.push(`/documents/${document.id}/settings`);
	}, [document.id, router]);

	const handleArchiveDocument = React.useCallback(async () => {
		const confirmed = window.confirm(
			"Are you sure you want to archive this document?\n\nYou can restore it later from the archived documents list."
		);
		if (!confirmed) return;

		try {
			await archiveDocument(document.id);
			toast.success("Document archived");
			router.push("/documents");
		} catch (error) {
			toast.error("Failed to archive document");
		}
	}, [document.id, router]);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className={className} aria-label="Document actions">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>Actions</DropdownMenuLabel>

					<DropdownMenuItem onClick={handleDuplicateDocument}>
						<Copy className="h-4 w-4 mr-2" />
						Duplicate
					</DropdownMenuItem>

					<DropdownMenuItem onClick={() => setIsTemplateDialogOpen(true)}>
						<LayoutTemplate className="h-4 w-4 mr-2" />
						Apply Template
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuLabel>Export</DropdownMenuLabel>

					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<Download className="h-4 w-4 mr-2" />
							Export As
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem onClick={() => handleExport("pdf")}>
								<FileImage className="h-4 w-4 mr-2" />
								PDF
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("docx")}>
								<FileText className="h-4 w-4 mr-2" />
								Word (DOCX)
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("markdown")}>
								<FileIconMarkdown className="h-4 w-4 mr-2" />
								Markdown
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("html")}>
								<FileCode className="h-4 w-4 mr-2" />
								HTML
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("json")}>
								<FileJson className="h-4 w-4 mr-2" />
								JSON
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>

					<DropdownMenuItem onClick={handlePrint}>
						<Printer className="h-4 w-4 mr-2" />
						Print
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={() => setIsShareDialogOpen(true)}>
						<Share2 className="h-4 w-4 mr-2" />
						Share
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={() => window.open(`/documents/${document.id}/versions`, "_blank")}>
						<History className="h-4 w-4 mr-2" />
						Version History
						<ExternalLink className="h-3 w-3 ml-auto" />
					</DropdownMenuItem>

					<DropdownMenuItem onClick={handleDocumentSettings}>
						<Settings className="h-4 w-4 mr-2" />
						Document Settings
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={handleArchiveDocument}>
						<Archive className="h-4 w-4 mr-2" />
						Archive Document
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Template Dialog */}
			<Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Apply Template</DialogTitle>
						<DialogDescription>
							Select a template to merge with your document
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<Select
							value={selectedTemplate}
							onValueChange={setSelectedTemplate}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a template" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="template-1">Project Proposal Template</SelectItem>
								<SelectItem value="template-2">Technical Specification</SelectItem>
								<SelectItem value="template-3">Report Template</SelectItem>
							</SelectContent>
						</Select>

						<div>
							<span className="text-sm font-medium">Merge Mode</span>
							<div className="mt-2 space-y-2">
								<button
									type="button"
									className={cn(
										"w-full flex items-start gap-2 p-3 rounded-lg border text-left",
										templateMode === "append" && "border-primary bg-primary/5"
									)}
									onClick={() => setTemplateMode("append")}
								>
									<div className="flex-1">
										<p className="font-medium">Append</p>
										<p className="text-sm text-muted-foreground">
											Add template content at the end
										</p>
									</div>
								</button>

								<button
									type="button"
									className={cn(
										"w-full flex items-start gap-2 p-3 rounded-lg border text-left",
										templateMode === "replace" && "border-primary bg-primary/5"
									)}
									onClick={() => setTemplateMode("replace")}
								>
									<div className="flex-1">
										<p className="font-medium">Replace</p>
										<p className="text-sm text-muted-foreground">
											Replace current content entirely
										</p>
									</div>
								</button>

								<button
									type="button"
									className={cn(
										"w-full flex items-start gap-2 p-3 rounded-lg border text-left",
										templateMode === "interleave" && "border-primary bg-primary/5"
									)}
									onClick={() => setTemplateMode("interleave")}
								>
									<div className="flex-1">
										<p className="font-medium">Interleave</p>
										<p className="text-sm text-muted-foreground">
											Merge content intelligently
										</p>
									</div>
								</button>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleApplyTemplate} disabled={!selectedTemplate}>
							Apply Template
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Share Dialog */}
			<Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Share Document</DialogTitle>
						<DialogDescription>
							Share this document with collaborators
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
							<input
								type="text"
								readOnly
								value={typeof window !== "undefined" ? window.location.href : ""}
								className="flex-1 bg-transparent text-sm"
							/ >
							<Button variant="ghost" size="sm" onClick={handleShare}>
								<Copy className="h-4 w-4 mr-2" />
								Copy
							</Button>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

