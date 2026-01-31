/**
 * Person Detail Page
 *
 * View and manage a standalone contact.
 * Only shows contacts owned by or shared with the current user.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import { getContactWithRelations } from "@/lib/actions/crm/contacts";
import PersonDetailContent from "./person-detail-content";

interface PersonPageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
	const { id } = await params;

	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		return { title: "Person | CRM" };
	}

	const contact = await getContactWithRelations(id, userContext);

	if (!contact) {
		return { title: "Person Not Found | CRM" };
	}

	return {
		title: `${contact.firstName} ${contact.lastName} | People | CRM`,
		description: `View details for ${contact.firstName} ${contact.lastName}`,
	};
}

export default async function PersonPage({ params }: PersonPageProps) {
	const { id } = await params;

	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		redirect("/auth/sign-in");
	}

	const contact = await getContactWithRelations(id, userContext);

	if (!contact) {
		notFound();
	}

	return (
		<Suspense
			fallback={
				<div className="h-full flex items-center justify-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</div>
			}
		>
			<PersonDetailContent contact={contact} userContext={userContext} />
		</Suspense>
	);
}
