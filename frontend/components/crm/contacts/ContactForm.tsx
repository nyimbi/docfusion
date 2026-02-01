"use client";

/**
 * Contact Form Component
 *
 * Create and edit form for CRM contacts.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	User,
	Building2,
	Mail,
	Phone,
	MapPin,
	Linkedin,
	Loader2,
} from "lucide-react";
import type { ContactRow } from "@/lib/db/schema-crm";
import type { CreateContactInput, UpdateContactInput } from "@/lib/types/crm";

// Form validation schema
const contactFormSchema = z.object({
	accountId: z.string().uuid().optional(),
	firstName: z.string().min(1, "First name is required").max(100),
	lastName: z.string().min(1, "Last name is required").max(100),
	salutation: z.string().optional(),

	// Professional
	title: z.string().max(200).optional(),
	department: z.string().max(100).optional(),
	role: z.string().max(100).optional(),
	seniority: z.string().optional(),

	// Contact details
	email: z.string().email().optional().or(z.literal("")),
	emailSecondary: z.string().email().optional().or(z.literal("")),
	phone: z.string().max(50).optional(),
	phoneMobile: z.string().max(50).optional(),
	phoneWork: z.string().max(50).optional(),
	linkedinUrl: z.string().url().optional().or(z.literal("")),

	// Location
	country: z.string().max(100).optional(),
	city: z.string().max(100).optional(),
	timezone: z.string().max(50).optional(),

	// Communication preferences
	preferredLanguage: z.string().default("en"),
	preferredContactMethod: z.enum(["email", "phone", "linkedin", "whatsapp", "in_person"]).optional(),
	bestTimeToContact: z.string().max(100).optional(),
	doNotContact: z.boolean().default(false),
	doNotEmail: z.boolean().default(false),
	doNotCall: z.boolean().default(false),

	// Relationship
	isPrimaryContact: z.boolean().default(false),
	relationshipStrength: z.enum(["cold", "warm", "hot"]).optional(),
	influence: z.enum(["low", "medium", "high"]).optional(),
	sentiment: z.enum(["negative", "neutral", "positive", "champion"]).optional(),

	// Context - How we met
	howWeMet: z.string().max(200).optional(),
	meetingContext: z.string().optional(),
	meetingDate: z.string().optional(), // ISO date string

	// Personal details
	birthday: z.string().optional(), // ISO date string
	preferredName: z.string().max(100).optional(),
	pronouns: z.string().max(50).optional(),

	// Notes
	notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

// Use z.input for form values to match zodResolver's input validation type
type ContactFormValues = z.input<typeof contactFormSchema>;

interface ContactFormProps {
	contact?: ContactRow;
	accountId?: string;
	/** Alternative: pass defaults as an object */
	defaultValues?: {
		accountId?: string;
	};
	onSubmit: (data: CreateContactInput | UpdateContactInput) => Promise<void>;
	onCancel?: () => void;
	isLoading?: boolean;
	className?: string;
}

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."];
const SENIORITIES = ["C-Level", "VP", "Director", "Manager", "Senior", "Mid-Level", "Junior", "Entry"];
const ROLES = ["Decision Maker", "Influencer", "Champion", "Blocker", "End User", "Technical Contact", "Other"];

export function ContactForm({
	contact,
	accountId: accountIdProp,
	defaultValues,
	onSubmit,
	onCancel,
	isLoading = false,
	className,
}: ContactFormProps) {
	const [activeTab, setActiveTab] = useState("basic");

	// Support both individual props and defaultValues object
	const accountId = accountIdProp ?? defaultValues?.accountId;

	const form = useForm<ContactFormValues>({
		resolver: zodResolver(contactFormSchema),
		defaultValues: {
			accountId: contact?.accountId ?? accountId ?? undefined,
			firstName: contact?.firstName ?? "",
			lastName: contact?.lastName ?? "",
			salutation: contact?.salutation ?? "",
			title: contact?.title ?? "",
			department: contact?.department ?? "",
			role: contact?.role ?? "",
			seniority: contact?.seniority ?? "",
			email: contact?.email ?? "",
			emailSecondary: contact?.emailSecondary ?? "",
			phone: contact?.phone ?? "",
			phoneMobile: contact?.phoneMobile ?? "",
			phoneWork: contact?.phoneWork ?? "",
			linkedinUrl: contact?.linkedinUrl ?? "",
			country: contact?.country ?? "",
			city: contact?.city ?? "",
			timezone: contact?.timezone ?? "",
			preferredLanguage: contact?.preferredLanguage ?? "en",
			preferredContactMethod: contact?.preferredContactMethod as ContactFormValues["preferredContactMethod"],
			bestTimeToContact: contact?.bestTimeToContact ?? "",
			doNotContact: contact?.doNotContact ?? false,
			doNotEmail: contact?.doNotEmail ?? false,
			doNotCall: contact?.doNotCall ?? false,
			isPrimaryContact: contact?.isPrimaryContact ?? false,
			relationshipStrength: contact?.relationshipStrength as ContactFormValues["relationshipStrength"],
			influence: contact?.influence as ContactFormValues["influence"],
			sentiment: contact?.sentiment as ContactFormValues["sentiment"],
			// Context fields
			howWeMet: contact?.howWeMet ?? "",
			meetingContext: contact?.meetingContext ?? "",
			meetingDate: contact?.meetingDate ? new Date(contact.meetingDate).toISOString().split("T")[0] : "",
			// Personal details
			birthday: contact?.birthday ? new Date(contact.birthday).toISOString().split("T")[0] : "",
			preferredName: contact?.preferredName ?? "",
			pronouns: contact?.pronouns ?? "",
			notes: contact?.notes ?? "",
			tags: (contact?.tags as string[]) ?? [],
		},
	});

	const handleSubmit = async (data: ContactFormValues) => {
		// Clean up empty strings to undefined
		const cleanedData = Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				value === "" ? undefined : value,
			])
		) as CreateContactInput | UpdateContactInput;

		await onSubmit(cleanedData);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className={cn("space-y-6", className)}
			>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="basic">Basic Info</TabsTrigger>
						<TabsTrigger value="contact">Contact Details</TabsTrigger>
						<TabsTrigger value="context">Context</TabsTrigger>
						<TabsTrigger value="relationship">Relationship</TabsTrigger>
						<TabsTrigger value="preferences">Preferences</TabsTrigger>
					</TabsList>

					{/* Basic Info Tab */}
					<TabsContent value="basic" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<User className="h-5 w-5" />
									Personal Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-4 gap-4">
									<FormField
										control={form.control}
										name="salutation"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Salutation</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{SALUTATIONS.map((s) => (
															<SelectItem key={s} value={s}>
																{s}
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
										name="firstName"
										render={({ field }) => (
											<FormItem className="col-span-1">
												<FormLabel>First Name *</FormLabel>
												<FormControl>
													<Input placeholder="First name" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="lastName"
										render={({ field }) => (
											<FormItem className="col-span-2">
												<FormLabel>Last Name *</FormLabel>
												<FormControl>
													<Input placeholder="Last name" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="isPrimaryContact"
									render={({ field }) => (
										<FormItem className="flex flex-row items-start space-x-3 space-y-0">
											<FormControl>
												<Checkbox
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<div className="space-y-1 leading-none">
												<FormLabel>Primary Contact</FormLabel>
												<FormDescription>
													Mark as the primary contact for this account
												</FormDescription>
											</div>
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building2 className="h-5 w-5" />
									Professional Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Job Title</FormLabel>
											<FormControl>
												<Input placeholder="e.g., VP of Sales" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="department"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Department</FormLabel>
												<FormControl>
													<Input placeholder="e.g., Sales" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="seniority"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Seniority</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select level" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{SENIORITIES.map((s) => (
															<SelectItem key={s} value={s}>
																{s}
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
									name="role"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Role in Decision</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select role" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{ROLES.map((r) => (
														<SelectItem key={r} value={r}>
															{r}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Contact Details Tab */}
					<TabsContent value="contact" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Mail className="h-5 w-5" />
									Email & Phone
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Primary Email</FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="email@example.com"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="emailSecondary"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Secondary Email</FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="email@example.com"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="grid grid-cols-3 gap-4">
									<FormField
										control={form.control}
										name="phone"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Primary Phone</FormLabel>
												<FormControl>
													<Input placeholder="+1 (555) 123-4567" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="phoneMobile"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Mobile</FormLabel>
												<FormControl>
													<Input placeholder="+1 (555) 123-4567" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="phoneWork"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Work Phone</FormLabel>
												<FormControl>
													<Input placeholder="+1 (555) 123-4567" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="linkedinUrl"
									render={({ field }) => (
										<FormItem>
											<FormLabel>LinkedIn Profile</FormLabel>
											<FormControl>
												<div className="relative">
													<Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
													<Input
														placeholder="https://linkedin.com/in/username"
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

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<MapPin className="h-5 w-5" />
									Location
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
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
								</div>

								<FormField
									control={form.control}
									name="timezone"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Timezone</FormLabel>
											<FormControl>
												<Input placeholder="e.g., America/New_York" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Context Tab - How We Met & Personal Details */}
					<TabsContent value="context" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle>How We Met</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<FormField
									control={form.control}
									name="howWeMet"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Meeting Type</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="How did you meet?" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="conference">Conference/Event</SelectItem>
													<SelectItem value="referral">Referral</SelectItem>
													<SelectItem value="linkedin">LinkedIn</SelectItem>
													<SelectItem value="cold_outreach">Cold Outreach</SelectItem>
													<SelectItem value="colleague">Previous Colleague</SelectItem>
													<SelectItem value="client">Client Relationship</SelectItem>
													<SelectItem value="university">University/Alumni</SelectItem>
													<SelectItem value="association">Industry Association</SelectItem>
													<SelectItem value="webinar">Webinar/Online Event</SelectItem>
													<SelectItem value="social">Social Media</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="meetingContext"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Meeting Context</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Details about how/where you met..."
													className="min-h-[80px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="meetingDate"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Meeting Date</FormLabel>
											<FormControl>
												<Input type="date" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Personal Details</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="preferredName"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Preferred Name / Nickname</FormLabel>
												<FormControl>
													<Input placeholder="How they prefer to be called" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="pronouns"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Pronouns</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select pronouns" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="he/him">He/Him</SelectItem>
														<SelectItem value="she/her">She/Her</SelectItem>
														<SelectItem value="they/them">They/Them</SelectItem>
														<SelectItem value="other">Other</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="birthday"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Birthday</FormLabel>
											<FormControl>
												<Input type="date" {...field} />
											</FormControl>
											<FormDescription>
												For remembering to send birthday wishes
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Relationship Tab */}
					<TabsContent value="relationship" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle>Relationship Assessment</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-3 gap-4">
									<FormField
										control={form.control}
										name="relationshipStrength"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Relationship Strength</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="cold">Cold</SelectItem>
														<SelectItem value="warm">Warm</SelectItem>
														<SelectItem value="hot">Hot</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="influence"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Influence Level</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select" />
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

									<FormField
										control={form.control}
										name="sentiment"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Sentiment</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="negative">Negative</SelectItem>
														<SelectItem value="neutral">Neutral</SelectItem>
														<SelectItem value="positive">Positive</SelectItem>
														<SelectItem value="champion">Champion</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="notes"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Notes</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Add notes about this contact..."
													className="min-h-[100px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

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
												Add tags to organize contacts
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Preferences Tab */}
					<TabsContent value="preferences" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle>Communication Preferences</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="preferredLanguage"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Preferred Language</FormLabel>
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

								<FormField
									control={form.control}
									name="bestTimeToContact"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Best Time to Contact</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g., Mornings, after 2pm"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="space-y-4 pt-4 border-t">
									<h4 className="font-medium">Do Not Contact Settings</h4>

									<FormField
										control={form.control}
										name="doNotContact"
										render={({ field }) => (
											<FormItem className="flex flex-row items-start space-x-3 space-y-0">
												<FormControl>
													<Checkbox
														checked={field.value}
														onCheckedChange={field.onChange}
													/>
												</FormControl>
												<div className="space-y-1 leading-none">
													<FormLabel>Do Not Contact</FormLabel>
													<FormDescription>
														Do not contact this person at all
													</FormDescription>
												</div>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="doNotEmail"
										render={({ field }) => (
											<FormItem className="flex flex-row items-start space-x-3 space-y-0">
												<FormControl>
													<Checkbox
														checked={field.value}
														onCheckedChange={field.onChange}
													/>
												</FormControl>
												<div className="space-y-1 leading-none">
													<FormLabel>Do Not Email</FormLabel>
													<FormDescription>
														Do not send emails to this person
													</FormDescription>
												</div>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="doNotCall"
										render={({ field }) => (
											<FormItem className="flex flex-row items-start space-x-3 space-y-0">
												<FormControl>
													<Checkbox
														checked={field.value}
														onCheckedChange={field.onChange}
													/>
												</FormControl>
												<div className="space-y-1 leading-none">
													<FormLabel>Do Not Call</FormLabel>
													<FormDescription>
														Do not call this person
													</FormDescription>
												</div>
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
						{contact ? "Update Contact" : "Create Contact"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default ContactForm;
