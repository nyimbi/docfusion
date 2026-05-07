/**
 * PlantUML Editor - DocFusion
 *
 * Specialized editor for PlantUML diagrams with syntax highlighting,
 * validation, and live preview.
 */

"use client";

import * as React from "react";
import { sanitizeHTML } from "@/lib/utils/sanitize";
import { Button } from "@/components/ui/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, Copy, Download, Play, RefreshCw, Zap } from "lucide-react";
import type { PlantUmlDiagramType, DiagramValidationError } from "@/lib/diagrams/types";
import {
	parsePlantUML,
	formatPlantUML,
	validatePlantUML,
	getPlantUmlSuggestions,
	PLANTUML_SNIPPETS,
	PLANTUML_TEMPLATES,
	renderPlantUML,
	getPlantUmlRenderUrl,
} from "@/lib/diagrams/plantuml";
import { generateDiagram } from "@/lib/actions/diagrams";

// =============================================================================
// Types
// =============================================================================

interface PlantUMLEditorProps {
	initialCode?: string;
	initialType?: PlantUmlDiagramType;
	onChange?: (code: string, type: PlantUmlDiagramType) => void;
	onRender?: (svg: string) => void;
	onExport?: (format: "svg" | "png" | "txt", url: string) => void;
	className?: string;
}

interface EditorState {
	code: string;
	type: PlantUmlDiagramType;
	errors: DiagramValidationError[];
	svg: string | null;
	isRendering: boolean;
	isGenerating: boolean;
	zoom: number;
}

// =============================================================================
// Component
// =============================================================================

export function PlantUMLEditor({
	initialCode = "",
	initialType = "sequence",
	onChange,
	onRender,
	onExport,
	className,
}: PlantUMLEditorProps) {
	// State
	const [code, setCode] = React.useState(initialCode);
	const [type, setType] = React.useState<PlantUmlDiagramType>(initialType);
	const [errors, setErrors] = React.useState<DiagramValidationError[]>([]);
	const [svg, setSvg] = React.useState<string | null>(null);
	const [isRendering, setIsRendering] = React.useState(false);
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [zoom, setZoom] = React.useState(1);
	const [showSnippets, setShowSnippets] = React.useState(false);

	const editorRef = React.useRef<HTMLTextAreaElement>(null);
	const svgRef = React.useRef<HTMLDivElement>(null);

	// Debounced rendering
	React.useEffect(() => {
		const timeout = setTimeout(async () => {
			// Validate
			const validationErrors = validatePlantUML(code);
			setErrors(validationErrors);

			// Render if valid
			if (validationErrors.length === 0) {
				setIsRendering(true);
				try {
					const result = await renderPlantUML(code, { format: "svg" });
					if (result.success && typeof result.data === "string") {
						setSvg(result.data);
						onRender?.(result.data);
					}
				} catch {
					// Rendering failed
				} finally {
					setIsRendering(false);
				}
			}
		}, 500);

		return () => clearTimeout(timeout);
	}, [code, onRender]);

	// Handlers
	const handleCodeChange = (newCode: string) => {
		setCode(newCode);
		onChange?.(newCode, type);
	};

	const handleFormat = () => {
		const formatted = formatPlantUML(code);
		if (formatted !== code) {
			setCode(formatted);
			onChange?.(formatted, type);
		}
	};

	const handleGenerate = async (description: string) => {
		setIsGenerating(true);
		try {
			const result = await generateDiagram({
				description,
				format: "plantuml",
				type: type as string,
			});
			setCode(result.code);
			onChange?.(result.code, type);
		} catch {
			// Generation failed
		} finally {
			setIsGenerating(false);
		}
	};

	const handleTypeChange = (newType: PlantUmlDiagramType) => {
		setType(newType);
		// Check for diagram type in code and update it
		if (code.includes("@startuml") || code.includes("@enduml")) {
			const updated = code.replace(
				/@start(mindmap|gantt|salt|wbs)/g,
				"@startuml"
			).replace(
				/@end(mindmap|gantt|salt|wbs)/g,
				"@enduml"
			);
			if (updated !== code) {
				setCode(updated);
				onChange?.(updated, newType);
			}
		}
	};

	const handleInsertSnippet = (snippet: string) => {
		setCode(snippet);
		onChange?.(snippet, type);
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(code);
	};

	const handleExport = (format: "svg" | "png" | "txt") => {
		const url = getPlantUmlRenderUrl(code, { format: format === "txt" ? "svg" : format });
		onExport?.(format, url);
	};

	// Zoom handlers
	const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 4));
	const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.25));
	const handleZoomReset = () => setZoom(1);

	// Get templates for current type
	const typeTemplates = PLANTUML_TEMPLATES.filter(
		(t) => t.type === type || t.type === "sequence"
	).slice(0, 6);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Toolbar */}
			<div className="flex items-center gap-2 p-3 border-b bg-muted/50 shrink-0">
				<Select value={type} onValueChange={(v) => handleTypeChange(v as PlantUmlDiagramType)}>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="sequence">Sequence</SelectItem>
						<SelectItem value="class">Class</SelectItem>
						<SelectItem value="component">Component</SelectItem>
						<SelectItem value="activity">Activity</SelectItem>
						<SelectItem value="state">State</SelectItem>
						<SelectItem value="usecase">Use Case</SelectItem>
						<SelectItem value="er">Entity Rel</SelectItem>
						<SelectItem value="gantt">Gantt</SelectItem>
						<SelectItem value="mindmap">Mind Map</SelectItem>
					</SelectContent>
				</Select>

				<Button variant="ghost" size="sm" onClick={handleFormat} title="Format">
					<RefreshCw className="h-4 w-4" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowSnippets(!showSnippets)}
					title="Snippets"
				>
					<Zap className="h-4 w-4" />
				</Button>

				<div className="flex-1" />

				{errors.length > 0 ? (
					<div className="flex items-center gap-1 text-destructive text-sm">
						<AlertCircle className="h-4 w-4" />
						<span>{errors.length}</span>
					</div>
				) : code.length > 0 ? (
					<div className="flex items-center gap-1 text-green-600 text-sm">
						<Check className="h-4 w-4" />
						<span>Valid</span>
					</div>
				) : null}

				<Button variant="ghost" size="sm" onClick={handleCopy} title="Copy">
					<Copy className="h-4 w-4" />
				</Button>

				<Select onValueChange={(v) => handleExport(v as "svg" | "png" | "txt")}>
					<SelectTrigger className="w-28">
						<Download className="h-4 w-4 mr-2" />
						<SelectValue placeholder="Export" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="svg">SVG</SelectItem>
						<SelectItem value="png">PNG</SelectItem>
						<SelectItem value="txt">Text</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Error Bar */}
			{errors.length > 0 && (
				<div className="bg-destructive/10 border-b px-3 py-2 text-sm text-destructive shrink-0">
					{errors[0].message}
					{errors[0].suggestion && (
						<span className="text-muted-foreground ml-2">({errors[0].suggestion})</span>
					)}
				</div>
			)}

			{/* Main Content */}
			<div className="grid grid-cols-2 flex-1 min-h-0">
				{/* Editor */}
				<div className="flex flex-col border-r">
					{/* Editor */}
					<Textarea
						ref={editorRef}
						value={code}
						onChange={(e) => handleCodeChange(e.target.value)}
						className="flex-1 min-h-[300px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
						placeholder={`@startuml
actor User
participant "System" as System
User -> System: Request
System --> User: Response
@enduml`}
						spellCheck={false}
					/>

					{/* Snippets */}
					{showSnippets && (
						<div className="p-2 border-t bg-muted/30 shrink-0 max-h-40 overflow-y-auto">
							<div className="text-xs text-muted-foreground mb-2">Quick Templates:</div>
							<div className="flex flex-wrap gap-2">
								{PLANTUML_SNIPPETS.filter(s => 
									type === "sequence" ? s.prefix.includes("seq") : 
									type === "class" ? s.prefix.includes("class") || s.prefix.includes("interface") :
									s.prefix.includes(type.substring(1, 4))
								).slice(0, 6).map((snippet) => (
									<Button
										key={snippet.prefix}
										variant="secondary"
										size="sm"
										onClick={() => handleInsertSnippet(snippet.body)}
										className="text-xs h-6"
									>
										{snippet.name}
									</Button>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Preview */}
				<div className="flex flex-col bg-muted/20">
					{/* Preview Toolbar */}
					<div className="flex items-center gap-2 p-2 border-b bg-muted/50 shrink-0">
						<Button variant="ghost" size="sm" onClick={handleZoomIn} title="Zoom in">
							Zoom In
						</Button>
						<span className="text-sm text-muted-foreground min-w-[3ch]">{Math.round(zoom * 100)}%</span>
						<Button variant="ghost" size="sm" onClick={handleZoomOut} title="Zoom out">
							Zoom Out
						</Button>
						<Button variant="ghost" size="sm" onClick={handleZoomReset} title="Reset zoom">
							<RefreshCw className="h-4 w-4" />
						</Button>
					</div>

					{/* SVG */}
					<div
						ref={svgRef}
						className="flex-1 overflow-auto p-4 flex items-center justify-center"
					>
						{isRendering ? (
							<div className="flex items-center gap-2 text-muted-foreground">
								<RefreshCw className="h-5 w-5 animate-spin" />
								<span>Rendering...</span>
							</div>
						) : svg ? (
							<div
								style={{
									transform: `scale(${zoom})`,
									transformOrigin: "center",
								}}
								dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}
							/>
						) : errors.length > 0 ? (
							<div className="text-center text-destructive">
								<AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
								<p>Errors in code</p>
							</div>
						) : (
							<div className="text-center text-muted-foreground">
								<Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
								<p>Type code to preview</p>
							</div>
						)}
					</div>
				</div>
			</div>
        </div>
	);
}
