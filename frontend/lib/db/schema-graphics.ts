// lib/db/schema-graphics.ts
import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { opportunities } from "./schema";

// Proposal graphics table
export const proposalGraphics = pgTable("proposal_graphics", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  documentId: uuid("document_id"),
  sectionId: uuid("section_id"),

  // Graphic identification
  title: varchar("title", { length: 500 }).notNull(),
  figureNumber: varchar("figure_number", { length: 50 }),

  // Type and format
  graphicType: varchar("graphic_type", { length: 100 }).notNull(), // org_chart, process_flow, schedule, infographic, diagram, chart
  format: varchar("format", { length: 50 }), // svg, png, mermaid, d2

  // Content
  sourceData: jsonb("source_data"),
  diagramCode: text("diagram_code"), // Mermaid/D2 code if applicable
  imageUrl: text("image_url"),

  // Caption
  caption: text("caption"),
  actionCaption: text("action_caption"), // Caption starting with action verb

  // Dimensions
  width: integer("width"),
  height: integer("height"),

  // Generation
  generatedBy: varchar("generated_by", { length: 50 }), // ai, manual, template
  generationPrompt: text("generation_prompt"),

  // Approval
  status: varchar("status", { length: 50 }).default("draft"),
  approvedBy: varchar("approved_by", { length: 200 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Graphic templates - reusable templates for common graphic types
export const graphicTemplates = pgTable("graphic_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  graphicType: varchar("graphic_type", { length: 100 }).notNull(),
  format: varchar("format", { length: 50 }).notNull(),

  // Template content
  templateCode: text("template_code").notNull(), // Mermaid/D2 template with placeholders
  placeholders: jsonb("placeholders").$type<{
    key: string;
    label: string;
    type: "text" | "list" | "number" | "date";
    required: boolean;
    defaultValue?: string;
  }[]>(),

  // Preview
  previewImageUrl: text("preview_image_url"),

  // Usage tracking
  useCount: integer("use_count").default(0),
  isPublic: boolean("is_public").default(false),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Graphic references - tracks where graphics are used in documents
export const graphicReferences = pgTable("graphic_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphicId: uuid("graphic_id").references(() => proposalGraphics.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull(),
  sectionId: uuid("section_id"),

  // Reference location
  pageNumber: integer("page_number"),
  referenceText: text("reference_text"), // "See Figure 1-3" etc.

  // Validation
  isValid: boolean("is_valid").default(true),
  validationNotes: text("validation_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Graphic feedback - stores AI suggestions and user feedback
export const graphicFeedback = pgTable("graphic_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphicId: uuid("graphic_id").references(() => proposalGraphics.id, { onDelete: "cascade" }),

  feedbackType: varchar("feedback_type", { length: 50 }).notNull(), // suggestion, critique, approval
  content: text("content").notNull(),

  // If AI suggestion
  aiGenerated: boolean("ai_generated").default(false),
  confidence: real("confidence"),

  // Resolution
  status: varchar("status", { length: 50 }).default("pending"), // pending, accepted, rejected
  resolvedBy: varchar("resolved_by", { length: 200 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Graphic style guide - organization-specific styling
export const graphicStyleGuides = pgTable("graphic_style_guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  name: varchar("name", { length: 200 }).notNull(),
  isDefault: boolean("is_default").default(false),

  // Color palette
  primaryColor: varchar("primary_color", { length: 20 }),
  secondaryColor: varchar("secondary_color", { length: 20 }),
  accentColor: varchar("accent_color", { length: 20 }),
  textColor: varchar("text_color", { length: 20 }),
  backgroundColor: varchar("background_color", { length: 20 }),
  colorPalette: jsonb("color_palette").$type<string[]>(),

  // Typography
  fontFamily: varchar("font_family", { length: 100 }),
  titleFontSize: integer("title_font_size"),
  labelFontSize: integer("label_font_size"),

  // Styling rules
  borderRadius: integer("border_radius"),
  lineWidth: integer("line_width"),
  arrowStyle: varchar("arrow_style", { length: 50 }),

  // Mermaid/D2 theme overrides
  mermaidTheme: text("mermaid_theme"),
  d2Theme: text("d2_theme"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const proposalGraphicsRelations = relations(proposalGraphics, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [proposalGraphics.opportunityId],
    references: [opportunities.id],
  }),
  references: many(graphicReferences),
  feedback: many(graphicFeedback),
}));

export const graphicReferencesRelations = relations(graphicReferences, ({ one }) => ({
  graphic: one(proposalGraphics, {
    fields: [graphicReferences.graphicId],
    references: [proposalGraphics.id],
  }),
}));

export const graphicFeedbackRelations = relations(graphicFeedback, ({ one }) => ({
  graphic: one(proposalGraphics, {
    fields: [graphicFeedback.graphicId],
    references: [proposalGraphics.id],
  }),
}));

// Type exports
export type ProposalGraphic = typeof proposalGraphics.$inferSelect;
export type NewProposalGraphic = typeof proposalGraphics.$inferInsert;
export type GraphicTemplate = typeof graphicTemplates.$inferSelect;
export type NewGraphicTemplate = typeof graphicTemplates.$inferInsert;
export type GraphicReference = typeof graphicReferences.$inferSelect;
export type GraphicFeedback = typeof graphicFeedback.$inferSelect;
export type GraphicStyleGuide = typeof graphicStyleGuides.$inferSelect;
