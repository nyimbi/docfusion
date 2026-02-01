"use client";

/**
 * Competitor Form Component
 *
 * Form for creating and editing competitor records with
 * dynamic capability management, multi-select for certifications
 * and contract vehicles, and tag inputs for strengths/weaknesses.
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Building2,
	Globe,
	Target,
	Award,
	FileText,
	TrendingUp,
	Plus,
	X,
	Loader2,
	AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	createCompetitor,
	updateCompetitor,
} from "@/lib/actions/competitive";
import type { Competitor, CreateCompetitorInput } from "@/lib/types/competitive";

// Form validation schema
const competitorFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(500),
	legalName: z.string().max(500).optional(),
	website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	description: z.string().optional(),
	competitorType: z.enum(["prime", "sub", "both"]).optional(),
	sizeStandard: z.enum(["small", "large", "8a", "hubzone", "sdvosb", "wosb"]).optional(),
	capabilities: z.array(z.object({
		area: z.string().min(1, "Capability area is required"),
		strength: z.enum(["strong", "moderate", "weak"]),
		notes: z.string().optional(),
	})).optional(),
	certifications: z.array(z.string()).optional(),
	contractVehicles: z.array(z.string()).optional(),
	naicsCodes: z.array(z.string()).optional(),
	strengths: z.array(z.string()).optional(),
	weaknesses: z.array(z.string()).optional(),
	pricingTendency: z.enum(["aggressive", "moderate", "premium"]).optional(),
	researchNotes: z.string().optional(),
});

type CompetitorFormValues = z.infer<typeof competitorFormSchema>;

interface CompetitorFormProps {
	competitor?: Competitor;
	onSubmit?: (data: CreateCompetitorInput) => void;
	onCancel?: () => void;
	className?: string;
}

const COMPETITOR_TYPES = [
	{ value: "prime", label: "Prime Contractor" },
	{ value: "sub", label: "Subcontractor" },
	{ value: "both", label: "Both (Prime/Sub)" },
];

const SIZE_STANDARDS = [
	{ value: "small", label: "Small Business" },
	{ value: "large", label: "Large Business" },
	{ value: "8a", label: "8(a) Program" },
	{ value: "hubzone", label: "HUBZone" },
	{ value: "sdvosb", label: "SDVOSB" },
	{ value: "wosb", label: "WOSB" },
];

const CAPABILITY_STRENGTHS = [
	{ value: "strong", label: "Strong", color: "text-green-600" },
	{ value: "moderate", label: "Moderate", color: "text-yellow-600" },
	{ value: "weak", label: "Weak", color: "text-red-600" },
];

const PRICING_TENDENCIES = [
	{ value: "aggressive", label: "Aggressive (Low Price)" },
	{ value: "moderate", label: "Moderate" },
	{ value: "premium", label: "Premium (High Price)" },
];

// Common certifications for autocomplete
const COMMON_CERTIFICATIONS = [
	"ISO 9001",
	"ISO 27001",
	"CMMI Level 3",
	"CMMI Level 5",
	"FedRAMP",
	"SOC 2 Type II",
	"PMP",
	"CISSP",
	"AWS Partner",
	"Microsoft Partner",
];

// Common contract vehicles
const COMMON_VEHICLES = [
	"GSA Schedule",
	"SEWP V",
	"CIO-SP3",
	"OASIS",
	"OASIS SB",
	"Alliant 2",
	"STARS III",
	"ITES-3S",
	"VETS 2",
];

export function CompetitorForm({
	competitor,
	onSubmit,
	onCancel,
	className,
}: CompetitorFormProps) {
	const [activeTab, setActiveTab] = useState("basic");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Tag input states
	const [certInput, setCertInput] = useState("");
	const [vehicleInput, setVehicleInput] = useState("");
	const [naicsInput, setNaicsInput] = useState("");
	const [strengthInput, setStrengthInput] = useState("");
	const [weaknessInput, setWeaknessInput] = useState("");

	const form = useForm<CompetitorFormValues>({
		resolver: zodResolver(competitorFormSchema),
		defaultValues: {
			name: competitor?.name ?? "",
			legalName: competitor?.legalName ?? "",
			website: competitor?.website ?? "",
			description: competitor?.description ?? "",
			competitorType: competitor?.competitorType as CompetitorFormValues["competitorType"],
			sizeStandard: competitor?.sizeStandard as CompetitorFormValues["sizeStandard"],
			capabilities: competitor?.capabilities ?? [],
			certifications: competitor?.certifications ?? [],
			contractVehicles: competitor?.contractVehicles ?? [],
			naicsCodes: competitor?.naicsCodes ?? [],
			strengths: competitor?.strengths ?? [],
			weaknesses: competitor?.weaknesses ?? [],
			pricingTendency: competitor?.pricingTendency as CompetitorFormValues["pricingTendency"],
			researchNotes: competitor?.researchNotes ?? "",
		},
	});

	// Dynamic capabilities array
	const { fields: capabilityFields, append: appendCapability, remove: removeCapability } =
		useFieldArray({
			control: form.control,
			name: "capabilities",
		});

	/**
	 * Handle form submission
	 */
	const handleSubmit = useCallback(
		async (data: CompetitorFormValues) => {
			setError(null);

			startTransition(async () => {
				try {
					// Clean up empty strings
					const cleanedData = {
						...data,
						website: data.website || undefined,
						legalName: data.legalName || undefined,
						description: data.description || undefined,
						researchNotes: data.researchNotes || undefined,
					} as CreateCompetitorInput;

					let result;
					if (competitor) {
						result = await updateCompetitor(competitor.id, cleanedData);
					} else {
						result = await createCompetitor(cleanedData);
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
		[competitor, onSubmit]
	);

	/**
	 * Add tag to array field
	 */
	const addTag = useCallback(
		(fieldName: keyof CompetitorFormValues, value: string, setInput: (v: string) => void) => {
			if (!value.trim()) return;

			const currentValues = form.getValues(fieldName) as string[];
			if (!currentValues.includes(value.trim())) {
				form.setValue(fieldName, [...currentValues, value.trim()]);
			}
			setInput("");
		},
		[form]
	);

	/**
	 * Remove tag from array field
	 */
	const removeTag = useCallback(
		(fieldName: keyof CompetitorFormValues, index: number) => {
			const currentValues = form.getValues(fieldName) as string[];
			form.setValue(
				fieldName,
				currentValues.filter((_, i) => i !== index)
			);
		},
		[form]
	);

	/**
	 * Handle tag input keydown
	 */
	const handleTagKeyDown = useCallback(
		(
			e: React.KeyboardEvent<HTMLInputElement>,
			fieldName: keyof CompetitorFormValues,
			value: string,
			setInput: (v: string) => void
		) => {
			if (e.key === "Enter" || e.key === ",") {
				e.preventDefault();
				addTag(fieldName, value, setInput);
			}
		},
		[addTag]
	);

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

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="basic">Basic Info</TabsTrigger>
						<TabsTrigger value="capabilities">Capabilities</TabsTrigger>
						<TabsTrigger value="credentials">Credentials</TabsTrigger>
						<TabsTrigger value="intelligence">Intelligence</TabsTrigger>
					</TabsList>

					{/* Basic Info Tab */}
					<TabsContent value="basic" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building2 className="h-5 w-5" />
									Company Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Company Name *</FormLabel>
											<FormControl>
												<Input placeholder="Acme Corporation" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="legalName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Legal Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Acme Corporation, Inc."
													{...field}
												/>
											</FormControl>
											<FormDescription>
												Full legal entity name if different
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="website"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Website</FormLabel>
											<FormControl>
												<div className="relative">
													<Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
													<Input
														placeholder="https://example.com"
														className="pl-9"
														{...field}
													/>
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="competitorType"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Competitor Type</FormLabel>
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
														{COMPETITOR_TYPES.map((type) => (
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

									<FormField
										control={form.control}
										name="sizeStandard"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Size Standard</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select size" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{SIZE_STANDARDS.map((size) => (
															<SelectItem key={size.value} value={size.value}>
																{size.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Brief description of the competitor..."
													className="min-h-[80px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Capabilities Tab */}
					<TabsContent value="capabilities" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									<span className="flex items-center gap-2">
										<Target className="h-5 w-5" />
										Capability Areas
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											appendCapability({ area: "", strength: "moderate", notes: "" })
										}
									>
										<Plus className="h-4 w-4 mr-1" />
										Add Capability
									</Button>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{capabilityFields.length === 0 && (
									<p className="text-sm text-muted-foreground text-center py-4">
										No capabilities added yet. Click "Add Capability" to start.
									</p>
								)}

								{capabilityFields.map((field, index) => (
									<div
										key={field.id}
										className="grid grid-cols-12 gap-3 items-start border-b pb-4 last:border-0"
									>
										<div className="col-span-5">
											<FormField
												control={form.control}
												name={`capabilities.${index}.area`}
												render={({ field }) => (
													<FormItem>
														{index === 0 && <FormLabel>Area</FormLabel>}
														<FormControl>
															<Input
																placeholder="e.g., Cloud Computing"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
										<div className="col-span-3">
											<FormField
												control={form.control}
												name={`capabilities.${index}.strength`}
												render={({ field }) => (
													<FormItem>
														{index === 0 && <FormLabel>Strength</FormLabel>}
														<Select
															onValueChange={field.onChange}
															value={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																{CAPABILITY_STRENGTHS.map((s) => (
																	<SelectItem
																		key={s.value}
																		value={s.value}
																		className={s.color}
																	>
																		{s.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
										<div className="col-span-3">
											<FormField
												control={form.control}
												name={`capabilities.${index}.notes`}
												render={({ field }) => (
													<FormItem>
														{index === 0 && <FormLabel>Notes</FormLabel>}
														<FormControl>
															<Input placeholder="Optional notes" {...field} />
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
												onClick={() => removeCapability(index)}
												className="text-destructive hover:text-destructive"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									</div>
								))}
							</CardContent>
						</Card>

						{/* Pricing Tendency */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<TrendingUp className="h-5 w-5" />
									Pricing Intelligence
								</CardTitle>
							</CardHeader>
							<CardContent>
								<FormField
									control={form.control}
									name="pricingTendency"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Pricing Tendency</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select tendency" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{PRICING_TENDENCIES.map((p) => (
														<SelectItem key={p.value} value={p.value}>
															{p.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>
												General pricing strategy observed in past bids
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Credentials Tab */}
					<TabsContent value="credentials" className="space-y-4 mt-4">
						{/* Certifications */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Award className="h-5 w-5" />
									Certifications
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex gap-2">
									<Input
										placeholder="Type certification and press Enter"
										value={certInput}
										onChange={(e) => setCertInput(e.target.value)}
										onKeyDown={(e) =>
											handleTagKeyDown(e, "certifications", certInput, setCertInput)
										}
										list="cert-suggestions"
									/>
									<datalist id="cert-suggestions">
										{COMMON_CERTIFICATIONS.map((cert) => (
											<option key={cert} value={cert} />
										))}
									</datalist>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											addTag("certifications", certInput, setCertInput)
										}
									>
										Add
									</Button>
								</div>

								<div className="flex flex-wrap gap-2">
									{(form.watch("certifications") ?? []).map((cert, idx) => (
										<Badge
											key={idx}
											variant="secondary"
											className="gap-1 pr-1"
										>
											{cert}
											<button
												type="button"
												onClick={() => removeTag("certifications", idx)}
												className="ml-1 hover:bg-destructive/20 rounded p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Contract Vehicles */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Contract Vehicles
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex gap-2">
									<Input
										placeholder="Type vehicle and press Enter"
										value={vehicleInput}
										onChange={(e) => setVehicleInput(e.target.value)}
										onKeyDown={(e) =>
											handleTagKeyDown(e, "contractVehicles", vehicleInput, setVehicleInput)
										}
										list="vehicle-suggestions"
									/>
									<datalist id="vehicle-suggestions">
										{COMMON_VEHICLES.map((vehicle) => (
											<option key={vehicle} value={vehicle} />
										))}
									</datalist>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											addTag("contractVehicles", vehicleInput, setVehicleInput)
										}
									>
										Add
									</Button>
								</div>

								<div className="flex flex-wrap gap-2">
									{(form.watch("contractVehicles") ?? []).map((vehicle, idx) => (
										<Badge
											key={idx}
											variant="secondary"
											className="gap-1 pr-1"
										>
											{vehicle}
											<button
												type="button"
												onClick={() => removeTag("contractVehicles", idx)}
												className="ml-1 hover:bg-destructive/20 rounded p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
							</CardContent>
						</Card>

						{/* NAICS Codes */}
						<Card>
							<CardHeader>
								<CardTitle>NAICS Codes</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex gap-2">
									<Input
										placeholder="Enter NAICS code (e.g., 541512)"
										value={naicsInput}
										onChange={(e) => setNaicsInput(e.target.value)}
										onKeyDown={(e) =>
											handleTagKeyDown(e, "naicsCodes", naicsInput, setNaicsInput)
										}
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											addTag("naicsCodes", naicsInput, setNaicsInput)
										}
									>
										Add
									</Button>
								</div>

								<div className="flex flex-wrap gap-2">
									{(form.watch("naicsCodes") ?? []).map((code, idx) => (
										<Badge
											key={idx}
											variant="outline"
											className="gap-1 pr-1"
										>
											{code}
											<button
												type="button"
												onClick={() => removeTag("naicsCodes", idx)}
												className="ml-1 hover:bg-destructive/20 rounded p-0.5"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Intelligence Tab */}
					<TabsContent value="intelligence" className="space-y-4 mt-4">
						{/* Strengths */}
						<Card>
							<CardHeader>
								<CardTitle className="text-green-600 dark:text-green-400">
									Known Strengths
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex gap-2">
									<Input
										placeholder="Enter a strength and press Enter"
										value={strengthInput}
										onChange={(e) => setStrengthInput(e.target.value)}
										onKeyDown={(e) =>
											handleTagKeyDown(e, "strengths", strengthInput, setStrengthInput)
										}
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											addTag("strengths", strengthInput, setStrengthInput)
										}
									>
										Add
									</Button>
								</div>

								<div className="space-y-2">
									{(form.watch("strengths") ?? []).map((strength, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800"
										>
											<span className="text-sm">{strength}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeTag("strengths", idx)}
												className="h-6 w-6 p-0"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Weaknesses */}
						<Card>
							<CardHeader>
								<CardTitle className="text-red-600 dark:text-red-400">
									Known Weaknesses
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex gap-2">
									<Input
										placeholder="Enter a weakness and press Enter"
										value={weaknessInput}
										onChange={(e) => setWeaknessInput(e.target.value)}
										onKeyDown={(e) =>
											handleTagKeyDown(e, "weaknesses", weaknessInput, setWeaknessInput)
										}
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											addTag("weaknesses", weaknessInput, setWeaknessInput)
										}
									>
										Add
									</Button>
								</div>

								<div className="space-y-2">
									{(form.watch("weaknesses") ?? []).map((weakness, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800"
										>
											<span className="text-sm">{weakness}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeTag("weaknesses", idx)}
												className="h-6 w-6 p-0"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Research Notes */}
						<Card>
							<CardHeader>
								<CardTitle>Research Notes</CardTitle>
							</CardHeader>
							<CardContent>
								<FormField
									control={form.control}
									name="researchNotes"
									render={({ field }) => (
										<FormItem>
											<FormControl>
												<Textarea
													placeholder="Additional intelligence and research notes..."
													className="min-h-[120px]"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												Free-form notes about this competitor
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
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
						{competitor ? "Update Competitor" : "Add Competitor"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default CompetitorForm;
