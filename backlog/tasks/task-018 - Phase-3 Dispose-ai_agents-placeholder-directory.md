---
id: task-018
title: "Phase 3: Dispose of ai_agents placeholder directory"
status: To Do
phase: 3
gap_ids: [G-AI-01, G-OP-01]
priority: Low
---

# task-018 - Phase 3: Dispose of ai_agents placeholder directory

## Description (the why)

`src/docfusion/ai_agents/` contains only a README and no Python code. It was reserved for future reasoning agents, but the existing `agents/specialists/` is the real implementation. An empty placeholder is confusing. We either delete it or repurpose it with a re-export shim — either way, record the decision in an ADR.

## Acceptance Criteria (the what)

- [ ] ADR `docs/technical/design_decisions/2026-04-22-ai-agents-placeholder.md` exists with a Context / Decision / Consequences structure.
- [ ] Either `src/docfusion/ai_agents/` is deleted, or it contains a real `__init__.py` that re-exports from `agents/specialists/`.
- [ ] If re-exported, at least one import of the new path resolves (e.g. `from docfusion.ai_agents import WriterAgent` works).
- [ ] If deleted, `grep -rn "ai_agents" src/docfusion/ --include="*.py"` returns 0.

## Implementation Plan (the how)

**Step 1: Read the README.**
```bash
cat src/docfusion/ai_agents/README.md
```

**Step 2: Decide.** Default recommendation: **delete the directory**. `agents/specialists/` is the canonical home. An ADR documenting the removal is more useful than a re-export shim that adds a second import path.

If you strongly prefer re-export (because external docs or code already reference `docfusion.ai_agents`), make the decision the other way and document why.

**Step 3: Write the ADR.**

```markdown
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
```

**Step 4a: If deleting.**

```bash
rm -rf src/docfusion/ai_agents/
git rm -rf src/docfusion/ai_agents/
```

Grep for any import references:
```bash
grep -rn "docfusion.ai_agents\|from .ai_agents\|import ai_agents" src/docfusion/ --include="*.py"
```

Fix any that appear (should be 0 based on today's audit).

**Step 4b: If re-exporting (alternative).**

Replace `src/docfusion/ai_agents/README.md` with `__init__.py`:

```python
"""Backward-compat re-exports from docfusion.agents.specialists."""

from docfusion.agents.specialists.writer_agent import WriterAgent
from docfusion.agents.specialists.editor_agent import EditorAgent
from docfusion.agents.specialists.compliance_agent import ComplianceAgent
# ... add the rest.

__all__ = ["WriterAgent", "EditorAgent", "ComplianceAgent"]
```

**Step 5: Commit.**
```bash
git add docs/technical/design_decisions/2026-04-22-ai-agents-placeholder.md
# plus the directory change
git commit -m "chore: dispose of ai_agents placeholder per ADR [G-AI-01][G-OP-01]"
```

## Notes for less-capable agents

- Do NOT make this decision unilaterally if you're uncertain. Open a draft PR and ask the user.
- If any external documentation (README, docs/*.md) references `ai_agents`, update those references in the same commit.
