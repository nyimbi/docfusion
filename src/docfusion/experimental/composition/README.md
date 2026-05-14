# Agent Composition Language (ACL) — experimental

This module implements a YAML-based DSL for orchestrating agent
workflows: sequential pipelines (`agent1 -> agent2`), parallel execution,
conditional branches, error handling, and execution-graph optimization.
Four components — `language.py`, `parser.py`, `interpreter.py`,
`runner.py` — total roughly 2,900 lines.

It is **not** currently wired into any production code path.

## Why it lives in `experimental/`

A C-track sweep of the codebase in May 2026 found that the ACL had
exactly one external importer: a `CompositionRunner()` instance created
in `src/docfusion/api/endpoints/template_endpoints.py` that was never
invoked. The endpoint's `populate_template_handler` calls
`self.document_engine.generate_document(...)` directly, ignoring the
runner. No agent system, no proposal workflow, no document pipeline
consumes ACL compositions.

The module's own tests (`tests/ci/test_composition_*.py`) verify
internal correctness — parsing, sequential-node merging, retry
semantics, safe expression evaluation — but only against compositions
constructed inside the tests. There is no end-to-end coverage from a
real user request to a real composition execution.

Moving the module into `experimental/` is the honest signal: this is
reference-quality code waiting for a product decision, not a
load-bearing dependency.

## What promotion looks like

The natural promotion path is the project's RFP-response workflow:
discovery -> analysis -> compliance scoring -> draft generation ->
review. Writing one of those as a YAML composition and routing it
through `CompositionRunner` would justify lifting this module back into
`src/docfusion/` proper. Until then, treat it as architectural
inventory.

## What is intentionally not done in this move

- The runner's existing unit tests stay in `tests/ci/` (they're real
  tests, just for an experimental module — same convention as any other
  CI-discovered test).
- `examples/composition_example.py` stays in place and still works
  against the new import path.
- No code was deleted. If a real composition workflow ships in the
  future, the move is a `git mv` away from being undone.
