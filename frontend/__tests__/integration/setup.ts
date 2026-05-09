/**
 * Integration Test Setup
 *
 * Minimal setup for integration tests that run in Node.js environment.
 * Unlike frontend tests, these don't need browser API mocks.
 *
 * Loads .env.local so tests pointing at a real Postgres pick up DATABASE_URL.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { vi, beforeAll, afterAll } from "vitest";

// Load env BEFORE any module-level DB connections initialise.
loadEnv({ path: resolve(__dirname, "../../.env.local") });
loadEnv({ path: resolve(__dirname, "../../.env") });

// Set test environment flag
Object.assign(process.env, { NODE_ENV: "test" });

// Mock console methods for cleaner test output (optional)
beforeAll(() => {
	// Tests can override this if they need console output
});

afterAll(() => {
	// Cleanup
});
