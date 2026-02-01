"use client";

/**
 * Account Detail Component
 *
 * Full account detail view with tabs for contacts, activities,
 * deals, documents, and timeline.
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	StageIndicator,
	StagePipeline,
	AccountTypeBadge,
	LeadScoreBadge,
	HealthScoreBadge,
	FitScoreBadge,
	PartnerTierBadge,
	QuickActions,
} from "../shared";
import {
	Building2,
	Globe,
	MapPin,
	Phone,
	Mail,
	Calendar,
	Users,
	DollarSign,
	ExternalLink,
	Edit,
	MoreHorizontal,
	Plus,
	ArrowRight,
	Clock,
	FileText,
	Activity,
	Briefcase,
	ChevronLeft,
} from "lucide-react";
import type { AccountRow, ContactRow, ActivityRow, DealRow } from "@/lib/db/schema-crm";
import type { AccountType } from "@/lib/types/crm";
import { AccountResearchPanel } from "./AccountResearchPanel";

interface AccountDetailProps {
	account: AccountRow;
	contacts?: ContactRow[];
	activities?: ActivityRow[];
	deals?: DealRow[];
	onEdit?: () => void;
	onStageChange?: (stage: string) => void;
	onLogActivity?: (type: string) => void;
	onAddContact?: () => void;
	onAddDeal?: () => void;
	onContactClick?: (contact: ContactRow) => void;
	onActivityClick?: (activity: ActivityRow) => void;
	onDealClick?: (deal: DealRow) => void;
	className?: string;
}

export function AccountDetail({
	account,
	contacts = [],
	activities = [],
	deals = [],
	onEdit,
	onStageChange,
	onLogActivity,
	onAddContact,
	onAddDeal,
	onContactClick,
	onActivityClick,
	onDealClick,
	className,
}: AccountDetailProps) {
	const [activeTab, setActiveTab] = useState("overview");
	const accountType = account.type as AccountType;

	// Format currency
	const formatCurrency = (value: number | null, currency = "USD") => {
		if (!value) return "-";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
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

	// Get score component based on account type
	const getScoreComponent = () => {
		switch (accountType) {
			case "partner":
				return account.partnerTier ? (
					<PartnerTierBadge tier={account.partnerTier} />
				) : (
					<FitScoreBadge score={account.partnershipFitScore} />
				);
			case "customer":
				return <HealthScoreBadge score={account.customerHealthScore} />;
			case "prospect":
			case "lead":
				return <LeadScoreBadge score={account.leadScore} />;
			default:
				return null;
		}
	};

	// Get primary contact
	const primaryContact = contacts.find((c) => c.isPrimaryContact);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-start gap-4">
					<Link
						href="/crm/accounts"
						className="mt-1 p-2 hover:bg-muted rounded-md"
					>
						<ChevronLeft className="h-5 w-5" />
					</Link>

					<div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
						<Building2 className="h-8 w-8 text-muted-foreground" />
					</div>

					<div>
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-bold">{account.name}</h1>
							<AccountTypeBadge type={accountType} />
							{getScoreComponent()}
						</div>

						<div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
							{account.industry && (
								<span>{account.industry}</span>
							)}
							{(account.city || account.country) && (
								<span className="flex items-center gap-1">
									<MapPin className="h-3.5 w-3.5" />
									{[account.city, account.country].filter(Boolean).join(", ")}
								</span>
							)}
							{account.website && (
								<a
									href={account.website}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1 hover:text-primary"
								>
									<Globe className="h-3.5 w-3.5" />
									{account.website.replace(/^https?:\/\//, "")}
								</a>
							)}
						</div>

						{/* Stage Pipeline */}
						<div className="mt-4">
							<StagePipeline
								currentStage={account.stage ?? "new"}
								type={accountType}
								onStageClick={onStageChange}
							/>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<AccountResearchPanel
						account={account}
						onResearchComplete={() => {
							// Refresh the page to show updated data
							window.location.reload();
						}}
					/>

					<QuickActions
						entityType="account"
						entityId={account.id}
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

			{/* Main Content */}
			<div className="grid grid-cols-3 gap-6">
				{/* Left Column - Details & Tabs */}
				<div className="col-span-2 space-y-6">
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="contacts">
								Contacts ({contacts.length})
							</TabsTrigger>
							<TabsTrigger value="activities">
								Activities ({activities.length})
							</TabsTrigger>
							<TabsTrigger value="deals">
								Deals ({deals.length})
							</TabsTrigger>
						</TabsList>

						{/* Overview Tab */}
						<TabsContent value="overview" className="space-y-4 mt-4">
							{/* Description */}
							{account.description && (
								<Card>
									<CardHeader>
										<CardTitle>About</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-muted-foreground">
											{account.description}
										</p>
									</CardContent>
								</Card>
							)}

							{/* Contact Information */}
							{(account.email || account.phone || account.keyLeadership || account.headquarters) && (
								<Card>
									<CardHeader>
										<CardTitle>Contact Information</CardTitle>
									</CardHeader>
									<CardContent>
										<dl className="grid grid-cols-2 gap-4">
											{account.email && (
												<div>
													<dt className="text-sm text-muted-foreground">Email</dt>
													<dd>
														<a
															href={`mailto:${account.email}`}
															className="text-primary hover:underline flex items-center gap-1"
														>
															<Mail className="h-3.5 w-3.5" />
															{account.email}
														</a>
													</dd>
												</div>
											)}
											{account.phone && (
												<div>
													<dt className="text-sm text-muted-foreground">Phone</dt>
													<dd>
														<a
															href={`tel:${account.phone}`}
															className="text-primary hover:underline flex items-center gap-1"
														>
															<Phone className="h-3.5 w-3.5" />
															{account.phone}
														</a>
													</dd>
												</div>
											)}
											{account.headquarters && (
												<div>
													<dt className="text-sm text-muted-foreground">Headquarters</dt>
													<dd className="font-medium flex items-center gap-1">
														<MapPin className="h-3.5 w-3.5 text-muted-foreground" />
														{account.headquarters}
													</dd>
												</div>
											)}
											{account.address && (
												<div className="col-span-2">
													<dt className="text-sm text-muted-foreground">Address</dt>
													<dd className="font-medium">{account.address}</dd>
												</div>
											)}
										</dl>
										{account.keyLeadership && (
											<div className="mt-4">
												<dt className="text-sm text-muted-foreground mb-1">Key Leadership</dt>
												<dd className="text-sm">{account.keyLeadership}</dd>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Company Details */}
							<Card>
								<CardHeader>
									<CardTitle>Company Details</CardTitle>
								</CardHeader>
								<CardContent>
									<dl className="grid grid-cols-2 gap-4">
										{account.industry && (
											<div>
												<dt className="text-sm text-muted-foreground">Industry</dt>
												<dd className="font-medium">{account.industry}</dd>
											</div>
										)}
										{account.sector && (
											<div>
												<dt className="text-sm text-muted-foreground">Sector</dt>
												<dd className="font-medium">{account.sector}</dd>
											</div>
										)}
										{account.companySize && (
											<div>
												<dt className="text-sm text-muted-foreground">Company Size</dt>
												<dd className="font-medium capitalize">{account.companySize}</dd>
											</div>
										)}
										{account.employeeCount && (
											<div>
												<dt className="text-sm text-muted-foreground">Employees</dt>
												<dd className="font-medium">{account.employeeCount}</dd>
											</div>
										)}
										{account.foundedYear && (
											<div>
												<dt className="text-sm text-muted-foreground">Founded</dt>
												<dd className="font-medium">{account.foundedYear}</dd>
											</div>
										)}
										{account.annualRevenue && (
											<div>
												<dt className="text-sm text-muted-foreground">Annual Revenue</dt>
												<dd className="font-medium">{account.annualRevenue}</dd>
											</div>
										)}
										{account.region && (
											<div>
												<dt className="text-sm text-muted-foreground">Region</dt>
												<dd className="font-medium">{account.region}</dd>
											</div>
										)}
										{account.linkedinUrl && (
											<div>
												<dt className="text-sm text-muted-foreground">LinkedIn</dt>
												<dd>
													<a
														href={account.linkedinUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-primary hover:underline flex items-center gap-1"
													>
														View Profile
														<ExternalLink className="h-3 w-3" />
													</a>
												</dd>
											</div>
										)}
									</dl>
								</CardContent>
							</Card>

							{/* Type-specific details */}
							{accountType === "partner" && (
								<>
									{account.coreCapabilities && (
										<Card>
											<CardHeader>
												<CardTitle>Core Capabilities</CardTitle>
											</CardHeader>
											<CardContent>
												<p className="text-muted-foreground">
													{account.coreCapabilities}
												</p>
												{(account.capabilities as string[])?.length > 0 && (
													<div className="flex flex-wrap gap-2 mt-4">
														{(account.capabilities as string[]).map((cap) => (
															<Badge key={cap} variant="secondary">
																{cap}
															</Badge>
														))}
													</div>
												)}
											</CardContent>
										</Card>
									)}

									{/* Partner Assessment */}
									{(account.notableClients || account.riskAssessment || account.fitJustification) && (
										<Card>
											<CardHeader>
												<CardTitle>Partner Assessment</CardTitle>
											</CardHeader>
											<CardContent className="space-y-4">
												<dl className="grid grid-cols-2 gap-4">
													{account.corporateStatus && (
														<div>
															<dt className="text-sm text-muted-foreground">Corporate Status</dt>
															<dd className="font-medium">{account.corporateStatus}</dd>
														</div>
													)}
													{account.riskAssessment && (
														<div>
															<dt className="text-sm text-muted-foreground">Risk Assessment</dt>
															<dd>
																<Badge
																	variant={
																		account.riskAssessment.toLowerCase().includes("low")
																			? "default"
																			: account.riskAssessment.toLowerCase().includes("high")
																			? "destructive"
																			: "secondary"
																	}
																>
																	{account.riskAssessment}
																</Badge>
															</dd>
														</div>
													)}
												</dl>
												{account.notableClients && (
													<div>
														<dt className="text-sm text-muted-foreground mb-1">Notable Clients/Projects</dt>
														<dd className="text-sm">{account.notableClients}</dd>
													</div>
												)}
												{account.fitJustification && (
													<div>
														<dt className="text-sm text-muted-foreground mb-1">Partnership Fit Justification</dt>
														<dd className="text-sm bg-muted/50 p-3 rounded-md">
															{account.fitJustification}
														</dd>
													</div>
												)}
											</CardContent>
										</Card>
									)}
								</>
							)}

							{accountType === "customer" && (
								<Card>
									<CardHeader>
										<CardTitle>Contract Details</CardTitle>
									</CardHeader>
									<CardContent>
										<dl className="grid grid-cols-2 gap-4">
											<div>
												<dt className="text-sm text-muted-foreground">Contract Value</dt>
												<dd className="font-medium">
													{formatCurrency(account.contractValue, account.contractCurrency ?? "USD")}
												</dd>
											</div>
											<div>
												<dt className="text-sm text-muted-foreground">Customer Since</dt>
												<dd className="font-medium">
													{formatDate(account.customerSince)}
												</dd>
											</div>
											<div>
												<dt className="text-sm text-muted-foreground">Renewal Date</dt>
												<dd className="font-medium">
													{formatDate(account.contractRenewalDate)}
												</dd>
											</div>
											<div>
												<dt className="text-sm text-muted-foreground">Churn Risk</dt>
												<dd>
													<Badge
														variant={
															account.churnRisk === "high"
																? "destructive"
																: account.churnRisk === "medium"
																? "default"
																: "secondary"
														}
													>
														{account.churnRisk ?? "Unknown"}
													</Badge>
												</dd>
											</div>
										</dl>
									</CardContent>
								</Card>
							)}

							{(accountType === "lead" || accountType === "prospect") && (
								<Card>
									<CardHeader>
										<CardTitle>Lead Information</CardTitle>
									</CardHeader>
									<CardContent>
										<dl className="grid grid-cols-2 gap-4">
											<div>
												<dt className="text-sm text-muted-foreground">Lead Source</dt>
												<dd className="font-medium">{account.leadSource ?? "-"}</dd>
											</div>
											<div>
												<dt className="text-sm text-muted-foreground">Qualification Status</dt>
												<dd className="font-medium capitalize">
													{account.qualificationStatus ?? "-"}
												</dd>
											</div>
											{account.category && (
												<div>
													<dt className="text-sm text-muted-foreground">Category</dt>
													<dd className="font-medium">{account.category}</dd>
												</div>
											)}
											{account.subCategory && (
												<div>
													<dt className="text-sm text-muted-foreground">Sub-Category</dt>
													<dd className="font-medium">{account.subCategory}</dd>
												</div>
											)}
											{account.organizationType && (
												<div>
													<dt className="text-sm text-muted-foreground">Organization Type</dt>
													<dd className="font-medium">{account.organizationType}</dd>
												</div>
											)}
											{account.priorityTier && (
												<div>
													<dt className="text-sm text-muted-foreground">Priority Tier</dt>
													<dd>
														<Badge
															variant={
																account.priorityTier === "Tier 1"
																	? "default"
																	: account.priorityTier === "Tier 2"
																	? "secondary"
																	: "outline"
															}
														>
															{account.priorityTier}
														</Badge>
													</dd>
												</div>
											)}
										</dl>
										{account.pitchingAngle && (
											<div className="mt-4">
												<dt className="text-sm text-muted-foreground mb-1">Pitching Angle</dt>
												<dd className="text-sm bg-muted/50 p-3 rounded-md">
													{account.pitchingAngle}
												</dd>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Grant Maker Details */}
							{account.annualGiving && (
								<Card>
									<CardHeader>
										<CardTitle>Grant Maker Profile</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<dl className="grid grid-cols-2 gap-4">
											<div>
												<dt className="text-sm text-muted-foreground">Annual Giving</dt>
												<dd className="font-medium">{account.annualGiving}</dd>
											</div>
											{account.grantRange && (
												<div>
													<dt className="text-sm text-muted-foreground">Grant Range</dt>
													<dd className="font-medium">{account.grantRange}</dd>
												</div>
											)}
											{account.impactScore && (
												<div>
													<dt className="text-sm text-muted-foreground">Impact Score</dt>
													<dd>
														<Badge variant={account.impactScore >= 8 ? "default" : "secondary"}>
															{account.impactScore}/10
														</Badge>
													</dd>
												</div>
											)}
										</dl>
										{account.focusAreas && (
											<div>
												<dt className="text-sm text-muted-foreground mb-1">Focus Areas</dt>
												<dd className="text-sm">{account.focusAreas}</dd>
											</div>
										)}
										{account.geographicFocus && (
											<div>
												<dt className="text-sm text-muted-foreground mb-1">Geographic Focus</dt>
												<dd className="text-sm">{account.geographicFocus}</dd>
											</div>
										)}
										{account.applicationProcess && (
											<div>
												<dt className="text-sm text-muted-foreground mb-1">Application Process</dt>
												<dd className="text-sm bg-muted/50 p-3 rounded-md">
													{account.applicationProcess}
												</dd>
											</div>
										)}
										{account.grantHistory && (
											<div>
												<dt className="text-sm text-muted-foreground mb-1">Grant History</dt>
												<dd className="text-sm">{account.grantHistory}</dd>
											</div>
										)}
									</CardContent>
								</Card>
							)}
						</TabsContent>

						{/* Contacts Tab */}
						<TabsContent value="contacts" className="space-y-4 mt-4">
							<div className="flex justify-between items-center">
								<h3 className="font-semibold">
									Contacts ({contacts.length})
								</h3>
								<Button size="sm" onClick={onAddContact}>
									<Plus className="h-4 w-4 mr-1" />
									Add Contact
								</Button>
							</div>

							{contacts.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-8">
										<Users className="h-12 w-12 text-muted-foreground mb-4" />
										<p className="text-muted-foreground">No contacts yet</p>
										<Button
											variant="outline"
											size="sm"
											className="mt-4"
											onClick={onAddContact}
										>
											Add First Contact
										</Button>
									</CardContent>
								</Card>
							) : (
								<div className="space-y-3">
									{contacts.map((contact) => (
										<Card key={contact.id}>
											<CardContent className="p-4">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-3">
														<Avatar>
															<AvatarFallback>
																{contact.firstName?.[0]}
																{contact.lastName?.[0]}
															</AvatarFallback>
														</Avatar>
														<div>
															<div className="flex items-center gap-2">
																<span className="font-medium">
																	{contact.firstName} {contact.lastName}
																</span>
																{contact.isPrimaryContact && (
																	<Badge variant="secondary" className="text-xs">
																		Primary
																	</Badge>
																)}
															</div>
															<p className="text-sm text-muted-foreground">
																{contact.title}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-2">
														{contact.email && (
															<Button variant="ghost" size="sm" asChild>
																<a href={`mailto:${contact.email}`}>
																	<Mail className="h-4 w-4" />
																</a>
															</Button>
														)}
														{contact.phone && (
															<Button variant="ghost" size="sm" asChild>
																<a href={`tel:${contact.phone}`}>
																	<Phone className="h-4 w-4" />
																</a>
															</Button>
														)}
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</TabsContent>

						{/* Activities Tab */}
						<TabsContent value="activities" className="space-y-4 mt-4">
							<div className="flex justify-between items-center">
								<h3 className="font-semibold">
									Activities ({activities.length})
								</h3>
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
									{activities.slice(0, 10).map((activity) => (
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

						{/* Deals Tab */}
						<TabsContent value="deals" className="space-y-4 mt-4">
							<div className="flex justify-between items-center">
								<h3 className="font-semibold">
									Deals ({deals.length})
								</h3>
								<Button size="sm" onClick={onAddDeal}>
									<Plus className="h-4 w-4 mr-1" />
									Add Deal
								</Button>
							</div>

							{deals.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-8">
										<Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
										<p className="text-muted-foreground">No deals yet</p>
										<Button
											variant="outline"
											size="sm"
											className="mt-4"
											onClick={onAddDeal}
										>
											Create First Deal
										</Button>
									</CardContent>
								</Card>
							) : (
								<div className="space-y-3">
									{deals.map((deal) => (
										<Card key={deal.id}>
											<CardContent className="p-4">
												<div className="flex items-center justify-between">
													<div>
														<h4 className="font-medium">{deal.name}</h4>
														<p className="text-sm text-muted-foreground">
															{deal.stage} • Expected close: {formatDate(deal.expectedCloseDate)}
														</p>
													</div>
													<div className="text-right">
														<div className="font-semibold">
															{formatCurrency(deal.value, deal.currency ?? "USD")}
														</div>
														<Badge
															variant={
																deal.status === "won"
																	? "default"
																	: deal.status === "lost"
																	? "destructive"
																	: "secondary"
															}
														>
															{deal.status}
														</Badge>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
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
								<span className="text-sm text-muted-foreground">Owner</span>
								<p className="font-medium">{account.ownerName ?? "Unassigned"}</p>
							</div>
							<Separator />
							<div>
								<span className="text-sm text-muted-foreground">Last Contact</span>
								<p className="font-medium">
									{formatRelativeTime(account.lastContactDate)}
								</p>
							</div>
							<Separator />
							<div>
								<span className="text-sm text-muted-foreground">Next Follow-up</span>
								<p className="font-medium">
									{account.nextFollowUpDate
										? formatDate(account.nextFollowUpDate)
										: "Not scheduled"}
								</p>
							</div>
							<Separator />
							<div>
								<span className="text-sm text-muted-foreground">Created</span>
								<p className="font-medium">{formatDate(account.createdAt)}</p>
							</div>
						</CardContent>
					</Card>

					{/* Primary Contact */}
					{primaryContact && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Primary Contact</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex items-center gap-3">
									<Avatar>
										<AvatarFallback>
											{primaryContact.firstName?.[0]}
											{primaryContact.lastName?.[0]}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-medium">
											{primaryContact.firstName} {primaryContact.lastName}
										</p>
										<p className="text-sm text-muted-foreground">
											{primaryContact.title}
										</p>
									</div>
								</div>
								<div className="mt-4 space-y-2">
									{primaryContact.email && (
										<a
											href={`mailto:${primaryContact.email}`}
											className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
										>
											<Mail className="h-4 w-4" />
											{primaryContact.email}
										</a>
									)}
									{primaryContact.phone && (
										<a
											href={`tel:${primaryContact.phone}`}
											className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
										>
											<Phone className="h-4 w-4" />
											{primaryContact.phone}
										</a>
									)}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Tags */}
					{(account.tags as string[])?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Tags</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{(account.tags as string[]).map((tag) => (
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

export default AccountDetail;
