"use client";

/**
 * CRM Dashboard Content
 *
 * Client component for the CRM dashboard with interactive widgets.
 * Features a prominent top navigation bar for quick entity access.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	PipelineWidget,
	ActivityWidget,
	CRMStatsWidget,
	TaskStatsWidget,
	ForecastWidget,
} from "@/components/crm/dashboard";
import {
	Plus,
	Building2,
	Users,
	Handshake,
	Calendar,
	RefreshCw,
	LayoutDashboard,
	ChevronRight,
	TrendingUp,
	ArrowUpRight,
} from "lucide-react";
import type { AccountRow, ContactRow, DealRow, ActivityRow } from "@/lib/db/schema-crm";
import { getCRMDashboardStats } from "@/lib/actions/crm";

// CRM Entity Navigation - Primary navigation items with entity-specific colors
const CRM_ENTITIES = [
	{
		key: "dashboard",
		label: "Dashboard",
		href: "/crm",
		icon: LayoutDashboard,
		color: "text-primary",
		bgColor: "bg-primary/10",
		borderColor: "border-primary/20",
		hoverBg: "hover:bg-primary/15",
		description: "Overview & metrics",
	},
	{
		key: "accounts",
		label: "Accounts",
		href: "/crm/accounts",
		icon: Building2,
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-50 dark:bg-blue-950/50",
		borderColor: "border-blue-200 dark:border-blue-800",
		hoverBg: "hover:bg-blue-100 dark:hover:bg-blue-900/50",
		description: "Companies & organizations",
	},
	{
		key: "contacts",
		label: "Contacts",
		href: "/crm/contacts",
		icon: Users,
		color: "text-emerald-600 dark:text-emerald-400",
		bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
		borderColor: "border-emerald-200 dark:border-emerald-800",
		hoverBg: "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
		description: "People & relationships",
	},
	{
		key: "deals",
		label: "Deals",
		href: "/crm/deals",
		icon: Handshake,
		color: "text-violet-600 dark:text-violet-400",
		bgColor: "bg-violet-50 dark:bg-violet-950/50",
		borderColor: "border-violet-200 dark:border-violet-800",
		hoverBg: "hover:bg-violet-100 dark:hover:bg-violet-900/50",
		description: "Sales pipeline",
	},
	{
		key: "activities",
		label: "Activities",
		href: "/crm/activities",
		icon: Calendar,
		color: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-50 dark:bg-amber-950/50",
		borderColor: "border-amber-200 dark:border-amber-800",
		hoverBg: "hover:bg-amber-100 dark:hover:bg-amber-900/50",
		description: "Tasks & timeline",
	},
];

// Quick actions for creating new entities
const QUICK_ACTIONS = [
	{ label: "Account", href: "/crm/accounts/new", icon: Building2, color: "text-blue-600" },
	{ label: "Contact", href: "/crm/contacts/new", icon: Users, color: "text-emerald-600" },
	{ label: "Deal", href: "/crm/deals/new", icon: Handshake, color: "text-violet-600" },
	{ label: "Activity", href: "/crm/activities/new", icon: Calendar, color: "text-amber-600" },
];

export default function CRMDashboard() {
	const router = useRouter();
	const pathname = usePathname();
	const [isLoading, setIsLoading] = useState(true);
	const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");

	// Data states
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [contacts, setContacts] = useState<ContactRow[]>([]);
	const [deals, setDeals] = useState<DealRow[]>([]);
	const [activities, setActivities] = useState<ActivityRow[]>([]);

	// Stats
	const [stats, setStats] = useState({
		totalAccounts: 0,
		totalContacts: 0,
		openDeals: 0,
		pipelineValue: 0,
		overdueTasks: 0,
		dueToday: 0,
		upcoming: 0,
		completed: 0,
	});

	// Fetch dashboard data
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				const dashboardStats = await getCRMDashboardStats();
				setStats({
					totalAccounts: dashboardStats.totalAccounts,
					totalContacts: dashboardStats.totalContacts,
					openDeals: dashboardStats.openDeals,
					pipelineValue: dashboardStats.pipelineValue,
					overdueTasks: dashboardStats.overdueTasks,
					dueToday: dashboardStats.dueToday,
					upcoming: dashboardStats.upcoming,
					completed: dashboardStats.completedTasks,
				});
			} catch (error) {
				console.error("Failed to fetch dashboard data:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [period]);

	const handleRefresh = () => {
		setIsLoading(true);
		setTimeout(() => setIsLoading(false), 500);
	};

	// Determine which entity is currently active
	const getActiveEntity = () => {
		if (pathname === "/crm") return "dashboard";
		if (pathname.startsWith("/crm/accounts")) return "accounts";
		if (pathname.startsWith("/crm/contacts")) return "contacts";
		if (pathname.startsWith("/crm/deals")) return "deals";
		if (pathname.startsWith("/crm/activities")) return "activities";
		return "dashboard";
	};

	const activeEntity = getActiveEntity();

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* ═══════════════════════════════════════════════════════════════
			    CRM Navigation Bar - Primary Entity Navigation
			    Moved to top for improved ergonomics and quick access
			    ═══════════════════════════════════════════════════════════════ */}
			<div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
				<div className="px-6 py-4">
					{/* Top row: Title + Period selector + Refresh */}
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-primary/10">
								<LayoutDashboard className="h-5 w-5 text-primary" />
							</div>
							<div>
								<h1 className="text-xl font-display font-semibold tracking-tight">
									Customer Relationship Management
								</h1>
								<p className="text-sm text-muted-foreground">
									Pipeline, contacts, and activities at a glance
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
								<SelectTrigger className="w-[130px] h-9 text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="week">This Week</SelectItem>
									<SelectItem value="month">This Month</SelectItem>
									<SelectItem value="quarter">This Quarter</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="icon"
								className="h-9 w-9"
								onClick={handleRefresh}
							>
								<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
							</Button>
						</div>
					</div>

					{/* Entity Navigation Cards - The star of the show */}
					<div className="flex items-stretch gap-3 overflow-x-auto pb-1 scrollbar-thin">
						{CRM_ENTITIES.map((entity, index) => {
							const isActive = activeEntity === entity.key;
							const EntityIcon = entity.icon;

							return (
								<Link
									key={entity.key}
									href={entity.href}
									className={`
										group relative flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl
										border transition-all duration-200 min-w-[160px]
										${isActive
											? `${entity.bgColor} ${entity.borderColor} shadow-sm`
											: `bg-background border-border/50 ${entity.hoverBg}`
										}
										animate-fade-up opacity-0
									`}
									style={{ animationDelay: `${index * 50}ms`, animationFillMode: "forwards" }}
								>
									{/* Icon container */}
									<div
										className={`
											p-2 rounded-lg transition-colors
											${isActive ? entity.bgColor : "bg-muted/50 group-hover:" + entity.bgColor}
										`}
									>
										<EntityIcon
											className={`h-5 w-5 transition-colors ${isActive ? entity.color : "text-muted-foreground group-hover:" + entity.color}`}
										/>
									</div>

									{/* Label and description */}
									<div className="flex-1 min-w-0">
										<div className={`font-medium text-sm ${isActive ? entity.color : "text-foreground"}`}>
											{entity.label}
										</div>
										<div className="text-xs text-muted-foreground truncate">
											{entity.description}
										</div>
									</div>

									{/* Active indicator */}
									{isActive && (
										<div className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full ${entity.color.replace("text-", "bg-")}`} />
									)}

									{/* Hover arrow */}
									<ChevronRight
										className={`
											h-4 w-4 transition-all duration-200
											${isActive ? entity.color : "text-muted-foreground/0 group-hover:text-muted-foreground"}
											${isActive ? "" : "translate-x-0 group-hover:translate-x-1"}
										`}
									/>
								</Link>
							);
						})}

						{/* Quick Add dropdown */}
						<QuickAddDropdown />
					</div>
				</div>
			</div>

			{/* ═══════════════════════════════════════════════════════════════
			    Main Dashboard Content
			    ═══════════════════════════════════════════════════════════════ */}
			<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
				{/* Stats Cards Row */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
					{/* Accounts Stat */}
					<Link
						href="/crm/accounts"
						className="group p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-800"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
								<Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
							<ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
						</div>
						<div className="text-2xl font-display font-bold tracking-tight">
							{stats.totalAccounts}
						</div>
						<div className="text-sm text-muted-foreground">Total Accounts</div>
					</Link>

					{/* Contacts Stat */}
					<Link
						href="/crm/contacts"
						className="group p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200 hover:border-emerald-200 dark:hover:border-emerald-800"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
								<Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
							</div>
							<ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
						</div>
						<div className="text-2xl font-display font-bold tracking-tight">
							{stats.totalContacts}
						</div>
						<div className="text-sm text-muted-foreground">Total Contacts</div>
					</Link>

					{/* Open Deals Stat */}
					<Link
						href="/crm/deals"
						className="group p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200 hover:border-violet-200 dark:hover:border-violet-800"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50">
								<Handshake className="h-4 w-4 text-violet-600 dark:text-violet-400" />
							</div>
							<ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
						</div>
						<div className="text-2xl font-display font-bold tracking-tight">
							{stats.openDeals}
						</div>
						<div className="text-sm text-muted-foreground">Open Deals</div>
					</Link>

					{/* Pipeline Value Stat */}
					<div className="p-4 rounded-xl border bg-gradient-to-br from-card to-muted/30">
						<div className="flex items-center justify-between mb-3">
							<div className="p-2 rounded-lg bg-primary/10">
								<TrendingUp className="h-4 w-4 text-primary" />
							</div>
						</div>
						<div className="text-2xl font-display font-bold tracking-tight">
							${(stats.pipelineValue / 1000000).toFixed(1)}M
						</div>
						<div className="text-sm text-muted-foreground">Pipeline Value</div>
					</div>
				</div>

				{/* Task Stats */}
				<TaskStatsWidget
					overdue={stats.overdueTasks}
					dueToday={stats.dueToday}
					upcoming={stats.upcoming}
					completed={stats.completed}
					size="sm"
				/>

				{/* Main Content Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Pipeline Widget */}
					<PipelineWidget
						deals={deals}
						mode="deals"
						title="Deal Pipeline"
					/>

					{/* Forecast Widget */}
					<ForecastWidget
						deals={deals}
						target={3000000}
						months={3}
					/>
				</div>

				{/* Activity Section */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Recent Activity */}
					<div className="lg:col-span-2">
						<ActivityWidget
							activities={activities}
							maxItems={8}
							onViewAll={() => router.push("/crm/activities")}
							onActivityClick={(activity) => router.push(`/crm/activities/${activity.id}`)}
						/>
					</div>

					{/* Account Pipeline by Type */}
					<Tabs defaultValue="prospect" className="space-y-4">
						<TabsList className="w-full">
							<TabsTrigger value="prospect" className="flex-1">Prospects</TabsTrigger>
							<TabsTrigger value="lead" className="flex-1">Leads</TabsTrigger>
							<TabsTrigger value="partner" className="flex-1">Partners</TabsTrigger>
						</TabsList>
						<TabsContent value="prospect">
							<PipelineWidget
								accounts={accounts}
								mode="accounts"
								accountType="prospect"
							/>
						</TabsContent>
						<TabsContent value="lead">
							<PipelineWidget
								accounts={accounts}
								mode="accounts"
								accountType="lead"
							/>
						</TabsContent>
						<TabsContent value="partner">
							<PipelineWidget
								accounts={accounts}
								mode="accounts"
								accountType="partner"
							/>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

/**
 * Quick Add Dropdown Component
 * Provides click-to-toggle dropdown for creating new CRM entities.
 */
function QuickAddDropdown() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="flex-shrink-0 flex items-center pl-2 border-l border-border/50">
			<div className="relative">
				<Button
					variant="outline"
					size="sm"
					className="h-10 px-3 gap-2 bg-background hover:bg-muted"
					onClick={() => setIsOpen(!isOpen)}
					onBlur={() => setTimeout(() => setIsOpen(false), 150)}
				>
					<Plus className="h-4 w-4" />
					<span className="hidden sm:inline">New</span>
				</Button>

				{/* Quick actions dropdown */}
				{isOpen && (
					<div className="absolute top-full right-0 mt-2 p-2 bg-popover border rounded-lg shadow-lg z-50 min-w-[160px]">
						{QUICK_ACTIONS.map((action) => (
							<Link
								key={action.href}
								href={action.href}
								className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors"
								onClick={() => setIsOpen(false)}
							>
								<action.icon className={`h-4 w-4 ${action.color}`} />
								<span className="text-sm">{action.label}</span>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
