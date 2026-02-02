/**
 * New Contact Page
 *
 * Create a new CRM contact.
 * Updated for Next.js 15 async searchParams.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import NewContactContent from "./new-contact-content";

export const metadata: Metadata = {
	title: "New Contact | CRM",
	description: "Create a new CRM contact",
};

interface NewContactPageProps {
	searchParams: Promise<{
		accountId?: string;
	}>;
}

export default async function NewContactPage({ searchParams }: NewContactPageProps) {
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
			<NewContactContent accountId={params.accountId} userContext={userContext} />
		</Suspense>
	);
}
