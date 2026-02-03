"use client";

/**
 * Accounts Content
 *
 * Client component for accounts list with filtering and view modes.
 * Features the shared CRM navigation bar at the top.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	AccountList,
	AccountCard,
	AccountKanban,
	AccountFilters,
} from "@/components/crm/accounts";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import { toast } from "sonner";
import {
	Plus,
	Search,
	Filter,
	LayoutList,
	LayoutGrid,
	Kanban,
	Download,
	Upload,
	ChevronLeft,
	ChevronRight,
	Building2,
} from "lucide-react";
import type { AccountRow } from "@/lib/db/schema-crm";
import type { AccountType, AccountFilters as AccountFiltersType } from "@/lib/types/crm";
import { getAccounts, updateAccountStage } from "@/lib/actions/crm";

interface AccountsContentProps {
	searchParams: {
		type?: string;
		stage?: string;
		view?: string;
		search?: string;
		page?: string;
	};
}

// Account types for filtering
const ACCOUNT_TYPES = [
	{ value: "all", label: "All Types" },
	{ value: "partner", label: "Partners" },
	{ value: "prospect", label: "Prospects" },
	{ value: "lead", label: "Leads" },
	{ value: "customer", label: "Customers" },
	{ value: "vendor", label: "Vendors" },
];

export default function AccountsContent({ searchParams }: AccountsContentProps) {
	const router = useRouter();
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState(searchParams.search ?? "");
	const [typeFilter, setTypeFilter] = useState(searchParams.type ?? "all");
	const [viewMode, setViewMode] = useState<"list" | "grid" | "kanban">(
		(searchParams.view as "list" | "grid" | "kanban") ?? "list"
	);
	const [showFilters, setShowFilters] = useState(false);
	const [advancedFilters, setAdvancedFilters] = useState<AccountFiltersType>({});

	// Pagination state
	const [totalCount, setTotalCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 50;

	// Fetch accounts
	useEffect(() => {
		async function fetchAccounts() {
			setIsLoading(true);
			try {
				// Merge basic type filter with advanced filters
				const filters: AccountFiltersType = {
					...advancedFilters,
					...(typeFilter !== "all" ? { type: typeFilter as AccountType } : {}),
				};
				const hasFilters = Object.keys(filters).length > 0;
				const response = await getAccounts(hasFilters ? filters : undefined, undefined, { page: currentPage, pageSize });
				setAccounts(response.data);
				setTotalCount(response.total);
			} catch (error) {
				console.error("Failed to fetch accounts:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchAccounts();
	}, [typeFilter, currentPage, advancedFilters]);

	// Filter accounts locally
	const filteredAccounts = useMemo(() => {
		let result = [...accounts];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(a) =>
					a.name.toLowerCase().includes(query) ||
					a.industry?.toLowerCase().includes(query) ||
					a.country?.toLowerCase().includes(query)
			);
		}

		if (typeFilter !== "all") {
			result = result.filter((a) => a.type === typeFilter);
		}

		return result;
	}, [accounts, searchQuery, typeFilter]);

	// Update URL when filters change
	const updateFilters = (updates: Record<string, string>) => {
		const params = new URLSearchParams();
		const current = {
			type: typeFilter,
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
		router.push(`/crm/accounts${query ? `?${query}` : ""}`);
	};

	// Handle account actions
	const handleAccountClick = (account: AccountRow) => {
		router.push(`/crm/accounts/${account.id}`);
	};

	const handleStageChange = async (accountId: string, newStage: string) => {
		try {
			const updated = await updateAccountStage(accountId, newStage);
			if (updated) {
				// Update the account in our local state
				setAccounts((prev) =>
					prev.map((a) => (a.id === accountId ? { ...a, stage: newStage } : a))
				);
				toast.success(`Stage updated to ${newStage}`);
			}
		} catch (error) {
			console.error("Failed to update stage:", error);
			toast.error("Failed to update stage");
		}
	};

	const handleImport = () => {
		toast.info("Import feature", {
			description: "Use the command-line scripts in /scripts to import accounts from Excel files.",
		});
	};

	const handleExport = () => {
		// Create CSV of current filtered accounts
		if (filteredAccounts.length === 0) {
			toast.error("No accounts to export");
			return;
		}

		const headers = ["Name", "Type", "Industry", "Website", "Email", "Phone", "Country", "City", "Stage"];
		const rows = filteredAccounts.map((a) => [
			a.name,
			a.type,
			a.industry ?? "",
			a.website ?? "",
			a.email ?? "",
			a.phone ?? "",
			a.country ?? "",
			a.city ?? "",
			a.stage ?? "",
		]);

		const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `accounts-export-${new Date().toISOString().split("T")[0]}.csv`;
		link.click();
		URL.revokeObjectURL(url);

		toast.success(`Exported ${filteredAccounts.length} accounts`);
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="Accounts"
				description="Manage partners, prospects, customers, and vendors"
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleImport}>
							<Upload className="h-4 w-4 mr-2" />
							Import
						</Button>
						<Button variant="outline" size="sm" onClick={handleExport}>
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
						<Button asChild>
							<Link href="/crm/accounts/new">
								<Plus className="h-4 w-4 mr-2" />
								New Account
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
						placeholder="Search accounts..."
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							updateFilters({ search: e.target.value });
						}}
						className="pl-9"
					/>
				</div>

				<Select
					value={typeFilter}
					onValueChange={(value) => {
						setTypeFilter(value);
						updateFilters({ type: value });
					}}
				>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="Account Type" />
					</SelectTrigger>
					<SelectContent>
						{ACCOUNT_TYPES.map((type) => (
							<SelectItem key={type.value} value={type.value}>
								{type.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Button
					variant="outline"
					size="icon"
					onClick={() => setShowFilters(true)}
				>
					<Filter className="h-4 w-4" />
				</Button>

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
						className="rounded-none border-x"
						onClick={() => {
							setViewMode("grid");
							updateFilters({ view: "grid" });
						}}
					>
						<LayoutGrid className="h-4 w-4" />
					</Button>
					<Button
						variant={viewMode === "kanban" ? "secondary" : "ghost"}
						size="sm"
						className="rounded-l-none"
						onClick={() => {
							setViewMode("kanban");
							updateFilters({ view: "kanban" });
						}}
					>
						<Kanban className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Type Tabs */}
			<Tabs
				value={typeFilter}
				onValueChange={(value) => {
					setTypeFilter(value);
					setCurrentPage(1); // Reset to page 1 when changing filter
					updateFilters({ type: value });
				}}
			>
				<TabsList>
					{ACCOUNT_TYPES.map((type) => (
						<TabsTrigger key={type.value} value={type.value}>
							{type.label}
							{type.value === typeFilter && type.value !== "all" && (
								<span className="ml-1.5 text-xs text-muted-foreground">
									({totalCount})
								</span>
							)}
							{type.value === "all" && typeFilter === "all" && (
								<span className="ml-1.5 text-xs text-muted-foreground">
									({totalCount})
								</span>
							)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			{/* Content */}
			{isLoading ? (
				<div className="space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
					))}
				</div>
			) : filteredAccounts.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<p className="text-lg">No accounts found</p>
					<p className="text-sm">
						{searchQuery
							? "Try adjusting your search or filters"
							: "Create your first account to get started"}
					</p>
					<Button asChild className="mt-4">
						<Link href="/crm/accounts/new">
							<Plus className="h-4 w-4 mr-2" />
							Create Account
						</Link>
					</Button>
				</div>
			) : viewMode === "list" ? (
				<AccountList
					accounts={filteredAccounts}
					onAccountClick={handleAccountClick}
				/>
			) : viewMode === "grid" ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredAccounts.map((account) => (
						<AccountCard
							key={account.id}
							account={account}
							onClick={() => handleAccountClick(account)}
						/>
					))}
				</div>
			) : (
				<AccountKanban
					accounts={filteredAccounts}
					accountType={typeFilter !== "all" ? (typeFilter as AccountType) : "prospect"}
					onAccountClick={handleAccountClick}
					onStageChange={handleStageChange}
				/>
			)}

			{/* Pagination */}
			{totalCount > pageSize && (
				<div className="flex items-center justify-between pt-4 border-t">
					<span className="text-sm text-muted-foreground">
						Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} accounts
					</span>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={currentPage === 1}
							onClick={() => setCurrentPage((p) => p - 1)}
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							Previous
						</Button>
						<span className="text-sm text-muted-foreground px-2">
							Page {currentPage} of {Math.ceil(totalCount / pageSize)}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={currentPage >= Math.ceil(totalCount / pageSize)}
							onClick={() => setCurrentPage((p) => p + 1)}
						>
							Next
							<ChevronRight className="h-4 w-4 ml-1" />
						</Button>
					</div>
				</div>
			)}

				{/* Advanced Filters Sheet */}
				<AccountFilters
					isOpen={showFilters}
					onClose={() => setShowFilters(false)}
					filters={advancedFilters}
					onApply={(filters) => {
						setAdvancedFilters(filters);
						setCurrentPage(1); // Reset to first page when filters change
						setShowFilters(false);
						const filterCount = Object.values(filters).filter(v => v !== undefined && v !== null && v !== "").length;
						if (filterCount > 0) {
							toast.success(`Applied ${filterCount} filter${filterCount > 1 ? "s" : ""}`);
						}
					}}
				/>
			</div>
		</div>
	);
}
