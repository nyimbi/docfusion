/**
 * D2 Editor - DocFusion
 *
 * Editor for D2 (Declarative Diagramming) language
 * with modern layout and styling support.
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
import { AlertCircle, Check, Copy, Download, RefreshCw, LayoutGrid, Zap } from "lucide-react";
import type { DiagramValidationError } from "@/lib/diagrams/types";
import {
	parseD2,
	formatD2,
	validateD2,
	d2ToMermaid,
	D2_SNIPPETS,
	D2_TEMPLATES,
} from "@/lib/diagrams/d2";
import { generateDiagram } from "@/lib/actions/diagrams";
import mermaid from "mermaid";

// =============================================================================
// Types
// =============================================================================

interface D2EditorProps {
	initialCode?: string;
	onChange?: (code: string) => void;
	onRender?: (svg: string) => void;
	className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function D2Editor({
	initialCode = "",
	onChange,
	onRender,
	className,
}: D2EditorProps) {
	const [code, setCode] = React.useState(initialCode);
	const [errors, setErrors] = React.useState<DiagramValidationError[]>([]);
	const [svg, setSvg] = React.useState<string | null>(null);
	const [isRendering, setIsRendering] = React.useState(false);
	const [zoom, setZoom] = React.useState(1);
	const [showSnippets, setShowSnippets] = React.useState(false);

	const editorRef = React.useRef<HTMLTextAreaElement>(null);

	// Render using Mermaid conversion
	React.useEffect(() => {
		const timeout = setTimeout(async () => {
			const validationErrors = validateD2(code);
			setErrors(validationErrors);

			if (validationErrors.length === 0 && code) {
				setIsRendering(true);
				try {
					const mermaidCode = d2ToMermaid(code);
					mermaid.initialize({
						startOnLoad: false,
						theme: "default",
					});
					const { svg } = await mermaid.render(
						`d2-${Date.now()}`,
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
		onChange?.(newCode);
	};

	const handleFormat = () => {
		const formatted = formatD2(code);
		if (formatted !== code) {
			setCode(formatted);
			onChange?.(formatted);
		}
	};

	const handleGenerate = async (description: string) => {
		try {
			const result = await generateDiagram({
				description,
				format: "d2",
				type: "flowchart",
			});
			setCode(result.code);
			onChange?.(result.code);
		} catch {
			// Generation failed
		}
	};

	const handleInsertSnippet = (snippet: string) => {
		setCode(snippet);
		onChange?.(snippet);
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
	const { parsed } = parseD2(code);
	const objectCount = parsed?.objects.length || 0;
	const connectionCount = parsed?.connections.length || 0;

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Toolbar */}
			<div className="flex items-center gap-2 p-3 border-b bg-muted/50 shrink-0">
				<span className="text-sm font-medium text-muted-foreground">D2 Editor</span>

				<div className="h-4 w-px bg-border mx-1" />

				<Button variant="ghost" size="sm" onClick={handleFormat} title="Format">
					<LayoutGrid className="h-4 w-4" />
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
						<span>{errors.length} errors</span>
					</div>
				) : code.length > 0 ? (
					<div className="flex items-center gap-1 text-green-600 text-sm">
						<Check className="h-4 w-4" />
						<span>
							{objectCount} objs, {connectionCount} conn
						</span>
					</div>
				) : null}

				<Button variant="ghost" size="sm" onClick={handleCopy} title="Copy">
					<Copy className="h-4 w-4" />
				</Button>

				<Button variant="ghost" size="sm" onClick={handleExport} title="Export DSL">
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
						placeholder={`direction: right

A: Component A
B: Component B
C: Component C

A -> B: Request
B -> C: Query
B -> A: Response`}
						spellCheck={false}
					/>

					{showSnippets && (
						<div className="p-2 border-t bg-muted/30 shrink-0 max-h-40 overflow-y-auto">
							<div className="text-xs text-muted-foreground mb-2">Quick Templates:</div>
							<div className="flex flex-wrap gap-2">
								{D2_TEMPLATES.slice(0, 6).map((template) => (
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
								dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}
							/>
						) : errors.length > 0 ? (
							<div className="text-center text-destructive">
								<AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
								<p>Syntax errors in code</p>
							</div>
						) : (
							<div className="text-center text-muted-foreground">
								<p>Enter valid D2 code to preview</p>
								<p className="text-xs mt-2">Converted to Mermaid for rendering</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
