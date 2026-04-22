---
id: TASK-001
title: 'Phase 1: Eliminate remaining asyncio.get_event_loop() calls'
status: Done
assignee: []
created_date: ''
updated_date: '2026-04-22 19:13'
labels: []
dependencies: []
priority: high
---

# task-001 - Phase 1: Eliminate remaining asyncio.get_event_loop() calls

## Description (the why)

Audit iteration 3 removed 33 occurrences of the deprecated `asyncio.get_event_loop()` call, but `HANDOVER.md` notes that ~47 more remain in `src/docfusion/discovery/**` and `src/docfusion/nlp/**`. This deprecation triggers a `DeprecationWarning` in Python 3.12 and will raise in 3.14. We close this debt before writing new async code.

## Acceptance Criteria (the what)

- [x] `grep -rn "asyncio.get_event_loop" src/docfusion/ --include="*.py"` returns **0 results**.
- [x] No new `DeprecationWarning: There is no current event loop` is emitted when running `uv run pytest tests/ci/ -W error::DeprecationWarning`.
- [x] All touched async functions still pass their existing tests.

## Implementation Plan (the how)

**Step 1: Find every occurrence.**
```bash
grep -rn "asyncio.get_event_loop" src/docfusion/ --include="*.py" > /tmp/getevloop.txt
wc -l /tmp/getevloop.txt
```

**Step 2: Classify each occurrence into one of three patterns.**

Read each file. For every line, decide which replacement applies:

- **Pattern A — inside an `async def` function**: replace with `asyncio.get_running_loop()`.
- **Pattern B — at module entrypoint (a `main()` or `if __name__ == "__main__":`)**: replace with `asyncio.new_event_loop()` + `asyncio.set_event_loop(loop)`.
- **Pattern C — used only to call `.time()`** (e.g. `asyncio.get_event_loop().time()`): replace the **entire expression** with `time.monotonic()` and add `import time` if missing.

**Step 3: Apply the replacements file by file.** Use the `Edit` tool — one replacement per edit. Never bulk-edit across files without reading each one first.

**Step 4: Verify per file.**
```bash
uv run pytest tests/ci/ -vxs -k <module_name>
```

**Step 5: Final verification.**
```bash
grep -rn "asyncio.get_event_loop" src/docfusion/ --include="*.py"
# Must return no lines.

uv run pytest tests/ci/ -W error::DeprecationWarning
# Must pass with no deprecation warnings escalated to errors.
```

**Step 6: Commit.**
```bash
git add src/docfusion/
git commit -m "fix: eliminate remaining asyncio.get_event_loop() calls [HANDOVER-1]"
```

## Notes for less-capable agents

- If you see `loop = asyncio.get_event_loop()` followed by `loop.run_until_complete(...)` inside a test, this is Pattern B (entrypoint), not Pattern A. Use `asyncio.new_event_loop()`.
- Do NOT blindly sed-replace. Some occurrences are inside `try/except DeprecationWarning` blocks and should be deleted entirely.
- If a file has more than 3 occurrences, commit after that file alone before moving on. Small commits are easier to revert.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Eliminated asyncio.get_event_loop() calls from src/ and tests
<!-- SECTION:NOTES:END -->
