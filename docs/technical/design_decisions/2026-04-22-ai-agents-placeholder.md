# ADR: Disposition of `src/docfusion/ai_agents/` placeholder

**Date**: 2026-04-22
**Status**: Accepted
**Decision makers**: Platform engineering

## Context

`src/docfusion/ai_agents/` was created in early design as a reserved namespace for
a future "reasoning agents" subsystem separate from `src/docfusion/agents/specialists/`.
After Phase 3 implementation, `agents/specialists/` became the actual home for
all specialist agents (Writer, Reviewer, Compliance, etc.). The `ai_agents/`
directory remained with only a README, creating a persistent source of confusion
for new contributors.

## Decision

Delete `src/docfusion/ai_agents/`. `agents/specialists/` is canonical.
Reasoning-specific agents will live in `agents/specialists/` alongside the rest;
category is determined by role tags, not directory hierarchy.

## Consequences

**Positive:**
- One canonical import path: `from docfusion.agents.specialists import WriterAgent`.
- New contributors are not misled by the empty namespace.

**Negative:**
- External code that imports from `docfusion.ai_agents` will break. None is known.

## Alternatives considered

- Keep as re-export shim: rejected — two import paths for one thing, invites drift.
- Repurpose for reasoning-only agents: rejected — arbitrary split, no real need.
