"use client";

/**
 * Activities Content
 *
 * Client component for activity timeline and task management.
 * Features the shared CRM navigation bar at the top.
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ActivityTimeline, TaskList } from "@/components/crm/activities";
import { TaskStatsWidget } from "@/components/crm/dashboard";
import { CRMNavigation } from "@/components/crm/CRMNavigation";
import {
	Plus,
	Search,
	Calendar,
	CheckSquare,
	Clock,
	Filter,
} from "lucide-react";
import type { ActivityRow, AccountRow } from "@/lib/db/schema-crm";

interface ActivitiesContentProps {
	searchParams: {
		type?: string;
		status?: string;
		account?: string;
		view?: string;
		search?: string;
	};
}

// Activity types for filtering
const ACTIVITY_TYPES = [
	{ value: "all", label: "All Types" },
	{ value: "email", label: "Email" },
	{ value: "call", label: "Call" },
	{ value: "meeting", label: "Meeting" },
	{ value: "task", label: "Task" },
	{ value: "note", label: "Note" },
	{ value: "demo", label: "Demo" },
	{ value: "proposal", label: "Proposal" },
];

export default function ActivitiesContent({ searchParams }: ActivitiesContentProps) {
	const router = useRouter();
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState(searchParams.search ?? "");
	const [typeFilter, setTypeFilter] = useState(searchParams.type ?? "all");
	const [accountFilter, setAccountFilter] = useState(searchParams.account ?? "all");
	const [activeTab, setActiveTab] = useState<"timeline" | "tasks">(
		(searchParams.view as "timeline" | "tasks") ?? "timeline"
	);

	// Fetch activities
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				// In production:
				// const activitiesData = await getActivities();
				// const accountsData = await getAccounts();
				setActivities([]);
				setAccounts([]);
			} catch (error) {
				console.error("Failed to fetch activities:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, []);

	// Filter activities locally
	const filteredActivities = useMemo(() => {
		let result = [...activities];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(a) =>
					a.subject?.toLowerCase().includes(query) ||
					a.description?.toLowerCase().includes(query)
			);
		}

		if (typeFilter !== "all") {
			result = result.filter((a) => a.type === typeFilter);
		}

		if (accountFilter !== "all") {
			result = result.filter((a) => a.accountId === accountFilter);
		}

		return result;
	}, [activities, searchQuery, typeFilter, accountFilter]);

	// Calculate task stats
	const taskStats = useMemo(() => {
		const now = new Date();
		const tasks = filteredActivities.filter((a) => a.type === "task");

		const overdue = tasks.filter(
			(t) =>
				t.status !== "completed" &&
				t.scheduledAt &&
				new Date(t.scheduledAt) < now
		).length;

		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const dueToday = tasks.filter(
			(t) =>
				t.status !== "completed" &&
				t.scheduledAt &&
				new Date(t.scheduledAt) >= today &&
				new Date(t.scheduledAt) < tomorrow
		).length;

		const nextWeek = new Date(today);
		nextWeek.setDate(nextWeek.getDate() + 7);

		const upcoming = tasks.filter(
			(t) =>
				t.status !== "completed" &&
				t.scheduledAt &&
				new Date(t.scheduledAt) >= tomorrow &&
				new Date(t.scheduledAt) < nextWeek
		).length;

		const completed = tasks.filter((t) => t.status === "completed").length;

		return { overdue, dueToday, upcoming, completed };
	}, [filteredActivities]);

	// Update URL when filters change
	const updateFilters = (updates: Record<string, string>) => {
		const params = new URLSearchParams();
		const current = {
			type: typeFilter,
			account: accountFilter,
			view: activeTab,
			search: searchQuery,
			...updates,
		};

		Object.entries(current).forEach(([key, value]) => {
			if (value && value !== "all" && value !== "timeline" && value !== "") {
				params.set(key, value);
			}
		});

		const query = params.toString();
		router.push(`/crm/activities${query ? `?${query}` : ""}`);
	};

	const handleActivityClick = (activity: ActivityRow) => {
		router.push(`/crm/activities/${activity.id}`);
	};

	const handleTaskComplete = async (activityId: string) => {
		// In production: await updateActivity(activityId, { status: "completed", completedAt: new Date() });
		console.log("Completing task:", activityId);
		setActivities((prev) =>
			prev.map((a) =>
				a.id === activityId
					? { ...a, status: "completed", completedAt: new Date() }
					: a
			)
		);
	};

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* CRM Navigation Bar */}
			<CRMNavigation
				title="Activities"
				description="Track interactions and manage tasks"
				actions={
					<Button asChild>
						<Link href="/crm/activities/new">
							<Plus className="h-4 w-4 mr-2" />
							New Activity
						</Link>
					</Button>
				}
			/>

			<div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
				{/* Task Stats */}
			<TaskStatsWidget
				overdue={taskStats.overdue}
				dueToday={taskStats.dueToday}
				upcoming={taskStats.upcoming}
				completed={taskStats.completed}
				size="sm"
			/>

			{/* Filters Bar */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search activities..."
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
					<SelectTrigger className="w-[150px]">
						<SelectValue placeholder="Activity Type" />
					</SelectTrigger>
					<SelectContent>
						{ACTIVITY_TYPES.map((type) => (
							<SelectItem key={type.value} value={type.value}>
								{type.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

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
			</div>

			{/* Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={(value) => {
					setActiveTab(value as "timeline" | "tasks");
					updateFilters({ view: value });
				}}
			>
				<TabsList>
					<TabsTrigger value="timeline" className="gap-2">
						<Clock className="h-4 w-4" />
						Timeline
					</TabsTrigger>
					<TabsTrigger value="tasks" className="gap-2">
						<CheckSquare className="h-4 w-4" />
						Tasks
					</TabsTrigger>
				</TabsList>

				<TabsContent value="timeline" className="mt-4">
					{isLoading ? (
						<div className="space-y-3">
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
							))}
						</div>
					) : filteredActivities.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
							<Calendar className="h-12 w-12 mb-4" />
							<p className="text-lg">No activities found</p>
							<p className="text-sm">
								{searchQuery
									? "Try adjusting your search"
									: "Create your first activity to get started"}
							</p>
							<Button asChild className="mt-4">
								<Link href="/crm/activities/new">
									<Plus className="h-4 w-4 mr-2" />
									Create Activity
								</Link>
							</Button>
						</div>
					) : (
						<ActivityTimeline
							activities={filteredActivities}
							onActivityClick={handleActivityClick}
						/>
					)}
				</TabsContent>

				<TabsContent value="tasks" className="mt-4">
					{isLoading ? (
						<div className="space-y-3">
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
							))}
						</div>
					) : (
						<TaskList
							activities={filteredActivities.filter((a) => a.type === "task")}
							onTaskClick={handleActivityClick}
							onTaskComplete={handleTaskComplete}
						/>
					)}
				</TabsContent>
			</Tabs>
			</div>
		</div>
	);
}
