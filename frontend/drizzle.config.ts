import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./lib/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ||
			"postgresql://azureuser:Abcd1234.@lindela16.postgres.database.azure.com:5432/docfusion?sslmode=require",
		ssl: true,
	},
	verbose: true,
	strict: true,
});
