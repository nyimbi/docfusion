"use client";

/**
 * GraphicPreview Component - DocFusion
 *
 * Renders diagram preview with zoom/pan controls, theme switching,
 * and export capabilities. Uses the diagram renderer from lib/diagrams.
 *
 * Features:
 * - Live rendering of Mermaid/D2/PlantUML diagrams
 * - Zoom and pan controls
 * - Theme switcher (light/dark/forest/ocean)
 * - Export to SVG/PNG
 * - Fit to container
 * - Error handling with fallback display
 * - XSS-safe SVG rendering with DOMPurify sanitization
 *
 * @module components/graphics/GraphicPreview
 */

import * as React from "react";
import { useCallback, useEffect, useState, useRef } from "react";
import DOMPurify from "dompurify";
import {
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	renderDiagram,
	downloadDiagram,
	svgToPng,
	fitToContainer,
	calculateZoom,
	calculatePan,
	transformToCss,
	getDefaultViewTransform,
} from "@/lib/diagrams/renderer";
import type { DiagramTheme, DiagramFormat, ViewTransform } from "@/lib/diagrams/types";
import {
	ZoomIn,
	ZoomOut,
	Maximize,
	RotateCcw,
	Palette,
	AlertCircle,
	RefreshCw,
	Image as ImageIcon,
	FileCode,
} from "lucide-react";

// Theme options
const THEME_OPTIONS: { value: DiagramTheme; label: string; icon?: string }[] = [
	{ value: "default", label: "Default" },
	{ value: "dark", label: "Dark" },
	{ value: "light", label: "Light" },
	{ value: "forest", label: "Forest" },
	{ value: "ocean", label: "Ocean" },
	{ value: "cyber", label: "Cyber" },
];

// Configure DOMPurify for SVG sanitization
const DOMPURIFY_CONFIG = {
	USE_PROFILES: { svg: true, svgFilters: true },
	ADD_TAGS: ["foreignObject", "style"],
	ADD_ATTR: ["xmlns", "xmlns:xlink", "viewBox", "preserveAspectRatio", "transform"],
};

/**
 * Sanitize SVG content to prevent XSS attacks while preserving diagram functionality.
 * This function uses DOMPurify to ensure all SVG content is safe before rendering.
 */
function sanitizeSvg(svg: string): string {
	if (typeof window === "undefined") {
		// Server-side: return empty or use a different sanitization approach
		return "";
	}
	// DOMPurify sanitizes the SVG content, removing any potentially malicious scripts
	return DOMPurify.sanitize(svg, DOMPURIFY_CONFIG);
}

interface GraphicPreviewProps {
	/** The diagram code to render */
	code: string;
	/** The diagram format (auto-detected if not provided) */
	format?: DiagramFormat | "mermaid" | "d2" | "svg" | "png";
	/** Fixed width for the preview */
	width?: number;
	/** Fixed height for the preview */
	height?: number;
	/** Additional CSS class names */
	className?: string;
	/** Show toolbar controls (default: true when not in thumbnail mode) */
	showControls?: boolean;
	/** Initial theme */
	initialTheme?: DiagramTheme;
	/** Callback when rendering completes */
	onRenderComplete?: (success: boolean, error?: string) => void;
}

/**
 * Preview controls toolbar.
 */
function PreviewToolbar({
	theme,
	onThemeChange,
	onZoomIn,
	onZoomOut,
	onFitToContainer,
	onReset,
	onExportSvg,
	onExportPng,
	isRendering,
}: {
	theme: DiagramTheme;
	onThemeChange: (theme: DiagramTheme) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onFitToContainer: () => void;
	onReset: () => void;
	onExportSvg: () => void;
	onExportPng: () => void;
	isRendering: boolean;
}) {
	return (
		<div className="flex items-center gap-1 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			{/* Zoom controls */}
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onZoomOut}
							disabled={isRendering}
						>
							<ZoomOut className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom Out</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onZoomIn}
							disabled={isRendering}
						>
							<ZoomIn className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom In</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onFitToContainer}
							disabled={isRendering}
						>
							<Maximize className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Fit to View</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onReset}
							disabled={isRendering}
						>
							<RotateCcw className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Reset View</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div className="w-px h-5 bg-border mx-1" />

			{/* Theme selector */}
			<Select value={theme} onValueChange={(v) => onThemeChange(v as DiagramTheme)}>
				<SelectTrigger className="h-7 w-[100px] text-xs">
					<Palette className="h-3 w-3 mr-1" />
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{THEME_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div className="flex-1" />

			{/* Export buttons */}
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onExportSvg}
							disabled={isRendering}
						>
							<FileCode className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Export SVG</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onExportPng}
							disabled={isRendering}
						>
							<ImageIcon className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Export PNG</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}

/**
 * Error display component.
 */
function RenderError({ error, onRetry }: { error: string; onRetry: () => void }) {
	return (
		<div className="h-full flex items-center justify-center p-6">
			<div className="text-center max-w-md">
				<AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3 opacity-60" />
				<h3 className="font-semibold text-sm mb-1">Render Error</h3>
				<p className="text-xs text-muted-foreground mb-3">{error}</p>
				<Button variant="outline" size="sm" onClick={onRetry}>
					<RefreshCw className="h-4 w-4 mr-1" />
					Retry
				</Button>
			</div>
		</div>
	);
}

/**
 * Safe SVG renderer component that sanitizes content before rendering.
 * Uses DOMPurify to prevent XSS attacks while preserving SVG functionality.
 */
function SafeSvgRenderer({ svg }: { svg: string }) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (containerRef.current && svg) {
			// Sanitize SVG content using DOMPurify before inserting into DOM
			// This prevents XSS attacks while preserving valid SVG elements
			const sanitizedSvg = sanitizeSvg(svg);
			// Safe to set innerHTML after sanitization by DOMPurify
			containerRef.current.innerHTML = sanitizedSvg;
		}
	}, [svg]);

	return (
		<div
			ref={containerRef}
			className="[&_svg]:max-w-full [&_svg]:max-h-full"
		/>
	);
}

/**
 * GraphicPreview - Renders and displays diagram previews with interactive controls.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <GraphicPreview
 *   code={mermaidCode}
 *   format="mermaid"
 * />
 *
 * // Thumbnail mode (smaller, no controls)
 * <GraphicPreview
 *   code={code}
 *   width={200}
 *   height={120}
 *   showControls={false}
 * />
 *
 * // With theme and callbacks
 * <GraphicPreview
 *   code={d2Code}
 *   format="d2"
 *   initialTheme="dark"
 *   onRenderComplete={(success, error) => {
 *     if (!success) console.error(error);
 *   }}
 * />
 * ```
 */
export function GraphicPreview({
	code,
	format = "mermaid",
	width,
	height,
	className,
	showControls,
	initialTheme = "default",
	onRenderComplete,
}: GraphicPreviewProps) {
	// State
	const [svg, setSvg] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isRendering, setIsRendering] = useState(false);
	const [theme, setTheme] = useState<DiagramTheme>(initialTheme);
	const [transform, setTransform] = useState<ViewTransform>(getDefaultViewTransform());

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);
	const lastPosition = useRef({ x: 0, y: 0 });

	// Determine if we should show controls (default: yes unless in small thumbnail mode)
	const shouldShowControls = showControls ?? (!(width && width < 300));

	// Render diagram
	const render = useCallback(async () => {
		if (!code) {
			setSvg(null);
			setError(null);
			return;
		}

		setIsRendering(true);
		setError(null);

		try {
			const diagramFormat = format === "svg" || format === "png" ? "mermaid" : format;
			const result = await renderDiagram(code, diagramFormat as DiagramFormat, "svg", theme);

			if (result.success && typeof result.data === "string") {
				setSvg(result.data);
				onRenderComplete?.(true);
			} else {
				setError(result.error || "Failed to render diagram");
				setSvg(null);
				onRenderComplete?.(false, result.error);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			setError(errorMessage);
			setSvg(null);
			onRenderComplete?.(false, errorMessage);
		}

		setIsRendering(false);
	}, [code, format, theme, onRenderComplete]);

	// Render on code/theme change
	useEffect(() => {
		render();
	}, [render]);

	// Zoom handlers
	const handleZoomIn = useCallback(() => {
		setTransform((prev: ViewTransform) => ({
			...prev,
			scale: calculateZoom(prev.scale, 1),
		}));
	}, []);

	const handleZoomOut = useCallback(() => {
		setTransform((prev: ViewTransform) => ({
			...prev,
			scale: calculateZoom(prev.scale, -1),
		}));
	}, []);

	const handleReset = useCallback(() => {
		setTransform(getDefaultViewTransform());
	}, []);

	const handleFitToContainer = useCallback(() => {
		if (!containerRef.current || !contentRef.current) return;

		const container = containerRef.current.getBoundingClientRect();
		const content = contentRef.current.getBoundingClientRect();

		const newTransform = fitToContainer(
			content.width / transform.scale,
			content.height / transform.scale,
			container.width,
			container.height
		);

		setTransform(newTransform);
	}, [transform.scale]);

	// Pan handlers
	const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0) return; // Only left click
		isDragging.current = true;
		lastPosition.current = { x: e.clientX, y: e.clientY };
		(e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
	}, []);

	const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!isDragging.current) return;

		const deltaX = e.clientX - lastPosition.current.x;
		const deltaY = e.clientY - lastPosition.current.y;

		setTransform((prev: ViewTransform) => calculatePan(prev, deltaX, deltaY));

		lastPosition.current = { x: e.clientX, y: e.clientY };
	}, []);

	const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		isDragging.current = false;
		(e.currentTarget as HTMLDivElement).style.cursor = "grab";
	}, []);

	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -1 : 1;
		setTransform((prev: ViewTransform) => ({
			...prev,
			scale: calculateZoom(prev.scale, delta * 0.5),
		}));
	}, []);

	// Export handlers
	const handleExportSvg = useCallback(() => {
		if (!svg) return;
		downloadDiagram(svg, "diagram.svg");
	}, [svg]);

	const handleExportPng = useCallback(async () => {
		if (!svg) return;

		const png = await svgToPng(svg);
		if (png) {
			downloadDiagram(png, "diagram.png");
		}
	}, [svg]);

	// Handle theme change
	const handleThemeChange = useCallback((newTheme: DiagramTheme) => {
		setTheme(newTheme);
	}, []);

	// Loading state
	if (isRendering && !svg) {
		return (
			<div
				className={cn("flex flex-col", className)}
				style={{ width, height }}
			>
				{shouldShowControls && (
					<div className="h-[41px] border-b bg-muted/50">
						<Skeleton className="h-full w-full" />
					</div>
				)}
				<div className="flex-1 flex items-center justify-center bg-muted/30">
					<div className="flex flex-col items-center gap-2">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
						<span className="text-xs text-muted-foreground">Rendering...</span>
					</div>
				</div>
			</div>
		);
	}

	// Error state
	if (error && !svg) {
		return (
			<div
				className={cn("flex flex-col", className)}
				style={{ width, height }}
			>
				{shouldShowControls && (
					<PreviewToolbar
						theme={theme}
						onThemeChange={handleThemeChange}
						onZoomIn={handleZoomIn}
						onZoomOut={handleZoomOut}
						onFitToContainer={handleFitToContainer}
						onReset={handleReset}
						onExportSvg={handleExportSvg}
						onExportPng={handleExportPng}
						isRendering={isRendering}
					/>
				)}
				<RenderError error={error} onRetry={render} />
			</div>
		);
	}

	return (
		<div
			className={cn("flex flex-col bg-background", className)}
			style={{ width, height }}
		>
			{shouldShowControls && (
				<PreviewToolbar
					theme={theme}
					onThemeChange={handleThemeChange}
					onZoomIn={handleZoomIn}
					onZoomOut={handleZoomOut}
					onFitToContainer={handleFitToContainer}
					onReset={handleReset}
					onExportSvg={handleExportSvg}
					onExportPng={handleExportPng}
					isRendering={isRendering}
				/>
			)}

			<div
				ref={containerRef}
				className={cn(
					"flex-1 overflow-hidden relative",
					shouldShowControls && "cursor-grab"
				)}
				onMouseDown={shouldShowControls ? handleMouseDown : undefined}
				onMouseMove={shouldShowControls ? handleMouseMove : undefined}
				onMouseUp={shouldShowControls ? handleMouseUp : undefined}
				onMouseLeave={shouldShowControls ? handleMouseUp : undefined}
				onWheel={shouldShowControls ? handleWheel : undefined}
			>
				{/* Grid background pattern */}
				<div
					className="absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage: `
							linear-gradient(to right, currentColor 1px, transparent 1px),
							linear-gradient(to bottom, currentColor 1px, transparent 1px)
						`,
						backgroundSize: "20px 20px",
					}}
				/>

				{/* SVG content - safely rendered with DOMPurify sanitization */}
				{svg && (
					<div
						ref={contentRef}
						className="absolute inset-0 flex items-center justify-center"
						style={{
							transform: transformToCss(transform),
							transformOrigin: "center center",
						}}
					>
						<SafeSvgRenderer svg={svg} />
					</div>
				)}

				{/* Loading overlay */}
				{isRendering && svg && (
					<div className="absolute inset-0 bg-background/50 flex items-center justify-center">
						<RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				)}

				{/* Zoom indicator */}
				{shouldShowControls && transform.scale !== 1 && (
					<div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground">
						{Math.round(transform.scale * 100)}%
					</div>
				)}
			</div>
		</div>
	);
}
