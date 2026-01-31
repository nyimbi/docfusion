"use client";

/**
 * Contact Detail Component
 *
 * Full contact detail view with activity timeline and related data.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickActions } from "../shared";
import {
	User,
	Building2,
	Mail,
	Phone,
	MapPin,
	Linkedin,
	Calendar,
	Star,
	Edit,
	Plus,
	ChevronLeft,
	ExternalLink,
	Clock,
	FileText,
	Activity,
	MessageSquare,
} from "lucide-react";
import type { ContactRow, ActivityRow, AccountRow } from "@/lib/db/schema-crm";

interface ContactDetailProps {
	contact: ContactRow;
	account?: AccountRow | null;
	activities?: ActivityRow[];
	onEdit?: () => void;
	onLogActivity?: (type: string) => void;
	onAccountClick?: () => void;
	onActivityClick?: (activity: ActivityRow) => void;
	className?: string;
}

export function ContactDetail({
	contact,
	account,
	activities = [],
	onEdit,
	onLogActivity,
	onAccountClick,
	onActivityClick,
	className,
}: ContactDetailProps) {
	const [activeTab, setActiveTab] = useState("overview");

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

	// Get relationship color
	const getRelationshipBadge = () => {
		switch (contact.relationshipStrength) {
			case "hot":
				return <Badge className="bg-red-100 text-red-700">Hot</Badge>;
			case "warm":
				return <Badge className="bg-yellow-100 text-yellow-700">Warm</Badge>;
			case "cold":
				return <Badge className="bg-blue-100 text-blue-700">Cold</Badge>;
			default:
				return null;
		}
	};

	// Get sentiment badge
	const getSentimentBadge = () => {
		switch (contact.sentiment) {
			case "champion":
				return <Badge className="bg-green-100 text-green-700">Champion</Badge>;
			case "positive":
				return <Badge className="bg-blue-100 text-blue-700">Positive</Badge>;
			case "neutral":
				return <Badge variant="secondary">Neutral</Badge>;
			case "negative":
				return <Badge className="bg-red-100 text-red-700">Negative</Badge>;
			default:
				return null;
		}
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-start gap-4">
					<Link
						href="/crm/contacts"
						className="mt-1 p-2 hover:bg-muted rounded-md"
					>
						<ChevronLeft className="h-5 w-5" />
					</Link>

					<Avatar className="h-16 w-16">
						<AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
					</Avatar>

					<div>
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-bold">
								{contact.salutation && `${contact.salutation} `}
								{contact.firstName} {contact.lastName}
							</h1>
							{contact.isPrimaryContact && (
								<Badge className="bg-yellow-100 text-yellow-700">
									<Star className="h-3 w-3 mr-1 fill-current" />
									Primary
								</Badge>
							)}
							{getRelationshipBadge()}
							{getSentimentBadge()}
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

						{/* Account link */}
						{account && (
							<Link
								href={`/crm/accounts/${account.id}`}
								className="flex items-center gap-2 mt-2 text-primary hover:underline"
							>
								<Building2 className="h-4 w-4" />
								{account.name}
								<ExternalLink className="h-3 w-3" />
							</Link>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					<QuickActions
						entityType="contact"
						entityId={contact.id}
						onLogCall={() => onLogActivity?.("call")}
						onSendEmail={() => onLogActivity?.("email")}
						onScheduleMeeting={() => onLogActivity?.("meeting")}
						onAddNote={() => onLogActivity?.("note")}
						onEdit={onEdit}
					/>

					<Button onClick={onEdit}>
						<Edit className="h-4 w-4 mr-2" />
						Edit
					</Button>
				</div>
			</div>

			{/* Do Not Contact Warning */}
			{(contact.doNotContact || contact.doNotEmail || contact.doNotCall) && (
				<div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
					<h4 className="font-medium text-yellow-800">Communication Restrictions</h4>
					<div className="mt-2 flex flex-wrap gap-2">
						{contact.doNotContact && (
							<Badge variant="outline" className="text-yellow-700 border-yellow-300">
								Do Not Contact
							</Badge>
						)}
						{contact.doNotEmail && (
							<Badge variant="outline" className="text-yellow-700 border-yellow-300">
								Do Not Email
							</Badge>
						)}
						{contact.doNotCall && (
							<Badge variant="outline" className="text-yellow-700 border-yellow-300">
								Do Not Call
							</Badge>
						)}
					</div>
				</div>
			)}

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
												<dt className="text-sm text-muted-foreground">Primary Email</dt>
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
										{contact.emailSecondary && (
											<div>
												<dt className="text-sm text-muted-foreground">Secondary Email</dt>
												<dd>
													<a
														href={`mailto:${contact.emailSecondary}`}
														className="font-medium text-primary hover:underline"
													>
														{contact.emailSecondary}
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
												<dt className="text-sm text-muted-foreground">Role in Decision</dt>
												<dd className="font-medium">{contact.role}</dd>
											</div>
										)}
										{contact.influence && (
											<div>
												<dt className="text-sm text-muted-foreground">Influence Level</dt>
												<dd className="font-medium capitalize">{contact.influence}</dd>
											</div>
										)}
									</dl>
								</CardContent>
							</Card>

							{/* Communication Preferences */}
							<Card>
								<CardHeader>
									<CardTitle>Communication Preferences</CardTitle>
								</CardHeader>
								<CardContent>
									<dl className="grid grid-cols-2 gap-4">
										<div>
											<dt className="text-sm text-muted-foreground">Preferred Language</dt>
											<dd className="font-medium">
												{contact.preferredLanguage === "en"
													? "English"
													: contact.preferredLanguage ?? "-"}
											</dd>
										</div>
										{contact.preferredContactMethod && (
											<div>
												<dt className="text-sm text-muted-foreground">
													Preferred Contact Method
												</dt>
												<dd className="font-medium capitalize">
													{contact.preferredContactMethod.replace("_", " ")}
												</dd>
											</div>
										)}
										{contact.bestTimeToContact && (
											<div>
												<dt className="text-sm text-muted-foreground">
													Best Time to Contact
												</dt>
												<dd className="font-medium">{contact.bestTimeToContact}</dd>
											</div>
										)}
										{contact.timezone && (
											<div>
												<dt className="text-sm text-muted-foreground">Timezone</dt>
												<dd className="font-medium">{contact.timezone}</dd>
											</div>
										)}
									</dl>
								</CardContent>
							</Card>
						</TabsContent>

						{/* Activities Tab */}
						<TabsContent value="activities" className="space-y-4 mt-4">
							<div className="flex justify-between items-center">
								<h3 className="font-semibold">Activities ({activities.length})</h3>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button size="sm">
											<Plus className="h-4 w-4 mr-1" />
											Log Activity
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent>
										<DropdownMenuItem onClick={() => onLogActivity?.("call")}>
											<Phone className="h-4 w-4 mr-2" />
											Log Call
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onLogActivity?.("email")}>
											<Mail className="h-4 w-4 mr-2" />
											Log Email
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onLogActivity?.("meeting")}>
											<Calendar className="h-4 w-4 mr-2" />
											Log Meeting
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onLogActivity?.("note")}>
											<FileText className="h-4 w-4 mr-2" />
											Add Note
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

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
														{!["call", "email", "meeting", "note"].includes(activity.type) && (
															<Activity className="h-4 w-4" />
														)}
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

					{/* Quick Actions */}
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{contact.email && !contact.doNotEmail && !contact.doNotContact && (
								<Button
									variant="outline"
									className="w-full justify-start"
									asChild
								>
									<a href={`mailto:${contact.email}`}>
										<Mail className="h-4 w-4 mr-2" />
										Send Email
									</a>
								</Button>
							)}
							{contact.phone && !contact.doNotCall && !contact.doNotContact && (
								<Button
									variant="outline"
									className="w-full justify-start"
									asChild
								>
									<a href={`tel:${contact.phone}`}>
										<Phone className="h-4 w-4 mr-2" />
										Call
									</a>
								</Button>
							)}
							{contact.linkedinUrl && (
								<Button
									variant="outline"
									className="w-full justify-start"
									asChild
								>
									<a
										href={contact.linkedinUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Linkedin className="h-4 w-4 mr-2" />
										View LinkedIn
									</a>
								</Button>
							)}
							<Button
								variant="outline"
								className="w-full justify-start"
								onClick={() => onLogActivity?.("meeting")}
							>
								<Calendar className="h-4 w-4 mr-2" />
								Schedule Meeting
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
	);
}

export default ContactDetail;
