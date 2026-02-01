/**
 * Database Seed Script - DocFusion
 *
 * Initializes the database with:
 * 1. Datacraft organization
 * 2. Admin user (if specified)
 * 3. Base templates
 * 4. Default settings
 */

import { db } from "@/lib/db";
import { organization, user, templates, templateCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PREMIUM_TEMPLATE_INPUTS } from "@/lib/data/templates-data";

// ============================================================================
// Seed Configuration
// ============================================================================

const SEED_CONFIG = {
	// Organization details
	organization: {
		name: "Datacraft",
		slug: "datacraft",
		description: "Datacraft Consulting & Technology",
		website: "https://datacraft.co.za",
		industry: "Technology & Consulting",
		size: "small",
		location: "South Africa",
		contactEmail: "info@datacraft.co.za",
		settings: {
			branding: {
				primaryColor: "#3b82f6",
				secondaryColor: "#10b981",
			},
		},
	},
	
	// Template categories
	categories: [
		{ id: crypto.randomUUID(), name: "Government RFPs", slug: "government-rfps", description: "Federal, state, and local government proposals", order: 1 },
		{ id: crypto.randomUUID(), name: "Business Proposals", slug: "business-proposals", description: "Sales, partnerships, and consulting proposals", order: 2 },
		{ id: crypto.randomUUID(), name: "Technical Documents", slug: "technical", description: "Architecture, specs, SOWs, and technical documentation", order: 3 },
		{ id: crypto.randomUUID(), name: "Legal & Contracts", slug: "legal", description: "Agreements, policies, and legal documents", order: 4 },
		{ id: crypto.randomUUID(), name: "Marketing & PR", slug: "marketing", description: "Press releases, whitepapers, and marketing content", order: 5 },
		{ id: crypto.randomUUID(), name: "HR & Internal", slug: "hr-internal", description: "Policies, handbooks, and internal documents", order: 6 },
		{ id: crypto.randomUUID(), name: "Business Planning", slug: "business-planning", description: "Strategic plans, financial models, and business analysis", order: 7 },
	],
};

// ============================================================================
// Seed Functions
// ============================================================================

/**
 * Seed the Datacraft organization
 */
async function seedOrganization() {
	console.log("🔧 Seeding Datacraft organization...");
	
	const existingOrg = await db.query.organization.findFirst({
		where: eq(organization.slug, "datacraft"),
	});
	
	if (existingOrg) {
		console.log("✅ Datacraft organization already exists");
		return existingOrg.id;
	}
	
	const orgId = crypto.randomUUID();
	await db.insert(organization).values({
		id: orgId,
		...SEED_CONFIG.organization,
		isActive: true,
	});
	
	console.log("✅ Created Datacraft organization");
	return orgId;
}

/**
 * Seed template categories
 */
async function seedCategories() {
	console.log("📂 Seeding template categories...");
	
	const existingCategories = await db.query.templateCategories.findMany();
	
	if (existingCategories.length > 0) {
		console.log(`✅ ${existingCategories.length} categories already exist`);
		return existingCategories.map((c) => c.id);
	}
	
	await db.insert(templateCategories).values(SEED_CONFIG.categories);
	
	console.log("✅ Created template categories");
	return SEED_CONFIG.categories.map((c) => c.id);
}

/**
 * Seed premium templates
 */
async function seedTemplates(categoryIds: string[], orgId: string) {
	console.log("📄 Seeding premium templates...");
	
	const existingTemplates = await db.query.templates.findMany({
		limit: 1,
	});
	
	if (existingTemplates.length > 0) {
		console.log("✅ Templates already seeded");
		return;
	}
	
	// Map templates to categories
	const categoryMap: Record<string, string> = {
		"Government RFPs": categoryIds[0],
		"Business Proposals": categoryIds[1],
		"Technical Documents": categoryIds[2],
		"Legal & Contracts": categoryIds[3],
		"Marketing & PR": categoryIds[4],
		"HR & Internal": categoryIds[5],
		"Business Planning": categoryIds[6],
	};
	
	// Add templates
	const templatesToInsert = PREMIUM_TEMPLATE_INPUTS.map((template) => {
		// Determine category based on tags
		let categoryId = categoryIds[0]; // Default to first category
		const tags = template.tags ?? [];

		if (tags.includes("government") || tags.includes("far")) {
			categoryId = categoryIds[0];
		} else if (tags.includes("business") || tags.includes("sales")) {
			categoryId = categoryIds[1];
		} else if (tags.includes("technical") || tags.includes("architecture")) {
			categoryId = categoryIds[2];
		} else if (tags.includes("legal") || tags.includes("contract")) {
			categoryId = categoryIds[3];
		} else if (tags.includes("marketing")) {
			categoryId = categoryIds[4];
		} else if (tags.includes("hr") || tags.includes("internal")) {
			categoryId = categoryIds[5];
		} else if (template.name.toLowerCase().includes("business") || 
			template.name.toLowerCase().includes("financial") ||
			template.name.toLowerCase().includes("strategic")) {
			categoryId = categoryIds[6];
		}
		
		return {
			id: crypto.randomUUID(),
			name: template.name,
			description: template.description,
			content: template.content,
			status: "published",
			visibility: "public",
			createdBy: orgId, // Use org as creator
			categoryIds: [categoryId],
			tags: template.tags,
			placeholders: template.placeholders || [],
			aiInstructions: template.aiInstructions || [],
			complianceRequirements: template.complianceRequirements || [],
			estimatedTime: template.estimatedTime || 60,
			difficulty: template.difficulty || "intermediate",
		};
	});
	
	// Insert in batches to avoid overwhelming the database
	const batchSize = 10;
	for (let i = 0; i < templatesToInsert.length; i += batchSize) {
		const batch = templatesToInsert.slice(i, i + batchSize);
		await db.insert(templates).values(batch);
		console.log(`✅ Inserted batch ${i / batchSize + 1}/${Math.ceil(templatesToInsert.length / batchSize)}`);
	}
	
	console.log(`✅ Seeded ${templatesToInsert.length} templates`);
}

/**
 * Main seed function
 */
export async function seedDatabase(adminEmail?: string, adminPassword?: string) {
	try {
		console.log("🌱 Starting database seed...\n");
		
		// 1. Seed organization
		const orgId = await seedOrganization();
		
		// 2. Seed categories
		const categoryIds = await seedCategories();
		
		// 3. Seed templates
		await seedTemplates(categoryIds, orgId);
		
		console.log("\n✅ Database seed completed successfully!");
		return { orgId, categoryIds };
	} catch (error) {
		console.error("❌ Database seed failed:", error);
		throw error;
	}
}

// ============================================================================
// CLI Execution
// ============================================================================

if (require.main === module) {
	// Run seed when executed directly
	const args = process.argv.slice(2);
	const adminEmail = args.find((arg) => arg.startsWith("--email="))?.replace("--email=", "");
	const adminPassword = args.find((arg) => arg.startsWith("--password="))?.replace("--password=", "");
	
	seedDatabase(adminEmail, adminPassword)
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
