/**
 * Collaborative Cursor - DocFusion
 *
 * Displays other users' cursors and selection in real-time.
 * Part of the collaborative editing system.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CollaborationUser {
	id: string;
	name: string;
	color: string;
	cursor?: { x: number; y: number };
	selection?: { from: number; to: number };
}

interface CollaborativeCursorProps {
	user: CollaborationUser;
	containerRef?: React.RefObject<HTMLElement>;
}

// Predefined colors for cursors
const USER_COLORS = [
	{ name: "Blue", hex: "#3b82f6", bg: "bg-blue-500" },
	{ name: "Green", hex: "#10b981", bg: "bg-green-500" },
	{ name: "Yellow", hex: "#f59e0b", bg: "bg-amber-500" },
	{ name: "Purple", hex: "#8b5cf6", bg: "bg-violet-500" },
	{ name: "Pink", hex: "#ec4899", bg: "bg-pink-500" },
	{ name: "Red", hex: "#ef4444", bg: "bg-red-500" },
	{ name: "Teal", hex: "#14b8a6", bg: "bg-teal-500" },
	{ name: "Orange", hex: "#f97316", bg: "bg-orange-500" },
];

export function getUserColor(index: number) {
	return USER_COLORS[index % USER_COLORS.length];
}

export function CollaborativeCursor({ user }: CollaborativeCursorProps) {
	if (!user.cursor) return null;

	const color = getUserColor(parseInt(user.id.slice(-2), 16) || 1);

	return (
		<div
			className="fixed pointer-events-none z-50 transition-all duration-75 ease-out"
			style={{
				left: user.cursor.x,
				top: user.cursor.y,
			}}
		>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				className="drop-shadow-sm"
			>
				<path
					d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 00-.85.35z"
					fill="currentColor"
					className={color.bg}
				/>
			</svg>
			<div
				className={cn(
					"absolute left-5 top-4 px-2 py-0.5 rounded-full text-xs font-medium",
					"whitespace-nowrap text-white shadow-sm",
					color.bg
				)}
			>
				{user.name}
			</div>
		</div>
	);
}

interface CollaborationAvatarsProps {
	users: CollaborationUser[];
	maxVisible?: number;
}

export function CollaborationAvatars({
	users,
	maxVisible = 3,
}: CollaborationAvatarsProps) {
	const visibleUsers = users.slice(0, maxVisible);
	const remainingCount = Math.max(0, users.length - maxVisible);

	return (
		<div className="flex -space-x-2">
			{visibleUsers.map((user, i) => {
				const color = getUserColor(
					(parseInt(user.id.slice(-2), 16) || 1) + i
				);
				return (
					<div
						key={user.id}
						className={cn(
							"w-8 h-8 rounded-full border-2 border-background flex items-center justify-center",
							"text-white text-xs font-medium shadow-sm",
							color.bg
						)}
						title={user.name}
					>
						{user.name
							.split(" ")
							.map((n) => n[0])
							.join("")
							.toUpperCase()
							.slice(0, 2)}
					</div>
				);
			})}
			{remainingCount > 0 && (
				<div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
					+{remainingCount}
				</div>
			)}
		</div>
	);
}

export function CollaborationIndicator() {
	const [isConnected, setIsConnected] = React.useState(true);
	const [userCount, setUserCount] = React.useState(3);

	return (
		<div className="flex items-center gap-2">
			<div
				className={cn(
					"w-2 h-2 rounded-full animate-pulse",
					isConnected ? "bg-green-500" : "bg-amber-500 animate-pulse"
				)}
			/>
			<span className="text-sm text-muted-foreground">
				{isConnected ? `Live • ${userCount} users` : "Reconnecting..."}
			</span>
		</div>
	);
}
