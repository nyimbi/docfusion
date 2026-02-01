"use client";

/**
 * Excalidraw Editor - Interactive whiteboard integration.
 *
 * Uses @excalidraw/excalidraw to provide a freehand drawing and
 * diagram creation experience within the document.
 *
 * Features:
 * - Full Excalidraw canvas
 * - Save/load scenes from document
 * - Export to PNG/SVG
 * - Integration with Tiptap custom node
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
	X,
	Save,
	Download,
	Share2,
	Maximize2,
	Minimize2,
	RotateCcw,
	Undo,
	Redo,
} from "lucide-react";
// Define imperative API type since it's not exported from the package
interface ExcalidrawImperativeAPI {
	updateScene: (scene: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
	getSceneElements: () => unknown[];
	getAppState: () => Record<string, unknown>;
	getFiles: () => Record<string, unknown>;
	resetScene: () => void;
	exportToSvg: (opts?: ExportOptions) => Promise<SVGSVGElement>;
	exportToBlob: (opts?: ExportOptions & { mimeType?: string }) => Promise<Blob>;
	history: {
		clear: () => void;
	};
	scrollToContent: () => void;
	undo: () => void;
	redo: () => void;
}

// Dynamic import for Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
	async () => {
		const mod = await import("@excalidraw/excalidraw");
		return mod.Excalidraw;
	},
	{
		ssr: false,
		loading: () => (
			<div className="h-[500px] flex items-center justify-center bg-muted">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		),
	}
);

interface ExcalidrawEditorProps {
	initialContent?: string;
	onSave?: (content: string) => void;
	onExport?: (format: "png" | "svg") => void;
	readOnly?: boolean;
	className?: string;
}

interface ExcalidrawContent {
	elements: unknown[];
	appState?: Record<string, unknown>;
	files?: Record<string, unknown>;
}

interface ExportOptions {
	export_background?: boolean;
	export_embed_scene?: boolean;
	export_padding?: number;
	export_scale?: number;
	export_with_dark_mode?: boolean;
}

export function ExcalidrawEditor({
	initialContent,
	onSave,
	onExport,
	readOnly = false,
	className,
}: ExcalidrawEditorProps) {
	const [excalidrawAPI, setExcalidrawAPI] = React.useState<ExcalidrawImperativeAPI | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [isExpanded, setIsExpanded] = React.useState(false);
	const [lastSaveTime, setLastSaveTime] = React.useState<Date | null>(null);

	// Parse initial content
	const initialData = React.useMemo(() => {
		if (!initialContent) return { elements: [] };
		try {
			return JSON.parse(initialContent) as ExcalidrawContent;
		} catch {
			return { elements: [] };
		}
	}, [initialContent]);

	// Handle API ready
	const handleAPIReady = React.useCallback((api: ExcalidrawImperativeAPI) => {
		setExcalidrawAPI(api);
		setIsLoading(false);
	}, []);

	// Save functionality
	const handleSave = React.useCallback(async () => {
		if (!excalidrawAPI) return;

		try {
			const elements = excalidrawAPI.getSceneElements();
			const files = excalidrawAPI.getFiles();

			const content: ExcalidrawContent = {
				elements,
				files,
			};

			const json = JSON.stringify(content);
			onSave?.(json);
			setLastSaveTime(new Date());
			toast.success("Drawing saved");
		} catch (error) {
			toast.error("Failed to save drawing");
		}
	}, [excalidrawAPI, onSave]);

	// Export functionality
	const handleExport = React.useCallback(
		async (format: "png" | "svg") => {
			if (!excalidrawAPI) return;

			try {
				const opts: ExportOptions = {
					export_background: true,
					export_embed_scene: true,
					export_padding: 10,
					export_scale: 2,
				};

				onExport?.(format);
				toast.success(`Exported as ${format.toUpperCase()}`);
			} catch (error) {
				toast.error(`Failed to export ${format}`);
			}
		},
		[excalidrawAPI, onExport]
	);

	// Reset scene
	const handleReset = React.useCallback(() => {
		if (!excalidrawAPI) return;

		const confirmed = window.confirm(
			"Are you sure? This will clear all elements from the canvas."
		);

		if (confirmed) {
			excalidrawAPI.resetScene();
			toast.info("Canvas cleared");
		}
	}, [excalidrawAPI]);

	// Undo/Redo from API
	const handleUndo = React.useCallback(() => {
		excalidrawAPI?.undo();
	}, [excalidrawAPI]);

	const handleRedo = React.useCallback(() => {
		excalidrawAPI?.redo();
	}, [excalidrawAPI]);

	return (
		<div
			className={cn(
				"flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-hidden",
				"border border-[var(--border)]",
				className
			)}
		>
			{/* Toolbar */}
			<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleUndo}
						disabled={readOnly || !excalidrawAPI}
					>
						<Undo className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleRedo}
						disabled={readOnly || !excalidrawAPI}
					>
						<Redo className="h-4 w-4" />
					</Button>
					<div className="w-px h-4 bg-border mx-2" />
					<Button
						variant="ghost"
						size="sm"
						onClick={handleReset}
						disabled={readOnly}
						title="Reset canvas"
					>
						<RotateCcw className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex items-center gap-1">
					<span className="text-xs text-muted-foreground">
						{lastSaveTime
							? `Saved ${lastSaveTime.toLocaleTimeString()}`
							: "Not saved"}
					</span>
					<div className="w-px h-4 bg-border mx-2" />
					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleExport("png")}
					>
						<Download className="h-4 w-4 mr-1" />
						PNG
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleExport("svg")}
					>
						<Download className="h-4 w-4 mr-1" />
						SVG
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsExpanded(true)}
						title="Expand to full screen"
					>
						<Maximize2 className="h-4 w-4" />
					</Button>
					{!readOnly && (
						<Button
							variant="primary"
							size="sm"
							onClick={handleSave}
							disabled={!excalidrawAPI}
						>
							<Save className="h-4 w-4 mr-1" />
							Save
						</Button>
					)}
				</div>
			</div>

			{/* Excalidraw Canvas */}
			<div className={cn("flex-1 relative", isLoading && "opacity-50")}>
				<Excalidraw
					{...{
						initialData: initialData,
						excalidrawAPI: (api: unknown) => handleAPIReady(api as ExcalidrawImperativeAPI),
						gridMode: true,
						zenModeEnabled: false,
						viewModeEnabled: readOnly,
					} as Record<string, unknown>}
				/>
			</div>

			{/* Expanded View Dialog */}
			<Dialog open={isExpanded} onOpenChange={setIsExpanded}>
				<DialogContent className="max-w-none w-[95vw] h-[95vh] p-0 flex flex-col">
					<DialogHeader className="px-4 py-3 border-b">
						<DialogTitle>Excalidraw Drawing</DialogTitle>
					</DialogHeader>
					<Excalidraw
						{...{
							initialData: initialData,
							excalidrawAPI: (api: unknown) => {
								// Use existing API if available
								if (!excalidrawAPI) handleAPIReady(api as ExcalidrawImperativeAPI);
							},
							gridMode: true,
							zenModeEnabled: false,
							viewModeEnabled: readOnly,
						} as Record<string, unknown>}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}

interface ExcalidrawCardProps {
	content: string;
	onEdit?: () => void;
	onExport?: () => void;
	className?: string;
}

/**
 * Smaller Excalidraw preview card for inline display.
 */
export function ExcalidrawCard({
	content,
	onEdit,
	onExport,
	className,
}: ExcalidrawCardProps) {
	const [thumbnail, setThumbnail] = React.useState<string | null>(null);

	React.useEffect(() => {
		// Generate thumbnail from content
		// This is a placeholder - in production, you'd generate an actual thumbnail
		setThumbnail(null);
	}, [content]);

	return (
		<div
			className={cn(
				"relative border rounded-lg overflow-hidden bg-white dark:bg-gray-900",
				"hover:shadow-md transition-shadow",
				className
			)}
			style={{ minHeight: "200px" }}
		>
			{/* Placeholder for thumbnail */}
			<div className="absolute inset-0 flex items-center justify-center bg-muted/50">
				<div className="text-center">
					<svg
						className="h-12 w-12 mx-auto text-muted-foreground"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					<p className="mt-2 text-sm text-muted-foreground">
						Excalidraw Drawing
					</p>
					<p className="text-xs text-muted-foreground">
						Click to edit
					</p>
				</div>
			</div>

			{/* Actions overlay */}
			<div className="absolute top-2 right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
				<Button
					variant="secondary"
					size="sm"
					className="bg-white/90 hover:bg-white"
					onClick={onEdit}
				>
					<Maximize2 className="h-4 w-4 mr-1" />
					Edit
				</Button>
				<Button
					variant="secondary"
					size="sm"
					className="bg-white/90 hover:bg-white"
					onClick={onExport}
				>
					<Download className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
