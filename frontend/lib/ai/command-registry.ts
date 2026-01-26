/**
 * AI command registry for DocFusion.
 *
 * Manages registration, lookup, and execution of AI slash commands.
 * Provides a central registry for all available commands.
 */

import type {
	AICommand,
	AICommandCategory,
	AIContext,
	AICompletionResponse,
} from "@/lib/types/ai";
import { AI_COMMANDS, parseSlashCommand } from "@/lib/types/ai";
import { aiClient } from "./ai-client";

/**
 * Command execution options.
 */
export interface CommandExecutionOptions {
	/** Whether to use streaming response */
	stream?: boolean;
	/** Maximum tokens for response */
	maxTokens?: number;
	/** Temperature for creativity */
	temperature?: number;
	/** Callback for streaming chunks */
	onChunk?: (text: string, accumulated: string) => void;
	/** Callback for progress updates */
	onProgress?: (progress: number) => void;
}

/**
 * Command execution result.
 */
export interface CommandExecutionResult {
	success: boolean;
	result?: string;
	alternatives?: { text: string; confidence: number }[];
	error?: string;
	confidence?: number;
	processingTime?: number;
}

/**
 * AI Command Registry.
 * Manages all registered AI commands.
 */
class CommandRegistry {
	private commands: Map<string, AICommand> = new Map();
	private categoryIndex: Map<AICommandCategory, AICommand[]> = new Map();

	constructor() {
		// Register built-in commands
		AI_COMMANDS.forEach((cmd) => this.register(cmd));
	}

	/**
	 * Register a new command.
	 */
	register(command: AICommand): void {
		this.commands.set(command.name, command);

		// Update category index
		const categoryCommands = this.categoryIndex.get(command.category) ?? [];
		categoryCommands.push(command);
		this.categoryIndex.set(command.category, categoryCommands);
	}

	/**
	 * Unregister a command.
	 */
	unregister(name: string): boolean {
		const command = this.commands.get(name);
		if (!command) return false;

		this.commands.delete(name);

		// Update category index
		const categoryCommands = this.categoryIndex.get(command.category);
		if (categoryCommands) {
			const index = categoryCommands.findIndex((c) => c.name === name);
			if (index !== -1) {
				categoryCommands.splice(index, 1);
			}
		}

		return true;
	}

	/**
	 * Get a command by name.
	 */
	get(name: string): AICommand | undefined {
		return this.commands.get(name);
	}

	/**
	 * Get all registered commands.
	 */
	getAll(): AICommand[] {
		return Array.from(this.commands.values());
	}

	/**
	 * Get commands by category.
	 */
	getByCategory(category: AICommandCategory): AICommand[] {
		return this.categoryIndex.get(category) ?? [];
	}

	/**
	 * Search commands by query string.
	 */
	search(query: string): AICommand[] {
		const q = query.toLowerCase();
		return this.getAll().filter(
			(cmd) =>
				cmd.name.includes(q) ||
				cmd.label.toLowerCase().includes(q) ||
				cmd.description.toLowerCase().includes(q)
		);
	}

	/**
	 * Check if a command exists.
	 */
	has(name: string): boolean {
		return this.commands.has(name);
	}

	/**
	 * Validate command input.
	 */
	validate(name: string, hasSelection: boolean, args: string[]): {
		valid: boolean;
		error?: string;
		command?: AICommand;
	} {
		const command = this.get(name);

		if (!command) {
			return {
				valid: false,
				error: `Unknown command: /${name}`,
			};
		}

		if (command.requiresSelection && !hasSelection) {
			return {
				valid: false,
				error: `Command /${name} requires text selection`,
				command,
			};
		}

		if (command.acceptsArguments && command.argumentSchema) {
			const requiredArgs = command.argumentSchema.filter((a) => a.required);
			if (args.length < requiredArgs.length) {
				const missingArg = requiredArgs[args.length];
				return {
					valid: false,
					error: `Missing required argument: ${missingArg.name}`,
					command,
				};
			}
		}

		return { valid: true, command };
	}

	/**
	 * Parse command arguments into a key-value object.
	 */
	parseArguments(
		command: AICommand,
		args: string[]
	): Record<string, string | number> {
		const result: Record<string, string | number> = {};

		if (!command.argumentSchema) {
			// If no schema, use positional arguments
			args.forEach((arg, i) => {
				result[`arg${i}`] = arg;
			});
			return result;
		}

		command.argumentSchema.forEach((schema, index) => {
			const value = args[index];
			if (value !== undefined) {
				if (schema.type === "number") {
					result[schema.name] = parseFloat(value);
				} else {
					result[schema.name] = value;
				}
			} else if (schema.defaultValue !== undefined) {
				result[schema.name] = schema.defaultValue;
			}
		});

		return result;
	}

	/**
	 * Execute a command.
	 */
	async execute(
		name: string,
		context: AIContext,
		args: string[] = [],
		options?: CommandExecutionOptions
	): Promise<CommandExecutionResult> {
		const command = this.get(name);

		if (!command) {
			return {
				success: false,
				error: `Unknown command: /${name}`,
			};
		}

		const parsedArgs = this.parseArguments(command, args);

		try {
			const response = await aiClient.execute(
				name,
				context,
				parsedArgs,
				{
					stream: options?.stream,
					maxTokens: options?.maxTokens,
					temperature: options?.temperature,
					onChunk: options?.onChunk
						? (chunk) => {
								options.onChunk!(chunk.delta, chunk.accumulated ?? "");
							}
						: undefined,
				}
			);

			return {
				success: true,
				result: response.result,
				alternatives: response.alternatives,
				confidence: response.confidence,
				processingTime: response.processingTime,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Parse and execute a slash command string.
	 */
	async executeFromString(
		input: string,
		context: AIContext,
		options?: CommandExecutionOptions
	): Promise<CommandExecutionResult> {
		const parsed = parseSlashCommand(input);

		if (!parsed) {
			return {
				success: false,
				error: "Invalid command format",
			};
		}

		const hasSelection = Boolean(context.selectedText);
		const validation = this.validate(parsed.command, hasSelection, parsed.args);

		if (!validation.valid) {
			return {
				success: false,
				error: validation.error,
			};
		}

		return this.execute(parsed.command, context, parsed.args, options);
	}
}

/** Singleton command registry instance */
export const commandRegistry = new CommandRegistry();

/**
 * Get command suggestions for autocomplete.
 */
export function getCommandSuggestions(
	query: string,
	hasSelection: boolean
): AICommand[] {
	const commands = commandRegistry.search(query);

	// Sort by relevance and filter based on selection requirement
	return commands
		.filter((cmd) => !cmd.requiresSelection || hasSelection)
		.sort((a, b) => {
			// Exact match first
			if (a.name === query) return -1;
			if (b.name === query) return 1;
			// Then by name starts with query
			if (a.name.startsWith(query) && !b.name.startsWith(query)) return -1;
			if (b.name.startsWith(query) && !a.name.startsWith(query)) return 1;
			// Then alphabetically
			return a.name.localeCompare(b.name);
		});
}

/**
 * Get all command categories with their commands.
 */
export function getCommandsByCategories(): {
	category: AICommandCategory;
	label: string;
	commands: AICommand[];
}[] {
	const categoryLabels: Record<AICommandCategory, string> = {
		writing: "Writing",
		editing: "Editing",
		analysis: "Analysis",
		compliance: "Compliance",
		translation: "Translation",
	};

	const categories: AICommandCategory[] = [
		"writing",
		"editing",
		"analysis",
		"compliance",
		"translation",
	];

	return categories
		.map((category) => ({
			category,
			label: categoryLabels[category],
			commands: commandRegistry.getByCategory(category),
		}))
		.filter((cat) => cat.commands.length > 0);
}
