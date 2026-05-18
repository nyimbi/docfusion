# Security Dependency Decisions

Last reviewed: 2026-05-18

## High-Severity Remediation

The high-severity audit findings from `xlsx`, `next-pwa`/Workbox, the Excalidraw transitive stack, old `next` releases, and transitive `protobufjs`/`fast-uri`/`@protobufjs/utf8` chains were removed from the deployed frontend dependency graph.

- `xlsx`: removed as an application dependency. HTTP import surfaces now accept CSV/TSV only. Local operational scripts use `scripts/lib/xlsx-reader.ts`, a narrow read-only first-party XLSX reader for the existing script use cases.
- `next-pwa`: removed from `next.config.ts` and from dependencies. The application now builds without PWA wrapping.
- `@excalidraw/excalidraw`: removed from dependencies. The document drawing surface is implemented in first-party SVG/canvas-compatible React code.
- `next`: pinned within the current Next 15 line to clear high-severity framework advisories.
- `@authzed/authzed-node` transitive dependencies: pinned narrow npm overrides for the fixed `protobufjs`, `@protobufjs/utf8`, and `fast-uri` versions.
- Mermaid/Sentry/y-webrtc moderate advisories: upgraded Mermaid and pinned fixed transitive `brace-expansion` and `ws` versions.

Verification: `npm audit --omit=dev --audit-level=high` exits successfully.

## Remaining Moderate Advisories

| Advisory group | Dependency path | Decision |
|---|---|---|
| `esbuild` dev-server request exposure | `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild` | No direct fix is available. This is a local development/tooling exposure through Drizzle tooling, not a production route dependency. Keep Drizzle tooling off public networks and re-check when Drizzle publishes a fixed chain. |
| `postcss` CSS stringify XSS | `next -> postcss`, also via `@sentry/nextjs` and `next-auth` peer paths | No safe direct fix is available from the current Next chain. `npm audit fix --force` proposes downgrading to `next@9.3.3`, which is not compatible with this app. The app does not expose user-controlled CSS stringification; keep Next updated and re-check on each framework upgrade. |
