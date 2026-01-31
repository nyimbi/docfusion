/**
 * Contact Detail Page
 *
 * Displays detailed information for a single contact.
 * Updated for Next.js 15 async params.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ContactDetailContent from "./contact-detail-content";

interface ContactDetailPageProps {
	params: Promise<{
		id: string;
	}>;
}

export async function generateMetadata({
	params,
}: ContactDetailPageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: "Contact Details",
		description: "View and manage contact information",
	};
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
	const { id } = await params;

	if (!id) {
		notFound();
	}

	return (
		<Suspense fallback={<ContactDetailSkeleton />}>
			<ContactDetailContent contactId={id} />
		</Suspense>
	);
}

function ContactDetailSkeleton() {
	return (
		<div className="h-full overflow-y-auto p-6 space-y-6">
			<div className="flex items-center gap-4">
				<div className="h-10 w-10 bg-muted animate-pulse rounded" />
				<div className="space-y-2">
					<div className="h-6 w-48 bg-muted animate-pulse rounded" />
					<div className="h-4 w-32 bg-muted animate-pulse rounded" />
				</div>
			</div>
			<div className="grid grid-cols-3 gap-6">
				<div className="col-span-2 h-96 bg-muted animate-pulse rounded-lg" />
				<div className="h-96 bg-muted animate-pulse rounded-lg" />
			</div>
		</div>
	);
}
