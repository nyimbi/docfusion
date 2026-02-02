"use client";

/**
 * New Contact Content
 *
 * Client component for creating a new contact.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContactForm } from "@/components/crm/contacts";
import { createContact, type UserContext } from "@/lib/actions/crm/contacts";
import { ArrowLeft } from "lucide-react";
import type { CreateContactInput, UpdateContactInput } from "@/lib/types/crm";

interface NewContactContentProps {
	accountId?: string;
	userContext: UserContext;
}

export default function NewContactContent({ accountId, userContext }: NewContactContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (data: CreateContactInput | UpdateContactInput) => {
		setIsSubmitting(true);
		setError(null);
		try {
			// Create contact with account association if provided
			const contactData = { ...data, accountId } as CreateContactInput;
			const created = await createContact(contactData, userContext, "private");

			// Redirect based on whether we came from an account
			if (accountId) {
				router.push(`/crm/accounts/${accountId}`);
			} else {
				router.push(`/crm/contacts/${created.id}`);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create contact");
			console.error("Failed to create contact:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href={accountId ? `/crm/accounts/${accountId}` : "/crm/contacts"}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold">New Contact</h1>
						<p className="text-muted-foreground">
							Add a new person to your CRM
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
				<ContactForm
					defaultValues={accountId ? { accountId } : undefined}
					onSubmit={handleSubmit}
					onCancel={() => router.back()}
					isLoading={isSubmitting}
				/>
			</div>
		</div>
	);
}
