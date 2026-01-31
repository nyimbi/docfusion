"use client";

/**
 * Deal Form Component
 *
 * Create and edit form for CRM deals.
 */

import { useState } from "react";
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
	DollarSign,
	Calendar as CalendarIcon,
	Building2,
	User,
	Loader2,
} from "lucide-react";
import type { DealRow } from "@/lib/db/schema-crm";
import type { CreateDealInput, UpdateDealInput } from "@/lib/types/crm";
import { DEAL_STAGES } from "@/lib/types/crm";

// Form validation schema
const dealFormSchema = z.object({
	accountId: z.string().uuid("Please select an account"),
	primaryContactId: z.string().uuid().optional(),
	opportunityId: z.string().uuid().optional(),

	name: z.string().min(1, "Name is required").max(500),
	description: z.string().optional(),

	value: z.number().min(0).optional(),
	currency: z.string().default("USD"),
	recurringValue: z.number().min(0).optional(),
	recurringPeriod: z.enum(["monthly", "quarterly", "yearly"]).optional(),

	pipelineId: z.string().default("default"),
	stage: z.string().min(1, "Stage is required"),
	stageProbability: z.number().min(0).max(100).optional(),

	expectedCloseDate: z.date().optional(),

	status: z.enum(["open", "won", "lost", "on_hold", "abandoned"]).default("open"),

	lossReason: z.string().optional(),
	lossReasonDetail: z.string().optional(),
	competitorLostTo: z.string().optional(),
	winReason: z.string().optional(),

	ownerId: z.string().optional(),
	ownerName: z.string().optional(),

	tags: z.array(z.string()).optional(),
});

// Use z.input for form values to match zodResolver's input validation type
type DealFormValues = z.input<typeof dealFormSchema>;

interface DealFormProps {
	deal?: DealRow;
	accountId?: string;
	/** Alternative: pass defaults as an object */
	defaultValues?: {
		accountId?: string;
	};
	accounts?: { id: string; name: string }[];
	contacts?: { id: string; name: string }[];
	onSubmit: (data: CreateDealInput | UpdateDealInput) => Promise<void>;
	onCancel?: () => void;
	isLoading?: boolean;
	className?: string;
}

const CURRENCIES = [
	{ value: "USD", label: "USD - US Dollar" },
	{ value: "EUR", label: "EUR - Euro" },
	{ value: "GBP", label: "GBP - British Pound" },
	{ value: "CAD", label: "CAD - Canadian Dollar" },
	{ value: "AUD", label: "AUD - Australian Dollar" },
];

const LOSS_REASONS = [
	"Price",
	"Competition",
	"No Decision",
	"Lost to Status Quo",
	"Product Fit",
	"Timing",
	"Budget",
	"Other",
];

export function DealForm({
	deal,
	accountId: accountIdProp,
	defaultValues: defaultValuesProp,
	accounts = [],
	contacts = [],
	onSubmit,
	onCancel,
	isLoading = false,
	className,
}: DealFormProps) {
	// Support both individual props and defaultValues object
	const accountId = accountIdProp ?? defaultValuesProp?.accountId;

	const form = useForm<DealFormValues>({
		resolver: zodResolver(dealFormSchema),
		defaultValues: {
			accountId: deal?.accountId ?? accountId ?? "",
			primaryContactId: deal?.primaryContactId ?? undefined,
			opportunityId: deal?.opportunityId ?? undefined,
			name: deal?.name ?? "",
			description: deal?.description ?? "",
			value: deal?.value ?? undefined,
			currency: deal?.currency ?? "USD",
			recurringValue: deal?.recurringValue ?? undefined,
			recurringPeriod: deal?.recurringPeriod as DealFormValues["recurringPeriod"],
			pipelineId: deal?.pipelineId ?? "default",
			stage: deal?.stage ?? "qualification",
			stageProbability: deal?.stageProbability ?? undefined,
			expectedCloseDate: deal?.expectedCloseDate
				? new Date(deal.expectedCloseDate)
				: undefined,
			status: (deal?.status as DealFormValues["status"]) ?? "open",
			lossReason: deal?.lossReason ?? "",
			lossReasonDetail: deal?.lossReasonDetail ?? "",
			competitorLostTo: deal?.competitorLostTo ?? "",
			winReason: deal?.winReason ?? "",
			ownerId: deal?.ownerId ?? "",
			ownerName: deal?.ownerName ?? "",
			tags: (deal?.tags as string[]) ?? [],
		},
	});

	const watchedStatus = form.watch("status");
	const watchedStage = form.watch("stage");

	// Get stages
	const stages = DEAL_STAGES.map((stage) => ({
		id: stage.id,
		label: stage.label,
		probability: stage.probability,
	}));

	// Update probability when stage changes
	const handleStageChange = (stage: string) => {
		form.setValue("stage", stage);
		const stageConfig = DEAL_STAGES.find((s) => s.id === stage);
		if (stageConfig?.probability !== undefined) {
			form.setValue("stageProbability", stageConfig.probability);
		}
	};

	const handleSubmit = async (data: DealFormValues) => {
		const cleanedData = {
			...data,
			expectedCloseDate: data.expectedCloseDate?.toISOString(),
		} as CreateDealInput | UpdateDealInput;

		await onSubmit(cleanedData);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className={cn("space-y-6", className)}
			>
				{/* Basic Info */}
				<Card>
					<CardHeader>
						<CardTitle>Deal Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Deal Name *</FormLabel>
									<FormControl>
										<Input placeholder="Enter deal name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Describe this deal..."
											className="min-h-[80px]"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="accountId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Account *</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select account" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{accounts.map((account) => (
													<SelectItem key={account.id} value={account.id}>
														{account.name}
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
								name="primaryContactId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Primary Contact</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select contact" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{contacts.map((contact) => (
													<SelectItem key={contact.id} value={contact.id}>
														{contact.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Value */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<DollarSign className="h-5 w-5" />
							Deal Value
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="value"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Value</FormLabel>
										<FormControl>
											<div className="relative">
												<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
												<Input
													type="number"
													placeholder="0"
													className="pl-9"
													{...field}
													onChange={(e) =>
														field.onChange(
															e.target.value ? parseFloat(e.target.value) : undefined
														)
													}
												/>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="currency"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Currency</FormLabel>
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
												{CURRENCIES.map((c) => (
													<SelectItem key={c.value} value={c.value}>
														{c.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="recurringValue"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Recurring Value</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="0"
												{...field}
												onChange={(e) =>
													field.onChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
											/>
										</FormControl>
										<FormDescription>
											For subscription-based deals
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="recurringPeriod"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Recurring Period</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select period" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="monthly">Monthly</SelectItem>
												<SelectItem value="quarterly">Quarterly</SelectItem>
												<SelectItem value="yearly">Yearly</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Pipeline */}
				<Card>
					<CardHeader>
						<CardTitle>Pipeline & Status</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="stage"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Stage *</FormLabel>
										<Select
											onValueChange={handleStageChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{stages.map((stage) => (
													<SelectItem key={stage.id} value={stage.id}>
														{stage.label} ({stage.probability}%)
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
								name="status"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Status</FormLabel>
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
												<SelectItem value="open">Open</SelectItem>
												<SelectItem value="won">Won</SelectItem>
												<SelectItem value="lost">Lost</SelectItem>
												<SelectItem value="on_hold">On Hold</SelectItem>
												<SelectItem value="abandoned">Abandoned</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="stageProbability"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										Win Probability: {field.value ?? 0}%
									</FormLabel>
									<FormControl>
										<Slider
											min={0}
											max={100}
											step={5}
											value={[field.value ?? 0]}
											onValueChange={([value]) => field.onChange(value)}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="expectedCloseDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Expected Close Date</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-start text-left font-normal",
														!field.value && "text-muted-foreground"
													)}
												>
													<CalendarIcon className="mr-2 h-4 w-4" />
													{field.value
														? field.value.toLocaleDateString()
														: "Pick a date"}
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={field.value}
												onSelect={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Win/Loss Details */}
				{(watchedStatus === "won" || watchedStatus === "lost") && (
					<Card>
						<CardHeader>
							<CardTitle>
								{watchedStatus === "won" ? "Win Details" : "Loss Details"}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{watchedStatus === "won" && (
								<FormField
									control={form.control}
									name="winReason"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Win Reason</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Why did we win this deal?"
													className="min-h-[80px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							{watchedStatus === "lost" && (
								<>
									<FormField
										control={form.control}
										name="lossReason"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Loss Reason</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select reason" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{LOSS_REASONS.map((reason) => (
															<SelectItem key={reason} value={reason}>
																{reason}
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
										name="lossReasonDetail"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Additional Details</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Provide more context..."
														className="min-h-[60px]"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="competitorLostTo"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Competitor Lost To</FormLabel>
												<FormControl>
													<Input
														placeholder="Competitor name"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</>
							)}
						</CardContent>
					</Card>
				)}

				{/* Tags */}
				<Card>
					<CardHeader>
						<CardTitle>Tags</CardTitle>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name="tags"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											placeholder="Enter tags separated by commas"
											value={field.value?.join(", ") ?? ""}
											onChange={(e) => {
												const tags = e.target.value
													.split(",")
													.map((t) => t.trim())
													.filter(Boolean);
												field.onChange(tags);
											}}
										/>
									</FormControl>
									<FormDescription>
										Add tags to organize deals
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Form Actions */}
				<div className="flex justify-end gap-3 pt-4 border-t">
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
					)}
					<Button type="submit" disabled={isLoading}>
						{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						{deal ? "Update Deal" : "Create Deal"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default DealForm;
