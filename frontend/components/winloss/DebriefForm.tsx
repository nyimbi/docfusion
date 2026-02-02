"use client";

/**
 * Debrief Form Component
 *
 * Create and edit form for win/loss debrief records.
 * Captures outcome, scores, evaluator feedback, strengths/weaknesses,
 * lessons learned, and action items.
 */

import { useState, useTransition, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Trophy,
	XCircle,
	MinusCircle,
	Ban,
	FileText,
	Target,
	DollarSign,
	Users,
	Loader2,
	Plus,
	X,
	AlertTriangle,
} from "lucide-react";
import { createDebrief, updateDebrief } from "@/lib/actions/winloss";
import type { Debrief, DebriefOutcome } from "@/lib/types/winloss";

// Form validation schema
const debriefFormSchema = z.object({
	outcome: z.enum(["win", "loss", "no_award", "cancelled"]),
	debriefDate: z.string().optional(),
	debriefType: z.enum(["written", "oral", "none"]).optional(),

	// Scores
	technicalScore: z.coerce.number().min(0).optional(),
	technicalMaxScore: z.coerce.number().min(0).optional(),
	managementScore: z.coerce.number().min(0).optional(),
	managementMaxScore: z.coerce.number().min(0).optional(),
	pastPerfScore: z.coerce.number().min(0).optional(),
	pastPerfMaxScore: z.coerce.number().min(0).optional(),
	costScore: z.coerce.number().min(0).optional(),
	costMaxScore: z.coerce.number().min(0).optional(),

	// Ranking
	overallRanking: z.coerce.number().int().min(1).optional(),
	totalBidders: z.coerce.number().int().min(1).optional(),

	// Winner info
	winnerName: z.string().max(500).optional(),
	winnerId: z.string().uuid().optional().or(z.literal("")),
	winningPrice: z.coerce.number().min(0).optional(),

	// Feedback
	evaluatorFeedback: z.string().optional(),
	strengthsIdentified: z.array(z.string()).optional(),
	weaknessesIdentified: z.array(z.string()).optional(),

	// Financial
	proposalInvestment: z.coerce.number().min(0).optional(),
	contractValue: z.coerce.number().min(0).optional(),

	// Internal analysis
	internalAnalysis: z.string().optional(),
	lessonsLearned: z.array(z.string()).optional(),
});

type DebriefFormValues = z.input<typeof debriefFormSchema>;

interface DebriefFormProps {
	opportunityId: string;
	opportunityTitle?: string;
	debrief?: Debrief;
	onSubmit?: (result: { success: boolean; data?: Debrief; error?: string }) => void;
	onCancel?: () => void;
	className?: string;
}

const OUTCOME_OPTIONS: { value: DebriefOutcome; label: string; icon: React.ReactNode; color: string }[] = [
	{ value: "win", label: "Won", icon: <Trophy className="h-4 w-4" />, color: "text-green-600" },
	{ value: "loss", label: "Lost", icon: <XCircle className="h-4 w-4" />, color: "text-red-600" },
	{ value: "no_award", label: "No Award", icon: <MinusCircle className="h-4 w-4" />, color: "text-yellow-600" },
	{ value: "cancelled", label: "Cancelled", icon: <Ban className="h-4 w-4" />, color: "text-gray-600" },
];

export function DebriefForm({
	opportunityId,
	opportunityTitle,
	debrief,
	onSubmit,
	onCancel,
	className,
}: DebriefFormProps) {
	const [isPending, startTransition] = useTransition();
	const [activeTab, setActiveTab] = useState("outcome");
	const [strengthInput, setStrengthInput] = useState("");
	const [weaknessInput, setWeaknessInput] = useState("");
	const [lessonInput, setLessonInput] = useState("");

	const isEditing = !!debrief;

	const form = useForm<DebriefFormValues>({
		resolver: zodResolver(debriefFormSchema),
		defaultValues: {
			outcome: (debrief?.outcome as DebriefOutcome) ?? "loss",
			debriefDate: debrief?.debriefDate
				? new Date(debrief.debriefDate).toISOString().split("T")[0]
				: "",
			debriefType: debrief?.debriefType as DebriefFormValues["debriefType"],
			technicalScore: debrief?.technicalScore ?? undefined,
			technicalMaxScore: debrief?.technicalMaxScore ?? undefined,
			managementScore: debrief?.managementScore ?? undefined,
			managementMaxScore: debrief?.managementMaxScore ?? undefined,
			pastPerfScore: debrief?.pastPerfScore ?? undefined,
			pastPerfMaxScore: debrief?.pastPerfMaxScore ?? undefined,
			costScore: debrief?.costScore ?? undefined,
			costMaxScore: debrief?.costMaxScore ?? undefined,
			overallRanking: debrief?.overallRanking ?? undefined,
			totalBidders: debrief?.totalBidders ?? undefined,
			winnerName: debrief?.winnerName ?? "",
			winnerId: debrief?.winnerId ?? "",
			winningPrice: debrief?.winningPrice ?? undefined,
			evaluatorFeedback: debrief?.evaluatorFeedback ?? "",
			strengthsIdentified: (debrief?.strengthsIdentified as string[]) ?? [],
			weaknessesIdentified: (debrief?.weaknessesIdentified as string[]) ?? [],
			proposalInvestment: debrief?.proposalInvestment ?? undefined,
			contractValue: debrief?.contractValue ?? undefined,
			internalAnalysis: debrief?.internalAnalysis ?? "",
			lessonsLearned: (debrief?.lessonsLearned as string[]) ?? [],
		},
	});

	const outcome = form.watch("outcome");
	const strengths = form.watch("strengthsIdentified") ?? [];
	const weaknesses = form.watch("weaknessesIdentified") ?? [];
	const lessons = form.watch("lessonsLearned") ?? [];

	const handleSubmit = useCallback(
		(data: DebriefFormValues) => {
			startTransition(async () => {
				try {
					const payload = {
						opportunityId,
						outcome: data.outcome,
						debriefDate: data.debriefDate ? new Date(data.debriefDate) : undefined,
						debriefType: data.debriefType,
						technicalScore: data.technicalScore as number | undefined,
						technicalMaxScore: data.technicalMaxScore as number | undefined,
						managementScore: data.managementScore as number | undefined,
						managementMaxScore: data.managementMaxScore as number | undefined,
						pastPerfScore: data.pastPerfScore as number | undefined,
						pastPerfMaxScore: data.pastPerfMaxScore as number | undefined,
						costScore: data.costScore as number | undefined,
						costMaxScore: data.costMaxScore as number | undefined,
						overallRanking: data.overallRanking as number | undefined,
						totalBidders: data.totalBidders as number | undefined,
						winnerName: data.winnerName,
						winnerId: data.winnerId || undefined,
						winningPrice: data.winningPrice as number | undefined,
						evaluatorFeedback: data.evaluatorFeedback,
						strengthsIdentified: data.strengthsIdentified ?? [],
						weaknessesIdentified: data.weaknessesIdentified ?? [],
						proposalInvestment: data.proposalInvestment as number | undefined,
						contractValue: data.contractValue as number | undefined,
						internalAnalysis: data.internalAnalysis,
						lessonsLearned: data.lessonsLearned ?? [],
					};

					const result = isEditing
						? await updateDebrief(debrief.id, payload as Parameters<typeof updateDebrief>[1])
						: await createDebrief(payload as Parameters<typeof createDebrief>[0]);

					onSubmit?.(result as { success: boolean; data?: Debrief; error?: string });
				} catch (error) {
					onSubmit?.({
						success: false,
						error: error instanceof Error ? error.message : "Failed to save debrief",
					});
				}
			});
		},
		[opportunityId, isEditing, debrief?.id, onSubmit]
	);

	const addStrength = useCallback(() => {
		if (strengthInput.trim()) {
			const current = form.getValues("strengthsIdentified") ?? [];
			form.setValue("strengthsIdentified", [...current, strengthInput.trim()]);
			setStrengthInput("");
		}
	}, [form, strengthInput]);

	const removeStrength = useCallback(
		(index: number) => {
			const current = form.getValues("strengthsIdentified") ?? [];
			form.setValue(
				"strengthsIdentified",
				current.filter((_, i) => i !== index)
			);
		},
		[form]
	);

	const addWeakness = useCallback(() => {
		if (weaknessInput.trim()) {
			const current = form.getValues("weaknessesIdentified") ?? [];
			form.setValue("weaknessesIdentified", [...current, weaknessInput.trim()]);
			setWeaknessInput("");
		}
	}, [form, weaknessInput]);

	const removeWeakness = useCallback(
		(index: number) => {
			const current = form.getValues("weaknessesIdentified") ?? [];
			form.setValue(
				"weaknessesIdentified",
				current.filter((_, i) => i !== index)
			);
		},
		[form]
	);

	const addLesson = useCallback(() => {
		if (lessonInput.trim()) {
			const current = form.getValues("lessonsLearned") ?? [];
			form.setValue("lessonsLearned", [...current, lessonInput.trim()]);
			setLessonInput("");
		}
	}, [form, lessonInput]);

	const removeLesson = useCallback(
		(index: number) => {
			const current = form.getValues("lessonsLearned") ?? [];
			form.setValue(
				"lessonsLearned",
				current.filter((_, i) => i !== index)
			);
		},
		[form]
	);

	const calculateScorePercentage = (score?: number, max?: number): string => {
		if (!score || !max || max === 0) return "-";
		return `${Math.round((score / max) * 100)}%`;
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className={cn("space-y-6", className)}
			>
				{/* Header */}
				{opportunityTitle && (
					<div className="border-b pb-4">
						<h2 className="text-lg font-semibold">
							{isEditing ? "Edit Debrief" : "Create Debrief"}
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							{opportunityTitle}
						</p>
					</div>
				)}

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="outcome">Outcome</TabsTrigger>
						<TabsTrigger value="scores">Scores</TabsTrigger>
						<TabsTrigger value="feedback">Feedback</TabsTrigger>
						<TabsTrigger value="financial">Financial</TabsTrigger>
						<TabsTrigger value="analysis">Analysis</TabsTrigger>
					</TabsList>

					{/* Outcome Tab */}
					<TabsContent value="outcome" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Target className="h-5 w-5" />
									Outcome Details
								</CardTitle>
								<CardDescription>
									Record the final outcome of this opportunity
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Outcome Selection */}
								<FormField
									control={form.control}
									name="outcome"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Outcome *</FormLabel>
											<div className="grid grid-cols-4 gap-3">
												{OUTCOME_OPTIONS.map((option) => (
													<button
														key={option.value}
														type="button"
														onClick={() => field.onChange(option.value)}
														className={cn(
															"flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
															field.value === option.value
																? "border-primary bg-primary/5"
																: "border-muted hover:border-muted-foreground/50"
														)}
													>
														<span className={option.color}>{option.icon}</span>
														<span className="text-sm font-medium">{option.label}</span>
													</button>
												))}
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="debriefDate"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Debrief Date</FormLabel>
												<FormControl>
													<Input type="date" {...field} />
												</FormControl>
												<FormDescription>
													When the debrief was received
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="debriefType"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Debrief Type</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select type" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="written">Written</SelectItem>
														<SelectItem value="oral">Oral</SelectItem>
														<SelectItem value="none">None Provided</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Ranking */}
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="overallRanking"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Our Ranking</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={1}
														placeholder="e.g., 2"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormDescription>
													Our position in the evaluation
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="totalBidders"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Total Bidders</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={1}
														placeholder="e.g., 5"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormDescription>
													Number of competitors
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Winner info (for losses) */}
								{outcome !== "win" && (
									<div className="border-t pt-4">
										<h4 className="font-medium mb-4">Winner Information</h4>
										<div className="grid grid-cols-2 gap-4">
											<FormField
												control={form.control}
												name="winnerName"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Winner Name</FormLabel>
														<FormControl>
															<Input
																placeholder="Winning company name"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name="winningPrice"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Winning Price</FormLabel>
														<FormControl>
															<Input
																type="number"
																min={0}
																placeholder="Contract value"
																name={field.name}
																ref={field.ref}
																onChange={field.onChange}
																onBlur={field.onBlur}
																disabled={field.disabled}
																value={String(field.value ?? "")}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* Scores Tab */}
					<TabsContent value="scores" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Target className="h-5 w-5" />
									Evaluation Scores
								</CardTitle>
								<CardDescription>
									Record scores from each evaluation factor
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Technical Score */}
								<div className="grid grid-cols-3 gap-4 items-end">
									<FormField
										control={form.control}
										name="technicalScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Technical Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Score"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="technicalMaxScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Max Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Max"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="pb-2 text-sm text-muted-foreground">
										{calculateScorePercentage(
											form.watch("technicalScore") as number | undefined,
											form.watch("technicalMaxScore") as number | undefined
										)}
									</div>
								</div>

								{/* Management Score */}
								<div className="grid grid-cols-3 gap-4 items-end">
									<FormField
										control={form.control}
										name="managementScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Management Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Score"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="managementMaxScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Max Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Max"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="pb-2 text-sm text-muted-foreground">
										{calculateScorePercentage(
											form.watch("managementScore") as number | undefined,
											form.watch("managementMaxScore") as number | undefined
										)}
									</div>
								</div>

								{/* Past Performance Score */}
								<div className="grid grid-cols-3 gap-4 items-end">
									<FormField
										control={form.control}
										name="pastPerfScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Past Performance Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Score"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="pastPerfMaxScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Max Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Max"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="pb-2 text-sm text-muted-foreground">
										{calculateScorePercentage(
											form.watch("pastPerfScore") as number | undefined,
											form.watch("pastPerfMaxScore") as number | undefined
										)}
									</div>
								</div>

								{/* Cost Score */}
								<div className="grid grid-cols-3 gap-4 items-end">
									<FormField
										control={form.control}
										name="costScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Cost Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Score"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="costMaxScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Max Score</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														placeholder="Max"
														name={field.name}
														ref={field.ref}
														onChange={field.onChange}
														onBlur={field.onBlur}
														disabled={field.disabled}
														value={String(field.value ?? "")}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="pb-2 text-sm text-muted-foreground">
										{calculateScorePercentage(
											form.watch("costScore") as number | undefined,
											form.watch("costMaxScore") as number | undefined
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Feedback Tab */}
					<TabsContent value="feedback" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Evaluator Feedback
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								<FormField
									control={form.control}
									name="evaluatorFeedback"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Feedback Summary</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Enter evaluator comments and feedback..."
													className="min-h-[150px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Strengths */}
								<div className="space-y-3">
									<FormLabel>Strengths Identified</FormLabel>
									<div className="flex gap-2">
										<Input
											placeholder="Add a strength..."
											value={strengthInput}
											onChange={(e) => setStrengthInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													addStrength();
												}
											}}
										/>
										<Button
											type="button"
											variant="outline"
											onClick={addStrength}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
									<div className="flex flex-wrap gap-2">
										{strengths.map((strength, index) => (
											<Badge
												key={index}
												variant="secondary"
												className="bg-green-100 text-green-800 flex items-center gap-1"
											>
												{strength}
												<button
													type="button"
													onClick={() => removeStrength(index)}
													className="hover:text-green-600"
												>
													<X className="h-3 w-3" />
												</button>
											</Badge>
										))}
									</div>
								</div>

								{/* Weaknesses */}
								<div className="space-y-3">
									<FormLabel>Weaknesses Identified</FormLabel>
									<div className="flex gap-2">
										<Input
											placeholder="Add a weakness..."
											value={weaknessInput}
											onChange={(e) => setWeaknessInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													addWeakness();
												}
											}}
										/>
										<Button
											type="button"
											variant="outline"
											onClick={addWeakness}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
									<div className="flex flex-wrap gap-2">
										{weaknesses.map((weakness, index) => (
											<Badge
												key={index}
												variant="secondary"
												className="bg-red-100 text-red-800 flex items-center gap-1"
											>
												{weakness}
												<button
													type="button"
													onClick={() => removeWeakness(index)}
													className="hover:text-red-600"
												>
													<X className="h-3 w-3" />
												</button>
											</Badge>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Financial Tab */}
					<TabsContent value="financial" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<DollarSign className="h-5 w-5" />
									Financial Information
								</CardTitle>
								<CardDescription>
									Track investment and contract value for ROI analysis
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="proposalInvestment"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Proposal Investment</FormLabel>
												<FormControl>
													<div className="relative">
														<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
														<Input
															type="number"
															min={0}
															placeholder="0"
															className="pl-9"
															name={field.name}
															ref={field.ref}
															onChange={field.onChange}
															onBlur={field.onBlur}
															disabled={field.disabled}
															value={String(field.value ?? "")}
														/>
													</div>
												</FormControl>
												<FormDescription>
													Total cost to develop the proposal
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="contractValue"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Contract Value</FormLabel>
												<FormControl>
													<div className="relative">
														<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
														<Input
															type="number"
															min={0}
															placeholder="0"
															className="pl-9"
															name={field.name}
															ref={field.ref}
															onChange={field.onChange}
															onBlur={field.onBlur}
															disabled={field.disabled}
															value={String(field.value ?? "")}
														/>
													</div>
												</FormControl>
												<FormDescription>
													{outcome === "win"
														? "Value of won contract"
														: "Estimated contract value"}
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* ROI Preview */}
								{(form.watch("proposalInvestment") as number) && (form.watch("contractValue") as number) && (
									<div className="p-4 bg-muted rounded-lg">
										<h4 className="font-medium mb-2">ROI Preview</h4>
										<div className="grid grid-cols-3 gap-4 text-sm">
											<div>
												<span className="text-muted-foreground">Investment:</span>
												<p className="font-medium">
													${((form.watch("proposalInvestment") as number) ?? 0).toLocaleString()}
												</p>
											</div>
											<div>
												<span className="text-muted-foreground">Contract Value:</span>
												<p className="font-medium">
													${((form.watch("contractValue") as number) ?? 0).toLocaleString()}
												</p>
											</div>
											<div>
												<span className="text-muted-foreground">
													{outcome === "win" ? "ROI:" : "Potential ROI:"}
												</span>
												<p
													className={cn(
														"font-medium",
														outcome === "win"
															? "text-green-600"
															: "text-muted-foreground"
													)}
												>
													{Math.round(
														((((form.watch("contractValue") as number) ?? 0) -
															((form.watch("proposalInvestment") as number) ?? 0)) /
															((form.watch("proposalInvestment") as number) || 1)) *
															100
													)}
													%
												</p>
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* Analysis Tab */}
					<TabsContent value="analysis" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="h-5 w-5" />
									Internal Analysis
								</CardTitle>
								<CardDescription>
									Capture internal insights and lessons learned
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<FormField
									control={form.control}
									name="internalAnalysis"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Internal Analysis</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Document your team's analysis of the outcome..."
													className="min-h-[150px]"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												Team observations, root cause analysis, and insights
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Lessons Learned */}
								<div className="space-y-3">
									<FormLabel>Lessons Learned</FormLabel>
									<div className="flex gap-2">
										<Input
											placeholder="Add a lesson learned..."
											value={lessonInput}
											onChange={(e) => setLessonInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													addLesson();
												}
											}}
										/>
										<Button
											type="button"
											variant="outline"
											onClick={addLesson}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
									<div className="space-y-2">
										{lessons.map((lesson, index) => (
											<div
												key={index}
												className="flex items-start gap-2 p-3 bg-muted rounded-lg"
											>
												<AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
												<span className="text-sm flex-1">{lesson}</span>
												<button
													type="button"
													onClick={() => removeLesson(index)}
													className="text-muted-foreground hover:text-foreground"
												>
													<X className="h-4 w-4" />
												</button>
											</div>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{/* Form Actions */}
				<div className="flex justify-end gap-3 pt-4 border-t">
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
					)}
					<Button type="submit" disabled={isPending}>
						{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						{isEditing ? "Update Debrief" : "Create Debrief"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default DebriefForm;
