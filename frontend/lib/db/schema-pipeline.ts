// lib/db/schema-pipeline.ts
import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { opportunities } from "./schema";

// Pipeline stages enum-like values
export const PIPELINE_STAGES = [
  "discovery",
  "qualification",
  "capture",
  "proposal",
  "submitted",
  "evaluation",
  "awarded",
  "lost",
  "no_bid",
  "cancelled",
] as const;

// Capture Pipeline - main pipeline tracking for opportunities
export const capturePipeline = pgTable("capture_pipeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: varchar("organization_id", { length: 100 }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }).unique(),

  // Stage tracking
  currentStage: varchar("current_stage", { length: 100 }).notNull().default("discovery"),
  stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).defaultNow(),
  stageHistory: jsonb("stage_history").$type<{
    stage: string;
    enteredAt: string;
    exitedAt?: string;
    daysInStage?: number;
  }[]>(),

  // Bid decision
  bidDecision: varchar("bid_decision", { length: 50 }), // bid, no_bid, pending
  bidDecisionDate: timestamp("bid_decision_date", { withTimezone: true }),
  bidDecisionRationale: text("bid_decision_rationale"),
  bidDecisionMadeBy: varchar("bid_decision_made_by", { length: 200 }),

  // Pwin (Probability of Win) tracking
  pwinCurrent: real("pwin_current"),
  pwinTarget: real("pwin_target"),
  pwinHistory: jsonb("pwin_history").$type<{
    date: string;
    value: number;
    reason: string;
    updatedBy?: string;
  }[]>(),

  // Customer relationship
  customerRelationshipScore: integer("customer_relationship_score"), // 1-10
  incumbentStatus: varchar("incumbent_status", { length: 50 }), // incumbent, challenger, new_market
  customerEngagements: integer("customer_engagements").default(0),
  lastCustomerContact: timestamp("last_customer_contact", { withTimezone: true }),

  // Solution readiness
  solutionReadiness: varchar("solution_readiness", { length: 50 }), // not_started, in_progress, ready
  technicalApproachStatus: varchar("technical_approach_status", { length: 50 }),
  teamingStatus: varchar("teaming_status", { length: 50 }), // none_needed, in_progress, complete

  // Investment tracking
  captureInvestment: real("capture_investment").default(0),
  proposalInvestment: real("proposal_investment").default(0),
  totalInvestment: real("total_investment").default(0),
  budgetedInvestment: real("budgeted_investment"),

  // Key dates
  anticipatedRfpDate: timestamp("anticipated_rfp_date", { withTimezone: true }),
  actualRfpDate: timestamp("actual_rfp_date", { withTimezone: true }),
  proposalDueDate: timestamp("proposal_due_date", { withTimezone: true }),
  questionsDeadline: timestamp("questions_deadline", { withTimezone: true }),
  anticipatedAwardDate: timestamp("anticipated_award_date", { withTimezone: true }),
  actualAwardDate: timestamp("actual_award_date", { withTimezone: true }),

  // Capture manager
  captureManager: varchar("capture_manager", { length: 200 }),
  proposalManager: varchar("proposal_manager", { length: 200 }),

  // Priority and health
  priority: varchar("priority", { length: 50 }).default("medium"), // high, medium, low
  healthStatus: varchar("health_status", { length: 50 }).default("on_track"), // on_track, at_risk, critical

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Capture Activities - activities performed during capture
export const captureActivities = pgTable("capture_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Activity info
  activityType: varchar("activity_type", { length: 100 }).notNull(), // customer_meeting, site_visit, call, email, rfi_response, draft_review, internal_meeting
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  status: varchar("status", { length: 50 }).default("scheduled"), // scheduled, completed, cancelled, rescheduled

  // Outcome
  outcome: text("outcome"),
  successRating: integer("success_rating"), // 1-5
  nextSteps: jsonb("next_steps").$type<string[]>(),

  // Customer intelligence gathered
  intelligenceGathered: text("intelligence_gathered"),
  competitorIntelligence: text("competitor_intelligence"),

  // Participants
  participants: jsonb("participants").$type<{
    name: string;
    role: string;
    organization?: string;
    isCustomer?: boolean;
  }[]>(),

  // Attachments/artifacts
  attachments: jsonb("attachments").$type<{
    name: string;
    url: string;
    type: string;
  }[]>(),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Gate Reviews - formal decision points
export const gateReviews = pgTable("gate_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: varchar("organization_id", { length: 100 }),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Gate info
  gateType: varchar("gate_type", { length: 100 }).notNull(), // pursuit, bid_no_bid, capture_ready, proposal_ready, color_review, final_review
  gateName: varchar("gate_name", { length: 200 }),
  gateNumber: integer("gate_number"),

  // Timing
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  conductedDate: timestamp("conducted_date", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("scheduled"), // scheduled, in_progress, completed, cancelled

  // Pre-review checklist
  checklistItems: jsonb("checklist_items").$type<{
    item: string;
    required: boolean;
    completed: boolean;
    notes?: string;
  }[]>(),
  checklistComplete: boolean("checklist_complete").default(false),

  // Decision
  decision: varchar("decision", { length: 50 }), // pass, conditional_pass, fail, defer
  conditions: jsonb("conditions").$type<{
    condition: string;
    dueDate?: string;
    assignee?: string;
    status: "pending" | "met" | "waived";
  }[]>(),
  rationale: text("rationale"),

  // Scoring (for color reviews)
  technicalScore: varchar("technical_score", { length: 50 }), // green, yellow, red
  managementScore: varchar("management_score", { length: 50 }),
  costScore: varchar("cost_score", { length: 50 }),
  overallScore: varchar("overall_score", { length: 50 }),

  // Participants
  reviewers: jsonb("reviewers").$type<{
    name: string;
    role: string;
    vote?: "approve" | "conditional" | "reject";
    comments?: string;
  }[]>(),
  chairperson: varchar("chairperson", { length: 200 }),

  // Documentation
  presentationUrl: text("presentation_url"),
  meetingMinutes: text("meeting_minutes"),
  actionItems: jsonb("action_items").$type<{
    item: string;
    assignee: string;
    dueDate: string;
    status: "pending" | "completed";
  }[]>(),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Pipeline Milestones - key milestones in the capture process
export const pipelineMilestones = pgTable("pipeline_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineId: uuid("pipeline_id").references(() => capturePipeline.id, { onDelete: "cascade" }),

  // Milestone info
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  milestoneType: varchar("milestone_type", { length: 100 }), // rfp_release, questions_due, proposal_due, award, etc.

  // Timing
  targetDate: timestamp("target_date", { withTimezone: true }),
  actualDate: timestamp("actual_date", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, completed, missed, cancelled

  // Dependencies
  dependsOn: jsonb("depends_on").$type<string[]>(), // Array of milestone IDs
  blockedBy: text("blocked_by"),

  // Ownership
  owner: varchar("owner", { length: 200 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const capturePipelineRelations = relations(capturePipeline, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [capturePipeline.opportunityId],
    references: [opportunities.id],
  }),
  activities: many(captureActivities),
  gateReviews: many(gateReviews),
  milestones: many(pipelineMilestones),
}));

export const captureActivitiesRelations = relations(captureActivities, ({ one }) => ({
  pipeline: one(capturePipeline, {
    fields: [captureActivities.pipelineId],
    references: [capturePipeline.id],
  }),
}));

export const gateReviewsRelations = relations(gateReviews, ({ one }) => ({
  pipeline: one(capturePipeline, {
    fields: [gateReviews.pipelineId],
    references: [capturePipeline.id],
  }),
}));

export const pipelineMilestonesRelations = relations(pipelineMilestones, ({ one }) => ({
  pipeline: one(capturePipeline, {
    fields: [pipelineMilestones.pipelineId],
    references: [capturePipeline.id],
  }),
}));

// Type exports
export type CapturePipeline = typeof capturePipeline.$inferSelect;
export type NewCapturePipeline = typeof capturePipeline.$inferInsert;
export type CaptureActivity = typeof captureActivities.$inferSelect;
export type NewCaptureActivity = typeof captureActivities.$inferInsert;
export type GateReview = typeof gateReviews.$inferSelect;
export type NewGateReview = typeof gateReviews.$inferInsert;
export type PipelineMilestone = typeof pipelineMilestones.$inferSelect;
export type NewPipelineMilestone = typeof pipelineMilestones.$inferInsert;
