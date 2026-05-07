/**
 * SpiceDB Authorization Client
 *
 * ReBAC (Relationship-Based Access Control) via Authzed SpiceDB.
 * Uses the shared PJS authorization schema.
 */

import { v1 } from "@authzed/authzed-node";

let _client: ReturnType<typeof v1.NewClient> | null = null;

function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required for SpiceDB authorization`);
	}
	return value;
}

function getClient() {
	if (!_client) {
		const endpoint = requiredEnv("SPICEDB_ENDPOINT");
		const key = requiredEnv("SPICEDB_KEY");
		const allowInsecureLocalhost =
			process.env.SPICEDB_ALLOW_INSECURE_LOCALHOST === "true" &&
			(endpoint.startsWith("localhost:") || endpoint.startsWith("127.0.0.1:"));

		_client = v1.NewClient(
			key,
			endpoint,
			allowInsecureLocalhost
				? v1.ClientSecurity.INSECURE_LOCALHOST_ALLOWED
				: v1.ClientSecurity.SECURE,
		);
	}
	return _client;
}

function promisify<T>(
	fn: (cb: (err: Error | null, res?: T) => void) => void,
): Promise<T> {
	return new Promise((resolve, reject) => {
		fn((err, res) => {
			if (err) reject(err);
			else resolve(res as T);
		});
	});
}

const {
	CheckPermissionRequest,
	ObjectReference,
	SubjectReference,
	Consistency,
	LookupResourcesRequest,
	CheckPermissionResponse_Permissionship,
	WriteRelationshipsRequest,
	RelationshipUpdate,
	Relationship,
} = v1;

/**
 * Check if a user has a specific permission on a resource.
 */
export async function checkPermission(
	resourceType: string,
	resourceId: string,
	permission: string,
	userId: string,
): Promise<boolean> {
	try {
		const res = await promisify<{ permissionship: number }>((cb) =>
			getClient().checkPermission(
				CheckPermissionRequest.create({
					consistency: Consistency.create({
						requirement: {
							oneofKind: "fullyConsistent",
							fullyConsistent: true,
						},
					}),
					resource: ObjectReference.create({
						objectType: resourceType,
						objectId: resourceId,
					}),
					permission,
					subject: SubjectReference.create({
						object: ObjectReference.create({
							objectType: "user",
							objectId: userId,
						}),
					}),
				}),
				cb,
			),
		);
		return res.permissionship === CheckPermissionResponse_Permissionship.HAS_PERMISSION;
	} catch {
		return false;
	}
}

/**
 * Find all resources of a type that a user has permission on.
 */
export async function lookupResources(
	resourceType: string,
	permission: string,
	userId: string,
): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const results: string[] = [];
		const stream = getClient().lookupResources(
			LookupResourcesRequest.create({
				consistency: Consistency.create({
					requirement: {
						oneofKind: "fullyConsistent",
						fullyConsistent: true,
					},
				}),
				resourceObjectType: resourceType,
				permission,
				subject: SubjectReference.create({
					object: ObjectReference.create({
						objectType: "user",
						objectId: userId,
					}),
				}),
			}),
		);
		stream.on("data", (r: { resourceObjectId: string }) =>
			results.push(r.resourceObjectId),
		);
		stream.on("error", reject);
		stream.on("end", () => resolve(results));
	});
}

/**
 * Write (or update) a relationship between a resource and subject.
 */
export async function writeRelationship(
	resourceType: string,
	resourceId: string,
	relation: string,
	subjectType: string,
	subjectId: string,
): Promise<void> {
	await promisify((cb) =>
		getClient().writeRelationships(
			WriteRelationshipsRequest.create({
				updates: [
					RelationshipUpdate.create({
						operation: v1.RelationshipUpdate_Operation.TOUCH,
						relationship: Relationship.create({
							resource: ObjectReference.create({
								objectType: resourceType,
								objectId: resourceId,
							}),
							relation,
							subject: SubjectReference.create({
								object: ObjectReference.create({
									objectType: subjectType,
									objectId: subjectId,
								}),
							}),
						}),
					}),
				],
			}),
			cb,
		),
	);
}
