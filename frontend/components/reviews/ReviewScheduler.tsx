/**
 * ReviewScheduler - Schedule and Configure Reviews
 *
 * Allows scheduling new reviews with full configuration options including
 * review type, dates, scope, focus areas, and instructions.
 */

"use client";

import { useState, useCallback } from "react";
import {
	Calendar,
	Clock,
	FileText,
	Info,
	AlertCircle,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export type ReviewType = "pink" | "red" | "gold" | "compliance" | "final";

export interface ReviewTemplate {
	id: string;
	name: string;
	reviewType: ReviewType;
	defaultDurationDays: number;
	defaultInstructions: string;
	defaultFocusAreas: string[];
	requiresScoring: boolean;
	requiresConflictCheck: boolean;
}

export interface Section {
	id: string;
	name: string;
	volumeId?: string;
}

export interface Volume {
	id: string;
	name: string;
}

export interface ReviewSchedulerProps {
	opportunityId: string;
	templates?: ReviewTemplate[];
	sections?: Section[];
	volumes?: Volume[];
	documentVersions?: { id: string; name: string; createdAt: string }[];
	onSchedule?: (data: ReviewScheduleData) => Promise<void>;
	onCancel?: () => void;
	isLoading?: boolean;
	className?: string;
}

export interface ReviewScheduleData {
	opportunityId: string;
	reviewType: ReviewType;
	reviewName: string;
	description: string;
	scheduledDate: string;
	scheduledEndDate: string;
	documentVersionId?: string;
	scopeType: "full" | "partial" | "section";
	scopedSections: string[];
	scopedVolumes: string[];
	reviewInstructions: string;
	focusAreas: string[];
	templateId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REVIEW_TYPE_INFO: Record<
	ReviewType,
	{
		label: string;
		color: string;
		bgColor: string;
		description: string;
		defaultDuration: number;
		typicalTiming: string;
	}
> = {
	pink: {
		label: "Pink Team",
		color: "text-pink-700 dark:text-pink-400",
		bgColor: "bg-pink-100 dark:bg-pink-900/30",
		description: "Initial draft review focusing on outline completeness and compliance gaps",
		defaultDuration: 2,
		typicalTiming: "50-70% content complete",
	},
	red: {
		label: "Red Team",
		color: "text-red-700 dark:text-red-400",
		bgColor: "bg-red-100 dark:bg-red-900/30",
		description: "Full proposal review simulating government evaluation",
		defaultDuration: 3,
		typicalTiming: "85-95% content complete",
	},
	gold: {
		label: "Gold Team",
		color: "text-amber-700 dark:text-amber-400",
		bgColor: "bg-amber-100 dark:bg-amber-900/30",
		description: "Final review for polish, compliance verification, and win theme consistency",
		defaultDuration: 2,
		typicalTiming: "100% content complete, final editing",
	},
	compliance: {
		label: "Compliance",
		color: "text-blue-700 dark:text-blue-400",
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		description: "Focused review on requirements traceability and compliance matrix",
		defaultDuration: 1,
		typicalTiming: "Any time after requirements mapping",
	},
	final: {
		label: "Final",
		color: "text-purple-700 dark:text-purple-400",
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
		description: "Last look before submission - final proofreading and format check",
		defaultDuration: 1,
		typicalTiming: "24-48 hours before submission",
	},
};

const DEFAULT_FOCUS_AREAS = [
	"Technical Approach",
	"Past Performance",
	"Management Approach",
	"Cost/Price",
	"Key Personnel",
	"Risk Mitigation",
	"Win Themes",
	"Compliance",
	"Graphics/Visuals",
	"Executive Summary",
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewScheduler({
	opportunityId,
	templates = [],
	sections = [],
	volumes = [],
	documentVersions = [],
	onSchedule,
	onCancel,
	isLoading = false,
	className,
}: ReviewSchedulerProps) {
	// Form state
	const [reviewType, setReviewType] = useState<ReviewType>("red");
	const [reviewName, setReviewName] = useState("");
	const [description, setDescription] = useState("");
	const [scheduledDate, setScheduledDate] = useState("");
	const [scheduledEndDate, setScheduledEndDate] = useState("");
	const [documentVersionId, setDocumentVersionId] = useState<string>("");
	const [scopeType, setScopeType] = useState<"full" | "partial" | "section">("full");
	const [selectedSections, setSelectedSections] = useState<string[]>([]);
	const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);
	const [instructions, setInstructions] = useState("");
	const [focusAreas, setFocusAreas] = useState<string[]>([]);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

	// UI state
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Get current type info
	const typeInfo = REVIEW_TYPE_INFO[reviewType];

	// Handle review type change
	const handleTypeChange = useCallback(
		(type: ReviewType) => {
			setReviewType(type);
			const info = REVIEW_TYPE_INFO[type];

			// Auto-generate name if empty
			if (!reviewName) {
				setReviewName(`${info.label} Review`);
			}

			// Auto-set duration
			if (scheduledDate && !scheduledEndDate) {
				const start = new Date(scheduledDate);
				start.setDate(start.getDate() + info.defaultDuration);
				setScheduledEndDate(start.toISOString().split("T")[0]);
			}

			// Apply template if available
			const template = templates.find((t) => t.reviewType === type);
			if (template) {
				setSelectedTemplateId(template.id);
				setInstructions(template.defaultInstructions);
				setFocusAreas(template.defaultFocusAreas);
			}
		},
		[reviewName, scheduledDate, scheduledEndDate, templates]
	);

	// Handle start date change
	const handleStartDateChange = useCallback(
		(date: string) => {
			setScheduledDate(date);

			// Auto-set end date based on review type
			if (date) {
				const start = new Date(date);
				start.setDate(start.getDate() + typeInfo.defaultDuration);
				setScheduledEndDate(start.toISOString().split("T")[0]);
			}
		},
		[typeInfo.defaultDuration]
	);

	// Toggle focus area
	const toggleFocusArea = useCallback((area: string) => {
		setFocusAreas((prev) =>
			prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
		);
	}, []);

	// Toggle section selection
	const toggleSection = useCallback((sectionId: string) => {
		setSelectedSections((prev) =>
			prev.includes(sectionId)
				? prev.filter((id) => id !== sectionId)
				: [...prev, sectionId]
		);
	}, []);

	// Toggle volume selection
	const toggleVolume = useCallback((volumeId: string) => {
		setSelectedVolumes((prev) =>
			prev.includes(volumeId)
				? prev.filter((id) => id !== volumeId)
				: [...prev, volumeId]
		);
	}, []);

	// Validate form
	const validateForm = useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!reviewName.trim()) {
			newErrors.reviewName = "Review name is required";
		}

		if (!scheduledDate) {
			newErrors.scheduledDate = "Start date is required";
		}

		if (!scheduledEndDate) {
			newErrors.scheduledEndDate = "End date is required";
		}

		if (scheduledDate && scheduledEndDate) {
			const start = new Date(scheduledDate);
			const end = new Date(scheduledEndDate);
			if (end < start) {
				newErrors.scheduledEndDate = "End date must be after start date";
			}
		}

		if (scopeType !== "full" && selectedSections.length === 0 && selectedVolumes.length === 0) {
			newErrors.scope = "Select at least one section or volume for partial review";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [reviewName, scheduledDate, scheduledEndDate, scopeType, selectedSections, selectedVolumes]);

	// Handle submit
	const handleSubmit = useCallback(async () => {
		if (!validateForm()) return;

		const data: ReviewScheduleData = {
			opportunityId,
			reviewType,
			reviewName: reviewName.trim(),
			description: description.trim(),
			scheduledDate: new Date(scheduledDate).toISOString(),
			scheduledEndDate: new Date(scheduledEndDate).toISOString(),
			documentVersionId: documentVersionId || undefined,
			scopeType,
			scopedSections: scopeType !== "full" ? selectedSections : [],
			scopedVolumes: scopeType !== "full" ? selectedVolumes : [],
			reviewInstructions: instructions.trim(),
			focusAreas,
			templateId: selectedTemplateId || undefined,
		};

		await onSchedule?.(data);
	}, [
		validateForm,
		opportunityId,
		reviewType,
		reviewName,
		description,
		scheduledDate,
		scheduledEndDate,
		documentVersionId,
		scopeType,
		selectedSections,
		selectedVolumes,
		instructions,
		focusAreas,
		selectedTemplateId,
		onSchedule,
	]);

	return (
		<Card className={cn("w-full max-w-2xl", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Calendar className="h-5 w-5" />
					Schedule Review
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Review Type Selection */}
				<div className="space-y-3">
					<Label>Review Type</Label>
					<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
						{(Object.keys(REVIEW_TYPE_INFO) as ReviewType[]).map((type) => {
							const info = REVIEW_TYPE_INFO[type];
							const isSelected = reviewType === type;

							return (
								<TooltipProvider key={type}>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={() => handleTypeChange(type)}
												className={cn(
													"p-3 rounded-lg border-2 text-left transition-all",
													isSelected
														? cn("border-primary", info.bgColor)
														: "border-muted hover:border-muted-foreground/50"
												)}
											>
												<Badge
													variant="secondary"
													className={cn(info.bgColor, info.color, "mb-1")}
												>
													{info.label}
												</Badge>
												<p className="text-xs text-muted-foreground mt-1">
													{info.typicalTiming}
												</p>
											</button>
										</TooltipTrigger>
										<TooltipContent side="bottom" className="max-w-[250px]">
											<p>{info.description}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							);
						})}
					</div>

					{/* Type description */}
					<div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
						<Info className="h-4 w-4 text-muted-foreground mt-0.5" />
						<div className="text-sm">
							<p className="font-medium">{typeInfo.label}</p>
							<p className="text-muted-foreground">{typeInfo.description}</p>
						</div>
					</div>
				</div>

				{/* Review Name */}
				<div className="space-y-2">
					<Label htmlFor="reviewName">Review Name</Label>
					<Input
						id="reviewName"
						value={reviewName}
						onChange={(e) => setReviewName(e.target.value)}
						placeholder={`${typeInfo.label} Review`}
						className={cn(errors.reviewName && "border-destructive")}
					/>
					{errors.reviewName && (
						<p className="text-sm text-destructive">{errors.reviewName}</p>
					)}
				</div>

				{/* Description */}
				<div className="space-y-2">
					<Label htmlFor="description">Description (Optional)</Label>
					<Textarea
						id="description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Add context or objectives for this review..."
						rows={2}
					/>
				</div>

				{/* Dates */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="startDate">Start Date</Label>
						<Input
							id="startDate"
							type="date"
							value={scheduledDate}
							onChange={(e) => handleStartDateChange(e.target.value)}
							className={cn(errors.scheduledDate && "border-destructive")}
						/>
						{errors.scheduledDate && (
							<p className="text-sm text-destructive">{errors.scheduledDate}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="endDate">End Date</Label>
						<Input
							id="endDate"
							type="date"
							value={scheduledEndDate}
							onChange={(e) => setScheduledEndDate(e.target.value)}
							min={scheduledDate}
							className={cn(errors.scheduledEndDate && "border-destructive")}
						/>
						{errors.scheduledEndDate && (
							<p className="text-sm text-destructive">{errors.scheduledEndDate}</p>
						)}
					</div>
				</div>

				{/* Duration info */}
				{scheduledDate && scheduledEndDate && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span>
							{Math.ceil(
								(new Date(scheduledEndDate).getTime() -
									new Date(scheduledDate).getTime()) /
									(1000 * 60 * 60 * 24)
							)}{" "}
							days
						</span>
					</div>
				)}

				{/* Document Version */}
				{documentVersions.length > 0 && (
					<div className="space-y-2">
						<Label htmlFor="documentVersion">Document Version</Label>
						<Select value={documentVersionId} onValueChange={setDocumentVersionId}>
							<SelectTrigger>
								<SelectValue placeholder="Select version to review" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">Latest version</SelectItem>
								{documentVersions.map((version) => (
									<SelectItem key={version.id} value={version.id}>
										{version.name} ({new Date(version.createdAt).toLocaleDateString()})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Focus Areas */}
				<div className="space-y-2">
					<Label>Focus Areas</Label>
					<div className="flex flex-wrap gap-2">
						{DEFAULT_FOCUS_AREAS.map((area) => (
							<Badge
								key={area}
								variant={focusAreas.includes(area) ? "default" : "outline"}
								className="cursor-pointer"
								onClick={() => toggleFocusArea(area)}
							>
								{area}
							</Badge>
						))}
					</div>
				</div>

				{/* Advanced Options */}
				<Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
					<CollapsibleTrigger asChild>
						<Button variant="ghost" className="w-full justify-between">
							Advanced Options
							{showAdvanced ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</Button>
					</CollapsibleTrigger>

					<CollapsibleContent className="space-y-4 pt-4">
						{/* Review Scope */}
						<div className="space-y-3">
							<Label>Review Scope</Label>
							<div className="flex items-center gap-4">
								{(["full", "partial", "section"] as const).map((scope) => (
									<label key={scope} className="flex items-center gap-2 cursor-pointer">
										<input
											type="radio"
											name="scope"
											checked={scopeType === scope}
											onChange={() => setScopeType(scope)}
											className="h-4 w-4"
										/>
										<span className="text-sm capitalize">
											{scope === "section" ? "Specific Sections" : `${scope} Review`}
										</span>
									</label>
								))}
							</div>

							{/* Section/Volume Selection */}
							{scopeType !== "full" && (
								<div className="space-y-3 p-3 bg-muted rounded-lg">
									{volumes.length > 0 && (
										<div className="space-y-2">
											<Label className="text-sm">Volumes</Label>
											<div className="flex flex-wrap gap-2">
												{volumes.map((volume) => (
													<label
														key={volume.id}
														className="flex items-center gap-2 cursor-pointer"
													>
														<Checkbox
															checked={selectedVolumes.includes(volume.id)}
															onCheckedChange={() => toggleVolume(volume.id)}
														/>
														<span className="text-sm">{volume.name}</span>
													</label>
												))}
											</div>
										</div>
									)}

									{sections.length > 0 && (
										<div className="space-y-2">
											<Label className="text-sm">Sections</Label>
											<div className="max-h-40 overflow-y-auto space-y-1">
												{sections.map((section) => (
													<label
														key={section.id}
														className="flex items-center gap-2 cursor-pointer p-1 hover:bg-background rounded"
													>
														<Checkbox
															checked={selectedSections.includes(section.id)}
															onCheckedChange={() => toggleSection(section.id)}
														/>
														<span className="text-sm">{section.name}</span>
													</label>
												))}
											</div>
										</div>
									)}

									{errors.scope && (
										<p className="text-sm text-destructive flex items-center gap-1">
											<AlertCircle className="h-4 w-4" />
											{errors.scope}
										</p>
									)}
								</div>
							)}
						</div>

						{/* Review Instructions */}
						<div className="space-y-2">
							<Label htmlFor="instructions">Review Instructions</Label>
							<Textarea
								id="instructions"
								value={instructions}
								onChange={(e) => setInstructions(e.target.value)}
								placeholder="Provide specific instructions for reviewers..."
								rows={4}
							/>
						</div>

						{/* Template Selection */}
						{templates.length > 0 && (
							<div className="space-y-2">
								<Label htmlFor="template">Apply Template</Label>
								<Select
									value={selectedTemplateId}
									onValueChange={setSelectedTemplateId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select a template (optional)" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">No template</SelectItem>
										{templates.map((template) => (
											<SelectItem key={template.id} value={template.id}>
												{template.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</CollapsibleContent>
				</Collapsible>
			</CardContent>

			<CardFooter className="flex justify-end gap-3 border-t pt-4">
				<Button variant="outline" onClick={onCancel} disabled={isLoading}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={isLoading}>
					{isLoading ? "Scheduling..." : "Schedule Review"}
				</Button>
			</CardFooter>
		</Card>
	);
}

export default ReviewScheduler;
