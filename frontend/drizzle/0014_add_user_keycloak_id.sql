ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "keycloak_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "user_keycloak_id_unique" ON "user" ("keycloak_id");
CREATE INDEX IF NOT EXISTS "user_keycloak_idx" ON "user" ("keycloak_id");
