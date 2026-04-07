"use client";

import Image from "next/image";

/**
 * GraphicEditor Component - DocFusion
 *
 * Main editor for creating and editing proposal graphics. Provides:
 * - Code editor with syntax highlighting for Mermaid/D2/PlantUML/Structurizr
 * - Live preview panel
 * - Caption and action caption fields
 * - Template selection
 * - Save/cancel actions
 *
 * @module components/graphics/GraphicEditor
 */

import * as React from "react";
import { useCallback, useEffect, useState, useTransition, useMemo } from "react";
import {
	Card,
	CardContent,
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
	DialogTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
} from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
	createGraphic,
	updateGraphic,
	validateGraphicCode,
	formatGraphicCode,
	getGraphicTemplates,
} from "@/lib/actions/graphics";
import type {
	ProposalGraphic,
	GraphicTemplate,
	GraphicEditorProps,
	GraphicType,
	GraphicFormat,
} from "@/lib/types/graphics";
import { GraphicPreview } from "./GraphicPreview";
import { ActionCaptionEditor } from "./ActionCaptionEditor";
import {
	Save,
	X,
	Code,
	Eye,
	Layout,
	Wand2,
	FileCode,
	RefreshCw,
	AlertCircle,
	CheckCircle2,
	Sparkles,
	BookTemplate,
	Maximize2,
	Minimize2,
	Copy,
	Download,
} from "lucide-react";

// Diagram format options
const FORMAT_OPTIONS: { value: GraphicFormat; label: string; description: string }[] = [
	{ value: "mermaid", label: "Mermaid", description: "Flowcharts, sequence diagrams, etc." },
	{ value: "d2", label: "D2", description: "Declarative diagramming language" },
	{ value: "svg", label: "SVG", description: "Direct SVG code" },
	{ value: "png", label: "PNG", description: "Image URL" },
];

// Graphic type options
const TYPE_OPTIONS: { value: GraphicType; label: string }[] = [
	{ value: "org_chart", label: "Organizational Chart" },
	{ value: "process_flow", label: "Process Flow" },
	{ value: "schedule", label: "Schedule / Gantt" },
	{ value: "infographic", label: "Infographic" },
	{ value: "diagram", label: "General Diagram" },
	{ value: "chart", label: "Chart" },
];

interface ValidationState {
	valid: boolean;
	error?: string;
	format?: string;
}

/**
 * Simple code editor textarea with line numbers.
 * In production, this could be replaced with Monaco Editor or CodeMirror.
 */
function CodeEditor({
	value,
	onChange,
	format,
	error,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	format: GraphicFormat;
	error?: string;
	className?: string;
}) {
	const lines = value.split("\n");
	const lineNumbers = lines.map((_, i) => i + 1);

	return (
		<div className={cn("relative flex border rounded-md bg-muted/30", className)}>
			{/* Line numbers */}
			<div className="flex-shrink-0 py-3 px-2 text-right text-xs text-muted-foreground font-mono bg-muted/50 border-r select-none">
				{lineNumbers.map((num) => (
					<div key={num} className="h-5 leading-5">
						{num}
					</div>
				))}
			</div>

			{/* Code textarea */}
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					"flex-1 p-3 text-sm font-mono bg-transparent resize-none focus:outline-none",
					"min-h-[300px]",
					error && "text-destructive"
				)}
				placeholder={`Enter ${format} diagram code...`}
				spellCheck={false}
			/>

			{/* Error indicator */}
			{error && (
				<div className="absolute bottom-2 right-2 flex items-center gap-1 text-destructive text-xs">
					<AlertCircle className="h-3 w-3" />
					<span className="max-w-[200px] truncate">{error}</span>
				</div>
			)}
		</div>
	);
}

/**
 * Template selection dialog for quick starts.
 */
function TemplateDialog({
	format,
	onSelect,
	children,
}: {
	format: GraphicFormat;
	onSelect: (code: string) => void;
	children: React.ReactNode;
}) {
	const [templates, setTemplates] = useState<GraphicTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [open, setOpen] = useState(false);

	const loadTemplates = useCallback(async () => {
		setIsLoading(true);
		const result = await getGraphicTemplates();
		if (result.success) {
			// Filter templates by format
			const filtered = result.data.filter(
				(t) => t.format === format || format === "mermaid"
			);
			setTemplates(filtered);
		}
		setIsLoading(false);
	}, [format]);

	useEffect(() => {
		if (open) {
			loadTemplates();
		}
	}, [open, loadTemplates]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Select Template</DialogTitle>
					<DialogDescription>
						Choose a template to start with. You can customize it after insertion.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="h-[400px] pr-4">
					{isLoading ? (
						<div className="flex items-center justify-center h-40">
							<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : templates.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-40 text-center">
							<BookTemplate className="h-10 w-10 text-muted-foreground/40 mb-2" />
							<p className="text-sm text-muted-foreground">
								No templates available for this format.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-3">
							{templates.map((template) => (
								<Card
									key={template.id}
									interactive
									className="cursor-pointer"
									onClick={() => {
										onSelect(template.templateCode);
										setOpen(false);
									}}
								>
									<CardHeader className="p-3">
										<CardTitle className="text-sm">{template.name}</CardTitle>
									</CardHeader>
									<CardContent className="p-3 pt-0">
										<p className="text-xs text-muted-foreground line-clamp-2">
											{template.description}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

/**
 * GraphicEditor - Full-featured editor for creating and editing graphics.
 *
 * @example
 * ```tsx
 * <GraphicEditor
 *   opportunityId={opportunityId}
 *   onSave={(graphic) => console.log("Saved:", graphic)}
 *   onCancel={() => setEditorOpen(false)}
 * />
 *
 * // Edit existing graphic
 * <GraphicEditor
 *   graphic={existingGraphic}
 *   onSave={(graphic) => console.log("Updated:", graphic)}
 *   onCancel={() => setEditorOpen(false)}
 * />
 * ```
 */
export function GraphicEditor({
	graphic,
	opportunityId,
	documentId,
	sectionId,
	onSave,
	onCancel,
}: GraphicEditorProps) {
	// Determine if we're editing or creating
	const isEditing = !!graphic;

	// Form state
	const [title, setTitle] = useState(graphic?.title || "");
	const [figureNumber, setFigureNumber] = useState(graphic?.figureNumber || "");
	const [graphicType, setGraphicType] = useState<GraphicType>(
		(graphic?.graphicType as GraphicType) || "diagram"
	);
	const [format, setFormat] = useState<GraphicFormat>(
		(graphic?.format as GraphicFormat) || "mermaid"
	);
	const [diagramCode, setDiagramCode] = useState(graphic?.diagramCode || "");
	const [imageUrl, setImageUrl] = useState(graphic?.imageUrl || "");
	const [caption, setCaption] = useState(graphic?.caption || "");
	const [actionCaption, setActionCaption] = useState(graphic?.actionCaption || "");

	// UI state
	const [viewMode, setViewMode] = useState<"split" | "code" | "preview">("split");
	const [validation, setValidation] = useState<ValidationState>({ valid: true });
	const [isPending, startTransition] = useTransition();
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	// Track changes
	useEffect(() => {
		if (isEditing) {
			const hasChanges =
				title !== graphic.title ||
				figureNumber !== (graphic.figureNumber || "") ||
				graphicType !== graphic.graphicType ||
				format !== graphic.format ||
				diagramCode !== (graphic.diagramCode || "") ||
				imageUrl !== (graphic.imageUrl || "") ||
				caption !== (graphic.caption || "") ||
				actionCaption !== (graphic.actionCaption || "");
			setHasUnsavedChanges(hasChanges);
		} else {
			setHasUnsavedChanges(
				!!(title || diagramCode || imageUrl || caption || actionCaption)
			);
		}
	}, [
		isEditing,
		graphic,
		title,
		figureNumber,
		graphicType,
		format,
		diagramCode,
		imageUrl,
		caption,
		actionCaption,
	]);

	// Validate code when it changes
	const validateCode = useCallback(async () => {
		if (!diagramCode || format === "png") {
			setValidation({ valid: true });
			return;
		}

		const result = await validateGraphicCode(diagramCode, format as "mermaid" | "d2");
		if (result.success) {
			setValidation(result.data);
		}
	}, [diagramCode, format]);

	// Debounced validation
	useEffect(() => {
		const timer = setTimeout(validateCode, 500);
		return () => clearTimeout(timer);
	}, [validateCode]);

	// Format code
	const handleFormatCode = async () => {
		if (!diagramCode) return;

		const result = await formatGraphicCode(diagramCode, format as "mermaid" | "d2");
		if (result.success) {
			setDiagramCode(result.data.formattedCode);
		}
	};

	// Save handler
	const handleSave = async () => {
		if (!title.trim()) {
			return; // Title is required
		}

		startTransition(async () => {
			const effectiveOpportunityId = opportunityId || graphic?.opportunityId || undefined;
			const effectiveDocumentId = documentId || graphic?.documentId || undefined;
			const effectiveSectionId = sectionId || graphic?.sectionId || undefined;

			const data = {
				opportunityId: effectiveOpportunityId,
				documentId: effectiveDocumentId,
				sectionId: effectiveSectionId,
				title: title.trim(),
				figureNumber: figureNumber.trim() || undefined,
				graphicType,
				format,
				diagramCode: diagramCode || undefined,
				imageUrl: imageUrl || undefined,
				caption: caption || undefined,
				actionCaption: actionCaption || undefined,
				generatedBy: "manual" as const,
			};

			const result = isEditing
				? await updateGraphic(graphic.id, data)
				: await createGraphic(data);

			if (result.success) {
				onSave?.(result.data);
			}
		});
	};

	// Copy code to clipboard
	const handleCopyCode = async () => {
		if (diagramCode) {
			await navigator.clipboard.writeText(diagramCode);
		}
	};

	// Render code input based on format
	const renderCodeInput = () => {
		if (format === "png") {
			return (
				<div className="space-y-3">
					<Label htmlFor="imageUrl">Image URL</Label>
					<Input
						id="imageUrl"
						value={imageUrl}
						onChange={(e) => setImageUrl(e.target.value)}
						placeholder="https://example.com/image.png"
					/>
					<p className="text-xs text-muted-foreground">
						Enter the URL of an existing image to use as the graphic.
					</p>
				</div>
			);
		}

		return (
			<div className="space-y-3 h-full flex flex-col">
				<div className="flex items-center justify-between">
					<Label>Diagram Code</Label>
					<div className="flex items-center gap-1">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="sm" onClick={handleFormatCode}>
										<Wand2 className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Format code</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="sm" onClick={handleCopyCode}>
										<Copy className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Copy code</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TemplateDialog format={format} onSelect={setDiagramCode}>
							<Button variant="ghost" size="sm">
								<BookTemplate className="h-4 w-4 mr-1" />
								Templates
							</Button>
						</TemplateDialog>
					</div>
				</div>
				<CodeEditor
					value={diagramCode}
					onChange={setDiagramCode}
					format={format}
					error={validation.error}
					className="flex-1"
				/>
				{validation.valid && diagramCode && (
					<div className="flex items-center gap-1 text-green-600 text-xs">
						<CheckCircle2 className="h-3 w-3" />
						Valid {validation.format || format} syntax
					</div>
				)}
			</div>
		);
	};

	// Render preview panel
	const renderPreview = () => {
		if (format === "png" && imageUrl) {
			return (
				<div className="h-full flex items-center justify-center bg-muted/30 rounded-md p-4">
					<Image
						src={imageUrl}
						alt={title || "Preview"}
						className="max-w-full max-h-full object-contain"
						width={600}
						height={400}
						unoptimized
					/>
				</div>
			);
		}

		if (!diagramCode) {
			return (
				<div className="h-full flex items-center justify-center text-muted-foreground">
					<div className="text-center">
						<Eye className="h-10 w-10 mx-auto mb-2 opacity-40" />
						<p className="text-sm">Enter diagram code to see preview</p>
					</div>
				</div>
			);
		}

		return (
			<GraphicPreview
				code={diagramCode}
				format={format as "mermaid" | "d2"}
				className="h-full"
			/>
		);
	};

	return (
		<div
			className={cn(
				"flex flex-col bg-background",
				isFullscreen ? "fixed inset-0 z-50" : "h-full"
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-3">
					<FileCode className="h-5 w-5 text-muted-foreground" />
					<h2 className="text-lg font-semibold">
						{isEditing ? "Edit Graphic" : "New Graphic"}
					</h2>
					{hasUnsavedChanges && (
						<span className="text-xs text-muted-foreground">(unsaved changes)</span>
					)}
				</div>

				<div className="flex items-center gap-2">
					{/* View mode toggle */}
					<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
						<TabsList className="h-8">
							<TabsTrigger value="code" className="h-7 px-2">
								<Code className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="split" className="h-7 px-2">
								<Layout className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="preview" className="h-7 px-2">
								<Eye className="h-4 w-4" />
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsFullscreen(!isFullscreen)}
					>
						{isFullscreen ? (
							<Minimize2 className="h-4 w-4" />
						) : (
							<Maximize2 className="h-4 w-4" />
						)}
					</Button>

					<Button variant="outline" onClick={onCancel} disabled={isPending}>
						<X className="h-4 w-4 mr-1" />
						Cancel
					</Button>

					<Button
						onClick={handleSave}
						disabled={!title.trim() || isPending || !validation.valid}
						isLoading={isPending}
					>
						<Save className="h-4 w-4 mr-1" />
						{isEditing ? "Update" : "Create"}
					</Button>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex overflow-hidden">
				{/* Metadata sidebar */}
				<div className="w-80 border-r p-4 space-y-4 overflow-y-auto">
					<div className="space-y-2">
						<Label htmlFor="title">Title *</Label>
						<Input
							id="title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Organizational Structure"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="figureNumber">Figure Number</Label>
						<Input
							id="figureNumber"
							value={figureNumber}
							onChange={(e) => setFigureNumber(e.target.value)}
							placeholder="Figure 1-1"
						/>
					</div>

					<div className="space-y-2">
						<Label>Graphic Type</Label>
						<Select
							value={graphicType}
							onValueChange={(v) => setGraphicType(v as GraphicType)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TYPE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Format</Label>
						<Select
							value={format}
							onValueChange={(v) => setFormat(v as GraphicFormat)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FORMAT_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<div>
											<div>{option.label}</div>
											<div className="text-xs text-muted-foreground">
												{option.description}
											</div>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="caption">Caption</Label>
						<Textarea
							id="caption"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							placeholder="Descriptive caption for the figure..."
							rows={3}
						/>
					</div>

					<ActionCaptionEditor
						value={actionCaption}
						onChange={setActionCaption}
						graphicId={graphic?.id}
						title={title}
						graphicType={graphicType}
					/>
				</div>

				{/* Editor/Preview area */}
				<div className="flex-1 flex overflow-hidden">
					{(viewMode === "code" || viewMode === "split") && (
						<div
							className={cn(
								"p-4 overflow-auto",
								viewMode === "split" ? "w-1/2 border-r" : "w-full"
							)}
						>
							{renderCodeInput()}
						</div>
					)}

					{(viewMode === "preview" || viewMode === "split") && (
						<div
							className={cn(
								"p-4 overflow-auto bg-muted/20",
								viewMode === "split" ? "w-1/2" : "w-full"
							)}
						>
							{renderPreview()}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
