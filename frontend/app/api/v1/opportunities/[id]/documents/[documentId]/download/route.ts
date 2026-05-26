/**
 * Document Download API Route
 *
 * Serves downloaded RFP documents from server-side storage.
 * Authenticates the user and serves the file with proper headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
	getOpportunityDocumentFileForActor,
	OpportunityDocumentAccessError,
} from "@/lib/services/rfp-document-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    // Verify authentication using Better Auth API
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

	    const { id, documentId } = await params;
	    
	    // Get file from storage
	    const file = await getOpportunityDocumentFileForActor({
	      userId: session.user.id,
	      role: (session.user as { role?: string }).role,
	      roles: (session.user as { roles?: string[] }).roles,
	    }, id, documentId);
    
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
	    if (error instanceof OpportunityDocumentAccessError) {
	      return new NextResponse(error.message, { status: error.status });
	    }
	    console.error("Failed to serve document:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
