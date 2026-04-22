---
id: task-022
title: "Phase 4: Implement composition interpreter _merge_sequential_nodes"
status: To Do
phase: 4
gap_ids: [G-CP-01]
priority: Medium
---

# task-022 - Phase 4: Implement composition interpreter _merge_sequential_nodes

## Description (the why)

`src/docfusion/composition/interpreter.py:435` raises `NotImplementedError` on `_merge_sequential_nodes` — an AST optimization that merges adjacent same-type nodes (e.g. two consecutive text runs). Without it, compositions produce a fragmented AST that bloats memory and rendering time.

## Acceptance Criteria (the what)

- [ ] `_merge_sequential_nodes` is implemented and no longer raises.
- [ ] Merging is correct: two adjacent text nodes `A` + `B` become one text node with combined content equal to `A.content + B.content`.
- [ ] Merging is only applied when node types match AND their attributes/metadata are compatible.
- [ ] Non-mergeable pairs are preserved.
- [ ] Test `tests/ci/test_interpreter_merge.py` covers: (a) two text nodes merge, (b) text + heading don't merge, (c) three adjacent text nodes merge into one.

## Implementation Plan (the how)

**Step 1: Read the context.**
```bash
grep -n "_merge_sequential_nodes\|class.*Interpreter\|Node\b" src/docfusion/composition/interpreter.py | head -30
```

Find the `Node` class (may be in `parser.py` or `ast.py`). Note what fields it has — `type`, `content`, `attrs`, `children`, etc.

**Step 2: Implement.**

Replace the `NotImplementedError` body with:

```python
def _merge_sequential_nodes(self, nodes: list["Node"]) -> list["Node"]:
	"""Merge adjacent same-type nodes where compatible.

	Two nodes merge if:
	- They have the same `type`.
	- Their `attrs` dicts are equal.
	- Neither has children (we do not recurse-merge).
	"""
	if not nodes:
		return []

	merged: list["Node"] = [nodes[0]]
	for current in nodes[1:]:
		prior = merged[-1]
		if self._can_merge(prior, current):
			prior.content = (prior.content or "") + (current.content or "")
		else:
			merged.append(current)
	return merged


def _can_merge(self, a: "Node", b: "Node") -> bool:
	"""Return True if two adjacent nodes can be safely merged."""
	if a.type != b.type:
		return False
	if getattr(a, "attrs", None) != getattr(b, "attrs", None):
		return False
	if getattr(a, "children", None) or getattr(b, "children", None):
		return False
	# Only merge types that have concatenable content.
	mergeable_types = {"text", "code", "inline_code"}
	return a.type in mergeable_types
```

If the `Node` class uses dataclass attributes that are frozen, you'll need a different approach: build a new node instead of mutating:

```python
from dataclasses import replace

if self._can_merge(prior, current):
	merged[-1] = replace(prior, content=(prior.content or "") + (current.content or ""))
else:
	merged.append(current)
```

**Step 3: Find callers** of `_merge_sequential_nodes` in the interpreter and confirm they pass and receive lists of nodes, not other structures. If they use the return differently, adjust the signature.

**Step 4: Test.**

```python
# tests/ci/test_interpreter_merge.py
"""Sequential node merge coverage."""

import pytest

from docfusion.composition.interpreter import Interpreter
from docfusion.composition.parser import Node  # adjust to reality


def _text(content: str, attrs=None):
	return Node(type="text", content=content, attrs=attrs or {})


def _heading(content: str, level=1):
	return Node(type="heading", content=content, attrs={"level": level})


def test_merge_two_adjacent_text_nodes():
	interp = Interpreter()
	merged = interp._merge_sequential_nodes([_text("Hello "), _text("world")])
	assert len(merged) == 1
	assert merged[0].content == "Hello world"


def test_no_merge_across_types():
	interp = Interpreter()
	merged = interp._merge_sequential_nodes([_text("Hi "), _heading("Title")])
	assert len(merged) == 2


def test_three_consecutive_text_merge_into_one():
	interp = Interpreter()
	merged = interp._merge_sequential_nodes([
		_text("A"), _text("B"), _text("C"),
	])
	assert len(merged) == 1
	assert merged[0].content == "ABC"


def test_incompatible_attrs_prevent_merge():
	interp = Interpreter()
	merged = interp._merge_sequential_nodes([
		_text("red", attrs={"color": "red"}),
		_text("blue", attrs={"color": "blue"}),
	])
	assert len(merged) == 2
```

**Step 5: Verify + commit.**
```bash
uv run pytest tests/ci/test_interpreter_merge.py -vxs
grep -n "NotImplementedError" src/docfusion/composition/interpreter.py
# Must be 0 lines.

git add src/docfusion/composition/interpreter.py tests/ci/test_interpreter_merge.py
git commit -m "feat(composition): implement _merge_sequential_nodes [G-CP-01]"
```

## Notes for less-capable agents

- Do NOT merge recursively into children. This is a single-level pass.
- If the `Node` class is a Pydantic model, the `replace` approach won't work — use `.model_copy(update={"content": ...})` instead.
- The mergeable-types set is conservative. Expanding it is a separate task.
