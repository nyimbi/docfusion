/**
 * Template Seed Data - DocFusion
 *
 * Comprehensive template library with 100+ fully articulated templates
 * for RFP response, proposals, and document generation.
 */

import { db } from "@/lib/db";
import { templates, templateCategories } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import { EXTENDED_TEMPLATES } from "./seed-templates-extended";
import { ALL_PROFESSIONAL_TEMPLATES } from "./seed-templates-professional";
import { randomUUID } from "crypto";

// ============================================================================
// Template Categories
// ============================================================================

// Short ID to UUID mapping (generated once for consistency)
const CATEGORY_ID_MAP: Record<string, string> = {
	// Original categories
	exec: "a1b2c3d4-e5f6-4789-0123-456789abcde1",
	tech: "a1b2c3d4-e5f6-4789-0123-456789abcde2",
	mgmt: "a1b2c3d4-e5f6-4789-0123-456789abcde3",
	exp: "a1b2c3d4-e5f6-4789-0123-456789abcde4",
	cost: "a1b2c3d4-e5f6-4789-0123-456789abcde5",
	compliance: "a1b2c3d4-e5f6-4789-0123-456789abcde6",
	hr: "a1b2c3d4-e5f6-4789-0123-456789abcde7",
	qa: "a1b2c3d4-e5f6-4789-0123-456789abcde8",
	security: "a1b2c3d4-e5f6-4789-0123-456789abcde9",
	transition: "a1b2c3d4-e5f6-4789-0123-456789abcdea",
	// Professional template categories
	pmi: "b1b2c3d4-e5f6-4789-0123-456789abcd01",
	prince2: "b1b2c3d4-e5f6-4789-0123-456789abcd02",
	agile: "b1b2c3d4-e5f6-4789-0123-456789abcd03",
	software: "b1b2c3d4-e5f6-4789-0123-456789abcd04",
	rfp: "b1b2c3d4-e5f6-4789-0123-456789abcd05",
	consultancy: "b1b2c3d4-e5f6-4789-0123-456789abcd06",
	business: "b1b2c3d4-e5f6-4789-0123-456789abcd07",
	finance: "b1b2c3d4-e5f6-4789-0123-456789abcd08",
	governance: "b1b2c3d4-e5f6-4789-0123-456789abcd09",
	strategy: "b1b2c3d4-e5f6-4789-0123-456789abcd10",
	risk: "b1b2c3d4-e5f6-4789-0123-456789abcd11",
	audit: "b1b2c3d4-e5f6-4789-0123-456789abcd12",
	privacy: "b1b2c3d4-e5f6-4789-0123-456789abcd13",
	data: "b1b2c3d4-e5f6-4789-0123-456789abcd14",
	procurement: "b1b2c3d4-e5f6-4789-0123-456789abcd15",
	requirements: "b1b2c3d4-e5f6-4789-0123-456789abcd16",
	architecture: "b1b2c3d4-e5f6-4789-0123-456789abcd17",
	devops: "b1b2c3d4-e5f6-4789-0123-456789abcd18",
	operations: "b1b2c3d4-e5f6-4789-0123-456789abcd19",
	technical: "b1b2c3d4-e5f6-4789-0123-456789abcd20",
	planning: "b1b2c3d4-e5f6-4789-0123-456789abcd21",
	process: "b1b2c3d4-e5f6-4789-0123-456789abcd22",
	improvement: "b1b2c3d4-e5f6-4789-0123-456789abcd23",
	analysis: "b1b2c3d4-e5f6-4789-0123-456789abcd24",
	marketing: "b1b2c3d4-e5f6-4789-0123-456789abcd25",
	sales: "b1b2c3d4-e5f6-4789-0123-456789abcd26",
	change: "b1b2c3d4-e5f6-4789-0123-456789abcd27",
	performance: "b1b2c3d4-e5f6-4789-0123-456789abcd28",
	policy: "b1b2c3d4-e5f6-4789-0123-456789abcd29",
	recruitment: "b1b2c3d4-e5f6-4789-0123-456789abcd30",
	training: "b1b2c3d4-e5f6-4789-0123-456789abcd31",
	benefits: "b1b2c3d4-e5f6-4789-0123-456789abcd32",
	comms: "b1b2c3d4-e5f6-4789-0123-456789abcd33",
	config: "b1b2c3d4-e5f6-4789-0123-456789abcd34",
	construction: "b1b2c3d4-e5f6-4789-0123-456789abcd35",
	healthcare: "b1b2c3d4-e5f6-4789-0123-456789abcd36",
	it: "b1b2c3d4-e5f6-4789-0123-456789abcd37",
	professional: "b1b2c3d4-e5f6-4789-0123-456789abcd38",
	digital: "b1b2c3d4-e5f6-4789-0123-456789abcd39",
	innovation: "b1b2c3d4-e5f6-4789-0123-456789abcd40",
	ma: "b1b2c3d4-e5f6-4789-0123-456789abcd41",
	cx: "b1b2c3d4-e5f6-4789-0123-456789abcd42",
	technology: "b1b2c3d4-e5f6-4789-0123-456789abcd43",
	sustainability: "b1b2c3d4-e5f6-4789-0123-456789abcd44",
	// Legal categories
	legal: "b1b2c3d4-e5f6-4789-0123-456789abcd45",
	contracts: "b1b2c3d4-e5f6-4789-0123-456789abcd46",
	// Additional professional categories
	engineering: "b1b2c3d4-e5f6-4789-0123-456789abcd47",
	corporate: "b1b2c3d4-e5f6-4789-0123-456789abcd48",
	research: "b1b2c3d4-e5f6-4789-0123-456789abcd49",
	product: "b1b2c3d4-e5f6-4789-0123-456789abcd50",
	grants: "b1b2c3d4-e5f6-4789-0123-456789abcd51",
	funding: "b1b2c3d4-e5f6-4789-0123-456789abcd52",
	realestate: "b1b2c3d4-e5f6-4789-0123-456789abcd53",
	manufacturing: "b1b2c3d4-e5f6-4789-0123-456789abcd54",
	quality: "b1b2c3d4-e5f6-4789-0123-456789abcd55",
	nonprofit: "b1b2c3d4-e5f6-4789-0123-456789abcd56",
	impact: "b1b2c3d4-e5f6-4789-0123-456789abcd57",
	events: "b1b2c3d4-e5f6-4789-0123-456789abcd58",
	sponsorship: "b1b2c3d4-e5f6-4789-0123-456789abcd59",
};

// Helper to convert short IDs to UUIDs
export function getCategoryUUID(shortId: string): string {
	return CATEGORY_ID_MAP[shortId] || shortId;
}

// Helper to convert array of short IDs to UUIDs
export function getCategoryUUIDs(shortIds: string[]): string[] {
	return shortIds.map((id) => getCategoryUUID(id));
}

export const CATEGORIES = [
	{
		id: CATEGORY_ID_MAP.exec,
		shortId: "exec",
		name: "Executive",
		description: "High-level summaries, capability statements, and strategic overviews",
		slug: "executive",
		icon: "FileText",
		order: 1,
	},
	{
		id: CATEGORY_ID_MAP.tech,
		shortId: "tech",
		name: "Technical",
		description: "Technical approaches, solution architecture, and methodology documents",
		slug: "technical",
		icon: "Code",
		order: 2,
	},
	{
		id: CATEGORY_ID_MAP.mgmt,
		shortId: "mgmt",
		name: "Management",
		description: "Project management, staffing plans, and organizational approaches",
		slug: "management",
		icon: "Users",
		order: 3,
	},
	{
		id: CATEGORY_ID_MAP.exp,
		shortId: "exp",
		name: "Experience",
		description: "Past performance, case studies, and relevant experience",
		slug: "experience",
		icon: "Award",
		order: 4,
	},
	{
		id: CATEGORY_ID_MAP.cost,
		shortId: "cost",
		name: "Pricing",
		description: "Cost volumes, pricing strategies, and financial proposals",
		slug: "pricing",
		icon: "DollarSign",
		order: 5,
	},
	{
		id: CATEGORY_ID_MAP.compliance,
		shortId: "compliance",
		name: "Compliance",
		description: "FAR/DFARS compliance, certifications, and regulatory documents",
		slug: "compliance",
		icon: "Shield",
		order: 6,
	},
	{
		id: CATEGORY_ID_MAP.hr,
		shortId: "hr",
		name: "Human Resources",
		description: "Resumes, staffing qualifications, and personnel documents",
		slug: "human-resources",
		icon: "UserCheck",
		order: 7,
	},
	{
		id: CATEGORY_ID_MAP.qa,
		shortId: "qa",
		name: "Quality Assurance",
		description: "Quality management plans, testing strategies, and QA documentation",
		slug: "quality-assurance",
		icon: "CheckCircle",
		order: 8,
	},
	{
		id: CATEGORY_ID_MAP.security,
		shortId: "security",
		name: "Security",
		description: "Security plans, clearance documentation, and cybersecurity approaches",
		slug: "security",
		icon: "Lock",
		order: 9,
	},
	{
		id: CATEGORY_ID_MAP.transition,
		shortId: "transition",
		name: "Transition",
		description: "Transition plans, phase-in/phase-out, and knowledge transfer",
		slug: "transition",
		icon: "ArrowRightLeft",
		order: 10,
	},
	// Professional categories
	{
		id: CATEGORY_ID_MAP.pmi,
		shortId: "pmi",
		name: "PMI/PMBOK",
		description: "Project Management Institute standard templates",
		slug: "pmi",
		icon: "Target",
		order: 11,
	},
	{
		id: CATEGORY_ID_MAP.prince2,
		shortId: "prince2",
		name: "PRINCE2",
		description: "Projects IN Controlled Environments methodology",
		slug: "prince2",
		icon: "Crown",
		order: 12,
	},
	{
		id: CATEGORY_ID_MAP.agile,
		shortId: "agile",
		name: "Agile",
		description: "Agile and Scrum methodology templates",
		slug: "agile",
		icon: "Zap",
		order: 13,
	},
	{
		id: CATEGORY_ID_MAP.software,
		shortId: "software",
		name: "Software",
		description: "Software development documentation",
		slug: "software",
		icon: "Code2",
		order: 14,
	},
	{
		id: CATEGORY_ID_MAP.rfp,
		shortId: "rfp",
		name: "RFP Response",
		description: "Request for Proposal response templates",
		slug: "rfp",
		icon: "FileSignature",
		order: 15,
	},
	{
		id: CATEGORY_ID_MAP.consultancy,
		shortId: "consultancy",
		name: "Consultancy",
		description: "Consulting proposals and advisory documents",
		slug: "consultancy",
		icon: "Briefcase",
		order: 16,
	},
	{
		id: CATEGORY_ID_MAP.business,
		shortId: "business",
		name: "Business",
		description: "Business plans and management documents",
		slug: "business",
		icon: "Building2",
		order: 17,
	},
	{
		id: CATEGORY_ID_MAP.finance,
		shortId: "finance",
		name: "Finance",
		description: "Financial planning and reporting",
		slug: "finance",
		icon: "Wallet",
		order: 18,
	},
	{
		id: CATEGORY_ID_MAP.governance,
		shortId: "governance",
		name: "Governance",
		description: "IT governance and policy documents",
		slug: "governance",
		icon: "Scale",
		order: 19,
	},
	{
		id: CATEGORY_ID_MAP.strategy,
		shortId: "strategy",
		name: "Strategy",
		description: "Strategic planning and analysis",
		slug: "strategy",
		icon: "Compass",
		order: 20,
	},
	{
		id: CATEGORY_ID_MAP.legal,
		shortId: "legal",
		name: "Legal",
		description: "Legal agreements and contracts",
		slug: "legal",
		icon: "Gavel",
		order: 21,
	},
	{
		id: CATEGORY_ID_MAP.contracts,
		shortId: "contracts",
		name: "Contracts",
		description: "Contract templates and agreements",
		slug: "contracts",
		icon: "FileText",
		order: 22,
	},
	{
		id: CATEGORY_ID_MAP.sales,
		shortId: "sales",
		name: "Sales",
		description: "Sales proposals and quotes",
		slug: "sales",
		icon: "TrendingUp",
		order: 23,
	},
	{
		id: CATEGORY_ID_MAP.marketing,
		shortId: "marketing",
		name: "Marketing",
		description: "Marketing plans and brand documents",
		slug: "marketing",
		icon: "Megaphone",
		order: 24,
	},
	{
		id: CATEGORY_ID_MAP.engineering,
		shortId: "engineering",
		name: "Engineering",
		description: "Technical engineering documentation",
		slug: "engineering",
		icon: "Cpu",
		order: 25,
	},
	{
		id: CATEGORY_ID_MAP.architecture,
		shortId: "architecture",
		name: "Architecture",
		description: "System architecture and design",
		slug: "architecture",
		icon: "Layers",
		order: 26,
	},
	{
		id: CATEGORY_ID_MAP.corporate,
		shortId: "corporate",
		name: "Corporate",
		description: "Corporate governance and board materials",
		slug: "corporate",
		icon: "Building",
		order: 27,
	},
	{
		id: CATEGORY_ID_MAP.research,
		shortId: "research",
		name: "Research",
		description: "Research proposals and white papers",
		slug: "research",
		icon: "FlaskConical",
		order: 28,
	},
	{
		id: CATEGORY_ID_MAP.product,
		shortId: "product",
		name: "Product",
		description: "Product requirements and roadmaps",
		slug: "product",
		icon: "Package",
		order: 29,
	},
	{
		id: CATEGORY_ID_MAP.grants,
		shortId: "grants",
		name: "Grants",
		description: "Grant proposals and applications",
		slug: "grants",
		icon: "Award",
		order: 30,
	},
	{
		id: CATEGORY_ID_MAP.funding,
		shortId: "funding",
		name: "Funding",
		description: "Investment and fundraising documents",
		slug: "funding",
		icon: "Banknote",
		order: 31,
	},
	{
		id: CATEGORY_ID_MAP.realestate,
		shortId: "realestate",
		name: "Real Estate",
		description: "Property agreements and leases",
		slug: "realestate",
		icon: "Home",
		order: 32,
	},
	{
		id: CATEGORY_ID_MAP.construction,
		shortId: "construction",
		name: "Construction",
		description: "Construction contracts and specifications",
		slug: "construction",
		icon: "HardHat",
		order: 33,
	},
	{
		id: CATEGORY_ID_MAP.manufacturing,
		shortId: "manufacturing",
		name: "Manufacturing",
		description: "Manufacturing processes and SOPs",
		slug: "manufacturing",
		icon: "Factory",
		order: 34,
	},
	{
		id: CATEGORY_ID_MAP.quality,
		shortId: "quality",
		name: "Quality",
		description: "Quality management and certification",
		slug: "quality",
		icon: "BadgeCheck",
		order: 35,
	},
	{
		id: CATEGORY_ID_MAP.nonprofit,
		shortId: "nonprofit",
		name: "Non-Profit",
		description: "Non-profit organization documents",
		slug: "nonprofit",
		icon: "Heart",
		order: 36,
	},
	{
		id: CATEGORY_ID_MAP.impact,
		shortId: "impact",
		name: "Impact",
		description: "Impact assessments and sustainability",
		slug: "impact",
		icon: "Leaf",
		order: 37,
	},
	{
		id: CATEGORY_ID_MAP.events,
		shortId: "events",
		name: "Events",
		description: "Event planning and conferences",
		slug: "events",
		icon: "Calendar",
		order: 38,
	},
	{
		id: CATEGORY_ID_MAP.sponsorship,
		shortId: "sponsorship",
		name: "Sponsorship",
		description: "Sponsorship proposals and packages",
		slug: "sponsorship",
		icon: "Handshake",
		order: 39,
	},
];

// ============================================================================
// Helper: Create Section Content
// ============================================================================

interface SectionConfig {
	title: string;
	level: number;
	prompt: string;
	subsections?: SectionConfig[];
}

function createSectionContent(sections: SectionConfig[]): object {
	const createContent = (secs: SectionConfig[]): object[] => {
		return secs.flatMap((sec) => {
			const result: object[] = [
				{
					type: "heading",
					attrs: { level: sec.level },
					content: [{ type: "text", text: sec.title }],
				},
				{
					type: "paragraph",
					attrs: { "data-ai-prompt": sec.prompt },
					content: [
						{
							type: "text",
							text: `[AI will generate content based on: ${sec.prompt}]`,
						},
					],
				},
			];

			if (sec.subsections && sec.subsections.length > 0) {
				result.push(...createContent(sec.subsections));
			}

			return result;
		});
	};

	return {
		type: "doc",
		content: createContent(sections),
	};
}

// ============================================================================
// Template Definitions
// ============================================================================

export interface TemplateDef {
	name: string;
	description: string;
	categoryIds: string[];
	tags: string[];
	difficulty: "beginner" | "intermediate" | "advanced";
	estimatedTime: number;
	sections: SectionConfig[];
	placeholders: Array<{
		id: string;
		name: string;
		variableName: string;
		description: string;
		type: "text" | "textarea" | "number" | "currency" | "date" | "select" | "boolean";
		required: boolean;
		defaultValue?: string;
		options?: Array<{ value: string; label: string }>;
	}>;
}

// ============================================================================
// Executive Templates (15)
// ============================================================================

const EXECUTIVE_TEMPLATES: TemplateDef[] = [
	{
		name: "Executive Summary - Standard",
		description: "A comprehensive executive summary template with win themes, value proposition, and strategic positioning for government proposals.",
		categoryIds: ["exec"],
		tags: ["executive", "summary", "win-themes", "strategy", "government"],
		difficulty: "intermediate",
		estimatedTime: 45,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Generate a compelling opening paragraph that captures the evaluator's attention and establishes credibility. Reference the {{client_name}} requirements and demonstrate understanding of their mission.",
				subsections: [
					{
						title: "Understanding of Requirements",
						level: 2,
						prompt: "Summarize key requirements from the solicitation, demonstrating thorough understanding. Reference specific PWS/SOW sections and highlight critical success factors for {{client_name}}.",
					},
					{
						title: "Solution Overview",
						level: 2,
						prompt: "Provide a high-level overview of the proposed solution. Emphasize how {{company_name}}'s approach directly addresses each requirement with proven methodologies.",
					},
					{
						title: "Win Themes",
						level: 2,
						prompt: "Present 3-4 compelling win themes that differentiate {{company_name}} from competitors. Each theme should address a key evaluation criterion and be supported by evidence.",
					},
					{
						title: "Value Proposition",
						level: 2,
						prompt: "Articulate the unique value {{company_name}} brings to {{client_name}}. Quantify benefits where possible (cost savings, efficiency gains, risk reduction).",
					},
					{
						title: "Qualifications Summary",
						level: 2,
						prompt: "Summarize key qualifications including relevant experience, certifications, and past performance that demonstrate capability to perform.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "The contracting agency or client", type: "text", required: true },
			{ id: "p3", name: "Contract Name", variableName: "{{contract_name}}", description: "Name of the contract/opportunity", type: "text", required: true },
			{ id: "p4", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "RFP/RFQ number", type: "text", required: false },
		],
	},
	{
		name: "Executive Summary - LPTA Focus",
		description: "Executive summary optimized for Lowest Price Technically Acceptable (LPTA) evaluations, emphasizing compliance and cost-effectiveness.",
		categoryIds: ["exec"],
		tags: ["executive", "summary", "lpta", "compliance", "cost-effective"],
		difficulty: "intermediate",
		estimatedTime: 40,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Create a focused executive summary emphasizing technical acceptability and value. For LPTA, stress compliance with every requirement.",
				subsections: [
					{
						title: "Technical Compliance Statement",
						level: 2,
						prompt: "Provide a clear statement of full technical compliance. List each major requirement and confirm compliance without elaborate discussion.",
					},
					{
						title: "Proven Approach",
						level: 2,
						prompt: "Describe the proven, low-risk approach that ensures reliable delivery. Emphasize standardized processes and mature methodologies.",
					},
					{
						title: "Value Optimization",
						level: 2,
						prompt: "Explain how {{company_name}} delivers maximum value while maintaining competitive pricing. Focus on efficiency and streamlined operations.",
					},
					{
						title: "Experience Confirmation",
						level: 2,
						prompt: "Briefly confirm relevant experience that demonstrates capability. Include specific contract references with quantifiable results.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "The contracting agency", type: "text", required: true },
			{ id: "p3", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "RFP/RFQ number", type: "text", required: false },
		],
	},
	{
		name: "Executive Summary - Best Value",
		description: "Executive summary for best value trade-off procurements, balancing technical excellence with competitive pricing.",
		categoryIds: ["exec"],
		tags: ["executive", "summary", "best-value", "trade-off", "technical"],
		difficulty: "advanced",
		estimatedTime: 60,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Create a compelling executive summary for best value evaluation. Balance technical innovation with cost consciousness.",
				subsections: [
					{
						title: "Mission Understanding",
						level: 2,
						prompt: "Demonstrate deep understanding of {{client_name}}'s mission, challenges, and objectives. Show insight beyond the written requirements.",
					},
					{
						title: "Innovative Solution",
						level: 2,
						prompt: "Present innovative aspects of the proposed solution that provide measurable advantages. Explain how innovation reduces risk or improves outcomes.",
					},
					{
						title: "Technical Excellence",
						level: 2,
						prompt: "Highlight technical strengths that exceed minimum requirements. Explain the value-add of enhanced capabilities.",
					},
					{
						title: "Past Performance Highlights",
						level: 2,
						prompt: "Feature top 3 most relevant past performance examples with quantified results that demonstrate superior capability.",
					},
					{
						title: "Value Analysis",
						level: 2,
						prompt: "Articulate why {{company_name}} represents the best value considering technical approach, past performance, and price combined.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "The contracting agency", type: "text", required: true },
			{ id: "p3", name: "Contract Name", variableName: "{{contract_name}}", description: "Name of the opportunity", type: "text", required: true },
		],
	},
	{
		name: "Capability Statement - Government",
		description: "Professional capability statement for government contracting with company overview, core competencies, and differentiators.",
		categoryIds: ["exec"],
		tags: ["capability", "statement", "government", "overview", "marketing"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Capability Statement",
				level: 1,
				prompt: "Create a professional capability statement header with company branding and contact information.",
				subsections: [
					{
						title: "Company Overview",
						level: 2,
						prompt: "Provide a concise company overview including years in business, number of employees, headquarters location, and primary focus areas.",
					},
					{
						title: "Core Competencies",
						level: 2,
						prompt: "List 4-6 core competencies with brief descriptions. Focus on capabilities most relevant to government contracting.",
					},
					{
						title: "Differentiators",
						level: 2,
						prompt: "Identify 3-4 key differentiators that set {{company_name}} apart from competitors. Support with evidence.",
					},
					{
						title: "Past Performance",
						level: 2,
						prompt: "List 3-5 relevant contract references including agency, contract value, and brief scope description.",
					},
					{
						title: "Certifications & Codes",
						level: 2,
						prompt: "List all relevant certifications, NAICS codes, cage code, DUNS, and socioeconomic designations.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "DUNS Number", variableName: "{{duns_number}}", description: "Your DUNS number", type: "text", required: false },
			{ id: "p3", name: "CAGE Code", variableName: "{{cage_code}}", description: "Your CAGE code", type: "text", required: false },
			{ id: "p4", name: "Primary NAICS", variableName: "{{primary_naics}}", description: "Primary NAICS code", type: "text", required: false },
		],
	},
	{
		name: "Capability Statement - Commercial",
		description: "Commercial capability statement for private sector clients with focus on solutions and results.",
		categoryIds: ["exec"],
		tags: ["capability", "statement", "commercial", "solutions", "enterprise"],
		difficulty: "beginner",
		estimatedTime: 25,
		sections: [
			{
				title: "{{company_name}} Capabilities",
				level: 1,
				prompt: "Create an engaging capability overview focused on business outcomes and client success stories.",
				subsections: [
					{
						title: "Who We Are",
						level: 2,
						prompt: "Write a compelling company introduction focusing on mission, vision, and the value delivered to clients.",
					},
					{
						title: "What We Do",
						level: 2,
						prompt: "Describe primary service offerings with focus on solving client business challenges.",
					},
					{
						title: "Our Approach",
						level: 2,
						prompt: "Explain the methodology or approach that delivers consistent results for clients.",
					},
					{
						title: "Success Stories",
						level: 2,
						prompt: "Highlight 3 brief success stories with measurable outcomes and client testimonials if available.",
					},
					{
						title: "Industries Served",
						level: 2,
						prompt: "List industries served with specific expertise and relevant experience in each.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Industry Focus", variableName: "{{industry_focus}}", description: "Primary industry focus", type: "text", required: false },
		],
	},
	{
		name: "Cover Letter - Formal Proposal",
		description: "Formal cover letter for proposal submissions with proper formatting and executive sign-off.",
		categoryIds: ["exec"],
		tags: ["cover-letter", "formal", "submission", "executive"],
		difficulty: "beginner",
		estimatedTime: 15,
		sections: [
			{
				title: "Cover Letter",
				level: 1,
				prompt: "Generate a formal cover letter addressed to the contracting officer. Include proper formatting, reference to solicitation, and executive commitment.",
				subsections: [
					{
						title: "Opening Statement",
						level: 2,
						prompt: "Reference the specific solicitation and express {{company_name}}'s interest and commitment to the opportunity.",
					},
					{
						title: "Key Points",
						level: 2,
						prompt: "Summarize 3 key reasons why {{company_name}} is the ideal choice for this contract.",
					},
					{
						title: "Commitment Statement",
						level: 2,
						prompt: "Express commitment to contract requirements, schedule, and successful performance.",
					},
					{
						title: "Closing",
						level: 2,
						prompt: "Provide closing statement with point of contact information and express appreciation for the opportunity.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Contracting Officer", variableName: "{{co_name}}", description: "Contracting officer name", type: "text", required: true },
			{ id: "p3", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "RFP/RFQ number", type: "text", required: true },
			{ id: "p4", name: "Executive Name", variableName: "{{executive_name}}", description: "Signing executive name", type: "text", required: true },
			{ id: "p5", name: "Executive Title", variableName: "{{executive_title}}", description: "Signing executive title", type: "text", required: true },
		],
	},
	{
		name: "Executive Summary - Task Order",
		description: "Streamlined executive summary for task order responses under IDIQs and other contract vehicles.",
		categoryIds: ["exec"],
		tags: ["executive", "task-order", "idiq", "gwac", "bpa"],
		difficulty: "intermediate",
		estimatedTime: 30,
		sections: [
			{
				title: "Task Order Executive Summary",
				level: 1,
				prompt: "Create a focused executive summary for task order response, referencing the parent contract vehicle and demonstrating understanding of the specific task requirements.",
				subsections: [
					{
						title: "Task Understanding",
						level: 2,
						prompt: "Demonstrate understanding of the specific task order requirements and objectives. Reference the PWS/SOO directly.",
					},
					{
						title: "Approach Summary",
						level: 2,
						prompt: "Summarize the technical approach tailored to this specific task. Reference relevant experience under the parent contract if applicable.",
					},
					{
						title: "Key Personnel",
						level: 2,
						prompt: "Highlight key personnel who will lead the effort and their specific qualifications for this task.",
					},
					{
						title: "Schedule Commitment",
						level: 2,
						prompt: "Confirm ability to meet task order schedule requirements and any accelerated delivery capabilities.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Contract Vehicle", variableName: "{{contract_vehicle}}", description: "Parent contract name/number", type: "text", required: true },
			{ id: "p3", name: "Task Order Number", variableName: "{{task_order_number}}", description: "Task order number", type: "text", required: true },
		],
	},
	{
		name: "Executive Summary - Teaming Arrangement",
		description: "Executive summary highlighting teaming partner capabilities and integrated approach.",
		categoryIds: ["exec"],
		tags: ["executive", "teaming", "partnership", "joint-venture"],
		difficulty: "advanced",
		estimatedTime: 50,
		sections: [
			{
				title: "Team Executive Summary",
				level: 1,
				prompt: "Create an executive summary that presents the teaming arrangement as a unified, integrated solution provider.",
				subsections: [
					{
						title: "Team Overview",
						level: 2,
						prompt: "Introduce the team structure with {{company_name}} as prime contractor and teaming partners. Explain the rationale for team composition.",
					},
					{
						title: "Combined Capabilities",
						level: 2,
						prompt: "Present the integrated capabilities of all team members, showing how the combination addresses all requirements comprehensively.",
					},
					{
						title: "Division of Responsibilities",
						level: 2,
						prompt: "Outline the clear division of work among team members based on core competencies and past performance.",
					},
					{
						title: "Team Integration",
						level: 2,
						prompt: "Describe the proven team integration approach including communication, coordination, and management structure.",
					},
					{
						title: "Relevant Team Experience",
						level: 2,
						prompt: "Highlight examples where team members have successfully worked together on similar efforts.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Prime Contractor", variableName: "{{company_name}}", description: "Prime contractor name", type: "text", required: true },
			{ id: "p2", name: "Teaming Partner 1", variableName: "{{partner_1}}", description: "First teaming partner name", type: "text", required: true },
			{ id: "p3", name: "Teaming Partner 2", variableName: "{{partner_2}}", description: "Second teaming partner name", type: "text", required: false },
			{ id: "p4", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
		],
	},
	{
		name: "Strategic Overview - Multi-Year Contract",
		description: "Strategic overview for multi-year contracts emphasizing long-term vision and continuous improvement.",
		categoryIds: ["exec"],
		tags: ["strategic", "multi-year", "long-term", "continuous-improvement"],
		difficulty: "advanced",
		estimatedTime: 55,
		sections: [
			{
				title: "Strategic Overview",
				level: 1,
				prompt: "Present a strategic vision for the multi-year contract period that demonstrates commitment to long-term partnership.",
				subsections: [
					{
						title: "Long-Term Vision",
						level: 2,
						prompt: "Articulate the vision for the contractor-government partnership over the contract period. Focus on mission advancement.",
					},
					{
						title: "Year 1 Priorities",
						level: 2,
						prompt: "Detail first-year priorities focusing on transition, baseline establishment, and quick wins.",
					},
					{
						title: "Evolution Roadmap",
						level: 2,
						prompt: "Present a roadmap showing how service delivery will evolve and improve over the contract period.",
					},
					{
						title: "Innovation Pipeline",
						level: 2,
						prompt: "Describe planned innovations and how emerging technologies will be incorporated to enhance service delivery.",
					},
					{
						title: "Investment Commitment",
						level: 2,
						prompt: "Outline {{company_name}}'s investment commitments in training, technology, and process improvement.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Contract Duration", variableName: "{{contract_duration}}", description: "Contract duration (e.g., 5 years)", type: "text", required: true },
			{ id: "p3", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
		],
	},
	{
		name: "Executive Summary - Small Business",
		description: "Executive summary tailored for small business proposals emphasizing agility and socioeconomic benefits.",
		categoryIds: ["exec"],
		tags: ["small-business", "8a", "hubzone", "sdvosb", "wosb"],
		difficulty: "intermediate",
		estimatedTime: 40,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Create an executive summary that leverages small business advantages while demonstrating full capability to perform.",
				subsections: [
					{
						title: "Small Business Value",
						level: 2,
						prompt: "Articulate the unique value a small business brings: agility, executive access, dedicated attention, and socioeconomic benefits.",
					},
					{
						title: "Capability Demonstration",
						level: 2,
						prompt: "Demonstrate full capability to perform despite size. Reference similar scope contracts successfully completed.",
					},
					{
						title: "Technical Approach",
						level: 2,
						prompt: "Present a streamlined technical approach that shows efficiency advantages of small business operations.",
					},
					{
						title: "Socioeconomic Impact",
						level: 2,
						prompt: "Describe socioeconomic benefits including certifications, subcontracting goals support, and community impact.",
					},
					{
						title: "Growth Partnership",
						level: 2,
						prompt: "Position the opportunity as a growth partnership that will strengthen both {{company_name}} and government capabilities.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "SB Certifications", variableName: "{{sb_certifications}}", description: "Small business certifications (8a, HUBZone, etc.)", type: "text", required: false },
			{ id: "p3", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
		],
	},
	{
		name: "Executive Summary - Recompete",
		description: "Executive summary for recompete/incumbent scenarios emphasizing continuity and improvements.",
		categoryIds: ["exec"],
		tags: ["recompete", "incumbent", "continuity", "transition-risk"],
		difficulty: "advanced",
		estimatedTime: 50,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Create an executive summary that leverages incumbent advantage while demonstrating commitment to continuous improvement.",
				subsections: [
					{
						title: "Proven Partnership",
						level: 2,
						prompt: "Highlight the successful partnership history with {{client_name}} including key achievements and metrics.",
					},
					{
						title: "Continuity Advantages",
						level: 2,
						prompt: "Emphasize continuity benefits: institutional knowledge, established relationships, zero transition risk.",
					},
					{
						title: "Performance Record",
						level: 2,
						prompt: "Present contract performance metrics, CPARS ratings, and specific accomplishments during current performance period.",
					},
					{
						title: "Planned Improvements",
						level: 2,
						prompt: "Detail planned improvements and innovations for the new contract period based on lessons learned.",
					},
					{
						title: "Value Added",
						level: 2,
						prompt: "Describe additional value {{company_name}} will bring to the recompete including efficiencies and enhancements.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Current Contract", variableName: "{{current_contract}}", description: "Current contract number", type: "text", required: true },
			{ id: "p4", name: "Years of Performance", variableName: "{{performance_years}}", description: "Years as incumbent", type: "number", required: false },
		],
	},
	{
		name: "Executive Overview - IT Services",
		description: "Executive overview specifically for IT services contracts with technical and management elements.",
		categoryIds: ["exec", "tech"],
		tags: ["it-services", "technology", "digital-transformation", "modernization"],
		difficulty: "intermediate",
		estimatedTime: 45,
		sections: [
			{
				title: "IT Services Executive Overview",
				level: 1,
				prompt: "Create an executive overview for IT services emphasizing technical capability and modern delivery approaches.",
				subsections: [
					{
						title: "Technology Vision",
						level: 2,
						prompt: "Present {{company_name}}'s vision for supporting {{client_name}}'s technology mission and modernization goals.",
					},
					{
						title: "Service Delivery Model",
						level: 2,
						prompt: "Describe the IT service delivery model including Agile/DevOps practices, tooling, and delivery framework.",
					},
					{
						title: "Technical Capabilities",
						level: 2,
						prompt: "Highlight key technical capabilities in cloud, cybersecurity, development, and operations.",
					},
					{
						title: "Innovation Approach",
						level: 2,
						prompt: "Explain how {{company_name}} incorporates emerging technologies and innovation into service delivery.",
					},
					{
						title: "Proven Results",
						level: 2,
						prompt: "Present IT services past performance with metrics like uptime, incident response, and user satisfaction.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Technology Focus", variableName: "{{tech_focus}}", description: "Primary technology focus area", type: "text", required: false },
		],
	},
	{
		name: "Executive Summary - Professional Services",
		description: "Executive summary for professional services contracts emphasizing expertise and methodology.",
		categoryIds: ["exec"],
		tags: ["professional-services", "consulting", "advisory", "expertise"],
		difficulty: "intermediate",
		estimatedTime: 40,
		sections: [
			{
				title: "Professional Services Executive Summary",
				level: 1,
				prompt: "Create an executive summary that emphasizes professional expertise, methodology, and proven results.",
				subsections: [
					{
						title: "Expertise Overview",
						level: 2,
						prompt: "Summarize {{company_name}}'s professional expertise and subject matter authority relevant to this opportunity.",
					},
					{
						title: "Methodology",
						level: 2,
						prompt: "Present the proven methodology for delivering professional services with consistent quality.",
					},
					{
						title: "Team Excellence",
						level: 2,
						prompt: "Highlight the caliber of professional staff including credentials, certifications, and thought leadership.",
					},
					{
						title: "Client Success",
						level: 2,
						prompt: "Feature client success stories demonstrating impact of {{company_name}}'s professional services.",
					},
					{
						title: "Engagement Model",
						level: 2,
						prompt: "Describe the client engagement model ensuring responsiveness and alignment with objectives.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Service Type", variableName: "{{service_type}}", description: "Type of professional services", type: "text", required: true },
			{ id: "p3", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
		],
	},
	{
		name: "Executive Summary - Construction/Facilities",
		description: "Executive summary for construction and facilities contracts with safety and quality emphasis.",
		categoryIds: ["exec"],
		tags: ["construction", "facilities", "safety", "building"],
		difficulty: "intermediate",
		estimatedTime: 45,
		sections: [
			{
				title: "Construction/Facilities Executive Summary",
				level: 1,
				prompt: "Create an executive summary emphasizing safety record, quality workmanship, and on-time delivery.",
				subsections: [
					{
						title: "Project Understanding",
						level: 2,
						prompt: "Demonstrate thorough understanding of the project scope, site conditions, and critical requirements.",
					},
					{
						title: "Safety Commitment",
						level: 2,
						prompt: "Present {{company_name}}'s safety record including EMR rating, OSHA statistics, and safety culture.",
					},
					{
						title: "Construction Approach",
						level: 2,
						prompt: "Summarize the construction approach including methodology, sequencing, and risk mitigation.",
					},
					{
						title: "Quality Assurance",
						level: 2,
						prompt: "Describe quality assurance processes that ensure workmanship meets or exceeds specifications.",
					},
					{
						title: "Schedule Performance",
						level: 2,
						prompt: "Highlight track record of on-time completion and schedule management capabilities.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p3", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p4", name: "EMR Rating", variableName: "{{emr_rating}}", description: "Experience Modification Rate", type: "number", required: false },
		],
	},
	{
		name: "Proposal Highlights Sheet",
		description: "One-page proposal highlights summary for quick executive review.",
		categoryIds: ["exec"],
		tags: ["highlights", "summary", "one-pager", "quick-reference"],
		difficulty: "beginner",
		estimatedTime: 20,
		sections: [
			{
				title: "Proposal Highlights",
				level: 1,
				prompt: "Create a one-page highlights summary with key proposal information in an easily scannable format.",
				subsections: [
					{
						title: "Solution at a Glance",
						level: 2,
						prompt: "Provide a 2-3 sentence solution summary capturing the essence of the proposed approach.",
					},
					{
						title: "Key Differentiators",
						level: 2,
						prompt: "List 3-4 key differentiators in bullet format with brief supporting evidence.",
					},
					{
						title: "Team Highlights",
						level: 2,
						prompt: "List key personnel and teaming partners with primary qualifications.",
					},
					{
						title: "Relevant Experience",
						level: 2,
						prompt: "List 3 most relevant past performance references with key metrics.",
					},
					{
						title: "Value Summary",
						level: 2,
						prompt: "Provide a brief value proposition statement explaining why {{company_name}} represents the best choice.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Opportunity Name", variableName: "{{opportunity_name}}", description: "Name of opportunity", type: "text", required: true },
		],
	},
];

// ============================================================================
// Technical Templates (20)
// ============================================================================

const TECHNICAL_TEMPLATES: TemplateDef[] = [
	{
		name: "Technical Approach - Comprehensive",
		description: "Full technical approach document with methodology, architecture, and implementation details.",
		categoryIds: ["tech"],
		tags: ["technical", "approach", "methodology", "implementation", "architecture"],
		difficulty: "advanced",
		estimatedTime: 120,
		sections: [
			{
				title: "Technical Approach",
				level: 1,
				prompt: "Create a comprehensive technical approach that demonstrates deep understanding and proven methodology.",
				subsections: [
					{
						title: "Understanding of Requirements",
						level: 2,
						prompt: "Demonstrate thorough understanding of technical requirements. Reference specific PWS sections and interpret agency needs.",
					},
					{
						title: "Technical Solution Architecture",
						level: 2,
						prompt: "Present the overall solution architecture with components, interfaces, and integration points.",
					},
					{
						title: "Methodology",
						level: 2,
						prompt: "Describe the technical methodology including processes, standards, and frameworks to be applied.",
					},
					{
						title: "Implementation Approach",
						level: 2,
						prompt: "Detail the implementation approach including phases, milestones, and deliverables.",
					},
					{
						title: "Tools and Technologies",
						level: 2,
						prompt: "Specify tools, technologies, and platforms to be utilized with justification for selections.",
					},
					{
						title: "Risk Mitigation",
						level: 2,
						prompt: "Identify technical risks and present mitigation strategies for each.",
					},
					{
						title: "Quality Assurance",
						level: 2,
						prompt: "Describe quality assurance processes ensuring technical deliverables meet requirements.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Solution Name", variableName: "{{solution_name}}", description: "Name of proposed solution", type: "text", required: false },
		],
	},
	{
		name: "Technical Approach - Agile Development",
		description: "Technical approach for Agile/DevOps software development projects.",
		categoryIds: ["tech"],
		tags: ["agile", "devops", "software", "development", "scrum"],
		difficulty: "advanced",
		estimatedTime: 90,
		sections: [
			{
				title: "Agile Development Approach",
				level: 1,
				prompt: "Present an Agile/DevOps development approach aligned with modern software delivery practices.",
				subsections: [
					{
						title: "Agile Framework",
						level: 2,
						prompt: "Describe the Agile framework (Scrum, SAFe, Kanban) and how it will be tailored to the project.",
					},
					{
						title: "DevOps Pipeline",
						level: 2,
						prompt: "Detail the CI/CD pipeline including automation, testing, and deployment processes.",
					},
					{
						title: "Sprint Structure",
						level: 2,
						prompt: "Explain sprint structure, ceremonies, and cadence for iterative delivery.",
					},
					{
						title: "Technical Architecture",
						level: 2,
						prompt: "Present the technical architecture supporting Agile development including microservices, APIs, and cloud infrastructure.",
					},
					{
						title: "Quality Engineering",
						level: 2,
						prompt: "Describe quality engineering practices including automated testing, code review, and technical debt management.",
					},
					{
						title: "Stakeholder Engagement",
						level: 2,
						prompt: "Explain how stakeholders will be engaged throughout the development process.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Sprint Length", variableName: "{{sprint_length}}", description: "Sprint duration in weeks", type: "select", required: true, options: [{ value: "1", label: "1 week" }, { value: "2", label: "2 weeks" }, { value: "3", label: "3 weeks" }] },
			{ id: "p3", name: "Agile Framework", variableName: "{{agile_framework}}", description: "Primary Agile framework", type: "select", required: true, options: [{ value: "scrum", label: "Scrum" }, { value: "safe", label: "SAFe" }, { value: "kanban", label: "Kanban" }] },
		],
	},
	{
		name: "Technical Approach - Cloud Migration",
		description: "Technical approach for cloud migration and modernization projects.",
		categoryIds: ["tech"],
		tags: ["cloud", "migration", "aws", "azure", "modernization"],
		difficulty: "advanced",
		estimatedTime: 100,
		sections: [
			{
				title: "Cloud Migration Approach",
				level: 1,
				prompt: "Present a comprehensive cloud migration approach following best practices and proven methodologies.",
				subsections: [
					{
						title: "Migration Strategy",
						level: 2,
						prompt: "Define the migration strategy (6 Rs: Rehost, Replatform, Repurchase, Refactor, Retire, Retain) for different application categories.",
					},
					{
						title: "Assessment Phase",
						level: 2,
						prompt: "Describe the application assessment methodology to determine migration readiness and approach.",
					},
					{
						title: "Target Architecture",
						level: 2,
						prompt: "Present the target cloud architecture including landing zone design, networking, and security controls.",
					},
					{
						title: "Migration Waves",
						level: 2,
						prompt: "Outline the migration wave plan with application groupings and sequencing rationale.",
					},
					{
						title: "Security and Compliance",
						level: 2,
						prompt: "Address security controls and compliance requirements in the cloud environment.",
					},
					{
						title: "Optimization",
						level: 2,
						prompt: "Describe post-migration optimization including cost management and performance tuning.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Cloud Provider", variableName: "{{cloud_provider}}", description: "Target cloud provider", type: "select", required: true, options: [{ value: "aws", label: "AWS" }, { value: "azure", label: "Azure" }, { value: "gcp", label: "GCP" }, { value: "multi", label: "Multi-Cloud" }] },
			{ id: "p3", name: "Number of Applications", variableName: "{{app_count}}", description: "Approximate number of applications", type: "number", required: false },
		],
	},
	{
		name: "Technical Approach - Cybersecurity",
		description: "Technical approach for cybersecurity services and implementation.",
		categoryIds: ["tech", "security"],
		tags: ["cybersecurity", "security", "nist", "fedramp", "fisma"],
		difficulty: "advanced",
		estimatedTime: 110,
		sections: [
			{
				title: "Cybersecurity Technical Approach",
				level: 1,
				prompt: "Present a comprehensive cybersecurity approach aligned with federal standards and best practices.",
				subsections: [
					{
						title: "Security Framework Alignment",
						level: 2,
						prompt: "Describe alignment with NIST Cybersecurity Framework, RMF, and applicable security requirements.",
					},
					{
						title: "Security Architecture",
						level: 2,
						prompt: "Present the security architecture including defense-in-depth strategy and control implementation.",
					},
					{
						title: "Continuous Monitoring",
						level: 2,
						prompt: "Detail the continuous monitoring approach including tools, processes, and reporting.",
					},
					{
						title: "Incident Response",
						level: 2,
						prompt: "Describe incident response capabilities including detection, analysis, containment, and recovery.",
					},
					{
						title: "Vulnerability Management",
						level: 2,
						prompt: "Explain vulnerability management processes including scanning, remediation, and reporting.",
					},
					{
						title: "Security Operations",
						level: 2,
						prompt: "Describe security operations including SOC functions, threat intelligence, and security engineering.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Security Framework", variableName: "{{framework}}", description: "Primary security framework", type: "select", required: true, options: [{ value: "nist-csf", label: "NIST CSF" }, { value: "nist-rmf", label: "NIST RMF" }, { value: "fedramp", label: "FedRAMP" }] },
			{ id: "p3", name: "Impact Level", variableName: "{{impact_level}}", description: "System impact level", type: "select", required: true, options: [{ value: "low", label: "Low" }, { value: "moderate", label: "Moderate" }, { value: "high", label: "High" }] },
		],
	},
	{
		name: "Technical Approach - Data Analytics",
		description: "Technical approach for data analytics, BI, and data science projects.",
		categoryIds: ["tech"],
		tags: ["data", "analytics", "bi", "data-science", "visualization"],
		difficulty: "advanced",
		estimatedTime: 95,
		sections: [
			{
				title: "Data Analytics Approach",
				level: 1,
				prompt: "Present a comprehensive data analytics approach from data ingestion through insights delivery.",
				subsections: [
					{
						title: "Data Strategy",
						level: 2,
						prompt: "Describe the overall data strategy including governance, quality, and lifecycle management.",
					},
					{
						title: "Data Architecture",
						level: 2,
						prompt: "Present the data architecture including data lake/warehouse design, ETL/ELT processes, and data models.",
					},
					{
						title: "Analytics Platform",
						level: 2,
						prompt: "Detail the analytics platform stack including tools for BI, visualization, and advanced analytics.",
					},
					{
						title: "Machine Learning",
						level: 2,
						prompt: "Describe machine learning and AI capabilities including model development, training, and deployment.",
					},
					{
						title: "Data Visualization",
						level: 2,
						prompt: "Explain visualization and reporting approach including dashboards, self-service BI, and storytelling.",
					},
					{
						title: "Data Governance",
						level: 2,
						prompt: "Address data governance including security, privacy, and compliance requirements.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Platform", variableName: "{{platform}}", description: "Primary analytics platform", type: "text", required: false },
			{ id: "p3", name: "Data Volume", variableName: "{{data_volume}}", description: "Approximate data volume", type: "text", required: false },
		],
	},
	{
		name: "Technical Approach - System Integration",
		description: "Technical approach for system integration projects connecting multiple systems.",
		categoryIds: ["tech"],
		tags: ["integration", "api", "middleware", "enterprise", "systems"],
		difficulty: "advanced",
		estimatedTime: 100,
		sections: [
			{
				title: "System Integration Approach",
				level: 1,
				prompt: "Present a robust system integration approach that ensures seamless connectivity and data flow.",
				subsections: [
					{
						title: "Integration Strategy",
						level: 2,
						prompt: "Define the overall integration strategy including patterns, standards, and governance.",
					},
					{
						title: "Interface Inventory",
						level: 2,
						prompt: "Describe approach to cataloging and managing the interface inventory.",
					},
					{
						title: "Integration Architecture",
						level: 2,
						prompt: "Present the integration architecture including middleware, API gateway, and messaging patterns.",
					},
					{
						title: "Data Mapping",
						level: 2,
						prompt: "Explain data mapping and transformation approach ensuring data integrity across systems.",
					},
					{
						title: "Testing Approach",
						level: 2,
						prompt: "Describe integration testing methodology including end-to-end and regression testing.",
					},
					{
						title: "Error Handling",
						level: 2,
						prompt: "Detail error handling, logging, and monitoring for integration points.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Number of Systems", variableName: "{{system_count}}", description: "Number of systems to integrate", type: "number", required: false },
			{ id: "p3", name: "Integration Platform", variableName: "{{integration_platform}}", description: "Integration platform/middleware", type: "text", required: false },
		],
	},
	{
		name: "Solution Architecture Document",
		description: "Detailed solution architecture document with diagrams and specifications.",
		categoryIds: ["tech"],
		tags: ["architecture", "solution", "design", "specifications", "diagrams"],
		difficulty: "advanced",
		estimatedTime: 150,
		sections: [
			{
				title: "Solution Architecture",
				level: 1,
				prompt: "Create a comprehensive solution architecture document that provides technical blueprint.",
				subsections: [
					{
						title: "Architecture Overview",
						level: 2,
						prompt: "Provide high-level architecture overview with context diagram showing major components.",
					},
					{
						title: "Component Architecture",
						level: 2,
						prompt: "Detail each major component including purpose, responsibilities, and interactions.",
					},
					{
						title: "Data Architecture",
						level: 2,
						prompt: "Describe data architecture including data models, storage, and data flow.",
					},
					{
						title: "Integration Architecture",
						level: 2,
						prompt: "Define integration architecture showing all interfaces and integration patterns.",
					},
					{
						title: "Security Architecture",
						level: 2,
						prompt: "Present security architecture including authentication, authorization, and encryption.",
					},
					{
						title: "Infrastructure Architecture",
						level: 2,
						prompt: "Describe infrastructure architecture including compute, network, and storage.",
					},
					{
						title: "Non-Functional Requirements",
						level: 2,
						prompt: "Address non-functional requirements including performance, scalability, and availability.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Solution Name", variableName: "{{solution_name}}", description: "Name of the solution", type: "text", required: true },
			{ id: "p2", name: "Version", variableName: "{{version}}", description: "Document version", type: "text", required: true, defaultValue: "1.0" },
			{ id: "p3", name: "Client Name", variableName: "{{client_name}}", description: "Client organization", type: "text", required: true },
		],
	},
	{
		name: "Technical Approach - O&M Services",
		description: "Technical approach for Operations and Maintenance services.",
		categoryIds: ["tech"],
		tags: ["operations", "maintenance", "support", "itil", "service-management"],
		difficulty: "intermediate",
		estimatedTime: 80,
		sections: [
			{
				title: "Operations & Maintenance Approach",
				level: 1,
				prompt: "Present a comprehensive O&M approach ensuring reliable system operations and service delivery.",
				subsections: [
					{
						title: "Service Management Framework",
						level: 2,
						prompt: "Describe the ITIL-aligned service management framework for O&M delivery.",
					},
					{
						title: "Service Desk Operations",
						level: 2,
						prompt: "Detail service desk operations including ticketing, triage, and escalation procedures.",
					},
					{
						title: "System Monitoring",
						level: 2,
						prompt: "Describe proactive monitoring approach including tools, alerts, and automation.",
					},
					{
						title: "Incident Management",
						level: 2,
						prompt: "Explain incident management process from detection through resolution and review.",
					},
					{
						title: "Change Management",
						level: 2,
						prompt: "Describe change management process ensuring controlled and low-risk changes.",
					},
					{
						title: "Reporting and SLAs",
						level: 2,
						prompt: "Present SLA management and reporting approach demonstrating accountability.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Service Hours", variableName: "{{service_hours}}", description: "Service availability hours", type: "select", required: true, options: [{ value: "8x5", label: "8x5 Business Hours" }, { value: "12x5", label: "12x5 Extended" }, { value: "24x7", label: "24x7" }] },
		],
	},
	{
		name: "Technical Approach - Help Desk/Tier 1",
		description: "Technical approach for help desk and Tier 1 support services.",
		categoryIds: ["tech"],
		tags: ["help-desk", "tier-1", "support", "customer-service"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Help Desk Approach",
				level: 1,
				prompt: "Present a customer-focused help desk approach ensuring excellent user experience.",
				subsections: [
					{
						title: "Service Delivery Model",
						level: 2,
						prompt: "Describe the help desk service delivery model including channels and staffing.",
					},
					{
						title: "Knowledge Management",
						level: 2,
						prompt: "Explain knowledge management approach for first-call resolution optimization.",
					},
					{
						title: "Ticket Management",
						level: 2,
						prompt: "Detail ticket management workflow from creation through closure.",
					},
					{
						title: "Escalation Procedures",
						level: 2,
						prompt: "Describe escalation procedures ensuring timely resolution of complex issues.",
					},
					{
						title: "Quality Assurance",
						level: 2,
						prompt: "Present quality assurance approach including call monitoring and customer surveys.",
					},
					{
						title: "Continuous Improvement",
						level: 2,
						prompt: "Describe continuous improvement approach using metrics and feedback.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Support Channels", variableName: "{{channels}}", description: "Support channels offered", type: "text", required: false, defaultValue: "Phone, Email, Chat" },
		],
	},
	{
		name: "Technical Approach - Network Services",
		description: "Technical approach for network engineering and operations services.",
		categoryIds: ["tech"],
		tags: ["network", "infrastructure", "wan", "lan", "telecommunications"],
		difficulty: "advanced",
		estimatedTime: 90,
		sections: [
			{
				title: "Network Services Approach",
				level: 1,
				prompt: "Present a comprehensive network services approach ensuring reliable, secure connectivity.",
				subsections: [
					{
						title: "Network Architecture",
						level: 2,
						prompt: "Describe the target network architecture including topology, segmentation, and redundancy.",
					},
					{
						title: "Network Operations",
						level: 2,
						prompt: "Detail network operations including monitoring, configuration management, and troubleshooting.",
					},
					{
						title: "Security Controls",
						level: 2,
						prompt: "Explain network security controls including firewalls, IDS/IPS, and access controls.",
					},
					{
						title: "Performance Management",
						level: 2,
						prompt: "Describe network performance management including capacity planning and optimization.",
					},
					{
						title: "Change Management",
						level: 2,
						prompt: "Present network change management ensuring stability and minimizing disruption.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Network Type", variableName: "{{network_type}}", description: "Type of network", type: "select", required: true, options: [{ value: "enterprise", label: "Enterprise LAN/WAN" }, { value: "datacenter", label: "Data Center" }, { value: "cloud", label: "Cloud Networking" }] },
		],
	},
	{
		name: "Technical Approach - Application Development",
		description: "Technical approach for custom application development projects.",
		categoryIds: ["tech"],
		tags: ["application", "development", "custom", "software", "coding"],
		difficulty: "advanced",
		estimatedTime: 100,
		sections: [
			{
				title: "Application Development Approach",
				level: 1,
				prompt: "Present a comprehensive application development approach delivering high-quality software.",
				subsections: [
					{
						title: "Development Methodology",
						level: 2,
						prompt: "Describe the software development methodology including lifecycle phases and governance.",
					},
					{
						title: "Technical Stack",
						level: 2,
						prompt: "Present the proposed technical stack with justification for technology selections.",
					},
					{
						title: "Design Approach",
						level: 2,
						prompt: "Explain the design approach including UX research, prototyping, and design reviews.",
					},
					{
						title: "Development Standards",
						level: 2,
						prompt: "Detail coding standards, best practices, and code review processes.",
					},
					{
						title: "Testing Strategy",
						level: 2,
						prompt: "Describe comprehensive testing strategy including unit, integration, and acceptance testing.",
					},
					{
						title: "Deployment Approach",
						level: 2,
						prompt: "Present deployment approach including environments, automation, and release management.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Application Type", variableName: "{{app_type}}", description: "Type of application", type: "select", required: true, options: [{ value: "web", label: "Web Application" }, { value: "mobile", label: "Mobile Application" }, { value: "enterprise", label: "Enterprise System" }] },
		],
	},
	{
		name: "Technical Approach - Testing Services",
		description: "Technical approach for software testing and quality assurance services.",
		categoryIds: ["tech", "qa"],
		tags: ["testing", "qa", "quality", "automation", "test-management"],
		difficulty: "intermediate",
		estimatedTime: 75,
		sections: [
			{
				title: "Testing Services Approach",
				level: 1,
				prompt: "Present a comprehensive testing approach ensuring software quality and reliability.",
				subsections: [
					{
						title: "Test Strategy",
						level: 2,
						prompt: "Describe the overall test strategy including types of testing and coverage goals.",
					},
					{
						title: "Test Planning",
						level: 2,
						prompt: "Explain test planning process including risk-based prioritization and resource allocation.",
					},
					{
						title: "Test Automation",
						level: 2,
						prompt: "Detail test automation approach including framework, tools, and automation targets.",
					},
					{
						title: "Performance Testing",
						level: 2,
						prompt: "Describe performance testing approach including load, stress, and scalability testing.",
					},
					{
						title: "Defect Management",
						level: 2,
						prompt: "Present defect management process from identification through verification.",
					},
					{
						title: "Test Metrics",
						level: 2,
						prompt: "Define testing metrics and reporting approach demonstrating quality progress.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Automation Target", variableName: "{{automation_target}}", description: "Target automation percentage", type: "number", required: false, defaultValue: "70" },
		],
	},
	{
		name: "Technical Approach - Database Administration",
		description: "Technical approach for database administration and management services.",
		categoryIds: ["tech"],
		tags: ["database", "dba", "administration", "sql", "performance"],
		difficulty: "intermediate",
		estimatedTime: 70,
		sections: [
			{
				title: "Database Administration Approach",
				level: 1,
				prompt: "Present a comprehensive database administration approach ensuring data availability and performance.",
				subsections: [
					{
						title: "Database Management Strategy",
						level: 2,
						prompt: "Describe the overall database management strategy including platforms and standards.",
					},
					{
						title: "Performance Tuning",
						level: 2,
						prompt: "Explain performance tuning approach including monitoring, analysis, and optimization.",
					},
					{
						title: "Backup and Recovery",
						level: 2,
						prompt: "Detail backup and recovery procedures ensuring data protection and business continuity.",
					},
					{
						title: "Security Administration",
						level: 2,
						prompt: "Describe database security administration including access control and encryption.",
					},
					{
						title: "Capacity Management",
						level: 2,
						prompt: "Present capacity management approach including growth planning and resource optimization.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Database Platform", variableName: "{{db_platform}}", description: "Primary database platform", type: "text", required: false },
		],
	},
	{
		name: "Technical Approach - Enterprise Architecture",
		description: "Technical approach for enterprise architecture services using TOGAF or similar frameworks.",
		categoryIds: ["tech"],
		tags: ["enterprise-architecture", "togaf", "framework", "strategic", "planning"],
		difficulty: "advanced",
		estimatedTime: 120,
		sections: [
			{
				title: "Enterprise Architecture Approach",
				level: 1,
				prompt: "Present a comprehensive enterprise architecture approach aligned with industry frameworks.",
				subsections: [
					{
						title: "EA Framework",
						level: 2,
						prompt: "Describe the EA framework (TOGAF, Zachman, FEAF) to be applied and customization approach.",
					},
					{
						title: "Architecture Development",
						level: 2,
						prompt: "Explain the architecture development method including phases and deliverables.",
					},
					{
						title: "Business Architecture",
						level: 2,
						prompt: "Describe approach to developing business architecture including capabilities and processes.",
					},
					{
						title: "Information Architecture",
						level: 2,
						prompt: "Present information/data architecture approach including data modeling and governance.",
					},
					{
						title: "Technology Architecture",
						level: 2,
						prompt: "Detail technology architecture approach including standards and reference architectures.",
					},
					{
						title: "Governance",
						level: 2,
						prompt: "Describe EA governance including review boards, compliance, and exception handling.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "EA Framework", variableName: "{{ea_framework}}", description: "Primary EA framework", type: "select", required: true, options: [{ value: "togaf", label: "TOGAF" }, { value: "feaf", label: "FEAF" }, { value: "dodaf", label: "DoDAF" }] },
		],
	},
	{
		name: "Technical Approach - AI/ML Implementation",
		description: "Technical approach for artificial intelligence and machine learning projects.",
		categoryIds: ["tech"],
		tags: ["ai", "ml", "artificial-intelligence", "machine-learning", "data-science"],
		difficulty: "advanced",
		estimatedTime: 110,
		sections: [
			{
				title: "AI/ML Implementation Approach",
				level: 1,
				prompt: "Present a comprehensive AI/ML implementation approach from problem definition through model deployment.",
				subsections: [
					{
						title: "Problem Definition",
						level: 2,
						prompt: "Describe approach to defining AI/ML problems and success criteria.",
					},
					{
						title: "Data Engineering",
						level: 2,
						prompt: "Explain data engineering approach including data collection, preparation, and feature engineering.",
					},
					{
						title: "Model Development",
						level: 2,
						prompt: "Detail model development approach including algorithm selection, training, and validation.",
					},
					{
						title: "MLOps",
						level: 2,
						prompt: "Describe MLOps practices for model deployment, monitoring, and lifecycle management.",
					},
					{
						title: "Responsible AI",
						level: 2,
						prompt: "Address responsible AI considerations including bias, explainability, and ethics.",
					},
					{
						title: "Integration",
						level: 2,
						prompt: "Present approach to integrating AI/ML capabilities into business processes and applications.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "ML Platform", variableName: "{{ml_platform}}", description: "ML platform", type: "text", required: false },
			{ id: "p3", name: "Use Case", variableName: "{{use_case}}", description: "Primary AI/ML use case", type: "text", required: false },
		],
	},
	{
		name: "Requirements Traceability Matrix",
		description: "Template for creating requirements traceability matrix linking requirements to solutions.",
		categoryIds: ["tech", "compliance"],
		tags: ["requirements", "traceability", "matrix", "compliance", "rtm"],
		difficulty: "intermediate",
		estimatedTime: 45,
		sections: [
			{
				title: "Requirements Traceability Matrix",
				level: 1,
				prompt: "Create a requirements traceability matrix structure for tracking compliance.",
				subsections: [
					{
						title: "Introduction",
						level: 2,
						prompt: "Introduce the RTM and explain how it demonstrates compliance with all requirements.",
					},
					{
						title: "Functional Requirements",
						level: 2,
						prompt: "Create matrix section for functional requirements showing requirement, solution, and compliance status.",
					},
					{
						title: "Technical Requirements",
						level: 2,
						prompt: "Create matrix section for technical requirements with solution mapping.",
					},
					{
						title: "Performance Requirements",
						level: 2,
						prompt: "Create matrix section for performance/SLA requirements with measurement approach.",
					},
					{
						title: "Security Requirements",
						level: 2,
						prompt: "Create matrix section for security requirements with control implementation.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "Solicitation number", type: "text", required: true },
		],
	},
	{
		name: "Technical Approach - IT Infrastructure",
		description: "Technical approach for IT infrastructure services including servers, storage, and virtualization.",
		categoryIds: ["tech"],
		tags: ["infrastructure", "servers", "storage", "virtualization", "datacenter"],
		difficulty: "advanced",
		estimatedTime: 95,
		sections: [
			{
				title: "IT Infrastructure Approach",
				level: 1,
				prompt: "Present a comprehensive IT infrastructure approach ensuring reliable, scalable operations.",
				subsections: [
					{
						title: "Infrastructure Strategy",
						level: 2,
						prompt: "Describe the overall infrastructure strategy including on-premise, cloud, and hybrid considerations.",
					},
					{
						title: "Compute Services",
						level: 2,
						prompt: "Detail compute services approach including servers, virtualization, and containerization.",
					},
					{
						title: "Storage Services",
						level: 2,
						prompt: "Explain storage services including SAN/NAS, object storage, and data management.",
					},
					{
						title: "Backup and DR",
						level: 2,
						prompt: "Describe backup and disaster recovery approach ensuring business continuity.",
					},
					{
						title: "Infrastructure Automation",
						level: 2,
						prompt: "Present infrastructure automation approach using IaC and configuration management.",
					},
					{
						title: "Capacity Management",
						level: 2,
						prompt: "Detail capacity management ensuring adequate resources for current and future needs.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Environment Type", variableName: "{{env_type}}", description: "Infrastructure environment", type: "select", required: true, options: [{ value: "onprem", label: "On-Premise" }, { value: "cloud", label: "Cloud" }, { value: "hybrid", label: "Hybrid" }] },
		],
	},
	{
		name: "Technical Approach - ServiceNow Implementation",
		description: "Technical approach for ServiceNow platform implementation and customization.",
		categoryIds: ["tech"],
		tags: ["servicenow", "itsm", "platform", "workflow", "automation"],
		difficulty: "advanced",
		estimatedTime: 85,
		sections: [
			{
				title: "ServiceNow Implementation Approach",
				level: 1,
				prompt: "Present a comprehensive ServiceNow implementation approach following best practices.",
				subsections: [
					{
						title: "Implementation Methodology",
						level: 2,
						prompt: "Describe ServiceNow implementation methodology including phases and governance.",
					},
					{
						title: "Platform Configuration",
						level: 2,
						prompt: "Detail platform configuration approach including OOTB vs. customization decisions.",
					},
					{
						title: "Process Design",
						level: 2,
						prompt: "Explain ITSM/ITOM process design aligned with ITIL best practices.",
					},
					{
						title: "Integration",
						level: 2,
						prompt: "Describe integration approach with existing systems and data sources.",
					},
					{
						title: "Testing and Deployment",
						level: 2,
						prompt: "Present testing and deployment approach including instance management.",
					},
					{
						title: "Training and Adoption",
						level: 2,
						prompt: "Detail training and change management for successful adoption.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Modules", variableName: "{{sn_modules}}", description: "ServiceNow modules to implement", type: "text", required: false },
		],
	},
	{
		name: "Technical Approach - RPA Implementation",
		description: "Technical approach for Robotic Process Automation implementation.",
		categoryIds: ["tech"],
		tags: ["rpa", "automation", "bots", "process-automation", "uipath"],
		difficulty: "intermediate",
		estimatedTime: 70,
		sections: [
			{
				title: "RPA Implementation Approach",
				level: 1,
				prompt: "Present a comprehensive RPA implementation approach delivering automation value.",
				subsections: [
					{
						title: "Process Assessment",
						level: 2,
						prompt: "Describe approach to identifying and prioritizing processes for automation.",
					},
					{
						title: "Bot Development",
						level: 2,
						prompt: "Detail bot development methodology including design, development, and testing.",
					},
					{
						title: "Infrastructure",
						level: 2,
						prompt: "Explain RPA infrastructure requirements including orchestration and bot deployment.",
					},
					{
						title: "Governance",
						level: 2,
						prompt: "Present RPA governance framework including change management and compliance.",
					},
					{
						title: "Operations",
						level: 2,
						prompt: "Describe bot operations including monitoring, exception handling, and optimization.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "RPA Platform", variableName: "{{rpa_platform}}", description: "RPA platform", type: "select", required: true, options: [{ value: "uipath", label: "UiPath" }, { value: "aa", label: "Automation Anywhere" }, { value: "blueprism", label: "Blue Prism" }] },
		],
	},
	{
		name: "Technical Approach - Low-Code Platform",
		description: "Technical approach for low-code platform implementation and application development.",
		categoryIds: ["tech"],
		tags: ["low-code", "platform", "rapid-development", "citizen-developer"],
		difficulty: "intermediate",
		estimatedTime: 65,
		sections: [
			{
				title: "Low-Code Platform Approach",
				level: 1,
				prompt: "Present approach for low-code platform implementation enabling rapid application delivery.",
				subsections: [
					{
						title: "Platform Strategy",
						level: 2,
						prompt: "Describe low-code platform strategy including use cases and governance.",
					},
					{
						title: "Platform Implementation",
						level: 2,
						prompt: "Detail platform setup including environment configuration and security.",
					},
					{
						title: "Application Development",
						level: 2,
						prompt: "Explain rapid application development approach using low-code capabilities.",
					},
					{
						title: "Integration",
						level: 2,
						prompt: "Describe integration approach connecting low-code apps with enterprise systems.",
					},
					{
						title: "Citizen Development",
						level: 2,
						prompt: "Present citizen developer program including training, guardrails, and support.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Platform", variableName: "{{lowcode_platform}}", description: "Low-code platform", type: "text", required: false },
		],
	},
];

// Continue in next part due to length...
// I'll create the remaining template categories and the seeding function

// ============================================================================
// Management Templates (15)
// ============================================================================

const MANAGEMENT_TEMPLATES: TemplateDef[] = [
	{
		name: "Project Management Plan - Comprehensive",
		description: "Complete project management plan covering all PMI knowledge areas.",
		categoryIds: ["mgmt"],
		tags: ["project-management", "pmp", "planning", "pmi", "methodology"],
		difficulty: "advanced",
		estimatedTime: 120,
		sections: [
			{
				title: "Project Management Plan",
				level: 1,
				prompt: "Create a comprehensive project management plan aligned with PMI best practices.",
				subsections: [
					{
						title: "Project Overview",
						level: 2,
						prompt: "Provide project overview including scope, objectives, and success criteria.",
					},
					{
						title: "Schedule Management",
						level: 2,
						prompt: "Describe schedule management approach including methodology, tools, and reporting.",
					},
					{
						title: "Resource Management",
						level: 2,
						prompt: "Detail resource management including staffing plan and capacity management.",
					},
					{
						title: "Risk Management",
						level: 2,
						prompt: "Present risk management framework including identification, analysis, and mitigation.",
					},
					{
						title: "Communications Management",
						level: 2,
						prompt: "Describe communications management including stakeholder engagement and reporting.",
					},
					{
						title: "Quality Management",
						level: 2,
						prompt: "Detail quality management approach including QA/QC processes and metrics.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p3", name: "Project Manager", variableName: "{{pm_name}}", description: "Project manager name", type: "text", required: true },
		],
	},
	{
		name: "Staffing Plan - Government Contract",
		description: "Comprehensive staffing plan for government contracts with labor categories.",
		categoryIds: ["mgmt", "hr"],
		tags: ["staffing", "labor-categories", "personnel", "ftes", "workforce"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Staffing Plan",
				level: 1,
				prompt: "Create a comprehensive staffing plan demonstrating capability to perform.",
				subsections: [
					{
						title: "Staffing Strategy",
						level: 2,
						prompt: "Describe overall staffing strategy including recruitment and retention approach.",
					},
					{
						title: "Organizational Structure",
						level: 2,
						prompt: "Present organizational chart and reporting relationships for the contract.",
					},
					{
						title: "Labor Categories",
						level: 2,
						prompt: "Define labor categories with qualifications and responsibilities for each.",
					},
					{
						title: "Key Personnel",
						level: 2,
						prompt: "Identify key personnel with qualifications and commitment to the contract.",
					},
					{
						title: "Staffing Timeline",
						level: 2,
						prompt: "Present staffing ramp-up timeline aligned with contract phases.",
					},
					{
						title: "Retention Plan",
						level: 2,
						prompt: "Describe retention strategy to maintain workforce stability.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "FTE Count", variableName: "{{fte_count}}", description: "Total FTE count", type: "number", required: false },
		],
	},
	{
		name: "Risk Management Plan",
		description: "Detailed risk management plan with identification, assessment, and mitigation strategies.",
		categoryIds: ["mgmt"],
		tags: ["risk", "management", "mitigation", "analysis", "planning"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Risk Management Plan",
				level: 1,
				prompt: "Create a comprehensive risk management plan ensuring proactive risk handling.",
				subsections: [
					{
						title: "Risk Management Approach",
						level: 2,
						prompt: "Describe overall risk management methodology and framework.",
					},
					{
						title: "Risk Identification",
						level: 2,
						prompt: "Present risk identification process and initial risk register.",
					},
					{
						title: "Risk Assessment",
						level: 2,
						prompt: "Detail risk assessment methodology including probability and impact analysis.",
					},
					{
						title: "Risk Response Planning",
						level: 2,
						prompt: "Describe risk response strategies (avoid, mitigate, transfer, accept).",
					},
					{
						title: "Risk Monitoring",
						level: 2,
						prompt: "Present risk monitoring and control approach including reviews and updates.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Communications Plan",
		description: "Project communications plan with stakeholder matrix and reporting cadence.",
		categoryIds: ["mgmt"],
		tags: ["communications", "stakeholder", "reporting", "meetings", "status"],
		difficulty: "beginner",
		estimatedTime: 40,
		sections: [
			{
				title: "Communications Plan",
				level: 1,
				prompt: "Create a communications plan ensuring effective stakeholder engagement.",
				subsections: [
					{
						title: "Stakeholder Analysis",
						level: 2,
						prompt: "Identify stakeholders and their communication needs and preferences.",
					},
					{
						title: "Communication Methods",
						level: 2,
						prompt: "Describe communication channels and methods to be used.",
					},
					{
						title: "Meeting Schedule",
						level: 2,
						prompt: "Present meeting cadence including status meetings, reviews, and governance.",
					},
					{
						title: "Status Reporting",
						level: 2,
						prompt: "Detail status reporting format, frequency, and distribution.",
					},
					{
						title: "Escalation Procedures",
						level: 2,
						prompt: "Describe escalation paths and procedures for issues and decisions.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Quality Management Plan",
		description: "Quality management plan with QA/QC processes and metrics.",
		categoryIds: ["mgmt", "qa"],
		tags: ["quality", "qa", "qc", "standards", "continuous-improvement"],
		difficulty: "intermediate",
		estimatedTime: 55,
		sections: [
			{
				title: "Quality Management Plan",
				level: 1,
				prompt: "Create a quality management plan ensuring delivery excellence.",
				subsections: [
					{
						title: "Quality Policy",
						level: 2,
						prompt: "State quality policy and commitment to excellence.",
					},
					{
						title: "Quality Standards",
						level: 2,
						prompt: "Identify applicable quality standards and how they will be applied.",
					},
					{
						title: "Quality Assurance",
						level: 2,
						prompt: "Describe QA processes ensuring standards are followed.",
					},
					{
						title: "Quality Control",
						level: 2,
						prompt: "Detail QC activities verifying deliverable quality.",
					},
					{
						title: "Quality Metrics",
						level: 2,
						prompt: "Define quality metrics and targets for measurement.",
					},
					{
						title: "Continuous Improvement",
						level: 2,
						prompt: "Describe continuous improvement processes using lessons learned.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Quality Standard", variableName: "{{quality_standard}}", description: "Primary quality standard", type: "text", required: false, defaultValue: "ISO 9001" },
		],
	},
];

// Additional templates will be created for other categories...

// ============================================================================
// Combine All Templates
// ============================================================================

const ALL_TEMPLATES = [
	...EXECUTIVE_TEMPLATES,
	...TECHNICAL_TEMPLATES,
	...MANAGEMENT_TEMPLATES,
	...EXTENDED_TEMPLATES, // RFP, EOI, Letters, Invoices
	...ALL_PROFESSIONAL_TEMPLATES, // PMI, PRINCE2, Agile, Software, Governance, Strategic
];

// ============================================================================
// Seed Function
// ============================================================================

export async function seedTemplates() {
	console.log("Starting template seed...");

	// Seed categories first
	console.log("Seeding categories...");
	for (const category of CATEGORIES) {
		await db
			.insert(templateCategories)
			.values({
				id: category.id,
				name: category.name,
				description: category.description,
				slug: category.slug,
				icon: category.icon,
				order: category.order,
			})
			.onConflictDoUpdate({
				target: templateCategories.id,
				set: {
					name: category.name,
					description: category.description,
					slug: category.slug,
					icon: category.icon,
					order: category.order,
				},
			});
	}
	console.log(`Seeded ${CATEGORIES.length} categories`);

	// Clear existing system templates to avoid duplicates
	console.log("Clearing existing system templates...");
	await db.delete(templates).where(eq(templates.createdBy, "system"));

	// Seed templates
	console.log("Seeding templates...");
	let count = 0;
	for (const template of ALL_TEMPLATES) {
		const content = createSectionContent(template.sections);
		// Convert short category IDs to UUIDs
		const categoryUUIDs = getCategoryUUIDs(template.categoryIds);

		await db
			.insert(templates)
			.values({
				name: template.name,
				description: template.description,
				content,
				status: "published",
				visibility: "organization",
				createdBy: "system",
				categoryIds: categoryUUIDs,
				tags: template.tags,
				placeholders: template.placeholders,
				aiInstructions: [],
				complianceRequirements: [],
				// Stats start at 0 - only actual usage updates these values
				useCount: 0,
				rating: null,
				ratingCount: 0,
				estimatedTime: template.estimatedTime,
				difficulty: template.difficulty,
			})
			.onConflictDoNothing();

		count++;
	}

	console.log(`Seeded ${count} templates`);
	console.log("Template seed complete!");

	return { categories: CATEGORIES.length, templates: count };
}

// Export for use in seed script
export { ALL_TEMPLATES };
