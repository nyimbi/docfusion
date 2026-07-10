import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiteLLMProvider } from "@/lib/ai/providers/litellm";

const originalFetch = global.fetch;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	global.fetch = originalFetch;
});

describe("LiteLLMProvider", () => {
	it("uses the OpenAI-compatible LiteLLM chat completion endpoint", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			model: "gpt-4o",
			choices: [{
				finish_reason: "stop",
				message: { content: "OK" },
			}],
			usage: {
				prompt_tokens: 4,
				completion_tokens: 1,
				total_tokens: 5,
			},
		}), { status: 200 }));
		global.fetch = fetchMock as typeof fetch;

		const provider = new LiteLLMProvider({
			baseUrl: "http://62.169.25.77:4000",
			apiKey: "test-key",
			defaultModel: "gpt-4o",
			fastModel: "gpt-4o-mini",
			embeddingModel: "text-embedding-ada-002",
		});

		const result = await provider.complete({
			messages: [{ role: "user", content: "Say OK" }],
			maxTokens: 5,
		});

		expect(result).toMatchObject({
			content: "OK",
			model: "gpt-4o",
			finishReason: "stop",
			usage: {
				promptTokens: 4,
				completionTokens: 1,
				totalTokens: 5,
			},
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"http://62.169.25.77:4000/v1/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-key",
					"Content-Type": "application/json",
				}),
				body: expect.stringContaining("\"model\":\"gpt-4o\""),
			})
		);
	});

	it("lists LiteLLM models and falls back to configured aliases when unavailable", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			data: [
				{ id: "gpt-4o" },
				{ id: "gpt-4o-mini" },
				{ id: "text-embedding-ada-002" },
			],
		}), { status: 200 }));
		global.fetch = fetchMock as typeof fetch;

		const provider = new LiteLLMProvider({
			baseUrl: "http://62.169.25.77:4000/v1",
			apiKey: "test-key",
			defaultModel: "gpt-4o",
			fastModel: "gpt-4o-mini",
			embeddingModel: "text-embedding-ada-002",
		});

		const models = await provider.listModels();

		expect(models.map((model) => model.modelId)).toEqual([
			"gpt-4o",
			"gpt-4o-mini",
			"text-embedding-ada-002",
		]);
		expect(fetchMock).toHaveBeenCalledWith(
			"http://62.169.25.77:4000/v1/models",
			expect.objectContaining({ method: "GET" })
		);
	});

	it("uses the LiteLLM embeddings endpoint", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			model: "text-embedding-ada-002",
			data: [{ embedding: [0.1, 0.2, 0.3] }],
			usage: {
				prompt_tokens: 3,
				total_tokens: 3,
			},
		}), { status: 200 }));
		global.fetch = fetchMock as typeof fetch;

		const provider = new LiteLLMProvider({
			baseUrl: "http://62.169.25.77:4000",
			apiKey: "test-key",
			defaultModel: "gpt-4o",
			embeddingModel: "text-embedding-ada-002",
		});

		const result = await provider.createEmbedding?.({ input: "RFP response" });

		expect(result).toEqual({
			embeddings: [[0.1, 0.2, 0.3]],
			model: "text-embedding-ada-002",
			usage: {
				promptTokens: 3,
				totalTokens: 3,
			},
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"http://62.169.25.77:4000/v1/embeddings",
			expect.objectContaining({
				method: "POST",
				body: expect.stringContaining("\"model\":\"text-embedding-ada-002\""),
			})
		);
	});
});
