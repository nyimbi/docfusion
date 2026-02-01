"use client";

/**
 * Ghost Theme Generator Component
 *
 * AI-powered generation of ethical ghost themes that highlight
 * competitor weaknesses without directly naming them.
 */

import * as React from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
	Ghost,
	Sparkles,
	RefreshCw,
	Save,
	Copy,
	Check,
	AlertTriangle,
	Building2,
	Loader2,
	ShieldCheck,
	Target,
	Info,
} from "lucide-react";
import {
	listCompetitors,
	getCompetitor,
	generateGhostTheme,
	createGhostTheme,
} from "@/lib/actions/competitive";
import type {
	Competitor,
	GhostTheme,
	GhostThemeGeneratorProps,
	GhostCategory,
} from "@/lib/types/competitive";

const GHOST_CATEGORIES: Array<{ value: GhostCategory; label: string; description: string }> = [
	{ value: "technical", label: "Technical", description: "Technical capability gaps" },
	{ value: "management", label: "Management", description: "Management approach weaknesses" },
	{ value: "past_performance", label: "Past Performance", description: "Performance history concerns" },
	{ value: "cost", label: "Cost/Pricing", description: "Cost-related vulnerabilities" },
	{ value: "schedule", label: "Schedule", description: "Timeline and delivery risks" },
	{ value: "risk", label: "Risk", description: "General risk factors" },
];

interface ExtendedGhostThemeGeneratorProps extends Omit<GhostThemeGeneratorProps, "competitorId"> {
	competitorId?: string;
	className?: string;
}

export function GhostThemeGenerator({
	competitorId: initialCompetitorId,
	onGenerated,
	className,
}: ExtendedGhostThemeGeneratorProps) {
	// State
	const [competitors, setCompetitors] = useState<Competitor[]>([]);
	const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>(initialCompetitorId ?? "");
	const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
	const [selectedWeakness, setSelectedWeakness] = useState<string>("");
	const [customWeakness, setCustomWeakness] = useState("");
	const [generatedTheme, setGeneratedTheme] = useState<string>("");
	const [editedTheme, setEditedTheme] = useState<string>("");
	const [category, setCategory] = useState<GhostCategory>("technical");
	const [suggestedPlacement, setSuggestedPlacement] = useState("");
	const [isEthicalChecked, setIsEthicalChecked] = useState(false);
	const [complianceNotes, setComplianceNotes] = useState("");

	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

	// Load competitors
	useEffect(() => {
		async function load() {
			const result = await listCompetitors();
			if (result.success) {
				setCompetitors(result.data);

				// If initialCompetitorId provided, load that competitor
				if (initialCompetitorId) {
					const competitorResult = await getCompetitor(initialCompetitorId);
					if (competitorResult.success) {
						setSelectedCompetitor(competitorResult.data);
					}
				}
			}
			setIsLoading(false);
		}
		load();
	}, [initialCompetitorId]);

	// Load competitor details when selection changes
	useEffect(() => {
		if (!selectedCompetitorId || selectedCompetitorId === selectedCompetitor?.id) return;

		async function loadCompetitor() {
			const result = await getCompetitor(selectedCompetitorId);
			if (result.success) {
				setSelectedCompetitor(result.data);
				setSelectedWeakness("");
				setGeneratedTheme("");
				setEditedTheme("");
			}
		}
		loadCompetitor();
	}, [selectedCompetitorId, selectedCompetitor?.id]);

	/**
	 * Generate ghost theme using AI
	 */
	const handleGenerate = useCallback(async () => {
		if (!selectedCompetitorId) return;

		const weakness = selectedWeakness === "custom" ? customWeakness : selectedWeakness;
		if (!weakness.trim()) {
			setError("Please select or enter a weakness");
			return;
		}

		setError(null);
		setGeneratedTheme("");
		setEditedTheme("");

		startTransition(async () => {
			const result = await generateGhostTheme(selectedCompetitorId, weakness);
			if (result.success) {
				setGeneratedTheme(result.data);
				setEditedTheme(result.data);
			} else {
				setError(result.error);
			}
		});
	}, [selectedCompetitorId, selectedWeakness, customWeakness]);

	/**
	 * Copy theme to clipboard
	 */
	const handleCopy = useCallback(async () => {
		const text = editedTheme || generatedTheme;
		if (!text) return;

		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [editedTheme, generatedTheme]);

	/**
	 * Save ghost theme to database
	 */
	const handleSave = useCallback(async () => {
		if (!selectedCompetitorId || !editedTheme) return;
		if (!isEthicalChecked) {
			setError("Please confirm ethical compliance before saving");
			return;
		}

		const weakness = selectedWeakness === "custom" ? customWeakness : selectedWeakness;

		startTransition(async () => {
			const result = await createGhostTheme({
				competitorId: selectedCompetitorId,
				weakness,
				ghostLanguage: editedTheme,
				suggestedPlacement: suggestedPlacement || undefined,
				category,
				complianceNotes: complianceNotes || undefined,
			});

			if (result.success) {
				setIsSaveDialogOpen(false);
				onGenerated?.(result.data);
				// Reset for next generation
				setGeneratedTheme("");
				setEditedTheme("");
				setSelectedWeakness("");
				setCustomWeakness("");
				setIsEthicalChecked(false);
			} else {
				setError(result.error);
			}
		});
	}, [
		selectedCompetitorId,
		editedTheme,
		isEthicalChecked,
		selectedWeakness,
		customWeakness,
		suggestedPlacement,
		category,
		complianceNotes,
		onGenerated,
	]);

	if (isLoading) {
		return (
			<Card className={className}>
				<CardContent className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Info Banner */}
			<Alert>
				<Info className="h-4 w-4" />
				<AlertTitle>What is a Ghost Theme?</AlertTitle>
				<AlertDescription>
					Ghost themes are proposal language that highlights a competitor's weakness
					<strong> without naming them directly</strong>. The language focuses on your
					strengths in areas where competitors are weak, allowing evaluators to draw their
					own conclusions.
				</AlertDescription>
			</Alert>

			{/* Configuration Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Ghost className="h-5 w-5" />
						Ghost Theme Generator
					</CardTitle>
					<CardDescription>
						Generate ethical, professional language to highlight competitor weaknesses
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Competitor Selection */}
					<div className="space-y-2">
						<Label>Select Competitor</Label>
						<Select
							value={selectedCompetitorId}
							onValueChange={setSelectedCompetitorId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Choose a competitor" />
							</SelectTrigger>
							<SelectContent>
								{competitors.map((competitor) => (
									<SelectItem key={competitor.id} value={competitor.id}>
										<div className="flex items-center gap-2">
											<Building2 className="h-4 w-4" />
											{competitor.name}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Weakness Selection */}
					{selectedCompetitor && (
						<div className="space-y-2">
							<Label>Select Weakness to Ghost</Label>
							{(selectedCompetitor.weaknesses ?? []).length > 0 ? (
								<div className="space-y-2">
									<Select
										value={selectedWeakness}
										onValueChange={setSelectedWeakness}
									>
										<SelectTrigger>
											<SelectValue placeholder="Choose a known weakness" />
										</SelectTrigger>
										<SelectContent>
											{(selectedCompetitor.weaknesses ?? []).map((weakness, idx) => (
												<SelectItem key={idx} value={weakness}>
													<div className="flex items-center gap-2">
														<Target className="h-4 w-4 text-red-500" />
														{weakness}
													</div>
												</SelectItem>
											))}
											<SelectItem value="custom">
												<div className="flex items-center gap-2">
													<Sparkles className="h-4 w-4" />
													Enter custom weakness...
												</div>
											</SelectItem>
										</SelectContent>
									</Select>

									{selectedWeakness === "custom" && (
										<Textarea
											placeholder="Describe the competitor weakness..."
											value={customWeakness}
											onChange={(e) => setCustomWeakness(e.target.value)}
											className="min-h-[80px]"
										/>
									)}
								</div>
							) : (
								<div className="space-y-2">
									<Alert variant="warning">
										<AlertTriangle className="h-4 w-4" />
										<AlertDescription>
											No weaknesses recorded for this competitor. Enter a custom weakness below.
										</AlertDescription>
									</Alert>
									<Textarea
										placeholder="Describe the competitor weakness to ghost..."
										value={customWeakness}
										onChange={(e) => {
											setCustomWeakness(e.target.value);
											setSelectedWeakness("custom");
										}}
										className="min-h-[80px]"
									/>
								</div>
							)}
						</div>
					)}

					{/* Category Selection */}
					<div className="space-y-2">
						<Label>Theme Category</Label>
						<Select value={category} onValueChange={(v) => setCategory(v as GhostCategory)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{GHOST_CATEGORIES.map((cat) => (
									<SelectItem key={cat.value} value={cat.value}>
										<div className="flex flex-col">
											<span>{cat.label}</span>
											<span className="text-xs text-muted-foreground">
												{cat.description}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Generate Button */}
					<Button
						onClick={handleGenerate}
						disabled={isPending || !selectedCompetitorId || (!selectedWeakness && !customWeakness)}
						className="w-full"
					>
						{isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								Generate Ghost Theme
							</>
						)}
					</Button>
				</CardContent>
			</Card>

			{/* Generated Theme Card */}
			{(generatedTheme || editedTheme) && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span className="flex items-center gap-2">
								<Ghost className="h-5 w-5 text-purple-600" />
								Generated Ghost Theme
							</span>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={handleGenerate}
									disabled={isPending}
								>
									<RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
								</Button>
								<Button variant="ghost" size="sm" onClick={handleCopy}>
									{copied ? (
										<Check className="h-4 w-4 text-green-600" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
						</CardTitle>
						<CardDescription>
							Review and edit the generated language before using or saving
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						{/* Original Generated */}
						{generatedTheme && generatedTheme !== editedTheme && (
							<div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
								<Label className="text-xs">Original:</Label>
								<p className="mt-1">{generatedTheme}</p>
							</div>
						)}

						{/* Editable Theme */}
						<Textarea
							value={editedTheme}
							onChange={(e) => setEditedTheme(e.target.value)}
							className="min-h-[120px]"
							placeholder="Edit the generated theme..."
						/>

						{/* Weakness Badge */}
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">Targeting:</span>
							<Badge variant="destructive">
								{selectedWeakness === "custom" ? customWeakness : selectedWeakness}
							</Badge>
							<Badge variant="secondary" className="capitalize">
								{category}
							</Badge>
						</div>
					</CardContent>

					<CardFooter className="flex justify-between">
						<div className="flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-green-600" />
							<span className="text-sm text-muted-foreground">
								This language does not name the competitor
							</span>
						</div>

						<Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
							<DialogTrigger asChild>
								<Button>
									<Save className="h-4 w-4 mr-2" />
									Save to Library
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Save Ghost Theme</DialogTitle>
									<DialogDescription>
										Confirm the theme is ethical and add any placement notes
									</DialogDescription>
								</DialogHeader>

								<div className="space-y-4 py-4">
									{/* Preview */}
									<div className="p-3 bg-muted rounded-lg">
										<Label className="text-xs text-muted-foreground">Theme Preview:</Label>
										<p className="text-sm mt-1">{editedTheme}</p>
									</div>

									{/* Suggested Placement */}
									<div className="space-y-2">
										<Label htmlFor="placement">Suggested Placement</Label>
										<Input
											id="placement"
											placeholder="e.g., Executive Summary, Technical Approach"
											value={suggestedPlacement}
											onChange={(e) => setSuggestedPlacement(e.target.value)}
										/>
									</div>

									{/* Compliance Notes */}
									<div className="space-y-2">
										<Label htmlFor="compliance">Compliance Notes (Optional)</Label>
										<Textarea
											id="compliance"
											placeholder="Any notes about ethical considerations..."
											value={complianceNotes}
											onChange={(e) => setComplianceNotes(e.target.value)}
											className="min-h-[60px]"
										/>
									</div>

									{/* Ethical Confirmation */}
									<div className="flex items-start gap-3 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950">
										<Checkbox
											id="ethical"
											checked={isEthicalChecked}
											onCheckedChange={(checked) => setIsEthicalChecked(checked === true)}
										/>
										<div className="space-y-1">
											<Label htmlFor="ethical" className="font-medium cursor-pointer">
												I confirm this ghost theme is ethical
											</Label>
											<p className="text-xs text-muted-foreground">
												The language does not directly name or unfairly disparage competitors,
												focuses on our strengths, and is factually accurate.
											</p>
										</div>
									</div>
								</div>

								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setIsSaveDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSave}
										disabled={isPending || !isEthicalChecked}
									>
										{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
										Save Ghost Theme
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</CardFooter>
				</Card>
			)}

			{/* Best Practices */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Ghost Theme Best Practices</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="text-sm text-muted-foreground space-y-2">
						<li className="flex items-start gap-2">
							<Check className="h-4 w-4 text-green-600 mt-0.5" />
							<span>Focus on your positive capabilities, not competitor negatives</span>
						</li>
						<li className="flex items-start gap-2">
							<Check className="h-4 w-4 text-green-600 mt-0.5" />
							<span>Use verifiable facts and quantifiable metrics</span>
						</li>
						<li className="flex items-start gap-2">
							<Check className="h-4 w-4 text-green-600 mt-0.5" />
							<span>Never name competitors or use identifying details</span>
						</li>
						<li className="flex items-start gap-2">
							<Check className="h-4 w-4 text-green-600 mt-0.5" />
							<span>Position themes near relevant evaluation criteria</span>
						</li>
						<li className="flex items-start gap-2">
							<Check className="h-4 w-4 text-green-600 mt-0.5" />
							<span>Allow evaluators to draw their own conclusions</span>
						</li>
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}

export default GhostThemeGenerator;
