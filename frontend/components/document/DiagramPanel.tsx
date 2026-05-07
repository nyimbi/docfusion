/**
 * Diagram Panel - DocFusion
 *
 * A panel for generating and editing diagrams using Mermaid syntax
 * with live preview. Includes napkin-style generation from descriptions.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Pencil,
	Sparkles,
	Image,
	Undo2,
	Check,
	Code,
	Download,
	Loader2,
	ArrowRight,
	Shapes,
	Maximize2,
} from "lucide-react";
import {
	generateDiagram,
	renderMermaidToSvg,
	type GenerateDiagramInput,
	type GeneratedDiagram,
} from "@/lib/actions/document-generation";
import mermaid from "mermaid";

// ============================================================================
// Types
// ============================================================================

interface DiagramPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertDiagram: (svg: string, code: string) => void;
}

type DiagramType = GenerateDiagramInput["type"];
type DiagramStyle = NonNullable<GenerateDiagramInput["style"]>;

// ============================================================================
// Component
// ============================================================================

export function DiagramPanel({
	isOpen,
	onClose,
	onInsertDiagram,
}: DiagramPanelProps) {
	const [activeTab, setActiveTab] = React.useState<"generate" | "code">("generate");
	const [description, setDescription] = React.useState("");
	const [diagramType, setDiagramType] = React.useState<DiagramType>("flowchart");
	const [diagramStyle, setDiagramStyle] = React.useState<DiagramStyle>("modern");
	const [mermaidCode, setMermaidCode] = React.useState<string>(
		`flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E`
	);
	
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [isRendering, setIsRendering] = React.useState(false);
	const [result, setResult] = React.useState<GeneratedDiagram | null>(null);
	const [renderedSvg, setRenderedSvg] = React.useState<string>("");
	const [error, setError] = React.useState<string>("");
	
	const svgContainerRef = React.useRef<HTMLDivElement>(null);
	
	// Initialize mermaid
	React.useEffect(() => {
		mermaid.initialize({
			startOnLoad: false,
			theme: "default",
			securityLevel: "strict",
		});
	}, []);
	
	// Render mermaid to SVG
	const renderMermaid = React.useCallback(async (code: string) => {
		setIsRendering(true);
		setError("");
		
		try {
			const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code);
			setRenderedSvg(svg);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to render diagram");
		} finally {
			setIsRendering(false);
		}
	}, []);
	
	// Auto-render on code change
	React.useEffect(() => {
		if (activeTab === "code" && mermaidCode) {
			const timer = setTimeout(() => renderMermaid(mermaidCode), 500);
			return () => clearTimeout(timer);
		}
	}, [mermaidCode, activeTab, renderMermaid]);
	
	const handleGenerate = async () => {
		if (!description.trim()) return;
		
		setIsGenerating(true);
		setError("");
		
		try {
			const generated = await generateDiagram({
				description,
				type: diagramType,
				style: diagramStyle,
			});
			
			setResult(generated);
			setMermaidCode(generated.code);
			
			// Render if it's mermaid
			if (generated.type === "mermaid") {
				await renderMermaid(generated.code);
			} else {
				setRenderedSvg(
					`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
						<rect width="800" height="600" fill="#f8f9fa"/>
						<text x="400" y="300" text-anchor="middle" font-family="system-ui" font-size="16" fill="#666">
							Napkin diagram placeholder for: ${description.slice(0, 50)}...
						</text>
					</svg>`
				);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to generate diagram");
		} finally {
			setIsGenerating(false);
		}
	};
	
	const handleInsert = () => {
		if (renderedSvg) {
			onInsertDiagram(renderedSvg, mermaidCode);
			onClose();
		}
	};
	
	const diagramTypes: { value: DiagramType; label: string }[] = [
		{ value: "flowchart", label: "Flowchart" },
		{ value: "sequence", label: "Sequence Diagram" },
		{ value: "class", label: "Class Diagram" },
		{ value: "state", label: "State Diagram" },
		{ value: "gantt", label: "Gantt Chart" },
		{ value: "er", label: "Entity Relationship" },
		{ value: "mindmap", label: "Mind Map" },
		{ value: "napkin", label: "Napkin Style" },
	];
	
	const styles: { value: DiagramStyle; label: string }[] = [
		{ value: "modern", label: "Modern" },
		{ value: "minimal", label: "Minimal" },
		{ value: "detailed", label: "Detailed" },
	];
	
	const examples: Record<DiagramType, string> = {
		flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E`,
		sequence: `sequenceDiagram
    participant User
    participant API
    participant DB
    User->>API: Request Data
    API->>DB: Query
    DB-->>API: Results
    API-->>User: Response`,
		class: `classDiagram
    class Document {
        +String id
        +String title
        +Status status
        +create()
        +update()
    }
    class Template {
        +String id
        +String name
    }
    Document --> Template : uses`,
		state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : event received
    Processing --> Success : completed
    Processing --> Error : failed
    Success --> Idle
    Error --> Idle`,
		gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Planning     :a1, 2024-01-01, 7d
    Development  :a2, after a1, 14d
    section Phase 2
    Testing      :a3, after a2, 7d
    Deployment   :a4, after a3, 3d`,
		er: `erDiagram
    DOCUMENT ||--o{ VERSION : has
    DOCUMENT ||--o{ COMMENT : contains
    TEMPLATE ||--o{ DOCUMENT : creates
    DOCUMENT {
        string id PK
        string title
        string status
    }
    VERSION {
        string id PK
        string documentId FK
        int number
    }`,
		mindmap: `mindmap
  root((Document
  Management))
    Creation
      Templates
      AI Generation
      Import
    Editing
      Real-time
      Collaboration
      Version History
    Organization
      Folders
      Tags
      Search`,
		napkin: `graph TD
    A[Sketch Start] --> B{Napkin Style}
    B --> C[Hand-drawn Look]
    B --> D[Casual Elements]`,
	};
	
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 gap-0">
				<DialogHeader className="p-6 border-b">
					<DialogTitle className="flex items-center gap-2">
						<Shapes className="h-5 w-5 text-primary" />
						Diagram Generator
					</DialogTitle>
					<DialogDescription>
						Create diagrams from descriptions or write Mermaid code directly.
					</DialogDescription>
				</DialogHeader>
				
				<div className="flex h-[60vh]">
					{/* Left Panel - Controls */}
					<div className="w-1/3 border-r p-4 overflow-y-auto">
						<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
							<TabsList className="w-full">
								<TabsTrigger value="generate" className="flex-1">
									<Sparkles className="h-4 w-4 mr-1" />
									Generate
								</TabsTrigger>
								<TabsTrigger value="code" className="flex-1">
									<Code className="h-4 w-4 mr-1" />
									Code
								</TabsTrigger>
							</TabsList>
							
							<TabsContent value="generate" className="mt-4 space-y-4">
								<div className="space-y-2">
									<span className="text-sm font-medium">Description</span>
									<Textarea
										placeholder="Describe what you want to diagram..."
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										className="min-h-[100px]"
									 aria-label="Description"/>
								</div>
								
								<div className="space-y-2">
									<span className="text-sm font-medium">Diagram Type</span>
									<Select value={diagramType} onValueChange={(v) => setDiagramType(v as DiagramType)}>
										<SelectTrigger aria-label="Diagram Type">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{diagramTypes.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								
								<div className="space-y-2">
									<span className="text-sm font-medium">Style</span>
									<Select value={diagramStyle} onValueChange={(v) => setDiagramStyle(v as DiagramStyle)}>
										<SelectTrigger aria-label="Style">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{styles.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								
								<Button
									onClick={handleGenerate}
									disabled={!description.trim() || isGenerating}
									className="w-full"
								>
									{isGenerating ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Generating...
										</>
									) : (
										<>
											<Sparkles className="h-4 w-4 mr-2" />
											Generate Diagram
										</>
									)}
								</Button>
							</TabsContent>
							
							<TabsContent value="code" className="mt-4 space-y-4">
								<div className="space-y-2">
									<span className="text-sm font-medium">Mermaid Code</span>
									<Textarea
										value={mermaidCode}
										onChange={(e) => setMermaidCode(e.target.value)}
										className="min-h-[250px] font-mono text-sm"
										spellCheck={false}
									 aria-label="Mermaid Code"/>
								</div>
								
								<div className="space-y-2">
									<span className="text-sm font-medium">Load Example</span>
									<div className="flex flex-wrap gap-2">
										{Object.entries(examples).slice(0, 4).map(([type, code]) => (
											<Button
												key={type}
												variant="secondary"
												size="sm"
												onClick={() => setMermaidCode(code)}
											>
												{type}
											</Button>
										))}
									</div>
								</div>
							</TabsContent>
						</Tabs>
					</div>
					
					{/* Right Panel - Preview */}
					<div className="flex-1 flex flex-col bg-muted/50">
						<div className="flex items-center justify-between p-4 border-b bg-background">
							<span className="font-medium">Preview</span>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => renderMermaid(mermaidCode)}
									disabled={isRendering}
								>
									{isRendering ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Maximize2 className="h-4 w-4" />
									)}
								</Button>
							</div>
						</div>
						
						<div className="flex-1 p-4 overflow-auto flex items-center justify-center">
							{error ? (
								<div className="text-center text-destructive p-4">
									<p className="font-medium">Error rendering diagram</p>
									<p className="text-sm mt-1">{error}</p>
								</div>
							) : renderedSvg ? (
								<div
									ref={svgContainerRef}
									className="bg-white p-4 rounded-lg shadow-sm"
									dangerouslySetInnerHTML={{ __html: sanitizeHTML(renderedSvg) }}
								/>
							) : activeTab === "generate" && !result ? (
								<div className="text-center text-muted-foreground p-8">
									<Shapes className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>Describe your diagram and click Generate</p>
								</div>
							) : (
								<div className="text-center text-muted-foreground p-8">
									<Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>Enter Mermaid code and click preview</p>
								</div>
							)}
						</div>
					</div>
				</div>
				
				<DialogFooter className="p-6 border-t gap-2">
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={handleInsert}
						disabled={!renderedSvg}
					>
						<Check className="h-4 w-4 mr-2" />
						Insert Diagram
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
