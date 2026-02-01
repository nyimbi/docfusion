// Document types
export * from "./document";

// Template types
export * from "./template";

// Collaboration types
export * from "./collaboration";

// AI types
export * from "./ai";

// Comments and Workflow types
export * from "./comments-workflow";

// Opportunity types
export * from "./opportunity";

// Company setup types
export * from "./company";

// RFP Intelligence types
export * from "./rfp";

// Content Library types
export * from "./content-library";

// Formatting types - selectively export to avoid conflicts
export type {
	FormatTemplateId,
	FormatIssueId,
	TOCEntryId,
	ValidationResultId,
	PageSize,
	FontFamily,
	LineSpacing,
	GovernmentAgency,
	MarginSettings,
	FontSettings,
	FormatTemplate,
	VolumePageLimit,
	PageNumberFormat,
	HeaderFooterPosition,
	HeaderFooterElement,
	HeaderFooterSettings,
	IssueCategory,
	FormatIssueSeverity,
	FormatIssue,
	IssueLocation,
	FormatValidationResult,
	PageCountInfo,
	VolumePageCount,
	WCAGLevel,
	AccessibilityCategory,
	AccessibilityIssue,
	AccessibilityResult,
	HeadingLevel,
	TOCEntryType,
	TOCEntry,
	TOCConfig,
	TOCResult,
	FigureEntry,
	TableEntry,
	AcronymEntry,
	ListsResult,
	PreviewPage,
	FormatPreviewResult,
	ApplyTemplateInput,
	ValidateFormatInput,
	CheckAccessibilityInput,
	GenerateTOCInput,
	GenerateListsInput,
	UpdateHeaderFooterInput,
	GeneratePreviewInput,
	AutoFixIssuesInput,
	ActionResult,
} from "./formatting";
