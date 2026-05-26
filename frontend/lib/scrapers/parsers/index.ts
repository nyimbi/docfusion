/**
 * Parser Registry Index
 *
 * Imports all site-specific parsers to register them.
 * Import this file to ensure all parsers are available.
 */

// Types and utilities
export * from "./types";

// Import parsers to trigger self-registration
import "./dgmarket";
import "./generic";
import "./kenya-ppip";
import "./ungm";

// Re-export for direct access
export { dgmarketParser } from "./dgmarket";
export { genericParser } from "./generic";
export { kenyaPpipParser } from "./kenya-ppip";
export { ungmParser } from "./ungm";

// LLM-based extraction (for sites without custom parsers)
export * from "./llm-extractor";
