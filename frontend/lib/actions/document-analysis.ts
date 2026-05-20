/**
 * Document Analysis Server Actions - DocFusion
 *
 * Server actions for AI-powered document analysis with 30+ factors
 * across clarity, compliance, persuasiveness, and technical quality.
 */

"use server";

import { db } from "@/lib/db";
import { documents, documentAnalyses, paragraphAnalyses, proposalDocuments } from "@/lib/db/schema";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import { getProviderManager } from "@/lib/ai/providers";
import { getCurrentUserId } from "@/lib/auth-utils";
import type {
	DocumentAnalysis,
	ParagraphAnalysis,
	AnalyzeDocumentInput,
	AnalysisHistoryEntry,
	AnalysisFactor,
	AnalysisFactorCategory,
	CategoryScore,
	AnalysisIssue,
	AnalysisSuggestion,
	IssueSeverity,
	SuggestionImpact,
} from "@/lib/types/opportunity";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Analysis Factor Definitions (30+ Factors)
// ============================================================================

interface FactorDefinition {
	id: string;
	name: string;
	category: AnalysisFactorCategory;
	description: string;
	weight: number;
}

/**
 * Complete list of 32 analysis factors across 4 categories.
 */
const ANALYSIS_FACTORS: FactorDefinition[] = [
	// === Clarity & Readability (8 factors) ===
	{
		id: "sentence_complexity",
		name: "Sentence Complexity",
		category: "clarity",
		description: "Average words per sentence (target: 15-20)",
		weight: 0.12,
	},
	{
		id: "passive_voice",
		name: "Passive Voice Usage",
		category: "clarity",
		description: "Percentage of passive voice constructions (target: <15%)",
		weight: 0.10,
	},
	{
		id: "jargon_density",
		name: "Jargon Density",
		category: "clarity",
		description: "Technical terms without explanation",
		weight: 0.08,
	},
	{
		id: "readability_score",
		name: "Readability Score",
		category: "clarity",
		description: "Flesch-Kincaid grade level (target: 10-12)",
		weight: 0.15,
	},
	{
		id: "paragraph_length",
		name: "Paragraph Length",
		category: "clarity",
		description: "Consistency of paragraph lengths",
		weight: 0.08,
	},
	{
		id: "transition_words",
		name: "Transition Word Usage",
		category: "clarity",
		description: "Logical flow between paragraphs",
		weight: 0.12,
	},
	{
		id: "acronym_definitions",
		name: "Acronym Definitions",
		category: "clarity",
		description: "All acronyms defined on first use",
		weight: 0.10,
	},
	{
		id: "grammar_accuracy",
		name: "Grammar & Spelling",
		category: "clarity",
		description: "Grammar and spelling accuracy",
		weight: 0.25,
	},

	// === Compliance & Responsiveness (8 factors) ===
	{
		id: "requirement_coverage",
		name: "Requirement Coverage",
		category: "compliance",
		description: "Percentage of requirements addressed",
		weight: 0.20,
	},
	{
		id: "compliance_statements",
		name: "Explicit Compliance",
		category: "compliance",
		description: "Clear compliance/non-compliance statements",
		weight: 0.15,
	},
	{
		id: "page_limit",
		name: "Page/Word Limits",
		category: "compliance",
		description: "Adherence to specified limits",
		weight: 0.12,
	},
	{
		id: "required_sections",
		name: "Required Sections",
		category: "compliance",
		description: "All mandatory sections present",
		weight: 0.15,
	},
	{
		id: "evaluation_alignment",
		name: "Evaluation Criteria",
		category: "compliance",
		description: "Alignment with stated evaluation criteria",
		weight: 0.12,
	},
	{
		id: "mandatory_keywords",
		name: "Mandatory Keywords",
		category: "compliance",
		description: "Inclusion of required terminology",
		weight: 0.08,
	},
	{
		id: "cross_references",
		name: "Cross-Reference Accuracy",
		category: "compliance",
		description: "Internal references are accurate",
		weight: 0.10,
	},
	{
		id: "attachment_completeness",
		name: "Attachment Completeness",
		category: "compliance",
		description: "All required attachments referenced",
		weight: 0.08,
	},

	// === Persuasiveness & Strength (8 factors) ===
	{
		id: "value_proposition",
		name: "Value Proposition",
		category: "persuasiveness",
		description: "Clarity of unique value offered",
		weight: 0.18,
	},
	{
		id: "benefit_feature_ratio",
		name: "Benefit-to-Feature Ratio",
		category: "persuasiveness",
		description: "Benefits emphasized over features",
		weight: 0.12,
	},
	{
		id: "quantified_claims",
		name: "Quantified Claims",
		category: "persuasiveness",
		description: "Percentage of claims with metrics",
		weight: 0.15,
	},
	{
		id: "proof_points",
		name: "Proof Point Density",
		category: "persuasiveness",
		description: "Evidence supporting claims",
		weight: 0.12,
	},
	{
		id: "differentiators",
		name: "Differentiator Prominence",
		category: "persuasiveness",
		description: "Competitive advantages highlighted",
		weight: 0.15,
	},
	{
		id: "risk_mitigation",
		name: "Risk Mitigation Coverage",
		category: "persuasiveness",
		description: "Proactive risk addressing",
		weight: 0.10,
	},
	{
		id: "win_themes",
		name: "Win Theme Consistency",
		category: "persuasiveness",
		description: "Key themes reinforced throughout",
		weight: 0.10,
	},
	{
		id: "call_to_action",
		name: "Call-to-Action Strength",
		category: "persuasiveness",
		description: "Clear next steps and urgency",
		weight: 0.08,
	},

	// === Technical Quality (8 factors) ===
	{
		id: "technical_depth",
		name: "Technical Depth",
		category: "technical",
		description: "Appropriate level of technical detail",
		weight: 0.15,
	},
	{
		id: "methodology_completeness",
		name: "Methodology Completeness",
		category: "technical",
		description: "Full approach description",
		weight: 0.15,
	},
	{
		id: "schedule_realism",
		name: "Schedule Realism",
		category: "technical",
		description: "Timeline feasibility",
		weight: 0.12,
	},
	{
		id: "resource_adequacy",
		name: "Resource Adequacy",
		category: "technical",
		description: "Sufficient resources allocated",
		weight: 0.12,
	},
	{
		id: "innovation_indicators",
		name: "Innovation Indicators",
		category: "technical",
		description: "Novel approaches presented",
		weight: 0.12,
	},
	{
		id: "past_performance_relevance",
		name: "Past Performance Relevance",
		category: "technical",
		description: "Experience relevance to requirements",
		weight: 0.12,
	},
	{
		id: "tool_technology_fit",
		name: "Tool & Technology Fit",
		category: "technical",
		description: "Appropriate technology choices",
		weight: 0.12,
	},
	{
		id: "quality_assurance",
		name: "Quality Assurance Plan",
		category: "technical",
		description: "QA processes defined",
		weight: 0.10,
	},
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract plain text from Tiptap JSON content.
 */
function extractText(content: unknown): string {
	if (!content || typeof content !== "object") return "";

	const doc = content as { type?: string; content?: unknown[]; text?: string };
	if (doc.type === "text" && doc.text) {
		return doc.text;
	}

	if (Array.isArray(doc.content)) {
		return doc.content.map(extractText).join("\n");
	}

	return "";
}

/**
 * Extract paragraphs from Tiptap JSON content.
 */
function extractParagraphs(content: unknown): string[] {
	if (!content || typeof content !== "object") return [];

	const doc = content as { type?: string; content?: unknown[] };
	if (!Array.isArray(doc.content)) return [];

	const paragraphs: string[] = [];

	for (const node of doc.content) {
		const n = node as { type?: string; content?: unknown[] };
		if (n.type === "paragraph" && Array.isArray(n.content)) {
			const text = n.content
				.map((c) => (c as { text?: string }).text || "")
				.join("");
			if (text.trim()) {
				paragraphs.push(text);
			}
		}
	}

	return paragraphs;
}

/**
 * Count words in text.
 */
function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate average sentence length.
 */
function averageSentenceLength(text: string): number {
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	if (sentences.length === 0) return 0;
	const totalWords = sentences.reduce((sum, s) => sum + countWords(s), 0);
	return totalWords / sentences.length;
}

/**
 * Calculate passive voice percentage (heuristic).
 */
function passiveVoicePercentage(text: string): number {
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	if (sentences.length === 0) return 0;

	// Simple heuristic: look for "was/were/been/being + past participle" patterns
	const passivePatterns = [
		/\b(was|were|been|being|is|are|am)\s+\w+ed\b/gi,
		/\b(was|were|been|being|is|are|am)\s+\w+en\b/gi,
	];

	let passiveCount = 0;
	for (const sentence of sentences) {
		for (const pattern of passivePatterns) {
			if (pattern.test(sentence)) {
				passiveCount++;
				break;
			}
		}
	}

	return (passiveCount / sentences.length) * 100;
}

/**
 * Calculate Flesch-Kincaid grade level.
 */
function fleschKincaidGrade(text: string): number {
	const words = text.trim().split(/\s+/).filter(Boolean);
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

	if (words.length === 0 || sentences.length === 0) return 0;

	// Syllable count (approximation)
	const syllables = words.reduce((sum, word) => {
		return sum + Math.max(1, word.replace(/[^aeiouy]/gi, "").length);
	}, 0);

	const grade =
		0.39 * (words.length / sentences.length) +
		11.8 * (syllables / words.length) -
		15.59;

	return Math.max(0, Math.min(20, grade));
}

/**
 * Find undefined acronyms.
 */
function findUndefinedAcronyms(text: string): string[] {
	// Find all uppercase acronyms (2+ letters)
	const acronymPattern = /\b[A-Z]{2,}\b/g;
	const matches = text.match(acronymPattern) || [];
	const unique = [...new Set(matches)];

	// Check if each has a definition (simplified check)
	const undefined: string[] = [];
	for (const acronym of unique) {
		// Look for "Full Name (ACRONYM)" or "ACRONYM (Full Name)" patterns
		const definitionPattern = new RegExp(
			`\\([^)]*${acronym}[^)]*\\)|${acronym}\\s*\\([^)]+\\)`,
			"i"
		);
		if (!definitionPattern.test(text)) {
			undefined.push(acronym);
		}
	}

	return undefined.filter((a) => !["RFP", "EOI", "SOW", "PDF", "API", "IT", "US", "UK"].includes(a));
}

/**
 * Find weak language patterns.
 */
function findWeakLanguage(text: string): { text: string; suggestion: string }[] {
	const weakPatterns = [
		{ pattern: /\bwe think\b/gi, suggestion: "We are confident" },
		{ pattern: /\bwe believe\b/gi, suggestion: "We are certain" },
		{ pattern: /\bprobably\b/gi, suggestion: "Remove or be specific" },
		{ pattern: /\bmaybe\b/gi, suggestion: "Remove or be specific" },
		{ pattern: /\bmight be able to\b/gi, suggestion: "We will" },
		{ pattern: /\bshould be able to\b/gi, suggestion: "We will" },
		{ pattern: /\bhopefully\b/gi, suggestion: "Remove or be specific" },
		{ pattern: /\bfairly\b/gi, suggestion: "Remove or quantify" },
		{ pattern: /\bquite\b/gi, suggestion: "Remove or quantify" },
		{ pattern: /\brather\b/gi, suggestion: "Remove or quantify" },
	];

	const found: { text: string; suggestion: string }[] = [];
	for (const { pattern, suggestion } of weakPatterns) {
		const matches = text.match(pattern) || [];
		for (const match of matches) {
			found.push({ text: match, suggestion });
		}
	}

	return found;
}

/**
 * Generate a unique ID.
 */
function generateId(): string {
	return Math.random().toString(36).substring(2, 15);
}

function normalizeAnalysisHistoryLimit(limit: number | undefined, fallback = 10, maximum = 1000): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return fallback;
	}
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

// ============================================================================
// Analysis Engine
// ============================================================================

/**
 * Analyze a single factor and return score and issues.
 */
async function analyzeFactor(
	factor: FactorDefinition,
	text: string,
	paragraphs: string[]
): Promise<AnalysisFactor> {
	const issues: AnalysisIssue[] = [];
	const suggestions: AnalysisSuggestion[] = [];
	let score = 75; // Default score

	switch (factor.id) {
		case "sentence_complexity": {
			const avgLen = averageSentenceLength(text);
			if (avgLen < 10) {
				score = 60;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Sentences are too short (avg ${avgLen.toFixed(1)} words). Consider combining related ideas.`,
				});
			} else if (avgLen > 25) {
				score = 50;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Sentences are too long (avg ${avgLen.toFixed(1)} words). Break into smaller sentences.`,
				});
			} else if (avgLen >= 15 && avgLen <= 20) {
				score = 95;
			} else {
				score = 80;
			}
			break;
		}

		case "passive_voice": {
			const passive = passiveVoicePercentage(text);
			if (passive > 30) {
				score = 40;
				issues.push({
					id: generateId(),
					severity: "error",
					factorId: factor.id,
					message: `High passive voice usage (${passive.toFixed(0)}%). Use active voice for stronger writing.`,
				});
			} else if (passive > 15) {
				score = 70;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Moderate passive voice usage (${passive.toFixed(0)}%). Consider reducing.`,
				});
			} else {
				score = 90;
			}
			break;
		}

		case "readability_score": {
			const grade = fleschKincaidGrade(text);
			if (grade < 8) {
				score = 70;
				issues.push({
					id: generateId(),
					severity: "info",
					factorId: factor.id,
					message: `Reading level may be too simple (grade ${grade.toFixed(1)}). Consider more sophisticated language for technical audiences.`,
				});
			} else if (grade > 14) {
				score = 55;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Reading level is very high (grade ${grade.toFixed(1)}). Simplify for broader accessibility.`,
				});
			} else if (grade >= 10 && grade <= 12) {
				score = 95;
			} else {
				score = 80;
			}
			break;
		}

		case "acronym_definitions": {
			const undefined = findUndefinedAcronyms(text);
			if (undefined.length > 5) {
				score = 40;
				issues.push({
					id: generateId(),
					severity: "error",
					factorId: factor.id,
					message: `${undefined.length} acronyms not defined: ${undefined.slice(0, 5).join(", ")}${undefined.length > 5 ? "..." : ""}`,
				});
			} else if (undefined.length > 0) {
				score = 70;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Undefined acronyms: ${undefined.join(", ")}`,
				});
			} else {
				score = 95;
			}
			break;
		}

		case "paragraph_length": {
			const lengths = paragraphs.map((p) => countWords(p));
			const avg = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
			const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / (lengths.length || 1);
			const stdDev = Math.sqrt(variance);

			if (stdDev > avg * 0.7) {
				score = 60;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: "Paragraph lengths vary significantly. Consider more consistent paragraph sizes.",
				});
			} else if (avg > 150) {
				score = 55;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Paragraphs are too long (avg ${avg.toFixed(0)} words). Break into smaller paragraphs.`,
				});
			} else {
				score = 85;
			}
			break;
		}

		case "transition_words": {
			const transitions = [
				"however", "therefore", "furthermore", "moreover", "additionally",
				"consequently", "nevertheless", "meanwhile", "specifically", "in addition",
				"as a result", "for example", "in contrast", "similarly", "finally",
			];
			const lowerText = text.toLowerCase();
			const found = transitions.filter((t) => lowerText.includes(t)).length;
			const density = (found / paragraphs.length) * 100;

			if (density < 30) {
				score = 60;
				suggestions.push({
					id: generateId(),
					type: "add",
					text: "Add transition words between paragraphs to improve flow.",
					impact: "medium",
				});
			} else if (density > 80) {
				score = 75;
				issues.push({
					id: generateId(),
					severity: "info",
					factorId: factor.id,
					message: "High density of transition words. Some may be unnecessary.",
				});
			} else {
				score = 90;
			}
			break;
		}

		case "quantified_claims": {
			// Look for numbers, percentages, metrics
			const quantifiers = text.match(/\d+%|\$[\d,]+|\d+\s*(years?|months?|days?|hours?|million|billion|thousand)/gi) || [];
			const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
			const ratio = (quantifiers.length / sentences.length) * 100;

			if (ratio < 10) {
				score = 55;
				suggestions.push({
					id: generateId(),
					type: "add",
					text: "Add specific metrics and quantified results to strengthen claims.",
					impact: "high",
				});
			} else if (ratio >= 20) {
				score = 90;
			} else {
				score = 75;
			}
			break;
		}

		case "value_proposition": {
			const valueKeywords = [
				"unique", "innovative", "proven", "award", "leading", "expert",
				"specialized", "dedicated", "committed", "advantage", "benefit",
				"value", "solution", "deliver", "achieve", "success",
			];
			const lowerText = text.toLowerCase();
			const found = valueKeywords.filter((k) => lowerText.includes(k)).length;

			if (found < 3) {
				score = 55;
				suggestions.push({
					id: generateId(),
					type: "clarify",
					text: "Strengthen value proposition by emphasizing unique benefits and competitive advantages.",
					impact: "high",
				});
			} else if (found >= 8) {
				score = 90;
			} else {
				score = 75;
			}
			break;
		}

		case "win_themes": {
			// Look for consistent themes (simplified)
			const weakLanguage = findWeakLanguage(text);
			if (weakLanguage.length > 5) {
				score = 55;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Found ${weakLanguage.length} instances of weak language that undermine confidence.`,
				});
				for (const weak of weakLanguage.slice(0, 3)) {
					suggestions.push({
						id: generateId(),
						type: "rewrite",
						text: `Replace "${weak.text}" with stronger language: "${weak.suggestion}"`,
						impact: "medium",
					});
				}
			} else if (weakLanguage.length > 0) {
				score = 75;
			} else {
				score = 90;
			}
			break;
		}

		case "grammar_accuracy": {
			// Simplified grammar check - look for common issues
			const issues_found: string[] = [];

			// Double spaces
			if (/  /.test(text)) issues_found.push("double spaces");
			// Missing space after period
			if (/\.[A-Z]/.test(text)) issues_found.push("missing space after period");
			// Repeated words
			if (/\b(\w+)\s+\1\b/i.test(text)) issues_found.push("repeated words");

			if (issues_found.length > 2) {
				score = 60;
				issues.push({
					id: generateId(),
					severity: "warning",
					factorId: factor.id,
					message: `Grammar issues found: ${issues_found.join(", ")}`,
				});
			} else if (issues_found.length > 0) {
				score = 80;
			} else {
				score = 95;
			}
			break;
		}

		default:
			// Use AI analysis for unsupported factors
			return await analyzeFactorWithAI(factor, text, paragraphs);
	}

	return {
		id: factor.id,
		name: factor.name,
		category: factor.category,
		description: factor.description,
		score: Math.round(score),
		weight: factor.weight,
		issues,
		suggestions,
	};
}

/**
 * Analyze a factor using AI for factors without specific heuristic analysis.
 */
async function analyzeFactorWithAI(
	factor: FactorDefinition,
	text: string,
	paragraphs: string[]
): Promise<AnalysisFactor> {
	const manager = getProviderManager();
	await manager.initialize();

	if (!(await manager.isAvailable())) {
		// Return a reasonable default when AI is unavailable
		return {
			id: factor.id,
			name: factor.name,
			category: factor.category,
			description: factor.description,
			score: 75,
			weight: factor.weight,
			issues: [],
			suggestions: [],
		};
	}

	const systemPrompt = `You are an expert document analyst. Analyze a document based on a specific quality factor.

Output your analysis as JSON with this structure:
{
  "score": <number 0-100>,
  "issues": [
    {"severity": "error|warning|info", "message": "<issue description>"}
  ],
  "suggestions": [
    {"type": "rewrite|add|clarify", "text": "<suggestion text>", "impact": "high|medium|low"}
  ]
}

Be objective and fair in your scoring. Score 80+ for good quality, 60-79 for adequate, below 60 for issues.
Only output valid JSON.`;

	const userPrompt = `Analyze this document for the factor: "${factor.name}"

Category: ${factor.category}
Description: ${factor.description}

Document content (first 3000 chars):
${text.slice(0, 3000)}

Number of paragraphs: ${paragraphs.length}
Total word count: ${text.trim().split(/\s+/).filter(Boolean).length}

Provide your JSON analysis.`;

	try {
		const response = await manager.complete({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.3,
			maxTokens: 1024,
		});

		// Parse the JSON response
		const jsonMatch = response.content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("Invalid JSON response from AI");
		}

		const analysis = JSON.parse(jsonMatch[0]) as {
			score: number;
			issues?: Array<{ severity: string; message: string }>;
			suggestions?: Array<{ type: string; text: string; impact: string }>;
		};

		const score = Math.max(0, Math.min(100, analysis.score ?? 75));

		const issues: AnalysisIssue[] = (analysis.issues || []).map((issue) => ({
			id: generateId(),
			severity: (issue.severity as IssueSeverity) || "warning",
			factorId: factor.id,
			message: issue.message,
		}));

		const suggestions: AnalysisSuggestion[] = (analysis.suggestions || []).map((suggestion) => ({
			id: generateId(),
			type: (suggestion.type as AnalysisSuggestion["type"]) || "rewrite",
			text: suggestion.text,
			impact: (suggestion.impact as SuggestionImpact) || "medium",
		}));

		return {
			id: factor.id,
			name: factor.name,
			category: factor.category,
			description: factor.description,
			score: Math.round(score),
			weight: factor.weight,
			issues,
			suggestions,
		};
	} catch (error) {
		logger.warn(`[AI Analysis Error] Factor ${factor.id}:`, error);
		// Fallback to default score when AI fails
		return {
			id: factor.id,
			name: factor.name,
			category: factor.category,
			description: factor.description,
			score: 75,
			weight: factor.weight,
			issues: [],
			suggestions: [],
		};
	}
}

/**
 * Analyze a single paragraph.
 */
function analyzeParagraphContent(
	text: string,
	index: number,
	analysisId: string
): Omit<ParagraphAnalysis, "id"> {
	const issues: AnalysisIssue[] = [];
	const suggestions: AnalysisSuggestion[] = [];
	let score = 80;

	const wordCount = countWords(text);
	const sentenceCount = text.split(/[.!?]+/).filter((s) => s.trim()).length;

	// Check paragraph length
	if (wordCount > 150) {
		score -= 15;
		issues.push({
			id: generateId(),
			severity: "warning",
			factorId: "paragraph_length",
			message: "Paragraph is too long. Consider breaking into smaller paragraphs.",
			location: { paragraphIndex: index },
		});
	}

	// Check for weak language
	const weakLanguage = findWeakLanguage(text);
	if (weakLanguage.length > 0) {
		score -= weakLanguage.length * 5;
		for (const weak of weakLanguage) {
			suggestions.push({
				id: generateId(),
				type: "rewrite",
				text: `Replace "${weak.text}" with "${weak.suggestion}"`,
				impact: "medium",
				location: { paragraphIndex: index },
			});
		}
	}

	// Check passive voice
	const passive = passiveVoicePercentage(text);
	if (passive > 40) {
		score -= 10;
		issues.push({
			id: generateId(),
			severity: "info",
			factorId: "passive_voice",
			message: "High passive voice usage in this paragraph.",
			location: { paragraphIndex: index },
		});
	}

	return {
		analysisId,
		paragraphIndex: index,
		text,
		score: Math.max(0, Math.min(100, Math.round(score))),
		issues,
		suggestions,
	};
}

// ============================================================================
// Server Actions
// ============================================================================

async function requireCurrentUserId(): Promise<string> {
	const userId = await getCurrentUserId();
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}

function writableDocumentCondition(documentId: string, userId: string): SQL {
	return sql`documents.id = ${documentId} and (
		documents.owner_id = ${userId}
		or documents.collaborator_ids ? ${userId}
	)`;
}

function readableDocumentExistsSql(documentId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from documents
		where documents.id = ${documentId}
			and (
				documents.owner_id = ${userId}
				or documents.visibility = 'public'
				or documents.collaborator_ids ? ${userId}
			)
	)`;
}

function writableDocumentExistsSql(documentId: unknown, userId: string): SQL {
	return sql`exists (
		select 1
		from documents
		where documents.id = ${documentId}
			and (
				documents.owner_id = ${userId}
				or documents.collaborator_ids ? ${userId}
			)
	)`;
}

/**
 * Run full document analysis with 30+ factors.
 */
export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<DocumentAnalysis> {
	const userId = await requireCurrentUserId();

	const startTime = Date.now();

	// Fetch document
	const [doc] = await db
		.select()
		.from(documents)
		.where(writableDocumentCondition(input.documentId, userId))
		.limit(1);

	if (!doc) {
		throw new Error("Document not found");
	}

	if (input.proposalDocumentId) {
		const [proposalDocument] = await db
			.select({ id: proposalDocuments.id })
			.from(proposalDocuments)
			.where(and(
				eq(proposalDocuments.id, input.proposalDocumentId),
				eq(proposalDocuments.documentId, input.documentId),
				writableDocumentExistsSql(proposalDocuments.documentId, userId)
			))
			.limit(1);

		if (!proposalDocument) {
			throw new Error("Proposal document not found");
		}
	}

	// Extract text content
	const text = extractText(doc.content);
	const paragraphs = extractParagraphs(doc.content);
	const wordCount = countWords(text);
	const paragraphCount = paragraphs.length;

	// Filter factors by category if specified
	const factorsToAnalyze = input.categories
		? ANALYSIS_FACTORS.filter((f) => input.categories!.includes(f.category))
		: ANALYSIS_FACTORS;

	// Analyze all factors (now async due to AI analysis)
	const analyzedFactors = await Promise.all(
		factorsToAnalyze.map((factor) => analyzeFactor(factor, text, paragraphs))
	);

	// Calculate category scores
	const categories: AnalysisFactorCategory[] = ["clarity", "compliance", "persuasiveness", "technical"];
	const categoryScores: CategoryScore[] = categories.map((category) => {
		const categoryFactors = analyzedFactors.filter((f) => f.category === category);
		const totalWeight = categoryFactors.reduce((sum, f) => sum + f.weight, 0);
		const weightedScore =
			categoryFactors.reduce((sum, f) => sum + f.score * f.weight, 0) / (totalWeight || 1);
		const issues = categoryFactors.flatMap((f) => f.issues);

		return {
			category,
			score: Math.round(weightedScore),
			factorCount: categoryFactors.length,
			issueCount: issues.length,
			topIssues: issues.slice(0, 3),
		};
	});

	// Calculate overall score (weighted average of category scores)
	const categoryWeights: Record<AnalysisFactorCategory, number> = {
		clarity: 0.25,
		compliance: 0.30,
		persuasiveness: 0.25,
		technical: 0.20,
	};

	const overallScore = Math.round(
		categoryScores.reduce(
			(sum, cs) => sum + cs.score * categoryWeights[cs.category],
			0
		)
	);

	// Collect all issues and suggestions
	const allIssues = analyzedFactors.flatMap((f) => f.issues);
	const allSuggestions = analyzedFactors.flatMap((f) => f.suggestions);

	// Analyze paragraphs if requested
	let paragraphAnalysisData: Omit<ParagraphAnalysis, "id">[] = [];
	if (input.includeParagraphs !== false) {
		paragraphAnalysisData = paragraphs.map((p, i) =>
			analyzeParagraphContent(p, i, "") // ID will be set after insert
		);
	}

	// Save analysis to database
	const [savedAnalysis] = await db
		.insert(documentAnalyses)
		.values({
			documentId: input.documentId,
			proposalDocumentId: input.proposalDocumentId || null,
			overallScore,
			categoryScores: categoryScores as unknown as Record<string, unknown>,
			factorScores: analyzedFactors as unknown as Record<string, unknown>[],
			issues: allIssues as unknown as Record<string, unknown>[],
			suggestions: allSuggestions as unknown as Record<string, unknown>[],
			wordCount,
			paragraphCount,
			modelVersion: "heuristic-v1",
		})
		.returning();

	// Save paragraph analyses
	if (paragraphAnalysisData.length > 0) {
		await db.insert(paragraphAnalyses).values(
			paragraphAnalysisData.map((p) => ({
				analysisId: savedAnalysis.id,
				paragraphIndex: p.paragraphIndex,
				text: p.text,
				score: p.score,
				issues: p.issues as unknown as Record<string, unknown>[],
				suggestions: p.suggestions as unknown as Record<string, unknown>[],
			}))
		);
	}

	// Update proposal document AI score if applicable
	if (input.proposalDocumentId) {
		await db
			.update(proposalDocuments)
			.set({
				aiAnalysisScore: overallScore,
				aiAnalysisAt: new Date(),
				updatedAt: new Date(),
			})
			.where(and(
				eq(proposalDocuments.id, input.proposalDocumentId),
				eq(proposalDocuments.documentId, input.documentId),
				writableDocumentExistsSql(proposalDocuments.documentId, userId)
			));
	}

	const processingTime = Date.now() - startTime;
	logger.debug(`Analysis completed in ${processingTime}ms`);

	return {
		id: savedAnalysis.id,
		documentId: input.documentId,
		proposalDocumentId: input.proposalDocumentId || null,
		overallScore,
		categoryScores,
		factors: analyzedFactors,
		issues: allIssues,
		suggestions: allSuggestions,
		wordCount,
		paragraphCount,
		analyzedAt: savedAnalysis.analyzedAt,
		modelVersion: "heuristic-v1",
	};
}

/**
 * Get the latest analysis for a document.
 */
export async function getAnalysis(documentId: string): Promise<DocumentAnalysis | null> {
	const userId = await requireCurrentUserId();

	const [analysis] = await db
		.select()
		.from(documentAnalyses)
		.where(and(
			eq(documentAnalyses.documentId, documentId),
			readableDocumentExistsSql(documentAnalyses.documentId, userId)
		))
		.orderBy(desc(documentAnalyses.analyzedAt))
		.limit(1);

	if (!analysis) return null;

	return {
		id: analysis.id,
		documentId: analysis.documentId,
		proposalDocumentId: analysis.proposalDocumentId,
		overallScore: analysis.overallScore,
		categoryScores: analysis.categoryScores as CategoryScore[],
		factors: analysis.factorScores as AnalysisFactor[],
		issues: analysis.issues as AnalysisIssue[],
		suggestions: analysis.suggestions as AnalysisSuggestion[],
		wordCount: analysis.wordCount,
		paragraphCount: analysis.paragraphCount,
		analyzedAt: analysis.analyzedAt,
		modelVersion: analysis.modelVersion,
	};
}

/**
 * Get analysis history for a document.
 */
export async function getAnalysisHistory(
	documentId: string,
	limit = 10
): Promise<AnalysisHistoryEntry[]> {
	const userId = await requireCurrentUserId();

	const analyses = await db
		.select()
		.from(documentAnalyses)
		.where(and(
			eq(documentAnalyses.documentId, documentId),
			readableDocumentExistsSql(documentAnalyses.documentId, userId)
		))
		.orderBy(desc(documentAnalyses.analyzedAt))
		.limit(normalizeAnalysisHistoryLimit(limit));

	return analyses.map((a) => ({
		id: a.id,
		overallScore: a.overallScore,
		analyzedAt: a.analyzedAt,
		wordCount: a.wordCount,
		issueCount: Array.isArray(a.issues) ? a.issues.length : 0,
	}));
}

/**
 * Delete an analysis.
 */
export async function deleteAnalysis(analysisId: string): Promise<boolean> {
	const userId = await requireCurrentUserId();

	const result = await db
		.delete(documentAnalyses)
		.where(and(
			eq(documentAnalyses.id, analysisId),
			writableDocumentExistsSql(documentAnalyses.documentId, userId)
		))
		.returning({ id: documentAnalyses.id });

	return result.length > 0;
}
