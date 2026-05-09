/**
 * Root setup file: load .env.local before any test imports a module that
 * reads `process.env` at load time (e.g. `@/lib/db`).
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(__dirname, "../.env.local") });
loadEnv({ path: resolve(__dirname, "../.env") });
