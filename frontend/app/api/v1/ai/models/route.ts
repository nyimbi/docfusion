/**
 * AI Models API Route - DocFusion
 *
 * Lists available AI models and providers.
 */

import { NextResponse } from "next/server";
import { aiProviderManager } from "@/lib/ai/providers";

/**
 * GET /api/v1/ai/models
 * List all available AI models.
 */
export async function GET() {
	try {
		await aiProviderManager.initialize();

		const providers = aiProviderManager.listProviders();
		const models = await aiProviderManager.listAllModels();
		const activeProvider = aiProviderManager.getActiveProvider();

		return NextResponse.json({
			available: aiProviderManager.isAvailable(),
			activeProvider: activeProvider?.name || null,
			providers,
			models,
		});
	} catch (error) {
		console.error("[AI Models Error]", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Failed to list models",
				available: false,
				providers: [],
				models: [],
			},
			{ status: 500 }
		);
	}
}
