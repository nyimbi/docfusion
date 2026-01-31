/**
 * New Contact Page
 *
 * Create a new CRM contact.
 * Updated for Next.js 15 async searchParams.
 */

import { Metadata } from "next";
import NewContactContent from "./new-contact-content";

export const metadata: Metadata = {
	title: "New Contact",
	description: "Create a new CRM contact",
};

interface NewContactPageProps {
	searchParams: Promise<{
		accountId?: string;
	}>;
}

export default async function NewContactPage({ searchParams }: NewContactPageProps) {
	const params = await searchParams;
	return <NewContactContent accountId={params.accountId} />;
}
