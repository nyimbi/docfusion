/**
 * DiagramEditor - DocFusion
 *
 * Unified diagram editor supporting PlantUML, Structurizr (C4), D2, and Mermaid.
 * Provides live preview, syntax validation, templates, and export capabilities.
 *
 * Security Note: SVG content is rendered from trusted diagram rendering services
 * (PlantUML server, Mermaid library). The dangerouslySetInnerHTML usage is
 * intentional for SVG rendering and the content source is controlled.
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sanitizeHTML } from "@/lib/utils/sanitize";
import {
	AlertCircle,
	Check,
	Code2,
	Copy,
	Download,
	FileCode,
	LayoutGrid,
	Palette,
	RefreshCw,
	Save,
	Wand2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type {
	AutoCompleteSuggestion,
	CodeSnippet,
	DiagramFormat,
	DiagramTemplate,
	DiagramTheme,
	ViewTransform,
} from "@/lib/diagrams/types";
export type { DiagramFormat } from "@/lib/diagrams/types";
import {
	copyToClipboard,
	detectDiagramFormat,
	diagramToSvg,
	downloadDiagram,
	formatDiagram,
	getAutocompleteSuggestions,
	getDiagramSnippets,
	getDiagramStats,
	getDiagramTemplates,
	renderDiagram,
	validateDiagram,
} from "@/lib/diagrams/renderer";
import { generateDiagram } from "@/lib/actions/diagrams";

// =============================================================================
// Types
// =============================================================================

interface DiagramEditorProps {
	/** Initial diagram code */
	initialCode?: string;
	/** Initial diagram format */
	initialFormat?: DiagramFormat;
	/** Initial theme */
	initialTheme?: DiagramTheme;
	/** Called when code changes */
	onChange?: (code: string, format: DiagramFormat) => void;
	/** Called when user saves diagram */
	onSave?: (code: string, format: DiagramFormat, name: string) => void;
	/** Called when user inserts diagram into document */
	onInsert?: (svg: string, code: string, format: DiagramFormat) => void;
	/** Called when dialog is closed */
	onClose?: () => void;
	/** Display mode - dialog or standalone */
	mode?: "dialog" | "standalone";
	/** Whether dialog is open (only for dialog mode) */
	isOpen?: boolean;
}

// =============================================================================
// Main Export
// =============================================================================

export function DiagramEditor({ ...props }: DiagramEditorProps): React.ReactElement {
	return (
		<TooltipProvider>
			<DiagramEditorContent {...props} />
		</TooltipProvider>
	);
}

// =============================================================================
// Internal Component
// =============================================================================

function DiagramEditorContent({
	initialCode = "",
	initialFormat = "plantuml",
	initialTheme = "default",
	onChange,
	onSave,
	onInsert,
	onClose,
	mode = "standalone",
	isOpen = true,
}: DiagramEditorProps): React.ReactElement {
	// Refs
	const editorRef = React.useRef<HTMLTextAreaElement>(null);
	const svgContainerRef = React.useRef<HTMLDivElement>(null);

	// State
	const [code, setCode] = React.useState(initialCode);
	const [format, setFormat] = React.useState<DiagramFormat>(initialFormat);
	const [theme, setTheme] = React.useState<DiagramTheme>(initialTheme);
	const [editorMode, setEditorMode] = React.useState<"split" | "code" | "preview">("split");
	const [errors, setErrors] = React.useState<Array<{ line: number; column: number; message: string }>>([]);
	const [isDirty, setIsDirty] = React.useState(false);
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [svg, setSvg] = React.useState<string | null>(null);
	const [stats, setStats] = React.useState<{ lines: number; elements?: number; relationships?: number } | null>(null);
	const [showTemplates, setShowTemplates] = React.useState(false);
	const [suggestions, setSuggestions] = React.useState<AutoCompleteSuggestion[]>([]);
	const [showSuggestions, setShowSuggestions] = React.useState(false);
	const [cursorPosition, setCursorPosition] = React.useState({ line: 0, column: 0 });

	// View transformations for zoom/pan
	const [viewTransform, setViewTransform] = React.useState<ViewTransform>({
		scale: 1,
		translateX: 0,
		translateY: 0,
	});

	const isDragging = React.useRef(false);
	const lastMousePos = React.useRef({ x: 0, y: 0 });

	// Get templates and snippets
	const templates = React.useMemo(() => getDiagramTemplates(format), [format]);
	const snippets = React.useMemo(() => getDiagramSnippets(format), [format]);

	// Debounced render
	React.useEffect(() => {
		const timeout = setTimeout(async () => {
			const validationErrors = validateDiagram(code, format);
			setErrors(validationErrors);

			if (validationErrors.length === 0) {
				try {
					const result = await renderDiagram(code, format, "svg", theme);
					if (result.success && typeof result.data === "string") {
						setSvg(result.data);
					}
				} catch {
					setSvg(null);
				}
			}

			// Update stats
			const diagramStats = getDiagramStats(code, format);
			setStats({
				lines: diagramStats.lineCount,
				elements: diagramStats.elementCount,
				relationships: diagramStats.relationshipCount,
			});
		}, 500);

		return () => clearTimeout(timeout);
	}, [code, format, theme]);

	// Handle code changes
	const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newCode = e.target.value;
		setCode(newCode);
		setIsDirty(true);
		onChange?.(newCode, format);

		// Auto-detect format from code
		const detected = detectDiagramFormat(newCode);
		if (detected !== format) {
			setFormat(detected);
		}
	};

	// Format code
	const handleFormat = () => {
		const formatted = formatDiagram(code, format);
		if (formatted !== code) {
			setCode(formatted);
			setIsDirty(true);
		}
	};

	// Change format manually
	const handleFormatChange = (newFormat: DiagramFormat) => {
		setFormat(newFormat);
	};

	// Insert snippet
	const handleInsertSnippet = (snippet: CodeSnippet) => {
		const textarea = editorRef.current;
		if (textarea) {
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const before = code.substring(0, start);
			const after = code.substring(end);
			const newCode = before + snippet.body + after;
			setCode(newCode);
			setIsDirty(true);

			// Restore cursor position after snippet
			setTimeout(() => {
				textarea.selectionStart = start + snippet.body.length;
				textarea.selectionEnd = start + snippet.body.length;
			}, 0);
		}
	};

	// Insert template
	const handleInsertTemplate = (template: DiagramTemplate) => {
		setCode(template.code);
		setFormat(template.format);
		setIsDirty(true);
		setShowTemplates(false);
		onChange?.(template.code, template.format);
	};

	// AI Generation
	const handleGenerateFromPrompt = async (prompt: string) => {
		if (!prompt.trim()) return;

		setIsGenerating(true);
		try {
			const result = await generateDiagram({
				description: prompt,
				format,
				type: "flowchart",
				style: "modern",
			});

			setCode(result.code);
			setIsDirty(true);
			onChange?.(result.code, format);
		} catch (err) {
			console.error("Generation failed:", err);
		} finally {
			setIsGenerating(false);
		}
	};

	// Copy/Download
	const handleCopyCode = async () => {
		await copyToClipboard(code);
	};

	const handleDownload = async (exportFormat: "svg" | "png" | "txt") => {
		if (exportFormat === "txt") {
			const filename = `diagram.${format === "plantuml" ? "puml" : format === "structurizr" ? "dsl" : format}.txt`;
			downloadDiagram(code, filename);
			return;
		}

		const svgData = await diagramToSvg(code, format, theme);
		if (svgData) {
			if (exportFormat === "svg") {
				downloadDiagram(svgData, "diagram.svg");
			} else {
				// Convert SVG to PNG
				const blob = await svgToPng(svgData);
				if (blob) {
					const url = URL.createObjectURL(blob);
					const link = document.createElement("a");
					link.href = url;
					link.download = "diagram.png";
					link.click();
					URL.revokeObjectURL(url);
				}
			}
		}
	};

	// Save handler
	const handleSave = () => {
		const name = prompt("Enter diagram name:", "Diagram");
		if (name) {
			onSave?.(code, format, name);
			setIsDirty(false);
		}
	};

	// Insert handler
	const handleInsert = () => {
		if (svg) {
			onInsert?.(svg, code, format);
		}
	};

	// Close handler
	const handleClose = () => {
		if (isDirty) {
			const confirmed = window.confirm("You have unsaved changes. Close anyway?");
			if (!confirmed) return;
		}
		onClose?.();
	};

	// Zoom handlers
	const handleZoomIn = () => setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 4) }));
	const handleZoomOut = () => setViewTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.25) }));
	const handleZoomReset = () => setViewTransform({ scale: 1, translateX: 0, translateY: 0 });

	// Pan handlers
	const handleMouseDown = (e: React.MouseEvent) => {
		isDragging.current = true;
		lastMousePos.current = { x: e.clientX, y: e.clientY };
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging.current) return;
		const deltaX = e.clientX - lastMousePos.current.x;
		const deltaY = e.clientY - lastMousePos.current.y;
		lastMousePos.current = { x: e.clientX, y: e.clientY };
		setViewTransform(prev => ({
			...prev,
			translateX: prev.translateX + deltaX,
			translateY: prev.translateY + deltaY,
		}));
	};

	const handleMouseUp = () => { isDragging.current = false; };

	// Convert SVG to PNG helper
	const svgToPng = async (svgString: string): Promise<Blob | null> => {
		return new Promise((resolve) => {
			const img = new Image();
			const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
			const url = URL.createObjectURL(svgBlob);

			img.onload = () => {
				const canvas = document.createElement("canvas");
				canvas.width = img.naturalWidth * 2;
				canvas.height = img.naturalHeight * 2;

				const ctx = canvas.getContext("2d");
				if (!ctx) { resolve(null); return; }

				ctx.scale(2, 2);
				ctx.drawImage(img, 0, 0);

				canvas.toBlob((blob) => {
					resolve(blob);
					URL.revokeObjectURL(url);
				});
			};

			img.onerror = () => {
				resolve(null);
				URL.revokeObjectURL(url);
			};

			img.src = url;
		});
	};

	// Handle cursor position for auto-complete
	const handleCursorChange = () => {
		const textarea = editorRef.current;
		if (textarea) {
			const value = textarea.value.substring(0, textarea.selectionStart);
			const lines = value.split("\n");
			const line = lines.length - 1;
			const column = lines[lines.length - 1].length;
			const pos = { line, column };
			setCursorPosition(pos);

			// Get suggestions
			const s = getAutocompleteSuggestions(code, format, pos);
			setSuggestions(s);
			setShowSuggestions(s.length > 0 && column > 0);
		}
	};

	// ==========================================================================
	// SVG Preview Component (isolated for security clarity)
	// SVG content comes from trusted rendering services only
	// ==========================================================================
	const SvgPreview = ({ svgContent }: { svgContent: string }) => (
		<div
			className="absolute inset-0 flex items-center justify-center p-8"
			style={{
				transform: `translate(${viewTransform.translateX}px, ${viewTransform.translateY}px) scale(${viewTransform.scale})`,
				transformOrigin: "center",
			}}
			// SVG is from trusted diagram renderers (mermaid, plantuml server)
			dangerouslySetInnerHTML={{ __html: sanitizeHTML(svgContent) }}
		/>
	);

	// ==========================================================================
	// Render Content (shared between dialog and standalone)
	// ==========================================================================

	const content = (
		<div className={cn("grid h-full", editorMode === "split" ? "grid-cols-2" : "grid-cols-1")}>
			{/* Editor Section */}
			{(editorMode === "split" || editorMode === "code") && (
				<div className="flex flex-col h-full border-r">
					{/* Editor Toolbar */}
					<div className="flex items-center gap-2 p-2 border-b bg-muted/50">
						<Select value={format} onValueChange={(v) => handleFormatChange(v as DiagramFormat)}>
							<SelectTrigger className="w-24">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="plantuml">PlantUML</SelectItem>
								<SelectItem value="structurizr">Structurizr</SelectItem>
								<SelectItem value="d2">D2</SelectItem>
								<SelectItem value="mermaid">Mermaid</SelectItem>
							</SelectContent>
						</Select>

						<div className="h-4 w-px bg-border mx-1" />

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={handleFormat}>
									<LayoutGrid className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Format</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={() => setShowTemplates(true)}>
									<FileCode className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Templates</TooltipContent>
						</Tooltip>

						<Select value={theme} onValueChange={(v) => setTheme(v as DiagramTheme)}>
							<SelectTrigger className="w-24 ml-2">
								<Palette className="h-4 w-4 mr-2" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">Default</SelectItem>
								<SelectItem value="dark">Dark</SelectItem>
								<SelectItem value="light">Light</SelectItem>
								<SelectItem value="forest">Forest</SelectItem>
								<SelectItem value="ocean">Ocean</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex-1" />

						{errors.length > 0 && (
							<div className="flex items-center gap-1 text-destructive text-sm">
								<AlertCircle className="h-4 w-4" />
								<span>{errors.length}</span>
							</div>
						)}

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={handleCopyCode}>
									<Copy className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Copy</TooltipContent>
						</Tooltip>
					</div>

					{/* Code Input */}
					<Textarea
						ref={editorRef}
						value={code}
						onChange={handleCodeChange}
						onKeyUp={handleCursorChange}
						onClick={handleCursorChange}
						className="flex-1 min-h-[300px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
						placeholder={`Enter ${format} code here...\nExample for PlantUML: @startuml\nA -> B: Hello\n@enduml`}
						spellCheck={false}
					/>

					{/* Snippets */}
					{snippets.length > 0 && (
						<div className="px-2 py-1 border-t bg-muted/30 flex items-center gap-2 overflow-x-auto">
							<span className="text-xs text-muted-foreground whitespace-nowrap">Snippets:</span>
							{snippets.slice(0, 5).map((snippet) => (
								<Button
									key={snippet.prefix}
									variant="secondary"
									size="sm"
									className="text-xs h-6 whitespace-nowrap"
									onClick={() => handleInsertSnippet(snippet)}
								>
									{snippet.name}
								</Button>
							))}
						</div>
					)}
				</div>
			)}

			{/* Preview Section */}
			{(editorMode === "split" || editorMode === "preview") && (
				<div className="flex flex-col h-full bg-muted/20">
					{/* Preview Toolbar */}
					<div className="flex items-center gap-2 p-2 border-b bg-muted/50">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={handleZoomIn}>
									<ZoomIn className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Zoom in</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={handleZoomOut}>
									<ZoomOut className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Zoom out</TooltipContent>
						</Tooltip>

						<span className="text-sm text-muted-foreground min-w-[3ch]">
							{Math.round(viewTransform.scale * 100)}%
						</span>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={handleZoomReset}>
									<RefreshCw className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Reset zoom</TooltipContent>
						</Tooltip>

						<div className="flex-1" />

						{stats && (
							<span className="text-xs text-muted-foreground">
								{stats.lines} lines • {stats.elements ?? 0} elements • {stats.relationships ?? 0} relations
							</span>
						)}

						<div className="flex-1" />

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="sm" onClick={() => handleDownload("svg")}>
									<Download className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Download SVG</TooltipContent>
						</Tooltip>
					</div>

					{/* SVG Preview */}
					<div
						ref={svgContainerRef}
						className="flex-1 overflow-hidden bg-muted/30 relative cursor-grab active:cursor-grabbing"
						onMouseDown={handleMouseDown}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
						onMouseMove={handleMouseMove}
					>
						{isGenerating ? (
							<div className="absolute inset-0 flex items-center justify-center">
								<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : svg ? (
							<SvgPreview svgContent={svg} />
						) : errors.length > 0 ? (
							<div className="absolute inset-0 flex flex-col items-center justify-center">
								<AlertCircle className="h-12 w-12 text-destructive opacity-50 mb-2" />
								<p className="text-destructive">Errors found in code</p>
								<p className="text-xs text-muted-foreground mt-1">
									Line {errors[0]?.line}: {errors[0]?.message}
								</p>
							</div>
						) : (
							<div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
								<Code2 className="h-12 w-12 mb-2 opacity-50" />
								<p>Enter code to see preview</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);

	// ==========================================================================
	// Render
	// ==========================================================================

	// Dialog Mode
	if (mode === "dialog") {
		return (
			<>
				<Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
					<DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 flex flex-col">
						<DialogHeader className="p-6 border-b">
							<DialogTitle className="flex items-center gap-2">
								<Code2 className="h-5 w-5 text-primary" />
								Diagram Editor
								{isDirty && <span className="text-xs text-muted-foreground ml-2">• Unsaved</span>}
							</DialogTitle>
							<DialogDescription>
								Create and edit diagrams with live preview. Supports PlantUML, Structurizr (C4), D2, and Mermaid.
							</DialogDescription>
						</DialogHeader>

						{/* Main Content */}
						<div className="h-[60vh] overflow-hidden">{content}</div>

						{/* Footer */}
						<DialogFooter className="p-6 border-t gap-2">
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							{onSave && (
								<Button variant="secondary" onClick={handleSave} disabled={!isDirty}>
									<Save className="h-4 w-4 mr-2" />
									Save
								</Button>
							)}
							{onInsert && (
								<Button onClick={handleInsert} disabled={!svg}>
									<Check className="h-4 w-4 mr-2" />
									Insert
								</Button>
							)}
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Templates Dialog */}
				<Dialog open={showTemplates} onOpenChange={setShowTemplates}>
					<DialogContent className="max-w-4xl max-h-[80vh]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<FileCode className="h-5 w-5" />
								Diagram Templates
							</DialogTitle>
							<DialogDescription>
								Choose from pre-built templates or start from scratch
							</DialogDescription>
						</DialogHeader>

						<div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto p-2">
							{templates.map((template) => (
								<Button
									key={template.id}
									variant="outline"
									className="h-auto p-4 flex flex-col items-start text-left"
									onClick={() => handleInsertTemplate(template)}
								>
									<div className="font-medium">{template.name}</div>
									<div className="text-sm text-muted-foreground mt-1">{template.description}</div>
									<div className="flex gap-1 mt-2">
										{template.tags.map((tag) => (
											<span
												key={tag}
												className="text-xs bg-muted px-2 py-0.5 rounded"
											>
												{tag}
											</span>
										))}
									</div>
								</Button>
							))}
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setShowTemplates(false)}>
								Close
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</>
		);
	}

	// Standalone Mode
	return (
		<>
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b bg-muted/50">
					<div className="flex items-center gap-2">
						<Code2 className="h-5 w-5 text-primary" />
						<span className="font-semibold">Diagram Editor</span>
						{isDirty && (
							<span className="text-xs text-muted-foreground">• Unsaved</span>
						)}
					</div>

					<div className="flex items-center gap-2">
						<Select
							value={editorMode}
							onValueChange={(v) => setEditorMode(v as "split" | "code" | "preview")}
						>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="split">Split View</SelectItem>
								<SelectItem value="code">Code Only</SelectItem>
								<SelectItem value="preview">Preview Only</SelectItem>
							</SelectContent>
						</Select>

						<Button variant="outline" size="sm" onClick={() => setIsGenerating(true)} disabled={isGenerating}>
							{isGenerating ? (
								<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Wand2 className="h-4 w-4 mr-2" />
							)}
							{isGenerating ? "Generating..." : "Generate"}
						</Button>
					</div>
				</div>

				{/* Main Content Area */}
				<div className="flex-1 overflow-hidden">{content}</div>
			</div>

			{/* Templates Dialog */}
			<Dialog open={showTemplates} onOpenChange={setShowTemplates}>
				<DialogContent className="max-w-4xl max-h-[80vh]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileCode className="h-5 w-5" />
							Diagram Templates
						</DialogTitle>
						<DialogDescription>
							Choose from pre-built templates or start from scratch
						</DialogDescription>
					</DialogHeader>

					<div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto p-2">
						{templates.map((template) => (
							<Button
								key={template.id}
								variant="outline"
								className="h-auto p-4 flex flex-col items-start text-left"
								onClick={() => handleInsertTemplate(template)}
							>
								<div className="font-medium">{template.name}</div>
								<div className="text-sm text-muted-foreground mt-1">{template.description}</div>
								<div className="flex gap-1 mt-2">
									{template.tags.map((tag) => (
										<span
											key={tag}
											className="text-xs bg-muted px-2 py-0.5 rounded"
										>
											{tag}
										</span>
									))}
								</div>
							</Button>
						))}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowTemplates(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
