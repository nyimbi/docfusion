"use server";

/**
 * AI Settings Server Actions - DocFusion
 *
 * Server-side actions for managing AI configuration and settings.
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
	getAISettingsManager,
	initializeAI,
	testProviderConnections,
	testOllamaConnection,
	type AISettingsFormData,
} from "./client";
import { initializeAIConfig } from "./config";
import type { AIProviderType } from "./providers/types";

/**
 * Load current user AI settings.
 */
export async function loadAISettings(): Promise<{
	success: boolean;
	data?: AISettingsFormData;
	error?: string;
}> {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return { success: false, error: "Not authenticated" };
		}

		// Initialize with user context
		await initializeAI(session.user.id);

		const settingsManager = getAISettingsManager();
		const settings = await settingsManager.loadSettings();

		return { success: true, data: settings };
	} catch (error) {
		console.error("[AI Actions] Failed to load settings:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to load settings",
		};
	}
}

/**
 * Save user AI settings.
 */
export async function saveAISettings(
	settings: AISettingsFormData
): Promise<{
	success: boolean;
	error?: string;
}> {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return { success: false, error: "Not authenticated" };
		}

		// Initialize with user context
		await initializeAI(session.user.id);

		// Validate settings
		const settingsManager = getAISettingsManager();
		const validation = settingsManager.validateSettings(settings);

		if (!validation.isValid) {
			return {
				success: false,
				error: Object.values(validation.errors).join("; "),
			};
		}

		// Save settings
		await settingsManager.saveSettings(settings);

		return { success: true };
	} catch (error) {
		console.error("[AI Actions] Failed to save settings:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to save settings",
		};
	}
}

/**
 * Test AI provider connections.
 */
export async function testAIConnections(): Promise<{
	success: boolean;
	results?: Record<
		AIProviderType,
		{ success: boolean; message: string; models?: string[] }
	>;
	error?: string;
}> {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return { success: false, error: "Not authenticated" };
		}

		// Initialize with user context
		await initializeAI(session.user.id);

		const results = await testProviderConnections();

		return { success: true, results };
	} catch (error) {
		console.error("[AI Actions] Failed to test connections:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to test connections",
		};
	}
}

/**
 * Test Ollama connection with custom URL.
 */
export async function testOllamaSettings(
	baseUrl: string,
	model?: string
): Promise<{
	success: boolean;
	result?: { success: boolean; message: string; models?: string[] };
	error?: string;
}> {
	try {
		const result = await testOllamaConnection(baseUrl, model);

		return { success: true, result };
	} catch (error) {
		console.error("[AI Actions] Failed to test Ollama:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to test Ollama",
		};
	}
}

/**
 * Validate AI settings before saving.
 */
export async function validateAISettings(
	settings: AISettingsFormData
): Promise<{
	success: boolean;
	validation?: {
		isValid: boolean;
		errors: Partial<Record<keyof AISettingsFormData, string>>;
		connectionTests: Partial<
			Record<AIProviderType, { success: boolean; message: string }>
		>;
	};
	error?: string;
}> {
	try {
		const settingsManager = getAISettingsManager();

		// Run validation
		const validation = await settingsManager.testSettings(settings);

		return { success: true, validation };
	} catch (error) {
		console.error("[AI Actions] Failed to validate settings:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to validate settings",
		};
	}
}

/**
 * Get available AI models from all configured providers.
 */
export async function listAvailableAIModels(): Promise<{
	success: boolean;
	models?: {
		provider: AIProviderType;
		modelId: string;
		displayName: string;
		supportsStreaming: boolean;
	}[];
	error?: string;
}> {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return { success: false, error: "Not authenticated" };
		}

		// Initialize with user context
		await initializeAI(session.user.id);

		// Get provider manager
		const { getProviderManager } = await import("./providers/factory");
		const manager = getProviderManager();
		const models = await manager.listAllModels();

		return {
			success: true,
			models: models.map((m) => ({
				provider: m.provider,
				modelId: m.modelId,
				displayName: m.displayName,
				supportsStreaming: m.supportsStreaming,
			})),
		};
	} catch (error) {
		console.error("[AI Actions] Failed to list models:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to list models",
		};
	}
}
