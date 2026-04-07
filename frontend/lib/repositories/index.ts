/**
 * Repository Layer - DocFusion
 *
 * Barrel export for all domain repositories. Each repository encapsulates
 * Drizzle ORM queries for its domain, providing a testable data access
 * abstraction that action files can adopt incrementally.
 *
 * Usage:
 *   import { opportunityRepo } from "@/lib/repositories";
 *   const stats = await opportunityRepo.getStats(filters);
 *
 * For testing, instantiate a repository class directly and override the
 * protected `db` getter to inject a stub:
 *   class TestOpportunityRepo extends OpportunityRepository {
 *     protected get db() { return mockDb; }
 *   }
 */

// Base class and shared types
export { BaseRepository } from "./base-repository";
export type { FindManyOptions, PaginatedResult } from "./base-repository";

// Domain repositories
export { OpportunityRepository } from "./opportunity-repository";
export { EvidenceRepository } from "./evidence-repository";
export { CompetitiveRepository } from "./competitive-repository";
export { TemplateRepository } from "./template-repository";
export { PricingRepository } from "./pricing-repository";

// Re-export domain filter types
export type { EvidenceFilters } from "./evidence-repository";
export type { CompetitorFilters, DiscriminatorFilters } from "./competitive-repository";
export type { TemplateFilters, TemplateStats } from "./template-repository";
export type { CostElementFilters } from "./pricing-repository";

// ────────────────────────────────────────────────────────────────────────────
// Singleton instances for convenience (most callers need exactly one instance)
// ────────────────────────────────────────────────────────────────────────────

import { OpportunityRepository } from "./opportunity-repository";
import { EvidenceRepository } from "./evidence-repository";
import { CompetitiveRepository } from "./competitive-repository";
import { TemplateRepository } from "./template-repository";
import { PricingRepository } from "./pricing-repository";

export const opportunityRepo = new OpportunityRepository();
export const evidenceRepo = new EvidenceRepository();
export const competitiveRepo = new CompetitiveRepository();
export const templateRepo = new TemplateRepository();
export const pricingRepo = new PricingRepository();
