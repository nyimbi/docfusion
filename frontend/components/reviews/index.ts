/**
 * Reviews Module - Formal Review Process Components
 *
 * Comprehensive Pink/Red/Gold Team review system for government proposal evaluation.
 * Implements industry-standard color team methodology with modern UX patterns.
 *
 * Review Types:
 * - Pink Team: Initial draft review (50-70% complete) - focus on approach and compliance
 * - Red Team: Full proposal review (85-95% complete) - simulates government evaluation
 * - Gold Team: Final review (100% complete) - polish and verification
 * - Compliance: Regulatory and requirements verification
 * - Final: Pre-submission quality gate
 */

// Dashboard & Management
export { ReviewDashboard, type ReviewDashboardProps, type Review } from "./ReviewDashboard";
export { ReviewScheduler, type ReviewSchedulerProps, type ReviewScheduleData, type ReviewType, type ReviewTemplate } from "./ReviewScheduler";
export { ReviewerAssignment, type ReviewerAssignmentProps, type TeamMember, type AssignedReviewer, type ReviewerRole, type ConflictCheckResult } from "./ReviewerAssignment";

// Reviewer Workspace
export { ReviewInterface, type ReviewInterfaceProps, type ReviewSession, type ReviewerProgress } from "./ReviewInterface";
export { ScoringRubric, type ScoringRubricProps, type EvaluationCriteria, type CriteriaScore, type RatingCategory } from "./ScoringRubric";

// Comments System
export { CommentCard, type CommentCardProps, type Comment, type CommentType, type CommentSeverity, type ResolutionStatus } from "./CommentCard";
export { CommentPanel, type CommentPanelProps } from "./CommentPanel";

// Tracking & Progress
export { ResolutionTracker, type ResolutionTrackerProps, type ResolutionItem, type ResolutionStats } from "./ResolutionTracker";
export { ScoreAggregation, type ScoreAggregationProps, type ReviewerScore, type CriteriaAggregation } from "./ScoreAggregation";

// Reporting & Analytics
export { ReviewReport, type ReviewReportProps, type ReviewReportData } from "./ReviewReport";
export { BeforeAfterView, type BeforeAfterViewProps, type BeforeAfterComparisonData } from "./BeforeAfterView";
export { ReviewMetrics, type ReviewMetricsProps, type EffectivenessMetricsData, type ReviewTypeEffectiveness, type ReviewerEffectiveness, type WinRateCorrelation, type CommonIssueCategory } from "./ReviewMetrics";
