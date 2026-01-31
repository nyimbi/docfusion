"use client";

/**
 * People Content
 *
 * Client component for standalone contacts (People) with import focus.
 * Shows contacts NOT linked to any account, with easy import functionality.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ContactList, ContactCard, ContactImporter } from "@/components/crm/contacts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
	Plus,
	Search,
	LayoutList,
	LayoutGrid,
	Upload,
	Download,
	Building2,
	ChevronDown,
	UserCircle,
	History,
} from "lucide-react";
import type { ContactRow } from "@/lib/db/schema-crm";
import { getStandaloneContacts, type UserContext } from "@/lib/actions/crm/contacts";

interface PeopleContentProps {
	searchParams: {
		search?: string;
		view?: string;
		page?: string;
	};
	userContext: UserContext;
}

export default function PeopleContent({ searchParams, userContext }: PeopleContentProps) {
	const router = useRouter();
	const [contacts, setContacts] = useState<ContactRow[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState(searchParams.search ?? "");
	const [viewMode, setViewMode] = useState<"list" | "grid">(
		(searchParams.view as "list" | "grid") ?? "list"
	);
	const [importerOpen, setImporterOpen] = useState(false);

	// Fetch standalone contacts (owned by or shared with user)
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				const page = parseInt(searchParams.page || "1");
				const result = await getStandaloneContacts(
					userContext,
					{ search: searchQuery || undefined },
					{ page, pageSize: 25 }
				);
				setContacts(result.data);
				setTotalCount(result.total);
			} catch (error) {
				console.error("Failed to fetch people:", error);
				setContacts([]);
				setTotalCount(0);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [searchQuery, searchParams.page, userContext]);

	// Update URL when filters change
	const updateFilters = (updates: Record<string, string>) => {
		const params = new URLSearchParams();
		const current = {
			view: viewMode,
			search: searchQuery,
			...updates,
		};

		Object.entries(current).forEach(([key, value]) => {
			if (value && value !== "list" && value !== "") {
				params.set(key, value);
			}
		});

		const query = params.toString();
		router.push(`/crm/people${query ? `?${query}` : ""}`);
	};

	const handleContactClick = (contact: ContactRow) => {
		router.push(`/crm/people/${contact.id}`);
	};

	const handleImportComplete = () => {
		// Refresh the list after import
		router.refresh();
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="People"
				description="Personal contacts not linked to any company"
				actions={
					<div className="flex items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Upload className="h-4 w-4 mr-2" />
									Import
									<ChevronDown className="h-4 w-4 ml-1" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setImporterOpen(true)}>
									<Upload className="h-4 w-4 mr-2" />
									Import from File
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/crm/people/import-history">
										<History className="h-4 w-4 mr-2" />
										Import History
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button variant="outline" size="sm">
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>

						<Button asChild>
							<Link href="/crm/people/new">
								<Plus className="h-4 w-4 mr-2" />
								New Person
							</Link>
						</Button>
					</div>
				}
			/>

			<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
				{/* Info Banner */}
				<div className="flex items-center gap-3 p-4 bg-teal-50 dark:bg-teal-950/20 rounded-lg border border-teal-200 dark:border-teal-800">
					<UserCircle className="h-5 w-5 text-teal-600" />
					<div className="flex-1">
						<p className="text-sm font-medium text-teal-900 dark:text-teal-100">
							People are contacts not linked to any company
						</p>
						<p className="text-xs text-teal-700 dark:text-teal-300">
							Import from vCard or CSV, or{" "}
							<button
								onClick={() => setImporterOpen(true)}
								className="underline hover:no-underline"
							>
								link them to accounts
							</button>{" "}
							later.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setImporterOpen(true)}
						className="border-teal-300 text-teal-700 hover:bg-teal-100"
					>
						<Upload className="h-4 w-4 mr-1" />
						Import
					</Button>
				</div>

				{/* Filters Bar */}
				<div className="flex items-center gap-4">
					<div className="relative flex-1 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search people..."
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
								updateFilters({ search: e.target.value });
							}}
							className="pl-9"
						/>
					</div>

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
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						{totalCount} {totalCount === 1 ? "person" : "people"}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" asChild>
							<Link href="/crm/contacts">
								<Building2 className="h-4 w-4 mr-1" />
								View All Contacts
							</Link>
						</Button>
					</div>
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
						<UserCircle className="h-16 w-16 mb-4 text-muted-foreground/50" />
						<p className="text-lg font-medium">No people found</p>
						<p className="text-sm">
							{searchQuery
								? "Try adjusting your search"
								: "Import contacts or add people manually"}
						</p>
						<div className="flex gap-3 mt-6">
							<Button onClick={() => setImporterOpen(true)}>
								<Upload className="h-4 w-4 mr-2" />
								Import Contacts
							</Button>
							<Button variant="outline" asChild>
								<Link href="/crm/people/new">
									<Plus className="h-4 w-4 mr-2" />
									Add Person
								</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "list" ? (
					<ContactList
						contacts={contacts}
						onContactClick={handleContactClick}
						showAccountColumn={false}
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
