"use client";

import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export function EmptyState({
	icon: Icon = Inbox,
	title,
	description,
	actionLabel,
	onAction,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<div className="rounded-full bg-muted p-4 mb-4">
				<Icon className="h-8 w-8 text-muted-foreground" />
			</div>
			<h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
			{description && (
				<p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
			)}
			{actionLabel && onAction && (
				<Button onClick={onAction} variant="outline" size="sm">
					{actionLabel}
				</Button>
			)}
		</div>
	);
}
