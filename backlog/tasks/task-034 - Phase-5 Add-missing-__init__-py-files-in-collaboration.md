---
id: task-034
title: "Phase 5: Add missing __init__.py files in collaboration subdirs"
status: To Do
phase: 5
gap_ids: [G-OP-02]
priority: Low
---

# task-034 - Phase 5: Add missing __init__.py files in collaboration subdirs

## Description (the why)

Six subdirectories under `src/docfusion/collaboration/` lack `__init__.py`. This currently works because parent `__init__.py` re-exports, but it signals incomplete package hygiene and prevents namespace packages from working cleanly.

## Acceptance Criteria (the what)

- [ ] Every subdirectory under `src/docfusion/collaboration/` contains an `__init__.py`.
- [ ] Each `__init__.py` explicitly exports the public names of its submodules (if any).
- [ ] All existing collaboration tests still pass.

## Implementation Plan (the how)

**Step 1: Find missing `__init__.py`.**
```bash
find src/docfusion/collaboration -type d ! -name __pycache__ -exec test ! -e '{}/__init__.py' \; -print
```

**Step 2: For each missing directory, create `__init__.py`** populated with the public API:

```bash
ls src/docfusion/collaboration/editing/
# If you see `collaborative_editor.py`, `conflict_detector.py`, etc.:
```

```python
# src/docfusion/collaboration/editing/__init__.py
"""Collaborative editing primitives."""

from docfusion.collaboration.editing.collaborative_editor import CollaborativeEditor

__all__ = ["CollaborativeEditor"]
```

If you're not sure which symbols are public, export only those already re-exported in the parent package. Don't speculate.

**Step 3: Verify.**
```bash
uv run python -c "from docfusion.collaboration import *; print('OK')"
uv run pytest tests/ci/ -vxs -k collaboration
```

**Step 4: Commit.**
```bash
git add src/docfusion/collaboration/**/__init__.py
git commit -m "chore: add missing __init__.py in collaboration subdirs [G-OP-02]"
```

## Notes for less-capable agents

- An empty `__init__.py` is valid — use `"""Docstring."""` + nothing else if no public names need exporting.
- Do NOT create `__init__.py` under `__pycache__` directories.
