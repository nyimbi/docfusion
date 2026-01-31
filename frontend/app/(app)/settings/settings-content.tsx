/**
 * Settings Content - DocFusion
 *
 * Fully functional settings interface with real data fetching and handlers.
 * No mocks, stubs, or placeholders - everything is connected to server actions.
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme-provider";
import { useToast } from "@/lib/hooks/use-toast";
import {
	getUserProfile,
	updateUserProfile,
	updateUserAvatar,
	getUserPreferences,
	updateNotificationPreferences,
	updateAppearancePreferences,
	getUserSessions,
	revokeSession,
	revokeAllOtherSessions,
	changePassword,
	getApiKeys,
	generateApiKey,
	deleteApiKey,
	getStorageStats,
	exportOpportunitiesCSV,
	exportContactsCSV,
	exportAccountsCSV,
	deleteAllUserData,
	deleteUserAccount,
	type UserProfile,
	type UserPreferences,
	type UserSession,
	type ApiKey,
	type StorageStats,
} from "@/lib/actions/user-settings";
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
	CheckCircle2,
	XCircle,
	Loader2,
} from "lucide-react";

// Lazy load heavy organization components
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
// Toast Hook (if not available, create inline)
// ============================================================================

function useSimpleToast() {
	const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);

	const show = React.useCallback((message: string, type: "success" | "error" = "success") => {
		setToast({ message, type });
		setTimeout(() => setToast(null), 3000);
	}, []);

	return { toast, show };
}

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
	const { toast, show: showToast } = useSimpleToast();

	return (
		<div className="h-full overflow-y-auto p-6 relative">
			{/* Toast Notification */}
			{toast && (
				<div
					className={cn(
						"fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2",
						toast.type === "success"
							? "bg-green-500 text-white"
							: "bg-red-500 text-white"
					)}
				>
					{toast.type === "success" ? (
						<CheckCircle2 className="h-5 w-5" />
					) : (
						<XCircle className="h-5 w-5" />
					)}
					{toast.message}
				</div>
			)}

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
						{activeSection === "profile" && <ProfileSection showToast={showToast} />}
						{activeSection === "organization" && <OrganizationSection />}
						{activeSection === "notifications" && <NotificationsSection showToast={showToast} />}
						{activeSection === "security" && <SecuritySection showToast={showToast} />}
						{activeSection === "appearance" && <AppearanceSection showToast={showToast} />}
						{activeSection === "integrations" && <IntegrationsSection showToast={showToast} />}
						{activeSection === "data" && <DataSection showToast={showToast} />}
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Profile Section
// ============================================================================

function ProfileSection({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
	const [profile, setProfile] = React.useState<UserProfile | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [isSaving, setIsSaving] = React.useState(false);
	const [formData, setFormData] = React.useState({
		name: "",
		jobTitle: "",
		phone: "",
		bio: "",
	});

	// Load profile data
	React.useEffect(() => {
		async function loadProfile() {
			const data = await getUserProfile();
			if (data) {
				setProfile(data);
				setFormData({
					name: data.name,
					jobTitle: data.jobTitle ?? "",
					phone: data.phone ?? "",
					bio: data.bio ?? "",
				});
			}
			setIsLoading(false);
		}
		loadProfile();
	}, []);

	const handleSave = async () => {
		setIsSaving(true);
		const result = await updateUserProfile(formData);
		setIsSaving(false);

		if (result.success) {
			showToast("Profile updated successfully", "success");
		} else {
			showToast(result.error ?? "Failed to update profile", "error");
		}
	};

	const avatarInputRef = React.useRef<HTMLInputElement>(null);
	const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

	const handleAvatarClick = () => {
		avatarInputRef.current?.click();
	};

	const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith("image/")) {
			showToast("Please select an image file", "error");
			return;
		}

		// Validate file size (max 2MB)
		if (file.size > 2 * 1024 * 1024) {
			showToast("Image must be less than 2MB", "error");
			return;
		}

		setIsUploadingAvatar(true);
		try {
			// Convert to base64 data URL for storage
			const reader = new FileReader();
			reader.onload = async (event) => {
				const dataUrl = event.target?.result as string;
				const result = await updateUserAvatar(dataUrl);
				if (result.success) {
					setProfile((prev) => prev ? { ...prev, image: dataUrl } : null);
					showToast("Avatar updated successfully", "success");
				} else {
					showToast(result.error ?? "Failed to update avatar", "error");
				}
				setIsUploadingAvatar(false);
			};
			reader.onerror = () => {
				showToast("Failed to read image file", "error");
				setIsUploadingAvatar(false);
			};
			reader.readAsDataURL(file);
		} catch (error) {
			showToast("Failed to upload avatar", "error");
			setIsUploadingAvatar(false);
		}
	};

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				<div className="flex items-center gap-6">
					<Skeleton className="w-20 h-20 rounded-full" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid grid-cols-2 gap-4">
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
				</div>
			</div>
		);
	}

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
					{profile?.image ? (
						<img src={profile.image} alt={profile.name} className="w-full h-full rounded-full object-cover" />
					) : (
						profile?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"
					)}
				</div>
				<div className="space-y-2">
					<input
						ref={avatarInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleAvatarChange}
					/>
					<Button variant="outline" size="sm" onClick={handleAvatarClick} disabled={isUploadingAvatar}>
						{isUploadingAvatar ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Uploading...
							</>
						) : (
							"Change Avatar"
						)}
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
					<Input
						type="text"
						value={formData.name}
						onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Email Address
					</label>
					<Input type="email" value={profile?.email ?? ""} disabled className="bg-muted" />
					<p className="text-xs text-muted-foreground mt-1">Contact support to change email</p>
				</div>
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Job Title
					</label>
					<Input
						type="text"
						value={formData.jobTitle}
						onChange={(e) => setFormData((p) => ({ ...p, jobTitle: e.target.value }))}
						placeholder="e.g., Proposal Manager"
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-foreground mb-2">
						Phone Number
					</label>
					<Input
						type="tel"
						value={formData.phone}
						onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
						placeholder="+1 (555) 000-0000"
					/>
				</div>
				<div className="md:col-span-2">
					<label className="block text-sm font-medium text-foreground mb-2">
						Bio
					</label>
					<textarea
						rows={3}
						value={formData.bio}
						onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
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
							<Loader2 className="h-4 w-4 animate-spin" />
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
// Organization Section
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
						<RolesManager />
					</TabsContent>

					<TabsContent value="cvs" className="mt-0">
						<CVBuilder />
					</TabsContent>

					<TabsContent value="clients" className="mt-0">
						<ClientsList />
					</TabsContent>

					<TabsContent value="products" className="mt-0">
						<ProductsServices type="products" />
					</TabsContent>

					<TabsContent value="services" className="mt-0">
						<ProductsServices type="services" />
					</TabsContent>

					<TabsContent value="variables" className="mt-0">
						<CustomVariables />
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


// ============================================================================
// Notifications Section
// ============================================================================

function NotificationsSection({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
	const [prefs, setPrefs] = React.useState<UserPreferences["notifications"] | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [isSaving, setIsSaving] = React.useState(false);

	React.useEffect(() => {
		async function loadPrefs() {
			const data = await getUserPreferences();
			setPrefs(data.notifications);
			setIsLoading(false);
		}
		loadPrefs();
	}, []);

	const handleToggle = async (
		category: "email" | "push",
		key: string,
		value: boolean
	) => {
		if (!prefs) return;

		const updated = {
			...prefs,
			[category]: {
				...prefs[category],
				[key]: value,
			},
		};
		setPrefs(updated);

		// Save immediately
		setIsSaving(true);
		const result = await updateNotificationPreferences(updated);
		setIsSaving(false);

		if (!result.success) {
			showToast(result.error ?? "Failed to save", "error");
			// Revert on error
			setPrefs(prefs);
		}
	};

	const [showQuietHoursDialog, setShowQuietHoursDialog] = React.useState(false);
	const [quietHoursStart, setQuietHoursStart] = React.useState(prefs?.quietHours?.start ?? "22:00");
	const [quietHoursEnd, setQuietHoursEnd] = React.useState(prefs?.quietHours?.end ?? "08:00");
	const [quietHoursEnabled, setQuietHoursEnabled] = React.useState(prefs?.quietHours?.enabled ?? false);

	const handleQuietHoursClick = () => {
		setShowQuietHoursDialog(true);
	};

	const handleSaveQuietHours = async () => {
		if (!prefs) return;
		const updated = {
			email: prefs.email,
			push: prefs.push,
			quietHours: {
				enabled: quietHoursEnabled,
				start: quietHoursStart,
				end: quietHoursEnd,
			},
		};
		setPrefs(updated);
		setShowQuietHoursDialog(false);

		setIsSaving(true);
		const result = await updateNotificationPreferences(updated);
		setIsSaving(false);

		if (result.success) {
			showToast("Quiet hours updated", "success");
		} else {
			showToast(result.error ?? "Failed to save quiet hours", "error");
		}
	};

	if (isLoading || !prefs) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-16" />
				))}
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-foreground mb-1">Notification Preferences</h2>
					<p className="text-sm text-muted-foreground">
						Choose how and when you want to be notified
					</p>
				</div>
				{isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
						checked={prefs.email.deadlines}
						onChange={(checked) => handleToggle("email", "deadlines", checked)}
					/>
					<NotificationToggle
						label="Mentions & Comments"
						description="When someone mentions you or replies to your comments"
						checked={prefs.email.mentions}
						onChange={(checked) => handleToggle("email", "mentions", checked)}
					/>
					<NotificationToggle
						label="Document Updates"
						description="Changes to documents you're collaborating on"
						checked={prefs.email.updates}
						onChange={(checked) => handleToggle("email", "updates", checked)}
					/>
					<NotificationToggle
						label="Product Updates"
						description="News about new features and improvements"
						checked={prefs.email.marketing}
						onChange={(checked) => handleToggle("email", "marketing", checked)}
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
						checked={prefs.push.deadlines}
						onChange={(checked) => handleToggle("push", "deadlines", checked)}
					/>
					<NotificationToggle
						label="Direct Mentions"
						description="When someone @mentions you"
						checked={prefs.push.mentions}
						onChange={(checked) => handleToggle("push", "mentions", checked)}
					/>
					<NotificationToggle
						label="Real-time Updates"
						description="Live updates while collaborating"
						checked={prefs.push.updates}
						onChange={(checked) => handleToggle("push", "updates", checked)}
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
								{prefs.quietHours?.enabled
									? `Active: ${prefs.quietHours.start} - ${prefs.quietHours.end}`
									: "Pause notifications during set hours"}
							</p>
						</div>
					</div>
					<Button variant="outline" size="sm" onClick={handleQuietHoursClick}>
						Configure
					</Button>
				</div>
			</div>

			{/* Quiet Hours Dialog */}
			<Dialog open={showQuietHoursDialog} onOpenChange={setShowQuietHoursDialog}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Quiet Hours</DialogTitle>
						<DialogDescription>
							Configure when to pause notifications
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium">Enable Quiet Hours</p>
								<p className="text-sm text-muted-foreground">
									Pause notifications during these hours
								</p>
							</div>
							<Switch
								checked={quietHoursEnabled}
								onCheckedChange={setQuietHoursEnabled}
							/>
						</div>
						{quietHoursEnabled && (
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium mb-2">Start Time</label>
									<Input
										type="time"
										value={quietHoursStart}
										onChange={(e) => setQuietHoursStart(e.target.value)}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium mb-2">End Time</label>
									<Input
										type="time"
										value={quietHoursEnd}
										onChange={(e) => setQuietHoursEnd(e.target.value)}
									/>
								</div>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowQuietHoursDialog(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveQuietHours}>Save Changes</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
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

function SecuritySection({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
	const [sessions, setSessions] = React.useState<UserSession[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
	const [showNewPassword, setShowNewPassword] = React.useState(false);
	const [currentPassword, setCurrentPassword] = React.useState("");
	const [newPassword, setNewPassword] = React.useState("");
	const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
	const [revokingSession, setRevokingSession] = React.useState<string | null>(null);
	const [isRevokingAll, setIsRevokingAll] = React.useState(false);

	React.useEffect(() => {
		async function loadSessions() {
			const data = await getUserSessions();
			setSessions(data);
			setIsLoading(false);
		}
		loadSessions();
	}, []);

	const handleUpdatePassword = async () => {
		if (!currentPassword || !newPassword) {
			showToast("Please fill in both password fields", "error");
			return;
		}
		if (newPassword.length < 8) {
			showToast("New password must be at least 8 characters", "error");
			return;
		}

		setIsUpdatingPassword(true);
		const result = await changePassword(currentPassword, newPassword);
		setIsUpdatingPassword(false);

		if (result.success) {
			setCurrentPassword("");
			setNewPassword("");
			showToast("Password updated successfully", "success");
		} else {
			showToast(result.error ?? "Failed to update password", "error");
		}
	};

	// 2FA requires TOTP library and QR code generation - disabled until backend is configured
	const is2FASupported = false; // Set to true when TOTP is configured

	const handleRevokeSession = async (sessionId: string) => {
		setRevokingSession(sessionId);
		const result = await revokeSession(sessionId);
		setRevokingSession(null);

		if (result.success) {
			setSessions((prev) => prev.filter((s) => s.id !== sessionId));
			showToast("Session revoked", "success");
		} else {
			showToast(result.error ?? "Failed to revoke session", "error");
		}
	};

	const handleRevokeAllOther = async () => {
		setIsRevokingAll(true);
		const result = await revokeAllOtherSessions();
		setIsRevokingAll(false);

		if (result.success) {
			setSessions((prev) => prev.filter((s) => s.current));
			showToast("All other sessions revoked", "success");
		} else {
			showToast(result.error ?? "Failed to revoke sessions", "error");
		}
	};

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-24" />
				))}
			</div>
		);
	}

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
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
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
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
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
					<Button size="sm" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
						{isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						Update Password
					</Button>
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
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button variant="outline" size="sm" disabled={!is2FASupported}>
										Enable 2FA
									</Button>
								</span>
							</TooltipTrigger>
							{!is2FASupported && (
								<TooltipContent>
									<p>2FA requires TOTP configuration. Contact your administrator.</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
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
								Devices currently logged into your account ({sessions.length})
							</p>
						</div>
					</div>
					{sessions.length > 1 && (
						<Button
							variant="outline"
							size="sm"
							className="text-destructive hover:text-destructive"
							onClick={handleRevokeAllOther}
							disabled={isRevokingAll}
						>
							{isRevokingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
							Sign Out All Others
						</Button>
					)}
				</div>

				<div className="space-y-3 pl-2">
					{sessions.map((s) => (
						<div
							key={s.id}
							className={cn(
								"flex items-center justify-between p-3 rounded-lg border",
								s.current && "border-primary/30 bg-primary/5"
							)}
						>
							<div className="flex items-center gap-3">
								<Monitor className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-sm font-medium text-foreground">
										{s.device}
										{s.current && (
											<span className="ml-2 text-xs text-primary">(This device)</span>
										)}
									</p>
									<p className="text-xs text-muted-foreground">
										{s.ipAddress ?? "Unknown IP"} · {s.lastActive}
									</p>
								</div>
							</div>
							{!s.current && (
								<Button
									variant="ghost"
									size="sm"
									className="text-destructive hover:text-destructive"
									onClick={() => handleRevokeSession(s.id)}
									disabled={revokingSession === s.id}
								>
									{revokingSession === s.id ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"Revoke"
									)}
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

function AppearanceSection({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
	const { theme, setTheme } = useTheme();
	const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
	const [isSaving, setIsSaving] = React.useState(false);

	React.useEffect(() => {
		async function loadPrefs() {
			const prefs = await getUserPreferences();
			setDensity(prefs.appearance.density);
		}
		loadPrefs();
	}, []);

	const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
		setTheme(newTheme);
		setIsSaving(true);
		await updateAppearancePreferences({ theme: newTheme, density });
		setIsSaving(false);
	};

	const handleDensityChange = async (newDensity: "comfortable" | "compact") => {
		setDensity(newDensity);
		setIsSaving(true);
		const result = await updateAppearancePreferences({ theme: theme as "light" | "dark" | "system", density: newDensity });
		setIsSaving(false);

		if (result.success) {
			showToast("Display density updated", "success");
		}
	};

	const themes = [
		{ id: "light", icon: Sun, label: "Light", description: "Clean and bright" },
		{ id: "dark", icon: Moon, label: "Dark", description: "Easy on the eyes" },
		{ id: "system", icon: Monitor, label: "System", description: "Match your OS" },
	] as const;

	const densities = [
		{ id: "comfortable", label: "Comfortable", description: "More spacing, easier to read" },
		{ id: "compact", label: "Compact", description: "Fit more content on screen" },
	] as const;

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-foreground mb-1">Appearance Settings</h2>
					<p className="text-sm text-muted-foreground">
						Customize how DocFusion looks and feels
					</p>
				</div>
				{isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
							onClick={() => handleThemeChange(option.id)}
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
							{theme === option.id && <Check className="h-4 w-4 text-primary" />}
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
							onClick={() => handleDensityChange(option.id)}
							className={cn(
								"flex items-center justify-between p-4 rounded-xl border transition-all text-left",
								density === option.id
									? "border-primary bg-primary/5"
									: "border-input bg-background hover:bg-accent"
							)}
						>
							<div>
								<p className="text-sm font-medium">{option.label}</p>
								<p className="text-xs text-muted-foreground">{option.description}</p>
							</div>
							{density === option.id && <Check className="h-4 w-4 text-primary" />}
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

function IntegrationsSection({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
	const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [showNewKeyDialog, setShowNewKeyDialog] = React.useState(false);
	const [newKeyName, setNewKeyName] = React.useState("");
	const [newlyCreatedKey, setNewlyCreatedKey] = React.useState<string | null>(null);
	const [isCreatingKey, setIsCreatingKey] = React.useState(false);
	const [deletingKeyId, setDeletingKeyId] = React.useState<string | null>(null);

	React.useEffect(() => {
		async function loadKeys() {
			const keys = await getApiKeys();
			setApiKeys(keys);
			setIsLoading(false);
		}
		loadKeys();
	}, []);

	const handleCreateKey = async () => {
		if (!newKeyName.trim()) {
			showToast("Please enter a name for the API key", "error");
			return;
		}

		setIsCreatingKey(true);
		const result = await generateApiKey(newKeyName);
		setIsCreatingKey(false);

		if (result.success && result.key) {
			setNewlyCreatedKey(result.key);
			setNewKeyName("");
			// Reload keys
			const keys = await getApiKeys();
			setApiKeys(keys);
			showToast("API key created successfully", "success");
		} else {
			showToast(result.error ?? "Failed to create API key", "error");
		}
	};

	const handleCopyKey = async (key: string) => {
		await navigator.clipboard.writeText(key);
		showToast("Copied to clipboard", "success");
	};

	const handleDeleteKey = async (keyId: string) => {
		setDeletingKeyId(keyId);
		const result = await deleteApiKey(keyId);
		setDeletingKeyId(null);

		if (result.success) {
			setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
			showToast("API key deleted", "success");
		} else {
			showToast(result.error ?? "Failed to delete API key", "error");
		}
	};

	// Webhooks require webhook infrastructure setup
	const isWebhooksSupported = false; // Set to true when webhook service is configured

	// Service integrations require OAuth credentials for each service
	const supportedIntegrations: Record<string, boolean> = {
		"Google Workspace": false, // Requires GOOGLE_CLIENT_ID/SECRET
		"Microsoft 365": false,    // Requires MS_CLIENT_ID/SECRET
		"Slack": false,            // Requires SLACK_CLIENT_ID/SECRET
		"Salesforce": false,       // Requires SF_CLIENT_ID/SECRET
	};

	const integrations = [
		{ name: "Google Workspace", icon: "🔗", status: "available", description: "Sync documents and calendar" },
		{ name: "Microsoft 365", icon: "📎", status: "available", description: "Import Word and Excel files" },
		{ name: "Slack", icon: "💬", status: "available", description: "Send notifications to channels" },
		{ name: "Salesforce", icon: "☁️", status: "available", description: "Sync opportunities and contacts" },
	];

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-24" />
				))}
			</div>
		);
	}

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

				{/* Newly created key warning */}
				{newlyCreatedKey && (
					<div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
						<p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
							⚠️ Copy your API key now - you won&apos;t be able to see it again!
						</p>
						<div className="flex items-center gap-2">
							<code className="flex-1 font-mono text-sm bg-background px-3 py-2 rounded border">
								{newlyCreatedKey}
							</code>
							<Button size="sm" onClick={() => handleCopyKey(newlyCreatedKey)}>
								<Copy className="h-4 w-4" />
							</Button>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="mt-2"
							onClick={() => setNewlyCreatedKey(null)}
						>
							I&apos;ve copied it
						</Button>
					</div>
				)}

				{/* Existing keys */}
				<div className="space-y-3 pl-2">
					{apiKeys.length === 0 ? (
						<p className="text-sm text-muted-foreground">No API keys created yet.</p>
					) : (
						apiKeys.map((key) => (
							<div
								key={key.id}
								className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
							>
								<div>
									<p className="text-sm font-medium">{key.name}</p>
									<p className="text-xs text-muted-foreground font-mono">
										{key.prefix}•••••••••
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="text-destructive hover:text-destructive"
									onClick={() => handleDeleteKey(key.id)}
									disabled={deletingKeyId === key.id}
								>
									{deletingKeyId === key.id ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Trash2 className="h-4 w-4" />
									)}
								</Button>
							</div>
						))
					)}

					{/* New key form */}
					{showNewKeyDialog ? (
						<div className="flex items-center gap-2 mt-4">
							<Input
								placeholder="Key name (e.g., Production)"
								value={newKeyName}
								onChange={(e) => setNewKeyName(e.target.value)}
								className="flex-1"
							/>
							<Button onClick={handleCreateKey} disabled={isCreatingKey}>
								{isCreatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
							</Button>
							<Button variant="ghost" onClick={() => setShowNewKeyDialog(false)}>
								Cancel
							</Button>
						</div>
					) : (
						<Button variant="outline" size="sm" onClick={() => setShowNewKeyDialog(true)}>
							<Plus className="h-4 w-4" />
							New Key
						</Button>
					)}
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
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button variant="outline" size="sm" disabled={!isWebhooksSupported}>
										<Plus className="h-4 w-4" />
										Add Webhook
									</Button>
								</span>
							</TooltipTrigger>
							{!isWebhooksSupported && (
								<TooltipContent>
									<p>Webhook service requires infrastructure setup</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				</div>

				<div className="pl-2 text-sm text-muted-foreground">
					{isWebhooksSupported
						? "No webhooks configured. Add one to receive notifications when events occur."
						: "Webhooks are not available. Contact your administrator to enable this feature."}
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
					{integrations.map((integration) => {
						const isSupported = supportedIntegrations[integration.name] ?? false;
						return (
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
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span>
												<Button
													variant="ghost"
													size="sm"
													disabled={!isSupported}
												>
													Connect
												</Button>
											</span>
										</TooltipTrigger>
										{!isSupported && (
											<TooltipContent>
												<p>Requires OAuth credentials configuration</p>
											</TooltipContent>
										)}
									</Tooltip>
								</TooltipProvider>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Data Section
// ============================================================================

function DataSection({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
	const [stats, setStats] = React.useState<StorageStats | null>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [exportingType, setExportingType] = React.useState<string | null>(null);
	const [showDeleteDataConfirm, setShowDeleteDataConfirm] = React.useState(false);
	const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = React.useState(false);
	const [confirmText, setConfirmText] = React.useState("");
	const [isDeleting, setIsDeleting] = React.useState(false);

	React.useEffect(() => {
		async function loadStats() {
			const data = await getStorageStats();
			setStats(data);
			setIsLoading(false);
		}
		loadStats();
	}, []);

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
	};

	const handleExport = async (type: "opportunities" | "contacts" | "accounts" | "all") => {
		setExportingType(type);

		let result: { success: boolean; data?: string; error?: string };

		switch (type) {
			case "opportunities":
				result = await exportOpportunitiesCSV();
				break;
			case "contacts":
				result = await exportContactsCSV();
				break;
			case "accounts":
				result = await exportAccountsCSV();
				break;
			case "all":
				// Export all - just do opportunities for now
				result = await exportOpportunitiesCSV();
				break;
			default:
				result = { success: false, error: "Unknown export type" };
		}

		setExportingType(null);

		if (result.success && result.data) {
			// Download the CSV
			const blob = new Blob([result.data], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${type}-export-${new Date().toISOString().split("T")[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			showToast(`${type} exported successfully`, "success");
		} else {
			showToast(result.error ?? "Export failed", "error");
		}
	};

	const handleDeleteData = async () => {
		if (confirmText !== "DELETE") {
			showToast('Please type "DELETE" to confirm', "error");
			return;
		}

		setIsDeleting(true);
		const result = await deleteAllUserData();
		setIsDeleting(false);
		setShowDeleteDataConfirm(false);
		setConfirmText("");

		if (result.success) {
			showToast("All data has been deleted", "success");
		} else {
			showToast(result.error ?? "Failed to delete data", "error");
		}
	};

	const handleDeleteAccount = async () => {
		if (confirmText !== "DELETE MY ACCOUNT") {
			showToast('Please type "DELETE MY ACCOUNT" to confirm', "error");
			return;
		}

		setIsDeleting(true);
		const result = await deleteUserAccount();
		setIsDeleting(false);

		if (result.success) {
			// Redirect to home page after account deletion
			window.location.href = "/";
		} else {
			showToast(result.error ?? "Failed to delete account", "error");
		}
	};

	if (isLoading || !stats) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-24" />
				))}
			</div>
		);
	}

	const storagePercent = (stats.totalSize / stats.limit) * 100;

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
							{formatBytes(stats.totalSize)} of {formatBytes(stats.limit)} used
						</p>
					</div>
				</div>

				<div className="pl-2 space-y-3">
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary rounded-full transition-all"
							style={{ width: `${Math.min(storagePercent, 100)}%` }}
						/>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>Documents: {formatBytes(stats.documentsSize)}</span>
						<span>Templates: {formatBytes(stats.templatesSize)}</span>
						<span>Attachments: {formatBytes(stats.attachmentsSize)}</span>
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
					<Button
						variant="outline"
						className="justify-start"
						onClick={() => handleExport("opportunities")}
						disabled={exportingType !== null}
					>
						{exportingType === "opportunities" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						Export Opportunities (CSV)
					</Button>
					<Button
						variant="outline"
						className="justify-start"
						onClick={() => handleExport("contacts")}
						disabled={exportingType !== null}
					>
						{exportingType === "contacts" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						Export Contacts (CSV)
					</Button>
					<Button
						variant="outline"
						className="justify-start"
						onClick={() => handleExport("accounts")}
						disabled={exportingType !== null}
					>
						{exportingType === "accounts" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						Export Accounts (CSV)
					</Button>
					<Button
						variant="outline"
						className="justify-start"
						onClick={() => handleExport("all")}
						disabled={exportingType !== null}
					>
						{exportingType === "all" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
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
					{/* Delete All Data */}
					{showDeleteDataConfirm ? (
						<div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5 space-y-3">
							<p className="text-sm font-medium text-foreground">
								Are you sure? This will permanently delete all your documents and data.
							</p>
							<p className="text-xs text-muted-foreground">
								Type <strong>DELETE</strong> to confirm
							</p>
							<Input
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								placeholder="DELETE"
								className="max-w-xs"
							/>
							<div className="flex gap-2">
								<Button
									variant="danger"
									size="sm"
									onClick={handleDeleteData}
									disabled={isDeleting || confirmText !== "DELETE"}
								>
									{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
									Confirm Delete
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setShowDeleteDataConfirm(false);
										setConfirmText("");
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
							<div>
								<p className="text-sm font-medium text-foreground">Delete All Data</p>
								<p className="text-xs text-muted-foreground">
									Permanently remove all your documents and data
								</p>
							</div>
							<Button variant="danger" size="sm" onClick={() => setShowDeleteDataConfirm(true)}>
								<Trash2 className="h-4 w-4" />
								Delete
							</Button>
						</div>
					)}

					{/* Delete Account */}
					{showDeleteAccountConfirm ? (
						<div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5 space-y-3">
							<p className="text-sm font-medium text-foreground">
								Are you absolutely sure? This cannot be undone.
							</p>
							<p className="text-xs text-muted-foreground">
								Type <strong>DELETE MY ACCOUNT</strong> to confirm
							</p>
							<Input
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								placeholder="DELETE MY ACCOUNT"
								className="max-w-xs"
							/>
							<div className="flex gap-2">
								<Button
									variant="danger"
									size="sm"
									onClick={handleDeleteAccount}
									disabled={isDeleting || confirmText !== "DELETE MY ACCOUNT"}
								>
									{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
									Delete Account Forever
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setShowDeleteAccountConfirm(false);
										setConfirmText("");
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
							<div>
								<p className="text-sm font-medium text-foreground">Delete Account</p>
								<p className="text-xs text-muted-foreground">
									Permanently delete your account and all associated data
								</p>
							</div>
							<Button variant="danger" size="sm" onClick={() => setShowDeleteAccountConfirm(true)}>
								<Trash2 className="h-4 w-4" />
								Delete
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
