import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoleHomepage } from "@/components/work-items/RoleHomepage";
import { getRoleHomepageProjection } from "@/lib/actions/role-homepage";
import { getWorkflowViewerScopeFromSession } from "@/lib/workflows/viewer-scope";

export const metadata: Metadata = {
	title: "Home | DocFusion",
};

export default async function RoleHomePage() {
	const scope = await getWorkflowViewerScopeFromSession();
	if (!scope) redirect("/auth/sign-in");
	const projection = await getRoleHomepageProjection();

	return (
		<div className="h-full overflow-auto bg-background">
			<main className="p-6">
				<RoleHomepage projection={projection} />
			</main>
		</div>
	);
}
