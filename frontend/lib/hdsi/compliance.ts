"use client";

/**
 * Citation & Compliance Tracker
 * FAR/DFARS clause detection, requirement traceability, gap analysis
 */

import { useState, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type RegulationType = "FAR" | "DFARS" | "FAR_NF" | "AI" | "GDPR" | "HIPAA" | "SOX" | "custom";

export interface RegulationClause {
  id: string;
  regulation: RegulationType;
  number: string;
  title: string;
  fullText?: string;
  applicability: "all" | "small_business" | "large_business" | "commercial" | "non_commercial";
  mandatory: boolean;
  flowDown: boolean;
  keywords: string[];
}

export interface ComplianceRequirement {
  clause: RegulationClause;
  citedInDocument: boolean;
  satisfiedBy: string[]; // Node IDs
  status: "missing" | "partial" | "complete" | "exempt";
  gapDescription?: string;
}

export interface Citation {
  id: string;
  text: string;
  clauseId?: string;
  url?: string;
  page?: number;
  paragraph?: string;
}

export interface TraceabilityMatrix {
  requirements: ComplianceRequirement[];
  traceability: Map<string, string[]>; // Requirement ID -> Node IDs
  coverage: number; // 0-1 percentage
  gaps: ComplianceRequirement[];
}

export interface ComplianceReport {
  documentId: string;
  regulation: RegulationType;
  analyzedAt: Date;
  matrix: TraceabilityMatrix;
  score: number; // 0-100 compliance score
  criticalGaps: number;
  recommendations: string[];
}

// ============================================================================
// FAR/DFARS Clause Database
// ============================================================================

export const FAR_CLAUSES: RegulationClause[] = [
  {
    id: "FAR-52.204-21",
    regulation: "FAR",
    number: "52.204-21",
    title: "Basic Safeguarding of Covered Contractor Information Systems",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["cybersecurity", "safeguarding", "information systems", "covered"],
  },
  {
    id: "FAR-52.219-9",
    regulation: "FAR",
    number: "52.219-9",
    title: "Small Business Subcontracting Plan",
    applicability: "large_business",
    mandatory: true,
    flowDown: true,
    keywords: ["small business", "subcontracting", "plan", "goals"],
  },
  {
    id: "FAR-52.222-26",
    regulation: "FAR",
    number: "52.222-26",
    title: "Equal Opportunity",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["equal opportunity", "EEO", "affirmative action"],
  },
  {
    id: "FAR-52.222-35",
    regulation: "FAR",
    number: "52.222-35",
    title: "Equal Opportunity for Veterans",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["veterans", "disabled", "VEVRAA", "protected"],
  },
  {
    id: "FAR-52.222-36",
    regulation: "FAR",
    number: "52.222-36",
    title: "Affirmative Action for Workers with Disabilities",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["disabilities", "affirmative action", "504"],
  },
  {
    id: "FAR-52.222-50",
    regulation: "FAR",
    number: "52.222-50",
    title: "Combating Trafficking in Persons",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["trafficking", "forced labor", "modern slavery"],
  },
  {
    id: "FAR-52.223-6",
    regulation: "FAR",
    number: "52.223-6",
    title: "Drug-Free Workplace",
    applicability: "all",
    mandatory: true,
    flowDown: false,
    keywords: ["drug-free", "workplace", "substance abuse"],
  },
  {
    id: "FAR-52.225-13",
    regulation: "FAR",
    number: "52.225-13",
    title: "Restrictions on Certain Foreign Purchases",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["country", "boycott", "foreign"],
  },
];

export const DFARS_CLAUSES: RegulationClause[] = [
  {
    id: "DFARS-252.204-7012",
    regulation: "DFARS",
    number: "252.204-7012",
    title: "Safeguarding Covered Defense Information and Cyber Incident Reporting",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: [ "cybersecurity", "DFARS", "covered defense information", "CDI", "cyber incident", ],
  },
  {
    id: "DFARS-252.204-7019",
    regulation: "DFARS",
    number: "252.204-7019",
    title: "Notice of NIST SP 800-171 DoD Assessment Requirements",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["NIST 800-171", "assessment", "cybersecurity", "CMMC"],
  },
  {
    id: "DFARS-252.204-7020",
    regulation: "DFARS",
    number: "252.204-7020",
    title: "NIST SP 800-171 DoD Assessment Requirements",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["NIST 800-171", "assessment", "cybersecurity", "compliance"],
  },
  {
    id: "DFARS-252.225-7007",
    regulation: "DFARS",
    number: "252.225-7007",
    title: "Prohibition on Acquisition of Certain Items from Communist Chinese Military Companies",
    applicability: "all",
    mandatory: true,
    flowDown: true,
    keywords: ["China", "military company", "prohibition", "Uyghur"],
  },
  {
    id: "DFARS-252.239-7010",
    regulation: "DFARS",
    number: "252.239-7010",
    title: "Cloud Computing Services",
    applicability: "commercial",
    mandatory: false,
    flowDown: false,
    keywords: ["cloud", "computing", "FedRAMP"],
  },
];

export const ALL_CLAUSES = [...FAR_CLAUSES, ...DFARS_CLAUSES];

// ============================================================================
// Clause Detection
// ============================================================================

export function detectClauses(text: string, regulation?: RegulationType): RegulationClause[] {
  const normalized = text.toLowerCase();
  const applicableClauses = regulation
    ? ALL_CLAUSES.filter(c => c.regulation === regulation)
    : ALL_CLAUSES;
  
  const detected: RegulationClause[] = [];
  
  for (const clause of applicableClauses) {
    // Check for explicit clause number
    const numberPattern = new RegExp(clause.number.replace(/\./g, "\\."), "i");
    
    // Check for keywords
    const keywordMatches = clause.keywords.some(kw => normalized.includes(kw.toLowerCase()));
    
    if (numberPattern.test(text) || keywordMatches) {
      detected.push(clause);
    }
  }
  
  return detected;
}

export interface ParagraphAnalysis {
  paragraphId: string;
  text: string;
  detectedClauses: RegulationClause[];
  citations: Citation[];
}

export function analyzeParagraphs(
  paragraphs: string[],
  regulation?: RegulationType
): ParagraphAnalysis[] {
  return paragraphs.map((text, index) => ({
    paragraphId: `para-${index}`,
    text,
    detectedClauses: detectClauses(text, regulation),
    citations: extractCitations(text),
  }));
}

function extractCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Match FAR/DFARS clause references
  const clausePattern = /\b(FAR|DFARS)\s+(?:Clause\s+)?((?:52|252)\.\d{3}-?\d{0,4})\b/gi;
  let match;
  
  while ((match = clausePattern.exec(text)) !== null) {
    citations.push({
      id: `cite-${match[1]}-${match[2]}`,
      text: `${match[1]} ${match[2]}`,
      clauseId: `${match[1]}-${match[2]}`,
    });
  }
  
  // Match URLs
  const urlPattern = /https?:\/\/[^\s]+/g;
  while ((match = urlPattern.exec(text)) !== null) {
    citations.push({
      id: `cite-url-${match.index}`,
      text: match[0],
      url: match[0],
    });
  }
  
  return citations;
}

// ============================================================================
// Compliance Analysis
// ============================================================================

export function analyzeCompliance(
  documentId: string,
  paragraphs: string[],
  regulation: RegulationType = "FAR",
  applicableClauses?: RegulationClause[]
): ComplianceReport {
  const clauses = applicableClauses || 
    (regulation === "FAR" ? FAR_CLAUSES : 
     regulation === "DFARS" ? DFARS_CLAUSES : 
     ALL_CLAUSES);
  
  const paragraphAnalysis = analyzeParagraphs(paragraphs, regulation);
  
  const requirements: ComplianceRequirement[] = clauses.map(clause => {
    // Find all paragraphs that cite or reference this clause
    const citingParagraphs = paragraphAnalysis.filter(p =>
      p.detectedClauses.some(c => c.id === clause.id)
    );
    
    const citedInDocument = citingParagraphs.length > 0;
    const satisfiedBy = citingParagraphs.map(p => p.paragraphId);
    
    let status: ComplianceRequirement["status"] = "missing";
    let gapDescription: string | undefined;
    
    if (citedInDocument) {
      if (satisfiedBy.length >= 2) {
        status = "complete";
      } else {
        status = "partial";
        gapDescription = "Limited coverage of requirements";
      }
    } else if (!clause.mandatory) {
      status = "exempt";
    } else {
      gapDescription = `Missing required clause ${clause.number}: ${clause.title}`;
    }
    
    return {
      clause,
      citedInDocument,
      satisfiedBy,
      status,
      gapDescription,
    };
  });
  
  const traceability = new Map<string, string[]>();
  for (const req of requirements) {
    traceability.set(req.clause.id, req.satisfiedBy);
  }
  
  const mandatoryCount = clauses.filter(c => c.mandatory).length;
  const satisfiedMandatoryCount = requirements.filter(
    r => r.clause.mandatory && (r.status === "complete" || r.status === "partial")
  ).length;
  
  const coverage = mandatoryCount > 0 ? satisfiedMandatoryCount / mandatoryCount : 0;
  const gaps = requirements.filter(r => r.status === "missing" && r.clause.mandatory);
  
  const score = Math.round(coverage * 100);
  
  const recommendations = generateRecommendations(requirements, score);
  
  return {
    documentId,
    regulation,
    analyzedAt: new Date(),
    matrix: {
      requirements,
      traceability,
      coverage,
      gaps,
    },
    score,
    criticalGaps: gaps.length,
    recommendations,
  };
}

function generateRecommendations(
  requirements: ComplianceRequirement[],
  score: number
): string[] {
  const recommendations: string[] = [];
  
  if (score < 50) {
    recommendations.push("Critical: Document lacks basic regulatory compliance. Review all mandatory clauses.");
  } else if (score < 80) {
    recommendations.push("Warning: Document has moderate compliance gaps. Address missing mandatory clauses.");
  }
  
  const missingFlowDown = requirements.filter(
    r => r.clause.flowDown && (r.status === "missing" || r.status === "partial")
  );
  
  if (missingFlowDown.length > 0) {
    recommendations.push(`Ensure ${missingFlowDown.length} flow-down clauses are addressed in subcontracting plans.`);
  }
  
  const cybersecurityGaps = requirements.filter(
    r => r.clause.keywords.includes("cybersecurity") && r.status === "missing"
  );
  
  if (cybersecurityGaps.length > 0) {
    recommendations.push("Critical: Cybersecurity compliance gaps detected. Address NIST 800-171/CMMC requirements.");
  }
  
  return recommendations;
}

// ============================================================================
// Requirement Traceability Matrix Export
// ============================================================================

export function exportTraceabilityMatrix(matrix: TraceabilityMatrix): string {
  const rows = matrix.requirements.map(req => ({
    "Clause Number": req.clause.number,
    "Clause Title": req.clause.title,
    "Mandatory": req.clause.mandatory ? "Yes" : "No",
    "Status": req.status,
    "Satisfied By": req.satisfiedBy.join("; ") || "N/A",
    "Gap Description": req.gapDescription || "",
  }));
  
  // Simple CSV export
  const headers = Object.keys(rows[0] || {});
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${(r as Record<string, string>)[h]}"`).join(",")),
  ].join("\n");
  
  return csv;
}

export function exportComplianceReport(report: ComplianceReport): string {
  const sections = [
    `# Compliance Report: ${report.regulation}`,
    ``,
    `Document ID: ${report.documentId}`,
    `Analyzed: ${report.analyzedAt.toISOString()}`,
    ``,
    `## Summary`,
    `- Compliance Score: ${report.score}/100`,
    `- Critical Gaps: ${report.criticalGaps}`,
    `- Coverage: ${(report.matrix.coverage * 100).toFixed(1)}%`,
    ``,
    `## Recommendations`,
    ...report.recommendations.map(r => `- ${r}`),
    ``,
    `## Detailed Requirements`,
    ...report.matrix.requirements.map(req => [
      `### ${req.clause.number}: ${req.clause.title}`,
      `- Status: ${req.status}`,
      `- Mandatory: ${req.clause.mandatory ? "Yes" : "No"}`,
      req.gapDescription ? `- Gap: ${req.gapDescription}` : "",
      `- Paragraphs: ${req.satisfiedBy.join(", ") || "None"}`,
      ``,
    ].join("\n")),
  ];
  
  return sections.join("\n");
}

// ============================================================================
// React Hooks
// ============================================================================

export function useComplianceAnalyzer(
  documentId: string,
  regulation: RegulationType = "FAR"
) {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback((paragraphs: string[]) => {
    setIsAnalyzing(true);
    try {
      const result = analyzeCompliance(documentId, paragraphs, regulation);
      setReport(result);
      return result;
    } finally {
      setIsAnalyzing(false);
    }
  }, [documentId, regulation]);

  const exportReport = useCallback((format: "csv" | "markdown" = "markdown") => {
    if (!report) return null;
    
    if (format === "csv") {
      return exportTraceabilityMatrix(report.matrix);
    }
    return exportComplianceReport(report);
  }, [report]);

  const getGapSummary = useMemo(() => {
    if (!report) return null;
    
    return {
      totalGaps: report.matrix.gaps.length,
      critical: report.matrix.gaps.filter(g => g.clause.mandatory).length,
      byCategory: report.matrix.gaps.reduce((acc, g) => {
        const cat = g.clause.regulation;
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [report]);

  return {
    report,
    isAnalyzing,
    analyze,
    exportReport,
    gapSummary: getGapSummary,
  };
}
