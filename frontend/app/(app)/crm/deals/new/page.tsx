/**
 * New Deal Page
 *
 * Create a new CRM deal.
 * Updated for Next.js 15 async searchParams.
 */

import { Metadata } from "next";
import NewDealContent from "./new-deal-content";

export const metadata: Metadata = {
	title: "New Deal",
	description: "Create a new sales deal",
};

interface NewDealPageProps {
	searchParams: Promise<{
		accountId?: string;
	}>;
}

export default async function NewDealPage({ searchParams }: NewDealPageProps) {
	const params = await searchParams;
	return <NewDealContent accountId={params.accountId} />;
}
