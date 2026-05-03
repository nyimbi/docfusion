import crypto from "crypto";

const DEFAULT_ENDPOINT = "https://gb-lon-1.linodeobjects.com";
const DEFAULT_REGION = "gb-lon-1";

export interface LinodeE3Config {
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	prefix?: string;
}

export interface LinodeE3UploadInput {
	key: string;
	body: Buffer;
	contentType: string;
	contentLength: number;
	metadata?: Record<string, string>;
}

export interface LinodeE3UploadResult {
	bucket: string;
	key: string;
	storagePath: string;
	etag: string | null;
	endpoint: string;
}

export interface LinodeE3ObjectResult {
	body: Buffer;
	contentType: string | null;
	contentLength: number | null;
	etag: string | null;
}

export function getLinodeE3ConfigFromEnv(): LinodeE3Config | null {
	const bucket = process.env.LINODE_E3_BUCKET;
	const accessKeyId = process.env.LINODE_E3_ACCESS_KEY_ID;
	const secretAccessKey = process.env.LINODE_E3_SECRET_ACCESS_KEY;

	if (!bucket || !accessKeyId || !secretAccessKey) {
		return null;
	}

	return {
		endpoint: process.env.LINODE_E3_ENDPOINT ?? DEFAULT_ENDPOINT,
		region: process.env.LINODE_E3_REGION ?? DEFAULT_REGION,
		bucket,
		accessKeyId,
		secretAccessKey,
		prefix: process.env.LINODE_E3_PREFIX ?? "rfp",
	};
}

export function buildRfpObjectKey(params: {
	documentId: string;
	filename: string;
	opportunityId?: string | null;
	prefix?: string;
}): string {
	const segments = [
		params.prefix ?? "rfp",
		params.opportunityId ?? "unassigned",
		params.documentId,
		sanitizeObjectKeySegment(params.filename),
	];
	return segments.join("/");
}

export async function uploadToLinodeE3(
	config: LinodeE3Config,
	input: LinodeE3UploadInput
): Promise<LinodeE3UploadResult> {
	const endpoint = normalizeEndpoint(config.endpoint);
	const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
	const url = `${endpoint}/${config.bucket}/${encodedKey}`;
	const now = new Date();
	const amzDate = toAmzDate(now);
	const dateStamp = amzDate.slice(0, 8);
	const payloadHash = sha256Hex(input.body);
	const host = new URL(endpoint).host;
	const metadataHeaders = Object.fromEntries(
		Object.entries(input.metadata ?? {}).map(([key, value]) => [
			`x-amz-meta-${key.toLowerCase()}`,
			value,
		])
	);
	const headers: Record<string, string> = {
		"content-length": String(input.contentLength),
		"content-type": input.contentType || "application/octet-stream",
		host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date": amzDate,
		...metadataHeaders,
	};

	headers.authorization = buildAuthorizationHeader({
		method: "PUT",
		canonicalUri: `/${config.bucket}/${encodedKey}`,
		headers,
		payloadHash,
		amzDate,
		dateStamp,
		region: config.region,
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
	});

	const response = await fetch(url, {
		method: "PUT",
		headers,
		body: new Uint8Array(input.body),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`Linode E3 upload failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
	}

	return {
		bucket: config.bucket,
		key: input.key,
		storagePath: `s3://${config.bucket}/${input.key}`,
		etag: response.headers.get("etag"),
		endpoint,
	};
}

export async function downloadFromLinodeE3(
	config: LinodeE3Config,
	storagePath: string
): Promise<LinodeE3ObjectResult> {
	const { bucket, key } = parseS3StoragePath(storagePath);
	if (bucket !== config.bucket) {
		throw new Error(`Linode E3 bucket mismatch for ${storagePath}`);
	}

	const endpoint = normalizeEndpoint(config.endpoint);
	const encodedKey = key.split("/").map(encodeURIComponent).join("/");
	const url = `${endpoint}/${bucket}/${encodedKey}`;
	const now = new Date();
	const amzDate = toAmzDate(now);
	const dateStamp = amzDate.slice(0, 8);
	const payloadHash = sha256Hex("");
	const host = new URL(endpoint).host;
	const headers: Record<string, string> = {
		host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date": amzDate,
	};

	headers.authorization = buildAuthorizationHeader({
		method: "GET",
		canonicalUri: `/${bucket}/${encodedKey}`,
		headers,
		payloadHash,
		amzDate,
		dateStamp,
		region: config.region,
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
	});

	const response = await fetch(url, {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`Linode E3 download failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
	}

	return {
		body: Buffer.from(await response.arrayBuffer()),
		contentType: response.headers.get("content-type"),
		contentLength: response.headers.get("content-length")
			? Number(response.headers.get("content-length"))
			: null,
		etag: response.headers.get("etag"),
	};
}

export function parseS3StoragePath(storagePath: string): { bucket: string; key: string } {
	if (!storagePath.startsWith("s3://")) {
		throw new Error(`Unsupported object storage path: ${storagePath}`);
	}

	const withoutScheme = storagePath.slice("s3://".length);
	const slashIndex = withoutScheme.indexOf("/");
	if (slashIndex <= 0 || slashIndex === withoutScheme.length - 1) {
		throw new Error(`Invalid object storage path: ${storagePath}`);
	}

	return {
		bucket: withoutScheme.slice(0, slashIndex),
		key: withoutScheme.slice(slashIndex + 1),
	};
}

function buildAuthorizationHeader(params: {
	method: string;
	canonicalUri: string;
	headers: Record<string, string>;
	payloadHash: string;
	amzDate: string;
	dateStamp: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
}): string {
	const normalizedHeaders = Object.fromEntries(
		Object.entries(params.headers).map(([header, value]) => [
			header.toLowerCase(),
			value.trim(),
		])
	);
	const signedHeaderNames = Object.keys(normalizedHeaders).sort();
	const canonicalHeaders = signedHeaderNames
		.map((header) => `${header}:${normalizedHeaders[header]}\n`)
		.join("");
	const signedHeaders = signedHeaderNames.join(";");
	const credentialScope = `${params.dateStamp}/${params.region}/s3/aws4_request`;
	const canonicalRequest = [
		params.method,
		params.canonicalUri,
		"",
		canonicalHeaders,
		signedHeaders,
		params.payloadHash,
	].join("\n");
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		params.amzDate,
		credentialScope,
		sha256Hex(canonicalRequest),
	].join("\n");
	const signingKey = getSignatureKey(
		params.secretAccessKey,
		params.dateStamp,
		params.region,
		"s3"
	);
	const signature = hmacHex(signingKey, stringToSign);

	return `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function sanitizeObjectKeySegment(value: string): string {
	const sanitized = value
		.normalize("NFKD")
		.replace(/[^\w.\-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/-\./g, ".")
		.replace(/^-|-$/g, "")
		.slice(0, 180);
	return sanitized || "rfp-document";
}

function normalizeEndpoint(endpoint: string): string {
	const withProtocol = endpoint.startsWith("http://") || endpoint.startsWith("https://")
		? endpoint
		: `https://${endpoint}`;
	return withProtocol.replace(/\/+$/, "");
}

function toAmzDate(date: Date): string {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: crypto.BinaryLike): string {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string): Buffer {
	return crypto.createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: crypto.BinaryLike | crypto.KeyObject, value: string): string {
	return crypto.createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(
	secretAccessKey: string,
	dateStamp: string,
	regionName: string,
	serviceName: string
): Buffer {
	const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
	const kRegion = hmac(kDate, regionName);
	const kService = hmac(kRegion, serviceName);
	return hmac(kService, "aws4_request");
}
