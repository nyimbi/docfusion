/**
 * Better Auth API Route Handler
 *
 * Handles all auth-related API requests (/api/auth/*)
 * including sign-in, sign-up, sign-out, session management.
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
