/**
 * Settings Content - DocFusion
 *
 * Client-side settings interface with all configuration sections.
 * Organization section incorporates company setup functionality.
 */

"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/lib/theme-provider";
import {
	Settings,
	User,
	Building2,
	Bell,
	Shield,
	Palette,
	Globe,
	Database,
	Check,
	Moon,
	Sun,
	Monitor,
	Key,
	Smartphone,
	Mail,
	Clock,
	AlertTriangle,
	Download,
	Trash2,
	RefreshCw,
	Copy,
	Eye,
	EyeOff,
	Plus,
	ExternalLink,
	Users,
	FileText,
	Briefcase,
	Package,
	Variable,
	LogOut,
	History,
	HardDrive,
	Webhook,
	Zap,
} from "lucide-react";

// Lazy load heavy organization components
const CompanyOverview = React.lazy(() =>
	import("@/components/company/CompanyOverview").then((m) => ({ default: m.CompanyOverview }))
);
const CompanyProfileForm = React.lazy(() =>
	import("@/components/company/CompanyProfileForm").then((m) => ({ default: m.CompanyProfileForm }))
);
const RolesManager = React.lazy(() =>
	import("@/components/company/RolesManager").then((m) => ({ default: m.RolesManager }))
);
const CVBuilder = React.lazy(() =>
	import("@/components/company/CVBuilder").then((m) => ({ default: m.CVBuilder }))
);
const ClientsList = React.lazy(() =>
	import("@/components/company/ClientsList").then((m) => ({ default: m.ClientsList }))
);
const ProductsServices = React.lazy(() =>
	import("@/components/company/ProductsServices").then((m) => ({ default: m.ProductsServices }))
);
const CustomVariables = React.lazy(() =>
	import("@/components/company/CustomVariables").then((m) => ({ default: m.CustomVariables }))
);

// ============================================================================
// Types
// ============================================================================

interface SettingsSection {
	id: string;
	icon: React.ElementType;
	title: string;
	description: string;
}

// ============================================================================
// Constants
// ============================================================================

const SETTINGS_SECTIONS: SettingsSection[] = [
	{
		id: "profile",
		icon: User,
		title: "Profile",
		description: "Your personal information and preferences",
	},
	{
		id: "organization",
		icon: Building2,
		title: "Organization",
		description: "Company profile, team, products, and services",
	},
	{
		id: "notifications",
		icon: Bell,
		title: "Notifications",
		description: "Email alerts, deadlines, and push notifications",
	},
	{
		id: "security",
		icon: Shield,
		title: "Security",
		description: "Password, two-factor auth, and active sessions",
	},
	{
		id: "appearance",
		icon: Palette,
		title: "Appearance",
		description: "Theme, display density, and visual preferences",
	},
	{
		id: "integrations",
		icon: Globe,
		title: "Integrations",
		description: "API keys, webhooks, and connected services",
	},
	{
		id: "data",
		icon: Database,
		title: "Data & Storage",
		description: "Export data, storage usage, and retention",
	},
];

// ============================================================================
// Main Component
// ============================================================================

export function SettingsContent() {
	const searchParams = useSearchParams();
	const sectionFromUrl = searchParams.get("section");
	const [activeSection, setActiveSection] = React.useState(
		sectionFromUrl && SETTINGS_SECTIONS.some((s) => s.id === sectionFromUrl)
			? sectionFromUrl
			: "profile"
	);

	return (
		<div className="h-full overflow-y-auto p-6 relative">
			{/* Page Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
				<p className="text-sm text-muted-foreground">
					Manage your account, organization, and application settings
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Sidebar Navigation */}
				<div className="lg:col-span-1">
					<nav className="space-y-1 sticky top-6">
						{SETTINGS_SECTIONS.map((section) => (
							<button
								key={section.id}
								onClick={() => setActiveSection(section.id)}
								className={cn(
									"w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
									activeSection === section.id
										? "bg-accent text-accent-foreground"
										: "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
								)}
							>
								<div
									className={cn(
										"w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
										activeSection === section.id
											? "bg-primary/10 text-primary"
											: "bg-muted"
									)}
								>
									<section.icon className="h-5 w-5" />
								</div>
								<div className="min-w-0">
									<span className="text-sm font-medium block">{section.title}</span>
									<span className="text-xs text-muted-foreground truncate block">
										{section.description}
									</span>
								</div>
							</button>
						))}
					</nav>
				</div>

				{/* Settings Content */}
				<div className="lg:col-span-3">
					<div className="rounded-xl border bg-card shadow-sm">
						{activeSection === "profile" && <ProfileSection />}
						{activeSection === "organization" && <OrganizationSection />}
						{activeSection === "notifications" && <NotificationsSection />}
						{activeSection === "security" && <SecuritySection />}
						{activeSection === "appearance" && <AppearanceSection />}
						{activeSection === "integrations" && <IntegrationsSection />}
						{activeSection === "data" && <DataSection />}
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Profile Section
// ============================================================================

function ProfileSection() {
	const [isSaving, setIsSaving] = React.useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		await new Promise((r) => setTimeout(r, 1000));
		setIsSaving(false);
	};

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground mb-1">Profile Information</h2>
				<p className="text-sm text-muted-foreground">
					Update your personal details and how others see you
				</p>
			</div>

			{/* Avatar */}
			<div className="flex items-center gap-6 pb-6 border-b">
				<div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-2xl font-semibold border-2 border-primary/20">
					JD
				</div>
				<div className="space-y-2">
					<Button variant="outline" size="sm">
						Change Avatar
					</Button>
					<p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
				</div>
			</div>

			{/* Form Fields */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Full Name
					</label>
					<Input type="text" defaultValue="John Doe" />
				</div>
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Email Address
					</label>
					<Input type="email" defaultValue="john.doe@example.com" />
				</div>
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Job Title
					</label>
					<Input type="text" defaultValue="Proposal Manager" />
				</div>
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Phone Number
					</label>
					<Input type="tel" placeholder="+1 (555) 000-0000" />
				</div>
				<div className="md:col-span-2">
					<label className="block text-sm font-medium text-foreground mb-2">
						Bio
					</label>
					<textarea
						rows={3}
						placeholder="Brief description for your profile..."
						className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
					/>
				</div>
			</div>

			{/* Save Button */}
			<div className="flex justify-end pt-4 border-t">
				<Button onClick={handleSave} disabled={isSaving}>
					{isSaving ? (
						<>
							<RefreshCw className="h-4 w-4 animate-spin" />
							Saving...
						</>
					) : (
						"Save Changes"
					)}
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Organization Section (Company Setup)
// ============================================================================

function OrganizationSection() {
	const [activeTab, setActiveTab] = React.useState("profile");

	return (
		<div className="p-6">
			<div className="mb-6">
				<h2 className="text-lg font-semibold text-foreground mb-1">Organization Settings</h2>
				<p className="text-sm text-muted-foreground">
					Manage your company profile, team roles, products, and services
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 gap-1 h-auto p-1">
					<TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs py-2">
						<Building2 className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Profile</span>
					</TabsTrigger>
					<TabsTrigger value="roles" className="flex items-center gap-1.5 text-xs py-2">
						<Users className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Roles</span>
					</TabsTrigger>
					<TabsTrigger value="cvs" className="flex items-center gap-1.5 text-xs py-2">
						<FileText className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">CVs</span>
					</TabsTrigger>
					<TabsTrigger value="clients" className="flex items-center gap-1.5 text-xs py-2">
						<Briefcase className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Clients</span>
					</TabsTrigger>
					<TabsTrigger value="products" className="flex items-center gap-1.5 text-xs py-2">
						<Package className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Products</span>
					</TabsTrigger>
					<TabsTrigger value="services" className="flex items-center gap-1.5 text-xs py-2">
						<Zap className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Services</span>
					</TabsTrigger>
					<TabsTrigger value="variables" className="flex items-center gap-1.5 text-xs py-2">
						<Variable className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Variables</span>
					</TabsTrigger>
				</TabsList>

				<Suspense fallback={<OrganizationSkeleton />}>
					<TabsContent value="profile" className="mt-0">
						<CompanyProfileForm />
					</TabsContent>

					<TabsContent value="roles" className="mt-0">
						<RolesPlaceholder />
					</TabsContent>

					<TabsContent value="cvs" className="mt-0">
						<CVsPlaceholder />
					</TabsContent>

					<TabsContent value="clients" className="mt-0">
						<ClientsPlaceholder />
					</TabsContent>

					<TabsContent value="products" className="mt-0">
						<ProductsPlaceholder />
					</TabsContent>

					<TabsContent value="services" className="mt-0">
						<ServicesPlaceholder />
					</TabsContent>

					<TabsContent value="variables" className="mt-0">
						<VariablesPlaceholder />
					</TabsContent>
				</Suspense>
			</Tabs>
		</div>
	);
}

function OrganizationSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-32" />
			<Skeleton className="h-64" />
		</div>
	);
}

// Placeholder components that load real data
function RolesPlaceholder() {
	return (
		<div className="rounded-lg border p-8 text-center">
			<Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">Team Roles</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Define roles and responsibilities for your team members
			</p>
			<Button variant="outline">
				<Plus className="h-4 w-4" />
				Add Role
			</Button>
		</div>
	);
}

function CVsPlaceholder() {
	return (
		<div className="rounded-lg border p-8 text-center">
			<FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">CV Builder</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Create and manage team member CVs for proposals
			</p>
			<Button variant="outline">
				<Plus className="h-4 w-4" />
				Create CV
			</Button>
		</div>
	);
}

function ClientsPlaceholder() {
	return (
		<div className="rounded-lg border p-8 text-center">
			<Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">Client Portfolio</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Track your clients and project history
			</p>
			<Button variant="outline">
				<Plus className="h-4 w-4" />
				Add Client
			</Button>
		</div>
	);
}

function ProductsPlaceholder() {
	return (
		<div className="rounded-lg border p-8 text-center">
			<Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">Products Catalog</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Define your product offerings for proposals
			</p>
			<Button variant="outline">
				<Plus className="h-4 w-4" />
				Add Product
			</Button>
		</div>
	);
}

function ServicesPlaceholder() {
	return (
		<div className="rounded-lg border p-8 text-center">
			<Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">Services Catalog</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Define your service offerings for proposals
			</p>
			<Button variant="outline">
				<Plus className="h-4 w-4" />
				Add Service
			</Button>
		</div>
	);
}

function VariablesPlaceholder() {
	return (
		<div className="rounded-lg border p-8 text-center">
			<Variable className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">Custom Variables</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Create reusable variables for document templates
			</p>
			<Button variant="outline">
				<Plus className="h-4 w-4" />
				Add Variable
			</Button>
		</div>
	);
}

// ============================================================================
// Notifications Section
// ============================================================================

function NotificationsSection() {
	const [emailNotifs, setEmailNotifs] = React.useState({
		deadlines: true,
		mentions: true,
		updates: false,
		marketing: false,
	});
	const [pushNotifs, setPushNotifs] = React.useState({
		deadlines: true,
		mentions: true,
		updates: true,
	});

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground mb-1">Notification Preferences</h2>
				<p className="text-sm text-muted-foreground">
					Choose how and when you want to be notified
				</p>
			</div>

			{/* Email Notifications */}
			<div className="space-y-4">
				<div className="flex items-center gap-3 pb-3 border-b">
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
						<Mail className="h-5 w-5 text-blue-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Email Notifications</h3>
						<p className="text-sm text-muted-foreground">Receive updates via email</p>
					</div>
				</div>

				<div className="space-y-3 pl-2">
					<NotificationToggle
						label="Deadline Reminders"
						description="Get notified 7, 3, and 1 day before deadlines"
						checked={emailNotifs.deadlines}
						onChange={(checked) => setEmailNotifs((p) => ({ ...p, deadlines: checked }))}
					/>
					<NotificationToggle
						label="Mentions & Comments"
						description="When someone mentions you or replies to your comments"
						checked={emailNotifs.mentions}
						onChange={(checked) => setEmailNotifs((p) => ({ ...p, mentions: checked }))}
					/>
					<NotificationToggle
						label="Document Updates"
						description="Changes to documents you're collaborating on"
						checked={emailNotifs.updates}
						onChange={(checked) => setEmailNotifs((p) => ({ ...p, updates: checked }))}
					/>
					<NotificationToggle
						label="Product Updates"
						description="News about new features and improvements"
						checked={emailNotifs.marketing}
						onChange={(checked) => setEmailNotifs((p) => ({ ...p, marketing: checked }))}
					/>
				</div>
			</div>

			{/* Push Notifications */}
			<div className="space-y-4 pt-4">
				<div className="flex items-center gap-3 pb-3 border-b">
					<div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
						<Bell className="h-5 w-5 text-purple-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Push Notifications</h3>
						<p className="text-sm text-muted-foreground">In-app and browser notifications</p>
					</div>
				</div>

				<div className="space-y-3 pl-2">
					<NotificationToggle
						label="Urgent Deadlines"
						description="Immediate alerts for deadlines within 24 hours"
						checked={pushNotifs.deadlines}
						onChange={(checked) => setPushNotifs((p) => ({ ...p, deadlines: checked }))}
					/>
					<NotificationToggle
						label="Direct Mentions"
						description="When someone @mentions you"
						checked={pushNotifs.mentions}
						onChange={(checked) => setPushNotifs((p) => ({ ...p, mentions: checked }))}
					/>
					<NotificationToggle
						label="Real-time Updates"
						description="Live updates while collaborating"
						checked={pushNotifs.updates}
						onChange={(checked) => setPushNotifs((p) => ({ ...p, updates: checked }))}
					/>
				</div>
			</div>

			{/* Quiet Hours */}
			<div className="pt-4 border-t">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
							<Clock className="h-5 w-5 text-amber-500" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">Quiet Hours</h3>
							<p className="text-sm text-muted-foreground">
								Pause notifications during set hours
							</p>
						</div>
					</div>
					<Button variant="outline" size="sm">
						Configure
					</Button>
				</div>
			</div>
		</div>
	);
}

function NotificationToggle({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between py-2">
			<div>
				<p className="text-sm font-medium text-foreground">{label}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<Switch checked={checked} onCheckedChange={onChange} />
		</div>
	);
}

// ============================================================================
// Security Section
// ============================================================================

function SecuritySection() {
	const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
	const [showNewPassword, setShowNewPassword] = React.useState(false);

	const sessions = [
		{ device: "Chrome on MacOS", location: "Nairobi, Kenya", current: true, lastActive: "Now" },
		{ device: "Safari on iPhone", location: "Nairobi, Kenya", current: false, lastActive: "2 hours ago" },
		{ device: "Firefox on Windows", location: "London, UK", current: false, lastActive: "3 days ago" },
	];

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground mb-1">Security Settings</h2>
				<p className="text-sm text-muted-foreground">
					Manage your password, authentication, and active sessions
				</p>
			</div>

			{/* Change Password */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
						<Key className="h-5 w-5 text-green-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Change Password</h3>
						<p className="text-sm text-muted-foreground">
							Update your password regularly for security
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
					<div className="relative">
						<label className="block text-sm font-medium text-foreground mb-2">
							Current Password
						</label>
						<div className="relative">
							<Input
								type={showCurrentPassword ? "text" : "password"}
								placeholder="Enter current password"
							/>
							<button
								type="button"
								onClick={() => setShowCurrentPassword(!showCurrentPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						</div>
					</div>
					<div className="relative">
						<label className="block text-sm font-medium text-foreground mb-2">
							New Password
						</label>
						<div className="relative">
							<Input
								type={showNewPassword ? "text" : "password"}
								placeholder="Enter new password"
							/>
							<button
								type="button"
								onClick={() => setShowNewPassword(!showNewPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						</div>
					</div>
				</div>
				<div className="pl-2">
					<Button size="sm">Update Password</Button>
				</div>
			</div>

			{/* Two-Factor Authentication */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
							<Smartphone className="h-5 w-5 text-blue-500" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">Two-Factor Authentication</h3>
							<p className="text-sm text-muted-foreground">
								Add an extra layer of security to your account
							</p>
						</div>
					</div>
					<Button variant="outline" size="sm">
						Enable 2FA
					</Button>
				</div>
			</div>

			{/* Active Sessions */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
							<History className="h-5 w-5 text-amber-500" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">Active Sessions</h3>
							<p className="text-sm text-muted-foreground">
								Devices currently logged into your account
							</p>
						</div>
					</div>
					<Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
						<LogOut className="h-4 w-4" />
						Sign Out All
					</Button>
				</div>

				<div className="space-y-3 pl-2">
					{sessions.map((session, i) => (
						<div
							key={i}
							className={cn(
								"flex items-center justify-between p-3 rounded-lg border",
								session.current && "border-primary/30 bg-primary/5"
							)}
						>
							<div className="flex items-center gap-3">
								<Monitor className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-sm font-medium text-foreground">
										{session.device}
										{session.current && (
											<span className="ml-2 text-xs text-primary">(This device)</span>
										)}
									</p>
									<p className="text-xs text-muted-foreground">
										{session.location} · {session.lastActive}
									</p>
								</div>
							</div>
							{!session.current && (
								<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
									Revoke
								</Button>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Appearance Section
// ============================================================================

function AppearanceSection() {
	const { theme, setTheme } = useTheme();

	const themes = [
		{ id: "light", icon: Sun, label: "Light", description: "Clean and bright" },
		{ id: "dark", icon: Moon, label: "Dark", description: "Easy on the eyes" },
		{ id: "system", icon: Monitor, label: "System", description: "Match your OS" },
	] as const;

	const densities = [
		{ id: "comfortable", label: "Comfortable", description: "More spacing, easier to read" },
		{ id: "compact", label: "Compact", description: "Fit more content on screen" },
	];

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground mb-1">Appearance Settings</h2>
				<p className="text-sm text-muted-foreground">
					Customize how DocFusion looks and feels
				</p>
			</div>

			{/* Theme Selection */}
			<div className="space-y-4">
				<div className="flex items-center gap-3 pb-3 border-b">
					<div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
						<Palette className="h-5 w-5 text-purple-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Theme</h3>
						<p className="text-sm text-muted-foreground">Select your preferred color scheme</p>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					{themes.map((option) => (
						<button
							key={option.id}
							onClick={() => setTheme(option.id)}
							className={cn(
								"flex flex-col items-center gap-3 p-4 rounded-xl border transition-all",
								theme === option.id
									? "border-primary bg-primary/5 ring-1 ring-primary/20"
									: "border-input bg-background hover:bg-accent hover:border-accent-foreground/20"
							)}
						>
							<div
								className={cn(
									"w-12 h-12 rounded-xl flex items-center justify-center",
									theme === option.id ? "bg-primary/10" : "bg-muted"
								)}
							>
								<option.icon className={cn("w-6 h-6", theme === option.id && "text-primary")} />
							</div>
							<div className="text-center">
								<p className="text-sm font-medium">{option.label}</p>
								<p className="text-xs text-muted-foreground">{option.description}</p>
							</div>
							{theme === option.id && (
								<Check className="h-4 w-4 text-primary" />
							)}
						</button>
					))}
				</div>
			</div>

			{/* Display Density */}
			<div className="space-y-4 pt-4">
				<div className="flex items-center gap-3 pb-3 border-b">
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
						<Settings className="h-5 w-5 text-blue-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Display Density</h3>
						<p className="text-sm text-muted-foreground">Adjust spacing and content density</p>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{densities.map((option) => (
						<button
							key={option.id}
							className={cn(
								"flex items-center justify-between p-4 rounded-xl border transition-all text-left",
								option.id === "comfortable"
									? "border-primary bg-primary/5"
									: "border-input bg-background hover:bg-accent"
							)}
						>
							<div>
								<p className="text-sm font-medium">{option.label}</p>
								<p className="text-xs text-muted-foreground">{option.description}</p>
							</div>
							{option.id === "comfortable" && <Check className="h-4 w-4 text-primary" />}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Integrations Section
// ============================================================================

function IntegrationsSection() {
	const [showApiKey, setShowApiKey] = React.useState(false);
	const apiKey = "dk_live_abc123xyz789...";

	const integrations = [
		{ name: "Google Workspace", icon: "🔗", status: "connected", description: "Sync documents and calendar" },
		{ name: "Microsoft 365", icon: "📎", status: "available", description: "Import Word and Excel files" },
		{ name: "Slack", icon: "💬", status: "available", description: "Send notifications to channels" },
		{ name: "Salesforce", icon: "☁️", status: "available", description: "Sync opportunities and contacts" },
	];

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground mb-1">Integrations</h2>
				<p className="text-sm text-muted-foreground">
					Connect external services and manage API access
				</p>
			</div>

			{/* API Keys */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
						<Key className="h-5 w-5 text-green-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">API Keys</h3>
						<p className="text-sm text-muted-foreground">
							Manage keys for programmatic access
						</p>
					</div>
				</div>

				<div className="space-y-3 pl-2">
					<div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
						<div className="flex-1 font-mono text-sm">
							{showApiKey ? apiKey : "dk_live_•••••••••••••••"}
						</div>
						<button
							onClick={() => setShowApiKey(!showApiKey)}
							className="p-2 hover:bg-accent rounded-md transition-colors"
						>
							{showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						</button>
						<button className="p-2 hover:bg-accent rounded-md transition-colors">
							<Copy className="h-4 w-4" />
						</button>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm">
							<RefreshCw className="h-4 w-4" />
							Regenerate
						</Button>
						<Button variant="outline" size="sm">
							<Plus className="h-4 w-4" />
							New Key
						</Button>
					</div>
				</div>
			</div>

			{/* Webhooks */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
							<Webhook className="h-5 w-5 text-purple-500" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">Webhooks</h3>
							<p className="text-sm text-muted-foreground">
								Receive real-time event notifications
							</p>
						</div>
					</div>
					<Button variant="outline" size="sm">
						<Plus className="h-4 w-4" />
						Add Webhook
					</Button>
				</div>

				<div className="pl-2 text-sm text-muted-foreground">
					No webhooks configured. Add one to receive notifications when events occur.
				</div>
			</div>

			{/* Connected Services */}
			<div className="space-y-4">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
						<Globe className="h-5 w-5 text-blue-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Connected Services</h3>
						<p className="text-sm text-muted-foreground">
							Third-party apps connected to your account
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
					{integrations.map((integration) => (
						<div
							key={integration.name}
							className="flex items-center justify-between p-4 rounded-lg border"
						>
							<div className="flex items-center gap-3">
								<span className="text-2xl">{integration.icon}</span>
								<div>
									<p className="text-sm font-medium">{integration.name}</p>
									<p className="text-xs text-muted-foreground">{integration.description}</p>
								</div>
							</div>
							{integration.status === "connected" ? (
								<span className="text-xs text-green-500 font-medium">Connected</span>
							) : (
								<Button variant="ghost" size="sm">
									Connect
								</Button>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Data Section
// ============================================================================

function DataSection() {
	const storageUsed = 2.4; // GB
	const storageTotal = 10; // GB
	const storagePercent = (storageUsed / storageTotal) * 100;

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground mb-1">Data & Storage</h2>
				<p className="text-sm text-muted-foreground">
					Manage your data, exports, and storage usage
				</p>
			</div>

			{/* Storage Usage */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
						<HardDrive className="h-5 w-5 text-blue-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Storage Usage</h3>
						<p className="text-sm text-muted-foreground">
							{storageUsed} GB of {storageTotal} GB used
						</p>
					</div>
				</div>

				<div className="pl-2 space-y-3">
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary rounded-full transition-all"
							style={{ width: `${storagePercent}%` }}
						/>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>Documents: 1.2 GB</span>
						<span>Templates: 0.8 GB</span>
						<span>Attachments: 0.4 GB</span>
					</div>
				</div>
			</div>

			{/* Export Data */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
						<Download className="h-5 w-5 text-green-500" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Export Data</h3>
						<p className="text-sm text-muted-foreground">
							Download a copy of your data
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
					<Button variant="outline" className="justify-start">
						<Download className="h-4 w-4" />
						Export Opportunities (CSV)
					</Button>
					<Button variant="outline" className="justify-start">
						<Download className="h-4 w-4" />
						Export Contacts (CSV)
					</Button>
					<Button variant="outline" className="justify-start">
						<Download className="h-4 w-4" />
						Export Documents (ZIP)
					</Button>
					<Button variant="outline" className="justify-start">
						<Download className="h-4 w-4" />
						Export All Data
					</Button>
				</div>
			</div>

			{/* Data Retention */}
			<div className="space-y-4 pb-6 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
							<Clock className="h-5 w-5 text-amber-500" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">Data Retention</h3>
							<p className="text-sm text-muted-foreground">
								How long we keep your deleted data
							</p>
						</div>
					</div>
					<span className="text-sm text-muted-foreground">30 days</span>
				</div>
			</div>

			{/* Danger Zone */}
			<div className="space-y-4">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
						<AlertTriangle className="h-5 w-5 text-destructive" />
					</div>
					<div>
						<h3 className="font-medium text-foreground">Danger Zone</h3>
						<p className="text-sm text-muted-foreground">
							Irreversible actions for your account
						</p>
					</div>
				</div>

				<div className="pl-2 space-y-3">
					<div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
						<div>
							<p className="text-sm font-medium text-foreground">Delete All Data</p>
							<p className="text-xs text-muted-foreground">
								Permanently remove all your documents and data
							</p>
						</div>
						<Button variant="danger" size="sm">
							<Trash2 className="h-4 w-4" />
							Delete
						</Button>
					</div>
					<div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
						<div>
							<p className="text-sm font-medium text-foreground">Delete Account</p>
							<p className="text-xs text-muted-foreground">
								Permanently delete your account and all associated data
							</p>
						</div>
						<Button variant="danger" size="sm">
							<Trash2 className="h-4 w-4" />
							Delete
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
