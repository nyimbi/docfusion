/**
 * PlantUML Parser and Generator - DocFusion
 *
 * Comprehensive PlantUML support including:
 * - Syntax highlighting definitions
 * - Parser for diagram structure extraction
 * - Code generation utilities
 * - Auto-complete suggestions
 * - Snippets for common patterns
 *
 * Supported diagrams:
 * - Sequence, Class, Component, Activity
 * - State, Use Case, ERD, Gantt, Mind Map
 */

import type {
	AutoCompleteSuggestion,
	CodeSnippet,
	DiagramTemplate,
	DiagramTheme,
	DiagramValidationError,
	ParsedPlantUmlDiagram,
	PlantUmlArrowDirection,
	PlantUmlDiagramType,
	PlantUmlElement,
	PlantUmlElementType,
	PlantUmlRelationship,
	PlantUmlRenderOptions,
	RenderResult,
} from "./types";

// =============================================================================
// Keywords and Syntax Definitions
// =============================================================================

/**
 * PlantUML start/end directives for each diagram type
 */
export const PLANTUML_START_DIRECTIVES: Record<PlantUmlDiagramType, string[]> = {
	sequence: ["@startuml", "@enduml"],
	class: ["@startuml", "@enduml"],
	component: ["@startuml", "@enduml"],
	activity: ["@startuml", "@enduml"],
	state: ["@startuml", "@enduml"],
	usecase: ["@startuml", "@enduml"],
	er: ["@startuml", "@enduml"],
	gantt: ["@startgantt", "@endgantt"],
	mindmap: ["@startmindmap", "@endmindmap"],
	object: ["@startuml", "@enduml"],
	deployment: ["@startuml", "@enduml"],
	timing: ["@startuml", "@enduml"],
	network: ["@startuml", "@enduml"],
	wireframe: ["@startsalt", "@endsalt"],
	wbs: ["@startwbs", "@endwbs"],
};

/**
 * PlantUML keywords for syntax highlighting
 */
export const PLANTUML_KEYWORDS = [
	"@startuml",
	"@enduml",
	"@startmindmap",
	"@endmindmap",
	"@startgantt",
	"@endgantt",
	"@startsalt",
	"@endsalt",
	"@startwbs",
	"@endwbs",
	"title",
	"header",
	"footer",
	"skinparam",
	"skin",
	"top to bottom direction",
	"left to right direction",
	"scale",
	"autonumber",
	"activate",
	"deactivate",
	"destroy",
	"create",
	"return",
	"alt",
	"else",
	"opt",
	"loop",
	"par",
	"break",
	"critical",
	"group",
	"note",
	"rnote",
	"hnote",
	"left",
	"right",
	"over",
	"ref",
	"newpage",
	"package",
	"namespace",
	"together",
	"interface",
	"abstract",
	"class",
	"enum",
	"entity",
	"annotation",
	"struct",
	"part",
	"static",
	"abstract",
	"abstract class",
	"extends",
	"implements",
	"use",
	"composition",
	"aggregation",
	"association",
	"arrow",
	"up",
	"down",
	"left",
	"right",
	"if",
	"then",
	"elseif",
	"else",
	"endif",
	"while",
	"endwhile",
	"repeat",
	"endrepeat",
	"fork",
	"fork again",
	"merge",
	"switch",
	"case",
	"endswitch",
	"partition",
	"start",
	"stop",
	"end",
	"detach",
	"kill",
	"state",
	"state fork",
	"state join",
	"history",
	"deephistory",
	"[*]",
	"actor",
	"usecase",
	"rectangle",
	"card",
	"file",
	"stack",
	"	|",
	"node",
	"cloud",
	"database",
	"storage",
	"artifact",
	"component",
	"folder",
	"frame",
	"agent",
	"boundary",
	"control",
	"collections",
	"queue",
	"stack",
	"rectangle",
	"participant",
	"as",
	"..>",
	"--|>",
	"..|>",
	"<..",
	"<|--",
	"<..|",
	"o--",
	"--o",
	"*--",
	"--*",
	"x--",
	"--x",
	"#--",
	"--#",
	"+--",
	"--+",
	"^--",
	"--^",
	"<--",
	"-->",
	"..",
	"--",
	"->",
	"->x",
	"->>",
	"-\\",
	"\\--",
	"-\\}",
	"->o",
	"o->",
	"<->",
	"<->o",
	"o<->",
	"->c",
	"c->o",
	"<->>o",
];

/**
 * Preprocessor directives
 */
export const PLANTUML_PREPROCESSOR = [
	"!define",
	"!undef",
	"!ifdef",
	"!endif",
	"!ifndef",
	"!include",
	"!includeurl",
	"!import",
	"!theme",
	"!pragma",
	"%include",
];

/**
 * Skin parameters for styling
 */
export const PLANTUML_SKINPARAMS = [
	"backgroundColor",
	"handwritten",
	"monochrome",
	"monochromeReverse",
	"linetype",
	"dpi",
	"defaultFontSize",
	"defaultFontName",
	"shadowing",
	"maxMessageSize",
	"sequenceArrowThickness",
	"classAttributeIconSize",
	"classFontSize",
	"classFontStyle",
	"classHeaderBackgroundColor",
	"entityBackgroundColor",
	"entityBorderColor",
	"activityBackgroundColor",
	"activityBorderColor",
	"stateBackgroundColor",
	"stateBorderColor",
	"usecaseBackgroundColor",
	"usecaseBorderColor",
	"packageBackgroundColor",
	"packageBorderColor",
	"noteBackgroundColor",
	"noteBorderColor",
	"componentStyle",
	"svgLinkTarget",
	"topurl",
];

/**
 * Color definitions
 */
export const PLANTUML_COLORS = [
	"AliceBlue",
	"AntiqueWhite",
	"Aqua",
	"Aquamarine",
	"Azure",
	"Beige",
	"Bisque",
	"Black",
	"BlanchedAlmond",
	"Blue",
	"BlueViolet",
	"Brown",
	"BurlyWood",
	"CadetBlue",
	"Chartreuse",
	"Chocolate",
	"Coral",
	"CornflowerBlue",
	"Cornsilk",
	"Crimson",
	"Cyan",
	"DarkBlue",
	"DarkCyan",
	"DarkGoldenRod",
	"DarkGray",
	"DarkGreen",
	"DarkKhaki",
	"DarkMagenta",
	"DarkOliveGreen",
	"DarkOrange",
	"DarkOrchid",
	"DarkRed",
	"DarkSalmon",
	"DarkSeaGreen",
	"DarkSlateBlue",
	"DarkSlateGray",
	"DarkTurquoise",
	"DarkViolet",
	"DeepPink",
	"DeepSkyBlue",
	"DimGray",
	"DodgerBlue",
	"FireBrick",
	"FloralWhite",
	"ForestGreen",
	"Fuchsia",
	"Gainsboro",
	"GhostWhite",
	"Gold",
	"GoldenRod",
	"Gray",
	"Green",
	"GreenYellow",
	"HoneyDew",
	"HotPink",
	"IndianRed",
	"Indigo",
	"Ivory",
	"Khaki",
	"Lavender",
	"LavenderBlush",
	"LawnGreen",
	"LemonChiffon",
	"LightBlue",
	"LightCoral",
	"LightCyan",
	"LightGoldenRodYellow",
	"LightGray",
	"LightGreen",
	"LightPink",
	"LightSalmon",
	"LightSeaGreen",
	"LightSkyBlue",
	"LightSlateGray",
	"LightSteelBlue",
	"LightYellow",
	"Lime",
	"LimeGreen",
	"Linen",
	"Magenta",
	"Maroon",
	"MediumAquaMarine",
	"MediumBlue",
	"MediumOrchid",
	"MediumPurple",
	"MediumSeaGreen",
	"MediumSlateBlue",
	"MediumSpringGreen",
	"MediumTurquoise",
	"MediumVioletRed",
	"MidnightBlue",
	"MintCream",
	"MistyRose",
	"Moccasin",
	"NavajoWhite",
	"Navy",
	"OldLace",
	"Olive",
	"OliveDrab",
	"Orange",
	"OrangeRed",
	"Orchid",
	"PaleGoldenRod",
	"PaleGreen",
	"PaleTurquoise",
	"PaleVioletRed",
	"PapayaWhip",
	"PeachPuff",
	"Peru",
	"Pink",
	"Plum",
	"PowderBlue",
	"Purple",
	"RebeccaPurple",
	"Red",
	"RosyBrown",
	"RoyalBlue",
	"SaddleBrown",
	"Salmon",
	"SandyBrown",
	"SeaGreen",
	"SeaShell",
	"Sienna",
	"Silver",
	"SkyBlue",
	"SlateBlue",
	"SlateGray",
	"Snow",
	"SpringGreen",
	"SteelBlue",
	"Tan",
	"Teal",
	"Thistle",
	"Tomato",
	"Turquoise",
	"Violet",
	"Wheat",
	"White",
	"WhiteSmoke",
	"Yellow",
	"YellowGreen",
];

// =============================================================================
// Code Snippets
// =============================================================================

/**
 * PlantUML code snippets for quick insertion
 */
export const PLANTUML_SNIPPETS: CodeSnippet[] = [
	{
		name: "Basic Sequence Diagram",
		prefix: "pseq",
		body: `@startuml
actor User
participant "Frontend" as FE
participant "API" as API
database "Database" as DB

User -> FE : Action
FE -> API : Request data
API -> DB : Query
DB --> API : Results
API --> FE : Response
FE --> User : Display result
@enduml`,
		description: "Basic sequence diagram with actor, participants, and database",
	},
	{
		name: "Sequence with Alt/Else",
		prefix: "pseqalt",
		body: `@startuml
participant A
participant B

A -> B : Request
alt Success
	B --> A : Success response
else Failure
	B --> A : Error response
end
@enduml`,
		description: "Sequence diagram with alternative flow",
	},
	{
		name: "Sequence with Loop",
		prefix: "pseqloop",
		body: `@startuml
participant Client
participant Server

loop Until complete
	Client -> Server : Poll status
	Server --> Client : Status
end
Client -> Server : Acknowledge completion
@enduml`,
		description: "Sequence diagram with loop construct",
	},
	{
		name: "Basic Class Diagram",
		prefix: "pclass",
		body: `@startuml
class User {
	- id: UUID
	- email: String
	- name: String
	+ login(): boolean
	+ logout(): void
}

class Document {
	- id: UUID
	- title: String
	- content: String
	+ publish(): boolean
}

User "1" -- "0..*" Document : creates >
@enduml`,
		description: "Basic class diagram with attributes and methods",
	},
	{
		name: "Interface Implementation",
		prefix: "pinterface",
		body: `@startuml
interface Repository {
	+ findById(id: UUID): Entity
	+ save(entity: Entity): void
	+ delete(id: UUID): void
}

class JpaRepository implements Repository {
	- entityManager: EntityManager
}

class MongoRepository implements Repository {
	- mongoTemplate: MongoTemplate
}
@enduml`,
		description: "Class diagram showing interface implementations",
	},
	{
		name: "Component Diagram",
		prefix: "pcomp",
		body: `@startuml
skinparam componentStyle rectangle

title Component Diagram

package "Frontend" {
	[Web UI] as WebUI
	[Admin Portal] as Admin
}

package "Backend Services" {
	[Auth Service] as Auth
	[Document Service] as DocService
	[Search Service] as Search
}

database "PostgreSQL" as Postgres {
	[Documents]
	[Users]
}

WebUI ..> Auth : authenticate
WebUI ..> DocService : CRUD
Admin ..> Auth : manage
DocService --> Postgres : SQL
Search ..> Postgres : queries
@enduml`,
		description: "Component diagram with packages and relationships",
	},
	{
		name: "Activity Diagram",
		prefix: "pact",
		body: `@startuml
start
:Input received;
if (Valid?) then (yes)
	:Process data;
	:Save to database;
	if (Success?) then (yes)
		:Return success;
	else (no)
		:Log error;
		:Return error;
	endif
else (no)
	:Return validation error;
endif
stop
@enduml`,
		description: "Activity diagram with conditional flows",
	},
	{
		name: "State Diagram",
		prefix: "pstate",
		body: `@startuml
[*] --> Draft

state Draft {
	[*] --> Editing
	Editing --> Reviewing : Submit
}

state Reviewing {
	[*] --> UnderReview
	UnderReview --> Approved : Accept
	UnderReview --> Rejected : Reject
	Rejected --> Draft : Revise
}

Approved --> Published : Publish
Published --> [*]
@enduml`,
		description: "State diagram with nested states",
	},
	{
		name: "Use Case Diagram",
		prefix: "pusecase",
		body: `@startuml
left to right direction

actor "Admin" as Admin
actor "User" as User

rectangle System {
	usecase "Create Document" as UC1
	usecase "Edit Document" as UC2
	usecase "Delete Document" as UC3
	usecase "Manage Users" as UC4
	usecase "Generate Reports" as UC5
}

User --> UC1
User --> UC2
User --> UC3
Admin --> UC4
Admin --> UC5
@enduml`,
		description: "Use case diagram with actors",
	},
	{
		name: "Entity Relationship",
		prefix: "per",
		body: `@startuml
erDiagram
	DOCUMENT ||--o{ VERSION : has
	DOCUMENT ||--o{ COMMENT : contains
	DOCUMENT }o--|| TEMPLATE : based_on
	USER ||--o{ DOCUMENT : creates
	
	DOCUMENT {
		uuid id PK
		string title
		text content
		enum status
		timestamp created_at
	}
	
	VERSION {
		uuid id PK
		uuid document_id FK
		int version_number
		text changes
	}

	USER {
		uuid id PK
		string email
		string name
	}
@enduml`,
		description: "Entity relationship diagram",
	},
	{
		name: "Gantt Chart",
		prefix: "pgantt",
		body: `@startgantt
Project starts 2024-01-01
[Prototype design] lasts 10 days
[Build prototype] lasts 10 days
[Test prototype] lasts 5 days
[Deploy] lasts 5 days

[Test prototype] starts at [Build prototype]'s end
[Deploy] starts at [Test prototype]'s end
@endgantt`,
		description: "Gantt chart for project timeline",
	},
	{
		name: "Mind Map",
		prefix: "pmind",
		body: `@startmindmap
* Document Management
** Creation
*** Templates
*** AI Generation
*** Import
** Editing
*** Real-time collaboration
*** Version history
*** Comments
** Organization
*** Folders
*** Tags
*** Search
** Publishing
*** Export formats
*** Review workflow
*** Approval
@endmindmap`,
		description: "Mind map diagram",
	},
];

// =============================================================================
// Template Library
// =============================================================================

/**
 * PlantUML template library
 */
export const PLANTUML_TEMPLATES: DiagramTemplate[] = [
	{
		id: "plantuml-api-flow",
		name: "API Request Flow",
		description: "Standard API request/response sequence",
		format: "plantuml",
		type: "sequence",
		code: `@startuml
actor Client
participant "API Gateway" as Gateway
participant "Auth Service" as Auth
participant "Business Service" as Service
database "Database" as DB

Client -> Gateway : API Request
Gateway -> Auth : Validate Token
Auth --> Gateway : Token Valid
Gateway -> Service : Forward Request
Service -> DB : Query Data
DB --> Service : Data
Service --> Gateway : Business Logic Result
Gateway --> Client : API Response
@enduml`,
		tags: ["api", "sequence", "flow"],
	},
	{
		id: "plantuml-cqrs",
		name: "CQRS Pattern",
		description: "Command Query Responsibility Segregation architecture",
		format: "plantuml",
		type: "component",
		code: `@startuml
skinparam componentStyle rectangle

package "Command Side" {
	[Command API] as CmdAPI
	[Command Handler] as CmdHandler
	[Aggregate Root] as Aggregate
	[Event Store] as EventStore
}

package "Query Side" {
	[Query API] as QueryAPI
	[Query Handler] as QueryHandler
	[Read Model] as ReadModel
}

database "Event Store" as ES
database "Read Database" as ReadDB
package "Event Bus" as Bus

CmdAPI -> CmdHandler : Command
CmdHandler -> Aggregate : Apply
Aggregate -> EventStore : Events
EventStore -> ES : Persist
EventStore -> Bus : Publish
Bus -> ReadModel : Update
ReadModel -> ReadDB : Save
QueryAPI -> QueryHandler : Query
QueryHandler -> ReadModel : Fetch
@enduml`,
		tags: ["architecture", "cqrs", "event-sourcing"],
	},
	{
		id: "plantuml-microservices",
		name: "Microservices Architecture",
		description: "Microservices with service mesh",
		format: "plantuml",
		type: "deployment",
		code: `@startuml
cloud "CDN" as CDN

node "Load Balancer" as LB {
	[Nginx]
}

cloud "Kubernetes Cluster" as K8s {
	package "Service Mesh (Istio)" {
		[API Gateway] as Gateway
		[Auth Service] as Auth
		[Document Service] as DocSvc
		[User Service] as UserSvc
		[Notification Service] as NotifSvc
		[Search Service] as SearchSvc

		queue "Message Queue\n(RabbitMQ)" as MQ
	}
}

database "PostgreSQL" as Postgres
database "Elasticsearch" as Elastic
database "Redis" as Redis

CDN --> LB
LB --> Gateway
Gateway --> Auth
Gateway --> DocSvc
Gateway --> UserSvc
DocSvc --> Postgres
DocSvc --> MQ
NotifSvc --> MQ
SearchSvc --> Elastic
Auth --> Redis
@enduml`,
		tags: ["microservices", "kubernetes", "architecture"],
	},
	{
		id: "plantuml-ddd",
		name: "DDD Bounded Contexts",
		description: "Domain-driven design with bounded contexts",
		format: "plantuml",
		type: "class",
		code: `@startuml
package "User Management Context" #LightBlue {
	class User <<Aggregate Root>> {
		- UserId id
		- Email email
		- Profile profile
		+ register()
		+ updateProfile()
	}

	class Profile <<Value Object>> {
		- String name
		- String avatar
	}
}

package "Document Context" #LightGreen {
	class Document <<Aggregate Root>> {
		- DocumentId id
		- Title title
		- Content content
		- AuthorId authorId
		+ create()
		+ publish()
		+ update()
	}

	class DocumentVersion <<Entity>> {
		- VersionId id
		- Content snapshot
		- Date created
	}
}

package "Collaboration Context" #LightYellow {
	class Comment <<Entity>> {
		- CommentId id
		- DocumentId documentId
		- UserId authorId
		- Text content
		+ add()
		+ edit()
	}
}

User "1" -- "0..*" Document : creates >
Document "1" -- "0..*" DocumentVersion : versions
Document "1" -- "0..*" Comment : has >
@enduml`,
		tags: ["ddd", "bounded-contexts", "domain-model"],
	},
];

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse PlantUML code to extract structure
 */
export function parsePlantUML(code: string): {
	parsed: ParsedPlantUmlDiagram | null;
	errors: DiagramValidationError[];
} {
	const errors: DiagramValidationError[] = [];
	const lines = code.split("\n");

	// Detect diagram type from start directive
	let type: PlantUmlDiagramType = "sequence"; // default
	let inDiagram = false;
	for (const line of lines) {
		const trimmed = line.trim().toLowerCase();
		if (!trimmed) continue;

		if (trimmed.startsWith("@start")) {
			inDiagram = true;
			if (trimmed.includes("mindmap")) type = "mindmap";
			else if (trimmed.includes("gantt")) type = "gantt";
			else if (trimmed.includes("wbs")) type = "wbs";
			else if (trimmed.includes("salt")) type = "wireframe";
		}
		
		// Detect from keywords
		if (!type && trimmed.includes("sequence")) type = "sequence";
		else if (trimmed.includes("state") && trimmed.includes("-->")) type = "state";
		else if (trimmed.includes("usecase") || trimmed.includes("actor")) type = "usecase";
		else if (trimmed.match(/class\s+\w+\s*\{/)) type = "class";
		else if (trimmed.includes("erdiagram")) type = "er";
		else if (trimmed.includes("component") || trimmed.includes("[name]")) type = "component";
	}

	if (!inDiagram && !code.includes("@enduml")) {
		errors.push({
			line: 0,
			column: 0,
			message: "PlantUML diagram should start with @startuml and end with @enduml",
			suggestion: "Add @startuml at the beginning and @enduml at the end",
		});
	}

	const elements: PlantUmlElement[] = [];
	const relationships: PlantUmlRelationship[] = [];
	const skinParams: Record<string, string> = {};
	let title: string | undefined;
	let header: string | undefined;
	let footer: string | undefined;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("'")) continue;
		if (trimmed.startsWith("@start") || trimmed.startsWith("@end")) continue;

		// Extract title
		const titleMatch = trimmed.match(/^title\s+"?(.+?)"?$/i);
		if (titleMatch) {
			title = titleMatch[1];
			continue;
		}

		// Extract header/footer
		const headerMatch = trimmed.match(/^header\s+"?(.+?)"?$/i);
		if (headerMatch) {
			header = headerMatch[1];
			continue;
		}

		const footerMatch = trimmed.match(/^footer\s+"?(.+?)"?$/i);
		if (footerMatch) {
			footer = footerMatch[1];
			continue;
		}

		// Extract skinparam
		const skinMatch = trimmed.match(/^skinparam\s+(\w+)\s+(.+)$/i);
		if (skinMatch) {
			skinParams[skinMatch[1]] = skinMatch[2];
			continue;
		}

		// Parse elements based on diagram type
		if (type === "sequence") {
			// participant, actor, boundary, control, entity, database
			const participantMatch = trimmed.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+"(.+?)"(?:\s+as\s+([\w]+))?/i);
			if (participantMatch) {
				elements.push({
					id: participantMatch[3] || participantMatch[2],
					name: participantMatch[2],
					type: participantMatch[1] as PlantUmlElementType,
					lineNumber: i + 1,
				});
			}

			// Parse arrow relationships
			const arrowMatch = trimmed.match(/^(\w+)\s*(->>|-->|-x|->|->>)\s*(\w+)(?::\s*(.+))?/);
			if (arrowMatch) {
				relationships.push({
					from: arrowMatch[1],
					to: arrowMatch[3],
					direction: arrowMatch[2] as PlantUmlArrowDirection,
					label: arrowMatch[4],
					lineNumber: i + 1,
				});
			}
		}

		if (type === "class") {
			// class definitions
			const classMatch = trimmed.match(/^(class|interface|abstract|enum)\s+(\w+)/);
			if (classMatch) {
				elements.push({
					id: classMatch[2],
					name: classMatch[2],
					type: classMatch[1] as PlantUmlElementType,
					lineNumber: i + 1,
				});
			}

			// class relationships
			const relMatch = trimmed.match(/^(\w+)\s+(.+?)\s+(\w+)/);
			if (relMatch && (trimmed.includes("<|") || trimmed.includes("<-"))) {
				const direction = line.match(/<?--?\|?>/)?.[0] as PlantUmlArrowDirection | undefined;
				if (direction) {
					relationships.push({
						from: relMatch[1],
						to: relMatch[3],
						direction,
						lineNumber: i + 1,
					});
				}
			}
		}
	}

	const parsed: ParsedPlantUmlDiagram = {
		type,
		title,
		header,
		footer,
		skinParams,
		elements,
		relationships,
		groups: [],
	};

	return { parsed, errors };
}

// =============================================================================
// Auto-complete
// =============================================================================

/**
 * Get auto-complete suggestions for the current context
 */
export function getPlantUmlSuggestions(
	code: string,
	position: { line: number; column: number }
): AutoCompleteSuggestion[] {
	const lines = code.split("\n");
	const currentLine = lines[position.line] || "";
	const beforeCursor = currentLine.slice(0, position.column);

	const suggestions: AutoCompleteSuggestion[] = [];

	// Start directives
	if (beforeCursor.match(/@(start|end|star)/)) {
		suggestions.push(
			{ label: "@startuml", insertText: "@startuml\n\n@enduml", detail: "Start/end PlantUML", kind: "keyword" },
			{ label: "@startmindmap", insertText: "@startmindmap\n\n@endmindmap", detail: "Mind map diagram", kind: "keyword" },
			{ label: "@startgantt", insertText: "@startgantt\n\n@endgantt", detail: "Gantt chart", kind: "keyword" },
			{ label: "@startsalt", insertText: "@startsalt\n{\n  [Button]\n}\n@endsalt", detail: "Wireframe (SALT)", kind: "keyword" }
		);
	}

	// Skin parameters
	if (beforeCursor.toLowerCase().includes("skinparam")) {
		for (const param of PLANTUML_SKINPARAMS) {
			suggestions.push({
				label: param,
				insertText: param + " ",
				detail: "Skin parameter",
				kind: "property",
			});
		}
	}

	// Colors
	if (beforeCursor.match(/#[a-z]?$/i) || beforeCursor.toLowerCase().includes("color")) {
		for (const color of PLANTUML_COLORS.slice(0, 20)) {
			suggestions.push({
				label: color,
				insertText: color,
				detail: `Color: ${color}`,
				kind: "value",
			});
		}
	}

	// Common keywords
	for (const keyword of PLANTUML_KEYWORDS.slice(0, 50)) {
		if (!beforeCursor.includes(keyword)) {
			suggestions.push({
				label: keyword,
				insertText: keyword + " ",
				kind: "keyword",
			});
		}
	}

	// Participant types for sequence diagrams
	if (beforeCursor.match(/(part|act|bound|cont|entity|data|coll|que)/i)) {
		suggestions.push(
			{ label: "participant", insertText: 'participant "Name" as alias', detail: "Participant", kind: "keyword" },
			{ label: "actor", insertText: 'actor "Name" as alias', detail: "Actor", kind: "keyword" },
			{ label: "database", insertText: 'database "Name" as alias', detail: "Database", kind: "keyword" },
			{ label: "boundary", insertText: 'boundary "Name" as alias', detail: "Boundary", kind: "keyword" },
			{ label: "control", insertText: 'control "Name" as alias', detail: "Control", kind: "keyword" },
			{ label: "entity", insertText: 'entity "Name" as alias', detail: "Entity", kind: "keyword" },
			{ label: "collections", insertText: 'collections "Name" as alias', detail: "Collections", kind: "keyword" },
			{ label: "queue", insertText: 'queue "Name" as alias', detail: "Queue", kind: "keyword" }
		);
	}

	return suggestions;
}

// =============================================================================
// Code Formatting
// =============================================================================

/**
 * Format PlantUML code with consistent indentation
 */
export function formatPlantUML(code: string): string {
	const lines = code.split("\n");
	const formatted: string[] = [];
	let indentLevel = 0;
	const indent = "\t";

	for (let line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			formatted.push("");
			continue;
		}

		// Decrease indent for certain end keywords
		if (trimmed.match(/^(end|endif|endwhile|enduml|@enduml|})$/i)) {
			indentLevel = Math.max(0, indentLevel - 1);
		}

		// Add comment as-is
		if (trimmed.startsWith("'")) {
			formatted.push(indent.repeat(indentLevel) + trimmed);
			continue;
		}

		// Format the line
		formatted.push(indent.repeat(indentLevel) + trimmed);

		// Increase indent for certain start keywords
		if (trimmed.match(/^(alt|else|opt|loop|par|group|box|rectangle|package|namespace|if|while|fork|partition|state.*\{)$/i)) {
			indentLevel++;
		}
		
		if (trimmed.match(/^(class|interface|enum|abstract).*\{/i)) {
			indentLevel++;
		}
	}

	return formatted.join("\n");
}

// =============================================================================
// Rendering
// =============================================================================

/**
 * Default PlantUML server URL
 */
export const DEFAULT_PLANTUML_SERVER = "https://www.plantuml.com/plantuml";

/**
 * Encode PlantUML code for server rendering using the PlantUML text encoding
 */
export function encodePlantUML(code: string): string {
	// Use deflate + base64 encoding as per PlantUML spec
	const zlib = require("zlib");
	const deflated = zlib.deflateRawSync(Buffer.from(code, "utf-8"));
	return encode64(deflated);
}

/**
 * Custom base64 encoding for PlantUML (slight variant)
 */
function encode64(data: Buffer): string {
	const plantumlBase64 =
		"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_:";
	let result = "";
	for (let i = 0; i < data.length; i += 3) {
		if (i + 2 === data.length) {
			result += encode3bytes(data[i], data[i + 1], 0, plantumlBase64);
		} else if (i + 1 === data.length) {
			result += encode3bytes(data[i], 0, 0, plantumlBase64);
		} else {
			result += encode3bytes(data[i], data[i + 1], data[i + 2], plantumlBase64);
		}
	}
	return result;
}

function encode3bytes(b1: number, b2: number, b3: number, chars: string): string {
	const c1 = b1 >> 2;
	const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
	const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
	const c4 = b3 & 0x3f;
	return chars[c1] + chars[c2] + chars[c3] + chars[c4];
}

/**
 * Generate URL for rendering PlantUML diagram
 */
export function getPlantUmlRenderUrl(
	code: string,
	options: PlantUmlRenderOptions
): string {
	const format = options.format === "txt" ? "txt" : options.format;
	const encoded = encodePlantUML(code);
	const server = options.server || DEFAULT_PLANTUML_SERVER;
	return `${server}/${format}/${encoded}`;
}

/**
 * Render PlantUML diagram by fetching from server
 */
export async function renderPlantUML(
	code: string,
	options: PlantUmlRenderOptions
): Promise<RenderResult> {
	try {
		const url = getPlantUmlRenderUrl(code, options);
		
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: options.format === "png" ? "image/png" : options.format === "txt" ? "text/plain" : "image/svg+xml",
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: `Failed to render: ${response.status} ${response.statusText}`,
			};
		}

		if (options.format === "txt") {
			const text = await response.text();
			return { success: true, data: text };
		}

		const blob = await response.blob();
		return { success: true, data: blob };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// =============================================================================
// Theme Support
// =============================================================================

/**
 * Generate skinparam configuration for theme
 */
export function getPlantUmlThemeConfig(theme: "default" | "dark" | "light" | "cyber" | "ocean" | "forest"): Record<string, string> {
	const themes: Record<string, Record<string, string>> = {
		default: {},
		dark: {
			backgroundColor: "#1e1e1e",
			defaultFontColor: "#d4d4d4",
			classBackgroundColor: "#2d2d30",
			classBorderColor: "#569cd6",
			classFontColor: "#d4d4d4",
			arrowColor: "#d4d4d4",
			activityBackgroundColor: "#2d2d30",
			activityBorderColor: "#c586c0",
			participantBackgroundColor: "#2d2d30",
			participantBorderColor: "#4ec9b0",
			noteBackgroundColor: "#2d2d30",
			noteBorderColor: "#dcdcaa",
		},
		light: {
			backgroundColor: "#ffffff",
			defaultFontColor: "#333333",
			classBackgroundColor: "#f0f0f0",
			classBorderColor: "#0066cc",
			arrowColor: "#666666",
			activityBackgroundColor: "#fff8dc",
			activityBorderColor: "#ff8c00",
		},
		cyber: {
			backgroundColor: "#0a0a0f",
			defaultFontColor: "#00ff00",
			classBackgroundColor: "#0d1117",
			classBorderColor: "#00ff00",
			classFontColor: "#00ff00",
			arrowColor: "#00ffff",
			arrowFontColor: "#ff00ff",
			activityBackgroundColor: "#0d1117",
			activityBorderColor: "#ff00ff",
		},
		ocean: {
			backgroundColor: "#e6f3ff",
			defaultFontColor: "#003366",
			classBackgroundColor: "#cce5ff",
			classBorderColor: "#0066cc",
			arrowColor: "#3399ff",
		},
		forest: {
			backgroundColor: "#f0f8e8",
			defaultFontColor: "#1a4a1a",
			classBackgroundColor: "#e0eed0",
			classBorderColor: "#2d6a2d",
			arrowColor: "#4a8a4a",
		},
	};

	return themes[theme] || themes.default;
}

/**
 * Generate skinparam code for theme
 */
export function generateThemeSkinParams(theme: "default" | "dark" | "light" | "cyber" | "ocean" | "forest"): string {
	if (theme === "default") return "";
	
	const config = getPlantUmlThemeConfig(theme);
	const lines = ["' Theme Configuration"];
	for (const [key, value] of Object.entries(config)) {
		lines.push(`skinparam ${key} ${value}`);
	}
	return lines.join("\n");
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate PlantUML syntax
 */
export function validatePlantUML(code: string): DiagramValidationError[] {
	const errors: DiagramValidationError[] = [];
	const lines = code.split("\n");
	
	let hasStart = false;
	let hasEnd = false;
	let braceStack: Array<{ char: string; line: number }> = [];
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("'")) continue;
		
		if (trimmed.startsWith("@start")) hasStart = true;
		if (trimmed.startsWith("@end")) hasEnd = true;
		
		// Check for mismatched braces/brackets in class definitions
		for (let j = 0; j < line.length; j++) {
			const char = line[j];
			if (char === "{") {
				braceStack.push({ char, line: i + 1 });
			} else if (char === "}") {
				const open = braceStack.pop();
				if (!open) {
					errors.push({
						line: i + 1,
						column: j,
						message: "Unmatched closing brace",
					});
				}
			}
		}
		
		// Check for common syntax errors
		if (trimmed.match(/^(participant|actor|class|interface|enum)\s+["\w]/)) {
			if (!trimmed.includes("as") && trimmed.includes('"') && !trimmed.endsWith('"')) {
				errors.push({
					line: i + 1,
					column: line.indexOf('"'),
					message: "Unclosed quote in declaration",
					suggestion: "Use as keyword for aliasing",
				});
			}
		}
	}
	
	if (!hasStart) {
		errors.unshift({
			line: 1,
			column: 1,
			message: "Missing @startuml directive",
			suggestion: "Add @startuml at the beginning of the diagram",
		});
	}
	
	if (!hasEnd) {
		errors.push({
			line: lines.length,
			column: 1,
			message: "Missing @enduml directive",
			suggestion: "Add @enduml at the end of the diagram",
		});
	}
	
	if (braceStack.length > 0) {
		const last = braceStack[braceStack.length - 1];
		errors.push({
			line: last.line,
			column: 1,
			message: "Unclosed opening brace",
		});
	}
	
	return errors;
}
