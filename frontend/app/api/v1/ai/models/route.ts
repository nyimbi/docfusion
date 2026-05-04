/**
 * AI Models API Route - DocFusion
 *
 * Lists available AI models and providers with configuration status.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProviderManager, type AIProvider } from "@/lib/ai/providers";
import { testProviderConnections } from "@/lib/ai/providers";

/**
 * GET /api/v1/ai/models
 * List all available AI models and check configuration status.
 */
export async function GET() {
	// Verify authentication
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const manager = getProviderManager();
		await manager.initialize();

		const providers = manager.listProviders();
		const models = await manager.listAllModels();
		const activeProvider = await manager.getActiveProvider() as AIProvider | null;

		// Check provider connections
		const connectionResults = await testProviderConnections();

		// Check environment variables
		const envVars = {
			AZURE_OPENAI_API_KEY: !!process.env.AZURE_OPENAI_API_KEY,
			AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
			AZURE_OPENAI_DEPLOYMENT_NAME: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
			AZURE_OPENAI_API_VERSION: !!process.env.AZURE_OPENAI_API_VERSION,
			OLLAMA_BASE_URL: !!process.env.OLLAMA_BASE_URL,
		};

		// Build provider status with detailed info
		const providerStatus = providers.map((provider) => {
			const result = connectionResults[provider as keyof typeof connectionResults];
			return {
				provider,
				configured: envVars.AZURE_OPENAI_API_KEY || provider === "ollama",
				available: result?.success ?? null,
				message: result?.message || "Status unknown",
				models: result?.models,
			};
		});

		return NextResponse.json({
			available: await manager.isAvailable(),
			activeProvider: activeProvider?.name || null,
			envVars,
			providers: providerStatus,
			models,
		});
	} catch (error) {
		console.error("[AI Models Error]", error);
		
		// Return config status even on error
		const envVars = {
			AZURE_OPENAI_API_KEY: !!process.env.AZURE_OPENAI_API_KEY,
			AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
			AZURE_OPENAI_DEPLOYMENT_NAME: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
			AZURE_OPENAI_API_VERSION: !!process.env.AZURE_OPENAI_API_VERSION,
			OLLAMA_BASE_URL: !!process.env.OLLAMA_BASE_URL,
		};

		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Failed to list models",
				available: false,
				activeProvider: null,
				envVars,
				providers: [],
				models: [],
			},
			{ status: 500 }
		);
	}
}
