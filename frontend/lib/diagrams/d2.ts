/**
 * D2 Diagram Support - DocFusion
 *
 * Support for D2 (Declarative Diagramming) format.
 * D2 is a modern text-to-diagram language with powerful layout and styling.
 */

import type {
	AutoCompleteSuggestion,
	CodeSnippet,
	D2Connection,
	D2Direction,
	D2Object,
	D2RenderOptions,
	D2ShapeType,
	DiagramTemplate,
	DiagramValidationError,
	ParsedD2Diagram,
	RenderResult,
} from "./types";

// =============================================================================
// Syntax Definitions
// =============================================================================

/**
 * D2 keywords
 */
export const D2_KEYWORDS = [
	"direction",
	"shape",
	"style",
	"label",
	"link",
	"tooltip",
	"icon",
	"width",
	"height",
	"grid-rows",
	"grid-columns",
	"grid-gap",
	"constraint",
	"near",
	"sql_table",
	"sql_primary_key",
	"sql_foreign_key",
	"sql_index",
	"sql_unique",
	"sql_not_null",
	"classes",
	"vars",
	"layers",
	"scenarios",
	"steps",
	"import",
];

/**
 * D2 shape types
 */
export const D2_SHAPE_TYPES: D2ShapeType[] = [
	"rectangle",
	"square",
	"circle",
	"oval",
	"cylinder",
	"database",
	"page",
	"document",
	"cloud",
	"queue",
	"package",
	"class",
	"step",
	"diamond",
	"hexagon",
	"parallelogram",
	"person",
	"stored_data",
	"callout",
	"text",
	"image",
	"sequence_diagram",
	"sql_table",
	"markdown",
];

/**
 * D2 directions
 */
export const D2_DIRECTIONS: D2Direction[] = ["up", "down", "right", "left"];

/**
 * D2 arrow head types
 */
export const D2_ARROW_HEADS = ["arrow", "triangle", "circle", "diamond", "line"];

/**
 * D2 fill patterns
 */
export const D2_FILL_PATTERNS = ["dots", "lines", "none"];

// =============================================================================
// Code Snippets
// =============================================================================

/**
 * D2 code snippets
 */
export const D2_SNIPPETS: CodeSnippet[] = [
	{
		name: "Basic Flowchart",
		prefix: "dflow",
		body: `direction: right

start: Start
process: Process Data
condition: Valid {
	shape: diamond
}
end: End

start -> process
process -> condition
condition -> end: yes
condition -> process: no`,
		description: "Basic flowchart with conditional logic",
	},
	{
		name: "Architecture Diagram",
		prefix: "darch",
		body: `direction: down

client: Client App {
	shape: cloud
	label: Web Client
}

server: API Server {
	auth: Authentication Service
	api: Business Logic
	
	auth -> api
}

db: Database {
	shape: cylinder
	label: PostgreSQL
}

client -> server.auth: login
server.api -> db: CRUD`,
		description: "Simple 3-tier architecture",
	},
	{
		name: "Database Schema",
		prefix: "dschema",
		body: `users: Users {
	shape: sql_table
	aid: id int {constraint: primary_key}
	name: varchar
	email: varchar {constraint: unique}
	created_at: timestamp
}

documents: Documents {
	shape: sql_table
	id: int {constraint: primary_key}
	user_id: int {constraint: foreign_key}
	title: varchar
	content: text
	created_at: timestamp
}

users.id <-> documents.user_id: one-to-many`,
		description: "Database schema with SQL tables",
	},
	{
		name: "Class Diagram",
		prefix: "dclass",
		body: `User: {
	shape: class
	
	-id: number
	-name: string
	-email: string
	
	+login(): boolean
	+logout(): void
	+updateProfile(data: Profile): boolean
}

Document: {
	shape: class
	
	-id: number
	-title: string
	-content: string
	-authorId: number
	
	+publish(): boolean
	+update(data: Partial): boolean
	+delete(): boolean
}

User -> Document: creates >`,
		description: "Class diagram with attributes and methods",
	},
	{
		name: "Microservices",
		prefix: "dmicro",
		body: `direction: down

gateway: API Gateway {
	shape: package
	
	router: Router
	auth: Auth Middleware
}

services: Services {
	users: User Service
	docs: Document Service
	search: Search Service
}

data: Data Layer {
	userdb: User DB {
		shape: cylinder
	}
	docdb: Document DB {
		shape: cylinder
	}
	searchdb: Search Index {
		shape: cylinder
	}
}

gateway -> services.users

gateway -> services.docs

services.users -> data.userdb
services.docs -> data.docdb
services.search -> data.searchdb

services
users <-> services.search: sync`,
		description: "Microservices architecture",
	},
	{
		name: "Sequence Diagram",
		prefix: "dseq",
		body: `shape: sequence_diagram

Client
Server
Database

Client -> Server: POST /login
Server -> Database: Query user
Database -> Server: User found
Server -> Database: Validate password
Database -> Server: Valid
Server -> Client: Token + User data`,
		description: "Sequence diagram using sequence_diagram shape",
	},
	{
		name: "Containers",
		prefix: "dcontainer",
		body: `direction: down

web: Web App {
	shape: cloud
	style: {
		fill: lightcyan
		stroke: deepskyblue
	}
	label: |md
		## Frontend
		React / Vue
	|
}

api: API Cluster {
	auth: Auth Pod
	app: App Pod
	worker: Worker Pod
	
	style: {
		fill: lightyellow
		stroke: gold
	}
}

db: Database {
	primary: Primary {
		shape: cylinder
		style: {
			fill: lightgreen
			stroke: green
		}
	}
	replica: Replica {
		shape: cylinder
		style: {
			fill: lightgreen
			stroke: green
		}
	}
}

web -> api
api -> db`,
		description: "Container diagram with nested shapes",
	},
	{
		name: "Decision Tree",
		prefix: "ddecision",
		body: `direction: down

start: Start Process {
	shape: circle
	style.fill: lightgreen
}

valid: Input Valid {
	shape: diamond
}

process: Process Data
error: Show Error {
	shape: rectangle
	style: {
		fill: lightcoral
	}
}

end: Complete {
	shape: circle
	style.fill: lightgreen
}

start -> valid
valid -> process: Yes
valid -> error: No
process -> end
error -> start: Retry`,
		description: "Decision tree flowchart",
	},
];

// =============================================================================
// Templates
// =============================================================================

/**
 * D2 template library
 */
export const D2_TEMPLATES: DiagramTemplate[] = [
	{
		id: "d2-c4",
		name: "C4 Model (D2)",
		description: "C4 architectural diagrams in D2",
		format: "d2",
		type: "dagre",
		code: `# C4 Architecture

# Level 1: System Context

User: {
	shape: person
	style: {
		fill: lightblue
	}
}

App: {
	shape: rectangle
	label: |md
		# Application
		System Application
	|
	style: {
		fill: lightgreen
	}
}

External: {
	shape: rectangle
	label: |md
		# External System
		Third-party service
	|
	style: {
		fill: lightyellow
	}
}

User -> App: Uses
App -> External: Calls API`,
		tags: ["c4", "architecture", "system-context"],
	},
	{
		id: "d2-event-driven",
		name: "Event-Driven Architecture",
		description: "Event-driven microservices",
		format: "d2",
		type: "dagre",
		code: `direction: down

# Event Source
producer: Event Producer {
	shape: package
	style.fill: lightblue
}

# Message Bus
bus: Message Bus {
	shape: queue
	style: {
		fill: lightyellow
	}
}

# Event Consumers
consumers: Consumers {
	analytics: Analytics Service {
		shape: rectangle
		style.fill: lightgreen
	}
	
	notifications: Notification Service {
		shape: rectangle
		style.fill: lightcoral
	}
	
	indexing: Search Indexing {
		shape: rectangle
		style.fill: plum
	}
}

# Data Stores
stores: Data Stores {
	analytics_db: Analytics Store {
		shape: cylinder
		style.fill: lightgreen
	}
	
	notification_db: Notification DB {
		shape: cylinder
		style.fill: lightcoral
	}
	
	search_index: Search Index {
		shape: cylinder
		style.fill: plum
	}
}

producer -> bus: Publish event
bus -> consumers.analytics: Subscribe
bus -> consumers.notifications: Subscribe
bus -> consumers.indexing: Subscribe

consumers.analytics -> stores.analytics_db: Store
consumers.notifications -> stores.notification_db: Store
consumers.indexing -> stores.search_index: Index`,
		tags: ["event-driven", "microservices", "kafka"],
	},
	{
		id: "d2-devops",
		name: "DevOps Pipeline",
		description: "CI/CD pipeline visualization",
		format: "d2",
		type: "dagre",
		code: `direction: right

# Pipeline
vcs: Source Code {
	shape: rectangle
	style.fill: lightblue
}

build: Build & Test {
	shape: rectangle
	style.fill: lightyellow
}

artifacts: Store Artifacts {
	shape: cylinder
	style.fill: lightgreen
}

staging: Staging Deploy {
	shape: rectangle
	style.fill: lightcoral
}

prod: Production Deploy {
	shape: rectangle
	style.fill: lightgreen
}

# Flow
vcs -> build: Push triggers
build -> artifacts: On success
artifacts -> staging: Deploy
staging -> prod: Promote

# Feedback
prod -> vcs: Monitor & Alert`,
		tags: ["devops", "cicd", "pipeline"],
	},
];

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse D2 code to extract structure
 */
export function parseD2(code: string): {
	parsed: ParsedD2Diagram | null;
	errors: DiagramValidationError[];
} {
	const errors: DiagramValidationError[] = [];
	const lines = code.split("\n");
	
	const objects: D2Object[] = [];
	const connections: D2Connection[] = [];
	const classes: Record<string, Record<string, unknown>> = {};
	
	let direction: D2Direction | undefined;
	let currentObject: D2Object | null = null;
	let inStyleBlock = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		
		// Skip comments and empty lines
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
		
		// Extract direction
		const dirMatch = trimmed.match(/^direction:\s*(up|down|left|right)$/);
		if (dirMatch) {
			direction = dirMatch[1] as D2Direction;
			continue;
		}
		
		// Parse classes
		if (trimmed.startsWith("classes:")) {
			// Classes definition starts
			continue;
		}
		
		// Parse object definitions
		// Match: id: Label { attributes }
		const objMatch = trimmed.match(/^(\w+):\s*(?!.*->)(.+?)(?:\s*\{)?$/);
		if (objMatch && !trimmed.includes("->")) {
			const object: D2Object = {
				id: objMatch[1],
				label: objMatch[2].trim().replace(/^\|?\w+\||"|'|\{/g, "").trim(),
				shape: detectShape(objMatch[2]),
				lineNumber: i + 1,
			};
			
			// Check for SQL table fields
			if (trimmed.includes("sql_table") || object.shape === "sql_table") {
				object.shape = "sql_table";
				object.children = [];
			}
			
			objects.push(object);
			currentObject = object;
			continue;
		}
		
		// Parse connection
		const connMatch = trimmed.match(/^(\w+)\s*(-[-.>]?|<[-.]?-|->)\s*(\w+)(?::\s*(.+))?$/);
		if (connMatch) {
			const connection: D2Connection = {
				from: connMatch[1],
				to: connMatch[3],
				label: connMatch[4]?.trim(),
				lineNumber: i + 1,
			};
			connections.push(connection);
			continue;
		}
		
		// Check for style block start
		if (trimmed === "style: {" || trimmed === "style.") {
			inStyleBlock = true;
			continue;
		}
		
		// Check for style block end
		if (trimmed === "}") {
			inStyleBlock = false;
			continue;
		}

		// Parse style attributes
		if (inStyleBlock && currentObject) {
			const styleMatch = trimmed.match(/^(\w+):\s*(.+)$/);
			if (styleMatch) {
				if (!currentObject.style) currentObject.style = {};
				const key = styleMatch[1];
				// Use type assertion for dynamic style key assignment
				(currentObject.style as Record<string, unknown>)[key] = styleMatch[2];
			}
		}
	}
	
	return {
		parsed: {
			direction,
			objects,
			connections,
			classes,
		},
		errors,
	};
}

/**
 * Detect shape type from label
 */
function detectShape(label: string): D2ShapeType {
	if (label.includes("shape: sql_table")) return "sql_table";
	if (label.includes("shape: class")) return "class";
	if (label.includes("shape: cylinder")) return "cylinder";
	if (label.includes("shape: database")) return "database";
	if (label.includes("shape: cloud")) return "cloud";
	if (label.includes("shape: queue")) return "queue";
	if (label.includes("shape: person")) return "person";
	if (label.includes("shape: diamond")) return "diamond";
	if (label.includes("shape: circle")) return "circle";
	if (label.includes("shape: package")) return "package";
	if (label.includes("shape: sequence_diagram")) return "sequence_diagram";
	return "rectangle";
}

// =============================================================================
// Code Generation
// =============================================================================

/**
 * Generate D2 code from parsed diagram
 */
export function generateD2Code(parsed: ParsedD2Diagram): string {
	const lines: string[] = [];
	
	// Direction
	if (parsed.direction) {
		lines.push(`direction: ${parsed.direction}`);
		lines.push("");
	}
	
	// Objects
	for (const obj of parsed.objects) {
		let objLine = `${obj.id}: ${obj.label || obj.id}`;
		
		if (obj.shape && obj.shape !== "rectangle") {
			objLine += ` {
			shape: ${obj.shape}
		}`;
		}
		
		lines.push(objLine);
	}
	
	// Connections
	for (const conn of parsed.connections) {
		let connLine = `${conn.from} -> ${conn.to}`;
		if (conn.label) {
			connLine += `: ${conn.label}`;
		}
		lines.push(connLine);
	}
	
	return lines.join("\n");
}

// =============================================================================
// Auto-complete
// =============================================================================

/**
 * Get auto-complete for D2
 */
export function getD2Suggestions(
	code: string,
	position: { line: number; column: number }
): AutoCompleteSuggestion[] {
	const lines = code.split("\n");
	const currentLine = lines[position.line] || "";
	const beforeCursor = currentLine.slice(0, position.column);
	
	const suggestions: AutoCompleteSuggestion[] = [];
	
	// Direction suggestions
	if (beforeCursor.match(/di/)) {
		suggestions.push(
			{ label: "direction: right", insertText: "direction: right", detail: "Left-to-right layout", kind: "keyword" },
			{ label: "direction: down", insertText: "direction: down", detail: "Top-to-bottom layout", kind: "keyword" },
			{ label: "direction: left", insertText: "direction: left", detail: "Right-to-left layout", kind: "keyword" },
			{ label: "direction: up", insertText: "direction: up", detail: "Bottom-to-top layout", kind: "keyword" }
		);
	}
	
	// Shape suggestions
	if (beforeCursor.match(/sh/)) {
		suggestions.push(
			{ label: "shape: rectangle", insertText: "shape: rectangle", detail: "Rectangle shape", kind: "value" },
			{ label: "shape: circle", insertText: "shape: circle", detail: "Circle shape", kind: "value" },
			{ label: "shape: cylinder", insertText: "shape: cylinder", detail: "Database cylinder", kind: "value" },
			{ label: "shape: cloud", insertText: "shape: cloud", detail: "Cloud shape", kind: "value" },
			{ label: "shape: person", insertText: "shape: person", detail: "Person avatar", kind: "value" },
			{ label: "shape: diamond", insertText: "shape: diamond", detail: "Decision diamond", kind: "value" },
			{ label: "shape: sql_table", insertText: "shape: sql_table", detail: "SQL table", kind: "value" },
			{ label: "shape: class", insertText: "shape: class", detail: "Class diagram box", kind: "value" },
			{ label: "shape: sequence_diagram", insertText: "shape: sequence_diagram", detail: "Sequence diagram", kind: "value" },
			{ label: "shape: package", insertText: "shape: package", detail: "Package container", kind: "value" },
			{ label: "shape: queue", insertText: "shape: queue", detail: "Queue shape", kind: "value" }
		);
	}
	
	// Style suggestions
	if (beforeCursor.match(/st/)) {
		suggestions.push(
			{ label: "style: {", insertText: "style: {\n\n}", detail: "Style block", kind: "keyword" },
			{ label: "fill: color", insertText: "fill: ", detail: "Fill color", kind: "property" },
			{ label: "stroke: color", insertText: "stroke: ", detail: "Stroke color", kind: "property" },
			{ label: "stroke-width: 2", insertText: "stroke-width: ", detail: "Stroke width", kind: "property" },
			{ label: "opacity: 0.5", insertText: "opacity: ", detail: "Node opacity", kind: "property" }
		);
	}
	
	// Constraint suggestions for SQL tables
	if (beforeCursor.includes("constraint")) {
		suggestions.push(
			{ label: "primary_key", insertText: "primary_key", detail: "Primary key constraint", kind: "value" },
			{ label: "foreign_key", insertText: "foreign_key", detail: "Foreign key constraint", kind: "value" },
			{ label: "unique", insertText: "unique", detail: "Unique constraint", kind: "value" },
			{ label: "not_null", insertText: "not_null", detail: "Not null constraint", kind: "value" }
		);
	}
	
	// Default keywords
	for (const keyword of D2_KEYWORDS) {
		suggestions.push({
			label: keyword,
			insertText: keyword + " ",
			kind: "keyword",
		});
	}
	
	return suggestions;
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format D2 code
 */
export function formatD2(code: string): string {
	const lines = code.split("\n");
	const formatted: string[] = [];
	let indentLevel = 0;
	const indent = "  ";
	
	for (let line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			formatted.push(trimmed);
			continue;
		}
		
		// Decrease indent for closing brace
		if (trimmed === "}") {
			indentLevel = Math.max(0, indentLevel - 1);
		}

		// Connection stays at current indent
		const isConnection = trimmed.includes("->");
		
		// Format connection arrows
		if (isConnection) {
			const formattedLine = trimmed.replace(/\s*->\s*/, " -> ").replace(/\s*:\s*/, ": ");
			formatted.push(indent.repeat(indentLevel) + formattedLine);
		} else {
			formatted.push(indent.repeat(indentLevel) + trimmed);
		}
		
		// Increase indent for opening brace
		if (trimmed.endsWith("{") && !trimmed.startsWith("//")) {
			indentLevel++;
		}
	}
	
	return formatted.join("\n").trimEnd();
}

// =============================================================================
// Rendering
// =============================================================================

/**
 * Render D2 diagram using D2 CLI or service
 */
export async function renderD2(
	code: string,
	options: D2RenderOptions
): Promise<RenderResult> {
	// D2 can be rendered using:
	// 1. D2 CLI (d2 -) for local rendering
	// 2. D2 Playground API
	// 3. Converting to SVG programmatically
	
	// For now, return error since we need CLI
	return {
		success: false,
		error: "D2 rendering requires D2 CLI to be installed locally",
	};
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate D2 code
 */
export function validateD2(code: string): DiagramValidationError[] {
	const errors: DiagramValidationError[] = [];
	const lines = code.split("\n");
	let braceDepth = 0;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
		
		braceDepth += (line.match(/{/g) || []).length;
		braceDepth -= (line.match(/}/g) || []).length;

		if (braceDepth < 0) {
			errors.push({
				line: i + 1,
				column: line.indexOf("}") + 1,
				message: "Unmatched closing brace",
			});
			braceDepth = 0;
		}
		
		// Check for invalid connection syntax
		if (line.includes("-") && line.includes(">")) {
			if (!line.match(/(\w+)\s*(-[-.>]?|->|--->|-\.-)\s*(\w+)/)) {
				errors.push({
					line: i + 1,
					column: 1,
					message: "Invalid connection syntax",
					suggestion: "Use 'id -> id: label' format",
				});
			}
		}
	}
	
	if (braceDepth > 0) {
		errors.push({
			line: lines.length,
			column: 1,
			message: `Unclosed braces (${braceDepth} remaining)`,
		});
	}
	
	return errors;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert D2 to Mermaid (for fallback rendering)
 */
export function d2ToMermaid(code: string): string {
	const { parsed } = parseD2(code);
	if (!parsed) return "";
	
	const lines: string[] = [];
	const direction = parsed.direction === "down" ? "TB" : parsed.direction === "up" ? "BT" : parsed.direction === "left" ? "RL" : "LR";
	lines.push(`flowchart ${direction}`);
	lines.push("");
	
	// Add nodes
	for (const obj of parsed.objects) {
		let shape = "[";
		let shapeEnd = "]";
		if (obj.shape === "circle") {
			shape = "((";
			shapeEnd = "))";
		} else if (obj.shape === "diamond") {
			shape = "{";
			shapeEnd = "}";
		} else if (obj.shape === "cylinder") {
			shape = "[(";
			shapeEnd = ")]";
		}
		lines.push(`    ${obj.id}${shape}${obj.label}${shapeEnd}`);
	}

	lines.push("");

	// Add connections
	for (const conn of parsed.connections) {
		const label = conn.label ? `|${conn.label}|` : "";
		lines.push(`    ${conn.from} -->${label} ${conn.to}`);
	}

	return lines.join("\n");
}