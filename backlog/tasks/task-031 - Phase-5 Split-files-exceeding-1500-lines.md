---
id: task-031
title: "Phase 5: Split files exceeding 1500 lines"
status: To Do
phase: 5
gap_ids: [findings-plan-4.12]
priority: Low
---

# task-031 - Phase 5: Split files exceeding 1500 lines

## Description (the why)

Several source files exceed 1500 lines, mixing multiple concerns. Smaller files are easier to reason about and reduce merge conflicts. Target: no file in active codebase exceeds 1500 lines.

## Acceptance Criteria (the what)

- [ ] No file in `src/docfusion/` exceeds 1500 lines.
- [ ] No file in `frontend/lib/` or `frontend/app/(app)/` exceeds 1500 lines (TS/TSX).
- [ ] All existing tests pass after splits.
- [ ] Imports are updated; no broken references.

## Implementation Plan (the how)

**Step 1: Find oversize files.**
```bash
find src/docfusion frontend/lib frontend/app -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) -exec wc -l {} + | awk '$1 > 1500 {print}' | sort -n
```

Likely candidates:
- `src/docfusion/document_engine/formatter/document_formatter.py` (~3099 lines)
- `src/docfusion/agents/tools/publishing_tools.py` (~2963)
- `src/docfusion/document_engine/assembler/block_manager.py` (~2203)
- `src/docfusion/agents/specialists/content_generator.py` (~2129)
- `frontend/lib/actions/pricing.ts` (~4092)
- `frontend/app/(app)/opportunities/page.tsx` (~1773)

**Step 2: Split strategy per file.**

- **`document_formatter.py`** → `text_formatter.py`, `table_formatter.py`, `list_formatter.py`, `heading_formatter.py`. Keep `document_formatter.py` as a thin orchestrator that imports and delegates.
- **`publishing_tools.py`** → `export_tools.py`, `render_tools.py`, `template_tools.py`.
- **`block_manager.py`** → `block_types.py`, `block_operations.py`, `block_serialization.py`.
- **`content_generator.py`** → `content_generator_text.py`, `content_generator_structured.py`.
- **`pricing.ts`** → `pricing-queries.ts`, `pricing-mutations.ts`, `pricing-calculations.ts`.
- **`opportunities/page.tsx`** → extract `OpportunityFilters`, `OpportunityTable`, `BulkActions`, `VotingSummary` to `components/opportunities/`.

**Step 3: Working rule — one file at a time.** Do not attempt to split all files in one commit.

For each file:

1. Run existing tests, confirm green.
2. Copy the file to a scratch branch.
3. Identify natural seams (classes, function groups, sections separated by comment banners).
4. Create the new files, move code over.
5. Update imports at call sites: `from old_module import X` → `from new_module import X`.
6. Keep the original file as a re-export shim so downstream code doesn't break immediately:

```python
# document_formatter.py (now thin)
from docfusion.document_engine.formatter.text_formatter import TextFormatter
from docfusion.document_engine.formatter.table_formatter import TableFormatter
from docfusion.document_engine.formatter.list_formatter import ListFormatter
from docfusion.document_engine.formatter.heading_formatter import HeadingFormatter

__all__ = ["TextFormatter", "TableFormatter", "ListFormatter", "HeadingFormatter"]

# Orchestration facade:
class DocumentFormatter:
	def __init__(self):
		self._text = TextFormatter()
		self._table = TableFormatter()
		# ...
```

7. Run the full test suite. If green, commit:

```bash
git add src/docfusion/document_engine/formatter/
git commit -m "refactor: split document_formatter.py into 4 focused modules [findings-plan-4.12]"
```

**Step 4: After all files are split**, optionally delete the re-export shims in a follow-up task. Not required for this task.

**Step 5: Verify no file exceeds 1500 lines.**
```bash
find src/docfusion frontend/lib frontend/app -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) -exec wc -l {} + | awk '$1 > 1500 {print}'
# Expected: empty output.
```

## Notes for less-capable agents

- Splits are safe when: (1) the new modules import cleanly, (2) all imports at call sites resolve, (3) all tests still pass.
- If you split a file and a test immediately breaks, revert and try a different seam.
- Keep function signatures identical during the split. Refactoring signatures is a separate task.
