/**
 * LLM Provider Registry - DocFusion
 *
 * Central registry for LLM provider instances. The registry decouples provider
 * construction (which depends on environment variables and user settings) from
 * provider consumption (which only needs the `LLMProvider` interface).
 *
 * Usage:
 *   import { providerRegistry } from "./provider-registry";
 *
 *   // Registration (typically at app startup)
 *   providerRegistry.register("azure-openai", azureProvider);
 *   providerRegistry.register("ollama", ollamaProvider);
 *   providerRegistry.setDefault("azure-openai");
 *
 *   // Consumption (anywhere in the app)
 *   const provider = providerRegistry.get();        // default provider
 *   const ollama   = providerRegistry.get("ollama"); // explicit provider
 *   const first    = providerRegistry.getFirstConfigured(); // first configured
 */

import type { LLMProvider } from "./llm-provider";

/**
 * Manages a named collection of LLM providers with default selection
 * and configuration-aware fallback.
 */
export class ProviderRegistry {
	private providers = new Map<string, LLMProvider>();
	private defaultProviderName: string | null = null;

	// ── Registration ─────────────────────────────────────────────────────

	/**
	 * Register a provider under a unique name.
	 *
	 * The first provider registered becomes the default unless
	 * `setDefault()` is called explicitly.
	 */
	register(name: string, provider: LLMProvider): void {
		this.providers.set(name, provider);
		if (!this.defaultProviderName) {
			this.defaultProviderName = name;
		}
	}

	/**
	 * Remove a previously registered provider.
	 *
	 * If the removed provider was the default, the default is cleared.
	 * Call `setDefault()` afterwards if another provider should take over.
	 */
	unregister(name: string): boolean {
		const removed = this.providers.delete(name);
		if (removed && this.defaultProviderName === name) {
			this.defaultProviderName = null;
		}
		return removed;
	}

	// ── Retrieval ────────────────────────────────────────────────────────

	/**
	 * Get a provider by name, or the default provider if no name is given.
	 *
	 * @throws {Error} If no provider matches or no default is set.
	 */
	get(name?: string): LLMProvider {
		const key = name ?? this.defaultProviderName;
		if (!key) {
			throw new Error(
				"No LLM provider registered. Call providerRegistry.register() first.",
			);
		}
		const provider = this.providers.get(key);
		if (!provider) {
			const available = [...this.providers.keys()].join(", ") || "(none)";
			throw new Error(
				`LLM provider "${key}" not found. Available: ${available}`,
			);
		}
		return provider;
	}

	/**
	 * Get a provider by name, returning `null` instead of throwing.
	 */
	tryGet(name: string): LLMProvider | null {
		return this.providers.get(name) ?? null;
	}

	/**
	 * Return the first registered provider whose `isConfigured` flag is
	 * `true`, or `null` if none are configured.
	 *
	 * Iteration order follows insertion order (Map semantics).
	 */
	getFirstConfigured(): LLMProvider | null {
		for (const provider of this.providers.values()) {
			if (provider.isConfigured) return provider;
		}
		return null;
	}

	/**
	 * Return the first provider that passes an async `healthCheck()`,
	 * or `null` if all providers are unreachable.
	 *
	 * This is heavier than `getFirstConfigured()` because it makes
	 * network calls. Use sparingly (e.g. at startup or after config change).
	 */
	async getFirstHealthy(): Promise<LLMProvider | null> {
		for (const provider of this.providers.values()) {
			if (!provider.isConfigured) continue;
			try {
				const healthy = await provider.healthCheck();
				if (healthy) return provider;
			} catch {
				// provider unreachable, try next
			}
		}
		return null;
	}

	// ── Introspection ────────────────────────────────────────────────────

	/**
	 * List all registered provider names.
	 */
	list(): string[] {
		return [...this.providers.keys()];
	}

	/**
	 * List names of providers whose `isConfigured` is `true`.
	 */
	listConfigured(): string[] {
		return [...this.providers.entries()]
			.filter(([, p]) => p.isConfigured)
			.map(([name]) => name);
	}

	/**
	 * Check whether a provider with the given name is registered.
	 */
	has(name: string): boolean {
		return this.providers.has(name);
	}

	/**
	 * Number of registered providers.
	 */
	get size(): number {
		return this.providers.size;
	}

	/**
	 * The name of the current default provider, or `null`.
	 */
	get defaultName(): string | null {
		return this.defaultProviderName;
	}

	// ── Configuration ────────────────────────────────────────────────────

	/**
	 * Set the default provider by name.
	 *
	 * @throws {Error} If the provider is not registered.
	 */
	setDefault(name: string): void {
		if (!this.providers.has(name)) {
			throw new Error(
				`Cannot set default: provider "${name}" is not registered.`,
			);
		}
		this.defaultProviderName = name;
	}

	/**
	 * Remove all providers and reset the default.
	 */
	clear(): void {
		this.providers.clear();
		this.defaultProviderName = null;
	}
}

// ============================================================================
// Singleton
// ============================================================================

/**
 * Global provider registry instance.
 *
 * Application startup code registers providers here. Consumer code retrieves
 * them via `providerRegistry.get()`.
 */
export const providerRegistry = new ProviderRegistry();
