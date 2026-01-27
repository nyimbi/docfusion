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
		<div className="min-h-screen bg-[var(--background)]">
			{/* Ambient Background - only visible in dark mode */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden dark:block hidden">
				<div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[var(--accent-500)]/3 rounded-full blur-[150px]" />
				<div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[var(--info-500)]/3 rounded-full blur-[150px]" />
			</div>

			{/* Mobile Header */}
			<header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-[var(--ink-800)]/50 bg-[var(--ink-950)]/90 backdrop-blur-xl">
				<div className="flex items-center justify-between h-full px-4">
					<button
						onClick={() => setMobileMenuOpen(true)}
						className="p-2 rounded-lg text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50 transition-colors"
					>
						<Menu className="h-5 w-5" />
					</button>

					<Link href="/" className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center">
							<FileText className="h-4 w-4 text-white" />
						</div>
						<span className="font-semibold text-[var(--ink-100)]">DocFusion</span>
					</Link>

					<UserMenu />
				</div>
			</header>

			{/* Mobile Sidebar Overlay */}
			{mobileMenuOpen && (
				<>
					<div
						className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
						onClick={() => setMobileMenuOpen(false)}
					/>
					<aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[var(--ink-900)] border-r border-[var(--ink-800)]/50">
						<MobileSidebar
							pathname={pathname}
							onClose={() => setMobileMenuOpen(false)}
						/>
					</aside>
				</>
			)}

			{/* Desktop Sidebar */}
			<aside
				className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-[var(--ink-800)]/50 bg-[var(--ink-900)]/80 backdrop-blur-xl transition-all duration-300 ${
					sidebarCollapsed ? "w-20" : "w-64"
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
				className={`relative min-h-screen transition-all duration-300 ${
					sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
				} pt-16 lg:pt-0`}
			>
				{/* Top Bar */}
				<header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-between gap-4 border-b border-[var(--ink-800)]/50 bg-[var(--ink-950)]/80 backdrop-blur-xl px-6">
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
			<div className="h-16 flex items-center justify-between px-4 border-b border-[var(--ink-800)]/50">
				<Link href="/" className="flex items-center gap-3 group">
					<div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-400)] via-[var(--accent-500)] to-[var(--accent-600)] flex items-center justify-center shadow-[0_4px_16px_-2px_rgba(224,153,21,0.4)] flex-shrink-0">
						<FileText className="h-5 w-5 text-white" />
					</div>
					{!collapsed && (
						<span className="font-semibold text-lg text-[var(--ink-100)] tracking-tight">
							DocFusion
						</span>
					)}
				</Link>
				<button
					onClick={onToggleCollapse}
					className="p-2 rounded-lg text-[var(--ink-500)] hover:text-[var(--ink-300)] hover:bg-[var(--ink-800)]/50 transition-colors"
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
								className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
									isActive
										? "bg-[var(--accent-500)]/15 text-[var(--accent-400)]"
										: "text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50"
								}`}
								title={collapsed ? item.label : undefined}
							>
								<div
									className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
										isActive
											? "bg-[var(--accent-500)]/20"
											: "bg-[var(--ink-800)]/50 group-hover:bg-[var(--ink-800)]"
									}`}
								>
									<item.icon className="h-5 w-5" />
								</div>
								{!collapsed && (
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium">{item.label}</div>
										<div className="text-xs text-[var(--ink-500)] truncate">
											{item.description}
										</div>
									</div>
								)}
								{isActive && !collapsed && (
									<div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-400)]" />
								)}
							</Link>
						);
					})}
				</div>
			</nav>

			{/* Secondary Navigation */}
			<div className="border-t border-[var(--ink-800)]/50 py-4 px-3">
				<div className="space-y-1">
					{secondaryNav.map((item) => {
						const isActive = pathname === item.href;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
									isActive
										? "text-[var(--ink-100)] bg-[var(--ink-800)]/50"
										: "text-[var(--ink-500)] hover:text-[var(--ink-300)] hover:bg-[var(--ink-800)]/30"
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
			<div className="h-16 flex items-center justify-between px-4 border-b border-[var(--ink-800)]/50">
				<Link href="/" className="flex items-center gap-3" onClick={onClose}>
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center">
						<FileText className="h-5 w-5 text-white" />
					</div>
					<span className="font-semibold text-lg text-[var(--ink-100)]">
						DocFusion
					</span>
				</Link>
				<button
					onClick={onClose}
					className="p-2 rounded-lg text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50 transition-colors"
				>
					<X className="h-5 w-5" />
				</button>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto py-4 px-3">
				<Link
					href="/"
					className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50 transition-all mb-2"
					onClick={onClose}
				>
					<div className="w-9 h-9 rounded-lg bg-[var(--ink-800)]/50 flex items-center justify-center">
						<Home className="h-5 w-5" />
					</div>
					<div className="flex-1">
						<div className="text-sm font-medium">Home</div>
						<div className="text-xs text-[var(--ink-500)]">Back to homepage</div>
					</div>
				</Link>

				<div className="h-px bg-[var(--ink-800)]/50 my-2" />

				<div className="space-y-1">
					{primaryNav.map((item) => {
						const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
									isActive
										? "bg-[var(--accent-500)]/15 text-[var(--accent-400)]"
										: "text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50"
								}`}
								onClick={onClose}
							>
								<div
									className={`w-9 h-9 rounded-lg flex items-center justify-center ${
										isActive
											? "bg-[var(--accent-500)]/20"
											: "bg-[var(--ink-800)]/50"
									}`}
								>
									<item.icon className="h-5 w-5" />
								</div>
								<div className="flex-1">
									<div className="text-sm font-medium">{item.label}</div>
									<div className="text-xs text-[var(--ink-500)]">
										{item.description}
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			</nav>

			{/* Secondary */}
			<div className="border-t border-[var(--ink-800)]/50 py-4 px-3">
				<div className="space-y-1">
					{secondaryNav.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className="flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--ink-500)] hover:text-[var(--ink-300)] hover:bg-[var(--ink-800)]/30 transition-colors"
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
				<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-500)] group-focus-within:text-[var(--ink-300)] transition-colors" />
				<input
					type="text"
					placeholder="Search documents, opportunities..."
					className="w-full h-10 pl-11 pr-20 rounded-xl bg-[var(--ink-900)]/50 border border-[var(--ink-800)]/50 text-[var(--ink-100)] placeholder:text-[var(--ink-500)] text-sm focus:outline-none focus:border-[var(--accent-500)]/50 focus:ring-1 focus:ring-[var(--accent-500)]/30 transition-all"
				/>
				<kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--ink-800)] text-[var(--ink-500)] text-xs font-mono">
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
		<button className="relative p-2 rounded-lg text-[var(--ink-400)] hover:text-[var(--ink-100)] hover:bg-[var(--ink-800)]/50 transition-colors">
			<Bell className="h-5 w-5" />
			{hasNotifications && (
				<span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent-500)]" />
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
				<button className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-[var(--border)]/50 transition-colors">
					{session?.user?.image ? (
						<img
							src={session.user.image}
							alt={session.user.name || "User"}
							className="w-8 h-8 rounded-lg object-cover"
						/>
					) : (
						<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center text-white text-sm font-medium">
							{userInitials}
						</div>
					)}
					<ChevronDown className="hidden sm:block h-4 w-4 text-[var(--foreground-muted)]" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56 bg-[var(--background-subtle)] border-[var(--border)] text-[var(--foreground)]"
			>
				<DropdownMenuLabel className="text-[var(--foreground)]">
					<div className="font-normal text-xs text-[var(--foreground-muted)]">Signed in as</div>
					<div className="font-medium truncate">{session?.user?.email || "Loading..."}</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator className="bg-[var(--border)]" />
				<DropdownMenuItem className="text-[var(--foreground-muted)] focus:bg-[var(--background-muted)] focus:text-[var(--foreground)]">
					<User className="mr-2 h-4 w-4" />
					Profile
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/settings" className="text-[var(--foreground-muted)] focus:bg-[var(--background-muted)] focus:text-[var(--foreground)]">
						<Settings className="mr-2 h-4 w-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator className="bg-[var(--border)]" />
				<DropdownMenuLabel className="text-[var(--foreground-subtle)] text-xs">Theme</DropdownMenuLabel>
				<DropdownMenuItem
					onClick={() => setTheme("light")}
					className="text-[var(--foreground-muted)] focus:bg-[var(--background-muted)] focus:text-[var(--foreground)]"
				>
					<Sun className="mr-2 h-4 w-4" />
					Light
					{theme === "light" && <span className="ml-auto text-[var(--accent-500)]">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("dark")}
					className="text-[var(--foreground-muted)] focus:bg-[var(--background-muted)] focus:text-[var(--foreground)]"
				>
					<Moon className="mr-2 h-4 w-4" />
					Dark
					{theme === "dark" && <span className="ml-auto text-[var(--accent-500)]">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("system")}
					className="text-[var(--foreground-muted)] focus:bg-[var(--background-muted)] focus:text-[var(--foreground)]"
				>
					<Monitor className="mr-2 h-4 w-4" />
					System
					{theme === "system" && <span className="ml-auto text-[var(--accent-500)]">✓</span>}
				</DropdownMenuItem>
				<DropdownMenuSeparator className="bg-[var(--border)]" />
				<DropdownMenuItem
					onClick={handleSignOut}
					className="text-[var(--foreground-muted)] focus:bg-[var(--background-muted)] focus:text-[var(--foreground)]"
				>
					<LogOut className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
