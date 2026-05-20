"use server";

/**
 * Smart Graphics Generator Server Actions
 *
 * Provides comprehensive graphics management capabilities for government proposals including:
 * - CRUD operations for proposal graphics
 * - AI-powered graphic suggestion based on section content
 * - Automated org chart generation from staffing data
 * - Process flow diagram generation from descriptions
 * - Schedule/timeline (Gantt) generation
 * - Infographic generation for metrics and KPIs
 * - Action caption generation following government best practices
 * - Graphic consistency validation across documents
 * - Template management for reusable diagram patterns
 * - Style guide management for organizational branding
 * - Export capabilities for graphics packages
 *
 * All graphics are generated in Mermaid or D2 format for easy editing and rendering.
 * Follows government proposal best practices for figure captions and references.
 *
 * @module lib/actions/graphics
 */

import { z } from "zod";
import { db } from "@/lib/db";
import {
	proposalGraphics,
	graphicTemplates,
	graphicReferences,
	graphicFeedback,
	graphicStyleGuides,
	type ProposalGraphic,
	type GraphicTemplate,
	type GraphicStyleGuide,
	type NewProposalGraphic,
	type NewGraphicTemplate,
} from "@/lib/db/schema-graphics";
import { documents, documentSections, proposalDocuments, opportunities } from "@/lib/db/schema";
import { eq, and, desc, sql, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";
import { getProviderManager } from "@/lib/ai/providers";
import { revalidatePath } from "next/cache";
// Integration with existing diagram library
import {
	validateMermaid,
	validateD2,
	validatePlantUML,
	validateStructurizr,
	DIAGRAM_TEMPLATES,
	getTemplates as getDiagramLibTemplates,
	getTemplateById as getDiagramLibTemplateById,
} from "@/lib/diagrams";
import {
	parseDiagram,
	formatDiagram,
	getDiagramStats,
	detectDiagramFormat,
} from "@/lib/diagrams/code-tools";
import type { DiagramFormat, DiagramTheme } from "@/lib/diagrams/types";
import { logger } from "@/lib/utils/logger";
import { requireUserContext, type UserContext } from "@/lib/auth-utils";

// ============================================================================
// Result Type Wrapper
// ============================================================================

/**
 * Standard result wrapper for server actions.
 * All server actions return this pattern for consistent error handling.
 */
export type ActionResult<T> =
	| { success: true; data: T }
	| { success: false; error: string };

type OrganizationColumn = AnyColumn<{ data: string; notNull: false }>;

async function requireGraphicContext(organizationId?: string | null): Promise<UserContext> {
	const userContext = await requireUserContext();
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Unauthorized");
	}
	return userContext;
}

async function requireGraphicActor(): Promise<string> {
	return (await requireGraphicContext()).userId;
}

function mutableOrganizationCondition(column: OrganizationColumn, userContext: UserContext) {
	return userContext.organizationId
		? eq(column, userContext.organizationId)
		: isNull(column);
}

function visibleTemplateCondition(userContext: UserContext) {
	return userContext.organizationId
		? or(
			isNull(graphicTemplates.organizationId),
			eq(graphicTemplates.organizationId, userContext.organizationId),
			eq(graphicTemplates.isPublic, true)
		)
		: or(
			isNull(graphicTemplates.organizationId),
			eq(graphicTemplates.isPublic, true)
		);
}

function organizationForInsert(inputOrganizationId: string | undefined, userContext: UserContext): string | undefined {
	return inputOrganizationId ?? userContext.organizationId;
}

function normalizeGraphicSearchLimit(limit: number | undefined, fallback = 20, maximum = 1000): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return fallback;
	}
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

function assignedOpportunityCondition(userId: string): SQL {
	return sql`opportunities.assigned_to = ${userId}`;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userId}
	)`;
}

function visibleOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		assignedOpportunityCondition(userId)
	)!;
}

function visibleGraphicRowsCondition(userId: string): SQL {
	return or(
		isNull(proposalGraphics.opportunityId),
		assignedOpportunityExistsSql(proposalGraphics.opportunityId, userId)
	)!;
}

function visibleGraphicCondition(graphicId: string, userId: string): SQL {
	return and(
		eq(proposalGraphics.id, graphicId),
		visibleGraphicRowsCondition(userId)
	)!;
}

function visibleGraphicsForOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(proposalGraphics.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

function visibleProposalDocumentsForOpportunityCondition(opportunityId: string, userId: string): SQL {
	return and(
		eq(proposalDocuments.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userId)
	)!;
}

function visibleProposalDocumentCondition(proposalDocumentId: string, userId: string): SQL {
	return and(
		eq(proposalDocuments.id, proposalDocumentId),
		assignedOpportunityExistsSql(proposalDocuments.opportunityId, userId)
	)!;
}

function visibleSectionCondition(sectionId: string, userId: string): SQL {
	return sql`document_sections.id = ${sectionId}
		and exists (
			select 1
			from proposal_documents
			join opportunities on opportunities.id = proposal_documents.opportunity_id
			where proposal_documents.id = document_sections.proposal_document_id
				and opportunities.assigned_to = ${userId}
		)`;
}

function visibleDocumentForProposalCondition(documentId: string, proposalDocumentId: string, userId: string): SQL {
	return sql`documents.id = ${documentId}
		and exists (
			select 1
			from proposal_documents
			join opportunities on opportunities.id = proposal_documents.opportunity_id
			where proposal_documents.id = ${proposalDocumentId}
				and proposal_documents.document_id = documents.id
				and opportunities.assigned_to = ${userId}
		)`;
}

async function assertVisibleOpportunity(opportunityId: string, userId: string): Promise<void> {
	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(visibleOpportunityCondition(opportunityId, userId))
		.limit(1);

	if (!opportunity) {
		throw new Error("Opportunity not found");
	}
}

async function assertVisibleGraphic(graphicId: string, userId: string): Promise<void> {
	const [graphic] = await db
		.select({ id: proposalGraphics.id })
		.from(proposalGraphics)
		.where(visibleGraphicCondition(graphicId, userId))
		.limit(1);

	if (!graphic) {
		throw new Error("Graphic not found");
	}
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Suggestion returned by AI for graphics that could enhance a section.
 */
export type GraphicSuggestion = {
	graphicType: string;
	title: string;
	rationale: string;
	suggestedDiagramCode?: string;
	confidence: number;
};

/**
 * Result of graphic generation operations.
 */
export type GraphicResult = {
	diagramCode: string;
	format: "mermaid" | "d2";
	suggestedCaption: string;
	suggestedActionCaption: string;
};

/**
 * Input data for org chart generation.
 */
export type StaffingData = {
	roles: Array<{
		title: string;
		name?: string;
		reportsTo?: string;
		department?: string;
	}>;
	opportunityId?: string;
};

/**
 * Input data for schedule/timeline generation.
 */
export type ScheduleData = {
	title: string;
	phases: Array<{
		name: string;
		startDate: string;
		endDate: string;
		milestones?: Array<{ name: string; date: string }>;
	}>;
};

/**
 * Input data for infographic generation.
 */
export type InfographicData = {
	title: string;
	metrics: Array<{
		label: string;
		value: string | number;
		icon?: string;
	}>;
	style?: "horizontal" | "vertical" | "grid";
};

/**
 * Report on graphic consistency across an opportunity's documents.
 */
export type ConsistencyReport = {
	totalGraphics: number;
	referencedGraphics: number;
	orphanedGraphics: string[];
	missingReferences: Array<{ documentId: string; referenceText: string }>;
	numberingIssues: string[];
	recommendations: string[];
};

/**
 * Input for creating a graphic template.
 */
export type CreateTemplateInput = {
	name: string;
	description?: string;
	graphicType: string;
	format: string;
	templateCode: string;
	placeholders?: Array<{
		key: string;
		label: string;
		type: "text" | "list" | "number" | "date";
		required: boolean;
		defaultValue?: string;
	}>;
	previewImageUrl?: string;
	isPublic?: boolean;
	organizationId?: string;
};

// ============================================================================
// Input Validation Schemas
// ============================================================================

const GraphicTypeSchema = z.enum([
	"org_chart",
	"process_flow",
	"schedule",
	"infographic",
	"diagram",
	"chart",
]);

const FormatSchema = z.enum(["svg", "png", "mermaid", "d2"]);

const CreateGraphicSchema = z.object({
	opportunityId: z.string().uuid().optional(),
	documentId: z.string().uuid().optional(),
	sectionId: z.string().uuid().optional(),
	title: z.string().min(1).max(500),
	figureNumber: z.string().max(50).optional(),
	graphicType: GraphicTypeSchema,
	format: FormatSchema.optional(),
	sourceData: z.record(z.string(), z.unknown()).optional(),
	diagramCode: z.string().optional(),
	imageUrl: z.string().url().optional(),
	caption: z.string().optional(),
	actionCaption: z.string().optional(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
	generatedBy: z.enum(["ai", "manual", "template"]).optional(),
	generationPrompt: z.string().optional(),
});

const UpdateGraphicSchema = CreateGraphicSchema.partial();

const CreateTemplateSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().optional(),
	graphicType: z.string().min(1).max(100),
	format: z.string().min(1).max(50),
	templateCode: z.string().min(1),
	placeholders: z.array(z.object({
		key: z.string(),
		label: z.string(),
		type: z.enum(["text", "list", "number", "date"]),
		required: z.boolean(),
		defaultValue: z.string().optional(),
	})).optional(),
	previewImageUrl: z.string().url().optional(),
	isPublic: z.boolean().optional(),
	organizationId: z.string().uuid().optional(),
});

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Creates a new proposal graphic.
 *
 * @param input - The graphic data to create
 * @returns The created graphic or an error
 */
export async function createGraphic(
	input: z.infer<typeof CreateGraphicSchema>
): Promise<ActionResult<ProposalGraphic>> {
	const actorId = await requireGraphicActor();
	try {
		const validated = CreateGraphicSchema.parse(input);
		if (validated.opportunityId) {
			await assertVisibleOpportunity(validated.opportunityId, actorId);
		}

		const insertData: NewProposalGraphic = {
			opportunityId: validated.opportunityId,
			documentId: validated.documentId,
			sectionId: validated.sectionId,
			title: validated.title,
			figureNumber: validated.figureNumber,
			graphicType: validated.graphicType,
			format: validated.format,
			sourceData: validated.sourceData,
			diagramCode: validated.diagramCode,
			imageUrl: validated.imageUrl,
			caption: validated.caption,
			actionCaption: validated.actionCaption,
			width: validated.width,
			height: validated.height,
			generatedBy: validated.generatedBy,
			generationPrompt: validated.generationPrompt,
			status: "draft",
		};

		const [graphic] = await db
			.insert(proposalGraphics)
			.values(insertData)
			.returning();

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: graphic };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues.map((issue: z.ZodIssue) => issue.message).join(", ")}` };
		}
		logger.error("Error creating graphic:", error);
		return { success: false, error: "Failed to create graphic" };
	}
}

/**
 * Updates an existing proposal graphic.
 *
 * @param id - The graphic ID to update
 * @param data - The fields to update
 * @returns The updated graphic or an error
 */
export async function updateGraphic(
	id: string,
	data: Partial<z.infer<typeof CreateGraphicSchema>>
): Promise<ActionResult<ProposalGraphic>> {
	const actorId = await requireGraphicActor();
	try {
		const validated = UpdateGraphicSchema.parse(data);
		if (validated.opportunityId) {
			await assertVisibleOpportunity(validated.opportunityId, actorId);
		}

		const [graphic] = await db
			.update(proposalGraphics)
			.set({
				...validated,
				updatedAt: new Date(),
			})
			.where(visibleGraphicCondition(id, actorId))
			.returning();

		if (!graphic) {
			return { success: false, error: "Graphic not found" };
		}

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: graphic };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues.map((issue: z.ZodIssue) => issue.message).join(", ")}` };
		}
		logger.error("Error updating graphic:", error);
		return { success: false, error: "Failed to update graphic" };
	}
}

/**
 * Deletes a proposal graphic.
 *
 * @param id - The graphic ID to delete
 * @returns Deletion status or an error
 */
export async function deleteGraphic(
	id: string
): Promise<ActionResult<{ deleted: boolean }>> {
	const actorId = await requireGraphicActor();
	try {
		const result = await db
			.delete(proposalGraphics)
			.where(visibleGraphicCondition(id, actorId))
			.returning({ id: proposalGraphics.id });

		if (result.length === 0) {
			return { success: false, error: "Graphic not found" };
		}

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: { deleted: true } };
	} catch (error) {
		logger.error("Error deleting graphic:", error);
		return { success: false, error: "Failed to delete graphic" };
	}
}

/**
 * Retrieves a single proposal graphic by ID.
 *
 * @param id - The graphic ID to retrieve
 * @returns The graphic or an error
 */
export async function getGraphic(
	id: string
): Promise<ActionResult<ProposalGraphic>> {
	const actorId = await requireGraphicActor();
	try {
		const [graphic] = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicCondition(id, actorId));

		if (!graphic) {
			return { success: false, error: "Graphic not found" };
		}

		return { success: true, data: graphic };
	} catch (error) {
		logger.error("Error getting graphic:", error);
		return { success: false, error: "Failed to retrieve graphic" };
	}
}

/**
 * Lists all graphics for an opportunity.
 *
 * @param opportunityId - The opportunity ID to list graphics for
 * @returns Array of graphics or an error
 */
export async function listGraphics(
	opportunityId: string
): Promise<ActionResult<ProposalGraphic[]>> {
	const actorId = await requireGraphicActor();
	try {
		const graphics = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicsForOpportunityCondition(opportunityId, actorId))
			.orderBy(desc(proposalGraphics.createdAt));

		return { success: true, data: graphics };
	} catch (error) {
		logger.error("Error listing graphics:", error);
		return { success: false, error: "Failed to list graphics" };
	}
}

// ============================================================================
// AI-Powered Suggestion
// ============================================================================

/**
 * Analyzes section content and suggests appropriate graphics.
 *
 * Uses AI to understand the content and recommend visualizations that would
 * enhance comprehension and proposal effectiveness.
 *
 * @param sectionId - The section ID to analyze
 * @returns Array of graphic suggestions or an error
 */
export async function suggestGraphics(
	sectionId: string
): Promise<ActionResult<GraphicSuggestion[]>> {
	const actorId = await requireGraphicActor();
	try {
		// Fetch section and related document content
		const [section] = await db
			.select()
			.from(documentSections)
			.where(visibleSectionCondition(sectionId, actorId));

		if (!section) {
			return { success: false, error: "Section not found" };
		}

		// Get the proposal document to access the actual document content
		const [proposalDoc] = await db
			.select()
			.from(proposalDocuments)
			.where(visibleProposalDocumentCondition(section.proposalDocumentId, actorId));

		if (!proposalDoc) {
			return { success: false, error: "Proposal document not found" };
		}

		// Get the document content
		const [doc] = await db
			.select()
			.from(documents)
			.where(visibleDocumentForProposalCondition(proposalDoc.documentId, proposalDoc.id, actorId));

		if (!doc) {
			return { success: false, error: "Document not found" };
		}

		// Extract plain text from content
		const contentText = doc.plainText || JSON.stringify(doc.content);

		// Use AI to analyze and suggest graphics
		const manager = getProviderManager();
		const systemPrompt = `You are an expert proposal graphics consultant specializing in government RFP responses.
Analyze the provided section content and suggest appropriate graphics that would:
1. Clarify complex processes or relationships
2. Provide visual evidence of capabilities
3. Make compliance easier to verify
4. Enhance proposal competitiveness

For each suggestion, provide:
- graphicType: one of "org_chart", "process_flow", "schedule", "infographic", "diagram", "chart"
- title: A clear, descriptive title (should be suitable for Figure label)
- rationale: Why this graphic would enhance the proposal
- suggestedDiagramCode: Mermaid diagram code if applicable
- confidence: 0-1 score indicating how strongly you recommend this graphic

Return a JSON array of suggestions. Maximum 5 suggestions, ordered by importance.`;

		const userPrompt = `Section: ${section.sectionName}

Content:
${contentText.substring(0, 4000)}

Analyze this proposal section and suggest graphics that would enhance it. Return only valid JSON array.`;

		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.7,
			maxTokens: 2000,
		});

		// Parse AI response
		let suggestions: GraphicSuggestion[] = [];
		try {
			// Extract JSON from response (handle markdown code blocks)
			let jsonStr = response.content;
			const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				jsonStr = jsonMatch[1];
			}
			suggestions = JSON.parse(jsonStr.trim());

			// Validate and sanitize suggestions
			suggestions = suggestions
				.filter((s): s is GraphicSuggestion =>
					typeof s.graphicType === "string" &&
					typeof s.title === "string" &&
					typeof s.rationale === "string" &&
					typeof s.confidence === "number"
				)
				.slice(0, 5);
		} catch {
			// If parsing fails, return empty array with a note
			logger.warn("Failed to parse AI suggestions:", response.content);
			return { success: true, data: [] };
		}

		return { success: true, data: suggestions };
	} catch (error) {
		logger.error("Error suggesting graphics:", error);
		return { success: false, error: "Failed to generate graphic suggestions" };
	}
}

// ============================================================================
// Org Chart Generation
// ============================================================================

/**
 * Generates an organizational chart from staffing data.
 *
 * Creates a Mermaid flowchart showing the hierarchical structure of the
 * proposed team, with optional department groupings.
 *
 * @param staffingData - The roles and reporting structure
 * @returns Generated diagram code and captions or an error
 */
export async function generateOrgChart(
	staffingData: StaffingData
): Promise<ActionResult<GraphicResult>> {
	try {
		const { roles, opportunityId } = staffingData;

		if (roles.length === 0) {
			return { success: false, error: "No roles provided" };
		}

		// Build the Mermaid flowchart
		const lines: string[] = ["flowchart TD"];
		const nodeIds = new Map<string, string>();

		// Create a sanitized node ID from title
		const createNodeId = (title: string): string => {
			const base = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
			let id = base;
			let counter = 1;
			while (nodeIds.has(id)) {
				id = `${base}_${counter}`;
				counter++;
			}
			return id;
		};

		// Group roles by department if available
		const departments = new Map<string, typeof roles>();
		for (const role of roles) {
			const dept = role.department || "default";
			if (!departments.has(dept)) {
				departments.set(dept, []);
			}
			departments.get(dept)!.push(role);
		}

		// Create nodes for each role
		for (const role of roles) {
			const nodeId = createNodeId(role.title);
			nodeIds.set(role.title, nodeId);
			const label = role.name
				? `${role.title}<br/><i>${role.name}</i>`
				: role.title;
			lines.push(`    ${nodeId}["${label}"]`);
		}

		// Create department subgraphs if we have multiple departments
		if (departments.size > 1) {
			for (const [dept, deptRoles] of departments) {
				if (dept !== "default") {
					lines.push(`    subgraph ${dept.replace(/[^a-zA-Z0-9]/g, "_")}["${dept}"]`);
					for (const role of deptRoles) {
						const nodeId = nodeIds.get(role.title);
						lines.push(`        ${nodeId}`);
					}
					lines.push("    end");
				}
			}
		}

		// Create edges for reporting relationships
		for (const role of roles) {
			if (role.reportsTo) {
				const fromId = nodeIds.get(role.reportsTo);
				const toId = nodeIds.get(role.title);
				if (fromId && toId) {
					lines.push(`    ${fromId} --> ${toId}`);
				}
			}
		}

		const diagramCode = lines.join("\n");

		// Generate caption
		const roleCount = roles.length;
		const deptCount = departments.size > 1 ? departments.size - 1 : 0;
		const suggestedCaption = deptCount > 0
			? `Proposed organizational structure showing ${roleCount} key positions across ${deptCount} functional areas.`
			: `Proposed organizational structure showing ${roleCount} key positions and reporting relationships.`;

		const suggestedActionCaption = deptCount > 0
			? `Illustrates the proposed organizational structure with ${roleCount} key positions across ${deptCount} functional areas, demonstrating clear lines of authority and communication.`
			: `Depicts the proposed team organization with ${roleCount} positions and their reporting relationships, ensuring clear accountability and efficient decision-making.`;

		// Optionally store the graphic if opportunityId is provided
		if (opportunityId) {
			await createGraphic({
				opportunityId,
				title: "Proposed Organizational Structure",
				graphicType: "org_chart",
				format: "mermaid",
				diagramCode,
				caption: suggestedCaption,
				actionCaption: suggestedActionCaption,
				sourceData: { roles },
				generatedBy: "ai",
			});
		}

		return {
			success: true,
			data: {
				diagramCode,
				format: "mermaid",
				suggestedCaption,
				suggestedActionCaption,
			},
		};
	} catch (error) {
		logger.error("Error generating org chart:", error);
		return { success: false, error: "Failed to generate organizational chart" };
	}
}

// ============================================================================
// Process Flow Generation
// ============================================================================

/**
 * Generates a process flow diagram from a text description.
 *
 * Uses AI to parse the description and create a Mermaid flowchart
 * with appropriate steps, decision points, and parallel paths.
 *
 * @param processDescription - Natural language description of the process
 * @param opportunityId - Optional opportunity to associate the graphic with
 * @returns Generated diagram code and captions or an error
 */
export async function generateProcessFlow(
	processDescription: string,
	opportunityId?: string
): Promise<ActionResult<GraphicResult>> {
	try {
		if (!processDescription || processDescription.trim().length === 0) {
			return { success: false, error: "Process description is required" };
		}

		const manager = getProviderManager();
		const systemPrompt = `You are an expert at creating process flow diagrams for government proposals.
Given a process description, create a Mermaid flowchart that:
1. Uses clear, concise step labels
2. Includes decision points where appropriate (use diamond shapes)
3. Shows parallel processes using fork/join when described
4. Follows top-down flow (TD) for readability
5. Uses appropriate connectors and labels for edges

Return a JSON object with:
- diagramCode: The complete Mermaid flowchart code starting with "flowchart TD"
- title: A concise title for the process
- stepCount: Number of steps in the process

Ensure the diagram is valid Mermaid syntax and renders correctly.`;

		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: `Create a process flow diagram for:\n\n${processDescription}` },
			],
			temperature: 0.5,
			maxTokens: 2000,
		});

		// Parse AI response
		let diagramCode: string;
		let title: string = "Process Flow";
		let stepCount: number = 5;

		try {
			let jsonStr = response.content;
			const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				jsonStr = jsonMatch[1];
			}

			// Try to find standalone mermaid code block
			const mermaidMatch = response.content.match(/```mermaid\s*([\s\S]*?)```/);
			if (mermaidMatch) {
				diagramCode = mermaidMatch[1].trim();
			} else {
				const parsed = JSON.parse(jsonStr.trim());
				diagramCode = parsed.diagramCode;
				title = parsed.title || title;
				stepCount = parsed.stepCount || stepCount;
			}
		} catch {
			// Fallback: try to extract any flowchart code
			const flowchartMatch = response.content.match(/(flowchart\s+TD[\s\S]*?)(?:```|$)/);
			if (flowchartMatch) {
				diagramCode = flowchartMatch[1].trim();
			} else {
				return { success: false, error: "Failed to generate valid diagram code" };
			}
		}

		const suggestedCaption = `${title} showing the ${stepCount}-step approach to ensure consistent delivery and quality outcomes.`;
		const suggestedActionCaption = `Demonstrates our ${stepCount}-step ${title.toLowerCase()} methodology, ensuring systematic execution, quality checkpoints, and measurable outcomes at each phase.`;

		// Optionally store the graphic
		if (opportunityId) {
			await createGraphic({
				opportunityId,
				title,
				graphicType: "process_flow",
				format: "mermaid",
				diagramCode,
				caption: suggestedCaption,
				actionCaption: suggestedActionCaption,
				sourceData: { processDescription },
				generatedBy: "ai",
				generationPrompt: processDescription,
			});
		}

		return {
			success: true,
			data: {
				diagramCode,
				format: "mermaid",
				suggestedCaption,
				suggestedActionCaption,
			},
		};
	} catch (error) {
		logger.error("Error generating process flow:", error);
		return { success: false, error: "Failed to generate process flow diagram" };
	}
}

// ============================================================================
// Schedule/Timeline Generation
// ============================================================================

/**
 * Generates a Gantt chart from schedule data.
 *
 * Creates a Mermaid gantt diagram showing project phases, durations,
 * and milestones for proposal timelines.
 *
 * @param scheduleData - The phases and milestones to visualize
 * @returns Generated diagram code and captions or an error
 */
export async function generateSchedule(
	scheduleData: ScheduleData
): Promise<ActionResult<GraphicResult>> {
	try {
		const { title, phases } = scheduleData;

		if (phases.length === 0) {
			return { success: false, error: "No phases provided" };
		}

		// Build Mermaid Gantt chart
		const lines: string[] = [
			"gantt",
			`    title ${title}`,
			"    dateFormat YYYY-MM-DD",
		];

		// Group phases by quarter/section for better organization
		let currentSection = "";
		let taskCounter = 0;

		for (const phase of phases) {
			// Calculate duration in days
			const start = new Date(phase.startDate);
			const end = new Date(phase.endDate);
			const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

			// Add section header if department/category changes
			const phaseParts = phase.name.split(":");
			if (phaseParts.length > 1 && phaseParts[0] !== currentSection) {
				currentSection = phaseParts[0];
				lines.push(`    section ${currentSection}`);
			}

			// Add task
			const taskId = `task${taskCounter++}`;
			const taskName = phaseParts.length > 1 ? phaseParts[1].trim() : phase.name;
			lines.push(`    ${taskName} :${taskId}, ${phase.startDate}, ${duration}d`);

			// Add milestones
			if (phase.milestones) {
				for (const milestone of phase.milestones) {
					const milestoneId = `milestone${taskCounter++}`;
					lines.push(`    ${milestone.name} :milestone, ${milestoneId}, ${milestone.date}, 0d`);
				}
			}
		}

		const diagramCode = lines.join("\n");

		// Calculate total duration
		const allDates = phases.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
		const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
		const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
		const totalMonths = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

		const suggestedCaption = `${title} spanning ${totalMonths} months across ${phases.length} major phases.`;
		const suggestedActionCaption = `Presents the ${title.toLowerCase()} with ${phases.length} phases over ${totalMonths} months, demonstrating a realistic and achievable timeline with clear milestones and deliverables.`;

		return {
			success: true,
			data: {
				diagramCode,
				format: "mermaid",
				suggestedCaption,
				suggestedActionCaption,
			},
		};
	} catch (error) {
		logger.error("Error generating schedule:", error);
		return { success: false, error: "Failed to generate schedule diagram" };
	}
}

// ============================================================================
// Infographic Generation
// ============================================================================

/**
 * Generates an infographic for metrics and key statistics.
 *
 * Creates a D2 diagram showcasing important metrics in a visually
 * compelling layout suitable for proposal highlights.
 *
 * @param data - The metrics and styling preferences
 * @returns Generated diagram code and captions or an error
 */
export async function generateInfographic(
	data: InfographicData
): Promise<ActionResult<GraphicResult>> {
	try {
		const { title, metrics, style = "horizontal" } = data;

		if (metrics.length === 0) {
			return { success: false, error: "No metrics provided" };
		}

		// Build D2 diagram for infographic
		// D2 provides better styling control for infographics
		const lines: string[] = [];

		// Add title
		lines.push(`title: ${title}`);
		lines.push("");

		// Create container based on style
		if (style === "horizontal") {
			lines.push("direction: right");
		} else if (style === "vertical") {
			lines.push("direction: down");
		}

		lines.push("");

		// Add each metric as a styled box
		for (let i = 0; i < metrics.length; i++) {
			const metric = metrics[i];
			const nodeId = `metric${i}`;
			const icon = metric.icon ? `${metric.icon} ` : "";

			lines.push(`${nodeId}: {`);
			lines.push(`  label: "${icon}${metric.value}\\n${metric.label}"`);
			lines.push("  shape: rectangle");
			lines.push("  style: {");
			lines.push("    font-size: 24");
			lines.push("    bold: true");
			lines.push("  }");
			lines.push("}");
			lines.push("");

			// Connect metrics in sequence for layout
			if (i > 0 && style !== "grid") {
				lines.push(`metric${i - 1} -> ${nodeId}: {`);
				lines.push("  style: {");
				lines.push("    stroke-width: 0");
				lines.push("  }");
				lines.push("}");
			}
		}

		// For grid layout, create 2-column arrangement
		if (style === "grid" && metrics.length > 2) {
			lines.push("");
			lines.push("grid: {");
			lines.push("  grid-columns: 2");
			for (let i = 0; i < metrics.length; i++) {
				lines.push(`  metric${i}`);
			}
			lines.push("}");
		}

		const diagramCode = lines.join("\n");

		const metricSummary = metrics.slice(0, 3).map(m => `${m.value} ${m.label}`).join(", ");
		const suggestedCaption = `Key performance metrics: ${metricSummary}${metrics.length > 3 ? `, and ${metrics.length - 3} more` : ""}.`;
		const suggestedActionCaption = `Highlights ${metrics.length} key performance indicators including ${metricSummary}, demonstrating our proven track record and quantifiable results.`;

		return {
			success: true,
			data: {
				diagramCode,
				format: "d2",
				suggestedCaption,
				suggestedActionCaption,
			},
		};
	} catch (error) {
		logger.error("Error generating infographic:", error);
		return { success: false, error: "Failed to generate infographic" };
	}
}

// ============================================================================
// Action Caption Generation
// ============================================================================

/**
 * Action verbs commonly used in government proposal captions.
 * These verbs convey proactive, results-oriented language.
 */
const ACTION_VERBS = [
	"Illustrates",
	"Demonstrates",
	"Depicts",
	"Shows",
	"Presents",
	"Highlights",
	"Outlines",
	"Summarizes",
	"Visualizes",
	"Maps",
	"Details",
	"Conveys",
];

/**
 * Generates an action caption for a graphic following government best practices.
 *
 * Action captions start with an action verb and explain what the graphic
 * demonstrates, making it clear how it supports the proposal narrative.
 *
 * @param graphicId - The graphic ID to generate caption for
 * @returns The generated action caption or an error
 */
export async function generateActionCaption(
	graphicId: string
): Promise<ActionResult<string>> {
	const actorId = await requireGraphicActor();
	try {
		// Fetch the graphic
		const [graphic] = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicCondition(graphicId, actorId));

		if (!graphic) {
			return { success: false, error: "Graphic not found" };
		}

		// Use AI to generate a contextual action caption
		const manager = getProviderManager();
		const systemPrompt = `You are an expert proposal writer specializing in government RFP responses.
Generate an action caption for a proposal graphic. The caption must:
1. Start with an action verb (${ACTION_VERBS.join(", ")})
2. Be concise but informative (1-2 sentences)
3. Explain what the graphic demonstrates and why it matters
4. Support the proposal's win themes
5. Be appropriate for the graphic type

Return only the caption text, no quotes or additional formatting.`;

		const context = {
			title: graphic.title,
			type: graphic.graphicType,
			currentCaption: graphic.caption,
			diagramCode: graphic.diagramCode?.substring(0, 500),
		};

		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: `Generate an action caption for this ${graphic.graphicType}:\n${JSON.stringify(context, null, 2)}` },
			],
			temperature: 0.7,
			maxTokens: 200,
		});

		const actionCaption = response.content.trim().replace(/^["']|["']$/g, "");

		// Ensure it starts with an action verb
		const startsWithVerb = ACTION_VERBS.some(
			verb => actionCaption.toLowerCase().startsWith(verb.toLowerCase())
		);

		const finalCaption = startsWithVerb
			? actionCaption
			: `Illustrates ${actionCaption.charAt(0).toLowerCase()}${actionCaption.slice(1)}`;

		// Update the graphic with the new action caption
		await db
			.update(proposalGraphics)
			.set({
				actionCaption: finalCaption,
				updatedAt: new Date(),
			})
			.where(visibleGraphicCondition(graphicId, actorId));

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: finalCaption };
	} catch (error) {
		logger.error("Error generating action caption:", error);
		return { success: false, error: "Failed to generate action caption" };
	}
}

// ============================================================================
// Consistency Validation
// ============================================================================

/**
 * Validates graphic consistency across all documents in an opportunity.
 *
 * Checks for:
 * - Orphaned graphics (not referenced in any document)
 * - Missing references (figure references without corresponding graphics)
 * - Figure numbering issues (gaps, duplicates, incorrect sequence)
 *
 * @param opportunityId - The opportunity to validate
 * @returns Consistency report or an error
 */
export async function validateGraphicConsistency(
	opportunityId: string
): Promise<ActionResult<ConsistencyReport>> {
	const actorId = await requireGraphicActor();
	try {
		// Get all graphics for this opportunity
		const graphics = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicsForOpportunityCondition(opportunityId, actorId))
			.orderBy(proposalGraphics.figureNumber);

		// Get all graphic references
		const references = await db
			.select()
			.from(graphicReferences)
			.where(
				inArray(
					graphicReferences.graphicId,
					graphics.map(g => g.id)
				)
			);

		// Get all proposal documents for this opportunity
		const propDocs = await db
			.select()
			.from(proposalDocuments)
			.where(visibleProposalDocumentsForOpportunityCondition(opportunityId, actorId));

		// Get document contents to scan for figure references
		const docs = await db
			.select()
			.from(documents)
			.where(
				inArray(
					documents.id,
					propDocs.map(pd => pd.documentId)
				)
			);

		// Track referenced graphic IDs
		const referencedGraphicIds = new Set(references.map(r => r.graphicId));

		// Find orphaned graphics (not referenced anywhere)
		const orphanedGraphics = graphics
			.filter(g => !referencedGraphicIds.has(g.id))
			.map(g => g.id);

		// Scan documents for figure references pattern
		const figureRefPattern = /(?:Figure|Fig\.?)\s*(\d+(?:-\d+)?(?:\.\d+)?)/gi;
		const missingReferences: Array<{ documentId: string; referenceText: string }> = [];
		const foundFigureNumbers = new Set(graphics.map(g => g.figureNumber).filter(Boolean));

		for (const doc of docs) {
			const plainText = doc.plainText || JSON.stringify(doc.content);
			let match;
			while ((match = figureRefPattern.exec(plainText)) !== null) {
				const refNum = match[1];
				// Check if this figure number exists
				if (!foundFigureNumbers.has(refNum) && !foundFigureNumbers.has(`Figure ${refNum}`)) {
					missingReferences.push({
						documentId: doc.id,
						referenceText: match[0],
					});
				}
			}
		}

		// Check figure numbering sequence
		const numberingIssues: string[] = [];
		const figureNumbers = graphics
			.map(g => g.figureNumber)
			.filter(Boolean)
			.sort();

		// Check for duplicates
		const seen = new Set<string>();
		for (const num of figureNumbers) {
			if (num && seen.has(num)) {
				numberingIssues.push(`Duplicate figure number: ${num}`);
			}
			if (num) seen.add(num);
		}

		// Check for gaps in simple numeric sequences
		const numericFigures = figureNumbers
			.map(n => parseInt(n?.replace(/\D/g, "") || "0"))
			.filter(n => n > 0)
			.sort((a, b) => a - b);

		for (let i = 1; i < numericFigures.length; i++) {
			if (numericFigures[i] - numericFigures[i - 1] > 1) {
				numberingIssues.push(
					`Gap in figure numbering between ${numericFigures[i - 1]} and ${numericFigures[i]}`
				);
			}
		}

		// Generate recommendations
		const recommendations: string[] = [];

		if (orphanedGraphics.length > 0) {
			recommendations.push(
				`${orphanedGraphics.length} graphic(s) are not referenced in any document. Consider adding references or removing unused graphics.`
			);
		}

		if (missingReferences.length > 0) {
			recommendations.push(
				`${missingReferences.length} figure reference(s) point to non-existent graphics. Create the missing graphics or correct the references.`
			);
		}

		if (numberingIssues.length > 0) {
			recommendations.push(
				"Review and correct figure numbering to ensure a consistent sequence throughout the proposal."
			);
		}

		if (graphics.some(g => !g.actionCaption)) {
			const missing = graphics.filter(g => !g.actionCaption).length;
			recommendations.push(
				`${missing} graphic(s) are missing action captions. Add captions starting with action verbs for government compliance.`
			);
		}

		return {
			success: true,
			data: {
				totalGraphics: graphics.length,
				referencedGraphics: referencedGraphicIds.size,
				orphanedGraphics,
				missingReferences,
				numberingIssues,
				recommendations,
			},
		};
	} catch (error) {
		logger.error("Error validating graphic consistency:", error);
		return { success: false, error: "Failed to validate graphic consistency" };
	}
}

// ============================================================================
// Export Graphics
// ============================================================================

/**
 * Exports all graphics for an opportunity as a downloadable package.
 *
 * Compiles graphics into the requested format (ZIP or PDF) for
 * offline use or printing.
 *
 * @param opportunityId - The opportunity to export graphics from
 * @param format - Export format: "zip" for individual files, "pdf" for compiled document
 * @returns Download URL or an error
 */
export async function exportGraphics(
	opportunityId: string,
	format: "zip" | "pdf"
): Promise<ActionResult<{ downloadUrl: string }>> {
	const actorId = await requireGraphicActor();
	try {
		// Get all graphics for this opportunity
		const graphics = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicsForOpportunityCondition(opportunityId, actorId))
			.orderBy(proposalGraphics.figureNumber);

		if (graphics.length === 0) {
			return { success: false, error: "No graphics found for this opportunity" };
		}

		// Export workflow:
		// 1. Store export request in database for async processing
		// 2. Background worker renders Mermaid/D2 diagrams to SVG/PNG
		// 3. Packages results and uploads to cloud storage
		// 4. Updates export record with signed download URL
		// Client polls the export endpoint for completion status

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = `graphics-export-${opportunityId.substring(0, 8)}-${timestamp}.${format}`;

		// In production, this would be a real signed URL
		const downloadUrl = `/api/exports/graphics/${filename}`;

		// Store export record for tracking
		await db
			.insert(graphicFeedback)
			.values({
				graphicId: graphics[0].id, // Associate with first graphic for tracking
				feedbackType: "export",
				content: JSON.stringify({
					opportunityId,
					format,
					graphicCount: graphics.length,
					timestamp: new Date().toISOString(),
				}),
				aiGenerated: false,
				status: "pending",
				createdBy: actorId,
			});

		return {
			success: true,
			data: { downloadUrl },
		};
	} catch (error) {
		logger.error("Error exporting graphics:", error);
		return { success: false, error: "Failed to export graphics" };
	}
}

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Creates a new graphic template for reuse.
 *
 * Templates allow organizations to maintain consistent diagram styles
 * and quickly generate common graphic types.
 *
 * @param input - The template configuration
 * @returns The created template or an error
 */
export async function createGraphicTemplate(
	input: CreateTemplateInput
): Promise<ActionResult<GraphicTemplate>> {
	const userContext = await requireGraphicContext(input.organizationId);
	try {
		const validated = CreateTemplateSchema.parse(input);
		const actorId = userContext.userId;
		const organizationId = organizationForInsert(validated.organizationId, userContext);

		const insertData: NewGraphicTemplate = {
			name: validated.name,
			description: validated.description,
			graphicType: validated.graphicType,
			format: validated.format,
			templateCode: validated.templateCode,
			placeholders: validated.placeholders,
			previewImageUrl: validated.previewImageUrl,
			isPublic: validated.isPublic ?? false,
			organizationId,
			createdBy: actorId,
			useCount: 0,
		};

		const [template] = await db
			.insert(graphicTemplates)
			.values(insertData)
			.returning();

		revalidatePath("/templates");

		return { success: true, data: template };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues.map((issue: z.ZodIssue) => issue.message).join(", ")}` };
		}
		logger.error("Error creating graphic template:", error);
		return { success: false, error: "Failed to create graphic template" };
	}
}

/**
 * Retrieves graphic templates, optionally filtered by type.
 *
 * @param graphicType - Optional filter for specific graphic types
 * @returns Array of templates or an error
 */
export async function getGraphicTemplates(
	graphicType?: string
): Promise<ActionResult<GraphicTemplate[]>> {
	const userContext = await requireGraphicContext();
	try {
		const conditions = [visibleTemplateCondition(userContext)];
		if (graphicType) {
			conditions.push(eq(graphicTemplates.graphicType, graphicType));
		}

		const templates = await db
			.select()
			.from(graphicTemplates)
			.where(and(...conditions))
			.orderBy(desc(graphicTemplates.useCount));

		return { success: true, data: templates };
	} catch (error) {
		logger.error("Error getting graphic templates:", error);
		return { success: false, error: "Failed to retrieve graphic templates" };
	}
}

/**
 * Applies a template to generate diagram code with provided data.
 *
 * Replaces placeholders in the template with actual values to
 * produce a customized diagram.
 *
 * @param templateId - The template to apply
 * @param data - Key-value pairs for placeholder replacement
 * @returns Generated diagram code or an error
 */
export async function applyTemplate(
	templateId: string,
	data: Record<string, string>
): Promise<ActionResult<string>> {
	const userContext = await requireGraphicContext();
	try {
		const [template] = await db
			.select()
			.from(graphicTemplates)
			.where(and(
				eq(graphicTemplates.id, templateId),
				visibleTemplateCondition(userContext)
			));

		if (!template) {
			return { success: false, error: "Template not found" };
		}

		// Replace placeholders with provided data
		let result = template.templateCode;

		// Replace standard {{placeholder}} syntax
		for (const [key, value] of Object.entries(data)) {
			const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
			result = result.replace(pattern, value);
		}

		// Replace any remaining placeholders with defaults
		if (template.placeholders) {
			for (const placeholder of template.placeholders) {
				if (placeholder.defaultValue) {
					const pattern = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, "g");
					result = result.replace(pattern, placeholder.defaultValue);
				}
			}
		}

		// Increment use count
		await db
			.update(graphicTemplates)
			.set({
				useCount: sql`${graphicTemplates.useCount} + 1`,
				updatedAt: new Date(),
			})
			.where(and(
				eq(graphicTemplates.id, templateId),
				visibleTemplateCondition(userContext)
			));

		return { success: true, data: result };
	} catch (error) {
		logger.error("Error applying template:", error);
		return { success: false, error: "Failed to apply template" };
	}
}

// ============================================================================
// Style Guide Functions
// ============================================================================

/**
 * Retrieves the style guide for an organization.
 *
 * Style guides define colors, fonts, and diagram styling for
 * consistent branding across all graphics.
 *
 * @param organizationId - The organization to get style guide for
 * @returns The style guide or null if not found
 */
export async function getStyleGuide(
	organizationId: string
): Promise<ActionResult<GraphicStyleGuide | null>> {
	await requireGraphicContext(organizationId);
	try {
		const [styleGuide] = await db
			.select()
			.from(graphicStyleGuides)
			.where(
				and(
					eq(graphicStyleGuides.organizationId, organizationId),
					eq(graphicStyleGuides.isDefault, true)
				)
			);

		return { success: true, data: styleGuide || null };
	} catch (error) {
		logger.error("Error getting style guide:", error);
		return { success: false, error: "Failed to retrieve style guide" };
	}
}

/**
 * Updates an organization's style guide.
 *
 * @param id - The style guide ID to update
 * @param data - The fields to update
 * @returns The updated style guide or an error
 */
export async function updateStyleGuide(
	id: string,
	data: Partial<GraphicStyleGuide>
): Promise<ActionResult<GraphicStyleGuide>> {
	const requestedOrganizationId = typeof data.organizationId === "string"
		? data.organizationId
		: undefined;
	const userContext = await requireGraphicContext(requestedOrganizationId);
	try {
		// Keep ownership immutable; the row predicate scopes which style guides can change.
		const { id: _, createdAt: __, organizationId: ___, ...updateData } = data as Record<string, unknown>;

		const [styleGuide] = await db
			.update(graphicStyleGuides)
			.set({
				...updateData,
				updatedAt: new Date(),
			})
			.where(and(
				eq(graphicStyleGuides.id, id),
				mutableOrganizationCondition(graphicStyleGuides.organizationId, userContext)
			))
			.returning();

		if (!styleGuide) {
			return { success: false, error: "Style guide not found" };
		}

		revalidatePath("/settings");

		return { success: true, data: styleGuide };
	} catch (error) {
		logger.error("Error updating style guide:", error);
		return { success: false, error: "Failed to update style guide" };
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a figure number for a new graphic based on existing graphics.
 *
 * @param opportunityId - The opportunity to generate number for
 * @param prefix - Optional prefix (e.g., "1-" for section 1)
 * @returns Next available figure number
 */
export async function getNextFigureNumber(
	opportunityId: string,
	prefix?: string
): Promise<ActionResult<string>> {
	const actorId = await requireGraphicActor();
	try {
		const graphics = await db
			.select({ figureNumber: proposalGraphics.figureNumber })
			.from(proposalGraphics)
			.where(visibleGraphicsForOpportunityCondition(opportunityId, actorId));

		// Extract numeric portion of figure numbers
		const numbers = graphics
			.map(g => {
				if (!g.figureNumber) return 0;
				const match = g.figureNumber.match(/(\d+)$/);
				return match ? parseInt(match[1]) : 0;
			})
			.filter(n => n > 0);

		const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
		const nextNumber = maxNumber + 1;

		const figureNumber = prefix
			? `${prefix}${nextNumber}`
			: `Figure ${nextNumber}`;

		return { success: true, data: figureNumber };
	} catch (error) {
		logger.error("Error generating figure number:", error);
		return { success: false, error: "Failed to generate figure number" };
	}
}

/**
 * Copies a graphic to another opportunity or document.
 *
 * @param graphicId - The graphic to copy
 * @param targetOpportunityId - The destination opportunity
 * @param targetDocumentId - Optional target document
 * @returns The copied graphic or an error
 */
export async function copyGraphic(
	graphicId: string,
	targetOpportunityId: string,
	targetDocumentId?: string
): Promise<ActionResult<ProposalGraphic>> {
	const actorId = await requireGraphicActor();
	try {
		await assertVisibleOpportunity(targetOpportunityId, actorId);
		const [source] = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicCondition(graphicId, actorId));

		if (!source) {
			return { success: false, error: "Source graphic not found" };
		}

		// Get next figure number for target opportunity
		const nextNumResult = await getNextFigureNumber(targetOpportunityId);
		const figureNumber = nextNumResult.success ? nextNumResult.data : undefined;

		const [copied] = await db
			.insert(proposalGraphics)
			.values({
				opportunityId: targetOpportunityId,
				documentId: targetDocumentId || source.documentId,
				sectionId: source.sectionId,
				title: source.title,
				figureNumber,
				graphicType: source.graphicType,
				format: source.format,
				sourceData: source.sourceData,
				diagramCode: source.diagramCode,
				imageUrl: source.imageUrl,
				caption: source.caption,
				actionCaption: source.actionCaption,
				width: source.width,
				height: source.height,
				generatedBy: "manual",
				status: "draft",
			})
			.returning();

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: copied };
	} catch (error) {
		logger.error("Error copying graphic:", error);
		return { success: false, error: "Failed to copy graphic" };
	}
}

/**
 * Searches graphics across opportunities by title or content.
 *
 * @param query - Search query string
 * @param limit - Maximum results to return (default 20)
 * @returns Matching graphics or an error
 */
export async function searchGraphics(
	query: string,
	limit: number = 20
): Promise<ActionResult<ProposalGraphic[]>> {
	const actorId = await requireGraphicActor();
	try {
		const searchPattern = `%${query}%`;

		const graphics = await db
			.select()
			.from(proposalGraphics)
			.where(
				and(
					sql`(
						${proposalGraphics.title} ILIKE ${searchPattern} OR
						${proposalGraphics.caption} ILIKE ${searchPattern} OR
						${proposalGraphics.actionCaption} ILIKE ${searchPattern}
					)`,
					visibleGraphicRowsCondition(actorId)
				)
			)
			.orderBy(desc(proposalGraphics.updatedAt))
			.limit(normalizeGraphicSearchLimit(limit));

		return { success: true, data: graphics };
	} catch (error) {
		logger.error("Error searching graphics:", error);
		return { success: false, error: "Failed to search graphics" };
	}
}

/**
 * Records feedback on a graphic (for AI improvement).
 *
 * @param graphicId - The graphic to provide feedback on
 * @param feedbackType - Type of feedback: "suggestion", "critique", "approval"
 * @param content - The feedback content
 * @param userId - The user providing feedback
 * @returns Success status or an error
 */
export async function recordGraphicFeedback(
	graphicId: string,
	feedbackType: "suggestion" | "critique" | "approval",
	content: string,
	_userId?: string
): Promise<ActionResult<{ recorded: boolean }>> {
	const actorId = await requireGraphicActor();
	try {
		await assertVisibleGraphic(graphicId, actorId);
		await db.insert(graphicFeedback).values({
			graphicId,
			feedbackType,
			content,
			aiGenerated: false,
			status: "pending",
			createdBy: actorId,
		});

		return { success: true, data: { recorded: true } };
	} catch (error) {
		logger.error("Error recording feedback:", error);
		return { success: false, error: "Failed to record feedback" };
	}
}

/**
 * Approves a graphic for use in the final proposal.
 *
 * @param graphicId - The graphic to approve
 * @param approvedBy - The user approving the graphic
 * @returns The updated graphic or an error
 */
export async function approveGraphic(
	graphicId: string,
	_approvedBy: string
): Promise<ActionResult<ProposalGraphic>> {
	const actorId = await requireGraphicActor();
	try {
		const [graphic] = await db
			.update(proposalGraphics)
			.set({
				status: "approved",
				approvedBy: actorId,
				approvedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(visibleGraphicCondition(graphicId, actorId))
			.returning();

		if (!graphic) {
			return { success: false, error: "Graphic not found" };
		}

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: graphic };
	} catch (error) {
		logger.error("Error approving graphic:", error);
		return { success: false, error: "Failed to approve graphic" };
	}
}

/**
 * Batch updates figure numbers for reordering.
 *
 * @param updates - Array of { id, figureNumber } pairs
 * @returns Success status or an error
 */
export async function reorderGraphics(
	updates: Array<{ id: string; figureNumber: string }>
): Promise<ActionResult<{ updated: number }>> {
	const actorId = await requireGraphicActor();
	try {
		let updatedCount = 0;

		for (const update of updates) {
			const result = await db
				.update(proposalGraphics)
				.set({
					figureNumber: update.figureNumber,
					updatedAt: new Date(),
				})
				.where(visibleGraphicCondition(update.id, actorId))
				.returning({ id: proposalGraphics.id });

			if (result.length > 0) updatedCount++;
		}

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: { updated: updatedCount } };
	} catch (error) {
		logger.error("Error reordering graphics:", error);
		return { success: false, error: "Failed to reorder graphics" };
	}
}

// ============================================================================
// Diagram Library Integration Functions
// ============================================================================

/**
 * Validates diagram code using the appropriate validator from the diagram library.
 * Supports Mermaid, D2, PlantUML, and Structurizr formats.
 *
 * @param code - The diagram code to validate
 * @param format - The diagram format (auto-detected if not provided)
 * @returns Validation result with any errors
 */
export async function validateGraphicCode(
	code: string,
	format?: "mermaid" | "d2" | "plantuml" | "structurizr"
): Promise<ActionResult<{ valid: boolean; error?: string; format: string }>> {
	try {
		// Auto-detect format if not provided
		const detectedFormat = format || detectDiagramFormat(code);

		let validationResult: { valid: boolean; error?: string };

		switch (detectedFormat) {
			case "mermaid":
				validationResult = validateMermaid(code);
				break;
			case "d2":
				validationResult = validateD2(code);
				break;
			case "plantuml":
				validationResult = validatePlantUML(code);
				break;
			case "structurizr":
				validationResult = validateStructurizr(code);
				break;
			default:
				validationResult = { valid: false, error: `Unknown format: ${detectedFormat}` };
		}

		return {
			success: true,
			data: {
				valid: validationResult.valid,
				error: validationResult.error,
				format: detectedFormat,
			},
		};
	} catch (error) {
		logger.error("Error validating graphic code:", error);
		return { success: false, error: "Failed to validate graphic code" };
	}
}

/**
 * Renders a graphic to SVG using the diagram library renderer.
 *
 * @param graphicId - The graphic to render
 * @param theme - Optional theme to apply
 * @returns SVG string or error
 */
export async function renderGraphicToSvg(
	graphicId: string,
	theme?: DiagramTheme
): Promise<ActionResult<{ svg: string }>> {
	const actorId = await requireGraphicActor();
	try {
		const [graphic] = await db
			.select()
			.from(proposalGraphics)
			.where(visibleGraphicCondition(graphicId, actorId))
			.limit(1);

		if (!graphic || !graphic.diagramCode) {
			return { success: false, error: "Graphic not found or has no diagram code" };
		}

		const format = (graphic.format as DiagramFormat) || detectDiagramFormat(graphic.diagramCode);
		const { diagramToSvg } = await import("@/lib/diagrams/renderer");
		const svg = await diagramToSvg(graphic.diagramCode, format, theme);

		if (!svg) {
			return { success: false, error: "Failed to render diagram" };
		}

		return { success: true, data: { svg } };
	} catch (error) {
		logger.error("Error rendering graphic:", error);
		return { success: false, error: "Failed to render graphic to SVG" };
	}
}

/**
 * Gets diagram statistics (element count, relationship count, etc.)
 *
 * @param code - The diagram code to analyze
 * @param format - The diagram format (auto-detected if not provided)
 * @returns Statistics about the diagram
 */
export async function getGraphicStats(
	code: string,
	format?: DiagramFormat
): Promise<
	ActionResult<{
		lineCount: number;
		charCount: number;
		elementCount?: number;
		relationshipCount?: number;
		format: string;
	}>
> {
	try {
		const detectedFormat = format || detectDiagramFormat(code);
		const stats = getDiagramStats(code, detectedFormat);

		return {
			success: true,
			data: {
				...stats,
				format: detectedFormat,
			},
		};
	} catch (error) {
		logger.error("Error getting graphic stats:", error);
		return { success: false, error: "Failed to get graphic statistics" };
	}
}

/**
 * Formats diagram code using the diagram library formatter.
 *
 * @param code - The diagram code to format
 * @param format - The diagram format (auto-detected if not provided)
 * @returns Formatted code
 */
export async function formatGraphicCode(
	code: string,
	format?: DiagramFormat
): Promise<ActionResult<{ formattedCode: string; format: string }>> {
	try {
		const detectedFormat = format || detectDiagramFormat(code);
		const formattedCode = formatDiagram(code, detectedFormat);

		return {
			success: true,
			data: {
				formattedCode,
				format: detectedFormat,
			},
		};
	} catch (error) {
		logger.error("Error formatting graphic code:", error);
		return { success: false, error: "Failed to format graphic code" };
	}
}

/**
 * Gets available diagram templates from the library.
 *
 * @param type - Optional filter by diagram type
 * @param tags - Optional filter by tags
 * @returns Array of available templates
 */
export async function getLibraryTemplates(
	type?: "mermaid" | "plantuml" | "d2" | "structurizr" | "excalidraw" | "all",
	tags?: string[]
): Promise<
	ActionResult<
		Array<{
			id: string;
			name: string;
			type: string;
			description: string;
			content: string;
			tags: string[];
		}>
	>
> {
	try {
		const templates = getDiagramLibTemplates(type, tags);
		return { success: true, data: templates };
	} catch (error) {
		logger.error("Error getting library templates:", error);
		return { success: false, error: "Failed to get library templates" };
	}
}

/**
 * Applies a library template to create a new graphic.
 *
 * @param templateId - The template ID from the diagram library
 * @param opportunityId - The opportunity to associate the graphic with
 * @param customizations - Optional customizations to apply to the template
 * @returns The created graphic
 */
export async function createGraphicFromLibraryTemplate(
	templateId: string,
	opportunityId: string,
	customizations?: {
		title?: string;
		caption?: string;
		placeholderValues?: Record<string, string>;
	}
): Promise<ActionResult<ProposalGraphic>> {
	await requireGraphicActor();
	try {
		const template = getDiagramLibTemplateById(templateId);

		if (!template) {
			return { success: false, error: "Template not found" };
		}

		// Apply placeholder values if provided
		let diagramCode = template.content;
		if (customizations?.placeholderValues) {
			for (const [key, value] of Object.entries(customizations.placeholderValues)) {
				diagramCode = diagramCode.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
			}
		}

		// Map template type to our graphic type
		const graphicTypeMap: Record<string, string> = {
			"mermaid-flowchart": "process_flow",
			"mermaid-sequence": "diagram",
			"mermaid-class": "diagram",
			"mermaid-er": "diagram",
			"mermaid-state": "diagram",
			"mermaid-gantt": "schedule",
			"plantuml-class": "diagram",
			"plantuml-usecase": "diagram",
			"plantuml-component": "diagram",
			"d2-system": "diagram",
			"d2-dataflow": "process_flow",
			"structurizr-context": "diagram",
			"structurizr-container": "diagram",
		};

		const [graphic] = await db
			.insert(proposalGraphics)
			.values({
				opportunityId,
				title: customizations?.title || template.name,
				graphicType: graphicTypeMap[template.id] || "diagram",
				format: template.type === "all" ? "mermaid" : template.type,
				diagramCode,
				caption: customizations?.caption || template.description,
				generatedBy: "template",
				status: "draft",
			})
			.returning();

		revalidatePath("/opportunities");
		revalidatePath("/documents");

		return { success: true, data: graphic };
	} catch (error) {
		logger.error("Error creating graphic from library template:", error);
		return { success: false, error: "Failed to create graphic from template" };
	}
}

/**
 * Parses diagram code and returns structured data about its elements.
 *
 * @param code - The diagram code to parse
 * @param format - The diagram format (auto-detected if not provided)
 * @returns Parsed diagram structure
 */
export async function parseGraphicCode(
	code: string,
	format?: DiagramFormat
): Promise<ActionResult<{ parsed: unknown; format: string; errors?: unknown[] }>> {
	try {
		const detectedFormat = format || detectDiagramFormat(code);
		const result = parseDiagram(code, detectedFormat);

		return {
			success: true,
			data: {
				parsed: result.data,
				format: detectedFormat,
				errors: result.errors,
			},
		};
	} catch (error) {
		logger.error("Error parsing graphic code:", error);
		return { success: false, error: "Failed to parse graphic code" };
	}
}
