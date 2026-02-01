/**
 * Company Overview Component - DocFusion
 *
 * Displays company statistics and overview cards.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyStats } from "@/lib/types/company";
import {
	Users,
	FileText,
	Briefcase,
	Package,
	Building2,
}
from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface CompanyOverviewProps {
	stats: CompanyStats;
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyOverview({ stats }: CompanyOverviewProps) {
	const cards = [
		{
			title: "Team Roles",
			value: stats.roleCount,
			icon: Users,
			description: "Defined positions",
			color: "text-blue-600",
			bgColor: "bg-blue-100 dark:bg-blue-900",
		},
		{
			title: "Team CVs",
			value: stats.cvCount,
			icon: FileText,
			description: "Active profiles",
			color: "text-green-600",
			bgColor: "bg-green-100 dark:bg-green-900",
		},
		{
			title: "Clients",
			value: stats.clientCount,
			icon: Briefcase,
			description: `${stats.activeClientCount} active, ${stats.formerClientCount} former`,
			color: "text-amber-600",
			bgColor: "bg-amber-100 dark:bg-amber-900",
		},
		{
			title: "Offerings",
			value: stats.productCount + stats.serviceCount,
			icon: Package,
			description: `${stats.productCount} products, ${stats.serviceCount} services`,
			color: "text-purple-600",
			bgColor: "bg-purple-100 dark:bg-purple-900",
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{cards.map((card) => {
				const Icon = card.icon;
				return (
					<Card key={card.title} className="overflow-hidden">
						<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
							<CardTitle className="text-sm font-medium">
								{card.title}
							</CardTitle>
							<div className={`p-2 rounded-lg ${card.bgColor}`}>
								<Icon className={`h-4 w-4 ${card.color}`} />
							</div>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{card.value}</div>
							<p className="text-xs text-muted-foreground">
								{card.description}
							</p>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
