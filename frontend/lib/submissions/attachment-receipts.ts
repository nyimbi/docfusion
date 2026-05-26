import type { SubmissionAttachment } from "@/lib/types/opportunity";
import { formatBytes } from "@/lib/utils";

export interface SubmissionAttachmentReceiptLine {
	label: string;
	value: string;
	title?: string;
	mono?: boolean;
}

export function submissionAttachmentReceiptLines(
	attachment: SubmissionAttachment
): SubmissionAttachmentReceiptLine[] {
	const lines: SubmissionAttachmentReceiptLine[] = [];

	const fileLabel = attachment.filename ?? attachment.documentTitle;
	const size = typeof attachment.size === "number"
		? attachment.size
		: typeof attachment.fileSize === "number"
			? attachment.fileSize
			: null;
	if (fileLabel || size !== null) {
		lines.push({
			label: "File",
			value: [fileLabel, size !== null ? formatBytes(size, 1) : null]
				.filter(Boolean)
				.join(" - "),
		});
	}

	if (attachment.artifactHash) {
		lines.push({
			label: "SHA-256",
			value: shortHash(attachment.artifactHash),
			title: attachment.artifactHash,
			mono: true,
		});
	}

	const storageLocation = storageReceiptLocation(attachment);
	if (storageLocation) {
		lines.push({
			label: "Storage",
			value: storageLocation,
			mono: true,
		});
	}

	const sourceReceipt = sourceReceiptLabel(attachment);
	if (sourceReceipt) {
		lines.push({
			label: "Source",
			value: sourceReceipt.value,
			title: sourceReceipt.title,
			mono: Boolean(sourceReceipt.title),
		});
	}

	const approvalReceipt = approvalReceiptLabel(attachment);
	if (approvalReceipt) {
		lines.push({
			label: "Approved",
			value: approvalReceipt,
		});
	}

	if (attachment.lockedAt) {
		lines.push({
			label: "Locked",
			value: formatReceiptDate(attachment.lockedAt),
		});
	}

	return lines;
}

function storageReceiptLocation(attachment: SubmissionAttachment): string | null {
	if (attachment.storageBucket && attachment.storageKey) {
		return `${attachment.storageBucket}/${attachment.storageKey}`;
	}
	return attachment.storagePath ?? null;
}

function sourceReceiptLabel(
	attachment: SubmissionAttachment
): { value: string; title?: string } | null {
	const parts: string[] = [];
	if ("sourceDocumentVersion" in attachment) {
		parts.push(`v${attachment.sourceDocumentVersion ?? "none"}`);
	}
	if (attachment.sourceContentHash) {
		parts.push(shortHash(attachment.sourceContentHash));
	}
	if (parts.length === 0) {
		return null;
	}
	return {
		value: parts.join(" - "),
		title: attachment.sourceContentHash,
	};
}

function approvalReceiptLabel(attachment: SubmissionAttachment): string | null {
	if (!attachment.approvedBy && !attachment.approvedAt) {
		return null;
	}
	return [attachment.approvedBy, attachment.approvedAt ? formatReceiptDate(attachment.approvedAt) : null]
		.filter(Boolean)
		.join(" - ");
}

function shortHash(value: string): string {
	return value.length > 16 ? `${value.slice(0, 12)}...${value.slice(-4)}` : value;
}

function formatReceiptDate(value: string | Date): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
