/**
 * Dynamic Auth Pages
 *
 * Renders authentication views (sign-in, sign-up, forgot-password, etc.)
 * using better-auth-ui's AuthView component.
 */

import { AuthView } from "@daveyplate/better-auth-ui";

// Allow dynamic rendering - auth pages should work without static generation
export const dynamic = "force-dynamic";

export default async function AuthPage({
	params,
}: {
	params: Promise<{ path: string[] }>;
}) {
	const { path } = await params;
	const authPath = path.join("/");

	return (
		<main className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
			<div className="w-full max-w-md animate-fade-up">
				<AuthView path={authPath} />

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Powered by{" "}
					<span className="font-medium text-foreground">DocFusion</span>
				</p>
			</div>
		</main>
	);
}
