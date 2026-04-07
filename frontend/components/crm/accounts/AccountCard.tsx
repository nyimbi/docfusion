"use client";

/**
 * Account Card Component
 *
 * Card view for displaying account information in grid layouts.
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	StageIndicator,
	StagePipeline,
	AccountTypeBadge,
	LeadScoreBadge,
	HealthScoreBadge,
	FitScoreBadge,
	PartnerTierBadge,
	QuickActions,
	InlineActions,
} from "../shared";
import {
	Building2,
	MapPin,
	Globe,
	Calendar,
	Users,
	Phone,
	Mail,
} from "lucide-react";
import type { AccountRow } from "@/lib/db/schema-crm";
import type { AccountType } from "@/lib/types/crm";

interface AccountCardProps {
	account: AccountRow;
	variant?: "default" | "compact" | "detailed";
	showPipeline?: boolean;
	onClick?: () => void;
	onLogCall?: () => void;
	onSendEmail?: () => void;
	onScheduleMeeting?: () => void;
	onAddNote?: () => void;
	className?: string;
}

export const AccountCard = React.memo(function AccountCard({
	account,
	variant = "default",
	showPipeline = false,
	onClick,
	onLogCall,
	onSendEmail,
	onScheduleMeeting,
	onAddNote,
	className,
}: AccountCardProps) {
	const accountType = account.type as AccountType;

	// Format date
	const formatDate = (date: Date | null) => {
		if (!date) return "Never";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	// Get score component based on account type
	const getScoreComponent = () => {
		switch (accountType) {
			case "partner":
				return account.partnerTier ? (
					<PartnerTierBadge tier={account.partnerTier} size="sm" showLabel={false} />
				) : (
					<FitScoreBadge score={account.partnershipFitScore} variant="compact" size="sm" />
				);
			case "customer":
				return <HealthScoreBadge score={account.customerHealthScore} variant="compact" size="sm" />;
			case "prospect":
			case "lead":
				return <LeadScoreBadge score={account.leadScore} variant="compact" size="sm" />;
			default:
				return null;
		}
	};

	if (variant === "compact") {
		return (
			<Card className={cn("hover:shadow-md transition-shadow", className)}>
				<CardContent className="p-4">
					<Link href={`/crm/accounts/${account.id}`} className="block">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-3 min-w-0">
								<div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
									<Building2 className="h-5 w-5 text-muted-foreground" />
								</div>
								<div className="min-w-0">
									<h3 className="font-medium truncate">{account.name}</h3>
									<div className="flex items-center gap-2 mt-1">
										<AccountTypeBadge type={accountType} size="sm" showIcon={false} />
										<StageIndicator
											stage={account.stage ?? "new"}
											type={accountType}
											variant="dot"
											size="sm"
											showLabel={false}
										/>
									</div>
								</div>
							</div>
							{getScoreComponent()}
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
						<Link href={`/crm/accounts/${account.id}`} className="flex items-start gap-3 min-w-0 flex-1">
							<div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
								<Building2 className="h-6 w-6 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h3 className="font-semibold text-lg truncate">{account.name}</h3>
								<div className="flex items-center gap-2 mt-1">
									<AccountTypeBadge type={accountType} size="sm" />
									<StageIndicator
										stage={account.stage ?? "new"}
										type={accountType}
										size="sm"
									/>
								</div>
							</div>
						</Link>
						<div className="flex items-center gap-2">
							{getScoreComponent()}
							<QuickActions
								entityType="account"
								entityId={account.id}
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
					{showPipeline && (
						<StagePipeline
							currentStage={account.stage ?? "new"}
							type={accountType}
							size="sm"
						/>
					)}

					{account.description && (
						<p className="text-sm text-muted-foreground line-clamp-2">
							{account.description}
						</p>
					)}

					<div className="grid grid-cols-2 gap-3 text-sm">
						{(account.city || account.country) && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<MapPin className="h-4 w-4 flex-shrink-0" />
								<span className="truncate">
									{[account.city, account.country].filter(Boolean).join(", ")}
								</span>
							</div>
						)}
						{account.website && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Globe className="h-4 w-4 flex-shrink-0" />
								<a
									href={account.website}
									target="_blank"
									rel="noopener noreferrer"
									className="truncate hover:text-primary"
									onClick={(e) => e.stopPropagation()}
								>
									{account.website.replace(/^https?:\/\//, "")}
								</a>
							</div>
						)}
						{account.employeeCount && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Users className="h-4 w-4 flex-shrink-0" />
								<span>{account.employeeCount} employees</span>
							</div>
						)}
						<div className="flex items-center gap-2 text-muted-foreground">
							<Calendar className="h-4 w-4 flex-shrink-0" />
							<span>Last contact: {formatDate(account.lastContactDate)}</span>
						</div>
					</div>

					{/* Tags */}
					{(account.tags as string[])?.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{(account.tags as string[]).slice(0, 3).map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
								>
									{tag}
								</span>
							))}
							{(account.tags as string[]).length > 3 && (
								<span className="text-xs text-muted-foreground">
									+{(account.tags as string[]).length - 3} more
								</span>
							)}
						</div>
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
							href={`/crm/accounts/${account.id}`}
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
					<Link href={`/crm/accounts/${account.id}`} className="flex items-center gap-3 min-w-0 flex-1">
						<div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
							<Building2 className="h-5 w-5 text-muted-foreground" />
						</div>
						<div className="min-w-0">
							<h3 className="font-medium truncate">{account.name}</h3>
							<div className="flex items-center gap-2 mt-1">
								<StageIndicator
									stage={account.stage ?? "new"}
									type={accountType}
									variant="dot"
									size="sm"
								/>
							</div>
						</div>
					</Link>
					<QuickActions
						entityType="account"
						entityId={account.id}
						onLogCall={onLogCall}
						onSendEmail={onSendEmail}
						onScheduleMeeting={onScheduleMeeting}
						onAddNote={onAddNote}
						size="sm"
					/>
				</div>

				<div className="space-y-2 text-sm">
					{(account.city || account.country) && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<MapPin className="h-3.5 w-3.5" />
							<span className="truncate">
								{[account.city, account.country].filter(Boolean).join(", ")}
							</span>
						</div>
					)}
					<div className="flex items-center gap-2 text-muted-foreground">
						<Calendar className="h-3.5 w-3.5" />
						<span>Last: {formatDate(account.lastContactDate)}</span>
					</div>
				</div>

				<div className="flex items-center justify-between mt-3 pt-3 border-t">
					<AccountTypeBadge type={accountType} size="sm" showIcon={false} />
					{getScoreComponent()}
				</div>
			</CardContent>
		</Card>
	);
});

AccountCard.displayName = "AccountCard";

export default AccountCard;
