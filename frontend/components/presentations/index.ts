/**
 * Presentations Components Export - DocFusion
 *
 * Comprehensive component library for oral presentation creation,
 * practice, and delivery. Designed for government RFP responses
 * with support for timing validation, Q&A preparation, and team coordination.
 */

// ============================================================================
// Core Editor Components
// ============================================================================

/**
 * Main presentation editor with slide list, editing panels, and toolbar.
 * Entry point for presentation creation and management.
 */
export { PresentationEditor } from "./PresentationEditor";

/**
 * Individual slide editor with rich content editing and layout options.
 * Supports text, images, charts, tables, and other content types.
 */
export { SlideEditor } from "./SlideEditor";

/**
 * Slide preview with transitions, speaker notes, and presentation mode.
 * Includes fullscreen support and keyboard navigation.
 */
export { SlidePreview } from "./SlidePreview";

/**
 * Drag-and-drop slide reordering with grid view.
 * Supports bulk selection and visual thumbnails.
 */
export { SlideSorter } from "./SlideSorter";

// ============================================================================
// Speaker Notes & Q&A Components
// ============================================================================

/**
 * Speaker notes editor with AI-powered generation and word count tracking.
 * Includes timing estimates based on speaking pace.
 */
export { SpeakerNotesEditor } from "./SpeakerNotesEditor";

/**
 * Q&A preparation tool with question management and answer drafting.
 * Supports AI-generated questions and evidence linking.
 */
export { QAPreparer } from "./QAPreparer";

/**
 * Individual Q&A card displaying question, answer, and evidence.
 * Includes category badges, difficulty indicators, and review status.
 */
export { QuestionCard } from "./QuestionCard";

// ============================================================================
// Timing & Practice Components
// ============================================================================

/**
 * Timing validator for checking presentation duration against limits.
 * Shows per-slide analysis and recommendations.
 */
export { TimingValidator } from "./TimingValidator";

/**
 * Practice recording interface with real-time timing feedback.
 * Supports audio/video capture and slide tracking.
 */
export { PracticeRecorder } from "./PracticeRecorder";

/**
 * Practice analysis with detailed feedback on timing, pacing, and content.
 * Includes improvement recommendations and comparison to previous recordings.
 */
export { PracticeAnalysis } from "./PracticeAnalysis";

// ============================================================================
// Team & Export Components
// ============================================================================

/**
 * Team assignment interface for slides and Q&A topics.
 * Supports role assignment and time allocation.
 */
export { TeamAssignment } from "./TeamAssignment";

/**
 * Presentation exporter for PPTX, PDF, and HTML formats.
 * Includes options for speaker notes, Q&A, and security.
 */
export { PresentationExporter } from "./PresentationExporter";

// ============================================================================
// Re-export Types
// ============================================================================

export type {
	// Core entity types
	OralPresentation,
	PresentationSlide,
	PresentationQA,
	PracticeRecording,
	PresentationTeamMember,

	// Enum/union types
	PresentationStatus,
	SlideType,
	ContentType,
	QuestionCategory,
	QuestionDifficulty,
	TeamRole,
	RecordingType,

	// Content types
	SlideContentElement,
	EvaluationCriterion,
	CustomBranding,
	SlideAnnotation,
	SupportingEvidence,

	// Analysis types
	PacingAnalysis,
	ContentCoverage,
	FillerWordAnalysis,
	TimingAnalysis,
	PracticeAnalysis as PracticeAnalysisData,
	SlideReductionSuggestion,
	GeneratedQA,

	// Options/form types
	ExportOptions,
	HandoutOptions,
	PresentationWithDetails,
	SlideFormData,
} from "@/lib/types/presentations";

// Re-export config objects
export {
	PRESENTATION_STATUS_CONFIG,
	SLIDE_TYPE_CONFIG,
	QUESTION_CATEGORY_CONFIG,
} from "@/lib/types/presentations";
