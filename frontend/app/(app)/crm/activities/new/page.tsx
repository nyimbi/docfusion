/**
 * New Activity Page
 *
 * Create a new CRM activity.
 * Updated for Next.js 15 async searchParams.
 */

import { Metadata } from "next";
import NewActivityContent from "./new-activity-content";

export const metadata: Metadata = {
	title: "New Activity",
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
	const params = await searchParams;
	return <NewActivityContent {...params} />;
}
