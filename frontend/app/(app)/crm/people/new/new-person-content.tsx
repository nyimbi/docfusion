"use client";

/**
 * New Person Content
 *
 * Form for creating a standalone contact (Person).
 * No account association required.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContactForm } from "@/components/crm/contacts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import { createContact, type UserContext } from "@/lib/actions/crm/contacts";
import { ChevronLeft, UserCircle } from "lucide-react";
import type { CreateContactInput, UpdateContactInput } from "@/lib/types/crm";

interface NewPersonContentProps {
	userContext: UserContext;
}

export default function NewPersonContent({ userContext }: NewPersonContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (data: CreateContactInput | UpdateContactInput) => {
		setIsSubmitting(true);
		setError(null);

		try {
			// Ensure no accountId is set for People, owned by current user
			const personData = { ...data, accountId: undefined } as CreateContactInput;
			const created = await createContact(personData, userContext, "private");
			router.push(`/crm/people/${created.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create person");
			setIsSubmitting(false);
		}
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<CRMNavigation
				title="New Person"
				description="Create a standalone contact not linked to any company"
				actions={
					<Button variant="outline" asChild>
						<Link href="/crm/people">
							<ChevronLeft className="h-4 w-4 mr-2" />
							Back to People
						</Link>
					</Button>
				}
			/>

			<div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
				<div className="max-w-3xl mx-auto">
					{/* Info Notice */}
					<div className="mb-6 p-4 bg-teal-50 dark:bg-teal-950/20 rounded-lg border border-teal-200 dark:border-teal-800">
						<div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
							<UserCircle className="h-5 w-5" />
							<span className="text-sm font-medium">
								Creating a Person (standalone contact)
							</span>
						</div>
						<p className="text-xs text-teal-600 dark:text-teal-400 mt-1 ml-7">
							This contact won't be linked to any company. You can link them to an account later.
						</p>
					</div>

					{error && (
						<div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">
							{error}
						</div>
					)}

					<ContactForm
						onSubmit={handleSubmit}
						onCancel={() => router.push("/crm/people")}
						isLoading={isSubmitting}
					/>
				</div>
			</div>
		</div>
	);
}
