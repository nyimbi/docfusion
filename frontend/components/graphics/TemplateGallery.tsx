"use client";

/**
 * TemplateGallery Component - DocFusion
 *
 * Browse and use diagram templates from the diagram library.
 * Provides a visual gallery of pre-built templates organized by type.
 *
 * Features:
 * - Shows templates from lib/diagrams library
 * - Filter by diagram type (mermaid, plantuml, d2, structurizr)
 * - Preview on hover
 * - Use template button
 * - Tag-based filtering
 *
 * @module components/graphics/TemplateGallery
 */

import * as React from "react";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
	getLibraryTemplates,
	createGraphicFromLibraryTemplate,
} from "@/lib/actions/graphics";
import {
	getTemplates,
	getAvailableTags,
	type DiagramTemplate,
} from "@/lib/diagrams";
import { GraphicPreview } from "./GraphicPreview";
import {
	Search,
	Filter,
	BookTemplate,
	Plus,
	X,
	Eye,
	GitBranch,
	Box,
	FileCode,
	Layers,
	Check,
} from "lucide-react";

// Format icons
const FORMAT_ICONS: Record<string, React.ElementType> = {
	mermaid: GitBranch,
	plantuml: FileCode,
	d2: Box,
	structurizr: Layers,
	excalidraw: BookTemplate,
};

// Format labels
const FORMAT_LABELS: Record<string, string> = {
	mermaid: "Mermaid",
	plantuml: "PlantUML",
	d2: "D2",
	structurizr: "Structurizr",
	excalidraw: "Excalidraw",
};

interface TemplateCardProps {
	template: DiagramTemplate;
	onSelect: () => void;
	onPreview: () => void;
}

/**
 * Individual template card
 */
function TemplateCard({ template, onSelect, onPreview }: TemplateCardProps) {
	const [isHovered, setIsHovered] = useState(false);
	const FormatIcon = FORMAT_ICONS[template.type] || BookTemplate;

	return (
		<Card
			interactive
			className={cn(
				"group relative overflow-hidden transition-all",
				isHovered && "ring-2 ring-primary"
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Preview area */}
			<div className="relative aspect-video bg-muted/30 overflow-hidden">
				{template.content && isHovered ? (
					<div className="absolute inset-0 p-2">
						<GraphicPreview
							code={template.content}
							format={template.type === "all" ? "mermaid" : (template.type as "mermaid" | "d2")}
							showControls={false}
							className="h-full"
						/>
					</div>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<FormatIcon className="h-10 w-10 text-muted-foreground/30" />
					</div>
				)}

				{/* Format badge */}
				<Badge
					variant="secondary"
					className="absolute top-2 right-2 text-xs capitalize"
				>
					{FORMAT_LABELS[template.type] || template.type}
				</Badge>

				{/* Hover overlay with actions */}
				<div
					className={cn(
						"absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity",
						isHovered ? "opacity-100" : "opacity-0"
					)}
				>
					<Button size="sm" variant="secondary" onClick={onPreview}>
						<Eye className="h-4 w-4 mr-1" />
						Preview
					</Button>
					<Button size="sm" onClick={onSelect}>
						<Plus className="h-4 w-4 mr-1" />
						Use
					</Button>
				</div>
			</div>

			<CardHeader className="p-3 pb-2">
				<CardTitle className="text-sm line-clamp-1">{template.name}</CardTitle>
				<CardDescription className="text-xs line-clamp-2">
					{template.description}
				</CardDescription>
			</CardHeader>

			<CardContent className="p-3 pt-0">
				<div className="flex flex-wrap gap-1">
					{template.tags.slice(0, 3).map((tag) => (
						<Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
							{tag}
						</Badge>
					))}
					{template.tags.length > 3 && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0">
							+{template.tags.length - 3}
						</Badge>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Template preview dialog
 */
function TemplatePreviewDialog({
	template,
	isOpen,
	onClose,
	onUse,
}: {
	template: DiagramTemplate | null;
	isOpen: boolean;
	onClose: () => void;
	onUse: () => void;
}) {
	if (!template) return null;

	const FormatIcon = FORMAT_ICONS[template.type] || BookTemplate;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<FormatIcon className="h-5 w-5 text-primary" />
						<DialogTitle>{template.name}</DialogTitle>
					</div>
					<DialogDescription>{template.description}</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-2 gap-4">
					{/* Preview */}
					<div className="border rounded-lg overflow-hidden h-[400px]">
						<GraphicPreview
							code={template.content}
							format={template.type === "all" ? "mermaid" : (template.type as "mermaid" | "d2")}
							className="h-full"
						/>
					</div>

					{/* Code */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Template Code</span>
							<Badge variant="secondary" className="text-xs">
								{FORMAT_LABELS[template.type] || template.type}
							</Badge>
						</div>
						<ScrollArea className="h-[340px] border rounded-lg">
							<pre className="p-3 text-xs font-mono">
								{template.content || "No code content"}
							</pre>
						</ScrollArea>
						<div className="flex flex-wrap gap-1">
							{template.tags.map((tag) => (
								<Badge key={tag} variant="outline" className="text-xs">
									{tag}
								</Badge>
							))}
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
					<Button onClick={onUse}>
						<Plus className="h-4 w-4 mr-1" />
						Use This Template
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Empty state
 */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<BookTemplate className="h-12 w-12 text-muted-foreground/40 mb-3" />
			<h3 className="text-sm font-medium mb-1">
				{hasFilters ? "No matching templates" : "No templates available"}
			</h3>
			<p className="text-xs text-muted-foreground max-w-xs">
				{hasFilters
					? "Try adjusting your filters or search query."
					: "Templates will appear here once they are added to the library."}
			</p>
		</div>
	);
}

interface TemplateGalleryProps {
	/** Opportunity ID for creating graphics from templates */
	opportunityId?: string;
	/** Callback when a template is selected */
	onSelectTemplate?: (template: DiagramTemplate) => void;
	/** Callback when a graphic is created from a template */
	onCreateGraphic?: (graphicId: string) => void;
	/** Additional CSS class names */
	className?: string;
}

/**
 * TemplateGallery - Browse and use diagram templates.
 *
 * @example
 * ```tsx
 * <TemplateGallery
 *   opportunityId={opportunityId}
 *   onSelectTemplate={(template) => {
 *     setDiagramCode(template.content);
 *   }}
 * />
 * ```
 */
export function TemplateGallery({
	opportunityId,
	onSelectTemplate,
	onCreateGraphic,
	className,
}: TemplateGalleryProps) {
	// State
	const [templates, setTemplates] = useState<DiagramTemplate[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
	const [previewTemplate, setPreviewTemplate] = useState<DiagramTemplate | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	// Get available tags
	const availableTags = useMemo(() => getAvailableTags(), []);

	// Load templates
	useEffect(() => {
		const filterType = typeFilter === "all" ? undefined : (typeFilter as DiagramTemplate["type"]);
		const filterTags = selectedTags.size > 0 ? Array.from(selectedTags) : undefined;
		const loaded = getTemplates(filterType, filterTags);
		setTemplates(loaded);
	}, [typeFilter, selectedTags]);

	// Filter templates by search
	const filteredTemplates = useMemo(() => {
		if (!searchQuery) return templates;

		const query = searchQuery.toLowerCase();
		return templates.filter(
			(t) =>
				t.name.toLowerCase().includes(query) ||
				t.description.toLowerCase().includes(query) ||
				t.tags.some((tag) => tag.toLowerCase().includes(query))
		);
	}, [templates, searchQuery]);

	// Toggle tag filter
	const toggleTag = useCallback((tag: string) => {
		setSelectedTags((prev) => {
			const next = new Set(prev);
			if (next.has(tag)) {
				next.delete(tag);
			} else {
				next.add(tag);
			}
			return next;
		});
	}, []);

	// Clear filters
	const clearFilters = useCallback(() => {
		setSearchQuery("");
		setTypeFilter("all");
		setSelectedTags(new Set());
	}, []);

	// Handle template selection
	const handleSelectTemplate = useCallback(
		(template: DiagramTemplate) => {
			onSelectTemplate?.(template);
		},
		[onSelectTemplate]
	);

	// Handle create graphic from template
	const handleCreateGraphic = useCallback(
		async (template: DiagramTemplate) => {
			if (!opportunityId) {
				// Just return the template code
				onSelectTemplate?.(template);
				return;
			}

			setIsCreating(true);

			const result = await createGraphicFromLibraryTemplate(
				template.id,
				opportunityId
			);

			if (result.success) {
				onCreateGraphic?.(result.data.id);
				setPreviewTemplate(null);
			}

			setIsCreating(false);
		},
		[opportunityId, onSelectTemplate, onCreateGraphic]
	);

	const hasFilters = !!(searchQuery || typeFilter !== "all" || selectedTags.size > 0);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Toolbar */}
			<div className="flex flex-col gap-3 p-4 border-b bg-background">
				<div className="flex items-center gap-3">
					{/* Search */}
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search templates..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					{/* Type filter */}
					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="w-[140px]">
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="Format" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Formats</SelectItem>
							{Object.entries(FORMAT_LABELS).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Clear filters */}
					{hasFilters && (
						<Button variant="ghost" size="sm" onClick={clearFilters}>
							<X className="h-4 w-4 mr-1" />
							Clear
						</Button>
					)}

					{/* Count */}
					<div className="text-sm text-muted-foreground">
						{filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}
					</div>
				</div>

				{/* Tag filters */}
				<div className="flex flex-wrap gap-1">
					{availableTags.slice(0, 15).map((tag) => (
						<Badge
							key={tag}
							variant={selectedTags.has(tag) ? "default" : "outline"}
							className="cursor-pointer text-xs"
							onClick={() => toggleTag(tag)}
						>
							{selectedTags.has(tag) && <Check className="h-3 w-3 mr-1" />}
							{tag}
						</Badge>
					))}
					{availableTags.length > 15 && (
						<span className="text-xs text-muted-foreground">
							+{availableTags.length - 15} more
						</span>
					)}
				</div>
			</div>

			{/* Template grid */}
			<ScrollArea className="flex-1 p-4">
				{filteredTemplates.length === 0 ? (
					<EmptyState hasFilters={hasFilters} />
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{filteredTemplates.map((template) => (
							<TemplateCard
								key={template.id}
								template={template}
								onSelect={() => handleSelectTemplate(template)}
								onPreview={() => setPreviewTemplate(template)}
							/>
						))}
					</div>
				)}
			</ScrollArea>

			{/* Preview dialog */}
			<TemplatePreviewDialog
				template={previewTemplate}
				isOpen={!!previewTemplate}
				onClose={() => setPreviewTemplate(null)}
				onUse={() => {
					if (previewTemplate) {
						handleCreateGraphic(previewTemplate);
					}
				}}
			/>
		</div>
	);
}
