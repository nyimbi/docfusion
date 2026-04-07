/**
 * Diagram Preview - DocFusion
 *
 * Component for displaying rendered diagrams with:
 * - Zoom and pan controls
 * - Theme support
 * - Fullscreen mode
 * - Export functionality
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { sanitizeHTML } from "@/lib/utils/sanitize";
import {
	AlertCircle,
	Download,
	Expand,
	Maximize2,
	Minimize2,
	RefreshCw,
	ZoomIn,
	ZoomOut,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface DiagramPreviewProps {
	svg: string | null;
	isLoading?: boolean;
	errors?: string[];
	className?: string;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onZoomReset?: () => void;
	onZoomFit?: () => void;
	onDownload?: (format: "svg" | "png") => void;
	onFullscreen?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function DiagramPreview({
	svg,
	isLoading = false,
	errors = [],
	className,
	onZoomIn,
	onZoomOut,
	onZoomReset,
	onZoomFit,
	onDownload,
	onFullscreen,
}: DiagramPreviewProps) {
	const [zoom, setZoom] = React.useState(1);
	const [pan, setPan] = React.useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const svgRef = React.useRef<HTMLDivElement>(null);
	const lastMousePos = React.useRef({ x: 0, y: 0 });

	/**
	 * Handle zoom in
	 */
	const handleZoomIn = () => {
		const newZoom = Math.min(zoom * 1.2, 4);
		setZoom(newZoom);
		onZoomIn?.();
	};

	/**
	 * Handle zoom out
	 */
	const handleZoomOut = () => {
		const newZoom = Math.max(zoom / 1.2, 0.25);
		setZoom(newZoom);
		onZoomOut?.();
	};

	/**
	 * Handle zoom reset
	 */
	const handleZoomReset = () => {
		setZoom(1);
		setPan({ x: 0, y: 0 });
		onZoomReset?.();
	};

	/**
	 * Handle zoom to fit
	 */
	const handleZoomFit = () => {
		if (!svg || !containerRef.current || !svgRef.current) return;

		const container = containerRef.current.getBoundingClientRect();
		const svgElement = svgRef.current.querySelector("svg");
		
		if (!svgElement) return;

		const svgRect = svgElement.getBoundingClientRect();
		const padding = 40;

		const scaleX = (container.width - padding * 2) / svgRect.width;
		const scaleY = (container.height - padding * 2) / svgRect.height;
		const fitScale = Math.min(scaleX, scaleY, 1);

		setZoom(fitScale);
		setPan({ x: 0, y: 0 });
		onZoomFit?.();
	};

	/**
	 * Handle mouse down for panning
	 */
	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true);
		lastMousePos.current = { x: e.clientX, y: e.clientY };
	};

	/**
	 * Handle mouse move for panning
	 */
	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging) return;

		const deltaX = e.clientX - lastMousePos.current.x;
		const deltaY = e.clientY - lastMousePos.current.y;
		lastMousePos.current = { x: e.clientX, y: e.clientY };

		setPan((prev) => ({
			x: prev.x + deltaX,
			y: prev.y + deltaY,
		}));
	};

	/**
	 * Handle mouse up to stop panning
	 */
	const handleMouseUp = () => {
		setIsDragging(false);
	};

	/**
	 * Handle wheel zoom
	 */
	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setZoom((prev) => Math.max(0.25, Math.min(4, prev * delta)));
	};

	/**
	 * Handle download
	 */
	const handleDownload = (format: "svg" | "png") => {
		if (!svg) return;

		if (format === "svg") {
			const blob = new Blob([svg], { type: "image/svg+xml" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = "diagram.svg";
			link.click();
			URL.revokeObjectURL(url);
		} else {
			// PNG conversion handled by parent
			onDownload?.(format);
		}
	};

	/**
	 * Toggle fullscreen
	 */
	const handleFullscreen = () => {
		if (!containerRef.current) return;

		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			containerRef.current.requestFullscreen();
		}
		onFullscreen?.();
	};

	return (
		<div
			ref={containerRef}
			className={cn(
				"flex flex-col h-full",
				className
			)}
		>
			{/* Toolbar */}
			<div className="flex items-center gap-2 p-2 border-b bg-muted/50 shrink-0">
				{/* Zoom Controls */}
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomOut}
						disabled={isLoading}
						title="Zoom out"
					>
						<ZoomOut className="h-4 w-4" />
					</Button>

					<span className="text-sm font-medium min-w-[4ch] text-center">
						{Math.round(zoom * 100)}%
					</span>

					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomIn}
						disabled={isLoading}
						title="Zoom in"
					>
						<ZoomIn className="h-4 w-4" />
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomReset}
						disabled={isLoading}
						title="Reset zoom"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={handleZoomFit}
						disabled={isLoading || !svg}
						title="Fit to screen"
					>
						<Maximize2 className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex-1" />

				{/* Download Controls */}
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleDownload("svg")}
						disabled={isLoading || !svg}
						title="Download SVG"
					>
						<Download className="h-4 w-4 mr-1" />
						SVG
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleDownload("png")}
						disabled={isLoading || !svg}
						title="Download PNG"
					>
						<Download className="h-4 w-4 mr-1" />
						PNG
					</Button>
				</div>

				<div className="h-4 w-px bg-border mx-1" />

				{/* Fullscreen */}
				<Button
					variant="ghost"
					size="sm"
					onClick={handleFullscreen}
					disabled={isLoading}
					title="Toggle fullscreen"
				>
					<Expand className="h-4 w-4" />
				</Button>
			</div>

			{/* Error Display */}
			{errors.length > 0 && (
				<div className="bg-destructive/10 border-b px-3 py-2 text-sm text-destructive">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-4 w-4" />
						<span>{errors[0]}</span>
					</div>
				</div>
			)}

			{/* Preview Area */}
			<div
				className="flex-1 overflow-hidden flex items-center justify-center bg-muted/20 relative cursor-grab active:cursor-grabbing"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onWheel={handleWheel}
			>
				{isLoading ? (
					<div className="flex items-center gap-3 text-muted-foreground">
						<RefreshCw className="h-6 w-6 animate-spin" />
						<span>Rendering...</span>
					</div>
				) : svg ? (
					<div
						ref={svgRef}
						className="origin-center transition-transform duration-100 ease-out p-8"
						style={{
							transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
						}}
						dangerouslySetInnerHTML={{ __html: sanitizeHTML(svg) }}
					/>
				) : errors.length > 0 ? (
					<div className="text-center text-destructive max-w-md px-4">
						<div className="bg-destructive/10 rounded-lg p-6">
							<h3 className="font-semibold mb-2">Rendering Error</h3>
							<p className="text-sm">{errors[0]}</p>
						</div>
					</div>
				) : (
					<div className="text-center text-muted-foreground">
						<p>No diagram to display</p>
						<p className="text-sm mt-1">Enter code to see the preview</p>
					</div>
				)}
			</div>

			{/* Scale Indicator */}
			<div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-medium shadow-sm border">
				{Math.round(zoom * 100)}%
			</div>
		</div>
	);
}
