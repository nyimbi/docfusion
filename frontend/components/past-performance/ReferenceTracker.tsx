/**
 * Reference Tracker Component
 *
 * Manages reference availability status, POC verification,
 * and tracking for past performance projects.
 */

"use client";

import { useState, useCallback } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Phone,
	Mail,
	User,
	Building2,
	CheckCircle,
	AlertCircle,
	Clock,
	Calendar,
	RefreshCw,
	Edit,
	Plus,
	History,
	Send,
	MessageSquare,
	FileText,
	ExternalLink,
	Loader2,
	Info,
} from "lucide-react";
import type { Project } from "@/lib/db/schema-past-performance";

// ============================================================================
// Types
// ============================================================================

interface ReferenceContact {
	name: string;
	title?: string;
	email?: string;
	phone?: string;
	lastVerified?: Date;
	status: "verified" | "pending" | "outdated" | "unavailable";
	notes?: string;
}

interface VerificationHistory {
	date: Date;
	status: "verified" | "no_response" | "declined" | "contact_changed";
	notes?: string;
	verifiedBy?: string;
}

interface ReferenceTrackerProps {
	project: Project;
	contacts?: ReferenceContact[];
	verificationHistory?: VerificationHistory[];
	onUpdateStatus: (status: string, notes?: string) => Promise<void>;
	onUpdateContact: (contact: ReferenceContact) => Promise<void>;
	onVerify: () => Promise<void>;
	onSendVerificationEmail?: (contactEmail: string) => Promise<void>;
	isVerifying?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Reference status badge with tooltip
 */
function ReferenceStatusBadge({
	status,
	lastVerified,
}: {
	status: string | null | undefined;
	lastVerified?: Date | null;
}) {
	const config = {
		available: {
			icon: CheckCircle,
			label: "Available",
			variant: "default" as const,
			description: "Reference is available and verified",
		},
		limited: {
			icon: Clock,
			label: "Limited",
			variant: "secondary" as const,
			description: "Reference has limited availability",
		},
		unavailable: {
			icon: AlertCircle,
			label: "Unavailable",
			variant: "destructive" as const,
			description: "Reference is currently unavailable",
		},
	};

	const current = config[(status as keyof typeof config) || "available"] || config.available;
	const Icon = current.icon;

	const daysSinceVerified = lastVerified
		? Math.floor((Date.now() - new Date(lastVerified).getTime()) / (1000 * 60 * 60 * 24))
		: null;

	const isStale = daysSinceVerified !== null && daysSinceVerified > 90;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-2">
						<Badge
							variant={current.variant}
							className={`gap-1 ${isStale ? "opacity-70" : ""}`}
						>
							<Icon className="h-3 w-3" />
							{current.label}
						</Badge>
						{isStale && (
							<Badge variant="outline" className="text-yellow-600 border-yellow-300">
								<Clock className="h-3 w-3 mr-1" />
								Needs verification
							</Badge>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>{current.description}</p>
					{lastVerified && (
						<p className="text-xs mt-1">
							Last verified: {new Date(lastVerified).toLocaleDateString()}
							{daysSinceVerified !== null && ` (${daysSinceVerified} days ago)`}
						</p>
					)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Contact card
 */
function ContactCard({
	contact,
	onEdit,
	onSendEmail,
}: {
	contact: ReferenceContact;
	onEdit?: () => void;
	onSendEmail?: () => void;
}) {
	const statusConfig = {
		verified: { color: "bg-green-500", label: "Verified" },
		pending: { color: "bg-yellow-500", label: "Pending" },
		outdated: { color: "bg-orange-500", label: "Outdated" },
		unavailable: { color: "bg-red-500", label: "Unavailable" },
	};

	const status = statusConfig[contact.status];

	return (
		<div className="p-4 border rounded-lg space-y-3">
			<div className="flex items-start justify-between">
				<div className="flex items-start gap-3">
					<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
						<User className="h-5 w-5 text-muted-foreground" />
					</div>
					<div>
						<p className="font-medium">{contact.name}</p>
						{contact.title && (
							<p className="text-sm text-muted-foreground">{contact.title}</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<div className={`w-2 h-2 rounded-full ${status.color}`} />
					<span className="text-xs text-muted-foreground">{status.label}</span>
				</div>
			</div>

			<div className="grid gap-2 text-sm">
				{contact.email && (
					<div className="flex items-center gap-2">
						<Mail className="h-4 w-4 text-muted-foreground" />
						<a
							href={`mailto:${contact.email}`}
							className="text-primary hover:underline"
						>
							{contact.email}
						</a>
					</div>
				)}
				{contact.phone && (
					<div className="flex items-center gap-2">
						<Phone className="h-4 w-4 text-muted-foreground" />
						<a
							href={`tel:${contact.phone}`}
							className="text-primary hover:underline"
						>
							{contact.phone}
						</a>
					</div>
				)}
			</div>

			{contact.lastVerified && (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Calendar className="h-3 w-3" />
					Last verified: {new Date(contact.lastVerified).toLocaleDateString()}
				</div>
			)}

			{contact.notes && (
				<p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
					{contact.notes}
				</p>
			)}

			<div className="flex items-center gap-2 pt-2 border-t">
				{onEdit && (
					<Button variant="outline" size="sm" onClick={onEdit}>
						<Edit className="h-4 w-4 mr-1" />
						Edit
					</Button>
				)}
				{onSendEmail && contact.email && (
					<Button variant="outline" size="sm" onClick={onSendEmail}>
						<Send className="h-4 w-4 mr-1" />
						Send Verification
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * Verification history timeline
 */
function VerificationTimeline({
	history,
}: {
	history: VerificationHistory[];
}) {
	const statusConfig = {
		verified: { color: "bg-green-500", icon: CheckCircle },
		no_response: { color: "bg-yellow-500", icon: Clock },
		declined: { color: "bg-red-500", icon: AlertCircle },
		contact_changed: { color: "bg-blue-500", icon: RefreshCw },
	};

	if (history.length === 0) {
		return (
			<div className="text-center py-6 text-muted-foreground">
				<History className="h-8 w-8 mx-auto mb-2 opacity-50" />
				<p>No verification history</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{history.map((entry, index) => {
				const config = statusConfig[entry.status];
				const Icon = config.icon;

				return (
					<div key={index} className="flex gap-3">
						<div className="relative">
							<div
								className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center`}
							>
								<Icon className="h-4 w-4 text-white" />
							</div>
							{index < history.length - 1 && (
								<div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
							)}
						</div>
						<div className="flex-1 pb-4">
							<div className="flex items-center justify-between">
								<p className="font-medium text-sm">
									{entry.status.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
								</p>
								<span className="text-xs text-muted-foreground">
									{new Date(entry.date).toLocaleDateString()}
								</span>
							</div>
							{entry.notes && (
								<p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
							)}
							{entry.verifiedBy && (
								<p className="text-xs text-muted-foreground mt-1">
									By: {entry.verifiedBy}
								</p>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ReferenceTracker({
	project,
	contacts = [],
	verificationHistory = [],
	onUpdateStatus,
	onUpdateContact,
	onVerify,
	onSendVerificationEmail,
	isVerifying = false,
}: ReferenceTrackerProps) {
	const [showStatusDialog, setShowStatusDialog] = useState(false);
	const [showContactDialog, setShowContactDialog] = useState(false);
	const [selectedContact, setSelectedContact] = useState<ReferenceContact | null>(null);
	const [statusUpdate, setStatusUpdate] = useState({
		status: project.referenceStatus || "available",
		notes: project.referenceNotes || "",
	});
	const [isSaving, setIsSaving] = useState(false);

	// Handle status update
	const handleStatusUpdate = useCallback(async () => {
		setIsSaving(true);
		try {
			await onUpdateStatus(statusUpdate.status, statusUpdate.notes);
			setShowStatusDialog(false);
		} finally {
			setIsSaving(false);
		}
	}, [statusUpdate, onUpdateStatus]);

	// Handle contact edit
	const handleEditContact = useCallback((contact: ReferenceContact) => {
		setSelectedContact(contact);
		setShowContactDialog(true);
	}, []);

	// Days since last verification
	const daysSinceVerified = project.lastReferenceCheck
		? Math.floor(
				(Date.now() - new Date(project.lastReferenceCheck).getTime()) /
					(1000 * 60 * 60 * 24)
			)
		: null;

	const needsVerification = daysSinceVerified === null || daysSinceVerified > 90;

	return (
		<div className="space-y-6">
			{/* Status Overview */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<CheckCircle className="h-5 w-5" />
								Reference Status
							</CardTitle>
							<CardDescription>
								Reference availability for "{project.name}"
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<ReferenceStatusBadge
								status={project.referenceStatus}
								lastVerified={project.lastReferenceCheck}
							/>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Customer Info */}
					<div className="p-4 bg-muted/50 rounded-lg">
						<div className="flex items-start gap-4">
							<div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
								<Building2 className="h-6 w-6 text-primary" />
							</div>
							<div className="flex-1">
								<h4 className="font-medium">{project.customerName}</h4>
								{project.customerAgency && (
									<p className="text-sm text-muted-foreground">
										{project.customerAgency}
									</p>
								)}
								<div className="grid gap-2 mt-3 text-sm">
									{project.customerPOC && (
										<div className="flex items-center gap-2">
											<User className="h-4 w-4 text-muted-foreground" />
											{project.customerPOC}
										</div>
									)}
									{project.customerPOCEmail && (
										<div className="flex items-center gap-2">
											<Mail className="h-4 w-4 text-muted-foreground" />
											<a
												href={`mailto:${project.customerPOCEmail}`}
												className="text-primary hover:underline"
											>
												{project.customerPOCEmail}
											</a>
										</div>
									)}
									{project.customerPOCPhone && (
										<div className="flex items-center gap-2">
											<Phone className="h-4 w-4 text-muted-foreground" />
											{project.customerPOCPhone}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Verification Alert */}
					{needsVerification && (
						<div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
							<div className="flex items-center gap-3">
								<AlertCircle className="h-5 w-5 text-yellow-600" />
								<div>
									<p className="font-medium text-yellow-800">
										Reference verification needed
									</p>
									<p className="text-sm text-yellow-700">
										{daysSinceVerified !== null
											? `Last verified ${daysSinceVerified} days ago`
											: "Never verified"}
									</p>
								</div>
							</div>
							<Button onClick={onVerify} disabled={isVerifying}>
								{isVerifying ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Verifying...
									</>
								) : (
									<>
										<RefreshCw className="h-4 w-4 mr-2" />
										Verify Now
									</>
								)}
							</Button>
						</div>
					)}

					{/* Reference Notes */}
					{project.referenceNotes && (
						<div className="p-4 border rounded-lg">
							<div className="flex items-center gap-2 mb-2">
								<MessageSquare className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">Reference Notes</span>
							</div>
							<p className="text-sm text-muted-foreground">
								{project.referenceNotes}
							</p>
						</div>
					)}

					{/* Actions */}
					<div className="flex items-center gap-2 pt-2 border-t">
						<Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
							<DialogTrigger asChild>
								<Button variant="outline">
									<Edit className="h-4 w-4 mr-2" />
									Update Status
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Update Reference Status</DialogTitle>
									<DialogDescription>
										Update the reference availability for this project
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<Label>Status</Label>
										<Select
											value={statusUpdate.status}
											onValueChange={(v) =>
												setStatusUpdate((prev) => ({ ...prev, status: v }))
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="available">Available</SelectItem>
												<SelectItem value="limited">Limited Availability</SelectItem>
												<SelectItem value="unavailable">Unavailable</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Notes</Label>
										<Textarea
											value={statusUpdate.notes}
											onChange={(e) =>
												setStatusUpdate((prev) => ({
													...prev,
													notes: e.target.value,
												}))
											}
											placeholder="Add notes about reference availability..."
											rows={3}
										/>
									</div>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setShowStatusDialog(false)}
									>
										Cancel
									</Button>
									<Button onClick={handleStatusUpdate} disabled={isSaving}>
										{isSaving ? (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										) : null}
										Save Status
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						{onSendVerificationEmail && project.customerPOCEmail && (
							<Button
								variant="outline"
								onClick={() => onSendVerificationEmail(project.customerPOCEmail!)}
							>
								<Send className="h-4 w-4 mr-2" />
								Send Verification Email
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Additional Contacts */}
			{contacts.length > 0 && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-base flex items-center gap-2">
								<User className="h-4 w-4" />
								Additional Contacts
							</CardTitle>
							<Button variant="outline" size="sm">
								<Plus className="h-4 w-4 mr-1" />
								Add Contact
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2">
							{contacts.map((contact, index) => (
								<ContactCard
									key={index}
									contact={contact}
									onEdit={() => handleEditContact(contact)}
									onSendEmail={
										onSendVerificationEmail && contact.email
											? () => onSendVerificationEmail(contact.email!)
											: undefined
									}
								/>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Verification History */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<History className="h-4 w-4" />
						Verification History
					</CardTitle>
				</CardHeader>
				<CardContent>
					<VerificationTimeline history={verificationHistory} />
				</CardContent>
			</Card>
		</div>
	);
}

export default ReferenceTracker;
