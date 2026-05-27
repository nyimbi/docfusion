/**
 * Parser Registry Index
 *
 * Imports all site-specific parsers to register them.
 * Import this file to ensure all parsers are available.
 */

// Types and utilities
export * from "./types";

// Import parsers to trigger self-registration
import "./afdb";
import "./comesa";
import "./dgmarket";
import "./generic";
import "./kenya-ppip";
import "./undp";
import "./ungm";
import "./world-bank";

// Re-export for direct access
export { afdbParser } from "./afdb";
export { comesaParser } from "./comesa";
export { dgmarketParser } from "./dgmarket";
export { genericParser } from "./generic";
export { kenyaPpipParser } from "./kenya-ppip";
export { undpParser } from "./undp";
export { ungmParser } from "./ungm";
export { worldBankParser } from "./world-bank";

// LLM-based extraction (for sites without custom parsers)
export * from "./llm-extractor";
