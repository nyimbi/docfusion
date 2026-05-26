/**
 * DocLing Client
 * 
 * Interface to the DocLing document processing service running on infrastructure server.
 * Provides document extraction, OCR, and conversion capabilities.
 */

const DOCLING_URL = process.env.DOCLING_URL || "http://84.247.181.100:3600";

export interface DoclingConvertOptions {
  outputFormat?: "markdown" | "html" | "json" | "text";
  ocr?: boolean;
  extractTables?: boolean;
  extractImages?: boolean;
  pageRange?: [number, number];
  documentTimeoutSeconds?: number;
}

export interface DoclingConvertResponse {
  markdown?: string;
  html?: string;
  text?: string;
  json?: unknown;
  status?: string;
  errors?: Array<{ component_type?: string; module_name?: string; error_message?: string }>;
  metadata?: {
    title?: string;
    author?: string;
    creation_date?: string;
    page_count?: number;
    file_type?: string;
  };
  images?: Array<{
    id: string;
    data: string; // base64
    mime_type: string;
  }>;
  tables?: Array<{
    id: string;
    markdown: string;
    html: string;
  }>;
}

interface DoclingServeConvertResponse {
  document?: {
    filename?: string;
    md_content?: string | null;
    json_content?: unknown;
    html_content?: string | null;
    text_content?: string | null;
    doctags_content?: string | null;
  };
  status?: string;
  errors?: DoclingConvertResponse["errors"];
  processing_time?: number;
}

function toDoclingOutputFormat(format: DoclingConvertOptions["outputFormat"]): string {
  switch (format) {
    case "markdown":
    case undefined:
      return "md";
    case "json":
      return "json";
    case "html":
      return "html";
    case "text":
      return "text";
  }
}

function normalizeConvertResponse(response: DoclingServeConvertResponse | DoclingConvertResponse): DoclingConvertResponse {
  if ("document" in response) {
    return {
      markdown: response.document?.md_content ?? undefined,
      html: response.document?.html_content ?? undefined,
      text: response.document?.text_content ?? response.document?.md_content ?? undefined,
      json: response.document?.json_content,
      status: response.status,
      errors: response.errors,
      metadata: {
        title: response.document?.filename,
      },
    };
  }

  return response;
}

export interface DoclingHealthResponse {
  status: string;
  version?: string;
}

/**
 * Convert a document using DocLing
 */
export async function convertDocument(
  fileBuffer: Buffer,
  filename: string,
  options: DoclingConvertOptions = {}
): Promise<DoclingConvertResponse> {
  const formData = new FormData();
  
  const blob = new Blob([fileBuffer as unknown as BlobPart]);
  formData.append("files", blob, filename);
  formData.append("target_type", "inbody");
  formData.append("to_formats", toDoclingOutputFormat(options.outputFormat));
  if (options.ocr !== undefined) {
    formData.append("do_ocr", options.ocr.toString());
  }
  if (options.extractTables !== undefined) {
    formData.append("do_table_structure", options.extractTables.toString());
  }
  if (options.extractImages !== undefined) {
    formData.append("include_images", options.extractImages.toString());
  }
  if (options.pageRange) {
    formData.append("page_range", String(options.pageRange[0]));
    formData.append("page_range", String(options.pageRange[1]));
  }
  if (options.documentTimeoutSeconds !== undefined) {
    formData.append("document_timeout", options.documentTimeoutSeconds.toString());
  }

  const response = await fetch(`${DOCLING_URL}/v1/convert/file`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(120000), // 2 minutes for large documents
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocLing conversion failed: ${response.status} ${error}`);
  }

  return normalizeConvertResponse(await response.json());
}

/**
 * Convert document from URL
 */
export async function convertDocumentFromUrl(
  url: string,
  options: DoclingConvertOptions = {}
): Promise<DoclingConvertResponse> {
  // First download the document
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = url.split("/").pop() || "document.pdf";
  
  return convertDocument(buffer, filename, options);
}

/**
 * Extract text from document
 */
export async function extractText(
  fileBuffer: Buffer,
  filename: string,
  options: { ocr?: boolean } = {}
): Promise<{
  text: string;
  metadata: DoclingConvertResponse["metadata"];
}> {
  const result = await convertDocument(fileBuffer, filename, {
    outputFormat: "text",
    ocr: options.ocr ?? true,
  });

  return {
    text: result.text || result.markdown || "",
    metadata: result.metadata,
  };
}

/**
 * Process a downloaded RFP document
 */
export async function processRfpDocument(
  fileBuffer: Buffer,
  filename: string
): Promise<{
  markdown: string;
  text: string;
  metadata: DoclingConvertResponse["metadata"];
  tables: DoclingConvertResponse["tables"];
  pageCount?: number;
}> {
  const result = await convertDocument(fileBuffer, filename, {
    outputFormat: "markdown",
    ocr: true,
    extractTables: true,
    extractImages: false,
  });

  return {
    markdown: result.markdown || "",
    text: result.text || result.markdown || "",
    metadata: result.metadata,
    tables: result.tables,
    pageCount: result.metadata?.page_count,
  };
}

/**
 * Check DocLing health
 */
export async function checkDoclingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${DOCLING_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(filename: string): boolean {
  const supported = [
    ".pdf", ".docx", ".doc", ".pptx", ".ppt", 
    ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".tiff", ".html"
  ];
  const lower = filename.toLowerCase();
  return supported.some(ext => lower.endsWith(ext));
}
