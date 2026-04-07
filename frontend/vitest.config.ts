/**
 * Vitest Configuration for DocFusion Frontend
 *
 * Separates unit tests (fast, mocked) from integration tests (slower, database).
 */

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
	test: {
		// Global test settings
		globals: true,
		environment: "node",

		// Include patterns
		include: ["__tests__/**/*.test.ts"],

		// Exclude patterns
		exclude: ["node_modules", "__tests__/e2e/**"],

		// Project-specific configs
		pool: "threads",

		// Coverage settings
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"__tests__/**",
				"**/*.d.ts",
				"**/*.config.ts",
			],
		},

		// Test timeouts
		testTimeout: 10000,
		hookTimeout: 10000,

		// Retry failed tests
		retry: 1,
	},

	resolve: {
		alias: {
			"@": resolve(__dirname, "./"),
		},
	},

	// Separate projects for unit vs integration tests
	projects: [
		{
			test: {
				name: "unit",
				include: [
					"__tests__/hdsi/**/*.test.ts",
					"__tests__/components/**/*.test.{ts,tsx}",
				],
				setupFiles: ["__tests__/setup.ts"],
				environment: "jsdom",
			},
		},
		{
			test: {
				name: "actions",
				include: ["__tests__/actions/**/*.test.ts"],
				setupFiles: ["__tests__/utils/action-helpers.ts"],
				environment: "node",
				globals: true,
			},
		},
		{
			test: {
				name: "integration",
				include: ["__tests__/integration/**/*.test.ts"],
				setupFiles: ["__tests__/integration/setup.ts"],
				environment: "node",
			},
		},
	],
});