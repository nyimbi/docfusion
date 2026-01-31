"use client";

/**
 * New Activity Content
 *
 * Client component for creating a new activity.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ActivityForm } from "@/components/crm/activities";
import { ArrowLeft } from "lucide-react";
import type { ActivityRow } from "@/lib/db/schema-crm";

interface NewActivityContentProps {
	accountId?: string;
	contactId?: string;
	dealId?: string;
	type?: string;
}

export default function NewActivityContent({
	accountId,
	contactId,
	dealId,
	type,
}: NewActivityContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (data: Partial<ActivityRow>) => {
		setIsSubmitting(true);
		try {
			// In production: const activity = await createActivity(data);
			console.log("Creating activity:", data);

			// Redirect based on context
			if (accountId) {
				router.push(`/crm/accounts/${accountId}`);
			} else if (contactId) {
				router.push(`/crm/contacts/${contactId}`);
			} else if (dealId) {
				router.push(`/crm/deals/${dealId}`);
			} else {
				router.push("/crm/activities");
			}
		} catch (error) {
			console.error("Failed to create activity:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Determine back link
	const backLink = accountId
		? `/crm/accounts/${accountId}`
		: contactId
		? `/crm/contacts/${contactId}`
		: dealId
		? `/crm/deals/${dealId}`
		: "/crm/activities";

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href={backLink}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold">New Activity</h1>
						<p className="text-muted-foreground">
							Log an interaction or create a task
						</p>
					</div>
				</div>

				{/* Form */}
				<ActivityForm
					defaultValues={{
						accountId: accountId ?? undefined,
						contactId: contactId ?? undefined,
						dealId: dealId ?? undefined,
						type: (type as ActivityRow["type"]) ?? "task",
					}}
					onSubmit={handleSubmit}
					onCancel={() => router.back()}
					isLoading={isSubmitting}
				/>
			</div>
		</div>
	);
}
