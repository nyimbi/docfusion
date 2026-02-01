/**
 * Personnel Module Exports
 *
 * Comprehensive personnel management system including:
 * - Personnel database with filtering and search
 * - Resume parsing and generation
 * - Skills taxonomy management
 * - Position matching and gap analysis
 * - Certification tracking
 * - Staffing matrix visualization
 */

// Core Components
export { PersonnelCard } from "./PersonnelCard";
export { PersonnelDatabase } from "./PersonnelDatabase";
export { PersonnelEditor } from "./PersonnelEditor";

// Resume Management
export { ResumeParser } from "./ResumeParser";
export { ResumeGenerator } from "./ResumeGenerator";

// Skills & Matching
export { SkillsManager } from "./SkillsManager";
export { PositionMatcher } from "./PositionMatcher";

// Tracking & Visualization
export { CertificationTracker } from "./CertificationTracker";
export { StaffingMatrix } from "./StaffingMatrix";

// Re-export types
export type { Personnel, NewPersonnel } from "@/lib/db/schema-personnel";
export type { SkillTaxonomy, NewSkillTaxonomy } from "@/lib/db/schema-personnel";
export type { PersonnelExperience, NewPersonnelExperience } from "@/lib/db/schema-personnel";
export type { PositionRequirement, NewPositionRequirement } from "@/lib/db/schema-personnel";
export type { PersonnelAvailability } from "@/lib/db/schema-personnel";
export type { ResumeTemplate } from "@/lib/db/schema-personnel";
