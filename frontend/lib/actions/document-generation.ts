/**
 * Document Generation Actions - DocFusion
 *
 * Server actions for AI-powered document generation including
 * structure generation, section content creation, and diagram generation.
 */

"use server";

import { db } from "@/lib/db";
import { documents, documentVersions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { initializeAIConfig } from "@/lib/ai/config";
import { getProviderManager } from "@/lib/ai/providers";
import type { DocumentContent, DocumentBlock } from "@/lib/types/document";
import { logger } from "@/lib/utils/logger";
import { getCurrentUserId } from "@/lib/auth-utils";

// ============================================================================
// Types
// ============================================================================

export interface DocumentStructure {
	id: string;
	type: "chapter" | "section" | "subsection" | "paragraph";
	title: string;
	order: number;
	children?: DocumentStructure[];
	length?: "brief" | "medium" | "comprehensive";
}

export interface GenerateStructureInput {
	prompt: string;
	documentType?: string;
	tone?: "formal" | "professional" | "friendly" | "technical";
	audience?: string;
	minSections?: number;
	maxSections?: number;
}

const VALID_STRUCTURE_TYPES = new Set<DocumentStructure["type"]>(["chapter", "section", "subsection", "paragraph"]);
const VALID_STRUCTURE_LENGTHS = new Set<NonNullable<DocumentStructure["length"]>>(["brief", "medium", "comprehensive"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonBlankText(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStructureType(value: unknown, fallback: DocumentStructure["type"]): DocumentStructure["type"] {
	const text = nonBlankText(value);
	return text && VALID_STRUCTURE_TYPES.has(text as DocumentStructure["type"])
		? text as DocumentStructure["type"]
		: fallback;
}

function normalizeStructureLength(value: unknown): DocumentStructure["length"] {
	const text = nonBlankText(value);
	return text && VALID_STRUCTURE_LENGTHS.has(text as NonNullable<DocumentStructure["length"]>)
		? text as NonNullable<DocumentStructure["length"]>
		: "medium";
}

function normalizeStructureNode(value: unknown, index: number, fallbackType: DocumentStructure["type"]): DocumentStructure | null {
	if (!isRecord(value)) return null;
	const title = nonBlankText(value.title);
	if (!title) return null;
	const type = normalizeStructureType(value.type, fallbackType);
	const childFallbackType = type === "chapter" ? "section" : "subsection";
	const children = Array.isArray(value.children)
		? value.children
			.map((child, childIndex) => normalizeStructureNode(child, childIndex, childFallbackType))
			.filter((child): child is DocumentStructure => child !== null)
		: undefined;
	const order = typeof value.order === "number" && Number.isFinite(value.order) && value.order > 0
		? Math.floor(value.order)
		: index + 1;

	return {
		id: nonBlankText(value.id) ?? crypto.randomUUID(),
		type,
		title,
		order,
		length: normalizeStructureLength(value.length),
		...(children && children.length > 0 ? { children } : {}),
	};
}

export interface GenerateSectionInput {
	documentId: string;
	sectionId: string;
	sectionPath: string[];
	sectionTitle: string;
	parentContext: string;
	tone: string;
	length: "brief" | "medium" | "comprehensive";
	keyPoints?: string[];
	references?: string[];
}

export interface GenerateDiagramInput {
	description: string;
	type: "flowchart" | "sequence" | "class" | "state" | "gantt" | "er" | "mindmap" | "napkin";
	style?: "modern" | "minimal" | "detailed";
}

export interface GeneratedDiagram {
	type: "mermaid" | "napkin" | "svg";
	code: string;
	svg?: string;
	description: string;
}

type GeneratedSectionContent = {
	content: DocumentContent;
	wordCount: number;
};

// ============================================================================
// Constants
// ============================================================================

const SECTION_GENERATION_SYSTEM_PROMPT = `You are an expert document writer. Generate high-quality document content based on the provided specifications.

Your response MUST be valid JSON in the following format:
{
  "paragraphs": [
    "First paragraph content...",
    "Second paragraph content...",
    "Third paragraph content..."
  ]
}

Guidelines:
- Write in the specified tone (formal, professional, friendly, or technical)
- Generate approximately the requested word count
- Consider parent section context for coherence with the broader document
- Address all key points provided
- Create well-structured, flowing content with clear transitions
- Use appropriate vocabulary for the specified tone
- Ensure each paragraph has a clear purpose and focus
- Do not include markdown formatting in the content
- Return ONLY the JSON object, no markdown code blocks, no additional text`;

const DIAGRAM_GENERATION_SYSTEM_PROMPT = `You are an expert at creating Mermaid diagrams. Generate valid Mermaid code based on the user's description.

Guidelines:
- Generate syntactically correct Mermaid code
- Use appropriate diagram type syntax (flowchart, sequenceDiagram, classDiagram, erDiagram, gantt, mindmap, stateDiagram-v2)
- Make diagrams clear and well-structured
- Use meaningful node/entity names
- Include comments if helpful for complex diagrams
- Return ONLY the Mermaid code, no markdown code blocks, no additional explanation`;

// Word count targets based on length setting
const WORD_TARGETS = {
	brief: 200,
	medium: 500,
	comprehensive: 1200,
};

// Approximate tokens per word for estimation
const TOKENS_PER_WORD = 1.5;

async function requireDocumentGenerationUserId(expectedUserId?: string): Promise<string> {
	const currentUserId = await getCurrentUserId();
	if (!currentUserId || (expectedUserId && currentUserId !== expectedUserId)) {
		throw new Error("Unauthorized");
	}
	return currentUserId;
}

// ============================================================================
// Structure Generation
// ============================================================================

/**
 * Generate a hierarchical document structure based on user prompt.
 * Uses AI to create chapters, sections, subsections, and paragraphs.
 */
export async function generateDocumentStructure(
	input: GenerateStructureInput
): Promise<DocumentStructure[]> {
	await requireDocumentGenerationUserId();
	const { prompt, documentType, tone = "professional", audience, minSections = 5, maxSections = 10 } = input;

	// Ensure AI config is initialized (server action context)
	await initializeAIConfig();

	// Get provider manager
	const manager = getProviderManager();

	// Check if any provider is available
	const isAvail = await manager.isAvailable();
	if (!isAvail) {
		// Get more specific error information
		const azureProvider = await manager.getActiveProvider();
		const errors: string[] = [];
		
		// Check what might be wrong
		if (!process.env.AZURE_OPENAI_API_KEY) {
			errors.push("Missing AZURE_OPENAI_API_KEY");
		}
		if (!process.env.AZURE_OPENAI_ENDPOINT) {
			errors.push("Missing AZURE_OPENAI_ENDPOINT");
		}
		if (!process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
			errors.push("Missing AZURE_OPENAI_DEPLOYMENT_NAME");
		}
		
		if (errors.length > 0) {
			throw new Error(`AI provider not configured: ${errors.join(", ")}. Please check your environment variables.`);
		} else {
			throw new Error("AI provider not available. Please verify your Azure OpenAI configuration and ensure the service is accessible.");
		}
	}

	// Build the AI prompt
	const systemPrompt = `You are a document structure expert. Generate hierarchical document outlines based on user requirements.
Return ONLY valid JSON arrays with no markdown formatting, no code blocks, just raw JSON.`;

	const userPrompt = `Generate a detailed document structure for: ${prompt}
Document Type: ${documentType || "auto-detect"}
Tone: ${tone}
Audience: ${audience || "general"}
Minimum sections: ${minSections}
Maximum sections: ${maxSections}

Return ONLY a valid JSON array of structure nodes:
[{
  "id": "uuid",
  "type": "chapter|section|subsection",
  "title": "title",
  "order": 1,
  "length": "brief|medium|comprehensive",
  "children": [...]
}]

Guidelines:
- Generate between ${minSections} and ${maxSections} top-level chapters
- Each chapter MUST contain 2-4 sections with type "section"
- Each section SHOULD contain 0-3 subsections with type "subsection"
- Use "chapter" for top-level divisions
- Use "section" for major subdivisions (nested under chapters)
- Use "subsection" for detailed breakdowns (nested under sections)
- Create a deep hierarchical structure with multiple levels
- Make titles descriptive and relevant to the document topic
- Order should be sequential starting from 1
- Length indicates content density: "brief" (1-2 paragraphs), "medium" (3-5 paragraphs), "comprehensive" (full section)`;

	try {
		// Call AI provider
		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.7,
			maxTokens: 4000,
		});

		const content = response.content.trim();

		// Try to parse the JSON response
		let structure: unknown;
		try {
			// Remove any markdown code block markers if present
			const cleanContent = content
				.replace(/^```json\s*/i, "")
				.replace(/^```\s*/i, "")
				.replace(/```\s*$/i, "")
				.trim();

			structure = JSON.parse(cleanContent);

			// Validate structure is an array
			if (!Array.isArray(structure)) {
				throw new Error("Response is not an array");
			}
			if (structure.length === 0) {
				throw new Error("Response contained no structure nodes");
			}

			const normalizedStructure = structure
				.map((item, index) => normalizeStructureNode(item, index, "chapter"))
				.filter((item): item is DocumentStructure => item !== null);
			if (normalizedStructure.length === 0) {
				throw new Error("Response contained no usable structure nodes");
			}

			return normalizedStructure;
		} catch (parseError) {
			logger.error("[AI] Failed to parse structure, creating minimal fallback:", parseError);

			// Create minimal structure from the prompt (use first 50 chars as title)
			const title = prompt.slice(0, 50) + (prompt.length > 50 ? "..." : "");

			return [
				{
					id: crypto.randomUUID(),
					type: "chapter",
					title: title,
					order: 1,
					length: "comprehensive",
					children: [
						{
							id: crypto.randomUUID(),
							type: "section",
							title: "Introduction",
							order: 1,
							length: "medium",
						},
						{
							id: crypto.randomUUID(),
							type: "section",
							title: "Main Content",
							order: 2,
							length: "comprehensive",
						},
						{
							id: crypto.randomUUID(),
							type: "section",
							title: "Conclusion",
							order: 3,
							length: "brief",
						},
					],
				},
			];
		}
	} catch (error) {
		logger.error("[AI] Failed to generate structure:", error);

		// If it's already a provider error, re-throw it
		if (error instanceof Error && error.message.includes("AI provider not configured")) {
			throw error;
		}

		throw new Error("Failed to generate structure. Please try again.");
	}
}

// ============================================================================
// Section Content Generation
// ============================================================================

interface SectionPromptParams {
	title: string;
	targetWords: number;
	tone: string;
	parentContext: string;
	keyPoints: string[];
}

/**
 * Build a prompt for section content generation.
 */
function buildSectionPrompt(params: SectionPromptParams): string {
	const { title, targetWords, tone, parentContext, keyPoints } = params;

	let prompt = `Generate content for the following document section:

Section Title: ${title}
Target Word Count: approximately ${targetWords} words
Tone: ${tone}`;

	if (parentContext) {
		prompt += `\n\nParent Section Context (for coherence):\n${parentContext}`;
	}

	if (keyPoints.length > 0) {
		prompt += `\n\nKey Points to Address:\n${keyPoints.map((point, i) => `${i + 1}. ${point}`).join("\n")}`;
	}

	prompt += `\n\nGenerate ${Math.max(2, Math.ceil(targetWords / 100))} well-structured paragraphs that flow naturally together.`;

	return prompt;
}

/**
 * Estimate the number of tokens needed for a target word count.
 * Includes a buffer for system prompt and overhead.
 */
function estimateTokens(targetWords: number): number {
	const contentTokens = Math.ceil(targetWords * TOKENS_PER_WORD);
	const overheadTokens = 500; // For system prompt, JSON structure, etc.
	return Math.min(contentTokens + overheadTokens, 4000);
}

/**
 * Parse the AI response and create DocumentContent.
 */
function parseContentResponse(responseContent: string, fallbackText: string): DocumentContent {
	let parsedJson = false;
	try {
		// Remove any markdown code block markers if present
		const cleanContent = responseContent
			.replace(/^```json\s*/i, "")
			.replace(/^```\s*/i, "")
			.replace(/```\s*$/i, "")
			.trim();

		const parsed = JSON.parse(cleanContent);
		parsedJson = true;

		// Handle both { paragraphs: [...] } and direct array formats
		const paragraphs = Array.isArray(parsed)
			? parsed
			: parsed.paragraphs || [];
		const usableParagraphs = Array.isArray(paragraphs)
			? paragraphs.map((text) => String(text).trim()).filter(Boolean)
			: [];

		if (usableParagraphs.length === 0) {
			throw new Error("Invalid response format: expected array of paragraphs");
		}

		return {
			type: "doc",
			content: usableParagraphs.map((text) => ({
				type: "paragraph",
				content: [{ type: "text", text }],
			})),
		};
	} catch (error) {
		logger.error("[AI] Failed to parse content response:", error);

		const text = parsedJson ? fallbackText : responseContent.trim() || fallbackText;
		return paragraphContent(text);
	}
}

/**
 * Generate content for a specific document section.
 * Considers context from parent sections and sibling content.
 */
export async function generateSectionContent(
	input: GenerateSectionInput
): Promise<{ content: DocumentContent; wordCount: number; charCount: number }> {
	await requireDocumentGenerationUserId();
	const { sectionTitle, parentContext, tone, length, keyPoints, references } = input;

	const targetWords = WORD_TARGETS[length];

	// Check if AI provider is available
	const manager = getProviderManager();
	const isAvailable = await manager.isAvailable();

	if (!isAvailable) {
		const errors: string[] = [];
		if (!process.env.AZURE_OPENAI_API_KEY) errors.push("AZURE_OPENAI_API_KEY");
		if (!process.env.AZURE_OPENAI_ENDPOINT) errors.push("AZURE_OPENAI_ENDPOINT");
		if (!process.env.AZURE_OPENAI_DEPLOYMENT_NAME) errors.push("AZURE_OPENAI_DEPLOYMENT_NAME");
		
		if (errors.length > 0) {
			throw new Error(`AI provider not available. Missing environment variables: ${errors.join(", ")}`);
		}
		throw new Error("AI provider not available. Please verify your Azure OpenAI configuration.");
	}

	// Build the AI prompt
	const prompt = buildSectionPrompt({
		title: sectionTitle,
		targetWords,
		tone,
		parentContext: parentContext || "",
		keyPoints: keyPoints || [],
	});

	try {
		// Call AI provider
		const response = await manager.complete({
			messages: [
				{ role: "system", content: SECTION_GENERATION_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			temperature: 0.7,
			maxTokens: estimateTokens(targetWords),
		});

		// Parse response and create DocumentContent
		const fallbackText = buildDeterministicSectionDraft({
			id: input.sectionId,
			type: "section",
			title: sectionTitle,
			order: 0,
			length,
			children: keyPoints?.map((point, index) => ({
				id: `${input.sectionId}-point-${index + 1}`,
				type: "paragraph",
				title: point,
				order: index + 1,
			})),
		}, parentContext || "");
		const content = parseContentResponse(response.content, fallbackText);

		// Calculate word and character counts
		const textContent = (content.content || [])
			.map((block) => {
				if (block.type === "paragraph" && Array.isArray(block.content)) {
					return block.content
						.map((item) => (item.type === "text" ? item.text : ""))
						.join("");
				}
				return "";
			})
			.join(" ");

		const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;
		const charCount = textContent.length;

		return { content, wordCount, charCount };
	} catch (error) {
		logger.error("[AI] Failed to generate section content:", error);
		throw new Error(
			error instanceof Error ? error.message : "Failed to generate section content. Please try again."
		);
	}
}

// ============================================================================
// Diagram Generation
// ============================================================================

/**
 * Build a prompt for diagram generation.
 */
function buildDiagramPrompt(description: string, type: string, style: string): string {
	const diagramTypeMap: Record<string, string> = {
		flowchart: "flowchart",
		sequence: "sequenceDiagram",
		class: "classDiagram",
		state: "stateDiagram-v2",
		gantt: "gantt",
		er: "erDiagram",
		mindmap: "mindmap",
	};

	const mermaidType = diagramTypeMap[type] || "flowchart";

	let prompt = `Generate a ${mermaidType} diagram based on the following description:

Description: ${description}

Style: ${style}`;

	if (style === "minimal") {
		prompt += "\n\nKeep the diagram simple and minimal with only essential elements.";
	} else if (style === "detailed") {
		prompt += "\n\nInclude detailed nodes, relationships, and annotations where appropriate.";
	}

	prompt += "\n\nGenerate valid Mermaid syntax that can be rendered directly.";

	return prompt;
}

function sanitizeDiagramLabel(value: string, fallback: string): string {
	const label = value
		.replace(/[`[\]{}<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 48);
	return label || fallback;
}

function deterministicMermaidDiagram(description: string, type: GenerateDiagramInput["type"]): string {
	const cleanDescription = sanitizeDiagramLabel(description, "Concept");
	const steps = description
		.replace(/\b(?:then|next|finally|after that)\b/gi, ".")
		.split(/[.;\n]+/)
		.map((part) => sanitizeDiagramLabel(part, "Step"))
		.filter((part) => part.length > 0)
		.slice(0, 5);
	const boundedSteps = steps.length >= 2 ? steps : [cleanDescription, "Review", "Outcome"];

	switch (type) {
		case "sequence":
			return [
				"sequenceDiagram",
				"  participant User",
				"  participant System",
				`  User->>System: ${boundedSteps[0]}`,
				`  System-->>User: ${boundedSteps[boundedSteps.length - 1]}`,
			].join("\n");
		case "state":
			return [
				"stateDiagram-v2",
				"  [*] --> Draft",
				"  Draft --> Review",
				"  Review --> Approved",
				"  Approved --> [*]",
			].join("\n");
		case "gantt":
			return [
				"gantt",
				`  title ${cleanDescription}`,
				"  dateFormat YYYY-MM-DD",
				"  section Delivery",
				"  Mobilize :a1, 2026-01-01, 14d",
				"  Execute :a2, after a1, 30d",
				"  Validate :a3, after a2, 10d",
			].join("\n");
		case "mindmap":
			return [
				"mindmap",
				`  root((${cleanDescription}))`,
				...boundedSteps.slice(0, 4).map((step) => `    ${step}`),
			].join("\n");
		case "class":
			return [
				"classDiagram",
				"  class ResponseArtifact",
				"  ResponseArtifact : +approach",
				"  ResponseArtifact : +evidence",
				"  ResponseArtifact : +outcome",
			].join("\n");
		case "er":
			return [
				"erDiagram",
				"  REQUIREMENT ||--o{ RESPONSE : drives",
				"  RESPONSE ||--o{ EVIDENCE : cites",
				"  RESPONSE ||--o{ OUTCOME : produces",
			].join("\n");
		default:
			return [
				"flowchart TD",
				...boundedSteps.map((step, index) => `  S${index + 1}[${step}]`),
				...boundedSteps.slice(0, -1).map((_, index) => `  S${index + 1} --> S${index + 2}`),
			].join("\n");
	}
}

function deterministicGeneratedDiagram(
	description: string,
	type: GenerateDiagramInput["type"],
	reason: string
): GeneratedDiagram {
	if (type === "napkin") {
		const cleanDesc = description.slice(0, 200);
		return {
			type: "napkin",
			code: `
┌─────────────────────────────────────┐
│         CONCEPT SKETCH              │
├─────────────────────────────────────┤
│                                     │
│  ${cleanDesc.slice(0, 35).padEnd(35)}  │
│  ${cleanDesc.slice(35, 70).padEnd(35)}  │
│  ${cleanDesc.slice(70, 105).padEnd(35)}  │
│                                     │
│     ┌───────┐      ┌───────┐       │
│     │ Input │ ───► │ Output│       │
│     └───────┘      └───────┘       │
│                                     │
└─────────────────────────────────────┘
`.trim(),
			description: `Napkin sketch concept for: ${cleanDesc}`,
		};
	}

	return {
		type: "mermaid",
		code: deterministicMermaidDiagram(description, type),
		description: `Deterministic ${type} diagram generated because ${reason}: ${description.slice(0, 100)}...`,
	};
}

/**
 * Generate diagrams using AI-powered Mermaid code generation.
 */
export async function generateDiagram(
	input: GenerateDiagramInput
): Promise<GeneratedDiagram> {
	await requireDocumentGenerationUserId();
	const { description, type, style = "modern" } = input;

	// Check if AI provider is available
	const manager = getProviderManager();
	const isAvailable = await manager.isAvailable();

	if (!isAvailable) {
		return deterministicGeneratedDiagram(description, type, "AI provider is unavailable");
	}

	// Build the AI prompt
	const prompt = buildDiagramPrompt(description, type, style);

	try {
		// Call AI provider
		const response = await manager.complete({
			messages: [
				{ role: "system", content: DIAGRAM_GENERATION_SYSTEM_PROMPT },
				{ role: "user", content: prompt },
			],
			temperature: 0.3, // Lower temperature for more consistent syntax
			maxTokens: 2000,
		});

		// Clean up the response to extract just the Mermaid code
		let code = response.content.trim();

		// Remove markdown code block markers if present
		code = code
			.replace(/^```mermaid\s*/i, "")
			.replace(/^```\s*/i, "")
			.replace(/```\s*$/i, "")
			.trim();
		if (code.length === 0) {
			throw new Error("AI diagram response was empty");
		}

		return {
			type: "mermaid",
			code,
			description: `Generated ${type} diagram based on: ${description.slice(0, 100)}...`,
		};
	} catch (error) {
		logger.error("[AI] Failed to generate diagram:", error);
		return deterministicGeneratedDiagram(description, type, "AI diagram generation failed");
	}
}

/**
 * Convert Mermaid code to SVG using Kroki API for server-side rendering.
 * Kroki is a unified diagram API that supports Mermaid and many other formats.
 */
export async function renderMermaidToSvg(code: string): Promise<string> {
	// Use Kroki API for server-side Mermaid rendering
	const KROKI_URL = process.env.KROKI_URL || "https://kroki.io";

	try {
		// Compress and encode the diagram code
		const encoder = new TextEncoder();
		const data = encoder.encode(code);

		// Use deflate compression
		const stream = new CompressionStream("deflate");
		const writer = stream.writable.getWriter();
		writer.write(data);
		writer.close();

		const compressedData = await new Response(stream.readable).arrayBuffer();
		const base64 = btoa(String.fromCharCode(...new Uint8Array(compressedData)));

		// Convert to URL-safe base64
		const urlSafeBase64 = base64.replace(/\+/g, "-").replace(/\//g, "_");

		// Fetch SVG from Kroki
		const response = await fetch(`${KROKI_URL}/mermaid/svg/${urlSafeBase64}`, {
			method: "GET",
			headers: {
				"Accept": "image/svg+xml",
			},
		});

		if (!response.ok) {
			// If Kroki fails, try posting the raw code
			const postResponse = await fetch(`${KROKI_URL}/mermaid/svg`, {
				method: "POST",
				headers: {
					"Content-Type": "text/plain",
					"Accept": "image/svg+xml",
				},
				body: code,
			});

			if (!postResponse.ok) {
				throw new Error(`Kroki API error: ${postResponse.status} ${postResponse.statusText}`);
			}

			return await postResponse.text();
		}

		return await response.text();
	} catch (error) {
		logger.error("Failed to render Mermaid diagram:", error);

		// Fallback: return an error SVG with the error message
		const errorMessage = error instanceof Error ? error.message : "Rendering failed";
		const escapedMessage = errorMessage
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.slice(0, 100);

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
			<rect width="800" height="600" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>
			<text x="400" y="280" text-anchor="middle" font-family="system-ui" font-size="16" fill="#dc2626" font-weight="bold">
				Diagram Rendering Error
			</text>
			<text x="400" y="320" text-anchor="middle" font-family="system-ui" font-size="12" fill="#666">
				${escapedMessage}
			</text>
		</svg>`;
	}
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Generate multiple sections in parallel with progress tracking.
 */
export async function generateMultipleSections(
	inputs: GenerateSectionInput[]
): Promise<Map<string, { content: DocumentContent; wordCount: number }>> {
	const results = new Map<string, { content: DocumentContent; wordCount: number }>();

	// Process in batches to avoid overwhelming the API
	const batchSize = 3;
	for (let i = 0; i < inputs.length; i += batchSize) {
		const batch = inputs.slice(i, i + batchSize);
		const batchResults = await Promise.all(
			batch.map(async (input) => {
				const result = await generateSectionContent(input);
				return { id: input.sectionId, result };
			})
		);

		for (const { id, result } of batchResults) {
			results.set(id, result);
		}
	}

	return results;
}

// ============================================================================
// Document Creation from Structure
// ============================================================================

/**
 * Create an editable outline document from a generated structure.
 */
export async function createDocumentFromStructure(
	title: string,
	structure: DocumentStructure[],
	userId: string,
	options?: {
		autoFill?: boolean;
		tone?: string;
		templateId?: string;
	}
): Promise<{ id: string; content: DocumentContent }> {
	try {
		const currentUserId = await requireDocumentGenerationUserId(userId);
		logger.debug("[Server] createDocumentFromStructure called", { title, structureCount: structure.length, userId: currentUserId });
		const generatedSections = options?.autoFill
			? await generateAutofillSections(structure, options.tone || "professional")
			: new Map<string, GeneratedSectionContent>();
		const content = structureToDocumentContent(structure, generatedSections);
		const wordCount = Array.from(generatedSections.values()).reduce((sum, section) => sum + section.wordCount, 0);

		const [doc] = await db
			.insert(documents)
			.values({
				title,
				content,
				ownerId: currentUserId,
				templateId: options?.templateId ? uuidv4() : null,
				status: "draft",
				wordCount,
			})
			.returning();

		// Create initial version
		await db.insert(documentVersions).values({
			documentId: doc.id,
			versionNumber: 1,
			content,
			changeDescription: "Document created from AI-generated structure",
			createdBy: currentUserId,
		});

		logger.debug("[Server] Document created successfully:", doc.id);
		return { id: doc.id, content };
	} catch (error) {
		logger.error("[Server] Failed to create document:", error);
		throw error;
	}
}

async function generateAutofillSections(
	structure: DocumentStructure[],
	tone: string
): Promise<Map<string, GeneratedSectionContent>> {
	const generated = new Map<string, GeneratedSectionContent>();

	async function processNode(node: DocumentStructure, path: string[], parentContext: string) {
		const sectionPath = [...path, node.title];
		try {
			const result = await generateSectionContent({
				documentId: "new-document",
				sectionId: node.id,
				sectionPath,
				sectionTitle: node.title,
				parentContext,
				tone,
				length: node.length || "medium",
				keyPoints: node.children?.map((child) => child.title) || [],
			});
			generated.set(node.id, {
				content: result.content,
				wordCount: result.wordCount,
			});
		} catch (error) {
			logger.warn("[Server] Auto-fill section generation failed; using deterministic section draft", {
				sectionId: node.id,
				title: node.title,
				error,
			});
			const fallbackText = buildDeterministicSectionDraft(node, parentContext);
			generated.set(node.id, {
				content: paragraphContent(fallbackText),
				wordCount: countWords(fallbackText),
			});
		}

		for (const child of node.children || []) {
			await processNode(child, sectionPath, node.title);
		}
	}

	for (const node of structure) {
		await processNode(node, [], "");
	}

	return generated;
}

function buildDeterministicSectionDraft(node: DocumentStructure, parentContext: string): string {
	const childTopics = node.children?.map((child) => child.title).filter(Boolean) || [];
	const scope = parentContext ? ` within ${parentContext}` : "";
	const topics = childTopics.length > 0
		? ` It should address ${childTopics.join(", ")} with concrete evidence, ownership, and measurable outcomes.`
		: " It should connect the proposed approach to evaluator requirements, proof points, and delivery outcomes.";
	return `${node.title}${scope} frames the response content for this part of the proposal.${topics}`;
}

function paragraphContent(text: string): DocumentContent {
	return {
		type: "doc",
		content: [{
			type: "paragraph",
			content: [{ type: "text", text }],
		}],
	};
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

function structureToDocumentContent(
	structure: DocumentStructure[],
	generatedSections = new Map<string, GeneratedSectionContent>()
): DocumentContent {
	const content: DocumentBlock[] = [];

	function processNode(node: DocumentStructure, level: number) {
		// Add heading
		const headingType = level === 0 ? "heading" : level === 1 ? "heading" : "heading";
		const headingLevel = level === 0 ? 1 : level === 1 ? 2 : 3;

		content.push({
			type: "heading",
			attrs: { level: headingLevel },
			content: [{ type: "text", text: node.title }],
		});

		const generated = generatedSections.get(node.id);
		if (generated?.content.content?.length) {
			content.push(...(generated.content.content as DocumentBlock[]));
		} else {
			content.push({
				type: "paragraph",
				content: [],
			});
		}

		// Process children
		if (node.children?.length) {
			for (const child of node.children) {
				processNode(child, level + 1);
			}
		}
	}

	for (const node of structure) {
		processNode(node, 0);
	}

	return { type: "doc", content };
}

// Helper
function uuidv4(): string {
	return crypto.randomUUID();
}
