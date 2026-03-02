/**
 * Integration Test Setup
 *
 * Minimal setup for integration tests that run in Node.js environment.
 * Unlike frontend tests, these don't need browser API mocks.
 */

import { vi, beforeAll, afterAll } from "vitest";

// Set test environment flag
process.env.NODE_ENV = "test";

// Mock console methods for cleaner test output (optional)
beforeAll(() => {
	// Tests can override this if they need console output
});

afterAll(() => {
	// Cleanup
});