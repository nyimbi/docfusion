/**
 * Account Detail Page
 *
 * Displays detailed information for a single account.
 * Updated for Next.js 15 async params.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import AccountDetailContent from "./account-detail-content";

interface AccountDetailPageProps {
	params: Promise<{
		id: string;
	}>;
}

export async function generateMetadata({
	params,
}: AccountDetailPageProps): Promise<Metadata> {
	const { id } = await params;
	// Optional enhancement: fetch account name for dynamic SEO title
	// const account = await getAccount(id);
	// return { title: `${account?.name ?? 'Account'} | CRM`, ... };
	return {
		title: "Account Details",
		description: "View and manage account information",
	};
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
	const { id } = await params;

	if (!id) {
		notFound();
	}

	return (
		<Suspense fallback={<AccountDetailSkeleton />}>
			<AccountDetailContent accountId={id} />
		</Suspense>
	);
}

function AccountDetailSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<div className="h-10 w-10 bg-muted animate-pulse rounded" />
				<div className="space-y-2">
					<div className="h-6 w-48 bg-muted animate-pulse rounded" />
					<div className="h-4 w-32 bg-muted animate-pulse rounded" />
				</div>
			</div>
			<div className="h-12 bg-muted animate-pulse rounded" />
			<div className="grid grid-cols-3 gap-6">
				<div className="col-span-2 h-96 bg-muted animate-pulse rounded-lg" />
				<div className="h-96 bg-muted animate-pulse rounded-lg" />
			</div>
		</div>
	);
}
