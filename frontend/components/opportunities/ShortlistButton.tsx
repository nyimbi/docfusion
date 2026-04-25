"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { BookmarkPlus, BookmarkCheck, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkUpdateStatus } from "@/lib/actions/opportunities";
import { toast } from "sonner";

// ============================================================================
// Props
// ============================================================================

interface ShortlistButtonProps {
	opportunityId: string;
	isShortlisted: boolean;
	size?: "sm" | "md";
	variant?: "primary" | "outline" | "ghost";
	className?: string;
}

// ============================================================================
// ShortlistButton
// ============================================================================

export function ShortlistButton({
	opportunityId,
	isShortlisted,
	size = "sm",
	variant = "outline",
	className,
}: ShortlistButtonProps) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (shortlist: boolean) => {
			const status = shortlist ? "shortlisted" : "interested";
			await bulkUpdateStatus([opportunityId], status);
		},
		onSuccess: (_data, shortlist) => {
			queryClient.invalidateQueries({ queryKey: ["opportunities"] });
			queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
			toast.success(shortlist ? "Added to shortlist" : "Removed from shortlist");
		},
		onError: (err) => {
			toast.error("Failed to update shortlist status");
			console.error(err);
		},
	});

	return (
		<Button
			variant={isShortlisted ? "primary" : variant}
			size={size}
			onClick={() => mutation.mutate(!isShortlisted)}
			disabled={mutation.isPending}
			className={cn(
				"gap-1.5 transition-all duration-200",
				isShortlisted && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
				className
			)}
		>
			{mutation.isPending ? (
				<Loader2 className="w-4 h-4 animate-spin" />
			) : isShortlisted ? (
				<BookmarkCheck className="w-4 h-4" />
			) : (
				<BookmarkPlus className="w-4 h-4" />
			)}
			{isShortlisted ? "Shortlisted" : "Shortlist"}
		</Button>
	);
}
