"use client";

/**
 * Account Detail Content
 *
 * Client component displaying full account details with tabs.
 * Includes dialogs for logging activities, creating contacts,
 * deals, and documents.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AccountDetail } from "@/components/crm/accounts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import { toast } from "sonner";
import {
	ArrowLeft,
	Pencil,
	Trash2,
	Phone,
	Mail,
	Calendar,
	FileText,
	Loader2,
	Plus,
	MessageSquare,
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	getAccountWithRelations,
	updateAccountStage,
	deleteAccount,
} from "@/lib/actions/crm/accounts";
import {
	createActivity,
	logCall,
	logEmail,
	logNote,
	scheduleMeeting,
} from "@/lib/actions/crm/activities";
import type { AccountRow, ContactRow, ActivityRow, DealRow } from "@/lib/db/schema-crm";
import type { CreateActivityInput } from "@/lib/types/crm";

// ============================================================================
// Types
// ============================================================================

type ActivityDialogType = "call" | "email" | "meeting" | "note" | null;

interface ActivityFormData {
	subject: string;
	description: string;
	outcome: string;
	direction: "inbound" | "outbound";
	durationMinutes: number;
	scheduledAt: string;
}

// ============================================================================
// Component
// ============================================================================

interface AccountDetailContentProps {
	accountId: string;
}

export default function AccountDetailContent({ accountId }: AccountDetailContentProps) {
	const router = useRouter();

	// Account state
	const [isLoading, setIsLoading] = useState(true);
	const [account, setAccount] = useState<AccountRow | null>(null);
	const [contacts, setContacts] = useState<ContactRow[]>([]);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [deals, setDeals] = useState<DealRow[]>([]);

	// Dialog states
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [activityDialogType, setActivityDialogType] = useState<ActivityDialogType>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Activity form state
	const [activityForm, setActivityForm] = useState<ActivityFormData>({
		subject: "",
		description: "",
		outcome: "",
		direction: "outbound",
		durationMinutes: 15,
		scheduledAt: new Date().toISOString().slice(0, 16),
	});

	// ============================================================================
	// Data Fetching
	// ============================================================================

	const fetchAccountData = useCallback(async () => {
		setIsLoading(true);
		try {
			const accountData = await getAccountWithRelations(accountId);

			if (accountData) {
				setAccount(accountData);
				setContacts(accountData.contacts ?? []);
				setActivities(accountData.recentActivities ?? []);
				setDeals(accountData.deals ?? []);
			} else {
				setAccount(null);
				setContacts([]);
				setActivities([]);
				setDeals([]);
			}
		} catch (error) {
			console.error("Failed to fetch account:", error);
			setAccount(null);
		} finally {
			setIsLoading(false);
		}
	}, [accountId]);

	useEffect(() => {
		fetchAccountData();
	}, [fetchAccountData]);

	// ============================================================================
	// Handlers
	// ============================================================================

	const handleEdit = () => {
		router.push(`/crm/accounts/${accountId}/edit`);
	};

	const handleDelete = async () => {
		try {
			await deleteAccount(accountId);
			toast.success("Account deleted successfully");
			router.push("/crm/accounts");
		} catch (error) {
			console.error("Failed to delete account:", error);
			toast.error("Failed to delete account");
		}
	};

	const handleStageChange = async (newStage: string) => {
		try {
			const updated = await updateAccountStage(accountId, newStage);
			if (updated) {
				setAccount(updated);
				toast.success(`Stage updated to ${newStage}`);
			}
		} catch (error) {
			console.error("Failed to update stage:", error);
			toast.error("Failed to update stage");
		}
	};

	// Activity handlers
	const handleLogActivity = (type: string) => {
		// Reset form
		setActivityForm({
			subject: "",
			description: "",
			outcome: "",
			direction: "outbound",
			durationMinutes: type === "meeting" ? 60 : 15,
			scheduledAt: new Date().toISOString().slice(0, 16),
		});
		setActivityDialogType(type as ActivityDialogType);
	};

	const handleActivitySubmit = async () => {
		if (!activityDialogType || !account) return;

		setIsSubmitting(true);
		try {
			switch (activityDialogType) {
				case "call":
					await logCall({
						accountId: account.id,
						subject: activityForm.subject || `Call with ${account.name}`,
						outcome: activityForm.outcome,
						durationMinutes: activityForm.durationMinutes,
						direction: activityForm.direction,
					});
					toast.success("Call logged successfully");
					break;

				case "email":
					await logEmail({
						accountId: account.id,
						subject: activityForm.subject || `Email to ${account.name}`,
						content: activityForm.description,
						direction: activityForm.direction,
					});
					toast.success("Email logged successfully");
					break;

				case "meeting":
					await scheduleMeeting({
						accountId: account.id,
						subject: activityForm.subject || `Meeting with ${account.name}`,
						description: activityForm.description,
						scheduledAt: new Date(activityForm.scheduledAt),
						durationMinutes: activityForm.durationMinutes,
					});
					toast.success("Meeting scheduled successfully");
					break;

				case "note":
					await logNote({
						accountId: account.id,
						content: activityForm.description || activityForm.subject,
					});
					toast.success("Note added successfully");
					break;
			}

			// Refresh data and close dialog
			await fetchAccountData();
			setActivityDialogType(null);
		} catch (error) {
			console.error("Failed to log activity:", error);
			toast.error("Failed to log activity");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Navigation handlers
	const handleAddContact = () => {
		router.push(`/crm/contacts/new?accountId=${accountId}`);
	};

	const handleAddDeal = () => {
		router.push(`/crm/deals/new?accountId=${accountId}`);
	};

	const handleCreateDocument = () => {
		// Navigate to document creation with account context
		router.push(`/documents/new?accountId=${accountId}&accountName=${encodeURIComponent(account?.name ?? "")}`);
	};

	// ============================================================================
	// Activity Dialog Content
	// ============================================================================

	const getActivityDialogContent = () => {
		if (!activityDialogType) return null;

		const config: Record<
			ActivityDialogType & string,
			{
				title: string;
				description: string;
				icon: React.ReactNode;
				showDirection: boolean;
				showDuration: boolean;
				showScheduled: boolean;
				showOutcome: boolean;
				subjectPlaceholder: string;
				descriptionPlaceholder: string;
			}
		> = {
			call: {
				title: "Log Call",
				description: "Record details about a phone call with this account.",
				icon: <Phone className="h-5 w-5 text-green-600" />,
				showDirection: true,
				showDuration: true,
				showScheduled: false,
				showOutcome: true,
				subjectPlaceholder: `Call with ${account?.name ?? ""}`,
				descriptionPlaceholder: "Call notes...",
			},
			email: {
				title: "Log Email",
				description: "Record an email communication with this account.",
				icon: <Mail className="h-5 w-5 text-blue-600" />,
				showDirection: true,
				showDuration: false,
				showScheduled: false,
				showOutcome: false,
				subjectPlaceholder: "Email subject",
				descriptionPlaceholder: "Email content or summary...",
			},
			meeting: {
				title: "Schedule Meeting",
				description: "Schedule a meeting with this account.",
				icon: <Calendar className="h-5 w-5 text-purple-600" />,
				showDirection: false,
				showDuration: true,
				showScheduled: true,
				showOutcome: false,
				subjectPlaceholder: `Meeting with ${account?.name ?? ""}`,
				descriptionPlaceholder: "Meeting agenda and notes...",
			},
			note: {
				title: "Add Note",
				description: "Add a note about this account.",
				icon: <MessageSquare className="h-5 w-5 text-amber-600" />,
				showDirection: false,
				showDuration: false,
				showScheduled: false,
				showOutcome: false,
				subjectPlaceholder: "Note title (optional)",
				descriptionPlaceholder: "Write your note here...",
			},
		};

		const dialogConfig = config[activityDialogType];

		return (
			<Dialog open={!!activityDialogType} onOpenChange={() => setActivityDialogType(null)}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{dialogConfig.icon}
							{dialogConfig.title}
						</DialogTitle>
						<DialogDescription>{dialogConfig.description}</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Subject */}
						<div className="space-y-2">
							<Label htmlFor="subject">Subject</Label>
							<Input
								id="subject"
								placeholder={dialogConfig.subjectPlaceholder}
								value={activityForm.subject}
								onChange={(e) =>
									setActivityForm((prev) => ({ ...prev, subject: e.target.value }))
								}
							/>
						</div>

						{/* Direction */}
						{dialogConfig.showDirection && (
							<div className="space-y-2">
								<Label>Direction</Label>
								<Select
									value={activityForm.direction}
									onValueChange={(value: "inbound" | "outbound") =>
										setActivityForm((prev) => ({ ...prev, direction: value }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="outbound">Outbound</SelectItem>
										<SelectItem value="inbound">Inbound</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

						{/* Scheduled At */}
						{dialogConfig.showScheduled && (
							<div className="space-y-2">
								<Label htmlFor="scheduledAt">Scheduled Date & Time</Label>
								<Input
									id="scheduledAt"
									type="datetime-local"
									value={activityForm.scheduledAt}
									onChange={(e) =>
										setActivityForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
									}
								/>
							</div>
						)}

						{/* Duration */}
						{dialogConfig.showDuration && (
							<div className="space-y-2">
								<Label>Duration</Label>
								<Select
									value={activityForm.durationMinutes.toString()}
									onValueChange={(value) =>
										setActivityForm((prev) => ({
											...prev,
											durationMinutes: parseInt(value),
										}))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="5">5 minutes</SelectItem>
										<SelectItem value="10">10 minutes</SelectItem>
										<SelectItem value="15">15 minutes</SelectItem>
										<SelectItem value="30">30 minutes</SelectItem>
										<SelectItem value="45">45 minutes</SelectItem>
										<SelectItem value="60">1 hour</SelectItem>
										<SelectItem value="90">1.5 hours</SelectItem>
										<SelectItem value="120">2 hours</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

						{/* Description/Notes */}
						<div className="space-y-2">
							<Label htmlFor="description">
								{activityDialogType === "note" ? "Note Content" : "Notes"}
							</Label>
							<Textarea
								id="description"
								placeholder={dialogConfig.descriptionPlaceholder}
								className="min-h-[100px]"
								value={activityForm.description}
								onChange={(e) =>
									setActivityForm((prev) => ({ ...prev, description: e.target.value }))
								}
							/>
						</div>

						{/* Outcome */}
						{dialogConfig.showOutcome && (
							<div className="space-y-2">
								<Label htmlFor="outcome">Outcome</Label>
								<Textarea
									id="outcome"
									placeholder="What was the result?"
									className="min-h-[60px]"
									value={activityForm.outcome}
									onChange={(e) =>
										setActivityForm((prev) => ({ ...prev, outcome: e.target.value }))
									}
								/>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setActivityDialogType(null)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button onClick={handleActivitySubmit} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							{activityDialogType === "meeting" ? "Schedule" : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	};

	// ============================================================================
	// Render
	// ============================================================================

	if (isLoading) {
		return (
			<div className="h-full flex flex-col overflow-hidden">
				<CRMNavigation compact />
				<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
					<div className="flex items-center gap-4">
						<div className="h-10 w-10 bg-muted animate-pulse rounded" />
						<div className="space-y-2">
							<div className="h-6 w-48 bg-muted animate-pulse rounded" />
							<div className="h-4 w-32 bg-muted animate-pulse rounded" />
						</div>
					</div>
					<div className="h-12 bg-muted animate-pulse rounded" />
					<div className="grid grid-cols-3 gap-6">
						<div className="col-span-2 h-96 bg-muted animate-pulse rounded-lg" />
						<div className="h-96 bg-muted animate-pulse rounded-lg" />
					</div>
				</div>
			</div>
		);
	}

	if (!account) {
		return (
			<div className="h-full flex flex-col overflow-hidden">
				<CRMNavigation compact />
				<div className="flex-1 flex flex-col items-center justify-center">
					<h2 className="text-xl font-semibold">Account not found</h2>
					<p className="text-muted-foreground mt-2">
						The account you're looking for doesn't exist or has been deleted.
					</p>
					<Button asChild className="mt-4">
						<Link href="/crm/accounts">Back to Accounts</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title={account.name}
				description={`${account.type} · ${account.industry ?? "No industry"}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" asChild>
							<Link href="/crm/accounts">
								<ArrowLeft className="h-4 w-4" />
							</Link>
						</Button>
						<Button variant="outline" size="sm" onClick={handleCreateDocument}>
							<FileText className="h-4 w-4 mr-2" />
							Create Document
						</Button>
						<Button variant="outline" size="sm" onClick={handleEdit}>
							<Pencil className="h-4 w-4 mr-2" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-red-600 hover:text-red-700"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</div>
				}
				showQuickActions={false}
			/>

			<div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
				{/* Account Detail Component */}
				<AccountDetail
					account={account}
					contacts={contacts}
					activities={activities}
					deals={deals}
					onEdit={handleEdit}
					onStageChange={handleStageChange}
					onLogActivity={handleLogActivity}
					onAddContact={handleAddContact}
					onAddDeal={handleAddDeal}
					onContactClick={(contact) => router.push(`/crm/contacts/${contact.id}`)}
					onActivityClick={(activity) => router.push(`/crm/activities/${activity.id}`)}
					onDealClick={(deal) => router.push(`/crm/deals/${deal.id}`)}
				/>
			</div>

			{/* Activity Dialog */}
			{getActivityDialogContent()}

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Account</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{account.name}"? This action cannot be undone.
							All related contacts, activities, and deals will also be affected.
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
