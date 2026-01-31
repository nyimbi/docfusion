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
import { ArrowLeft } from "lucide-react";
import type { AccountRow } from "@/lib/db/schema-crm";

export default function NewAccountContent() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (data: Partial<AccountRow>) => {
		setIsSubmitting(true);
		try {
			// In production: const account = await createAccount(data);
			console.log("Creating account:", data);
			// Redirect to the new account
			router.push("/crm/accounts");
		} catch (error) {
			console.error("Failed to create account:", error);
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
