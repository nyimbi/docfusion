/**
 * Activities Page
 *
 * Activity timeline and task management.
 * Updated for Next.js 15 async searchParams.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import ActivitiesContent from "./activities-content";

export const metadata: Metadata = {
	title: "Activities",
	description: "View and manage CRM activities and tasks",
};

interface ActivitiesPageProps {
	searchParams: Promise<{
		type?: string;
		status?: string;
		account?: string;
		view?: string;
		search?: string;
	}>;
}

export default async function ActivitiesPage({ searchParams }: ActivitiesPageProps) {
	const params = await searchParams;

	return (
		<Suspense fallback={<ActivitiesListSkeleton />}>
			<ActivitiesContent searchParams={params} />
		</Suspense>
	);
}

function ActivitiesListSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="h-8 w-32 bg-muted animate-pulse rounded" />
				<div className="h-10 w-36 bg-muted animate-pulse rounded" />
			</div>
			<div className="grid grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
				))}
			</div>
			<div className="space-y-3">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
				))}
			</div>
		</div>
	);
}
