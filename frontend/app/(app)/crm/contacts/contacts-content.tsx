"use client";

/**
 * Contacts Content
 *
 * Client component for contacts list with search and filtering.
 * Features the shared CRM navigation bar at the top.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ContactList, ContactCard } from "@/components/crm/contacts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import {
	Plus,
	Search,
	LayoutList,
	LayoutGrid,
	Download,
	Upload,
} from "lucide-react";
import type { ContactRow, AccountRow } from "@/lib/db/schema-crm";

interface ContactsContentProps {
	searchParams: {
		account?: string;
		view?: string;
		search?: string;
		page?: string;
	};
}

export default function ContactsContent({ searchParams }: ContactsContentProps) {
	const router = useRouter();
	const [contacts, setContacts] = useState<ContactRow[]>([]);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState(searchParams.search ?? "");
	const [accountFilter, setAccountFilter] = useState(searchParams.account ?? "all");
	const [viewMode, setViewMode] = useState<"list" | "grid">(
		(searchParams.view as "list" | "grid") ?? "list"
	);

	// Fetch contacts
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				// In production:
				// const contactsData = await getContacts({ accountId: accountFilter !== "all" ? accountFilter : undefined });
				// const accountsData = await getAccounts();
				setContacts([]);
				setAccounts([]);
			} catch (error) {
				console.error("Failed to fetch contacts:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [accountFilter]);

	// Filter contacts locally
	const filteredContacts = useMemo(() => {
		let result = [...contacts];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(c) =>
					c.firstName.toLowerCase().includes(query) ||
					c.lastName.toLowerCase().includes(query) ||
					c.email?.toLowerCase().includes(query) ||
					c.title?.toLowerCase().includes(query)
			);
		}

		if (accountFilter !== "all") {
			result = result.filter((c) => c.accountId === accountFilter);
		}

		return result;
	}, [contacts, searchQuery, accountFilter]);

	// Update URL when filters change
	const updateFilters = (updates: Record<string, string>) => {
		const params = new URLSearchParams();
		const current = {
			account: accountFilter,
			view: viewMode,
			search: searchQuery,
			...updates,
		};

		Object.entries(current).forEach(([key, value]) => {
			if (value && value !== "all" && value !== "list" && value !== "") {
				params.set(key, value);
			}
		});

		const query = params.toString();
		router.push(`/crm/contacts${query ? `?${query}` : ""}`);
	};

	const handleContactClick = (contact: ContactRow) => {
		router.push(`/crm/contacts/${contact.id}`);
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="Contacts"
				description="Manage people and relationships across your accounts"
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm">
							<Upload className="h-4 w-4 mr-2" />
							Import
						</Button>
						<Button variant="outline" size="sm">
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
						<Button asChild>
							<Link href="/crm/contacts/new">
								<Plus className="h-4 w-4 mr-2" />
								New Contact
							</Link>
						</Button>
					</div>
				}
			/>

			<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
				{/* Filters Bar */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search contacts..."
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							updateFilters({ search: e.target.value });
						}}
						className="pl-9"
					/>
				</div>

				<Select
					value={accountFilter}
					onValueChange={(value) => {
						setAccountFilter(value);
						updateFilters({ account: value });
					}}
				>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder="Filter by account" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Accounts</SelectItem>
						{accounts.map((account) => (
							<SelectItem key={account.id} value={account.id}>
								{account.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* View Mode Toggle */}
				<div className="flex items-center border rounded-md">
					<Button
						variant={viewMode === "list" ? "secondary" : "ghost"}
						size="sm"
						className="rounded-r-none"
						onClick={() => {
							setViewMode("list");
							updateFilters({ view: "list" });
						}}
					>
						<LayoutList className="h-4 w-4" />
					</Button>
					<Button
						variant={viewMode === "grid" ? "secondary" : "ghost"}
						size="sm"
						className="rounded-l-none"
						onClick={() => {
							setViewMode("grid");
							updateFilters({ view: "grid" });
						}}
					>
						<LayoutGrid className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Results Count */}
			<div className="text-sm text-muted-foreground">
				{filteredContacts.length} contacts
				{accountFilter !== "all" && " in selected account"}
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
					))}
				</div>
			) : filteredContacts.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<p className="text-lg">No contacts found</p>
					<p className="text-sm">
						{searchQuery
							? "Try adjusting your search"
							: "Create your first contact to get started"}
					</p>
					<Button asChild className="mt-4">
						<Link href="/crm/contacts/new">
							<Plus className="h-4 w-4 mr-2" />
							Create Contact
						</Link>
					</Button>
				</div>
				) : viewMode === "list" ? (
				<ContactList
					contacts={filteredContacts}
					onContactClick={handleContactClick}
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredContacts.map((contact) => (
						<ContactCard
							key={contact.id}
							contact={contact}
							onClick={() => handleContactClick(contact)}
						/>
					))}
				</div>
			)}
			</div>
		</div>
	);
}
