"use client";

/**
 * Deals Content
 *
 * Client component for deals pipeline with Kanban view.
 * Features the shared CRM navigation bar at the top.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { DealPipeline, DealCard } from "@/components/crm/deals";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import {
	Plus,
	Search,
	LayoutList,
	Kanban,
	DollarSign,
	Target,
} from "lucide-react";
import type { DealRow, AccountRow } from "@/lib/db/schema-crm";

interface DealsContentProps {
	searchParams: {
		account?: string;
		stage?: string;
		view?: string;
		search?: string;
		page?: string;
	};
}

// Format currency
const formatCurrency = (value: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: value >= 1000000 ? "compact" : "standard",
		maximumFractionDigits: value >= 1000000 ? 1 : 0,
	}).format(value);
};

export default function DealsContent({ searchParams }: DealsContentProps) {
	const router = useRouter();
	const [deals, setDeals] = useState<DealRow[]>([]);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState(searchParams.search ?? "");
	const [accountFilter, setAccountFilter] = useState(searchParams.account ?? "all");
	const [stageFilter, setStageFilter] = useState(searchParams.stage ?? "all");
	const [viewMode, setViewMode] = useState<"kanban" | "list">(
		(searchParams.view as "kanban" | "list") ?? "kanban"
	);

	// Fetch deals
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				// In production:
				// const dealsData = await getDeals({ status: "open" });
				// const accountsData = await getAccounts();
				setDeals([]);
				setAccounts([]);
			} catch (error) {
				console.error("Failed to fetch deals:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, []);

	// Filter deals locally
	const filteredDeals = useMemo(() => {
		let result = [...deals];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter((d) => d.name.toLowerCase().includes(query));
		}

		if (accountFilter !== "all") {
			result = result.filter((d) => d.accountId === accountFilter);
		}

		if (stageFilter !== "all") {
			result = result.filter((d) => d.stage === stageFilter);
		}

		return result;
	}, [deals, searchQuery, accountFilter, stageFilter]);

	// Calculate pipeline stats
	const stats = useMemo(() => {
		const openDeals = filteredDeals.filter((d) => d.status === "open");
		const total = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
		const weighted = openDeals.reduce((sum, d) => {
			const probability = d.stageProbability ?? 50;
			return sum + (d.value ?? 0) * (probability / 100);
		}, 0);

		return { total, weighted, count: openDeals.length };
	}, [filteredDeals]);

	// Update URL when filters change
	const updateFilters = (updates: Record<string, string>) => {
		const params = new URLSearchParams();
		const current = {
			account: accountFilter,
			stage: stageFilter,
			view: viewMode,
			search: searchQuery,
			...updates,
		};

		Object.entries(current).forEach(([key, value]) => {
			if (value && value !== "all" && value !== "kanban" && value !== "") {
				params.set(key, value);
			}
		});

		const query = params.toString();
		router.push(`/crm/deals${query ? `?${query}` : ""}`);
	};

	const handleDealClick = (deal: DealRow) => {
		router.push(`/crm/deals/${deal.id}`);
	};

	const handleStageChange = async (dealId: string, newStage: string) => {
		// In production: await updateDealStage(dealId, newStage);
		console.log("Deal stage changed:", dealId, newStage);
		// Optimistically update local state
		setDeals((prev) =>
			prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
		);
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="Deals Pipeline"
				description="Track and manage your sales opportunities"
				actions={
					<Button asChild>
						<Link href="/crm/deals/new">
							<Plus className="h-4 w-4 mr-2" />
							New Deal
						</Link>
					</Button>
				}
			/>

			<div className="flex-1 flex flex-col overflow-hidden p-6">
				{/* Stats Bar */}
			<div className="flex items-center gap-6 mb-6 p-4 bg-muted/50 rounded-lg">
				<div className="flex items-center gap-2">
					<DollarSign className="h-5 w-5 text-muted-foreground" />
					<div>
						<p className="text-sm text-muted-foreground">Pipeline Value</p>
						<p className="text-xl font-bold">{formatCurrency(stats.total)}</p>
					</div>
				</div>
				<div className="h-8 w-px bg-border" />
				<div className="flex items-center gap-2">
					<Target className="h-5 w-5 text-muted-foreground" />
					<div>
						<p className="text-sm text-muted-foreground">Weighted Value</p>
						<p className="text-xl font-bold">{formatCurrency(stats.weighted)}</p>
					</div>
				</div>
				<div className="h-8 w-px bg-border" />
				<div>
					<p className="text-sm text-muted-foreground">Open Deals</p>
					<p className="text-xl font-bold">{stats.count}</p>
				</div>
			</div>

			{/* Filters Bar */}
			<div className="flex items-center gap-4 mb-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search deals..."
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
					<SelectTrigger className="w-[180px]">
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
				<div className="flex items-center border rounded-md ml-auto">
					<Button
						variant={viewMode === "kanban" ? "secondary" : "ghost"}
						size="sm"
						className="rounded-r-none"
						onClick={() => {
							setViewMode("kanban");
							updateFilters({ view: "kanban" });
						}}
					>
						<Kanban className="h-4 w-4 mr-2" />
						Pipeline
					</Button>
					<Button
						variant={viewMode === "list" ? "secondary" : "ghost"}
						size="sm"
						className="rounded-l-none"
						onClick={() => {
							setViewMode("list");
							updateFilters({ view: "list" });
						}}
					>
						<LayoutList className="h-4 w-4 mr-2" />
						List
					</Button>
				</div>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="grid grid-cols-5 gap-4 flex-1">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="space-y-3">
							<div className="h-8 bg-muted animate-pulse rounded" />
							<div className="h-32 bg-muted animate-pulse rounded-lg" />
							<div className="h-32 bg-muted animate-pulse rounded-lg" />
						</div>
					))}
				</div>
			) : filteredDeals.length === 0 ? (
				<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
					<p className="text-lg">No deals found</p>
					<p className="text-sm">
						{searchQuery
							? "Try adjusting your search"
							: "Create your first deal to get started"}
					</p>
					<Button asChild className="mt-4">
						<Link href="/crm/deals/new">
							<Plus className="h-4 w-4 mr-2" />
							Create Deal
						</Link>
					</Button>
				</div>
			) : viewMode === "kanban" ? (
				<div className="flex-1 overflow-hidden">
					<DealPipeline
						deals={filteredDeals}
						onDealClick={handleDealClick}
						onStageChange={handleStageChange}
					/>
				</div>
				) : (
					<div className="space-y-3 overflow-y-auto flex-1">
						{filteredDeals.map((deal) => (
							<DealCard
								key={deal.id}
								deal={deal}
								onClick={() => handleDealClick(deal)}
								variant="default"
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
