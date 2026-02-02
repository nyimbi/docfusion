/**
 * Pipeline Components - DocFusion Capture Pipeline
 *
 * Barrel file exporting all pipeline management components for the
 * capture-to-proposal lifecycle. These components provide comprehensive
 * pipeline visualization, stage management, and analytics capabilities.
 *
 * Components:
 * - PipelineBoard: Kanban board for visualizing pipeline stages
 * - PipelineCard: Individual capture card with PWin indicator
 * - CaptureDetail: Detailed view of a capture with all fields
 * - PWinCalculator: Interactive probability of win calculator
 * - GateReviewPanel: Gate review management with checklists
 * - ActivityTimeline: Timeline of capture activities
 * - MilestoneTracker: Visual milestone tracker with progress
 * - BidDecisionPackage: Bid/No-Bid decision package generator
 * - PipelineAnalytics: Analytics dashboard with pipeline metrics
 * - StageTransitionDialog: Dialog for stage transitions
 */

// Main board component for pipeline visualization
export { PipelineBoard } from "./PipelineBoard";
export { default as PipelineBoardDefault } from "./PipelineBoard";

// Individual capture card component
export { PipelineCard } from "./PipelineCard";
export { default as PipelineCardDefault } from "./PipelineCard";

// Detailed capture view with editing
export { CaptureDetail } from "./CaptureDetail";
export { default as CaptureDetailDefault } from "./CaptureDetail";

// PWin probability calculator
export { PWinCalculator } from "./PWinCalculator";
export { default as PWinCalculatorDefault } from "./PWinCalculator";

// Gate review management
export { GateReviewPanel } from "./GateReviewPanel";
export { default as GateReviewPanelDefault } from "./GateReviewPanel";

// Activity timeline component
export { ActivityTimeline } from "./ActivityTimeline";
export { default as ActivityTimelineDefault } from "./ActivityTimeline";

// Milestone tracker component
export { MilestoneTracker } from "./MilestoneTracker";
export { default as MilestoneTrackerDefault } from "./MilestoneTracker";

// Bid decision package generator
export { BidDecisionPackage } from "./BidDecisionPackage";
export { default as BidDecisionPackageDefault } from "./BidDecisionPackage";

// Analytics dashboard
export { PipelineAnalytics } from "./PipelineAnalytics";
export { default as PipelineAnalyticsDefault } from "./PipelineAnalytics";

// Stage transition dialog
export { StageTransitionDialog } from "./StageTransitionDialog";
export { default as StageTransitionDialogDefault } from "./StageTransitionDialog";
