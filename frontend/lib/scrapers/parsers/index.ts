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
import "./ebrd";
import "./eu-funding-tenders";
import "./generic";
import "./giz";
import "./kenya-ppip";
import "./sam-gov";
import "./un-procurement";
import "./unicef";
import "./undp";
import "./ungm";
import "./world-bank";

// Re-export for direct access
export { afdbParser } from "./afdb";
export { comesaParser } from "./comesa";
export { dgmarketParser } from "./dgmarket";
export { ebrdParser } from "./ebrd";
export { euFundingTendersParser } from "./eu-funding-tenders";
export { genericParser } from "./generic";
export { gizParser } from "./giz";
export { kenyaPpipParser } from "./kenya-ppip";
export { samGovParser } from "./sam-gov";
export { unProcurementParser } from "./un-procurement";
export { unicefParser } from "./unicef";
export { undpParser } from "./undp";
export { ungmParser } from "./ungm";
export { worldBankParser } from "./world-bank";

// LLM-based extraction (for sites without custom parsers)
export * from "./llm-extractor";
