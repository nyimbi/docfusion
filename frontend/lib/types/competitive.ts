// lib/types/competitive.ts
// Type exports for Competitive Intelligence & Discriminator Engine

// Import schema types for local use
import type {
  Competitor as _Competitor,
  NewCompetitor as _NewCompetitor,
  Discriminator as _Discriminator,
  NewDiscriminator as _NewDiscriminator,
  GhostTheme as _GhostTheme,
  NewGhostTheme as _NewGhostTheme,
  CompetitorOpportunity as _CompetitorOpportunity,
  CompetitiveAnalysis as _CompetitiveAnalysis,
} from "@/lib/db/schema-competitors";

// Re-export schema types
export type Competitor = _Competitor;
export type NewCompetitor = _NewCompetitor;
export type Discriminator = _Discriminator;
export type NewDiscriminator = _NewDiscriminator;
export type GhostTheme = _GhostTheme;
export type NewGhostTheme = _NewGhostTheme;
export type CompetitorOpportunity = _CompetitorOpportunity;
export type CompetitiveAnalysis = _CompetitiveAnalysis;

// Import action types for local use
import type {
  CompetitorMatch as _CompetitorMatch,
  SWOTAnalysis as _SWOTAnalysis,
  DiscriminatorSuggestion as _DiscriminatorSuggestion,
  CompetitiveMatrix as _CompetitiveMatrix,
  TeamingSuggestion as _TeamingSuggestion,
  WinLossAnalysis as _WinLossAnalysis,
  CompetitorFilters as _CompetitorFilters,
  DiscriminatorFilters as _DiscriminatorFilters,
} from "@/lib/actions/competitive";

// Re-export action types
export type CompetitorMatch = _CompetitorMatch;
export type SWOTAnalysis = _SWOTAnalysis;
export type DiscriminatorSuggestion = _DiscriminatorSuggestion;
export type CompetitiveMatrix = _CompetitiveMatrix;
export type TeamingSuggestion = _TeamingSuggestion;
export type WinLossAnalysis = _WinLossAnalysis;
export type CompetitorFilters = _CompetitorFilters;
export type DiscriminatorFilters = _DiscriminatorFilters;

// UI-specific types

export type CompetitorType = "prime" | "sub" | "both";

export type SizeStandard = "small" | "large" | "8a" | "hubzone" | "sdvosb" | "wosb";

export type PricingTendency = "aggressive" | "moderate" | "premium";

export type IntelligenceQuality = "verified" | "estimated" | "outdated";

export type DiscriminatorType =
  | "capability"
  | "experience"
  | "approach"
  | "team"
  | "cost"
  | "schedule"
  | "innovation"
  | "past_performance";

export type GhostCategory =
  | "technical"
  | "management"
  | "past_performance"
  | "cost"
  | "schedule"
  | "risk";

export type CompetitorRole = "prime" | "sub" | "incumbent";

export type BidLikelihood = "certain" | "likely" | "possible" | "unlikely";

export type CompetitorOutcome = "won" | "lost" | "no_bid";

export type CompetitivePosition = "leader" | "challenger" | "follower" | "niche";

export type PricingStrategy = "low_price" | "best_value" | "premium";

// Form input types

export interface CreateCompetitorInput {
  name: string;
  legalName?: string;
  website?: string;
  description?: string;
  competitorType?: CompetitorType;
  sizeStandard?: SizeStandard;
  capabilities?: Array<{
    area: string;
    strength: "strong" | "moderate" | "weak";
    notes?: string;
  }>;
  certifications?: string[];
  contractVehicles?: string[];
  naicsCodes?: string[];
  strengths?: string[];
  weaknesses?: string[];
  pricingTendency?: PricingTendency;
}

export interface CreateDiscriminatorInput {
  statement: string;
  shortVersion?: string;
  proofPoints?: string[];
  discriminatorType?: DiscriminatorType;
  category?: string;
  supportingEvidence?: Array<{
    type: "contract" | "metric" | "testimonial" | "case_study";
    description: string;
    reference?: string;
  }>;
  effectiveAgainst?: string[];
  applicableOpportunityTypes?: string[];
  applicableNaicsCodes?: string[];
}

export interface CreateGhostThemeInput {
  competitorId: string;
  weakness: string;
  ghostLanguage: string;
  suggestedPlacement?: string;
  category?: GhostCategory;
  isEthical?: boolean;
  complianceNotes?: string;
}

export interface AddCompetitorToOpportunityInput {
  competitorId: string;
  opportunityId: string;
  likelihoodToBid?: BidLikelihood;
  role?: CompetitorRole;
  teamingPartners?: string[];
  intelligenceSource?: string;
  notes?: string;
}

// Component prop types

export interface CompetitorCardProps {
  competitor: Competitor;
  onEdit?: (competitor: Competitor) => void;
  onDelete?: (id: string) => void;
  onViewDetails?: (competitor: Competitor) => void;
  showWinLoss?: boolean;
}

export interface CompetitorFormProps {
  competitor?: Competitor;
  onSubmit?: (data: CreateCompetitorInput) => void;
  onCancel?: () => void;
}

export interface DiscriminatorListProps {
  discriminators: Discriminator[];
  onSelect?: (discriminator: Discriminator) => void;
  onEdit?: (discriminator: Discriminator) => void;
  onDelete?: (id: string) => void;
  showEffectiveness?: boolean;
}

export interface GhostThemeGeneratorProps {
  competitorId: string;
  onGenerated?: (ghostTheme: GhostTheme) => void;
}

export interface SWOTDisplayProps {
  analysis: SWOTAnalysis;
  showInsights?: boolean;
  editable?: boolean;
  onUpdate?: (analysis: Partial<SWOTAnalysis>) => void;
}

export interface CompetitiveMatrixProps {
  matrix: CompetitiveMatrix;
  highlightAdvantages?: boolean;
}

export interface CompetitorSelectorProps {
  opportunityId: string;
  selectedIds?: string[];
  onSelect?: (competitors: Competitor[]) => void;
  showSuggestions?: boolean;
}

// Capability assessment
export interface CapabilityScore {
  area: string;
  ourScore: number;
  competitorScores: Array<{
    competitorId: string;
    score: number;
  }>;
}

// Battle card for quick competitive reference
export interface BattleCard {
  competitorId: string;
  competitorName: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  recommendedDiscriminators: string[];
  ghostThemes: string[];
  winStrategy: string;
}
