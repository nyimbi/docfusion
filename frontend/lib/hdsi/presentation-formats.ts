"use client";

/**
 * Professional Presentation Formats
 * 
 * World-class presentation templates for:
 * - McKinsey & Company (structured problem-solving)
 * - BCG (Boston Consulting Group) (insights-driven)
 * - Bain & Company (results-focused)
 * - Military Briefings (decision-focused)
 * 
 * Each format enforces its specific storyline framework, design system,
 * and content quality standards.
 */

import type { Slide, PresentationTheme, StorylineFramework, ChartConfig } from "./presentations";
import type { HDSINode } from "./types";

// ============================================================================
// Format Types
// ============================================================================

export type ConsultingFirm = "mckinsey" | "bcg" | "bain" | "deloitte" | "pwc" | "ey" | "kpmg";
export type MilitaryFormatType = "decision" | "information" | "conops" | "staft" | "ops_order";
export type AcademicFormat = "thesis" | "dissertation" | "conference" | "poster";
export type CorporateFormat = "board" | "investor" | "all_hands" | "kickoff" | "review";

export type PresentationFormat = 
  | { type: "consulting"; firm: ConsultingFirm; variant?: string }
  | { type: "military"; format: MilitaryFormatType; classification?: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" }
  | { type: "academic"; format: AcademicFormat; style?: string }
  | { type: "corporate"; format: CorporateFormat; level?: string }
  | { type: "custom"; name: string };

// ============================================================================
// Consulting Firm Formats
// ============================================================================

export interface ConsultingFormat {
  firm: ConsultingFirm;
  name: string;
  theme: PresentationTheme;
  
  // Storyline framework
  framework: {
    name: string;
    description: string;
    structure: {
      type: "opening" | "body" | "close";
      label: string;
      expectedSlides: number;
      required?: boolean;
    }[];
  };
  
  // Content rules
  rules: {
    maxBulletsPerSlide: number;
    maxWordsPerBullet: number;
    maxSlideTitleLength: number;
    requiresActionTitle: boolean;
    requiresSoWhat: boolean;
    requiresNextSteps: boolean;
  };
  
  // Visual standards
  visual: {
    maxChartsPerSlide: number;
    preferredChartTypes: string[];
    requiresSourceCitations: boolean;
    logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none";
    pageNumbers: boolean;
  };
}

export const BCG_FORMAT: ConsultingFormat = {
  firm: "bcg",
  name: "BCG Standard",
  theme: {
    name: "BCG",
    colors: {
      primary: "#003B5C",
      secondary: "#005587",
      accent: "#00A3E0",
      background: "#FFFFFF",
      text: "#1A1A1A",
      textLight: "#6B6B6B",
      positive: "#00843D",
      negative: "#C8102E",
      warning: "#FF8200",
    },
    fonts: {
      title: "Arial, sans-serif",
      body: "Arial, sans-serif",
    },
  },
  framework: {
    name: "Insights-Driven Storyline",
    description: 'Start with the "So What" - lead with insights, not data',
    structure: [
      { type: "opening", label: "Executive Summary: The Big Picture", expectedSlides: 1, required: true },
      { type: "opening", label: "Key Insights", expectedSlides: 1, required: true },
      { type: "body", label: "Detail & Analysis", expectedSlides: 8, required: true },
      { type: "close", label: "Recommendation & Next Steps", expectedSlides: 2, required: true },
    ],
  },
  rules: {
    maxBulletsPerSlide: 3,  // BCG prefers fewer, punchier points
    maxWordsPerBullet: 12,
    maxSlideTitleLength: 8,
    requiresActionTitle: true,
    requiresSoWhat: true,
    requiresNextSteps: true,
  },
  visual: {
    maxChartsPerSlide: 1,
    preferredChartTypes: ["waterfall", "marimekko", "bubble", "bar"],
    requiresSourceCitations: true,
    logoPosition: "bottom-right",
    pageNumbers: true,
  },
};

export const MCKINSEY_FORMAT: ConsultingFormat = {
  firm: "mckinsey",
  name: "McKinsey Classic",
  theme: {
    name: "McKinsey",
    colors: {
      primary: "#051C2C",
      secondary: "#2251FF",
      accent: "#00A9E0",
      background: "#FFFFFF",
      text: "#212121",
      textLight: "#6F6F6F",
      positive: "#0A8543",
      negative: "#CE1136",
      warning: "#F47B20",
    },
    fonts: {
      title: "Helvetica Neue, Arial, sans-serif",
      body: "Helvetica Neue, Arial, sans-serif",
    },
  },
  framework: {
    name: "Pyramid Principle / SCR",
    description: "MECE structure: Situation → Complication → Resolution",
    structure: [
      { type: "opening", label: "Executive Summary: Governing Thought", expectedSlides: 1, required: true },
      { type: "opening", label: "Situation: Current State", expectedSlides: 1, required: true },
      { type: "opening", label: "Complication: The Challenge", expectedSlides: 1, required: true },
      { type: "opening", label: "Resolution: Our Answer", expectedSlides: 1, required: true },
      { type: "body", label: "Supporting Logic", expectedSlides: 8, required: true },
      { type: "close", label: "Next Steps", expectedSlides: 1, required: true },
    ],
  },
  rules: {
    maxBulletsPerSlide: 5,
    maxWordsPerBullet: 15,
    maxSlideTitleLength: 10,
    requiresActionTitle: true,
    requiresSoWhat: false,
    requiresNextSteps: true,
  },
  visual: {
    maxChartsPerSlide: 1,
    preferredChartTypes: ["waterfall", "stacked-bar", "mekko", "line"],
    requiresSourceCitations: true,
    logoPosition: "none",
    pageNumbers: true,
  },
};

export const BAIN_FORMAT: ConsultingFormat = {
  firm: "bain",
  name: "Bain Results Delivery",
  theme: {
    name: "Bain",
    colors: {
      primary: "#CC0000",
      secondary: "#990000",
      accent: "#FF4400",
      background: "#FFFFFF",
      text: "#333333",
      textLight: "#666666",
      positive: "#009900",
      negative: "#CC0000",
      warning: "#FF6600",
    },
    fonts: {
      title: "Georgia, serif",
      body: "Arial, sans-serif",
    },
  },
  framework: {
    name: "Results Delivery",
    description: "Focus on outcomes and measurable results",
    structure: [
      { type: "opening", label: "Promise: What We'll Deliver", expectedSlides: 1, required: true },
      { type: "opening", label: "Current Reality", expectedSlides: 1, required: true },
      { type: "body", label: "The Approach", expectedSlides: 6, required: true },
      { type: "body", label: "Results & Impact", expectedSlides: 3, required: true },
      { type: "close", label: "90-Day Plan", expectedSlides: 1, required: true },
    ],
  },
  rules: {
    maxBulletsPerSlide: 4,
    maxWordsPerBullet: 10,
    maxSlideTitleLength: 8,
    requiresActionTitle: true,
    requiresSoWhat: true,
    requiresNextSteps: true,
  },
  visual: {
    maxChartsPerSlide: 2,
    preferredChartTypes: ["bar", "column", "line", "pie"],
    requiresSourceCitations: true,
    logoPosition: "bottom-right",
    pageNumbers: true,
  },
};

export const DELOITTE_FORMAT: ConsultingFormat = {
  firm: "deloitte",
  name: "Deloitte Green Dot",
  theme: {
    name: "Deloitte",
    colors: {
      primary: "#000000",
      secondary: "#86BC25",  // Green dot
      accent: "#00A3E0",
      background: "#FFFFFF",
      text: "#333333",
      textLight: "#666666",
      positive: "#86BC25",
      negative: "#E71D2B",
      warning: "#FF8200",
    },
    fonts: {
      title: "Open Sans, sans-serif",
      body: "Open Sans, sans-serif",
    },
  },
  framework: {
    name: "Impact-Driven",
    description: "Digital-first, outcome-focused presentations",
    structure: [
      { type: "opening", label: "The Opportunity", expectedSlides: 1, required: true },
      { type: "body", label: "Our Point of View", expectedSlides: 2, required: true },
      { type: "body", label: "Proof Points", expectedSlides: 6, required: true },
      { type: "close", label: "Path Forward", expectedSlides: 2, required: true },
    ],
  },
  rules: {
    maxBulletsPerSlide: 4,
    maxWordsPerBullet: 12,
    maxSlideTitleLength: 10,
    requiresActionTitle: true,
    requiresSoWhat: true,
    requiresNextSteps: true,
  },
  visual: {
    maxChartsPerSlide: 1,
    preferredChartTypes: ["column", "line", "radar", "heatmap"],
    requiresSourceCitations: true,
    logoPosition: "bottom-left",
    pageNumbers: true,
  },
};

// ============================================================================
// Military Briefing Formats
// ============================================================================

export interface MilitaryFormatConfig {
  format: MilitaryFormatType;
  name: string;
  classification: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET";
  classificationColor: string;
  
  theme: PresentationTheme;
  
  // Required elements
  requiredElements: {
    classificationBanner: boolean;
    unitLogo: boolean;
    dateTimeGroup: boolean;
    conceptOfOperations?: boolean;
    commandersIntent?: boolean;
    tasksToSubordinates?: boolean;
  };
  
  // Standard structure per format type
  structure: {
    phase: string;
    label: string;
    requiredSections: string[];
    timeAllocation: number;  // minutes
  }[];
  
  rules: {
    maxSlides: number;
    maxBriefingTime: number;  // minutes
    requiresDecision?: boolean;
    requiresBackupSlides: boolean;
  };
}

export const MILITARY_DECISION_BRIEF: MilitaryFormatConfig = {
  format: "decision",
  name: "Decision Briefing (Standard 5-Paragraph Format)",
  classification: "UNCLASSIFIED",
  classificationColor: "#000000",
  
  theme: {
    name: "Military Standard",
    colors: {
      primary: "#000000",
      secondary: "#8B0000",  // Dark red
      accent: "#C41E3A",     // Cardnal
      background: "#FFFFFF",
      text: "#000000",
      textLight: "#4A4A4A",
      positive: "#006400",   // Dark green
      negative: "#8B0000",
      warning: "#FF8C00",
    },
    fonts: {
      title: "Arial, sans-serif",
      body: "Arial, sans-serif",
    },
  },
  
  requiredElements: {
    classificationBanner: true,
    unitLogo: true,
    dateTimeGroup: true,
    conceptOfOperations: true,
    commandersIntent: true,
    tasksToSubordinates: true,
  },
  
  structure: [
    { phase: "opening", label: "Classification Banner + Situation", requiredSections: ["SITUATION"], timeAllocation: 2 },
    { phase: "opening", label: "Mission Statement", requiredSections: ["MISSION"], timeAllocation: 1 },
    { phase: "body", label: "Execution (Concept of Ops)", requiredSections: ["EXECUTION", "CONCEPT OF OPERATIONS"], timeAllocation: 5 },
    { phase: "body", label: "Service & Support", requiredSections: ["SERVICE SUPPORT", "LOGISTICS"], timeAllocation: 2 },
    { phase: "body", label: "Command & Signal", requiredSections: ["COMMAND SIGNAL", "COMMUNICATIONS"], timeAllocation: 2 },
    { phase: "close", label: "Decision Point", requiredSections: ["DECISION REQUIRED"], timeAllocation: 3 },
  ],
  
  rules: {
    maxSlides: 12,
    maxBriefingTime: 15,
    requiresDecision: true,
    requiresBackupSlides: true,
  },
};

export const MILITARY_INFORMATION_BRIEF: MilitaryFormatConfig = {
  format: "information",
  name: "Information Briefing (INFO BRIEF)",
  classification: "UNCLASSIFIED",
  classificationColor: "#000000",
  
  theme: {
    name: "Military Info Brief",
    colors: {
      primary: "#000000",
      secondary: "#003366",
      accent: "#0066CC",
      background: "#FFFFFF",
      text: "#000000",
      textLight: "#4A4A4A",
      positive: "#006400",
      negative: "#8B0000",
      warning: "#FF6600",
    },
    fonts: {
      title: "Arial, sans-serif",
      body: "Arial, sans-serif",
    },
  },
  
  requiredElements: {
    classificationBanner: true,
    unitLogo: true,
    dateTimeGroup: true,
    conceptOfOperations: false,
    commandersIntent: false,
    tasksToSubordinates: false,
  },
  
  structure: [
    { phase: "opening", label: "Classification + Purpose", requiredSections: ["PURPOSE"], timeAllocation: 1 },
    { phase: "body", label: "Current Status", requiredSections: ["CURRENT STATUS", "FACTS"], timeAllocation: 5 },
    { phase: "body", label: "Key Issues / Observations", requiredSections: ["KEY ISSUES"], timeAllocation: 3 },
    { phase: "close", label: "Recommendations / Way Ahead", requiredSections: ["WAY AHEAD"], timeAllocation: 3 },
  ],
  
  rules: {
    maxSlides: 10,
    maxBriefingTime: 12,
    requiresDecision: false,
    requiresBackupSlides: false,
  },
};

export const MILITARY_CONOPS: MilitaryFormatConfig = {
  format: "conops",
  name: "Concept of Operations (CONOPS)",
  classification: "CONFIDENTIAL",
  classificationColor: "#8B0000",  // Red for CONFIDENTIAL
  
  theme: {
    name: "CONOPS",
    colors: {
      primary: "#8B0000",    // Red banner for CONFIDENTIAL
      secondary: "#000000",
      accent: "#C41E3A",
      background: "#F5F5F5",
      text: "#000000",
      textLight: "#4A4A4A",
      positive: "#006400",
      negative: "#8B0000",
      warning: "#FF6600",
    },
    fonts: {
      title: "Arial, sans-serif",
      body: "Arial, sans-serif",
    },
  },
  
  requiredElements: {
    classificationBanner: true,
    unitLogo: true,
    dateTimeGroup: true,
    conceptOfOperations: true,
    commandersIntent: true,
    tasksToSubordinates: false,
  },
  
  structure: [
    { phase: "opening", label: "Strategic Context", requiredSections: ["STRATEGIC CONTEXT"], timeAllocation: 3 },
    { phase: "opening", label: "The Problem", requiredSections: ["PROBLEM STATEMENT"], timeAllocation: 2 },
    { phase: "body", label: "Commander's Intent", requiredSections: ["COMMANDERS INTENT"], timeAllocation: 3 },
    { phase: "body", label: "Concept of Operations", requiredSections: ["CONCEPT OF OPERATIONS", "PHASES"], timeAllocation: 8 },
    { phase: "body", label: "Resources Required", requiredSections: ["RESOURCES"], timeAllocation: 3 },
    { phase: "close", label: "Risk Assessment", requiredSections: ["RISKS"], timeAllocation: 3 },
    { phase: "close", label: "Authority / Approval", requiredSections: ["AUTHORITY"], timeAllocation: 2 },
  ],
  
  rules: {
    maxSlides: 20,
    maxBriefingTime: 25,
    requiresDecision: true,
    requiresBackupSlides: true,
  },
};

export const MILITARY_STAFT: MilitaryFormatConfig = {
  format: "staft",
  name: "STAFT Estimate Brief",
  classification: "SECRET",
  classificationColor: "#FF0000",  // Bright red for SECRET
  
  theme: {
    name: "STAFT",
    colors: {
      primary: "#FF0000",    // Red for SECRET
      secondary: "#8B0000",
      accent: "#C41E3A",
      background: "#F5F5F5",
      text: "#000000",
      textLight: "#4A4A4A",
      positive: "#006400",
      negative: "#8B0000",
      warning: "#FF6600",
    },
    fonts: {
      title: "Arial, sans-serif",
      body: "Arial, sans-serif",
    },
  },
  
  requiredElements: {
    classificationBanner: true,
    unitLogo: true,
    dateTimeGroup: true,
    conceptOfOperations: true,
    commandersIntent: true,
    tasksToSubordinates: true,
  },
  
  structure: [
    { phase: "opening", label: "Mission Analysis", requiredSections: ["MISSION ANALYSIS"], timeAllocation: 3 },
    { phase: "body", label: "Situation (METT-TC)", requiredSections: ["MISSION", "ENEMY", "TERRAIN", "TROOPS", "TIME", "CIVIL"], timeAllocation: 8 },
    { phase: "body", label: "Course of Action Development", requiredSections: ["COA DEVELOPMENT", "COAs"], timeAllocation: 6 },
    { phase: "body", label: "Analysis & Comparison", requiredSections: ["COA ANALYSIS", "WARGAMING"], timeAllocation: 5 },
    { phase: "close", label: "Recommendation", requiredSections: ["RECOMMENDATION", "DECISION"], timeAllocation: 3 },
  ],
  
  rules: {
    maxSlides: 25,
    maxBriefingTime: 30,
    requiresDecision: true,
    requiresBackupSlides: true,
  },
};

// ============================================================================
// Format Validation
// ============================================================================

export interface FormatValidationResult {
  isValid: boolean;
  score: number;  // 0-100
  firm?: ConsultingFirm;
  format?: MilitaryFormatType;
  issues: {
    severity: "error" | "warning" | "info";
    type: string;
    message: string;
    slideIndex?: number;
    suggestion: string;
  }[];
  compliance: {
    requiredSectionsPresent: string[];
    requiredSectionsMissing: string[];
    timingEstimate: number;
    slideCount: number;
  };
}

export function validateConsultingFormat(
  slides: Slide[],
  format: ConsultingFormat
): FormatValidationResult {
  const issues: FormatValidationResult["issues"] = [];
  let score = 100;
  
  // Check slide count
  const expectedTotal = format.framework.structure.reduce((sum, s) => sum + s.expectedSlides, 0);
  if (slides.length < expectedTotal * 0.7) {
    issues.push({
      severity: "warning",
      type: "slide_count",
      message: `Only ${slides.length} slides - expected ~${expectedTotal} for ${format.name}`,
      suggestion: `Add ${expectedTotal - slides.length} more slides to fully develop the storyline`,
    });
    score -= 10;
  }
  
  // Check each slide against rules
  slides.forEach((slide, idx) => {
    if (slide.bullets && slide.bullets.length > format.rules.maxBulletsPerSlide) {
      issues.push({
        severity: "error",
        type: "bullet_overload",
        message: `Slide ${idx + 1} has ${slide.bullets.length} bullets`,
        slideIndex: idx,
        suggestion: `Reduce to ${format.rules.maxBulletsPerSlide} bullets (firm standard)`,
      });
      score -= 15;
    }
    
    if (format.rules.requiresActionTitle && !isActionTitle(slide.actionTitle)) {
      issues.push({
        severity: "warning",
        type: "passive_title",
        message: `Slide ${idx + 1} title may be passive`,
        slideIndex: idx,
        suggestion: "Start with action verb: 'We must...' 'To achieve...'",
      });
      score -= 10;
    }
    
    // Check bullet length
    slide.bullets?.forEach((bullet, bIdx) => {
      const words = bullet.split(" ").length;
      if (words > format.rules.maxWordsPerBullet) {
        issues.push({
          severity: "warning",
          type: "long_bullet",
          message: `Bullet ${bIdx + 1} on slide ${idx + 1} is ${words} words`,
          slideIndex: idx,
          suggestion: `Shorten to ${format.rules.maxWordsPerBullet} words max`,
        });
        score -= 5;
      }
    });
  });
  
  return {
    isValid: score >= 70,
    score: Math.max(0, score),
    firm: format.firm,
    issues,
    compliance: {
      requiredSectionsPresent: [],
      requiredSectionsMissing: [],
      timingEstimate: Math.ceil(slides.length * 1.5),  // ~90 sec per slide
      slideCount: slides.length,
    },
  };
}

export function validateMilitaryFormat(
  slides: Slide[],
  format: MilitaryFormatConfig
): FormatValidationResult {
  const issues: FormatValidationResult["issues"] = [];
  const sectionsPresent = new Set<string>();
  const requiredSectionsMissing: string[] = [];
  
  // Extract sections from slide titles/bullets
  slides.forEach((slide, idx) => {
    const text = (slide.actionTitle + " " + slide.bullets?.join(" ")).toUpperCase();
    
    format.structure.forEach(phase => {
      phase.requiredSections.forEach(section => {
        if (text.includes(section)) {
          sectionsPresent.add(section);
        }
      });
    });
  });
  
  // Check required sections
  const allRequired = format.structure.flatMap(s => s.requiredSections);
  allRequired.forEach(section => {
    if (!sectionsPresent.has(section)) {
      requiredSectionsMissing.push(section);
      issues.push({
        severity: "error",
        type: "missing_section",
        message: `Missing required section: ${section}`,
        suggestion: `Add a slide covering ${section}`,
      });
    }
  });
  
  // Check slide count
  if (slides.length > format.rules.maxSlides) {
    issues.push({
      severity: "warning",
      type: "slide_count",
      message: `${slides.length} slides exceeds ${format.rules.maxSlides} limit`,
      suggestion: "Move detail slides to backup or consolidate",
    });
  }
  
  const score = Math.max(0, 100 - (requiredSectionsMissing.length * 10) - (slides.length > format.rules.maxSlides ? 10 : 0));
  
  return {
    isValid: requiredSectionsMissing.length === 0 && slides.length <= format.rules.maxSlides,
    score,
    format: format.format,
    issues,
    compliance: {
      requiredSectionsPresent: Array.from(sectionsPresent),
      requiredSectionsMissing,
      timingEstimate: format.rules.maxBriefingTime,
      slideCount: slides.length,
    },
  };
}

export function isActionTitle(title: string): boolean {
  const actionPatterns = [
    /^We (must|should|need to|will|can|recommend)/i,
    /^To /i,
    /^\d+%/i,
    /(increase|decrease|reduce|improve|implement|consolidate|expand|optimize|achieve|deliver)/i,
  ];
  return actionPatterns.some(p => p.test(title));
}

// ============================================================================
// Format-Aware Storyline Generators
// ============================================================================

export function generateBCGStoryline(nodes: HDSINode[]): Slide[] {
  return [
    {
      id: `slide-${Date.now()}-1`,
      order: 0,
      type: "executive-summary",
      actionTitle: "We have identified 3 key insights that will drive $50M in value",
      bullets: ["Insight 1: Market consolidation opportunity", "Insight 2: Cost reduction potential", "Insight 3: Revenue enhancement levers"],
      layout: "title-content",
    },
    {
      id: `slide-${Date.now()}-2`,
      order: 1,
      type: "supporting-point",
      actionTitle: "The market is consolidating - we must act now to capture share",
      bullets: ["Top 3 players now control 60% vs 40% five years ago", "M&A activity up 3x in our sector", "First-mover advantage window: 12-18 months"],
      layout: "title-content",
    },
    // More BCG-style slides...
  ];
}

export function generateMilitaryDecisionBrief(content: Record<string, unknown>): Slide[] {
  return [
    {
      id: `slide-${Date.now()}-situation`,
      order: 0,
      type: "situation",
      actionTitle: "SITUATION: Enemy forces have advanced to Phase Line Blue",
      bullets: ["Enemy strength: Battalion-sized element (500-800 personnel)", "Current position: 5km east of OBJ ALPHA", "Friendly situation: Company A in defensive posture"],
      layout: "title-content",
    },
    {
      id: `slide-${Date.now()}-mission`,
      order: 1,
      type: "supporting-point",
      actionTitle: "MISSION: Task Force 1-77 attacks to seize OBJ ALPHA NLT 0600Z",
      bullets: ["Purpose: Restore the international border", "Method: Coordinated attack with air support", "End state: Secure OBJ ALPHA for follow-on forces"],
      layout: "title-content",
    },
    {
      id: `slide-${Date.now()}-execution`,
      order: 2,
      type: "supporting-point",
      actionTitle: "CONCEPT OF OPERATIONS: Three-phase attack with decisive point at Phase Line Green",
      bullets: ["Phase I: Isolation (H-hour to H+2)", "Phase II: Assault (H+2 to H+4)", "Phase III: Consolidation (H+4 to H+6)"],
      layout: "title-chart",
    },
    // More military format slides...
  ];
}

export const FORMAT_LIBRARY = {
  consulting: {
    bcg: BCG_FORMAT,
    mckinsey: MCKINSEY_FORMAT,
    bain: BAIN_FORMAT,
    deloitte: DELOITTE_FORMAT,
  },
  military: {
    decision: MILITARY_DECISION_BRIEF,
    information: MILITARY_INFORMATION_BRIEF,
    conops: MILITARY_CONOPS,
    staft: MILITARY_STAFT,
  },
};

export type FormatType = keyof typeof FORMAT_LIBRARY;
