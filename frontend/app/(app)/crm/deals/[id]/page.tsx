/**
 * Deal Detail Page
 *
 * Displays detailed information for a single deal.
 * Updated for Next.js 15 async params.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import DealDetailContent from "./deal-detail-content";

interface DealDetailPageProps {
	params: Promise<{
		id: string;
	}>;
}

export async function generateMetadata({
	params,
}: DealDetailPageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: "Deal Details",
		description: "View and manage deal information",
	};
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
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
		<Suspense fallback={<DealDetailSkeleton />}>
			<DealDetailContent dealId={id} userId={userContext.userId} />
		</Suspense>
	);
}

function DealDetailSkeleton() {
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
