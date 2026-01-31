"use client";

/**
 * Deal Detail Content
 *
 * Client component displaying full deal details.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTimeline } from "@/components/crm/activities";
import { StageIndicator, StagePipeline } from "@/components/crm/shared";
import {
	ArrowLeft,
	Pencil,
	Trash2,
	DollarSign,
	Calendar,
	Building2,
	User,
	CheckCircle,
	XCircle,
} from "lucide-react";
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
import type { DealRow, AccountRow, ContactRow, ActivityRow } from "@/lib/db/schema-crm";

interface DealDetailContentProps {
	dealId: string;
}

// Deal stages configuration
const DEAL_STAGES = [
	{ id: "qualification", label: "Qualification", probability: 10 },
	{ id: "discovery", label: "Discovery", probability: 25 },
	{ id: "proposal", label: "Proposal", probability: 50 },
	{ id: "negotiation", label: "Negotiation", probability: 75 },
	{ id: "closed_won", label: "Won", probability: 100 },
	{ id: "closed_lost", label: "Lost", probability: 0 },
];

// Format currency
const formatCurrency = (value: number | null | undefined, currency = "USD") => {
	if (!value) return "-";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
};

// Format date
const formatDate = (date: Date | string | null | undefined) => {
	if (!date) return "-";
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

export default function DealDetailContent({ dealId }: DealDetailContentProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [deal, setDeal] = useState<DealRow | null>(null);
	const [account, setAccount] = useState<AccountRow | null>(null);
	const [contact, setContact] = useState<ContactRow | null>(null);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showWinDialog, setShowWinDialog] = useState(false);
	const [showLoseDialog, setShowLoseDialog] = useState(false);

	// Fetch deal data
	useEffect(() => {
		async function fetchData() {
			setIsLoading(true);
			try {
				// In production:
				// const dealData = await getDeal(dealId);
				// const accountData = await getAccount(dealData.accountId);
				// const contactData = dealData.primaryContactId ? await getContact(dealData.primaryContactId) : null;
				// const activitiesData = await getDealTimeline(dealId);

				setDeal(null);
				setAccount(null);
				setContact(null);
				setActivities([]);
			} catch (error) {
				console.error("Failed to fetch deal:", error);
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [dealId]);

	const handleEdit = () => {
		router.push(`/crm/deals/${dealId}/edit`);
	};

	const handleDelete = async () => {
		try {
			// In production: await deleteDeal(dealId);
			router.push("/crm/deals");
		} catch (error) {
			console.error("Failed to delete deal:", error);
		}
	};

	const handleWin = async () => {
		try {
			// In production: await markDealWon(dealId);
			console.log("Marking deal as won");
			setShowWinDialog(false);
		} catch (error) {
			console.error("Failed to mark deal as won:", error);
		}
	};

	const handleLose = async () => {
		try {
			// In production: await markDealLost(dealId, reason);
			console.log("Marking deal as lost");
			setShowLoseDialog(false);
		} catch (error) {
			console.error("Failed to mark deal as lost:", error);
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
				<div className="h-12 bg-muted animate-pulse rounded" />
				<div className="grid grid-cols-3 gap-6">
					<div className="col-span-2 h-96 bg-muted animate-pulse rounded-lg" />
					<div className="h-96 bg-muted animate-pulse rounded-lg" />
				</div>
			</div>
		);
	}

	if (!deal) {
		return (
			<div className="h-full flex flex-col items-center justify-center">
				<h2 className="text-xl font-semibold">Deal not found</h2>
				<p className="text-muted-foreground mt-2">
					The deal you're looking for doesn't exist or has been deleted.
				</p>
				<Button asChild className="mt-4">
					<Link href="/crm/deals">Back to Deals</Link>
				</Button>
			</div>
		);
	}

	const currentStage = DEAL_STAGES.find((s) => s.id === deal.stage);
	const isOpen = deal.status === "open";

	return (
		<div className="h-full overflow-y-auto p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href="/crm/deals">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-2xl font-bold">{deal.name}</h1>
							{deal.status === "won" && (
								<Badge className="bg-green-100 text-green-700">Won</Badge>
							)}
							{deal.status === "lost" && (
								<Badge variant="destructive">Lost</Badge>
							)}
						</div>
						<p className="text-muted-foreground">
							{formatCurrency(deal.value, deal.currency ?? "USD")}
							{account && ` · ${account.name}`}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{isOpen && (
						<>
							<Button
								variant="outline"
								className="text-green-600 hover:text-green-700"
								onClick={() => setShowWinDialog(true)}
							>
								<CheckCircle className="h-4 w-4 mr-2" />
								Won
							</Button>
							<Button
								variant="outline"
								className="text-red-600 hover:text-red-700"
								onClick={() => setShowLoseDialog(true)}
							>
								<XCircle className="h-4 w-4 mr-2" />
								Lost
							</Button>
						</>
					)}
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

			{/* Stage Pipeline */}
			{isOpen && (
				<Card className="mb-6">
					<CardContent className="p-4">
						<StagePipeline
							currentStage={deal.stage}
							isDeal={true}
						/>
					</CardContent>
				</Card>
			)}

			{/* Main Content */}
			<div className="grid grid-cols-3 gap-6">
				{/* Left Column - Details */}
				<div className="col-span-2 space-y-6">
					<Tabs defaultValue="overview">
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="activities">Activities</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="space-y-6 mt-4">
							<Card>
								<CardHeader>
									<CardTitle>Deal Details</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-sm text-muted-foreground">Value</p>
											<p className="font-medium flex items-center gap-1">
												<DollarSign className="h-4 w-4" />
												{formatCurrency(deal.value, deal.currency ?? "USD")}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Expected Close</p>
											<p className="font-medium flex items-center gap-1">
												<Calendar className="h-4 w-4" />
												{formatDate(deal.expectedCloseDate)}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Stage</p>
											<p className="font-medium">{currentStage?.label ?? deal.stage}</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Probability</p>
											<p className="font-medium">{currentStage?.probability ?? 0}%</p>
										</div>
									</div>
									{deal.description && (
										<div>
											<p className="text-sm text-muted-foreground">Description</p>
											<p className="mt-1">{deal.description}</p>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="activities" className="mt-4">
							<ActivityTimeline
								activities={activities}
								onActivityClick={(activity) =>
									router.push(`/crm/activities/${activity.id}`)
								}
							/>
						</TabsContent>
					</Tabs>
				</div>

				{/* Right Column - Sidebar */}
				<div className="space-y-4">
					{/* Account Card */}
					{account && (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Account
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Link
									href={`/crm/accounts/${account.id}`}
									className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-md transition-colors"
								>
									<Building2 className="h-5 w-5 text-muted-foreground" />
									<div>
										<p className="font-medium">{account.name}</p>
										<p className="text-sm text-muted-foreground capitalize">
											{account.type}
										</p>
									</div>
								</Link>
							</CardContent>
						</Card>
					)}

					{/* Contact Card */}
					{contact && (
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Primary Contact
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Link
									href={`/crm/contacts/${contact.id}`}
									className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-md transition-colors"
								>
									<User className="h-5 w-5 text-muted-foreground" />
									<div>
										<p className="font-medium">
											{contact.firstName} {contact.lastName}
										</p>
										<p className="text-sm text-muted-foreground">{contact.title}</p>
									</div>
								</Link>
							</CardContent>
						</Card>
					)}

					{/* Quick Stats */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Quick Stats
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Created</span>
								<span>{formatDate(deal.createdAt)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Updated</span>
								<span>{formatDate(deal.updatedAt)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Activities</span>
								<span>{activities.length}</span>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Deal</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{deal.name}"? This action cannot be undone.
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

			{/* Win Dialog */}
			<AlertDialog open={showWinDialog} onOpenChange={setShowWinDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Mark Deal as Won</AlertDialogTitle>
						<AlertDialogDescription>
							Congratulations! Mark "{deal.name}" as won?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleWin}
							className="bg-green-600 hover:bg-green-700"
						>
							Mark as Won
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Lose Dialog */}
			<AlertDialog open={showLoseDialog} onOpenChange={setShowLoseDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Mark Deal as Lost</AlertDialogTitle>
						<AlertDialogDescription>
							Mark "{deal.name}" as lost? You can add a reason later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleLose}
							className="bg-red-600 hover:bg-red-700"
						>
							Mark as Lost
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
