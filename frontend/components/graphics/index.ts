/**
 * Graphics Components Export - DocFusion
 *
 * Smart Graphics Generator components for AI-powered diagram creation,
 * editing, and management in government proposals.
 *
 * @module components/graphics
 */

// Gallery and browsing components
export { GraphicsGallery } from "./GraphicsGallery";
export { TemplateGallery } from "./TemplateGallery";

// Editor and preview components
export { GraphicEditor } from "./GraphicEditor";
export { GraphicPreview } from "./GraphicPreview";

// AI-powered generators
export { OrgChartGenerator } from "./OrgChartGenerator";
export { ScheduleGenerator } from "./ScheduleGenerator";
export { ProcessFlowGenerator } from "./ProcessFlowGenerator";

// AI suggestion and validation components
export { GraphicSuggestions } from "./GraphicSuggestions";
export { ConsistencyChecker } from "./ConsistencyChecker";

// Caption editor
export { ActionCaptionEditor } from "./ActionCaptionEditor";

// Re-export types for convenience
export type {
	ProposalGraphic,
	GraphicTemplate,
	GraphicSuggestion,
	GraphicResult,
	StaffingData,
	ScheduleData,
	InfographicData,
	ConsistencyReport,
	GraphicType,
	GraphicFormat,
	GraphicStatus,
	CreateGraphicInput,
	UpdateGraphicInput,
	GraphicPreviewProps,
	GraphicEditorProps,
	GraphicGalleryProps,
	GraphicSuggestionUIProps,
	ValidationIssue,
} from "@/lib/types/graphics";
