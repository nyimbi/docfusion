/**
 * AI types for DocFusion.
 *
 * Handles slash commands, AI completions, and intelligent
 * document assistance features.
 */

import type { DocumentId, BlockId } from "./document";

/** AI request identifier */
export type AIRequestId = string;

/** AI command identifier */
export type AICommandId = string;

/**
 * Status of an AI operation.
 */
export type AIOperationStatus =
	| "idle"
	| "pending"
	| "streaming"
	| "completed"
	| "error"
	| "cancelled";

/**
 * Categories of AI commands.
 */
export type AICommandCategory =
	| "writing"      // Content generation and improvement
	| "editing"      // Text transformations
	| "analysis"     // Content analysis and insights
	| "compliance"   // Regulatory and compliance checks
	| "translation"; // Language translation

/**
 * Registered AI slash command definition.
 */
export interface AICommand {
	id: AICommandId;
	/** Command trigger (e.g., "improve", "expand") */
	name: string;
	/** Display label in command palette */
	label: string;
	/** Command description */
	description: string;
	/** Command category */
	category: AICommandCategory;
	/** Icon name (lucide) */
	icon: string;
	/** Keyboard shortcut (optional) */
	shortcut?: string;
	/** Whether command requires text selection */
	requiresSelection: boolean;
	/** Whether command accepts additional arguments */
	acceptsArguments: boolean;
	/** Argument schema if accepts arguments */
	argumentSchema?: AICommandArgument[];
	/** Example usage */
	examples?: string[];
}

/**
 * Argument definition for AI commands.
 */
export interface AICommandArgument {
	name: string;
	type: "string" | "number" | "select";
	required: boolean;
	description: string;
	defaultValue?: string | number;
	options?: { value: string; label: string }[];
}

/**
 * Context provided to AI for better responses.
 */
export interface AIContext {
	/** Document ID being edited */
	documentId: DocumentId;
	/** Document title */
	documentTitle?: string;
	/** Text before the cursor/selection */
	textBefore: string;
	/** Text after the cursor/selection */
	textAfter: string;
	/** Currently selected text (if any) */
	selectedText?: string;
	/** Current block type */
	blockType?: string;
	/** Block ID being edited */
	blockId?: BlockId;
	/** Document metadata for context */
	metadata?: Record<string, unknown>;
	/** Template context if document is from template */
	templateContext?: {
		templateId: string;
		templateName: string;
		aiInstructions?: string[];
	};
}

/**
 * Request to the AI completion API.
 */
export interface AICompletionRequest {
	/** Unique request ID for tracking */
	requestId: AIRequestId;
	/** Command being executed */
	command: string;
	/** Additional command arguments */
	arguments?: Record<string, string | number>;
	/** Context for the AI */
	context: AIContext;
	/** Whether to stream the response */
	stream?: boolean;
	/** Maximum tokens for response */
	maxTokens?: number;
	/** Temperature for creativity (0-1) */
	temperature?: number;
}

/**
 * Response from the AI completion API.
 */
export interface AICompletionResponse {
	requestId: AIRequestId;
	/** Generated result text */
	result: string;
	/** Confidence score (0-1) */
	confidence: number;
	/** Alternative suggestions */
	alternatives?: AIAlternative[];
	/** Token usage information */
	usage?: AIUsage;
	/** Processing time in milliseconds */
	processingTime: number;
	/** Any warnings or notes */
	warnings?: string[];
}

/**
 * Alternative AI suggestion.
 */
export interface AIAlternative {
	text: string;
	confidence: number;
	description?: string;
}

/**
 * Token usage information.
 */
export interface AIUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Streaming chunk from AI response.
 */
export interface AIStreamChunk {
	requestId: AIRequestId;
	/** Chunk of generated text */
	delta: string;
	/** Whether this is the final chunk */
	isComplete: boolean;
	/** Accumulated text so far */
	accumulated?: string;
}

/**
 * State of an active AI operation.
 */
export interface AIOperation {
	id: AIRequestId;
	command: string;
	status: AIOperationStatus;
	/** Progress (0-100) for long operations */
	progress?: number;
	/** Accumulated result text (for streaming) */
	result: string;
	/** Error message if failed */
	error?: string;
	/** When the operation started */
	startedAt: string;
	/** When the operation completed */
	completedAt?: string;
	/** Position in document where result should be inserted */
	insertPosition?: {
		from: number;
		to: number;
	};
}

/**
 * User's action on AI suggestion.
 */
export type AIActionType = "accept" | "reject" | "edit" | "retry";

/**
 * Feedback on AI suggestion for improvement.
 */
export interface AIFeedback {
	requestId: AIRequestId;
	action: AIActionType;
	/** User's edited version if action is "edit" */
	editedResult?: string;
	/** Rating (1-5) */
	rating?: number;
	/** Optional feedback text */
	comment?: string;
}

/**
 * AI-powered compliance check result.
 */
export interface AIComplianceResult {
	requestId: AIRequestId;
	/** Overall compliance score (0-100) */
	score: number;
	/** Issues found */
	issues: AIComplianceIssue[];
	/** Suggestions for improvement */
	suggestions: AIComplianceSuggestion[];
	/** Frameworks checked */
	frameworksChecked: string[];
}

/**
 * Compliance issue found by AI.
 */
export interface AIComplianceIssue {
	id: string;
	/** Severity level */
	severity: "error" | "warning" | "info";
	/** Regulatory framework */
	framework: string;
	/** Specific clause violated */
	clause?: string;
	/** Issue description */
	description: string;
	/** Location in document */
	location?: {
		blockId: BlockId;
		from: number;
		to: number;
	};
	/** Suggested fix */
	suggestedFix?: string;
}

/**
 * Compliance improvement suggestion.
 */
export interface AIComplianceSuggestion {
	id: string;
	/** What to improve */
	description: string;
	/** Expected impact on score */
	impactScore: number;
	/** How to implement */
	implementation?: string;
}

/**
 * AI writing improvement suggestion.
 */
export interface AIWritingSuggestion {
	id: string;
	type: "grammar" | "clarity" | "tone" | "conciseness" | "structure";
	/** Original text */
	original: string;
	/** Suggested replacement */
	suggested: string;
	/** Explanation of the change */
	explanation: string;
	/** Location in document */
	location: {
		from: number;
		to: number;
	};
	/** Confidence score */
	confidence: number;
}

/**
 * Built-in AI commands registry.
 */
export const AI_COMMANDS: AICommand[] = [
	{
		id: "improve",
		name: "improve",
		label: "Improve Writing",
		description: "Enhance clarity, grammar, and overall quality",
		category: "writing",
		icon: "Sparkles",
		requiresSelection: true,
		acceptsArguments: false,
		examples: ["/improve"],
	},
	{
		id: "expand",
		name: "expand",
		label: "Expand",
		description: "Elaborate on the selected text with more detail",
		category: "writing",
		icon: "Maximize2",
		requiresSelection: true,
		acceptsArguments: false,
		examples: ["/expand"],
	},
	{
		id: "condense",
		name: "condense",
		label: "Condense",
		description: "Make the selected text more concise and brief",
		category: "editing",
		icon: "Minimize2",
		requiresSelection: true,
		acceptsArguments: false,
		examples: ["/condense"],
	},
	{
		id: "summarize",
		name: "summarize",
		label: "Summarize",
		description: "Create a concise summary of the selected text",
		category: "editing",
		icon: "FileText",
		requiresSelection: true,
		acceptsArguments: false,
		examples: ["/summarize"],
	},
	{
		id: "tone",
		name: "tone",
		label: "Adjust Tone",
		description: "Change the tone of the selected text",
		category: "editing",
		icon: "MessageSquare",
		requiresSelection: true,
		acceptsArguments: true,
		argumentSchema: [
			{
				name: "style",
				type: "select",
				required: true,
				description: "Target tone",
				options: [
					{ value: "formal", label: "Formal" },
					{ value: "casual", label: "Casual" },
					{ value: "professional", label: "Professional" },
					{ value: "friendly", label: "Friendly" },
					{ value: "technical", label: "Technical" },
				],
			},
		],
		examples: ["/tone formal", "/tone casual"],
	},
	{
		id: "translate",
		name: "translate",
		label: "Translate",
		description: "Translate text to another language",
		category: "translation",
		icon: "Languages",
		requiresSelection: true,
		acceptsArguments: true,
		argumentSchema: [
			{
				name: "language",
				type: "string",
				required: true,
				description: "Target language",
			},
		],
		examples: ["/translate Spanish", "/translate French"],
	},
	{
		id: "continue",
		name: "continue",
		label: "Continue Writing",
		description: "Continue writing from the current cursor position",
		category: "writing",
		icon: "PenLine",
		requiresSelection: false,
		acceptsArguments: false,
		examples: ["/continue"],
	},
	{
		id: "explain",
		name: "explain",
		label: "Explain Simply",
		description: "Explain complex text in simpler terms",
		category: "analysis",
		icon: "HelpCircle",
		requiresSelection: true,
		acceptsArguments: false,
		examples: ["/explain"],
	},
	{
		id: "compliance",
		name: "compliance",
		label: "Check Compliance",
		description: "Check text for regulatory compliance issues",
		category: "compliance",
		icon: "Shield",
		requiresSelection: true,
		acceptsArguments: true,
		argumentSchema: [
			{
				name: "framework",
				type: "select",
				required: false,
				description: "Compliance framework",
				defaultValue: "general",
				options: [
					{ value: "general", label: "General" },
					{ value: "far", label: "FAR" },
					{ value: "dfars", label: "DFARS" },
					{ value: "gdpr", label: "GDPR" },
					{ value: "hipaa", label: "HIPAA" },
				],
			},
		],
		examples: ["/compliance", "/compliance far"],
	},
];

/**
 * Get command by name.
 */
export function getAICommand(name: string): AICommand | undefined {
	return AI_COMMANDS.find((cmd) => cmd.name === name);
}

/**
 * Get commands by category.
 */
export function getAICommandsByCategory(category: AICommandCategory): AICommand[] {
	return AI_COMMANDS.filter((cmd) => cmd.category === category);
}

/**
 * Parse a slash command string into command and arguments.
 */
export function parseSlashCommand(input: string): {
	command: string;
	args: string[];
} | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith("/")) return null;

	const parts = trimmed.slice(1).split(/\s+/);
	const command = parts[0]?.toLowerCase();
	const args = parts.slice(1);

	if (!command) return null;

	return { command, args };
}
