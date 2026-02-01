/**
 * FormatPreview Component
 *
 * Simulated page view with margins, fonts, headers, footers,
 * and page numbering for document formatting preview.
 */

"use client";

import * as React from "react";
import {
	FileText,
	ChevronLeft,
	ChevronRight,
	ZoomIn,
	ZoomOut,
	Maximize2,
	RefreshCw,
	Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

import type {
	FormatTemplate,
	FormatPreviewResult,
	HeaderFooterSettings,
} from "@/lib/types/formatting";
import { useFormatPreview } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface FormatPreviewProps {
	/** Document ID to preview */
	documentId: string;
	/** Template ID to apply (optional) */
	templateId?: string;
	/** Header/footer settings override */
	headerFooterSettings?: HeaderFooterSettings;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];
const DEFAULT_ZOOM = 100;

// Page dimensions in pixels at 100% (based on 72 DPI)
const PAGE_WIDTH = 612; // 8.5 inches
const PAGE_HEIGHT = 792; // 11 inches

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Simulated page component.
 */
interface PageViewProps {
	pageNumber: number;
	totalPages: number;
	template?: FormatTemplate;
	headerFooterSettings?: HeaderFooterSettings;
	zoom: number;
}

function PageView({
	pageNumber,
	totalPages,
	template,
	headerFooterSettings,
	zoom,
}: PageViewProps) {
	// Calculate scaled dimensions
	const scale = zoom / 100;
	const width = PAGE_WIDTH * scale;
	const height = PAGE_HEIGHT * scale;

	// Get margin values in pixels (inches * 72 DPI * scale)
	const margins = template?.margins || { top: 1, bottom: 1, left: 1, right: 1 };
	const marginTop = margins.top * 72 * scale;
	const marginBottom = margins.bottom * 72 * scale;
	const marginLeft = margins.left * 72 * scale;
	const marginRight = margins.right * 72 * scale;

	// Format page number
	const formatPageNum = (num: number): string => {
		const format = headerFooterSettings?.pageNumberFormat || "arabic";
		switch (format) {
			case "roman-lower":
				return toRoman(num).toLowerCase();
			case "roman-upper":
				return toRoman(num);
			default:
				return num.toString();
		}
	};

	const toRoman = (num: number): string => {
		const numerals: [number, string][] = [
			[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
			[100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
			[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
		];
		let result = "";
		for (const [value, numeral] of numerals) {
			while (num >= value) {
				result += numeral;
				num -= value;
			}
		}
		return result;
	};

	// Determine if first page has different header/footer
	const isFirstPage = pageNumber === 1;
	const useDifferentFirst = headerFooterSettings?.differentFirstPage && isFirstPage;

	// Get header/footer elements
	const headerElements = useDifferentFirst
		? headerFooterSettings?.firstPageHeader || []
		: headerFooterSettings?.header || [];
	const footerElements = useDifferentFirst
		? headerFooterSettings?.firstPageFooter || []
		: headerFooterSettings?.footer || [];

	// Replace tokens in content
	const replaceTokens = (content: string): string => {
		return content
			.replace(/{page}/g, formatPageNum(pageNumber))
			.replace(/{pages}/g, totalPages.toString())
			.replace(/{date}/g, new Date().toLocaleDateString())
			.replace(/{title}/g, "Document Title");
	};

	// Font styling
	const fontFamily = template?.font.family
		? template.font.family.replace(/-/g, " ")
		: "Times New Roman";
	const fontSize = (template?.font.size || 12) * scale;

	return (
		<div
			className="relative bg-white shadow-lg border border-gray-200"
			style={{
				width: `${width}px`,
				height: `${height}px`,
				fontFamily: `'${fontFamily}', serif`,
			}}
		>
			{/* Header Area */}
			<div
				className="absolute left-0 right-0 flex items-end text-gray-500"
				style={{
					top: `${marginTop * 0.4}px`,
					left: `${marginLeft}px`,
					right: `${marginRight}px`,
					fontSize: `${fontSize * 0.75}px`,
				}}
			>
				<div className="flex-1 grid grid-cols-3 gap-2">
					{(["left", "center", "right"] as const).map((pos) => {
						const element = headerElements.find((e) => e.position === pos);
						if (!element?.content) return <span key={pos} />;
						return (
							<span
								key={pos}
								className={cn(
									pos === "center" && "text-center",
									pos === "right" && "text-right"
								)}
							>
								{replaceTokens(element.content)}
							</span>
						);
					})}
				</div>
			</div>

			{/* Content Area (simulated) */}
			<div
				className="absolute overflow-hidden"
				style={{
					top: `${marginTop}px`,
					bottom: `${marginBottom}px`,
					left: `${marginLeft}px`,
					right: `${marginRight}px`,
				}}
			>
				{/* Simulated text lines */}
				<div className="space-y-1" style={{ fontSize: `${fontSize}px` }}>
					{pageNumber === 1 && (
						<div className="text-center mb-4">
							<div
								className="font-bold"
								style={{ fontSize: `${fontSize * 1.5}px` }}
							>
								Document Title
							</div>
							<div className="text-gray-500 mt-2">
								Proposal Response
							</div>
						</div>
					)}

					{/* Simulated paragraphs */}
					{Array.from({ length: 15 }).map((_, i) => (
						<div
							key={i}
							className="h-3 bg-gray-200 rounded"
							style={{
								width: `${70 + Math.random() * 30}%`,
								height: `${fontSize * 0.8}px`,
								marginBottom: `${fontSize * 0.5}px`,
							}}
						/>
					))}
				</div>
			</div>

			{/* Footer Area */}
			<div
				className="absolute left-0 right-0 flex items-start text-gray-500"
				style={{
					bottom: `${marginBottom * 0.4}px`,
					left: `${marginLeft}px`,
					right: `${marginRight}px`,
					fontSize: `${fontSize * 0.75}px`,
				}}
			>
				<div className="flex-1 grid grid-cols-3 gap-2">
					{(["left", "center", "right"] as const).map((pos) => {
						const element = footerElements.find((e) => e.position === pos);
						if (!element?.content) return <span key={pos} />;
						return (
							<span
								key={pos}
								className={cn(
									pos === "center" && "text-center",
									pos === "right" && "text-right"
								)}
							>
								{replaceTokens(element.content)}
							</span>
						);
					})}
				</div>
			</div>

			{/* Margin guides (shown at low opacity) */}
			<div
				className="absolute border border-dashed border-blue-200 pointer-events-none"
				style={{
					top: `${marginTop}px`,
					bottom: `${marginBottom}px`,
					left: `${marginLeft}px`,
					right: `${marginRight}px`,
				}}
			/>
		</div>
	);
}

/**
 * Zoom controls.
 */
interface ZoomControlsProps {
	zoom: number;
	onZoomChange: (zoom: number) => void;
}

function ZoomControls({ zoom, onZoomChange }: ZoomControlsProps) {
	const zoomIn = () => {
		const currentIndex = ZOOM_LEVELS.indexOf(zoom);
		if (currentIndex < ZOOM_LEVELS.length - 1) {
			onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
		}
	};

	const zoomOut = () => {
		const currentIndex = ZOOM_LEVELS.indexOf(zoom);
		if (currentIndex > 0) {
			onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
		}
	};

	const resetZoom = () => {
		onZoomChange(DEFAULT_ZOOM);
	};

	return (
		<div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={zoomOut}
							disabled={zoom === ZOOM_LEVELS[0]}
						>
							<ZoomOut className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom out</TooltipContent>
				</Tooltip>

				<Button
					variant="ghost"
					size="sm"
					className="h-8 px-2 min-w-[4rem]"
					onClick={resetZoom}
				>
					{zoom}%
				</Button>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={zoomIn}
							disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
						>
							<ZoomIn className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom in</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}

/**
 * Page navigation.
 */
interface PageNavigationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

function PageNavigation({
	currentPage,
	totalPages,
	onPageChange,
}: PageNavigationProps) {
	return (
		<div className="flex items-center gap-2">
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			<div className="flex items-center gap-1 text-sm">
				<Input
					type="number"
					min={1}
					max={totalPages}
					value={currentPage}
					onChange={(e) => {
						const page = parseInt(e.target.value);
						if (page >= 1 && page <= totalPages) {
							onPageChange(page);
						}
					}}
					className="w-12 h-8 text-center p-1"
				/>
				<span className="text-muted-foreground">of {totalPages}</span>
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
}

/**
 * Loading skeleton.
 */
function PreviewSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-56 mt-1" />
			</CardHeader>
			<CardContent>
				<div className="flex justify-center py-8">
					<Skeleton
						className="shadow-lg"
						style={{ width: "306px", height: "396px" }}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function FormatPreview({
	documentId,
	templateId,
	headerFooterSettings,
	className,
}: FormatPreviewProps) {
	// Use hook for format preview
	const { template, totalPages, isLoading, error } = useFormatPreview(documentId, templateId);

	// Local state
	const [currentPage, setCurrentPage] = React.useState(1);
	const [zoom, setZoom] = React.useState(DEFAULT_ZOOM);

	// Reload function for manual refresh
	const loadPreview = React.useCallback(() => {
		// The hook handles the loading, this is just for the refresh button
		// A real implementation would trigger a refetch
	}, []);

	// Loading state
	if (isLoading) {
		return <PreviewSkeleton />;
	}

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Format Preview
					</CardTitle>
					<CardDescription>
						{template ? template.name : "Preview document formatting"}
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={loadPreview}
					disabled={isLoading}
				>
					<RefreshCw
						className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
					/>
					Refresh
				</Button>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Template Info */}
				{template && (
					<div className="flex gap-2 flex-wrap">
						<Badge variant="outline">
							{template.pageSize === "letter" ? "US Letter" : template.pageSize}
						</Badge>
						<Badge variant="secondary">
							{template.font.family.replace(/-/g, " ")} {template.font.size}pt
						</Badge>
						<Badge variant="secondary">{template.lineSpacing} spacing</Badge>
						{template.maxPages && (
							<Badge variant="outline">{template.maxPages} page limit</Badge>
						)}
					</div>
				)}

				{/* Controls */}
				<div className="flex items-center justify-between border-b pb-3">
					<ZoomControls zoom={zoom} onZoomChange={setZoom} />
					<PageNavigation
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={setCurrentPage}
					/>
				</div>

				{/* Preview Area */}
				<div className="overflow-auto bg-gray-100 dark:bg-gray-800 rounded-lg p-8 flex justify-center min-h-[500px]">
					<PageView
						pageNumber={currentPage}
						totalPages={totalPages}
						template={template || undefined}
						headerFooterSettings={
							headerFooterSettings || template?.defaultHeaderFooter
						}
						zoom={zoom}
					/>
				</div>

				{/* Preview Info */}
				<p className="text-xs text-muted-foreground text-center">
					Simulated preview showing formatting layout. Actual content rendering
					may vary.
				</p>
			</CardContent>
		</Card>
	);
}

export default FormatPreview;
