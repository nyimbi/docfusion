import { pgTable, uuid, varchar, text, timestamp, real, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Debrief records for won/lost opportunities
export const debriefs = pgTable("debriefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id"),
  organizationId: uuid("organization_id"),

  // Outcome
  outcome: varchar("outcome", { length: 50 }).notNull(), // win, loss, no_award, cancelled

  // Debrief info
  debriefDate: timestamp("debrief_date", { withTimezone: true }),
  debriefType: varchar("debrief_type", { length: 50 }), // written, oral, none
  debriefRequestedAt: timestamp("debrief_requested_at", { withTimezone: true }),
  debriefReceivedAt: timestamp("debrief_received_at", { withTimezone: true }),

  // Scores (if available from debrief)
  technicalScore: real("technical_score"),
  technicalMaxScore: real("technical_max_score"),
  managementScore: real("management_score"),
  managementMaxScore: real("management_max_score"),
  pastPerfScore: real("past_perf_score"),
  pastPerfMaxScore: real("past_perf_max_score"),
  costScore: real("cost_score"),
  costMaxScore: real("cost_max_score"),
  overallRanking: integer("overall_ranking"),
  totalBidders: integer("total_bidders"),

  // Winner info (if loss)
  winnerName: varchar("winner_name", { length: 500 }),
  winnerId: uuid("winner_id"), // If competitor in our system
  winningPrice: real("winning_price"),

  // Feedback
  evaluatorFeedback: text("evaluator_feedback"),
  strengthsIdentified: jsonb("strengths_identified").$type<string[]>().default([]),
  weaknessesIdentified: jsonb("weaknesses_identified").$type<string[]>().default([]),

  // Internal analysis
  internalAnalysis: text("internal_analysis"),
  lessonsLearned: jsonb("lessons_learned").$type<string[]>().default([]),
  actionItems: jsonb("action_items").$type<{
    id: string;
    item: string;
    assignee: string;
    dueDate: string;
    status: "pending" | "in_progress" | "completed";
    completedAt?: string;
  }[]>().default([]),

  // ROI
  proposalInvestment: real("proposal_investment"),
  contractValue: real("contract_value"), // If won

  // Documents
  debriefDocument: text("debrief_document"), // URL or content

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 200 }),
});

// Win/Loss patterns identified through analysis
export const winLossPatterns = pgTable("win_loss_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // Pattern identification
  patternType: varchar("pattern_type", { length: 100 }).notNull(), // strength, weakness, process, competitor, pricing, team
  patternName: varchar("pattern_name", { length: 200 }).notNull(),
  description: text("description"),

  // Statistics
  occurrenceCount: integer("occurrence_count").default(0),
  winCorrelation: real("win_correlation"), // -1 to 1
  lossCorrelation: real("loss_correlation"), // -1 to 1
  confidence: real("confidence"), // 0 to 1

  // Associated data
  relatedDebriefs: jsonb("related_debriefs").$type<string[]>().default([]),
  relatedCompetitors: jsonb("related_competitors").$type<string[]>().default([]),
  relatedAgencies: jsonb("related_agencies").$type<string[]>().default([]),

  // Recommendations
  recommendations: jsonb("recommendations").$type<{
    recommendation: string;
    priority: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
  }[]>().default([]),

  // Status
  isActive: boolean("is_active").default(true),
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Proposal ROI tracking
export const proposalROI = pgTable("proposal_roi", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // Time period
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

  // Proposal metrics
  totalProposals: integer("total_proposals").default(0),
  totalWins: integer("total_wins").default(0),
  totalLosses: integer("total_losses").default(0),
  totalNoAward: integer("total_no_award").default(0),

  // Financial metrics
  totalInvestment: real("total_investment").default(0),
  totalContractValue: real("total_contract_value").default(0),
  totalPipeline: real("total_pipeline").default(0),

  // Calculated metrics (stored for quick retrieval)
  winRate: real("win_rate"),
  averageProposalCost: real("average_proposal_cost"),
  roi: real("roi"), // (contract_value - investment) / investment
  costPerWin: real("cost_per_win"),

  // Breakdown by category
  metricsByAgency: jsonb("metrics_by_agency").$type<Record<string, {
    proposals: number;
    wins: number;
    winRate: number;
    revenue: number;
  }>>(),
  metricsBySize: jsonb("metrics_by_size").$type<Record<string, {
    proposals: number;
    wins: number;
    winRate: number;
    revenue: number;
  }>>(),
  metricsByCompetitor: jsonb("metrics_by_competitor").$type<Record<string, {
    encounters: number;
    wins: number;
    losses: number;
  }>>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const debriefsRelations = relations(debriefs, ({ one }) => ({
  // Add relations if needed
}));

export const winLossPatternsRelations = relations(winLossPatterns, ({ one }) => ({
  // Add relations if needed
}));

// Type exports
export type Debrief = typeof debriefs.$inferSelect;
export type NewDebrief = typeof debriefs.$inferInsert;
export type WinLossPattern = typeof winLossPatterns.$inferSelect;
export type NewWinLossPattern = typeof winLossPatterns.$inferInsert;
export type ProposalROI = typeof proposalROI.$inferSelect;
export type NewProposalROI = typeof proposalROI.$inferInsert;
