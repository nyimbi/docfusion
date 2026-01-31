"use client";

/**
 * Account Form Component
 *
 * Create and edit form for CRM accounts with dynamic fields
 * based on account type.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
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
import { Slider } from "@/components/ui/slider";
import {
	Building2,
	Globe,
	MapPin,
	Users,
	DollarSign,
	Calendar,
	Tag,
	Loader2,
} from "lucide-react";
import type { AccountType, CreateAccountInput, UpdateAccountInput } from "@/lib/types/crm";
import type { AccountRow } from "@/lib/db/schema-crm";
import { ACCOUNT_STAGES } from "@/lib/types/crm";

// Form validation schema
const accountFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(500),
	type: z.enum(["partner", "prospect", "lead", "customer", "vendor", "other"]),
	description: z.string().optional(),
	website: z.string().url().optional().or(z.literal("")),
	linkedinUrl: z.string().url().optional().or(z.literal("")),

	// Classification
	industry: z.string().optional(),
	sector: z.string().optional(),
	companySize: z.enum(["micro", "small", "medium", "large", "enterprise"]).optional(),

	// Location
	country: z.string().optional(),
	region: z.string().optional(),
	city: z.string().optional(),
	address: z.string().optional(),
	timezone: z.string().optional(),

	// Company details
	foundedYear: z.number().min(1800).max(2100).optional(),
	employeeCount: z.string().optional(),
	annualRevenue: z.string().optional(),

	// Communication
	primaryLanguage: z.string().default("en"),
	preferredContactMethod: z.enum(["email", "phone", "linkedin", "whatsapp", "in_person"]).optional(),

	// Partner-specific
	partnerTier: z.number().min(1).max(3).optional(),
	partnershipFitScore: z.number().min(0).max(100).optional(),
	coreCapabilities: z.string().optional(),
	capabilities: z.array(z.string()).optional(),

	// Customer-specific
	contractValue: z.number().min(0).optional(),
	contractCurrency: z.string().default("USD"),
	customerHealthScore: z.number().min(0).max(100).optional(),
	churnRisk: z.enum(["low", "medium", "high"]).optional(),

	// Pipeline
	stage: z.string().optional(),
	status: z.enum(["active", "inactive", "churned", "lost", "archived"]).default("active"),

	// Lead/Prospect scoring
	leadScore: z.number().min(0).max(100).optional(),
	leadSource: z.string().optional(),

	// Metadata
	tags: z.array(z.string()).optional(),
});

// Use z.input for form values to match zodResolver's input validation type
// z.infer gives OUTPUT type (after defaults), but forms need INPUT type (before defaults)
type AccountFormValues = z.input<typeof accountFormSchema>;

interface AccountFormProps {
	account?: AccountRow;
	defaultType?: AccountType;
	onSubmit: (data: CreateAccountInput | UpdateAccountInput) => Promise<void>;
	onCancel?: () => void;
	isLoading?: boolean;
	className?: string;
}

const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
	{ value: "partner", label: "Partner", description: "Teaming partner for joint bids" },
	{ value: "prospect", label: "Prospect", description: "Potential customer in early stages" },
	{ value: "lead", label: "Lead", description: "Qualified prospect being pursued" },
	{ value: "customer", label: "Customer", description: "Active paying customer" },
	{ value: "vendor", label: "Vendor", description: "Supplier or service provider" },
	{ value: "other", label: "Other", description: "General contact" },
];

const INDUSTRIES = [
	"Technology",
	"Healthcare",
	"Finance",
	"Manufacturing",
	"Retail",
	"Education",
	"Government",
	"Energy",
	"Transportation",
	"Real Estate",
	"Professional Services",
	"Media & Entertainment",
	"Other",
];

const LEAD_SOURCES = [
	"Website",
	"Referral",
	"Trade Show",
	"Cold Outreach",
	"LinkedIn",
	"Partner",
	"Advertising",
	"Content Marketing",
	"Other",
];

export function AccountForm({
	account,
	defaultType = "prospect",
	onSubmit,
	onCancel,
	isLoading = false,
	className,
}: AccountFormProps) {
	const [activeTab, setActiveTab] = useState("basic");

	const form = useForm<AccountFormValues>({
		resolver: zodResolver(accountFormSchema),
		defaultValues: {
			name: account?.name ?? "",
			type: (account?.type as AccountType) ?? defaultType,
			description: account?.description ?? "",
			website: account?.website ?? "",
			linkedinUrl: account?.linkedinUrl ?? "",
			industry: account?.industry ?? "",
			sector: account?.sector ?? "",
			companySize: account?.companySize as AccountFormValues["companySize"],
			country: account?.country ?? "",
			region: account?.region ?? "",
			city: account?.city ?? "",
			address: account?.address ?? "",
			timezone: account?.timezone ?? "",
			foundedYear: account?.foundedYear ?? undefined,
			employeeCount: account?.employeeCount ?? "",
			annualRevenue: account?.annualRevenue ?? "",
			primaryLanguage: account?.primaryLanguage ?? "en",
			preferredContactMethod: account?.preferredContactMethod as AccountFormValues["preferredContactMethod"],
			partnerTier: account?.partnerTier ?? undefined,
			partnershipFitScore: account?.partnershipFitScore ?? undefined,
			coreCapabilities: account?.coreCapabilities ?? "",
			capabilities: (account?.capabilities as string[]) ?? [],
			contractValue: account?.contractValue ?? undefined,
			contractCurrency: account?.contractCurrency ?? "USD",
			customerHealthScore: account?.customerHealthScore ?? undefined,
			churnRisk: account?.churnRisk as AccountFormValues["churnRisk"],
			stage: account?.stage ?? "",
			status: (account?.status as AccountFormValues["status"]) ?? "active",
			leadScore: account?.leadScore ?? undefined,
			leadSource: account?.leadSource ?? "",
			tags: (account?.tags as string[]) ?? [],
		},
	});

	const watchedType = form.watch("type");

	// Get available stages for current account type
	const getStages = () => {
		const stages = ACCOUNT_STAGES[watchedType];
		if (!stages) return [];
		return Object.entries(stages).map(([value, config]) => ({
			value,
			label: config.label,
		}));
	};

	const handleSubmit = async (data: AccountFormValues) => {
		// Clean up empty strings to undefined
		const cleanedData = Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				value === "" ? undefined : value,
			])
		) as CreateAccountInput | UpdateAccountInput;

		await onSubmit(cleanedData);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className={cn("space-y-6", className)}
			>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="basic">Basic Info</TabsTrigger>
						<TabsTrigger value="details">Details</TabsTrigger>
						<TabsTrigger value="scoring">Scoring</TabsTrigger>
						<TabsTrigger value="metadata">Metadata</TabsTrigger>
					</TabsList>

					{/* Basic Info Tab */}
					<TabsContent value="basic" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building2 className="h-5 w-5" />
									Account Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Account Name *</FormLabel>
											<FormControl>
												<Input placeholder="Enter account name" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="type"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Account Type *</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{ACCOUNT_TYPES.map((type) => (
														<SelectItem key={type.value} value={type.value}>
															<div>
																<div className="font-medium">{type.label}</div>
																<div className="text-xs text-muted-foreground">
																	{type.description}
																</div>
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
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Brief description of the account"
													className="min-h-[100px]"
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

									<FormField
										control={form.control}
										name="linkedinUrl"
										render={({ field }) => (
											<FormItem>
												<FormLabel>LinkedIn</FormLabel>
												<FormControl>
													<Input
														placeholder="LinkedIn company URL"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="stage"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Pipeline Stage</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select stage" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{getStages().map((stage) => (
															<SelectItem key={stage.value} value={stage.value}>
																{stage.label}
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
															<SelectValue placeholder="Select status" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="active">Active</SelectItem>
														<SelectItem value="inactive">Inactive</SelectItem>
														<SelectItem value="churned">Churned</SelectItem>
														<SelectItem value="lost">Lost</SelectItem>
														<SelectItem value="archived">Archived</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<MapPin className="h-5 w-5" />
									Location
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-3 gap-4">
									<FormField
										control={form.control}
										name="country"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Country</FormLabel>
												<FormControl>
													<Input placeholder="Country" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="region"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Region/State</FormLabel>
												<FormControl>
													<Input placeholder="Region" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="city"
										render={({ field }) => (
											<FormItem>
												<FormLabel>City</FormLabel>
												<FormControl>
													<Input placeholder="City" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="address"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Address</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Full address"
													className="min-h-[60px]"
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

					{/* Details Tab */}
					<TabsContent value="details" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="h-5 w-5" />
									Company Details
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="industry"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Industry</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select industry" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{INDUSTRIES.map((industry) => (
															<SelectItem key={industry} value={industry}>
																{industry}
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
										name="companySize"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Company Size</FormLabel>
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
														<SelectItem value="micro">Micro (1-10)</SelectItem>
														<SelectItem value="small">Small (11-50)</SelectItem>
														<SelectItem value="medium">Medium (51-200)</SelectItem>
														<SelectItem value="large">Large (201-1000)</SelectItem>
														<SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
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
										name="employeeCount"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Employee Count</FormLabel>
												<FormControl>
													<Input placeholder="e.g., 50-100" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="foundedYear"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Founded Year</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="e.g., 2010"
														{...field}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? parseInt(e.target.value)
																	: undefined
															)
														}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="annualRevenue"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Annual Revenue</FormLabel>
											<FormControl>
												<div className="relative">
													<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
													<Input
														placeholder="e.g., $1M-$5M"
														className="pl-9"
														{...field}
													/>
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>

						{/* Partner-specific fields */}
						{watchedType === "partner" && (
							<Card>
								<CardHeader>
									<CardTitle>Partner Details</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<FormField
										control={form.control}
										name="partnerTier"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Partner Tier</FormLabel>
												<Select
													onValueChange={(value) =>
														field.onChange(parseInt(value))
													}
													value={field.value?.toString()}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select tier" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="1">Tier 1 (Strategic)</SelectItem>
														<SelectItem value="2">Tier 2 (Preferred)</SelectItem>
														<SelectItem value="3">Tier 3 (Standard)</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="coreCapabilities"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Core Capabilities</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Describe core capabilities..."
														className="min-h-[100px]"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</CardContent>
							</Card>
						)}

						{/* Customer-specific fields */}
						{watchedType === "customer" && (
							<Card>
								<CardHeader>
									<CardTitle>Customer Details</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="contractValue"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Contract Value</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="0.00"
															{...field}
															onChange={(e) =>
																field.onChange(
																	e.target.value
																		? parseFloat(e.target.value)
																		: undefined
																)
															}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="contractCurrency"
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
															<SelectItem value="USD">USD</SelectItem>
															<SelectItem value="EUR">EUR</SelectItem>
															<SelectItem value="GBP">GBP</SelectItem>
															<SelectItem value="CAD">CAD</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<FormField
										control={form.control}
										name="churnRisk"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Churn Risk</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select risk level" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="low">Low</SelectItem>
														<SelectItem value="medium">Medium</SelectItem>
														<SelectItem value="high">High</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Scoring Tab */}
					<TabsContent value="scoring" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle>Scoring & Qualification</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								{(watchedType === "lead" || watchedType === "prospect") && (
									<>
										<FormField
											control={form.control}
											name="leadScore"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														Lead Score: {field.value ?? 0}
													</FormLabel>
													<FormControl>
														<Slider
															min={0}
															max={100}
															step={1}
															value={[field.value ?? 0]}
															onValueChange={([value]) =>
																field.onChange(value)
															}
														/>
													</FormControl>
													<FormDescription>
														0-30: Cold, 31-70: Warm, 71-100: Hot
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="leadSource"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Lead Source</FormLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select source" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{LEAD_SOURCES.map((source) => (
																<SelectItem key={source} value={source}>
																	{source}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									</>
								)}

								{watchedType === "partner" && (
									<FormField
										control={form.control}
										name="partnershipFitScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Partnership Fit Score: {field.value ?? 0}
												</FormLabel>
												<FormControl>
													<Slider
														min={0}
														max={100}
														step={1}
														value={[field.value ?? 0]}
														onValueChange={([value]) =>
															field.onChange(value)
														}
													/>
												</FormControl>
												<FormDescription>
													How well this partner fits your organization
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								{watchedType === "customer" && (
									<FormField
										control={form.control}
										name="customerHealthScore"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Customer Health Score: {field.value ?? 0}
												</FormLabel>
												<FormControl>
													<Slider
														min={0}
														max={100}
														step={1}
														value={[field.value ?? 0]}
														onValueChange={([value]) =>
															field.onChange(value)
														}
													/>
												</FormControl>
												<FormDescription>
													0-30: At risk, 31-70: Healthy, 71-100: Champion
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* Metadata Tab */}
					<TabsContent value="metadata" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Tag className="h-5 w-5" />
									Tags & Custom Fields
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="tags"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Tags</FormLabel>
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
												Add tags to organize and filter accounts
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Communication Preferences</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="primaryLanguage"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Primary Language</FormLabel>
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
														<SelectItem value="en">English</SelectItem>
														<SelectItem value="es">Spanish</SelectItem>
														<SelectItem value="fr">French</SelectItem>
														<SelectItem value="de">German</SelectItem>
														<SelectItem value="zh">Chinese</SelectItem>
														<SelectItem value="ja">Japanese</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="preferredContactMethod"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Preferred Contact Method</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select method" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="email">Email</SelectItem>
														<SelectItem value="phone">Phone</SelectItem>
														<SelectItem value="linkedin">LinkedIn</SelectItem>
														<SelectItem value="whatsapp">WhatsApp</SelectItem>
														<SelectItem value="in_person">In Person</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
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
					<Button type="submit" disabled={isLoading}>
						{isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						{account ? "Update Account" : "Create Account"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default AccountForm;
