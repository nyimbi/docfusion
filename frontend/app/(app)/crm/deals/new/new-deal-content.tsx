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
import { ArrowLeft } from "lucide-react";
import type { DealRow, AccountRow } from "@/lib/db/schema-crm";

interface NewDealContentProps {
	accountId?: string;
}

export default function NewDealContent({ accountId }: NewDealContentProps) {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);

	// Fetch accounts for the select dropdown
	useEffect(() => {
		async function fetchAccounts() {
			try {
				// In production: const data = await getAccounts();
				setAccounts([]);
			} catch (error) {
				console.error("Failed to fetch accounts:", error);
			}
		}

		fetchAccounts();
	}, []);

	const handleSubmit = async (data: Partial<DealRow>) => {
		setIsSubmitting(true);
		try {
			// In production: const deal = await createDeal(data);
			console.log("Creating deal:", data);

			// Redirect based on whether we came from an account
			if (accountId) {
				router.push(`/crm/accounts/${accountId}`);
			} else {
				router.push("/crm/deals");
			}
		} catch (error) {
			console.error("Failed to create deal:", error);
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
