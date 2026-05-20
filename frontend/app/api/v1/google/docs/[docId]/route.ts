/**
 * Google Docs Fetch Route
 *
 * Fetches the content of a Google Doc and converts it to plain text
 * for template import analysis.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	isRouteSessionResponse,
	requireRouteSessionOr401,
} from "@/lib/auth/route-session";
import {
	getBoundGoogleTokens,
	setBoundGoogleTokenCookies,
} from "@/lib/google/bound-tokens";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

interface GoogleDocElement {
  paragraph?: {
    elements?: Array<{
      textRun?: {
        content?: string;
      };
    }>;
    paragraphStyle?: {
      namedStyleType?: string;
      headingId?: string;
    };
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: Array<GoogleDocElement>;
      }>;
    }>;
  };
  sectionBreak?: object;
}

interface GoogleDocContent {
  content?: GoogleDocElement[];
}

interface GoogleDoc {
  title?: string;
  body?: GoogleDocContent;
  documentStyle?: {
    pageSize?: {
      height?: { magnitude: number };
      width?: { magnitude: number };
    };
  };
}

interface GoogleDocSuccessCookieInput {
	sessionUserId: string;
	accessToken: string;
	refreshToken: string;
	userEmail?: string;
}

/**
 * Extract plain text from Google Docs JSON structure
 */
function extractTextFromDoc(doc: GoogleDoc): string {
  const lines: string[] = [];

  function processElement(element: GoogleDocElement) {
    if (element.paragraph) {
      const para = element.paragraph;
      let text = "";

      // Extract text content
      if (para.elements) {
        for (const elem of para.elements) {
          if (elem.textRun?.content) {
            text += elem.textRun.content;
          }
        }
      }

      // Handle heading styles
      const style = para.paragraphStyle?.namedStyleType;
      if (style) {
        if (style === "TITLE") {
          lines.push(`# ${text.trim()}`);
        } else if (style === "HEADING_1") {
          lines.push(`# ${text.trim()}`);
        } else if (style === "HEADING_2") {
          lines.push(`## ${text.trim()}`);
        } else if (style === "HEADING_3") {
          lines.push(`### ${text.trim()}`);
        } else if (style === "HEADING_4") {
          lines.push(`#### ${text.trim()}`);
        } else if (style === "HEADING_5") {
          lines.push(`##### ${text.trim()}`);
        } else if (style === "HEADING_6") {
          lines.push(`###### ${text.trim()}`);
        } else {
          lines.push(text);
        }
      } else {
        lines.push(text);
      }
    }

    if (element.table) {
      // Handle tables - convert to simple text representation
      const table = element.table;
      if (table.tableRows) {
        for (const row of table.tableRows) {
          const cells: string[] = [];
          if (row.tableCells) {
            for (const cell of row.tableCells) {
              let cellText = "";
              if (cell.content) {
                for (const content of cell.content) {
                  if (content.paragraph?.elements) {
                    for (const elem of content.paragraph.elements) {
                      if (elem.textRun?.content) {
                        cellText += elem.textRun.content.trim();
                      }
                    }
                  }
                }
              }
              cells.push(cellText);
            }
          }
          lines.push(`| ${cells.join(" | ")} |`);
        }
        lines.push("");
      }
    }
  }

  if (doc.body?.content) {
    for (const element of doc.body.content) {
      processElement(element);
    }
  }

  return lines.join("");
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

function createGoogleDocSuccessResponse(
	doc: GoogleDoc,
	refreshedToken?: GoogleDocSuccessCookieInput
): NextResponse {
	const content = extractTextFromDoc(doc);
	const response = NextResponse.json({
		success: true,
		title: doc.title || "Untitled Document",
		content,
		wordCount: content.split(/\s+/).filter(Boolean).length,
		characterCount: content.length,
	});

	if (refreshedToken) {
		setBoundGoogleTokenCookies(response, {
			sessionUserId: refreshedToken.sessionUserId,
			accessToken: refreshedToken.accessToken,
			refreshToken: refreshedToken.refreshToken,
			userEmail: refreshedToken.userEmail,
		});
	}

	return response;
}

function getGoogleDocApiUrl(docId: string): string {
	return `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const sessionResult = await requireRouteSessionOr401();
  if (isRouteSessionResponse(sessionResult)) {
    return sessionResult;
  }

  const { docId } = await params;

  if (!docId) {
    return NextResponse.json(
      { error: "Document ID is required" },
      { status: 400 }
    );
  }

  if (!GOOGLE_DOC_ID_PATTERN.test(docId)) {
    return NextResponse.json(
      { error: "Invalid Google document ID" },
      { status: 400 }
    );
  }

  const tokens = getBoundGoogleTokens(request, sessionResult.session.user.id);
  let accessToken = tokens?.accessToken;
  const refreshToken = tokens?.refreshToken;
  let refreshedAccessToken: string | undefined;

  // If no access token but have refresh token, try to refresh
  if (!accessToken && refreshToken) {
    refreshedAccessToken = await refreshAccessToken(refreshToken) || undefined;
    accessToken = refreshedAccessToken;
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Not authenticated with Google",
        code: "NOT_AUTHENTICATED",
        message: "Please connect your Google account first",
      },
      { status: 401 }
    );
  }

  try {
    // Fetch the document from Google Docs API
    const docResponse = await fetch(
      getGoogleDocApiUrl(docId),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!docResponse.ok) {
      const errorData = await docResponse.json().catch(() => ({}));

      // Handle specific error cases
      if (docResponse.status === 401) {
        // Token expired, try to refresh
        if (refreshToken) {
          const newToken = await refreshAccessToken(refreshToken);
          if (newToken) {
            // Retry with new token
            const retryResponse = await fetch(
              getGoogleDocApiUrl(docId),
              {
                headers: {
                  Authorization: `Bearer ${newToken}`,
                },
              }
            );

            if (retryResponse.ok) {
              const doc = await retryResponse.json();
              return createGoogleDocSuccessResponse(doc, {
                sessionUserId: sessionResult.session.user.id,
                accessToken: newToken,
                refreshToken,
                userEmail: tokens?.userEmail,
              });
            }
          }
        }

        return NextResponse.json(
          {
            error: "Google authentication expired",
            code: "TOKEN_EXPIRED",
            message: "Please reconnect your Google account",
          },
          { status: 401 }
        );
      }

      if (docResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Access denied",
            code: "ACCESS_DENIED",
            message: "You don't have permission to access this document. Make sure the document is shared with your Google account.",
          },
          { status: 403 }
        );
      }

      if (docResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Document not found",
            code: "NOT_FOUND",
            message: "The document could not be found. Please check the URL and try again.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch document",
          code: "FETCH_FAILED",
          message: errorData.error?.message || "Unknown error",
        },
        { status: docResponse.status }
      );
    }

    const doc: GoogleDoc = await docResponse.json();
    return createGoogleDocSuccessResponse(
      doc,
      refreshedAccessToken && refreshToken
        ? {
            sessionUserId: sessionResult.session.user.id,
            accessToken: refreshedAccessToken,
            refreshToken,
            userEmail: tokens?.userEmail,
          }
        : undefined
    );
  } catch (error) {
    console.error("Error fetching Google Doc:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch document",
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
