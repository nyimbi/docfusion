/**
 * Auth Provider Component
 *
 * Wraps the application with Next-Auth SessionProvider.
 * Must be used within a Next.js client component.
 */

"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
	return <SessionProvider>{children}</SessionProvider>;
}
