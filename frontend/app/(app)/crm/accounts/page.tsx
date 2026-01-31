/**
 * Accounts List Page
 *
 * Lists all CRM accounts with filtering, sorting, and view modes.
 * Updated for Next.js 15 async searchParams.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import AccountsContent from "./accounts-content";

export const metadata: Metadata = {
	title: "Accounts",
	description: "Manage your CRM accounts - partners, prospects, leads, customers, and vendors",
};

interface AccountsPageProps {
	searchParams: Promise<{
		type?: string;
		stage?: string;
		view?: string;
		search?: string;
		page?: string;
	}>;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
	const params = await searchParams;

	return (
		<Suspense fallback={<AccountsListSkeleton />}>
			<AccountsContent searchParams={params} />
		</Suspense>
	);
}

function AccountsListSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="h-8 w-32 bg-muted animate-pulse rounded" />
				<div className="h-10 w-36 bg-muted animate-pulse rounded" />
			</div>
			<div className="flex items-center gap-4">
				<div className="h-10 w-64 bg-muted animate-pulse rounded" />
				<div className="h-10 w-40 bg-muted animate-pulse rounded" />
			</div>
			<div className="space-y-3">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
				))}
			</div>
		</div>
	);
}
