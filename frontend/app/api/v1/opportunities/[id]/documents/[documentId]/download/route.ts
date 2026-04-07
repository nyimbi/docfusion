/**
 * Document Download API Route
 * 
 * Serves downloaded RFP documents from local storage.
 * Authenticates the user and serves the file with proper headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDocumentFile } from "@/lib/services/rfp-document-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    // Verify authentication using Better Auth API
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { documentId } = await params;
    
    // Get file from storage
    const file = await getDocumentFile(documentId);
    
    if (!file) {
      return new NextResponse("Document not found or not downloaded", { status: 404 });
    }

    // Create response with file (convert Buffer to Uint8Array for NextResponse)
    const response = new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
        "Content-Length": file.buffer.length.toString(),
      },
    });

    return response;
  } catch (error) {
    console.error("Failed to serve document:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
