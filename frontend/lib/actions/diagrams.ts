/**
 * Diagram Server Actions - DocFusion
 *
 * Server-side actions for diagram processing:
 * - AI-powered diagram generation from descriptions
 * - Diagram conversion between formats
 * - Diagram storage and retrieval
 * - Batch operations
 */

"use server";

import type {
	DiagramFormat,
	DiagramTheme,
	DiagramTemplate,
	DiagramMetadata,
} from "../diagrams/types";
import { getCurrentUserId } from "@/lib/auth-utils";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// AI Diagram Generation Helper
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

/**
 * Call AI API to generate diagram code based on description
 */
async function callAIForDiagram(
	description: string,
	format: DiagramFormat,
	diagramType: string,
	context?: { documentType?: string; industry?: string; audience?: string }
): Promise<string> {
	const formatInstructions: Record<DiagramFormat, string> = {
		plantuml: `Generate PlantUML code. Start with @startuml and end with @enduml.`,
		structurizr: `Generate Structurizr DSL code for C4 diagrams. Use workspace, model, and views blocks.`,
		d2: `Generate D2 diagram code. Use simple arrow notation (->).`,
		mermaid: `Generate Mermaid diagram code. Start with the diagram type declaration.`,
	};

	const typePrompts: Record<string, string> = {
		sequence: "a sequence diagram showing interactions over time",
		class: "a class diagram showing classes and their relationships",
		component: "a component diagram showing system components",
		activity: "an activity/flowchart diagram showing process flow",
		state: "a state diagram showing state transitions",
		usecase: "a use case diagram showing actors and use cases",
		er: "an entity-relationship diagram for data modeling",
		mindmap: "a mind map for hierarchical information",
		container: "a C4 container diagram showing high-level technology",
		dynamic: "a dynamic diagram showing runtime behavior",
		flowchart: "a flowchart showing process steps",
	};

	const prompt = `Generate ${typePrompts[diagramType] || `a ${diagramType} diagram`} based on this description:

"${description}"

${context?.documentType ? `Context: This is for a ${context.documentType}.` : ""}
${context?.industry ? `Industry: ${context.industry}` : ""}
${context?.audience ? `Audience: ${context.audience}` : ""}

${formatInstructions[format]}

Output ONLY the diagram code, no explanations. Make sure it's syntactically correct.`;

	try {
		const response = await fetch(
			`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/v1/ai/completion`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [
						{ role: "system", content: "You are an expert diagram generator. Output only valid diagram code." },
						{ role: "user", content: prompt },
					],
					temperature: 0.5,
					maxTokens: 1500,
				}),
			}
		);

		if (!response.ok) {
			throw new Error("AI generation failed");
		}

		const data = await response.json();
		if (data.error) {
			throw new Error(data.error);
		}

		return data.content || "";
	} catch (error) {
		logger.error("AI diagram generation error:", error);
		// Return null to trigger fallback to templates
		return "";
	}
}

// ============================================================================
// Types
// ============================================================================

export interface GenerateDiagramInput {
	description: string;
	format?: DiagramFormat;
	type?: string;
	style?: "modern" | "minimal" | "detailed";
	context?: {
		documentType?: string;
		industry?: string;
		audience?: string;
	};
}

export interface GeneratedDiagram {
	id: string;
	code: string;
	format: DiagramFormat;
	type: string;
	title: string;
	description: string;
	explanation?: string;
}

export interface ConvertDiagramInput {
	code: string;
	fromFormat: DiagramFormat;
	toFormat: Exclude<DiagramFormat, "mermaid"> | "svg" | "png";
	theme?: DiagramTheme;
}

export interface ConvertDiagramOutput {
	success: boolean;
	code?: string;
	url?: string;
	error?: string;
}

export interface SaveDiagramInput {
	documentId: string;
	code: string;
	format: DiagramFormat;
	name: string;
	tags?: string[];
}

export interface SaveDiagramOutput {
	id: string;
	success: boolean;
}

// ============================================================================
// AI-Powered Diagram Generation
// ============================================================================

/**
 * Generate a diagram from natural language description using AI
 */
export async function generateDiagram(
	input: GenerateDiagramInput
): Promise<GeneratedDiagram> {
	await requireCurrentUserId();

	const {
		description,
		format = "plantuml",
		type = "flowchart",
		style = "modern",
		context,
	} = input;

	// Generate diagram based on format and type
	switch (format) {
		case "plantuml":
			return generatePlantUMLDiagram(description, type, style, context);
		case "structurizr":
			return generateStructurizrDiagram(description, type, style, context);
		case "d2":
			return generateD2Diagram(description, type, style, context);
		case "mermaid":
			return generateMermaidDiagram(description, type, style, context);
	}
}

/**
 * Generate PlantUML diagram from description
 */
async function generatePlantUMLDiagram(
	description: string,
	diagramType: string,
	style: string,
	context?: GenerateDiagramInput["context"]
): Promise<GeneratedDiagram> {
	const templates: Record<string, string> = {
		sequence: `@startuml
actor User
participant "Web Server" as Server
database "Database" as DB

User -> Server : Request
Server -> DB : Query
DB --> Server : Results
Server --> User : Response
@enduml`,

		class: `@startuml
class User {
	-id : UUID
	-email : String
	+login()
	+logout()
}

class Document {
	-id : UUID
	-title : String
	+publish()
	+update()
}

User -> Document : creates
@enduml`,

		component: `@startuml
[Web Application] as WebApp
[API Service] as API
[Database Service] as DB

WebApp -> API : HTTP/REST
API -> DB : SQL
@enduml`,

		activity: `@startuml
start
:Receive Request;
if (Valid?) then (yes)
	:Process Data;
	:Store Result;
else (no)
	:Log Error;
endif
:Return Response;
stop
@enduml`,

		state: `@startuml
[*] --> Idle
Idle --> Processing : Start
Processing --> Success : Complete
Processing --> Error : Fail
Success --> [*]
Error --> Idle : Retry
@enduml`,

		usecase: `@startuml
left to right direction
actor User
rectangle System {
	UC1 as "Create Document"
	UC2 as "Edit Document"
	UC3 as "Delete Document"
}
User --> UC1
User --> UC2
User --> UC3
@enduml`,

		er: `@startuml
erDiagram
	USER ||--o{ DOCUMENT : creates
	USER ||--o{ COMMENT : writes
	DOCUMENT ||--o{ VERSION : has
	
	USER {
		UUID id PK
		string email
		string name
	}
	
	DOCUMENT {
		UUID id PK
		UUID author_id FK
		string title
		text content
	}
@enduml`,

		gantt: `@startgantt
Project starts ${new Date().toISOString().split("T")[0]}
[Planning] lasts 5 days
[Development] lasts 15 days
[Testing] lasts 5 days
[Deployment] lasts 3 days

[Development] starts at [Planning]'s end
[Testing] starts at [Development]'s end
[Deployment] starts at [Testing]'s end
@endgantt`,

		mindmap: `@startmindmap
* ${context?.documentType || "System"}
** Core Features
*** Feature A
*** Feature B
** Technical
*** Architecture
*** Performance
** Users
*** End Users
*** Admins
@endmindmap`,
	};

	// Try AI generation first
	let code = await callAIForDiagram(description, "plantuml", diagramType, context);
	let isAIGenerated = !!code;

	// Fallback to templates if AI fails
	if (!code) {
		code =
			templates[diagramType] ||
			templates.flowchart ||
			`@startuml
[${description.slice(0, 30)}] as A
[Component B] as B
[Component C] as C

A -> B
B -> C
@enduml`;
	}

	return {
		id: `gen_${Date.now()}`,
		code,
		format: "plantuml",
		type: diagramType,
		title: `${isAIGenerated ? "AI-Generated" : "Template"} ${diagramType} Diagram`,
		description: `${isAIGenerated ? "AI-generated" : "Template-based"} ${diagramType} diagram based on: ${description.slice(0, 100)}`,
		explanation: `This diagram represents ${description}`,
	};
}

/**
 * Generate Structurizr DSL diagram from description
 */
async function generateStructurizrDiagram(
	description: string,
	diagramType: string,
	style: string,
	context?: GenerateDiagramInput["context"]
): Promise<GeneratedDiagram> {
	const type = diagramType;

	const baseCode = `workspace "System Architecture" "${description.slice(0, 50)}" {
	model {
		user = person "User" "End user of the system"
		
		softwareSystem = softwareSystem "Application" "${
			context?.documentType || "Application"
		}" {
			webApp = container "Web Application" "User interface" "React"
			api = container "API Gateway" "REST API" "Node.js"
			database = container "Database" "Data storage" "PostgreSQL"
			
			user -> webApp "Uses"
			webApp -> api "Calls API"
			api -> database "Reads/Writes"
		}
	}
	
	views {
		${type === "container" || type === "component" ? `container softwareSystem {
			title "Container Diagram"
			include *
			autolayout lr
		}` : type === "dynamic" ? `dynamic softwareSystem "UseCase" {
			title "Dynamic Diagram"
			description "${description.slice(0, 50)}"
			user -> webApp "1. Accesses"
			webApp -> api "2. Submits"
			api -> database "3. Stores"
			autolayout lr
		}` : `systemContext softwareSystem {
			title "System Context"
			include *
			autolayout lr
		}`}
	}
}`;

	// Try AI generation first
	let code = await callAIForDiagram(description, "structurizr", diagramType, context);
	let isAIGenerated = !!code;

	// Fallback to template if AI fails
	if (!code) {
		code = baseCode;
	}

	return {
		id: `gen_${Date.now()}`,
		code,
		format: "structurizr",
		type: diagramType,
		title: `${isAIGenerated ? "AI-Generated" : "Template"} C4 ${type} Diagram`,
		description: `${isAIGenerated ? "AI-generated" : "Template-based"} ${type} diagram based on: ${description.slice(0, 100)}`,
		explanation: `This C4 Model diagram uses a hierarchical approach to visualize the architecture of the system described.`,
	};
}

/**
 * Generate D2 diagram from description
 */
async function generateD2Diagram(
	description: string,
	diagramType: string,
	style: string,
	context?: GenerateDiagramInput["context"]
): Promise<GeneratedDiagram> {
	const code = `direction: ${
		diagramType === "flowchart" ? "down" : "right"
}

${diagramType === "flowchart" ? `:Decision Process {
  start: Start {
    shape: circle
    style.fill: lightgreen
  }
  
  process: ${context?.documentType || "Process"} {
    shape: rectangle
  }
  
  end: End {
    shape: circle
    style.fill: lightgreen
  }
  
  start -> process: begin
  process -> end: complete
}` : diagramType === "database" ? `:Database Schema {
  users: Users {
    shape: sql_table
    id: int {constraint: primary_key}
    name: varchar
    email: varchar {constraint: unique}
  }
  
  documents: Documents {
    shape: sql_table
    id: int {constraint: primary_key}
    user_id: int {constraint: foreign_key}
    title: varchar
    content: text
  }
  
  users.id <-> documents.user_id: one-to-many
}` : diagramType === "class" ? `:Class Diagram {
  User: {
    shape: class
    -id: number
    -name: string
    +login(): boolean
    +logout(): void
  }
  
  Document: {
    shape: class
    -id: number
    -title: string
    +publish(): boolean
  }
  
  User -> Document: creates
}` : `architecture: ${context?.documentType || "System Architecture"} {
  client: Frontend {
    shape: cloud
    style.fill: lightcyan
  }
  
  api: API Server {
    shape: rectangle
    style.fill: lightyellow
  }
  
  db: Database {
    shape: cylinder
    style.fill: lightgreen
  }
  
  client -> api: API calls
  api -> db: CRUD operations
}`}`;

	// Try AI generation first
	let finalCode = await callAIForDiagram(description, "d2", diagramType, context);
	let isAIGenerated = !!finalCode;

	// Fallback to template if AI fails
	if (!finalCode) {
		finalCode = code;
	}

	return {
		id: `gen_${Date.now()}`,
		code: finalCode,
		format: "d2",
		type: diagramType,
		title: `${isAIGenerated ? "AI-Generated" : "Template"} D2 ${diagramType} Diagram`,
		description: `${isAIGenerated ? "AI-generated" : "Template-based"} D2 diagram based on: ${description.slice(0, 100)}`,
		explanation: `This D2 diagram uses a declarative syntax for clear visualization.`,
	};
}

/**
 * Generate Mermaid diagram from description
 */
async function generateMermaidDiagram(
	description: string,
	diagramType: string,
	style: string,
	context?: GenerateDiagramInput["context"]
): Promise<GeneratedDiagram> {
	const templates: Record<string, string> = {
		flowchart: `flowchart TD
    A[Start] --> B{Process}
    B -->|Success| C[Done]
    B -->|Failure| D[Retry]
    D --> B`,

		sequence: `sequenceDiagram
    participant U as User
    participant W as Web App
    participant A as API
    participant D as Database
    
    U->>W: Action
    W->>A: Request
    A->>D: Query
    D-->>A: Result
    A-->>W: Response
    W-->>U: Display`,

		class: `classDiagram
    class User {
        -UUID id
        -String email
        +login()
        +logout()
    }
    class Document {
        -UUID id
        -String title
        +publish()
    }
    User "1" --> "0..*" Document : creates`,

		state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Active : Start
    Active --> Processing : Submit
    Processing --> Complete : Success
    Processing --> Error : Fail
    Complete --> [*]`,

		er: `erDiagram
    USER ||--o{ DOCUMENT : creates
    USER ||--o{ COMMENT : writes
    
    USER {
        UUID id PK
        string email
        string name
    }
    DOCUMENT {
        UUID id PK
        UUID author_id FK
        string title
    }`,

		mindmap: `mindmap
  root((System))
    Core
      Feature A
      Feature B
    Data
      Storage
      Processing
    Users
      End Users
      Admins`,
	};

	const templateCode =
		templates[diagramType] ||
		`flowchart TD
    A[${description.slice(0, 30)}] --> B[Process]
    B --> C[Complete]`;

	// Try AI generation first
	let code = await callAIForDiagram(description, "mermaid", diagramType, context);
	let isAIGenerated = !!code;

	// Fallback to template if AI fails
	if (!code) {
		code = templateCode;
	}

	return {
		id: `gen_${Date.now()}`,
		code,
		format: "mermaid",
		type: diagramType,
		title: `${isAIGenerated ? "AI-Generated" : "Template"} Mermaid ${diagramType} Diagram`,
		description: `${isAIGenerated ? "AI-generated" : "Template-based"} ${diagramType} diagram based on: ${description.slice(0, 100)}`,
		explanation: `This Mermaid diagram uses standard syntax.`,
	};
}

// ============================================================================
// Format Conversion
// ============================================================================

/**
 * Convert diagram between formats
 */
export async function convertDiagramFormat(
	input: ConvertDiagramInput
): Promise<ConvertDiagramOutput> {
	await requireCurrentUserId();

	const { code, fromFormat, toFormat } = input;

	try {
		// If converting to SVG or PNG for PlantUML
		if (fromFormat === "plantuml" && (toFormat === "svg" || toFormat === "png")) {
			const { encodePlantUML, DEFAULT_PLANTUML_SERVER } = await import(
				"../diagrams/plantuml"
			);
			const encoded = encodePlantUML(code);
			const url = `${DEFAULT_PLANTUML_SERVER}/${toFormat}/${encoded}`;

			return {
				success: true,
				url,
			};
		}

		// Convert to text format
		if (toFormat === "plantuml" || toFormat === "structurizr" || toFormat === "d2") {
			// Format conversion logic
			let convertedCode = code;

			// Add conversion logic here based on from/to formats
			if (fromFormat === "structurizr" && toFormat === "plantuml") {
				// Convert Structurizr to PlantUML
				const { structurizrToMermaid } = await import(
					"../diagrams/structurizr"
				);
				convertedCode = `@startuml
${structurizrToMermaid(code)}
@enduml`;
			}

			return {
				success: true,
				code: convertedCode,
			};
		}

		return {
			success: false,
			error: "Unsupported conversion",
		};
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Conversion failed",
		};
	}
}

// ============================================================================
// Batch Operations
// ============================================================================

export interface BatchProcessInput {
	diagrams: Array<{
		id: string;
		code: string;
		format: DiagramFormat;
	}>;
	operation: "format" | "validate" | "export";
	exportFormat?: "svg" | "png";
}

export interface BatchProcessOutput {
	results: Array<{
		id: string;
		success: boolean;
		result?: string;
		error?: string;
	}>;
	completed: number;
	failed: number;
}

/**
 * Process multiple diagrams in batch
 */
export async function batchProcessDiagrams(
	input: BatchProcessInput
): Promise<BatchProcessOutput> {
	await requireCurrentUserId();

	const { diagrams, operation, exportFormat } = input;

	const results = await Promise.all(
		diagrams.map(async (diagram) => {
			try {
				switch (operation) {
					case "format": {
						const { formatDiagram } = await import("../diagrams/code-tools");
						const formatted = formatDiagram(diagram.code, diagram.format);
						return {
							id: diagram.id,
							success: true,
							result: formatted,
						};
					}

					case "validate": {
						const { validateDiagram } = await import("../diagrams/code-tools");
						const errors = validateDiagram(diagram.code, diagram.format);
						return {
							id: diagram.id,
							success: errors.length === 0,
							result:
								errors.length > 0
									? errors.map((e) => e.message).join("\n")
									: "Valid",
						};
					}

					case "export":
						if (exportFormat === "svg" || exportFormat === "png") {
							const { convertDiagramFormat } = await import("./diagrams");
							const result = await convertDiagramFormat({
								code: diagram.code,
								fromFormat: diagram.format,
								toFormat: exportFormat,
							});
							return {
								id: diagram.id,
								success: result.success,
								result: result.url || result.code,
								error: result.error,
							};
						}
						return {
							id: diagram.id,
							success: false,
							error: "No export format specified",
						};

					default:
						return {
							id: diagram.id,
							success: false,
							error: "Unknown operation",
						};
				}
			} catch (err) {
				return {
					id: diagram.id,
					success: false,
					error: err instanceof Error ? err.message : "Unknown error",
				};
			}
		})
	);

	return {
		results,
		completed: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
	};
}

// ============================================================================
// Analytics
// ============================================================================

export interface DiagramAnalytics {
	totalDiagrams: number;
	diagramsByFormat: Record<DiagramFormat, number>;
	diagramsByType: Record<string, number>;
	averageLength: number;
	mostUsedTemplates: string[];
	revisions: number;
}

/**
 * Get analytics for diagram usage
 * Returns empty statistics when no diagram data exists for the document.
 */
export async function getDiagramAnalytics(
	documentId: string
): Promise<DiagramAnalytics> {
	await requireCurrentUserId();

	// Returns zero state - diagram analytics tracking can be added by creating
	// a diagram_analytics table that records diagram usage events
	return {
		totalDiagrams: 0,
		diagramsByFormat: { plantuml: 0, structurizr: 0, d2: 0, mermaid: 0 },
		diagramsByType: {},
		averageLength: 0,
		mostUsedTemplates: [],
		revisions: 0,
	};
}
