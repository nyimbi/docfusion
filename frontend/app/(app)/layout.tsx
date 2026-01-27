/**
 * App Layout Shell
 *
 * Shared layout for all interior application pages (documents, opportunities, etc.)
 * Provides consistent navigation, sidebar, and app-wide context.
 *
 * Aesthetic: "Command Center Elegance"
 * - Dark, professional environment
 * - Fixed sidebar with navigation
 * - Ambient glows for visual depth
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

// Navigation items configuration
const primaryNav = [
	{
		label: "Documents",
		href: "/documents",
		icon: FileText,
		description: "Manage proposals and content",
	},
	{
		label: "Opportunities",
		href: "/opportunities",
		icon: Target,
		description: "Track RFPs and bids",
	},
	{
		label: "Templates",
		href: "/templates",
		icon: LayoutTemplate,
		description: "Reusable document templates",
	},
	{
		label: "Calendar",
		href: "/calendar",
		icon: Calendar,
		description: "Deadlines and milestones",
	},
	{
		label: "Partners",
		href: "/partners",
		icon: Users,
		description: "Team and collaborators",
	},
];

const secondaryNav = [
	{ label: "Settings", href: "/settings", icon: Settings },
	{ label: "Help", href: "/help", icon: HelpCircle },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

	return (
		<div className="min-h-screen bg-background">
			{/* Mobile Header */}
			<header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-center justify-between h-full px-4">
					<button
						onClick={() => setMobileMenuOpen(true)}
						className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					>
						<Menu className="h-5 w-5" />
					</button>

					<Link href="/" className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
							<FileText className="h-4 w-4 text-primary-foreground" />
						</div>
						<span className="font-semibold text-foreground">DocFusion</span>
					</Link>

					<UserMenu />
				</div>
			</header>

			{/* Mobile Sidebar Overlay */}
			{mobileMenuOpen && (
				<>
					<div
						className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
						onClick={() => setMobileMenuOpen(false)}
					/>
					<aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r">
						<MobileSidebar
							pathname={pathname}
							onClose={() => setMobileMenuOpen(false)}
						/>
					</aside>
				</>
			)}

			{/* Desktop Sidebar */}
			<aside
				className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r bg-card transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"
					}`}
			>
				<DesktopSidebar
					pathname={pathname}
					collapsed={sidebarCollapsed}
					onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
				/>
			</aside>

			{/* Main Content Area */}
			<main
				className={`relative min-h-screen transition-all duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
					} pt-16 lg:pt-0 bg-secondary/20`}
			>
				{/* Top Bar */}
				<header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
					<SearchBar />
					<div className="flex items-center gap-3">
						<NotificationBell />
						<UserMenu />
					</div>
				</header>

				{/* Page Content */}
				<div className="relative px-6 py-6 lg:px-8">{children}</div>
			</main>
		</div>
	);
}

// ============================================================================
// Desktop Sidebar
// ============================================================================

function DesktopSidebar({
	pathname,
	collapsed,
	onToggleCollapse,
}: {
	pathname: string;
	collapsed: boolean;
	onToggleCollapse: () => void;
}) {
	return (
		<>
			{/* Logo */}
			<div className="h-16 flex items-center justify-between px-4 border-b">
				<Link href="/" className="flex items-center gap-3 group">
					<div className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 flex-shrink-0">
						<FileText className="h-5 w-5 text-primary-foreground" />
					</div>
					{!collapsed && (
						<span className="font-semibold text-lg text-foreground tracking-tight">
							DocFusion
						</span>
					)}
				</Link>
				<button
					onClick={onToggleCollapse}
					className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? (
						<PanelLeft className="h-4 w-4" />
					) : (
						<PanelLeftClose className="h-4 w-4" />
					)}
				</button>
			</div>

			{/* Primary Navigation */}
			<nav className="flex-1 overflow-y-auto py-4 px-3">
				<div className="space-y-1">
					{primaryNav.map((item) => {
						const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground hover:bg-accent"
									}`}
								title={collapsed ? item.label : undefined}
							>
								<div
									className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isActive
										? "bg-primary/20"
										: "bg-muted group-hover:bg-accent"
										}`}
								>
									<item.icon className="h-5 w-5" />
								</div>
								{!collapsed && (
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium">{item.label}</div>
										<div className="text-xs text-muted-foreground/70 truncate">
											{item.description}
										</div>
									</div>
								)}
								{isActive && !collapsed && (
									<div className="w-1.5 h-1.5 rounded-full bg-primary" />
								)}
							</Link>
						);
					})}
				</div>
			</nav>

			{/* Secondary Navigation */}
			<div className="border-t py-4 px-3">
				<div className="space-y-1">
					{secondaryNav.map((item) => {
						const isActive = pathname === item.href;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
									? "text-foreground bg-accent"
									: "text-muted-foreground hover:text-foreground hover:bg-accent"
									}`}
								title={collapsed ? item.label : undefined}
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
		</>
	);
}

// ============================================================================
// Mobile Sidebar
// ============================================================================

function MobileSidebar({
	pathname,
	onClose,
}: {
	pathname: string;
	onClose: () => void;
}) {
	return (
		<>
			{/* Header */}
			<div className="h-16 flex items-center justify-between px-4 border-b">
				<Link href="/" className="flex items-center gap-3" onClick={onClose}>
					<div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
						<FileText className="h-5 w-5 text-primary-foreground" />
					</div>
					<span className="font-semibold text-lg text-foreground">
						DocFusion
					</span>
				</Link>
				<button
					onClick={onClose}
					className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
				>
					<X className="h-5 w-5" />
				</button>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto py-4 px-3">
				<Link
					href="/"
					className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all mb-2"
					onClick={onClose}
				>
					<div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
						<Home className="h-5 w-5" />
					</div>
					<div className="flex-1">
						<div className="text-sm font-medium">Home</div>
						<div className="text-xs text-muted-foreground">Back to homepage</div>
					</div>
				</Link>

				<div className="h-px bg-border my-2" />

				<div className="space-y-1">
					{primaryNav.map((item) => {
						const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground hover:bg-accent"
									}`}
								onClick={onClose}
							>
								<div
									className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive
										? "bg-primary/20"
										: "bg-muted"
										}`}
								>
									<item.icon className="h-5 w-5" />
								</div>
								<div className="flex-1">
									<div className="text-sm font-medium">{item.label}</div>
									<div className="text-xs text-muted-foreground/70">
										{item.description}
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			</nav>

			{/* Secondary */}
			<div className="border-t py-4 px-3">
				<div className="space-y-1">
					{secondaryNav.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							onClick={onClose}
						>
							<item.icon className="h-4 w-4" />
							<span className="text-sm">{item.label}</span>
						</Link>
					))}
				</div>
			</div>
		</>
	);
}

// ============================================================================
// Search Bar
// ============================================================================

function SearchBar() {
	return (
		<div className="flex-1 max-w-xl">
			<div className="relative group">
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
				<input
					type="text"
					placeholder="Search documents, opportunities..."
					className="w-full h-10 pl-11 pr-20 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
				/>
				<kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-mono">
					<Command className="h-3 w-3" />K
				</kbd>
			</div>
		</div>
	);
}

// ============================================================================
// Notification Bell
// ============================================================================

function NotificationBell() {
	const hasNotifications = true;

	return (
		<button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
			<Bell className="h-5 w-5" />
			{hasNotifications && (
				<span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
			)}
		</button>
	);
}

// ============================================================================
// User Menu
// ============================================================================

function UserMenu() {
	const { theme, setTheme } = useTheme();
	const { data: session } = useSession();
	const router = useRouter();

	// Get user initials from name or email
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

	const handleSignOut = async () => {
		await signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/auth/sign-in");
				},
			},
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-accent transition-colors">
					{session?.user?.image ? (
						<img
							src={session.user.image}
							alt={session.user.name || "User"}
							className="w-8 h-8 rounded-lg object-cover"
						/>
					) : (
						<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
							{userInitials}
						</div>
					)}
					<ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56"
			>
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
				>
					<Sun className="mr-2 h-4 w-4" />
					Light
					{theme === "light" && <span className="ml-auto text-primary">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("dark")}
				>
					<Moon className="mr-2 h-4 w-4" />
					Dark
					{theme === "dark" && <span className="ml-auto text-primary">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("system")}
				>
					<Monitor className="mr-2 h-4 w-4" />
					System
					{theme === "system" && <span className="ml-auto text-primary">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleSignOut}
				>
					<LogOut className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
