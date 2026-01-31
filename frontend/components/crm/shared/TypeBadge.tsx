"use client";

/**
 * Type Badge Component
 *
 * Visual badges for displaying account and activity types.
 */

import { cn } from "@/lib/utils";
import {
	Users,
	UserCheck,
	Target,
	Building2,
	Truck,
	HelpCircle,
	Mail,
	Phone,
	Calendar,
	FileText,
	MessageSquare,
	Linkedin,
	MessageCircle,
	Presentation,
	Bell,
	CheckSquare,
} from "lucide-react";
import type { AccountType, ActivityType } from "@/lib/types/crm";

// Account type configuration
const accountTypeConfig: Record<
	AccountType,
	{ label: string; icon: React.ElementType; color: string }
> = {
	partner: { label: "Partner", icon: Users, color: "purple" },
	prospect: { label: "Prospect", icon: Target, color: "blue" },
	lead: { label: "Lead", icon: UserCheck, color: "indigo" },
	customer: { label: "Customer", icon: Building2, color: "green" },
	vendor: { label: "Vendor", icon: Truck, color: "orange" },
	other: { label: "Other", icon: HelpCircle, color: "gray" },
};

// Activity type configuration
const activityTypeConfig: Record<
	ActivityType,
	{ label: string; icon: React.ElementType; color: string }
> = {
	email: { label: "Email", icon: Mail, color: "blue" },
	call: { label: "Call", icon: Phone, color: "green" },
	meeting: { label: "Meeting", icon: Calendar, color: "purple" },
	task: { label: "Task", icon: CheckSquare, color: "orange" },
	note: { label: "Note", icon: FileText, color: "gray" },
	linkedin: { label: "LinkedIn", icon: Linkedin, color: "blue" },
	whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "green" },
	sms: { label: "SMS", icon: MessageSquare, color: "teal" },
	event: { label: "Event", icon: Bell, color: "indigo" },
	demo: { label: "Demo", icon: Presentation, color: "pink" },
	proposal: { label: "Proposal", icon: FileText, color: "yellow" },
};

// Color classes mapping
const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
	gray: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
	blue: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
	indigo: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300" },
	purple: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
	yellow: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
	orange: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
	green: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
	red: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
	teal: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300" },
	pink: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300" },
};

interface AccountTypeBadgeProps {
	type: AccountType;
	variant?: "badge" | "icon" | "pill";
	size?: "sm" | "md" | "lg";
	showIcon?: boolean;
	className?: string;
}

export function AccountTypeBadge({
	type,
	variant = "badge",
	size = "md",
	showIcon = true,
	className,
}: AccountTypeBadgeProps) {
	const config = accountTypeConfig[type] ?? accountTypeConfig.other;
	const colors = colorClasses[config.color] ?? colorClasses.gray;
	const Icon = config.icon;

	const sizeClasses = {
		sm: { badge: "text-xs px-1.5 py-0.5", icon: "h-3 w-3" },
		md: { badge: "text-sm px-2 py-1", icon: "h-3.5 w-3.5" },
		lg: { badge: "text-base px-3 py-1.5", icon: "h-4 w-4" },
	};

	if (variant === "icon") {
		return (
			<div
				className={cn(
					"flex items-center justify-center rounded-md",
					colors.bg,
					colors.text,
					size === "sm" ? "h-6 w-6" : size === "md" ? "h-8 w-8" : "h-10 w-10",
					className
				)}
				title={config.label}
			>
				<Icon className={sizeClasses[size].icon} />
			</div>
		);
	}

	if (variant === "pill") {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded-full border",
					colors.bg,
					colors.text,
					colors.border,
					sizeClasses[size].badge,
					className
				)}
			>
				{showIcon && <Icon className={sizeClasses[size].icon} />}
				{config.label}
			</span>
		);
	}

	// Default badge variant
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-md font-medium",
				colors.bg,
				colors.text,
				sizeClasses[size].badge,
				className
			)}
		>
			{showIcon && <Icon className={sizeClasses[size].icon} />}
			{config.label}
		</span>
	);
}

interface ActivityTypeBadgeProps {
	type: ActivityType;
	variant?: "badge" | "icon" | "pill";
	size?: "sm" | "md" | "lg";
	showIcon?: boolean;
	className?: string;
}

export function ActivityTypeBadge({
	type,
	variant = "badge",
	size = "md",
	showIcon = true,
	className,
}: ActivityTypeBadgeProps) {
	const config = activityTypeConfig[type] ?? activityTypeConfig.note;
	const colors = colorClasses[config.color] ?? colorClasses.gray;
	const Icon = config.icon;

	const sizeClasses = {
		sm: { badge: "text-xs px-1.5 py-0.5", icon: "h-3 w-3" },
		md: { badge: "text-sm px-2 py-1", icon: "h-3.5 w-3.5" },
		lg: { badge: "text-base px-3 py-1.5", icon: "h-4 w-4" },
	};

	if (variant === "icon") {
		return (
			<div
				className={cn(
					"flex items-center justify-center rounded-md",
					colors.bg,
					colors.text,
					size === "sm" ? "h-6 w-6" : size === "md" ? "h-8 w-8" : "h-10 w-10",
					className
				)}
				title={config.label}
			>
				<Icon className={sizeClasses[size].icon} />
			</div>
		);
	}

	if (variant === "pill") {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded-full border",
					colors.bg,
					colors.text,
					colors.border,
					sizeClasses[size].badge,
					className
				)}
			>
				{showIcon && <Icon className={sizeClasses[size].icon} />}
				{config.label}
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-md font-medium",
				colors.bg,
				colors.text,
				sizeClasses[size].badge,
				className
			)}
		>
			{showIcon && <Icon className={sizeClasses[size].icon} />}
			{config.label}
		</span>
	);
}

// Get icon component for type (useful for custom rendering)
export function getAccountTypeIcon(type: AccountType): React.ElementType {
	return accountTypeConfig[type]?.icon ?? HelpCircle;
}

export function getActivityTypeIcon(type: ActivityType): React.ElementType {
	return activityTypeConfig[type]?.icon ?? FileText;
}

export default AccountTypeBadge;
