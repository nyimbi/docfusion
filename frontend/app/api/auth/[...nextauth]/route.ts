/**
 * Next-Auth API Route Handler
 *
 * Handles all auth-related API requests (/api/auth/*)
 * including sign-in, callback, sign-out, session management.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
