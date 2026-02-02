/**
 * New Deal Page
 *
 * Create a new CRM deal.
 * Updated for Next.js 15 async searchParams.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import NewDealContent from "./new-deal-content";

export const metadata: Metadata = {
	title: "New Deal | CRM",
	description: "Create a new sales deal",
};

interface NewDealPageProps {
	searchParams: Promise<{
		accountId?: string;
	}>;
}

export default async function NewDealPage({ searchParams }: NewDealPageProps) {
	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		redirect("/auth/sign-in");
	}

	const params = await searchParams;

	return (
		<Suspense
			fallback={
				<div className="h-full flex items-center justify-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</div>
			}
		>
			<NewDealContent accountId={params.accountId} userId={userContext.userId} />
		</Suspense>
	);
}
