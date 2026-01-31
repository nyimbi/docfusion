"use client";

/**
 * CRM Navigation Component
 *
 * A shared navigation bar for the CRM module that provides quick access
 * to all CRM entities (Accounts, Contacts, Deals, Activities) with
 * entity-specific color coding and visual feedback.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
	Plus,
	Building2,
	Users,
	Handshake,
	Calendar,
	LayoutDashboard,
	ChevronRight,
} from "lucide-react";

// CRM Entity Navigation configuration
export const CRM_ENTITIES = [
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
] as const;

// Quick actions for creating new entities
export const QUICK_ACTIONS = [
	{ label: "Account", href: "/crm/accounts/new", icon: Building2, color: "text-blue-600" },
	{ label: "Contact", href: "/crm/contacts/new", icon: Users, color: "text-emerald-600" },
	{ label: "Deal", href: "/crm/deals/new", icon: Handshake, color: "text-violet-600" },
	{ label: "Activity", href: "/crm/activities/new", icon: Calendar, color: "text-amber-600" },
];

interface CRMNavigationProps {
	/** Optional title override for the header */
	title?: string;
	/** Optional description override */
	description?: string;
	/** Optional right-side content (e.g., action buttons) */
	actions?: React.ReactNode;
	/** Whether to show the quick actions dropdown */
	showQuickActions?: boolean;
	/** Compact mode - smaller padding */
	compact?: boolean;
}

export function CRMNavigation({
	title,
	description,
	actions,
	showQuickActions = true,
	compact = false,
}: CRMNavigationProps) {
	const pathname = usePathname();

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
	const activeConfig = CRM_ENTITIES.find((e) => e.key === activeEntity);

	return (
		<div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
			<div className={compact ? "px-4 py-3" : "px-6 py-4"}>
				{/* Top row: Title + Actions */}
				{(title || description || actions) && (
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							{activeConfig && (
								<div className={`p-2 rounded-lg ${activeConfig.bgColor}`}>
									<activeConfig.icon className={`h-5 w-5 ${activeConfig.color}`} />
								</div>
							)}
							<div>
								<h1 className="text-xl font-display font-semibold tracking-tight">
									{title || "Customer Relationship Management"}
								</h1>
								{description && (
									<p className="text-sm text-muted-foreground">{description}</p>
								)}
							</div>
						</div>
						{actions && <div className="flex items-center gap-2">{actions}</div>}
					</div>
				)}

				{/* Entity Navigation Cards */}
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
					{showQuickActions && (
						<div className="flex-shrink-0 flex items-center pl-2 border-l border-border/50">
							<div className="relative group">
								<Button
									variant="outline"
									size="sm"
									className="h-10 px-3 gap-2 bg-background hover:bg-muted"
								>
									<Plus className="h-4 w-4" />
									<span className="hidden sm:inline">New</span>
								</Button>

								{/* Quick actions dropdown on hover */}
								<div className="absolute top-full right-0 mt-2 p-2 bg-popover border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[160px]">
									{QUICK_ACTIONS.map((action) => (
										<Link
											key={action.href}
											href={action.href}
											className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors"
										>
											<action.icon className={`h-4 w-4 ${action.color}`} />
											<span className="text-sm">{action.label}</span>
										</Link>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default CRMNavigation;
