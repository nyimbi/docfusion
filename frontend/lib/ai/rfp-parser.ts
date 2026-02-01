/**
 * AI Integration for RFP Parsing and Requirements Extraction
 *
 * Provides AI-powered functions for:
 * - RFP document parsing and structure detection
 * - Requirements extraction and classification
 * - Ambiguity detection and clarification generation
 * - Compliance matching and scoring
 */

import { getAIClient } from "./client";
import type {
	RfpRequirementCategory,
	RfpRequirementType,
	RfpRequirementPriority,
	RfpRiskLevel,
	AmbiguityLevel,
} from "@/lib/types/rfp";

// ============================================================================
// Types
// ============================================================================

export interface RFPParserConfig {
	model?: string;
	temperature: number;
	maxTokens: number;
}

export interface ParsedRFP {
	/** Identified issuing agency */
	issuingAgency?: string;
	/** Solicitation/RFP number */
	solicitationNumber?: string;
	/** Response deadline */
	responseDeadline?: string;
	/** Question/inquiry deadline */
	questionDeadline?: string;
	/** Contract type (FFP, T&M, CPFF, etc.) */
	contractType?: string;
	/** NAICS code */
	naicsCode?: string;
	/** Set-aside type */
	setAside?: string;
	/** Estimated contract value */
	estimatedValue?: number;
	/** Key sections identified */
	sections: Array<{
		sectionId: string;
		title: string;
		pageStart: number;
		pageEnd: number;
		content: string;
	}>;
	/** Confidence score for the parsing (0-1) */
	confidence: number;
}

export interface ExtractedRequirement {
	/** Requirement ID from document (e.g., "L.5.2.1") */
	requirementNumber: string;
	/** Section reference (e.g., "Section L, Para 5.2.1") */
	sectionReference?: string;
	/** Short title */
	title?: string;
	/** Full requirement text */
	fullText: string;
	/** AI-generated summary */
	summary?: string;
	/** Requirement category */
	category: RfpRequirementCategory;
	/** Sub-category */
	subcategory?: string;
	/** Requirement type based on language */
	requirementType: RfpRequirementType;
	/** Priority level */
	priority: RfpRequirementPriority;
	/** Evaluation weight if specified */
	evaluationWeight?: number;
	/** Scoring method if specified */
	scoringMethod?: string;
	/** AI confidence score */
	confidenceScore: number;
	/** Related requirement IDs */
	relatedRequirements?: string[];
	/** Page number in source document */
	pageNumber?: number;
}

export interface RequirementClassification {
	category: RfpRequirementCategory;
	subcategory?: string;
	requirementType: RfpRequirementType;
	priority: RfpRequirementPriority;
	confidence: number;
	reasoning: string;
}

export interface AmbiguityAnalysis {
	isAmbiguous: boolean;
	ambiguityLevel: AmbiguityLevel;
	reasons: string[];
	suggestedClarifications: string[];
	riskLevel: RfpRiskLevel;
}

export interface ComplianceMatch {
	requirementId: string;
	contentId: string;
	matchScore: number;
	matchType: "exact" | "partial" | "semantic";
	matchedText: string;
	gaps?: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: RFPParserConfig = {
	temperature: 0.1, // Low temperature for consistent extraction
	maxTokens: 4096,
};

// ============================================================================
// Prompts
// ============================================================================

const PARSE_RFP_PROMPT = `You are an expert government RFP analyst. Parse the following RFP document and extract key metadata and structure.

Extract:
1. Issuing Agency name
2. Solicitation/RFP Number
3. Response deadline (if specified)
4. Question deadline (if specified)
5. Contract type (FFP, T&M, CPFF, IDIQ, etc.)
6. NAICS code
7. Set-aside type (if any)
8. Estimated value (if specified)
9. Major sections with page ranges

Respond in JSON format only:
{
  "issuingAgency": "string or null",
  "solicitationNumber": "string or null",
  "responseDeadline": "ISO date string or null",
  "questionDeadline": "ISO date string or null",
  "contractType": "string or null",
  "naicsCode": "string or null",
  "setAside": "string or null",
  "estimatedValue": "number or null",
  "sections": [
    {
      "sectionId": "string",
      "title": "string",
      "pageStart": "number",
      "pageEnd": "number",
      "content": "brief summary of section content"
    }
  ],
  "confidence": "number 0-1"
}

Document text:
`;

const EXTRACT_REQUIREMENTS_PROMPT = `You are an expert government proposal analyst specializing in RFP requirements extraction.

Extract ALL requirements from the following RFP text. For each requirement:
1. Identify the requirement number/ID if present (e.g., "L.5.2.1")
2. Note the section reference
3. Extract the full requirement text
4. Generate a brief summary
5. Classify the category: technical, management, past_performance, cost, administrative, personnel, security, compliance, other
6. Determine the requirement type: shall (mandatory), should (preferred), may (optional), will (informational)
7. Assess priority: mandatory, preferred, optional
8. Note any evaluation weight or scoring method mentioned
9. Identify related requirements

Respond in JSON format only:
{
  "requirements": [
    {
      "requirementNumber": "string",
      "sectionReference": "string or null",
      "title": "string or null",
      "fullText": "string",
      "summary": "string",
      "category": "technical|management|past_performance|cost|administrative|personnel|security|compliance|other",
      "subcategory": "string or null",
      "requirementType": "shall|should|may|will",
      "priority": "mandatory|preferred|optional",
      "evaluationWeight": "number or null",
      "scoringMethod": "string or null",
      "confidenceScore": "number 0-1",
      "relatedRequirements": ["string"],
      "pageNumber": "number or null"
    }
  ]
}

RFP Text:
`;

const CLASSIFY_REQUIREMENT_PROMPT = `You are an expert at classifying government RFP requirements.

Classify the following requirement:

Requirement: {requirement}

Determine:
1. Category (technical, management, past_performance, cost, administrative, personnel, security, compliance, other)
2. Subcategory (if applicable)
3. Requirement type (shall = mandatory, should = preferred, may = optional, will = informational)
4. Priority (mandatory, preferred, optional)

Respond in JSON only:
{
  "category": "string",
  "subcategory": "string or null",
  "requirementType": "shall|should|may|will",
  "priority": "mandatory|preferred|optional",
  "confidence": "number 0-1",
  "reasoning": "brief explanation"
}
`;

const DETECT_AMBIGUITY_PROMPT = `You are an expert at identifying ambiguous requirements in government RFPs.

Analyze the following requirement for ambiguity:

Requirement: {requirement}

Identify:
1. Is it ambiguous? (yes/no)
2. Ambiguity level (clear, somewhat_ambiguous, very_ambiguous)
3. Specific reasons for ambiguity
4. Suggested clarification questions
5. Risk level (critical, high, medium, low)

Respond in JSON only:
{
  "isAmbiguous": true/false,
  "ambiguityLevel": "clear|somewhat_ambiguous|very_ambiguous",
  "reasons": ["string"],
  "suggestedClarifications": ["string"],
  "riskLevel": "critical|high|medium|low"
}
`;

const MATCH_CONTENT_PROMPT = `You are an expert at matching proposal content to RFP requirements.

Requirement: {requirement}

Content to evaluate: {content}

Determine how well the content addresses the requirement:
1. Match score (0-100)
2. Match type (exact, partial, semantic)
3. What text specifically addresses the requirement
4. What gaps exist

Respond in JSON only:
{
  "matchScore": "number 0-100",
  "matchType": "exact|partial|semantic",
  "matchedText": "string",
  "gaps": ["string"]
}
`;

// ============================================================================
// Helper Function - Parse JSON Response
// ============================================================================

/**
 * Parse AI response, handling potential markdown code blocks.
 */
function parseJsonResponse<T>(content: string): T {
	// Remove markdown code blocks if present
	const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
	return JSON.parse(jsonStr) as T;
}

// ============================================================================
// AI Functions
// ============================================================================

/**
 * Parse RFP document and extract structure and metadata.
 */
export async function parseRFPWithAI(
	text: string,
	config: Partial<RFPParserConfig> = {}
): Promise<ParsedRFP> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert government RFP analyst. Always respond with valid JSON only, no additional text.",
				},
				{
					role: "user",
					content: PARSE_RFP_PROMPT + text.slice(0, 50000), // Limit input size
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: finalConfig.maxTokens,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return parseJsonResponse<ParsedRFP>(content);
	} catch (error) {
		console.error("Error parsing RFP with AI:", error);
		throw new Error(`Failed to parse RFP: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Extract requirements from RFP text.
 */
export async function extractRequirementsWithAI(
	text: string,
	config: Partial<RFPParserConfig> = {}
): Promise<ExtractedRequirement[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert government proposal analyst. Always respond with valid JSON only, no additional text.",
				},
				{
					role: "user",
					content: EXTRACT_REQUIREMENTS_PROMPT + text.slice(0, 50000),
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: finalConfig.maxTokens,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		const parsed = parseJsonResponse<{ requirements: ExtractedRequirement[] }>(content);
		return parsed.requirements;
	} catch (error) {
		console.error("Error extracting requirements with AI:", error);
		throw new Error(`Failed to extract requirements: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Classify a single requirement.
 */
export async function classifyRequirementWithAI(
	requirement: string,
	config: Partial<RFPParserConfig> = {}
): Promise<RequirementClassification> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at classifying government RFP requirements. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: CLASSIFY_REQUIREMENT_PROMPT.replace("{requirement}", requirement),
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: 1024,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return parseJsonResponse<RequirementClassification>(content);
	} catch (error) {
		console.error("Error classifying requirement with AI:", error);
		throw new Error(`Failed to classify requirement: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Detect ambiguity in a requirement.
 */
export async function detectAmbiguityWithAI(
	requirement: string,
	config: Partial<RFPParserConfig> = {}
): Promise<AmbiguityAnalysis> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at identifying ambiguous requirements. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: DETECT_AMBIGUITY_PROMPT.replace("{requirement}", requirement),
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: 1024,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return parseJsonResponse<AmbiguityAnalysis>(content);
	} catch (error) {
		console.error("Error detecting ambiguity with AI:", error);
		throw new Error(`Failed to detect ambiguity: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Generate clarification questions for ambiguous requirements.
 */
export async function generateClarificationQuestions(
	requirement: string,
	context?: string,
	config: Partial<RFPParserConfig> = {}
): Promise<string[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const prompt = `Generate clarification questions for the following requirement that would help remove ambiguity and ensure accurate proposal response.

Requirement: ${requirement}
${context ? `Context: ${context}` : ""}

Generate 3-5 specific, professional clarification questions that could be submitted during the Q&A period.

Respond in JSON format only:
{
  "questions": ["string"]
}`;

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert government proposal professional. Generate professional clarification questions. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.3,
				maxTokens: 1024,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		const parsed = parseJsonResponse<{ questions: string[] }>(content);
		return parsed.questions;
	} catch (error) {
		console.error("Error generating clarification questions:", error);
		return [];
	}
}

/**
 * Match proposal content to a requirement.
 */
export async function matchRequirementToContent(
	requirement: string,
	content: string,
	config: Partial<RFPParserConfig> = {}
): Promise<ComplianceMatch> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at matching proposal content to RFP requirements. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: MATCH_CONTENT_PROMPT
						.replace("{requirement}", requirement)
						.replace("{content}", content.slice(0, 10000)),
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: 1024,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		const parsed = parseJsonResponse<Omit<ComplianceMatch, "requirementId" | "contentId">>(responseContent);

		return {
			requirementId: "", // To be filled by caller
			contentId: "", // To be filled by caller
			...parsed,
		};
	} catch (error) {
		console.error("Error matching content to requirement:", error);
		throw new Error(`Failed to match content: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Batch extract requirements from multiple sections.
 */
export async function batchExtractRequirements(
	sections: Array<{ id: string; text: string; pageNumber?: number }>,
	config: Partial<RFPParserConfig> = {}
): Promise<Map<string, ExtractedRequirement[]>> {
	const results = new Map<string, ExtractedRequirement[]>();

	// Process sections in parallel with concurrency limit
	const CONCURRENCY_LIMIT = 3;
	const chunks: Array<typeof sections> = [];

	for (let i = 0; i < sections.length; i += CONCURRENCY_LIMIT) {
		chunks.push(sections.slice(i, i + CONCURRENCY_LIMIT));
	}

	for (const chunk of chunks) {
		const promises = chunk.map(async (section) => {
			try {
				const requirements = await extractRequirementsWithAI(section.text, config);
				// Add page number to each requirement
				const withPageNumbers = requirements.map((req) => ({
					...req,
					pageNumber: req.pageNumber ?? section.pageNumber,
				}));
				return { sectionId: section.id, requirements: withPageNumbers };
			} catch (error) {
				console.error(`Error extracting from section ${section.id}:`, error);
				return { sectionId: section.id, requirements: [] };
			}
		});

		const chunkResults = await Promise.all(promises);
		for (const result of chunkResults) {
			results.set(result.sectionId, result.requirements);
		}
	}

	return results;
}

/**
 * Generate a compliance status summary for a set of requirements.
 */
export async function generateComplianceSummary(
	requirements: Array<{
		requirement: string;
		status: string;
		response?: string;
	}>,
	config: Partial<RFPParserConfig> = {}
): Promise<{
	overallCompliance: number;
	summary: string;
	criticalGaps: string[];
	recommendations: string[];
}> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const prompt = `Analyze the following compliance status for RFP requirements and provide a summary:

Requirements:
${JSON.stringify(requirements, null, 2)}

Provide:
1. Overall compliance percentage (0-100)
2. Brief summary of compliance status
3. List of critical gaps that must be addressed
4. Recommendations for improvement

Respond in JSON only:
{
  "overallCompliance": number,
  "summary": "string",
  "criticalGaps": ["string"],
  "recommendations": ["string"]
}`;

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert compliance analyst. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.2,
				maxTokens: 2048,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return parseJsonResponse(content);
	} catch (error) {
		console.error("Error generating compliance summary:", error);
		return {
			overallCompliance: 0,
			summary: "Error generating compliance summary",
			criticalGaps: [],
			recommendations: [],
		};
	}
}

/**
 * Analyze evaluation criteria from Section M.
 */
export async function analyzeEvaluationCriteria(
	sectionMText: string,
	config: Partial<RFPParserConfig> = {}
): Promise<{
	criteria: Array<{
		name: string;
		weight?: number;
		description: string;
		subfactors?: Array<{ name: string; weight?: number; description: string }>;
	}>;
	evaluationMethod: string;
	confidence: number;
}> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const prompt = `Analyze the following Section M (Evaluation Criteria) text and extract the evaluation structure:

${sectionMText}

Extract:
1. Each evaluation factor/criterion with weight if specified
2. Subfactors for each main factor
3. The overall evaluation method (LPTA, Best Value, Trade-off, etc.)

Respond in JSON only:
{
  "criteria": [
    {
      "name": "string",
      "weight": "number or null (percentage)",
      "description": "string",
      "subfactors": [
        {
          "name": "string",
          "weight": "number or null",
          "description": "string"
        }
      ]
    }
  ],
  "evaluationMethod": "LPTA|Best Value|Trade-off|Other",
  "confidence": "number 0-1"
}`;

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at analyzing government RFP evaluation criteria. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: 2048,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return parseJsonResponse(content);
	} catch (error) {
		console.error("Error analyzing evaluation criteria:", error);
		return {
			criteria: [],
			evaluationMethod: "Unknown",
			confidence: 0,
		};
	}
}

/**
 * Generate a proposal outline based on RFP requirements.
 */
export async function generateProposalOutline(
	requirements: ExtractedRequirement[],
	evaluationCriteria?: Array<{ name: string; weight?: number }>,
	config: Partial<RFPParserConfig> = {}
): Promise<{
	sections: Array<{
		title: string;
		description: string;
		requirementIds: string[];
		suggestedPageCount: number;
		priority: "high" | "medium" | "low";
	}>;
	recommendations: string[];
}> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const prompt = `Based on the following RFP requirements${evaluationCriteria ? " and evaluation criteria" : ""}, generate a proposal outline:

Requirements:
${JSON.stringify(requirements.slice(0, 50), null, 2)}

${evaluationCriteria ? `Evaluation Criteria:\n${JSON.stringify(evaluationCriteria, null, 2)}` : ""}

Generate a proposal outline that:
1. Groups related requirements into logical sections
2. Aligns with evaluation criteria priorities
3. Suggests page counts based on requirement complexity
4. Identifies high-priority sections

Respond in JSON only:
{
  "sections": [
    {
      "title": "string",
      "description": "string",
      "requirementIds": ["string"],
      "suggestedPageCount": "number",
      "priority": "high|medium|low"
    }
  ],
  "recommendations": ["string"]
}`;

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert proposal manager. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.3,
				maxTokens: 4096,
			}
		);

		const content = response.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return parseJsonResponse(content);
	} catch (error) {
		console.error("Error generating proposal outline:", error);
		return {
			sections: [],
			recommendations: [],
		};
	}
}
