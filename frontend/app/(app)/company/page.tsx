/**
 * Company Page - Redirect to Settings
 *
 * Company setup has been merged into the Settings page under Organization.
 */

import { redirect } from "next/navigation";

export default function CompanyPage() {
	redirect("/settings?section=organization");
}
