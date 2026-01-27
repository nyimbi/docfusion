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
		<main className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
			{/* Ambient Background Gradient */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				<div
					className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[150px]"
					style={{ background: 'var(--accent-500)', opacity: 0.05 }}
				/>
				<div
					className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px]"
					style={{ background: 'var(--info-500)', opacity: 0.05 }}
				/>
			</div>

			<div className="relative flex flex-col items-center animate-fade-up">
				{/* AuthView provides its own card styling */}
				<AuthView path={authPath} />

				{/* Branding below card */}
				<div className="mt-8 text-center">
					<p style={{ color: 'var(--foreground-subtle)', fontSize: '0.8125rem' }}>
						Powered by <span style={{ fontWeight: 500, color: 'var(--foreground-muted)' }}>DocFusion</span>
					</p>
				</div>
			</div>
		</main>
	);
}
