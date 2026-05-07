export type RfpUploadFileType = "pdf" | "docx" | "doc" | "html";

export interface RfpUploadMetadataInput {
	filename: string;
	contentType?: string;
	size: number;
}

export interface RfpUploadMetadataValidation {
	valid: boolean;
	errors: string[];
	extension: string;
	fileType: RfpUploadFileType | null;
}

export interface RfpUploadSecurityScan {
	status: "passed" | "warning" | "failed";
	findings: string[];
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/msword",
	"text/html",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".html", ".htm"]);

export function validateRfpUploadMetadata(input: RfpUploadMetadataInput): RfpUploadMetadataValidation {
	const errors: string[] = [];
	const extension = getExtension(input.filename);

	if (input.size > MAX_FILE_SIZE) {
		errors.push(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
	}
	if (!ALLOWED_EXTENSIONS.has(extension)) {
		errors.push(`Unsupported file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`);
	}
	if (input.contentType && !ALLOWED_TYPES.has(input.contentType)) {
		errors.push(`Unsupported content type: ${input.contentType}`);
	}

	return {
		valid: errors.length === 0,
		errors,
		extension,
		fileType: extensionToFileType(extension),
	};
}

export function scanRfpUploadBuffer(buffer: Buffer, fileType: RfpUploadFileType | null): RfpUploadSecurityScan {
	const findings: string[] = [];
	if (buffer.length === 0) {
		return { status: "failed", findings: ["empty_file"] };
	}

	if (fileType === "pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
		findings.push("pdf_signature_not_confirmed");
	}
	if (fileType === "docx" && !buffer.subarray(0, 2).equals(Buffer.from("PK"))) {
		findings.push("docx_zip_signature_not_confirmed");
	}
	if (fileType === "doc" && !buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
		findings.push("legacy_doc_signature_not_confirmed");
	}
	if (fileType === "html") {
		const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").toLowerCase();
		if (!head.includes("<html") && !head.includes("<!doctype html")) {
			findings.push("html_signature_not_confirmed");
		}
	}

	return {
		status: findings.length ? "warning" : "passed",
		findings,
	};
}

function getExtension(filename: string): string {
	const index = filename.lastIndexOf(".");
	return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function extensionToFileType(extension: string): RfpUploadFileType | null {
	if (extension === ".pdf") return "pdf";
	if (extension === ".docx") return "docx";
	if (extension === ".doc") return "doc";
	if (extension === ".html" || extension === ".htm") return "html";
	return null;
}

