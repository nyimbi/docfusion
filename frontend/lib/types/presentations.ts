/**
 * Oral Presentation Generator Types
 */

// Re-export database types
import type {
  OralPresentation as _OralPresentation,
  PresentationSlide as _PresentationSlide,
  PresentationQA as _PresentationQA,
  PracticeRecording as _PracticeRecording,
  PresentationTeamMember as _PresentationTeamMember,
} from "@/lib/db/schema-presentations";

export type OralPresentation = _OralPresentation;
export type PresentationSlide = _PresentationSlide;
export type PresentationQA = _PresentationQA;
export type PracticeRecording = _PracticeRecording;
export type PresentationTeamMember = _PresentationTeamMember;

// Presentation status
export type PresentationStatus = "draft" | "in_review" | "approved" | "delivered";
export type SlideType = "title" | "content" | "image" | "chart" | "table" | "section_divider" | "qa";
export type ContentType = "text" | "bullet" | "image" | "chart" | "table" | "video" | "code" | "quote";
export type QuestionCategory = "technical" | "management" | "cost" | "past_performance" | "clarification";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type TeamRole = "presenter" | "backup" | "qa_responder" | "technical_support";
export type RecordingType = "full" | "section" | "qa_practice";

// Slide content element
export interface SlideContentElement {
  type: ContentType;
  data: unknown;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Evaluation criterion
export interface EvaluationCriterion {
  criterion: string;
  weight: number;
  description: string;
}

// Custom branding
export interface CustomBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  fontFamily?: string;
}

// Slide annotation
export interface SlideAnnotation {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
}

// Q&A supporting evidence
export interface SupportingEvidence {
  evidence: string;
  source: string;
  slideId?: string;
}

// Pacing analysis
export interface PacingAnalysis {
  averageWPM: number;
  variationScore: number;
  tooFastSegments: Array<{ startTime: number; endTime: number }>;
  tooSlowSegments: Array<{ startTime: number; endTime: number }>;
  pauseScore: number;
}

// Content coverage
export interface ContentCoverage {
  slideId: string;
  slideNumber: number;
  covered: boolean;
  duration: number;
  targetDuration: number;
  coverageScore: number;
}

// Filler word analysis
export interface FillerWordAnalysis {
  word: string;
  count: number;
  timestamps: number[];
}

// Timing analysis
export interface TimingAnalysis {
  totalDuration: number;
  timeLimit: number;
  isWithinLimit: boolean;
  overUnderMinutes: number;
  slideTiming: Array<{
    slideId: string;
    slideNumber: number;
    title?: string;
    estimatedDuration: number;
    recommendedDuration: number;
    status: "ok" | "too_short" | "too_long";
  }>;
  recommendations: string[];
}

// Practice analysis
export interface PracticeAnalysis {
  recordingId: string;
  duration: number;
  overallScore: number;
  pacing: PacingAnalysis;
  contentCoverage: ContentCoverage[];
  fillerWords: FillerWordAnalysis[];
  feedback: string;
  recommendations: string[];
  comparisonToPrevious?: {
    scoreChange: number;
    improvementAreas: string[];
    regressionAreas: string[];
  };
}

// Slide reduction suggestion
export interface SlideReductionSuggestion {
  currentMinutes: number;
  targetMinutes: number;
  suggestedCuts: Array<{
    slideId: string;
    slideNumber: number;
    slideTitle?: string;
    reason: string;
    timeSaved: number;
    impact: "low" | "medium" | "high";
  }>;
  suggestedMerges: Array<{
    slideIds: string[];
    reason: string;
    timeSaved: number;
  }>;
  contentTrimSuggestions: Array<{
    slideId: string;
    currentContent: string;
    suggestedContent: string;
    timeSaved: number;
  }>;
}

// Generated Q&A item
export interface GeneratedQA {
  question: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  probability: number;
  source: string;
  suggestedAnswer: string;
  keyPoints: string[];
  thingsToAvoid: string[];
}

// Export format options
export interface ExportOptions {
  format: "pptx" | "pdf" | "html";
  includeSpeakerNotes?: boolean;
  includeAnnotations?: boolean;
  includeQA?: boolean;
  quality?: "draft" | "final";
}

// Handout options
export interface HandoutOptions {
  slidesPerPage: 1 | 2 | 3 | 4 | 6;
  includeNotes?: boolean;
  includeAgenda?: boolean;
  includeContactInfo?: boolean;
}

// Presentation with details
export interface PresentationWithDetails extends OralPresentation {
  slides: PresentationSlide[];
  qaItems: PresentationQA[];
  team: PresentationTeamMember[];
  recordings: PracticeRecording[];
}

// Slide form data
export interface SlideFormData {
  slideNumber: number;
  slideType: SlideType;
  title?: string;
  content: SlideContentElement[];
  layout?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  speakerNotes?: string;
  estimatedDuration?: number;
  transitionType?: string;
}

// Status configuration
export const PRESENTATION_STATUS_CONFIG: Record<PresentationStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "gray" },
  in_review: { label: "In Review", color: "yellow" },
  approved: { label: "Approved", color: "green" },
  delivered: { label: "Delivered", color: "blue" },
};

export const SLIDE_TYPE_CONFIG: Record<SlideType, { label: string; icon: string }> = {
  title: { label: "Title Slide", icon: "type" },
  content: { label: "Content", icon: "file-text" },
  image: { label: "Image", icon: "image" },
  chart: { label: "Chart", icon: "bar-chart" },
  table: { label: "Table", icon: "table" },
  section_divider: { label: "Section Divider", icon: "minus" },
  qa: { label: "Q&A", icon: "help-circle" },
};

export const QUESTION_CATEGORY_CONFIG: Record<QuestionCategory, { label: string; color: string }> = {
  technical: { label: "Technical", color: "blue" },
  management: { label: "Management", color: "purple" },
  cost: { label: "Cost", color: "green" },
  past_performance: { label: "Past Performance", color: "amber" },
  clarification: { label: "Clarification", color: "gray" },
};
