---
id: TASK-049
title: Integrate Ollama web search into discovery pipeline
status: To Do
assignee: []
created_date: '2026-08-13 23:16'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ollama now exposes a native web-search tool (docs.ollama.com/capabilities/web-search). Add it as a third retrieval path alongside SearXNG and Firecrawl for opportunity/tender discovery. Ollama is on 62.169.25.77 (same host as LiteLLM).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OllamaWebSearchCrawler class next to existing SearXNG crawler,Query-expansion prompt uses sector/keyword context,Results merged into existing relevance-scored digest,Configurable via LITELLM_URL and OLLAMA_URL env vars,Integration test hits real Ollama endpoint
<!-- AC:END -->
