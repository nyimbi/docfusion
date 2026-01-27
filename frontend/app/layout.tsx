import type { Metadata } from "next";
import { QueryProvider } from "@/lib/query/provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import "@/styles/globals.css";

export const metadata: Metadata = {
	title: "DocFusion - AI-Powered Document Intelligence",
	description:
		"Transform documents from static artifacts into strategic assets with AI-powered composition, collaborative editing, and predictive compliance.",
	keywords: [
		"document editor",
		"RFP automation",
		"AI writing",
		"collaborative editing",
		"compliance",
	],
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen bg-background font-sans antialiased">
				<AuthProvider>
					<ThemeProvider>
						<QueryProvider>
							<TooltipProvider>{children}</TooltipProvider>
						</QueryProvider>
					</ThemeProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
