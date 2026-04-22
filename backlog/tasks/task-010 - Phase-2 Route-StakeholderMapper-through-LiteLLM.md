
## Implementation Notes

**Approach:**
- Removed `import httpx` and `self.ollama_client` initialization from `StakeholderMapper.__init__`.
- Replaced Ollama-specific config keys (`ollama_base_url`, `ollama_model`, `ollama_timeout`) with LiteLLM-agnostic keys (`ai_model`, `ai_timeout`).
- Replaced the direct `httpx.AsyncClient.post("/api/generate")` call in `_analyze_chunk_for_stakeholders` with `complete_with_fallback()` from `..infrastructure`.
- Updated response parsing: instead of `response.json()["response"]`, now uses `response.content` directly (CompletionResponse from LLMFallbackChain).
- Updated `close()` to be a no-op since there's no persistent HTTP client to close.
- Updated `get_mapper_info()` to report `ai_model` instead of `ollama_model`.

**Files touched:**
- `src/docfusion/rfp/stakeholder_mapper.py` — removed Ollama client, wired LLMFallbackChain.
- `tests/ci/test_stakeholder_mapper_litellm.py` — 6 tests: source inspection, LiteLLM routing, AI failure fallback, disabled skip, config validation, close safety.

**Unexpected findings:**
- The pattern-based extraction in `StakeholderMapper` is quite aggressive: "Contact John Doe" gets extracted as a single name entity. Test expectations adjusted accordingly.
- The method is `extract_stakeholders()`, not `map_stakeholders()` as shown in the task plan.

**Deviations from plan:**
- Used `complete_with_fallback()` (module-level function) instead of instantiating `LLMFallbackChain` in the constructor, consistent with task-008/009 pattern.
- Did not add a `llm_client` constructor parameter; the module-level fallback chain is sufficient and avoids lifecycle management.
