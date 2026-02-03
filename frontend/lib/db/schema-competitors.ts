// lib/db/schema-competitors.ts
import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean, real, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { opportunities } from "./schema";

// Competitors table - comprehensive competitive intelligence for software companies
export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // ===== BASIC COMPANY INFO =====
  name: varchar("name", { length: 500 }).notNull(),
  legalName: varchar("legal_name", { length: 500 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 200 }),
  website: text("website"),
  description: text("description"),
  logoUrl: text("logo_url"),

  // ===== FOUNDING & AGE =====
  foundedYear: integer("founded_year"),
  companyAge: integer("company_age"), // Calculated from foundedYear

  // ===== CLASSIFICATION =====
  competitorType: varchar("competitor_type", { length: 100 }), // prime, sub, both, fintech, software_dev, etc.
  companyType: varchar("company_type", { length: 200 }), // More detailed: "Fintech/Mobile Money", "Software Development Agency"
  primaryBusiness: varchar("primary_business", { length: 500 }),
  specialization: text("specialization"),
  sizeStandard: varchar("size_standard", { length: 50 }), // small, large, 8a, hubzone, sdvosb, wosb

  // ===== CONTACT INFO =====
  linkedIn: text("linkedin"),
  email: varchar("email", { length: 500 }),
  phone: varchar("phone", { length: 100 }),
  physicalAddress: text("physical_address"),

  // ===== LEADERSHIP & TEAM =====
  ceoFounder: varchar("ceo_founder", { length: 300 }),
  ctoTechLead: varchar("cto_tech_lead", { length: 300 }),
  keyManagement: jsonb("key_management").$type<string[]>(), // List of key management names
  managementLinkedin: jsonb("management_linkedin").$type<string[]>(), // LinkedIn URLs for management
  teamSize: varchar("team_size", { length: 100 }), // "50-100", "200+", etc.
  engineerCount: varchar("engineer_count", { length: 100 }), // "20-50", "100+", etc.
  keyEngineers: jsonb("key_engineers").$type<string[]>(), // Notable engineers
  notableAlumni: jsonb("notable_alumni").$type<string[]>(), // Alumni who went to notable companies

  // ===== FINANCIALS =====
  annualRevenue: varchar("annual_revenue", { length: 200 }), // "$2.5B+", "$10-20M", etc.
  revenueRange: varchar("revenue_range", { length: 100 }), // "1M-5M", "10M-50M", etc.
  fundingRaised: varchar("funding_raised", { length: 200 }), // Total funding raised
  investors: jsonb("investors").$type<string[]>(), // List of investors

  // ===== PRODUCTS & TECHNOLOGY =====
  productsServices: text("products_services"), // Description of products/services
  technologyStack: jsonb("technology_stack").$type<string[]>(), // ["Node.js", "React", "AWS"]
  industriesServed: jsonb("industries_served").$type<string[]>(), // ["FinTech", "HealthTech", "AgriTech"]

  // ===== CLIENTS & CONTRACTS =====
  notableClients: jsonb("notable_clients").$type<string[]>(), // List of notable clients
  recentContracts: text("recent_contracts"), // Description of recent contracts
  contractValues: varchar("contract_values", { length: 200 }), // "$500K-5M typical"
  pursuingOpportunities: text("pursuing_opportunities"), // Known opportunities they're pursuing

  // ===== PARTNERSHIPS & CERTIFICATIONS =====
  partnerships: jsonb("partnerships").$type<string[]>(), // Strategic partnerships
  knownPartners: jsonb("known_partners").$type<string[]>(), // Teaming partners for proposals
  certifications: jsonb("certifications").$type<string[]>(), // ["ISO 27001", "ISO 9001", "Microsoft Gold Partner"]
  awards: jsonb("awards").$type<string[]>(), // Industry awards

  // ===== NEWS & MEDIA =====
  newsMentions: jsonb("news_mentions").$type<string[]>(), // News article references
  recentNews: text("recent_news"), // Summary of recent news
  socialMediaPresence: jsonb("social_media_presence").$type<{
    platform: string;
    url?: string;
    followers?: string;
  }[]>(),

  // ===== COMPETITIVE ANALYSIS =====
  competitivePositioning: text("competitive_positioning"), // "Market Leader", "Challenger", etc.
  marketShare: varchar("market_share", { length: 100 }), // "15%", "Dominant in Kenya", etc.
  growthTrajectory: varchar("growth_trajectory", { length: 200 }), // "High Growth", "Stable", "Declining"
  threatLevel: varchar("threat_level", { length: 50 }), // "HIGH", "MEDIUM", "LOW"
  strategicNotes: text("strategic_notes"), // Internal strategic analysis

  // ===== CAPABILITIES (legacy structure for compatibility) =====
  capabilities: jsonb("capabilities").$type<{
    area: string;
    strength: "strong" | "moderate" | "weak";
    notes?: string;
  }[]>(),
  contractVehicles: jsonb("contract_vehicles").$type<string[]>(),
  naicsCodes: jsonb("naics_codes").$type<string[]>(),

  // ===== STRENGTHS & WEAKNESSES =====
  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),

  // ===== PRICING INTELLIGENCE =====
  pricingTendency: varchar("pricing_tendency", { length: 100 }), // aggressive, moderate, premium
  averageWinPrice: real("average_win_price"),
  laborRateComparison: varchar("labor_rate_comparison", { length: 50 }), // below_market, market, above_market

  // ===== WIN/LOSS TRACKING =====
  winCount: integer("win_count").default(0),
  lossCount: integer("loss_count").default(0),
  winsAgainstUs: integer("wins_against_us").default(0),
  lossesToUs: integer("losses_to_us").default(0),

  // ===== INTELLIGENCE METADATA =====
  lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
  lastUpdated: date("last_updated"), // From competitive intelligence data
  researchNotes: text("research_notes"),
  intelligenceQuality: varchar("intelligence_quality", { length: 50 }), // verified, estimated, outdated
  dataSource: varchar("data_source", { length: 200 }), // "East Africa CI Database 2026", "Manual Entry", etc.
  externalId: varchar("external_id", { length: 100 }), // ID from external data source

  // ===== TIMESTAMPS =====
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Discriminators - statements that differentiate us from competitors
export const discriminators = pgTable("discriminators", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // Discriminator content
  statement: text("statement").notNull(),
  shortVersion: varchar("short_version", { length: 200 }),
  proofPoints: jsonb("proof_points").$type<string[]>(),

  // Classification
  discriminatorType: varchar("discriminator_type", { length: 100 }), // capability, experience, approach, team, cost, schedule, innovation, past_performance
  category: varchar("category", { length: 200 }),

  // Supporting evidence
  supportingEvidence: jsonb("supporting_evidence").$type<{
    type: "contract" | "metric" | "testimonial" | "case_study";
    description: string;
    reference?: string;
  }[]>(),

  // Competitor targeting - which competitors this is effective against
  effectiveAgainst: jsonb("effective_against").$type<string[]>(), // Competitor IDs

  // Opportunity types where this discriminator is most effective
  applicableOpportunityTypes: jsonb("applicable_opportunity_types").$type<string[]>(),
  applicableNaicsCodes: jsonb("applicable_naics_codes").$type<string[]>(),

  // Usage and effectiveness tracking
  useCount: integer("use_count").default(0),
  winCount: integer("win_count").default(0),
  effectivenessScore: real("effectiveness_score"),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Ghost themes - language to subtly highlight competitor weaknesses
export const ghostThemes = pgTable("ghost_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id").references(() => competitors.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id"),

  // Ghost theme content
  weakness: text("weakness").notNull(), // The competitor weakness being targeted
  ghostLanguage: text("ghost_language").notNull(), // Non-specific language highlighting the weakness
  suggestedPlacement: text("suggested_placement"), // Where in proposal to use

  // Classification
  category: varchar("category", { length: 100 }), // technical, management, past_performance, cost, schedule, risk

  // Compliance note - ensure language is ethical and compliant
  isEthical: boolean("is_ethical").default(true),
  complianceNotes: text("compliance_notes"),

  // Usage tracking
  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Competitor opportunity tracking - links competitors to specific opportunities
export const competitorOpportunities = pgTable("competitor_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id").references(() => competitors.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),

  // Assessment
  likelihoodToBid: varchar("likelihood_to_bid", { length: 50 }), // certain, likely, possible, unlikely
  role: varchar("role", { length: 50 }), // prime, sub, incumbent
  teamingPartners: jsonb("teaming_partners").$type<string[]>(),

  // Intelligence
  intelligenceSource: varchar("intelligence_source", { length: 200 }),
  notes: text("notes"),

  // Outcome (if known)
  outcome: varchar("outcome", { length: 50 }), // won, lost, no_bid
  outcomeNotes: text("outcome_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Competitive analysis - SWOT and positioning analysis for opportunities
export const competitiveAnalyses = pgTable("competitive_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),

  // SWOT Analysis
  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),
  opportunityFactors: jsonb("opportunity_factors").$type<string[]>(), // renamed to avoid conflict
  threats: jsonb("threats").$type<string[]>(),

  // Competitive positioning
  ourPosition: varchar("our_position", { length: 100 }), // leader, challenger, follower, niche
  primaryDifferentiators: jsonb("primary_differentiators").$type<string[]>(),
  competitiveGaps: jsonb("competitive_gaps").$type<string[]>(), // Areas where we're at disadvantage

  // Win strategy
  winStrategy: text("win_strategy"),
  pricingStrategy: varchar("pricing_strategy", { length: 100 }), // low_price, best_value, premium

  // AI-generated insights
  aiInsights: jsonb("ai_insights").$type<{
    insight: string;
    confidence: number;
    source: string;
  }[]>(),

  // Analysis metadata
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
  analyzedBy: varchar("analyzed_by", { length: 200 }),
  isOutdated: boolean("is_outdated").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const competitorsRelations = relations(competitors, ({ many }) => ({
  ghostThemes: many(ghostThemes),
  opportunities: many(competitorOpportunities),
}));

export const ghostThemesRelations = relations(ghostThemes, ({ one }) => ({
  competitor: one(competitors, {
    fields: [ghostThemes.competitorId],
    references: [competitors.id],
  }),
}));

export const competitorOpportunitiesRelations = relations(competitorOpportunities, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorOpportunities.competitorId],
    references: [competitors.id],
  }),
  opportunity: one(opportunities, {
    fields: [competitorOpportunities.opportunityId],
    references: [opportunities.id],
  }),
}));

export const competitiveAnalysesRelations = relations(competitiveAnalyses, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [competitiveAnalyses.opportunityId],
    references: [opportunities.id],
  }),
}));

// Type exports
export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type Discriminator = typeof discriminators.$inferSelect;
export type NewDiscriminator = typeof discriminators.$inferInsert;
export type GhostTheme = typeof ghostThemes.$inferSelect;
export type NewGhostTheme = typeof ghostThemes.$inferInsert;
export type CompetitorOpportunity = typeof competitorOpportunities.$inferSelect;
export type CompetitiveAnalysis = typeof competitiveAnalyses.$inferSelect;
