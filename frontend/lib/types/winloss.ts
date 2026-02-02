/**
 * Win/Loss Intelligence Platform Types
 */

// Re-export database types
import type {
  Debrief as _Debrief,
  WinLossPattern as _WinLossPattern,
  ProposalROI as _ProposalROI,
} from "@/lib/db/schema-winloss";

export type Debrief = _Debrief;
export type WinLossPattern = _WinLossPattern;
export type ProposalROI = _ProposalROI;

// Outcome types
export type DebriefOutcome = "win" | "loss" | "no_award" | "cancelled";
export type DebriefType = "written" | "oral" | "none";
export type ActionItemStatus = "pending" | "in_progress" | "completed";
export type PatternType = "strength" | "weakness" | "process" | "competitor" | "pricing" | "team";
export type Priority = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";
export type Trend = "improving" | "declining" | "stable";

// Action item
export interface ActionItem {
  id: string;
  item: string;
  assignee: string;
  dueDate: string;
  status: ActionItemStatus;
  completedAt?: string;
}

// Score breakdown
export interface ScoreBreakdown {
  technical?: { score: number; maxScore: number; percentage: number };
  management?: { score: number; maxScore: number; percentage: number };
  pastPerformance?: { score: number; maxScore: number; percentage: number };
  cost?: { score: number; maxScore: number; percentage: number };
  overall?: number;
}

// Filters
export interface WinLossFilters {
  outcome?: DebriefOutcome | DebriefOutcome[];
  dateFrom?: Date;
  dateTo?: Date;
  agencyId?: string;
  competitorId?: string;
  minValue?: number;
  maxValue?: number;
  hasDebrief?: boolean;
}

// Statistics
export interface WinLossStats {
  totalProposals: number;
  wins: number;
  losses: number;
  noAward: number;
  cancelled: number;
  winRate: number;
  averageRanking: number | null;
  totalContractValue: number;
  totalInvestment: number;
  roi: number;
  byMonth: MonthlyStats[];
  byAgency: AgencyStats[];
  byCompetitor: CompetitorStats[];
  bySize: SizeStats[];
  scoreBreakdown: AverageScores;
}

export interface MonthlyStats {
  month: string;
  year: number;
  wins: number;
  losses: number;
  noAward: number;
  winRate: number;
  revenue: number;
}

export interface AgencyStats {
  agencyId: string;
  agencyName: string;
  proposals: number;
  wins: number;
  losses: number;
  winRate: number;
  totalValue: number;
}

export interface CompetitorStats {
  competitorId: string;
  competitorName: string;
  encounters: number;
  wins: number;
  losses: number;
  winRateAgainst: number;
}

export interface SizeStats {
  size: string; // small, medium, large
  proposals: number;
  wins: number;
  losses: number;
  winRate: number;
  averageValue: number;
}

export interface AverageScores {
  technicalAvg: number | null;
  managementAvg: number | null;
  pastPerfAvg: number | null;
  costAvg: number | null;
}

// Pattern analysis
export interface PatternAnalysis {
  patterns: WinLossPattern[];
  insights: PatternInsight[];
  recommendations: PatternRecommendation[];
  confidence: number;
  analyzedAt: Date;
}

export interface PatternInsight {
  id: string;
  insight: string;
  supportingData: string[];
  confidence: number;
  category: string;
}

export interface PatternRecommendation {
  recommendation: string;
  priority: Priority;
  effort: Effort;
  expectedImpact: string;
  relatedPatterns: string[];
}

// Lessons learned
export interface LessonsReport {
  lessonsLearned: LessonItem[];
  topStrengths: string[];
  topWeaknesses: string[];
  improvementAreas: string[];
  generatedAt: Date;
}

export interface LessonItem {
  lesson: string;
  frequency: number;
  relatedOutcome: "win" | "loss" | "both";
  category: string;
  examples: string[];
}

// ROI analysis
export interface ROIAnalysis {
  periodStart: Date;
  periodEnd: Date;
  overallROI: number;
  costPerWin: number;
  costPerLoss: number;
  averageContractValue: number;
  averageProposalCost: number;
  trend: Trend;
  projectedAnnualReturn: number;
  breakEvenWinRate: number;
  recommendations: string[];
  byQuarter: QuarterlyROI[];
}

export interface QuarterlyROI {
  quarter: string;
  year: number;
  proposals: number;
  wins: number;
  investment: number;
  revenue: number;
  roi: number;
}

// Improvement areas
export interface ImprovementArea {
  id: string;
  area: string;
  description: string;
  impact: Priority;
  effort: Effort;
  evidence: string[];
  suggestedActions: string[];
  relatedPatterns: string[];
  estimatedROIImpact: number;
}

// Competitor comparison
export interface CompetitorComparison {
  competitorId: string;
  competitorName: string;
  totalEncounters: number;
  ourWins: number;
  theirWins: number;
  noAwardCases: number;
  winRateAgainst: number;
  strengthsVsThem: string[];
  weaknessesVsThem: string[];
  recommendations: string[];
  recentTrend: Trend;
  averageRankDelta: number | null;
  priceCompetitiveness: "lower" | "similar" | "higher" | "unknown";
}

// Dashboard metrics
export interface DashboardMetrics {
  currentWinRate: number;
  winRateChange: number; // vs previous period
  activeProposals: number;
  pendingDebriefs: number;
  recentWins: number;
  recentLosses: number;
  pipelineValue: number;
  topStrength: string;
  topWeakness: string;
  upcomingActionItems: ActionItem[];
}

// Timeline event
export interface TimelineEvent {
  id: string;
  type: "proposal_submitted" | "award_announced" | "debrief_requested" | "debrief_received" | "analysis_completed" | "action_item";
  date: Date;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Debrief form data
export interface DebriefFormData {
  outcome: DebriefOutcome;
  debriefDate?: Date;
  debriefType?: DebriefType;
  scores: {
    technical?: number;
    technicalMax?: number;
    management?: number;
    managementMax?: number;
    pastPerf?: number;
    pastPerfMax?: number;
    cost?: number;
    costMax?: number;
  };
  ranking?: number;
  totalBidders?: number;
  winner?: {
    name?: string;
    id?: string;
    price?: number;
  };
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
  investment?: number;
  contractValue?: number;
}

// Config for win/loss categories
export const OUTCOME_CONFIG: Record<DebriefOutcome, { label: string; color: string; icon: string }> = {
  win: { label: "Won", color: "green", icon: "trophy" },
  loss: { label: "Lost", color: "red", icon: "x-circle" },
  no_award: { label: "No Award", color: "yellow", icon: "minus-circle" },
  cancelled: { label: "Cancelled", color: "gray", icon: "ban" },
};

export const PATTERN_TYPE_CONFIG: Record<PatternType, { label: string; color: string }> = {
  strength: { label: "Strength", color: "green" },
  weakness: { label: "Weakness", color: "red" },
  process: { label: "Process", color: "blue" },
  competitor: { label: "Competitor", color: "purple" },
  pricing: { label: "Pricing", color: "amber" },
  team: { label: "Team", color: "cyan" },
};
