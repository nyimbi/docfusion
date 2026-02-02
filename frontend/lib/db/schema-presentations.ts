import { pgTable, uuid, varchar, text, timestamp, real, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Oral presentations
export const oralPresentations = pgTable("oral_presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id"),
  organizationId: uuid("organization_id"),

  // Presentation info
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),

  // Requirements
  timeLimit: integer("time_limit"), // minutes
  qaTimeLimit: integer("qa_time_limit"), // minutes for Q&A
  formatRequirements: text("format_requirements"),
  audienceDescription: text("audience_description"),
  evaluationCriteria: jsonb("evaluation_criteria").$type<{
    criterion: string;
    weight: number;
    description: string;
  }[]>(),

  // Source document
  sourceProposalId: uuid("source_proposal_id"),

  // Presentation metadata
  slideCount: integer("slide_count").default(0),
  totalDuration: integer("total_duration"), // seconds

  // Theme and styling
  theme: varchar("theme", { length: 50 }).default("default"),
  customBranding: jsonb("custom_branding").$type<{
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    fontFamily?: string;
  }>(),

  // Status
  status: varchar("status", { length: 50 }).default("draft"), // draft, in_review, approved, delivered

  // Schedule
  presentationDate: timestamp("presentation_date", { withTimezone: true }),
  venue: varchar("venue", { length: 200 }),
  isVirtual: boolean("is_virtual").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 200 }),
});

// Presentation slides
export const presentationSlides = pgTable("presentation_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  // Slide info
  slideNumber: integer("slide_number").notNull(),
  slideType: varchar("slide_type", { length: 50 }), // title, content, image, chart, table, section_divider, qa
  title: varchar("title", { length: 200 }),

  // Content (flexible structure for different slide types)
  content: jsonb("content").$type<{
    type: "text" | "bullet" | "image" | "chart" | "table" | "video" | "code" | "quote";
    data: unknown;
    position?: { x: number; y: number; width: number; height: number };
  }[]>().default([]),

  // Layout
  layout: varchar("layout", { length: 50 }).default("default"),
  backgroundImage: text("background_image"),
  backgroundColor: varchar("background_color", { length: 20 }),

  // Speaker notes
  speakerNotes: text("speaker_notes"),
  speakerNotesHtml: text("speaker_notes_html"),
  estimatedDuration: integer("estimated_duration"), // seconds

  // Transitions
  transitionType: varchar("transition_type", { length: 50 }).default("none"),
  transitionDuration: integer("transition_duration"), // milliseconds

  // Source mapping
  sourceSectionIds: jsonb("source_section_ids").$type<string[]>().default([]),
  sourceRequirementIds: jsonb("source_requirement_ids").$type<string[]>().default([]),

  // Annotations
  annotations: jsonb("annotations").$type<{
    id: string;
    text: string;
    author: string;
    createdAt: string;
    resolved: boolean;
  }[]>().default([]),

  isHidden: boolean("is_hidden").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Q&A preparation
export const presentationQA = pgTable("presentation_qa", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  // Question
  likelyQuestion: text("likely_question").notNull(),
  questionCategory: varchar("question_category", { length: 100 }), // technical, management, cost, past_performance, clarification
  difficulty: varchar("difficulty", { length: 20 }), // easy, medium, hard
  probability: real("probability"), // 0-1

  // Source of question (where it might come from)
  questionSource: varchar("question_source", { length: 100 }), // proposal_weakness, requirement_gap, competitor_strength, evaluator_pattern
  relatedSlideIds: jsonb("related_slide_ids").$type<string[]>().default([]),

  // Answer
  suggestedAnswer: text("suggested_answer"),
  answerOutline: jsonb("answer_outline").$type<string[]>().default([]),
  keyPoints: jsonb("key_points").$type<string[]>().default([]),
  supportingEvidence: jsonb("supporting_evidence").$type<{
    evidence: string;
    source: string;
    slideId?: string;
  }[]>().default([]),

  // Warnings
  thingsToAvoid: jsonb("things_to_avoid").$type<string[]>().default([]),

  // Status
  isReviewed: boolean("is_reviewed").default(false),
  reviewedBy: varchar("reviewed_by", { length: 200 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Practice recordings
export const practiceRecordings = pgTable("practice_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  // Recording info
  recordingUrl: text("recording_url"),
  recordingType: varchar("recording_type", { length: 50 }), // full, section, qa_practice
  duration: integer("duration"), // seconds

  // Analysis results
  pacingAnalysis: jsonb("pacing_analysis").$type<{
    averageWPM: number;
    variationScore: number;
    tooFastSegments: { startTime: number; endTime: number }[];
    tooSlowSegments: { startTime: number; endTime: number }[];
    pauseScore: number;
  }>(),

  contentCoverage: jsonb("content_coverage").$type<{
    slideId: string;
    slideNumber: number;
    covered: boolean;
    duration: number;
    targetDuration: number;
    coverageScore: number;
  }[]>(),

  fillerWordAnalysis: jsonb("filler_word_analysis").$type<{
    word: string;
    count: number;
    timestamps: number[];
  }[]>(),

  overallScore: real("overall_score"),

  // Feedback
  aiFeedback: text("ai_feedback"),
  recommendations: jsonb("recommendations").$type<string[]>().default([]),

  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  recordedBy: varchar("recorded_by", { length: 200 }),
});

// Presentation team assignments
export const presentationTeam = pgTable("presentation_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  presentationId: uuid("presentation_id"),

  // Team member
  userId: uuid("user_id"),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 100 }), // presenter, backup, qa_responder, technical_support

  // Assigned slides/topics
  assignedSlideIds: jsonb("assigned_slide_ids").$type<string[]>().default([]),
  assignedTopics: jsonb("assigned_topics").$type<string[]>().default([]),

  // Speaking time
  estimatedSpeakingTime: integer("estimated_speaking_time"), // seconds

  // Status
  hasConfirmed: boolean("has_confirmed").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const oralPresentationsRelations = relations(oralPresentations, ({ many }) => ({
  slides: many(presentationSlides),
  qaItems: many(presentationQA),
  recordings: many(practiceRecordings),
  team: many(presentationTeam),
}));

export const presentationSlidesRelations = relations(presentationSlides, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [presentationSlides.presentationId],
    references: [oralPresentations.id],
  }),
}));

export const presentationQARelations = relations(presentationQA, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [presentationQA.presentationId],
    references: [oralPresentations.id],
  }),
}));

export const practiceRecordingsRelations = relations(practiceRecordings, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [practiceRecordings.presentationId],
    references: [oralPresentations.id],
  }),
}));

export const presentationTeamRelations = relations(presentationTeam, ({ one }) => ({
  presentation: one(oralPresentations, {
    fields: [presentationTeam.presentationId],
    references: [oralPresentations.id],
  }),
}));

// Type exports
export type OralPresentation = typeof oralPresentations.$inferSelect;
export type NewOralPresentation = typeof oralPresentations.$inferInsert;
export type PresentationSlide = typeof presentationSlides.$inferSelect;
export type NewPresentationSlide = typeof presentationSlides.$inferInsert;
export type PresentationQA = typeof presentationQA.$inferSelect;
export type NewPresentationQA = typeof presentationQA.$inferInsert;
export type PracticeRecording = typeof practiceRecordings.$inferSelect;
export type NewPracticeRecording = typeof practiceRecordings.$inferInsert;
export type PresentationTeamMember = typeof presentationTeam.$inferSelect;
export type NewPresentationTeamMember = typeof presentationTeam.$inferInsert;
