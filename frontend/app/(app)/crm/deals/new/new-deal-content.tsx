"use client";

/**
 * New Deal Content
 *
 * Client component for creating a new deal.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DealForm } from "@/components/crm/deals";
import { createDeal } from "@/lib/actions/crm/deals";
import { getAccounts } from "@/lib/actions/crm/accounts";
import { ArrowLeft } from "lucide-react";
import type { AccountRow } from "@/lib/db/schema-crm";
import type { CreateDealInput, UpdateDealInput } from "@/lib/types/crm";

interface NewDealContentProps {
	accountId?: string;
	userId?: string;
}

export default function NewDealContent({ accountId, userId }: NewDealContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	// Fetch accounts for the select dropdown
	useEffect(() => {
		async function fetchAccounts() {
			try {
				const result = await getAccounts();
				setAccounts(result.data);
			} catch (err) {
				console.error("Failed to fetch accounts:", err);
			}
		}

		fetchAccounts();
	}, []);

	const handleSubmit = async (data: CreateDealInput | UpdateDealInput) => {
		setIsSubmitting(true);
		setError(null);
		try {
			const dealData = { ...data, accountId: data.accountId || accountId } as CreateDealInput;
			const created = await createDeal(dealData, userId);

			// Redirect based on whether we came from an account
			if (accountId) {
				router.push(`/crm/accounts/${accountId}`);
			} else {
				router.push(`/crm/deals/${created.id}`);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create deal");
			console.error("Failed to create deal:", err);
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
						<Link href={accountId ? `/crm/accounts/${accountId}` : "/crm/deals"}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold">New Deal</h1>
						<p className="text-muted-foreground">
							Create a new sales opportunity
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
				<DealForm
					accounts={accounts}
					defaultValues={accountId ? { accountId } : undefined}
					onSubmit={handleSubmit}
					onCancel={() => router.back()}
					isLoading={isSubmitting}
				/>
			</div>
		</div>
	);
}
