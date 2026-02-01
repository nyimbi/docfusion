"use client";

/**
 * Discriminator Editor Component
 *
 * Form for creating and editing discriminator statements with
 * proof points, evidence attachments, and competitor targeting.
 */

import * as React from "react";
import { useState, useTransition, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Target,
	FileText,
	Plus,
	X,
	Loader2,
	AlertCircle,
	Lightbulb,
	Award,
	Building2,
} from "lucide-react";
import {
	createDiscriminator,
	updateDiscriminator,
	listCompetitors,
} from "@/lib/actions/competitive";
import type { Discriminator, Competitor, CreateDiscriminatorInput, DiscriminatorType } from "@/lib/types/competitive";

// Form validation schema
const discriminatorFormSchema = z.object({
	statement: z.string().min(10, "Statement must be at least 10 characters"),
	shortVersion: z.string().max(200).optional(),
	proofPoints: z.array(z.string()).optional(),
	discriminatorType: z.enum([
		"capability",
		"experience",
		"approach",
		"team",
		"cost",
		"schedule",
		"innovation",
		"past_performance",
	]).optional(),
	category: z.string().max(200).optional(),
	supportingEvidence: z.array(
		z.object({
			type: z.enum(["contract", "metric", "testimonial", "case_study"]),
			description: z.string().min(1, "Description is required"),
			reference: z.string().optional(),
		})
	).optional(),
	effectiveAgainst: z.array(z.string()).optional(),
	applicableOpportunityTypes: z.array(z.string()).optional(),
	applicableNaicsCodes: z.array(z.string()).optional(),
});

type DiscriminatorFormValues = z.infer<typeof discriminatorFormSchema>;

interface DiscriminatorEditorProps {
	discriminator?: Discriminator;
	onSubmit?: (data: CreateDiscriminatorInput) => void;
	onCancel?: () => void;
	className?: string;
}

const DISCRIMINATOR_TYPES: Array<{ value: DiscriminatorType; label: string; description: string }> = [
	{ value: "capability", label: "Capability", description: "Technical or functional capability" },
	{ value: "experience", label: "Experience", description: "Relevant experience and track record" },
	{ value: "approach", label: "Approach", description: "Methodology or solution approach" },
	{ value: "team", label: "Team", description: "Personnel qualifications and team strength" },
	{ value: "cost", label: "Cost", description: "Pricing or cost efficiency advantage" },
	{ value: "schedule", label: "Schedule", description: "Delivery timeline or speed" },
	{ value: "innovation", label: "Innovation", description: "Novel solutions or technology" },
	{ value: "past_performance", label: "Past Performance", description: "Previous contract success" },
];

const EVIDENCE_TYPES = [
	{ value: "contract", label: "Contract Reference" },
	{ value: "metric", label: "Quantitative Metric" },
	{ value: "testimonial", label: "Customer Testimonial" },
	{ value: "case_study", label: "Case Study" },
];

const OPPORTUNITY_TYPES = [
	"IT Services",
	"Professional Services",
	"Systems Integration",
	"Cybersecurity",
	"Cloud Services",
	"Data Analytics",
	"Software Development",
	"Program Management",
	"Training",
	"Operations & Maintenance",
];

export function DiscriminatorEditor({
	discriminator,
	onSubmit,
	onCancel,
	className,
}: DiscriminatorEditorProps) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [competitors, setCompetitors] = useState<Competitor[]>([]);
	const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(true);

	// Tag input states
	const [proofPointInput, setProofPointInput] = useState("");
	const [naicsInput, setNaicsInput] = useState("");

	const form = useForm<DiscriminatorFormValues>({
		resolver: zodResolver(discriminatorFormSchema),
		defaultValues: {
			statement: discriminator?.statement ?? "",
			shortVersion: discriminator?.shortVersion ?? "",
			proofPoints: discriminator?.proofPoints ?? [],
			discriminatorType: discriminator?.discriminatorType as DiscriminatorFormValues["discriminatorType"],
			category: discriminator?.category ?? "",
			supportingEvidence: discriminator?.supportingEvidence ?? [],
			effectiveAgainst: discriminator?.effectiveAgainst ?? [],
			applicableOpportunityTypes: discriminator?.applicableOpportunityTypes ?? [],
			applicableNaicsCodes: discriminator?.applicableNaicsCodes ?? [],
		},
	});

	// Dynamic evidence array
	const {
		fields: evidenceFields,
		append: appendEvidence,
		remove: removeEvidence,
	} = useFieldArray({
		control: form.control,
		name: "supportingEvidence",
	});

	// Load competitors for targeting
	React.useEffect(() => {
		async function loadCompetitors() {
			const result = await listCompetitors();
			if (result.success) {
				setCompetitors(result.data);
			}
			setIsLoadingCompetitors(false);
		}
		loadCompetitors();
	}, []);

	/**
	 * Handle form submission
	 */
	const handleSubmit = useCallback(
		async (data: DiscriminatorFormValues) => {
			setError(null);

			startTransition(async () => {
				try {
					const cleanedData = {
						...data,
						shortVersion: data.shortVersion || undefined,
						category: data.category || undefined,
					} as CreateDiscriminatorInput;

					let result;
					if (discriminator) {
						result = await updateDiscriminator(discriminator.id, cleanedData);
					} else {
						result = await createDiscriminator(cleanedData);
					}

					if (result.success) {
						onSubmit?.(cleanedData);
					} else {
						setError(result.error);
					}
				} catch (err) {
					setError("An unexpected error occurred");
				}
			});
		},
		[discriminator, onSubmit]
	);

	/**
	 * Add proof point
	 */
	const addProofPoint = useCallback(() => {
		if (!proofPointInput.trim()) return;
		const currentPoints = form.getValues("proofPoints") ?? [];
		if (!currentPoints.includes(proofPointInput.trim())) {
			form.setValue("proofPoints", [...currentPoints, proofPointInput.trim()]);
		}
		setProofPointInput("");
	}, [form, proofPointInput]);

	/**
	 * Remove proof point
	 */
	const removeProofPoint = useCallback(
		(index: number) => {
			const currentPoints = form.getValues("proofPoints") ?? [];
			form.setValue(
				"proofPoints",
				currentPoints.filter((_, i) => i !== index)
			);
		},
		[form]
	);

	/**
	 * Add NAICS code
	 */
	const addNaicsCode = useCallback(() => {
		if (!naicsInput.trim()) return;
		const currentCodes = form.getValues("applicableNaicsCodes") ?? [];
		if (!currentCodes.includes(naicsInput.trim())) {
			form.setValue("applicableNaicsCodes", [...currentCodes, naicsInput.trim()]);
		}
		setNaicsInput("");
	}, [form, naicsInput]);

	/**
	 * Remove NAICS code
	 */
	const removeNaicsCode = useCallback(
		(index: number) => {
			const currentCodes = form.getValues("applicableNaicsCodes") ?? [];
			form.setValue(
				"applicableNaicsCodes",
				currentCodes.filter((_, i) => i !== index)
			);
		},
		[form]
	);

	/**
	 * Toggle competitor targeting
	 */
	const toggleCompetitorTarget = useCallback(
		(competitorId: string) => {
			const current = form.getValues("effectiveAgainst") ?? [];
			if (current.includes(competitorId)) {
				form.setValue(
					"effectiveAgainst",
					current.filter((id) => id !== competitorId)
				);
			} else {
				form.setValue("effectiveAgainst", [...current, competitorId]);
			}
		},
		[form]
	);

	/**
	 * Toggle opportunity type
	 */
	const toggleOpportunityType = useCallback(
		(type: string) => {
			const current = form.getValues("applicableOpportunityTypes") ?? [];
			if (current.includes(type)) {
				form.setValue(
					"applicableOpportunityTypes",
					current.filter((t) => t !== type)
				);
			} else {
				form.setValue("applicableOpportunityTypes", [...current, type]);
			}
		},
		[form]
	);

	const selectedCompetitorIds = form.watch("effectiveAgainst") ?? [];
	const selectedOpportunityTypes = form.watch("applicableOpportunityTypes") ?? [];

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className={cn("space-y-6", className)}
			>
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Main Statement */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Discriminator Statement
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="statement"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Full Statement *</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Write your discriminator statement here. Be specific and quantifiable..."
											className="min-h-[120px]"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										A compelling statement that differentiates your offering
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="shortVersion"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Short Version</FormLabel>
									<FormControl>
										<Input
											placeholder="Brief version for quick reference (max 200 chars)"
											maxLength={200}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										{(field.value?.length ?? 0)}/200 characters
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="discriminatorType"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Type</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{DISCRIMINATOR_TYPES.map((type) => (
													<SelectItem key={type.value} value={type.value}>
														<div className="flex flex-col">
															<span>{type.label}</span>
															<span className="text-xs text-muted-foreground">
																{type.description}
															</span>
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="category"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Category</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g., Technical, Management"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Proof Points */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Lightbulb className="h-5 w-5" />
							Proof Points
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex gap-2">
							<Input
								placeholder="Add a proof point and press Enter"
								value={proofPointInput}
								onChange={(e) => setProofPointInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addProofPoint();
									}
								}}
							/>
							<Button type="button" variant="outline" onClick={addProofPoint}>
								Add
							</Button>
						</div>

						<div className="space-y-2">
							{(form.watch("proofPoints") ?? []).map((point, idx) => (
								<div
									key={idx}
									className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-lg"
								>
									<span className="text-sm flex-1">{point}</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeProofPoint(idx)}
										className="h-6 w-6 p-0 shrink-0"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
							{(form.watch("proofPoints") ?? []).length === 0 && (
								<p className="text-sm text-muted-foreground text-center py-4">
									No proof points added. Add evidence that supports your discriminator.
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Supporting Evidence */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span className="flex items-center gap-2">
								<Award className="h-5 w-5" />
								Supporting Evidence
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									appendEvidence({ type: "contract", description: "", reference: "" })
								}
							>
								<Plus className="h-4 w-4 mr-1" />
								Add Evidence
							</Button>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{evidenceFields.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-4">
								No evidence attached. Add contracts, metrics, or testimonials.
							</p>
						)}

						{evidenceFields.map((field, index) => (
							<div
								key={field.id}
								className="grid grid-cols-12 gap-3 items-start border-b pb-4 last:border-0"
							>
								<div className="col-span-3">
									<FormField
										control={form.control}
										name={`supportingEvidence.${index}.type`}
										render={({ field }) => (
											<FormItem>
												{index === 0 && <FormLabel>Type</FormLabel>}
												<Select onValueChange={field.onChange} value={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{EVIDENCE_TYPES.map((type) => (
															<SelectItem key={type.value} value={type.value}>
																{type.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<div className="col-span-5">
									<FormField
										control={form.control}
										name={`supportingEvidence.${index}.description`}
										render={({ field }) => (
											<FormItem>
												{index === 0 && <FormLabel>Description</FormLabel>}
												<FormControl>
													<Input placeholder="Describe the evidence" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<div className="col-span-3">
									<FormField
										control={form.control}
										name={`supportingEvidence.${index}.reference`}
										render={({ field }) => (
											<FormItem>
												{index === 0 && <FormLabel>Reference</FormLabel>}
												<FormControl>
													<Input placeholder="Contract #, link, etc." {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<div className="col-span-1 pt-7">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeEvidence(index)}
										className="text-destructive hover:text-destructive"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				{/* Competitor Targeting */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Building2 className="h-5 w-5" />
							Effective Against (Competitors)
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoadingCompetitors ? (
							<p className="text-sm text-muted-foreground">Loading competitors...</p>
						) : competitors.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No competitors in database. Add competitors first.
							</p>
						) : (
							<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
								{competitors.map((competitor) => (
									<label
										key={competitor.id}
										className={cn(
											"flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
											selectedCompetitorIds.includes(competitor.id)
												? "bg-primary/10 border-primary"
												: "hover:bg-muted"
										)}
									>
										<Checkbox
											checked={selectedCompetitorIds.includes(competitor.id)}
											onCheckedChange={() => toggleCompetitorTarget(competitor.id)}
										/>
										<span className="text-sm truncate">{competitor.name}</span>
									</label>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Applicability */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Applicability
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Opportunity Types */}
						<div>
							<FormLabel className="mb-2 block">Opportunity Types</FormLabel>
							<div className="flex flex-wrap gap-2">
								{OPPORTUNITY_TYPES.map((type) => (
									<Badge
										key={type}
										variant={selectedOpportunityTypes.includes(type) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => toggleOpportunityType(type)}
									>
										{type}
									</Badge>
								))}
							</div>
						</div>

						{/* NAICS Codes */}
						<div>
							<FormLabel className="mb-2 block">Applicable NAICS Codes</FormLabel>
							<div className="flex gap-2 mb-2">
								<Input
									placeholder="Enter NAICS code (e.g., 541512)"
									value={naicsInput}
									onChange={(e) => setNaicsInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addNaicsCode();
										}
									}}
								/>
								<Button type="button" variant="outline" onClick={addNaicsCode}>
									Add
								</Button>
							</div>
							<div className="flex flex-wrap gap-2">
								{(form.watch("applicableNaicsCodes") ?? []).map((code, idx) => (
									<Badge key={idx} variant="secondary" className="gap-1 pr-1">
										{code}
										<button
											type="button"
											onClick={() => removeNaicsCode(idx)}
											className="ml-1 hover:bg-destructive/20 rounded p-0.5"
										>
											<X className="h-3 w-3" />
										</button>
									</Badge>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Form Actions */}
				<div className="flex justify-end gap-3 pt-4 border-t">
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
					)}
					<Button type="submit" disabled={isPending}>
						{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						{discriminator ? "Update Discriminator" : "Create Discriminator"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default DiscriminatorEditor;
