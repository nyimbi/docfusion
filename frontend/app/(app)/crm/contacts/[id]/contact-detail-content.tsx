"use client";

/**
 * Contact Detail Content
 *
 * Client component displaying full contact details.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContactDetail } from "@/components/crm/contacts";
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
import type { ContactRow, AccountRow, ActivityRow } from "@/lib/db/schema-crm";

interface ContactDetailContentProps {
	contactId: string;
}

export default function ContactDetailContent({ contactId }: ContactDetailContentProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [contact, setContact] = useState<ContactRow | null>(null);
	const [account, setAccount] = useState<AccountRow | null>(null);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	// Fetch contact data
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				// In production:
				// const contactData = await getContact(contactId);
				// if (contactData.accountId) {
				//   const accountData = await getAccount(contactData.accountId);
				//   setAccount(accountData);
				// }
				// const activitiesData = await getContactTimeline(contactId);

				setContact(null);
				setAccount(null);
				setActivities([]);
			} catch (error) {
				console.error("Failed to fetch contact:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [contactId]);

	const handleEdit = () => {
		router.push(`/crm/contacts/${contactId}/edit`);
	};

	const handleDelete = async () => {
		try {
			// In production: await deleteContact(contactId);
			router.push("/crm/contacts");
		} catch (error) {
			console.error("Failed to delete contact:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="h-full overflow-y-auto p-6 space-y-6">
				<div className="flex items-center gap-4">
					<div className="h-10 w-10 bg-muted animate-pulse rounded" />
					<div className="space-y-2">
						<div className="h-6 w-48 bg-muted animate-pulse rounded" />
						<div className="h-4 w-32 bg-muted animate-pulse rounded" />
					</div>
				</div>
				<div className="grid grid-cols-3 gap-6">
					<div className="col-span-2 h-96 bg-muted animate-pulse rounded-lg" />
					<div className="h-96 bg-muted animate-pulse rounded-lg" />
				</div>
			</div>
		);
	}

	if (!contact) {
		return (
			<div className="h-full flex flex-col items-center justify-center">
				<h2 className="text-xl font-semibold">Contact not found</h2>
				<p className="text-muted-foreground mt-2">
					The contact you're looking for doesn't exist or has been deleted.
				</p>
				<Button asChild className="mt-4">
					<Link href="/crm/contacts">Back to Contacts</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href="/crm/contacts">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold">
							{contact.firstName} {contact.lastName}
						</h1>
						<p className="text-muted-foreground">
							{contact.title ?? "No title"}
							{account && ` at ${account.name}`}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={handleEdit}>
						<Pencil className="h-4 w-4 mr-2" />
						Edit
					</Button>
					<Button
						variant="outline"
						className="text-red-600 hover:text-red-700"
						onClick={() => setShowDeleteDialog(true)}
					>
						<Trash2 className="h-4 w-4 mr-2" />
						Delete
					</Button>
				</div>
			</div>

			{/* Contact Detail Component */}
			<ContactDetail
				contact={contact}
				account={account ?? undefined}
				activities={activities}
				onAccountClick={() => account && router.push(`/crm/accounts/${account.id}`)}
				onActivityClick={(activity) => router.push(`/crm/activities/${activity.id}`)}
			/>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Contact</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{contact.firstName} {contact.lastName}"?
							This action cannot be undone.
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
