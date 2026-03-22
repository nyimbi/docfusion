# ADR: RFP Response Generation and the LaTeX Boundary

Date: 2026-03-23

Status: Proposed

## Context

`DocFusion` currently contains:

- a structured editor and hierarchical document model
- workflow, review, and AI-assisted drafting features
- export and rendering paths for `pdf`, `docx`, `pptx`, `html`, `markdown`, and `latex`
- additional document features such as TOC generation, bibliography, equations, numbering, and cross-reference support

At the same time, parts of the system already treat LaTeX as a serious output path:

- the frontend can render LaTeX source from structured editor content
- the current PDF path is effectively "generate LaTeX first, then compile elsewhere"
- the backend document engine includes a LaTeX-first PDF renderer with fallback behavior

This has created an important design question:

Should `DocFusion` use LaTeX as the primary document creation and rendering model, or should LaTeX remain one renderer/export target among several?

This question needs to be answered in light of the actual product goal:

`DocFusion` is not trying to be a general-purpose publishing platform. The desired output is RFP responses generated in response to received RFPs.

## Problem

If the product goal is narrowly focused on RFP responses, then there is a risk of overbuilding:

- replicating large parts of LaTeX in browser and application code
- building general publishing capabilities that do not materially improve proposal quality or throughput
- increasing complexity in formatting, rendering, and cross-format consistency
- investing in typesetting features that are valuable for books, journals, and technical papers, but only marginally useful for proposal operations

At the same time, there are legitimate reasons not to make LaTeX the single authoring model:

- proposal teams do not want to author raw `.tex`
- collaboration, review, snippets, AI drafting, and structured editing are core product capabilities
- many proposal teams need `docx` and `pptx`, not just PDF
- government and enterprise bid teams often revise material in Word-compatible workflows

## Decision

`DocFusion` should not become a LaTeX-native authoring product.

`DocFusion` should use a structured internal document model as the canonical source of truth, and treat LaTeX as a first-class rendering/export backend for high-fidelity PDF generation where appropriate.

In practical terms:

- authoring should remain structured, collaborative, and application-native
- LaTeX should be retained as a render target, not as the main editing surface
- the platform should stop reimplementing advanced typesetting behavior unless it is necessary for non-LaTeX outputs or directly improves RFP response workflows

## Why This Fits the Product

For RFP responses, the highest-value capabilities are:

- fast assembly from reusable content
- strict section/template control
- compliance with solicitation structure
- review and approval workflow
- red-team and quality workflows
- consistent branding
- multi-format outputs for submission, collaboration, and executive review

These are not the same as "build the best browser-based substitute for TeX."

LaTeX is useful for:

- stable PDF layout
- professional print-quality output
- difficult tables and equations
- citations and references when needed

But LaTeX is not where the core product differentiation lives. The differentiation lives in:

- ingesting an RFP
- extracting requirements
- assembling the right response structure
- populating the response with approved content
- coordinating AI assistance and human review
- producing final submission-ready artifacts

## Recommendations

### 1. Keep the structured document model as the canonical source

Do not make `.tex` the system of record.

The canonical representation should remain the structured document model already used by the editor and document engine. All outputs should be compiled from that model.

This preserves:

- collaborative editing
- review comments and approvals
- snippet and template reuse
- AI-assisted drafting
- format independence

### 2. Keep LaTeX as a first-class renderer, not the authoring interface

LaTeX should remain important, especially for PDF generation, but it should sit behind a rendering boundary.

This means:

- `structured content -> latex -> pdf` is acceptable
- `users author and manage source documents in latex` is not the right default

### 3. Narrow the feature roadmap to RFP-response needs

When evaluating document features, prefer the question:

"Does this improve win probability, response quality, compliance, or throughput for RFP responses?"

over:

"Would this be useful in a general document platform?"

Features that align strongly with the product:

- requirement traceability
- outline generation from the solicitation
- section-level assignment and ownership
- compliance matrices
- content library and snippet reuse
- versioned approved boilerplate
- red-team review workflows
- export to `docx`, `pdf`, and `pptx`

Features that should be scrutinized more carefully:

- generalized publishing features with no proposal-specific value
- deep academic citation workflows beyond what proposal teams need
- rich document types unrelated to RFP response production
- extensive print-layout abstractions duplicated both in app code and in LaTeX templates

### 4. Avoid duplicating advanced LaTeX semantics in application code

`DocFusion` already overlaps with LaTeX in several areas:

- TOC generation
- numbering
- references
- bibliography
- template/layout behavior
- equation handling

Some overlap is justified because non-LaTeX outputs also need these concepts. But the system should not keep drifting toward a second typesetting engine.

Use this rule:

- if a capability is required across `docx`, `pptx`, `html`, and `pdf`, keep it in the canonical model
- if a capability is primarily about high-fidelity PDF typesetting, push it down into the LaTeX renderer or PDF renderer

### 5. Strengthen the renderer boundary

The right architecture is:

- canonical structured proposal model
- proposal assembly and compliance layer
- renderer interface
- per-format implementations for `pdf`, `docx`, `pptx`, `html`, `markdown`, `latex`

This keeps product logic separate from format-specific logic.

In particular:

- proposal semantics should not be entangled with LaTeX package behavior
- format quirks should be isolated to renderers
- testing should focus on cross-renderer consistency for the same proposal source

### 6. Treat PDF as a deliverable, not a design center

The deliverable set for RFP response operations is usually broader than PDF:

- `docx` for customer edits and partner collaboration
- `pdf` for submission or controlled distribution
- `pptx` for internal reviews, oral presentations, and executive summaries

The system should therefore optimize for:

- one source
- multiple outputs
- predictable proposal semantics across formats

not:

- one PDF path that defines the whole product architecture

## Suggested Product Boundary

`DocFusion` should be framed internally as:

"A structured RFP response generation platform with multi-format output."

It should not be framed as:

- a browser-native LaTeX replacement
- a generic publishing suite
- a full academic authoring system

## Near-Term Implementation Guidance

### Prioritize

- robust RFP ingestion and structure extraction
- response template mapping
- reusable approved content blocks
- compliance and requirement traceability
- section-level workflows
- stable `docx`, `pdf`, and `pptx` generation
- proposal review and approval flows

### Deprioritize or contain

- broad publishing features not tied to proposal work
- advanced TeX-like layout features in core app logic
- duplicate implementations of numbering, references, and layout rules where a renderer can own them

## Consequences

### Positive

- keeps product scope aligned to proposal operations
- reduces risk of building a second LaTeX system
- preserves strong collaboration and AI-assisted authoring workflows
- supports the actual output mix proposal teams need
- keeps renderer-specific complexity out of product logic

### Negative

- some advanced PDF layout fidelity may remain dependent on the LaTeX renderer
- cross-format consistency will require active renderer testing and discipline
- certain rich publishing features may need to be explicitly excluded even if they are technically interesting

## Review Questions for the Team

- Which existing document features directly improve RFP response quality or throughput?
- Which current features are really generic publishing features in disguise?
- Should PDF generation be standardized on a LaTeX-backed path, or should there remain multiple PDF strategies?
- Which semantics belong in the canonical proposal model versus the renderer layer?
- Are there proposal use cases that truly require deeper TeX-native authoring, or is structured authoring sufficient?

## Bottom Line

Keep LaTeX.

Do not make LaTeX the product.

Use LaTeX where it is strongest: high-quality rendering and PDF production.
Keep `DocFusion` focused on what actually matters for the target product: generating strong RFP responses from received RFPs, quickly and reliably, with structured workflows and multi-format outputs.
