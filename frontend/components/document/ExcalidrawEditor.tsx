"use client";

/**
 * Lightweight document drawing editor.
 *
 * This keeps the document whiteboard feature in first-party code so the
 * application is not tied to the vulnerable Excalidraw dependency chain.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
	Download,
	Maximize2,
	Minimize2,
	RotateCcw,
	Save,
	Undo,
	Redo,
	PenLine,
} from "lucide-react";

interface DrawingPoint {
	x: number;
	y: number;
}

interface DrawingStroke {
	id: string;
	points: DrawingPoint[];
	color: string;
	width: number;
}

interface DrawingContent {
	version: 1;
	type: "docfusion-drawing";
	strokes: DrawingStroke[];
	note?: string;
}

interface ExcalidrawEditorProps {
	initialContent?: string;
	onSave?: (content: string) => void;
	onExport?: (format: "png" | "svg") => void;
	readOnly?: boolean;
	className?: string;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 520;
const DEFAULT_COLOR = "#1f2937";
const DEFAULT_WIDTH = 4;

function parseDrawingContent(initialContent?: string): DrawingContent {
	if (!initialContent) {
		return { version: 1, type: "docfusion-drawing", strokes: [] };
	}

	try {
		const parsed = JSON.parse(initialContent) as Partial<DrawingContent> & {
			elements?: unknown[];
		};
		if (Array.isArray(parsed.strokes)) {
			return {
				version: 1,
				type: "docfusion-drawing",
				strokes: parsed.strokes,
				note: parsed.note,
			};
		}

		// Preserve older Excalidraw JSON as a visible note instead of dropping it.
		if (Array.isArray(parsed.elements)) {
			return {
				version: 1,
				type: "docfusion-drawing",
				strokes: [],
				note: `${parsed.elements.length} legacy drawing element(s) are preserved in document history.`,
			};
		}
	} catch {
		return {
			version: 1,
			type: "docfusion-drawing",
			strokes: [],
			note: initialContent,
		};
	}

	return { version: 1, type: "docfusion-drawing", strokes: [] };
}

function getPoint(event: React.PointerEvent<SVGSVGElement>, svg: SVGSVGElement): DrawingPoint {
	const rect = svg.getBoundingClientRect();
	return {
		x: Math.max(0, Math.min(CANVAS_WIDTH, ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH)),
		y: Math.max(0, Math.min(CANVAS_HEIGHT, ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT)),
	};
}

function strokePath(points: DrawingPoint[]): string {
	if (points.length === 0) return "";
	if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

	const [first, ...rest] = points;
	return rest.reduce((path, point, index) => {
		const previous = points[index];
		const midX = (previous.x + point.x) / 2;
		const midY = (previous.y + point.y) / 2;
		return `${path} Q ${previous.x} ${previous.y} ${midX} ${midY}`;
	}, `M ${first.x} ${first.y}`);
}

function renderSvg(strokes: DrawingStroke[], note?: string): string {
	const paths = strokes
		.map((stroke) => {
			const d = strokePath(stroke.points);
			return `<path d="${d}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
		})
		.join("");

	const noteMarkup = note
		? `<text x="28" y="492" fill="#6b7280" font-family="Arial, sans-serif" font-size="16">${escapeXml(note.slice(0, 120))}</text>`
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"><rect width="100%" height="100%" fill="#ffffff"/><g opacity="0.22">${gridLines()}</g>${paths}${noteMarkup}</svg>`;
}

function gridLines(): string {
	const lines: string[] = [];
	for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
		lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${CANVAS_HEIGHT}" stroke="#cbd5e1" stroke-width="1"/>`);
	}
	for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
		lines.push(`<line x1="0" y1="${y}" x2="${CANVAS_WIDTH}" y2="${y}" stroke="#cbd5e1" stroke-width="1"/>`);
	}
	return lines.join("");
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function ExcalidrawEditor({
	initialContent,
	onSave,
	onExport,
	readOnly = false,
	className,
}: ExcalidrawEditorProps) {
	const initialData = React.useMemo(() => parseDrawingContent(initialContent), [initialContent]);
	const [strokes, setStrokes] = React.useState<DrawingStroke[]>(initialData.strokes);
	const [redoStack, setRedoStack] = React.useState<DrawingStroke[]>([]);
	const [activeStroke, setActiveStroke] = React.useState<DrawingStroke | null>(null);
	const [note, setNote] = React.useState(initialData.note ?? "");
	const [isExpanded, setIsExpanded] = React.useState(false);
	const [lastSaveTime, setLastSaveTime] = React.useState<Date | null>(null);
	const svgRef = React.useRef<SVGSVGElement>(null);

	const currentStrokes = activeStroke ? [...strokes, activeStroke] : strokes;

	const handlePointerDown = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
		if (readOnly || !svgRef.current) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const point = getPoint(event, svgRef.current);
		setRedoStack([]);
		setActiveStroke({
			id: crypto.randomUUID(),
			points: [point],
			color: DEFAULT_COLOR,
			width: DEFAULT_WIDTH,
		});
	}, [readOnly]);

	const handlePointerMove = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
		if (readOnly || !activeStroke || !svgRef.current) return;
		const point = getPoint(event, svgRef.current);
		setActiveStroke((stroke) => {
			if (!stroke) return stroke;
			const last = stroke.points[stroke.points.length - 1];
			if (last && Math.hypot(last.x - point.x, last.y - point.y) < 2) return stroke;
			return { ...stroke, points: [...stroke.points, point] };
		});
	}, [activeStroke, readOnly]);

	const finishStroke = React.useCallback(() => {
		setActiveStroke((stroke) => {
			if (stroke && stroke.points.length > 0) {
				setStrokes((existing) => [...existing, stroke]);
			}
			return null;
		});
	}, []);

	const handleSave = React.useCallback(() => {
		const content: DrawingContent = {
			version: 1,
			type: "docfusion-drawing",
			strokes,
			note: note.trim() || undefined,
		};
		onSave?.(JSON.stringify(content));
		setLastSaveTime(new Date());
		toast.success("Drawing saved");
	}, [note, onSave, strokes]);

	const handleExport = React.useCallback(async (format: "png" | "svg") => {
		const svg = renderSvg(strokes, note);
		onExport?.(format);

		if (format === "svg") {
			downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "document-drawing.svg");
			toast.success("Exported as SVG");
			return;
		}

		const image = new Image();
		const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = CANVAS_WIDTH * 2;
			canvas.height = CANVAS_HEIGHT * 2;
			const context = canvas.getContext("2d");
			if (!context) {
				URL.revokeObjectURL(svgUrl);
				toast.error("Failed to export PNG");
				return;
			}
			context.scale(2, 2);
			context.drawImage(image, 0, 0);
			canvas.toBlob((blob) => {
				URL.revokeObjectURL(svgUrl);
				if (!blob) {
					toast.error("Failed to export PNG");
					return;
				}
				downloadBlob(blob, "document-drawing.png");
				toast.success("Exported as PNG");
			}, "image/png");
		};
		image.onerror = () => {
			URL.revokeObjectURL(svgUrl);
			toast.error("Failed to export PNG");
		};
		image.src = svgUrl;
	}, [note, onExport, strokes]);

	const handleReset = React.useCallback(() => {
		if (readOnly) return;
		const confirmed = window.confirm("Clear the drawing canvas?");
		if (!confirmed) return;
		setRedoStack([]);
		setActiveStroke(null);
		setStrokes([]);
		toast.info("Canvas cleared");
	}, [readOnly]);

	const handleUndo = React.useCallback(() => {
		if (readOnly) return;
		setStrokes((existing) => {
			const next = existing.slice(0, -1);
			const removed = existing[existing.length - 1];
			if (removed) setRedoStack((redo) => [...redo, removed]);
			return next;
		});
	}, [readOnly]);

	const handleRedo = React.useCallback(() => {
		if (readOnly) return;
		setRedoStack((redo) => {
			const restored = redo[redo.length - 1];
			if (restored) setStrokes((existing) => [...existing, restored]);
			return redo.slice(0, -1);
		});
	}, [readOnly]);

	const canvas = (
		<div className="flex min-h-0 flex-1 flex-col">
			<svg
				ref={svgRef}
				viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
				className={cn(
					"min-h-[360px] w-full flex-1 touch-none bg-white",
					readOnly ? "cursor-default" : "cursor-crosshair"
				)}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={finishStroke}
				onPointerCancel={finishStroke}
				role="img"
				aria-label="Document drawing canvas"
			>
				<rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#ffffff" />
				<g opacity={0.22}>
					{Array.from({ length: Math.floor(CANVAS_WIDTH / 40) + 1 }, (_, index) => (
						<line key={`x-${index}`} x1={index * 40} y1={0} x2={index * 40} y2={CANVAS_HEIGHT} stroke="#cbd5e1" />
					))}
					{Array.from({ length: Math.floor(CANVAS_HEIGHT / 40) + 1 }, (_, index) => (
						<line key={`y-${index}`} x1={0} y1={index * 40} x2={CANVAS_WIDTH} y2={index * 40} stroke="#cbd5e1" />
					))}
				</g>
				{currentStrokes.map((stroke) => (
					<path
						key={stroke.id}
						d={strokePath(stroke.points)}
						fill="none"
						stroke={stroke.color}
						strokeWidth={stroke.width}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))}
			</svg>
			<textarea
				value={note}
				onChange={(event) => setNote(event.target.value)}
				disabled={readOnly}
				className="min-h-[76px] resize-none border-t bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
				placeholder="Add drawing notes"
			/>
		</div>
	);

	return (
		<div
			className={cn(
				"flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900",
				className
			)}
		>
			<div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="sm" onClick={handleUndo} disabled={readOnly || strokes.length === 0}>
						<Undo className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm" onClick={handleRedo} disabled={readOnly || redoStack.length === 0}>
						<Redo className="h-4 w-4" />
					</Button>
					<div className="mx-2 h-4 w-px bg-border" />
					<Button variant="ghost" size="sm" onClick={handleReset} disabled={readOnly} title="Reset canvas">
						<RotateCcw className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex items-center gap-1">
					<span className="text-xs text-muted-foreground">
						{lastSaveTime ? `Saved ${lastSaveTime.toLocaleTimeString()}` : "Not saved"}
					</span>
					<div className="mx-2 h-4 w-px bg-border" />
					<Button variant="ghost" size="sm" onClick={() => handleExport("png")}>
						<Download className="mr-1 h-4 w-4" />
						PNG
					</Button>
					<Button variant="ghost" size="sm" onClick={() => handleExport("svg")}>
						<Download className="mr-1 h-4 w-4" />
						SVG
					</Button>
					<Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)} title="Expand">
						<Maximize2 className="h-4 w-4" />
					</Button>
					{!readOnly && (
						<Button variant="primary" size="sm" onClick={handleSave}>
							<Save className="mr-1 h-4 w-4" />
							Save
						</Button>
					)}
				</div>
			</div>

			{canvas}

			<Dialog open={isExpanded} onOpenChange={setIsExpanded}>
				<DialogContent className="flex h-[95vh] w-[95vw] max-w-none flex-col p-0">
					<DialogHeader className="border-b px-4 py-3">
						<DialogTitle className="flex items-center gap-2">
							<PenLine className="h-4 w-4" />
							Drawing
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-1 flex-col">
						{canvas}
						<div className="flex justify-end gap-2 border-t px-4 py-3">
							<Button variant="outline" onClick={() => setIsExpanded(false)}>
								<Minimize2 className="mr-1 h-4 w-4" />
								Close
							</Button>
							{!readOnly && (
								<Button variant="primary" onClick={handleSave}>
									<Save className="mr-1 h-4 w-4" />
									Save
								</Button>
							)}
						</div>
					</div>
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

export function ExcalidrawCard({
	content,
	onEdit,
	onExport,
	className,
}: ExcalidrawCardProps) {
	const drawing = React.useMemo(() => parseDrawingContent(content), [content]);

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md dark:bg-gray-900",
				className
			)}
			style={{ minHeight: "200px" }}
		>
			<svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="h-[220px] w-full bg-white">
				<rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#ffffff" />
				{drawing.strokes.length === 0 ? (
					<text x="50%" y="50%" textAnchor="middle" fill="#6b7280" fontSize="28">
						Drawing
					</text>
				) : (
					drawing.strokes.map((stroke) => (
						<path
							key={stroke.id}
							d={strokePath(stroke.points)}
							fill="none"
							stroke={stroke.color}
							strokeWidth={stroke.width}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					))
				)}
			</svg>

			<div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity hover:opacity-100">
				<Button variant="secondary" size="sm" className="bg-white/90 hover:bg-white" onClick={onEdit}>
					<Maximize2 className="mr-1 h-4 w-4" />
					Edit
				</Button>
				<Button variant="secondary" size="sm" className="bg-white/90 hover:bg-white" onClick={onExport}>
					<Download className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
