"use client";

/**
 * HDSI Module - Barrel Re-exports
 *
 * Organized into five submodules:
 *
 *   core/        - Types, IndexedDB persistence, React hooks
 *   ai/          - Generation, streaming, embeddings, RAG, domain models,
 *                  predictive, style guide, diagrams, diff preview
 *   collab/      - Real-time collaboration, speech-to-text, voice, eye tracking
 *   content/     - Document organization, templates, bidirectional links,
 *                  graph view, text colors
 *   publishing/  - Publishing, export, compliance, presentations, PPTX
 *
 * All exports are re-exported here for backward compatibility.
 * New code should prefer importing from the specific submodule:
 *   import { hdsiDB } from "@/lib/hdsi/core";
 *   import { useRAG } from "@/lib/hdsi/ai";
 */

export * from "./core";
export * from "./ai";
export * from "./collab";
export * from "./content";
export * from "./publishing/index";
