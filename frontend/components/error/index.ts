/**
 * Error components barrel export.
 */

export {
	ErrorBoundary,
	DefaultErrorFallback,
	CompactErrorFallback,
	InlineError,
	type ErrorBoundaryProps,
	type ErrorFallbackProps,
	type ErrorInfo,
} from "./ErrorBoundary";

export {
	DocumentErrorFallback,
	DocumentLoadingError,
	DocumentErrorBanner,
	AutosaveError,
	type DocumentErrorFallbackProps,
	type DocumentErrorType,
} from "./DocumentErrorFallback";
