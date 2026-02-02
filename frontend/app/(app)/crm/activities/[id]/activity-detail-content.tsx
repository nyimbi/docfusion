"use client";

/**
 * Activity Detail Content
 *
 * Client component displaying full activity details.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	ArrowLeft,
	Pencil,
	Trash2,
	CheckCircle,
	Clock,
	Building2,
	User,
	Handshake,
	Mail,
	Phone,
	Calendar,
	FileText,
	Video,
	Presentation,
} from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActivityRow, AccountRow, ContactRow, DealRow } from "@/lib/db/schema-crm";
import { getActivity, deleteActivity, completeActivity } from "@/lib/actions/crm/activities";
import { getAccount } from "@/lib/actions/crm/accounts";
import { getContactInternal } from "@/lib/actions/crm/contacts";
import { getDeal } from "@/lib/actions/crm/deals";

interface ActivityDetailContentProps {
	activityId: string;
	userId?: string;
}

// Activity type icons
const ACTIVITY_ICONS: Record<string, React.ElementType> = {
	email: Mail,
	call: Phone,
	meeting: Calendar,
	task: CheckCircle,
	note: FileText,
	demo: Video,
	proposal: Presentation,
};

// Format date and time
const formatDateTime = (date: Date | string | null | undefined) => {
	if (!date) return "-";
	return new Date(date).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

// Format duration
const formatDuration = (minutes: number | null | undefined) => {
	if (!minutes) return "-";
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default function ActivityDetailContent({ activityId, userId }: ActivityDetailContentProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [activity, setActivity] = useState<ActivityRow | null>(null);
	const [account, setAccount] = useState<AccountRow | null>(null);
	const [contact, setContact] = useState<ContactRow | null>(null);
	const [deal, setDeal] = useState<DealRow | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	// Fetch activity data
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				const activityData = await getActivity(activityId);
				if (activityData) {
					setActivity(activityData);
					if (activityData.accountId) {
						const accountData = await getAccount(activityData.accountId);
						setAccount(accountData);
					}
					if (activityData.contactId) {
						const contactData = await getContactInternal(activityData.contactId);
						setContact(contactData);
					}
					if (activityData.dealId) {
						const dealData = await getDeal(activityData.dealId);
						setDeal(dealData);
					}
				} else {
					setActivity(null);
					setAccount(null);
					setContact(null);
					setDeal(null);
				}
			} catch (error) {
				console.error("Failed to fetch activity:", error);
				setActivity(null);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [activityId]);

	const handleEdit = () => {
		router.push(`/crm/activities/${activityId}/edit`);
	};

	const handleDelete = async () => {
		try {
			await deleteActivity(activityId);
			router.push("/crm/activities");
		} catch (error) {
			console.error("Failed to delete activity:", error);
		}
	};

	const handleComplete = async () => {
		try {
			const updatedActivity = await completeActivity(activityId);
			if (updatedActivity) {
				setActivity(updatedActivity);
			}
		} catch (error) {
			console.error("Failed to complete activity:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="h-full overflow-y-auto p-6 space-y-6">
				<div className="flex items-center gap-4">
					<div className="h-10 w-10 bg-muted animate-pulse rounded" />
					<div className="space-y-2">
						<div className="h-6 w-48 bg-muted animate-pulse rounded" />
						<div className="h-4 w-32 bg-muted animate-pulse rounded" />
					</div>
				</div>
				<div className="h-48 bg-muted animate-pulse rounded-lg" />
			</div>
		);
	}

	if (!activity) {
		return (
			<div className="h-full flex flex-col items-center justify-center">
				<h2 className="text-xl font-semibold">Activity not found</h2>
				<p className="text-muted-foreground mt-2">
					The activity you're looking for doesn't exist or has been deleted.
				</p>
				<Button asChild className="mt-4">
					<Link href="/crm/activities">Back to Activities</Link>
				</Button>
			</div>
		);
	}

	const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;
	const isCompleted = activity.status === "completed";
	const isOverdue =
		!isCompleted &&
		activity.scheduledAt &&
		new Date(activity.scheduledAt) < new Date();

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" asChild>
							<Link href="/crm/activities">
								<ArrowLeft className="h-4 w-4" />
							</Link>
						</Button>
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
								<Icon className="h-5 w-5 text-primary" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h1 className="text-xl font-bold">
										{activity.subject ?? `${activity.type} activity`}
									</h1>
									{isCompleted && (
										<Badge className="bg-green-100 text-green-700">Completed</Badge>
									)}
									{isOverdue && <Badge variant="destructive">Overdue</Badge>}
								</div>
								<p className="text-sm text-muted-foreground capitalize">
									{activity.type}
									{activity.direction && ` · ${activity.direction}`}
								</p>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{!isCompleted && (
							<Button variant="outline" onClick={handleComplete}>
								<CheckCircle className="h-4 w-4 mr-2" />
								Complete
							</Button>
						)}
						<Button variant="outline" onClick={handleEdit}>
							<Pencil className="h-4 w-4 mr-2" />
							Edit
						</Button>
						<Button
							variant="outline"
							className="text-red-600 hover:text-red-700"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</div>
				</div>

				{/* Main Content */}
				<div className="grid grid-cols-3 gap-6">
					{/* Left Column - Details */}
					<div className="col-span-2 space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Details</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{activity.description && (
									<div>
										<p className="text-sm text-muted-foreground">Description</p>
										<p className="mt-1 whitespace-pre-wrap">{activity.description}</p>
									</div>
								)}

								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm text-muted-foreground flex items-center gap-1">
											<Clock className="h-4 w-4" />
											Scheduled
										</p>
										<p className="font-medium">{formatDateTime(activity.scheduledAt)}</p>
									</div>
									{isCompleted && (
										<div>
											<p className="text-sm text-muted-foreground flex items-center gap-1">
												<CheckCircle className="h-4 w-4" />
												Completed
											</p>
											<p className="font-medium">
												{formatDateTime(activity.completedAt)}
											</p>
										</div>
									)}
									{activity.durationMinutes && (
										<div>
											<p className="text-sm text-muted-foreground">Duration</p>
											<p className="font-medium">
												{formatDuration(activity.durationMinutes)}
											</p>
										</div>
									)}
									{activity.priority && (
										<div>
											<p className="text-sm text-muted-foreground">Priority</p>
											<Badge
												variant={
													activity.priority === "urgent"
														? "destructive"
														: activity.priority === "high"
														? "default"
														: "secondary"
												}
											>
												{activity.priority}
											</Badge>
										</div>
									)}
								</div>

								{activity.outcome && (
									<div>
										<p className="text-sm text-muted-foreground">Outcome</p>
										<p className="mt-1">{activity.outcome}</p>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Follow-up Section */}
						{activity.followUpRequired && (
							<Card>
								<CardHeader>
									<CardTitle>Follow-up</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-muted-foreground" />
										<span>
											{activity.followUpDate
												? formatDateTime(activity.followUpDate)
												: "Not scheduled"}
										</span>
									</div>
									{activity.followUpNotes && (
										<p className="text-muted-foreground">{activity.followUpNotes}</p>
									)}
								</CardContent>
							</Card>
						)}
					</div>

					{/* Right Column - Related */}
					<div className="space-y-4">
						{/* Account */}
						{account && (
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium text-muted-foreground">
										Account
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Link
										href={`/crm/accounts/${account.id}`}
										className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-md transition-colors"
									>
										<Building2 className="h-5 w-5 text-muted-foreground" />
										<div>
											<p className="font-medium">{account.name}</p>
											<p className="text-sm text-muted-foreground capitalize">
												{account.type}
											</p>
										</div>
									</Link>
								</CardContent>
							</Card>
						)}

						{/* Contact */}
						{contact && (
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium text-muted-foreground">
										Contact
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Link
										href={`/crm/contacts/${contact.id}`}
										className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-md transition-colors"
									>
										<User className="h-5 w-5 text-muted-foreground" />
										<div>
											<p className="font-medium">
												{contact.firstName} {contact.lastName}
											</p>
											<p className="text-sm text-muted-foreground">{contact.title}</p>
										</div>
									</Link>
								</CardContent>
							</Card>
						)}

						{/* Deal */}
						{deal && (
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium text-muted-foreground">
										Deal
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Link
										href={`/crm/deals/${deal.id}`}
										className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-md transition-colors"
									>
										<Handshake className="h-5 w-5 text-muted-foreground" />
										<div>
											<p className="font-medium">{deal.name}</p>
											<p className="text-sm text-muted-foreground">{deal.stage}</p>
										</div>
									</Link>
								</CardContent>
							</Card>
						)}

						{/* Metadata */}
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Metadata
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created</span>
									<span>{formatDateTime(activity.createdAt)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Updated</span>
									<span>{formatDateTime(activity.updatedAt)}</span>
								</div>
								{activity.createdBy && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Created by</span>
										<span>{activity.createdBy}</span>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Activity</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this activity? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
