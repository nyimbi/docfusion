/**
 * Activity Detail Page
 *
 * Displays detailed information for a single activity.
 * Updated for Next.js 15 async params.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import ActivityDetailContent from "./activity-detail-content";

interface ActivityDetailPageProps {
	params: Promise<{
		id: string;
	}>;
}

export async function generateMetadata({
	params,
}: ActivityDetailPageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: "Activity Details",
		description: "View and manage activity information",
	};
}

export default async function ActivityDetailPage({ params }: ActivityDetailPageProps) {
	const { id } = await params;

	if (!id) {
		notFound();
	}

	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		redirect("/auth/sign-in");
	}

	return (
		<Suspense fallback={<ActivityDetailSkeleton />}>
			<ActivityDetailContent activityId={id} userId={userContext.userId} />
		</Suspense>
	);
}

function ActivityDetailSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<div className="h-10 w-10 bg-muted animate-pulse rounded" />
				<div className="space-y-2">
					<div className="h-6 w-48 bg-muted animate-pulse rounded" />
					<div className="h-4 w-32 bg-muted animate-pulse rounded" />
				</div>
			</div>
			<div className="h-48 bg-muted animate-pulse rounded-lg" />
		</div>
	);
}
