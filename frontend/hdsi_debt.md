# HDSI Editor Technical Debt Analysis

**Date**: 2026-02-02
**Analyst**: Claude Code
**Files Reviewed**:
- `components/document/HDSIEnhanced.tsx` (977 lines)
- `components/document/HDSIFullEnhanced.tsx` (1842 lines)
- `lib/hdsi/types.ts` (639 lines)

---

## Executive Summary

The current HDSI (Hierarchical Document Synthesis Interface) implementation achieves approximately **21% conformance** with the target specification. While the AI generation workflow and tree manipulation features are robust, critical cognitive ergonomics features (context visualization, coherence feedback, keyboard navigation) are missing entirely.

---

## Specification vs Implementation Comparison

### 1. Layout Structure

| Spec Requirement | Status | Implementation Notes |
|------------------|--------|----------------------|
| **4-Pane Layout** | ⚠️ PARTIAL | Only 2 panes implemented |
| Structural Tree: 28% width | ❌ MISSING | Uses `w-1/3` (33%) |
| Context Buffer Inspector (collapsible) | ❌ MISSING | Not implemented |
| Node Property Matrix: 52% width | ⚠️ PARTIAL | Uses `flex-1` instead of fixed % |
| Generation Control Surface (bottom bar) | ❌ MISSING | Controls are in header toolbar |

**Current Layout** (`HDSIEnhanced.tsx:662-711`):
```tsx
<div className="flex-1 flex overflow-hidden">
  {/* Tree Pane - 33% instead of 28% */}
  <div className="w-1/3 border-r overflow-auto p-2">
    <TreeView ... />
  </div>
  {/* Properties Pane - flex instead of 52% */}
  <div className="flex-1 p-4 overflow-auto">
    <HDSINodeEditor ... />
  </div>
</div>
```

**Required Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│                      Toolbar (fixed)                         │
├──────────┬───────────────────────────────────┬──────────────┤
│ Tree     │    Node Property Matrix           │ Context      │
│ (28%)    │         (52%)                     │ Buffer       │
│          │                                   │ Inspector    │
│          │                                   │ (collapsible)│
├──────────┴───────────────────────────────────┴──────────────┤
│              Generation Control Surface (bottom bar)         │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. Node State Glyphs

| Glyph | Meaning | Spec Requirement | Status | Current Implementation |
|-------|---------|------------------|--------|------------------------|
| ◻ | Unexpanded | Unicode glyph | ❌ | `ChevronRight` icon |
| ■ | Generated | Unicode glyph | ⚠️ | `CheckCircle` (green icon) |
| ⬤ | Active generation | Radial gradient pulse | ⚠️ | `Loader2` with `animate-spin` |
| ⚠ | Coherence debt | Unicode warning | ❌ | Not implemented |

**Current Status Rendering** (`HDSIEnhanced.tsx:859-867`):
```tsx
{generatingIds.has(node.id) && (
  <Loader2 className="h-3 w-3 animate-spin text-primary" />
)}
{node.status === "generated" && !generatingIds.has(node.id) && (
  <CheckCircle className="h-3 w-3 text-green-500" />
)}
{node.status === "error" && (
  <AlertCircle className="h-3 w-3 text-red-500" />
)}
```

**Missing**: No rendering for `status === "debt"` despite type support.

---

### 3. Context Buffer Inspector

**Spec Requirements**:
- Three-tier context provenance visualization
- Hierarchical source ordering (document → section → external)
- Token-proportional colored progress bars
- Embedding drift indicator (semantic similarity decay over generations)
- Dashed separators between context tiers
- 3,800 token buffer limit

**Status**: ❌ **NOT IMPLEMENTED**

The `HDSINode` type includes `aiConfig` but no UI exposes:
- Which context sources are active
- Token allocation per source
- Embedding drift metrics
- Buffer utilization

**Type Support Exists** (`types.ts:56-61`):
```typescript
export interface AIModelConfig {
  provider: "azure" | "openai" | "anthropic" | "local";
  model: string;
  temperature: number;
  maxTokens: number;
}
```

But lacks context buffer specific types.

---

### 4. Token Budget Controls

| Requirement | Status | Current Implementation |
|-------------|--------|------------------------|
| Dual-slider (min/max range) | ❌ | Single numeric input |
| Reading time estimation | ❌ | Not calculated or displayed |
| 3,800 token context cap | ⚠️ | No cap enforced, default 500/node |
| Visual token meter | ❌ | No visualization |

**Current Implementation** (`HDSIEnhanced.tsx:89`):
```typescript
tokenBudget: node.tokenBudget || 500,
```

**Required**: Dual-range slider with formula:
```
Reading Time (minutes) = tokenBudget / 200
```

---

### 5. Phase State Machine

**Spec States**: `Outline Synthesis → Sequential Expansion → Revision Cycle`

**Current States** (`HDSIFullEnhanced.tsx:589`):
```typescript
const [discoveryStep, setDiscoveryStep] = useState<
  "input" | "analyzing" | "review" | "generate"
>("input");
```

| Spec Phase | Status | Current Mapping |
|------------|--------|-----------------|
| Outline Synthesis | ⚠️ PARTIAL | `input` → `analyzing` → `review` |
| Sequential Expansion | ⚠️ PARTIAL | `generate` + node-by-node generation |
| Revision Cycle | ❌ MISSING | No revision tracking or cycle |

**Missing**:
- Tri-state toggle buttons for phase selection
- Revision cycle state with re-generation tracking
- Phase persistence across sessions

---

### 6. Coherence Debt Visualization

| Requirement | Status | Notes |
|-------------|--------|-------|
| Pulsating border (0.5-3 Hz frequency) | ❌ | No CSS animation |
| Score threshold < 0.6 triggers warning | ❌ | No threshold check |
| ⚠ debt glyph rendering | ❌ | Type exists, UI missing |
| Coherence score calculation | ❌ | Always initialized to 1.0 |
| Debt propagation to parent nodes | ❌ | Not implemented |

**Type Support** (`types.ts:21-42`):
```typescript
export interface HDSINode extends DocumentStructure {
  status: "outline" | "generating" | "generated" | "error" | "debt" | "deleted";
  coherenceScore: number;  // Exists but never calculated
  // ...
}
```

**Required CSS Animation**:
```css
@keyframes coherence-pulse {
  0%, 100% { border-color: rgba(251, 146, 60, 0.3); }
  50% { border-color: rgba(251, 146, 60, 0.8); }
}
.coherence-debt {
  animation: coherence-pulse 1.5s ease-in-out infinite;
}
```

---

### 7. Keyboard Navigation

| Shortcut | Action | Status |
|----------|--------|--------|
| `Tab` | Next sibling | ❌ NOT IMPLEMENTED |
| `Shift+Tab` | Previous sibling | ❌ NOT IMPLEMENTED |
| `Enter` | Expand/collapse node | ❌ NOT IMPLEMENTED |
| `Cmd/Ctrl+G` | Generate content | ❌ NOT IMPLEMENTED |
| `Cmd/Ctrl+Shift+G` | Generate all | ❌ NOT IMPLEMENTED |
| `Arrow Up/Down` | Navigate tree | ❌ NOT IMPLEMENTED |
| `Arrow Right` | Expand or enter children | ❌ NOT IMPLEMENTED |
| `Arrow Left` | Collapse or go to parent | ❌ NOT IMPLEMENTED |

The TreeView component (`HDSIEnhanced.tsx:773-973`) has **zero keyboard event handlers**. All interactions require mouse clicks.

---

## Conformance Scorecard

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Layout Structure | 15% | 30% | 4.5% |
| Node State Visualization | 15% | 40% | 6.0% |
| Context Buffer Inspector | 20% | 0% | 0.0% |
| Token Budget Controls | 10% | 20% | 2.0% |
| Phase State Machine | 15% | 50% | 7.5% |
| Coherence Debt | 15% | 10% | 1.5% |
| Keyboard Navigation | 10% | 0% | 0.0% |
| **Total** | **100%** | - | **21.5%** |

---

## What IS Implemented Well

### Strengths

1. **AI Generation Workflow**
   - Discovery analysis with strategic document planning
   - Editable AI prompts (discovery, outline, content)
   - Step-by-step wizard with progress tracking
   - Template-based generation

2. **Tree Operations**
   - Drag-and-drop reordering
   - Indent/outdent (hierarchy changes)
   - Move up/down within siblings
   - Expand/collapse (mouse-based)

3. **Node CRUD Operations**
   - Add nodes (root or child)
   - Soft delete with undo capability
   - Hard delete with confirmation
   - Restore from soft-deleted state

4. **Template System**
   - 20+ built-in templates by category
   - Template customization and persistence
   - Import from existing documents
   - Category-based organization

5. **Persistence Layer**
   - IndexedDB storage via `hdsiDB`
   - Version history tracking
   - Sync queue for offline support
   - Document metadata management

---

## Critical Gaps for Spec Compliance

### Priority 1: Must Have (Blocking)

1. **Context Buffer Inspector** - Users cannot understand AI context sources
2. **Keyboard Navigation** - Power users cannot work efficiently
3. **Coherence Debt Visualization** - No feedback on content quality
4. **Layout Restructure** - Current layout doesn't match spec

### Priority 2: Should Have (Important)

5. **Unicode State Glyphs** - Faster visual parsing than icons
6. **Token Budget Dual-Slider** - Better control over content length
7. **Reading Time Estimation** - Helps scope sections
8. **Phase State Machine** - Track revision cycles

### Priority 3: Could Have (Enhancement)

9. **Embedding Drift Indicators** - Advanced coherence tracking
10. **Generation Control Surface** - Dedicated bottom bar
11. **Token Meter Visualization** - Visual budget feedback

---

## Files Requiring Modification

| File | Changes Required | Complexity |
|------|------------------|------------|
| `components/document/HDSIEnhanced.tsx` | Layout, glyphs, keyboard nav | High |
| `components/document/HDSIFullEnhanced.tsx` | Phase machine, control surface | Medium |
| `lib/hdsi/types.ts` | Context buffer types | Low |
| `components/document/ContextBufferInspector.tsx` | NEW FILE | High |
| `components/document/GenerationControlSurface.tsx` | NEW FILE | Medium |
| `components/document/TokenBudgetSlider.tsx` | NEW FILE | Low |
| `lib/hdsi/coherence.ts` | NEW FILE - scoring logic | Medium |
| `styles/hdsi.css` | Coherence pulse animation | Low |

---

## Estimated Implementation Effort

| Phase | Features | Effort |
|-------|----------|--------|
| Phase 1 | Layout + Keyboard Navigation | Large |
| Phase 2 | Context Buffer Inspector | Large |
| Phase 3 | Coherence Debt System | Medium |
| Phase 4 | Token Controls + Glyphs | Small |
| Phase 5 | Phase State Machine | Medium |

---

## Recommendation

Prioritize **keyboard navigation** and **layout restructure** first, as these provide immediate productivity gains. The Context Buffer Inspector, while complex, is essential for users to understand and tune AI behavior. Coherence debt can be implemented incrementally.
