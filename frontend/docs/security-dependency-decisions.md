# Security Dependency Decisions

Last reviewed: 2026-05-04

## High-Severity Remediation

The high-severity audit findings from `xlsx`, `next-pwa`/Workbox, and the Excalidraw transitive stack were removed from the deployed frontend dependency graph.

- `xlsx`: removed as an application dependency. HTTP import surfaces now accept CSV/TSV only. Local operational scripts use `scripts/lib/xlsx-reader.ts`, a narrow read-only first-party XLSX reader for the existing script use cases.
- `next-pwa`: removed from `next.config.ts` and from dependencies. The application now builds without PWA wrapping.
- `@excalidraw/excalidraw`: removed from dependencies. The document drawing surface is implemented in first-party SVG/canvas-compatible React code.

Verification: `npm audit --audit-level=high` exits successfully.

## Remaining Moderate Advisories

| Advisory group | Dependency path | Decision |
|---|---|---|
| `esbuild` dev-server request exposure | `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild` | No direct fix is available. This is a local development/tooling exposure through Drizzle tooling, not a production route dependency. Keep Drizzle tooling off public networks and re-check when Drizzle publishes a fixed chain. |
| `postcss` CSS stringify XSS | `next -> postcss`, also via `@sentry/nextjs` and `next-auth` peer paths | No direct fix is available from the current Next chain. The app does not expose user-controlled CSS stringification; keep Next updated and re-check on each framework upgrade. |
| `uuid` buffer bounds check | `mermaid -> uuid` | No direct fix is available through the current Mermaid chain. Avoid passing attacker-controlled buffers to UUID APIs; this app uses Mermaid as a rendering dependency, not for UUID buffer generation. Re-check when Mermaid updates its UUID dependency. |

