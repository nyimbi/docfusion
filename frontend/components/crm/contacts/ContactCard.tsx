"use client";

/**
 * Contact Card Component
 *
 * Card view for displaying contact information in grid layouts.
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { QuickActions, InlineActions } from "../shared";
import {
	Mail,
	Phone,
	MapPin,
	Linkedin,
	Star,
	Building2,
} from "lucide-react";
import type { ContactRow } from "@/lib/db/schema-crm";

interface ContactCardProps {
	contact: ContactRow;
	variant?: "default" | "compact" | "detailed";
	accountName?: string;
	onClick?: () => void;
	onLogCall?: () => void;
	onSendEmail?: () => void;
	onScheduleMeeting?: () => void;
	onAddNote?: () => void;
	className?: string;
}

export const ContactCard = React.memo(function ContactCard({
	contact,
	variant = "default",
	accountName,
	onClick,
	onLogCall,
	onSendEmail,
	onScheduleMeeting,
	onAddNote,
	className,
}: ContactCardProps) {
	// Get initials
	const getInitials = () => {
		return `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase() || "?";
	};

	// Get relationship color
	const getRelationshipColor = () => {
		switch (contact.relationshipStrength) {
			case "hot":
				return "bg-red-100 text-red-700 border-red-300";
			case "warm":
				return "bg-yellow-100 text-yellow-700 border-yellow-300";
			case "cold":
				return "bg-blue-100 text-blue-700 border-blue-300";
			default:
				return "";
		}
	};

	// Get sentiment icon/color
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

	// Format date
	const formatDate = (date: Date | null) => {
		if (!date) return "Never";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	if (variant === "compact") {
		return (
			<Card className={cn("hover:shadow-md transition-shadow", className)}>
				<CardContent className="p-4">
					<Link href={`/crm/contacts/${contact.id}`} className="block">
						<div className="flex items-center gap-3">
							<Avatar className="h-10 w-10">
								<AvatarFallback>{getInitials()}</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<h3 className="font-medium truncate">
										{contact.firstName} {contact.lastName}
									</h3>
									{contact.isPrimaryContact && (
										<Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
									)}
								</div>
								<p className="text-sm text-muted-foreground truncate">
									{contact.title}
								</p>
							</div>
							{contact.relationshipStrength && (
								<Badge
									variant="outline"
									className={cn("capitalize text-xs", getRelationshipColor())}
								>
									{contact.relationshipStrength}
								</Badge>
							)}
						</div>
					</Link>
				</CardContent>
			</Card>
		);
	}

	if (variant === "detailed") {
		return (
			<Card className={cn("hover:shadow-md transition-shadow", className)}>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between gap-4">
						<Link
							href={`/crm/contacts/${contact.id}`}
							className="flex items-start gap-3 min-w-0 flex-1"
						>
							<Avatar className="h-12 w-12">
								<AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<h3 className="font-semibold text-lg truncate">
										{contact.firstName} {contact.lastName}
									</h3>
									{contact.isPrimaryContact && (
										<Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
									)}
								</div>
								<p className="text-muted-foreground truncate">
									{contact.title}
								</p>
								{contact.department && (
									<p className="text-sm text-muted-foreground">
										{contact.department}
									</p>
								)}
							</div>
						</Link>
						<div className="flex items-center gap-2">
							{getSentimentBadge()}
							<QuickActions
								entityType="contact"
								entityId={contact.id}
								onLogCall={onLogCall}
								onSendEmail={onSendEmail}
								onScheduleMeeting={onScheduleMeeting}
								onAddNote={onAddNote}
								size="sm"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Account */}
					{(accountName || contact.accountId) && (
						<div className="flex items-center gap-2 text-sm">
							<Building2 className="h-4 w-4 text-muted-foreground" />
							{contact.accountId ? (
								<Link
									href={`/crm/accounts/${contact.accountId}`}
									className="text-primary hover:underline"
								>
									{accountName ?? "View Account"}
								</Link>
							) : (
								<span className="text-muted-foreground">No account</span>
							)}
						</div>
					)}

					{/* Contact Info */}
					<div className="space-y-2">
						{contact.email && (
							<a
								href={`mailto:${contact.email}`}
								className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
							>
								<Mail className="h-4 w-4" />
								{contact.email}
							</a>
						)}
						{contact.phone && (
							<a
								href={`tel:${contact.phone}`}
								className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
							>
								<Phone className="h-4 w-4" />
								{contact.phone}
							</a>
						)}
						{contact.linkedinUrl && (
							<a
								href={contact.linkedinUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
							>
								<Linkedin className="h-4 w-4" />
								LinkedIn Profile
							</a>
						)}
						{(contact.city || contact.country) && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<MapPin className="h-4 w-4" />
								{[contact.city, contact.country].filter(Boolean).join(", ")}
							</div>
						)}
					</div>

					{/* Tags */}
					{(contact.tags as string[])?.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{(contact.tags as string[]).slice(0, 3).map((tag) => (
								<Badge key={tag} variant="secondary" className="text-xs">
									{tag}
								</Badge>
							))}
							{(contact.tags as string[]).length > 3 && (
								<Badge variant="outline" className="text-xs">
									+{(contact.tags as string[]).length - 3}
								</Badge>
							)}
						</div>
					)}

					{/* Notes preview */}
					{contact.notes && (
						<p className="text-sm text-muted-foreground line-clamp-2">
							{contact.notes}
						</p>
					)}

					{/* Quick actions */}
					<div className="flex items-center justify-between pt-2 border-t">
						<InlineActions
							onLogCall={onLogCall}
							onSendEmail={onSendEmail}
							onScheduleMeeting={onScheduleMeeting}
							onAddNote={onAddNote}
						/>
						<Link
							href={`/crm/contacts/${contact.id}`}
							className="text-sm text-primary hover:underline"
						>
							View details
						</Link>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Default variant
	return (
		<Card className={cn("hover:shadow-md transition-shadow", className)}>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-3 mb-3">
					<Link
						href={`/crm/contacts/${contact.id}`}
						className="flex items-center gap-3 min-w-0 flex-1"
					>
						<Avatar className="h-10 w-10">
							<AvatarFallback>{getInitials()}</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h3 className="font-medium truncate">
									{contact.firstName} {contact.lastName}
								</h3>
								{contact.isPrimaryContact && (
									<Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
								)}
							</div>
							<p className="text-sm text-muted-foreground truncate">
								{contact.title}
							</p>
						</div>
					</Link>
					<QuickActions
						entityType="contact"
						entityId={contact.id}
						onLogCall={onLogCall}
						onSendEmail={onSendEmail}
						onScheduleMeeting={onScheduleMeeting}
						onAddNote={onAddNote}
						size="sm"
					/>
				</div>

				<div className="space-y-2 text-sm">
					{contact.email && (
						<a
							href={`mailto:${contact.email}`}
							className="flex items-center gap-2 text-muted-foreground hover:text-primary"
						>
							<Mail className="h-3.5 w-3.5" />
							<span className="truncate">{contact.email}</span>
						</a>
					)}
					{contact.phone && (
						<a
							href={`tel:${contact.phone}`}
							className="flex items-center gap-2 text-muted-foreground hover:text-primary"
						>
							<Phone className="h-3.5 w-3.5" />
							{contact.phone}
						</a>
					)}
				</div>

				<div className="flex items-center justify-between mt-3 pt-3 border-t">
					{contact.relationshipStrength ? (
						<Badge
							variant="outline"
							className={cn("capitalize text-xs", getRelationshipColor())}
						>
							{contact.relationshipStrength}
						</Badge>
					) : (
						<span />
					)}
					<span className="text-xs text-muted-foreground">
						Last: {formatDate(contact.lastContactDate)}
					</span>
				</div>
			</CardContent>
		</Card>
	);
});

ContactCard.displayName = "ContactCard";

export default ContactCard;
