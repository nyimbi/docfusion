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
import { ArrowLeft } from "lucide-react";
import type { ContactRow } from "@/lib/db/schema-crm";

interface NewContactContentProps {
	accountId?: string;
}

export default function NewContactContent({ accountId }: NewContactContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (data: Partial<ContactRow>) => {
		setIsSubmitting(true);
		try {
			// In production: const contact = await createContact(data);
			console.log("Creating contact:", data);

			// Redirect based on whether we came from an account
			if (accountId) {
				router.push(`/crm/accounts/${accountId}`);
			} else {
				router.push("/crm/contacts");
			}
		} catch (error) {
			console.error("Failed to create contact:", error);
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
