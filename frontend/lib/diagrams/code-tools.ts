import type {
	DiagramFormat,
	ParsedD2Diagram,
	ParsedPlantUmlDiagram,
	ParsedStructurizrWorkspace,
	ParseResult,
} from "./types";
import {
	formatPlantUML,
	getPlantUmlSuggestions,
	parsePlantUML,
	PLANTUML_SNIPPETS,
	PLANTUML_TEMPLATES,
	validatePlantUML,
} from "./plantuml";
import {
	formatStructurizr,
	getStructurizrSuggestions,
	parseStructurizr,
	STRUCTURIZR_SNIPPETS,
	STRUCTURIZR_TEMPLATES,
	validateStructurizr,
} from "./structurizr";
import {
	D2_SNIPPETS,
	D2_TEMPLATES,
	formatD2,
	getD2Suggestions,
	parseD2,
	validateD2,
} from "./d2";

/**
 * Detect diagram format from code content.
 */
export function detectDiagramFormat(code: string): DiagramFormat {
	const trimmed = code.trim().toLowerCase();

	if (trimmed.match(/^@(start|end)(uml|mindmap|gantt|salt|wbs)/)) {
		return "plantuml";
	}

	if (trimmed.match(/^workspace\s*\{/)) {
		return "structurizr";
	}

	if (trimmed.match(/^direction:\s*(up|down|left|right)/)) {
		return "d2";
	}
	if (trimmed.match(/\w+:\s*[^->]+$/m)) {
		return "d2";
	}

	return "mermaid";
}

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
			return { success: true };
		default:
			return { success: false, errors: [{ line: 0, column: 0, message: "Unknown format" }] };
	}
}

export function formatDiagram(code: string, format: DiagramFormat): string {
	switch (format) {
		case "plantuml":
			return formatPlantUML(code);
		case "structurizr":
			return formatStructurizr(code);
		case "d2":
			return formatD2(code);
		case "mermaid":
		default:
			return code;
	}
}

export function validateDiagram(code: string, format: DiagramFormat) {
	switch (format) {
		case "plantuml":
			return validatePlantUML(code);
		case "structurizr":
			return validateStructurizr(code);
		case "d2":
			return validateD2(code);
		case "mermaid":
		default:
			return [];
	}
}

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
		default:
			return [];
	}
}

export function getDiagramTemplates(format: DiagramFormat) {
	switch (format) {
		case "plantuml":
			return PLANTUML_TEMPLATES;
		case "structurizr":
			return STRUCTURIZR_TEMPLATES;
		case "d2":
			return D2_TEMPLATES;
		case "mermaid":
		default:
			return [];
	}
}

export function getDiagramSnippets(format: DiagramFormat) {
	switch (format) {
		case "plantuml":
			return PLANTUML_SNIPPETS;
		case "structurizr":
			return STRUCTURIZR_SNIPPETS;
		case "d2":
			return D2_SNIPPETS;
		case "mermaid":
		default:
			return [];
	}
}

export function getDiagramStats(
	code: string,
	format: DiagramFormat
): {
	lineCount: number;
	charCount: number;
	elementCount?: number;
	relationshipCount?: number;
} {
	const lines = code.split("\n").filter((line) => line.trim());
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
