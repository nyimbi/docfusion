/**
 * App Layout Shell
 *
 * Shared layout for all interior application pages (documents, opportunities, etc.)
 * Provides consistent navigation, sidebar, and app-wide context.
 *
 * Aesthetic: "Command Center Elegance"
 * - Clean, professional environment  
 * - Fixed sidebar with smooth animations
 * - Optimized for performance with memoization
 */

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-provider";
import { useSession, signOut } from "@/lib/auth-client";
import {
	FileText,
	Target,
	LayoutTemplate,
	Calendar,
	Users,
	Settings,
	Search,
	Command,
	Bell,
	ChevronDown,
	LogOut,
	User,
	HelpCircle,
	Moon,
	Sun,
	Menu,
	X,
	Home,
	PanelLeftClose,
	PanelLeft,
	Monitor,
	Feather,
	LucideIcon,
	Building2,
	Briefcase,
	GitBranch,
	Upload,
	Library,
	Kanban,
	UserCircle,
	Award,
	CheckSquare,
	ClipboardCheck,
	Swords,
	BarChart3,
	Workflow,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

// ============================================================================
// Types
// ============================================================================

interface NavItem {
	label: string;
	href: string;
	icon: LucideIcon;
	description?: string;
}

interface NavSection {
	title: string;
	items: NavItem[];
}

// ============================================================================
// Navigation Configuration - Organized by RFP Workflow Phases
// ============================================================================

/**
 * Navigation sections organized to support the natural RFP workflow:
 *
 * 1. DISCOVER - Find opportunities, research customers & competitors
 * 2. CAPTURE - Pipeline management, win probability assessment
 * 3. DEVELOP - Create proposals using templates and editors
 * 4. RESOURCES - Pull in personnel, past performance, partners
 * 5. MANAGE - Coordinate tasks, reviews, deadlines
 */
const NAV_SECTIONS: NavSection[] = [
	{
		title: "Home",
		items: [
			{
				label: "Role Home",
				href: "/home",
				icon: Home,
				description: "Role-based work surface",
			},
		],
	},
	{
		title: "Discover",
		items: [
			{
				label: "Opportunities",
				href: "/opportunities",
				icon: Target,
				description: "Find and track RFP opportunities",
			},
			{
				label: "CRM",
				href: "/crm",
				icon: Briefcase,
				description: "Customers, contacts & partners",
			},
			{
				label: "Competitive Intel",
				href: "/competitive",
				icon: Swords,
				description: "Competitor analysis & battle cards",
			},
		],
	},
	{
		title: "Capture",
		items: [
			{
				label: "Pipeline",
				href: "/pipeline",
				icon: Kanban,
				description: "Qualify and pursue opportunities",
			},
			{
				label: "Analytics",
				href: "/analytics",
				icon: BarChart3,
				description: "Win probability & insights",
			},
		],
	},
	{
		title: "Develop",
		items: [
			{
				label: "Documents",
				href: "/documents",
				icon: FileText,
				description: "Create and edit proposals",
			},
			{
				label: "HDSI Editor",
				href: "/hdsi",
				icon: GitBranch,
				description: "AI-powered document synthesis",
			},
			{
				label: "Templates",
				href: "/templates",
				icon: LayoutTemplate,
				description: "Start from proven formats",
			},
			{
				label: "Content Library",
				href: "/content-library",
				icon: Library,
				description: "Reusable content blocks",
			},
		],
	},
	{
		title: "Resources",
		items: [
			{
				label: "Personnel",
				href: "/personnel",
				icon: UserCircle,
				description: "Resumes & key staff",
			},
			{
				label: "Past Performance",
				href: "/past-performance",
				icon: Award,
				description: "Project history & references",
			},
		],
	},
	{
		title: "Manage",
		items: [
			{
				label: "Tasks",
				href: "/tasks",
				icon: CheckSquare,
				description: "Track proposal activities",
			},
			{
				label: "Reviews",
				href: "/reviews",
				icon: ClipboardCheck,
				description: "Color team reviews",
			},
			{
				label: "Workflows",
				href: "/workflows",
				icon: Workflow,
				description: "Runtime control & governance",
			},
			{
				label: "Calendar",
				href: "/calendar",
				icon: Calendar,
				description: "Deadlines & milestones",
			},
		],
	},
];

/** Utility items at bottom of sidebar */
const UTILITY_NAV_ITEMS: NavItem[] = [
	{
		label: "Import Data",
		href: "/import",
		icon: Upload,
		description: "Import from Excel or CSV",
	},
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
	{ label: "Settings", href: "/settings", icon: Settings },
	{ label: "Help", href: "/help", icon: HelpCircle },
];

// ============================================================================
// Main Layout Component
// ============================================================================

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

	// Memoize handler to prevent re-renders
	const toggleSidebar = React.useCallback(() => {
		setSidebarCollapsed(prev => !prev);
	}, []);

	const openMobileMenu = React.useCallback(() => {
		setMobileMenuOpen(true);
	}, []);

	const closeMobileMenu = React.useCallback(() => {
		setMobileMenuOpen(false);
	}, []);

	return (
		<div className="min-h-screen bg-background bg-paper">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:border focus:border-border focus:rounded-md focus:top-2 focus:left-2"
			>
				Skip to main content
			</a>

			{/* Mobile Header */}
			<MobileHeader 
				onMenuOpen={openMobileMenu}
			/>

			{/* Mobile Sidebar Overlay */}
			{mobileMenuOpen && (
				<MobileMenu
					pathname={pathname}
					onClose={closeMobileMenu}
				/>
			)}

			{/* Desktop Sidebar */}
			<DesktopSidebar
				pathname={pathname}
				collapsed={sidebarCollapsed}
				onToggle={toggleSidebar}
			/>

			{/* Main Content Area */}
			<main
				id="main-content"
				className={cn(
					"relative h-screen flex flex-col transition-all duration-300",
					sidebarCollapsed ? "lg:pl-20" : "lg:pl-64",
					"pt-16 lg:pt-0 bg-secondary/20"
				)}
			>
				{/* Top Bar */}
				<DashboardTopBar />

				{/* Page Content - flex-1 allows children to control their own overflow */}
				<div className="relative flex-1 overflow-hidden">
					<ErrorBoundary>
						{children}
					</ErrorBoundary>
				</div>
			</main>
		</div>
	);
}

// ============================================================================
// Mobile Header
// ============================================================================

interface MobileHeaderProps {
	onMenuOpen: () => void;
}

const MobileHeader = React.memo(function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
	return (
		<header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex items-center justify-between h-full px-4">
				<button
					onClick={onMenuOpen}
					className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					aria-label="Open menu"
				>
					<Menu className="h-5 w-5" />
				</button>

				<Link href="/" className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
						<Feather className="h-4 w-4 text-primary-foreground" />
					</div>
					<span className="font-semibold text-foreground">DocFusion</span>
				</Link>

				<UserMenu />
			</div>
		</header>
	);
});

MobileHeader.displayName = "MobileHeader";

// ============================================================================
// Mobile Menu
// ============================================================================

interface MobileMenuProps {
	pathname: string;
	onClose: () => void;
}

const MobileMenu = React.memo(function MobileMenu({ pathname, onClose }: MobileMenuProps) {
	return (
		<>
			{/* Backdrop */}
			<div
				className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
				onClick={onClose}
				aria-hidden="true"
			/>
			
			{/* Sidebar */}
			<aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-xl">
				<SidebarContent
					pathname={pathname}
					variant="mobile"
					onClose={onClose}
				/>
			</aside>
		</>
	);
});

MobileMenu.displayName = "MobileMenu";

// ============================================================================
// Desktop Sidebar
// ============================================================================

interface DesktopSidebarProps {
	pathname: string;
	collapsed: boolean;
	onToggle: () => void;
}

const DesktopSidebar = React.memo(function DesktopSidebar({
	pathname,
	collapsed,
	onToggle,
}: DesktopSidebarProps) {
	return (
		<aside
			className={cn(
				"hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r bg-card",
				"transition-all duration-300 ease-out",
				collapsed ? "w-20" : "w-64"
			)}
		>
			<SidebarContent
				pathname={pathname}
				variant="desktop"
				collapsed={collapsed}
				onToggle={onToggle}
			/>
		</aside>
	);
});

DesktopSidebar.displayName = "DesktopSidebar";

// ============================================================================
// Sidebar Content (Shared between mobile/desktop)
// ============================================================================

interface SidebarContentProps {
	pathname: string;
	variant: "mobile" | "desktop";
	collapsed?: boolean;
	onToggle?: () => void;
	onClose?: () => void;
}

const SidebarContent = React.memo(function SidebarContent({
	pathname,
	variant,
	collapsed = false,
	onToggle,
	onClose,
}: SidebarContentProps) {
	const isMobile = variant === "mobile";

	if (isMobile) {
		return (
			<>
				<SidebarHeader
					isMobile={true}
					onClose={onClose}
				/>
				<SidebarNavigation
					pathname={pathname}
					sections={NAV_SECTIONS}
					utilityItems={UTILITY_NAV_ITEMS}
					isMobile={true}
					onClose={onClose}
				/>
				<SidebarSecondary
					pathname={pathname}
					items={SECONDARY_NAV_ITEMS}
					isMobile={true}
					onClose={onClose}
				/>
			</>
		);
	}

	return (
		<>
			<SidebarHeader
				isMobile={false}
				collapsed={collapsed}
				onToggle={onToggle}
			/>
			<SidebarNavigation
				pathname={pathname}
				sections={NAV_SECTIONS}
				utilityItems={UTILITY_NAV_ITEMS}
				isMobile={false}
				collapsed={collapsed}
			/>
			<SidebarSecondary
				pathname={pathname}
				items={SECONDARY_NAV_ITEMS}
				isMobile={false}
				collapsed={collapsed}
			/>
		</>
	);
});

SidebarContent.displayName = "SidebarContent";

// ============================================================================
// Sidebar Header
// ============================================================================

interface SidebarHeaderProps {
	isMobile: boolean;
	collapsed?: boolean;
	onToggle?: () => void;
	onClose?: () => void;
}

const SidebarHeader = React.memo(function SidebarHeader({
	isMobile,
	collapsed,
	onToggle,
	onClose,
}: SidebarHeaderProps) {
	return (
		<div className="h-16 flex items-center justify-between px-4 border-b">
			<Link href="/" className="flex items-center gap-3 group">
				<div className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 flex-shrink-0">
					<Feather className="h-5 w-5 text-primary-foreground" />
				</div>
				{!collapsed && !isMobile && (
					<span className="font-semibold text-lg text-foreground tracking-tight">
						DocFusion
					</span>
				)}
				{isMobile && (
					<span className="font-semibold text-lg text-foreground">
						DocFusion
					</span>
				)}
			</Link>
			
			{!isMobile && onToggle && (
				<button
					onClick={onToggle}
					className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? (
						<PanelLeft className="h-4 w-4" />
					) : (
						<PanelLeftClose className="h-4 w-4" />
					)}
				</button>
			)}
			
			{isMobile && onClose && (
				<button
					onClick={onClose}
					className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					aria-label="Close menu"
				>
					<X className="h-5 w-5" />
				</button>
			)}
		</div>
	);
});

SidebarHeader.displayName = "SidebarHeader";

// ============================================================================
// Sidebar Navigation
// ============================================================================

interface SidebarNavigationProps {
	pathname: string;
	sections: NavSection[];
	utilityItems?: NavItem[];
	isMobile: boolean;
	collapsed?: boolean;
	onClose?: () => void;
}

const SidebarNavigation = React.memo(function SidebarNavigation({
	pathname,
	sections,
	utilityItems = [],
	isMobile,
	collapsed,
	onClose,
}: SidebarNavigationProps) {
	const handleNavClick = React.useCallback(() => {
		if (isMobile && onClose) {
			onClose();
		}
	}, [isMobile, onClose]);

	return (
		<nav className="flex-1 overflow-y-auto py-4 px-3">
			{/* Home link for mobile */}
			{isMobile && (
				<Link
					href="/home"
					className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all mb-2"
					onClick={handleNavClick}
				>
					<div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
						<Home className="h-5 w-5" />
					</div>
					<div className="flex-1">
						<div className="text-sm font-medium">Home</div>
						<div className="text-xs text-muted-foreground/70">Role work surface</div>
					</div>
				</Link>
			)}

			{isMobile && <div className="h-px bg-border my-2" />}

			{/* Workflow-Organized Navigation Sections */}
			<div className="space-y-4">
				{sections.map((section, sectionIndex) => (
					<div key={section.title}>
						{/* Section Header - only show when not collapsed */}
						{!collapsed && (
							<div className="px-3 mb-1.5">
								<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
									{section.title}
								</span>
							</div>
						)}
						{/* Collapsed mode: show divider between sections except first */}
						{collapsed && sectionIndex > 0 && (
							<div className="h-px bg-border/50 mx-2 mb-2" />
						)}
						{/* Section Items */}
						<div className="space-y-0.5">
							{section.items.map((item) => (
								<NavItemLink
									key={item.href}
									item={item}
									pathname={pathname}
									isMobile={isMobile}
									collapsed={collapsed}
									onClick={handleNavClick}
								/>
							))}
						</div>
					</div>
				))}
			</div>

			{/* Utility Items (Import, etc.) */}
			{utilityItems.length > 0 && (
				<div className="mt-4 pt-4 border-t border-border/50">
					{!collapsed && (
						<div className="px-3 mb-1.5">
							<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
								Utilities
							</span>
						</div>
					)}
					<div className="space-y-0.5">
						{utilityItems.map((item) => (
							<NavItemLink
								key={item.href}
								item={item}
								pathname={pathname}
								isMobile={isMobile}
								collapsed={collapsed}
								onClick={handleNavClick}
							/>
						))}
					</div>
				</div>
			)}
		</nav>
	);
});

SidebarNavigation.displayName = "SidebarNavigation";

// ============================================================================
// Navigation Item Link
// ============================================================================

interface NavItemLinkProps {
	item: NavItem;
	pathname: string;
	isMobile: boolean;
	collapsed?: boolean;
	onClick: () => void;
}

const NavItemLink = React.memo(function NavItemLink({
	item,
	pathname,
	isMobile,
	collapsed,
	onClick,
}: NavItemLinkProps) {
	const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

	return (
		<Link
			href={item.href}
			onClick={onClick}
			className={cn(
				"flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
				isActive
					? "bg-primary/10 text-primary"
					: "text-muted-foreground hover:text-foreground hover:bg-accent"
			)}
			title={!isMobile && collapsed ? item.label : undefined}
		>
			<div
				className={cn(
					"flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
					isActive ? "bg-primary/20" : "bg-muted group-hover:bg-accent"
				)}
			>
				<item.icon className="h-5 w-5" />
			</div>
			{!collapsed && (
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium">{item.label}</div>
					{item.description && (
						<div className="text-xs text-muted-foreground/70 truncate">
							{item.description}
						</div>
					)}
				</div>
			)}
			{isActive && !collapsed && (
				<div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
			)}
		</Link>
	);
});

NavItemLink.displayName = "NavItemLink";

// ============================================================================
// Sidebar Secondary Navigation
// ============================================================================

interface SidebarSecondaryProps {
	pathname: string;
	items: NavItem[];
	isMobile: boolean;
	collapsed?: boolean;
	onClose?: () => void;
}

const SidebarSecondary = React.memo(function SidebarSecondary({
	pathname,
	items,
	isMobile,
	collapsed,
	onClose,
}: SidebarSecondaryProps) {
	const handleNavClick = React.useCallback(() => {
		if (isMobile && onClose) {
			onClose();
		}
	}, [isMobile, onClose]);

	return (
		<div className="border-t py-4 px-3">
			<div className="space-y-1">
				{items.map((item) => {
					const isActive = pathname === item.href;
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
								isActive
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent"
							)}
							 onClick={handleNavClick}
							title={!isMobile && collapsed ? item.label : undefined}
						>
							<item.icon className="h-4 w-4 flex-shrink-0" />
							{!collapsed && (
								<span className="text-sm">{item.label}</span>
							)}
						</Link>
					);
				})}
			</div>
		</div>
	);
});

SidebarSecondary.displayName = "SidebarSecondary";

// ============================================================================
// Dashboard Top Bar
// ============================================================================

const DashboardTopBar = React.memo(function DashboardTopBar() {
	return (
		<header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
			<SearchBar />
			<div className="flex items-center gap-3">
				<NotificationBell />
				<UserMenu />
			</div>
		</header>
	);
});

DashboardTopBar.displayName = "DashboardTopBar";

// ============================================================================
// Search Bar
// ============================================================================

const SearchBar = React.memo(function SearchBar() {
	return (
		<div className="flex-1 max-w-xl">
			<div className="relative group">
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
				<input
					type="search"
					placeholder="Search documents, opportunities..."
					className="w-full h-10 pl-11 pr-20 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
				/>
				<kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-mono">
					<Command className="h-3 w-3" />K
				</kbd>
			</div>
		</div>
	);
});

SearchBar.displayName = "SearchBar";

// ============================================================================
// Notification Bell
// ============================================================================

const NotificationBell = React.memo(function NotificationBell() {
	const hasNotifications = true; // Get from real notification state

	return (
		<button 
			className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
			aria-label={hasNotifications ? "Notifications available" : "No notifications"}
		>
			<Bell className="h-5 w-5" />
			{hasNotifications && (
				<span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
			)}
		</button>
	);
});

NotificationBell.displayName = "NotificationBell";

// ============================================================================
// User Menu
// ============================================================================

function UserMenu() {
	const { theme, setTheme } = useTheme();
	const { data: session } = useSession();

	// Memoize user initials
	const userInitials = React.useMemo(() => {
		if (session?.user?.name) {
			return session.user.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);
		}
		if (session?.user?.email) {
			return session.user.email.slice(0, 2).toUpperCase();
		}
		return "??";
	}, [session?.user?.name, session?.user?.email]);

	const handleSignOut = React.useCallback(async () => {
		await signOut({ callbackUrl: "/auth/sign-in" });
	}, []);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button 
					className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-accent transition-colors"
					aria-label="User menu"
				>
					{session?.user?.image ? (
						<Image
							src={session.user.image}
							alt={session.user.name || "User"}
							className="w-8 h-8 rounded-lg object-cover"
							width={32}
							height={32}
							unoptimized
						/>
					) : (
						<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
							{userInitials}
						</div>
					)}
					<ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<div className="font-normal text-xs text-muted-foreground">Signed in as</div>
					<div className="font-medium truncate">{session?.user?.email || "Loading..."}</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<User className="mr-2 h-4 w-4" />
					Profile
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/settings">
						<Settings className="mr-2 h-4 w-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
				<DropdownMenuItem
					onClick={() => setTheme("light")}
					className={cn(theme === "light" && "bg-accent")}
				>
					<Sun className="mr-2 h-4 w-4" />
					Light
					{theme === "light" && <span className="ml-auto text-primary">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("dark")}
					className={cn(theme === "dark" && "bg-accent")}
				>
					<Moon className="mr-2 h-4 w-4" />
					Dark
					{theme === "dark" && <span className="ml-auto text-primary">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("system")}
					className={cn(theme === "system" && "bg-accent")}
				>
					<Monitor className="mr-2 h-4 w-4" />
					System
					{theme === "system" && <span className="ml-auto text-primary">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut}>
					<LogOut className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
