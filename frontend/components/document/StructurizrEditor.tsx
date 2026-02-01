/**
 * Structurizr DSL Editor - DocFusion
 *
 * Editor for Structurizr DSL (C4 Model diagrams)
 * with workspace syntax support and live preview.
 */

"use client";

import * as React from "react";
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
import { AlertCircle, Check, Copy, Download, LayoutGrid, Save, RefreshCw } from "lucide-react";
import type { StructurizrDiagramType, DiagramValidationError } from "@/lib/diagrams/types";
import {
	parseStructurizr,
	formatStructurizr,
	validateStructurizr,
	structurizrToMermaid,
	STRUCTURIZR_SNIPPETS,
	STRUCTURIZR_TEMPLATES,
} from "@/lib/diagrams/structurizr";
import { generateDiagram } from "@/lib/actions/diagrams";
import mermaid from "mermaid";

// =============================================================================
// Types
// =============================================================================

interface StructurizrEditorProps {
	initialCode?: string;
	initialType?: StructurizrDiagramType;
	onChange?: (code: string, type: StructurizrDiagramType) => void;
	onRender?: (svg: string) => void;
	className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function StructurizrEditor({
	initialCode = "",
	initialType = "systemContext",
	onChange,
	onRender,
	className,
}: StructurizrEditorProps) {
	const [code, setCode] = React.useState(initialCode);
	const [type, setType] = React.useState<StructurizrDiagramType>(initialType);
	const [errors, setErrors] = React.useState<DiagramValidationError[]>([]);
	const [svg, setSvg] = React.useState<string | null>(null);
	const [isRendering, setIsRendering] = React.useState(false);
	const [zoom, setZoom] = React.useState(1);
	const [showSnippets, setShowSnippets] = React.useState(false);

	const editorRef = React.useRef<HTMLTextAreaElement>(null);

	// Render using Mermaid conversion
	React.useEffect(() => {
		const timeout = setTimeout(async () => {
			const validationErrors = validateStructurizr(code);
			setErrors(validationErrors);

			if (validationErrors.length === 0 && code) {
				setIsRendering(true);
				try {
					const mermaidCode = structurizrToMermaid(code);
					mermaid.initialize({
						startOnLoad: false,
						theme: "default",
					});
					const { svg } = await mermaid.render(
						`structurizr-${Date.now()}`,
						mermaidCode
					);
					setSvg(svg);
					onRender?.(svg);
				} catch {
					setSvg(null);
				} finally {
					setIsRendering(false);
				}
			}
		}, 500);

		return () => clearTimeout(timeout);
	}, [code]);

	// Handlers
	const handleCodeChange = (newCode: string) => {
		setCode(newCode);
		onChange?.(newCode, type);
	};

	const handleFormat = () => {
		const formatted = formatStructurizr(code);
		if (formatted !== code) {
			setCode(formatted);
			onChange?.(formatted, type);
		}
	};

	const handleGenerate = async (description: string) => {
		try {
			const result = await generateDiagram({
				description,
				format: "structurizr",
				type: type as string,
			});
			setCode(result.code);
			onChange?.(result.code, type);
		} catch {
			// Generation failed
		}
	};

	const handleTypeChange = (newType: StructurizrDiagramType) => {
		setType(newType);
		// Update view type in code if it exists
		if (code.includes("views {")) {
			const updated = code.replace(
				/(systemContext|container|component|dynamic|deployment)/,
				newType
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

	const handleExport = () => {
		navigator.clipboard.writeText(code);
	};

	// Zoom handlers
	const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 4));
	const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.25));
	const handleZoomReset = () => setZoom(1);

	// Parse info
	const { parsed } = parseStructurizr(code);
	const personCount = parsed?.model.people.length || 0;
	const systemCount = parsed?.model.softwareSystems.length || 0;
	const containerCount = parsed?.model.containers.length || 0;
	const componentCount = parsed?.model.components.length || 0;

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Toolbar */}
			<div className="flex items-center gap-2 p-3 border-b bg-muted/50 shrink-0">
				<Select value={type} onValueChange={(v) => handleTypeChange(v as StructurizrDiagramType)}>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="systemContext">System Context</SelectItem>
						<SelectItem value="container">Container</SelectItem>
						<SelectItem value="component">Component</SelectItem>
						<SelectItem value="dynamic">Dynamic/Runtime</SelectItem>
						<SelectItem value="deployment">Deployment</SelectItem>
						<SelectItem value="systemLandscape">Landscape</SelectItem>
					</SelectContent>
				</Select>

				<Button variant="ghost" size="sm" onClick={handleFormat} title="Format">
					<LayoutGrid className="h-4 w-4" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowSnippets(!showSnippets)}
					title="Snippets"
				>
					RefreshCw
				</Button>

				<div className="flex-1" />

				{errors.length > 0 ? (
					<div className="flex items-center gap-1 text-destructive text-sm">
						<AlertCircle className="h-4 w-4" />
						<span>{errors.length} errors</span>
					</div>
				) : code.length > 0 ? (
					<div className="flex items-center gap-1 text-green-600 text-sm">
						<Check className="h-4 w-4" />
						<span>
							{personCount}P, {systemCount}S, {containerCount}C, {componentCount}c
						</span>
					</div>
				) : null}

				<Button variant="ghost" size="sm" onClick={handleCopy} title="Copy">
					<Copy className="h-4 w-4" />
				</Button>

				<Button variant="ghost" size="sm" onClick={handleExport} title="Export">
					<Download className="h-4 w-4" />
				</Button>
			</div>

			{/* Error Bar */}
			{errors.length > 0 && (
				<div className="bg-destructive/10 border-b px-3 py-2 text-sm text-destructive shrink-0">
					Line {errors[0].line}: {errors[0].message}
				</div>
			)}

			{/* Main Content */}
			<div className="grid grid-cols-2 flex-1 min-h-0">
				{/* Editor */}
				<div className="flex flex-col border-r">
					<Textarea
						ref={editorRef}
						value={code}
						onChange={(e) => handleCodeChange(e.target.value)}
						className="flex-1 min-h-[300px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
						placeholder={`workspace "System" {
  model {
    user = person "User"
    system = softwareSystem "System"
    
    user -> system "Uses"
  }
  
  views {
    systemContext system {
      include *
      autolayout lr
    }
  }
}`}
						spellCheck={false}
					/>

					{showSnippets && (
						<div className="p-2 border-t bg-muted/30 shrink-0 max-h-40 overflow-y-auto">
							<div className="text-xs text-muted-foreground mb-2">Quick Templates:</div>
							<div className="flex flex-wrap gap-2">
								{STRUCTURIZR_TEMPLATES.slice(0, 6).map((template, i) => (
									<Button
										key={template.id}
										variant="secondary"
										size="sm"
										onClick={() => handleInsertSnippet(template.code)}
										className="text-xs h-6"
									>
										{template.name}
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
						<Button variant="ghost" size="sm" onClick={handleZoomIn}>
							Zoom In
						</Button>
						<span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
						<Button variant="ghost" size="sm" onClick={handleZoomOut}>Zoom Out</Button>
						<Button variant="ghost" size="sm" onClick={handleZoomReset}>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex-1 overflow-auto p-4 flex items-center justify-center">
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
								dangerouslySetInnerHTML={{ __html: svg }}
							/>
						) : errors.length > 0 ? (
							<div className="text-center text-destructive">
								<AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
								<p>Syntax errors in code</p>
							</div>
						) : (
							<div className="text-center text-muted-foreground">
								<p>Enter valid Structurizr DSL to preview</p>
								<p className="text-xs mt-2">Converted to Mermaid for rendering</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
