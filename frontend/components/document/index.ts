/**
 * Document Components Export - DocFusion
 *
 * Exports all document-related components including quality assessment,
 * comments, workflows, and collaboration features.
 */

// Core HDSI Components
// Note: Legacy HDSI.tsx and HDSIFull.tsx archived to _archive/ (superseded by Enhanced versions)
export { HDSIFullEnhanced } from "./HDSIFullEnhanced";
export { HDSIEnhanced } from "./HDSIEnhanced";
export { HDSIToolbar } from "./HDSIToolbar";
export { QuickQualityScore, CopySectionButton } from "./HDSIToolbar";

// Diagram Components
export { DiagramEditor } from "./DiagramEditor";
export { DiagramPanel } from "./DiagramPanel";
export type { DiagramFormat } from "./DiagramEditor";

// Quality Assessment Components
export { QualityAssessmentPanel } from "./QualityAssessmentPanel";
export { QualityScoreCard, MiniScoreGauge, CategoryMiniBar, QualityProgress } from "./QualityScoreCard";
export { QualityImprovement, MiniSuggestion, QuickActionToolbar } from "./QualityImprovement";

// Document Analysis Components
export { DocumentAnalysisPanel } from "../analysis/DocumentAnalysisPanel";
export { ComplianceHeatmap } from "../analysis/ComplianceHeatmap";
export { AnalysisSidebar } from "../analysis/AnalysisSidebar";

// Comment and Review Components
export { CommentsPanel } from "./CommentsPanel";
export { CommentThread } from "./CommentThread";
export { ReviewToolbar } from "./ReviewToolbar";
export { ApprovalWorkflow } from "./ApprovalWorkflow";

// AI Components
export { AIStructureGenerator } from "./AIStructureGenerator";
export { AIDiffPreview } from "./AIDiffPreview";

// Voice Components
export { SpeechInputButton } from "./SpeechInputButton";

// Graph & Organization Components
export { GraphView } from "./GraphView";
export { BacklinksPanel } from "./BacklinksPanel";

// Collaboration Components (from editor)
export { CollaboratorAvatars } from "../editor/CollaboratorAvatars";
export { CollaboratorCursors } from "../editor/CollaboratorCursors";

// Status Components
export { StatusBadge } from "../documents/StatusBadge";

// Publishing Components
export { PublishingToolbar } from "./PublishingToolbar";
export { BibliographyManager } from "./BibliographyManager";
export type {
  PageLayout,
  Watermark,
  WatermarkPreset,
  CitationStyle,
  BibliographyEntry,
} from "@/lib/hdsi/publishing";

// Document Browser
export { DocumentBrowser } from "./DocumentBrowser";

// Template Components
export { TemplatePicker } from "./TemplatePicker";

// Version Components
export { VersionHistoryDialog } from "./VersionHistoryDialog";

// Utility Components
export { DocumentActionsMenu } from "./DocumentActionsMenu";
export { DocumentSection } from "./DocumentSection";
