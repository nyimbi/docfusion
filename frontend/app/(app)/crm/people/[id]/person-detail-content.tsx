"use client";

/**
 * Person Detail Content
 *
 * Detail view for a standalone contact with link-to-account functionality.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import { QuickActions } from "@/components/crm/shared";
import {
	User,
	Building2,
	Mail,
	Phone,
	MapPin,
	Linkedin,
	Calendar,
	Edit,
	ChevronLeft,
	ExternalLink,
	Clock,
	FileText,
	Activity,
	MessageSquare,
	Link2,
	UserCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ContactRow, ActivityRow, AccountRow } from "@/lib/db/schema-crm";
import { linkContactToAccount, type UserContext } from "@/lib/actions/crm/contacts";
import { logCall, logNote, scheduleMeeting } from "@/lib/actions/crm/activities";

interface PersonDetailContentProps {
	contact: ContactRow & {
		account?: AccountRow | null;
		recentActivities?: ActivityRow[];
	};
	userContext: UserContext;
}

export default function PersonDetailContent({ contact, userContext }: PersonDetailContentProps) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState("overview");
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);
	const [selectedAccountId, setSelectedAccountId] = useState<string>("");
	const [isLinking, setIsLinking] = useState(false);

	// Activity dialogs state
	const [callDialogOpen, setCallDialogOpen] = useState(false);
	const [noteDialogOpen, setNoteDialogOpen] = useState(false);
	const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
	const [activityLoading, setActivityLoading] = useState(false);

	// Form state for activities
	const [callForm, setCallForm] = useState({ subject: "", outcome: "", duration: "15" });
	const [noteForm, setNoteForm] = useState({ content: "" });
	const [meetingForm, setMeetingForm] = useState({ subject: "", description: "", date: "", time: "", duration: "60" });

	// Get initials
	const getInitials = () => {
		return `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase() || "?";
	};

	// Format date
	const formatDate = (date: Date | string | null) => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Format relative time
	const formatRelativeTime = (date: Date | string | null) => {
		if (!date) return "Never";
		const now = new Date();
		const then = new Date(date);
		const diffMs = now.getTime() - then.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	};

	// Handle link to account
	const handleLinkToAccount = async () => {
		if (!selectedAccountId) return;

		setIsLinking(true);
		try {
			await linkContactToAccount(contact.id, selectedAccountId, userContext);
			router.push(`/crm/contacts/${contact.id}`);
		} catch (error) {
			console.error("Failed to link contact:", error);
		} finally {
			setIsLinking(false);
			setLinkDialogOpen(false);
		}
	};

	// Handle log call
	const handleLogCall = async () => {
		if (!callForm.subject.trim()) return;

		setActivityLoading(true);
		try {
			await logCall({
				contactId: contact.id,
				accountId: contact.accountId || undefined,
				subject: callForm.subject,
				outcome: callForm.outcome || undefined,
				durationMinutes: parseInt(callForm.duration) || 15,
				direction: "outbound",
			}, userContext.userId);
			setCallDialogOpen(false);
			setCallForm({ subject: "", outcome: "", duration: "15" });
			router.refresh();
		} catch (error) {
			console.error("Failed to log call:", error);
		} finally {
			setActivityLoading(false);
		}
	};

	// Handle add note
	const handleAddNote = async () => {
		if (!noteForm.content.trim()) return;

		setActivityLoading(true);
		try {
			await logNote({
				contactId: contact.id,
				accountId: contact.accountId || undefined,
				content: noteForm.content,
			}, userContext.userId);
			setNoteDialogOpen(false);
			setNoteForm({ content: "" });
			router.refresh();
		} catch (error) {
			console.error("Failed to add note:", error);
		} finally {
			setActivityLoading(false);
		}
	};

	// Handle schedule meeting
	const handleScheduleMeeting = async () => {
		if (!meetingForm.subject.trim() || !meetingForm.date || !meetingForm.time) return;

		setActivityLoading(true);
		try {
			const scheduledAt = new Date(`${meetingForm.date}T${meetingForm.time}`);
			await scheduleMeeting({
				contactId: contact.id,
				accountId: contact.accountId || undefined,
				subject: meetingForm.subject,
				description: meetingForm.description || undefined,
				scheduledAt,
				durationMinutes: parseInt(meetingForm.duration) || 60,
			}, userContext.userId);
			setMeetingDialogOpen(false);
			setMeetingForm({ subject: "", description: "", date: "", time: "", duration: "60" });
			router.refresh();
		} catch (error) {
			console.error("Failed to schedule meeting:", error);
		} finally {
			setActivityLoading(false);
		}
	};

	// Handle send email (opens mailto:)
	const handleSendEmail = () => {
		if (contact.email) {
			window.location.href = `mailto:${contact.email}`;
		}
	};

	const activities = contact.recentActivities || [];

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<CRMNavigation
				title={`${contact.firstName} ${contact.lastName}`}
				description="Standalone contact"
			/>

			<div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
				<div className="max-w-6xl mx-auto space-y-6">
					{/* Header */}
					<div className="flex items-start justify-between">
						<div className="flex items-start gap-4">
							<Link
								href="/crm/people"
								className="mt-1 p-2 hover:bg-muted rounded-md"
							>
								<ChevronLeft className="h-5 w-5" />
							</Link>

							<Avatar className="h-16 w-16">
								<AvatarFallback className="text-xl bg-teal-100 text-teal-700">
									{getInitials()}
								</AvatarFallback>
							</Avatar>

							<div>
								<div className="flex items-center gap-3">
									<h1 className="text-2xl font-bold">
										{contact.salutation && `${contact.salutation} `}
										{contact.firstName} {contact.lastName}
									</h1>
									<Badge className="bg-teal-100 text-teal-700">
										<UserCircle className="h-3 w-3 mr-1" />
										Person
									</Badge>
								</div>

								<div className="flex items-center gap-4 mt-2 text-muted-foreground">
									{contact.title && <span>{contact.title}</span>}
									{contact.department && (
										<>
											<span>•</span>
											<span>{contact.department}</span>
										</>
									)}
								</div>

								{/* Link to Account prompt */}
								<div className="mt-3">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setLinkDialogOpen(true)}
										className="text-teal-600 border-teal-300 hover:bg-teal-50"
									>
										<Link2 className="h-4 w-4 mr-2" />
										Link to Account
									</Button>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<QuickActions
								entityType="contact"
								entityId={contact.id}
								onLogCall={() => setCallDialogOpen(true)}
								onSendEmail={handleSendEmail}
								onScheduleMeeting={() => setMeetingDialogOpen(true)}
								onAddNote={() => setNoteDialogOpen(true)}
								onEdit={() => router.push(`/crm/people/${contact.id}/edit`)}
							/>

							<Button onClick={() => router.push(`/crm/people/${contact.id}/edit`)}>
								<Edit className="h-4 w-4 mr-2" />
								Edit
							</Button>
						</div>
					</div>

					{/* Main Content */}
					<div className="grid grid-cols-3 gap-6">
						{/* Left Column - Details & Tabs */}
						<div className="col-span-2 space-y-6">
							<Tabs value={activeTab} onValueChange={setActiveTab}>
								<TabsList>
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="activities">
										Activities ({activities.length})
									</TabsTrigger>
									<TabsTrigger value="notes">Notes</TabsTrigger>
								</TabsList>

								{/* Overview Tab */}
								<TabsContent value="overview" className="space-y-4 mt-4">
									{/* Contact Info */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Mail className="h-5 w-5" />
												Contact Information
											</CardTitle>
										</CardHeader>
										<CardContent>
											<dl className="grid grid-cols-2 gap-4">
												{contact.email && (
													<div>
														<dt className="text-sm text-muted-foreground">Email</dt>
														<dd>
															<a
																href={`mailto:${contact.email}`}
																className="font-medium text-primary hover:underline"
															>
																{contact.email}
															</a>
														</dd>
													</div>
												)}
												{contact.phone && (
													<div>
														<dt className="text-sm text-muted-foreground">Phone</dt>
														<dd>
															<a
																href={`tel:${contact.phone}`}
																className="font-medium text-primary hover:underline"
															>
																{contact.phone}
															</a>
														</dd>
													</div>
												)}
												{contact.phoneMobile && (
													<div>
														<dt className="text-sm text-muted-foreground">Mobile</dt>
														<dd>
															<a
																href={`tel:${contact.phoneMobile}`}
																className="font-medium text-primary hover:underline"
															>
																{contact.phoneMobile}
															</a>
														</dd>
													</div>
												)}
												{contact.linkedinUrl && (
													<div>
														<dt className="text-sm text-muted-foreground">LinkedIn</dt>
														<dd>
															<a
																href={contact.linkedinUrl}
																target="_blank"
																rel="noopener noreferrer"
																className="font-medium text-primary hover:underline flex items-center gap-1"
															>
																<Linkedin className="h-4 w-4" />
																View Profile
																<ExternalLink className="h-3 w-3" />
															</a>
														</dd>
													</div>
												)}
												{(contact.city || contact.country) && (
													<div>
														<dt className="text-sm text-muted-foreground">Location</dt>
														<dd className="font-medium flex items-center gap-1">
															<MapPin className="h-4 w-4 text-muted-foreground" />
															{[contact.city, contact.country].filter(Boolean).join(", ")}
														</dd>
													</div>
												)}
											</dl>
										</CardContent>
									</Card>

									{/* Professional Info */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Building2 className="h-5 w-5" />
												Professional Information
											</CardTitle>
										</CardHeader>
										<CardContent>
											<dl className="grid grid-cols-2 gap-4">
												{contact.title && (
													<div>
														<dt className="text-sm text-muted-foreground">Title</dt>
														<dd className="font-medium">{contact.title}</dd>
													</div>
												)}
												{contact.department && (
													<div>
														<dt className="text-sm text-muted-foreground">Department</dt>
														<dd className="font-medium">{contact.department}</dd>
													</div>
												)}
												{contact.seniority && (
													<div>
														<dt className="text-sm text-muted-foreground">Seniority</dt>
														<dd className="font-medium">{contact.seniority}</dd>
													</div>
												)}
												{contact.role && (
													<div>
														<dt className="text-sm text-muted-foreground">Role</dt>
														<dd className="font-medium">{contact.role}</dd>
													</div>
												)}
											</dl>
										</CardContent>
									</Card>
								</TabsContent>

								{/* Activities Tab */}
								<TabsContent value="activities" className="space-y-4 mt-4">
									{activities.length === 0 ? (
										<Card>
											<CardContent className="flex flex-col items-center justify-center py-8">
												<Activity className="h-12 w-12 text-muted-foreground mb-4" />
												<p className="text-muted-foreground">No activities yet</p>
											</CardContent>
										</Card>
									) : (
										<div className="space-y-3">
											{activities.map((activity) => (
												<Card key={activity.id}>
													<CardContent className="p-4">
														<div className="flex items-start gap-3">
															<div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
																{activity.type === "call" && <Phone className="h-4 w-4" />}
																{activity.type === "email" && <Mail className="h-4 w-4" />}
																{activity.type === "meeting" && <Calendar className="h-4 w-4" />}
																{activity.type === "note" && <FileText className="h-4 w-4" />}
															</div>
															<div className="flex-1">
																<div className="flex items-center justify-between">
																	<span className="font-medium">
																		{activity.subject ?? activity.type}
																	</span>
																	<span className="text-xs text-muted-foreground">
																		{formatRelativeTime(activity.completedAt ?? activity.scheduledAt)}
																	</span>
																</div>
																{activity.description && (
																	<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
																		{activity.description}
																	</p>
																)}
															</div>
														</div>
													</CardContent>
												</Card>
											))}
										</div>
									)}
								</TabsContent>

								{/* Notes Tab */}
								<TabsContent value="notes" className="space-y-4 mt-4">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<MessageSquare className="h-5 w-5" />
												Notes
											</CardTitle>
										</CardHeader>
										<CardContent>
											{contact.notes ? (
												<p className="whitespace-pre-wrap">{contact.notes}</p>
											) : (
												<p className="text-muted-foreground">No notes added yet.</p>
											)}
										</CardContent>
									</Card>
								</TabsContent>
							</Tabs>
						</div>

						{/* Right Column - Sidebar */}
						<div className="space-y-4">
							{/* Quick Info */}
							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Quick Info</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<span className="text-sm text-muted-foreground">Last Contact</span>
										<p className="font-medium">
											{formatRelativeTime(contact.lastContactDate)}
										</p>
									</div>
									<Separator />
									<div>
										<span className="text-sm text-muted-foreground">Next Follow-up</span>
										<p className="font-medium">
											{contact.nextFollowUpDate
												? formatDate(contact.nextFollowUpDate)
												: "Not scheduled"}
										</p>
									</div>
									<Separator />
									<div>
										<span className="text-sm text-muted-foreground">Total Interactions</span>
										<p className="font-medium">{contact.totalInteractions ?? 0}</p>
									</div>
									<Separator />
									<div>
										<span className="text-sm text-muted-foreground">Created</span>
										<p className="font-medium">{formatDate(contact.createdAt)}</p>
									</div>
								</CardContent>
							</Card>

							{/* Link to Account Card */}
							<Card className="border-teal-200 dark:border-teal-800">
								<CardHeader className="bg-teal-50 dark:bg-teal-950/20">
									<CardTitle className="text-sm flex items-center gap-2 text-teal-700 dark:text-teal-300">
										<Link2 className="h-4 w-4" />
										Link to Account
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-4">
									<p className="text-sm text-muted-foreground mb-3">
										Associate this person with a company account.
									</p>
									<Button
										variant="outline"
										className="w-full"
										onClick={() => setLinkDialogOpen(true)}
									>
										<Building2 className="h-4 w-4 mr-2" />
										Choose Account
									</Button>
								</CardContent>
							</Card>

							{/* Tags */}
							{(contact.tags as string[])?.length > 0 && (
								<Card>
									<CardHeader>
										<CardTitle className="text-sm">Tags</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex flex-wrap gap-2">
											{(contact.tags as string[]).map((tag) => (
												<Badge key={tag} variant="secondary">
													{tag}
												</Badge>
											))}
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Link to Account Dialog */}
			<Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Link to Account</DialogTitle>
						<DialogDescription>
							Choose an account to associate this person with.
						</DialogDescription>
					</DialogHeader>

					<div className="py-4">
						<label className="text-sm font-medium mb-2 block">Select Account</label>
						<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
							<SelectTrigger>
								<SelectValue placeholder="Search for an account..." />
							</SelectTrigger>
							<SelectContent>
								{/* In production, this would be populated from an API call */}
								<SelectItem value="placeholder">
									(Account search would go here)
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground mt-2">
							After linking, this person will appear under that account's contacts.
						</p>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleLinkToAccount}
							disabled={!selectedAccountId || isLinking}
						>
							{isLinking ? "Linking..." : "Link to Account"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Log Call Dialog */}
			<Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Phone className="h-5 w-5" />
							Log Call
						</DialogTitle>
						<DialogDescription>
							Record details about a phone call with {contact.firstName}.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="call-subject">Subject *</Label>
							<Input
								id="call-subject"
								placeholder="e.g., Follow-up on proposal"
								value={callForm.subject}
								onChange={(e) => setCallForm({ ...callForm, subject: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="call-outcome">Outcome</Label>
							<Textarea
								id="call-outcome"
								placeholder="Summary of the call..."
								value={callForm.outcome}
								onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })}
								rows={3}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="call-duration">Duration (minutes)</Label>
							<Select
								value={callForm.duration}
								onValueChange={(v) => setCallForm({ ...callForm, duration: v })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="5">5 minutes</SelectItem>
									<SelectItem value="15">15 minutes</SelectItem>
									<SelectItem value="30">30 minutes</SelectItem>
									<SelectItem value="45">45 minutes</SelectItem>
									<SelectItem value="60">1 hour</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCallDialogOpen(false)}>Cancel</Button>
						<Button onClick={handleLogCall} disabled={!callForm.subject.trim() || activityLoading}>
							{activityLoading ? "Saving..." : "Log Call"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add Note Dialog */}
			<Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<MessageSquare className="h-5 w-5" />
							Add Note
						</DialogTitle>
						<DialogDescription>
							Add a note about {contact.firstName}.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="note-content">Note *</Label>
							<Textarea
								id="note-content"
								placeholder="Enter your note..."
								value={noteForm.content}
								onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
								rows={5}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
						<Button onClick={handleAddNote} disabled={!noteForm.content.trim() || activityLoading}>
							{activityLoading ? "Saving..." : "Add Note"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Schedule Meeting Dialog */}
			<Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Schedule Meeting
						</DialogTitle>
						<DialogDescription>
							Schedule a meeting with {contact.firstName}.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="meeting-subject">Subject *</Label>
							<Input
								id="meeting-subject"
								placeholder="e.g., Project kickoff meeting"
								value={meetingForm.subject}
								onChange={(e) => setMeetingForm({ ...meetingForm, subject: e.target.value })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="meeting-date">Date *</Label>
								<Input
									id="meeting-date"
									type="date"
									value={meetingForm.date}
									onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="meeting-time">Time *</Label>
								<Input
									id="meeting-time"
									type="time"
									value={meetingForm.time}
									onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="meeting-duration">Duration</Label>
							<Select
								value={meetingForm.duration}
								onValueChange={(v) => setMeetingForm({ ...meetingForm, duration: v })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="15">15 minutes</SelectItem>
									<SelectItem value="30">30 minutes</SelectItem>
									<SelectItem value="45">45 minutes</SelectItem>
									<SelectItem value="60">1 hour</SelectItem>
									<SelectItem value="90">1.5 hours</SelectItem>
									<SelectItem value="120">2 hours</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="meeting-description">Description</Label>
							<Textarea
								id="meeting-description"
								placeholder="Meeting agenda or notes..."
								value={meetingForm.description}
								onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setMeetingDialogOpen(false)}>Cancel</Button>
						<Button
							onClick={handleScheduleMeeting}
							disabled={!meetingForm.subject.trim() || !meetingForm.date || !meetingForm.time || activityLoading}
						>
							{activityLoading ? "Scheduling..." : "Schedule Meeting"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
