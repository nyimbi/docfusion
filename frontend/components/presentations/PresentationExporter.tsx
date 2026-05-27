"use client";

/**
 * PresentationExporter Component - DocFusion
 *
 * Export presentation to PPTX, PDF, or HTML formats with customizable
 * options for speaker notes, Q&A, and branding.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Download,
	FileText,
	FileImage,
	Globe,
	Presentation,
	MessageSquare,
	HelpCircle,
	Users,
	Clock,
	Lock,
	Palette,
	Layers,
	CheckCircle,
	AlertTriangle,
	RefreshCw,
	X,
	Settings,
	Eye,
} from "lucide-react";
import { exportPresentation } from "@/lib/actions/presentations";
import type { OralPresentation, PresentationSlide, ExportOptions } from "@/lib/types/presentations";

// ============================================================================
// Types
// ============================================================================

interface PresentationExporterProps {
	/** Presentation to export */
	presentation: OralPresentation;
	/** All slides */
	slides: PresentationSlide[];
	/** Callback to close the exporter */
	onClose: () => void;
	/** Additional class names */
	className?: string;
}

type ExportFormat = "pptx" | "pdf" | "html";
type ExportQuality = "draft" | "final";

// ============================================================================
// Configuration
// ============================================================================

const FORMAT_CONFIG: Record<ExportFormat, { label: string; icon: typeof FileText; description: string }> = {
	pptx: {
		label: "PowerPoint",
		icon: Presentation,
		description: "Editable PowerPoint presentation (.pptx)",
	},
	pdf: {
		label: "PDF",
		icon: FileImage,
		description: "Print-ready PDF document",
	},
	html: {
		label: "Web",
		icon: Globe,
		description: "Interactive HTML presentation",
	},
};

// ============================================================================
// Component
// ============================================================================

export function PresentationExporter({
	presentation,
	slides,
	onClose,
	className,
}: PresentationExporterProps) {
	// State
	const [format, setFormat] = useState<ExportFormat>("pptx");
	const [quality, setQuality] = useState<ExportQuality>("final");
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState(0);
	const [exportError, setExportError] = useState<string | null>(null);
	const [exportSuccess, setExportSuccess] = useState(false);

	// Options state
	const [options, setOptions] = useState({
		includeSpeakerNotes: true,
		includeAnnotations: false,
		includeQA: false,
		includeTimingNotes: true,
		includeBackupSlides: false,
		addPageNumbers: true,
		addDateStamp: true,
		password: "",
	});

	// Derived state
	const totalSlides = slides.length;
	const backupSlides = slides.filter((s) => s.isHidden).length;
	const slidesWithNotes = slides.filter((s) => s.speakerNotes).length;

	const formatConfig = FORMAT_CONFIG[format];

	// Handlers
	const handleExport = useCallback(async () => {
		setIsExporting(true);
		setExportProgress(0);
		setExportError(null);
		setExportSuccess(false);

		try {
			// Simulate progress for UX
			const progressInterval = setInterval(() => {
				setExportProgress((prev) => Math.min(prev + 10, 90));
			}, 300);

			const result = await exportPresentation(presentation.id, format);

			clearInterval(progressInterval);

			if (result.success) {
				setExportProgress(100);
				setExportSuccess(true);

				// Trigger download
				if (result.data.downloadUrl) {
					const link = document.createElement("a");
					link.href = result.data.downloadUrl;
					link.download = result.data.filename ?? `${presentation.title}.${format}`;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
				}
			} else {
				setExportError(result.error || "Export failed. Please try again.");
			}
		} catch (error) {
			setExportError("An unexpected error occurred.");
		} finally {
			setIsExporting(false);
		}
	}, [presentation, format]);

	const handleOptionChange = (key: keyof typeof options, value: boolean | string) => {
		setOptions((prev) => ({ ...prev, [key]: value }));
	};

	const resetAndClose = () => {
		setExportProgress(0);
		setExportError(null);
		setExportSuccess(false);
		onClose();
	};

	return (
		<TooltipProvider>
			<Dialog open onOpenChange={resetAndClose}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Download className="h-5 w-5" />
							Export Presentation
						</DialogTitle>
						<DialogDescription>
							Choose format and options for exporting "{presentation.title}"
						</DialogDescription>
					</DialogHeader>

					{/* Export Progress / Success / Error States */}
					{isExporting && (
						<div className="py-8">
							<div className="text-center mb-4">
								<RefreshCw className="h-12 w-12 mx-auto text-primary animate-spin mb-3" />
								<p className="font-medium">Exporting...</p>
								<p className="text-sm text-muted-foreground">
									Please wait while we generate your {formatConfig.label}
								</p>
							</div>
							<Progress value={exportProgress} className="h-2" />
							<p className="text-center text-sm text-muted-foreground mt-2">
								{exportProgress}%
							</p>
						</div>
					)}

					{exportSuccess && !isExporting && (
						<div className="py-8 text-center">
							<CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
							<p className="text-xl font-medium text-green-600">Export Complete!</p>
							<p className="text-muted-foreground mt-2">
								Your {formatConfig.label} file is downloading.
							</p>
							<Button onClick={resetAndClose} className="mt-6">
								Done
							</Button>
						</div>
					)}

					{exportError && !isExporting && (
						<div className="py-8 text-center">
							<AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
							<p className="text-xl font-medium text-destructive">Export Failed</p>
							<p className="text-muted-foreground mt-2">{exportError}</p>
							<div className="flex justify-center gap-2 mt-6">
								<Button variant="outline" onClick={resetAndClose}>
									Cancel
								</Button>
								<Button onClick={handleExport}>
									Try Again
								</Button>
							</div>
						</div>
					)}

					{/* Main Export Options */}
					{!isExporting && !exportSuccess && !exportError && (
						<>
							<Tabs defaultValue="format" className="mt-2">
								<TabsList className="grid grid-cols-2">
									<TabsTrigger value="format">Format</TabsTrigger>
									<TabsTrigger value="options">Options</TabsTrigger>
								</TabsList>

								{/* Format Tab */}
								<TabsContent value="format" className="space-y-4 mt-4">
									{/* Format Selection */}
									<div className="grid grid-cols-3 gap-3">
										{(Object.entries(FORMAT_CONFIG) as [ExportFormat, typeof FORMAT_CONFIG.pptx][]).map(
											([key, config]) => (
												<Card
													key={key}
													className={cn(
														"cursor-pointer transition-all hover:border-primary/50",
														format === key && "ring-2 ring-primary border-primary"
													)}
													onClick={() => setFormat(key)}
												>
													<CardContent className="p-4 text-center">
														<config.icon className={cn(
															"h-8 w-8 mx-auto mb-2",
															format === key ? "text-primary" : "text-muted-foreground"
														)} />
														<p className="font-medium text-sm">{config.label}</p>
														<p className="text-xs text-muted-foreground mt-1">
															{config.description}
														</p>
													</CardContent>
												</Card>
											)
										)}
									</div>

									{/* Quality Selection */}
									<div>
										<span className="text-sm font-medium mb-2 block">Quality</span>
										<Select value={quality} onValueChange={(v) => setQuality(v as ExportQuality)}>
											<SelectTrigger aria-label="Quality">
												<SelectValue placeholder="Select quality" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="draft">
													<div className="flex items-center gap-2">
														<Eye className="h-4 w-4" />
														Draft - Lower resolution, faster export
													</div>
												</SelectItem>
												<SelectItem value="final">
													<div className="flex items-center gap-2">
														<CheckCircle className="h-4 w-4" />
														Final - High resolution, optimized
													</div>
												</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Summary */}
									<Card className="bg-muted/50">
										<CardContent className="p-4">
											<h4 className="font-medium text-sm mb-2 flex items-center gap-2">
												<Layers className="h-4 w-4" />
												Export Summary
											</h4>
											<div className="grid grid-cols-2 gap-2 text-sm">
												<div className="flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													<span>{totalSlides} slides</span>
												</div>
												<div className="flex items-center gap-2">
													<MessageSquare className="h-4 w-4 text-muted-foreground" />
													<span>{slidesWithNotes} with notes</span>
												</div>
												{backupSlides > 0 && (
													<div className="flex items-center gap-2">
														<Layers className="h-4 w-4 text-muted-foreground" />
														<span>{backupSlides} backup slides</span>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								</TabsContent>

								{/* Options Tab */}
								<TabsContent value="options" className="space-y-4 mt-4">
									{/* Content Options */}
									<Card>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm flex items-center gap-2">
												<FileText className="h-4 w-4" />
												Content Options
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Checkbox
														id="speakerNotes"
														checked={options.includeSpeakerNotes}
														onCheckedChange={(c) =>
															handleOptionChange("includeSpeakerNotes", !!c)
														}
													/>
													<Label htmlFor="speakerNotes" className="text-sm">
														Include speaker notes
													</Label>
												</div>
												<Badge variant="secondary">{slidesWithNotes} slides</Badge>
											</div>

											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Checkbox
														id="annotations"
														checked={options.includeAnnotations}
														onCheckedChange={(c) =>
															handleOptionChange("includeAnnotations", !!c)
														}
													/>
													<Label htmlFor="annotations" className="text-sm">
														Include annotations
													</Label>
												</div>
											</div>

											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Checkbox
														id="qa"
														checked={options.includeQA}
														onCheckedChange={(c) =>
															handleOptionChange("includeQA", !!c)
														}
													/>
													<Label htmlFor="qa" className="text-sm">
														Include Q&A preparation
													</Label>
												</div>
												<HelpCircle className="h-4 w-4 text-muted-foreground" />
											</div>

											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Checkbox
														id="timing"
														checked={options.includeTimingNotes}
														onCheckedChange={(c) =>
															handleOptionChange("includeTimingNotes", !!c)
														}
													/>
													<Label htmlFor="timing" className="text-sm">
														Include timing notes
													</Label>
												</div>
												<Clock className="h-4 w-4 text-muted-foreground" />
											</div>

											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Checkbox
														id="backup"
														checked={options.includeBackupSlides}
														onCheckedChange={(c) =>
															handleOptionChange("includeBackupSlides", !!c)
														}
														disabled={backupSlides === 0}
													/>
													<Label
														htmlFor="backup"
														className={cn(
															"text-sm",
															backupSlides === 0 && "text-muted-foreground"
														)}
													>
														Include backup/hidden slides
													</Label>
												</div>
												{backupSlides > 0 && (
													<Badge variant="secondary">{backupSlides} slides</Badge>
												)}
											</div>
										</CardContent>
									</Card>

									{/* Formatting Options */}
									<Card>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm flex items-center gap-2">
												<Settings className="h-4 w-4" />
												Formatting
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="flex items-center gap-2">
												<Checkbox
													id="pageNumbers"
													checked={options.addPageNumbers}
													onCheckedChange={(c) =>
														handleOptionChange("addPageNumbers", !!c)
													}
												/>
												<Label htmlFor="pageNumbers" className="text-sm">
													Add page numbers
												</Label>
											</div>

											<div className="flex items-center gap-2">
												<Checkbox
													id="dateStamp"
													checked={options.addDateStamp}
													onCheckedChange={(c) =>
														handleOptionChange("addDateStamp", !!c)
													}
												/>
												<Label htmlFor="dateStamp" className="text-sm">
													Add date stamp
												</Label>
											</div>
										</CardContent>
									</Card>

									{/* Security Options (PDF only) */}
									{format === "pdf" && (
										<Card>
											<CardHeader className="pb-2">
												<CardTitle className="text-sm flex items-center gap-2">
													<Lock className="h-4 w-4" />
													Security
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div>
													<Label htmlFor="password" className="text-sm">
														Password Protection (optional)
													</Label>
													<Input
														id="password"
														type="password"
														placeholder="Leave empty for no password"
														value={options.password}
														onChange={(e) =>
															handleOptionChange("password", e.target.value)
														}
														className="mt-1"
													/>
												</div>
											</CardContent>
										</Card>
									)}
								</TabsContent>
							</Tabs>

							<DialogFooter className="mt-4">
								<Button variant="outline" onClick={onClose}>
									Cancel
								</Button>
								<Button onClick={handleExport}>
									<Download className="h-4 w-4 mr-2" />
									Export {formatConfig.label}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</TooltipProvider>
	);
}
