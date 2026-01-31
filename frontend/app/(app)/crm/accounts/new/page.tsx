/**
 * New Account Page
 *
 * Create a new CRM account.
 */

import { Metadata } from "next";
import NewAccountContent from "./new-account-content";

export const metadata: Metadata = {
	title: "New Account",
	description: "Create a new CRM account",
};

export default function NewAccountPage() {
	return <NewAccountContent />;
}
