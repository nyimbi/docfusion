/**
 * New Activity Page
 *
 * Create a new CRM activity.
 * Updated for Next.js 15 async searchParams.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import NewActivityContent from "./new-activity-content";

export const metadata: Metadata = {
	title: "New Activity | CRM",
	description: "Create a new CRM activity",
};

interface NewActivityPageProps {
	searchParams: Promise<{
		accountId?: string;
		contactId?: string;
		dealId?: string;
		type?: string;
	}>;
}

export default async function NewActivityPage({ searchParams }: NewActivityPageProps) {
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
			<NewActivityContent {...params} userId={userContext.userId} />
		</Suspense>
	);
}
