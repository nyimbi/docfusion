/**
 * AI Streaming Completion API Route - DocFusion
 *
 * Handles streaming AI completion requests using Server-Sent Events.
 */

import { NextRequest } from "next/server";
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
 * POST /api/v1/ai/completion/stream
 * Execute a streaming AI completion request.
 */
export async function POST(request: NextRequest) {
	// Verify authentication
	const session = await auth();
	if (!session?.user) {
		return new Response(
			JSON.stringify({ error: "Authentication required" }),
			{ status: 401, headers: { "Content-Type": "application/json" } }
		);
	}

	try {
		const body = (await request.json()) as AICompletionRequest;

		const manager = getProviderManager();
		await manager.initialize();

		if (!manager.isAvailable()) {
			return new Response(
				JSON.stringify({
					error: "No AI provider available. Check your configuration.",
				}),
				{
					status: 503,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Build messages for the AI
		const messages = buildMessages(body);

		// Create a readable stream for SSE
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					const generator = manager.stream({
						messages,
						temperature: body.temperature ?? 0.7,
						maxTokens: body.maxTokens ?? 2048,
						stream: true,
					});

					for await (const chunk of generator) {
						const data = JSON.stringify({ delta: chunk.content });
						controller.enqueue(encoder.encode(`data: ${data}\n\n`));

						if (chunk.isComplete) {
							controller.enqueue(encoder.encode("data: [DONE]\n\n"));
							break;
						}
					}

					controller.close();
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Stream error";
					const errorData = JSON.stringify({ error: errorMessage });
					controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("[AI Stream Error]", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Stream failed",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
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
		SYSTEM_PROMPTS[request.command] || SYSTEM_PROMPTS.default;
	messages.push({ role: "system", content: systemPrompt });

	// Build user message with context
	let userContent = "";

	// Include document context if available
	if (request.context.textBefore) {
		userContent += `[Context before cursor]:\n${request.context.textBefore.slice(-500)}\n\n`;
	}

	// Include selected text or position
	if (request.context.selectedText) {
		userContent += `[Selected text to process]:\n${request.context.selectedText}\n\n`;
	}

	if (request.context.textAfter) {
		userContent += `[Context after cursor]:\n${request.context.textAfter.slice(0, 500)}\n\n`;
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
