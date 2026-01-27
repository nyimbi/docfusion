/**
 * Auth UI Provider Component
 *
 * Wraps the application with better-auth-ui context for authentication
 * forms and hooks. Must be used within a Next.js client component.
 */

"use client";

import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [mounted, setMounted] = useState(false);

	// Avoid hydration mismatch by only rendering AuthUIProvider on client
	useEffect(() => {
		setMounted(true);
	}, []);

	// During SSR and initial hydration, render children without provider
	// This prevents issues with static generation
	if (!mounted) {
		return <>{children}</>;
	}

	return (
		<AuthUIProvider
			authClient={authClient}
			navigate={router.push}
			replace={router.replace}
			onSessionChange={() => {
				// Clear router cache to refresh protected routes
				router.refresh();
			}}
			Link={Link}
		>
			{children}
		</AuthUIProvider>
	);
}
