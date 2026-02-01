// lib/types/graphics.ts
// Type exports for Smart Graphics Generator

// Import schema types for local use
import type {
  ProposalGraphic as _ProposalGraphic,
  NewProposalGraphic as _NewProposalGraphic,
  GraphicTemplate as _GraphicTemplate,
  NewGraphicTemplate as _NewGraphicTemplate,
  GraphicReference as _GraphicReference,
  GraphicFeedback as _GraphicFeedback,
  GraphicStyleGuide as _GraphicStyleGuide,
} from "@/lib/db/schema-graphics";

// Re-export schema types
export type ProposalGraphic = _ProposalGraphic;
export type NewProposalGraphic = _NewProposalGraphic;
export type GraphicTemplate = _GraphicTemplate;
export type NewGraphicTemplate = _NewGraphicTemplate;
export type GraphicReference = _GraphicReference;
export type GraphicFeedback = _GraphicFeedback;
export type GraphicStyleGuide = _GraphicStyleGuide;

// Import action types for local use
import type {
  GraphicSuggestion as _GraphicSuggestion,
  GraphicResult as _GraphicResult,
  StaffingData as _StaffingData,
  ScheduleData as _ScheduleData,
  InfographicData as _InfographicData,
  ConsistencyReport as _ConsistencyReport,
} from "@/lib/actions/graphics";

// Re-export action types
export type GraphicSuggestion = _GraphicSuggestion;
export type GraphicResult = _GraphicResult;
export type StaffingData = _StaffingData;
export type ScheduleData = _ScheduleData;
export type InfographicData = _InfographicData;
export type ConsistencyReport = _ConsistencyReport;

// UI-specific types

export type GraphicType =
  | "org_chart"
  | "process_flow"
  | "schedule"
  | "infographic"
  | "diagram"
  | "chart";

export type GraphicFormat = "svg" | "png" | "mermaid" | "d2";

export type GraphicStatus = "draft" | "review" | "approved" | "rejected";

export type GraphicGeneratedBy = "ai" | "manual" | "template";

// Form input types
export interface CreateGraphicInput {
  opportunityId?: string;
  documentId?: string;
  sectionId?: string;
  title: string;
  figureNumber?: string;
  graphicType: GraphicType;
  format?: GraphicFormat;
  sourceData?: Record<string, unknown>;
  diagramCode?: string;
  imageUrl?: string;
  caption?: string;
  actionCaption?: string;
  width?: number;
  height?: number;
  generatedBy?: GraphicGeneratedBy;
  generationPrompt?: string;
}

export interface UpdateGraphicInput extends Partial<CreateGraphicInput> {
  status?: GraphicStatus;
  approvedBy?: string;
}

// Template types
export interface TemplatePlaceholder {
  key: string;
  label: string;
  type: "text" | "list" | "number" | "date";
  required: boolean;
  defaultValue?: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  graphicType: GraphicType;
  format: GraphicFormat;
  templateCode: string;
  placeholders: TemplatePlaceholder[];
  previewImageUrl?: string;
  isPublic?: boolean;
}

// Style guide types
export interface StyleGuideColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
  palette: string[];
}

export interface StyleGuideTypography {
  fontFamily: string;
  titleFontSize: number;
  labelFontSize: number;
}

// Preview/render types
export interface GraphicPreviewProps {
  code: string;
  format: GraphicFormat;
  width?: number;
  height?: number;
  styleGuide?: Partial<GraphicStyleGuide>;
}

export interface GraphicEditorProps {
  graphic?: ProposalGraphic;
  opportunityId?: string;
  documentId?: string;
  sectionId?: string;
  onSave?: (graphic: ProposalGraphic) => void;
  onCancel?: () => void;
}

// Gallery/list types
export interface GraphicGalleryProps {
  opportunityId: string;
  selectedId?: string;
  onSelect?: (graphic: ProposalGraphic) => void;
  onEdit?: (graphic: ProposalGraphic) => void;
  onDelete?: (id: string) => void;
  showOrphaned?: boolean;
}

// Suggestion types for UI
export interface GraphicSuggestionUIProps {
  sectionId: string;
  onAcceptSuggestion?: (suggestion: GraphicSuggestion) => void;
}

// Validation types
export interface ValidationIssue {
  type: "missing_reference" | "orphaned" | "numbering" | "format";
  severity: "error" | "warning" | "info";
  message: string;
  graphicId?: string;
  documentId?: string;
}
