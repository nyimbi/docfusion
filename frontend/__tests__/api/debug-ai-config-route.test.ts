import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const loadAzureConfigFromEnvMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
	auth: authMock,
}));
vi.mock("@/lib/ai/config", () => ({
	loadAzureConfigFromEnv: loadAzureConfigFromEnvMock,
}));

import { GET } from "@/app/api/debug/ai-config/route";

beforeEach(() => {
	vi.clearAllMocks();
	authMock.mockResolvedValue({ user: { id: "user-1" } });
	loadAzureConfigFromEnvMock.mockReturnValue({
		value: {
			apiKey: "secret-key",
			endpoint: "https://azure.example.internal",
			deploymentName: "private-deployment",
			apiVersion: "2026-01-01",
		},
		source: "environment",
		userConfigurable: false,
	});
	vi.stubEnv("AZURE_OPENAI_API_KEY", "secret-key");
	vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://azure.example.internal");
	vi.stubEnv("AZURE_OPENAI_DEPLOYMENT_NAME", "private-deployment");
	vi.stubEnv("AZURE_OPENAI_API_VERSION", "2026-01-01");
	vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("debug AI config route", () => {
	it("rejects unauthenticated callers", async () => {
		vi.stubEnv("NODE_ENV", "development");
		authMock.mockResolvedValueOnce(null);

		const response = await GET();

		expect(response.status).toBe(401);
		expect(loadAzureConfigFromEnvMock).not.toHaveBeenCalled();
	});

	it("is unavailable outside local development", async () => {
		vi.stubEnv("NODE_ENV", "production");

		const response = await GET();

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Debug endpoint not available" });
		expect(loadAzureConfigFromEnvMock).not.toHaveBeenCalled();
	});

	it("returns only coarse configuration presence in development", async () => {
		vi.stubEnv("NODE_ENV", "development");

		const response = await GET();
		const body = await response.json();
		const serialized = JSON.stringify(body);

		expect(response.status).toBe(200);
		expect(body.environment).toEqual({
			AZURE_OPENAI_API_KEY: true,
			AZURE_OPENAI_ENDPOINT: true,
			AZURE_OPENAI_DEPLOYMENT_NAME: true,
			AZURE_OPENAI_API_VERSION: true,
			OLLAMA_BASE_URL: true,
			NODE_ENV: "development",
		});
		expect(body.azureConfig.config).toEqual({
			hasKey: true,
			hasEndpoint: true,
			hasDeploymentName: true,
			hasApiVersion: true,
		});
		expect(serialized).not.toContain("secret-key");
		expect(serialized).not.toContain("azure.example.internal");
		expect(serialized).not.toContain("private-deployment");
		expect(serialized).not.toContain("2026-01-01");
	});
});
