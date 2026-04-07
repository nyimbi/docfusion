/**
 * Structurizr DSL Parser and Generator - DocFusion
 *
 * Support for the C4 model from the Structurizr DSL.
 * Provides parsing, generation, and editor support for architecture diagrams.
 */

import type {
	AutoCompleteSuggestion,
	C4Element,
	C4ElementType,
	C4Relationship,
	C4View,
	CodeSnippet,
	ContainerTechnology,
	DiagramTemplate,
	DiagramTheme,
	DiagramValidationError,
	ParsedStructurizrWorkspace,
	StructurizrDiagramType,
	StructurizrRenderOptions,
	RenderResult,
} from "./types";
import { logger } from "@/lib/utils/logger";

// =============================================================================
// DSL Keywords
// =============================================================================

/**
 * Structurizr DSL keywords
 */
export const STRUCTURIZR_KEYWORDS = [
	"workspace",
	"name",
	"description",
	"model",
	"views",
	"properties",
	"configuration",
	"!identifiers",
	"group",
	"person",
	"softwareSystem",
	"container",
	"component",
	"deploymentEnvironment",
	"deploymentNode",
	"infrastructureNode",
	" softwareSystemInstance",
	" containerInstance",
	"uses",
	"->",
	"description",
	"technology",
	"tags",
	"url",
	"properties",
	"perspectives",
	"relationship",
	"systemContext",
	"container",
	"component",
	"filtered",
	"dynamic",
	"deployment",
	"custom",
	"systemLandscape",
	"include",
	"exclude",
	"default",
	"animation",
	"description",
	"title",
	"enterprise",
	"softwareSystem",
	"container",
	"component",
	"tags",
	"autoLayout",
	"lr",
	"tb",
	"rl",
	"bt",
	"styles",
	"element",
	"relationship",
	"tag",
	"shape",
	"icon",
	"width",
	"height",
	"background",
	"color",
	"fontSize",
	"border",
	"opacity",
	"thickness",
	"style",
	"solid",
	"dashed",
	"dotted",
	"branding",
	"logo",
	"titleRequired",
	"default",
	"systemContext",
	"filtered",
	"dynamic",
	"deployment",
"perspectives",
	"!identifiers",
	"hierarchy",
	"flat",
];

/**
 * C4 element definition keywords
 */
export const C4_ELEMENT_KEYWORDS = [
	"person",
	"softwareSystem",
	"container",
	"component",
	"deploymentNode",
	"infrastructureNode",
];

/**
 * C4 relationship keywords
 */
export const C4_RELATIONSHIP_KEYWORDS = ["uses", "->", "<-"];

/**
 * View type keywords
 */
export const C4_VIEW_TYPES = [
	"systemContext",
	"container",
	"component",
	"dynamic",
	"deployment",
	"systemLandscape",
	"filtered",
	"custom",
];

/**
 * Container technologies (for auto-complete)
 */
export const CONTAINER_TECHNOLOGIES: ContainerTechnology[] = [
	"java",
	"spring",
	"springBoot",
	"node",
	"express",
	"react",
	"angular",
	"vue",
	"database",
	"postgresql",
	"mysql",
	"mongodb",
	"redis",
	"kafka",
	"rabbitmq",
	"docker",
	"kubernetes",
	"aws",
	"azure",
	"gcp",
];

// =============================================================================
// Code Snippets
// =============================================================================

/**
 * Structurizr DSL snippets
 */
export const STRUCTURIZR_SNIPPETS: CodeSnippet[] = [
	{
		name: "Basic Workspace",
		prefix: "swork",
		body: `workspace {
	model {
		user = person "User" "A user of the system"
		system = softwareSystem "Software System" "Description of the system"
		
		user -> system "Uses"
	}
	
	views {
		systemContext system {
			include *
			autolayout lr
		}
	}
}`,
		description: "Basic workspace structure with one system and user",
	},
	{
		name: "C4 System Context",
		prefix: "ssystem",
		body: `workspace {
	model {
		user = person "User" "A user of the system"
		system = softwareSystem "Software System" {
			description "Core application system"
			
			webapp = container "Web Application" "Serves the UI" "React"
			api = container "API" "Business logic" "Node.js"
			db = container "Database" "Data storage" "PostgreSQL"
			
			user -> webapp "Uses"
			webapp -> api "Calls"
			api -> db "Reads/Writes"
		}
		
		external = softwareSystem "External System" {
			external true
		}
		
		api -> external "Integrates with"
	}
	
	views {
		systemContext system "SystemContext" {
			title "System Context Diagram"
			description "The system context for the application"
			include *
			autolayout lr
		}
		
		container system "ContainerDiagram" {
			title "Container Diagram"
			include *
			autolayout lr
		}
	}
}`,
		description: "Complete system context diagram with containers",
	},
	{
		name: "C4 Container Diagram",
		prefix: "scontainer",
		body: `workspace {
	model {
		user = person "End User" "Application user"
		
		softwareSystem = softwareSystem "Application" {
			description "Web-based application"
			
			webapp = container "Single-Page Application" {
				description "Provides all functionality via web browser"
				technology "React"
			}
			
			api = container "API Application" {
				description "Provides API"
				technology "Node.js / Express"
				tags "Application"
			}
			
			database = container "Database" {
				description "Stores user data"
				technology "PostgreSQL"
				tags "Database"
			}
			
			cache = container "Cache" {
				description "Caching layer"
				technology "Redis"
			}
			
			user -> webapp "Views"
			webapp -> api "Calls"
			api -> database "Reads/Writes"
			api -> cache "Caches"
		}
	}
	
	views {
		container softwareSystem "Containers" {
			include *
			autolayout lr
		}
	}
}`,
		description: "Container diagram with web app, API, database, and cache",
	},
	{
		name: "C4 Component Diagram",
		prefix: "scomponent",
		body: `workspace {
	model {
		softwareSystem = softwareSystem "Application" {
			api = container "API Application" "Node.js" {
				authController = component "Auth Controller" {
					description "Handles authentication"
					technology "Express Controller"
				}
				
				docController = component "Document Controller" {
					description "Manages documents"
					technology "Express Controller"
				}
				
				authService = component "Auth Service" {
					description "Business logic for auth"
					technology "Service"
				}
				
				docService = component "Document Service" {
					description "Business logic for documents"
					technology "Service"
				}
				
				authController -> authService "Uses"
				docController -> docService "Uses"
				docService -> authService "Validates auth"
			}
		}
	}
	
	views {
		component softwareSystem.api "Components" {
			include *
			autolayout tb
		}
	}
}`,
		description: "Component diagram showing MVC structure",
	},
	{
		name: "Deployment Diagram",
		prefix: "sdeploy",
		body: `workspace {
	model {
		softwareSystem = softwareSystem "Application" {
			webapp = container "Web Application" "React"
			api = container "API Application" "Node.js"
			db = container "Database" "PostgreSQL"
		}
		
		prod = deploymentEnvironment "Production" {
			aws = deploymentNode "AWS" {
				description "Amazon Web Services"
				
				ecs = deploymentNode "ECS" {
					description "Elastic Container Service"
					
					webContainer = containerInstance webapp
				}
				
				eks = deploymentNode "EKS" {
					description "Elastic Kubernetes Service"
					
					apiPod = deploymentNode "API Pod" {
						apiInstance = containerInstance api
					}
				}
				
				rds = deploymentNode "RDS" {
					description "Relational Database Service"
					dbInstance = containerInstance db
				}
			}
		}
	}
	
	views {
		deployment softwareSystem "Production" {
			include *
			autolayout lr
		}
	}
}`,
		description: "Deployment diagram with AWS architecture",
	},
	{
		name: "Dynamic Diagram",
		prefix: "sdynamic",
		body: `workspace {
	model {
		user = person "User"
		
		softwareSystem = softwareSystem "Application" {
			webapp = container "Web App" "React"
			api = container "API" "Node.js"
			db = container "Database" "PostgreSQL"
			
			user -> webapp "Views"
			webapp -> api "API call"
			api -> db "Query"
		}
	}
	
	views {
		dynamic softwareSystem "SignIn" {
			title "Sign In Process"
			description "A user signs in"
			
			user -> softwareSystem.webapp "1. Enters credentials"
			softwareSystem.webapp -> softwareSystem.api "2. POST /login"
			softwareSystem.api -> softwareSystem.db "3. Validate credentials"
			softwareSystem.api -> softwareSystem.webapp "4. Return auth token"
			softwareSystem.webapp -> user "5. Display dashboard"
			
			autolayout lr
		}
	}
}`,
		description: "Dynamic/runtime diagram with numbered interactions",
	},
];

// =============================================================================
// Templates
// =============================================================================

/**
 * Structurizr template library
 */
export const STRUCTURIZR_TEMPLATES: DiagramTemplate[] = [
	{
		id: "structurizr-microservices",
		name: "Microservices Architecture",
		description: "Microservices with API Gateway and event bus",
		format: "structurizr",
		type: "container",
		code: `workspace "Microservices Architecture" "Architecture documentation" {
	model {
		user = person "User" "System user"
		
		app = softwareSystem "Application" {
			gateway = container "API Gateway" {
				description "Routes requests to services"
				technology "Kong"
			}
			
			auth = container "Auth Service" {
				description "Authentication and authorization"
				technology "Node.js"
			}
			
			users = container "User Service" {
				description "User management"
				technology "Java / Spring"
			}
			
			docs = container "Document Service" {
				description "Document processing"
				technology "Python"
			}
			
			search = container "Search Service" {
				description "Full-text search"
				technology "Go"
			}
			
			bus = container "Message Bus" {
				description "Event streaming"
				technology "Kafka"
				
				users -> this "Publishes events"
				docs -> this "Publishes events"
				search -> this "Subscribes to events"
			}
			
			userdb = container "User DB" {
				description "User data"
				technology "PostgreSQL"
			}
			
			docdb = container "Doc DB" {
				description "Document data"
				technology "MongoDB"
			}
			
			searchdb = container "Search DB" {
				description "Search index"
				technology "Elasticsearch"
			}
			
			user -> gateway "Makes API calls"
			gateway -> auth "Validates tokens"
			gateway -> users "Routes /users"
			gateway -> docs "Routes /docs"
			gateway -> search "Routes /search"
			
			users -> userdb "Reads/Writes"
			docs -> docdb "Reads/Writes"
			search -> searchdb "Index/Query"
		}
	}
	
	views {
		container app {
			title "Microservices Container Diagram"
			include *
			autolayout tb
		}
	}
}`,
		tags: ["microservices", "architecture", "container"],
	},
	{
		id: "structurizr-cicd",
		name: "CI/CD Pipeline",
		description: "CI/CD pipeline architecture",
		format: "structurizr",
		type: "deployment",
		code: `workspace "CI/CD Pipeline" {
	model {
		dev = deploymentEnvironment "Development" {
			jenkins = deploymentNode "Jenkins" {
				devBuild = infrastructureNode "Build Job"
				devDeploy = infrastructureNode "Deploy Job"
				
				devBuild -> devDeploy "Triggers"
			}
		}
		
		prod = deploymentEnvironment "Production" {
			k8s = deploymentNode "Kubernetes Cluster" {
				namespace = deploymentNode "Production Namespace" {
					deployment = infrastructureNode "Deployment Controller"
					ingress = infrastructureNode "Ingress Controller"
				}
			}
		}
	}
	
	views {
		deployment * "Production" {
			include *
			autolayout tb
		}
	}
}`,
		tags: ["cicd", "devops", "deployment"],
	},
	{
		id: "structurizr-saas",
		name: "SaaS Multi-tenant",
		description: "SaaS architecture with multi-tenancy",
		format: "structurizr",
		type: "container",
		code: `workspace "SaaS Architecture" {
	model {
		customer = person "Customer" "End user of SaaS"
		admin = person "Admin" "System administrator"
		
		saas = softwareSystem "SaaS Platform" {
			tenantUI = container "Tenant UI" "Vue.js" {
				description "Customer-facing dashboard"
			}
			
			adminUI = container "Admin UI" "React" {
				description "Admin panel"
			}
			
			api = container "API Gateway" "Kong" {
				description "API gateway with tenant routing"
			}
			
			orchestrator = container "Orchestrator" "Kubernetes" {
				description "Manages tenant resources"
				
				worker = component "Worker Pod" {
					description "Processing job"
					technology "Go"
				}
			}
			
			tenantDB = container "Tenant DB" "PostgreSQL" {
				description "Per-tenant schemas"
			}
			
			sharedDB = container "Shared DB" "PostgreSQL" {
				description "Common configuration data"
			}
			
			customer -> tenantUI "Uses"
			admin -> adminUI "Manages"
			tenantUI -> api "API requests"
			adminUI -> api "Admin API"
			api -> orchestrator "Process jobs"
			api -> tenantDB "Schema routing"
			orchestrator -> tenantDB "Per-tenant"
			api -> sharedDB "Common data"
		}
	}
	
	views {
		container saas {
			title "SaaS Platform"
			include *
			autolayout tb
		}
	}
}`,
		tags: ["saas", "multi-tenant", "cloud"],
	},
];

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse Structurizr DSL code
 */
export function parseStructurizr(code: string): {
	parsed: ParsedStructurizrWorkspace | null;
	errors: DiagramValidationError[];
} {
	const errors: DiagramValidationError[] = [];
	const lines = code.split("\n");
	
	let inWorkspace = false;
	let inModel = false;
	let inViews = false;
	let braceDepth = 0;
	
	const people: C4Element[] = [];
	const softwareSystems: C4Element[] = [];
	const containers: C4Element[] = [];
	const components: C4Element[] = [];
	const deploymentNodes: C4Element[] = [];
	const relationships: C4Relationship[] = [];
	const views: C4View[] = [];
	
	let currentContext: C4Element | null = null;
	let currentContainer: C4Element | null = null;
	let workspaceName = "Workspace";
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("//")) continue;
		
		// Count braces for context
		const openBraces = (line.match(/{/g) || []).length;
		const closeBraces = (line.match(/}/g) || []).length;
		braceDepth += openBraces - closeBraces;
		
		// Workspace
		const workspaceMatch = trimmed.match(/^workspace\s+(?:"(.+?)"|\w+)?/);
		if (workspaceMatch) {
			inWorkspace = true;
			if (workspaceMatch[1]) workspaceName = workspaceMatch[1];
			continue;
		}
		
		// Model section
		if (trimmed === "model {") {
			inModel = true;
			continue;
		}
		
		if (inModel && trimmed === "}" && braceDepth <= 1) {
			inModel = false;
			continue;
		}

		// Parse person
		const personMatch = trimmed.match(/^(\w+)\s*=\s*person\s+"(.+?)"\s*(?:"(.+?)")?/);
		if (personMatch) {
			people.push({
				id: personMatch[1],
				name: personMatch[2],
				description: personMatch[3],
				type: "person",
				lineNumber: i + 1,
			});
			continue;
		}
		
		// Parse software system
		const systemMatch = trimmed.match(/^(\w+)\s*=\s*softwareSystem\s+"(.+?)"\s*(?:"(.+?)")?/);
		if (systemMatch) {
			const system: C4Element = {
				id: systemMatch[1],
				name: systemMatch[2],
				description: systemMatch[3],
				type: "softwareSystem",
				lineNumber: i + 1,
				children: [],
			};
			softwareSystems.push(system);
			currentContext = system;
			continue;
		}
		
		// Parse container within system
		if (currentContext?.type === "softwareSystem" && braceDepth === 1) {
			const containerMatch = trimmed.match(/^(\w+)\s*=\s*container\s+"(.+?)"\s*(?:"(.+?)"\s*)?(?:"(.+?)")?/);
			if (containerMatch) {
				const container: C4Element = {
					id: containerMatch[1],
					name: containerMatch[2],
					description: containerMatch[3],
					technology: containerMatch[4],
					type: "container",
					lineNumber: i + 1,
					children: [],
				};
				containers.push(container);
				currentContainer = container;
				if (currentContext.children) currentContext.children.push(container);
				continue;
			}
		}
		
		// Parse component within container
		if (currentContainer && braceDepth === 2) {
			const componentMatch = trimmed.match(/^(\w+)\s*=\s*component\s+"(.+?)"\s*(?:"(.+?)"\s*)?(?:"(.+?)")?/);
			if (componentMatch) {
				const component: C4Element = {
					id: componentMatch[1],
					name: componentMatch[2],
					description: componentMatch[3],
					technology: componentMatch[4],
					type: "component",
					lineNumber: i + 1,
				};
				components.push(component);
				continue;
			}
		}
		
		// Parse relationship
		const relMatch = trimmed.match(/^(\S+)\s*->\s*(\S+)\s+"(.+?)"\s*(?:"(.+?)")?/);
		if (relMatch) {
			relationships.push({
				sourceId: relMatch[1],
				targetId: relMatch[2],
				description: relMatch[3],
				technology: relMatch[4],
				lineNumber: i + 1,
			});
			continue;
		}
		
		// Views section
		if (trimmed === "views {") {
			inViews = true;
			continue;
		}
		
		if (inViews && trimmed === "}" && braceDepth <= 1) {
			inViews = false;
			continue;
		}

		// Parse view definitions
		const viewMatch = trimmed.match(/^(\w+)\s+(\S+)\s*(?:"(.+?)")?\s*\{/);
		if (viewMatch) {
			views.push({
				type: viewMatch[1] as StructurizrDiagramType,
				key: viewMatch[3] || `${viewMatch[1]}_${views.length}`,
				elementIds: [],
				relationshipIds: [],
				lineNumber: i + 1,
			});
		}
	}
	
	if (!inWorkspace) {
		errors.push({
			line: 1,
			column: 1,
			message: "Missing workspace definition",
			suggestion: "Define a workspace at the root level",
		});
	}
	
	const parsed: ParsedStructurizrWorkspace = {
		id: "workspace",
		name: workspaceName,
		model: {
			people,
			softwareSystems,
			containers,
			components,
			deploymentNodes,
			relationships,
		},
		views,
	};
	
	return { parsed, errors };
}

// =============================================================================
// Code Generation
// =============================================================================

/**
 * Generate Structurizr DSL from parsed model
 */
export function generateStructurizrDSL(parsed: ParsedStructurizrWorkspace): string {
	const lines: string[] = [];
	
	lines.push(`workspace ${quoteIfNeeded(parsed.name)} {`);
	lines.push("");
	lines.push("\tmodel {");
	
	// People
	for (const person of parsed.model.people) {
		lines.push(`\t\t${person.id} = person ${quoteIfNeeded(person.name)} ${person.description ? quoteIfNeeded(person.description) : ""}`);
	}
	
	// Software Systems
	for (const system of parsed.model.softwareSystems) {
		lines.push(`\t\t${system.id} = softwareSystem ${quoteIfNeeded(system.name)} ${system.description ? quoteIfNeeded(system.description) : ""} {`);
		
		// Containers
		for (const container of system.children || []) {
			lines.push(`\t\t\t${container.id} = container ${quoteIfNeeded(container.name)} ${container.description ? quoteIfNeeded(container.description) : ""}${container.technology ? ` ${quoteIfNeeded(container.technology)}` : ""} {`);
			
			// Components
			for (const component of container.children || []) {
				lines.push(`\t\t\t\t${component.id} = component ${quoteIfNeeded(component.name)} ${component.description ? quoteIfNeeded(component.description) : ""}${component.technology ? ` ${quoteIfNeeded(component.technology)}` : ""}`);
			}
			
			lines.push("\t\t\t}");
		}
		
		lines.push("\t\t}");
	}
	
	// Relationships
	for (const rel of parsed.model.relationships) {
		lines.push(`\t\t${formatRelationship(rel)}`);
	}
	
	lines.push("\t}");
	lines.push("");
	lines.push("\tviews {");
	
	// Views
	for (const view of parsed.views) {
		lines.push(`\t\t${view.type} ${view.key} {`);
		lines.push("\t\t\tinclude *");
		lines.push("\t\t\tautolayout lr");
		lines.push("\t\t}");
	}
	
	lines.push("\t}");
	lines.push("}");
	
	return lines.join("\n");
}

function quoteIfNeeded(str: string): string {
	if (str.includes(" ") || str.includes("-")) {
		return `"${str}"`;
	}
	return str;
}

function formatRelationship(rel: C4Relationship): string {
	let line = `${rel.sourceId} -> ${rel.targetId}`;
	if (rel.description) {
		line += ` ${quoteIfNeeded(rel.description)}`;
		if (rel.technology) {
			line += ` ${quoteIfNeeded(rel.technology)}`;
		}
	}
	return line;
}

// =============================================================================
// Auto-complete
// =============================================================================

/**
 * Get auto-complete suggestions for Structurizr DSL
 */
export function getStructurizrSuggestions(
	code: string,
	position: { line: number; column: number }
): AutoCompleteSuggestion[] {
	const lines = code.split("\n");
	const currentLine = lines[position.line] || "";
	const beforeCursor = currentLine.slice(0, position.column).toLowerCase();
	const suggestions: AutoCompleteSuggestion[] = [];
	
	// Context detection
	let inModel = false;
	let inViews = false;
	let braceDepth = 0;
	
	for (let i = 0; i < position.line; i++) {
		const line = lines[i];
		braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
		if (line.trim() === "model {") inModel = true;
		if (line.trim() === "views {") inViews = true;
	}
	
	// Element definitions
	if (beforeCursor.match(/(pers|soft|cont|comp|depl)/i)) {
		suggestions.push(
			{ label: "person", insertText: 'id = person "Name" "Description"', detail: "Person actor", kind: "keyword" },
			{ label: "softwareSystem", insertText: 'id = softwareSystem "Name" "Description" {', detail: "Software system", kind: "keyword" },
			{ label: "container", insertText: 'id = container "Name" "Description" "Technology" {', detail: "Container within system", kind: "keyword" },
			{ label: "component", insertText: 'id = component "Name" "Description" "Technology"', detail: "Component within container", kind: "keyword" },
			{ label: "deploymentNode", insertText: 'id = deploymentNode "Name" "Description" "Technology" {', detail: "Deployment node", kind: "keyword" }
		);
	}
	
	// Technology suggestions
	if (beforeCursor.includes('"') && currentLine.includes("container")) {
		suggestions.push(
			{ label: "Java/Spring", insertText: '"Java"', detail: "Java technology stack", kind: "value" },
			{ label: "Node.js", insertText: '"Node.js"', detail: "Node.js technology", kind: "value" },
			{ label: "React", insertText: '"React"', detail: "React frontend", kind: "value" },
			{ label: "PostgreSQL", insertText: '"PostgreSQL"', detail: "PostgreSQL database", kind: "value" },
			{ label: "Redis", insertText: '"Redis"', detail: "Redis cache", kind: "value" }
		);
	}
	
	// Relationship
	if (beforeCursor.includes("->")) {
		suggestions.push(
			{ label: "uses arrow", insertText: '-> target "Description"', detail: "Directed relationship", kind: "keyword" },
			{ label: "uses with tech", insertText: '-> target "Description" "Technology"', detail: "Relationship with technology", kind: "keyword" }
		);
	}
	
	// View keywords
	if (inViews || beforeCursor.match(/(system|cont|comp|dyna|depl)/i)) {
		suggestions.push(
			{ label: "systemContext", insertText: "systemContext systemId \"Key\" {", detail: "Level 1: System context", kind: "keyword" },
			{ label: "container", insertText: "container systemId \"Key\" {", detail: "Level 2: Container view", kind: "keyword" },
			{ label: "component", insertText: "component containerId \"Key\" {", detail: "Level 3: Component view", kind: "keyword" },
			{ label: "dynamic", insertText: "dynamic systemId \"Key\" {", detail: "Runtime/dynamic view", kind: "keyword" },
			{ label: "deployment", insertText: "deployment \"Environment\" \"Key\" {", detail: "Deployment view", kind: "keyword" },
			{ label: "systemLandscape", insertText: "systemLandscape {", detail: "System landscape", kind: "keyword" }
		);
	}
	
	// View options
	if (currentLine.includes("{")) {
		suggestions.push(
			{ label: "include all", insertText: "include *", detail: "Include all elements", kind: "keyword" },
			{ label: "autolayout", insertText: "autolayout lr", detail: "Auto layout (left-right)", kind: "keyword" },
			{ label: "title", insertText: 'title "Title"', detail: "View title", kind: "keyword" },
			{ label: "description", insertText: 'description "Description"', detail: "View description", kind: "keyword" }
		);
	}
	
	// General keywords
	for (const keyword of STRUCTURIZR_KEYWORDS) {
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
 * Format Structurizr DSL with consistent indentation
 */
export function formatStructurizr(code: string): string {
	const lines = code.split("\n");
	const formatted: string[] = [];
	let indentLevel = 0;
	const indent = "\t";
	
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			formatted.push("");
			continue;
		}
		
		// Skip comments formatting
		if (trimmed.startsWith("//")) {
			formatted.push(indent.repeat(indentLevel) + trimmed);
			continue;
		}
		
		// Decrease indent for closing braces
		if (trimmed === "}" || trimmed.startsWith("}")) {
			indentLevel = Math.max(0, indentLevel - 1);
		}

		// Format lines
		formatted.push(indent.repeat(indentLevel) + trimmed);

		// Increase indent for opening braces
		if (trimmed.endsWith("{")) {
			indentLevel++;
		}
	}
	
	return formatted.join("\n").trimEnd();
}

// =============================================================================
// Rendering (Note: Requires Structurizr CLI or online service)
// =============================================================================

/**
 * Render Structurizr DSL diagrams
 *
 * Rendering strategy:
 * 1. Try Kroki.io Structurizr rendering service
 * 2. Fall back to Mermaid conversion for client-side rendering
 *
 * Note: Structurizr DSL can also be rendered via:
 * - Structurizr CLI (local)
 * - Structurizr Lite (Docker)
 * - Structurizr.com (cloud service)
 */
export async function renderStructurizr(
	code: string,
	options: StructurizrRenderOptions
): Promise<RenderResult> {
	const format = options.format || "svg";

	// Strategy 1: Try Kroki.io Structurizr rendering
	try {
		const kroikiResult = await renderStructurizrViaKroki(code, format as "svg" | "png");
		if (kroikiResult.success) {
			return kroikiResult;
		}
	} catch (e) {
		logger.warn("Structurizr Kroki rendering failed, trying Mermaid fallback:", e);
	}

	// Strategy 2: Convert to Mermaid for client-side rendering
	const mermaidCode = structurizrToMermaid(code);
	if (!mermaidCode) {
		return {
			success: false,
			error: "Failed to convert Structurizr to Mermaid format",
		};
	}

	// Return the Mermaid code - caller should render with mermaid library
	return {
		success: true,
		data: mermaidCode,
		warnings: ["Rendered via Mermaid conversion - some C4 styling may differ"],
	};
}

/**
 * Render Structurizr via Kroki.io service
 */
async function renderStructurizrViaKroki(
	code: string,
	format: "svg" | "png"
): Promise<RenderResult> {
	const KROKI_URL = "https://kroki.io/structurizr";

	try {
		// Kroki accepts base64url-encoded diagram source
		const encoded = btoa(unescape(encodeURIComponent(code)))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		const url = `${KROKI_URL}/${format}/${encoded}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: format === "png" ? "image/png" : "image/svg+xml",
			},
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return {
				success: false,
				error: `Kroki Structurizr rendering failed (${response.status}): ${errorText}`,
			};
		}

		if (format === "png") {
			const blob = await response.blob();
			return { success: true, data: blob };
		}

		const svg = await response.text();
		return { success: true, data: svg };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Kroki Structurizr rendering failed",
		};
	}
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate Structurizr DSL syntax
 */
export function validateStructurizr(code: string): DiagramValidationError[] {
	const errors: DiagramValidationError[] = [];
	const lines = code.split("\n");
	let braceDepth = 0;
	let hasWorkspace = false;
	let hasModel = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("//")) continue;
		
		// Track braces
		braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

		if (trimmed.startsWith("workspace")) hasWorkspace = true;
		if (trimmed === "model {") hasModel = true;

		// Check for balanced braces
		if (braceDepth < 0) {
			errors.push({
				line: i + 1,
				column: line.indexOf("}") + 1,
				message: "Unmatched closing brace",
			});
			braceDepth = 0;
		}
	}
	
	if (braceDepth > 0) {
		errors.push({
			line: lines.length,
			column: 1,
			message: `Unclosed braces (${braceDepth} remaining)`,
		});
	}
	
	if (!hasWorkspace) {
		errors.unshift({
			line: 1,
			column: 1,
			message: "Missing workspace block",
			suggestion: "Add: workspace { model { } views { } }",
		});
	}
	
	if (!hasModel) {
		errors.push({
			line: 1,
			column: 1,
			message: "Missing model section",
			suggestion: "Add model { } within workspace",
		});
	}
	
	return errors;
}

// =============================================================================
// Mermaid Conversion (for client-side rendering)
// =============================================================================

/**
 * Convert Structurizr DSL to Mermaid for client-side rendering
 */
export function structurizrToMermaid(dsl: string): string {
	const { parsed } = parseStructurizr(dsl);
	if (!parsed) return "";
	
	const lines: string[] = [];
	lines.push("flowchart TB");
	lines.push("");
	
	// Create nodes for all elements
	for (const person of parsed.model.people) {
		lines.push(`    ${person.id}(["${person.name}"])`);
		lines.push(`    style ${person.id} fill:#ffdddd,stroke:#cc0000`);
	}
	
	for (const system of parsed.model.softwareSystems) {
		lines.push(`    ${system.id}(["${system.name}"])`);
		lines.push(`    style ${system.id} fill:#ddddff,stroke:#0000cc`);
	}
	
	for (const container of parsed.model.containers) {
		lines.push(`    ${container.id}(["${container.name}"])`);
		lines.push(`    style ${container.id} fill:#ddffdd,stroke:#00cc00`);
	}
	
	// Add relationships
	for (const rel of parsed.model.relationships) {
		lines.push(`    ${rel.sourceId} -->|"${rel.description || "uses"}"| ${rel.targetId}`);
	}
	
	return lines.join("\n");
}
