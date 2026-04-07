/**
 * HDSI Core Submodule
 *
 * Foundation types, IndexedDB persistence, and React hooks
 * for document management. All other HDSI submodules depend on core.
 *
 * Dependency graph:
 *   types  (leaf)
 *   db     -> types
 *   hooks  -> db, types
 */

// Core type definitions shared across all HDSI submodules
export type {
  HDSINode,
  HDSIDocument,
  HDSIVersion,
  AIModelConfig,
  Command,
  CommandType,
  ModelConfig,
  GenerationOptions,
  GenerationProgress,
  GenerationResult,
  UseHDSIDocumentOptions,
  UseHDSIDocumentResult,
  UseHDSIVersionHistoryResult,
  UseHDSIAllDocumentsResult,
  CollaborationSession,
  UserPresence,
  RAGContext,
  RAGSource,
  Citation,
  EmbeddingVector,
  SearchResult,
  TokenStream,
  StreamProgress,
  DomainType,
  DomainAdapter,
  DomainGenerationResult,
  PredictionCandidate,
  PredictedContent,
  StyleRule,
  Violation,
  StyleReport,
  VoiceCommand,
  VoiceState,
  DiagramGeneration,
  DiagramType,
  RegulationType,
  RegulationClause,
  ComplianceReport,
  EyePosition,
  AttentionMetrics,
} from "../types";

// IndexedDB persistence (auto-save, versioning, offline sync)
export { hdsiDB } from "../db";

// React hooks for document CRUD and version history
export {
  useHDSIDocument,
  useHDSIVersionHistory,
  useHDSIAllDocuments,
} from "../hooks";
