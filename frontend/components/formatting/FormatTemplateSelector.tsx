/**
 * FormatTemplateSelector Component
 *
 * Dropdown selector for government-specific format templates.
 * Shows template details and allows applying templates to documents.
 */

"use client";

import * as React from "react";
import {
	FileText,
	Check,
	ChevronDown,
	Building2,
	Ruler,
	Type,
	FileWarning,
	Shield,
	Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { FormatTemplate, GovernmentAgency } from "@/lib/types/formatting";
import { useFormatTemplates, useApplyFormatTemplate } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface FormatTemplateSelectorProps {
	/** Document ID to apply template to */
	documentId: string;
	/** Callback when template is applied */
	onApply?: (template: FormatTemplate) => void;
	/** Initially selected template ID */
	defaultTemplateId?: string;
	/** Additional CSS classes */
	className?: string;
	/** Show expanded details by default */
	showDetails?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get human-readable agency name.
 */
function getAgencyDisplayName(agency: GovernmentAgency): string {
	const names: Record<GovernmentAgency, string> = {
		dod: "Department of Defense",
		dhs: "Homeland Security",
		hhs: "Health & Human Services",
		nasa: "NASA",
		gsa: "General Services Admin",
		usda: "Agriculture",
		doe: "Energy",
		va: "Veterans Affairs",
		state: "State Department",
		treasury: "Treasury",
		commerce: "Commerce",
		interior: "Interior",
		justice: "Justice",
		labor: "Labor",
		transportation: "Transportation",
		epa: "EPA",
		other: "Other",
	};
	return names[agency] || agency.toUpperCase();
}

/**
 * Get agency abbreviation.
 */
function getAgencyAbbreviation(agency: GovernmentAgency): string {
	const abbrevs: Record<GovernmentAgency, string> = {
		dod: "DOD",
		dhs: "DHS",
		hhs: "HHS",
		nasa: "NASA",
		gsa: "GSA",
		usda: "USDA",
		doe: "DOE",
		va: "VA",
		state: "DOS",
		treasury: "TREAS",
		commerce: "DOC",
		interior: "DOI",
		justice: "DOJ",
		labor: "DOL",
		transportation: "DOT",
		epa: "EPA",
		other: "OTHER",
	};
	return abbrevs[agency] || agency.toUpperCase();
}

/**
 * Format margin string for display.
 */
function formatMargins(margins: FormatTemplate["margins"]): string {
	if (
		margins.top === margins.bottom &&
		margins.left === margins.right &&
		margins.top === margins.left
	) {
		return `${margins.top}" all sides`;
	}
	return `${margins.top}"/${margins.bottom}"/${margins.left}"/${margins.right}"`;
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function TemplateSelectorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-64 mt-1" />
			</CardHeader>
			<CardContent className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<div className="grid grid-cols-2 gap-4">
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
				</div>
				<Skeleton className="h-10 w-24" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Template Details Card
// =============================================================================

interface TemplateDetailsProps {
	template: FormatTemplate;
}

function TemplateDetails({ template }: TemplateDetailsProps) {
	return (
		<div className="space-y-4 mt-4">
			{/* Agency and Regulation */}
			<div className="flex items-center gap-2 flex-wrap">
				<Badge variant="outline" className="gap-1">
					<Building2 className="h-3 w-3" />
					{getAgencyAbbreviation(template.agency)}
				</Badge>
				{template.regulationReference && (
					<Badge variant="secondary" className="gap-1">
						<FileWarning className="h-3 w-3" />
						{template.regulationReference}
					</Badge>
				)}
				{template.section508Required && (
					<Badge className="gap-1 bg-green-600 hover:bg-green-700">
						<Shield className="h-3 w-3" />
						Section 508
					</Badge>
				)}
				{template.targetWCAGLevel && (
					<Badge variant="outline" className="gap-1">
						WCAG {template.targetWCAGLevel}
					</Badge>
				)}
			</div>

			{/* Page Setup */}
			<div className="grid grid-cols-2 gap-4">
				<div className="p-3 bg-muted/50 rounded-lg">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
						<Ruler className="h-4 w-4" />
						Page Setup
					</div>
					<div className="text-sm space-y-1">
						<p>
							<span className="text-muted-foreground">Size:</span>{" "}
							{template.pageSize === "letter" ? "US Letter (8.5×11)" : template.pageSize}
						</p>
						<p>
							<span className="text-muted-foreground">Margins:</span>{" "}
							{formatMargins(template.margins)}
						</p>
						<p>
							<span className="text-muted-foreground">Spacing:</span>{" "}
							{template.lineSpacing === "single" ? "Single" : template.lineSpacing}
						</p>
					</div>
				</div>

				<div className="p-3 bg-muted/50 rounded-lg">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
						<Type className="h-4 w-4" />
						Typography
					</div>
					<div className="text-sm space-y-1">
						<p>
							<span className="text-muted-foreground">Font:</span>{" "}
							{template.font.family.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
						</p>
						<p>
							<span className="text-muted-foreground">Size:</span> {template.font.size}pt
						</p>
						{template.maxPages && (
							<p>
								<span className="text-muted-foreground">Max Pages:</span> {template.maxPages}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Requirements */}
			<div className="p-3 bg-muted/50 rounded-lg">
				<div className="text-sm font-medium text-muted-foreground mb-2">
					Required Elements
				</div>
				<div className="flex flex-wrap gap-2">
					{template.requiresTOC && (
						<Badge variant="outline" className="text-xs">
							Table of Contents
						</Badge>
					)}
					{template.requiresPageNumbers && (
						<Badge variant="outline" className="text-xs">
							Page Numbers
						</Badge>
					)}
					{template.requiresListOfFigures && (
						<Badge variant="outline" className="text-xs">
							List of Figures
						</Badge>
					)}
					{template.requiresListOfTables && (
						<Badge variant="outline" className="text-xs">
							List of Tables
						</Badge>
					)}
					{template.requiresAcronymList && (
						<Badge variant="outline" className="text-xs">
							Acronym List
						</Badge>
					)}
					{template.requiresCrossReferences && (
						<Badge variant="outline" className="text-xs">
							Cross-References
						</Badge>
					)}
				</div>
			</div>

			{/* Volume Limits */}
			{template.volumeLimits && template.volumeLimits.length > 0 && (
				<div className="p-3 bg-muted/50 rounded-lg">
					<div className="text-sm font-medium text-muted-foreground mb-2">
						Volume Page Limits
					</div>
					<div className="space-y-1">
						{template.volumeLimits.map((vol) => (
							<div key={vol.volumeNumber} className="flex justify-between text-sm">
								<span>{vol.volumeName}</span>
								<span className="text-muted-foreground">{vol.maxPages} pages</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function FormatTemplateSelector({
	documentId,
	onApply,
	defaultTemplateId,
	className,
	showDetails = true,
}: FormatTemplateSelectorProps) {
	// Use hooks
	const { templates, isLoading, error: fetchError } = useFormatTemplates();
	const { apply, isApplying, error: applyError } = useApplyFormatTemplate();

	// State
	const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(
		defaultTemplateId || ""
	);
	const [applySuccess, setApplySuccess] = React.useState(false);

	// Auto-select first template when templates load
	React.useEffect(() => {
		if (!selectedTemplateId && templates.length > 0) {
			setSelectedTemplateId(templates[0].id);
		}
	}, [templates, selectedTemplateId]);

	// Derived state
	const selectedTemplate = React.useMemo(
		() => templates.find((t) => t.id === selectedTemplateId),
		[templates, selectedTemplateId]
	);

	const error = fetchError || applyError;

	// Handle template selection
	const handleTemplateChange = React.useCallback((value: string) => {
		setSelectedTemplateId(value);
		setApplySuccess(false);
	}, []);

	// Handle apply template
	const handleApply = React.useCallback(async () => {
		if (!selectedTemplate) return;

		setApplySuccess(false);
		const success = await apply(documentId, selectedTemplate.id);

		if (success) {
			setApplySuccess(true);
			onApply?.(selectedTemplate);
		}
	}, [documentId, selectedTemplate, onApply, apply]);

	// Loading state
	if (isLoading) {
		return <TemplateSelectorSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileText className="h-5 w-5" />
					Format Template
				</CardTitle>
				<CardDescription>
					Select a government formatting template to apply to your document
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Success Alert */}
				{applySuccess && (
					<Alert variant="success">
						<Check className="h-4 w-4" />
						<AlertTitle>Template Applied</AlertTitle>
						<AlertDescription>
							{selectedTemplate?.name} formatting has been applied to your document.
						</AlertDescription>
					</Alert>
				)}

				{/* Template Selector */}
				<div className="space-y-2">
					<span className="text-sm font-medium text-foreground">
						Select Template
					</span>
					<Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
						<SelectTrigger className="w-full" aria-label="Select Template">
							<SelectValue placeholder="Choose a format template..." />
						</SelectTrigger>
						<SelectContent>
							{templates.map((template) => (
								<SelectItem key={template.id} value={template.id}>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="text-xs">
											{getAgencyAbbreviation(template.agency)}
										</Badge>
										<span>{template.name}</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Template Details */}
				{showDetails && selectedTemplate && (
					<TemplateDetails template={selectedTemplate} />
				)}

				{/* Apply Button */}
				<div className="flex justify-end pt-2">
					<Button
						onClick={handleApply}
						disabled={!selectedTemplate || isApplying}
						isLoading={isApplying}
						loadingText="Applying..."
					>
						{applySuccess ? (
							<>
								<Check className="h-4 w-4 mr-2" />
								Applied
							</>
						) : (
							"Apply Template"
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default FormatTemplateSelector;
