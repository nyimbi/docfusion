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
import { createActivity } from "@/lib/actions/crm/activities";
import { ArrowLeft } from "lucide-react";
import type { ActivityRow } from "@/lib/db/schema-crm";
import type { CreateActivityInput, UpdateActivityInput } from "@/lib/types/crm";

interface NewActivityContentProps {
	accountId?: string;
	contactId?: string;
	dealId?: string;
	type?: string;
	userId?: string;
}

export default function NewActivityContent({
	accountId,
	contactId,
	dealId,
	type,
	userId,
}: NewActivityContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (data: CreateActivityInput | UpdateActivityInput) => {
		setIsSubmitting(true);
		setError(null);
		try {
			const activityData = {
				...data,
				accountId: data.accountId || accountId,
				contactId: data.contactId || contactId,
				dealId: data.dealId || dealId,
			} as CreateActivityInput;
			const created = await createActivity(activityData, userId);

			// Redirect based on context
			if (accountId) {
				router.push(`/crm/accounts/${accountId}`);
			} else if (contactId) {
				router.push(`/crm/contacts/${contactId}`);
			} else if (dealId) {
				router.push(`/crm/deals/${dealId}`);
			} else {
				router.push(`/crm/activities/${created.id}`);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create activity");
			console.error("Failed to create activity:", err);
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

				{/* Error Display */}
				{error && (
					<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
						{error}
					</div>
				)}

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
