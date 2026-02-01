/**
 * Unified Diagram Renderer - DocFusion
 *
 * Provides a unified interface for rendering PlantUML, Structurizr, D2,
 * and Mermaid diagrams. Handles format detection, rendering fallbacks,
 * and theme application.
 */

import type {
	DiagramFormat,
	DiagramTheme,
	D2RenderOptions,
	PlantUmlRenderOptions,
	RenderResult,
	StructurizrRenderOptions,
	ViewTransform,
	ParseResult,
	ParsedPlantUmlDiagram,
	ParsedStructurizrWorkspace,
	ParsedD2Diagram,
} from "./types";
import {
	renderPlantUML,
	parsePlantUML,
	formatPlantUML,
	validatePlantUML,
	getPlantUmlSuggestions,
	PLANTUML_TEMPLATES,
	PLANTUML_SNIPPETS,
	encodePlantUML,
	DEFAULT_PLANTUML_SERVER,
} from "./plantuml";
import {
	parseStructurizr,
	formatStructurizr,
	validateStructurizr,
	getStructurizrSuggestions,
	structurizrToMermaid,
	STRUCTURIZR_TEMPLATES,
	STRUCTURIZR_SNIPPETS,
} from "./structurizr";
import {
	parseD2,
	formatD2,
	validateD2,
	getD2Suggestions,
	d2ToMermaid,
	D2_TEMPLATES,
	D2_SNIPPETS,
} from "./d2";
import mermaid from "mermaid";

// =============================================================================
// Format Detection
// =============================================================================

/**
 * Detect diagram format from code content
 */
export function detectDiagramFormat(code: string): DiagramFormat {
	const trimmed = code.trim().toLowerCase();
	
	// Check for PlantUML
	if (trimmed.match(/^@(start|end)(uml|mindmap|gantt|salt|wbs)/)) {
		return "plantuml";
	}
	
	// Check for Structurizr
	if (trimmed.match(/^workspace\s*\{/)) {
		return "structurizr";
	}
	
	// Check for D2
	if (trimmed.match(/^direction:\s*(up|down|left|right)/)) {
		return "d2";
	}
	if (trimmed.match(/\w+:\s*[^->]+$/m)) {
		return "d2";
	}
	
	// Default to Mermaid
	return "mermaid";
}

// =============================================================================
// Unified Parsing
// =============================================================================

/**
 * Parse diagram code based on format
 */
export function parseDiagram(
	code: string,
	format: DiagramFormat
): ParseResult<ParsedPlantUmlDiagram | ParsedStructurizrWorkspace | ParsedD2Diagram> {
	switch (format) {
		case "plantuml": {
			const { parsed, errors } = parsePlantUML(code);
			return {
				success: errors.length === 0,
				data: parsed || undefined,
				errors: errors.length > 0 ? errors : undefined,
			};
		}
		case "structurizr": {
			const { parsed, errors } = parseStructurizr(code);
			return {
				success: errors.length === 0,
				data: parsed || undefined,
				errors: errors.length > 0 ? errors : undefined,
			};
		}
		case "d2": {
			const { parsed, errors } = parseD2(code);
			return {
				success: errors.length === 0,
				data: parsed || undefined,
				errors: errors.length > 0 ? errors : undefined,
			};
		}
		case "mermaid":
			// Mermaid is handled by the library directly
			return { success: true };
		default:
			return { success: false, errors: [{ line: 0, column: 0, message: "Unknown format" }] };
	}
}

// =============================================================================
// Unified Formatting
// =============================================================================

/**
 * Format diagram code based on format
 */
export function formatDiagram(code: string, format: DiagramFormat): string {
	switch (format) {
		case "plantuml":
			return formatPlantUML(code);
		case "structurizr":
			return formatStructurizr(code);
		case "d2":
			return formatD2(code);
		case "mermaid":
			// Mermaid doesn't need special formatting
			return code;
		default:
			return code;
	}
}

// =============================================================================
// Unified Validation
// =============================================================================

/**
 * Validate diagram code and return errors
 */
export function validateDiagram(code: string, format: DiagramFormat) {
	switch (format) {
		case "plantuml":
			return validatePlantUML(code);
		case "structurizr":
			return validateStructurizr(code);
		case "d2":
			return validateD2(code);
		case "mermaid":
			// Mermaid validation is done client-side
			return [];
		default:
			return [];
	}
}

// =============================================================================
// Auto-complete
// =============================================================================

/**
 * Get auto-complete suggestions for the given format
 */
export function getAutocompleteSuggestions(
	code: string,
	format: DiagramFormat,
	position: { line: number; column: number }
) {
	switch (format) {
		case "plantuml":
			return getPlantUmlSuggestions(code, position);
		case "structurizr":
			return getStructurizrSuggestions(code, position);
		case "d2":
			return getD2Suggestions(code, position);
		case "mermaid":
			return [];
		default:
			return [];
	}
}

// =============================================================================
// Templates and Snippets
// =============================================================================

/**
 * Get templates for the given format
 */
export function getDiagramTemplates(format: DiagramFormat) {
	switch (format) {
		case "plantuml":
			return PLANTUML_TEMPLATES;
		case "structurizr":
			return STRUCTURIZR_TEMPLATES;
		case "d2":
			return D2_TEMPLATES;
		case "mermaid":
			return [];
		default:
			return [];
	}
}

/**
 * Get code snippets for the given format
 */
export function getDiagramSnippets(format: DiagramFormat) {
	switch (format) {
		case "plantuml":
			return PLANTUML_SNIPPETS;
		case "structurizr":
			return STRUCTURIZR_SNIPPETS;
		case "d2":
			return D2_SNIPPETS;
		case "mermaid":
			return [];
		default:
			return [];
	}
}

// =============================================================================
// Rendering
// =============================================================================

/**
 * Render diagram to SVG/PNG
 */
export async function renderDiagram(
	code: string,
	format: DiagramFormat,
	outputFormat: "svg" | "png" = "svg",
	theme?: DiagramTheme
): Promise<RenderResult> {
	switch (format) {
		case "plantuml": {
			const options: PlantUmlRenderOptions = {
				format: outputFormat,
				server: DEFAULT_PLANTUML_SERVER,
			};
			return renderPlantUML(code, options);
		}
		case "structurizr": {
			// Convert to Mermaid for client-side rendering
			const mermaidCode = structurizrToMermaid(code);
			return renderMermaid(mermaidCode, theme);
		}
		case "d2": {
			// Convert to Mermaid for client-side rendering
			const mermaidCode = d2ToMermaid(code);
			return renderMermaid(mermaidCode, theme);
		}
		case "mermaid":
			return renderMermaid(code, theme);
		default:
			return { success: false, error: "Unknown format" };
	}
}

/**
 * Render Mermaid diagram using the mermaid library
 */
export async function renderMermaid(
	code: string,
	theme: DiagramTheme = "default"
): Promise<RenderResult> {
	try {
		// Configure mermaid
		mermaid.initialize({
			startOnLoad: false,
			theme: theme === "dark" ? "dark" : "default",
			securityLevel: "strict",
		});
		
		// Generate unique ID for rendering
		const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		// Render
		const { svg } = await mermaid.render(id, code);
		
		return {
			success: true,
			data: svg,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to render Mermaid diagram",
		};
	}
}

/**
 * Get PlantUML rendering URL (for external rendering)
 */
export function getPlantUmlUrl(code: string, format: "svg" | "png" = "svg"): string {
	const encoded = encodePlantUML(code);
	return `${DEFAULT_PLANTUML_SERVER}/${format}/${encoded}`;
}

// =============================================================================
// Export/Conversion
// =============================================================================

/**
 * Convert diagram to SVG string
 */
export async function diagramToSvg(
	code: string,
	format: DiagramFormat,
	theme?: DiagramTheme
): Promise<string | null> {
	const result = await renderDiagram(code, format, "svg", theme);
	if (result.success && typeof result.data === "string") {
		return result.data;
	}
	return null;
}

/**
 * Convert diagram to PNG Blob
 */
export async function diagramToPng(
	code: string,
	format: DiagramFormat,
	theme?: DiagramTheme
): Promise<Blob | null> {
	const result = await renderDiagram(code, format, "png", theme);
	if (result.success && result.data instanceof Blob) {
		return result.data;
	}
	return null;
}

/**
 * Convert SVG string to PNG Blob (using canvas)
 */
export async function svgToPng(svg: string, width?: number, height?: number): Promise<Blob | null> {
	return new Promise((resolve) => {
		const img = new Image();
		const svgBlob = new Blob([svg], { type: "image/svg+xml" });
		const url = URL.createObjectURL(svgBlob);
		
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = width || img.naturalWidth;
			canvas.height = height || img.naturalHeight;
			
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve(null);
				return;
			}
			
			ctx.drawImage(img, 0, 0);
			canvas.toBlob((blob) => resolve(blob));
			URL.revokeObjectURL(url);
		};
		
		img.onerror = () => {
			resolve(null);
			URL.revokeObjectURL(url);
		};
		
		img.src = url;
	});
}

/**
 * Convert diagram to specified format
 */
export async function convertDiagram(
	code: string,
	fromFormat: DiagramFormat,
	toFormat: "mermaid" | "plantuml" | "d2"
): Promise<string | null> {
	if (fromFormat === toFormat) return code;
	
	switch (fromFormat) {
		case "structurizr":
			if (toFormat === "mermaid") {
				return structurizrToMermaid(code);
			}
			break;
		case "d2":
			if (toFormat === "mermaid") {
				return d2ToMermaid(code);
			}
			break;
		default:
			return null;
	}
	
	return null;
}

// =============================================================================
// Theme Management
// =============================================================================

/**
 * Apply theme to SVG
 */
export function applyThemeToSvg(svg: string, theme: DiagramTheme): string {
	const themeColors: Record<string, Record<string, string>> = {
		default: {
			background: "#ffffff",
			foreground: "#333333",
			border: "#666666",
		},
		dark: {
			background: "#1e1e1e",
			foreground: "#d4d4d4",
			border: "#555555",
		},
		light: {
			background: "#fafafa",
			foreground: "#333333",
			border: "#cccccc",
		},
		forest: {
			background: "#f0f8e8",
			foreground: "#1a4a1a",
			border: "#4a8a4a",
		},
		ocean: {
			background: "#e6f3ff",
			foreground: "#003366",
			border: "#3399ff",
		},
		cyber: {
			background: "#0a0a0f",
			foreground: "#00ff00",
			border: "#00ffff",
		},
	};
	
	const colors = themeColors[theme] || themeColors.default;
	
	// Apply background color
	svg = svg.replace(
		/<svg[^>]*>/,
		(match) => {
			if (!match.includes("style=")) {
				return match.replace(/>$/, ` style="background-color: ${colors.background}">`);
			}
			return match;
		}
	);
	
	return svg;
}

/**
 * Theme configuration for different diagram formats
 */
export interface ThemeConfig {
	plantuml?: string;
	mermaid?: object;
	structurizr?: object;
	d2?: object;
}

/**
 * Get theme configuration for a format
 */
export function getThemeConfig(theme: DiagramTheme, format: DiagramFormat): string | object | null {
	switch (format) {
		case "plantuml": {
			// Return PlantUML skinparams
			const configs: Record<string, string> = {
				default: "",
				light: `skinparam backgroundColor #fafafa\nskinparam defaultFontColor #333333`,
				dark: `skinparam backgroundColor #1e1e1e\nskinparam defaultFontColor #d4d4d4`,
				ocean: `skinparam backgroundColor #e6f3ff\nskinparam defaultFontColor #003366`,
				forest: `skinparam backgroundColor #f0f8e8\nskinparam defaultFontColor #1a4a1a`,
				cyber: `skinparam backgroundColor #0a0a0f`,
			};
			return configs[theme] || "";
		}
		case "mermaid": {
			// Return Mermaid theme config
			const configs: Record<string, object> = {
				default: { theme: "default" },
				light: { theme: "base", themeCSS: "background: #fafafa; color: #333;" },
				dark: { theme: "dark" },
				ocean: { theme: "base", themeCSS: "background: #e6f3ff; color: #003366;" },
				forest: { theme: "forest" },
			};
			return configs[theme] || { theme: "default" };
		}
		default:
			return null;
	}
}

// =============================================================================
// Zoom and Pan
// =============================================================================

/**
 * Calculate zoom transform
 */
export function calculateZoom(
	currentScale: number,
	delta: number,
	minScale: number = 0.25,
	maxScale: number = 4
): number {
	const newScale = currentScale * (1 + delta * 0.1);
	return Math.max(minScale, Math.min(maxScale, newScale));
}

/**
 * Calculate pan transform
 */
export function calculatePan(
	currentTransform: ViewTransform,
	deltaX: number,
	deltaY: number
): ViewTransform {
	return {
		scale: currentTransform.scale,
		translateX: currentTransform.translateX + deltaX,
		translateY: currentTransform.translateY + deltaY,
	};
}

/**
 * Convert transform to CSS string
 */
export function transformToCss(transform: ViewTransform): string {
	return `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`;
}

/**
 * Default view transform
 */
export function getDefaultViewTransform(): ViewTransform {
	return {
		scale: 1,
		translateX: 0,
		translateY: 0,
	};
}

/**
 * Reset zoom to fit container
 */
export function fitToContainer(
	diagramWidth: number,
	diagramHeight: number,
	containerWidth: number,
	containerHeight: number,
	padding: number = 40
): ViewTransform {
	const availableWidth = containerWidth - padding * 2;
	const availableHeight = containerHeight - padding * 2;
	
	const scaleX = availableWidth / diagramWidth;
	const scaleY = availableHeight / diagramHeight;
	const scale = Math.min(scaleX, scaleY, 1); // Don't upscale beyond 1:1
	
	const centeredX = (containerWidth - diagramWidth * scale) / 2;
	const centeredY = (containerHeight - diagramHeight * scale) / 2;
	
	return {
		scale,
		translateX: centeredX,
		translateY: centeredY,
	};
}

// =============================================================================
// Export Utilities
// =============================================================================

/**
 * Download diagram as a file
 */
export function downloadDiagram(content: string | Blob, filename: string) {
	const blob = content instanceof Blob ? content : new Blob([content], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	
	URL.revokeObjectURL(url);
	document.body.removeChild(link);
}

/**
 * Copy diagram code to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get file extension for export format
 */
export function getExportExtension(format: DiagramFormat, type: "svg" | "png" | "txt" | "d2" | "puml" | "dsl"): string {
	const extensions: Record<string, string> = {
		svg: ".svg",
		png: ".png",
		txt: ".txt",
		d2: ".d2",
		puml: ".puml",
		dsl: ".dsl",
	};
	return extensions[type] || ".txt";
}

// =============================================================================
// Stats and Analysis
// =============================================================================

/**
 * Get diagram statistics
 */
export function getDiagramStats(
	code: string,
	format: DiagramFormat
): {
	lineCount: number;
	charCount: number;
	elementCount?: number;
	relationshipCount?: number;
} {
	const lines = code.split("\n").filter((l) => l.trim());
	const parsed = parseDiagram(code, format);

	let elementCount = 0;
	let relationshipCount = 0;

	if (parsed.success && parsed.data) {
		if ("elements" in parsed.data) {
			elementCount = parsed.data.elements.length;
			relationshipCount = parsed.data.relationships.length;
		} else if ("model" in parsed.data) {
			const model = parsed.data.model as {
				people: unknown[];
				softwareSystems: unknown[];
				containers: unknown[];
				components: unknown[];
				relationships: unknown[];
			};
			elementCount =
				model.people.length +
				model.softwareSystems.length +
				model.containers.length +
				model.components.length;
			relationshipCount = model.relationships.length;
		} else if ("objects" in parsed.data) {
			elementCount = parsed.data.objects.length;
			relationshipCount = parsed.data.connections.length;
		}
	}
	
	return {
		lineCount: lines.length,
		charCount: code.length,
		elementCount,
		relationshipCount,
	};
}
