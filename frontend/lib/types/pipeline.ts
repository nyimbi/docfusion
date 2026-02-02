// lib/types/pipeline.ts
// Type exports for Capture-to-Proposal Pipeline Manager

// Import schema types for local use
import type {
  CapturePipeline as _CapturePipeline,
  NewCapturePipeline as _NewCapturePipeline,
  CaptureActivity as _CaptureActivity,
  NewCaptureActivity as _NewCaptureActivity,
  GateReview as _GateReview,
  NewGateReview as _NewGateReview,
  PipelineMilestone as _PipelineMilestone,
  NewPipelineMilestone as _NewPipelineMilestone,
} from "@/lib/db/schema-pipeline";

// Re-export schema types
export type CapturePipeline = _CapturePipeline;
export type NewCapturePipeline = _NewCapturePipeline;
export type CaptureActivity = _CaptureActivity;
export type NewCaptureActivity = _NewCaptureActivity;
export type GateReview = _GateReview;
export type NewGateReview = _NewGateReview;
export type PipelineMilestone = _PipelineMilestone;
export type NewPipelineMilestone = _NewPipelineMilestone;

// Import action types for local use
import type {
  PwinCalculation as _PwinCalculation,
  GateDecision as _GateDecision,
  BidDecisionPackage as _BidDecisionPackage,
  PipelineAnalytics as _PipelineAnalytics,
  PipelineForecast as _PipelineForecast,
  AtRiskOpportunity as _AtRiskOpportunity,
  PipelineSummary as _PipelineSummary,
  ActivityFilters as _ActivityFilters,
  ChecklistItem as _ChecklistItem,
} from "@/lib/actions/pipeline";

// Re-export action types
export type PwinCalculation = _PwinCalculation;
export type GateDecision = _GateDecision;
export type BidDecisionPackage = _BidDecisionPackage;
export type PipelineAnalytics = _PipelineAnalytics;
export type PipelineForecast = _PipelineForecast;
export type AtRiskOpportunity = _AtRiskOpportunity;
export type PipelineSummary = _PipelineSummary;
export type ActivityFilters = _ActivityFilters;
export type ChecklistItem = _ChecklistItem;

// Re-export stage constants
export { PIPELINE_STAGES } from "@/lib/db/schema-pipeline";

// UI-specific types

export type PipelineStage =
  | "discovery"
  | "qualification"
  | "capture"
  | "proposal"
  | "submitted"
  | "evaluation"
  | "awarded"
  | "lost"
  | "no_bid"
  | "cancelled";

export type BidDecision = "bid" | "no_bid" | "pending";

export type IncumbentStatus = "incumbent" | "challenger" | "new_market";

export type SolutionReadiness = "not_started" | "in_progress" | "ready";

export type TeamingStatus = "none_needed" | "in_progress" | "complete";

export type PipelinePriority = "high" | "medium" | "low";

export type HealthStatus = "on_track" | "at_risk" | "critical";

export type ActivityType =
  | "customer_meeting"
  | "site_visit"
  | "call"
  | "email"
  | "rfi_response"
  | "draft_review"
  | "internal_meeting"
  | "industry_day"
  | "teaming_discussion"
  | "solution_session";

export type ActivityStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export type GateType =
  | "pursuit"
  | "bid_no_bid"
  | "capture_ready"
  | "proposal_ready"
  | "pink_team"
  | "red_team"
  | "gold_team"
  | "final_review";

export type GateDecisionType = "pass" | "conditional_pass" | "fail" | "defer";

export type GateStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type ColorScore = "green" | "yellow" | "red";

export type MilestoneStatus = "pending" | "completed" | "missed" | "cancelled";

export type MilestoneType =
  | "rfp_release"
  | "questions_due"
  | "answers_released"
  | "proposal_due"
  | "orals"
  | "award_expected"
  | "contract_start"
  | "gate_review"
  | "custom";

// Form input types

export interface UpdatePipelineInput {
  currentStage?: PipelineStage;
  bidDecision?: BidDecision;
  bidDecisionRationale?: string;
  pwinCurrent?: number;
  pwinTarget?: number;
  customerRelationshipScore?: number;
  incumbentStatus?: IncumbentStatus;
  solutionReadiness?: SolutionReadiness;
  teamingStatus?: TeamingStatus;
  captureInvestment?: number;
  proposalInvestment?: number;
  budgetedInvestment?: number;
  anticipatedRfpDate?: Date;
  proposalDueDate?: Date;
  questionsDeadline?: Date;
  anticipatedAwardDate?: Date;
  captureManager?: string;
  proposalManager?: string;
  priority?: PipelinePriority;
  healthStatus?: HealthStatus;
  notes?: string;
}

export interface CreateActivityInput {
  activityType: ActivityType;
  title: string;
  description?: string;
  scheduledDate?: Date;
  durationMinutes?: number;
  participants?: Array<{
    name: string;
    role: string;
    organization?: string;
    isCustomer?: boolean;
  }>;
}

export interface UpdateGateReviewInput {
  scheduledDate?: Date;
  reviewers?: Array<{ name: string; role: string }>;
  checklistItems?: Array<{
    item: string;
    required: boolean;
    completed: boolean;
    notes?: string;
  }>;
  presentationUrl?: string;
}

export interface CreateMilestoneInput {
  name: string;
  description?: string;
  milestoneType?: MilestoneType;
  targetDate?: Date;
  owner?: string;
  dependsOn?: string[];
}

// Component prop types

export interface PipelineKanbanProps {
  pipelines: CapturePipeline[];
  onStageChange?: (pipelineId: string, newStage: PipelineStage) => void;
  onCardClick?: (pipeline: CapturePipeline) => void;
}

export interface PipelineDetailProps {
  pipelineId: string;
  opportunityId?: string;
}

export interface ActivityTimelineProps {
  activities: CaptureActivity[];
  onAddActivity?: () => void;
  onActivityClick?: (activity: CaptureActivity) => void;
}

export interface GateReviewPanelProps {
  gateReview: GateReview;
  onConduct?: (decision: GateDecision) => void;
  editable?: boolean;
}

export interface PwinTrackerProps {
  pipelineId: string;
  currentPwin: number;
  history?: Array<{ date: string; value: number; reason: string }>;
  onUpdate?: (newPwin: number, reason: string) => void;
}

export interface MilestoneTimelineProps {
  milestones: PipelineMilestone[];
  onMilestoneClick?: (milestone: PipelineMilestone) => void;
  onComplete?: (milestoneId: string) => void;
}

export interface BidDecisionWizardProps {
  pipelineId: string;
  onDecision?: (decision: BidDecision) => void;
}

export interface PipelineAnalyticsDashboardProps {
  organizationId?: string;
  timeRange?: "30d" | "90d" | "1y" | "all";
}

// Stage configuration
export interface StageConfig {
  name: string;
  label: string;
  color: string;
  icon: string;
  requiredGates: GateType[];
  typicalDuration: number; // days
}

export const STAGE_CONFIG: Record<PipelineStage, StageConfig> = {
  discovery: {
    name: "discovery",
    label: "Discovery",
    color: "gray",
    icon: "search",
    requiredGates: [],
    typicalDuration: 30,
  },
  qualification: {
    name: "qualification",
    label: "Qualification",
    color: "blue",
    icon: "filter",
    requiredGates: ["pursuit"],
    typicalDuration: 14,
  },
  capture: {
    name: "capture",
    label: "Capture",
    color: "indigo",
    icon: "target",
    requiredGates: ["bid_no_bid"],
    typicalDuration: 60,
  },
  proposal: {
    name: "proposal",
    label: "Proposal",
    color: "purple",
    icon: "file-text",
    requiredGates: ["proposal_ready", "pink_team", "red_team"],
    typicalDuration: 30,
  },
  submitted: {
    name: "submitted",
    label: "Submitted",
    color: "cyan",
    icon: "send",
    requiredGates: ["gold_team", "final_review"],
    typicalDuration: 0,
  },
  evaluation: {
    name: "evaluation",
    label: "Evaluation",
    color: "yellow",
    icon: "clock",
    requiredGates: [],
    typicalDuration: 60,
  },
  awarded: {
    name: "awarded",
    label: "Awarded",
    color: "green",
    icon: "trophy",
    requiredGates: [],
    typicalDuration: 0,
  },
  lost: {
    name: "lost",
    label: "Lost",
    color: "red",
    icon: "x-circle",
    requiredGates: [],
    typicalDuration: 0,
  },
  no_bid: {
    name: "no_bid",
    label: "No Bid",
    color: "slate",
    icon: "minus-circle",
    requiredGates: [],
    typicalDuration: 0,
  },
  cancelled: {
    name: "cancelled",
    label: "Cancelled",
    color: "slate",
    icon: "ban",
    requiredGates: [],
    typicalDuration: 0,
  },
};
