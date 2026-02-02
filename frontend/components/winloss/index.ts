/**
 * Win/Loss Intelligence Components
 *
 * Comprehensive component library for post-award analysis,
 * debrief management, pattern recognition, and competitive intelligence.
 *
 * @example
 * ```tsx
 * import {
 *   WinLossDashboard,
 *   DebriefForm,
 *   DebriefDetail,
 *   WinLossStats,
 *   PatternAnalysis,
 * } from "@/components/winloss";
 *
 * // Main dashboard
 * <WinLossDashboard onCreateDebrief={() => setShowForm(true)} />
 *
 * // Create/edit debrief
 * <DebriefForm
 *   opportunityId={opportunity.id}
 *   onSubmit={handleSubmit}
 * />
 *
 * // View debrief details
 * <DebriefDetail
 *   debrief={debrief}
 *   onEdit={() => setEditing(true)}
 * />
 * ```
 */

// ===================
// Debrief Management
// ===================
export { DebriefForm } from "./DebriefForm";
export { DebriefDetail } from "./DebriefDetail";
export { DebriefList } from "./DebriefList";

// ===================
// Statistics & Analytics
// ===================
export { WinLossStats, WinLossStatsDisplay } from "./WinLossStats";
export { PatternAnalysis } from "./PatternAnalysis";
export { LessonsLearned } from "./LessonsLearned";
export { ROICalculator } from "./ROICalculator";

// ===================
// Improvement & Strategy
// ===================
export { ImprovementAreas } from "./ImprovementAreas";
export { CompetitorComparison } from "./CompetitorComparison";

// ===================
// Action Items
// ===================
export { ActionItemTracker } from "./ActionItemTracker";

// ===================
// Dashboard
// ===================
export { WinLossDashboard } from "./WinLossDashboard";

// ===================
// Default Export
// ===================
export { WinLossDashboard as default } from "./WinLossDashboard";
