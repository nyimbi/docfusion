/**
 * Debug endpoint to check AI configuration
 * NOTE: This endpoint is protected and only available to authenticated users
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAzureConfigFromEnv } from "@/lib/ai/config";

export async function GET() {
	// Verify authentication - debug endpoints should require auth
	const session = await auth();
	if (!session?.user) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401 }
		);
	}

	// Only expose debug configuration checks during local development.
	if (process.env.NODE_ENV !== "development") {
		return NextResponse.json(
			{ error: "Debug endpoint not available" },
			{ status: 404 }
		);
	}

	const envVars = {
		AZURE_OPENAI_API_KEY: Boolean(process.env.AZURE_OPENAI_API_KEY),
		AZURE_OPENAI_ENDPOINT: Boolean(process.env.AZURE_OPENAI_ENDPOINT),
		AZURE_OPENAI_DEPLOYMENT_NAME: Boolean(process.env.AZURE_OPENAI_DEPLOYMENT_NAME),
		AZURE_OPENAI_API_VERSION: Boolean(process.env.AZURE_OPENAI_API_VERSION),
		OLLAMA_BASE_URL: Boolean(process.env.OLLAMA_BASE_URL),
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
				hasKey: !!azureConfig.value.apiKey,
				hasEndpoint: !!azureConfig.value.endpoint,
				hasDeploymentName: !!azureConfig.value.deploymentName,
				hasApiVersion: !!azureConfig.value.apiVersion,
			} : null,
		},
	});
}
