"use client";

/**
 * Account Detail Content
 *
 * Client component displaying full account details with tabs.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AccountDetail } from "@/components/crm/accounts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	getAccountWithRelations,
	updateAccountStage,
	deleteAccount,
} from "@/lib/actions/crm/accounts";
import type { AccountRow, ContactRow, ActivityRow, DealRow } from "@/lib/db/schema-crm";

interface AccountDetailContentProps {
	accountId: string;
}

export default function AccountDetailContent({ accountId }: AccountDetailContentProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [account, setAccount] = useState<AccountRow | null>(null);
	const [contacts, setContacts] = useState<ContactRow[]>([]);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [deals, setDeals] = useState<DealRow[]>([]);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	// Fetch account data with relations
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				const accountData = await getAccountWithRelations(accountId);

				if (accountData) {
					setAccount(accountData);
					setContacts(accountData.contacts ?? []);
					setActivities(accountData.recentActivities ?? []);
					setDeals(accountData.deals ?? []);
				} else {
					setAccount(null);
					setContacts([]);
					setActivities([]);
					setDeals([]);
				}
			} catch (error) {
				console.error("Failed to fetch account:", error);
				setAccount(null);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [accountId]);

	const handleEdit = () => {
		router.push(`/crm/accounts/${accountId}/edit`);
	};

	const handleDelete = async () => {
		try {
			await deleteAccount(accountId);
			router.push("/crm/accounts");
		} catch (error) {
			console.error("Failed to delete account:", error);
		}
	};

	const handleStageChange = async (newStage: string) => {
		try {
			const updated = await updateAccountStage(accountId, newStage);
			if (updated) {
				setAccount(updated);
			}
		} catch (error) {
			console.error("Failed to update stage:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="h-full flex flex-col overflow-hidden">
				<CRMNavigation compact />
				<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
					<div className="flex items-center gap-4">
						<div className="h-10 w-10 bg-muted animate-pulse rounded" />
						<div className="space-y-2">
							<div className="h-6 w-48 bg-muted animate-pulse rounded" />
							<div className="h-4 w-32 bg-muted animate-pulse rounded" />
						</div>
					</div>
					<div className="h-12 bg-muted animate-pulse rounded" />
					<div className="grid grid-cols-3 gap-6">
						<div className="col-span-2 h-96 bg-muted animate-pulse rounded-lg" />
						<div className="h-96 bg-muted animate-pulse rounded-lg" />
					</div>
				</div>
			</div>
		);
	}

	if (!account) {
		return (
			<div className="h-full flex flex-col overflow-hidden">
				<CRMNavigation compact />
				<div className="flex-1 flex flex-col items-center justify-center">
					<h2 className="text-xl font-semibold">Account not found</h2>
					<p className="text-muted-foreground mt-2">
						The account you're looking for doesn't exist or has been deleted.
					</p>
					<Button asChild className="mt-4">
						<Link href="/crm/accounts">Back to Accounts</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title={account.name}
				description={`${account.type} · ${account.industry ?? "No industry"}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" asChild>
							<Link href="/crm/accounts">
								<ArrowLeft className="h-4 w-4" />
							</Link>
						</Button>
						<Button variant="outline" size="sm" onClick={handleEdit}>
							<Pencil className="h-4 w-4 mr-2" />
							Edit
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="text-red-600 hover:text-red-700"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</div>
				}
				showQuickActions={false}
			/>

			<div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

				{/* Account Detail Component */}
				<AccountDetail
					account={account}
					contacts={contacts}
					activities={activities}
					deals={deals}
					onStageChange={handleStageChange}
					onContactClick={(contact) => router.push(`/crm/contacts/${contact.id}`)}
					onActivityClick={(activity) => router.push(`/crm/activities/${activity.id}`)}
					onDealClick={(deal) => router.push(`/crm/deals/${deal.id}`)}
				/>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Account</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{account.name}"? This action cannot be undone.
							All related contacts, activities, and deals will also be affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
