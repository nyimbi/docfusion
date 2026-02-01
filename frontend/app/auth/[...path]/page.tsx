/**
 * Dynamic Auth Pages - DocFusion
 * "Ink & Paper" Editorial Elegance
 *
 * Renders authentication views (sign-in, sign-up, forgot-password, etc.)
 * using better-auth-ui's AuthView component with custom styling.
 */

import { AuthView } from "@daveyplate/better-auth-ui";
import Link from "next/link";
import { Feather } from "lucide-react";

// Allow dynamic rendering - auth pages should work without static generation
export const dynamic = "force-dynamic";

/** Custom class names for the AuthView component to match DocFusion design */
const authViewClassNames = {
	base: "w-full",
	content: "space-y-4",
	title: "font-display text-2xl font-semibold text-foreground",
	description: "text-sm text-muted-foreground",
	form: {
		base: "w-full space-y-4",
		input: "w-full h-11 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
		label: "block text-sm font-medium text-foreground mb-1.5",
		primaryButton: "w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-lg transition-colors",
		outlineButton: "w-full h-11 border border-border hover:bg-secondary text-foreground font-medium rounded-lg transition-colors",
		providerButton: "w-full h-11 border border-border hover:bg-secondary text-foreground font-medium rounded-lg transition-colors",
		error: "text-sm text-destructive mt-1",
		forgotPasswordLink: "text-sm text-primary hover:underline",
	},
	footerLink: "text-sm text-primary hover:underline",
	separator: "text-muted-foreground text-xs",
};

export default async function AuthPage({
	params,
}: {
	params: Promise<{ path: string[] }>;
}) {
	const { path } = await params;
	const authPath = path.join("/");

	return (
		<main className="min-h-screen flex flex-col bg-background bg-paper">
			{/* Background decoration */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
				<div className="absolute -bottom-40 -left-40 w-96 h-96 bg-warning/5 rounded-full blur-3xl" />
			</div>

			{/* Header with logo */}
			<header className="relative z-10 py-8 px-6">
				<Link href="/" className="inline-flex items-center gap-3 group">
					<div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-primary-sm transition-shadow group-hover:shadow-primary-md">
						<Feather className="h-5 w-5 text-primary-foreground" />
					</div>
					<span className="font-display font-semibold text-xl text-foreground tracking-tight">
						DocFusion
					</span>
				</Link>
			</header>

			{/* Auth form centered */}
			<div className="relative z-10 flex-1 flex items-center justify-center p-6">
				<div className="w-full max-w-sm animate-fade-up">
					{/* AuthView has its own card wrapper */}
					<AuthView
						path={authPath}
						className="w-full"
						classNames={authViewClassNames}
					/>

					{/* Footer text */}
					<p className="mt-8 text-center text-sm text-muted-foreground">
						Powered by{" "}
						<span className="font-medium text-foreground">DocFusion</span>
					</p>
				</div>
			</div>
		</main>
	);
}
