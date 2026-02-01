/**
 * Contacts List Page
 *
 * Lists all CRM contacts with filtering and management.
 * Updated for Next.js 15 async searchParams.
 * Includes relationship filtering (All / Company / People).
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import ContactsContent from "./contacts-content";
import { requireUserContext } from "@/lib/auth-utils";

export const metadata: Metadata = {
	title: "Contacts",
	description: "Manage your CRM contacts - people and relationships",
};

interface ContactsPageProps {
	searchParams: Promise<{
		account?: string;
		view?: string;
		search?: string;
		page?: string;
		relationship?: string;
	}>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
	const params = await searchParams;

	// Get authenticated user context
	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		redirect("/auth/sign-in");
	}

	return (
		<Suspense fallback={<ContactsListSkeleton />}>
			<ContactsContent searchParams={params} userContext={userContext} />
		</Suspense>
	);
}

function ContactsListSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="h-8 w-32 bg-muted animate-pulse rounded" />
				<div className="h-10 w-36 bg-muted animate-pulse rounded" />
			</div>
			<div className="h-10 w-64 bg-muted animate-pulse rounded" />
			<div className="space-y-3">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
				))}
			</div>
		</div>
	);
}
