"use client";

/**
 * Activity Form Component
 *
 * Create and edit form for CRM activities.
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Phone,
	Mail,
	Calendar as CalendarIcon,
	FileText,
	MessageSquare,
	Clock,
	Loader2,
	Users,
} from "lucide-react";
import type { ActivityRow } from "@/lib/db/schema-crm";
import type { CreateActivityInput, UpdateActivityInput, ActivityType } from "@/lib/types/crm";

// Form validation schema
const activityFormSchema = z.object({
	// Related entities
	accountId: z.string().uuid().optional(),
	contactId: z.string().uuid().optional(),
	dealId: z.string().uuid().optional(),

	// Activity details
	type: z.enum([
		"email",
		"call",
		"meeting",
		"task",
		"note",
		"linkedin",
		"whatsapp",
		"sms",
		"event",
		"demo",
		"proposal",
	]),
	subject: z.string().min(1, "Subject is required").max(500),
	description: z.string().optional(),
	outcome: z.string().optional(),

	// Timing
	scheduledAt: z.date().optional(),
	completedAt: z.date().optional(),
	durationMinutes: z.number().min(0).optional(),

	// Direction
	direction: z.enum(["inbound", "outbound", "internal"]).optional(),

	// Status
	status: z.enum(["scheduled", "completed", "cancelled", "no_show", "rescheduled"]).default("scheduled"),

	// Priority
	priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),

	// Follow-up
	followUpRequired: z.boolean().default(false),
	followUpDate: z.date().optional(),
	followUpNotes: z.string().optional(),
});

// Use z.input for form values to match zodResolver's input validation type
type ActivityFormValues = z.input<typeof activityFormSchema>;

interface ActivityFormProps {
	activity?: ActivityRow;
	defaultType?: ActivityType;
	accountId?: string;
	contactId?: string;
	dealId?: string;
	/** Alternative: pass all defaults as an object */
	defaultValues?: {
		accountId?: string;
		contactId?: string;
		dealId?: string;
		type?: ActivityRow["type"];
	};
	onSubmit: (data: CreateActivityInput | UpdateActivityInput) => Promise<void>;
	onCancel?: () => void;
	isLoading?: boolean;
	className?: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ElementType }[] = [
	{ value: "email", label: "Email", icon: Mail },
	{ value: "call", label: "Call", icon: Phone },
	{ value: "meeting", label: "Meeting", icon: CalendarIcon },
	{ value: "task", label: "Task", icon: FileText },
	{ value: "note", label: "Note", icon: MessageSquare },
	{ value: "linkedin", label: "LinkedIn", icon: Users },
	{ value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
	{ value: "sms", label: "SMS", icon: MessageSquare },
	{ value: "event", label: "Event", icon: CalendarIcon },
	{ value: "demo", label: "Demo", icon: Users },
	{ value: "proposal", label: "Proposal", icon: FileText },
];

const DURATIONS = [
	{ value: 15, label: "15 minutes" },
	{ value: 30, label: "30 minutes" },
	{ value: 45, label: "45 minutes" },
	{ value: 60, label: "1 hour" },
	{ value: 90, label: "1.5 hours" },
	{ value: 120, label: "2 hours" },
	{ value: 180, label: "3 hours" },
];

export function ActivityForm({
	activity,
	defaultType = "note",
	accountId: accountIdProp,
	contactId: contactIdProp,
	dealId: dealIdProp,
	defaultValues,
	onSubmit,
	onCancel,
	isLoading = false,
	className,
}: ActivityFormProps) {
	// Support both individual props and defaultValues object
	const accountId = accountIdProp ?? defaultValues?.accountId;
	const contactId = contactIdProp ?? defaultValues?.contactId;
	const dealId = dealIdProp ?? defaultValues?.dealId;
	const typeDefault = (defaultValues?.type as ActivityType) ?? defaultType;
	const form = useForm<ActivityFormValues>({
		resolver: zodResolver(activityFormSchema),
		defaultValues: {
			accountId: activity?.accountId ?? accountId ?? undefined,
			contactId: activity?.contactId ?? contactId ?? undefined,
			dealId: activity?.dealId ?? dealId ?? undefined,
			type: (activity?.type as ActivityType) ?? typeDefault,
			subject: activity?.subject ?? "",
			description: activity?.description ?? "",
			outcome: activity?.outcome ?? "",
			scheduledAt: activity?.scheduledAt ? new Date(activity.scheduledAt) : undefined,
			completedAt: activity?.completedAt ? new Date(activity.completedAt) : undefined,
			durationMinutes: activity?.durationMinutes ?? undefined,
			direction: activity?.direction as ActivityFormValues["direction"],
			status: (activity?.status as ActivityFormValues["status"]) ?? "scheduled",
			priority: (activity?.priority as ActivityFormValues["priority"]) ?? "normal",
			followUpRequired: activity?.followUpRequired ?? false,
			followUpDate: activity?.followUpDate ? new Date(activity.followUpDate) : undefined,
			followUpNotes: activity?.followUpNotes ?? "",
		},
	});

	const watchedType = form.watch("type");
	const watchedFollowUpRequired = form.watch("followUpRequired");

	// Get appropriate subject placeholder based on type
	const getSubjectPlaceholder = () => {
		switch (watchedType) {
			case "call":
				return "Call with [Contact Name]";
			case "email":
				return "Re: [Email Subject]";
			case "meeting":
				return "Meeting: [Topic]";
			case "task":
				return "Task: [Description]";
			case "note":
				return "Note about [Topic]";
			case "demo":
				return "Product Demo for [Company]";
			case "proposal":
				return "Proposal: [Project Name]";
			default:
				return "Activity subject";
		}
	};

	const handleSubmit = async (data: ActivityFormValues) => {
		// Convert dates to ISO strings
		const cleanedData = {
			...data,
			scheduledAt: data.scheduledAt?.toISOString(),
			completedAt: data.completedAt?.toISOString(),
			followUpDate: data.followUpDate?.toISOString(),
		} as CreateActivityInput | UpdateActivityInput;

		await onSubmit(cleanedData);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className={cn("space-y-6", className)}
			>
				{/* Activity Type */}
				<Card>
					<CardHeader>
						<CardTitle>Activity Type</CardTitle>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<div className="grid grid-cols-4 gap-2">
											{ACTIVITY_TYPES.slice(0, 8).map((type) => {
												const Icon = type.icon;
												return (
													<Button
														key={type.value}
														type="button"
														variant={field.value === type.value ? "primary" : "outline"}
														className="flex flex-col gap-1 h-auto py-3"
														onClick={() => field.onChange(type.value)}
													>
														<Icon className="h-5 w-5" />
														<span className="text-xs">{type.label}</span>
													</Button>
												);
											})}
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Activity Details */}
				<Card>
					<CardHeader>
						<CardTitle>Activity Details</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="subject"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Subject *</FormLabel>
									<FormControl>
										<Input placeholder={getSubjectPlaceholder()} {...field} />
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
											placeholder="Add details about this activity..."
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
								name="direction"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Direction</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select direction" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="inbound">Inbound</SelectItem>
												<SelectItem value="outbound">Outbound</SelectItem>
												<SelectItem value="internal">Internal</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority</FormLabel>
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
												<SelectItem value="low">Low</SelectItem>
												<SelectItem value="normal">Normal</SelectItem>
												<SelectItem value="high">High</SelectItem>
												<SelectItem value="urgent">Urgent</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Timing */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Timing
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="scheduledAt"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Scheduled Date/Time</FormLabel>
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

							<FormField
								control={form.control}
								name="completedAt"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Completed Date/Time</FormLabel>
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
						</div>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="durationMinutes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Duration</FormLabel>
										<Select
											onValueChange={(value) => field.onChange(parseInt(value))}
											value={field.value?.toString()}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select duration" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{DURATIONS.map((d) => (
													<SelectItem key={d.value} value={d.value.toString()}>
														{d.label}
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
												<SelectItem value="scheduled">Scheduled</SelectItem>
												<SelectItem value="completed">Completed</SelectItem>
												<SelectItem value="cancelled">Cancelled</SelectItem>
												<SelectItem value="no_show">No Show</SelectItem>
												<SelectItem value="rescheduled">Rescheduled</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Outcome */}
				<Card>
					<CardHeader>
						<CardTitle>Outcome</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="outcome"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Outcome/Result</FormLabel>
									<FormControl>
										<Textarea
											placeholder="What was the outcome of this activity?"
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
							name="followUpRequired"
							render={({ field }) => (
								<FormItem className="flex flex-row items-start space-x-3 space-y-0">
									<FormControl>
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
									<div className="space-y-1 leading-none">
										<FormLabel>Follow-up Required</FormLabel>
										<FormDescription>
											Schedule a follow-up for this activity
										</FormDescription>
									</div>
								</FormItem>
							)}
						/>

						{watchedFollowUpRequired && (
							<div className="space-y-4 pl-7">
								<FormField
									control={form.control}
									name="followUpDate"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Follow-up Date</FormLabel>
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

								<FormField
									control={form.control}
									name="followUpNotes"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Follow-up Notes</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Notes for the follow-up..."
													className="min-h-[60px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						)}
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
						{activity ? "Update Activity" : "Log Activity"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export default ActivityForm;
