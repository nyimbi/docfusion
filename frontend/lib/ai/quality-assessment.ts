/**
 * AI Quality Assessment System - DocFusion
 *
 * Comprehensive document quality assessment across 35 factors covering:
 * - Narrative coherence and clarity
 * - Grammar, spelling, and structure
 * - Tone and professional language
 * - Format compliance and completeness
 * - Argument strength and evidence quality
 * - Risk identification and mitigation
 * - Target audience alignment
 * - Compliance with requirements
 */

// ============================================================================
// Types & Enums
// ============================================================================

export type QualityFactorCategory =
	| "content"
	| "structure"
	| "style"
	| "technical"
	| "compliance"
	| "strategy";

export type QualityScoreLevel = "excellent" | "good" | "average" | "needs_work" | "poor";

export type IssuePriority = "critical" | "high" | "medium" | "low";

export type SuggestionType =
	| "rewrite"
	| "expand"
	| "condense"
	| "reorganize"
	| "enhance"
	| "add"
	| "remove"
	| "clarify";

// ============================================================================
// Quality Factor Definitions (35 Factors)
// ============================================================================

export interface QualityFactorDefinition {
	id: string;
	name: string;
	category: QualityFactorCategory;
	description: string;
	weight: number; // 0-1, importance factor
	targetValue?: number | string;
	measurementUnit?: string;
}

/**
 * Complete list of 35 quality assessment factors across 6 categories.
 */
export const QUALITY_FACTORS: QualityFactorDefinition[] = [
	// === Content Quality (9 factors) ===
	{
		id: "narrative_coherence",
		name: "Narrative Coherence",
		category: "content",
		description: "Logical flow and story progression throughout the document",
		weight: 0.15,
	},
	{
		id: "clarity_conciseness",
		name: "Clarity & Conciseness",
		category: "content",
		description: "Clear messaging without unnecessary verbosity",
		weight: 0.12,
	},
	{
		id: "logical_flow",
		name: "Logical Flow",
		category: "content",
		description: "Clear progression of ideas between sections",
		weight: 0.10,
	},
	{
		id: "evidence_quality",
		name: "Evidence/Support Quality",
		category: "content",
		description: "Relevance and credibility of supporting data",
		weight: 0.12,
	},
	{
		id: "argument_strength",
		name: "Argument Strength",
		category: "content",
		description: "Persuasiveness and logical validity of claims",
		weight: 0.10,
	},
	{
		id: "fact_accuracy",
		name: "Fact Accuracy",
		category: "content",
		description: "Presence of verifiable evidence signals for stated facts",
		weight: 0.08,
	},
	{
		id: "source_credibility",
		name: "Source Credibility",
		category: "content",
		description: "Specificity and credibility signals in cited sources",
		weight: 0.06,
	},
	{
		id: "citations_completeness",
		name: "Citations Completeness",
		category: "content",
		description: "All claims properly attributed to sources",
		weight: 0.08,
	},
	{
		id: "key_message_clarity",
		name: "Key Message Clarity",
		category: "content",
		description: "Primary message is clear and memorable",
		weight: 0.10,
	},

	// === Structure & Organization (8 factors) ===
	{
		id: "section_completeness",
		name: "Section Completeness",
		category: "structure",
		description: "All required sections present and complete",
		weight: 0.15,
	},
	{
		id: "header_hierarchy",
		name: "Header Hierarchy",
		category: "structure",
		description: "Proper heading levels (H1, H2, H3) and structure",
		weight: 0.08,
	},
	{
		id: "introduction_effectiveness",
		name: "Introduction Effectiveness",
		category: "structure",
		description: "Strong opening that engages and outlines the document",
		weight: 0.10,
	},
	{
		id: "conclusion_strength",
		name: "Conclusion Strength",
		category: "structure",
		description: "Compelling summary and call to action",
		weight: 0.10,
	},
	{
		id: "transitions_sections",
		name: "Transitions Between Sections",
		category: "structure",
		description: "Smooth connections between different sections",
		weight: 0.08,
	},
	{
		id: "paragraph_length_consistency",
		name: "Paragraph Length Consistency",
		category: "structure",
		description: "Appropriate and consistent paragraph sizes",
		weight: 0.06,
	},
	{
		id: "word_count_analysis",
		name: "Word Count Analysis",
		category: "structure",
		description: "Appropriate length for document type",
		weight: 0.05,
		targetValue: "500-5000",
		measurementUnit: "words",
	},
	{
		id: "data_presentation_quality",
		name: "Data Presentation Quality",
		category: "structure",
		description: "Effective use of tables, charts, and visuals",
		weight: 0.08,
	},

	// === Style & Language (7 factors) ===
	{
		id: "grammar_spelling",
		name: "Grammar & Spelling",
		category: "style",
		description: "Error-free writing with proper grammar",
		weight: 0.15,
	},
	{
		id: "sentence_structure_variety",
		name: "Sentence Structure Variety",
		category: "style",
		description: "Mix of sentence lengths and types",
		weight: 0.08,
	},
	{
		id: "active_voice_ratio",
		name: "Active vs Passive Voice Ratio",
		category: "style",
		description: "Predominant use of active voice (target: >80%)",
		weight: 0.10,
		targetValue: ">80",
		measurementUnit: "percent",
	},
	{
		id: "readability_score",
		name: "Readability Score",
		category: "style",
		description: "Flesch-Kincaid readability (target: 10-12 grade)",
		weight: 0.12,
		targetValue: "10-12",
		measurementUnit: "grade_level",
	},
	{
		id: "tone_consistency",
		name: "Tone Consistency",
		category: "style",
		description: "Consistent voice and tone throughout",
		weight: 0.10,
	},
	{
		id: "professional_language",
		name: "Professional Language",
		category: "style",
		description: "Appropriate business/academic register",
		weight: 0.12,
	},
	{
		id: "acronym_consistency",
		name: "Acronym Consistency",
		category: "style",
		description: "Defined on first use and used consistently",
		weight: 0.08,
	},

	// === Technical Quality (3 factors) ===
	{
		id: "jargon_usage",
		name: "Jargon Usage",
		category: "technical",
		description: "Appropriate technical terms with context",
		weight: 0.10,
	},
	{
		id: "format_compliance",
		name: "Format Compliance",
		category: "technical",
		description: "Adheres to required format specifications",
		weight: 0.12,
	},
	{
		id: "visual_consistency",
		name: "Visual Consistency",
		category: "technical",
		description: "Consistent formatting, fonts, and spacing",
		weight: 0.08,
	},

	// === Compliance & Requirements (2 factors) ===
	{
		id: "compliance_alignment",
		name: "Compliance Alignment",
		category: "compliance",
		description: "Match to stated requirements",
		weight: 0.18,
	},
	{
		id: "target_audience_alignment",
		name: "Target Audience Alignment",
		category: "compliance",
		description: "Content appropriate for intended readers",
		weight: 0.12,
	},

	// === Strategic Elements (6 factors) ===
	{
		id: "call_to_action_presence",
		name: "Call-to-Action Presence",
		category: "strategy",
		description: "Clear next steps or desired outcome",
		weight: 0.08,
	},
	{
		id: "risk_identification",
		name: "Risk Identification",
		category: "strategy",
		description: "Awareness and acknowledgment of risks",
		weight: 0.10,
	},
	{
		id: "risk_mitigation_quality",
		name: "Risk Mitigation Quality",
		category: "strategy",
		description: "Effective strategies to address risks",
		weight: 0.10,
	},
	{
		id: "timeline_feasibility",
		name: "Timeline Feasibility",
		category: "strategy",
		description: "Realistic and achievable timeline",
		weight: 0.08,
	},
	{
		id: "budget_justification",
		name: "Budget Justification",
		category: "strategy",
		description: "Clear rationale for costs and allocations",
		weight: 0.08,
	},
	{
		id: "team_qualifications_match",
		name: "Team Qualifications Match",
		category: "strategy",
		description: "Demonstrated capability to deliver",
		weight: 0.08,
	},
];

// ============================================================================
// Result Types
// ============================================================================

export interface QualityIssue {
	id: string;
	factorId: string;
	priority: IssuePriority;
	message: string;
	location?: {
		section?: string;
		paragraphIndex?: number;
		startOffset?: number;
		endOffset?: number;
		snippet?: string;
	};
	suggestion?: string;
}

export interface QualitySuggestion {
	id: string;
	type: SuggestionType;
	text: string;
	priority: IssuePriority;
	factorId: string;
	location?: {
		section?: string;
		paragraphIndex?: number;
	};
	replacement?: string;
	impact: "high" | "medium" | "low";
}

export interface QualityFactorResult {
	id: string;
	name: string;
	category: QualityFactorCategory;
	description: string;
	score: number; // 0-100
	weight: number;
	targetValue?: number | string;
	actualValue?: number | string;
	measurementUnit?: string;
	issues: QualityIssue[];
	suggestions: QualitySuggestion[];
	details?: string;
}

export interface CategoryScore {
	category: QualityFactorCategory;
	score: number; // 0-100
	weightedScore: number;
	factorCount: number;
	issueCount: number;
	topIssues: QualityIssue[];
}

export interface QualityAssessment {
	id: string;
	documentId: string;
	versionId?: string;
	overallScore: number; // 0-100
	scoreLevel: QualityScoreLevel;
	categoryScores: CategoryScore[];
	factors: QualityFactorResult[];
	issues: QualityIssue[];
	suggestions: QualitySuggestion[];
	summary: {
		wordCount: number;
		paragraphCount: number;
		sentenceCount: number;
		averageSentenceLength: number;
		passiveVoicePercentage: number;
		readabilityGrade: number;
		activeVoicePercentage: number;
		undefinedAcronyms: string[];
		weakLanguageCount: number;
	};
	assessedAt: Date;
	modelVersion: string;
	comparisons?: {
		previousVersionId?: string;
		scoreDelta: number;
		improvedFactors: string[];
		declinedFactors: string[];
		newIssues: QualityIssue[];
		resolvedIssues: QualityIssue[];
	};
}

// ============================================================================
// Assessment Input
// ============================================================================

export interface QualityAssessmentInput {
	documentId: string;
	content: string;
	contentType?: "markdown" | "html" | "plain" | "json";
	versionId?: string;
	previousVersionId?: string;
	targetAudience?: string;
	requirements?: string[];
	categories?: QualityFactorCategory[];
	options?: {
		includeParagraphAnalysis?: boolean;
		strictMode?: boolean;
		targetWordCount?: number;
		targetReadability?: number;
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID.
 */
let generatedIdCounter = 0;
export function generateId(): string {
	generatedIdCounter += 1;
	return `qa-${Date.now()}-${generatedIdCounter.toString(36)}`;
}

/**
 * Get score level based on numeric score.
 */
export function getScoreLevel(score: number): QualityScoreLevel {
	if (score >= 85) return "excellent";
	if (score >= 70) return "good";
	if (score >= 50) return "average";
	if (score >= 30) return "needs_work";
	return "poor";
}

/**
 * Get color class for a score.
 */
export function getScoreColor(score: number): string {
	if (score >= 85) return "text-green-600";
	if (score >= 70) return "text-emerald-600";
	if (score >= 50) return "text-yellow-600";
	if (score >= 30) return "text-orange-600";
	return "text-red-600";
}

/**
 * Get background color class for a score.
 */
export function getScoreBgColor(score: number): string {
	if (score >= 85) return "bg-green-100";
	if (score >= 70) return "bg-emerald-100";
	if (score >= 50) return "bg-yellow-100";
	if (score >= 30) return "bg-orange-100";
	return "bg-red-100";
}

/**
 * Get progress bar gradient for a score.
 */
export function getScoreGradient(score: number): string {
	if (score >= 85) return "from-green-500 to-emerald-500";
	if (score >= 70) return "from-emerald-400 to-green-500";
	if (score >= 50) return "from-yellow-400 to-amber-500";
	if (score >= 30) return "from-orange-400 to-amber-500";
	return "from-red-500 to-rose-500";
}

/**
 * Get color for priority level.
 */
export function getPriorityColor(priority: IssuePriority): string {
	switch (priority) {
		case "critical":
			return "text-red-600";
		case "high":
			return "text-orange-600";
		case "medium":
			return "text-yellow-600";
		case "low":
			return "text-blue-600";
		default:
			return "text-gray-600";
	}
}

/**
 * Get background color for priority level.
 */
export function getPriorityBgColor(priority: IssuePriority): string {
	switch (priority) {
		case "critical":
			return "bg-red-100";
		case "high":
			return "bg-orange-100";
		case "medium":
			return "bg-yellow-100";
		case "low":
			return "bg-blue-100";
		default:
			return "bg-gray-100";
	}
}

/**
 * Get label for suggestion type.
 */
export function getSuggestionTypeLabel(type: SuggestionType): string {
	const labels: Record<SuggestionType, string> = {
		rewrite: "Rewrite",
		expand: "Expand",
		condense: "Condense",
		reorganize: "Reorganize",
		enhance: "Enhance",
		add: "Add",
		remove: "Remove",
		clarify: "Clarify",
	};
	return labels[type];
}

/**
 * Get icon for category.
 */
export function getCategoryIcon(category: QualityFactorCategory): string {
	const icons: Record<QualityFactorCategory, string> = {
		content: "📝",
		structure: "🏗️",
		style: "✨",
		technical: "⚙️",
		compliance: "✅",
		strategy: "🎯",
	};
	return icons[category];
}

/**
 * Get label for category.
 */
export function getCategoryLabel(category: QualityFactorCategory): string {
	const labels: Record<QualityFactorCategory, string> = {
		content: "Content Quality",
		structure: "Structure & Organization",
		style: "Style & Language",
		technical: "Technical Quality",
		compliance: "Compliance & Alignment",
		strategy: "Strategic Elements",
	};
	return labels[category];
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Count words in text.
 */
export function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Count sentences in text.
 */
export function countSentences(text: string): number {
	return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

/**
 * Count paragraphs in text.
 */
export function countParagraphs(text: string): number {
	return text.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
}

/**
 * Calculate average sentence length.
 */
export function averageSentenceLength(text: string): number {
	const words = countWords(text);
	const sentences = countSentences(text);
	return sentences > 0 ? words / sentences : 0;
}

/**
 * Calculate Flesch-Kincaid grade level.
 */
export function calculateReadabilityGrade(text: string): number {
	const words = countWords(text);
	const sentences = countSentences(text);

	if (words === 0 || sentences === 0) return 0;

	// Count syllables (approximation)
	const syllables = text
		.toLowerCase()
		.split(/\s+/)
		.reduce((sum, word) => {
			// Simple syllable count: count vowel groups
			const vowelGroups = word.match(/[aeiouy]+/g);
			return sum + (vowelGroups ? vowelGroups.length : 1);
		}, 0);

	const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
	return Math.max(0, Math.min(20, grade));
}

/**
 * Calculate passive voice percentage.
 */
export function calculatePassiveVoicePercentage(text: string): number {
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	if (sentences.length === 0) return 0;

	// Passive voice patterns: was/were/is/are/be/been/being + past participle
	const passivePatterns = [
		/\b(?:was|were|been|being|is|are|am|be)\s+(?:\w+ed|\w+en|\w+nt)\b/gi,
		/\b(?:was|were|been|being|is|are|am|be)\s+(?:constructed|developed|implemented|completed|delivered|provided|created|designed|established|prepared|written|produced)\b/gi,
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
 * Find undefined acronyms in text.
 */
export function findUndefinedAcronyms(text: string): string[] {
	// Find all uppercase words (2-5 letters)
	const acronymPattern = /\b[A-Z]{2,5}\b/g;
	const matches = text.match(acronymPattern) || [];

	// Common acronyms to ignore
	const commonAcronyms = [
		"RFP",
		"EOI",
		"SOW",
		"PDF",
		"API",
		"IT",
		"US",
		"UK",
		"USA",
		"UAE",
		"CEO",
		"CTO",
		"CFO",
		"CTO",
		"COO",
		"HR",
		"QA",
		"UI",
		"UX",
		"URL",
		"HTTP",
		"HTTPS",
		"HTML",
		"CSS",
		"JSON",
		"XML",
		"SQL",
		"KPI",
		"ROI",
	];

	const undefined: string[] = [];
	for (const acronym of [...new Set(matches)]) {
		if (commonAcronyms.includes(acronym)) continue;

		// Check if acronym is defined (pattern: "Full Name (ACRONYM)" or "ACRONYM (Full Name)")
		const definitionPattern = new RegExp(
			`\\([^)]*${acronym}[^)]*\\)|${acronym}\\s*\\([^)]+\\)`,
			"i"
		);
		if (!definitionPattern.test(text)) {
			undefined.push(acronym);
		}
	}

	return undefined;
}

/**
 * Find weak language patterns.
 */
export function findWeakLanguage(text: string): Array<{ text: string; suggestion: string; count: number }> {
	const weakPatterns = [
		{ pattern: /\bwe think\b/gi, suggestion: "We are confident" },
		{ pattern: /\bwe believe\b/gi, suggestion: "We know" },
		{ pattern: /\bprobably\b/gi, suggestion: "Remove or be specific" },
		{ pattern: /\bmaybe\b/gi, suggestion: "Remove or be specific" },
		{ pattern: /\bmight be able to\b/gi, suggestion: "We will" },
		{ pattern: /\bshould be able to\b/gi, suggestion: "We will" },
		{ pattern: /\bhopefully\b/gi, suggestion: "Remove or be specific" },
		{ pattern: /\bfairly\b/gi, suggestion: "Remove or quantify" },
		{ pattern: /\bquite\b/gi, suggestion: "Remove or quantify" },
		{ pattern: /\brather\b/gi, suggestion: "Remove or quantify" },
		{ pattern: /\bjust\b/gi, suggestion: "Remove" },
		{ pattern: /\bsimply\b/gi, suggestion: "Remove" },
		{ pattern: /\bvery\b/gi, suggestion: "Use a stronger adjective" },
		{ pattern: /\breally\b/gi, suggestion: "Remove or use a stronger adjective" },
		{ pattern: /\bkind of\b/gi, suggestion: "Remove" },
		{ pattern: /\bsort of\b/gi, suggestion: "Remove" },
		{ pattern: /\btry to\b/gi, suggestion: "Will" },
		{ pattern: /\battempt to\b/gi, suggestion: "Will" },
	];

	const found: Array<{ text: string; suggestion: string; count: number }> = [];
	for (const { pattern, suggestion } of weakPatterns) {
		const matches = text.match(pattern);
		if (matches && matches.length > 0) {
			found.push({
				text: matches[0],
				suggestion,
				count: matches.length,
			});
		}
	}

	return found;
}

/**
 * Find transition words and phrases.
 */
export function findTransitions(text: string): {
	found: string[];
	count: number;
	density: number;
} {
	const transitions = [
		"however",
		"therefore",
		"furthermore",
		"moreover",
		"additionally",
		"consequently",
		"nevertheless",
		"meanwhile",
		"specifically",
		"in addition",
		"as a result",
		"for example",
		"for instance",
		"in contrast",
		"similarly",
		"likewise",
		"in other words",
		"that is",
		"namely",
		"accordingly",
		"thus",
		"hence",
		"subsequently",
		"alternatively",
		"conversely",
		"on the other hand",
		"in comparison",
		"by comparison",
		"on the contrary",
		"in any case",
		"at any rate",
		"in conclusion",
		"to summarize",
		"in summary",
		"finally",
		"firstly",
		"secondly",
		"thirdly",
		"lastly",
	];

	const lowerText = text.toLowerCase();
	const found = transitions.filter((t) => lowerText.includes(t));
	const paragraphs = countParagraphs(text) || 1;

	return {
		found,
		count: found.length,
		density: (found.length / paragraphs) * 100,
	};
}

/**
 * Check for structured sections.
 */
export function checkSectionStructure(text: string): {
	hasIntroduction: boolean;
	hasConclusion: boolean;
	hasExecutiveSummary: boolean;
	hasHeaders: boolean;
	headerCount: number;
} {
	const introPatterns = [
		/^#{0,6}\s*introduction\b/im,
		/^#{0,6}\s*overview\b/im,
		/^#{0,6}\s*background\b/im,
	];

	const conclusionPatterns = [
		/^#{0,6}\s*conclusion\b/im,
		/^#{0,6}\s*summary\b/im,
		/^#{0,6}\s*next steps\b/im,
	];

	const execSummaryPatterns = [
		/^#{0,6}\s*executive summary\b/im,
		/^#{0,6}\s*exec summary\b/im,
	];

	const hasIntroduction = introPatterns.some((p) => p.test(text));
	const hasConclusion = conclusionPatterns.some((p) => p.test(text));
	const hasExecutiveSummary = execSummaryPatterns.some((p) => p.test(text));

	// Count headers (markdown style)
	const headerMatches = text.match(/^#{1,6}\s+/gm);
	const hasHeaders = !!headerMatches && headerMatches.length > 0;
	const headerCount = headerMatches ? headerMatches.length : 0;

	return {
		hasIntroduction,
		hasConclusion,
		hasExecutiveSummary,
		hasHeaders,
		headerCount,
	};
}

// ============================================================================
// Factor Analysis Functions
// ============================================================================

interface FactorAnalysisContext {
	text: string;
	paragraphs: string[];
	words: string[];
	sentences: string[];
	wordCount: number;
	sentenceCount: number;
	paragraphCount: number;
	avgSentenceLength: number;
	readabilityGrade: number;
	passiveVoicePercentage: number;
	activeVoicePercentage: number;
	transitions: ReturnType<typeof findTransitions>;
	undefinedAcronyms: string[];
	weakLanguage: ReturnType<typeof findWeakLanguage>;
	sectionStructure: ReturnType<typeof checkSectionStructure>;
}

/**
 * Create analysis context from text.
 */
function createAnalysisContext(text: string): FactorAnalysisContext {
	const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
	const words = text.trim().split(/\s+/).filter(Boolean);
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	const wordCount = words.length;
	const sentenceCount = sentences.length;
	const paragraphCount = paragraphs.length;
	const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
	const readabilityGrade = calculateReadabilityGrade(text);
	const passiveVoicePercentage = calculatePassiveVoicePercentage(text);
	const activeVoicePercentage = 100 - passiveVoicePercentage;

	return {
		text,
		paragraphs,
		words,
		sentences,
		wordCount,
		sentenceCount,
		paragraphCount,
		avgSentenceLength,
		readabilityGrade,
		passiveVoicePercentage,
		activeVoicePercentage,
		transitions: findTransitions(text),
		undefinedAcronyms: findUndefinedAcronyms(text),
		weakLanguage: findWeakLanguage(text),
		sectionStructure: checkSectionStructure(text),
	};
}

function countPatternMatches(text: string, patterns: RegExp[]): number {
	return patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
}

function countKeywordMentions(text: string, keywords: string[]): number {
	const escaped = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
	return text.match(pattern)?.length ?? 0;
}

function scoreFromCount(
	count: number,
	thresholds: { excellent: number; good: number; average: number },
	emptyIssueScore = 45
): number {
	if (count >= thresholds.excellent) return 90;
	if (count >= thresholds.good) return 78;
	if (count >= thresholds.average) return 65;
	return emptyIssueScore;
}

function deterministicBaselineScore(context: FactorAnalysisContext): number {
	let score = 55;
	if (context.wordCount >= 300) score += 10;
	if (context.sectionStructure.hasHeaders) score += 10;
	if (context.transitions.count > 0) score += 8;
	if (context.readabilityGrade >= 8 && context.readabilityGrade <= 14) score += 7;
	if (context.weakLanguage.reduce((sum, w) => sum + w.count, 0) === 0) score += 5;
	return Math.min(score, 90);
}

/**
 * Analyze a specific factor.
 */
function analyzeFactor(
	factor: QualityFactorDefinition,
	context: FactorAnalysisContext
): QualityFactorResult {
	const issues: QualityIssue[] = [];
	const suggestions: QualitySuggestion[] = [];
	let score = 75; // Default score
	let actualValue: number | string | undefined;
	let details = "";

	switch (factor.id) {
		// === Content Analysis ===
		case "narrative_coherence": {
			// Check transition density as a proxy for coherence
			const { density } = context.transitions;
			actualValue = density.toFixed(1) + "%";

			if (density < 20) {
				score = 55;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Low transition word density. Consider adding more logical connectors between sections.",
					suggestion: "Add transition words like 'Furthermore', 'In addition', 'Consequently'",
				});
			} else if (density > 80) {
				score = 70;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: "Very high transition density. Some transitions may be unnecessary.",
				});
			} else if (density >= 30 && density <= 60) {
				score = 90;
			} else {
				score = 80;
			}
			details = `Found ${context.transitions.count} transition words (${density.toFixed(1)}% density)`;
			break;
		}

		case "clarity_conciseness": {
			// Check for wordiness indicators
			const wordyPatterns = [
				{ pattern: /\bin order to\b/gi, replacement: "to" },
				{ pattern: /\bdue to the fact that\b/gi, replacement: "because" },
				{ pattern: /\bwith regard to\b/gi, replacement: "about" },
				{ pattern: /\bin the event that\b/gi, replacement: "if" },
			];

			let wordyCount = 0;
			for (const { pattern } of wordyPatterns) {
				const matches = context.text.match(pattern);
				if (matches) wordyCount += matches.length;
			}

			actualValue = wordyCount;
			if (wordyCount > 5) {
				score = 60;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `${wordyCount} wordy phrases found. Consider more concise alternatives.`,
					suggestion: "Replace phrases like 'in order to' with 'to', 'due to the fact that' with 'because'",
				});
			} else if (wordyCount > 0) {
				score = 80;
			} else {
				score = 95;
			}
			details = `Found ${wordyCount} wordy phrases`;
			break;
		}

		case "logical_flow": {
			const orderedMarkers = countKeywordMentions(context.text, [
				"first",
				"second",
				"third",
				"next",
				"then",
				"finally",
				"therefore",
				"because",
				"consequently",
			]);
			const hasMultiSectionStructure = context.sectionStructure.headerCount >= 3;
			actualValue = `${context.transitions.count} transitions, ${context.sectionStructure.headerCount} headers`;
			score = scoreFromCount(context.transitions.count + orderedMarkers, {
				excellent: 6,
				good: 3,
				average: 1,
			});
			if (hasMultiSectionStructure) score = Math.min(95, score + 8);
			if (context.transitions.count === 0 && !hasMultiSectionStructure) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Document has limited section structure or transition language to show idea progression",
					suggestion: "Add section headings and connective phrases that make the evaluation logic explicit",
				});
			}
			details = `Measured ${context.transitions.count} transition phrases, ${orderedMarkers} ordering markers, and ${context.sectionStructure.headerCount} markdown headers`;
			break;
		}

		case "key_message_clarity": {
			const firstParagraph = context.paragraphs.find((paragraph) =>
				paragraph
					.split("\n")
					.some((line) => line.trim().length > 0 && !/^#{1,6}\s+\S+/.test(line.trim()))
			) ?? "";
			const messageSignals = countKeywordMentions(firstParagraph, [
				"will",
				"deliver",
				"provide",
				"enable",
				"ensure",
				"improve",
				"reduce",
				"support",
				"objective",
				"outcome",
				"benefit",
			]);
			const headingSignal = /^#\s+\S+/m.test(context.text) ? 1 : 0;
			actualValue = `${messageSignals} opening message signals`;
			score = scoreFromCount(messageSignals + headingSignal, {
				excellent: 5,
				good: 3,
				average: 1,
			});
			if (messageSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Opening paragraph does not clearly state the primary offer, outcome, or reader benefit",
					suggestion: "State the proposal's main outcome and value in the first paragraph",
				});
			}
			details = `Opening paragraph contains ${messageSignals} explicit outcome or offer signals`;
			break;
		}

		case "readability_score": {
			actualValue = context.readabilityGrade.toFixed(1);
			if (context.readabilityGrade < 8) {
				score = 70;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `Reading level is quite simple (grade ${context.readabilityGrade.toFixed(1)}). Consider if this matches your audience.`,
				});
			} else if (context.readabilityGrade > 14) {
				score = 50;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: `Reading level is very high (grade ${context.readabilityGrade.toFixed(1)}). Consider simplifying for broader accessibility.`,
					suggestion: "Break down complex sentences and use simpler vocabulary where possible",
				});
			} else if (context.readabilityGrade >= 10 && context.readabilityGrade <= 12) {
				score = 95;
			} else {
				score = 80;
			}
			details = `Flesch-Kincaid grade level: ${context.readabilityGrade.toFixed(1)}`;
			break;
		}

		case "sentence_structure_variety": {
			// Analyze sentence length distribution
			const sentenceLengths = context.sentences.map((s) =>
				s.trim().split(/\s+/).filter(Boolean).length
			);
			if (sentenceLengths.length === 0) {
				score = 0;
				actualValue = "0.0%";
				details = "No sentences found";
				break;
			}
			const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
			const variance =
				sentenceLengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) /
				sentenceLengths.length;
			const stdDev = Math.sqrt(variance);

			// Coefficient of variation - higher means more variety
			const cv = (stdDev / avg) * 100;
			actualValue = cv.toFixed(1) + "%";

			if (cv < 20) {
				score = 60;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Sentence lengths are very consistent. Consider varying sentence structure for better engagement.",
					suggestion: "Mix short, punchy sentences with longer, more detailed ones",
				});
			} else if (cv > 50) {
				score = 75;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: "High variation in sentence length. Some very long sentences may need breaking up.",
				});
			} else {
				score = 90;
			}
			details = `Sentence length variation: ${cv.toFixed(1)}% (coefficient of variation)`;
			break;
		}

		// === Style Analysis ===
		case "grammar_spelling": {
			// Simple grammar checks
			const grammarIssues: string[] = [];

			// Double spaces
			if (/  /.test(context.text)) grammarIssues.push("double spaces");
			// Missing space after period
			if (/\.[A-Z][a-z]/.test(context.text)) grammarIssues.push("missing spaces after periods");
			// Repeated words
			const repeatedWords = context.text.match(/\b(\w+)\s+\1\b/gi) || [];
			if (repeatedWords.length > 0) grammarIssues.push("repeated words");

			actualValue = grammarIssues.length;
			if (grammarIssues.length > 5) {
				score = 45;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: `Multiple grammar/formatting issues found: ${grammarIssues.join(", ")}`,
					suggestion: "Review and correct spacing and punctuation issues",
				});
			} else if (grammarIssues.length > 0) {
				score = 75;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `Minor grammar/formatting issues: ${grammarIssues.join(", ")}`,
				});
			} else {
				score = 98;
			}
			details = `Found ${grammarIssues.length} grammar/formatting issues`;
			break;
		}

		case "active_voice_ratio": {
			actualValue = context.activeVoicePercentage.toFixed(1) + "%";
			if (context.activeVoicePercentage < 70) {
				score = 55;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `Low active voice usage (${context.activeVoicePercentage.toFixed(0)}%). Active voice creates stronger, clearer writing.`,
					suggestion: "Rewrite passive constructions using active voice: 'The team completed the project' instead of 'The project was completed'",
				});
			} else if (context.activeVoicePercentage < 80) {
				score = 75;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `Moderate active voice usage (${context.activeVoicePercentage.toFixed(0)}%). Aim for 80%+ for more engaging writing.`,
				});
			} else {
				score = 95;
			}
			details = `Active voice: ${context.activeVoicePercentage.toFixed(1)}%, Passive voice: ${context.passiveVoicePercentage.toFixed(1)}%`;
			break;
		}

		case "acronym_consistency": {
			actualValue = context.undefinedAcronyms.length;
			if (context.undefinedAcronyms.length > 5) {
				score = 35;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: `${context.undefinedAcronyms.length} acronyms are not defined: ${context.undefinedAcronyms.slice(0, 5).join(", ")}${context.undefinedAcronyms.length > 5 ? "..." : ""}`,
					suggestion: "Define each acronym on first use: 'Application Programming Interface (API)'",
				});
			} else if (context.undefinedAcronyms.length > 0) {
				score = 70;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `Undefined acronyms: ${context.undefinedAcronyms.join(", ")}`,
					suggestion: "Define each acronym on first use",
				});
			} else {
				score = 98;
			}
			details = `Found ${context.undefinedAcronyms.length} undefined acronyms`;
			break;
		}

		case "professional_language": {
			// Check for informal language patterns
			const informalPatterns = [
				{ pattern: /\bain't\b/gi, severity: "high" },
				{ pattern: /\bgonna\b/gi, severity: "high" },
				{ pattern: /\bwanna\b/gi, severity: "medium" },
				{ pattern: /\bdon't\b/gi, severity: "low" }, // acceptable in many contexts
				{ pattern: /\bcan't\b/gi, severity: "low" },
				{ pattern: /!{2,}/g, severity: "medium" }, // multiple exclamation marks
			];

			let informalCount = 0;
			for (const { pattern } of informalPatterns) {
				const matches = context.text.match(pattern);
				if (matches) informalCount += matches.length;
			}

			// Check for contractions in total
			const contractions = (context.text.match(/\b\w+'\w+\b/g) || []).length;

			actualValue = contractions;
			if (informalCount > 0 || contractions > context.sentenceCount * 0.3) {
				score = 65;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `Informal language detected. ${contractions} contractions found in professional document.`,
					suggestion: "Replace contractions with full forms: 'don't' → 'do not', 'can't' → 'cannot'",
				});
			} else {
				score = 90;
			}
			details = `Found ${contractions} contractions`;
			break;
		}

		// === Structure Analysis ===
		case "section_completeness": {
			const { hasIntroduction, hasConclusion, hasExecutiveSummary, hasHeaders, headerCount } =
				context.sectionStructure;

			let completenessScore = 0;
			if (hasIntroduction) completenessScore += 25;
			if (hasConclusion) completenessScore += 25;
			if (hasHeaders) completenessScore += 25;
			if (hasExecutiveSummary) completenessScore += 25;

			score = completenessScore;
			actualValue = `${headerCount} headers`;

			if (!hasIntroduction) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: "Missing introduction section",
					suggestion: "Add an introduction that outlines the document's purpose and structure",
				});
			}
			if (!hasConclusion) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: "Missing conclusion section",
					suggestion: "Add a conclusion that summarizes key points and provides next steps",
				});
			}
			if (!hasHeaders) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No headers found",
					suggestion: "Add section headers to improve document structure and navigation",
				});
			}
			details = `${hasIntroduction ? "✓" : "✗"} Introduction, ${hasConclusion ? "✓" : "✗"} Conclusion, ${hasHeaders ? "✓" : "✗"} Headers (${headerCount})`;
			break;
		}

		case "paragraph_length_consistency": {
			const paragraphLengths = context.paragraphs.map((p) =>
				p.trim().split(/\s+/).filter(Boolean).length
			);
			const avg = paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length || 0;
			const variance =
				paragraphLengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) /
				paragraphLengths.length || 0;
			const stdDev = Math.sqrt(variance);

			actualValue = `${avg.toFixed(0)} words avg`;

			const longParagraphs = paragraphLengths.filter((l) => l > 150).length;
			const shortParagraphs = paragraphLengths.filter((l) => l < 30).length;

			if (longParagraphs > context.paragraphCount * 0.3) {
				score = 55;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `${longParagraphs} paragraphs are very long (>150 words). Consider breaking them up for better readability.`,
					suggestion: "Break long paragraphs into smaller chunks focused on single ideas",
				});
			} else if (shortParagraphs > context.paragraphCount * 0.3) {
				score = 70;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `${shortParagraphs} paragraphs are very short (<30 words). Some may need expansion.`,
				});
			} else {
				score = 88;
			}
			details = `Average: ${avg.toFixed(0)} words, StdDev: ${stdDev.toFixed(1)}, Range: ${Math.min(...paragraphLengths, 0)}-${Math.max(...paragraphLengths, 0)}`;
			break;
		}

		case "introduction_effectiveness": {
			const { hasIntroduction } = context.sectionStructure;
			if (!hasIntroduction) {
				score = 20;
			} else {
				// Check introduction content
				const introMatch = context.text.match(/(?:introduction|overview|background)[\s\S]{0,500}/i);
				if (introMatch) {
					const introText = introMatch[0];
					// Check for key elements
					const hasPurpose = /\b(?:purpose|objective|goal|aim)\b/i.test(introText);
					const hasScope = /\b(?:scope|cover|include|address)\b/i.test(introText);
					const hasContext = introText.length > 100;

					let effectivenessScore = 0;
					if (hasPurpose) effectivenessScore += 30;
					if (hasScope) effectivenessScore += 30;
					if (hasContext) effectivenessScore += 40;

					score = effectivenessScore;

					if (!hasPurpose) {
						issues.push({
							id: generateId(),
							factorId: factor.id,
							priority: "medium",
							message: "Introduction doesn't clearly state the purpose",
							suggestion: "Add a clear statement of purpose or objective",
						});
					}
				} else {
					score = 60;
				}
			}
			break;
		}

		case "conclusion_strength": {
			const { hasConclusion } = context.sectionStructure;
			if (!hasConclusion) {
				score = 20;
			} else {
				// Check conclusion content
				const conclusionMatch = context.text.match(/(?:conclusion|summary|closing)[\s\S]{0,500}/i);
				if (conclusionMatch) {
					const conclusionText = conclusionMatch[0];
					// Check for key elements
					const hasSummary = /\b(?:summary|conclude|overview)\b/i.test(conclusionText);
					const hasNextSteps = /\b(?:next|step|recommend|future|action)\b/i.test(conclusionText);
					const hasCTA = /\b(?:contact|reach|get in touch|call|email)\b/i.test(conclusionText);

					let strengthScore = 0;
					if (hasSummary) strengthScore += 40;
					if (hasNextSteps) strengthScore += 30;
					if (hasCTA) strengthScore += 30;

					score = strengthScore;

					if (!hasNextSteps && !hasCTA) {
						issues.push({
							id: generateId(),
							factorId: factor.id,
							priority: "medium",
							message: "Conclusion lacks clear next steps or call-to-action",
							suggestion: "Add what the reader should do next",
						});
					}
				} else {
					score = 60;
				}
			}
			break;
		}

		case "word_count_analysis": {
			actualValue = context.wordCount;
			if (context.wordCount < 300) {
				score = 60;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `Document is quite short (${context.wordCount} words). Consider if it provides sufficient detail.`,
				});
			} else if (context.wordCount > 10000) {
				score = 70;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `Document is very long (${context.wordCount} words). Consider if it could be more concise.`,
				});
			} else {
				score = 90;
			}
			details = `${context.wordCount} words total`;
			break;
		}

		// === Strategic Elements ===
		case "call_to_action_presence": {
			const ctaPatterns = [
				/\bcontact us\b/gi,
				/\breach out\b/gi,
				/\bget in touch\b/gi,
				/\bcall us\b/gi,
				/\bemail us\b/gi,
				/\blearn more\b/gi,
				/\bfind out more\b/gi,
				/\bschedule\b/gi,
				/\brequest\b/gi,
				/\bsign up\b/gi,
			];

			let ctaCount = 0;
			for (const pattern of ctaPatterns) {
				const matches = context.text.match(pattern);
				if (matches) ctaCount += matches.length;
			}

			actualValue = ctaCount;
			if (ctaCount === 0) {
				score = 40;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: "No clear call-to-action found",
					suggestion: "Add a clear call-to-action: 'Contact us to learn more' or 'Request a proposal'",
				});
			} else if (ctaCount > 5) {
				score = 75;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: "Multiple calls-to-action found. Consider focusing on one primary CTA.",
				});
			} else {
				score = 90;
			}
			details = `Found ${ctaCount} potential calls-to-action`;
			break;
		}

		case "risk_identification": {
			const riskPatterns = [
				/\brisk\b/gi,
				/\bchallenge\b/gi,
				/\bissue\b/gi,
				/\bconcern\b/gi,
				/\blimitation\b/gi,
				/\bmitigation\b/gi,
			];

			let riskMentions = 0;
			for (const pattern of riskPatterns) {
				const matches = context.text.match(pattern);
				if (matches) riskMentions += matches.length;
			}

			actualValue = riskMentions;
			if (riskMentions === 0) {
				score = 50;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No risk acknowledgment found",
					suggestion: "Consider addressing potential risks or challenges proactively",
				});
			} else if (riskMentions < 3) {
				score = 70;
			} else {
				score = 90;
			}
			details = `Found ${riskMentions} risk-related mentions`;
			break;
		}

		// === Content Quality ===
		case "evidence_quality": {
			// Look for quantified claims and metrics
			const metrics = [
				/\d+%/g, // percentages
				/\$[\d,]+/g, // dollar amounts
				/\d+\s*(?:years?|months?|days?)/gi, // time periods
				/\d+\s*(?:million|billion|thousand|k)/gi, // large numbers
				/\d{4}/g, // years (likely data points)
			];

			let evidenceCount = 0;
			for (const pattern of metrics) {
				const matches = context.text.match(pattern);
				if (matches) evidenceCount += matches.length;
			}

			const evidenceRatio = context.sentenceCount > 0 ? evidenceCount / context.sentenceCount : 0;
			actualValue = (evidenceRatio * 100).toFixed(1) + "%";

			if (evidenceRatio < 0.1) {
				score = 55;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: "Low density of supporting evidence and metrics",
					suggestion: "Add specific metrics, percentages, and quantifiable data to support claims",
				});
			} else if (evidenceRatio < 0.2) {
				score = 75;
			} else {
				score = 92;
			}
			details = `${evidenceCount} quantified metrics found`;
			break;
		}

		case "argument_strength": {
			// Check for weak language that undermines arguments
			const weakPhraseCount = context.weakLanguage.reduce((sum, w) => sum + w.count, 0);
			actualValue = weakPhraseCount;

			if (weakPhraseCount > 10) {
				score = 50;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: `${weakPhraseCount} instances of weak language weaken the argument`,
					suggestion: "Replace weak phrases with stronger alternatives",
				});
				// Add specific suggestions for weak language
				context.weakLanguage.slice(0, 3).forEach((w) => {
					suggestions.push({
						id: generateId(),
						type: "rewrite",
						text: `Replace "${w.text}" with stronger language`,
						priority: "medium",
						factorId: factor.id,
						impact: "medium",
						replacement: w.suggestion,
					});
				});
			} else if (weakPhraseCount > 5) {
				score = 70;
			} else {
				score = 90;
			}
			details = `Found ${weakPhraseCount} weak language patterns`;
			break;
		}

		case "citations_completeness": {
			// Simple check for citation patterns
			const citationPatterns = [
				/\([^)]*\d{4}[^)]*\)/g, // author-date citations
				/\[\d+\]/g, // numbered citations
				/\b(?:et al\.|et\. al\.)\b/gi, // et al
				/\b(?:according to|cited in|as reported in|source:)\b/gi,
			];

			let citationCount = 0;
			for (const pattern of citationPatterns) {
				const matches = context.text.match(pattern);
				if (matches) citationCount += matches.length;
			}

			actualValue = citationCount;
			if (citationCount === 0) {
				score = 70; // Not all documents need citations
				details = "No formal citations found";
			} else {
				score = 90;
				details = `${citationCount} citation patterns found`;
			}
			break;
		}

		case "fact_accuracy": {
			const verificationSignals = countPatternMatches(context.text, [
				/\baccording to\b/gi,
				/\bas reported by\b/gi,
				/\bverified by\b/gi,
				/\bevidence\b/gi,
				/\bsource:\s*\S+/gi,
				/\[[0-9]+\]/g,
				/\b(?:https?:\/\/|www\.)\S+/gi,
			]);
			actualValue = `${verificationSignals} verification signals`;
			score = scoreFromCount(verificationSignals, {
				excellent: 5,
				good: 3,
				average: 1,
			}, 50);
			if (verificationSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No verification signals found for factual claims",
					suggestion: "Attach source references or evidence notes to factual and quantified claims",
				});
			}
			details = `Found ${verificationSignals} citation, source, or evidence signals; external fact-checking is still required for final approval`;
			break;
		}

		case "source_credibility": {
			const sourceSignals = countPatternMatches(context.text, [
				/\bsource:\s*[^\n]+/gi,
				/\baccording to\s+[A-Z][A-Za-z0-9&., -]+/gi,
				/\b(?:https?:\/\/|www\.)\S+/gi,
				/\b(?:government|ministry|world bank|united nations|UNGM|auditor|annual report|procurement notice)\b/gi,
			]);
			actualValue = `${sourceSignals} source specificity signals`;
			score = scoreFromCount(sourceSignals, {
				excellent: 4,
				good: 2,
				average: 1,
			}, 45);
			if (sourceSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Sources are not specific enough to evaluate credibility",
					suggestion: "Name the source organization, publication, or URL for key evidence",
				});
			}
			details = `Found ${sourceSignals} named-source, URL, or authority signals`;
			break;
		}

		case "header_hierarchy": {
			const headerLevels = [...context.text.matchAll(/^(#{1,6})\s+\S+/gm)].map((match) => match[1].length);
			const jumps = headerLevels.filter((level, index) => index > 0 && level - headerLevels[index - 1] > 1).length;
			actualValue = `${headerLevels.length} headers, ${jumps} hierarchy jumps`;
			if (headerLevels.length === 0) {
				score = 35;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No heading hierarchy found",
					suggestion: "Use headings to show section order and reviewer navigation",
				});
			} else if (jumps > 0) {
				score = 65;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `${jumps} heading level jump(s) found`,
					suggestion: "Avoid skipping heading levels in proposal sections",
				});
			} else {
				score = headerLevels.length >= 3 ? 92 : 80;
			}
			details = `Header levels: ${headerLevels.join(", ") || "none"}`;
			break;
		}

		case "transitions_sections": {
			const transitionsPerSection = context.sectionStructure.headerCount > 0
				? context.transitions.count / context.sectionStructure.headerCount
				: context.transitions.count;
			actualValue = transitionsPerSection.toFixed(2);
			score = scoreFromCount(Math.round(transitionsPerSection * 10), {
				excellent: 10,
				good: 5,
				average: 1,
			}, 50);
			if (context.transitions.count === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No transition language found between sections",
					suggestion: "Add transition sentences that explain why the next section follows",
				});
			}
			details = `${context.transitions.count} transition phrases across ${context.sectionStructure.headerCount || 1} section group(s)`;
			break;
		}

		case "data_presentation_quality": {
			const tableCount = context.text.match(/^\|.+\|$/gm)?.length ?? 0;
			const listCount = context.text.match(/^\s*(?:[-*]|\d+\.)\s+\S+/gm)?.length ?? 0;
			const figureMentions = countKeywordMentions(context.text, ["table", "figure", "chart", "dashboard", "matrix", "appendix"]);
			const metricCount = countPatternMatches(context.text, [/\d+%/g, /\$[\d,]+/g, /\b\d+(?:\.\d+)?x\b/gi]);
			const presentationSignals = tableCount + listCount + figureMentions + metricCount;
			actualValue = `${presentationSignals} data presentation signals`;
			score = scoreFromCount(presentationSignals, {
				excellent: 8,
				good: 4,
				average: 1,
			}, 45);
			if (presentationSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: "No tables, lists, figures, or quantified presentation signals found",
					suggestion: "Use tables, bullets, or figures for dense data and evidence",
				});
			}
			details = `${tableCount} table rows, ${listCount} list items, ${figureMentions} visual references, ${metricCount} key metrics`;
			break;
		}

		case "tone_consistency": {
			const weakPhraseCount = context.weakLanguage.reduce((sum, w) => sum + w.count, 0);
			const informalCount = countPatternMatches(context.text, [
				/\bain't\b/gi,
				/\bgonna\b/gi,
				/\bwanna\b/gi,
				/!{2,}/g,
			]);
			const toneIssues = weakPhraseCount + informalCount;
			actualValue = `${toneIssues} tone drift signals`;
			score = toneIssues === 0 ? 92 : toneIssues <= 3 ? 78 : toneIssues <= 8 ? 62 : 45;
			if (toneIssues > 3) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: `${toneIssues} weak or informal language signals may create inconsistent tone`,
					suggestion: "Normalize language to a confident proposal voice",
				});
			}
			details = `${weakPhraseCount} weak-language hits and ${informalCount} informal tone hits`;
			break;
		}

		case "jargon_usage": {
			const jargonSignals = countKeywordMentions(context.text, [
				"architecture",
				"integration",
				"interoperability",
				"governance",
				"metadata",
				"analytics",
				"workflow",
				"automation",
				"security",
				"migration",
				"compliance",
			]);
			const contextSignals = countKeywordMentions(context.text, ["means", "defined", "called", "including", "such as", "for example"]);
			actualValue = `${jargonSignals} technical terms, ${contextSignals} context signals`;
			if (jargonSignals === 0) {
				score = 70;
			} else if (contextSignals >= Math.ceil(jargonSignals / 4)) {
				score = 88;
			} else {
				score = 62;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: "Technical terms appear without enough explanatory context",
					suggestion: "Define domain terms when they first appear or tie them to evaluator outcomes",
				});
			}
			details = `Measured ${jargonSignals} technical terms against ${contextSignals} definition or example signals`;
			break;
		}

		case "format_compliance": {
			const formatSignals = Number(context.sectionStructure.hasHeaders)
				+ Number(context.paragraphCount >= 3)
				+ Number(context.wordCount >= 300)
				+ Number(context.avgSentenceLength > 0 && context.avgSentenceLength <= 28);
			actualValue = `${formatSignals}/4 format signals`;
			score = [35, 55, 70, 85, 94][formatSignals] ?? 35;
			if (formatSignals < 3) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Document lacks enough structural signals for basic format compliance",
					suggestion: "Use headings, complete paragraphs, and controlled sentence length",
				});
			}
			details = `Headers: ${context.sectionStructure.hasHeaders}, paragraphs: ${context.paragraphCount}, words: ${context.wordCount}, average sentence length: ${context.avgSentenceLength.toFixed(1)}`;
			break;
		}

		case "visual_consistency": {
			const markdownArtifacts = countPatternMatches(context.text, [/^\s*[-*]\s+\S+/gm, /^\s*\d+\.\s+\S+/gm, /^\|.+\|$/gm, /\*\*[^*]+\*\*/g]);
			const malformedMarkers = countPatternMatches(context.text, [/\*\*[^*]*(?:\n|$)/g, /^\s*[-*]\s*$/gm]);
			actualValue = `${markdownArtifacts} visual markers, ${malformedMarkers} malformed markers`;
			score = malformedMarkers === 0
				? markdownArtifacts > 0 ? 88 : 75
				: malformedMarkers <= 2 ? 65 : 45;
			if (malformedMarkers > 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "low",
					message: `${malformedMarkers} potentially malformed visual formatting marker(s) found`,
					suggestion: "Review bold markers, list items, and table rows for consistency",
				});
			}
			details = `Found ${markdownArtifacts} structural formatting markers and ${malformedMarkers} malformed markers`;
			break;
		}

		case "compliance_alignment": {
			const complianceSignals = countKeywordMentions(context.text, [
				"shall",
				"must",
				"required",
				"requirement",
				"compliance",
				"compliant",
				"mandatory",
				"evaluation",
				"criteria",
				"RFP",
				"solicitation",
			]);
			actualValue = `${complianceSignals} compliance signals`;
			score = scoreFromCount(complianceSignals, {
				excellent: 8,
				good: 4,
				average: 1,
			}, 45);
			if (complianceSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "high",
					message: "No explicit requirement or compliance language found",
					suggestion: "Tie response sections to mandatory requirements and evaluation criteria",
				});
			}
			details = `Found ${complianceSignals} requirement, mandatory, or evaluation criteria signals`;
			break;
		}

		case "target_audience_alignment": {
			const audienceSignals = countKeywordMentions(context.text, [
				"client",
				"agency",
				"ministry",
				"evaluator",
				"committee",
				"user",
				"stakeholder",
				"beneficiary",
				"community",
				"procurement",
			]);
			actualValue = `${audienceSignals} audience signals`;
			score = scoreFromCount(audienceSignals, {
				excellent: 6,
				good: 3,
				average: 1,
			}, 50);
			if (audienceSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Document does not name the evaluator, client, users, or stakeholders",
					suggestion: "Anchor benefits to the reader's role and operating context",
				});
			}
			details = `Found ${audienceSignals} reader, stakeholder, or evaluator references`;
			break;
		}

		case "risk_mitigation_quality": {
			const riskMentions = countKeywordMentions(context.text, ["risk", "challenge", "issue", "constraint", "dependency"]);
			const mitigationMentions = countKeywordMentions(context.text, ["mitigate", "mitigation", "control", "contingency", "monitor", "escalate", "owner"]);
			actualValue = `${riskMentions} risks, ${mitigationMentions} mitigation signals`;
			if (riskMentions === 0) {
				score = 45;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Risks are not paired with mitigation plans",
					suggestion: "Identify key delivery risks and assign controls, owners, and triggers",
				});
			} else if (mitigationMentions >= riskMentions) {
				score = 90;
			} else if (mitigationMentions > 0) {
				score = 72;
			} else {
				score = 55;
			}
			details = `Risk mentions: ${riskMentions}; mitigation/control mentions: ${mitigationMentions}`;
			break;
		}

		case "timeline_feasibility": {
			const timelineSignals = countPatternMatches(context.text, [
				/\b(?:day|week|month|quarter|phase|milestone|schedule|timeline|deadline)\b/gi,
				/\b\d+\s*(?:days?|weeks?|months?|quarters?)\b/gi,
			]);
			actualValue = `${timelineSignals} timeline signals`;
			score = scoreFromCount(timelineSignals, {
				excellent: 5,
				good: 3,
				average: 1,
			}, 45);
			if (timelineSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No schedule, phase, milestone, or duration evidence found",
					suggestion: "Add a realistic phase or milestone timeline with durations",
				});
			}
			details = `Found ${timelineSignals} schedule, milestone, or duration signals`;
			break;
		}

		case "budget_justification": {
			const budgetSignals = countPatternMatches(context.text, [
				/\$[\d,]+/g,
				/\b(?:budget|cost|price|pricing|fee|value for money|level of effort|LOE|resource|resources)\b/gi,
			]);
			const rationaleSignals = countKeywordMentions(context.text, ["because", "based on", "aligned", "reflects", "includes", "covers"]);
			actualValue = `${budgetSignals} budget signals, ${rationaleSignals} rationale signals`;
			if (budgetSignals === 0) {
				score = 45;
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "No budget or cost justification language found",
					suggestion: "Explain how costs map to scope, effort, and value for money",
				});
			} else if (rationaleSignals >= 2) {
				score = 88;
			} else {
				score = 68;
			}
			details = `Budget/cost signals: ${budgetSignals}; rationale signals: ${rationaleSignals}`;
			break;
		}

		case "team_qualifications_match": {
			const qualificationSignals = countKeywordMentions(context.text, [
				"team",
				"personnel",
				"expert",
				"specialist",
				"experience",
				"certified",
				"qualification",
				"past performance",
				"delivered",
				"implemented",
			]);
			actualValue = `${qualificationSignals} qualification signals`;
			score = scoreFromCount(qualificationSignals, {
				excellent: 7,
				good: 4,
				average: 1,
			}, 45);
			if (qualificationSignals === 0) {
				issues.push({
					id: generateId(),
					factorId: factor.id,
					priority: "medium",
					message: "Team qualifications are not tied to delivery requirements",
					suggestion: "Name relevant roles, experience, certifications, and past delivery proof",
				});
			}
			details = `Found ${qualificationSignals} team, credential, or delivery-experience signals`;
			break;
		}

		// === Default factors ===
		default: {
			score = deterministicBaselineScore(context);
			actualValue = "Deterministic baseline";
			details = "Scored from document length, section structure, transitions, readability, and weak-language signals";
			issues.push({
				id: generateId(),
				factorId: factor.id,
				priority: "low",
				message: "No dedicated quality rule exists for this factor",
				suggestion: "Add a factor-specific rule before using this score in approval gates",
			});
		}
	}

	return {
		id: factor.id,
		name: factor.name,
		category: factor.category,
		description: factor.description,
		score: Math.round(Math.max(0, Math.min(100, score))),
		weight: factor.weight,
		targetValue: factor.targetValue,
		actualValue,
		measurementUnit: factor.measurementUnit,
		issues,
		suggestions,
		details,
	};
}

// ============================================================================
// Main Assessment Function
// ============================================================================

export interface RunQualityAssessmentOptions {
	categories?: QualityFactorCategory[];
	strictMode?: boolean;
}

/**
 * Run a complete quality assessment on document content.
 */
export function runQualityAssessment(
	documentId: string,
	content: string,
	options: RunQualityAssessmentOptions = {}
): QualityAssessment {
	const { categories, strictMode = false } = options;

	// Create analysis context
	const context = createAnalysisContext(content);

	// Filter factors by category if specified
	const factorsToAnalyze = categories
		? QUALITY_FACTORS.filter((f) => categories.includes(f.category))
		: QUALITY_FACTORS;

	// Analyze all factors
	const factorResults = factorsToAnalyze.map((factor) => analyzeFactor(factor, context));

	// Apply strict mode penalty if enabled
	if (strictMode) {
		for (const result of factorResults) {
			result.score = Math.max(0, result.score - 5);
		}
	}

	// Calculate category scores
	const categoryResults: CategoryScore[] = [];
	const categoryGroups = new Map<QualityFactorCategory, QualityFactorResult[]>();

	for (const result of factorResults) {
		const existing = categoryGroups.get(result.category) || [];
		existing.push(result);
		categoryGroups.set(result.category, existing);
	}

	for (const [category, factors] of categoryGroups) {
		const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
		const weightedScore =
			factors.reduce((sum, f) => sum + f.score * f.weight, 0) / (totalWeight || 1);
		const allIssues = factors.flatMap((f) => f.issues);

		categoryResults.push({
			category,
			score: Math.round(weightedScore),
			weightedScore,
			factorCount: factors.length,
			issueCount: allIssues.length,
			topIssues: allIssues.slice(0, 3),
		});
	}

	// Calculate overall score (weighted average of categories)
	const categoryWeights: Record<QualityFactorCategory, number> = {
		content: 0.25,
		structure: 0.20,
		style: 0.20,
		technical: 0.10,
		compliance: 0.15,
		strategy: 0.10,
	};

	const totalCategoryWeight = categoryResults.reduce(
		(sum, c) => sum + categoryWeights[c.category],
		0
	);

	const overallScore = Math.round(
		categoryResults.reduce(
			(sum, c) => sum + c.score * categoryWeights[c.category],
			0
		) / (totalCategoryWeight || 1)
	);

	// Collect all issues and suggestions
	const allIssues = factorResults.flatMap((f) => f.issues);
	const allSuggestions = factorResults.flatMap((f) => f.suggestions);

	// Sort by priority
	const priorityOrder: Record<IssuePriority, number> = {
		critical: 0,
		high: 1,
		medium: 2,
		low: 3,
	};

	allIssues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
	allSuggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

	return {
		id: generateId(),
		documentId,
		overallScore,
		scoreLevel: getScoreLevel(overallScore),
		categoryScores: categoryResults,
		factors: factorResults,
		issues: allIssues,
		suggestions: allSuggestions,
		summary: {
			wordCount: context.wordCount,
			paragraphCount: context.paragraphCount,
			sentenceCount: context.sentenceCount,
			averageSentenceLength: context.avgSentenceLength,
			passiveVoicePercentage: context.passiveVoicePercentage,
			readabilityGrade: context.readabilityGrade,
			activeVoicePercentage: context.activeVoicePercentage,
			undefinedAcronyms: context.undefinedAcronyms,
			weakLanguageCount: context.weakLanguage.reduce((sum, w) => sum + w.count, 0),
		},
		assessedAt: new Date(),
		modelVersion: "quality-assessment-v1.1",
	};
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compare two quality assessments and identify changes.
 */
export function compareAssessments(
	current: QualityAssessment,
	previous: QualityAssessment | null
): QualityAssessment["comparisons"] {
	if (!previous) {
		return {
			scoreDelta: 0,
			improvedFactors: [],
			declinedFactors: [],
			newIssues: [],
			resolvedIssues: [],
		};
	}

	const scoreDelta = current.overallScore - previous.overallScore;

	// Compare factors
	const improvedFactors: string[] = [];
	const declinedFactors: string[] = [];

	for (const currentFactor of current.factors) {
		const previousFactor = previous.factors.find((f) => f.id === currentFactor.id);
		if (previousFactor) {
			const delta = currentFactor.score - previousFactor.score;
			if (delta > 5) {
				improvedFactors.push(currentFactor.name);
			} else if (delta < -5) {
				declinedFactors.push(currentFactor.name);
			}
		}
	}

	// Compare issues (simplified)
	const newIssues: QualityIssue[] = [];
	const resolvedIssues: QualityIssue[] = [];

	// In a real implementation, we'd match issues by content similarity
	// For now, just report counts
	const previousIssueCount = previous.issues.length;
	const currentIssueCount = current.issues.length;

	if (currentIssueCount < previousIssueCount) {
		resolvedIssues.push(...previous.issues.slice(0, previousIssueCount - currentIssueCount));
	} else if (currentIssueCount > previousIssueCount) {
		newIssues.push(...current.issues.slice(0, currentIssueCount - previousIssueCount));
	}

	return {
		previousVersionId: previous.versionId || previous.id,
		scoreDelta,
		improvedFactors,
		declinedFactors,
		newIssues,
		resolvedIssues,
	};
}

// ============================================================================
// Export Summary Functions
// ============================================================================

/**
 * Generate a summary report of the quality assessment.
 */
export function generateSummaryReport(assessment: QualityAssessment): string {
	const lines = [
		`# Quality Assessment Report`,
		`Generated: ${assessment.assessedAt.toISOString()}`,
		"",
		`## Overall Score: ${assessment.overallScore}/100 (${assessment.scoreLevel})`,
		"",
		`### Document Statistics`,
		`- Word Count: ${assessment.summary.wordCount}`,
		`- Paragraphs: ${assessment.summary.paragraphCount}`,
		`- Sentences: ${assessment.summary.sentenceCount}`,
		`- Readability: Grade ${assessment.summary.readabilityGrade.toFixed(1)}`,
		`- Active Voice: ${assessment.summary.activeVoicePercentage.toFixed(1)}%`,
		"",
		`### Category Scores`,
		...assessment.categoryScores.map(
			(c) => `- ${getCategoryLabel(c.category)}: ${c.score}/100`
		),
		"",
		`### Issues Summary`,
		`- Critical: ${assessment.issues.filter((i) => i.priority === "critical").length}`,
		`- High: ${assessment.issues.filter((i) => i.priority === "high").length}`,
		`- Medium: ${assessment.issues.filter((i) => i.priority === "medium").length}`,
		`- Low: ${assessment.issues.filter((i) => i.priority === "low").length}`,
		"",
		`### Top Suggestions`,
		...assessment.suggestions.slice(0, 5).map((s) => `- ${s.text}`),
	];

	return lines.join("\n");
}

/**
 * Get priority counts for display.
 */
export function getPriorityCounts(
	items: Array<{ priority: IssuePriority }>
): Record<IssuePriority, number> {
	return items.reduce(
		(counts, item) => {
			counts[item.priority]++;
			return counts;
		},
		{ critical: 0, high: 0, medium: 0, low: 0 }
	);
}

// ============================================================================
// Re-export types
// ============================================================================
export type {
	FactorAnalysisContext,
};
