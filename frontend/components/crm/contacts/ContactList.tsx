"use client";

/**
 * Contact List Component
 *
 * Displays contacts in a sortable, filterable table with inline actions.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Search,
	Filter,
	SortAsc,
	SortDesc,
	ChevronLeft,
	ChevronRight,
	Mail,
	Phone,
	Linkedin,
	Users,
	ExternalLink,
	Star,
} from "lucide-react";
import { QuickActions } from "../shared";
import type { ContactRow } from "@/lib/db/schema-crm";

interface ContactListProps {
	contacts: ContactRow[];
	total?: number;
	page?: number;
	pageSize?: number;
	onPageChange?: (page: number) => void;
	onSort?: (field: string, direction: "asc" | "desc") => void;
	onSelectContact?: (id: string) => void;
	onContactClick?: (contact: ContactRow) => void;
	onBulkAction?: (action: string, ids: string[]) => void;
	/** Handler for logging a call activity */
	onLogCall?: (contactId: string) => void;
	/** Handler for sending email to contact */
	onSendEmail?: (contactId: string) => void;
	/** Handler for scheduling a meeting */
	onScheduleMeeting?: (contactId: string) => void;
	/** Handler for adding a note */
	onAddNote?: (contactId: string) => void;
	/** Handler for editing a contact */
	onEdit?: (contactId: string) => void;
	isLoading?: boolean;
	showAccountColumn?: boolean;
	className?: string;
}

export function ContactList({
	contacts,
	total = contacts.length,
	page = 1,
	pageSize = 10,
	onPageChange,
	onSort,
	onSelectContact,
	onContactClick,
	onBulkAction,
	onLogCall,
	onSendEmail,
	onScheduleMeeting,
	onAddNote,
	onEdit,
	isLoading = false,
	showAccountColumn = true,
	className,
}: ContactListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [sortField, setSortField] = useState<string>("updatedAt");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

	const totalPages = Math.ceil(total / pageSize);

	// Handle sort
	const handleSort = (field: string) => {
		const newDirection = sortField === field && sortDirection === "asc" ? "desc" : "asc";
		setSortField(field);
		setSortDirection(newDirection);
		onSort?.(field, newDirection);
	};

	// Handle select all
	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			setSelectedIds(new Set(contacts.map((c) => c.id)));
		} else {
			setSelectedIds(new Set());
		}
	};

	// Handle select one
	const handleSelect = (id: string, checked: boolean) => {
		const newSelected = new Set(selectedIds);
		if (checked) {
			newSelected.add(id);
		} else {
			newSelected.delete(id);
		}
		setSelectedIds(newSelected);
	};

	// Format date
	const formatDate = (date: Date | null) => {
		if (!date) return "-";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	// Get initials
	const getInitials = (firstName?: string | null, lastName?: string | null) => {
		return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
	};

	// Get relationship strength color
	const getRelationshipColor = (strength?: string | null) => {
		switch (strength) {
			case "hot":
				return "bg-red-100 text-red-700";
			case "warm":
				return "bg-yellow-100 text-yellow-700";
			case "cold":
				return "bg-blue-100 text-blue-700";
			default:
				return "bg-gray-100 text-gray-700";
		}
	};

	// Sort header component
	const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
		<button
			onClick={() => handleSort(field)}
			className="flex items-center gap-1 hover:text-foreground transition-colors"
		>
			{children}
			{sortField === field && (
				sortDirection === "asc" ? (
					<SortAsc className="h-3.5 w-3.5" />
				) : (
					<SortDesc className="h-3.5 w-3.5" />
				)
			)}
		</button>
	);

	return (
		<div className={cn("space-y-4", className)}>
			{/* Search and Filters */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search contacts..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Button variant="outline" size="sm">
					<Filter className="h-4 w-4 mr-2" />
					Filters
				</Button>
				{selectedIds.size > 0 && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							{selectedIds.size} selected
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onBulkAction?.("export", Array.from(selectedIds))}
						>
							Export
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onBulkAction?.("email", Array.from(selectedIds))}
						>
							Send Email
						</Button>
					</div>
				)}
			</div>

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10">
								<Checkbox
									checked={selectedIds.size === contacts.length && contacts.length > 0}
									onCheckedChange={handleSelectAll}
								/>
							</TableHead>
							<TableHead>
								<SortHeader field="lastName">Contact</SortHeader>
							</TableHead>
							{showAccountColumn && <TableHead>Account</TableHead>}
							<TableHead>Title</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Phone</TableHead>
							<TableHead>Relationship</TableHead>
							<TableHead>
								<SortHeader field="lastContactDate">Last Contact</SortHeader>
							</TableHead>
							<TableHead className="w-10"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							// Loading skeleton
							Array.from({ length: 5 }).map((_, i) => (
								<TableRow key={i}>
									<TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
									<TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
									{showAccountColumn && <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>}
									<TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
									<TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
									<TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
									<TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
									<TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
									<TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
								</TableRow>
							))
						) : contacts.length === 0 ? (
							<TableRow>
								<TableCell colSpan={showAccountColumn ? 9 : 8} className="h-32 text-center">
									<div className="flex flex-col items-center gap-2 text-muted-foreground">
										<Users className="h-8 w-8" />
										<p>No contacts found</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							contacts.map((contact) => (
								<TableRow
									key={contact.id}
									className={cn(
										"cursor-pointer hover:bg-muted/50",
										selectedIds.has(contact.id) && "bg-muted/30"
									)}
								>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<Checkbox
											checked={selectedIds.has(contact.id)}
											onCheckedChange={(checked) => handleSelect(contact.id, checked as boolean)}
										/>
									</TableCell>
									<TableCell>
										<Link
											href={`/crm/contacts/${contact.id}`}
											className="flex items-center gap-3 group"
										>
											<Avatar className="h-9 w-9">
												<AvatarFallback>
													{getInitials(contact.firstName, contact.lastName)}
												</AvatarFallback>
											</Avatar>
											<div>
												<div className="font-medium group-hover:text-primary flex items-center gap-1">
													{contact.firstName} {contact.lastName}
													{contact.isPrimaryContact && (
														<Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
													)}
													<ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
												</div>
												{contact.department && (
													<div className="text-xs text-muted-foreground">
														{contact.department}
													</div>
												)}
											</div>
										</Link>
									</TableCell>
									{showAccountColumn && (
										<TableCell>
											{contact.accountId ? (
												<Link
													href={`/crm/accounts/${contact.accountId}`}
													className="text-sm hover:text-primary"
												>
													View Account
												</Link>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
									)}
									<TableCell>
										<span className="text-sm">{contact.title ?? "-"}</span>
									</TableCell>
									<TableCell>
										{contact.email ? (
											<a
												href={`mailto:${contact.email}`}
												className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
												onClick={(e) => e.stopPropagation()}
											>
												<Mail className="h-3.5 w-3.5" />
												{contact.email}
											</a>
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</TableCell>
									<TableCell>
										{contact.phone ? (
											<a
												href={`tel:${contact.phone}`}
												className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
												onClick={(e) => e.stopPropagation()}
											>
												<Phone className="h-3.5 w-3.5" />
												{contact.phone}
											</a>
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</TableCell>
									<TableCell>
										{contact.relationshipStrength && (
											<Badge
												variant="secondary"
												className={cn(
													"capitalize",
													getRelationshipColor(contact.relationshipStrength)
												)}
											>
												{contact.relationshipStrength}
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<span className="text-sm text-muted-foreground">
											{formatDate(contact.lastContactDate)}
										</span>
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<QuickActions
											entityType="contact"
											entityId={contact.id}
											onLogCall={() => onLogCall?.(contact.id)}
											onSendEmail={() => {
												if (onSendEmail) {
													onSendEmail(contact.id);
												} else if (contact.email) {
													window.location.href = `mailto:${contact.email}`;
												}
											}}
											onScheduleMeeting={() => onScheduleMeeting?.(contact.id)}
											onAddNote={() => onAddNote?.(contact.id)}
											onEdit={() => onEdit?.(contact.id) ?? onSelectContact?.(contact.id)}
											onViewDetails={() => onSelectContact?.(contact.id)}
											size="sm"
										/>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<div className="text-sm text-muted-foreground">
					Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} contacts
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onPageChange?.(page - 1)}
						disabled={page <= 1}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<div className="flex items-center gap-1">
						{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							let pageNum: number;
							if (totalPages <= 5) {
								pageNum = i + 1;
							} else if (page <= 3) {
								pageNum = i + 1;
							} else if (page >= totalPages - 2) {
								pageNum = totalPages - 4 + i;
							} else {
								pageNum = page - 2 + i;
							}
							return (
								<Button
									key={pageNum}
									variant={pageNum === page ? "primary" : "outline"}
									size="sm"
									className="w-8"
									onClick={() => onPageChange?.(pageNum)}
								>
									{pageNum}
								</Button>
							);
						})}
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onPageChange?.(page + 1)}
						disabled={page >= totalPages}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

export default ContactList;
