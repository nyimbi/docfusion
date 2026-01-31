/**
 * AI Completion API Route - DocFusion
 *
 * Handles AI completion requests for document editing.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
	getProviderManager,
	type ChatMessage,
} from "@/lib/ai/providers";
import type { AICompletionRequest } from "@/lib/types/ai";

/**
 * System prompts for different commands.
 */
const SYSTEM_PROMPTS: Record<string, string> = {
	improve: `You are a professional writing assistant. Improve the given text for clarity, grammar, and readability while preserving its meaning and tone. Only output the improved text, no explanations.`,

	expand: `You are a professional writing assistant. Expand the given text with more detail, examples, or elaboration while maintaining the original style and message. Only output the expanded text.`,

	summarize: `You are a professional writing assistant. Create a concise summary of the given text that captures the key points. Only output the summary, no explanations.`,

	tone: `You are a professional writing assistant. Adjust the tone of the given text to match the requested style while preserving the meaning. Only output the adjusted text.`,

	translate: `You are a professional translator. Translate the given text accurately to the target language while preserving meaning and nuance. Only output the translation.`,

	continue: `You are a professional writing assistant. Continue writing from where the text leaves off, maintaining the same style, tone, and context. Only output the continuation.`,

	explain: `You are an educator. Explain the given text in simpler terms that anyone can understand. Be clear and concise.`,

	compliance: `You are a compliance expert. Analyze the given text for regulatory compliance issues and provide specific, actionable feedback.`,

	default: `You are a helpful AI assistant for a document editing application. Be concise and helpful.`,
};

/**
 * Simple message-based request (from HDSI, ai-client, etc.)
 */
interface SimpleCompletionRequest {
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	model?: string;
	stream?: boolean;
}

/**
 * Check if request is simple message format vs full AICompletionRequest
 */
function isSimpleRequest(body: unknown): body is SimpleCompletionRequest {
	return (
		typeof body === "object" &&
		body !== null &&
		"messages" in body &&
		Array.isArray((body as SimpleCompletionRequest).messages)
	);
}

/**
 * POST /api/v1/ai/completion
 * Execute an AI completion request.
 * Supports two formats:
 * 1. Simple: { messages, temperature?, maxTokens? }
 * 2. Full: AICompletionRequest with command, context, arguments
 */
export async function POST(request: NextRequest) {
	// Verify authentication
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const body = await request.json();

		const manager = getProviderManager();
		await manager.initialize();

		if (!await manager.isAvailable()) {
			console.error("[AI Completion] No provider available");
			return NextResponse.json(
				{
					error: "No AI provider available. Configure Azure OpenAI or Ollama, or use development mock mode.",
				},
				{ status: 503 }
			);
		}

		// Handle simple message-based requests (from HDSI ai-client, etc.)
		if (isSimpleRequest(body)) {
			const response = await manager.complete({
				messages: body.messages,
				temperature: body.temperature ?? 0.7,
				maxTokens: body.maxTokens ?? 2048,
				model: body.model,
				stream: false,
			});

			return NextResponse.json({
				content: response.content,
				usage: response.usage,
				model: response.model,
			});
		}

		// Handle full AICompletionRequest (from editor commands)
		const fullRequest = body as AICompletionRequest;

		// Build messages for the AI
		const messages = buildMessages(fullRequest);

		// Execute completion
		const response = await manager.complete({
			messages,
			temperature: fullRequest.temperature ?? 0.7,
			maxTokens: fullRequest.maxTokens ?? 2048,
			stream: false,
		});

		return NextResponse.json({
			content: response.content,
			usage: response.usage,
			model: response.model,
		});
	} catch (error) {
		console.error("[AI Completion Error]", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Completion failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * Build chat messages from the completion request.
 */
function buildMessages(request: AICompletionRequest): ChatMessage[] {
	const messages: ChatMessage[] = [];

	// Get system prompt for the command
	const systemPrompt =
		SYSTEM_PROMPTS[request.command || "default"] || SYSTEM_PROMPTS.default;
	messages.push({ role: "system", content: systemPrompt });

	// Build user message with context
	let userContent = "";

	// Include document context if available
	const context = request.context || {};

	if (context.textBefore) {
		userContent += `[Context before cursor]:\n${context.textBefore.slice(-500)}\n\n`;
	}

	// Include selected text or position
	if (context.selectedText) {
		userContent += `[Selected text to process]:\n${context.selectedText}\n\n`;
	}

	if (context.textAfter) {
		userContent += `[Context after cursor]:\n${context.textAfter.slice(0, 500)}\n\n`;
	}

	// Add command-specific instructions
	const args = request.arguments || {};

	switch (request.command) {
		case "tone":
			userContent += `Please adjust the tone to be more ${args.style || "professional"}.`;
			break;
		case "translate":
			userContent += `Please translate to ${args.language || "English"}.`;
			break;
		case "compliance":
			userContent += `Please check for ${args.framework || "general"} compliance issues.`;
			break;
		case "improve":
			userContent += "Please improve this text for clarity and readability.";
			break;
		case "expand":
			userContent += "Please expand this text with more detail.";
			break;
		case "summarize":
			userContent += "Please summarize this text concisely.";
			break;
		case "continue":
			userContent += "Please continue writing from where this text ends.";
			break;
		case "explain":
			userContent += "Please explain this text in simpler terms.";
			break;
		default:
			if (request.command) {
				userContent += `Command: ${request.command}`;
			}
	}

	messages.push({ role: "user", content: userContent });

	return messages;
}
