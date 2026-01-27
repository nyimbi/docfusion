/**
 * Collaborator avatars component for DocFusion.
 *
 * Displays a stack of avatar icons for active collaborators
 * with tooltips showing names and activity status.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CollaboratorPresence, CollaboratorUser } from "@/lib/types/collaboration";
import { getUserInitials } from "@/lib/types/collaboration";
import {
	useCollaboratorPresence,
	getActivityText,
	isUserActive,
} from "@/lib/collaboration/presence";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for CollaboratorAvatars component.
 */
export interface CollaboratorAvatarsProps {
	/** Maximum number of avatars to show before "+N more" */
	maxVisible?: number;
	/** Size of avatars */
	size?: "sm" | "md" | "lg";
	/** Whether to show connection indicator dot */
	showStatus?: boolean;
	/** Additional CSS class */
	className?: string;
}

/**
 * Collaborator avatars stack.
 * Shows active collaborators with overlapping avatars.
 */
export const CollaboratorAvatars = React.memo(function CollaboratorAvatars({
	maxVisible = 5,
	size = "md",
	showStatus = true,
	className,
}: CollaboratorAvatarsProps) {
	const { collaborators, count } = useCollaboratorPresence();

	if (count === 0) {
		return null;
	}

	const visible = collaborators.slice(0, maxVisible);
	const overflow = count - maxVisible;

	return (
		<TooltipProvider>
			<div className={cn("flex items-center -space-x-2", className)}>
				{visible.map((collaborator, index) => (
					<CollaboratorAvatar
						key={collaborator.clientId}
						collaborator={collaborator}
						size={size}
						showStatus={showStatus}
						style={{ zIndex: visible.length - index }}
					/>
				))}

				{overflow > 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<div
								className={cn(
									"flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium ring-2 ring-white dark:ring-gray-900",
									sizeClasses[size]
								)}
							>
								<span className="text-xs">+{overflow}</span>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>
								{overflow} more collaborator{overflow > 1 ? "s" : ""}
							</p>
						</TooltipContent>
					</Tooltip>
				)}
			</div>
		</TooltipProvider>
	);
});

CollaboratorAvatars.displayName = "CollaboratorAvatars";

/** Size classes for avatars */
const sizeClasses = {
	sm: "h-6 w-6 text-xs",
	md: "h-8 w-8 text-sm",
	lg: "h-10 w-10 text-base",
};

/** Status dot size classes */
const statusSizeClasses = {
	sm: "h-2 w-2",
	md: "h-2.5 w-2.5",
	lg: "h-3 w-3",
};

/**
 * Props for individual avatar.
 */
interface CollaboratorAvatarProps {
	collaborator: CollaboratorPresence;
	size?: "sm" | "md" | "lg";
	showStatus?: boolean;
	style?: React.CSSProperties;
}

/**
 * Individual collaborator avatar with tooltip.
 */
function CollaboratorAvatar({
	collaborator,
	size = "md",
	showStatus = true,
	style,
}: CollaboratorAvatarProps) {
	const { user, activity } = collaborator;
	const initials = getUserInitials(user.name);
	const isActive = isUserActive(activity);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="relative" style={style}>
					{user.avatarUrl ? (
						<img
							src={user.avatarUrl}
							alt={user.name}
							className={cn(
								"rounded-full ring-2 ring-white dark:ring-gray-900 object-cover",
								sizeClasses[size]
							)}
						/>
					) : (
						<div
							className={cn(
								"flex items-center justify-center rounded-full text-white font-medium ring-2 ring-white dark:ring-gray-900",
								sizeClasses[size]
							)}
							style={{ backgroundColor: user.color }}
						>
							{initials}
						</div>
					)}

					{showStatus && (
						<span
							className={cn(
								"absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-gray-900",
								statusSizeClasses[size],
								isActive
									? "bg-green-500"
									: activity === "idle"
										? "bg-yellow-500"
										: "bg-gray-400"
							)}
						/>
					)}
				</div>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="flex flex-col gap-0.5">
				<span className="font-medium">{user.name}</span>
				<span className="text-xs text-gray-500 dark:text-gray-400">
					{getActivityText(activity)}
				</span>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Detailed collaborator list for sidebar/panel.
 */
export function CollaboratorList({
	className,
}: {
	className?: string;
}) {
	const { collaborators, connectionStatus } = useCollaboratorPresence();

	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
				<span>Collaborators ({collaborators.length})</span>
				<ConnectionBadge status={connectionStatus} />
			</div>

			{collaborators.length === 0 ? (
				<p className="text-sm text-gray-500 dark:text-gray-400 py-2">
					No other collaborators
				</p>
			) : (
				<div className="space-y-1">
					{collaborators.map((collaborator) => (
						<CollaboratorListItem
							key={collaborator.clientId}
							collaborator={collaborator}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Collaborator list item.
 */
function CollaboratorListItem({
	collaborator,
}: {
	collaborator: CollaboratorPresence;
}) {
	const { user, activity } = collaborator;
	const initials = getUserInitials(user.name);
	const isActive = isUserActive(activity);

	return (
		<div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
			<div className="relative">
				{user.avatarUrl ? (
					<img
						src={user.avatarUrl}
						alt={user.name}
						className="h-8 w-8 rounded-full object-cover"
					/>
				) : (
					<div
						className="h-8 w-8 flex items-center justify-center rounded-full text-white text-sm font-medium"
						style={{ backgroundColor: user.color }}
					>
						{initials}
					</div>
				)}
				<span
					className={cn(
						"absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900",
						isActive
							? "bg-green-500"
							: activity === "idle"
								? "bg-yellow-500"
								: "bg-gray-400"
					)}
				/>
			</div>

			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-gray-900 dark:text-white truncate">
					{user.name}
				</p>
				<p className="text-xs text-gray-500 dark:text-gray-400">
					{getActivityText(activity)}
				</p>
			</div>

			{/* Color indicator */}
			<div
				className="h-3 w-3 rounded-full"
				style={{ backgroundColor: user.color }}
				title="Cursor color"
			/>
		</div>
	);
}

/**
 * Connection status badge.
 */
function ConnectionBadge({
	status,
}: {
	status: string;
}) {
	const statusConfig = {
		connected: { text: "Connected", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
		connecting: { text: "Connecting...", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
		reconnecting: { text: "Reconnecting...", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
		disconnected: { text: "Disconnected", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
		error: { text: "Error", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
	};

	const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.disconnected;

	return (
		<span
			className={cn(
				"px-2 py-0.5 rounded-full text-xs font-medium",
				config.className
			)}
		>
			{config.text}
		</span>
	);
}

/**
 * Simple presence indicator (e.g., for document cards).
 * Shows how many users are currently viewing a document.
 */
export function PresenceIndicator({
	count,
	maxShow = 3,
	users,
	className,
}: {
	count: number;
	maxShow?: number;
	users?: CollaboratorUser[];
	className?: string;
}) {
	if (count === 0) {
		return null;
	}

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400",
				className
			)}
		>
			{users && users.length > 0 ? (
				<div className="flex -space-x-1">
					{users.slice(0, maxShow).map((user) => (
						<div
							key={user.id}
							className="h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] text-white font-medium"
							style={{ backgroundColor: user.color }}
							title={user.name}
						>
							{getUserInitials(user.name)}
						</div>
					))}
				</div>
			) : (
				<div className="flex items-center">
					<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
				</div>
			)}
			<span>
				{count} {count === 1 ? "viewer" : "viewers"}
			</span>
		</div>
	);
}

/**
 * Hook to get the current user's avatar component.
 */
export function useCurrentUserAvatar() {
	const { collaborators } = useCollaboratorPresence();

	// This would typically come from auth context
	// For now, return null as placeholder
	return null;
}
