/**
 * Deals Pipeline Page
 *
 * Sales pipeline view with Kanban board and deal management.
 * Updated for Next.js 15 async searchParams.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import DealsContent from "./deals-content";

export const metadata: Metadata = {
	title: "Deals",
	description: "Manage your sales pipeline and deals",
};

interface DealsPageProps {
	searchParams: Promise<{
		account?: string;
		stage?: string;
		view?: string;
		search?: string;
		page?: string;
	}>;
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
	const params = await searchParams;

	return (
		<Suspense fallback={<DealsListSkeleton />}>
			<DealsContent searchParams={params} />
		</Suspense>
	);
}

function DealsListSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="h-8 w-32 bg-muted animate-pulse rounded" />
				<div className="h-10 w-32 bg-muted animate-pulse rounded" />
			</div>
			<div className="grid grid-cols-5 gap-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="space-y-3">
						<div className="h-8 bg-muted animate-pulse rounded" />
						<div className="h-32 bg-muted animate-pulse rounded-lg" />
						<div className="h-32 bg-muted animate-pulse rounded-lg" />
					</div>
				))}
			</div>
		</div>
	);
}
