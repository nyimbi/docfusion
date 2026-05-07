/**
 * Auth Pages - DocFusion
 *
 * Redirects all auth paths to Keycloak OIDC login.
 * Replaces the better-auth-ui dynamic auth pages.
 */

"use client";

import { signIn, useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Feather } from "lucide-react";

function sanitizeCallbackUrl(value: string | null): string {
	if (!value?.startsWith("/") || value.startsWith("//")) {
		return "/documents";
	}
	return value;
}

function AuthPageContent() {
	const { status } = useSession();
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

	useEffect(() => {
		if (status === "authenticated") {
			router.push(callbackUrl);
		}
		if (status === "unauthenticated") {
			// Automatically redirect to Keycloak login
			signIn("keycloak", { callbackUrl });
		}
	}, [status, router, callbackUrl]);

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

			{/* Loading state centered */}
			<div className="relative z-10 flex-1 flex items-center justify-center p-6">
				<div className="w-full max-w-sm animate-fade-up text-center space-y-6">
					<div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
					<div>
						<h1 className="font-display text-lg font-medium text-foreground">
							Redirecting to login...
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Please wait while we connect you to Keycloak.
						</p>
					</div>
					<button
						onClick={() => signIn("keycloak", { callbackUrl })}
						className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-lg transition-colors"
					>
						Sign in with Keycloak
					</button>
				</div>
			</div>
		</main>
	);
}

export default function AuthPage() {
	return (
		<Suspense fallback={null}>
			<AuthPageContent />
		</Suspense>
	);
}
