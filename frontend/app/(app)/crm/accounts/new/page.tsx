/**
 * New Account Page
 *
 * Create a new CRM account.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth-utils";
import NewAccountContent from "./new-account-content";

export const metadata: Metadata = {
	title: "New Account | CRM",
	description: "Create a new CRM account",
};

export default async function NewAccountPage() {
	let userContext;
	try {
		userContext = await requireUserContext();
	} catch {
		redirect("/auth/sign-in");
	}

	return (
		<Suspense
			fallback={
				<div className="h-full flex items-center justify-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</div>
			}
		>
			<NewAccountContent userId={userContext.userId} />
		</Suspense>
	);
}
