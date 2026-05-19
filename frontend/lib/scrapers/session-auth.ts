import { requireServerSession } from "@/lib/auth-utils";
import { hasScraperRole } from "@/lib/scrapers/access";

export async function requireScraperOperatorSession(): Promise<void> {
	const session = await requireServerSession();
	if (!session.user?.id) {
		throw new Error("Unauthorized");
	}
	if (!hasScraperRole(session.user as { role?: string; roles?: string[] })) {
		throw new Error("Forbidden");
	}
}
