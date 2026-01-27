/**
 * Settings Page - DocFusion
 *
 * Application settings and preferences.
 * Design: "Command Center Elegance" - Dark theme
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Settings,
	User,
	Building2,
	Bell,
	Shield,
	Palette,
	Globe,
	Database,
	ChevronRight,
	Check,
	Moon,
	Sun,
} from "lucide-react";

const settingsSections = [
	{
		id: "profile",
		icon: User,
		title: "Profile",
		description: "Manage your personal information and preferences",
	},
	{
		id: "organization",
		icon: Building2,
		title: "Organization",
		description: "Company details, team members, and permissions",
	},
	{
		id: "notifications",
		icon: Bell,
		title: "Notifications",
		description: "Email alerts, deadlines, and in-app notifications",
	},
	{
		id: "security",
		icon: Shield,
		title: "Security",
		description: "Password, two-factor authentication, and sessions",
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
		description: "Connected services, API keys, and webhooks",
	},
	{
		id: "data",
		icon: Database,
		title: "Data & Storage",
		description: "Export data, storage usage, and retention policies",
	},
];

export default function SettingsPage() {
	const [activeSection, setActiveSection] = React.useState("profile");
	const [theme, setTheme] = React.useState<"dark" | "light" | "system">("dark");

	return (
		<div className="relative">
			{/* Page Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-foreground mb-1">
					Settings
				</h1>
				<p className="text-sm text-muted-foreground">
					Manage your account, preferences, and application settings
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Sidebar Navigation */}
				<div className="lg:col-span-1">
					<nav className="space-y-1">
						{settingsSections.map((section) => (
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
										"w-9 h-9 rounded-lg flex items-center justify-center",
										activeSection === section.id
											? "bg-primary/10"
											: "bg-muted"
									)}
								>
									<section.icon className="h-5 w-5" />
								</div>
								<span className="text-sm font-medium">{section.title}</span>
							</button>
						))}
					</nav>
				</div>

				{/* Settings Content */}
				<div className="lg:col-span-3">
					<div className="rounded-xl border bg-card p-6 shadow-sm">
						{activeSection === "profile" && (
							<div className="space-y-6">
								<div>
									<h2 className="text-lg font-semibold text-foreground mb-4">
										Profile Information
									</h2>

									<div className="flex items-center gap-6 mb-6 pb-6 border-b">
										<div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-foreground text-2xl font-semibold">
											JD
										</div>
										<div>
											<Button variant="outline">
												Change Avatar
											</Button>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-foreground mb-2">
												Full Name
											</label>
											<input
												type="text"
												defaultValue="John Doe"
												className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-foreground mb-2">
												Email
											</label>
											<input
												type="email"
												defaultValue="john.doe@example.com"
												className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-foreground mb-2">
												Job Title
											</label>
											<input
												type="text"
												defaultValue="Proposal Manager"
												className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-foreground mb-2">
												Phone
											</label>
											<input
												type="tel"
												placeholder="+1 (555) 000-0000"
												className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</div>
									</div>
								</div>

								<div className="flex justify-end pt-4 border-t">
									<Button>
										Save Changes
									</Button>
								</div>
							</div>
						)}

						{activeSection === "appearance" && (
							<div className="space-y-6">
								<div>
									<h2 className="text-lg font-semibold text-foreground mb-4">
										Appearance Settings
									</h2>

									<div className="space-y-4">
										<div>
											<label className="block text-sm font-medium text-foreground mb-3">
												Theme
											</label>
											<div className="flex items-center gap-3">
												{[
													{ id: "light", icon: Sun, label: "Light" },
													{ id: "dark", icon: Moon, label: "Dark" },
													{ id: "system", icon: Settings, label: "System" },
												].map((option) => (
													<button
														key={option.id}
														onClick={() => setTheme(option.id as typeof theme)}
														className={cn(
															"flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
															theme === option.id
																? "border-primary bg-primary/10 text-primary"
																: "border-input bg-background hover:bg-accent hover:text-accent-foreground"
														)}
													>
														<option.icon className="w-4 h-4" />
														<span className="text-sm font-medium">{option.label}</span>
														{theme === option.id && <Check className="w-4 h-4 ml-2" />}
													</button>
												))}
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{activeSection !== "profile" && activeSection !== "appearance" && (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
									<Settings className="w-8 h-8 text-muted-foreground" />
								</div>
								<h3 className="text-lg font-semibold text-foreground mb-2">
									{settingsSections.find((s) => s.id === activeSection)?.title}
								</h3>
								<p className="text-sm text-muted-foreground max-w-sm">
									{settingsSections.find((s) => s.id === activeSection)?.description}
								</p>
								<p className="text-xs text-muted-foreground/70 mt-4">
									Coming soon
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
