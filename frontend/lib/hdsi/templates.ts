"use client";

/**
 * Enhanced Template System for HDSI
 * 
 * Provides:
 * - Rich template definitions with metadata
 * - Category-based organization
 * - Quick-start templates for common document types
 * - Template preview and selection flow
 */

import type { HDSINode, DocumentStructure } from "./types";

// ============================================================================
// Template Types
// ============================================================================

export type TemplateCategory =
  | "government"      // FAR, DFARS, federal proposals
  | "commercial"      // Commercial proposals, SOWs
  | "technical"       // Technical specs, architecture docs
  | "compliance"      // Compliance documents, certifications
  | "grants"          // Research grants, NIH, NSF
  | "legal"           // Contracts, agreements
  | "general";        // Generic starting points

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  domain: "government-proposal" | "commercial-proposal" | "technical-spec" | "compliance-doc" | "generic";
  structure: TemplateNode[];

  // Metadata
  icon: string;
  color: string;
  estimatedNodes: number;
  estimatedTime: string;  // e.g., "2-3 hours"

  // Smart defaults
  defaultType: "proposal" | "sow" | "contract" | "compliance" | "technical" | "whitepaper";
  defaultObjectives: string[];
  suggestedTags: string[];

  // Content hints
  aiPromptHint: string;   // Suggested prompt for content generation

  // Enhanced metadata (editable)
  purpose?: string;           // What this template is designed for
  targetAudience?: string;    // Who should use this template
  usageAdvice?: string;       // When and how to use this template
  bestPractices?: string[];   // Tips for using this template effectively

  // Popularity
  usageCount?: number;
  isPopular?: boolean;
  isNew?: boolean;

  // Customization tracking
  isCustom?: boolean;         // User-created or modified template
  baseTemplateId?: string;    // Original template if customized
  lastModified?: Date;
}

export interface TemplateNode {
  type: "chapter" | "section" | "subsection" | "paragraph";
  title: string;
  description?: string;
  children?: TemplateNode[];
  aiPrompt?: string;      // Section-specific generation prompt
  tokenBudget?: number;
  densityTarget?: number;
}

// ============================================================================
// Government/Federal Templates
// ============================================================================

export const FAR_PROPOSAL_TEMPLATE: DocumentTemplate = {
  id: "far-proposal",
  name: "FAR-Compliant Proposal",
  description: "Full federal proposal following Federal Acquisition Regulation structure (FAR Parts 10-16)",
  category: "government",
  domain: "government-proposal",
  icon: "Landmark",
  color: "#dc2626",
  estimatedNodes: 45,
  estimatedTime: "8-12 hours",
  defaultType: "proposal",
  defaultObjectives: ["win-bid", "compliance-only"],
  suggestedTags: ["FAR", "federal", "government", "compliance"],
  aiPromptHint: "Federal proposal for {{agency}} focusing on {{technical_area}} with emphasis on past performance and cost realism",
  
  structure: [
    {
      type: "chapter",
      title: "Cover Letter & Executive Summary",
      children: [
        { type: "section", title: "Proposal Cover Letter" },
        { type: "section", title: "Executive Summary", description: "Key win themes and differentiators" },
      ]
    },
    {
      type: "chapter",
      title: "Volume I: Technical Proposal",
      children: [
        { type: "section", title: "1.0 Technical Approach", description: "Overall methodology and approach" },
        { type: "subsection", title: "1.1 Understanding of Requirements" },
        { type: "subsection", title: "1.2 Proposed Solution Architecture" },
        { type: "subsection", title: "1.3 Innovation and Best Practices" },
        { type: "section", title: "2.0 Management Plan", description: "Project management approach" },
        { type: "subsection", title: "2.1 Organizational Structure" },
        { type: "subsection", title: "2.2 Key Personnel & Staffing" },
        { type: "subsection", title: "2.3 Phase-In/Phase-Out Plan" },
        { type: "section", title: "3.0 Past Performance", description: "Relevant contract history" },
        { type: "subsection", title: "3.1 Contract References" },
        { type: "subsection", title: "3.2 Performance Summaries" },
        { type: "section", title: "4.0 Quality Assurance", description: "QA approach and metrics" },
      ]
    },
    {
      type: "chapter",
      title: "Volume II: Cost Proposal",
      children: [
        { type: "section", title: "Cost Summary & Pricing" },
        { type: "section", title: "Basis of Estimates" },
        { type: "section", title: "Cost Realism Narrative" },
      ]
    },
    {
      type: "chapter",
      title: "Attachments & Compliance",
      children: [
        { type: "section", title: "Representations & Certifications" },
        { type: "section", title: "SF-33 (Solicitation/Contract)" },
        { type: "section", title: "DD-254 (Contract Security)" },
      ]
    }
  ]
};

export const DFARS_CYBER_TEMPLATE: DocumentTemplate = {
  id: "dfars-cyber",
  name: "DFARS Cyber Compliance",
  description: "DFARS 252.204-7012 NIST SP 800-171 compliance documentation",
  category: "compliance",
  domain: "compliance-doc",
  icon: "Shield",
  color: "#ea580c",
  estimatedNodes: 25,
  estimatedTime: "4-6 hours",
  defaultType: "compliance",
  defaultObjectives: ["compliance-only"],
  suggestedTags: ["DFARS", "cybersecurity", "NIST", "800-171", "CUI"],
  aiPromptHint: "DFARS cybersecurity compliance plan for protecting Controlled Unclassified Information (CUI)",
  
  structure: [
    {
      type: "chapter",
      title: "System Security Plan (SSP)",
      children: [
        { type: "section", title: "1.0 System Identification" },
        { type: "section", title: "2.0 System Environment" },
        { type: "section", title: "3.0 System Interconnections" },
      ]
    },
    {
      type: "chapter",
      title: "NIST 800-171 Controls",
      children: [
        { type: "section", title: "Access Control (AC) Family" },
        { type: "section", title: "Audit & Accountability (AU) Family" },
        { type: "section", title: "Configuration Management (CM) Family" },
        { type: "section", title: "Identification & Authentication (IA) Family" },
        { type: "section", title: "Incident Response (IR) Family" },
        { type: "section", title: "Maintenance (MA) Family" },
        { type: "section", title: "Media Protection (MP) Family" },
        { type: "section", title: "Personnel Security (PS) Family" },
        { type: "section", title: "Risk Assessment (RA) Family" },
        { type: "section", title: "Security Assessment (CA) Family" },
        { type: "section", title: "System & Communications (SC) Family" },
        { type: "section", title: "System & Info Integrity (SI) Family" },
      ]
    },
    {
      type: "chapter",
      title: "Plans & Procedures",
      children: [
        { type: "section", title: "Incident Response Plan" },
        { type: "section", title: "Plan of Action & Milestones (POA&M)" },
      ]
    }
  ]
};

export const SBIR_PROPOSAL_TEMPLATE: DocumentTemplate = {
  id: "sbir-proposal",
  name: "SBIR/STTR Proposal",
  description: "Small Business Innovation Research proposal (DoD, NIH, NSF formats)",
  category: "government",
  domain: "government-proposal",
  icon: "Lightbulb",
  color: "#2563eb",
  estimatedNodes: 20,
  estimatedTime: "6-10 hours",
  defaultType: "proposal",
  defaultObjectives: ["win-bid", "strategic"],
  suggestedTags: ["SBIR", "STTR", "research", "innovation", "small-business"],
  aiPromptHint: "SBIR Phase {{phase}} proposal for {{technicalTopic}} emphasizing innovation and commercial potential",
  
  structure: [
    {
      type: "chapter",
      title: "Technical Volume",
      children: [
        { type: "section", title: "1.0 Identification & Significance of Problem" },
        { type: "section", title: "2.0 Phase I Technical Objectives" },
        { type: "section", title: "3.0 Phase I Work Plan" },
        { type: "section", title: "4.0 Related R&D" },
        { type: "section", title: "5.0 Relationship with Future Research" },
        { type: "section", title: "6.0 Key Personnel & Facilities" },
      ]
    },
    {
      type: "chapter",
      title: "Commercialization Plan",
      children: [
        { type: "section", title: "1.0 Company Information" },
        { type: "section", title: "2.0 Market Analysis" },
        { type: "section", title: "3.0 Competitive Landscape" },
        { type: "section", title: "4.0 Intellectual Property Strategy" },
        { type: "section", title: "5.0 Financing & Revenue Projections" },
        { type: "section", title: "6.0 Production & Marketing Strategy" },
      ]
    },
    {
      type: "chapter",
      title: "Cost Volume",
      children: [
        { type: "section", title: "Budget Summary" },
        { type: "section", title: "Detailed Budget Justification" },
        { type: "section", title: "Facilities & Administrative Costs" },
      ]
    }
  ]
};

// ============================================================================
// Commercial Templates
// ============================================================================

export const COMMERCIAL_PROPOSAL_TEMPLATE: DocumentTemplate = {
  id: "commercial-proposal",
  name: "Commercial Proposal",
  description: "Private sector proposal for commercial contracts and engagements",
  category: "commercial",
  domain: "commercial-proposal",
  icon: "Briefcase",
  color: "#059669",
  estimatedNodes: 30,
  estimatedTime: "4-6 hours",
  defaultType: "proposal",
  defaultObjectives: ["win-bid", "relationship"],
  suggestedTags: ["commercial", "private-sector", "B2B"],
  aiPromptHint: "Commercial proposal for {{client}} focusing on {{solution}} and ROI",
  
  structure: [
    {
      type: "chapter",
      title: "Executive Summary",
      children: [
        { type: "section", title: "Client Challenge" },
        { type: "section", title: "Our Solution" },
        { type: "section", title: "Key Benefits & ROI" },
      ]
    },
    {
      type: "chapter",
      title: "Company Overview",
      children: [
        { type: "section", title: "About Us" },
        { type: "section", title: "Relevant Experience" },
        { type: "section", title: "Credentials & Certifications" },
      ]
    },
    {
      type: "chapter",
      title: "Solution Details",
      children: [
        { type: "section", title: "Approach & Methodology" },
        { type: "section", title: "Implementation Plan" },
        { type: "section", title: "Team & Resources" },
        { type: "section", title: "Risk Mitigation" },
      ]
    },
    {
      type: "chapter", 
      title: "Investment & Terms",
      children: [
        { type: "section", title: "Pricing" },
        { type: "section", title: "Payment Terms" },
        { type: "section", title: "Service Level Agreements" },
      ]
    },
    {
      type: "chapter",
      title: "Next Steps",
      children: [
        { type: "section", title: "Timeline" },
        { type: "section", title: "Decision Criteria" },
      ]
    }
  ]
};

export const STATEMENT_OF_WORK_TEMPLATE: DocumentTemplate = {
  id: "sow-template",
  name: "Statement of Work (SOW)",
  description: "Detailed SOW for service contracts and project engagements",
  category: "commercial",
  domain: "generic",
  icon: "FileText",
  color: "#0891b2",
  estimatedNodes: 18,
  estimatedTime: "2-4 hours",
  defaultType: "sow",
  defaultObjectives: ["compliance-only"],
  suggestedTags: ["SOW", "contract", "services"],
  aiPromptHint: "Statement of Work defining scope, deliverables, and acceptance criteria",
  
  structure: [
    {
      type: "chapter",
      title: "1.0 Scope of Work",
      children: [
        { type: "section", title: "1.1 Background & Objectives" },
        { type: "section", title: "1.2 Scope Boundaries" },
        { type: "section", title: "1.3 Exclusions" },
      ]
    },
    {
      type: "chapter",
      title: "2.0 Deliverables",
      children: [
        { type: "section", title: "2.1 Deliverable List" },
        { type: "section", title: "2.2 Acceptance Criteria" },
        { type: "section", title: "2.3 Review Process" },
      ]
    },
    {
      type: "chapter",
      title: "3.0 Schedule & Milestones",
      children: [
        { type: "section", title: "3.1 Project Timeline" },
        { type: "section", title: "3.2 Key Milestones" },
        { type: "section", title: "3.3 Dependencies" },
      ]
    },
    {
      type: "chapter",
      title: "4.0 Personnel & Resources",
      children: [
        { type: "section", title: "4.1 Key Personnel" },
        { type: "section", title: "4.2 Resource Requirements" },
        { type: "section", title: "4.3 Facility Requirements" },
      ]
    },
    {
      type: "chapter",
      title: "5.0 Terms & Conditions",
      children: [
        { type: "section", title: "5.1 Payment Terms" },
        { type: "section", title: "5.2 Change Management" },
        { type: "section", title: "5.3 Risk Allocation" },
      ]
    }
  ]
};

// ============================================================================
// Technical Templates
// ============================================================================

export const TECHNICAL_SPECIFICATION_TEMPLATE: DocumentTemplate = {
  id: "tech-spec",
  name: "Technical Specification",
  description: "System architecture and technical requirements document",
  category: "technical",
  domain: "technical-spec",
  icon: "Code",
  color: "#7c3aed",
  estimatedNodes: 35,
  estimatedTime: "6-10 hours",
  defaultType: "technical",
  defaultObjectives: ["reference", "compliance-only"],
  suggestedTags: ["technical", "architecture", "specification", "engineering"],
  aiPromptHint: "Technical specification for {{system}} covering architecture, interfaces, and requirements",
  
  structure: [
    {
      type: "chapter",
      title: "1.0 Introduction",
      children: [
        { type: "section", title: "1.1 Purpose & Scope" },
        { type: "section", title: "1.2 Definitions & Acronyms" },
        { type: "section", title: "1.3 References" },
      ]
    },
    {
      type: "chapter",
      title: "2.0 System Overview",
      children: [
        { type: "section", title: "2.1 System Context" },
        { type: "section", title: "2.2 System Components" },
        { type: "section", title: "2.3 System Interfaces" },
      ]
    },
    {
      type: "chapter",
      title: "3.0 Functional Requirements",
      children: [
        { type: "section", title: "3.1 Feature Set A", children: [
          { type: "subsection", title: "REQ-001: Core Functionality" },
          { type: "subsection", title: "REQ-002: Data Processing" },
        ]},
        { type: "section", title: "3.2 Feature Set B", children: [
          { type: "subsection", title: "REQ-003: Integration" },
          { type: "subsection", title: "REQ-004: Reporting" },
        ]},
      ]
    },
    {
      type: "chapter",
      title: "4.0 Non-Functional Requirements",
      children: [
        { type: "section", title: "4.1 Performance" },
        { type: "section", title: "4.2 Security" },
        { type: "section", title: "4.3 Reliability & Availability" },
        { type: "section", title: "4.4 Scalability" },
        { type: "section", title: "4.5 Maintainability" },
      ]
    },
    {
      type: "chapter",
      title: "5.0 Architecture",
      children: [
        { type: "section", title: "5.1 System Architecture Diagram" },
        { type: "section", title: "5.2 Component Details" },
        { type: "section", title: "5.3 Data Model" },
        { type: "section", title: "5.4 Interface Specifications" },
      ]
    },
    {
      type: "chapter",
      title: "6.0 Appendices",
      children: [
        { type: "section", title: "Appendix A: Data Dictionary" },
        { type: "section", title: "Appendix B: API Specifications" },
        { type: "section", title: "Appendix C: Test Strategy" },
      ]
    }
  ]
};

// ============================================================================
// All Templates Collection
// ============================================================================

export const ALL_TEMPLATES: DocumentTemplate[] = [
  FAR_PROPOSAL_TEMPLATE,
  DFARS_CYBER_TEMPLATE,
  SBIR_PROPOSAL_TEMPLATE,
  COMMERCIAL_PROPOSAL_TEMPLATE,
  STATEMENT_OF_WORK_TEMPLATE,
  TECHNICAL_SPECIFICATION_TEMPLATE,
];

export const TEMPLATES_BY_CATEGORY: Record<TemplateCategory, DocumentTemplate[]> = {
  government: [FAR_PROPOSAL_TEMPLATE, SBIR_PROPOSAL_TEMPLATE],
  commercial: [COMMERCIAL_PROPOSAL_TEMPLATE, STATEMENT_OF_WORK_TEMPLATE],
  technical: [TECHNICAL_SPECIFICATION_TEMPLATE],
  compliance: [DFARS_CYBER_TEMPLATE],
  grants: [SBIR_PROPOSAL_TEMPLATE],
  legal: [],
  general: [],
};

export const POPULAR_TEMPLATES = [
  FAR_PROPOSAL_TEMPLATE,
  COMMERCIAL_PROPOSAL_TEMPLATE,
  DFARS_CYBER_TEMPLATE,
];

// ============================================================================
// Template Application Functions
// ============================================================================

export function convertTemplateToNodes(template: DocumentTemplate): HDSINode[] {
  return template.structure.map((struct, index) => 
    convertStructureToNode(struct, index, null, 0)
  );
}

function convertStructureToNode(
  struct: TemplateNode,
  order: number,
  parentId: string | null,
  depth: number
): HDSINode {
  const nodeId = crypto.randomUUID();
  
  const node: HDSINode = {
    id: nodeId,
    type: struct.type,
    title: struct.title,
    order,
    expanded: true,
    status: "outline",
    tokenBudget: struct.tokenBudget || 500,
    customPrompt: struct.aiPrompt || `Write content for: ${struct.title}`,
    densityTarget: struct.densityTarget || 2.5,
    coherenceScore: 1.0,
    parentId,
    depth,
    children: struct.children?.map((child, idx) => 
      convertStructureToNode(child, idx, nodeId, depth + 1)
    ) || [],
    aiConfig: {
      provider: "azure",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
    },
  };
  
  return node;
}

export function searchTemplates(query: string, category?: TemplateCategory): DocumentTemplate[] {
  const templates = category ? TEMPLATES_BY_CATEGORY[category] : ALL_TEMPLATES;
  const q = query.toLowerCase();
  
  return templates.filter(t => 
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.suggestedTags.some(tag => tag.toLowerCase().includes(q))
  );
}

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id);
}

export function getSuggestedTemplates(
  documentType?: string,
  opportunityType?: string
): DocumentTemplate[] {
  // Simple recommendation logic based on context
  if (opportunityType?.includes("FAR") || opportunityType?.includes("federal")) {
    return [FAR_PROPOSAL_TEMPLATE, DFARS_CYBER_TEMPLATE];
  }
  if (documentType === "compliance") {
    return [DFARS_CYBER_TEMPLATE];
  }
  if (documentType === "technical") {
    return [TECHNICAL_SPECIFICATION_TEMPLATE, STATEMENT_OF_WORK_TEMPLATE];
  }
  return POPULAR_TEMPLATES;
}
