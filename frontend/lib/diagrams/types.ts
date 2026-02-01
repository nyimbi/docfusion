/**
 * Diagram Types - DocFusion
 *
 * Type definitions for PlantUML, Structurizr DSL, and D2 diagram formats.
 * Provides comprehensive type safety for diagram operations.
 */

/**
 * Supported diagram format types
 */
export type DiagramFormat = "plantuml" | "structurizr" | "d2" | "mermaid";

/**
 * PlantUML diagram types
 */
export type PlantUmlDiagramType =
	| "sequence" // Sequence diagrams
	| "class" // Class diagrams
	| "component" // Component diagrams
	| "activity" // Activity diagrams
	| "state" // State diagrams
	| "usecase" // Use case diagrams
	| "er" // Entity relationship diagrams
	| "gantt" // Gantt charts
	| "mindmap" // Mind maps
	| "object" // Object diagrams
	| "deployment" // Deployment diagrams
	| "timing" // Timing diagrams
	| "network" // Network diagrams
	| "wireframe" // Wireframe diagrams (salt)
	| "wbs"; // Work breakdown structure

/**
 * Structurizr/C4 diagram types
 */
export type StructurizrDiagramType =
	| "systemContext" // System Context (C4 Level 1)
	| "container" // Container (C4 Level 2)
	| "component" // Component (C4 Level 3)
	| "code" // Code/Class (C4 Level 4)
	| "dynamic" // Dynamic/Runtime
	| "deployment" // Deployment
	| "landscape"; // System Landscape

/**
 * D2 diagram layout types
 */
export type D2LayoutType =
	| "dagre" // Default directed graph layout
	| "elk" // Eclipse Layout Kernel
	| "tala"; // Custom layout engine

/**
 * Theme variants for diagrams
 */
export type DiagramTheme = "default" | "dark" | "light" | "forest" | "ocean" | "cyber";

/**
 * Export format options
 */
export type ExportFormat = "svg" | "png" | "pdf" | "txt";

/**
 * Validation error for diagram syntax
 */
export interface DiagramValidationError {
	line: number;
	column: number;
	message: string;
	suggestion?: string;
}

/**
 * Template definition for quick diagram creation
 */
export interface DiagramTemplate {
	id: string;
	name: string;
	description: string;
	format: DiagramFormat;
	type: PlantUmlDiagramType | StructurizrDiagramType | D2LayoutType;
	code: string;
	tags: string[];
}

/**
 * Zoom/pan state for diagram preview
 */
export interface ViewTransform {
	scale: number;
	translateX: number;
	translateY: number;
}

/**
 * Metadata for a diagram
 */
export interface DiagramMetadata {
	id: string;
	name: string;
	format: DiagramFormat;
	createdAt: Date;
	updatedAt: Date;
	tags: string[];
	parentId?: string; // For versioning
}

// =============================================================================
// PlantUML Specific Types
// =============================================================================

/**
 * PlantUML element types
 */
export type PlantUmlElementType =
	| "participant"
	| "actor"
	| "boundary"
	| "control"
	| "entity"
	| "database"
	| "collections"
	| "queue"
	| "class"
	| "interface"
	| "abstract"
	| "enum"
	| "component"
	| "package"
	| "node"
	| "folder"
	| "frame"
	| "cloud"
	| "card"
	| "usecase"
	| "state"
	| "note"
	| "group";

/**
 * PlantUML arrow directions
 */
export type PlantUmlArrowDirection =
	| "->"
	| "-->"
	| "->>"
	| "-->>"
	| "- ->"
	| "--->"
	| "->x"
	| "--x"
	| "-x"
	| "--x"
	| "<->"
	| "<-->"
	| "o->"
	| "o-->"
	| "->o"
	| "-->o"
	| "<|-"
	| "<|--"
	| "-|>"
	| "--|>";

/**
 * Parsed PlantUML element
 */
export interface PlantUmlElement {
	id: string;
	name: string;
	type: PlantUmlElementType;
	alias?: string;
	stereotype?: string;
	color?: string;
	url?: string;
	note?: string;
	children?: PlantUmlElement[];
	lineNumber: number;
}

/**
 * Parsed PlantUML relationship
 */
export interface PlantUmlRelationship {
	from: string;
	to: string;
	direction: PlantUmlArrowDirection;
	label?: string;
	color?: string;
	style?: "dashed" | "dotted" | "bold" | "hidden";
	lineNumber: number;
}

/**
 * Complete parsed PlantUML diagram
 */
export interface ParsedPlantUmlDiagram {
	type: PlantUmlDiagramType;
	title?: string;
	header?: string;
	footer?: string;
	skinParams: Record<string, string>;
	elements: PlantUmlElement[];
	relationships: PlantUmlRelationship[];
	note?: string;
	groups: Array<{
		name: string;
		elements: string[];
	}>;
}

// =============================================================================
// Structurizr Specific Types
// =============================================================================

/**
 * C4 model element types
 */
export type C4ElementType =
	| "person"
	| "softwareSystem"
	| "container"
	| "component"
	| "deploymentNode"
	| "infrastructureNode"
	| "softwareSystemInstance"
	| "containerInstance";

/**
 * Technology definitions for containers
 */
export type ContainerTechnology =
	| "java"
	| "spring"
	| "springBoot"
	| "node"
	| "express"
	| "react"
	| "angular"
	| "vue"
	| "database"
	| "postgresql"
	| "mysql"
	| "mongodb"
	| "redis"
	| "kafka"
	| "rabbitmq"
	| "docker"
	| "kubernetes"
	| "aws"
	| "azure"
	| "gcp";

/**
 * Structurizr model element
 */
export interface C4Element {
	id: string;
	name: string;
	type: C4ElementType;
	description?: string;
	technology?: string;
	tags?: string[];
	url?: string;
	properties?: Record<string, string>;
	children?: C4Element[];
	lineNumber: number;
}

/**
 * C4 relationship
 */
export interface C4Relationship {
	sourceId: string;
	targetId: string;
	description?: string;
	technology?: string;
	tags?: string[];
	lineNumber: number;
}

/**
 * Structurizr view definition
 */
export interface C4View {
	type: StructurizrDiagramType;
	key: string;
	softwareSystemId?: string;
	containerId?: string;
	componentId?: string;
	elementIds: string[];
	relationshipIds: string[];
	title?: string;
	description?: string;
	lineNumber: number;
}

/**
 * Complete parsed Structurizr workspace
 */
export interface ParsedStructurizrWorkspace {
	id: string;
	name: string;
	description?: string;
	model: {
		people: C4Element[];
		softwareSystems: C4Element[];
		containers: C4Element[];
		components: C4Element[];
		deploymentNodes: C4Element[];
		relationships: C4Relationship[];
	};
	views: C4View[];
}

// =============================================================================
// D2 Specific Types
// =============================================================================

/**
 * D2 shape types
 */
export type D2ShapeType =
	| "rectangle"
	| "square"
	| "circle"
	| "oval"
	| "cylinder"
	| "database"
	| "page"
	| "document"
	| "cloud"
	| "queue"
	| "package"
	| "class"
	| "step"
	| "diamond"
	| "hexagon"
	| "parallelogram"
	| "person"
	| "stored_data"
	| "callout"
	| "text"
	| "image"
	| "sequence_diagram"
	| "sql_table"
	| "markdown";

/**
 * D2 arrow heads
 */
export type D2ArrowHead = "arrow" | "triangle" | "circle" | "diamond" | "line";

/**
 * D2 direction
 */
export type D2Direction = "up" | "down" | "right" | "left";

/**
 * Parsed D2 object
 */
export interface D2Object {
	id: string;
	label: string;
	shape: D2ShapeType;
	direction?: D2Direction;
	style?: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		strokeDash?: string;
		borderRadius?: number;
		fillPattern?: "dots" | "lines" | "none";
	};
	icon?: string;
	link?: string;
	tooltip?: string;
	children?: D2Object[];
	lineNumber: number;
}

/**
 * D2 connection
 */
export interface D2Connection {
	from: string;
	to: string;
	label?: string;
	style?: {
		stroke?: string;
		strokeWidth?: number;
		strokeDash?: string;
	};
	lineNumber: number;
}

/**
 * Complete parsed D2 diagram
 */
export interface ParsedD2Diagram {
	direction?: D2Direction;
	objects: D2Object[];
	connections: D2Connection[];
	classes?: Record<string, D2Object["style"] & { shape?: D2ShapeType }>;
}

// =============================================================================
// Editor State Types
// =============================================================================

/**
 * Editor mode for split view
 */
export type EditorMode = "split" | "code" | "preview";

/**
 * Auto-complete suggestion
 */
export interface AutoCompleteSuggestion {
	label: string;
	insertText: string;
	detail?: string;
	documentation?: string;
	kind: "keyword" | "snippet" | "property" | "value";
}

/**
 * Code snippet for quick insertion
 */
export interface CodeSnippet {
	name: string;
	prefix: string;
	body: string;
	description: string;
}

/**
 * Line decoration for syntax highlighting
 */
export interface LineDecoration {
	lineNumber: number;
	type: "error" | "warning" | "info";
	message: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * PlantUML rendering options
 */
export interface PlantUmlRenderOptions {
	format: "svg" | "png" | "txt";
	server?: string;
	theme?: string;
}

/**
 * Structurizr rendering options
 */
export interface StructurizrRenderOptions {
	format: "svg" | "png" | "json";
	view?: string; // Specific view to render
}

/**
 * D2 rendering options
 */
export interface D2RenderOptions {
	format: "svg" | "png";
	layout?: D2LayoutType;
	theme?: number; // D2 theme ID
	sketch?: boolean; // Hand-drawn style
}

/**
 * Render result
 */
export interface RenderResult {
	success: boolean;
	data?: string | Blob; // SVG string or binary data
	error?: string;
	warnings?: string[];
}

/**
 * Parse result
 */
export interface ParseResult<T> {
	success: boolean;
	data?: T;
	errors?: DiagramValidationError[];
	warnings?: DiagramValidationError[];
}
