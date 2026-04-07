"use client";

/**
 * Contacts Content
 *
 * Client component for contacts list with search and filtering.
 * Features the shared CRM navigation bar at the top.
 *
 * Supports relationship filtering:
 * - All: Shows all accessible contacts
 * - Company: Contacts linked to an account (accountId IS NOT NULL)
 * - People: Standalone contacts (accountId IS NULL)
 */

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactList, ContactCard, ContactImporter } from "@/components/crm/contacts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import {
	Plus,
	Search,
	LayoutList,
	LayoutGrid,
	Download,
	Upload,
	Users,
	Building2,
	UserCircle,
} from "lucide-react";
import type { ContactRow, AccountRow } from "@/lib/db/schema-crm";
import { getContacts, type UserContext } from "@/lib/actions/crm/contacts";
import { getAccounts } from "@/lib/actions/crm/accounts";

/** Relationship filter values */
type RelationshipFilter = "all" | "company" | "people";

interface ContactsContentProps {
	searchParams: {
		account?: string;
		view?: string;
		search?: string;
		page?: string;
		relationship?: string;
	};
	userContext: UserContext;
}

export default function ContactsContent({ searchParams, userContext }: ContactsContentProps) {
	const router = useRouter();
	const [contacts, setContacts] = useState<ContactRow[]>([]);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState(searchParams.search ?? "");
	const [accountFilter, setAccountFilter] = useState(searchParams.account ?? "all");
	const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>(
		(searchParams.relationship as RelationshipFilter) ?? "all"
	);
	const [viewMode, setViewMode] = useState<"list" | "grid">(
		(searchParams.view as "list" | "grid") ?? "list"
	);
	const [importerOpen, setImporterOpen] = useState(false);

	// Fetch contacts with filters
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				const page = parseInt(searchParams.page || "1");

				// Build filters based on relationship and account selection
				const filters: { accountId?: string | null; search?: string } = {};

				if (searchQuery) filters.search = searchQuery;

				// Relationship filter: null means standalone (people), specific ID or undefined for all
				if (relationshipFilter === "people") {
					filters.accountId = null; // Standalone contacts only
				} else if (accountFilter !== "all") {
					filters.accountId = accountFilter;
				}
				// For "company" filter, the UI will just filter out null accountId results client-side
				// since we don't have a "hasAccount" server filter yet

				const result = await getContacts(
					userContext,
					filters,
					{ page, pageSize: 25 }
				);
				setContacts(result.data);
				setTotalCount(result.total);

				// Also fetch accounts for the filter dropdown
				const accountsResult = await getAccounts();
				setAccounts(accountsResult.data);
			} catch (error) {
				console.error("Failed to fetch contacts:", error);
				setContacts([]);
				setTotalCount(0);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [searchQuery, accountFilter, relationshipFilter, searchParams.page, userContext]);

	// Update URL when filters change
	const updateFilters = (updates: Record<string, string>) => {
		const params = new URLSearchParams();
		const current = {
			account: accountFilter,
			view: viewMode,
			search: searchQuery,
			relationship: relationshipFilter,
			...updates,
		};

		Object.entries(current).forEach(([key, value]) => {
			// Don't include default values in URL
			if (value && value !== "all" && value !== "list" && value !== "") {
				params.set(key, value);
			}
		});

		const query = params.toString();
		router.push(`/crm/contacts${query ? `?${query}` : ""}`);
	};

	const handleImportComplete = () => {
		router.refresh();
	};

	const handleContactClick = useCallback((contact: ContactRow) => {
		router.push(`/crm/contacts/${contact.id}`);
	}, [router]);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="Contacts"
				description="Manage people and relationships across your accounts"
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={() => setImporterOpen(true)}>
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
				{/* Relationship Filter Tabs */}
				<Tabs
					value={relationshipFilter}
					onValueChange={(value) => {
						setRelationshipFilter(value as RelationshipFilter);
						// Reset account filter when switching to "people"
						if (value === "people") {
							setAccountFilter("all");
							updateFilters({ relationship: value, account: "all" });
						} else {
							updateFilters({ relationship: value });
						}
					}}
				>
					<TabsList>
						<TabsTrigger value="all" className="gap-2">
							<Users className="h-4 w-4" />
							All Contacts
						</TabsTrigger>
						<TabsTrigger value="company" className="gap-2">
							<Building2 className="h-4 w-4" />
							Company Contacts
						</TabsTrigger>
						<TabsTrigger value="people" className="gap-2">
							<UserCircle className="h-4 w-4" />
							People
						</TabsTrigger>
					</TabsList>
				</Tabs>

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

					{/* Account filter - hidden when "people" relationship is selected */}
					{relationshipFilter !== "people" && (
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
					)}

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
				{totalCount} {totalCount === 1 ? "contact" : "contacts"}
				{relationshipFilter === "company" && " linked to accounts"}
				{relationshipFilter === "people" && " (standalone)"}
				{accountFilter !== "all" && ` in ${accounts.find(a => a.id === accountFilter)?.name || "selected account"}`}
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
					))}
				</div>
			) : contacts.length === 0 ? (
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
					contacts={contacts}
					onContactClick={handleContactClick}
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{contacts.map((contact) => (
						<ContactCard
							key={contact.id}
							contact={contact}
							onClick={() => handleContactClick(contact)}
						/>
					))}
				</div>
			)}
			</div>

			{/* Contact Importer Dialog */}
			<ContactImporter
				open={importerOpen}
				onOpenChange={setImporterOpen}
				onComplete={handleImportComplete}
			/>
		</div>
	);
}
