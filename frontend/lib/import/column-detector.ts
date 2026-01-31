/**
 * Column Detection for DocFusion
 *
 * Intelligent column name matching with confidence scoring.
 * Suggests mappings between source file columns and target database columns.
 *
 * Matching Strategies (in priority order):
 * 1. Exact match (100% confidence)
 * 2. Normalized match - lowercase, strip underscores/dashes (90%)
 * 3. Synonym match - known synonyms (80%)
 * 4. Contains match - one contains the other (70%)
 * 5. Fuzzy match - Levenshtein distance (50-60%)
 */

import type {
	MappingSuggestion,
	ColumnSchema,
	DetectedColumnType,
	ColumnDataType,
} from "@/lib/types/import";

// ============================================================================
// Column Name Synonyms
// ============================================================================

/**
 * Known synonyms for common column names.
 * Keys are canonical names (database columns), values are common variations.
 */
const COLUMN_SYNONYMS: Record<string, string[]> = {
	// Identity
	title: ["title", "name", "project", "project name", "project title", "subject", "rfp title", "opportunity"],
	name: ["name", "company name", "organization name", "account name", "full name"],
	firstName: ["first name", "firstname", "given name", "forename", "first"],
	lastName: ["last name", "lastname", "surname", "family name", "last"],
	fullName: ["full name", "fullname", "name", "contact name", "display name"],

	// Organization
	organization: ["organization", "org", "company", "client", "issuer", "agency", "firm", "employer"],
	accountName: ["account", "company", "organization", "business", "client name"],

	// Contact
	email: ["email", "e-mail", "mail", "email address", "contact email", "work email"],
	phone: ["phone", "tel", "telephone", "mobile", "cell", "contact phone", "work phone"],
	website: ["website", "web", "url", "site", "web address", "homepage"],
	linkedinUrl: ["linkedin", "linkedin url", "linkedin profile", "li url"],

	// Location
	country: ["country", "nation", "location country"],
	countryRegion: ["country", "region", "country/region", "location", "geography"],
	city: ["city", "town", "municipality", "locality"],
	address: ["address", "street", "street address", "location", "mailing address"],
	region: ["region", "area", "territory", "zone"],

	// Classification
	category: ["category", "type", "sector", "industry", "classification"],
	industry: ["industry", "sector", "vertical", "business sector"],
	sector: ["sector", "industry", "vertical"],

	// Dates
	deadline: ["deadline", "due", "due date", "closing", "close date", "end date", "submission date", "submission deadline"],
	createdAt: ["created", "created at", "created date", "date created", "creation date"],
	updatedAt: ["updated", "updated at", "modified", "modified date", "last modified"],

	// Financial
	budgetValue: ["budget", "value", "amount", "worth", "cost", "price", "est. budget", "estimated budget"],
	annualRevenue: ["revenue", "annual revenue", "yearly revenue", "sales"],
	contractValue: ["contract value", "deal value", "opportunity value"],

	// Content
	description: ["description", "desc", "details", "about", "summary", "overview"],
	projectSummary: ["summary", "project summary", "scope summary", "overview", "description"],
	projectScope: ["scope", "project scope", "deliverables", "scope & deliverables"],
	keyRequirements: ["requirements", "key requirements", "qualifications", "criteria"],
	technicalRequirements: ["technical requirements", "tech requirements", "technical stack", "technology"],
	notes: ["notes", "comments", "remarks", "additional notes"],

	// Source
	sourceId: ["id", "ref", "reference", "source id", "ref no", "reference no", "no.", "record id"],
	sourcePlatform: ["source", "platform", "portal", "origin", "source platform", "tender portal"],
	rfpLink: ["link", "url", "rfp link", "document link", "tender link", "rfp/eoi link"],

	// Status
	status: ["status", "state", "stage", "current status"],
	stage: ["stage", "pipeline stage", "sales stage", "deal stage"],

	// Partner/Account specific
	partnerTier: ["tier", "partner tier", "level", "partnership tier"],
	capabilities: ["capabilities", "skills", "expertise", "competencies", "specializations"],
	coreCapabilities: ["core capabilities", "main capabilities", "primary capabilities"],

	// Contact specific
	jobTitle: ["title", "job title", "position", "role", "designation"],
	department: ["department", "dept", "division", "unit", "team"],
	role: ["role", "job role", "function", "position"],
};

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Normalize a column name for comparison.
 * - Lowercase
 * - Replace underscores and dashes with spaces
 * - Remove extra whitespace
 * - Remove common prefixes/suffixes
 */
function normalizeColumnName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[_\-]/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^(col|column|field|fld)[\s_]*/i, "")
		.trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1 // deletion
				);
			}
		}
	}

	return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings.
 */
function stringSimilarity(a: string, b: string): number {
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	const distance = levenshteinDistance(a, b);
	return 1 - distance / maxLen;
}

// ============================================================================
// Type Compatibility
// ============================================================================

/**
 * Check if source type is compatible with target type.
 */
function isTypeCompatible(sourceType: ColumnDataType, targetType: ColumnDataType): boolean {
	// Same type is always compatible
	if (sourceType === targetType) return true;

	// String is compatible with everything
	if (targetType === "string" || targetType === "text") return true;

	// Number types are interchangeable
	const numericTypes: ColumnDataType[] = ["number", "integer", "currency"];
	if (numericTypes.includes(sourceType) && numericTypes.includes(targetType)) return true;

	// Date types are interchangeable
	const dateTypes: ColumnDataType[] = ["date", "datetime"];
	if (dateTypes.includes(sourceType) && dateTypes.includes(targetType)) return true;

	// Text/string sources can map to many targets (already covered by targetType check above)
	// This is a fallthrough for any remaining combinations
	return false;
}

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Try exact match.
 */
function tryExactMatch(source: string, target: string): number | null {
	if (source.toLowerCase() === target.toLowerCase()) {
		return 100;
	}
	return null;
}

/**
 * Try normalized match.
 */
function tryNormalizedMatch(source: string, target: string): number | null {
	const normalizedSource = normalizeColumnName(source);
	const normalizedTarget = normalizeColumnName(target);

	if (normalizedSource === normalizedTarget) {
		return 90;
	}
	return null;
}

/**
 * Try synonym match.
 */
function trySynonymMatch(source: string, target: string): number | null {
	const normalizedSource = normalizeColumnName(source);
	const synonyms = COLUMN_SYNONYMS[target];

	if (synonyms) {
		for (const synonym of synonyms) {
			if (normalizedSource === synonym.toLowerCase()) {
				return 85;
			}
			// Check if source contains the synonym
			if (normalizedSource.includes(synonym.toLowerCase())) {
				return 75;
			}
		}
	}

	return null;
}

/**
 * Try contains match.
 */
function tryContainsMatch(source: string, target: string): number | null {
	const normalizedSource = normalizeColumnName(source);
	const normalizedTarget = normalizeColumnName(target);

	// One contains the other
	if (normalizedSource.includes(normalizedTarget)) {
		return 70;
	}
	if (normalizedTarget.includes(normalizedSource)) {
		return 65;
	}

	return null;
}

/**
 * Try fuzzy match using Levenshtein distance.
 */
function tryFuzzyMatch(source: string, target: string): number | null {
	const normalizedSource = normalizeColumnName(source);
	const normalizedTarget = normalizeColumnName(target);

	const similarity = stringSimilarity(normalizedSource, normalizedTarget);

	// Only consider if similarity is above 0.6
	if (similarity >= 0.6) {
		return Math.round(50 + similarity * 20); // 50-70 range
	}

	return null;
}

// ============================================================================
// Main Detection Functions
// ============================================================================

/**
 * Calculate match confidence between a source column and target column.
 */
function calculateMatchConfidence(
	sourceColumn: string,
	targetColumn: ColumnSchema,
	sourceType?: DetectedColumnType
): { confidence: number; reason: string } | null {
	// Try each matching strategy in priority order
	const strategies = [
		{ fn: tryExactMatch, reason: "Exact name match" },
		{ fn: tryNormalizedMatch, reason: "Normalized name match" },
		{ fn: trySynonymMatch, reason: "Known synonym match" },
		{ fn: tryContainsMatch, reason: "Partial name match" },
		{ fn: tryFuzzyMatch, reason: "Similar name" },
	];

	for (const { fn, reason } of strategies) {
		const confidence = fn(sourceColumn, targetColumn.name);
		if (confidence !== null) {
			// Adjust confidence based on type compatibility
			let adjustedConfidence = confidence;
			if (sourceType && !isTypeCompatible(sourceType.inferredType, targetColumn.type)) {
				adjustedConfidence = Math.max(0, confidence - 20);
			}

			if (adjustedConfidence >= 50) {
				return { confidence: adjustedConfidence, reason };
			}
		}
	}

	return null;
}

/**
 * Generate mapping suggestions for all source columns.
 */
export function detectMappings(
	sourceColumns: DetectedColumnType[],
	targetSchema: ColumnSchema[]
): MappingSuggestion[] {
	const suggestions: MappingSuggestion[] = [];
	const usedTargets = new Set<string>();

	// Sort source columns by fill rate (more complete columns first)
	const sortedSource = [...sourceColumns].sort((a, b) => b.fillRate - a.fillRate);

	// Try to match each source column
	for (const sourceCol of sortedSource) {
		const candidates: Array<{
			target: string;
			confidence: number;
			reason: string;
		}> = [];

		// Check against all target columns
		for (const targetCol of targetSchema) {
			// Skip already matched targets
			if (usedTargets.has(targetCol.name)) continue;

			const match = calculateMatchConfidence(sourceCol.name, targetCol, sourceCol);
			if (match) {
				candidates.push({
					target: targetCol.name,
					...match,
				});
			}
		}

		// Take the best match
		if (candidates.length > 0) {
			candidates.sort((a, b) => b.confidence - a.confidence);
			const best = candidates[0];

			// Only suggest if confidence is above threshold
			if (best.confidence >= 50) {
				suggestions.push({
					targetColumn: best.target,
					sourceColumn: sourceCol.name,
					confidence: best.confidence,
					reason: best.reason,
				});
				usedTargets.add(best.target);
			}
		}
	}

	// Sort suggestions by confidence
	return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect mappings using template patterns (higher accuracy).
 */
export function detectMappingsWithTemplate(
	sourceColumns: string[],
	templatePatterns: Record<string, string[]>
): MappingSuggestion[] {
	const suggestions: MappingSuggestion[] = [];
	const usedTargets = new Set<string>();

	for (const sourceCol of sourceColumns) {
		const normalizedSource = normalizeColumnName(sourceCol);

		for (const [targetCol, patterns] of Object.entries(templatePatterns)) {
			if (usedTargets.has(targetCol)) continue;

			for (const pattern of patterns) {
				if (normalizeColumnName(pattern) === normalizedSource) {
					suggestions.push({
						targetColumn: targetCol,
						sourceColumn: sourceCol,
						confidence: 95, // High confidence for template match
						reason: "Template pattern match",
					});
					usedTargets.add(targetCol);
					break;
				}
			}
		}
	}

	return suggestions;
}

/**
 * Merge template suggestions with auto-detected suggestions.
 * Template matches take priority.
 */
export function mergeSuggestions(
	templateSuggestions: MappingSuggestion[],
	autoSuggestions: MappingSuggestion[]
): MappingSuggestion[] {
	const merged: MappingSuggestion[] = [...templateSuggestions];
	const usedTargets = new Set(templateSuggestions.map((s) => s.targetColumn));
	const usedSources = new Set(templateSuggestions.map((s) => s.sourceColumn));

	// Add auto suggestions that don't conflict
	for (const suggestion of autoSuggestions) {
		if (!usedTargets.has(suggestion.targetColumn) && !usedSources.has(suggestion.sourceColumn)) {
			merged.push(suggestion);
			usedTargets.add(suggestion.targetColumn);
			usedSources.add(suggestion.sourceColumn);
		}
	}

	return merged.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get confidence color for UI display.
 */
export function getConfidenceColor(confidence: number): string {
	if (confidence >= 90) return "text-green-600";
	if (confidence >= 70) return "text-yellow-600";
	if (confidence >= 50) return "text-orange-600";
	return "text-red-600";
}

/**
 * Get confidence label for UI display.
 */
export function getConfidenceLabel(confidence: number): string {
	if (confidence >= 90) return "High";
	if (confidence >= 70) return "Medium";
	if (confidence >= 50) return "Low";
	return "Unlikely";
}
