/**
 * Diagram Parsers and Templates - DocFusion
 *
 * Provides validation, syntax checking, and templates for
 * various diagram formats: Mermaid, PlantUML, D2, Structurizr.
 */

import type { DiagramType } from "@/components/document/DiagramInsertDialog";

// ============================================================================
// Diagram Templates
// ============================================================================

export interface DiagramTemplate {
	id: string;
	name: string;
	type: DiagramType | "all";
	description: string;
	content: string;
	tags: string[];
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
	// Mermaid Templates
	{
		id: "mermaid-flowchart",
		name: "Flowchart",
		type: "mermaid",
		description: "Basic flowchart with decision diamond",
		content: `flowchart TD
    Start([Start]) --> Check{Valid?}
    Check -->|Yes| Process[Process Data]
    Check -->|No| Error[Show Error]
    Process --> End([End])
    Error --> End`,
		tags: ["flowchart", "process", "decision"],
	},
	{
		id: "mermaid-sequence",
		name: "Sequence Diagram",
		type: "mermaid",
		description: "API authentication flow",
		content: `sequenceDiagram
    participant User
    participant API
    participant Auth
    participant DB
    
    User->>API: Request data
    API->>Auth: Validate token
    Auth-->>API: Token valid
    API->>DB: Query data
    DB-->>API: Return results
    API-->>User: Response`,
		tags: ["api", "auth", "sequence"],
	},
	{
		id: "mermaid-class",
		name: "Class Diagram",
		type: "mermaid",
		description: "Object-oriented class structure",
		content: `classDiagram
    class User {
        +String id
        +String name
        +String email
        +create()
        +update()
    }
    class Post {
        +String id
        +String title
        +String content
        +publish()
    }
    class Comment {
        +String id
        +String text
    }
    User "1" --> "*" Post : writes
    Post "1" --> "*" Comment : has`,
		tags: ["class", "oop", "structure"],
	},
	{
		id: "mermaid-er",
		name: "ER Diagram",
		type: "mermaid",
		description: "Entity relationship schema",
		content: `erDiagram
    USER ||--o{ POST : writes
    POST ||--o{ COMMENT : contains
    
    USER {
        uuid id
        string name
        string email
        datetime created_at
    }
    POST {
        uuid id
        string title
        text content
        uuid author_id
        datetime published_at
    }
    COMMENT {
        uuid id
        text content
        uuid post_id
        uuid author_id
    }`,
		tags: ["database", "schema", "erd"],
	},
	{
		id: "mermaid-state",
		name: "State Diagram",
		type: "mermaid",
		description: "State machine for document workflow",
		content: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review: Submit
    Review --> Approved: Approve
    Review --> Rejected: Reject
    Rejected --> Draft: Revise
    Approved --> Published: Publish
    Published --> Archived: Archive`,
		tags: ["state", "workflow", "status"],
	},
	{
		id: "mermaid-gantt",
		name: "Gantt Chart",
		type: "mermaid",
		description: "Project timeline",
		content: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Planning
    Requirements    :a1, 2024-01-01, 7d
    Design          :a2, after a1, 5d
    section Development
    Implementation  :a3, after a2, 14d
    Testing         :a4, after a3, 7d
    section Deployment
    Release         :a5, after a4, 3d`,
		tags: ["planning", "timeline", "project"],
	},

	// PlantUML Templates
	{
		id: "plantuml-class",
		name: "Class Diagram",
		type: "plantuml",
		description: "Object-oriented structure",
		content: `@startuml
class User {
  - id: String
  - name: String
  - email: String
  + create(): void
  + update(): void
}

class Document {
  - id: String
  - title: String
  + publish(): void
}

User "1" --> "*" Document : creates
@enduml`,
		tags: ["class", "oop"],
	},
	{
		id: "plantuml-usecase",
		name: "Use Case Diagram",
		type: "plantuml",
		description: "System use cases",
		content: `@startuml
left to right direction
actor "User" as U
actor "Admin" as A

rectangle System {
  usecase "Create Document" as UC1
  usecase "Edit Document" as UC2
  usecase "Delete Document" as UC3
  usecase "Approve Document" as UC4
}

U --> UC1
U --> UC2
A --> UC3
A --> UC4
@enduml`,
		tags: ["usecase", "actors"],
	},
	{
		id: "plantuml-component",
		name: "Component Diagram",
		type: "plantuml",
		description: "System components",
		content: `@startuml
[Web Client] as Web
[API Server] as API
[Auth Service] as Auth
[Database] as DB
[File Storage] as Storage

Web --> API : HTTP/JSON
API --> Auth : Validate
API --> DB : Query
API --> Storage : Files
@enduml`,
		tags: ["component", "architecture"],
	},

	// D2 Templates
	{
		id: "d2-system",
		name: "System Architecture",
		type: "d2",
		description: "High-level system view",
		content: `direction: right

web: Web Application {
  shape: cloud
}

api: API Gateway {
  shape: circle
}

services: Microservices {
  auth: Auth Service
  docs: Document Service
  user: User Service
}

db: Databases {
  postgres: PostgreSQL
  redis: Redis
  storage: File Storage
}

web -> api
api -> services.auth
api -> services.docs
api -> services.user
services.docs -> db.postgres
services.auth -> db.redis
services.docs -> db.storage`,
		tags: ["architecture", "microservices"],
	},
	{
		id: "d2-dataflow",
		name: "Data Flow",
		type: "d2",
		description: "Data processing pipeline",
		content: `direction: down

input: Raw Data {
  shape: cylinder
}

processor: Data Processor {
  validator: Validator
  transformer: Transformer
}

output: Clean Data {
  shape: cylinder
}

input -> processor.validator: validate
processor.validator -> processor.transformer
processor.transformer -> output: store`,
		tags: ["data", "pipeline"],
	},

	// Structurizr Templates
	{
		id: "structurizr-context",
		name: "System Context",
		type: "structurizr",
		description: "C4 Level 1 - Context",
		content: `workspace {
    description "System Context for Document Management"
    !adrs adrs
    !docs docs
    
    model {
        user = person "User" "Creates and manages documents"
        editor = person "Editor" "Reviews and approves documents"
        docSystem = softwareSystem "Document Management System" "Allows users to create, edit, and publish documents" {
            tags "System"
        }
        emailSystem = softwareSystem "Email System" "Sends notifications"
        
        user -> docSystem "Creates documents"
        user -> docSystem "Views documents"
        editor -> docSystem "Reviews documents"
        docSystem -> emailSystem "Sends emails"
    }
    
    views {
        systemContext docSystem {
            include *
            autolayout lr
        }
        
        styles {
            element "Person" {
                background #085bb5
                color #ffffff
            }
            element "System" {
                background #1168bd
                color #ffffff
            }
        }
    }
}`,
		tags: ["c4", "context", "level1"],
	},
	{
		id: "structurizr-container",
		name: "Container Diagram",
		type: "structurizr",
		description: "C4 Level 2 - Containers",
		content: `workspace {
    description "Container View"
    
    model {
        user = person "User"
        
        docSystem = softwareSystem "Document System" {
            webApp = container "Web App" "Next.js" "React 19" {
                tags "Web"
            }
            api = container "API" "Next.js API Routes" "TypeScript" {
                tags "API"
            }
            database = container "Database" "PostgreSQL" "Azure" {
                tags "DB"
            }
            cache = container "Cache" "Redis" "Sessions" {
                tags "Cache"
            }
            storage = container "Storage" "Azure Blob" "Files" {
                tags "Storage"
            }
        }
        
        user -> webApp "Uses"
        webApp -> api "Calls"
        api -> database "Reads/Writes"
        api -> cache "Cache"
        api -> storage "Files"
    }
    
    views {
        container docSystem {
            include *
            autolayout lr
        }
        
        styles {
            element "Web" {
                background #85bbf0
            }
            element "API" {
                background #438dd5
            }
            element "DB" {
                background #438dd5
            }
        }
    }
}`,
		tags: ["c4", "container", "level2"],
	},

	// Excalidraw is handled separately
	{
		id: "excalidraw-blank",
		name: "Blank Canvas",
		type: "excalidraw",
		description: "Start with blank canvas",
		content: "",
		tags: ["blank", "freehand"],
	},
];

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateMermaid(code: string): ValidationResult {
	if (!code.trim()) {
		return { valid: false, error: "Empty diagram" };
	}

	const validKeywords = [
		"flowchart",
		"graph",
		"sequenceDiagram",
		"classDiagram",
		"stateDiagram",
		"stateDiagram-v2",
		"erDiagram",
		"gantt",
		"pie",
		"journey",
		"gitGraph",
		"requirementDiagram",
	];

	const hasKeyword = validKeywords.some((kw) => code.includes(kw));
	if (!hasKeyword) {
		return { valid: false, error: "Missing valid diagram type keyword" };
	}

	return { valid: true };
}

export function validatePlantUML(code: string): ValidationResult {
	if (!code.trim()) {
		return { valid: false, error: "Empty diagram" };
	}

	if (!code.includes("@startuml")) {
		return { valid: false, error: "Missing @startuml directive" };
	}

	if (!code.includes("@enduml")) {
		return { valid: false, error: "Missing @enduml directive" };
	}

	return { valid: true };
}

export function validateD2(code: string): ValidationResult {
	if (!code.trim()) {
		return { valid: false, error: "Empty diagram" };
	}

	// Check for direction
	const hasDirection = /direction:\s*(up|down|left|right)/i.test(code);

	// Basic check for connections
	const hasConnections = code.includes("->");

	if (!hasConnections && !code.includes("shape:")) {
		return { valid: false, error: "No connections or shapes defined" };
	}

	// Check for balanced braces
	const openBraces = (code.match(/\{/g) || []).length;
	const closeBraces = (code.match(/\}/g) || []).length;
	if (openBraces !== closeBraces) {
		return { valid: false, error: "Unbalanced braces" };
	}

	return { valid: true };
}

export function validateStructurizr(code: string): ValidationResult {
	if (!code.trim()) {
		return { valid: false, error: "Empty workspace" };
	}

	if (!code.includes("workspace")) {
		return { valid: false, error: "No workspace defined" };
	}

	if (!code.includes("model") || !code.includes("views")) {
		return { valid: false, error: "Missing model or views section" };
	}

	return { valid: true };
}

// ============================================================================
// Template Selector Functions
// ============================================================================

export function getTemplates(
	type?: DiagramType | "all",
	tags?: string[],
): DiagramTemplate[] {
	let filtered = DIAGRAM_TEMPLATES;

	if (type && type !== "all") {
		filtered = filtered.filter(
			(t) => t.type === type || t.type === "all",
		);
	}

	if (tags && tags.length > 0) {
		filtered = filtered.filter((t) =>
			tags.some((tag) => t.tags.includes(tag)),
		);
	}

	return filtered;
}

export function getTemplateById(
	id: string,
): DiagramTemplate | undefined {
	return DIAGRAM_TEMPLATES.find((t) => t.id === id);
}

export function getAvailableTags(): string[] {
	const tags = new Set<string>();
	DIAGRAM_TEMPLATES.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
	return Array.from(tags).sort();
}
