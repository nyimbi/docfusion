/**
 * Debug endpoint to check AI configuration
 * NOTE: This endpoint is protected and only available to authenticated users
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadAzureConfigFromEnv } from "@/lib/ai/config";

export async function GET() {
	// Verify authentication - debug endpoints should require auth
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401 }
		);
	}

	// Only allow in development mode
	if (process.env.NODE_ENV === "production") {
		return NextResponse.json(
			{ error: "Debug endpoint not available in production" },
			{ status: 403 }
		);
	}
	// Check environment variables directly
	const envVars = {
		AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY 
			? `Present (${process.env.AZURE_OPENAI_API_KEY.length} chars)` 
			: "Missing",
		AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || "Missing",
		AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "Missing",
		AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || "Missing",
		OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "Missing",
		NODE_ENV: process.env.NODE_ENV,
	};

	// Try loading via config
	const azureConfig = loadAzureConfigFromEnv();

	return NextResponse.json({
		environment: envVars,
		azureConfig: {
			hasValue: !!azureConfig.value,
			source: azureConfig.source,
			userConfigurable: azureConfig.userConfigurable,
			config: azureConfig.value ? {
				endpoint: azureConfig.value.endpoint,
				deploymentName: azureConfig.value.deploymentName,
				apiVersion: azureConfig.value.apiVersion,
				hasKey: !!azureConfig.value.apiKey,
				keyLength: azureConfig.value.apiKey?.length,
			} : null,
		},
	});
}
