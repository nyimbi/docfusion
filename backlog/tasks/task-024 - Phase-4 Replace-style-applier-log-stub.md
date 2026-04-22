---
id: task-024
title: "Phase 4: Replace style-applier logging stub"
status: To Do
phase: 4
gap_ids: [G-SA-01]
priority: Low
---

# task-024 - Phase 4: Replace style-applier logging stub

## Description (the why)

`src/docfusion/document_engine/formatter/style_applier.py:842` raises `NotImplementedError` on `_log_initialization`. It's a logging-only stub, trivial to fix, but it must go to satisfy the Phase 1 invariant.

## Acceptance Criteria (the what)

- [ ] `_log_initialization` is implemented as a real structured log call.
- [ ] No `NotImplementedError` remains in `style_applier.py`.

## Implementation Plan (the how)

**Step 1: Read context.**
```bash
grep -n "_log_initialization\|self.logger\|^class" src/docfusion/document_engine/formatter/style_applier.py | head -20
```

**Step 2: Replace the stub.**

```python
def _log_initialization(self) -> None:
	"""Record the style applier's active configuration at startup."""
	self.logger.info(
		"StyleApplier initialized: engine=%s, theme=%s, locale=%s",
		getattr(self, "_engine", "default"),
		getattr(self, "_theme", "default"),
		getattr(self, "_locale", "en"),
	)
```

If the class doesn't have `self.logger`, add one in `__init__`:

```python
import logging
self.logger = logging.getLogger(__name__)
```

**Step 3: Verify + commit.**
```bash
grep -n "NotImplementedError" src/docfusion/document_engine/formatter/style_applier.py
# Must be 0 lines.

# No new test required — this is pure logging.
git add src/docfusion/document_engine/formatter/style_applier.py
git commit -m "fix(formatter): implement _log_initialization [G-SA-01]"
```

## Notes for less-capable agents

- Don't add a new test for this — it's logging only. Existing style_applier tests should still pass.
- Use `getattr` with a default so the log doesn't crash if a field is missing.
