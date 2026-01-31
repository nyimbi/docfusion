/**
 * Partners Page Redirect
 *
 * Redirects to the new CRM Partners location.
 * Partners are now managed within the CRM module at /crm/partners.
 */

import { redirect } from "next/navigation";

export default function PartnersRedirect() {
	redirect("/crm/partners");
}
