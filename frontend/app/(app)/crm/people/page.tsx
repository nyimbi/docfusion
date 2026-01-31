/**
 * People Page
 *
 * Standalone contacts (not linked to accounts).
 * Focused on import and personal network management.
 * Only shows contacts owned by or shared with the current user.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import PeopleContent from "./people-content";

export const metadata: Metadata = {
	title: "People | CRM",
	description: "Manage your personal network and standalone contacts",
};

interface PeoplePageProps {
	searchParams: Promise<{
		search?: string;
		view?: string;
		page?: string;
	}>;
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
	const params = await searchParams;

	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		redirect("/auth/sign-in");
	}

	return (
		<Suspense
			fallback={
				<div className="h-full flex items-center justify-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</div>
			}
		>
			<PeopleContent searchParams={params} userContext={userContext} />
		</Suspense>
	);
}
