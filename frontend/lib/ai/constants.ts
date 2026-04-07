/**
 * AI system configuration constants.
 *
 * Runtime-behaviour magic numbers extracted from ai-store.ts and related
 * modules.  Provider / model defaults live in ./types.ts (AI_CONFIG_DEFAULTS)
 * to avoid duplication — this file covers scoring, thresholds, and limits that
 * govern how the AI store manages operations and suggestions.
 */

/** Confidence score assigned to streamed completions (not computed by model). */
export const STREAM_DEFAULT_CONFIDENCE = 0.9;

/** Minimum confidence score for auto-accepting AI suggestions without user review. */
export const AUTO_ACCEPT_THRESHOLD = 0.95;

/** Maximum number of completed operations retained in history. */
export const OPERATION_HISTORY_LIMIT = 50;

/** Maximum number of recently-used commands retained. */
export const RECENT_COMMANDS_LIMIT = 10;

/** Default API endpoint for AI completions. */
export const DEFAULT_AI_ENDPOINT = "/api/ai/completion";
