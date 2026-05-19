"use server";

import { getServerSession } from "@/lib/auth-utils";
import {
	listOperationalExceptionsForActor,
	remediateOperationalExceptionForActor,
	syncOperationalExceptionWorkflowsForActor,
	type OperationalException,
	type OperationalExceptionFilters,
	type RemediateOperationalExceptionInput,
} from "@/lib/workflows/operational-exceptions";

export type {
	OperationalException,
	OperationalExceptionFilters,
	OperationalExceptionSeverity,
	OperationalExceptionStatus,
	OperationalExceptionSubjectType,
	RemediateOperationalExceptionInput,
} from "@/lib/workflows/operational-exceptions";

async function requireOperationalExceptionActor(): Promise<string> {
	const session = await getServerSession();
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}
	return session.user.id;
}

export async function listOperationalExceptions(
	filters: OperationalExceptionFilters = {}
): Promise<OperationalException[]> {
	await requireOperationalExceptionActor();
	return listOperationalExceptionsForActor(filters);
}

export async function remediateOperationalException(
	input: RemediateOperationalExceptionInput
) {
	await requireOperationalExceptionActor();
	return remediateOperationalExceptionForActor(input);
}

export async function syncOperationalExceptionWorkflows(
	filters: OperationalExceptionFilters = {},
	_actorId?: string
): Promise<{ synced: number }> {
	const sessionActorId = await requireOperationalExceptionActor();
	return syncOperationalExceptionWorkflowsForActor(filters, sessionActorId);
}
