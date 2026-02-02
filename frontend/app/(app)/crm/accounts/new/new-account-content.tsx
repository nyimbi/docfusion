"use client";

/**
 * New Account Content
 *
 * Client component for creating a new account.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AccountForm } from "@/components/crm/accounts";
import { createAccount } from "@/lib/actions/crm/accounts";
import { ArrowLeft } from "lucide-react";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/types/crm";

interface NewAccountContentProps {
	userId?: string;
}

export default function NewAccountContent({ userId }: NewAccountContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (data: CreateAccountInput | UpdateAccountInput) => {
		setIsSubmitting(true);
		setError(null);
		try {
			const accountData = data as CreateAccountInput;
			const created = await createAccount(accountData, userId);
			// Redirect to the new account
			router.push(`/crm/accounts/${created.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create account");
			console.error("Failed to create account:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href="/crm/accounts">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold">New Account</h1>
						<p className="text-muted-foreground">
							Create a new partner, prospect, customer, or vendor
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
				<AccountForm
					onSubmit={handleSubmit}
					onCancel={() => router.back()}
					isLoading={isSubmitting}
				/>
			</div>
		</div>
	);
}
