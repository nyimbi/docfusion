/**
 * Type declarations for next-pwa module.
 *
 * next-pwa doesn't ship with TypeScript declarations,
 * so we provide minimal type definitions for our usage.
 */

declare module "next-pwa" {
	import type { NextConfig } from "next";

	interface RuntimeCacheOptions {
		cacheName: string;
		expiration?: {
			maxEntries?: number;
			maxAgeSeconds?: number;
		};
		networkTimeoutSeconds?: number;
		cacheableResponse?: {
			statuses?: number[];
		};
	}

	interface RuntimeCacheEntry {
		urlPattern: RegExp | string;
		handler:
			| "CacheFirst"
			| "CacheOnly"
			| "NetworkFirst"
			| "NetworkOnly"
			| "StaleWhileRevalidate";
		method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
		options?: RuntimeCacheOptions;
	}

	interface PWAConfig {
		/** Destination directory for generated service worker files */
		dest: string;
		/** Disable PWA in development mode */
		disable?: boolean;
		/** Auto-register service worker */
		register?: boolean;
		/** Skip waiting for service worker activation */
		skipWaiting?: boolean;
		/** Service worker scope */
		scope?: string;
		/** Custom service worker source file */
		sw?: string;
		/** Runtime caching strategies */
		runtimeCaching?: RuntimeCacheEntry[];
		/** Build exclusions */
		buildExcludes?: (string | RegExp)[];
		/** Public exclusions */
		publicExcludes?: string[];
		/** Fallback routes */
		fallbacks?: {
			document?: string;
			image?: string;
			audio?: string;
			video?: string;
			font?: string;
		};
		/** Cache on frontend navigation */
		cacheOnFrontEndNav?: boolean;
		/** Reload on online */
		reloadOnOnline?: boolean;
		/** Custom worker directory */
		customWorkerDir?: string;
		/** Custom worker source */
		customWorkerSrc?: string;
		/** Custom worker destination */
		customWorkerDest?: string;
		/** Custom worker webpack config */
		customWorkerWebpack?: (config: unknown) => unknown;
	}

	/**
	 * Initialize PWA wrapper for Next.js config.
	 * @param config PWA configuration options
	 * @returns Function that wraps NextConfig with PWA support
	 */
	function withPWAInit(
		config: PWAConfig
	): (nextConfig: NextConfig) => NextConfig;

	export default withPWAInit;
}
