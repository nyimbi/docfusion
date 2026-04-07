/**
 * Professional Templates - Extended Template Library
 *
 * Comprehensive collection of templates for:
 * - Consultancy & Advisory Services
 * - Business Management & Strategy
 * - Project Management (PMI/PMBOK)
 * - Prince2 Methodology
 * - Enhanced RFP Response Templates
 *
 * Total: 100+ new templates
 */

import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Category IDs (matching existing categories + new ones)
// ============================================================================

export const PROFESSIONAL_CATEGORIES = {
	// Existing categories
	exec: "A1B2C3D4-E5F6-4789-0123-456789ABCDE1",
	tech: "A1B2C3D4-E5F6-4789-0123-456789ABCDE2",
	mgmt: "A1B2C3D4-E5F6-4789-0123-456789ABCDE3",
	exp: "A1B2C3D4-E5F6-4789-0123-456789ABCDE4",
	cost: "A1B2C3D4-E5F6-4789-0123-456789ABCDE5",
	compliance: "A1B2C3D4-E5F6-4789-0123-456789ABCDE6",
	hr: "A1B2C3D4-E5F6-4789-0123-456789ABCDE7",
	qa: "A1B2C3D4-E5F6-4789-0123-456789ABCDE8",
	security: "A1B2C3D4-E5F6-4789-0123-456789ABCDE9",
	transition: "A1B2C3D4-E5F6-4789-0123-456789ABCDEA",
	// New categories
	consultancy: "A1B2C3D4-E5F6-4789-0123-456789ABCDEB",
	business: "A1B2C3D4-E5F6-4789-0123-456789ABCDEC",
	pmi: "A1B2C3D4-E5F6-4789-0123-456789ABCDED",
	prince2: "A1B2C3D4-E5F6-4789-0123-456789ABCDEE",
	strategy: "A1B2C3D4-E5F6-4789-0123-456789ABCDEF",
	// Legal categories
	legal: "A1B2C3D4-E5F6-4789-0123-456789ABCDF0",
	contracts: "A1B2C3D4-E5F6-4789-0123-456789ABCDF1",
	software: "A1B2C3D4-E5F6-4789-0123-456789ABCDF2",
	privacy: "A1B2C3D4-E5F6-4789-0123-456789ABCDF3",
	ma: "A1B2C3D4-E5F6-4789-0123-456789ABCDF4",
	operations: "A1B2C3D4-E5F6-4789-0123-456789ABCDF5",
	// Sales & Marketing categories
	sales: "A1B2C3D4-E5F6-4789-0123-456789ABCDF6",
	marketing: "A1B2C3D4-E5F6-4789-0123-456789ABCDF7",
	// Technical/Engineering categories
	engineering: "A1B2C3D4-E5F6-4789-0123-456789ABCDF8",
	architecture: "A1B2C3D4-E5F6-4789-0123-456789ABCDF9",
	// Corporate governance categories
	corporate: "A1B2C3D4-E5F6-4789-0123-456789ABCDFA",
	governance: "A1B2C3D4-E5F6-4789-0123-456789ABCDFB",
	// Research & Product categories
	research: "A1B2C3D4-E5F6-4789-0123-456789ABCDFC",
	product: "A1B2C3D4-E5F6-4789-0123-456789ABCDFD",
	// Grants & Funding categories
	grants: "A1B2C3D4-E5F6-4789-0123-456789ABCDFE",
	funding: "A1B2C3D4-E5F6-4789-0123-456789ABCDFF",
	// Real Estate & Construction categories
	realestate: "A1B2C3D4-E5F6-4789-0123-456789ABD000",
	construction: "A1B2C3D4-E5F6-4789-0123-456789ABD001",
	// Manufacturing & Quality categories
	manufacturing: "A1B2C3D4-E5F6-4789-0123-456789ABD002",
	quality: "A1B2C3D4-E5F6-4789-0123-456789ABD003",
	// Non-Profit categories
	nonprofit: "A1B2C3D4-E5F6-4789-0123-456789ABD004",
	impact: "A1B2C3D4-E5F6-4789-0123-456789ABD005",
	// Event & Conference categories
	events: "A1B2C3D4-E5F6-4789-0123-456789ABD006",
	sponsorship: "A1B2C3D4-E5F6-4789-0123-456789ABD007",
};

// ============================================================================
// New Category Definitions
// ============================================================================

export const NEW_CATEGORIES = [
	{
		id: PROFESSIONAL_CATEGORIES.consultancy,
		name: "Consultancy",
		shortId: "consultancy",
		description: "Consulting proposals, engagement letters, assessment reports, and advisory documents",
		icon: "Briefcase",
	},
	{
		id: PROFESSIONAL_CATEGORIES.business,
		name: "Business Management",
		shortId: "business",
		description: "Business plans, strategic plans, operational frameworks, and management documents",
		icon: "Building2",
	},
	{
		id: PROFESSIONAL_CATEGORIES.pmi,
		name: "PMI/PMBOK",
		shortId: "pmi",
		description: "Project Management Institute standard templates following PMBOK Guide methodology",
		icon: "Target",
	},
	{
		id: PROFESSIONAL_CATEGORIES.prince2,
		name: "PRINCE2",
		shortId: "prince2",
		description: "Projects IN Controlled Environments methodology templates and documents",
		icon: "Crown",
	},
	{
		id: PROFESSIONAL_CATEGORIES.strategy,
		name: "Strategy",
		shortId: "strategy",
		description: "Strategic planning, analysis frameworks, and organizational strategy documents",
		icon: "Compass",
	},
	// Sales & Marketing
	{
		id: PROFESSIONAL_CATEGORIES.sales,
		name: "Sales",
		shortId: "sales",
		description: "Sales proposals, quotes, pitches, and commercial documents",
		icon: "TrendingUp",
	},
	{
		id: PROFESSIONAL_CATEGORIES.marketing,
		name: "Marketing",
		shortId: "marketing",
		description: "Marketing plans, brand guidelines, campaigns, and promotional documents",
		icon: "Megaphone",
	},
	// Technical/Engineering
	{
		id: PROFESSIONAL_CATEGORIES.engineering,
		name: "Engineering",
		shortId: "engineering",
		description: "Technical documentation, system designs, and engineering specifications",
		icon: "Cpu",
	},
	{
		id: PROFESSIONAL_CATEGORIES.architecture,
		name: "Architecture",
		shortId: "architecture",
		description: "System architecture, design documents, and technical blueprints",
		icon: "Layers",
	},
	// Corporate Governance
	{
		id: PROFESSIONAL_CATEGORIES.corporate,
		name: "Corporate",
		shortId: "corporate",
		description: "Corporate documents, board materials, and governance frameworks",
		icon: "Building",
	},
	{
		id: PROFESSIONAL_CATEGORIES.governance,
		name: "Governance",
		shortId: "governance",
		description: "Governance policies, procedures, and organizational controls",
		icon: "Scale",
	},
	// Research & Product
	{
		id: PROFESSIONAL_CATEGORIES.research,
		name: "Research",
		shortId: "research",
		description: "Research proposals, studies, white papers, and academic documents",
		icon: "FlaskConical",
	},
	{
		id: PROFESSIONAL_CATEGORIES.product,
		name: "Product",
		shortId: "product",
		description: "Product requirements, roadmaps, specifications, and launch documents",
		icon: "Package",
	},
	// Grants & Funding
	{
		id: PROFESSIONAL_CATEGORIES.grants,
		name: "Grants",
		shortId: "grants",
		description: "Grant proposals, applications, and funding requests",
		icon: "Award",
	},
	{
		id: PROFESSIONAL_CATEGORIES.funding,
		name: "Funding",
		shortId: "funding",
		description: "Investment documents, pitch decks, and fundraising materials",
		icon: "Banknote",
	},
	// Real Estate & Construction
	{
		id: PROFESSIONAL_CATEGORIES.realestate,
		name: "Real Estate",
		shortId: "realestate",
		description: "Property agreements, leases, and real estate documentation",
		icon: "Home",
	},
	{
		id: PROFESSIONAL_CATEGORIES.construction,
		name: "Construction",
		shortId: "construction",
		description: "Construction contracts, specifications, and project documents",
		icon: "HardHat",
	},
	// Manufacturing & Quality
	{
		id: PROFESSIONAL_CATEGORIES.manufacturing,
		name: "Manufacturing",
		shortId: "manufacturing",
		description: "Manufacturing processes, SOPs, and production documents",
		icon: "Factory",
	},
	{
		id: PROFESSIONAL_CATEGORIES.quality,
		name: "Quality",
		shortId: "quality",
		description: "Quality management, inspection, and certification documents",
		icon: "BadgeCheck",
	},
	// Non-Profit
	{
		id: PROFESSIONAL_CATEGORIES.nonprofit,
		name: "Non-Profit",
		shortId: "nonprofit",
		description: "Non-profit organization documents, grant applications, and impact reports",
		icon: "Heart",
	},
	{
		id: PROFESSIONAL_CATEGORIES.impact,
		name: "Impact",
		shortId: "impact",
		description: "Impact assessments, social responsibility, and sustainability reports",
		icon: "Leaf",
	},
	// Events & Conferences
	{
		id: PROFESSIONAL_CATEGORIES.events,
		name: "Events",
		shortId: "events",
		description: "Event planning, conference materials, and meeting documents",
		icon: "Calendar",
	},
	{
		id: PROFESSIONAL_CATEGORIES.sponsorship,
		name: "Sponsorship",
		shortId: "sponsorship",
		description: "Sponsorship proposals, packages, and partnership documents",
		icon: "Handshake",
	},
];

// ============================================================================
// Template Type Definition
// ============================================================================

interface SectionConfig {
	title: string;
	level: number;
	prompt: string;
	subsections?: SectionConfig[];
}

interface PlaceholderConfig {
	id: string;
	name: string;
	variableName: string;
	description: string;
	type: "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "boolean" | "email" | "url" | "currency";
	required: boolean;
	defaultValue?: string;
	options?: Array<{ value: string; label: string }>;
}

interface TemplateDef {
	name: string;
	description: string;
	categoryIds: string[];
	tags: string[];
	difficulty: "beginner" | "intermediate" | "advanced";
	estimatedTime: number;
	sections: SectionConfig[];
	placeholders: PlaceholderConfig[];
}

// ============================================================================
// ENHANCED RFP RESPONSE TEMPLATES
// ============================================================================

export const ENHANCED_RFP_TEMPLATES: TemplateDef[] = [
	{
		name: "RFP Response - Comprehensive Multi-Volume",
		description: "Complete multi-volume RFP response with detailed technical approach, management plan, past performance, staffing, and cost proposal. Follows FAR 15.3 source selection procedures.",
		categoryIds: ["exec", "tech", "mgmt", "cost"],
		tags: ["rfp", "comprehensive", "government", "far-compliant", "source-selection", "multi-volume"],
		difficulty: "advanced",
		estimatedTime: 960,
		sections: [
			{
				title: "Volume I - Technical Approach",
				level: 1,
				prompt: "Develop a comprehensive technical approach that demonstrates deep understanding of the client's requirements and presents an innovative, risk-mitigated solution.",
				subsections: [
					{
						title: "1.0 Executive Summary",
						level: 2,
						prompt: "Write a compelling 3-5 page executive summary that highlights: (1) Your understanding of {{client_name}}'s mission-critical needs, (2) Your unique value proposition and discriminators, (3) Key innovations in your approach, (4) Risk mitigation strategies, (5) Expected outcomes and benefits. Use the 'ghost' the competition technique to subtly address competitor weaknesses.",
					},
					{
						title: "2.0 Understanding of Requirements",
						level: 2,
						prompt: "Demonstrate thorough understanding by going beyond the SOW. Reference {{client_name}}'s strategic plans, recent initiatives, and industry challenges.",
						subsections: [
							{
								title: "2.1 Mission and Strategic Context",
								level: 3,
								prompt: "Articulate how {{client_name}}'s mission drives the requirements. Reference their strategic plan, congressional mandates, and current operational challenges. Show you've done your homework beyond the RFP.",
							},
							{
								title: "2.2 Requirements Analysis",
								level: 3,
								prompt: "Present a detailed analysis of each requirement, demonstrating insight into underlying needs. Identify implicit requirements and potential scope refinements that would benefit {{client_name}}.",
							},
							{
								title: "2.3 Challenges and Constraints",
								level: 3,
								prompt: "Address known challenges: budget constraints, legacy system integration, security requirements, timeline pressures. Show realistic understanding of the operating environment.",
							},
						],
					},
					{
						title: "3.0 Technical Solution",
						level: 2,
						prompt: "Present your technical solution with clear architecture, methodology, and implementation approach.",
						subsections: [
							{
								title: "3.1 Solution Architecture",
								level: 3,
								prompt: "Describe the overall solution architecture. Include diagrams showing system components, interfaces, data flows, and integration points. Address scalability, security, and performance.",
							},
							{
								title: "3.2 Methodology and Approach",
								level: 3,
								prompt: "Detail your methodology (e.g., Agile, DevSecOps, ITIL). Explain how it aligns with {{client_name}}'s environment and why it's optimal for this engagement.",
							},
							{
								title: "3.3 Innovation and Value-Add",
								level: 3,
								prompt: "Highlight innovative elements that differentiate your solution. Include automation opportunities, AI/ML applications, and efficiency improvements. Quantify expected benefits.",
							},
							{
								title: "3.4 Technical Standards and Compliance",
								level: 3,
								prompt: "Address compliance with technical standards (NIST, FedRAMP, Section 508, etc.). Include your approach to maintaining compliance throughout the contract period.",
							},
						],
					},
					{
						title: "4.0 Implementation Plan",
						level: 2,
						prompt: "Provide a detailed, realistic implementation plan with phases, milestones, and deliverables.",
						subsections: [
							{
								title: "4.1 Phased Approach",
								level: 3,
								prompt: "Break implementation into logical phases with clear entry/exit criteria. Address dependencies, parallel workstreams, and critical path items.",
							},
							{
								title: "4.2 Schedule and Milestones",
								level: 3,
								prompt: "Present a detailed schedule showing key milestones, deliverables, and review points. Include Gantt chart or similar visual. Address schedule risk mitigation.",
							},
							{
								title: "4.3 Transition Approach",
								level: 3,
								prompt: "Detail the transition-in approach including knowledge transfer from incumbent, parallel operations period, and risk mitigation for service continuity.",
							},
						],
					},
					{
						title: "5.0 Risk Management",
						level: 2,
						prompt: "Present a comprehensive risk management approach with specific identified risks and mitigation strategies.",
						subsections: [
							{
								title: "5.1 Risk Identification",
								level: 3,
								prompt: "Identify technical, programmatic, and external risks. Use a risk register format showing probability, impact, and risk score for each identified risk.",
							},
							{
								title: "5.2 Mitigation Strategies",
								level: 3,
								prompt: "For each significant risk, provide specific mitigation strategies. Include preventive measures, contingency plans, and trigger points for escalation.",
							},
							{
								title: "5.3 Risk Monitoring",
								level: 3,
								prompt: "Describe your continuous risk monitoring process including metrics, reporting frequency, and governance structure for risk decisions.",
							},
						],
					},
				],
			},
			{
				title: "Volume II - Management Approach",
				level: 1,
				prompt: "Present a management approach that instills confidence in your ability to execute.",
				subsections: [
					{
						title: "1.0 Program Management",
						level: 2,
						prompt: "Describe your program management framework, governance structure, and oversight mechanisms.",
						subsections: [
							{
								title: "1.1 Organizational Structure",
								level: 3,
								prompt: "Present the organizational structure with clear roles, responsibilities, and reporting relationships. Include org chart showing {{client_name}} touchpoints.",
							},
							{
								title: "1.2 Governance and Decision Making",
								level: 3,
								prompt: "Detail governance processes including steering committees, decision authorities, and escalation procedures. Address how {{client_name}} maintains appropriate oversight.",
							},
							{
								title: "1.3 Performance Management",
								level: 3,
								prompt: "Describe your approach to measuring and managing performance against contract requirements. Include QA processes, metrics dashboards, and continuous improvement.",
							},
						],
					},
					{
						title: "2.0 Staffing Plan",
						level: 2,
						prompt: "Present your staffing approach demonstrating ability to recruit and retain qualified personnel.",
						subsections: [
							{
								title: "2.1 Staffing Strategy",
								level: 3,
								prompt: "Describe your approach to staffing including recruitment, retention, and development. Address clearance requirements and ramp-up timeline.",
							},
							{
								title: "2.2 Key Personnel",
								level: 3,
								prompt: "Introduce key personnel with summary qualifications demonstrating relevant experience. Reference detailed resumes in the staffing volume.",
							},
							{
								title: "2.3 Training and Development",
								level: 3,
								prompt: "Address initial and ongoing training requirements. Include certifications, security awareness, and professional development opportunities.",
							},
						],
					},
					{
						title: "3.0 Quality Management",
						level: 2,
						prompt: "Present your quality management system and commitment to excellence.",
						subsections: [
							{
								title: "3.1 Quality Management System",
								level: 3,
								prompt: "Describe your QMS including ISO certifications, CMMI levels, or equivalent. Explain how the system applies to this contract.",
							},
							{
								title: "3.2 Quality Assurance",
								level: 3,
								prompt: "Detail QA processes including reviews, audits, and inspections. Address how you ensure deliverables meet requirements before submission.",
							},
							{
								title: "3.3 Continuous Improvement",
								level: 3,
								prompt: "Describe your continuous improvement methodology. Include how lessons learned are captured, analyzed, and applied.",
							},
						],
					},
					{
						title: "4.0 Communications and Reporting",
						level: 2,
						prompt: "Detail your communications approach ensuring {{client_name}} maintains visibility.",
						subsections: [
							{
								title: "4.1 Communications Plan",
								level: 3,
								prompt: "Present your communications plan including regular meetings, status reporting, and stakeholder engagement approach.",
							},
							{
								title: "4.2 Reporting Framework",
								level: 3,
								prompt: "Detail reporting deliverables including format, frequency, and distribution. Address ad hoc and executive reporting capabilities.",
							},
						],
					},
				],
			},
			{
				title: "Volume III - Past Performance",
				level: 1,
				prompt: "Present compelling past performance demonstrating relevant experience and successful delivery.",
				subsections: [
					{
						title: "1.0 Past Performance Overview",
						level: 2,
						prompt: "Provide an overview of your past performance demonstrating pattern of successful delivery on similar contracts.",
					},
					{
						title: "2.0 Relevant Experience",
						level: 2,
						prompt: "Present 3-5 recent, relevant contracts with detailed performance information.",
						subsections: [
							{
								title: "2.1 Contract Reference 1",
								level: 3,
								prompt: "Detail the most relevant contract: scope, value, period of performance, client, and key accomplishments. Address how this experience directly applies to {{client_name}}'s requirements.",
							},
							{
								title: "2.2 Contract Reference 2",
								level: 3,
								prompt: "Present second reference with emphasis on aspects not covered by the first (e.g., different technology, scale, or client type).",
							},
							{
								title: "2.3 Contract Reference 3",
								level: 3,
								prompt: "Present third reference demonstrating breadth of experience and consistent performance pattern.",
							},
						],
					},
					{
						title: "3.0 Performance Ratings",
						level: 2,
						prompt: "Summarize CPARS ratings, award fees earned, and other performance metrics demonstrating excellence.",
					},
				],
			},
			{
				title: "Volume IV - Staffing",
				level: 1,
				prompt: "Present detailed qualifications of key personnel and overall staffing approach.",
				subsections: [
					{
						title: "1.0 Key Personnel Resumes",
						level: 2,
						prompt: "Provide detailed resumes for all key personnel demonstrating qualifications against position requirements.",
					},
					{
						title: "2.0 Labor Categories",
						level: 2,
						prompt: "Define labor categories with qualifications, experience requirements, and role descriptions.",
					},
					{
						title: "3.0 Staffing Matrix",
						level: 2,
						prompt: "Provide staffing matrix showing personnel allocation across tasks, phases, and locations.",
					},
				],
			},
			{
				title: "Volume V - Cost/Price Proposal",
				level: 1,
				prompt: "Present a compliant, competitive cost proposal with clear pricing methodology.",
				subsections: [
					{
						title: "1.0 Cost Summary",
						level: 2,
						prompt: "Provide executive summary of pricing including total evaluated price, pricing structure, and key assumptions.",
					},
					{
						title: "2.0 Pricing Methodology",
						level: 2,
						prompt: "Explain your pricing methodology including basis of estimate, rate development, and indirect cost allocation.",
					},
					{
						title: "3.0 Cost Breakdowns",
						level: 2,
						prompt: "Provide detailed cost breakdowns by CLIN, labor category, and contract year. Include supporting schedules.",
					},
					{
						title: "4.0 Basis of Estimate",
						level: 2,
						prompt: "Document basis of estimate for all cost elements demonstrating reasonableness and realism.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization's legal name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency or organization", type: "text", required: true },
			{ id: "p3", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "RFP/RFQ reference number", type: "text", required: true },
			{ id: "p4", name: "Contract Title", variableName: "{{contract_title}}", description: "Name of the procurement", type: "text", required: true },
			{ id: "p5", name: "Due Date", variableName: "{{due_date}}", description: "Proposal submission deadline", type: "date", required: true },
			{ id: "p6", name: "Contract Value", variableName: "{{contract_value}}", description: "Estimated contract value", type: "currency", required: false },
			{ id: "p7", name: "Contract Type", variableName: "{{contract_type}}", description: "Contract type (FFP, T&M, Cost-Plus, etc.)", type: "select", required: true, options: [
				{ value: "ffp", label: "Firm Fixed Price (FFP)" },
				{ value: "tm", label: "Time & Materials (T&M)" },
				{ value: "cpff", label: "Cost Plus Fixed Fee (CPFF)" },
				{ value: "cpaf", label: "Cost Plus Award Fee (CPAF)" },
				{ value: "idiq", label: "Indefinite Delivery/Indefinite Quantity (IDIQ)" },
			]},
			{ id: "p8", name: "Period of Performance", variableName: "{{pop}}", description: "Contract duration", type: "text", required: true, defaultValue: "5 years (1 base + 4 option years)" },
			{ id: "p9", name: "NAICS Code", variableName: "{{naics}}", description: "North American Industry Classification System code", type: "text", required: false },
			{ id: "p10", name: "Set-Aside Type", variableName: "{{set_aside}}", description: "Small business set-aside designation", type: "select", required: false, options: [
				{ value: "full", label: "Full and Open Competition" },
				{ value: "sb", label: "Small Business Set-Aside" },
				{ value: "8a", label: "8(a) Set-Aside" },
				{ value: "hubzone", label: "HUBZone Set-Aside" },
				{ value: "sdvosb", label: "Service-Disabled Veteran-Owned Small Business" },
				{ value: "wosb", label: "Women-Owned Small Business" },
			]},
		],
	},
	{
		name: "RFP Response - IT Modernization",
		description: "Specialized template for IT modernization and digital transformation proposals. Addresses legacy system migration, cloud adoption, and technology refresh requirements.",
		categoryIds: ["tech", "exec"],
		tags: ["rfp", "it-modernization", "cloud", "digital-transformation", "legacy-migration"],
		difficulty: "advanced",
		estimatedTime: 720,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Write a compelling executive summary emphasizing modernization benefits: reduced technical debt, improved security posture, enhanced user experience, and operational efficiency gains for {{client_name}}.",
			},
			{
				title: "Current State Assessment",
				level: 1,
				prompt: "Demonstrate understanding of {{client_name}}'s current IT environment, pain points, and modernization drivers.",
				subsections: [
					{ title: "Legacy System Inventory", level: 2, prompt: "Document understanding of current systems, technologies, and technical debt to be addressed." },
					{ title: "Pain Points and Challenges", level: 2, prompt: "Articulate the business and technical challenges driving modernization need." },
					{ title: "Stakeholder Impact", level: 2, prompt: "Identify stakeholders affected by modernization and their specific concerns." },
				],
			},
			{
				title: "Target State Architecture",
				level: 1,
				prompt: "Present the modernized target state architecture aligned with industry best practices.",
				subsections: [
					{ title: "Architecture Vision", level: 2, prompt: "Describe the target architecture including cloud strategy, microservices, APIs, and data architecture." },
					{ title: "Technology Stack", level: 2, prompt: "Detail the proposed technology stack with rationale for each selection." },
					{ title: "Security Architecture", level: 2, prompt: "Address security in the modernized environment including Zero Trust, identity management, and data protection." },
				],
			},
			{
				title: "Modernization Approach",
				level: 1,
				prompt: "Detail your approach to achieving the target state with minimal disruption.",
				subsections: [
					{ title: "Migration Strategy", level: 2, prompt: "Present migration strategy (lift-and-shift, re-platform, re-factor, replace) for each component." },
					{ title: "Phased Roadmap", level: 2, prompt: "Provide phased implementation roadmap with quick wins and foundational elements." },
					{ title: "Parallel Operations", level: 2, prompt: "Address how legacy and modern systems will coexist during transition." },
					{ title: "Data Migration", level: 2, prompt: "Detail data migration approach including validation, cleansing, and reconciliation." },
				],
			},
			{
				title: "Risk Management",
				level: 1,
				prompt: "Address modernization-specific risks and mitigation strategies.",
			},
			{
				title: "Success Metrics",
				level: 1,
				prompt: "Define measurable success criteria and KPIs for the modernization initiative.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Legacy Systems", variableName: "{{legacy_systems}}", description: "List of systems to be modernized", type: "textarea", required: true },
			{ id: "p4", name: "Cloud Platform", variableName: "{{cloud_platform}}", description: "Target cloud platform", type: "select", required: true, options: [
				{ value: "aws", label: "Amazon Web Services (AWS)" },
				{ value: "azure", label: "Microsoft Azure" },
				{ value: "gcp", label: "Google Cloud Platform" },
				{ value: "multi", label: "Multi-Cloud Strategy" },
				{ value: "hybrid", label: "Hybrid Cloud" },
			]},
		],
	},
	{
		name: "RFP Response - Cybersecurity Services",
		description: "Template for cybersecurity services proposals including SOC operations, threat hunting, vulnerability management, and incident response.",
		categoryIds: ["tech", "security"],
		tags: ["rfp", "cybersecurity", "soc", "threat-hunting", "incident-response"],
		difficulty: "advanced",
		estimatedTime: 600,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Present cybersecurity value proposition emphasizing threat landscape understanding, proven capabilities, and commitment to protecting {{client_name}}'s mission.",
			},
			{
				title: "Security Operations Approach",
				level: 1,
				prompt: "Detail your security operations methodology and capabilities.",
				subsections: [
					{ title: "SOC Operations", level: 2, prompt: "Describe 24/7 SOC operations including staffing model, tools, and processes." },
					{ title: "Threat Intelligence", level: 2, prompt: "Detail threat intelligence sources, analysis capabilities, and integration with operations." },
					{ title: "Detection and Response", level: 2, prompt: "Explain detection methodologies, alert triage, and incident response procedures." },
				],
			},
			{
				title: "Vulnerability Management",
				level: 1,
				prompt: "Present comprehensive vulnerability management program.",
				subsections: [
					{ title: "Assessment Methodology", level: 2, prompt: "Describe vulnerability assessment approach, tools, and frequency." },
					{ title: "Remediation Support", level: 2, prompt: "Detail remediation tracking, prioritization, and support services." },
					{ title: "Compliance Scanning", level: 2, prompt: "Address compliance scanning for NIST, FISMA, and agency-specific requirements." },
				],
			},
			{
				title: "Incident Response",
				level: 1,
				prompt: "Detail incident response capabilities and processes.",
				subsections: [
					{ title: "IR Team and Capabilities", level: 2, prompt: "Present IR team qualifications, certifications, and experience." },
					{ title: "Response Procedures", level: 2, prompt: "Detail incident response procedures aligned with NIST framework." },
					{ title: "Forensics Capabilities", level: 2, prompt: "Describe digital forensics capabilities and chain of custody procedures." },
				],
			},
			{
				title: "Security Metrics and Reporting",
				level: 1,
				prompt: "Present security metrics framework and reporting capabilities.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Security Framework", variableName: "{{security_framework}}", description: "Primary security framework", type: "select", required: true, options: [
				{ value: "nist-csf", label: "NIST Cybersecurity Framework" },
				{ value: "nist-rmf", label: "NIST Risk Management Framework" },
				{ value: "fedramp", label: "FedRAMP" },
				{ value: "iso27001", label: "ISO 27001" },
			]},
		],
	},
];

// ============================================================================
// CONSULTANCY TEMPLATES
// ============================================================================

export const CONSULTANCY_TEMPLATES: TemplateDef[] = [
	{
		name: "Consulting Engagement Proposal",
		description: "Professional consulting engagement proposal covering scope, approach, deliverables, timeline, and pricing. Suitable for management consulting, strategy, and advisory engagements.",
		categoryIds: ["consultancy", "exec"],
		tags: ["consulting", "proposal", "engagement", "professional-services"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Write a compelling executive summary that articulates the client's challenge, your proposed solution, expected outcomes, and key differentiators of {{company_name}}.",
			},
			{
				title: "Understanding of Your Situation",
				level: 1,
				prompt: "Demonstrate deep understanding of {{client_name}}'s current situation, challenges, and objectives based on discovery conversations.",
				subsections: [
					{ title: "Current State Analysis", level: 2, prompt: "Summarize the current state based on discovery sessions, highlighting pain points and opportunities." },
					{ title: "Key Challenges", level: 2, prompt: "Articulate the primary challenges that need to be addressed." },
					{ title: "Desired Outcomes", level: 2, prompt: "Define the desired future state and success criteria from the client's perspective." },
				],
			},
			{
				title: "Our Approach",
				level: 1,
				prompt: "Present your consulting methodology and approach to addressing the client's needs.",
				subsections: [
					{ title: "Methodology Overview", level: 2, prompt: "Describe your consulting methodology and why it's appropriate for this engagement." },
					{ title: "Phase 1: Discovery & Assessment", level: 2, prompt: "Detail the discovery phase including stakeholder interviews, data analysis, and current state documentation." },
					{ title: "Phase 2: Analysis & Recommendations", level: 2, prompt: "Describe the analysis phase including gap analysis, benchmarking, and recommendation development." },
					{ title: "Phase 3: Implementation Support", level: 2, prompt: "Detail implementation support including change management, training, and ongoing advisory." },
				],
			},
			{
				title: "Deliverables",
				level: 1,
				prompt: "List all deliverables with descriptions and acceptance criteria.",
			},
			{
				title: "Project Timeline",
				level: 1,
				prompt: "Present the engagement timeline with phases, milestones, and key dates.",
			},
			{
				title: "Team and Qualifications",
				level: 1,
				prompt: "Introduce the consulting team with relevant qualifications and experience.",
			},
			{
				title: "Investment",
				level: 1,
				prompt: "Present the fee structure, payment terms, and what's included/excluded.",
			},
			{
				title: "Why {{company_name}}",
				level: 1,
				prompt: "Articulate your unique value proposition and differentiators.",
			},
			{
				title: "Next Steps",
				level: 1,
				prompt: "Outline clear next steps to proceed with the engagement.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your consulting firm name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client organization name", type: "text", required: true },
			{ id: "p3", name: "Engagement Type", variableName: "{{engagement_type}}", description: "Type of consulting engagement", type: "select", required: true, options: [
				{ value: "strategy", label: "Strategy Consulting" },
				{ value: "operations", label: "Operations Improvement" },
				{ value: "digital", label: "Digital Transformation" },
				{ value: "organizational", label: "Organizational Design" },
				{ value: "change", label: "Change Management" },
				{ value: "advisory", label: "Advisory Services" },
			]},
			{ id: "p4", name: "Engagement Duration", variableName: "{{duration}}", description: "Expected engagement duration", type: "text", required: true, defaultValue: "12 weeks" },
			{ id: "p5", name: "Total Investment", variableName: "{{total_investment}}", description: "Proposed engagement fee", type: "currency", required: true },
		],
	},
	{
		name: "Management Consulting Assessment Report",
		description: "Comprehensive assessment report template for management consulting engagements. Includes current state analysis, findings, recommendations, and implementation roadmap.",
		categoryIds: ["consultancy", "mgmt"],
		tags: ["consulting", "assessment", "report", "recommendations", "analysis"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize key findings, critical recommendations, and expected benefits in 2-3 pages for executive audience.",
			},
			{
				title: "Introduction",
				level: 1,
				prompt: "Provide context including engagement objectives, scope, methodology, and stakeholders involved.",
			},
			{
				title: "Current State Assessment",
				level: 1,
				prompt: "Present comprehensive analysis of the current state across relevant dimensions.",
				subsections: [
					{ title: "Organizational Analysis", level: 2, prompt: "Analyze organizational structure, roles, responsibilities, and spans of control." },
					{ title: "Process Analysis", level: 2, prompt: "Document and analyze key business processes, identifying inefficiencies and bottlenecks." },
					{ title: "Technology Assessment", level: 2, prompt: "Assess current technology landscape, capabilities, and gaps." },
					{ title: "Performance Analysis", level: 2, prompt: "Analyze key performance metrics, trends, and benchmarks against industry standards." },
					{ title: "Culture and Change Readiness", level: 2, prompt: "Assess organizational culture, change readiness, and potential resistance factors." },
				],
			},
			{
				title: "Key Findings",
				level: 1,
				prompt: "Present prioritized findings with supporting evidence and impact analysis.",
				subsections: [
					{ title: "Strengths", level: 2, prompt: "Document organizational strengths and assets to leverage." },
					{ title: "Opportunities", level: 2, prompt: "Identify improvement opportunities with potential value." },
					{ title: "Challenges", level: 2, prompt: "Document challenges and barriers to success." },
					{ title: "Risks", level: 2, prompt: "Identify risks requiring attention and mitigation." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Present detailed recommendations with rationale, expected benefits, and implementation considerations.",
				subsections: [
					{ title: "Strategic Recommendations", level: 2, prompt: "Present strategic-level recommendations addressing long-term positioning." },
					{ title: "Operational Recommendations", level: 2, prompt: "Detail operational improvements with quick wins and efficiency gains." },
					{ title: "Organizational Recommendations", level: 2, prompt: "Recommend organizational structure, capability, and talent changes." },
					{ title: "Technology Recommendations", level: 2, prompt: "Recommend technology investments, upgrades, or consolidations." },
				],
			},
			{
				title: "Implementation Roadmap",
				level: 1,
				prompt: "Present phased implementation roadmap with prioritization, dependencies, and resource requirements.",
				subsections: [
					{ title: "Quick Wins (0-3 months)", level: 2, prompt: "Identify and detail quick win initiatives that can demonstrate early value." },
					{ title: "Foundation Building (3-6 months)", level: 2, prompt: "Detail foundational initiatives required for long-term success." },
					{ title: "Transformation Initiatives (6-18 months)", level: 2, prompt: "Present major transformation initiatives with milestones." },
					{ title: "Resource Requirements", level: 2, prompt: "Estimate resources (people, budget, technology) required for implementation." },
				],
			},
			{
				title: "Business Case",
				level: 1,
				prompt: "Present financial analysis including investment required, expected benefits, and ROI.",
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Identify implementation risks and mitigation strategies.",
			},
			{
				title: "Appendices",
				level: 1,
				prompt: "Include supporting materials, detailed data, and methodology documentation.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Client Name", variableName: "{{client_name}}", description: "Client organization name", type: "text", required: true },
			{ id: "p2", name: "Assessment Scope", variableName: "{{scope}}", description: "Scope of the assessment", type: "textarea", required: true },
			{ id: "p3", name: "Assessment Date", variableName: "{{assessment_date}}", description: "Date assessment was conducted", type: "date", required: true },
			{ id: "p4", name: "Consulting Firm", variableName: "{{company_name}}", description: "Your consulting firm name", type: "text", required: true },
		],
	},
	{
		name: "Strategic Advisory Engagement Letter",
		description: "Formal engagement letter for strategic advisory services outlining scope, responsibilities, fees, and terms.",
		categoryIds: ["consultancy"],
		tags: ["engagement-letter", "advisory", "legal", "contract"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Introduction",
				level: 1,
				prompt: "Formal introduction confirming the advisory engagement and expressing appreciation for the opportunity.",
			},
			{
				title: "Scope of Services",
				level: 1,
				prompt: "Define the specific advisory services to be provided with clear boundaries.",
			},
			{
				title: "Deliverables",
				level: 1,
				prompt: "List all deliverables with descriptions and delivery schedule.",
			},
			{
				title: "Client Responsibilities",
				level: 1,
				prompt: "Define client responsibilities including information access, personnel availability, and decision timelines.",
			},
			{
				title: "Timing and Schedule",
				level: 1,
				prompt: "Define engagement timeline, key milestones, and expected completion date.",
			},
			{
				title: "Fees and Expenses",
				level: 1,
				prompt: "Detail fee structure, payment terms, expense policy, and invoicing schedule.",
			},
			{
				title: "Confidentiality",
				level: 1,
				prompt: "Define confidentiality obligations for both parties.",
			},
			{
				title: "Limitation of Liability",
				level: 1,
				prompt: "Include appropriate limitation of liability provisions.",
			},
			{
				title: "Termination",
				level: 1,
				prompt: "Define termination provisions including notice period and wind-down procedures.",
			},
			{
				title: "Acceptance",
				level: 1,
				prompt: "Include signature blocks and acceptance terms.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your firm name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client name", type: "text", required: true },
			{ id: "p3", name: "Effective Date", variableName: "{{effective_date}}", description: "Engagement start date", type: "date", required: true },
			{ id: "p4", name: "Monthly Retainer", variableName: "{{retainer}}", description: "Monthly retainer fee", type: "currency", required: false },
		],
	},
	{
		name: "Due Diligence Report",
		description: "Comprehensive due diligence report template for M&A, investment, or partnership evaluation.",
		categoryIds: ["consultancy", "business"],
		tags: ["due-diligence", "m&a", "investment", "analysis"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize key findings, material issues identified, and overall assessment/recommendation.",
			},
			{
				title: "Company Overview",
				level: 1,
				prompt: "Provide comprehensive overview of the target company.",
				subsections: [
					{ title: "Business Description", level: 2, prompt: "Describe the company's business, products/services, and market position." },
					{ title: "Corporate Structure", level: 2, prompt: "Document legal entity structure, subsidiaries, and ownership." },
					{ title: "Management Team", level: 2, prompt: "Profile key management with backgrounds and tenure." },
				],
			},
			{
				title: "Financial Analysis",
				level: 1,
				prompt: "Present detailed financial analysis and quality of earnings assessment.",
				subsections: [
					{ title: "Historical Financial Performance", level: 2, prompt: "Analyze 3-5 years of historical financial statements." },
					{ title: "Quality of Earnings", level: 2, prompt: "Assess quality of earnings including adjustments and normalizations." },
					{ title: "Working Capital Analysis", level: 2, prompt: "Analyze working capital trends and requirements." },
					{ title: "Debt and Capitalization", level: 2, prompt: "Review debt structure, covenants, and capitalization." },
				],
			},
			{
				title: "Commercial Analysis",
				level: 1,
				prompt: "Assess market position, competitive landscape, and commercial viability.",
				subsections: [
					{ title: "Market Analysis", level: 2, prompt: "Analyze target market size, growth, and trends." },
					{ title: "Competitive Position", level: 2, prompt: "Assess competitive position and sustainable advantages." },
					{ title: "Customer Analysis", level: 2, prompt: "Analyze customer base, concentration, and relationships." },
				],
			},
			{
				title: "Operational Analysis",
				level: 1,
				prompt: "Assess operational capabilities, efficiency, and scalability.",
			},
			{
				title: "Legal and Regulatory",
				level: 1,
				prompt: "Document legal and regulatory findings.",
				subsections: [
					{ title: "Material Contracts", level: 2, prompt: "Summarize material contracts and key terms." },
					{ title: "Litigation and Claims", level: 2, prompt: "Document pending or threatened litigation." },
					{ title: "Regulatory Compliance", level: 2, prompt: "Assess regulatory compliance status and risks." },
				],
			},
			{
				title: "Human Resources",
				level: 1,
				prompt: "Assess HR matters including compensation, benefits, and labor relations.",
			},
			{
				title: "Technology and IP",
				level: 1,
				prompt: "Assess technology infrastructure, intellectual property, and cybersecurity.",
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Summarize key risks identified with severity and mitigation recommendations.",
			},
			{
				title: "Conclusions and Recommendations",
				level: 1,
				prompt: "Present overall conclusions and recommended next steps.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Target Company", variableName: "{{target_company}}", description: "Target company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client/acquirer name", type: "text", required: true },
			{ id: "p3", name: "Transaction Type", variableName: "{{transaction_type}}", description: "Type of transaction", type: "select", required: true, options: [
				{ value: "acquisition", label: "Acquisition" },
				{ value: "merger", label: "Merger" },
				{ value: "investment", label: "Investment" },
				{ value: "partnership", label: "Partnership" },
			]},
		],
	},
	{
		name: "Workshop Facilitation Guide",
		description: "Template for planning and facilitating client workshops including agenda, exercises, and outputs.",
		categoryIds: ["consultancy"],
		tags: ["workshop", "facilitation", "agenda", "exercises"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Workshop Overview",
				level: 1,
				prompt: "Define workshop objectives, expected outcomes, and success criteria.",
			},
			{
				title: "Pre-Workshop Preparation",
				level: 1,
				prompt: "List pre-workshop activities including materials, communications, and logistics.",
			},
			{
				title: "Detailed Agenda",
				level: 1,
				prompt: "Provide minute-by-minute agenda with activities, facilitator notes, and timing.",
				subsections: [
					{ title: "Opening and Introductions", level: 2, prompt: "Detail opening activities, icebreakers, and agenda review." },
					{ title: "Context Setting", level: 2, prompt: "Present background information and frame the discussion." },
					{ title: "Working Sessions", level: 2, prompt: "Detail each working session with exercises, breakouts, and facilitation notes." },
					{ title: "Synthesis and Action Planning", level: 2, prompt: "Describe synthesis activities and action planning session." },
					{ title: "Closing", level: 2, prompt: "Detail closing activities, next steps, and feedback collection." },
				],
			},
			{
				title: "Facilitation Techniques",
				level: 1,
				prompt: "Document facilitation techniques, exercises, and tools to be used.",
			},
			{
				title: "Materials and Supplies",
				level: 1,
				prompt: "List all materials, supplies, and technology requirements.",
			},
			{
				title: "Post-Workshop Follow-up",
				level: 1,
				prompt: "Define post-workshop activities including summary report, action tracking, and follow-up meetings.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Workshop Title", variableName: "{{workshop_title}}", description: "Name of the workshop", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client organization", type: "text", required: true },
			{ id: "p3", name: "Workshop Date", variableName: "{{workshop_date}}", description: "Date of workshop", type: "date", required: true },
			{ id: "p4", name: "Duration", variableName: "{{duration}}", description: "Workshop duration", type: "text", required: true, defaultValue: "Full day (8 hours)" },
			{ id: "p5", name: "Participants", variableName: "{{participants}}", description: "Number of participants", type: "number", required: true },
		],
	},
];

// ============================================================================
// BUSINESS MANAGEMENT TEMPLATES
// ============================================================================

export const BUSINESS_MANAGEMENT_TEMPLATES: TemplateDef[] = [
	{
		name: "Business Plan - Comprehensive",
		description: "Complete business plan template covering executive summary, market analysis, operations, financials, and growth strategy. Suitable for startups and established businesses.",
		categoryIds: ["business", "strategy", "exec"],
		tags: ["business-plan", "strategy", "startup", "funding", "comprehensive"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Write a compelling 2-3 page executive summary covering: business concept, market opportunity, competitive advantage, financial highlights, and funding requirements.",
			},
			{
				title: "Company Description",
				level: 1,
				prompt: "Describe {{company_name}} including mission, vision, values, legal structure, and history.",
				subsections: [
					{ title: "Mission and Vision", level: 2, prompt: "Articulate the company's mission, vision, and core values." },
					{ title: "Company History", level: 2, prompt: "Provide relevant company background and milestones." },
					{ title: "Legal Structure", level: 2, prompt: "Describe legal structure, ownership, and key stakeholders." },
				],
			},
			{
				title: "Products and Services",
				level: 1,
				prompt: "Detail products/services including features, benefits, pricing, and competitive differentiation.",
				subsections: [
					{ title: "Product/Service Description", level: 2, prompt: "Describe each product or service in detail." },
					{ title: "Value Proposition", level: 2, prompt: "Articulate the unique value proposition and customer benefits." },
					{ title: "Pricing Strategy", level: 2, prompt: "Explain pricing strategy, margins, and competitive positioning." },
					{ title: "Product Roadmap", level: 2, prompt: "Present future product development plans." },
				],
			},
			{
				title: "Market Analysis",
				level: 1,
				prompt: "Present comprehensive market analysis demonstrating understanding and opportunity.",
				subsections: [
					{ title: "Industry Overview", level: 2, prompt: "Analyze industry trends, size, growth rate, and dynamics." },
					{ title: "Target Market", level: 2, prompt: "Define target market segments with demographics and psychographics." },
					{ title: "Market Size and Opportunity", level: 2, prompt: "Quantify total addressable market (TAM), serviceable addressable market (SAM), and serviceable obtainable market (SOM)." },
					{ title: "Competitive Analysis", level: 2, prompt: "Analyze competitors including strengths, weaknesses, market share, and positioning." },
				],
			},
			{
				title: "Marketing and Sales Strategy",
				level: 1,
				prompt: "Detail go-to-market strategy, marketing channels, and sales approach.",
				subsections: [
					{ title: "Marketing Strategy", level: 2, prompt: "Describe marketing channels, messaging, and customer acquisition strategy." },
					{ title: "Sales Strategy", level: 2, prompt: "Detail sales process, team structure, and revenue targets." },
					{ title: "Customer Retention", level: 2, prompt: "Explain customer success and retention strategies." },
				],
			},
			{
				title: "Operations Plan",
				level: 1,
				prompt: "Describe operational model, processes, and infrastructure.",
				subsections: [
					{ title: "Business Model", level: 2, prompt: "Describe the business model including revenue streams and cost structure." },
					{ title: "Operations Overview", level: 2, prompt: "Detail day-to-day operations, facilities, and equipment." },
					{ title: "Technology and Systems", level: 2, prompt: "Describe technology infrastructure and systems." },
					{ title: "Supply Chain", level: 2, prompt: "Detail supply chain, vendors, and partnerships." },
				],
			},
			{
				title: "Management Team",
				level: 1,
				prompt: "Introduce the management team demonstrating capability to execute.",
				subsections: [
					{ title: "Leadership Team", level: 2, prompt: "Profile key executives with backgrounds and relevant experience." },
					{ title: "Organizational Structure", level: 2, prompt: "Present organizational structure and key roles." },
					{ title: "Advisory Board", level: 2, prompt: "Describe advisors and board members if applicable." },
				],
			},
			{
				title: "Financial Plan",
				level: 1,
				prompt: "Present detailed financial projections and funding requirements.",
				subsections: [
					{ title: "Revenue Model", level: 2, prompt: "Explain revenue model and assumptions." },
					{ title: "Financial Projections", level: 2, prompt: "Present 3-5 year projections including income statement, balance sheet, and cash flow." },
					{ title: "Key Metrics", level: 2, prompt: "Define key financial and operational metrics." },
					{ title: "Funding Requirements", level: 2, prompt: "Detail funding requirements, use of funds, and expected returns." },
				],
			},
			{
				title: "Risk Analysis",
				level: 1,
				prompt: "Identify key risks and mitigation strategies.",
			},
			{
				title: "Implementation Timeline",
				level: 1,
				prompt: "Present implementation roadmap with key milestones.",
			},
			{
				title: "Appendices",
				level: 1,
				prompt: "Include supporting documents, detailed financials, and market research.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Industry", variableName: "{{industry}}", description: "Primary industry", type: "text", required: true },
			{ id: "p3", name: "Funding Sought", variableName: "{{funding_amount}}", description: "Amount of funding sought", type: "currency", required: false },
			{ id: "p4", name: "Plan Date", variableName: "{{plan_date}}", description: "Date of business plan", type: "date", required: true },
		],
	},
	{
		name: "Strategic Plan",
		description: "Multi-year strategic plan template with vision, mission, strategic objectives, and implementation roadmap.",
		categoryIds: ["business", "strategy"],
		tags: ["strategic-plan", "strategy", "planning", "objectives"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the strategic plan including vision, key objectives, and expected outcomes.",
			},
			{
				title: "Strategic Foundation",
				level: 1,
				prompt: "Establish the strategic foundation for {{company_name}}.",
				subsections: [
					{ title: "Mission Statement", level: 2, prompt: "Define or reaffirm the organization's mission." },
					{ title: "Vision Statement", level: 2, prompt: "Articulate the long-term vision for the organization." },
					{ title: "Core Values", level: 2, prompt: "Define the core values that guide organizational behavior." },
				],
			},
			{
				title: "Situational Analysis",
				level: 1,
				prompt: "Analyze the current internal and external environment.",
				subsections: [
					{ title: "External Environment", level: 2, prompt: "Analyze external factors using PESTEL framework (Political, Economic, Social, Technological, Environmental, Legal)." },
					{ title: "Industry Analysis", level: 2, prompt: "Analyze industry dynamics using Porter's Five Forces." },
					{ title: "Internal Assessment", level: 2, prompt: "Assess internal capabilities, resources, and performance." },
					{ title: "SWOT Analysis", level: 2, prompt: "Present comprehensive SWOT analysis synthesizing internal and external factors." },
				],
			},
			{
				title: "Strategic Objectives",
				level: 1,
				prompt: "Define strategic objectives for the planning period.",
				subsections: [
					{ title: "Financial Objectives", level: 2, prompt: "Define financial goals including revenue, profitability, and efficiency targets." },
					{ title: "Customer Objectives", level: 2, prompt: "Define customer-focused objectives including satisfaction, retention, and growth." },
					{ title: "Internal Process Objectives", level: 2, prompt: "Define operational excellence and process improvement objectives." },
					{ title: "Learning and Growth Objectives", level: 2, prompt: "Define people, culture, and capability development objectives." },
				],
			},
			{
				title: "Strategic Initiatives",
				level: 1,
				prompt: "Detail the strategic initiatives to achieve objectives.",
			},
			{
				title: "Implementation Roadmap",
				level: 1,
				prompt: "Present phased implementation plan with timeline and milestones.",
			},
			{
				title: "Resource Requirements",
				level: 1,
				prompt: "Define resource requirements including budget, personnel, and technology.",
			},
			{
				title: "Performance Measurement",
				level: 1,
				prompt: "Define KPIs, targets, and monitoring approach.",
			},
			{
				title: "Governance and Review",
				level: 1,
				prompt: "Establish governance structure and review cadence.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Planning Horizon", variableName: "{{planning_horizon}}", description: "Strategic plan timeframe", type: "select", required: true, options: [
				{ value: "3", label: "3 Years" },
				{ value: "5", label: "5 Years" },
				{ value: "10", label: "10 Years" },
			]},
			{ id: "p3", name: "Fiscal Year Start", variableName: "{{fy_start}}", description: "Fiscal year start date", type: "date", required: true },
		],
	},
	{
		name: "SWOT Analysis Report",
		description: "Structured SWOT analysis template with detailed analysis of Strengths, Weaknesses, Opportunities, and Threats.",
		categoryIds: ["business", "strategy"],
		tags: ["swot", "analysis", "strategy", "planning"],
		difficulty: "beginner",
		estimatedTime: 90,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize key findings from the SWOT analysis and strategic implications.",
			},
			{
				title: "Introduction",
				level: 1,
				prompt: "Provide context for the SWOT analysis including purpose, scope, and methodology.",
			},
			{
				title: "Strengths",
				level: 1,
				prompt: "Analyze internal strengths that provide competitive advantage.",
				subsections: [
					{ title: "Core Competencies", level: 2, prompt: "Identify and analyze core competencies and distinctive capabilities." },
					{ title: "Resources and Assets", level: 2, prompt: "Document valuable resources including financial, human, and intellectual capital." },
					{ title: "Market Position", level: 2, prompt: "Analyze market position strengths including brand, reputation, and relationships." },
				],
			},
			{
				title: "Weaknesses",
				level: 1,
				prompt: "Analyze internal weaknesses that need to be addressed.",
				subsections: [
					{ title: "Capability Gaps", level: 2, prompt: "Identify capability and skill gaps." },
					{ title: "Resource Constraints", level: 2, prompt: "Document resource limitations and constraints." },
					{ title: "Operational Challenges", level: 2, prompt: "Analyze operational inefficiencies and challenges." },
				],
			},
			{
				title: "Opportunities",
				level: 1,
				prompt: "Analyze external opportunities for growth and improvement.",
				subsections: [
					{ title: "Market Opportunities", level: 2, prompt: "Identify market growth, new segments, and expansion opportunities." },
					{ title: "Technology Opportunities", level: 2, prompt: "Analyze technology trends that create opportunities." },
					{ title: "Regulatory/Industry Changes", level: 2, prompt: "Identify favorable regulatory or industry changes." },
				],
			},
			{
				title: "Threats",
				level: 1,
				prompt: "Analyze external threats that could impact the organization.",
				subsections: [
					{ title: "Competitive Threats", level: 2, prompt: "Analyze competitive threats including new entrants and substitutes." },
					{ title: "Market Threats", level: 2, prompt: "Identify market risks including economic, regulatory, and demand changes." },
					{ title: "Technology Threats", level: 2, prompt: "Analyze technology disruption risks." },
				],
			},
			{
				title: "Strategic Implications",
				level: 1,
				prompt: "Synthesize findings into strategic implications and recommended actions.",
				subsections: [
					{ title: "SO Strategies (Strengths-Opportunities)", level: 2, prompt: "Identify strategies that use strengths to capitalize on opportunities." },
					{ title: "WO Strategies (Weaknesses-Opportunities)", level: 2, prompt: "Identify strategies that address weaknesses to capture opportunities." },
					{ title: "ST Strategies (Strengths-Threats)", level: 2, prompt: "Identify strategies that use strengths to mitigate threats." },
					{ title: "WT Strategies (Weaknesses-Threats)", level: 2, prompt: "Identify strategies that address weaknesses and defend against threats." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Present prioritized strategic recommendations based on the analysis.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Analysis Date", variableName: "{{analysis_date}}", description: "Date of analysis", type: "date", required: true },
			{ id: "p3", name: "Business Unit", variableName: "{{business_unit}}", description: "Business unit or division (if applicable)", type: "text", required: false },
		],
	},
	{
		name: "Operational Plan",
		description: "Annual operational plan template linking strategic objectives to operational activities, budgets, and performance metrics.",
		categoryIds: ["business", "mgmt"],
		tags: ["operational-plan", "annual-plan", "budget", "performance"],
		difficulty: "intermediate",
		estimatedTime: 240,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the operational plan including key priorities, resource requirements, and expected outcomes.",
			},
			{
				title: "Strategic Context",
				level: 1,
				prompt: "Link the operational plan to strategic objectives and organizational priorities.",
			},
			{
				title: "Operational Priorities",
				level: 1,
				prompt: "Define the key operational priorities for the planning period.",
			},
			{
				title: "Departmental Plans",
				level: 1,
				prompt: "Detail operational plans by department or function.",
				subsections: [
					{ title: "Operations/Production", level: 2, prompt: "Detail operations or production plans including capacity, efficiency, and quality targets." },
					{ title: "Sales and Marketing", level: 2, prompt: "Detail sales and marketing plans including pipeline, campaigns, and customer acquisition." },
					{ title: "Finance", level: 2, prompt: "Detail finance plans including budgeting, reporting, and financial management." },
					{ title: "Human Resources", level: 2, prompt: "Detail HR plans including hiring, development, and employee engagement." },
					{ title: "Technology", level: 2, prompt: "Detail technology plans including systems, infrastructure, and projects." },
				],
			},
			{
				title: "Budget",
				level: 1,
				prompt: "Present the operational budget with revenue and expense projections.",
				subsections: [
					{ title: "Revenue Budget", level: 2, prompt: "Detail revenue projections by product/service and customer segment." },
					{ title: "Operating Expenses", level: 2, prompt: "Detail operating expense budget by category." },
					{ title: "Capital Expenditures", level: 2, prompt: "Detail planned capital investments." },
				],
			},
			{
				title: "Performance Metrics",
				level: 1,
				prompt: "Define KPIs and targets for monitoring operational performance.",
			},
			{
				title: "Risk Management",
				level: 1,
				prompt: "Identify operational risks and mitigation plans.",
			},
			{
				title: "Implementation Calendar",
				level: 1,
				prompt: "Present the implementation calendar with key activities by quarter/month.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Fiscal Year", variableName: "{{fiscal_year}}", description: "Fiscal year", type: "text", required: true },
			{ id: "p3", name: "Total Budget", variableName: "{{total_budget}}", description: "Total operating budget", type: "currency", required: true },
		],
	},
	{
		name: "Business Case Template",
		description: "Business case template for investment decisions including problem statement, options analysis, financial analysis, and recommendations.",
		categoryIds: ["business", "exec"],
		tags: ["business-case", "investment", "decision", "roi"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the business case including recommendation, investment required, expected benefits, and key risks.",
			},
			{
				title: "Problem Statement",
				level: 1,
				prompt: "Clearly define the problem or opportunity being addressed.",
				subsections: [
					{ title: "Current Situation", level: 2, prompt: "Describe the current state and challenges." },
					{ title: "Impact of Inaction", level: 2, prompt: "Explain the consequences of not addressing the issue." },
					{ title: "Desired Outcome", level: 2, prompt: "Define the desired future state." },
				],
			},
			{
				title: "Options Analysis",
				level: 1,
				prompt: "Present and analyze options to address the problem.",
				subsections: [
					{ title: "Option 1: [Description]", level: 2, prompt: "Describe the first option with pros, cons, and implications." },
					{ title: "Option 2: [Description]", level: 2, prompt: "Describe the second option with pros, cons, and implications." },
					{ title: "Option 3: [Description]", level: 2, prompt: "Describe the third option with pros, cons, and implications." },
					{ title: "Options Comparison", level: 2, prompt: "Compare options against evaluation criteria." },
				],
			},
			{
				title: "Recommended Solution",
				level: 1,
				prompt: "Present the recommended solution with detailed justification.",
			},
			{
				title: "Financial Analysis",
				level: 1,
				prompt: "Present financial analysis supporting the recommendation.",
				subsections: [
					{ title: "Investment Required", level: 2, prompt: "Detail upfront and ongoing investment requirements." },
					{ title: "Expected Benefits", level: 2, prompt: "Quantify expected financial and non-financial benefits." },
					{ title: "ROI Analysis", level: 2, prompt: "Present ROI, NPV, payback period, and other financial metrics." },
					{ title: "Sensitivity Analysis", level: 2, prompt: "Show how results change under different assumptions." },
				],
			},
			{
				title: "Implementation Plan",
				level: 1,
				prompt: "Outline the implementation approach if approved.",
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Identify key risks and mitigation strategies.",
			},
			{
				title: "Recommendation",
				level: 1,
				prompt: "State the clear recommendation and requested decision/approval.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Name of the initiative", type: "text", required: true },
			{ id: "p2", name: "Sponsor", variableName: "{{sponsor}}", description: "Executive sponsor", type: "text", required: true },
			{ id: "p3", name: "Investment Amount", variableName: "{{investment}}", description: "Total investment required", type: "currency", required: true },
			{ id: "p4", name: "Date", variableName: "{{date}}", description: "Business case date", type: "date", required: true },
		],
	},
];

// ============================================================================
// PMI/PMBOK PROJECT MANAGEMENT TEMPLATES
// ============================================================================

export const PMI_TEMPLATES: TemplateDef[] = [
	{
		name: "Project Charter (PMI)",
		description: "PMI-compliant project charter template that formally authorizes a project and provides the project manager with authority to apply organizational resources.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "charter", "initiation", "authorization"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Project Overview",
				level: 1,
				prompt: "Provide high-level project overview including purpose, objectives, and justification.",
				subsections: [
					{ title: "Project Purpose", level: 2, prompt: "State the purpose and justification for the project." },
					{ title: "Measurable Project Objectives", level: 2, prompt: "Define SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound)." },
					{ title: "High-Level Requirements", level: 2, prompt: "List high-level requirements from key stakeholders." },
					{ title: "High-Level Project Description", level: 2, prompt: "Provide a high-level description of the project and its boundaries." },
				],
			},
			{
				title: "Project Boundaries",
				level: 1,
				prompt: "Define what is included and excluded from the project scope.",
				subsections: [
					{ title: "In Scope", level: 2, prompt: "List what is included in the project scope." },
					{ title: "Out of Scope", level: 2, prompt: "List what is explicitly excluded from the project scope." },
				],
			},
			{
				title: "Key Deliverables",
				level: 1,
				prompt: "List the major deliverables the project will produce.",
			},
			{
				title: "High-Level Risks",
				level: 1,
				prompt: "Identify high-level risks that could impact project success.",
			},
			{
				title: "Summary Milestone Schedule",
				level: 1,
				prompt: "Provide summary milestone schedule with key dates.",
			},
			{
				title: "Summary Budget",
				level: 1,
				prompt: "Provide summary budget including pre-approved financial resources.",
			},
			{
				title: "Key Stakeholders",
				level: 1,
				prompt: "Identify key stakeholders and their roles/interests.",
			},
			{
				title: "Project Approval Requirements",
				level: 1,
				prompt: "Define what constitutes project success and who decides.",
			},
			{
				title: "Project Manager Assignment",
				level: 1,
				prompt: "Assign the project manager and define their authority level.",
			},
			{
				title: "Sponsor Authorization",
				level: 1,
				prompt: "Include sponsor name, signature, and authorization date.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Official project name", type: "text", required: true },
			{ id: "p2", name: "Project Manager", variableName: "{{pm_name}}", description: "Assigned project manager", type: "text", required: true },
			{ id: "p3", name: "Sponsor", variableName: "{{sponsor}}", description: "Project sponsor", type: "text", required: true },
			{ id: "p4", name: "Start Date", variableName: "{{start_date}}", description: "Project start date", type: "date", required: true },
			{ id: "p5", name: "End Date", variableName: "{{end_date}}", description: "Target completion date", type: "date", required: true },
			{ id: "p6", name: "Budget", variableName: "{{budget}}", description: "Approved budget", type: "currency", required: true },
		],
	},
	{
		name: "Project Management Plan (PMI)",
		description: "Comprehensive project management plan following PMI PMBOK Guide structure covering all knowledge areas.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "management-plan", "comprehensive"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Introduction",
				level: 1,
				prompt: "Introduce the project management plan including purpose, project overview, and plan maintenance approach.",
			},
			{
				title: "Project Life Cycle",
				level: 1,
				prompt: "Define the project life cycle, phases, and phase gates.",
			},
			{
				title: "Scope Management Plan",
				level: 1,
				prompt: "Define how scope will be defined, validated, and controlled.",
				subsections: [
					{ title: "Scope Definition Process", level: 2, prompt: "Describe how detailed scope will be developed from the charter." },
					{ title: "WBS Development", level: 2, prompt: "Describe approach to creating and maintaining the WBS." },
					{ title: "Scope Change Control", level: 2, prompt: "Define process for managing scope changes." },
				],
			},
			{
				title: "Schedule Management Plan",
				level: 1,
				prompt: "Define how the project schedule will be developed and controlled.",
				subsections: [
					{ title: "Scheduling Methodology", level: 2, prompt: "Describe scheduling approach (CPM, Agile iterations, etc.)." },
					{ title: "Schedule Development", level: 2, prompt: "Define process for developing and approving the schedule." },
					{ title: "Schedule Control", level: 2, prompt: "Define how schedule performance will be monitored and controlled." },
				],
			},
			{
				title: "Cost Management Plan",
				level: 1,
				prompt: "Define how costs will be estimated, budgeted, and controlled.",
				subsections: [
					{ title: "Cost Estimating", level: 2, prompt: "Describe cost estimating approach and accuracy levels." },
					{ title: "Budget Development", level: 2, prompt: "Define process for establishing the cost baseline." },
					{ title: "Cost Control", level: 2, prompt: "Define earned value management and cost control processes." },
				],
			},
			{
				title: "Quality Management Plan",
				level: 1,
				prompt: "Define quality management approach for the project.",
				subsections: [
					{ title: "Quality Standards", level: 2, prompt: "Define applicable quality standards and metrics." },
					{ title: "Quality Assurance", level: 2, prompt: "Describe QA activities to ensure process compliance." },
					{ title: "Quality Control", level: 2, prompt: "Describe QC activities to verify deliverable quality." },
				],
			},
			{
				title: "Resource Management Plan",
				level: 1,
				prompt: "Define how project resources will be identified, acquired, and managed.",
				subsections: [
					{ title: "Resource Planning", level: 2, prompt: "Describe approach to identifying resource requirements." },
					{ title: "Team Acquisition", level: 2, prompt: "Define process for acquiring project team members." },
					{ title: "Team Development", level: 2, prompt: "Describe approach to developing team capabilities." },
				],
			},
			{
				title: "Communications Management Plan",
				level: 1,
				prompt: "Define project communications approach.",
				subsections: [
					{ title: "Stakeholder Communications", level: 2, prompt: "Define communications requirements by stakeholder group." },
					{ title: "Communications Matrix", level: 2, prompt: "Provide communications matrix showing what, when, how, and to whom." },
					{ title: "Meeting Schedule", level: 2, prompt: "Define regular meeting schedule and protocols." },
				],
			},
			{
				title: "Risk Management Plan",
				level: 1,
				prompt: "Define risk management approach for the project.",
				subsections: [
					{ title: "Risk Identification", level: 2, prompt: "Describe approach to identifying risks." },
					{ title: "Risk Analysis", level: 2, prompt: "Define qualitative and quantitative risk analysis approach." },
					{ title: "Risk Response Planning", level: 2, prompt: "Describe approach to developing risk responses." },
					{ title: "Risk Monitoring", level: 2, prompt: "Define risk monitoring and reporting approach." },
				],
			},
			{
				title: "Procurement Management Plan",
				level: 1,
				prompt: "Define procurement approach if external resources are needed.",
			},
			{
				title: "Stakeholder Management Plan",
				level: 1,
				prompt: "Define approach to engaging and managing stakeholders.",
			},
			{
				title: "Change Management Plan",
				level: 1,
				prompt: "Define the integrated change control process.",
			},
			{
				title: "Configuration Management Plan",
				level: 1,
				prompt: "Define how project artifacts will be version controlled.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Project Manager", variableName: "{{pm_name}}", description: "Project manager", type: "text", required: true },
			{ id: "p3", name: "Version", variableName: "{{version}}", description: "Plan version", type: "text", required: true, defaultValue: "1.0" },
		],
	},
	{
		name: "Work Breakdown Structure (WBS)",
		description: "WBS template with hierarchical decomposition of project scope into manageable work packages.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "wbs", "scope", "decomposition"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "WBS Overview",
				level: 1,
				prompt: "Introduce the WBS including decomposition approach and coding scheme.",
			},
			{
				title: "Project Deliverables Hierarchy",
				level: 1,
				prompt: "Present the hierarchical decomposition of project deliverables.",
				subsections: [
					{ title: "1.0 Project Management", level: 2, prompt: "Define project management deliverables and work packages." },
					{ title: "2.0 [Major Deliverable 1]", level: 2, prompt: "Decompose first major deliverable into work packages." },
					{ title: "3.0 [Major Deliverable 2]", level: 2, prompt: "Decompose second major deliverable into work packages." },
					{ title: "4.0 [Major Deliverable 3]", level: 2, prompt: "Decompose third major deliverable into work packages." },
				],
			},
			{
				title: "WBS Dictionary",
				level: 1,
				prompt: "Provide WBS dictionary with detailed descriptions of work packages.",
			},
			{
				title: "WBS Diagram",
				level: 1,
				prompt: "Include visual WBS diagram showing hierarchical structure.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "WBS Code", variableName: "{{wbs_code}}", description: "WBS coding convention", type: "text", required: true, defaultValue: "Numeric (1.1.1)" },
		],
	},
	{
		name: "Scope Statement (PMI)",
		description: "Project scope statement defining project scope, deliverables, acceptance criteria, exclusions, constraints, and assumptions.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "scope", "scope-statement", "boundaries"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Project Scope Description",
				level: 1,
				prompt: "Provide detailed description of project scope including major deliverables, characteristics, and boundaries.",
			},
			{
				title: "Product Scope Description",
				level: 1,
				prompt: "Describe the features and functions of the product, service, or result.",
			},
			{
				title: "Acceptance Criteria",
				level: 1,
				prompt: "Define specific acceptance criteria for project and product deliverables.",
			},
			{
				title: "Project Deliverables",
				level: 1,
				prompt: "List all project deliverables with descriptions.",
			},
			{
				title: "Project Exclusions",
				level: 1,
				prompt: "Explicitly state what is excluded from the project scope.",
			},
			{
				title: "Constraints",
				level: 1,
				prompt: "Document project constraints (time, cost, scope, quality, resources).",
			},
			{
				title: "Assumptions",
				level: 1,
				prompt: "Document project assumptions that impact scope.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Project Manager", variableName: "{{pm_name}}", description: "Project manager", type: "text", required: true },
			{ id: "p3", name: "Date", variableName: "{{date}}", description: "Document date", type: "date", required: true },
		],
	},
	{
		name: "Risk Register (PMI)",
		description: "Risk register template for identifying, analyzing, and tracking project risks with response strategies.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "risk", "register", "mitigation"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Risk Register Overview",
				level: 1,
				prompt: "Introduce the risk register including risk categories, probability/impact scales, and update process.",
			},
			{
				title: "Risk Identification",
				level: 1,
				prompt: "Document identified risks with descriptions and categories.",
			},
			{
				title: "Risk Analysis",
				level: 1,
				prompt: "Present risk analysis including probability, impact, and risk score for each risk.",
			},
			{
				title: "Risk Response Strategies",
				level: 1,
				prompt: "Document risk response strategies (avoid, mitigate, transfer, accept) for each significant risk.",
			},
			{
				title: "Risk Owners",
				level: 1,
				prompt: "Assign risk owners responsible for monitoring and response implementation.",
			},
			{
				title: "Risk Monitoring",
				level: 1,
				prompt: "Define risk monitoring approach and trigger points.",
			},
			{
				title: "Contingency Reserves",
				level: 1,
				prompt: "Document contingency reserves for known risks.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Risk Threshold", variableName: "{{risk_threshold}}", description: "Risk tolerance threshold", type: "select", required: true, options: [
				{ value: "low", label: "Low (Conservative)" },
				{ value: "medium", label: "Medium (Balanced)" },
				{ value: "high", label: "High (Aggressive)" },
			]},
		],
	},
	{
		name: "Stakeholder Register (PMI)",
		description: "Stakeholder register template for identifying and analyzing project stakeholders.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "stakeholder", "register", "engagement"],
		difficulty: "beginner",
		estimatedTime: 90,
		sections: [
			{
				title: "Stakeholder Identification",
				level: 1,
				prompt: "Identify all project stakeholders with contact information and role.",
			},
			{
				title: "Stakeholder Assessment",
				level: 1,
				prompt: "Assess each stakeholder's interest, influence, and potential impact.",
			},
			{
				title: "Stakeholder Classification",
				level: 1,
				prompt: "Classify stakeholders using power/interest grid or salience model.",
			},
			{
				title: "Engagement Strategy",
				level: 1,
				prompt: "Define engagement strategy for each stakeholder or stakeholder group.",
			},
			{
				title: "Communication Requirements",
				level: 1,
				prompt: "Document communication requirements for key stakeholders.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Communications Plan (PMI)",
		description: "Project communications management plan defining stakeholder information needs and communications approach.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "communications", "stakeholder", "reporting"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Communications Overview",
				level: 1,
				prompt: "Describe the overall communications approach and objectives.",
			},
			{
				title: "Stakeholder Communications Requirements",
				level: 1,
				prompt: "Document communications requirements by stakeholder group.",
			},
			{
				title: "Communications Matrix",
				level: 1,
				prompt: "Provide detailed communications matrix (what, when, how, who, responsible).",
			},
			{
				title: "Meeting Schedule",
				level: 1,
				prompt: "Define regular meeting schedule with purpose, participants, and frequency.",
			},
			{
				title: "Reporting Requirements",
				level: 1,
				prompt: "Define project reporting requirements including status reports, dashboards, and executive briefings.",
			},
			{
				title: "Communication Tools",
				level: 1,
				prompt: "Define tools and technologies for project communications.",
			},
			{
				title: "Escalation Procedures",
				level: 1,
				prompt: "Define escalation paths and procedures for issues requiring management attention.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Project Manager", variableName: "{{pm_name}}", description: "Project manager", type: "text", required: true },
		],
	},
	{
		name: "Change Request Form (PMI)",
		description: "Change request form for documenting and processing project change requests through integrated change control.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "change", "change-control", "request"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Change Request Information",
				level: 1,
				prompt: "Capture basic change request information including ID, requestor, date, and priority.",
			},
			{
				title: "Change Description",
				level: 1,
				prompt: "Describe the proposed change in detail.",
			},
			{
				title: "Reason for Change",
				level: 1,
				prompt: "Explain the reason and justification for the change.",
			},
			{
				title: "Impact Analysis",
				level: 1,
				prompt: "Analyze impact on scope, schedule, cost, quality, and resources.",
			},
			{
				title: "Alternatives Considered",
				level: 1,
				prompt: "Document alternatives considered and why this option was selected.",
			},
			{
				title: "Recommendation",
				level: 1,
				prompt: "Provide recommendation (approve, reject, defer) with justification.",
			},
			{
				title: "Approval",
				level: 1,
				prompt: "Include approval section with decision, approver, and date.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Change Request ID", variableName: "{{cr_id}}", description: "Change request identifier", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p3", name: "Requestor", variableName: "{{requestor}}", description: "Person requesting change", type: "text", required: true },
			{ id: "p4", name: "Date", variableName: "{{date}}", description: "Request date", type: "date", required: true },
		],
	},
	{
		name: "Lessons Learned Register (PMI)",
		description: "Lessons learned register for capturing project knowledge throughout the project lifecycle.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "lessons-learned", "knowledge", "continuous-improvement"],
		difficulty: "beginner",
		estimatedTime: 60,
		sections: [
			{
				title: "Lessons Learned Overview",
				level: 1,
				prompt: "Introduce the lessons learned process and how captured knowledge will be used.",
			},
			{
				title: "What Went Well",
				level: 1,
				prompt: "Document successful practices, approaches, and outcomes to replicate.",
			},
			{
				title: "What Could Be Improved",
				level: 1,
				prompt: "Document challenges, issues, and areas for improvement.",
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide specific recommendations for future projects.",
			},
			{
				title: "Knowledge Transfer",
				level: 1,
				prompt: "Document how lessons will be shared with the organization.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Phase", variableName: "{{phase}}", description: "Project phase", type: "text", required: true },
		],
	},
	{
		name: "Project Status Report (PMI)",
		description: "Weekly/monthly project status report template covering progress, issues, risks, and forecasts.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "status-report", "progress", "reporting"],
		difficulty: "beginner",
		estimatedTime: 45,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Provide executive summary of project status including overall health indicator.",
			},
			{
				title: "Schedule Status",
				level: 1,
				prompt: "Report schedule performance including milestones achieved and schedule variance.",
			},
			{
				title: "Cost Status",
				level: 1,
				prompt: "Report cost performance including actual vs. budget and cost variance.",
			},
			{
				title: "Scope Status",
				level: 1,
				prompt: "Report scope status including deliverables completed and any scope changes.",
			},
			{
				title: "Accomplishments",
				level: 1,
				prompt: "List key accomplishments for the reporting period.",
			},
			{
				title: "Planned Activities",
				level: 1,
				prompt: "List planned activities for the next reporting period.",
			},
			{
				title: "Issues",
				level: 1,
				prompt: "Report current issues requiring attention or decisions.",
			},
			{
				title: "Risks",
				level: 1,
				prompt: "Report active risks and any new risks identified.",
			},
			{
				title: "Decisions Needed",
				level: 1,
				prompt: "List any decisions needed from stakeholders or sponsors.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Reporting Period", variableName: "{{period}}", description: "Reporting period", type: "text", required: true },
			{ id: "p3", name: "Report Date", variableName: "{{date}}", description: "Report date", type: "date", required: true },
			{ id: "p4", name: "Project Manager", variableName: "{{pm_name}}", description: "Project manager", type: "text", required: true },
		],
	},
	{
		name: "Project Closure Report (PMI)",
		description: "Project closure report template documenting project completion, outcomes, and formal closure.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "closure", "completion", "handover"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize project outcomes, success criteria achievement, and key lessons.",
			},
			{
				title: "Project Objectives Review",
				level: 1,
				prompt: "Review original objectives and assess achievement level.",
			},
			{
				title: "Deliverables Acceptance",
				level: 1,
				prompt: "Document acceptance status of all project deliverables.",
			},
			{
				title: "Performance Summary",
				level: 1,
				prompt: "Summarize schedule, cost, and scope performance against baselines.",
			},
			{
				title: "Lessons Learned Summary",
				level: 1,
				prompt: "Summarize key lessons learned from the project.",
			},
			{
				title: "Outstanding Items",
				level: 1,
				prompt: "Document any outstanding items, punch list, or transition requirements.",
			},
			{
				title: "Resource Release",
				level: 1,
				prompt: "Document release of project resources back to functional organizations.",
			},
			{
				title: "Documentation Archive",
				level: 1,
				prompt: "Document location and access to archived project documentation.",
			},
			{
				title: "Formal Closure",
				level: 1,
				prompt: "Include formal closure sign-off by sponsor and key stakeholders.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Closure Date", variableName: "{{closure_date}}", description: "Project closure date", type: "date", required: true },
			{ id: "p3", name: "Project Manager", variableName: "{{pm_name}}", description: "Project manager", type: "text", required: true },
		],
	},
];

// ============================================================================
// PRINCE2 PROJECT MANAGEMENT TEMPLATES
// ============================================================================

export const PRINCE2_TEMPLATES: TemplateDef[] = [
	{
		name: "Business Case (PRINCE2)",
		description: "PRINCE2 business case document providing justification for the project throughout its lifecycle.",
		categoryIds: ["prince2", "business"],
		tags: ["prince2", "business-case", "justification", "benefits"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the business case including recommendation and key justification points.",
			},
			{
				title: "Reasons",
				level: 1,
				prompt: "Explain why this project is needed and what problem or opportunity it addresses.",
			},
			{
				title: "Business Options",
				level: 1,
				prompt: "Present options considered including 'do nothing', 'do minimum', and recommended option.",
				subsections: [
					{ title: "Option 1: Do Nothing", level: 2, prompt: "Analyze the implications of taking no action." },
					{ title: "Option 2: Do Minimum", level: 2, prompt: "Analyze a minimal intervention approach." },
					{ title: "Option 3: Recommended Option", level: 2, prompt: "Present the recommended option with full justification." },
				],
			},
			{
				title: "Expected Benefits",
				level: 1,
				prompt: "Define expected benefits with measurable targets and benefit owners.",
			},
			{
				title: "Expected Dis-benefits",
				level: 1,
				prompt: "Identify any negative consequences or trade-offs (dis-benefits).",
			},
			{
				title: "Timescales",
				level: 1,
				prompt: "Define project timescales and when benefits will be realized.",
			},
			{
				title: "Costs",
				level: 1,
				prompt: "Present project costs including development, operational, and ongoing costs.",
			},
			{
				title: "Investment Appraisal",
				level: 1,
				prompt: "Present financial analysis including ROI, NPV, payback period.",
			},
			{
				title: "Major Risks",
				level: 1,
				prompt: "Identify major risks to the business case and benefits realization.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Executive", variableName: "{{executive}}", description: "Project Executive", type: "text", required: true },
			{ id: "p3", name: "Version", variableName: "{{version}}", description: "Document version", type: "text", required: true, defaultValue: "1.0" },
		],
	},
	{
		name: "Project Initiation Document (PID) - PRINCE2",
		description: "PRINCE2 Project Initiation Document bringing together key information needed to start the project.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "pid", "initiation", "baseline"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Project Definition",
				level: 1,
				prompt: "Define the project including background, objectives, scope, and desired outcomes.",
				subsections: [
					{ title: "Project Background", level: 2, prompt: "Provide background and context for the project." },
					{ title: "Project Objectives", level: 2, prompt: "State the project objectives and success criteria." },
					{ title: "Project Scope", level: 2, prompt: "Define what is in and out of scope." },
					{ title: "Desired Outcomes", level: 2, prompt: "Describe the desired outcomes and end state." },
				],
			},
			{
				title: "Project Approach",
				level: 1,
				prompt: "Define the approach to delivering the project including delivery method and key decisions.",
			},
			{
				title: "Business Case",
				level: 1,
				prompt: "Include or reference the business case providing project justification.",
			},
			{
				title: "Project Management Team Structure",
				level: 1,
				prompt: "Define the project organization including roles, responsibilities, and reporting structure.",
				subsections: [
					{ title: "Project Board", level: 2, prompt: "Define Project Board composition and responsibilities." },
					{ title: "Project Manager", level: 2, prompt: "Define Project Manager role and responsibilities." },
					{ title: "Team Structure", level: 2, prompt: "Define team structure and team managers." },
					{ title: "Project Assurance", level: 2, prompt: "Define project assurance arrangements." },
				],
			},
			{
				title: "Role Descriptions",
				level: 1,
				prompt: "Provide role descriptions for key project management team members.",
			},
			{
				title: "Quality Management Strategy",
				level: 1,
				prompt: "Define the approach to quality management for the project.",
			},
			{
				title: "Configuration Management Strategy",
				level: 1,
				prompt: "Define how project products will be identified, controlled, and tracked.",
			},
			{
				title: "Risk Management Strategy",
				level: 1,
				prompt: "Define the approach to risk management including risk tolerance and escalation.",
			},
			{
				title: "Communication Management Strategy",
				level: 1,
				prompt: "Define how communications will be managed with stakeholders.",
			},
			{
				title: "Project Plan",
				level: 1,
				prompt: "Include or reference the project plan showing stages, milestones, and resource requirements.",
			},
			{
				title: "Project Controls",
				level: 1,
				prompt: "Define project controls including tolerances, reporting, and decision points.",
			},
			{
				title: "Tailoring of PRINCE2",
				level: 1,
				prompt: "Document how PRINCE2 has been tailored for this project.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Executive", variableName: "{{executive}}", description: "Project Executive", type: "text", required: true },
			{ id: "p3", name: "Project Manager", variableName: "{{pm_name}}", description: "Project Manager", type: "text", required: true },
			{ id: "p4", name: "Senior User", variableName: "{{senior_user}}", description: "Senior User", type: "text", required: true },
			{ id: "p5", name: "Senior Supplier", variableName: "{{senior_supplier}}", description: "Senior Supplier", type: "text", required: true },
		],
	},
	{
		name: "Stage Plan (PRINCE2)",
		description: "PRINCE2 stage plan providing detailed planning for a management stage.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "stage-plan", "planning", "schedule"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Plan Description",
				level: 1,
				prompt: "Describe the stage including objectives, scope, and approach.",
			},
			{
				title: "Plan Prerequisites",
				level: 1,
				prompt: "List prerequisites that must be in place before the stage can start.",
			},
			{
				title: "External Dependencies",
				level: 1,
				prompt: "Identify external dependencies outside the project's control.",
			},
			{
				title: "Planning Assumptions",
				level: 1,
				prompt: "Document assumptions made in developing the stage plan.",
			},
			{
				title: "Lessons Incorporated",
				level: 1,
				prompt: "Reference lessons from previous stages or projects that have been incorporated.",
			},
			{
				title: "Product Descriptions",
				level: 1,
				prompt: "Reference or include product descriptions for stage deliverables.",
			},
			{
				title: "Schedule",
				level: 1,
				prompt: "Present the stage schedule showing activities, dependencies, and milestones.",
			},
			{
				title: "Budget",
				level: 1,
				prompt: "Present the stage budget and resource requirements.",
			},
			{
				title: "Tolerance",
				level: 1,
				prompt: "Define tolerance levels for time, cost, scope, quality, benefit, and risk.",
			},
			{
				title: "Monitoring and Control",
				level: 1,
				prompt: "Define how the stage will be monitored and controlled.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Stage Name", variableName: "{{stage_name}}", description: "Stage name", type: "text", required: true },
			{ id: "p3", name: "Stage Number", variableName: "{{stage_number}}", description: "Stage number", type: "number", required: true },
		],
	},
	{
		name: "Highlight Report (PRINCE2)",
		description: "PRINCE2 highlight report providing regular status updates to the Project Board.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "highlight-report", "status", "reporting"],
		difficulty: "beginner",
		estimatedTime: 45,
		sections: [
			{
				title: "Date",
				level: 1,
				prompt: "State the reporting period covered by this highlight report.",
			},
			{
				title: "Period Covered",
				level: 1,
				prompt: "Specify the period this report covers.",
			},
			{
				title: "Status Summary",
				level: 1,
				prompt: "Provide RAG (Red/Amber/Green) status for time, cost, scope, quality, benefits, and risk.",
			},
			{
				title: "This Reporting Period",
				level: 1,
				prompt: "Summarize achievements, products completed, and activities performed this period.",
			},
			{
				title: "Next Reporting Period",
				level: 1,
				prompt: "Outline planned activities and expected progress for the next period.",
			},
			{
				title: "Tolerance Status",
				level: 1,
				prompt: "Report current tolerance status and any forecast breaches.",
			},
			{
				title: "Issues",
				level: 1,
				prompt: "Summarize current issues requiring attention.",
			},
			{
				title: "Risks",
				level: 1,
				prompt: "Summarize current risk status and any new risks.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Stage", variableName: "{{stage}}", description: "Current stage", type: "text", required: true },
			{ id: "p3", name: "Report Date", variableName: "{{date}}", description: "Report date", type: "date", required: true },
		],
	},
	{
		name: "End Stage Report (PRINCE2)",
		description: "PRINCE2 end stage report providing assessment at the end of a management stage.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "end-stage", "assessment", "reporting"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Project Manager's Report",
				level: 1,
				prompt: "Provide overall assessment of the stage just completed.",
			},
			{
				title: "Review of Business Case",
				level: 1,
				prompt: "Confirm the business case remains valid and benefits are achievable.",
			},
			{
				title: "Review of Project Objectives",
				level: 1,
				prompt: "Assess progress against project objectives.",
			},
			{
				title: "Review of Stage Objectives",
				level: 1,
				prompt: "Assess achievement of stage objectives and deliverables.",
			},
			{
				title: "Review of Team Performance",
				level: 1,
				prompt: "Assess team performance during the stage.",
			},
			{
				title: "Review of Products",
				level: 1,
				prompt: "Summarize products completed and their quality status.",
			},
			{
				title: "Issues and Risks",
				level: 1,
				prompt: "Summarize current issues and risks with recommendations.",
			},
			{
				title: "Lessons Learned",
				level: 1,
				prompt: "Document lessons learned during the stage.",
			},
			{
				title: "Forecast",
				level: 1,
				prompt: "Provide forecast for remaining stages including time and cost projections.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Stage Name", variableName: "{{stage_name}}", description: "Stage name", type: "text", required: true },
			{ id: "p3", name: "Date", variableName: "{{date}}", description: "Report date", type: "date", required: true },
		],
	},
	{
		name: "Exception Report (PRINCE2)",
		description: "PRINCE2 exception report for when tolerances are forecast to be exceeded.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "exception", "escalation", "tolerance"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Exception Title",
				level: 1,
				prompt: "Provide a clear title describing the exception.",
			},
			{
				title: "Cause of Exception",
				level: 1,
				prompt: "Explain what has caused or will cause the tolerance to be exceeded.",
			},
			{
				title: "Consequences of Exception",
				level: 1,
				prompt: "Describe the impact on the project, stage, and business case.",
			},
			{
				title: "Options",
				level: 1,
				prompt: "Present options for resolving the exception with pros and cons.",
			},
			{
				title: "Recommendation",
				level: 1,
				prompt: "Provide recommended course of action with justification.",
			},
			{
				title: "Impact on Business Case",
				level: 1,
				prompt: "Assess impact on the business case and whether it remains viable.",
			},
			{
				title: "Impact on Project Plan",
				level: 1,
				prompt: "Describe impact on project plan and other work packages.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Exception Type", variableName: "{{exception_type}}", description: "Type of exception", type: "select", required: true, options: [
				{ value: "time", label: "Time" },
				{ value: "cost", label: "Cost" },
				{ value: "scope", label: "Scope" },
				{ value: "quality", label: "Quality" },
				{ value: "benefit", label: "Benefit" },
				{ value: "risk", label: "Risk" },
			]},
			{ id: "p3", name: "Date", variableName: "{{date}}", description: "Report date", type: "date", required: true },
		],
	},
	{
		name: "Lessons Report (PRINCE2)",
		description: "PRINCE2 lessons report capturing lessons learned during or at the end of a project.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "lessons", "knowledge", "improvement"],
		difficulty: "beginner",
		estimatedTime: 60,
		sections: [
			{
				title: "Report Information",
				level: 1,
				prompt: "Provide report context including project stage and collection method.",
			},
			{
				title: "Lessons Learned",
				level: 1,
				prompt: "Document lessons learned with category, description, and recommendation.",
				subsections: [
					{ title: "Project Management Lessons", level: 2, prompt: "Lessons related to project management processes and controls." },
					{ title: "Technical Lessons", level: 2, prompt: "Lessons related to technical delivery and solutions." },
					{ title: "Commercial Lessons", level: 2, prompt: "Lessons related to commercial arrangements and suppliers." },
					{ title: "Organizational Lessons", level: 2, prompt: "Lessons related to organization, governance, and stakeholders." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide specific recommendations for future projects.",
			},
			{
				title: "Follow-up Actions",
				level: 1,
				prompt: "Define actions to ensure lessons are embedded in organizational processes.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Stage/Phase", variableName: "{{stage}}", description: "Stage or phase", type: "text", required: true },
			{ id: "p3", name: "Date", variableName: "{{date}}", description: "Report date", type: "date", required: true },
		],
	},
	{
		name: "End Project Report (PRINCE2)",
		description: "PRINCE2 end project report assessing overall project performance against the PID.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "end-project", "closure", "assessment"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Project Manager's Report",
				level: 1,
				prompt: "Provide overall assessment of project performance.",
			},
			{
				title: "Review of Business Case",
				level: 1,
				prompt: "Review final business case status and expected benefits realization.",
			},
			{
				title: "Review of Objectives",
				level: 1,
				prompt: "Assess achievement of project objectives against original targets.",
			},
			{
				title: "Performance Against Planned Targets",
				level: 1,
				prompt: "Compare actual performance against planned time, cost, and quality.",
			},
			{
				title: "Review of Products",
				level: 1,
				prompt: "Summarize products delivered and their acceptance status.",
			},
			{
				title: "Team Performance",
				level: 1,
				prompt: "Assess project team performance and resource utilization.",
			},
			{
				title: "Quality Management",
				level: 1,
				prompt: "Review quality management effectiveness during the project.",
			},
			{
				title: "Issue and Risk Summary",
				level: 1,
				prompt: "Summarize issues encountered and risks managed during the project.",
			},
			{
				title: "Lessons Learned",
				level: 1,
				prompt: "Reference or summarize key lessons learned.",
			},
			{
				title: "Post-Project Recommendations",
				level: 1,
				prompt: "Provide recommendations for post-project activities and benefits realization.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Project Manager", variableName: "{{pm_name}}", description: "Project Manager", type: "text", required: true },
			{ id: "p3", name: "Date", variableName: "{{date}}", description: "Report date", type: "date", required: true },
		],
	},
	{
		name: "Product Description (PRINCE2)",
		description: "PRINCE2 product description defining the purpose, composition, and quality criteria for a product.",
		categoryIds: ["prince2", "qa"],
		tags: ["prince2", "product-description", "quality", "deliverable"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Identifier",
				level: 1,
				prompt: "Provide unique product identifier.",
			},
			{
				title: "Title",
				level: 1,
				prompt: "Provide the product name.",
			},
			{
				title: "Purpose",
				level: 1,
				prompt: "Describe the purpose of this product and why it is needed.",
			},
			{
				title: "Composition",
				level: 1,
				prompt: "Describe what the product consists of or contains.",
			},
			{
				title: "Derivation",
				level: 1,
				prompt: "Identify the source products from which this product is derived.",
			},
			{
				title: "Format and Presentation",
				level: 1,
				prompt: "Define the format, layout, and presentation requirements.",
			},
			{
				title: "Development Skills Required",
				level: 1,
				prompt: "Identify the skills needed to develop this product.",
			},
			{
				title: "Quality Criteria",
				level: 1,
				prompt: "Define specific, measurable quality criteria.",
			},
			{
				title: "Quality Tolerance",
				level: 1,
				prompt: "Define acceptable tolerance ranges for quality criteria.",
			},
			{
				title: "Quality Method",
				level: 1,
				prompt: "Define the quality method(s) to be used to verify the product.",
			},
			{
				title: "Quality Skills Required",
				level: 1,
				prompt: "Identify the skills needed to quality check this product.",
			},
			{
				title: "Quality Responsibilities",
				level: 1,
				prompt: "Identify who is responsible for quality checking.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Product ID", variableName: "{{product_id}}", description: "Product identifier", type: "text", required: true },
			{ id: "p2", name: "Product Name", variableName: "{{product_name}}", description: "Product name", type: "text", required: true },
			{ id: "p3", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Work Package (PRINCE2)",
		description: "PRINCE2 work package containing information required by a team manager to produce products.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "work-package", "authorization", "assignment"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Work Package Authorization",
				level: 1,
				prompt: "Provide work package identification and authorization information.",
			},
			{
				title: "Team Manager",
				level: 1,
				prompt: "Identify the team manager responsible for the work package.",
			},
			{
				title: "Work Package Description",
				level: 1,
				prompt: "Describe the work to be performed.",
			},
			{
				title: "Products",
				level: 1,
				prompt: "List products to be delivered with references to product descriptions.",
			},
			{
				title: "Techniques, Processes, and Procedures",
				level: 1,
				prompt: "Define any required techniques, processes, or procedures.",
			},
			{
				title: "Development Interfaces",
				level: 1,
				prompt: "Identify interfaces with other work packages or external parties.",
			},
			{
				title: "Operations and Maintenance Interfaces",
				level: 1,
				prompt: "Identify handover requirements to operations.",
			},
			{
				title: "Configuration Management Requirements",
				level: 1,
				prompt: "Define configuration management requirements.",
			},
			{
				title: "Constraints",
				level: 1,
				prompt: "Document any constraints on the work package.",
			},
			{
				title: "Tolerance",
				level: 1,
				prompt: "Define work package tolerances for time, cost, and scope.",
			},
			{
				title: "Reporting Arrangements",
				level: 1,
				prompt: "Define checkpoint reporting requirements.",
			},
			{
				title: "Approval Method",
				level: 1,
				prompt: "Define how completed products will be approved.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Work Package ID", variableName: "{{wp_id}}", description: "Work package identifier", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p3", name: "Team Manager", variableName: "{{team_manager}}", description: "Assigned team manager", type: "text", required: true },
		],
	},
];

// ============================================================================
// ADDITIONAL PMI TEMPLATES
// ============================================================================

export const PMI_EXTENDED_TEMPLATES: TemplateDef[] = [
	{
		name: "Quality Management Plan (PMI)",
		description: "PMI/PMBOK quality management plan defining quality policies, procedures, and responsibilities.",
		categoryIds: ["pmi", "qa"],
		tags: ["pmi", "pmbok", "quality", "quality-management", "qms"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Quality Management Approach",
				level: 1,
				prompt: "Describe the overall approach to quality management including organizational policies and applicable standards.",
				subsections: [
					{ title: "Quality Philosophy and Principles", level: 2, prompt: "State the quality philosophy guiding the project and core quality principles (prevention over inspection, continuous improvement, customer focus)." },
					{ title: "Applicable Standards and Regulations", level: 2, prompt: "Identify industry standards (ISO 9001, CMMI, IEEE), regulatory requirements, and organizational quality policies that apply." },
					{ title: "Quality Policy Statement", level: 2, prompt: "Provide the project-specific quality policy statement aligned with organizational objectives." },
				],
			},
			{
				title: "Quality Standards and Metrics",
				level: 1,
				prompt: "Define quality standards, metrics, measurement criteria, and acceptance thresholds.",
				subsections: [
					{ title: "Quality Metrics Definition", level: 2, prompt: "Define specific quality metrics including defect density, test coverage, customer satisfaction scores, and process compliance rates." },
					{ title: "Measurement Methods", level: 2, prompt: "Describe how each metric will be measured, including data collection methods, sampling approaches, and measurement frequency." },
					{ title: "Acceptance Criteria", level: 2, prompt: "Define quantitative acceptance criteria and quality thresholds for deliverables, processes, and the overall project." },
				],
			},
			{
				title: "Quality Assurance Activities",
				level: 1,
				prompt: "Describe quality assurance activities to ensure processes are followed correctly.",
				subsections: [
					{ title: "Process Audits", level: 2, prompt: "Define audit schedule, scope, and procedures for verifying process compliance and identifying improvement opportunities." },
					{ title: "Quality Reviews", level: 2, prompt: "Describe quality review gates, peer reviews, and management reviews at key project milestones." },
					{ title: "Process Improvement", level: 2, prompt: "Outline the process improvement approach including PDCA cycles, root cause analysis, and corrective action procedures." },
				],
			},
			{
				title: "Quality Control Procedures",
				level: 1,
				prompt: "Define quality control procedures for monitoring deliverable quality.",
				subsections: [
					{ title: "Inspection and Testing", level: 2, prompt: "Detail inspection protocols, testing procedures, and verification activities for each deliverable type." },
					{ title: "Defect Management", level: 2, prompt: "Define defect identification, classification, tracking, and resolution procedures including severity levels and escalation paths." },
					{ title: "Quality Control Tools", level: 2, prompt: "Identify QC tools to be used: control charts, Pareto analysis, fishbone diagrams, histograms, and checklists." },
				],
			},
			{
				title: "Roles and Responsibilities",
				level: 1,
				prompt: "Define roles and responsibilities for quality management.",
				subsections: [
					{ title: "Quality Management Team", level: 2, prompt: "Define the quality team structure including Quality Manager, QA analysts, and QC inspectors with their responsibilities." },
					{ title: "Project Team Quality Responsibilities", level: 2, prompt: "Define quality responsibilities for project manager, technical leads, developers, and all team members." },
					{ title: "Stakeholder Quality Involvement", level: 2, prompt: "Define sponsor, customer, and end-user involvement in quality activities and acceptance." },
				],
			},
			{
				title: "Quality Tools and Techniques",
				level: 1,
				prompt: "Identify quality tools, techniques, and technologies to be used.",
				subsections: [
					{ title: "Quality Planning Tools", level: 2, prompt: "Describe tools for quality planning: quality function deployment, cost-benefit analysis, benchmarking, and design of experiments." },
					{ title: "Quality Management Systems", level: 2, prompt: "Identify QMS software, defect tracking systems, test management tools, and documentation repositories." },
					{ title: "Statistical Quality Control", level: 2, prompt: "Describe statistical techniques: SPC, acceptance sampling, hypothesis testing, and correlation analysis." },
				],
			},
			{
				title: "Continuous Improvement",
				level: 1,
				prompt: "Describe the continuous improvement approach and lessons learned integration.",
				subsections: [
					{ title: "Improvement Framework", level: 2, prompt: "Define the continuous improvement framework (Kaizen, Six Sigma, Lean) and how it integrates with project processes." },
					{ title: "Lessons Learned Process", level: 2, prompt: "Describe how quality-related lessons learned are captured, analyzed, and integrated into organizational assets." },
					{ title: "Performance Trending", level: 2, prompt: "Define how quality performance trends are monitored and used to drive proactive improvements." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Quality Manager", variableName: "{{quality_manager}}", description: "Quality Manager", type: "text", required: true },
		],
	},
	{
		name: "Procurement Management Plan (PMI)",
		description: "PMI/PMBOK procurement management plan for managing external acquisitions and vendor relationships.",
		categoryIds: ["pmi", "procurement"],
		tags: ["pmi", "pmbok", "procurement", "vendors", "contracts"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Procurement Strategy",
				level: 1,
				prompt: "Define overall procurement strategy and strategic sourcing approach.",
				subsections: [
					{ title: "Make-or-Buy Analysis", level: 2, prompt: "Document make-or-buy decisions with supporting analysis, considering cost, capability, risk, and strategic factors." },
					{ title: "Procurement Approach", level: 2, prompt: "Define the procurement approach: competitive bidding, sole source, strategic partnerships, or framework agreements." },
					{ title: "Market Analysis", level: 2, prompt: "Summarize market research including supplier landscape, market conditions, and pricing trends." },
				],
			},
			{
				title: "Procurement Types and Contract Forms",
				level: 1,
				prompt: "Identify types of procurements and contract types to be used.",
				subsections: [
					{ title: "Contract Types", level: 2, prompt: "Define contract types for different procurements: Fixed Price (FFP, FPIF), Cost Reimbursable (CPFF, CPIF, CPAF), or Time & Materials." },
					{ title: "Terms and Conditions", level: 2, prompt: "Outline standard terms and conditions, liability provisions, IP ownership, and warranty requirements." },
					{ title: "Special Provisions", level: 2, prompt: "Identify special provisions required: bonding, insurance, security clearances, or regulatory compliance clauses." },
				],
			},
			{
				title: "Vendor Selection Process",
				level: 1,
				prompt: "Define vendor selection criteria, evaluation methodology, and selection process.",
				subsections: [
					{ title: "Selection Criteria and Weighting", level: 2, prompt: "Define evaluation criteria (technical capability, price, experience, financial stability) with weights and scoring methodology." },
					{ title: "RFP/RFQ Process", level: 2, prompt: "Describe solicitation documents, bidder conferences, Q&A process, and proposal submission requirements." },
					{ title: "Evaluation and Award", level: 2, prompt: "Define evaluation team composition, scoring process, negotiation approach, and award procedures." },
				],
			},
			{
				title: "Contract Administration",
				level: 1,
				prompt: "Describe contract administration and management procedures throughout the contract lifecycle.",
				subsections: [
					{ title: "Contract Monitoring", level: 2, prompt: "Define procedures for monitoring contract performance, deliverable acceptance, and compliance verification." },
					{ title: "Change Management", level: 2, prompt: "Describe contract change management including change orders, amendments, and claims procedures." },
					{ title: "Payment Administration", level: 2, prompt: "Define invoicing, payment verification, milestone payments, and payment schedules." },
				],
			},
			{
				title: "Procurement Schedule",
				level: 1,
				prompt: "Define procurement timeline and integration with project schedule.",
				subsections: [
					{ title: "Procurement Timeline", level: 2, prompt: "Detail procurement milestones: RFP release, proposal due dates, evaluation periods, and contract award targets." },
					{ title: "Lead Time Management", level: 2, prompt: "Document lead times for long-lead items and integrate into project critical path." },
					{ title: "Schedule Constraints", level: 2, prompt: "Identify schedule constraints, dependencies with other project activities, and buffer management." },
				],
			},
			{
				title: "Risk and Performance Management",
				level: 1,
				prompt: "Address procurement risks and vendor performance management.",
				subsections: [
					{ title: "Procurement Risk Assessment", level: 2, prompt: "Identify and assess procurement risks: supply chain disruption, vendor failure, cost escalation, and quality issues." },
					{ title: "Risk Mitigation Strategies", level: 2, prompt: "Define risk mitigation approaches: multi-sourcing, performance bonds, insurance requirements, and contractual protections." },
					{ title: "Vendor Performance Metrics", level: 2, prompt: "Define vendor performance KPIs, scorecard methodology, performance reviews, and incentive/penalty structures." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Procurement Manager", variableName: "{{procurement_manager}}", description: "Procurement Manager", type: "text", required: true },
		],
	},
	{
		name: "Resource Management Plan (PMI)",
		description: "PMI/PMBOK resource management plan for managing project team and physical resources.",
		categoryIds: ["pmi", "hr"],
		tags: ["pmi", "pmbok", "resources", "team", "human-resources"],
		difficulty: "intermediate",
		estimatedTime: 150,
		sections: [
			{
				title: "Resource Planning",
				level: 1,
				prompt: "Describe approach to identifying and estimating resource requirements.",
			},
			{
				title: "Team Acquisition",
				level: 1,
				prompt: "Define how team members will be acquired (internal, external, virtual).",
			},
			{
				title: "Team Development",
				level: 1,
				prompt: "Describe training, team-building, and skill development activities.",
			},
			{
				title: "Team Management",
				level: 1,
				prompt: "Define performance management, feedback, and conflict resolution approaches.",
			},
			{
				title: "Physical Resources",
				level: 1,
				prompt: "Address physical resource requirements (facilities, equipment, materials).",
			},
			{
				title: "Resource Calendar",
				level: 1,
				prompt: "Define resource availability and allocation schedule.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Resource Manager", variableName: "{{resource_manager}}", description: "Resource Manager", type: "text", required: true },
		],
	},
	{
		name: "Cost Management Plan (PMI)",
		description: "PMI/PMBOK cost management plan defining cost estimating, budgeting, and control procedures.",
		categoryIds: ["pmi", "finance"],
		tags: ["pmi", "pmbok", "cost", "budget", "financial"],
		difficulty: "intermediate",
		estimatedTime: 150,
		sections: [
			{
				title: "Cost Estimating Approach",
				level: 1,
				prompt: "Define methods and accuracy levels for cost estimating.",
			},
			{
				title: "Budget Development",
				level: 1,
				prompt: "Describe budget development process and funding requirements.",
			},
			{
				title: "Cost Baseline",
				level: 1,
				prompt: "Define the cost baseline and how it will be maintained.",
			},
			{
				title: "Cost Control",
				level: 1,
				prompt: "Describe cost monitoring and control procedures including EVM.",
			},
			{
				title: "Change Control",
				level: 1,
				prompt: "Define cost-related change control thresholds and procedures.",
			},
			{
				title: "Reporting",
				level: 1,
				prompt: "Define cost reporting requirements and formats.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Cost Manager", variableName: "{{cost_manager}}", description: "Cost Manager", type: "text", required: true },
		],
	},
	{
		name: "Schedule Management Plan (PMI)",
		description: "PMI/PMBOK schedule management plan defining scheduling methodology and control procedures.",
		categoryIds: ["pmi", "mgmt"],
		tags: ["pmi", "pmbok", "schedule", "timeline", "planning"],
		difficulty: "intermediate",
		estimatedTime: 150,
		sections: [
			{
				title: "Scheduling Methodology",
				level: 1,
				prompt: "Define scheduling approach, tools, and software to be used.",
			},
			{
				title: "Schedule Development",
				level: 1,
				prompt: "Describe how the schedule will be developed including dependencies and constraints.",
			},
			{
				title: "Schedule Baseline",
				level: 1,
				prompt: "Define the schedule baseline and milestone schedule.",
			},
			{
				title: "Schedule Control",
				level: 1,
				prompt: "Describe schedule monitoring and control procedures.",
			},
			{
				title: "Schedule Compression",
				level: 1,
				prompt: "Define approaches for schedule compression (crashing, fast-tracking).",
			},
			{
				title: "Reporting",
				level: 1,
				prompt: "Define schedule reporting requirements and formats.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Schedule Manager", variableName: "{{schedule_manager}}", description: "Schedule Manager", type: "text", required: true },
		],
	},
	{
		name: "Requirements Traceability Matrix (PMI)",
		description: "PMI/PMBOK requirements traceability matrix linking requirements to objectives and deliverables.",
		categoryIds: ["pmi", "requirements"],
		tags: ["pmi", "pmbok", "requirements", "traceability", "rtm"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Matrix Overview",
				level: 1,
				prompt: "Introduce the RTM and explain its purpose and use.",
			},
			{
				title: "Business Requirements",
				level: 1,
				prompt: "Link business requirements to project objectives.",
			},
			{
				title: "Stakeholder Requirements",
				level: 1,
				prompt: "Link stakeholder requirements to business requirements.",
			},
			{
				title: "Solution Requirements",
				level: 1,
				prompt: "Link functional and non-functional solution requirements.",
			},
			{
				title: "Test Cases",
				level: 1,
				prompt: "Link requirements to test cases and verification methods.",
			},
			{
				title: "Status Tracking",
				level: 1,
				prompt: "Define status tracking and update procedures.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Requirements Manager", variableName: "{{req_manager}}", description: "Requirements Manager", type: "text", required: true },
		],
	},
];

// ============================================================================
// ADDITIONAL PRINCE2 TEMPLATES
// ============================================================================

export const PRINCE2_EXTENDED_TEMPLATES: TemplateDef[] = [
	{
		name: "Issue Register (PRINCE2)",
		description: "PRINCE2 issue register for capturing and tracking project issues.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "issues", "tracking", "register"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Issue Register Overview",
				level: 1,
				prompt: "Introduce the issue register and its usage procedures.",
			},
			{
				title: "Issue Entries",
				level: 1,
				prompt: "Document issues with ID, type, description, priority, status, and owner.",
			},
			{
				title: "Issue Analysis",
				level: 1,
				prompt: "Provide issue analysis including impact and recommended actions.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Risk Register (PRINCE2)",
		description: "PRINCE2 risk register for identifying, assessing, and managing project risks.",
		categoryIds: ["prince2", "risk"],
		tags: ["prince2", "risk", "register", "management"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Risk Register Overview",
				level: 1,
				prompt: "Introduce the risk register and risk management procedures.",
			},
			{
				title: "Risk Identification",
				level: 1,
				prompt: "Document identified risks with ID, category, description, and owner.",
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Assess probability, impact, and calculate risk score.",
			},
			{
				title: "Risk Response",
				level: 1,
				prompt: "Document response strategy (avoid, reduce, transfer, accept, share) and actions.",
			},
			{
				title: "Risk Status",
				level: 1,
				prompt: "Track current status and any residual risks.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Risk Owner", variableName: "{{risk_owner}}", description: "Risk owner", type: "text", required: true },
		],
	},
	{
		name: "Daily Log (PRINCE2)",
		description: "PRINCE2 daily log for recording informal issues, events, and actions.",
		categoryIds: ["prince2", "mgmt"],
		tags: ["prince2", "daily-log", "informal", "diary"],
		difficulty: "beginner",
		estimatedTime: 15,
		sections: [
			{
				title: "Log Entries",
				level: 1,
				prompt: "Record daily entries with date, type, description, and follow-up actions.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Configuration Item Record (PRINCE2)",
		description: "PRINCE2 configuration item record documenting product configuration details.",
		categoryIds: ["prince2", "config"],
		tags: ["prince2", "configuration", "baseline", "version"],
		difficulty: "intermediate",
		estimatedTime: 45,
		sections: [
			{
				title: "Configuration Item Details",
				level: 1,
				prompt: "Document CI identifier, title, type, location, and owner.",
			},
			{
				title: "Version Information",
				level: 1,
				prompt: "Track version number, date, and change history.",
			},
			{
				title: "Relationships",
				level: 1,
				prompt: "Document relationships to other configuration items.",
			},
			{
				title: "Status",
				level: 1,
				prompt: "Track current status and baseline information.",
			},
		],
		placeholders: [
			{ id: "p1", name: "CI ID", variableName: "{{ci_id}}", description: "Configuration item identifier", type: "text", required: true },
			{ id: "p2", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Benefits Review Plan (PRINCE2)",
		description: "PRINCE2 benefits review plan for measuring post-project benefit realization.",
		categoryIds: ["prince2", "benefits"],
		tags: ["prince2", "benefits", "review", "realization"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Benefits Overview",
				level: 1,
				prompt: "Summarize expected benefits and baseline measurements.",
			},
			{
				title: "Benefit Profiles",
				level: 1,
				prompt: "Define detailed benefit profiles with measures and targets.",
			},
			{
				title: "Review Schedule",
				level: 1,
				prompt: "Define when benefit reviews will be conducted post-project.",
			},
			{
				title: "Roles and Responsibilities",
				level: 1,
				prompt: "Assign responsibility for benefit measurement and review.",
			},
			{
				title: "Review Criteria",
				level: 1,
				prompt: "Define success criteria for benefit realization.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Senior User", variableName: "{{senior_user}}", description: "Senior User", type: "text", required: true },
		],
	},
	{
		name: "Communication Management Strategy (PRINCE2)",
		description: "PRINCE2 communication management strategy for stakeholder engagement and information flow.",
		categoryIds: ["prince2", "comms"],
		tags: ["prince2", "communications", "strategy", "stakeholders"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Communication Objectives",
				level: 1,
				prompt: "Define communication objectives and success criteria.",
			},
			{
				title: "Stakeholder Analysis",
				level: 1,
				prompt: "Analyze stakeholder communication needs and preferences.",
			},
			{
				title: "Communication Methods",
				level: 1,
				prompt: "Define communication methods and channels.",
			},
			{
				title: "Communication Schedule",
				level: 1,
				prompt: "Define communication frequency and timing.",
			},
			{
				title: "Roles and Responsibilities",
				level: 1,
				prompt: "Assign communication responsibilities.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Project Manager", variableName: "{{pm_name}}", description: "Project Manager", type: "text", required: true },
		],
	},
];

// ============================================================================
// AGILE/SCRUM TEMPLATES
// ============================================================================

export const AGILE_TEMPLATES: TemplateDef[] = [
	{
		name: "Product Backlog",
		description: "Agile product backlog for managing user stories and prioritized requirements.",
		categoryIds: ["agile", "requirements"],
		tags: ["agile", "scrum", "backlog", "user-stories", "product"],
		difficulty: "beginner",
		estimatedTime: 60,
		sections: [
			{
				title: "Product Vision",
				level: 1,
				prompt: "State the product vision and goals guiding backlog prioritization.",
			},
			{
				title: "Epic Summary",
				level: 1,
				prompt: "List high-level epics organizing the product features.",
			},
			{
				title: "User Stories",
				level: 1,
				prompt: "Document user stories in format: As a [user], I want [feature], so that [benefit].",
			},
			{
				title: "Acceptance Criteria",
				level: 1,
				prompt: "Define acceptance criteria for each user story.",
			},
			{
				title: "Priority and Estimation",
				level: 1,
				prompt: "Assign priority and story point estimates.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Product Name", variableName: "{{product_name}}", description: "Product name", type: "text", required: true },
			{ id: "p2", name: "Product Owner", variableName: "{{product_owner}}", description: "Product Owner", type: "text", required: true },
		],
	},
	{
		name: "Sprint Planning Document",
		description: "Sprint planning document capturing sprint goals, selected stories, and capacity.",
		categoryIds: ["agile", "mgmt"],
		tags: ["agile", "scrum", "sprint", "planning", "iteration"],
		difficulty: "beginner",
		estimatedTime: 45,
		sections: [
			{
				title: "Sprint Information",
				level: 1,
				prompt: "Capture sprint number, dates, and team members.",
			},
			{
				title: "Sprint Goal",
				level: 1,
				prompt: "Define the sprint goal - a single, focused objective.",
			},
			{
				title: "Selected Stories",
				level: 1,
				prompt: "List user stories selected for the sprint with estimates.",
			},
			{
				title: "Team Capacity",
				level: 1,
				prompt: "Calculate team capacity considering availability and velocity.",
			},
			{
				title: "Risks and Dependencies",
				level: 1,
				prompt: "Identify sprint risks and dependencies.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Sprint Number", variableName: "{{sprint_num}}", description: "Sprint number", type: "text", required: true },
			{ id: "p2", name: "Sprint Dates", variableName: "{{sprint_dates}}", description: "Start and end dates", type: "text", required: true },
		],
	},
	{
		name: "Sprint Retrospective",
		description: "Sprint retrospective template for continuous improvement reflection.",
		categoryIds: ["agile", "improvement"],
		tags: ["agile", "scrum", "retrospective", "improvement", "feedback"],
		difficulty: "beginner",
		estimatedTime: 60,
		sections: [
			{
				title: "Sprint Summary",
				level: 1,
				prompt: "Summarize the sprint including velocity and goal achievement.",
			},
			{
				title: "What Went Well",
				level: 1,
				prompt: "Capture what went well and should be continued.",
			},
			{
				title: "What Could Be Improved",
				level: 1,
				prompt: "Identify areas for improvement.",
			},
			{
				title: "Action Items",
				level: 1,
				prompt: "Define specific action items with owners for next sprint.",
			},
			{
				title: "Team Health",
				level: 1,
				prompt: "Assess team morale and collaboration.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Sprint Number", variableName: "{{sprint_num}}", description: "Sprint number", type: "text", required: true },
		],
	},
	{
		name: "Definition of Done",
		description: "Definition of Done establishing completeness criteria for user stories.",
		categoryIds: ["agile", "qa"],
		tags: ["agile", "scrum", "definition-of-done", "quality", "criteria"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Development Criteria",
				level: 1,
				prompt: "Define development completion criteria (code complete, reviewed).",
			},
			{
				title: "Testing Criteria",
				level: 1,
				prompt: "Define testing requirements (unit tests, integration tests, QA).",
			},
			{
				title: "Documentation Criteria",
				level: 1,
				prompt: "Define documentation requirements.",
			},
			{
				title: "Deployment Criteria",
				level: 1,
				prompt: "Define deployment and release requirements.",
			},
			{
				title: "Acceptance Criteria",
				level: 1,
				prompt: "Define Product Owner acceptance requirements.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Team Name", variableName: "{{team_name}}", description: "Team name", type: "text", required: true },
		],
	},
	{
		name: "Release Plan",
		description: "Agile release plan mapping sprints to releases and features.",
		categoryIds: ["agile", "planning"],
		tags: ["agile", "release", "planning", "roadmap", "iterations"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Release Overview",
				level: 1,
				prompt: "Define release scope, goals, and target date.",
			},
			{
				title: "Feature Breakdown",
				level: 1,
				prompt: "List features planned for this release.",
			},
			{
				title: "Sprint Mapping",
				level: 1,
				prompt: "Map features and epics to specific sprints.",
			},
			{
				title: "Dependencies",
				level: 1,
				prompt: "Identify external and internal dependencies.",
			},
			{
				title: "Release Criteria",
				level: 1,
				prompt: "Define criteria for release readiness.",
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Identify and assess release risks.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Release Name", variableName: "{{release_name}}", description: "Release name/version", type: "text", required: true },
			{ id: "p2", name: "Target Date", variableName: "{{target_date}}", description: "Target release date", type: "date", required: true },
		],
	},
	{
		name: "User Story Template",
		description: "Detailed user story template with acceptance criteria and technical notes.",
		categoryIds: ["agile", "requirements"],
		tags: ["agile", "user-story", "requirements", "feature", "acceptance"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "User Story",
				level: 1,
				prompt: "Write the user story: As a [persona], I want [what], so that [why].",
			},
			{
				title: "Acceptance Criteria",
				level: 1,
				prompt: "Define Given/When/Then acceptance criteria.",
			},
			{
				title: "Technical Notes",
				level: 1,
				prompt: "Add technical implementation notes or constraints.",
			},
			{
				title: "Dependencies",
				level: 1,
				prompt: "List any dependencies on other stories or systems.",
			},
			{
				title: "Estimation",
				level: 1,
				prompt: "Provide story point estimate with rationale.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Story ID", variableName: "{{story_id}}", description: "User story identifier", type: "text", required: true },
			{ id: "p2", name: "Epic", variableName: "{{epic}}", description: "Parent epic", type: "text", required: false },
		],
	},
	{
		name: "Kanban Board Setup",
		description: "Kanban board configuration including columns, WIP limits, and policies.",
		categoryIds: ["agile", "process"],
		tags: ["agile", "kanban", "board", "workflow", "wip"],
		difficulty: "intermediate",
		estimatedTime: 45,
		sections: [
			{
				title: "Board Overview",
				level: 1,
				prompt: "Describe the board purpose and team using it.",
			},
			{
				title: "Column Definitions",
				level: 1,
				prompt: "Define each column with entrance and exit criteria.",
			},
			{
				title: "WIP Limits",
				level: 1,
				prompt: "Set work-in-progress limits for each column with rationale.",
			},
			{
				title: "Swimlanes",
				level: 1,
				prompt: "Define swimlanes if used (expedite, class of service).",
			},
			{
				title: "Policies",
				level: 1,
				prompt: "Document policies for handling blocked items and escalations.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Team Name", variableName: "{{team_name}}", description: "Team name", type: "text", required: true },
		],
	},
];

// ============================================================================
// SOFTWARE DEVELOPMENT TEMPLATES
// ============================================================================

export const SOFTWARE_DEV_TEMPLATES: TemplateDef[] = [
	{
		name: "Software Requirements Specification (SRS)",
		description: "IEEE 830 compliant software requirements specification document with comprehensive functional and non-functional requirements.",
		categoryIds: ["software", "requirements"],
		tags: ["software", "srs", "requirements", "specification", "ieee"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Introduction",
				level: 1,
				prompt: "Provide purpose, scope, definitions, references, and document overview per IEEE 830.",
				subsections: [
					{ title: "Purpose", level: 2, prompt: "Define the purpose of this SRS document, intended audience, and how the document should be used." },
					{ title: "Scope", level: 2, prompt: "Describe the software product scope, objectives, benefits, and what is explicitly out of scope." },
					{ title: "Definitions, Acronyms, and Abbreviations", level: 2, prompt: "Define all technical terms, acronyms, and abbreviations used in this document." },
					{ title: "References", level: 2, prompt: "List all referenced documents including standards, related SRS documents, and external specifications." },
					{ title: "Overview", level: 2, prompt: "Describe the organization of the remainder of this SRS document." },
				],
			},
			{
				title: "Overall Description",
				level: 1,
				prompt: "Describe the general factors that affect the product and its requirements.",
				subsections: [
					{ title: "Product Perspective", level: 2, prompt: "Describe how the product relates to other products, systems, and the operating environment. Include system interface diagrams." },
					{ title: "Product Functions", level: 2, prompt: "Summarize the major functions the product must perform. Use data flow diagrams or use case diagrams as appropriate." },
					{ title: "User Characteristics", level: 2, prompt: "Describe the general characteristics of intended users including education level, experience, and technical expertise." },
					{ title: "Constraints", level: 2, prompt: "Describe constraints imposed on the system: regulatory, hardware, software, interfaces, parallelism, audit, criticality, safety, security." },
					{ title: "Assumptions and Dependencies", level: 2, prompt: "List assumptions that may affect requirements and external dependencies." },
					{ title: "Apportioning of Requirements", level: 2, prompt: "Identify requirements that may be delayed until future versions." },
				],
			},
			{
				title: "Specific Requirements",
				level: 1,
				prompt: "Detail all specific requirements at a level of detail sufficient for design and verification.",
				subsections: [
					{ title: "Functional Requirements", level: 2, prompt: "Detail all functional requirements organized by feature, use case, or mode of operation. Each requirement must be uniquely identifiable and testable." },
					{ title: "External Interface Requirements", level: 2, prompt: "Define all external interfaces including user interfaces, hardware interfaces, software interfaces, and communication interfaces." },
					{ title: "Performance Requirements", level: 2, prompt: "Specify static and dynamic numerical requirements: number of terminals, concurrent users, throughput, response times." },
					{ title: "Design Constraints", level: 2, prompt: "Specify design constraints imposed by standards, hardware limitations, and other system constraints." },
					{ title: "Software System Attributes", level: 2, prompt: "Specify required attributes: reliability, availability, security, maintainability, and portability requirements." },
				],
			},
			{
				title: "Non-Functional Requirements",
				level: 1,
				prompt: "Specify quality attributes and cross-cutting concerns.",
				subsections: [
					{ title: "Security Requirements", level: 2, prompt: "Detail authentication, authorization, data protection, audit logging, and security compliance requirements." },
					{ title: "Reliability and Availability", level: 2, prompt: "Specify MTBF, MTTR, uptime requirements, failover, and disaster recovery requirements." },
					{ title: "Scalability Requirements", level: 2, prompt: "Define scaling requirements for users, data volume, transactions, and geographic distribution." },
					{ title: "Usability Requirements", level: 2, prompt: "Specify usability requirements: accessibility (WCAG), localization, user training, and documentation." },
					{ title: "Compliance Requirements", level: 2, prompt: "Detail regulatory and standards compliance requirements (GDPR, HIPAA, SOC 2, PCI-DSS)." },
				],
			},
			{
				title: "Verification",
				level: 1,
				prompt: "Describe how each requirement will be verified.",
				subsections: [
					{ title: "Verification Methods", level: 2, prompt: "Define verification methods for each requirement: inspection, analysis, demonstration, or test." },
					{ title: "Traceability Matrix", level: 2, prompt: "Provide or reference the requirements traceability matrix linking requirements to verification activities." },
				],
			},
			{
				title: "Appendices",
				level: 1,
				prompt: "Include supplementary information supporting the requirements.",
				subsections: [
					{ title: "Analysis Models", level: 2, prompt: "Include data models, behavioral models, state diagrams, and other analysis artifacts." },
					{ title: "Supporting Information", level: 2, prompt: "Include sample reports, screen mockups, business rules, and other supporting materials." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "System Name", variableName: "{{system_name}}", description: "System name", type: "text", required: true },
			{ id: "p2", name: "Version", variableName: "{{version}}", description: "Document version", type: "text", required: true },
			{ id: "p3", name: "Client", variableName: "{{client}}", description: "Client organization", type: "text", required: false },
		],
	},
	{
		name: "Software Design Document (SDD)",
		description: "Comprehensive software design document covering architecture, components, interfaces, data design, and operational concerns.",
		categoryIds: ["software", "architecture"],
		tags: ["software", "design", "architecture", "technical", "sdd"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Introduction",
				level: 1,
				prompt: "Provide document overview, scope, and relationship to requirements.",
				subsections: [
					{ title: "Purpose and Scope", level: 2, prompt: "Define the purpose of this design document and the system scope it addresses." },
					{ title: "Design Goals and Constraints", level: 2, prompt: "Articulate design goals (modularity, scalability, maintainability) and constraints (technology, timeline, budget)." },
					{ title: "References", level: 2, prompt: "Reference related documents: SRS, architecture decision records, and external specifications." },
				],
			},
			{
				title: "Architecture Overview",
				level: 1,
				prompt: "Describe the high-level system architecture from multiple viewpoints.",
				subsections: [
					{ title: "Architectural Style", level: 2, prompt: "Describe the architectural style (microservices, layered, event-driven, serverless) with justification." },
					{ title: "High-Level Structure", level: 2, prompt: "Present the system structure using appropriate diagrams (C4 model, component diagrams)." },
					{ title: "Design Principles", level: 2, prompt: "Document guiding design principles: SOLID, DRY, separation of concerns, and domain-driven design patterns." },
					{ title: "Technology Stack", level: 2, prompt: "Define the technology stack with justification for each choice (languages, frameworks, databases, infrastructure)." },
				],
			},
			{
				title: "Component Design",
				level: 1,
				prompt: "Detail individual component designs with responsibilities, interfaces, and internal structure.",
				subsections: [
					{ title: "Component Catalog", level: 2, prompt: "Provide a catalog of all components with purpose, responsibilities, and dependencies." },
					{ title: "Component Specifications", level: 2, prompt: "For each major component, detail: responsibilities, public interfaces, internal design, and resource requirements." },
					{ title: "Component Interactions", level: 2, prompt: "Document how components interact using sequence diagrams or collaboration diagrams." },
				],
			},
			{
				title: "Data Design",
				level: 1,
				prompt: "Define data architecture including structures, storage, and data flows.",
				subsections: [
					{ title: "Data Model", level: 2, prompt: "Present the logical data model using ER diagrams or domain models with entity descriptions." },
					{ title: "Database Schema", level: 2, prompt: "Define physical database schema including tables, indexes, constraints, and partitioning strategies." },
					{ title: "Data Flow", level: 2, prompt: "Document how data flows through the system using data flow diagrams." },
					{ title: "Data Migration", level: 2, prompt: "If applicable, describe data migration strategies and data transformation requirements." },
				],
			},
			{
				title: "Interface Design",
				level: 1,
				prompt: "Specify all system interfaces: internal, external, and user interfaces.",
				subsections: [
					{ title: "API Design", level: 2, prompt: "Detail API design including REST/GraphQL endpoints, request/response formats, and versioning strategy." },
					{ title: "Integration Interfaces", level: 2, prompt: "Document integration with external systems: protocols, data formats, authentication, and error handling." },
					{ title: "User Interface Design", level: 2, prompt: "Reference UI design specifications including wireframes, component libraries, and accessibility requirements." },
				],
			},
			{
				title: "Security Design",
				level: 1,
				prompt: "Address security architecture and controls throughout the system.",
				subsections: [
					{ title: "Authentication and Authorization", level: 2, prompt: "Detail authentication mechanisms (OAuth, JWT, SAML) and authorization model (RBAC, ABAC)." },
					{ title: "Data Protection", level: 2, prompt: "Document encryption at rest, in transit, key management, and sensitive data handling." },
					{ title: "Security Controls", level: 2, prompt: "Define security controls: input validation, output encoding, CSRF protection, and secure headers." },
					{ title: "Audit and Compliance", level: 2, prompt: "Document audit logging, compliance controls, and security monitoring." },
				],
			},
			{
				title: "Operational Design",
				level: 1,
				prompt: "Address operational concerns including error handling, monitoring, and deployment.",
				subsections: [
					{ title: "Error Handling", level: 2, prompt: "Define error handling strategy: error classification, recovery procedures, and user error messages." },
					{ title: "Logging and Monitoring", level: 2, prompt: "Specify logging strategy, monitoring requirements, alerting thresholds, and observability approach." },
					{ title: "Deployment Architecture", level: 2, prompt: "Document deployment topology, infrastructure requirements, and CI/CD pipeline design." },
					{ title: "Scalability and Performance", level: 2, prompt: "Address horizontal/vertical scaling strategies, caching, and performance optimization approaches." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "System Name", variableName: "{{system_name}}", description: "System name", type: "text", required: true },
			{ id: "p2", name: "Version", variableName: "{{version}}", description: "Design version", type: "text", required: true },
			{ id: "p3", name: "Architect", variableName: "{{architect}}", description: "Lead architect", type: "text", required: false },
		],
	},
	{
		name: "API Documentation",
		description: "REST API documentation template with endpoints, requests, and responses.",
		categoryIds: ["software", "technical"],
		tags: ["api", "rest", "documentation", "endpoints", "integration"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "API Overview",
				level: 1,
				prompt: "Introduce the API including base URL, versioning, and authentication.",
			},
			{
				title: "Authentication",
				level: 1,
				prompt: "Document authentication methods and security requirements.",
			},
			{
				title: "Endpoints",
				level: 1,
				prompt: "Document each endpoint with method, path, parameters, and responses.",
			},
			{
				title: "Error Handling",
				level: 1,
				prompt: "Define error codes, messages, and handling guidelines.",
			},
			{
				title: "Rate Limiting",
				level: 1,
				prompt: "Document rate limiting policies and quotas.",
			},
			{
				title: "Examples",
				level: 1,
				prompt: "Provide code examples for common use cases.",
			},
		],
		placeholders: [
			{ id: "p1", name: "API Name", variableName: "{{api_name}}", description: "API name", type: "text", required: true },
			{ id: "p2", name: "Base URL", variableName: "{{base_url}}", description: "API base URL", type: "text", required: true },
		],
	},
	{
		name: "Test Plan",
		description: "Comprehensive test plan covering strategy, scope, and test cases.",
		categoryIds: ["software", "qa"],
		tags: ["testing", "test-plan", "qa", "quality", "verification"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Test Plan Overview",
				level: 1,
				prompt: "Define testing objectives, scope, and approach.",
			},
			{
				title: "Test Strategy",
				level: 1,
				prompt: "Describe testing levels, types, and methodologies.",
			},
			{
				title: "Test Environment",
				level: 1,
				prompt: "Define hardware, software, and configuration requirements.",
			},
			{
				title: "Test Schedule",
				level: 1,
				prompt: "Define testing timeline and milestones.",
			},
			{
				title: "Test Cases",
				level: 1,
				prompt: "Document test cases with preconditions, steps, and expected results.",
			},
			{
				title: "Entry/Exit Criteria",
				level: 1,
				prompt: "Define criteria for starting and completing test phases.",
			},
			{
				title: "Defect Management",
				level: 1,
				prompt: "Describe defect tracking and resolution process.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Test Lead", variableName: "{{test_lead}}", description: "Test Lead", type: "text", required: true },
		],
	},
	{
		name: "Technical Specification",
		description: "Technical specification for feature implementation including design decisions.",
		categoryIds: ["software", "technical"],
		tags: ["technical", "specification", "design", "implementation", "feature"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Overview",
				level: 1,
				prompt: "Summarize the feature and problem being solved.",
			},
			{
				title: "Goals and Non-Goals",
				level: 1,
				prompt: "Clearly state what is in scope and out of scope.",
			},
			{
				title: "Proposed Solution",
				level: 1,
				prompt: "Describe the technical approach and design.",
			},
			{
				title: "Alternatives Considered",
				level: 1,
				prompt: "Document alternative approaches and why they were rejected.",
			},
			{
				title: "Implementation Plan",
				level: 1,
				prompt: "Break down implementation into phases or milestones.",
			},
			{
				title: "Testing Strategy",
				level: 1,
				prompt: "Define how the feature will be tested.",
			},
			{
				title: "Rollout Plan",
				level: 1,
				prompt: "Describe deployment and rollout strategy.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Feature Name", variableName: "{{feature_name}}", description: "Feature name", type: "text", required: true },
			{ id: "p2", name: "Author", variableName: "{{author}}", description: "Spec author", type: "text", required: true },
		],
	},
	{
		name: "Database Design Document",
		description: "Database design document covering schema, relationships, and optimization.",
		categoryIds: ["software", "data"],
		tags: ["database", "schema", "design", "data-model", "sql"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Database Overview",
				level: 1,
				prompt: "Describe the database purpose, DBMS choice, and design goals.",
			},
			{
				title: "Entity Relationship Diagram",
				level: 1,
				prompt: "Include or describe the ER diagram showing all entities.",
			},
			{
				title: "Table Definitions",
				level: 1,
				prompt: "Define each table with columns, types, constraints, and indexes.",
			},
			{
				title: "Relationships",
				level: 1,
				prompt: "Document all relationships including foreign keys and cardinality.",
			},
			{
				title: "Indexing Strategy",
				level: 1,
				prompt: "Define indexing strategy for performance optimization.",
			},
			{
				title: "Data Migration",
				level: 1,
				prompt: "Describe data migration approach if applicable.",
			},
			{
				title: "Backup and Recovery",
				level: 1,
				prompt: "Define backup and disaster recovery procedures.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Database Name", variableName: "{{db_name}}", description: "Database name", type: "text", required: true },
			{ id: "p2", name: "DBMS", variableName: "{{dbms}}", description: "Database system", type: "text", required: true },
		],
	},
	{
		name: "Deployment Runbook",
		description: "Deployment runbook with step-by-step procedures and rollback instructions.",
		categoryIds: ["software", "devops"],
		tags: ["deployment", "runbook", "devops", "release", "operations"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Deployment Overview",
				level: 1,
				prompt: "Summarize the deployment scope and environment.",
			},
			{
				title: "Prerequisites",
				level: 1,
				prompt: "List all prerequisites including access, approvals, and dependencies.",
			},
			{
				title: "Pre-Deployment Checklist",
				level: 1,
				prompt: "Define pre-deployment verification steps.",
			},
			{
				title: "Deployment Steps",
				level: 1,
				prompt: "Detail step-by-step deployment procedure.",
			},
			{
				title: "Verification Steps",
				level: 1,
				prompt: "Define post-deployment verification and smoke tests.",
			},
			{
				title: "Rollback Procedure",
				level: 1,
				prompt: "Document rollback steps if deployment fails.",
			},
			{
				title: "Contacts",
				level: 1,
				prompt: "List escalation contacts for deployment issues.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Release Version", variableName: "{{release_version}}", description: "Release version", type: "text", required: true },
			{ id: "p2", name: "Environment", variableName: "{{environment}}", description: "Target environment", type: "text", required: true },
		],
	},
	{
		name: "Incident Report",
		description: "Post-incident report template for documenting and learning from outages.",
		categoryIds: ["software", "operations"],
		tags: ["incident", "postmortem", "outage", "report", "learning"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Incident Summary",
				level: 1,
				prompt: "Summarize the incident including severity, duration, and impact.",
			},
			{
				title: "Timeline",
				level: 1,
				prompt: "Provide detailed timeline from detection to resolution.",
			},
			{
				title: "Root Cause Analysis",
				level: 1,
				prompt: "Analyze the root cause(s) of the incident.",
			},
			{
				title: "Impact Analysis",
				level: 1,
				prompt: "Detail the business and technical impact.",
			},
			{
				title: "Resolution",
				level: 1,
				prompt: "Document the steps taken to resolve the incident.",
			},
			{
				title: "Action Items",
				level: 1,
				prompt: "List follow-up actions to prevent recurrence.",
			},
			{
				title: "Lessons Learned",
				level: 1,
				prompt: "Capture lessons learned and process improvements.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Incident ID", variableName: "{{incident_id}}", description: "Incident identifier", type: "text", required: true },
			{ id: "p2", name: "Incident Date", variableName: "{{incident_date}}", description: "Incident date", type: "date", required: true },
		],
	},
];

// ============================================================================
// SPECIALIZED RFP TEMPLATES
// ============================================================================

export const SPECIALIZED_RFP_TEMPLATES: TemplateDef[] = [
	{
		name: "Software Development RFP Response",
		description: "RFP response template for custom software development projects.",
		categoryIds: ["rfp", "software"],
		tags: ["rfp", "software-development", "proposal", "custom", "development"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize understanding of requirements and proposed solution.",
			},
			{
				title: "Technical Approach",
				level: 1,
				prompt: "Detail the development methodology, architecture, and technology stack.",
				subsections: [
					{ title: "Development Methodology", level: 2, prompt: "Describe agile/waterfall approach and ceremonies." },
					{ title: "Technical Architecture", level: 2, prompt: "Present the proposed system architecture." },
					{ title: "Technology Stack", level: 2, prompt: "Justify technology choices and alternatives considered." },
				],
			},
			{
				title: "Team Qualifications",
				level: 1,
				prompt: "Present team structure, roles, and individual qualifications.",
			},
			{
				title: "Past Performance",
				level: 1,
				prompt: "Highlight relevant past projects with similar scope and complexity.",
			},
			{
				title: "Project Plan",
				level: 1,
				prompt: "Provide detailed project schedule with milestones and deliverables.",
			},
			{
				title: "Quality Assurance",
				level: 1,
				prompt: "Describe QA processes including testing, code review, and CI/CD.",
			},
			{
				title: "Security Approach",
				level: 1,
				prompt: "Detail security measures and compliance with requirements.",
			},
			{
				title: "Cost Proposal",
				level: 1,
				prompt: "Present pricing model, cost breakdown, and value justification.",
			},
		],
		placeholders: [
			{ id: "p1", name: "RFP Number", variableName: "{{rfp_number}}", description: "RFP/solicitation number", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client organization", type: "text", required: true },
			{ id: "p3", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Construction RFP Response",
		description: "RFP response template for construction and infrastructure projects.",
		categoryIds: ["rfp", "construction"],
		tags: ["rfp", "construction", "infrastructure", "building", "proposal"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize approach to the construction project.",
			},
			{
				title: "Project Understanding",
				level: 1,
				prompt: "Demonstrate understanding of project scope, site conditions, and challenges.",
			},
			{
				title: "Construction Approach",
				level: 1,
				prompt: "Detail construction methodology, phasing, and sequencing.",
			},
			{
				title: "Safety Plan",
				level: 1,
				prompt: "Present comprehensive safety program and OSHA compliance.",
			},
			{
				title: "Quality Control",
				level: 1,
				prompt: "Describe QA/QC procedures and inspection protocols.",
			},
			{
				title: "Project Schedule",
				level: 1,
				prompt: "Provide detailed construction schedule with milestones.",
			},
			{
				title: "Key Personnel",
				level: 1,
				prompt: "Present project team including superintendent and PM qualifications.",
			},
			{
				title: "Subcontractor Management",
				level: 1,
				prompt: "Describe approach to subcontractor selection and management.",
			},
			{
				title: "Equipment and Resources",
				level: 1,
				prompt: "List major equipment and resources to be deployed.",
			},
			{
				title: "Cost Proposal",
				level: 1,
				prompt: "Present bid amount with detailed cost breakdown.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Bid Number", variableName: "{{bid_number}}", description: "Bid/RFP number", type: "text", required: true },
			{ id: "p3", name: "Location", variableName: "{{location}}", description: "Project location", type: "text", required: true },
		],
	},
	{
		name: "Healthcare Services RFP Response",
		description: "RFP response template for healthcare services and medical contracts.",
		categoryIds: ["rfp", "healthcare"],
		tags: ["rfp", "healthcare", "medical", "hipaa", "services"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize healthcare service offering and key differentiators.",
			},
			{
				title: "Clinical Approach",
				level: 1,
				prompt: "Detail clinical methodology and care delivery model.",
			},
			{
				title: "Quality and Outcomes",
				level: 1,
				prompt: "Present quality metrics, outcome measures, and improvement initiatives.",
			},
			{
				title: "Compliance and Accreditation",
				level: 1,
				prompt: "Document HIPAA compliance, accreditations, and regulatory adherence.",
			},
			{
				title: "Staff Qualifications",
				level: 1,
				prompt: "Present clinical staff credentials, licensing, and experience.",
			},
			{
				title: "Technology and Systems",
				level: 1,
				prompt: "Describe EHR systems, telehealth capabilities, and interoperability.",
			},
			{
				title: "Patient Safety",
				level: 1,
				prompt: "Detail patient safety protocols and incident management.",
			},
			{
				title: "Past Performance",
				level: 1,
				prompt: "Highlight relevant healthcare contracts and performance data.",
			},
			{
				title: "Cost Proposal",
				level: 1,
				prompt: "Present pricing structure and value-based components.",
			},
		],
		placeholders: [
			{ id: "p1", name: "RFP Number", variableName: "{{rfp_number}}", description: "RFP number", type: "text", required: true },
			{ id: "p2", name: "Healthcare Entity", variableName: "{{entity_name}}", description: "Healthcare entity name", type: "text", required: true },
		],
	},
	{
		name: "Professional Services RFP Response",
		description: "RFP response template for professional services (legal, accounting, consulting).",
		categoryIds: ["rfp", "professional"],
		tags: ["rfp", "professional-services", "consulting", "legal", "accounting"],
		difficulty: "intermediate",
		estimatedTime: 300,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize firm capabilities and approach to engagement.",
			},
			{
				title: "Firm Overview",
				level: 1,
				prompt: "Present firm history, size, practice areas, and office locations.",
			},
			{
				title: "Relevant Experience",
				level: 1,
				prompt: "Highlight experience with similar clients and matters.",
			},
			{
				title: "Proposed Team",
				level: 1,
				prompt: "Present engagement team with roles, qualifications, and availability.",
			},
			{
				title: "Service Approach",
				level: 1,
				prompt: "Detail approach to delivering requested services.",
			},
			{
				title: "Client References",
				level: 1,
				prompt: "Provide client references with contact information.",
			},
			{
				title: "Technology and Innovation",
				level: 1,
				prompt: "Describe technology tools and innovative approaches.",
			},
			{
				title: "Fee Proposal",
				level: 1,
				prompt: "Present fee structure, billing practices, and budget management.",
			},
		],
		placeholders: [
			{ id: "p1", name: "RFP Title", variableName: "{{rfp_title}}", description: "RFP title", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Prospective client", type: "text", required: true },
		],
	},
	{
		name: "Managed Services RFP Response",
		description: "RFP response template for IT managed services and outsourcing.",
		categoryIds: ["rfp", "it"],
		tags: ["rfp", "managed-services", "msp", "outsourcing", "it-services"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize managed services offering and partnership approach.",
			},
			{
				title: "Service Catalog",
				level: 1,
				prompt: "Detail services included with service level definitions.",
			},
			{
				title: "Service Level Agreements",
				level: 1,
				prompt: "Present SLAs with metrics, targets, and remedies.",
			},
			{
				title: "Service Delivery Model",
				level: 1,
				prompt: "Describe delivery model including onshore/offshore mix.",
			},
			{
				title: "Technology Platform",
				level: 1,
				prompt: "Present tools, monitoring platforms, and automation capabilities.",
			},
			{
				title: "Security and Compliance",
				level: 1,
				prompt: "Detail security controls, certifications, and compliance.",
			},
			{
				title: "Transition Plan",
				level: 1,
				prompt: "Provide detailed transition/onboarding plan.",
			},
			{
				title: "Governance",
				level: 1,
				prompt: "Define governance model and escalation procedures.",
			},
			{
				title: "Pricing Model",
				level: 1,
				prompt: "Present pricing structure with clear inclusions/exclusions.",
			},
		],
		placeholders: [
			{ id: "p1", name: "RFP Number", variableName: "{{rfp_number}}", description: "RFP number", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client organization", type: "text", required: true },
		],
	},
];

// ============================================================================
// FINANCIAL/BUSINESS TEMPLATES
// ============================================================================

export const FINANCIAL_TEMPLATES: TemplateDef[] = [
	{
		name: "Annual Budget Template",
		description: "Comprehensive annual budget template with revenue, expenses, and variance tracking.",
		categoryIds: ["finance", "planning"],
		tags: ["budget", "financial", "annual", "planning", "forecast"],
		difficulty: "intermediate",
		estimatedTime: 240,
		sections: [
			{
				title: "Budget Overview",
				level: 1,
				prompt: "Summarize budget objectives, assumptions, and key drivers.",
			},
			{
				title: "Revenue Budget",
				level: 1,
				prompt: "Detail revenue projections by product/service line.",
			},
			{
				title: "Operating Expenses",
				level: 1,
				prompt: "Break down operating expenses by department and category.",
			},
			{
				title: "Capital Expenditures",
				level: 1,
				prompt: "Detail capital investments and depreciation.",
			},
			{
				title: "Cash Flow Projection",
				level: 1,
				prompt: "Project monthly cash flow including timing considerations.",
			},
			{
				title: "Variance Analysis",
				level: 1,
				prompt: "Compare to prior year with explanation of significant variances.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Fiscal Year", variableName: "{{fiscal_year}}", description: "Fiscal year", type: "text", required: true },
			{ id: "p2", name: "Department", variableName: "{{department}}", description: "Department name", type: "text", required: false },
		],
	},
	{
		name: "Investment Proposal",
		description: "Investment proposal template for capital projects or initiatives.",
		categoryIds: ["finance", "business"],
		tags: ["investment", "capital", "proposal", "roi", "npv"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the investment opportunity and recommendation.",
			},
			{
				title: "Investment Overview",
				level: 1,
				prompt: "Describe the investment including amount and timeline.",
			},
			{
				title: "Strategic Alignment",
				level: 1,
				prompt: "Explain alignment with strategic objectives.",
			},
			{
				title: "Financial Analysis",
				level: 1,
				prompt: "Present NPV, IRR, payback period, and sensitivity analysis.",
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Identify and assess investment risks.",
			},
			{
				title: "Implementation Plan",
				level: 1,
				prompt: "Outline implementation timeline and resource requirements.",
			},
			{
				title: "Recommendation",
				level: 1,
				prompt: "Provide clear recommendation with justification.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Investment Amount", variableName: "{{amount}}", description: "Investment amount", type: "text", required: true },
		],
	},
	{
		name: "Financial Audit Report",
		description: "Financial audit report template following auditing standards.",
		categoryIds: ["finance", "compliance"],
		tags: ["audit", "financial", "report", "compliance", "gaas"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Auditor's Report",
				level: 1,
				prompt: "Provide the formal audit opinion.",
			},
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize audit scope, approach, and key findings.",
			},
			{
				title: "Financial Statement Analysis",
				level: 1,
				prompt: "Analyze financial statements for material misstatements.",
			},
			{
				title: "Internal Controls",
				level: 1,
				prompt: "Evaluate internal control environment.",
			},
			{
				title: "Findings and Observations",
				level: 1,
				prompt: "Detail findings with risk ratings and recommendations.",
			},
			{
				title: "Management Response",
				level: 1,
				prompt: "Include management responses to findings.",
			},
			{
				title: "Appendices",
				level: 1,
				prompt: "Include supporting schedules and documentation.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Entity Name", variableName: "{{entity_name}}", description: "Audited entity", type: "text", required: true },
			{ id: "p2", name: "Audit Period", variableName: "{{period}}", description: "Audit period", type: "text", required: true },
		],
	},
	{
		name: "Business Continuity Plan",
		description: "Comprehensive business continuity plan for maintaining operations during disruptions following ISO 22301 principles.",
		categoryIds: ["business", "risk"],
		tags: ["bcp", "continuity", "disaster-recovery", "risk", "resilience"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Plan Overview",
				level: 1,
				prompt: "Introduce the BCP including purpose, scope, objectives, and governance.",
				subsections: [
					{ title: "Purpose and Objectives", level: 2, prompt: "State the purpose of this plan and define continuity objectives aligned with organizational strategy." },
					{ title: "Scope and Applicability", level: 2, prompt: "Define the scope of the plan including covered locations, functions, processes, and systems." },
					{ title: "Plan Activation Criteria", level: 2, prompt: "Define the criteria and authority for activating the BCP at various levels (incident, crisis, disaster)." },
					{ title: "Governance Structure", level: 2, prompt: "Define the crisis management team structure, roles, responsibilities, and decision-making authority." },
				],
			},
			{
				title: "Business Impact Analysis",
				level: 1,
				prompt: "Analyze critical business functions and determine recovery requirements.",
				subsections: [
					{ title: "Critical Function Identification", level: 2, prompt: "Identify and prioritize critical business functions based on operational and financial impact." },
					{ title: "Recovery Time Objectives (RTO)", level: 2, prompt: "Define maximum acceptable downtime for each critical function with justification." },
					{ title: "Recovery Point Objectives (RPO)", level: 2, prompt: "Define maximum acceptable data loss for each critical function." },
					{ title: "Dependencies and Resources", level: 2, prompt: "Map dependencies: applications, data, infrastructure, personnel, suppliers, and facilities." },
				],
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Identify and assess risks that could impact business continuity.",
				subsections: [
					{ title: "Threat Identification", level: 2, prompt: "Identify potential threats: natural disasters, cyber attacks, infrastructure failures, pandemics, supply chain disruptions." },
					{ title: "Vulnerability Assessment", level: 2, prompt: "Assess organizational vulnerabilities to identified threats." },
					{ title: "Risk Analysis", level: 2, prompt: "Analyze likelihood and impact of each threat scenario and calculate risk levels." },
					{ title: "Risk Mitigation", level: 2, prompt: "Define risk mitigation measures and controls to reduce probability or impact." },
				],
			},
			{
				title: "Recovery Strategies",
				level: 1,
				prompt: "Define strategies to recover critical functions within required timeframes.",
				subsections: [
					{ title: "IT Disaster Recovery", level: 2, prompt: "Detail IT recovery strategies: backup systems, alternate sites, cloud failover, and data restoration procedures." },
					{ title: "Facility Recovery", level: 2, prompt: "Define alternate work locations, equipment relocation, and facility restoration strategies." },
					{ title: "Workforce Continuity", level: 2, prompt: "Address remote work capabilities, cross-training, succession planning, and employee safety protocols." },
					{ title: "Supply Chain Continuity", level: 2, prompt: "Define strategies for supplier failures: alternate suppliers, inventory buffers, and contract provisions." },
				],
			},
			{
				title: "Emergency Response",
				level: 1,
				prompt: "Document immediate response procedures for various incident types.",
				subsections: [
					{ title: "Initial Response Procedures", level: 2, prompt: "Define immediate actions: life safety, incident assessment, initial notifications, and triage procedures." },
					{ title: "Incident Classification", level: 2, prompt: "Define incident classification levels and corresponding response protocols." },
					{ title: "Escalation Procedures", level: 2, prompt: "Document escalation paths, decision trees, and authority levels for incident escalation." },
				],
			},
			{
				title: "Crisis Communication",
				level: 1,
				prompt: "Define crisis communication procedures for all stakeholders.",
				subsections: [
					{ title: "Internal Communications", level: 2, prompt: "Define employee notification procedures, communication channels, and messaging templates." },
					{ title: "External Communications", level: 2, prompt: "Define communications to customers, partners, media, regulators, and the public." },
					{ title: "Contact Lists", level: 2, prompt: "Maintain emergency contact lists for all key personnel, stakeholders, and service providers." },
				],
			},
			{
				title: "Testing and Maintenance",
				level: 1,
				prompt: "Define testing schedule and ongoing maintenance procedures.",
				subsections: [
					{ title: "Test Program", level: 2, prompt: "Define testing approach: tabletop exercises, functional tests, full-scale simulations, and test frequency." },
					{ title: "Plan Maintenance", level: 2, prompt: "Define procedures for regular plan updates, change triggers, and version control." },
					{ title: "Training and Awareness", level: 2, prompt: "Document training requirements for crisis team members and general awareness programs." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Plan Version", variableName: "{{version}}", description: "Plan version", type: "text", required: true },
			{ id: "p3", name: "BCP Coordinator", variableName: "{{coordinator}}", description: "BCP Coordinator", type: "text", required: false },
		],
	},
	{
		name: "Marketing Plan",
		description: "Comprehensive marketing plan with strategy, tactics, and budget.",
		categoryIds: ["business", "marketing"],
		tags: ["marketing", "plan", "strategy", "campaigns", "budget"],
		difficulty: "intermediate",
		estimatedTime: 240,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize marketing objectives and key strategies.",
			},
			{
				title: "Situation Analysis",
				level: 1,
				prompt: "Analyze market conditions, competitors, and SWOT.",
			},
			{
				title: "Target Market",
				level: 1,
				prompt: "Define target segments and buyer personas.",
			},
			{
				title: "Marketing Strategy",
				level: 1,
				prompt: "Outline overall marketing strategy and positioning.",
			},
			{
				title: "Marketing Mix",
				level: 1,
				prompt: "Detail the 4Ps: Product, Price, Place, Promotion.",
			},
			{
				title: "Campaign Calendar",
				level: 1,
				prompt: "Present marketing campaign calendar and key dates.",
			},
			{
				title: "Budget",
				level: 1,
				prompt: "Detail marketing budget allocation by channel.",
			},
			{
				title: "Metrics and KPIs",
				level: 1,
				prompt: "Define success metrics and measurement approach.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Product/Service", variableName: "{{product}}", description: "Product or service", type: "text", required: true },
			{ id: "p2", name: "Planning Period", variableName: "{{period}}", description: "Planning period", type: "text", required: true },
		],
	},
	{
		name: "Sales Proposal",
		description: "Professional sales proposal template for B2B deals.",
		categoryIds: ["business", "sales"],
		tags: ["sales", "proposal", "b2b", "deal", "quotation"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the opportunity and proposed solution.",
			},
			{
				title: "Understanding Your Needs",
				level: 1,
				prompt: "Demonstrate understanding of client challenges and objectives.",
			},
			{
				title: "Proposed Solution",
				level: 1,
				prompt: "Detail the proposed solution and how it addresses needs.",
			},
			{
				title: "Why Choose Us",
				level: 1,
				prompt: "Present differentiators and competitive advantages.",
			},
			{
				title: "Implementation Approach",
				level: 1,
				prompt: "Outline implementation timeline and process.",
			},
			{
				title: "Investment",
				level: 1,
				prompt: "Present pricing with clear terms and payment options.",
			},
			{
				title: "Next Steps",
				level: 1,
				prompt: "Define clear next steps and call to action.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Prospect Name", variableName: "{{prospect}}", description: "Prospect company", type: "text", required: true },
			{ id: "p2", name: "Solution Name", variableName: "{{solution}}", description: "Product/solution", type: "text", required: true },
		],
	},
];

// ============================================================================
// HR/ORGANIZATIONAL TEMPLATES
// ============================================================================

export const HR_TEMPLATES: TemplateDef[] = [
	{
		name: "Job Description",
		description: "Comprehensive job description template for recruitment.",
		categoryIds: ["hr", "recruitment"],
		tags: ["hr", "job-description", "recruitment", "hiring", "position"],
		difficulty: "beginner",
		estimatedTime: 45,
		sections: [
			{
				title: "Position Overview",
				level: 1,
				prompt: "Provide job title, department, and position summary.",
			},
			{
				title: "Key Responsibilities",
				level: 1,
				prompt: "List primary duties and responsibilities.",
			},
			{
				title: "Qualifications",
				level: 1,
				prompt: "Define required education, experience, and certifications.",
			},
			{
				title: "Skills and Competencies",
				level: 1,
				prompt: "List required and preferred skills.",
			},
			{
				title: "Working Conditions",
				level: 1,
				prompt: "Describe work environment and any physical requirements.",
			},
			{
				title: "Compensation and Benefits",
				level: 1,
				prompt: "Outline salary range and benefits package.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Job Title", variableName: "{{job_title}}", description: "Position title", type: "text", required: true },
			{ id: "p2", name: "Department", variableName: "{{department}}", description: "Department", type: "text", required: true },
		],
	},
	{
		name: "Performance Review",
		description: "Employee performance review template with goals and development.",
		categoryIds: ["hr", "performance"],
		tags: ["hr", "performance", "review", "appraisal", "evaluation"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Employee Information",
				level: 1,
				prompt: "Capture employee details and review period.",
			},
			{
				title: "Performance Against Goals",
				level: 1,
				prompt: "Evaluate achievement of established goals.",
			},
			{
				title: "Competency Assessment",
				level: 1,
				prompt: "Rate performance against core competencies.",
			},
			{
				title: "Accomplishments",
				level: 1,
				prompt: "Highlight key accomplishments during the review period.",
			},
			{
				title: "Areas for Development",
				level: 1,
				prompt: "Identify areas for improvement and growth.",
			},
			{
				title: "Goals for Next Period",
				level: 1,
				prompt: "Set SMART goals for the next review period.",
			},
			{
				title: "Development Plan",
				level: 1,
				prompt: "Create a development plan with actions and timelines.",
			},
			{
				title: "Overall Rating",
				level: 1,
				prompt: "Provide overall performance rating and justification.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Employee Name", variableName: "{{employee_name}}", description: "Employee name", type: "text", required: true },
			{ id: "p2", name: "Review Period", variableName: "{{period}}", description: "Review period", type: "text", required: true },
		],
	},
	{
		name: "Employee Handbook",
		description: "Employee handbook template covering policies and procedures.",
		categoryIds: ["hr", "policy"],
		tags: ["hr", "handbook", "policies", "procedures", "compliance"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Welcome and Introduction",
				level: 1,
				prompt: "Welcome employees and introduce company culture.",
			},
			{
				title: "Employment Policies",
				level: 1,
				prompt: "Cover employment classifications, EEO, and hiring policies.",
			},
			{
				title: "Compensation and Benefits",
				level: 1,
				prompt: "Detail pay practices, benefits, and time-off policies.",
			},
			{
				title: "Work Rules and Conduct",
				level: 1,
				prompt: "Define workplace conduct expectations and policies.",
			},
			{
				title: "Safety and Security",
				level: 1,
				prompt: "Cover workplace safety and emergency procedures.",
			},
			{
				title: "Technology and Information",
				level: 1,
				prompt: "Define technology use policies and information security.",
			},
			{
				title: "Separation",
				level: 1,
				prompt: "Cover resignation, termination, and exit procedures.",
			},
			{
				title: "Acknowledgment",
				level: 1,
				prompt: "Include handbook receipt acknowledgment.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Effective Date", variableName: "{{effective_date}}", description: "Effective date", type: "date", required: true },
		],
	},
	{
		name: "Training Plan",
		description: "Employee training plan template for skill development.",
		categoryIds: ["hr", "training"],
		tags: ["hr", "training", "development", "learning", "skills"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Training Overview",
				level: 1,
				prompt: "Define training objectives and target audience.",
			},
			{
				title: "Skills Gap Analysis",
				level: 1,
				prompt: "Identify current vs. required skills.",
			},
			{
				title: "Training Curriculum",
				level: 1,
				prompt: "Detail training modules, content, and delivery methods.",
			},
			{
				title: "Schedule",
				level: 1,
				prompt: "Provide training schedule and timeline.",
			},
			{
				title: "Resources",
				level: 1,
				prompt: "Identify training resources and materials needed.",
			},
			{
				title: "Assessment",
				level: 1,
				prompt: "Define how training effectiveness will be measured.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Training Program", variableName: "{{program_name}}", description: "Training program name", type: "text", required: true },
			{ id: "p2", name: "Department", variableName: "{{department}}", description: "Department", type: "text", required: true },
		],
	},
	{
		name: "Organizational Change Plan",
		description: "Change management plan for organizational transformation.",
		categoryIds: ["hr", "change"],
		tags: ["change-management", "transformation", "organizational", "change", "planning"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Change Overview",
				level: 1,
				prompt: "Describe the change and its drivers.",
			},
			{
				title: "Impact Assessment",
				level: 1,
				prompt: "Assess organizational and people impact.",
			},
			{
				title: "Stakeholder Analysis",
				level: 1,
				prompt: "Identify stakeholders and their change readiness.",
			},
			{
				title: "Communication Plan",
				level: 1,
				prompt: "Define communication strategy and messaging.",
			},
			{
				title: "Training and Support",
				level: 1,
				prompt: "Outline training and support resources.",
			},
			{
				title: "Resistance Management",
				level: 1,
				prompt: "Identify potential resistance and mitigation strategies.",
			},
			{
				title: "Success Metrics",
				level: 1,
				prompt: "Define how change success will be measured.",
			},
			{
				title: "Sustainability",
				level: 1,
				prompt: "Plan for sustaining the change long-term.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Initiative Name", variableName: "{{initiative}}", description: "Change initiative", type: "text", required: true },
			{ id: "p2", name: "Sponsor", variableName: "{{sponsor}}", description: "Executive sponsor", type: "text", required: true },
		],
	},
];

// ============================================================================
// ADDITIONAL CONSULTANCY TEMPLATES
// ============================================================================

export const CONSULTANCY_EXTENDED_TEMPLATES: TemplateDef[] = [
	{
		name: "Feasibility Study",
		description: "Feasibility study template for evaluating project viability.",
		categoryIds: ["consultancy", "analysis"],
		tags: ["feasibility", "study", "analysis", "viability", "assessment"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize feasibility findings and recommendation.",
			},
			{
				title: "Project Description",
				level: 1,
				prompt: "Describe the proposed project or initiative.",
			},
			{
				title: "Technical Feasibility",
				level: 1,
				prompt: "Assess technical requirements and capabilities.",
			},
			{
				title: "Economic Feasibility",
				level: 1,
				prompt: "Analyze costs, benefits, and financial viability.",
			},
			{
				title: "Operational Feasibility",
				level: 1,
				prompt: "Evaluate organizational readiness and impact.",
			},
			{
				title: "Schedule Feasibility",
				level: 1,
				prompt: "Assess timeline realism and constraints.",
			},
			{
				title: "Legal and Regulatory",
				level: 1,
				prompt: "Review legal and regulatory considerations.",
			},
			{
				title: "Risk Analysis",
				level: 1,
				prompt: "Identify and assess key risks.",
			},
			{
				title: "Recommendation",
				level: 1,
				prompt: "Provide clear recommendation with conditions.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client", type: "text", required: true },
		],
	},
	{
		name: "Gap Analysis Report",
		description: "Gap analysis report identifying current vs. desired state.",
		categoryIds: ["consultancy", "analysis"],
		tags: ["gap-analysis", "assessment", "current-state", "future-state", "improvement"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize key gaps and prioritized recommendations.",
			},
			{
				title: "Scope and Methodology",
				level: 1,
				prompt: "Define analysis scope and methodology used.",
			},
			{
				title: "Current State Assessment",
				level: 1,
				prompt: "Document current state across assessed dimensions.",
			},
			{
				title: "Desired Future State",
				level: 1,
				prompt: "Define the target future state.",
			},
			{
				title: "Gap Identification",
				level: 1,
				prompt: "Identify and describe gaps between current and future states.",
			},
			{
				title: "Root Cause Analysis",
				level: 1,
				prompt: "Analyze root causes of significant gaps.",
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide prioritized recommendations to close gaps.",
			},
			{
				title: "Implementation Roadmap",
				level: 1,
				prompt: "Outline roadmap for implementing recommendations.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Analysis Area", variableName: "{{area}}", description: "Area being analyzed", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client", type: "text", required: true },
		],
	},
	{
		name: "Benchmarking Report",
		description: "Benchmarking report comparing performance against peers or standards.",
		categoryIds: ["consultancy", "analysis"],
		tags: ["benchmarking", "comparison", "performance", "best-practices", "metrics"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize benchmarking findings and key insights.",
			},
			{
				title: "Benchmarking Methodology",
				level: 1,
				prompt: "Describe benchmarking approach and data sources.",
			},
			{
				title: "Peer Group Selection",
				level: 1,
				prompt: "Define and justify peer group selection.",
			},
			{
				title: "Performance Metrics",
				level: 1,
				prompt: "Define metrics being benchmarked.",
			},
			{
				title: "Comparative Analysis",
				level: 1,
				prompt: "Present performance comparison against peers.",
			},
			{
				title: "Gap Analysis",
				level: 1,
				prompt: "Identify performance gaps versus best-in-class.",
			},
			{
				title: "Best Practices",
				level: 1,
				prompt: "Document best practices observed.",
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide recommendations to improve performance.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Subject Area", variableName: "{{area}}", description: "Benchmarking area", type: "text", required: true },
			{ id: "p2", name: "Organization", variableName: "{{organization}}", description: "Organization", type: "text", required: true },
		],
	},
	{
		name: "Process Improvement Report",
		description: "Process improvement report with analysis and recommendations.",
		categoryIds: ["consultancy", "operations"],
		tags: ["process", "improvement", "optimization", "efficiency", "lean"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize improvement opportunities and expected benefits.",
			},
			{
				title: "Process Scope",
				level: 1,
				prompt: "Define the process being analyzed.",
			},
			{
				title: "Current State Mapping",
				level: 1,
				prompt: "Document current process flow and metrics.",
			},
			{
				title: "Pain Point Analysis",
				level: 1,
				prompt: "Identify inefficiencies, waste, and bottlenecks.",
			},
			{
				title: "Future State Design",
				level: 1,
				prompt: "Design the improved process with expected improvements.",
			},
			{
				title: "Implementation Plan",
				level: 1,
				prompt: "Outline steps to implement process changes.",
			},
			{
				title: "Metrics and Monitoring",
				level: 1,
				prompt: "Define metrics to measure improvement.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Process Name", variableName: "{{process_name}}", description: "Process name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client", type: "text", required: true },
		],
	},
	{
		name: "Technology Assessment",
		description: "Technology assessment evaluating solutions and making recommendations.",
		categoryIds: ["consultancy", "technology"],
		tags: ["technology", "assessment", "evaluation", "selection", "recommendation"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize technology assessment and recommendation.",
			},
			{
				title: "Business Requirements",
				level: 1,
				prompt: "Document business requirements driving technology need.",
			},
			{
				title: "Current State",
				level: 1,
				prompt: "Assess current technology landscape and gaps.",
			},
			{
				title: "Solution Options",
				level: 1,
				prompt: "Describe technology options evaluated.",
			},
			{
				title: "Evaluation Criteria",
				level: 1,
				prompt: "Define evaluation criteria and weighting.",
			},
			{
				title: "Comparative Analysis",
				level: 1,
				prompt: "Compare solutions against evaluation criteria.",
			},
			{
				title: "Total Cost of Ownership",
				level: 1,
				prompt: "Calculate TCO for leading options.",
			},
			{
				title: "Recommendation",
				level: 1,
				prompt: "Provide recommended solution with justification.",
			},
			{
				title: "Implementation Considerations",
				level: 1,
				prompt: "Outline implementation approach and considerations.",
			},
		],
		placeholders: [
			{ id: "p1", name: "Technology Area", variableName: "{{tech_area}}", description: "Technology area", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client", type: "text", required: true },
		],
	},
];

// ============================================================================
// GOVERNANCE & COMPLIANCE TEMPLATES
// ============================================================================

export const GOVERNANCE_COMPLIANCE_TEMPLATES: TemplateDef[] = [
	{
		name: "IT Governance Framework",
		description: "IT governance framework document defining policies, structures, and processes for IT decision-making.",
		categoryIds: ["governance", "it"],
		tags: ["governance", "cobit", "itil", "framework", "compliance"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Governance Overview",
				level: 1,
				prompt: "Establish the IT governance framework foundation and strategic alignment.",
				subsections: [
					{ title: "Purpose and Objectives", level: 2, prompt: "Define the purpose of IT governance and alignment with organizational strategy and risk appetite." },
					{ title: "Governance Principles", level: 2, prompt: "Establish guiding principles: value delivery, risk management, resource optimization, and performance measurement." },
					{ title: "Regulatory Context", level: 2, prompt: "Identify applicable regulations (SOX, GDPR, HIPAA) and industry standards (COBIT, ITIL, ISO 27001)." },
				],
			},
			{
				title: "Governance Structure",
				level: 1,
				prompt: "Define the organizational structure for IT governance.",
				subsections: [
					{ title: "Governance Bodies", level: 2, prompt: "Define IT steering committee, architecture review board, and other governance bodies with charters." },
					{ title: "Roles and Responsibilities", level: 2, prompt: "Define roles: CIO, IT Directors, Business Relationship Managers, and their governance responsibilities." },
					{ title: "Decision Rights Matrix", level: 2, prompt: "Create RACI matrix for IT decisions: strategy, architecture, investment, operations." },
				],
			},
			{
				title: "Governance Processes",
				level: 1,
				prompt: "Define key governance processes and procedures.",
				subsections: [
					{ title: "Portfolio Management", level: 2, prompt: "Define IT portfolio management including project prioritization, investment decisions, and benefits realization." },
					{ title: "Architecture Governance", level: 2, prompt: "Establish enterprise architecture governance including standards, exceptions, and compliance review." },
					{ title: "Risk and Compliance", level: 2, prompt: "Define IT risk management processes and compliance monitoring procedures." },
					{ title: "Vendor Governance", level: 2, prompt: "Establish vendor management and third-party risk governance processes." },
				],
			},
			{
				title: "Performance Management",
				level: 1,
				prompt: "Define IT performance measurement and reporting.",
				subsections: [
					{ title: "Key Performance Indicators", level: 2, prompt: "Define IT KPIs aligned with business objectives covering service delivery, financial, and risk metrics." },
					{ title: "Reporting Framework", level: 2, prompt: "Establish reporting cadence, dashboards, and executive reporting formats." },
					{ title: "Continuous Improvement", level: 2, prompt: "Define mechanisms for governance framework assessment and improvement." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CIO Name", variableName: "{{cio_name}}", description: "CIO name", type: "text", required: false },
		],
	},
	{
		name: "Data Governance Policy",
		description: "Data governance policy establishing data management principles, roles, and procedures.",
		categoryIds: ["governance", "data"],
		tags: ["data-governance", "policy", "data-quality", "data-management", "stewardship"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Policy Overview",
				level: 1,
				prompt: "Establish the data governance policy foundation.",
				subsections: [
					{ title: "Purpose and Scope", level: 2, prompt: "Define the purpose of data governance and scope covering all data assets across the organization." },
					{ title: "Data Governance Principles", level: 2, prompt: "Establish principles: data as an asset, accountability, quality, security, and compliance." },
					{ title: "Regulatory Requirements", level: 2, prompt: "Identify data-related regulations (GDPR, CCPA, industry-specific) and their requirements." },
				],
			},
			{
				title: "Data Governance Organization",
				level: 1,
				prompt: "Define the data governance organizational structure.",
				subsections: [
					{ title: "Data Governance Council", level: 2, prompt: "Define the council charter, membership, meeting cadence, and decision-making authority." },
					{ title: "Data Stewardship", level: 2, prompt: "Define data steward roles, responsibilities, and stewardship network structure." },
					{ title: "Data Ownership", level: 2, prompt: "Establish data ownership model: business data owners, technical custodians, and their responsibilities." },
				],
			},
			{
				title: "Data Management Policies",
				level: 1,
				prompt: "Define policies for key data management domains.",
				subsections: [
					{ title: "Data Quality Policy", level: 2, prompt: "Establish data quality dimensions, standards, measurement, and remediation procedures." },
					{ title: "Metadata Management", level: 2, prompt: "Define metadata standards, business glossary, data catalog, and lineage requirements." },
					{ title: "Data Security and Privacy", level: 2, prompt: "Establish data classification, access control, encryption, and privacy requirements." },
					{ title: "Data Lifecycle Management", level: 2, prompt: "Define data retention, archival, and disposal policies aligned with regulatory requirements." },
				],
			},
			{
				title: "Compliance and Enforcement",
				level: 1,
				prompt: "Define compliance monitoring and enforcement mechanisms.",
				subsections: [
					{ title: "Compliance Monitoring", level: 2, prompt: "Establish procedures for monitoring compliance with data governance policies." },
					{ title: "Exception Management", level: 2, prompt: "Define process for requesting, approving, and tracking policy exceptions." },
					{ title: "Enforcement and Remediation", level: 2, prompt: "Define consequences for policy violations and remediation procedures." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CDO Name", variableName: "{{cdo_name}}", description: "Chief Data Officer", type: "text", required: false },
		],
	},
	{
		name: "Security Policy Document",
		description: "Comprehensive information security policy covering all security domains.",
		categoryIds: ["security", "compliance"],
		tags: ["security", "policy", "iso27001", "nist", "cybersecurity"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Security Policy Overview",
				level: 1,
				prompt: "Establish the information security policy foundation.",
				subsections: [
					{ title: "Purpose and Scope", level: 2, prompt: "Define the purpose of information security and scope covering all information assets." },
					{ title: "Security Objectives", level: 2, prompt: "State security objectives: confidentiality, integrity, availability, and compliance." },
					{ title: "Governance and Accountability", level: 2, prompt: "Define security governance structure, CISO role, and accountability framework." },
				],
			},
			{
				title: "Access Control Policy",
				level: 1,
				prompt: "Define access control requirements and procedures.",
				subsections: [
					{ title: "Access Control Principles", level: 2, prompt: "Establish principles: least privilege, separation of duties, need-to-know basis." },
					{ title: "User Access Management", level: 2, prompt: "Define user provisioning, authentication requirements (MFA), and access review procedures." },
					{ title: "Privileged Access Management", level: 2, prompt: "Establish controls for privileged accounts: approval, monitoring, and session recording." },
				],
			},
			{
				title: "Data Protection Policy",
				level: 1,
				prompt: "Define data protection requirements.",
				subsections: [
					{ title: "Data Classification", level: 2, prompt: "Define classification levels (public, internal, confidential, restricted) and handling requirements." },
					{ title: "Encryption Requirements", level: 2, prompt: "Establish encryption requirements for data at rest, in transit, and key management." },
					{ title: "Data Loss Prevention", level: 2, prompt: "Define DLP controls and monitoring for sensitive data exfiltration." },
				],
			},
			{
				title: "Security Operations",
				level: 1,
				prompt: "Define security operations and monitoring.",
				subsections: [
					{ title: "Security Monitoring", level: 2, prompt: "Establish security monitoring requirements: SIEM, log management, and alerting thresholds." },
					{ title: "Incident Response", level: 2, prompt: "Define incident response procedures: detection, containment, eradication, and recovery." },
					{ title: "Vulnerability Management", level: 2, prompt: "Establish vulnerability scanning, assessment, and remediation timelines by severity." },
				],
			},
			{
				title: "Compliance and Assurance",
				level: 1,
				prompt: "Define security compliance and assurance activities.",
				subsections: [
					{ title: "Security Awareness", level: 2, prompt: "Establish security awareness training requirements and phishing simulation programs." },
					{ title: "Security Assessments", level: 2, prompt: "Define penetration testing, security audits, and third-party assessment requirements." },
					{ title: "Compliance Monitoring", level: 2, prompt: "Establish continuous compliance monitoring and reporting mechanisms." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CISO Name", variableName: "{{ciso_name}}", description: "CISO name", type: "text", required: false },
		],
	},
	{
		name: "Privacy Impact Assessment",
		description: "Privacy impact assessment template for evaluating data processing activities.",
		categoryIds: ["privacy", "compliance"],
		tags: ["privacy", "pia", "dpia", "gdpr", "assessment"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Assessment Overview",
				level: 1,
				prompt: "Describe the processing activity being assessed.",
				subsections: [
					{ title: "Processing Description", level: 2, prompt: "Describe the data processing activity: purpose, scope, and context." },
					{ title: "Data Inventory", level: 2, prompt: "Identify personal data categories, data subjects, and data volumes involved." },
					{ title: "Legal Basis", level: 2, prompt: "Identify the legal basis for processing (consent, contract, legitimate interest, legal obligation)." },
				],
			},
			{
				title: "Necessity and Proportionality",
				level: 1,
				prompt: "Assess necessity and proportionality of processing.",
				subsections: [
					{ title: "Purpose Limitation", level: 2, prompt: "Assess whether processing is necessary for the specified purpose." },
					{ title: "Data Minimization", level: 2, prompt: "Evaluate whether data collected is adequate, relevant, and limited to what is necessary." },
					{ title: "Storage Limitation", level: 2, prompt: "Assess retention periods and justify storage duration." },
				],
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Identify and assess privacy risks.",
				subsections: [
					{ title: "Risk Identification", level: 2, prompt: "Identify risks to data subject rights and freedoms." },
					{ title: "Risk Evaluation", level: 2, prompt: "Evaluate likelihood and severity of identified risks." },
					{ title: "Risk Mitigation", level: 2, prompt: "Define measures to mitigate identified risks." },
				],
			},
			{
				title: "Compliance Assessment",
				level: 1,
				prompt: "Assess compliance with privacy requirements.",
				subsections: [
					{ title: "Data Subject Rights", level: 2, prompt: "Describe how data subject rights are facilitated (access, rectification, erasure, portability)." },
					{ title: "Security Measures", level: 2, prompt: "Document technical and organizational security measures." },
					{ title: "Third-Party Processing", level: 2, prompt: "Assess any third-party processing and data protection agreements." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project/initiative name", type: "text", required: true },
			{ id: "p2", name: "DPO", variableName: "{{dpo_name}}", description: "Data Protection Officer", type: "text", required: false },
		],
	},
	{
		name: "Regulatory Compliance Report",
		description: "Regulatory compliance assessment report documenting compliance status and gaps.",
		categoryIds: ["compliance", "governance"],
		tags: ["compliance", "regulatory", "assessment", "audit", "report"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize compliance status and key findings.",
				subsections: [
					{ title: "Overall Compliance Status", level: 2, prompt: "Provide overall compliance rating and summary of compliance posture." },
					{ title: "Critical Findings", level: 2, prompt: "Highlight critical compliance gaps requiring immediate attention." },
					{ title: "Key Recommendations", level: 2, prompt: "Summarize priority recommendations for achieving compliance." },
				],
			},
			{
				title: "Assessment Scope",
				level: 1,
				prompt: "Define the scope of the compliance assessment.",
				subsections: [
					{ title: "Regulatory Framework", level: 2, prompt: "Identify the regulations and standards assessed (SOX, GDPR, HIPAA, PCI-DSS, etc.)." },
					{ title: "Assessment Period", level: 2, prompt: "Define the assessment period and methodology used." },
					{ title: "Organizational Scope", level: 2, prompt: "Define business units, systems, and processes in scope." },
				],
			},
			{
				title: "Detailed Findings",
				level: 1,
				prompt: "Document detailed compliance findings by control area.",
				subsections: [
					{ title: "Control Assessment", level: 2, prompt: "Assess each control requirement with compliance status, evidence, and gaps." },
					{ title: "Gap Analysis", level: 2, prompt: "Detail compliance gaps with root causes and impact assessment." },
					{ title: "Exception Tracking", level: 2, prompt: "Document any approved exceptions with compensating controls." },
				],
			},
			{
				title: "Remediation Plan",
				level: 1,
				prompt: "Define the remediation plan for identified gaps.",
				subsections: [
					{ title: "Remediation Actions", level: 2, prompt: "Define specific actions to remediate each gap with ownership and timelines." },
					{ title: "Resource Requirements", level: 2, prompt: "Identify resources required for remediation activities." },
					{ title: "Progress Tracking", level: 2, prompt: "Define how remediation progress will be tracked and reported." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Assessment Date", variableName: "{{assessment_date}}", description: "Assessment date", type: "date", required: true },
		],
	},
	{
		name: "Vendor Risk Assessment",
		description: "Third-party vendor risk assessment for evaluating vendor security and compliance.",
		categoryIds: ["risk", "procurement"],
		tags: ["vendor", "risk-assessment", "third-party", "due-diligence", "security"],
		difficulty: "intermediate",
		estimatedTime: 180,
		sections: [
			{
				title: "Vendor Overview",
				level: 1,
				prompt: "Document vendor information and engagement scope.",
				subsections: [
					{ title: "Vendor Profile", level: 2, prompt: "Capture vendor details: company name, location, size, industry certifications." },
					{ title: "Engagement Scope", level: 2, prompt: "Describe the services provided and data/systems accessed by the vendor." },
					{ title: "Criticality Assessment", level: 2, prompt: "Assess vendor criticality based on service importance and data sensitivity." },
				],
			},
			{
				title: "Security Assessment",
				level: 1,
				prompt: "Evaluate vendor security controls.",
				subsections: [
					{ title: "Security Certifications", level: 2, prompt: "Review security certifications (SOC 2, ISO 27001, PCI-DSS) and audit reports." },
					{ title: "Technical Controls", level: 2, prompt: "Assess encryption, access controls, vulnerability management, and incident response." },
					{ title: "Data Protection", level: 2, prompt: "Evaluate data handling practices, retention, and privacy compliance." },
				],
			},
			{
				title: "Business Continuity",
				level: 1,
				prompt: "Assess vendor business continuity and resilience.",
				subsections: [
					{ title: "Continuity Capabilities", level: 2, prompt: "Review vendor BCP/DR plans, testing, and recovery capabilities." },
					{ title: "Financial Stability", level: 2, prompt: "Assess vendor financial health and business stability." },
				],
			},
			{
				title: "Risk Summary and Recommendations",
				level: 1,
				prompt: "Summarize risk assessment findings.",
				subsections: [
					{ title: "Risk Rating", level: 2, prompt: "Provide overall vendor risk rating with justification." },
					{ title: "Risk Mitigation", level: 2, prompt: "Define risk mitigation measures and contractual requirements." },
					{ title: "Monitoring Requirements", level: 2, prompt: "Define ongoing monitoring and reassessment frequency." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Vendor Name", variableName: "{{vendor_name}}", description: "Vendor name", type: "text", required: true },
			{ id: "p2", name: "Service", variableName: "{{service}}", description: "Service provided", type: "text", required: true },
		],
	},
	{
		name: "Internal Audit Report",
		description: "Internal audit report template following IIA standards.",
		categoryIds: ["audit", "compliance"],
		tags: ["audit", "internal-audit", "iia", "compliance", "controls"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Provide executive overview of audit results.",
				subsections: [
					{ title: "Audit Opinion", level: 2, prompt: "State the overall audit opinion on control effectiveness." },
					{ title: "Key Findings Summary", level: 2, prompt: "Summarize high-risk findings and their business impact." },
					{ title: "Management Response Summary", level: 2, prompt: "Summarize management's response and commitment to remediation." },
				],
			},
			{
				title: "Audit Scope and Approach",
				level: 1,
				prompt: "Document audit scope, objectives, and methodology.",
				subsections: [
					{ title: "Audit Objectives", level: 2, prompt: "State specific audit objectives and questions addressed." },
					{ title: "Scope Definition", level: 2, prompt: "Define processes, systems, and time periods in scope." },
					{ title: "Methodology", level: 2, prompt: "Describe audit approach: walkthroughs, testing, interviews, and sampling." },
				],
			},
			{
				title: "Detailed Findings",
				level: 1,
				prompt: "Document audit findings in detail.",
				subsections: [
					{ title: "Finding Details", level: 2, prompt: "For each finding: condition, criteria, cause, effect, and risk rating." },
					{ title: "Recommendations", level: 2, prompt: "Provide specific, actionable recommendations for each finding." },
					{ title: "Management Response", level: 2, prompt: "Document management's response and action plans with target dates." },
				],
			},
			{
				title: "Appendices",
				level: 1,
				prompt: "Include supporting information.",
				subsections: [
					{ title: "Testing Results", level: 2, prompt: "Include detailed testing results and sample selections." },
					{ title: "Risk Rating Definitions", level: 2, prompt: "Define risk rating criteria used in the audit." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Audit Title", variableName: "{{audit_title}}", description: "Audit title", type: "text", required: true },
			{ id: "p2", name: "Audit Period", variableName: "{{audit_period}}", description: "Audit period", type: "text", required: true },
		],
	},
	{
		name: "Enterprise Risk Management Report",
		description: "Enterprise risk management report documenting organizational risk profile.",
		categoryIds: ["risk", "governance"],
		tags: ["erm", "risk-management", "coso", "enterprise", "governance"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "ERM Overview",
				level: 1,
				prompt: "Provide ERM program overview and organizational context.",
				subsections: [
					{ title: "Risk Management Framework", level: 2, prompt: "Describe the ERM framework (COSO, ISO 31000) and governance structure." },
					{ title: "Risk Appetite Statement", level: 2, prompt: "State the organization's risk appetite and tolerance levels by category." },
					{ title: "Risk Culture Assessment", level: 2, prompt: "Assess organizational risk culture and awareness." },
				],
			},
			{
				title: "Risk Identification",
				level: 1,
				prompt: "Document identified enterprise risks.",
				subsections: [
					{ title: "Strategic Risks", level: 2, prompt: "Identify strategic risks: market, competitive, regulatory, and reputational." },
					{ title: "Operational Risks", level: 2, prompt: "Identify operational risks: process, technology, people, and external events." },
					{ title: "Financial Risks", level: 2, prompt: "Identify financial risks: market, credit, liquidity, and currency." },
					{ title: "Compliance Risks", level: 2, prompt: "Identify compliance and legal risks across jurisdictions." },
				],
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Assess and prioritize enterprise risks.",
				subsections: [
					{ title: "Risk Evaluation", level: 2, prompt: "Evaluate inherent risk (likelihood x impact) for each identified risk." },
					{ title: "Control Assessment", level: 2, prompt: "Assess effectiveness of existing controls and calculate residual risk." },
					{ title: "Risk Prioritization", level: 2, prompt: "Prioritize risks using heat map or risk matrix and identify top risks." },
				],
			},
			{
				title: "Risk Response",
				level: 1,
				prompt: "Document risk response strategies.",
				subsections: [
					{ title: "Response Strategies", level: 2, prompt: "Define response strategy for each significant risk: avoid, reduce, share, accept." },
					{ title: "Action Plans", level: 2, prompt: "Document specific actions, owners, timelines, and resources for risk mitigation." },
					{ title: "Key Risk Indicators", level: 2, prompt: "Define KRIs for monitoring risk levels and triggering response actions." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CRO Name", variableName: "{{cro_name}}", description: "Chief Risk Officer", type: "text", required: false },
		],
	},
];

// ============================================================================
// STRATEGIC PLANNING TEMPLATES
// ============================================================================

export const STRATEGIC_PLANNING_TEMPLATES: TemplateDef[] = [
	{
		name: "Digital Transformation Strategy",
		description: "Digital transformation strategy document defining vision, roadmap, and initiatives.",
		categoryIds: ["strategy", "digital"],
		tags: ["digital-transformation", "strategy", "innovation", "technology", "roadmap"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Transformation Vision",
				level: 1,
				prompt: "Establish the digital transformation vision and strategic context.",
				subsections: [
					{ title: "Vision Statement", level: 2, prompt: "Articulate the digital transformation vision aligned with business strategy." },
					{ title: "Strategic Drivers", level: 2, prompt: "Identify drivers: market disruption, customer expectations, competitive pressure, operational efficiency." },
					{ title: "Current State Assessment", level: 2, prompt: "Assess current digital maturity across dimensions: customer, operations, workforce, technology." },
				],
			},
			{
				title: "Transformation Strategy",
				level: 1,
				prompt: "Define the digital transformation strategic approach.",
				subsections: [
					{ title: "Strategic Pillars", level: 2, prompt: "Define transformation pillars: customer experience, operational excellence, business model innovation, workforce enablement." },
					{ title: "Target Operating Model", level: 2, prompt: "Describe the target digital operating model including organizational and process changes." },
					{ title: "Technology Architecture", level: 2, prompt: "Define target technology architecture: cloud, data platforms, integration, and emerging technologies." },
				],
			},
			{
				title: "Transformation Roadmap",
				level: 1,
				prompt: "Develop the multi-year transformation roadmap.",
				subsections: [
					{ title: "Initiative Portfolio", level: 2, prompt: "Define transformation initiatives with scope, benefits, and interdependencies." },
					{ title: "Phasing and Prioritization", level: 2, prompt: "Phase initiatives into waves based on value, dependencies, and organizational readiness." },
					{ title: "Milestone Timeline", level: 2, prompt: "Create timeline with major milestones, quick wins, and transformation horizons." },
				],
			},
			{
				title: "Execution Framework",
				level: 1,
				prompt: "Define the execution and governance framework.",
				subsections: [
					{ title: "Governance Model", level: 2, prompt: "Establish transformation governance: steering committee, PMO, decision rights." },
					{ title: "Change Management", level: 2, prompt: "Define change management approach: communication, training, adoption, and resistance management." },
					{ title: "Investment and Benefits", level: 2, prompt: "Detail investment requirements and expected benefits with measurement approach." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CDO Name", variableName: "{{cdo_name}}", description: "Chief Digital Officer", type: "text", required: false },
		],
	},
	{
		name: "Market Entry Strategy",
		description: "Market entry strategy for expanding into new markets or geographies.",
		categoryIds: ["strategy", "business"],
		tags: ["market-entry", "expansion", "strategy", "international", "growth"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Market Analysis",
				level: 1,
				prompt: "Analyze the target market opportunity.",
				subsections: [
					{ title: "Market Overview", level: 2, prompt: "Describe target market: size, growth rate, segmentation, and trends." },
					{ title: "Competitive Landscape", level: 2, prompt: "Analyze competitors: market share, positioning, strengths, and weaknesses." },
					{ title: "Customer Analysis", level: 2, prompt: "Profile target customers: needs, preferences, buying behavior, and decision criteria." },
					{ title: "Regulatory Environment", level: 2, prompt: "Assess regulatory requirements, barriers to entry, and compliance needs." },
				],
			},
			{
				title: "Entry Strategy",
				level: 1,
				prompt: "Define the market entry approach.",
				subsections: [
					{ title: "Entry Mode Selection", level: 2, prompt: "Evaluate entry modes (export, licensing, JV, acquisition, greenfield) and select optimal approach." },
					{ title: "Value Proposition", level: 2, prompt: "Define the value proposition and differentiation for the target market." },
					{ title: "Go-to-Market Strategy", level: 2, prompt: "Develop GTM strategy: channels, pricing, promotion, and sales approach." },
				],
			},
			{
				title: "Operational Plan",
				level: 1,
				prompt: "Define operational requirements for market entry.",
				subsections: [
					{ title: "Organizational Structure", level: 2, prompt: "Define organizational structure and staffing requirements for the new market." },
					{ title: "Infrastructure Requirements", level: 2, prompt: "Identify infrastructure needs: facilities, technology, supply chain." },
					{ title: "Partner Strategy", level: 2, prompt: "Define partner strategy: distributors, agents, strategic alliances." },
				],
			},
			{
				title: "Financial Plan",
				level: 1,
				prompt: "Develop financial projections and investment requirements.",
				subsections: [
					{ title: "Investment Requirements", level: 2, prompt: "Detail investment requirements by category and phase." },
					{ title: "Financial Projections", level: 2, prompt: "Project revenue, costs, and profitability over 3-5 years." },
					{ title: "Risk Analysis", level: 2, prompt: "Identify key risks and develop mitigation strategies." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Target Market", variableName: "{{target_market}}", description: "Target market/geography", type: "text", required: true },
			{ id: "p2", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
		],
	},
	{
		name: "M&A Integration Plan",
		description: "Post-merger integration plan for successful acquisition integration.",
		categoryIds: ["strategy", "ma"],
		tags: ["mergers", "acquisitions", "integration", "pmi", "synergies"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Integration Overview",
				level: 1,
				prompt: "Establish integration vision and guiding principles.",
				subsections: [
					{ title: "Integration Vision", level: 2, prompt: "Articulate the integration vision and strategic rationale for the acquisition." },
					{ title: "Integration Principles", level: 2, prompt: "Define guiding principles: speed, value preservation, employee engagement, customer continuity." },
					{ title: "Synergy Targets", level: 2, prompt: "Define synergy targets: cost synergies, revenue synergies, and timeline for realization." },
				],
			},
			{
				title: "Integration Governance",
				level: 1,
				prompt: "Define integration governance and organization.",
				subsections: [
					{ title: "Governance Structure", level: 2, prompt: "Establish integration steering committee, IMO, and workstream structure." },
					{ title: "Decision-Making Framework", level: 2, prompt: "Define decision rights, escalation paths, and issue resolution process." },
					{ title: "Reporting and Tracking", level: 2, prompt: "Establish integration dashboards, KPIs, and reporting cadence." },
				],
			},
			{
				title: "Functional Integration Plans",
				level: 1,
				prompt: "Develop integration plans by functional area.",
				subsections: [
					{ title: "Operations Integration", level: 2, prompt: "Plan for integrating operations: supply chain, manufacturing, service delivery." },
					{ title: "Technology Integration", level: 2, prompt: "Plan for IT integration: systems consolidation, data migration, and infrastructure." },
					{ title: "People Integration", level: 2, prompt: "Plan for workforce integration: organization design, retention, culture alignment." },
					{ title: "Commercial Integration", level: 2, prompt: "Plan for commercial integration: sales, marketing, customer communication." },
				],
			},
			{
				title: "Day 1 Readiness",
				level: 1,
				prompt: "Plan for Day 1 and immediate post-close activities.",
				subsections: [
					{ title: "Day 1 Checklist", level: 2, prompt: "Define critical Day 1 activities: legal, communications, system access, compliance." },
					{ title: "First 100 Days Plan", level: 2, prompt: "Define priorities and milestones for the first 100 days post-close." },
					{ title: "Communication Plan", level: 2, prompt: "Develop communication plan for employees, customers, and stakeholders." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Acquirer", variableName: "{{acquirer}}", description: "Acquiring company", type: "text", required: true },
			{ id: "p2", name: "Target", variableName: "{{target}}", description: "Target company", type: "text", required: true },
		],
	},
	{
		name: "Innovation Strategy",
		description: "Innovation strategy defining approach to driving growth through innovation.",
		categoryIds: ["strategy", "innovation"],
		tags: ["innovation", "strategy", "r&d", "growth", "disruption"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Innovation Vision",
				level: 1,
				prompt: "Establish innovation vision and strategic context.",
				subsections: [
					{ title: "Innovation Imperative", level: 2, prompt: "Articulate why innovation is critical to achieving business strategy." },
					{ title: "Innovation Vision", level: 2, prompt: "Define the innovation vision: types of innovation (incremental, adjacent, transformational)." },
					{ title: "Current State Assessment", level: 2, prompt: "Assess current innovation capabilities, culture, and performance." },
				],
			},
			{
				title: "Innovation Framework",
				level: 1,
				prompt: "Define the innovation operating model.",
				subsections: [
					{ title: "Innovation Pillars", level: 2, prompt: "Define innovation focus areas: product, process, business model, customer experience." },
					{ title: "Innovation Portfolio", level: 2, prompt: "Establish portfolio approach balancing core, adjacent, and transformational innovation." },
					{ title: "Governance Model", level: 2, prompt: "Define innovation governance: funding decisions, stage gates, and metrics." },
				],
			},
			{
				title: "Innovation Enablers",
				level: 1,
				prompt: "Define enablers for innovation success.",
				subsections: [
					{ title: "Organization and Talent", level: 2, prompt: "Define organizational structure, roles, and talent strategy for innovation." },
					{ title: "Process and Methodology", level: 2, prompt: "Establish innovation processes: ideation, incubation, acceleration, scaling." },
					{ title: "Technology and Tools", level: 2, prompt: "Define enabling technologies: platforms, prototyping tools, collaboration systems." },
					{ title: "Culture and Incentives", level: 2, prompt: "Define cultural attributes and incentive mechanisms to drive innovation." },
				],
			},
			{
				title: "Innovation Roadmap",
				level: 1,
				prompt: "Develop the innovation execution roadmap.",
				subsections: [
					{ title: "Priority Initiatives", level: 2, prompt: "Identify priority innovation initiatives and pilot programs." },
					{ title: "Ecosystem Strategy", level: 2, prompt: "Define open innovation approach: partnerships, startups, academia, customers." },
					{ title: "Measurement Framework", level: 2, prompt: "Define innovation KPIs: input metrics, output metrics, and impact metrics." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CIO Name", variableName: "{{cio_name}}", description: "Chief Innovation Officer", type: "text", required: false },
		],
	},
	{
		name: "Organizational Restructuring Plan",
		description: "Organizational restructuring plan for major organizational change initiatives.",
		categoryIds: ["strategy", "hr"],
		tags: ["restructuring", "organization", "transformation", "change", "reorg"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Restructuring Rationale",
				level: 1,
				prompt: "Establish the case for organizational restructuring.",
				subsections: [
					{ title: "Strategic Context", level: 2, prompt: "Explain strategic drivers requiring organizational change." },
					{ title: "Current State Assessment", level: 2, prompt: "Assess current organization: structure, capabilities, pain points, and inefficiencies." },
					{ title: "Objectives", level: 2, prompt: "Define specific objectives: cost reduction, agility, capability building, customer focus." },
				],
			},
			{
				title: "Future Organization Design",
				level: 1,
				prompt: "Define the target organizational structure.",
				subsections: [
					{ title: "Design Principles", level: 2, prompt: "Establish design principles: spans, layers, decision rights, integration mechanisms." },
					{ title: "Organizational Structure", level: 2, prompt: "Present the target organizational structure with reporting relationships." },
					{ title: "Role Definitions", level: 2, prompt: "Define key roles, responsibilities, and competency requirements." },
				],
			},
			{
				title: "Transition Plan",
				level: 1,
				prompt: "Plan the transition to the new organization.",
				subsections: [
					{ title: "Transition Approach", level: 2, prompt: "Define transition approach: phasing, timing, and sequencing." },
					{ title: "People Transition", level: 2, prompt: "Plan for role mapping, selection processes, and workforce reductions if applicable." },
					{ title: "Risk Mitigation", level: 2, prompt: "Identify transition risks and mitigation strategies." },
				],
			},
			{
				title: "Implementation",
				level: 1,
				prompt: "Define implementation approach and support mechanisms.",
				subsections: [
					{ title: "Change Management", level: 2, prompt: "Define change management approach: leadership alignment, communication, engagement." },
					{ title: "Capability Building", level: 2, prompt: "Identify capability gaps and training/development programs." },
					{ title: "Performance Management", level: 2, prompt: "Define how success will be measured and performance managed." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Sponsor", variableName: "{{sponsor}}", description: "Executive sponsor", type: "text", required: true },
		],
	},
	{
		name: "Customer Experience Strategy",
		description: "Customer experience strategy defining approach to delivering exceptional CX.",
		categoryIds: ["strategy", "cx"],
		tags: ["customer-experience", "cx", "strategy", "journey", "engagement"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "CX Vision",
				level: 1,
				prompt: "Establish customer experience vision and strategic alignment.",
				subsections: [
					{ title: "CX Vision Statement", level: 2, prompt: "Articulate the customer experience vision and brand promise." },
					{ title: "Strategic Alignment", level: 2, prompt: "Connect CX strategy to business strategy and customer value proposition." },
					{ title: "Current State Assessment", level: 2, prompt: "Assess current CX performance: NPS, CSAT, journey friction, competitive position." },
				],
			},
			{
				title: "Customer Understanding",
				level: 1,
				prompt: "Build deep customer understanding.",
				subsections: [
					{ title: "Customer Segmentation", level: 2, prompt: "Define customer segments with needs, behaviors, and value profiles." },
					{ title: "Persona Development", level: 2, prompt: "Create detailed customer personas representing key segments." },
					{ title: "Journey Mapping", level: 2, prompt: "Map end-to-end customer journeys identifying moments that matter and pain points." },
				],
			},
			{
				title: "CX Design",
				level: 1,
				prompt: "Design target customer experiences.",
				subsections: [
					{ title: "Target Experience", level: 2, prompt: "Design target experiences for priority journeys and moments that matter." },
					{ title: "Channel Strategy", level: 2, prompt: "Define omnichannel strategy ensuring consistent experience across touchpoints." },
					{ title: "Personalization Strategy", level: 2, prompt: "Define personalization approach leveraging data and AI." },
				],
			},
			{
				title: "CX Enablement",
				level: 1,
				prompt: "Define enabling capabilities for CX excellence.",
				subsections: [
					{ title: "Technology Enablement", level: 2, prompt: "Identify technology investments: CRM, CDP, analytics, automation." },
					{ title: "Organization and Culture", level: 2, prompt: "Define organizational capabilities and customer-centric culture requirements." },
					{ title: "Metrics and Governance", level: 2, prompt: "Establish CX metrics, measurement approach, and governance model." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CCO Name", variableName: "{{cco_name}}", description: "Chief Customer Officer", type: "text", required: false },
		],
	},
	{
		name: "Technology Strategy",
		description: "Technology strategy aligning IT capabilities with business objectives.",
		categoryIds: ["strategy", "technology"],
		tags: ["technology", "it-strategy", "architecture", "digital", "roadmap"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Strategic Context",
				level: 1,
				prompt: "Establish the strategic context for technology.",
				subsections: [
					{ title: "Business Strategy Alignment", level: 2, prompt: "Connect technology strategy to business strategy and objectives." },
					{ title: "Technology Vision", level: 2, prompt: "Articulate the technology vision and strategic role of IT." },
					{ title: "Current State Assessment", level: 2, prompt: "Assess current technology landscape: strengths, gaps, technical debt." },
				],
			},
			{
				title: "Technology Architecture",
				level: 1,
				prompt: "Define target technology architecture.",
				subsections: [
					{ title: "Architecture Principles", level: 2, prompt: "Establish architecture principles: cloud-first, API-led, data-centric, security-by-design." },
					{ title: "Applications Architecture", level: 2, prompt: "Define target application portfolio and rationalization approach." },
					{ title: "Data Architecture", level: 2, prompt: "Define data architecture: platforms, integration, governance, analytics." },
					{ title: "Infrastructure Architecture", level: 2, prompt: "Define infrastructure strategy: cloud, hybrid, network, security." },
				],
			},
			{
				title: "Technology Capabilities",
				level: 1,
				prompt: "Define target technology capabilities.",
				subsections: [
					{ title: "Emerging Technologies", level: 2, prompt: "Assess emerging technologies (AI/ML, IoT, blockchain) and strategic applicability." },
					{ title: "Development Practices", level: 2, prompt: "Define target development practices: agile, DevOps, CI/CD, automation." },
					{ title: "Security and Risk", level: 2, prompt: "Define security architecture and cyber risk management approach." },
				],
			},
			{
				title: "Technology Roadmap",
				level: 1,
				prompt: "Develop technology investment roadmap.",
				subsections: [
					{ title: "Investment Portfolio", level: 2, prompt: "Define technology investments by category: run, grow, transform." },
					{ title: "Implementation Roadmap", level: 2, prompt: "Create multi-year roadmap with initiatives, dependencies, and milestones." },
					{ title: "Governance and Delivery", level: 2, prompt: "Define technology governance, delivery model, and success metrics." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CIO Name", variableName: "{{cio_name}}", description: "Chief Information Officer", type: "text", required: false },
		],
	},
	{
		name: "Sustainability Strategy",
		description: "Sustainability strategy addressing ESG commitments and environmental goals.",
		categoryIds: ["strategy", "sustainability"],
		tags: ["sustainability", "esg", "environment", "climate", "social-responsibility"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Sustainability Vision",
				level: 1,
				prompt: "Establish sustainability vision and strategic context.",
				subsections: [
					{ title: "Sustainability Commitment", level: 2, prompt: "Articulate organizational commitment to sustainability and ESG principles." },
					{ title: "Materiality Assessment", level: 2, prompt: "Identify material ESG issues based on stakeholder priorities and business impact." },
					{ title: "Current State Baseline", level: 2, prompt: "Establish baseline metrics: carbon footprint, resource usage, social impact." },
				],
			},
			{
				title: "Environmental Strategy",
				level: 1,
				prompt: "Define environmental sustainability approach.",
				subsections: [
					{ title: "Climate Commitments", level: 2, prompt: "Define climate commitments: net zero targets, science-based targets, renewable energy." },
					{ title: "Resource Efficiency", level: 2, prompt: "Address resource efficiency: waste reduction, water conservation, circular economy." },
					{ title: "Supply Chain Sustainability", level: 2, prompt: "Define approach to supply chain sustainability and Scope 3 emissions." },
				],
			},
			{
				title: "Social Strategy",
				level: 1,
				prompt: "Define social sustainability approach.",
				subsections: [
					{ title: "Workforce and Culture", level: 2, prompt: "Address diversity, equity, inclusion, employee wellbeing, and fair labor practices." },
					{ title: "Community Engagement", level: 2, prompt: "Define community investment, philanthropy, and stakeholder engagement approach." },
					{ title: "Human Rights", level: 2, prompt: "Address human rights commitments across operations and supply chain." },
				],
			},
			{
				title: "Governance and Reporting",
				level: 1,
				prompt: "Define sustainability governance and reporting.",
				subsections: [
					{ title: "Governance Structure", level: 2, prompt: "Define sustainability governance: board oversight, executive accountability, management roles." },
					{ title: "Targets and KPIs", level: 2, prompt: "Establish specific, measurable sustainability targets and KPIs." },
					{ title: "Reporting Framework", level: 2, prompt: "Define reporting approach: GRI, SASB, TCFD, CDP, and integrated reporting." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "CSO Name", variableName: "{{cso_name}}", description: "Chief Sustainability Officer", type: "text", required: false },
		],
	},
];

// ============================================================================
// LEGAL DOCUMENT TEMPLATES
// ============================================================================

export const LEGAL_TEMPLATES: TemplateDef[] = [
	// ==================== NDAs ====================
	{
		name: "Mutual Non-Disclosure Agreement (NDA)",
		description: "Bilateral confidentiality agreement protecting both parties' confidential information during business discussions.",
		categoryIds: ["legal", "contracts"],
		tags: ["nda", "confidentiality", "mutual", "bilateral", "legal"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Parties and Recitals",
				level: 1,
				prompt: "Identify the parties and establish the purpose of the confidentiality agreement.",
				subsections: [
					{ title: "Party Identification", level: 2, prompt: "Identify both disclosing and receiving parties with full legal names, addresses, and jurisdictions of incorporation." },
					{ title: "Purpose and Background", level: 2, prompt: "State the business purpose for which confidential information will be shared (e.g., potential business relationship, merger discussions, joint venture evaluation)." },
				],
			},
			{
				title: "Confidential Information Definition",
				level: 1,
				prompt: "Define what constitutes confidential information under the agreement.",
				subsections: [
					{ title: "Scope of Confidential Information", level: 2, prompt: "Define confidential information broadly: technical data, business plans, financial information, customer lists, trade secrets, proprietary processes, and all information marked confidential." },
					{ title: "Exclusions from Confidential Information", level: 2, prompt: "Define standard exclusions: publicly available information, independently developed information, information received from third parties without restriction, and information disclosed with prior written consent." },
					{ title: "Marking Requirements", level: 2, prompt: "Specify how confidential information must be marked (written: 'Confidential'; oral: confirmed in writing within specified days)." },
				],
			},
			{
				title: "Obligations of Receiving Party",
				level: 1,
				prompt: "Detail the obligations of parties receiving confidential information.",
				subsections: [
					{ title: "Non-Disclosure Obligations", level: 2, prompt: "Prohibit disclosure to third parties except as expressly permitted, require same degree of care as own confidential information (not less than reasonable care)." },
					{ title: "Permitted Use", level: 2, prompt: "Limit use of confidential information solely for the stated purpose; prohibit reverse engineering, copying, or derivative works." },
					{ title: "Authorized Recipients", level: 2, prompt: "Define who may receive confidential information (employees, contractors, advisors with need-to-know) and require binding confidentiality obligations for such recipients." },
				],
			},
			{
				title: "Compelled Disclosure",
				level: 1,
				prompt: "Address legally required disclosures.",
				subsections: [
					{ title: "Legal Process", level: 2, prompt: "Permit disclosure if required by law, regulation, or court order, subject to prompt notice to disclosing party and cooperation to seek protective order." },
					{ title: "Regulatory Requirements", level: 2, prompt: "Address disclosure to regulatory authorities while minimizing scope and seeking confidential treatment." },
				],
			},
			{
				title: "Term and Return of Information",
				level: 1,
				prompt: "Specify duration and information return requirements.",
				subsections: [
					{ title: "Agreement Term", level: 2, prompt: "Specify agreement duration (typically 2-5 years) and confidentiality survival period (obligations may survive termination for specified period)." },
					{ title: "Return or Destruction", level: 2, prompt: "Require return or certified destruction of confidential information upon termination or request, with exception for legally required retention and archived copies." },
				],
			},
			{
				title: "Remedies and General Provisions",
				level: 1,
				prompt: "Define remedies and standard legal provisions.",
				subsections: [
					{ title: "Remedies", level: 2, prompt: "Acknowledge that breach may cause irreparable harm entitling disclosing party to injunctive relief in addition to other remedies; specify no limitation on disclosing party's remedies." },
					{ title: "No License or Obligation", level: 2, prompt: "Clarify that no license to intellectual property is granted; no obligation to proceed with any transaction or relationship." },
					{ title: "Governing Law and Jurisdiction", level: 2, prompt: "Specify governing law, dispute resolution mechanism (courts/arbitration), and jurisdiction for enforcement." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "First Party", variableName: "{{party_a}}", description: "First party name", type: "text", required: true },
			{ id: "p2", name: "Second Party", variableName: "{{party_b}}", description: "Second party name", type: "text", required: true },
			{ id: "p3", name: "Effective Date", variableName: "{{effective_date}}", description: "Agreement effective date", type: "date", required: true },
			{ id: "p4", name: "Term (Years)", variableName: "{{term_years}}", description: "Agreement term in years", type: "number", required: true },
		],
	},
	{
		name: "Unilateral Non-Disclosure Agreement",
		description: "One-way confidentiality agreement where only one party discloses confidential information.",
		categoryIds: ["legal", "contracts"],
		tags: ["nda", "confidentiality", "unilateral", "one-way", "legal"],
		difficulty: "beginner",
		estimatedTime: 45,
		sections: [
			{
				title: "Parties and Purpose",
				level: 1,
				prompt: "Identify the disclosing party, receiving party, and purpose.",
				subsections: [
					{ title: "Party Identification", level: 2, prompt: "Identify the disclosing party and receiving party with full legal names and addresses." },
					{ title: "Purpose", level: 2, prompt: "State the specific purpose for which confidential information is being disclosed." },
				],
			},
			{
				title: "Confidential Information",
				level: 1,
				prompt: "Define confidential information and exclusions.",
				subsections: [
					{ title: "Definition", level: 2, prompt: "Define what constitutes confidential information of the disclosing party." },
					{ title: "Exclusions", level: 2, prompt: "List standard exclusions from confidentiality obligations." },
				],
			},
			{
				title: "Receiving Party Obligations",
				level: 1,
				prompt: "Detail obligations of the receiving party.",
				subsections: [
					{ title: "Non-Disclosure and Non-Use", level: 2, prompt: "Prohibit disclosure and limit use to stated purpose only." },
					{ title: "Protection Standards", level: 2, prompt: "Require reasonable measures to protect confidentiality." },
					{ title: "Permitted Disclosures", level: 2, prompt: "Define permitted recipients (employees, advisors) and their obligations." },
				],
			},
			{
				title: "Term and Termination",
				level: 1,
				prompt: "Specify duration and post-termination obligations.",
				subsections: [
					{ title: "Duration", level: 2, prompt: "Specify the term of the agreement and survival of obligations." },
					{ title: "Return of Materials", level: 2, prompt: "Require return or destruction of confidential materials upon termination." },
				],
			},
			{
				title: "General Provisions",
				level: 1,
				prompt: "Include standard legal provisions.",
				subsections: [
					{ title: "Remedies", level: 2, prompt: "Acknowledge availability of injunctive relief for breach." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law and jurisdiction." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Disclosing Party", variableName: "{{disclosing_party}}", description: "Party disclosing information", type: "text", required: true },
			{ id: "p2", name: "Receiving Party", variableName: "{{receiving_party}}", description: "Party receiving information", type: "text", required: true },
			{ id: "p3", name: "Purpose", variableName: "{{purpose}}", description: "Purpose of disclosure", type: "textarea", required: true },
		],
	},
	{
		name: "Employee Confidentiality Agreement",
		description: "Confidentiality and intellectual property assignment agreement for employees.",
		categoryIds: ["legal", "hr"],
		tags: ["nda", "employee", "confidentiality", "ip-assignment", "employment"],
		difficulty: "intermediate",
		estimatedTime: 75,
		sections: [
			{
				title: "Employment Context",
				level: 1,
				prompt: "Establish the employment relationship and agreement context.",
				subsections: [
					{ title: "Parties and Recitals", level: 2, prompt: "Identify employer and employee; acknowledge employment relationship and access to confidential information." },
					{ title: "Consideration", level: 2, prompt: "State the consideration: employment, continued employment, access to confidential information, and/or additional compensation." },
				],
			},
			{
				title: "Confidential Information",
				level: 1,
				prompt: "Define employer's confidential information comprehensively.",
				subsections: [
					{ title: "Definition", level: 2, prompt: "Define confidential information: trade secrets, business plans, customer lists, pricing, technical data, software, processes, and all non-public information." },
					{ title: "Third-Party Information", level: 2, prompt: "Address confidential information received from third parties under obligation of confidentiality." },
				],
			},
			{
				title: "Employee Obligations",
				level: 1,
				prompt: "Detail employee's confidentiality and related obligations.",
				subsections: [
					{ title: "Non-Disclosure", level: 2, prompt: "Prohibit disclosure of confidential information during and after employment." },
					{ title: "Non-Use", level: 2, prompt: "Limit use of confidential information solely for employer's benefit in course of employment." },
					{ title: "Protection Measures", level: 2, prompt: "Require employee to take reasonable measures to prevent unauthorized disclosure." },
				],
			},
			{
				title: "Intellectual Property Assignment",
				level: 1,
				prompt: "Address ownership and assignment of intellectual property.",
				subsections: [
					{ title: "Work Product Assignment", level: 2, prompt: "Assign all inventions, works, and IP created during employment and related to employer's business to employer." },
					{ title: "Prior Inventions", level: 2, prompt: "Require disclosure of prior inventions and exclude them from assignment obligations." },
					{ title: "Moral Rights Waiver", level: 2, prompt: "Include waiver of moral rights to the extent permitted by law." },
					{ title: "Cooperation", level: 2, prompt: "Require employee cooperation in securing IP rights (patent applications, registrations)." },
				],
			},
			{
				title: "Post-Employment Obligations",
				level: 1,
				prompt: "Address obligations continuing after employment ends.",
				subsections: [
					{ title: "Return of Materials", level: 2, prompt: "Require return of all confidential information and company property upon termination." },
					{ title: "Survival of Obligations", level: 2, prompt: "Specify that confidentiality and IP assignment obligations survive termination indefinitely." },
					{ title: "Exit Certification", level: 2, prompt: "Require certification of compliance with return and non-retention obligations." },
				],
			},
			{
				title: "General Provisions",
				level: 1,
				prompt: "Include standard employment agreement provisions.",
				subsections: [
					{ title: "Remedies", level: 2, prompt: "Acknowledge irreparable harm and availability of injunctive relief." },
					{ title: "Severability", level: 2, prompt: "Include severability clause for enforceability of remaining provisions." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law and jurisdiction." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Employer", variableName: "{{employer}}", description: "Employer name", type: "text", required: true },
			{ id: "p2", name: "Employee Name", variableName: "{{employee_name}}", description: "Employee full name", type: "text", required: true },
			{ id: "p3", name: "Position", variableName: "{{position}}", description: "Employee position/title", type: "text", required: true },
		],
	},

	// ==================== MoUs ====================
	{
		name: "Memorandum of Understanding (General)",
		description: "Non-binding framework agreement establishing understanding between parties for potential collaboration.",
		categoryIds: ["legal", "business"],
		tags: ["mou", "memorandum", "understanding", "framework", "preliminary"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Parties and Background",
				level: 1,
				prompt: "Identify parties and establish context for the MoU.",
				subsections: [
					{ title: "Party Identification", level: 2, prompt: "Identify all parties with full legal names, principal places of business, and brief descriptions of their activities." },
					{ title: "Background and Recitals", level: 2, prompt: "Describe the background leading to this MoU: previous discussions, shared interests, and the opportunity being explored." },
					{ title: "Purpose Statement", level: 2, prompt: "Clearly state the purpose of the MoU and the nature of the proposed collaboration or relationship." },
				],
			},
			{
				title: "Scope of Understanding",
				level: 1,
				prompt: "Define the scope and nature of the proposed relationship.",
				subsections: [
					{ title: "Areas of Collaboration", level: 2, prompt: "Describe specific areas or projects where parties intend to collaborate." },
					{ title: "Respective Roles", level: 2, prompt: "Outline the expected roles and contributions of each party." },
					{ title: "Expected Outcomes", level: 2, prompt: "Identify desired outcomes and mutual benefits of the collaboration." },
				],
			},
			{
				title: "Preliminary Commitments",
				level: 1,
				prompt: "Outline preliminary commitments and next steps.",
				subsections: [
					{ title: "Good Faith Negotiations", level: 2, prompt: "Commit to negotiate in good faith toward definitive agreements." },
					{ title: "Due Diligence", level: 2, prompt: "Outline any due diligence activities to be undertaken." },
					{ title: "Resource Commitments", level: 2, prompt: "Identify any preliminary resource commitments (personnel, funding for feasibility studies)." },
					{ title: "Timeline and Milestones", level: 2, prompt: "Establish timeline for next steps and key milestones." },
				],
			},
			{
				title: "Confidentiality",
				level: 1,
				prompt: "Address confidentiality of discussions and information shared.",
				subsections: [
					{ title: "Confidential Information", level: 2, prompt: "Define what information shared under the MoU is confidential." },
					{ title: "Non-Disclosure Obligations", level: 2, prompt: "Establish binding confidentiality obligations for information shared." },
					{ title: "Public Announcements", level: 2, prompt: "Require mutual consent for any public announcements about the MoU or discussions." },
				],
			},
			{
				title: "Legal Status and General Terms",
				level: 1,
				prompt: "Clarify legal status and include general provisions.",
				subsections: [
					{ title: "Non-Binding Nature", level: 2, prompt: "Clearly state which provisions are non-binding (collaboration terms) and which are binding (confidentiality, exclusivity if any, governing law)." },
					{ title: "Exclusivity", level: 2, prompt: "Address whether parties agree to exclusivity during the MoU period." },
					{ title: "Term and Termination", level: 2, prompt: "Specify MoU duration and termination provisions." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law for binding provisions." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "First Party", variableName: "{{party_a}}", description: "First party name", type: "text", required: true },
			{ id: "p2", name: "Second Party", variableName: "{{party_b}}", description: "Second party name", type: "text", required: true },
			{ id: "p3", name: "Collaboration Area", variableName: "{{collaboration_area}}", description: "Area of collaboration", type: "text", required: true },
		],
	},
	{
		name: "Joint Venture Memorandum of Understanding",
		description: "MoU establishing framework for exploring a joint venture between parties.",
		categoryIds: ["legal", "business", "ma"],
		tags: ["mou", "joint-venture", "jv", "partnership", "collaboration"],
		difficulty: "advanced",
		estimatedTime: 120,
		sections: [
			{
				title: "Parties and Joint Venture Concept",
				level: 1,
				prompt: "Identify parties and describe the proposed joint venture.",
				subsections: [
					{ title: "Party Identification", level: 2, prompt: "Identify JV parties with company details, ownership, and relevant capabilities." },
					{ title: "JV Concept", level: 2, prompt: "Describe the proposed joint venture: business purpose, market opportunity, and strategic rationale." },
					{ title: "JV Structure", level: 2, prompt: "Outline proposed JV structure: new entity, contractual JV, or other arrangement." },
				],
			},
			{
				title: "Proposed Contributions",
				level: 1,
				prompt: "Outline expected contributions from each party.",
				subsections: [
					{ title: "Capital Contributions", level: 2, prompt: "Describe proposed capital contributions and ownership percentages." },
					{ title: "Non-Cash Contributions", level: 2, prompt: "Detail non-cash contributions: IP, technology, facilities, contracts, personnel." },
					{ title: "Ongoing Commitments", level: 2, prompt: "Outline ongoing commitments: management services, technical support, market access." },
				],
			},
			{
				title: "Governance Framework",
				level: 1,
				prompt: "Describe proposed JV governance.",
				subsections: [
					{ title: "Board Composition", level: 2, prompt: "Propose board of directors composition and appointment rights." },
					{ title: "Management Structure", level: 2, prompt: "Outline management structure and key executive appointments." },
					{ title: "Decision-Making", level: 2, prompt: "Define decision-making framework: reserved matters, voting thresholds, deadlock resolution." },
				],
			},
			{
				title: "Commercial Terms",
				level: 1,
				prompt: "Outline key commercial terms for the JV.",
				subsections: [
					{ title: "Business Plan", level: 2, prompt: "Summarize expected JV business plan and financial projections." },
					{ title: "Profit Distribution", level: 2, prompt: "Propose profit distribution mechanism and dividend policy." },
					{ title: "Funding Requirements", level: 2, prompt: "Address future funding requirements and additional capital call mechanisms." },
				],
			},
			{
				title: "Next Steps and Binding Provisions",
				level: 1,
				prompt: "Define path to definitive agreements and binding terms.",
				subsections: [
					{ title: "Due Diligence", level: 2, prompt: "Outline due diligence process and information exchange requirements." },
					{ title: "Definitive Agreements", level: 2, prompt: "Identify definitive agreements to be negotiated (JV Agreement, Shareholders Agreement, IP License)." },
					{ title: "Exclusivity and Confidentiality", level: 2, prompt: "Establish binding exclusivity period and confidentiality obligations." },
					{ title: "Term and Termination", level: 2, prompt: "Specify MoU term and termination rights." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "First JV Partner", variableName: "{{partner_a}}", description: "First JV partner", type: "text", required: true },
			{ id: "p2", name: "Second JV Partner", variableName: "{{partner_b}}", description: "Second JV partner", type: "text", required: true },
			{ id: "p3", name: "JV Name", variableName: "{{jv_name}}", description: "Proposed JV name", type: "text", required: false },
		],
	},

	// ==================== Partnership Agreements ====================
	{
		name: "General Partnership Agreement",
		description: "Comprehensive partnership agreement for general partnerships establishing rights, obligations, and governance.",
		categoryIds: ["legal", "business"],
		tags: ["partnership", "general-partnership", "business-entity", "formation", "governance"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Partnership Formation",
				level: 1,
				prompt: "Establish the partnership formation and basic terms.",
				subsections: [
					{ title: "Partnership Name and Purpose", level: 2, prompt: "State partnership name, principal place of business, and business purpose." },
					{ title: "Partner Identification", level: 2, prompt: "Identify all partners with contact information and initial capital contributions." },
					{ title: "Term of Partnership", level: 2, prompt: "Specify whether partnership is for a fixed term or at-will, and commencement date." },
				],
			},
			{
				title: "Capital and Contributions",
				level: 1,
				prompt: "Define capital contributions and accounts.",
				subsections: [
					{ title: "Initial Contributions", level: 2, prompt: "Document initial capital contributions (cash, property, services) and valuation." },
					{ title: "Capital Accounts", level: 2, prompt: "Establish capital account maintenance rules and adjustments." },
					{ title: "Additional Contributions", level: 2, prompt: "Address requirements and procedures for additional capital contributions." },
					{ title: "Interest on Capital", level: 2, prompt: "Specify whether and how interest is paid on capital contributions." },
				],
			},
			{
				title: "Profits, Losses, and Distributions",
				level: 1,
				prompt: "Define allocation of profits, losses, and distributions.",
				subsections: [
					{ title: "Profit and Loss Allocation", level: 2, prompt: "Specify how profits and losses are allocated among partners (percentage, capital-based, or hybrid)." },
					{ title: "Distribution Policy", level: 2, prompt: "Establish distribution timing, frequency, and priority." },
					{ title: "Draws and Salaries", level: 2, prompt: "Address partner draws, guaranteed payments, and salaries for services." },
				],
			},
			{
				title: "Management and Authority",
				level: 1,
				prompt: "Define partnership management and decision-making.",
				subsections: [
					{ title: "Management Rights", level: 2, prompt: "Establish management structure: all partners participate or managing partner designation." },
					{ title: "Voting and Decisions", level: 2, prompt: "Specify voting rights and requirements for ordinary vs. major decisions." },
					{ title: "Authority to Bind", level: 2, prompt: "Define authority of partners to bind the partnership and limitations thereon." },
					{ title: "Meetings", level: 2, prompt: "Establish requirements for partner meetings, notice, and quorum." },
				],
			},
			{
				title: "Partner Duties and Restrictions",
				level: 1,
				prompt: "Define partner duties and competitive restrictions.",
				subsections: [
					{ title: "Fiduciary Duties", level: 2, prompt: "Establish duties of loyalty, care, and good faith among partners." },
					{ title: "Non-Compete", level: 2, prompt: "Address restrictions on partners engaging in competing businesses." },
					{ title: "Time and Attention", level: 2, prompt: "Specify time commitment expectations and outside activities." },
				],
			},
			{
				title: "Transfer of Partnership Interests",
				level: 1,
				prompt: "Address transfer and assignment of partnership interests.",
				subsections: [
					{ title: "Transfer Restrictions", level: 2, prompt: "Establish restrictions on transfer of partnership interests." },
					{ title: "Right of First Refusal", level: 2, prompt: "Define ROFR process for proposed transfers." },
					{ title: "Admission of New Partners", level: 2, prompt: "Specify process and requirements for admitting new partners." },
				],
			},
			{
				title: "Withdrawal, Dissolution, and Winding Up",
				level: 1,
				prompt: "Address partner withdrawal and partnership dissolution.",
				subsections: [
					{ title: "Voluntary Withdrawal", level: 2, prompt: "Define rights and process for partner voluntary withdrawal." },
					{ title: "Involuntary Withdrawal", level: 2, prompt: "Address events triggering involuntary withdrawal (death, disability, bankruptcy, expulsion)." },
					{ title: "Buyout Terms", level: 2, prompt: "Establish valuation methodology and payment terms for withdrawing partner's interest." },
					{ title: "Dissolution Events", level: 2, prompt: "Identify events causing partnership dissolution." },
					{ title: "Winding Up Procedures", level: 2, prompt: "Define winding up procedures and distribution of assets." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Partnership Name", variableName: "{{partnership_name}}", description: "Partnership name", type: "text", required: true },
			{ id: "p2", name: "Partners", variableName: "{{partners}}", description: "Partner names (comma-separated)", type: "textarea", required: true },
			{ id: "p3", name: "Business Purpose", variableName: "{{business_purpose}}", description: "Business purpose", type: "textarea", required: true },
		],
	},
	{
		name: "Strategic Partnership Agreement",
		description: "Agreement establishing a strategic business partnership between companies.",
		categoryIds: ["legal", "business", "strategy"],
		tags: ["partnership", "strategic", "alliance", "collaboration", "business"],
		difficulty: "advanced",
		estimatedTime: 150,
		sections: [
			{
				title: "Partnership Overview",
				level: 1,
				prompt: "Establish the strategic partnership framework.",
				subsections: [
					{ title: "Parties and Recitals", level: 2, prompt: "Identify parties and describe background leading to partnership." },
					{ title: "Strategic Objectives", level: 2, prompt: "Define shared strategic objectives and partnership goals." },
					{ title: "Scope of Partnership", level: 2, prompt: "Describe scope: geographic regions, products/services, customer segments covered." },
				],
			},
			{
				title: "Roles and Responsibilities",
				level: 1,
				prompt: "Define each party's roles and responsibilities.",
				subsections: [
					{ title: "Party A Responsibilities", level: 2, prompt: "Detail first party's specific responsibilities and deliverables." },
					{ title: "Party B Responsibilities", level: 2, prompt: "Detail second party's specific responsibilities and deliverables." },
					{ title: "Joint Activities", level: 2, prompt: "Describe activities to be undertaken jointly." },
				],
			},
			{
				title: "Commercial Terms",
				level: 1,
				prompt: "Define commercial and financial arrangements.",
				subsections: [
					{ title: "Revenue Sharing", level: 2, prompt: "Establish revenue sharing or fee arrangements between parties." },
					{ title: "Investment Commitments", level: 2, prompt: "Specify any investment commitments from each party." },
					{ title: "Cost Allocation", level: 2, prompt: "Define how costs of joint activities are allocated." },
				],
			},
			{
				title: "Governance",
				level: 1,
				prompt: "Establish partnership governance structure.",
				subsections: [
					{ title: "Steering Committee", level: 2, prompt: "Establish joint steering committee: composition, meeting frequency, responsibilities." },
					{ title: "Decision-Making", level: 2, prompt: "Define decision-making process and escalation procedures." },
					{ title: "Performance Reviews", level: 2, prompt: "Establish regular performance review process and KPIs." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Address IP rights and licensing.",
				subsections: [
					{ title: "Background IP", level: 2, prompt: "Each party retains ownership of pre-existing IP; grant necessary licenses for partnership activities." },
					{ title: "Joint IP", level: 2, prompt: "Address ownership and exploitation rights for jointly developed IP." },
					{ title: "Branding", level: 2, prompt: "Define co-branding rights and guidelines." },
				],
			},
			{
				title: "Term and Termination",
				level: 1,
				prompt: "Define partnership term and termination provisions.",
				subsections: [
					{ title: "Term", level: 2, prompt: "Specify initial term and renewal provisions." },
					{ title: "Termination Rights", level: 2, prompt: "Define termination for convenience, for cause, and immediate termination events." },
					{ title: "Effects of Termination", level: 2, prompt: "Address wind-down activities, transition assistance, and surviving obligations." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "First Partner", variableName: "{{partner_a}}", description: "First partner company", type: "text", required: true },
			{ id: "p2", name: "Second Partner", variableName: "{{partner_b}}", description: "Second partner company", type: "text", required: true },
			{ id: "p3", name: "Partnership Purpose", variableName: "{{purpose}}", description: "Partnership purpose", type: "textarea", required: true },
		],
	},

	// ==================== Software Licenses ====================
	{
		name: "Software as a Service (SaaS) Agreement",
		description: "Comprehensive SaaS subscription agreement for cloud-based software services.",
		categoryIds: ["legal", "software", "contracts"],
		tags: ["saas", "software", "subscription", "cloud", "license"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Service Description",
				level: 1,
				prompt: "Define the SaaS service and access rights.",
				subsections: [
					{ title: "Service Overview", level: 2, prompt: "Describe the SaaS service, its functionality, and the cloud infrastructure." },
					{ title: "Access Rights", level: 2, prompt: "Grant non-exclusive, non-transferable right to access and use the service during the subscription term." },
					{ title: "Authorized Users", level: 2, prompt: "Define authorized users, user limits, and user management responsibilities." },
				],
			},
			{
				title: "Subscription and Fees",
				level: 1,
				prompt: "Define subscription terms and payment obligations.",
				subsections: [
					{ title: "Subscription Term", level: 2, prompt: "Specify initial term, renewal terms, and auto-renewal provisions." },
					{ title: "Fees and Payment", level: 2, prompt: "Detail subscription fees, billing frequency, and payment terms." },
					{ title: "Price Changes", level: 2, prompt: "Address price increases for renewals and notice requirements." },
				],
			},
			{
				title: "Service Level Agreement",
				level: 1,
				prompt: "Define service levels and uptime commitments.",
				subsections: [
					{ title: "Availability Commitment", level: 2, prompt: "Specify uptime commitment (e.g., 99.9%) and how availability is measured." },
					{ title: "Service Credits", level: 2, prompt: "Define service credit remedies for failure to meet SLA." },
					{ title: "Maintenance Windows", level: 2, prompt: "Address scheduled maintenance and notification procedures." },
				],
			},
			{
				title: "Data Rights and Security",
				level: 1,
				prompt: "Address data ownership, security, and privacy.",
				subsections: [
					{ title: "Data Ownership", level: 2, prompt: "Clarify customer owns all customer data; provider has limited license to host and process." },
					{ title: "Data Security", level: 2, prompt: "Describe security measures: encryption, access controls, certifications (SOC 2, ISO 27001)." },
					{ title: "Data Privacy", level: 2, prompt: "Address compliance with data protection laws and include DPA reference if needed." },
					{ title: "Data Portability", level: 2, prompt: "Define customer's right to export data and format/method for data return." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Address IP ownership and restrictions.",
				subsections: [
					{ title: "Provider IP", level: 2, prompt: "Provider retains all rights in the service, software, and technology." },
					{ title: "Restrictions", level: 2, prompt: "Prohibit reverse engineering, copying, modification, sublicensing, and competitive use." },
					{ title: "Feedback", level: 2, prompt: "Address ownership of feedback and suggestions provided by customer." },
				],
			},
			{
				title: "Warranties and Disclaimers",
				level: 1,
				prompt: "Define warranties and limitations.",
				subsections: [
					{ title: "Service Warranty", level: 2, prompt: "Warrant service will perform materially as documented." },
					{ title: "Disclaimers", level: 2, prompt: "Disclaim implied warranties to maximum extent permitted by law." },
				],
			},
			{
				title: "Limitation of Liability",
				level: 1,
				prompt: "Define liability limitations.",
				subsections: [
					{ title: "Liability Cap", level: 2, prompt: "Cap total liability (typically to fees paid in prior 12 months)." },
					{ title: "Excluded Damages", level: 2, prompt: "Exclude consequential, incidental, and indirect damages." },
					{ title: "Exceptions", level: 2, prompt: "Identify exceptions: indemnification, gross negligence, willful misconduct, confidentiality breach." },
				],
			},
			{
				title: "Term and Termination",
				level: 1,
				prompt: "Define term and termination provisions.",
				subsections: [
					{ title: "Termination for Cause", level: 2, prompt: "Allow termination for material breach with cure period." },
					{ title: "Termination for Convenience", level: 2, prompt: "Address whether termination for convenience is allowed and implications." },
					{ title: "Effect of Termination", level: 2, prompt: "Define post-termination data return/deletion and surviving provisions." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Provider", variableName: "{{provider}}", description: "SaaS provider name", type: "text", required: true },
			{ id: "p2", name: "Customer", variableName: "{{customer}}", description: "Customer name", type: "text", required: true },
			{ id: "p3", name: "Service Name", variableName: "{{service_name}}", description: "SaaS service name", type: "text", required: true },
		],
	},
	{
		name: "Software License Agreement",
		description: "On-premise or perpetual software license agreement for enterprise software.",
		categoryIds: ["legal", "software", "contracts"],
		tags: ["software", "license", "perpetual", "enterprise", "on-premise"],
		difficulty: "advanced",
		estimatedTime: 150,
		sections: [
			{
				title: "License Grant",
				level: 1,
				prompt: "Define the software license grant and scope.",
				subsections: [
					{ title: "License Type", level: 2, prompt: "Grant non-exclusive license specifying type: perpetual or term, named user or concurrent." },
					{ title: "Scope of Use", level: 2, prompt: "Define permitted use: internal business purposes, specific locations, user/device limits." },
					{ title: "Documentation", level: 2, prompt: "License use of documentation accompanying the software." },
				],
			},
			{
				title: "Delivery and Installation",
				level: 1,
				prompt: "Address software delivery and installation.",
				subsections: [
					{ title: "Delivery", level: 2, prompt: "Specify delivery method: electronic download, physical media, or installation by licensor." },
					{ title: "Installation", level: 2, prompt: "Define installation responsibilities and any professional services." },
					{ title: "Acceptance", level: 2, prompt: "Establish acceptance criteria and testing period if applicable." },
				],
			},
			{
				title: "License Fees",
				level: 1,
				prompt: "Define license fees and payment terms.",
				subsections: [
					{ title: "License Fees", level: 2, prompt: "Specify one-time license fees and any per-user or tiered pricing." },
					{ title: "Maintenance Fees", level: 2, prompt: "Define annual maintenance and support fees and what they include." },
					{ title: "Payment Terms", level: 2, prompt: "Establish payment schedule, invoicing, and late payment consequences." },
				],
			},
			{
				title: "Restrictions and Compliance",
				level: 1,
				prompt: "Define license restrictions and compliance requirements.",
				subsections: [
					{ title: "License Restrictions", level: 2, prompt: "Prohibit copying (except backup), modification, reverse engineering, sublicensing, transfer without consent." },
					{ title: "Audit Rights", level: 2, prompt: "Grant licensor right to audit licensee's use for compliance, with reasonable notice." },
					{ title: "Export Compliance", level: 2, prompt: "Require compliance with export control laws and regulations." },
				],
			},
			{
				title: "Maintenance and Support",
				level: 1,
				prompt: "Define maintenance and support services.",
				subsections: [
					{ title: "Support Services", level: 2, prompt: "Describe support services: help desk, response times, escalation procedures." },
					{ title: "Updates and Upgrades", level: 2, prompt: "Define what updates (bug fixes) and upgrades (new versions) are included." },
					{ title: "End of Life", level: 2, prompt: "Address end of support/life notifications and transition assistance." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Address IP rights and indemnification.",
				subsections: [
					{ title: "Ownership", level: 2, prompt: "Licensor retains all ownership rights; license does not transfer title." },
					{ title: "IP Indemnification", level: 2, prompt: "Licensor indemnifies against IP infringement claims with standard limitations." },
				],
			},
			{
				title: "Warranties and Liability",
				level: 1,
				prompt: "Define warranties and liability provisions.",
				subsections: [
					{ title: "Software Warranty", level: 2, prompt: "Warrant software will perform substantially as documented for warranty period." },
					{ title: "Warranty Remedy", level: 2, prompt: "Define remedy for warranty breach: repair, replace, or refund." },
					{ title: "Limitation of Liability", level: 2, prompt: "Limit liability with cap and exclusion of consequential damages." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Licensor", variableName: "{{licensor}}", description: "Software licensor", type: "text", required: true },
			{ id: "p2", name: "Licensee", variableName: "{{licensee}}", description: "Licensee name", type: "text", required: true },
			{ id: "p3", name: "Software", variableName: "{{software_name}}", description: "Software product name", type: "text", required: true },
		],
	},
	{
		name: "End User License Agreement (EULA)",
		description: "Standard end user license agreement for software products distributed to consumers or businesses.",
		categoryIds: ["legal", "software"],
		tags: ["eula", "license", "end-user", "software", "consumer"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "License Grant",
				level: 1,
				prompt: "Grant the end user license to use the software.",
				subsections: [
					{ title: "Grant of License", level: 2, prompt: "Grant limited, non-exclusive, non-transferable license to use the software." },
					{ title: "Permitted Use", level: 2, prompt: "Define permitted use: personal/commercial, number of devices, user restrictions." },
				],
			},
			{
				title: "Restrictions",
				level: 1,
				prompt: "Define what the end user cannot do.",
				subsections: [
					{ title: "Prohibited Actions", level: 2, prompt: "Prohibit: copying, modification, reverse engineering, distribution, rental, sublicensing." },
					{ title: "Circumvention", level: 2, prompt: "Prohibit circumvention of technical protection measures." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Clarify IP ownership.",
				subsections: [
					{ title: "Ownership", level: 2, prompt: "State that licensor owns all rights; no title transfers to user." },
					{ title: "Trademarks", level: 2, prompt: "Restrict use of licensor trademarks." },
				],
			},
			{
				title: "Privacy and Data",
				level: 1,
				prompt: "Address data collection and privacy.",
				subsections: [
					{ title: "Data Collection", level: 2, prompt: "Disclose what data the software collects and how it's used." },
					{ title: "Privacy Policy", level: 2, prompt: "Reference privacy policy and require user acceptance." },
				],
			},
			{
				title: "Disclaimers and Limitations",
				level: 1,
				prompt: "Include warranty disclaimers and liability limitations.",
				subsections: [
					{ title: "Warranty Disclaimer", level: 2, prompt: "Disclaim warranties: software provided 'AS IS' without warranty." },
					{ title: "Liability Limitation", level: 2, prompt: "Limit liability to maximum extent permitted by law." },
				],
			},
			{
				title: "Termination",
				level: 1,
				prompt: "Define when the license terminates.",
				subsections: [
					{ title: "Termination Events", level: 2, prompt: "License terminates upon breach or if user stops using software." },
					{ title: "Effect of Termination", level: 2, prompt: "Require deletion of software and all copies upon termination." },
				],
			},
			{
				title: "General Terms",
				level: 1,
				prompt: "Include standard EULA provisions.",
				subsections: [
					{ title: "Updates", level: 2, prompt: "Reserve right to update EULA and software." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law and dispute resolution." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Software company name", type: "text", required: true },
			{ id: "p2", name: "Software", variableName: "{{software}}", description: "Software product name", type: "text", required: true },
		],
	},

	// ==================== Service Agreements ====================
	{
		name: "Master Services Agreement (MSA)",
		description: "Comprehensive master agreement governing professional services engagements.",
		categoryIds: ["legal", "contracts", "consultancy"],
		tags: ["msa", "services", "master-agreement", "professional-services", "consulting"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Engagement Framework",
				level: 1,
				prompt: "Establish the MSA framework and how work is ordered.",
				subsections: [
					{ title: "Purpose and Scope", level: 2, prompt: "Establish MSA as governing agreement for all services; work ordered through Statements of Work." },
					{ title: "Statement of Work Process", level: 2, prompt: "Define SOW requirements: scope, deliverables, timeline, fees, acceptance criteria." },
					{ title: "Order of Precedence", level: 2, prompt: "Establish precedence between MSA and SOWs in case of conflict." },
				],
			},
			{
				title: "Service Performance",
				level: 1,
				prompt: "Define service performance standards.",
				subsections: [
					{ title: "Performance Standards", level: 2, prompt: "Require services performed professionally, with skill, and in accordance with SOW." },
					{ title: "Personnel", level: 2, prompt: "Address personnel qualifications, key personnel, and replacement procedures." },
					{ title: "Subcontracting", level: 2, prompt: "Define whether and how subcontracting is permitted." },
				],
			},
			{
				title: "Fees and Payment",
				level: 1,
				prompt: "Define fee structures and payment terms.",
				subsections: [
					{ title: "Fee Structures", level: 2, prompt: "Allow for various fee structures: time and materials, fixed fee, milestone-based." },
					{ title: "Expenses", level: 2, prompt: "Define reimbursable expenses and approval requirements." },
					{ title: "Invoicing and Payment", level: 2, prompt: "Establish invoicing procedures, payment terms, and late payment interest." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Define IP ownership for deliverables and pre-existing IP.",
				subsections: [
					{ title: "Work Product Ownership", level: 2, prompt: "Define ownership of deliverables: client owns work product, or provider retains with license to client." },
					{ title: "Pre-Existing IP", level: 2, prompt: "Each party retains pre-existing IP; license granted as needed for deliverables." },
					{ title: "Third-Party Materials", level: 2, prompt: "Address use of third-party materials and open source in deliverables." },
				],
			},
			{
				title: "Confidentiality",
				level: 1,
				prompt: "Include confidentiality provisions.",
				subsections: [
					{ title: "Confidential Information", level: 2, prompt: "Define confidential information of both parties." },
					{ title: "Protection Obligations", level: 2, prompt: "Establish obligations to protect and limit use of confidential information." },
				],
			},
			{
				title: "Warranties and Indemnification",
				level: 1,
				prompt: "Define warranties and indemnification.",
				subsections: [
					{ title: "Service Warranty", level: 2, prompt: "Warrant services performed professionally and deliverables conform to specifications." },
					{ title: "IP Indemnification", level: 2, prompt: "Provider indemnifies client against IP infringement claims." },
					{ title: "General Indemnification", level: 2, prompt: "Mutual indemnification for third-party claims arising from breach or negligence." },
				],
			},
			{
				title: "Limitation of Liability",
				level: 1,
				prompt: "Define liability limitations.",
				subsections: [
					{ title: "Liability Cap", level: 2, prompt: "Cap total liability (often to fees paid under relevant SOW or in aggregate)." },
					{ title: "Excluded Damages", level: 2, prompt: "Exclude indirect, consequential, and special damages." },
				],
			},
			{
				title: "Term and Termination",
				level: 1,
				prompt: "Define MSA term and termination rights.",
				subsections: [
					{ title: "MSA Term", level: 2, prompt: "Specify MSA term with renewal provisions." },
					{ title: "SOW Termination", level: 2, prompt: "Allow termination of individual SOWs for convenience and for cause." },
					{ title: "Effect of Termination", level: 2, prompt: "Address payment for work completed, return of materials, and survival." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Provider", variableName: "{{provider}}", description: "Service provider", type: "text", required: true },
			{ id: "p2", name: "Client", variableName: "{{client}}", description: "Client name", type: "text", required: true },
		],
	},
	{
		name: "Statement of Work (SOW)",
		description: "Statement of Work template for specific project engagements under an MSA.",
		categoryIds: ["legal", "contracts", "consultancy"],
		tags: ["sow", "statement-of-work", "project", "services", "deliverables"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Project Overview",
				level: 1,
				prompt: "Describe the project and its objectives.",
				subsections: [
					{ title: "Project Description", level: 2, prompt: "Describe the project, background, and business objectives." },
					{ title: "Scope", level: 2, prompt: "Define what is in scope and explicitly what is out of scope." },
				],
			},
			{
				title: "Deliverables",
				level: 1,
				prompt: "Define project deliverables.",
				subsections: [
					{ title: "Deliverable List", level: 2, prompt: "List all deliverables with descriptions and specifications." },
					{ title: "Acceptance Criteria", level: 2, prompt: "Define acceptance criteria for each deliverable." },
				],
			},
			{
				title: "Timeline and Milestones",
				level: 1,
				prompt: "Define project timeline.",
				subsections: [
					{ title: "Project Schedule", level: 2, prompt: "Provide project schedule with start date, end date, and phase breakdown." },
					{ title: "Milestones", level: 2, prompt: "Define key milestones and dates." },
				],
			},
			{
				title: "Resources and Responsibilities",
				level: 1,
				prompt: "Define resource requirements and responsibilities.",
				subsections: [
					{ title: "Provider Resources", level: 2, prompt: "Identify provider team and key personnel." },
					{ title: "Client Responsibilities", level: 2, prompt: "Define client obligations: access, information, personnel, decisions." },
				],
			},
			{
				title: "Fees and Payment",
				level: 1,
				prompt: "Define project fees.",
				subsections: [
					{ title: "Fee Structure", level: 2, prompt: "Specify fee structure: fixed fee, T&M rates, milestone payments." },
					{ title: "Payment Schedule", level: 2, prompt: "Define payment schedule tied to milestones or time periods." },
					{ title: "Change Orders", level: 2, prompt: "Establish change order process for scope changes." },
				],
			},
			{
				title: "Assumptions and Dependencies",
				level: 1,
				prompt: "Document assumptions and dependencies.",
				subsections: [
					{ title: "Assumptions", level: 2, prompt: "List key assumptions underlying the SOW." },
					{ title: "Dependencies", level: 2, prompt: "Identify dependencies on client or third parties." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Project Name", variableName: "{{project_name}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "SOW Number", variableName: "{{sow_number}}", description: "SOW reference number", type: "text", required: true },
		],
	},
	{
		name: "Service Level Agreement (SLA)",
		description: "Service level agreement defining performance metrics and commitments.",
		categoryIds: ["legal", "contracts", "operations"],
		tags: ["sla", "service-levels", "performance", "metrics", "support"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Service Description",
				level: 1,
				prompt: "Describe the services covered by this SLA.",
				subsections: [
					{ title: "Services Covered", level: 2, prompt: "List and describe services subject to this SLA." },
					{ title: "Service Hours", level: 2, prompt: "Define service hours: 24/7, business hours, time zones." },
				],
			},
			{
				title: "Performance Metrics",
				level: 1,
				prompt: "Define service level metrics and targets.",
				subsections: [
					{ title: "Availability", level: 2, prompt: "Define availability target (e.g., 99.9%) and calculation methodology." },
					{ title: "Response Time", level: 2, prompt: "Define response time targets by priority level." },
					{ title: "Resolution Time", level: 2, prompt: "Define resolution time targets by priority level." },
				],
			},
			{
				title: "Measurement and Reporting",
				level: 1,
				prompt: "Define how service levels are measured and reported.",
				subsections: [
					{ title: "Measurement Period", level: 2, prompt: "Specify measurement period (monthly, quarterly)." },
					{ title: "Reporting", level: 2, prompt: "Define SLA reporting: frequency, format, and distribution." },
					{ title: "Exclusions", level: 2, prompt: "Define exclusions from SLA calculations: scheduled maintenance, customer-caused issues." },
				],
			},
			{
				title: "Service Credits",
				level: 1,
				prompt: "Define remedies for SLA failures.",
				subsections: [
					{ title: "Credit Calculation", level: 2, prompt: "Define service credit calculation based on SLA miss severity." },
					{ title: "Credit Cap", level: 2, prompt: "Cap maximum service credits per period." },
					{ title: "Credit Process", level: 2, prompt: "Define process for requesting and receiving service credits." },
				],
			},
			{
				title: "Escalation",
				level: 1,
				prompt: "Define escalation procedures.",
				subsections: [
					{ title: "Escalation Path", level: 2, prompt: "Define escalation contacts and triggers for escalation." },
					{ title: "Critical Incidents", level: 2, prompt: "Define special procedures for critical incidents." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Provider", variableName: "{{provider}}", description: "Service provider", type: "text", required: true },
			{ id: "p2", name: "Customer", variableName: "{{customer}}", description: "Customer name", type: "text", required: true },
		],
	},

	// ==================== Other Business Legal Documents ====================
	{
		name: "Independent Contractor Agreement",
		description: "Agreement for engaging independent contractors for services.",
		categoryIds: ["legal", "hr", "contracts"],
		tags: ["contractor", "independent", "freelance", "services", "engagement"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Engagement",
				level: 1,
				prompt: "Define the contractor engagement.",
				subsections: [
					{ title: "Services", level: 2, prompt: "Describe services to be performed by contractor." },
					{ title: "Term", level: 2, prompt: "Specify engagement term or project duration." },
				],
			},
			{
				title: "Compensation",
				level: 1,
				prompt: "Define compensation terms.",
				subsections: [
					{ title: "Fees", level: 2, prompt: "Specify compensation: hourly rate, project fee, or retainer." },
					{ title: "Expenses", level: 2, prompt: "Address reimbursable expenses and approval requirements." },
					{ title: "Invoicing", level: 2, prompt: "Define invoicing and payment procedures." },
				],
			},
			{
				title: "Independent Contractor Status",
				level: 1,
				prompt: "Establish independent contractor relationship.",
				subsections: [
					{ title: "Contractor Status", level: 2, prompt: "Confirm contractor is independent, not employee; no employment benefits." },
					{ title: "Taxes", level: 2, prompt: "Contractor responsible for own taxes; company will issue 1099." },
					{ title: "Control", level: 2, prompt: "Contractor controls manner and means of performing services." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Address IP ownership.",
				subsections: [
					{ title: "Work Product", level: 2, prompt: "Assign all work product and IP created during engagement to company." },
					{ title: "Pre-Existing IP", level: 2, prompt: "Contractor retains pre-existing IP; grants license if incorporated in work." },
				],
			},
			{
				title: "Confidentiality",
				level: 1,
				prompt: "Include confidentiality provisions.",
				subsections: [
					{ title: "Non-Disclosure", level: 2, prompt: "Contractor agrees to protect company confidential information." },
					{ title: "Return of Materials", level: 2, prompt: "Require return of materials upon termination." },
				],
			},
			{
				title: "Termination",
				level: 1,
				prompt: "Define termination provisions.",
				subsections: [
					{ title: "Termination Rights", level: 2, prompt: "Either party may terminate with notice; immediate termination for cause." },
					{ title: "Payment on Termination", level: 2, prompt: "Define payment for work completed prior to termination." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Engaging company", type: "text", required: true },
			{ id: "p2", name: "Contractor", variableName: "{{contractor}}", description: "Contractor name", type: "text", required: true },
		],
	},
	{
		name: "Terms of Service",
		description: "Terms of service agreement for websites, platforms, or applications.",
		categoryIds: ["legal", "software"],
		tags: ["terms", "tos", "terms-of-service", "website", "platform"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Acceptance and Scope",
				level: 1,
				prompt: "Establish agreement acceptance and scope.",
				subsections: [
					{ title: "Agreement to Terms", level: 2, prompt: "State that use of service constitutes acceptance of terms." },
					{ title: "Eligibility", level: 2, prompt: "Define eligibility requirements: age, jurisdiction, capacity." },
					{ title: "Account Registration", level: 2, prompt: "Address account creation, accuracy of information, and security." },
				],
			},
			{
				title: "Service Description",
				level: 1,
				prompt: "Describe the service.",
				subsections: [
					{ title: "Service Overview", level: 2, prompt: "Describe the service and its features." },
					{ title: "Service Modifications", level: 2, prompt: "Reserve right to modify, suspend, or discontinue service." },
				],
			},
			{
				title: "User Obligations",
				level: 1,
				prompt: "Define user obligations and restrictions.",
				subsections: [
					{ title: "Acceptable Use", level: 2, prompt: "Define acceptable use policy and prohibited activities." },
					{ title: "User Content", level: 2, prompt: "Address user-generated content: ownership, licenses granted, prohibited content." },
					{ title: "Compliance", level: 2, prompt: "Require compliance with laws and third-party rights." },
				],
			},
			{
				title: "Intellectual Property",
				level: 1,
				prompt: "Address IP rights.",
				subsections: [
					{ title: "Service IP", level: 2, prompt: "Company owns all rights in the service; user receives limited license." },
					{ title: "User Content License", level: 2, prompt: "User grants license to use user content for service operation." },
				],
			},
			{
				title: "Fees and Payment",
				level: 1,
				prompt: "Address any fees if applicable.",
				subsections: [
					{ title: "Pricing", level: 2, prompt: "Describe pricing for paid features/subscriptions." },
					{ title: "Billing", level: 2, prompt: "Define billing terms, auto-renewal, and cancellation." },
				],
			},
			{
				title: "Disclaimers and Liability",
				level: 1,
				prompt: "Include disclaimers and liability limitations.",
				subsections: [
					{ title: "Disclaimers", level: 2, prompt: "Disclaim warranties; service provided 'as is'." },
					{ title: "Limitation of Liability", level: 2, prompt: "Limit company liability; exclude consequential damages." },
					{ title: "Indemnification", level: 2, prompt: "User indemnifies company for claims arising from user's use or content." },
				],
			},
			{
				title: "Termination and General",
				level: 1,
				prompt: "Address termination and general provisions.",
				subsections: [
					{ title: "Termination", level: 2, prompt: "Define termination rights for both parties." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law and dispute resolution." },
					{ title: "Updates to Terms", level: 2, prompt: "Reserve right to update terms with notice." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Service Name", variableName: "{{service}}", description: "Service/platform name", type: "text", required: true },
		],
	},
	{
		name: "Data Processing Agreement (DPA)",
		description: "GDPR-compliant data processing agreement for processors handling personal data.",
		categoryIds: ["legal", "privacy", "compliance"],
		tags: ["dpa", "gdpr", "privacy", "data-processing", "compliance"],
		difficulty: "advanced",
		estimatedTime: 120,
		sections: [
			{
				title: "Scope and Roles",
				level: 1,
				prompt: "Define scope of processing and party roles.",
				subsections: [
					{ title: "Processing Activities", level: 2, prompt: "Describe the personal data processing activities covered by this DPA." },
					{ title: "Controller and Processor", level: 2, prompt: "Identify data controller and data processor roles." },
					{ title: "Data Subjects and Categories", level: 2, prompt: "Specify categories of data subjects and types of personal data processed." },
				],
			},
			{
				title: "Processor Obligations",
				level: 1,
				prompt: "Define processor's data protection obligations.",
				subsections: [
					{ title: "Processing Instructions", level: 2, prompt: "Processor only processes on documented controller instructions." },
					{ title: "Confidentiality", level: 2, prompt: "Ensure personnel are bound by confidentiality obligations." },
					{ title: "Security Measures", level: 2, prompt: "Implement appropriate technical and organizational security measures." },
				],
			},
			{
				title: "Sub-Processing",
				level: 1,
				prompt: "Address sub-processor engagement.",
				subsections: [
					{ title: "Sub-Processor Authorization", level: 2, prompt: "Require prior authorization for sub-processors; list current sub-processors." },
					{ title: "Sub-Processor Obligations", level: 2, prompt: "Impose equivalent data protection obligations on sub-processors." },
				],
			},
			{
				title: "Data Subject Rights",
				level: 1,
				prompt: "Address cooperation on data subject rights.",
				subsections: [
					{ title: "Assistance", level: 2, prompt: "Processor assists controller in responding to data subject requests." },
					{ title: "Response Timeframes", level: 2, prompt: "Define timeframes for processor to assist with requests." },
				],
			},
			{
				title: "Data Breach",
				level: 1,
				prompt: "Define data breach notification procedures.",
				subsections: [
					{ title: "Notification", level: 2, prompt: "Processor notifies controller of personal data breaches without undue delay." },
					{ title: "Breach Information", level: 2, prompt: "Specify information to be provided regarding the breach." },
				],
			},
			{
				title: "International Transfers",
				level: 1,
				prompt: "Address international data transfers.",
				subsections: [
					{ title: "Transfer Mechanisms", level: 2, prompt: "Specify lawful transfer mechanisms: SCCs, adequacy decisions, BCRs." },
					{ title: "Transfer Impact Assessment", level: 2, prompt: "Address transfer impact assessments for third country transfers." },
				],
			},
			{
				title: "Audits and Termination",
				level: 1,
				prompt: "Address audit rights and data return.",
				subsections: [
					{ title: "Audit Rights", level: 2, prompt: "Controller right to audit processor compliance; processor cooperation." },
					{ title: "Data Return/Deletion", level: 2, prompt: "Upon termination, processor returns or deletes personal data per controller instruction." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Controller", variableName: "{{controller}}", description: "Data controller name", type: "text", required: true },
			{ id: "p2", name: "Processor", variableName: "{{processor}}", description: "Data processor name", type: "text", required: true },
		],
	},
	{
		name: "Letter of Intent (LOI)",
		description: "Letter of intent expressing preliminary interest in a business transaction.",
		categoryIds: ["legal", "business", "ma"],
		tags: ["loi", "letter-of-intent", "preliminary", "transaction", "m&a"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Transaction Overview",
				level: 1,
				prompt: "Describe the proposed transaction.",
				subsections: [
					{ title: "Transaction Description", level: 2, prompt: "Describe the proposed transaction: acquisition, investment, partnership." },
					{ title: "Purchase Price", level: 2, prompt: "State proposed purchase price or valuation and form of consideration." },
				],
			},
			{
				title: "Key Terms",
				level: 1,
				prompt: "Outline key proposed terms.",
				subsections: [
					{ title: "Structure", level: 2, prompt: "Describe proposed deal structure: asset purchase, stock purchase, merger." },
					{ title: "Conditions", level: 2, prompt: "Identify key conditions: due diligence, financing, regulatory approvals." },
				],
			},
			{
				title: "Due Diligence",
				level: 1,
				prompt: "Address due diligence period and access.",
				subsections: [
					{ title: "Due Diligence Period", level: 2, prompt: "Specify due diligence period and information access requirements." },
					{ title: "Cooperation", level: 2, prompt: "Target agrees to cooperate with due diligence requests." },
				],
			},
			{
				title: "Binding Provisions",
				level: 1,
				prompt: "Identify binding and non-binding provisions.",
				subsections: [
					{ title: "Non-Binding Terms", level: 2, prompt: "Clearly state which provisions are non-binding (transaction terms)." },
					{ title: "Binding Terms", level: 2, prompt: "Identify binding provisions: confidentiality, exclusivity, expenses, governing law." },
				],
			},
			{
				title: "Exclusivity",
				level: 1,
				prompt: "Address exclusivity period if applicable.",
				subsections: [
					{ title: "Exclusivity Period", level: 2, prompt: "Grant exclusivity for specified period; define prohibited activities." },
					{ title: "Break Fee", level: 2, prompt: "Address any break fee for exclusivity breach if applicable." },
				],
			},
			{
				title: "Timeline and Expiration",
				level: 1,
				prompt: "Define timeline and LOI expiration.",
				subsections: [
					{ title: "Timeline", level: 2, prompt: "Outline expected timeline to definitive agreement." },
					{ title: "Expiration", level: 2, prompt: "Specify LOI expiration date." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Buyer", variableName: "{{buyer}}", description: "Buyer/investor name", type: "text", required: true },
			{ id: "p2", name: "Seller/Target", variableName: "{{target}}", description: "Seller/target name", type: "text", required: true },
		],
	},
	{
		name: "Non-Compete Agreement",
		description: "Non-competition agreement restricting competitive activities.",
		categoryIds: ["legal", "hr", "contracts"],
		tags: ["non-compete", "restrictive-covenant", "competition", "employment", "legal"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Parties and Context",
				level: 1,
				prompt: "Identify parties and establish context.",
				subsections: [
					{ title: "Party Identification", level: 2, prompt: "Identify parties: employer/company and employee/individual." },
					{ title: "Consideration", level: 2, prompt: "State consideration: employment, continued employment, severance, or other value." },
				],
			},
			{
				title: "Non-Competition Covenant",
				level: 1,
				prompt: "Define the non-competition restrictions.",
				subsections: [
					{ title: "Prohibited Activities", level: 2, prompt: "Define prohibited competitive activities: employment, ownership, consulting with competitors." },
					{ title: "Geographic Scope", level: 2, prompt: "Define geographic area where restrictions apply; must be reasonable." },
					{ title: "Duration", level: 2, prompt: "Specify restriction duration post-termination (typically 1-2 years)." },
					{ title: "Competitor Definition", level: 2, prompt: "Define what constitutes a competing business." },
				],
			},
			{
				title: "Non-Solicitation",
				level: 1,
				prompt: "Include non-solicitation provisions.",
				subsections: [
					{ title: "Customer Non-Solicitation", level: 2, prompt: "Prohibit solicitation of company customers for restricted period." },
					{ title: "Employee Non-Solicitation", level: 2, prompt: "Prohibit solicitation or hiring of company employees." },
				],
			},
			{
				title: "Enforcement",
				level: 1,
				prompt: "Address enforcement and remedies.",
				subsections: [
					{ title: "Injunctive Relief", level: 2, prompt: "Acknowledge availability of injunctive relief for breach." },
					{ title: "Tolling", level: 2, prompt: "Address whether restriction period tolls during breach." },
					{ title: "Blue Pencil", level: 2, prompt: "Include blue pencil provision allowing court modification for enforceability." },
				],
			},
			{
				title: "General Provisions",
				level: 1,
				prompt: "Include standard provisions.",
				subsections: [
					{ title: "Reasonableness", level: 2, prompt: "Acknowledge employee understands and agrees restrictions are reasonable." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law (important for non-compete enforceability)." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Individual", variableName: "{{individual}}", description: "Individual name", type: "text", required: true },
			{ id: "p3", name: "Duration (Months)", variableName: "{{duration_months}}", description: "Restriction duration in months", type: "number", required: true },
		],
	},
	{
		name: "Privacy Policy",
		description: "Comprehensive privacy policy for websites and applications.",
		categoryIds: ["legal", "privacy", "compliance"],
		tags: ["privacy", "policy", "gdpr", "ccpa", "data-protection"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Introduction",
				level: 1,
				prompt: "Introduce the privacy policy.",
				subsections: [
					{ title: "Overview", level: 2, prompt: "Introduce the privacy policy, its purpose, and commitment to privacy." },
					{ title: "Scope", level: 2, prompt: "Define scope: what services, websites, apps are covered." },
				],
			},
			{
				title: "Information Collection",
				level: 1,
				prompt: "Describe what information is collected.",
				subsections: [
					{ title: "Information You Provide", level: 2, prompt: "Describe information users provide directly: account info, communications." },
					{ title: "Automatic Collection", level: 2, prompt: "Describe automatically collected information: device info, usage data, cookies." },
					{ title: "Third-Party Sources", level: 2, prompt: "Address information from third-party sources if applicable." },
				],
			},
			{
				title: "Use of Information",
				level: 1,
				prompt: "Explain how information is used.",
				subsections: [
					{ title: "Service Provision", level: 2, prompt: "Use for providing, maintaining, and improving services." },
					{ title: "Communications", level: 2, prompt: "Use for communications: service updates, marketing (with consent)." },
					{ title: "Other Uses", level: 2, prompt: "Other uses: security, legal compliance, research/analytics." },
				],
			},
			{
				title: "Information Sharing",
				level: 1,
				prompt: "Describe when information is shared.",
				subsections: [
					{ title: "Service Providers", level: 2, prompt: "Sharing with service providers under data processing agreements." },
					{ title: "Legal Requirements", level: 2, prompt: "Disclosure required by law or to protect rights." },
					{ title: "Business Transfers", level: 2, prompt: "Sharing in connection with mergers, acquisitions, or asset sales." },
				],
			},
			{
				title: "Your Rights",
				level: 1,
				prompt: "Describe user privacy rights.",
				subsections: [
					{ title: "Access and Correction", level: 2, prompt: "Right to access and correct personal information." },
					{ title: "Deletion", level: 2, prompt: "Right to request deletion of personal information." },
					{ title: "Opt-Out", level: 2, prompt: "Right to opt-out of marketing; Do Not Sell (CCPA)." },
					{ title: "Data Portability", level: 2, prompt: "Right to data portability where applicable." },
				],
			},
			{
				title: "Data Security and Retention",
				level: 1,
				prompt: "Address security and retention.",
				subsections: [
					{ title: "Security Measures", level: 2, prompt: "Describe security measures to protect information." },
					{ title: "Retention", level: 2, prompt: "Describe data retention practices and criteria." },
				],
			},
			{
				title: "Additional Information",
				level: 1,
				prompt: "Include additional required disclosures.",
				subsections: [
					{ title: "Children's Privacy", level: 2, prompt: "Address children's privacy (COPPA compliance)." },
					{ title: "International Transfers", level: 2, prompt: "Address international data transfers if applicable." },
					{ title: "Updates", level: 2, prompt: "Reserve right to update policy and notification method." },
					{ title: "Contact", level: 2, prompt: "Provide contact information for privacy inquiries." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Effective Date", variableName: "{{effective_date}}", description: "Policy effective date", type: "date", required: true },
			{ id: "p3", name: "Contact Email", variableName: "{{contact_email}}", description: "Privacy contact email", type: "email", required: true },
		],
	},
];

// ============================================================================
// SALES & MARKETING TEMPLATES
// ============================================================================

export const SALES_MARKETING_TEMPLATES: TemplateDef[] = [
	{
		name: "Sales Proposal",
		description: "Professional sales proposal for products or services.",
		categoryIds: ["sales", "business"],
		tags: ["sales", "proposal", "quote", "pricing", "business"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the proposal and value proposition.",
				subsections: [
					{ title: "Opportunity Overview", level: 2, prompt: "Describe the customer's situation and opportunity." },
					{ title: "Proposed Solution", level: 2, prompt: "Summarize the recommended solution and key benefits." },
				],
			},
			{
				title: "Understanding Your Needs",
				level: 1,
				prompt: "Demonstrate understanding of customer requirements.",
				subsections: [
					{ title: "Current Challenges", level: 2, prompt: "Articulate the customer's pain points and challenges." },
					{ title: "Desired Outcomes", level: 2, prompt: "Define success criteria and desired business outcomes." },
				],
			},
			{
				title: "Proposed Solution",
				level: 1,
				prompt: "Detail the proposed solution.",
				subsections: [
					{ title: "Solution Overview", level: 2, prompt: "Describe the solution architecture and components." },
					{ title: "Features and Benefits", level: 2, prompt: "Map features to customer benefits and outcomes." },
					{ title: "Differentiators", level: 2, prompt: "Highlight unique value and competitive advantages." },
				],
			},
			{
				title: "Investment",
				level: 1,
				prompt: "Present pricing and investment details.",
				subsections: [
					{ title: "Pricing Summary", level: 2, prompt: "Present pricing options and payment terms." },
					{ title: "ROI Analysis", level: 2, prompt: "Quantify expected return on investment." },
				],
			},
			{
				title: "Implementation",
				level: 1,
				prompt: "Outline implementation approach.",
				subsections: [
					{ title: "Timeline", level: 2, prompt: "Present implementation timeline and milestones." },
					{ title: "Next Steps", level: 2, prompt: "Define immediate next steps and call to action." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Customer", variableName: "{{customer}}", description: "Customer name", type: "text", required: true },
			{ id: "p2", name: "Solution", variableName: "{{solution}}", description: "Solution name", type: "text", required: true },
		],
	},
	{
		name: "Marketing Plan",
		description: "Comprehensive marketing plan for product or service launch.",
		categoryIds: ["marketing", "strategy"],
		tags: ["marketing", "plan", "strategy", "campaign", "launch"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Situation Analysis",
				level: 1,
				prompt: "Analyze current market situation.",
				subsections: [
					{ title: "Market Overview", level: 2, prompt: "Describe market size, trends, and dynamics." },
					{ title: "Competitive Analysis", level: 2, prompt: "Analyze key competitors and their positioning." },
					{ title: "SWOT Analysis", level: 2, prompt: "Assess strengths, weaknesses, opportunities, threats." },
				],
			},
			{
				title: "Marketing Strategy",
				level: 1,
				prompt: "Define marketing strategy.",
				subsections: [
					{ title: "Target Audience", level: 2, prompt: "Define target segments and buyer personas." },
					{ title: "Positioning", level: 2, prompt: "Articulate brand positioning and value proposition." },
					{ title: "Marketing Objectives", level: 2, prompt: "Set SMART marketing objectives and KPIs." },
				],
			},
			{
				title: "Marketing Mix",
				level: 1,
				prompt: "Detail the marketing mix (4Ps).",
				subsections: [
					{ title: "Product Strategy", level: 2, prompt: "Define product features, packaging, and branding." },
					{ title: "Pricing Strategy", level: 2, prompt: "Establish pricing strategy and structure." },
					{ title: "Distribution Strategy", level: 2, prompt: "Define channels and distribution approach." },
					{ title: "Promotion Strategy", level: 2, prompt: "Plan promotional activities and campaigns." },
				],
			},
			{
				title: "Budget and Timeline",
				level: 1,
				prompt: "Define budget and implementation timeline.",
				subsections: [
					{ title: "Marketing Budget", level: 2, prompt: "Allocate budget across marketing activities." },
					{ title: "Implementation Timeline", level: 2, prompt: "Create timeline with key milestones." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Product/Service", variableName: "{{product}}", description: "Product or service name", type: "text", required: true },
			{ id: "p2", name: "Period", variableName: "{{period}}", description: "Planning period", type: "text", required: true },
		],
	},
	{
		name: "Go-to-Market Strategy",
		description: "Go-to-market strategy for new product or market entry.",
		categoryIds: ["marketing", "strategy", "sales"],
		tags: ["gtm", "go-to-market", "launch", "strategy", "product"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Market Opportunity",
				level: 1,
				prompt: "Define the market opportunity.",
				subsections: [
					{ title: "Market Definition", level: 2, prompt: "Define target market and addressable opportunity." },
					{ title: "Customer Segments", level: 2, prompt: "Identify and prioritize customer segments." },
					{ title: "Competitive Landscape", level: 2, prompt: "Map competitive landscape and positioning." },
				],
			},
			{
				title: "Value Proposition",
				level: 1,
				prompt: "Articulate the value proposition.",
				subsections: [
					{ title: "Core Value Proposition", level: 2, prompt: "Define compelling value proposition for each segment." },
					{ title: "Differentiation", level: 2, prompt: "Articulate key differentiators vs. alternatives." },
				],
			},
			{
				title: "Go-to-Market Model",
				level: 1,
				prompt: "Define GTM model and channels.",
				subsections: [
					{ title: "Sales Model", level: 2, prompt: "Define sales model: direct, channel, self-service, hybrid." },
					{ title: "Channel Strategy", level: 2, prompt: "Identify and prioritize go-to-market channels." },
					{ title: "Partnership Strategy", level: 2, prompt: "Define partner ecosystem and alliance strategy." },
				],
			},
			{
				title: "Launch Plan",
				level: 1,
				prompt: "Plan the market launch.",
				subsections: [
					{ title: "Launch Timeline", level: 2, prompt: "Create phased launch timeline and milestones." },
					{ title: "Launch Activities", level: 2, prompt: "Define marketing, sales, and enablement activities." },
					{ title: "Success Metrics", level: 2, prompt: "Define KPIs and success metrics for launch." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Product", variableName: "{{product}}", description: "Product name", type: "text", required: true },
			{ id: "p2", name: "Market", variableName: "{{market}}", description: "Target market", type: "text", required: true },
		],
	},
	{
		name: "Competitive Analysis Report",
		description: "In-depth competitive analysis and market intelligence report.",
		categoryIds: ["marketing", "strategy", "analysis"],
		tags: ["competitive", "analysis", "intelligence", "market", "competitors"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Competitive Landscape",
				level: 1,
				prompt: "Map the competitive landscape.",
				subsections: [
					{ title: "Market Overview", level: 2, prompt: "Define the market and competitive dynamics." },
					{ title: "Competitor Identification", level: 2, prompt: "Identify direct, indirect, and emerging competitors." },
				],
			},
			{
				title: "Competitor Profiles",
				level: 1,
				prompt: "Profile key competitors.",
				subsections: [
					{ title: "Company Overview", level: 2, prompt: "Profile each competitor: size, funding, market share." },
					{ title: "Product/Service Analysis", level: 2, prompt: "Analyze competitor offerings, features, and pricing." },
					{ title: "Go-to-Market", level: 2, prompt: "Assess competitor sales, marketing, and channel strategies." },
				],
			},
			{
				title: "Comparative Analysis",
				level: 1,
				prompt: "Compare competitive positioning.",
				subsections: [
					{ title: "Feature Comparison", level: 2, prompt: "Create feature comparison matrix." },
					{ title: "Strengths and Weaknesses", level: 2, prompt: "Assess each competitor's strengths and weaknesses." },
					{ title: "Positioning Map", level: 2, prompt: "Map competitive positioning on key dimensions." },
				],
			},
			{
				title: "Strategic Implications",
				level: 1,
				prompt: "Draw strategic implications.",
				subsections: [
					{ title: "Competitive Threats", level: 2, prompt: "Identify key competitive threats and risks." },
					{ title: "Opportunities", level: 2, prompt: "Identify competitive gaps and opportunities." },
					{ title: "Recommendations", level: 2, prompt: "Provide strategic recommendations." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Your company", type: "text", required: true },
			{ id: "p2", name: "Market", variableName: "{{market}}", description: "Market segment", type: "text", required: true },
		],
	},
	{
		name: "Customer Case Study",
		description: "Customer success case study showcasing results and value delivered.",
		categoryIds: ["marketing", "sales"],
		tags: ["case-study", "customer", "success", "testimonial", "reference"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Customer Profile",
				level: 1,
				prompt: "Introduce the customer.",
				subsections: [
					{ title: "Company Overview", level: 2, prompt: "Describe the customer company and industry." },
					{ title: "Business Context", level: 2, prompt: "Set the business context and environment." },
				],
			},
			{
				title: "Challenge",
				level: 1,
				prompt: "Describe the customer's challenge.",
				subsections: [
					{ title: "Business Challenge", level: 2, prompt: "Articulate the key business challenges faced." },
					{ title: "Impact of Challenge", level: 2, prompt: "Quantify the impact of these challenges." },
				],
			},
			{
				title: "Solution",
				level: 1,
				prompt: "Describe the solution implemented.",
				subsections: [
					{ title: "Solution Overview", level: 2, prompt: "Describe the solution and implementation approach." },
					{ title: "Why Us", level: 2, prompt: "Explain why customer chose this solution." },
				],
			},
			{
				title: "Results",
				level: 1,
				prompt: "Showcase measurable results.",
				subsections: [
					{ title: "Quantified Results", level: 2, prompt: "Present measurable business outcomes and ROI." },
					{ title: "Customer Quote", level: 2, prompt: "Include customer testimonial or quote." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Customer Name", variableName: "{{customer}}", description: "Customer company name", type: "text", required: true },
			{ id: "p2", name: "Industry", variableName: "{{industry}}", description: "Customer industry", type: "text", required: true },
		],
	},
	{
		name: "Product Launch Plan",
		description: "Comprehensive product launch plan and checklist.",
		categoryIds: ["marketing", "product"],
		tags: ["launch", "product", "plan", "release", "marketing"],
		difficulty: "advanced",
		estimatedTime: 150,
		sections: [
			{
				title: "Launch Overview",
				level: 1,
				prompt: "Define launch objectives and scope.",
				subsections: [
					{ title: "Product Overview", level: 2, prompt: "Describe the product being launched." },
					{ title: "Launch Objectives", level: 2, prompt: "Define specific launch goals and success metrics." },
					{ title: "Target Audience", level: 2, prompt: "Identify primary and secondary target audiences." },
				],
			},
			{
				title: "Launch Strategy",
				level: 1,
				prompt: "Define the launch strategy.",
				subsections: [
					{ title: "Positioning and Messaging", level: 2, prompt: "Define product positioning and key messages." },
					{ title: "Pricing Strategy", level: 2, prompt: "Finalize pricing and packaging strategy." },
					{ title: "Channel Strategy", level: 2, prompt: "Define launch channels and partnerships." },
				],
			},
			{
				title: "Launch Activities",
				level: 1,
				prompt: "Plan launch activities.",
				subsections: [
					{ title: "Marketing Activities", level: 2, prompt: "Plan campaigns, content, PR, and events." },
					{ title: "Sales Enablement", level: 2, prompt: "Prepare sales training, tools, and collateral." },
					{ title: "Customer Success", level: 2, prompt: "Plan onboarding, support, and success resources." },
				],
			},
			{
				title: "Launch Timeline",
				level: 1,
				prompt: "Create detailed launch timeline.",
				subsections: [
					{ title: "Pre-Launch", level: 2, prompt: "Define pre-launch activities and milestones." },
					{ title: "Launch Day", level: 2, prompt: "Plan launch day activities and coordination." },
					{ title: "Post-Launch", level: 2, prompt: "Define post-launch follow-up and optimization." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Product Name", variableName: "{{product}}", description: "Product name", type: "text", required: true },
			{ id: "p2", name: "Launch Date", variableName: "{{launch_date}}", description: "Target launch date", type: "date", required: true },
		],
	},
	{
		name: "Press Release",
		description: "Professional press release for company announcements.",
		categoryIds: ["marketing", "comms"],
		tags: ["press-release", "pr", "announcement", "media", "communications"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Headline and Lead",
				level: 1,
				prompt: "Create compelling headline and lead paragraph.",
				subsections: [
					{ title: "Headline", level: 2, prompt: "Write attention-grabbing headline summarizing news." },
					{ title: "Lead Paragraph", level: 2, prompt: "Summarize who, what, when, where, why in opening paragraph." },
				],
			},
			{
				title: "Body",
				level: 1,
				prompt: "Develop the press release body.",
				subsections: [
					{ title: "News Details", level: 2, prompt: "Provide detailed information about the announcement." },
					{ title: "Quotes", level: 2, prompt: "Include quotes from executives or stakeholders." },
					{ title: "Supporting Information", level: 2, prompt: "Add relevant context, data, or background." },
				],
			},
			{
				title: "Boilerplate",
				level: 1,
				prompt: "Include standard company information.",
				subsections: [
					{ title: "About Company", level: 2, prompt: "Standard company description paragraph." },
					{ title: "Contact Information", level: 2, prompt: "Media contact details." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Announcement", variableName: "{{announcement}}", description: "Brief announcement description", type: "text", required: true },
		],
	},
	{
		name: "Brand Guidelines Document",
		description: "Comprehensive brand guidelines and style guide.",
		categoryIds: ["marketing", "design"],
		tags: ["brand", "guidelines", "identity", "style-guide", "design"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Brand Overview",
				level: 1,
				prompt: "Introduce the brand.",
				subsections: [
					{ title: "Brand Story", level: 2, prompt: "Tell the brand story and history." },
					{ title: "Mission and Values", level: 2, prompt: "Define mission, vision, and core values." },
					{ title: "Brand Personality", level: 2, prompt: "Describe brand personality and attributes." },
				],
			},
			{
				title: "Visual Identity",
				level: 1,
				prompt: "Define visual identity standards.",
				subsections: [
					{ title: "Logo Usage", level: 2, prompt: "Define logo versions, spacing, and usage rules." },
					{ title: "Color Palette", level: 2, prompt: "Specify primary and secondary colors with codes." },
					{ title: "Typography", level: 2, prompt: "Define typefaces and typographic hierarchy." },
					{ title: "Imagery Style", level: 2, prompt: "Define photography and illustration style." },
				],
			},
			{
				title: "Voice and Tone",
				level: 1,
				prompt: "Define verbal identity.",
				subsections: [
					{ title: "Brand Voice", level: 2, prompt: "Define the brand voice characteristics." },
					{ title: "Tone Guidelines", level: 2, prompt: "Provide tone guidance for different contexts." },
					{ title: "Writing Style", level: 2, prompt: "Define writing style and grammar preferences." },
				],
			},
			{
				title: "Applications",
				level: 1,
				prompt: "Show brand applications.",
				subsections: [
					{ title: "Digital Applications", level: 2, prompt: "Guidelines for web, social, email applications." },
					{ title: "Print Applications", level: 2, prompt: "Guidelines for print materials and collateral." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Brand Name", variableName: "{{brand}}", description: "Brand name", type: "text", required: true },
		],
	},
];

// ============================================================================
// TECHNICAL & ENGINEERING TEMPLATES
// ============================================================================

export const TECHNICAL_ENGINEERING_TEMPLATES: TemplateDef[] = [
	{
		name: "System Architecture Document",
		description: "Technical system architecture documentation for software systems.",
		categoryIds: ["tech", "architecture", "software"],
		tags: ["architecture", "system", "technical", "design", "documentation"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Architecture Overview",
				level: 1,
				prompt: "Provide high-level architecture overview.",
				subsections: [
					{ title: "System Context", level: 2, prompt: "Describe system purpose and context within broader ecosystem." },
					{ title: "Architecture Principles", level: 2, prompt: "State guiding architecture principles and constraints." },
					{ title: "High-Level Architecture", level: 2, prompt: "Present high-level architecture diagram and description." },
				],
			},
			{
				title: "Component Architecture",
				level: 1,
				prompt: "Detail system components.",
				subsections: [
					{ title: "Component Overview", level: 2, prompt: "Describe major components and their responsibilities." },
					{ title: "Component Interactions", level: 2, prompt: "Document how components interact and communicate." },
					{ title: "Component Diagrams", level: 2, prompt: "Provide component and deployment diagrams." },
				],
			},
			{
				title: "Data Architecture",
				level: 1,
				prompt: "Define data architecture.",
				subsections: [
					{ title: "Data Model", level: 2, prompt: "Document logical and physical data models." },
					{ title: "Data Flow", level: 2, prompt: "Describe data flows between components." },
					{ title: "Data Storage", level: 2, prompt: "Define data storage technologies and strategies." },
				],
			},
			{
				title: "Integration Architecture",
				level: 1,
				prompt: "Document integration patterns.",
				subsections: [
					{ title: "External Integrations", level: 2, prompt: "Document external system integrations and APIs." },
					{ title: "Integration Patterns", level: 2, prompt: "Describe integration patterns used (sync, async, event-driven)." },
				],
			},
			{
				title: "Non-Functional Requirements",
				level: 1,
				prompt: "Address non-functional requirements.",
				subsections: [
					{ title: "Scalability", level: 2, prompt: "Describe scalability approach and capacity planning." },
					{ title: "Security", level: 2, prompt: "Document security architecture and controls." },
					{ title: "Availability", level: 2, prompt: "Define availability, reliability, and disaster recovery." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "System Name", variableName: "{{system}}", description: "System name", type: "text", required: true },
			{ id: "p2", name: "Version", variableName: "{{version}}", description: "Document version", type: "text", required: true },
		],
	},
	{
		name: "API Documentation",
		description: "REST/GraphQL API documentation template.",
		categoryIds: ["tech", "software", "architecture"],
		tags: ["api", "documentation", "rest", "graphql", "developer"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "API Overview",
				level: 1,
				prompt: "Introduce the API.",
				subsections: [
					{ title: "Introduction", level: 2, prompt: "Describe API purpose and capabilities." },
					{ title: "Base URL and Versioning", level: 2, prompt: "Document base URL, versioning strategy, and environments." },
				],
			},
			{
				title: "Authentication",
				level: 1,
				prompt: "Document authentication.",
				subsections: [
					{ title: "Authentication Methods", level: 2, prompt: "Describe supported authentication methods (OAuth, API keys, JWT)." },
					{ title: "Authorization", level: 2, prompt: "Document authorization scopes and permissions." },
				],
			},
			{
				title: "Endpoints",
				level: 1,
				prompt: "Document API endpoints.",
				subsections: [
					{ title: "Endpoint Reference", level: 2, prompt: "List all endpoints with methods, paths, and descriptions." },
					{ title: "Request/Response", level: 2, prompt: "Document request parameters and response schemas." },
					{ title: "Examples", level: 2, prompt: "Provide request/response examples for each endpoint." },
				],
			},
			{
				title: "Error Handling",
				level: 1,
				prompt: "Document error handling.",
				subsections: [
					{ title: "Error Codes", level: 2, prompt: "List error codes and their meanings." },
					{ title: "Error Response Format", level: 2, prompt: "Document error response structure." },
				],
			},
			{
				title: "Rate Limiting",
				level: 1,
				prompt: "Document rate limiting and quotas.",
				subsections: [
					{ title: "Rate Limits", level: 2, prompt: "Define rate limits and quotas." },
					{ title: "Best Practices", level: 2, prompt: "Provide usage best practices and optimization tips." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "API Name", variableName: "{{api_name}}", description: "API name", type: "text", required: true },
			{ id: "p2", name: "Version", variableName: "{{version}}", description: "API version", type: "text", required: true },
		],
	},
	{
		name: "Technical Design Document",
		description: "Detailed technical design document for feature implementation.",
		categoryIds: ["tech", "software", "architecture"],
		tags: ["tdd", "design", "technical", "implementation", "engineering"],
		difficulty: "advanced",
		estimatedTime: 150,
		sections: [
			{
				title: "Overview",
				level: 1,
				prompt: "Introduce the design.",
				subsections: [
					{ title: "Problem Statement", level: 2, prompt: "Define the problem being solved." },
					{ title: "Goals and Non-Goals", level: 2, prompt: "State explicit goals and non-goals." },
					{ title: "Background", level: 2, prompt: "Provide relevant technical context." },
				],
			},
			{
				title: "Proposed Design",
				level: 1,
				prompt: "Present the proposed design.",
				subsections: [
					{ title: "High-Level Design", level: 2, prompt: "Describe overall approach and architecture changes." },
					{ title: "Detailed Design", level: 2, prompt: "Document detailed implementation design." },
					{ title: "Data Model Changes", level: 2, prompt: "Define database/schema changes." },
					{ title: "API Changes", level: 2, prompt: "Document API additions or modifications." },
				],
			},
			{
				title: "Alternatives Considered",
				level: 1,
				prompt: "Document alternatives.",
				subsections: [
					{ title: "Alternative Approaches", level: 2, prompt: "Describe alternative designs considered." },
					{ title: "Trade-off Analysis", level: 2, prompt: "Analyze trade-offs and justify chosen approach." },
				],
			},
			{
				title: "Implementation Plan",
				level: 1,
				prompt: "Plan implementation.",
				subsections: [
					{ title: "Milestones", level: 2, prompt: "Break down implementation into milestones." },
					{ title: "Testing Strategy", level: 2, prompt: "Define testing approach and coverage." },
					{ title: "Rollout Plan", level: 2, prompt: "Plan for deployment and rollout." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Feature Name", variableName: "{{feature}}", description: "Feature name", type: "text", required: true },
			{ id: "p2", name: "Author", variableName: "{{author}}", description: "Document author", type: "text", required: true },
		],
	},
	{
		name: "Incident Post-Mortem",
		description: "Post-incident review and root cause analysis document.",
		categoryIds: ["tech", "operations", "qa"],
		tags: ["incident", "post-mortem", "rca", "outage", "analysis"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Incident Summary",
				level: 1,
				prompt: "Summarize the incident.",
				subsections: [
					{ title: "Incident Overview", level: 2, prompt: "Brief description of what happened." },
					{ title: "Impact", level: 2, prompt: "Quantify impact: users affected, duration, revenue loss." },
					{ title: "Timeline", level: 2, prompt: "Detailed timeline of events from detection to resolution." },
				],
			},
			{
				title: "Root Cause Analysis",
				level: 1,
				prompt: "Analyze root cause.",
				subsections: [
					{ title: "Root Cause", level: 2, prompt: "Identify the root cause(s) of the incident." },
					{ title: "Contributing Factors", level: 2, prompt: "Identify contributing factors that enabled or worsened the incident." },
					{ title: "Five Whys", level: 2, prompt: "Apply Five Whys analysis to get to underlying cause." },
				],
			},
			{
				title: "Response Evaluation",
				level: 1,
				prompt: "Evaluate incident response.",
				subsections: [
					{ title: "What Went Well", level: 2, prompt: "Identify what worked well in the response." },
					{ title: "What Could Be Improved", level: 2, prompt: "Identify areas for improvement in response." },
				],
			},
			{
				title: "Action Items",
				level: 1,
				prompt: "Define follow-up actions.",
				subsections: [
					{ title: "Preventive Actions", level: 2, prompt: "Actions to prevent recurrence." },
					{ title: "Detective Actions", level: 2, prompt: "Improvements to detection and monitoring." },
					{ title: "Process Improvements", level: 2, prompt: "Process changes to improve future response." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Incident ID", variableName: "{{incident_id}}", description: "Incident identifier", type: "text", required: true },
			{ id: "p2", name: "Incident Date", variableName: "{{incident_date}}", description: "Date of incident", type: "date", required: true },
		],
	},
	{
		name: "Runbook / Operations Playbook",
		description: "Operations runbook for routine procedures and incident response.",
		categoryIds: ["tech", "operations", "devops"],
		tags: ["runbook", "playbook", "operations", "procedures", "sre"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Overview",
				level: 1,
				prompt: "Introduce the runbook.",
				subsections: [
					{ title: "Purpose", level: 2, prompt: "Describe the purpose and scope of this runbook." },
					{ title: "Prerequisites", level: 2, prompt: "List required access, tools, and knowledge." },
				],
			},
			{
				title: "Procedures",
				level: 1,
				prompt: "Document operational procedures.",
				subsections: [
					{ title: "Step-by-Step Instructions", level: 2, prompt: "Provide detailed step-by-step procedures." },
					{ title: "Verification Steps", level: 2, prompt: "Include verification steps after each major action." },
					{ title: "Rollback Procedures", level: 2, prompt: "Document how to rollback if something goes wrong." },
				],
			},
			{
				title: "Troubleshooting",
				level: 1,
				prompt: "Provide troubleshooting guidance.",
				subsections: [
					{ title: "Common Issues", level: 2, prompt: "List common issues and their resolutions." },
					{ title: "Diagnostic Commands", level: 2, prompt: "Provide useful diagnostic commands and queries." },
				],
			},
			{
				title: "Escalation",
				level: 1,
				prompt: "Define escalation procedures.",
				subsections: [
					{ title: "Escalation Criteria", level: 2, prompt: "Define when to escalate." },
					{ title: "Escalation Contacts", level: 2, prompt: "List escalation contacts and communication channels." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "System/Service", variableName: "{{system}}", description: "System or service name", type: "text", required: true },
			{ id: "p2", name: "Procedure", variableName: "{{procedure}}", description: "Procedure name", type: "text", required: true },
		],
	},
	{
		name: "Disaster Recovery Plan",
		description: "IT disaster recovery plan for business continuity.",
		categoryIds: ["tech", "operations", "security"],
		tags: ["disaster-recovery", "dr", "business-continuity", "backup", "resilience"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Plan Overview",
				level: 1,
				prompt: "Introduce the DR plan.",
				subsections: [
					{ title: "Purpose and Scope", level: 2, prompt: "Define purpose, scope, and systems covered." },
					{ title: "Recovery Objectives", level: 2, prompt: "Define RTO and RPO for each system/service." },
					{ title: "Roles and Responsibilities", level: 2, prompt: "Define DR team roles and responsibilities." },
				],
			},
			{
				title: "Risk Assessment",
				level: 1,
				prompt: "Assess disaster risks.",
				subsections: [
					{ title: "Threat Analysis", level: 2, prompt: "Identify potential disaster scenarios." },
					{ title: "Impact Analysis", level: 2, prompt: "Assess business impact of each scenario." },
				],
			},
			{
				title: "Recovery Procedures",
				level: 1,
				prompt: "Document recovery procedures.",
				subsections: [
					{ title: "Declaration Criteria", level: 2, prompt: "Define criteria for declaring a disaster." },
					{ title: "Recovery Steps", level: 2, prompt: "Document step-by-step recovery procedures." },
					{ title: "Validation", level: 2, prompt: "Define how to validate successful recovery." },
				],
			},
			{
				title: "Infrastructure",
				level: 1,
				prompt: "Document DR infrastructure.",
				subsections: [
					{ title: "Backup Strategy", level: 2, prompt: "Document backup procedures and schedules." },
					{ title: "DR Site", level: 2, prompt: "Describe DR site/infrastructure and failover mechanisms." },
				],
			},
			{
				title: "Testing and Maintenance",
				level: 1,
				prompt: "Plan for DR testing.",
				subsections: [
					{ title: "Testing Schedule", level: 2, prompt: "Define DR testing frequency and types." },
					{ title: "Plan Maintenance", level: 2, prompt: "Define how the DR plan is maintained and updated." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "System", variableName: "{{system}}", description: "Primary system covered", type: "text", required: true },
		],
	},
	{
		name: "Database Design Document",
		description: "Database schema design and documentation.",
		categoryIds: ["tech", "data", "architecture"],
		tags: ["database", "schema", "design", "data-model", "sql"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Database Overview",
				level: 1,
				prompt: "Introduce the database design.",
				subsections: [
					{ title: "Purpose", level: 2, prompt: "Describe database purpose and the application it supports." },
					{ title: "Technology Stack", level: 2, prompt: "Specify DBMS and related technologies." },
				],
			},
			{
				title: "Data Model",
				level: 1,
				prompt: "Document the data model.",
				subsections: [
					{ title: "Entity Relationship Diagram", level: 2, prompt: "Provide ER diagram and description." },
					{ title: "Table Definitions", level: 2, prompt: "Document each table with columns, types, and constraints." },
					{ title: "Relationships", level: 2, prompt: "Document foreign keys and relationships." },
				],
			},
			{
				title: "Indexing Strategy",
				level: 1,
				prompt: "Document indexing approach.",
				subsections: [
					{ title: "Index Definitions", level: 2, prompt: "List indexes with columns and rationale." },
					{ title: "Query Patterns", level: 2, prompt: "Document expected query patterns driving index design." },
				],
			},
			{
				title: "Data Management",
				level: 1,
				prompt: "Address data management.",
				subsections: [
					{ title: "Data Retention", level: 2, prompt: "Define data retention and archival policies." },
					{ title: "Backup Strategy", level: 2, prompt: "Document backup and recovery procedures." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Database Name", variableName: "{{database}}", description: "Database name", type: "text", required: true },
			{ id: "p2", name: "Application", variableName: "{{application}}", description: "Application name", type: "text", required: true },
		],
	},
	{
		name: "Security Assessment Report",
		description: "Security assessment and vulnerability report.",
		categoryIds: ["security", "tech", "compliance"],
		tags: ["security", "assessment", "vulnerability", "pentest", "audit"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize assessment findings.",
				subsections: [
					{ title: "Assessment Overview", level: 2, prompt: "Describe scope, methodology, and timeline." },
					{ title: "Key Findings", level: 2, prompt: "Summarize critical and high-risk findings." },
					{ title: "Risk Rating", level: 2, prompt: "Provide overall security risk rating." },
				],
			},
			{
				title: "Methodology",
				level: 1,
				prompt: "Document assessment methodology.",
				subsections: [
					{ title: "Scope", level: 2, prompt: "Define systems, networks, and applications in scope." },
					{ title: "Testing Approach", level: 2, prompt: "Describe testing methodology and tools used." },
				],
			},
			{
				title: "Findings",
				level: 1,
				prompt: "Document detailed findings.",
				subsections: [
					{ title: "Vulnerability Details", level: 2, prompt: "Document each vulnerability: description, severity, evidence." },
					{ title: "Risk Analysis", level: 2, prompt: "Analyze risk: likelihood, impact, and exploitability." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide remediation recommendations.",
				subsections: [
					{ title: "Remediation Steps", level: 2, prompt: "Provide specific remediation steps for each finding." },
					{ title: "Prioritization", level: 2, prompt: "Prioritize remediation based on risk." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Target", variableName: "{{target}}", description: "Assessment target", type: "text", required: true },
			{ id: "p2", name: "Assessment Date", variableName: "{{assessment_date}}", description: "Assessment date", type: "date", required: true },
		],
	},
];

// ============================================================================
// CORPORATE GOVERNANCE TEMPLATES
// ============================================================================

export const CORPORATE_GOVERNANCE_TEMPLATES: TemplateDef[] = [
	{
		name: "Board Meeting Minutes",
		description: "Official minutes of board of directors meeting.",
		categoryIds: ["governance", "corporate"],
		tags: ["board", "minutes", "meeting", "governance", "corporate"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Meeting Details",
				level: 1,
				prompt: "Record meeting details.",
				subsections: [
					{ title: "Date, Time, Location", level: 2, prompt: "Record date, time, and location of meeting." },
					{ title: "Attendance", level: 2, prompt: "List directors present, absent, and guests." },
					{ title: "Quorum", level: 2, prompt: "Confirm quorum was present." },
				],
			},
			{
				title: "Proceedings",
				level: 1,
				prompt: "Document meeting proceedings.",
				subsections: [
					{ title: "Call to Order", level: 2, prompt: "Record meeting called to order and chairman." },
					{ title: "Approval of Prior Minutes", level: 2, prompt: "Record approval of previous meeting minutes." },
					{ title: "Reports", level: 2, prompt: "Summarize reports presented (CEO, CFO, committee reports)." },
				],
			},
			{
				title: "Business Discussed",
				level: 1,
				prompt: "Document matters discussed.",
				subsections: [
					{ title: "Agenda Items", level: 2, prompt: "Record each agenda item and discussion summary." },
					{ title: "Resolutions", level: 2, prompt: "Record all resolutions proposed, seconded, and voted upon." },
				],
			},
			{
				title: "Adjournment",
				level: 1,
				prompt: "Record meeting adjournment.",
				subsections: [
					{ title: "Next Meeting", level: 2, prompt: "Record date/time of next meeting." },
					{ title: "Adjournment", level: 2, prompt: "Record motion to adjourn and approval." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Meeting Date", variableName: "{{meeting_date}}", description: "Meeting date", type: "date", required: true },
		],
	},
	{
		name: "Annual Report",
		description: "Corporate annual report for shareholders and stakeholders.",
		categoryIds: ["governance", "corporate", "finance"],
		tags: ["annual-report", "shareholders", "corporate", "governance", "financials"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Letter to Shareholders",
				level: 1,
				prompt: "CEO/Chairman letter to shareholders.",
				subsections: [
					{ title: "Year in Review", level: 2, prompt: "Summarize key achievements and challenges of the year." },
					{ title: "Strategic Outlook", level: 2, prompt: "Discuss strategic direction and future outlook." },
				],
			},
			{
				title: "Business Overview",
				level: 1,
				prompt: "Describe the business.",
				subsections: [
					{ title: "Company Overview", level: 2, prompt: "Describe the company, products, services, and markets." },
					{ title: "Business Highlights", level: 2, prompt: "Highlight key business accomplishments." },
					{ title: "Market Position", level: 2, prompt: "Discuss competitive position and market dynamics." },
				],
			},
			{
				title: "Financial Review",
				level: 1,
				prompt: "Review financial performance.",
				subsections: [
					{ title: "Financial Highlights", level: 2, prompt: "Present key financial metrics and year-over-year comparison." },
					{ title: "Management Discussion", level: 2, prompt: "Provide MD&A of financial condition and results." },
				],
			},
			{
				title: "Corporate Governance",
				level: 1,
				prompt: "Document governance practices.",
				subsections: [
					{ title: "Board of Directors", level: 2, prompt: "List board members with bios and committee assignments." },
					{ title: "Executive Team", level: 2, prompt: "Profile executive leadership team." },
					{ title: "Governance Practices", level: 2, prompt: "Describe corporate governance practices and policies." },
				],
			},
			{
				title: "Financial Statements",
				level: 1,
				prompt: "Include audited financial statements.",
				subsections: [
					{ title: "Auditor's Report", level: 2, prompt: "Include independent auditor's report." },
					{ title: "Financial Statements", level: 2, prompt: "Include balance sheet, income statement, cash flow, and notes." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Fiscal Year", variableName: "{{fiscal_year}}", description: "Fiscal year", type: "text", required: true },
		],
	},
	{
		name: "Investor Update / Quarterly Report",
		description: "Quarterly investor update and business report.",
		categoryIds: ["governance", "corporate", "finance"],
		tags: ["investor", "quarterly", "update", "shareholders", "report"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize quarterly performance.",
				subsections: [
					{ title: "Quarter Highlights", level: 2, prompt: "Summarize key achievements and milestones." },
					{ title: "Financial Summary", level: 2, prompt: "Present key financial metrics for the quarter." },
				],
			},
			{
				title: "Business Update",
				level: 1,
				prompt: "Provide business update.",
				subsections: [
					{ title: "Operational Update", level: 2, prompt: "Update on key operational metrics and initiatives." },
					{ title: "Product/Market Update", level: 2, prompt: "Update on product development and market traction." },
					{ title: "Team Update", level: 2, prompt: "Note key hires or organizational changes." },
				],
			},
			{
				title: "Financial Performance",
				level: 1,
				prompt: "Detail financial performance.",
				subsections: [
					{ title: "Revenue", level: 2, prompt: "Report revenue with breakdown and growth analysis." },
					{ title: "Expenses and Profitability", level: 2, prompt: "Report expenses, margins, and profitability." },
					{ title: "Cash Position", level: 2, prompt: "Report cash position and runway." },
				],
			},
			{
				title: "Outlook",
				level: 1,
				prompt: "Provide forward-looking guidance.",
				subsections: [
					{ title: "Next Quarter Priorities", level: 2, prompt: "Outline priorities for the coming quarter." },
					{ title: "Guidance", level: 2, prompt: "Provide financial guidance if applicable." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Quarter", variableName: "{{quarter}}", description: "Quarter (e.g., Q1 2024)", type: "text", required: true },
		],
	},
	{
		name: "Corporate Bylaws",
		description: "Corporate bylaws governing company operations.",
		categoryIds: ["governance", "corporate", "legal"],
		tags: ["bylaws", "corporate", "governance", "legal", "formation"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "General Provisions",
				level: 1,
				prompt: "Establish general corporate provisions.",
				subsections: [
					{ title: "Name and Purpose", level: 2, prompt: "State corporate name and business purpose." },
					{ title: "Offices", level: 2, prompt: "Define principal office and other office locations." },
					{ title: "Fiscal Year", level: 2, prompt: "Define fiscal year." },
				],
			},
			{
				title: "Shareholders",
				level: 1,
				prompt: "Define shareholder rights and meetings.",
				subsections: [
					{ title: "Annual Meeting", level: 2, prompt: "Define annual shareholder meeting requirements." },
					{ title: "Special Meetings", level: 2, prompt: "Define when and how special meetings may be called." },
					{ title: "Voting Rights", level: 2, prompt: "Define voting rights and procedures." },
					{ title: "Quorum", level: 2, prompt: "Define quorum requirements for shareholder meetings." },
				],
			},
			{
				title: "Board of Directors",
				level: 1,
				prompt: "Define board structure and powers.",
				subsections: [
					{ title: "Powers", level: 2, prompt: "Define powers and responsibilities of the board." },
					{ title: "Composition", level: 2, prompt: "Define number of directors and qualifications." },
					{ title: "Election and Term", level: 2, prompt: "Define election process and term of directors." },
					{ title: "Meetings", level: 2, prompt: "Define board meeting requirements and procedures." },
					{ title: "Committees", level: 2, prompt: "Authorize board committees and their powers." },
				],
			},
			{
				title: "Officers",
				level: 1,
				prompt: "Define corporate officers.",
				subsections: [
					{ title: "Officer Positions", level: 2, prompt: "Define required and optional officer positions." },
					{ title: "Duties", level: 2, prompt: "Define duties of each officer position." },
					{ title: "Appointment and Removal", level: 2, prompt: "Define how officers are appointed and removed." },
				],
			},
			{
				title: "Stock",
				level: 1,
				prompt: "Define stock provisions.",
				subsections: [
					{ title: "Stock Certificates", level: 2, prompt: "Define stock certificate requirements." },
					{ title: "Transfer of Stock", level: 2, prompt: "Define stock transfer procedures." },
				],
			},
			{
				title: "Amendments",
				level: 1,
				prompt: "Define amendment procedures.",
				subsections: [
					{ title: "Amendment Process", level: 2, prompt: "Define how bylaws may be amended." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Corporation Name", variableName: "{{corporation}}", description: "Corporation name", type: "text", required: true },
			{ id: "p2", name: "State", variableName: "{{state}}", description: "State of incorporation", type: "text", required: true },
		],
	},
	{
		name: "Shareholders Agreement",
		description: "Agreement governing rights and obligations of shareholders.",
		categoryIds: ["governance", "legal", "corporate"],
		tags: ["shareholders", "agreement", "equity", "governance", "legal"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Parties and Recitals",
				level: 1,
				prompt: "Identify parties and context.",
				subsections: [
					{ title: "Party Identification", level: 2, prompt: "Identify all shareholders party to the agreement." },
					{ title: "Recitals", level: 2, prompt: "Describe context and purpose of the agreement." },
				],
			},
			{
				title: "Governance",
				level: 1,
				prompt: "Define governance provisions.",
				subsections: [
					{ title: "Board Composition", level: 2, prompt: "Define board composition and appointment rights." },
					{ title: "Reserved Matters", level: 2, prompt: "List matters requiring shareholder approval." },
					{ title: "Information Rights", level: 2, prompt: "Define shareholder information rights." },
				],
			},
			{
				title: "Transfer Restrictions",
				level: 1,
				prompt: "Define share transfer restrictions.",
				subsections: [
					{ title: "Right of First Refusal", level: 2, prompt: "Define ROFR process for proposed transfers." },
					{ title: "Co-Sale Rights", level: 2, prompt: "Define tag-along/co-sale rights." },
					{ title: "Drag-Along Rights", level: 2, prompt: "Define drag-along rights and triggers." },
				],
			},
			{
				title: "Exit Provisions",
				level: 1,
				prompt: "Define exit-related provisions.",
				subsections: [
					{ title: "IPO", level: 2, prompt: "Address IPO-related provisions and lock-ups." },
					{ title: "Acquisition", level: 2, prompt: "Define rights and procedures for acquisition." },
				],
			},
			{
				title: "General Provisions",
				level: 1,
				prompt: "Include standard provisions.",
				subsections: [
					{ title: "Confidentiality", level: 2, prompt: "Include confidentiality obligations." },
					{ title: "Dispute Resolution", level: 2, prompt: "Define dispute resolution mechanism." },
					{ title: "Governing Law", level: 2, prompt: "Specify governing law." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Shareholders", variableName: "{{shareholders}}", description: "Shareholder names", type: "textarea", required: true },
		],
	},
	{
		name: "Board Resolution",
		description: "Formal board resolution for corporate actions.",
		categoryIds: ["governance", "corporate", "legal"],
		tags: ["resolution", "board", "corporate", "governance", "approval"],
		difficulty: "beginner",
		estimatedTime: 30,
		sections: [
			{
				title: "Resolution Header",
				level: 1,
				prompt: "Identify the resolution.",
				subsections: [
					{ title: "Company and Date", level: 2, prompt: "State company name and resolution date." },
					{ title: "Meeting Context", level: 2, prompt: "State whether adopted at meeting or by written consent." },
				],
			},
			{
				title: "Whereas Clauses",
				level: 1,
				prompt: "Provide background recitals.",
				subsections: [
					{ title: "Background", level: 2, prompt: "State relevant background facts justifying the resolution." },
				],
			},
			{
				title: "Resolved Clauses",
				level: 1,
				prompt: "State the resolutions.",
				subsections: [
					{ title: "Primary Resolution", level: 2, prompt: "State the primary action being authorized." },
					{ title: "Authorization", level: 2, prompt: "Authorize officers to take necessary actions." },
					{ title: "Ratification", level: 2, prompt: "Ratify any prior actions if applicable." },
				],
			},
			{
				title: "Certification",
				level: 1,
				prompt: "Certify the resolution.",
				subsections: [
					{ title: "Secretary Certification", level: 2, prompt: "Include secretary's certification of adoption." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Resolution Subject", variableName: "{{subject}}", description: "Subject of resolution", type: "text", required: true },
		],
	},
];

// ============================================================================
// RESEARCH & PRODUCT TEMPLATES
// ============================================================================

export const RESEARCH_PRODUCT_TEMPLATES: TemplateDef[] = [
	{
		name: "Product Requirements Document (PRD)",
		description: "Comprehensive product requirements document for feature development.",
		categoryIds: ["product", "requirements", "tech"],
		tags: ["prd", "product", "requirements", "features", "specification"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Overview",
				level: 1,
				prompt: "Introduce the product/feature.",
				subsections: [
					{ title: "Problem Statement", level: 2, prompt: "Define the problem being solved and why it matters." },
					{ title: "Goals and Success Metrics", level: 2, prompt: "Define measurable goals and success criteria." },
					{ title: "User Stories", level: 2, prompt: "Capture key user stories and use cases." },
				],
			},
			{
				title: "Requirements",
				level: 1,
				prompt: "Detail product requirements.",
				subsections: [
					{ title: "Functional Requirements", level: 2, prompt: "List detailed functional requirements with priority." },
					{ title: "Non-Functional Requirements", level: 2, prompt: "Define performance, security, scalability requirements." },
					{ title: "User Experience", level: 2, prompt: "Describe UX requirements and user flows." },
				],
			},
			{
				title: "Design",
				level: 1,
				prompt: "Provide design direction.",
				subsections: [
					{ title: "Wireframes/Mockups", level: 2, prompt: "Reference or describe key UI designs." },
					{ title: "User Flows", level: 2, prompt: "Document primary user flows." },
				],
			},
			{
				title: "Technical Considerations",
				level: 1,
				prompt: "Address technical aspects.",
				subsections: [
					{ title: "Technical Constraints", level: 2, prompt: "Note technical constraints and dependencies." },
					{ title: "Integration Requirements", level: 2, prompt: "Define integration points with other systems." },
				],
			},
			{
				title: "Release Plan",
				level: 1,
				prompt: "Plan the release.",
				subsections: [
					{ title: "Milestones", level: 2, prompt: "Define development milestones and timeline." },
					{ title: "Launch Plan", level: 2, prompt: "Outline launch strategy and rollout plan." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Product/Feature", variableName: "{{product}}", description: "Product or feature name", type: "text", required: true },
			{ id: "p2", name: "Product Manager", variableName: "{{pm}}", description: "Product manager", type: "text", required: true },
		],
	},
	{
		name: "User Research Report",
		description: "User research findings and insights report.",
		categoryIds: ["product", "research", "cx"],
		tags: ["user-research", "ux", "insights", "personas", "interviews"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Research Overview",
				level: 1,
				prompt: "Introduce the research.",
				subsections: [
					{ title: "Research Objectives", level: 2, prompt: "Define research questions and objectives." },
					{ title: "Methodology", level: 2, prompt: "Describe research methods used." },
					{ title: "Participants", level: 2, prompt: "Describe participant demographics and recruitment." },
				],
			},
			{
				title: "Key Findings",
				level: 1,
				prompt: "Present research findings.",
				subsections: [
					{ title: "Major Themes", level: 2, prompt: "Identify and describe major themes from research." },
					{ title: "User Needs", level: 2, prompt: "Document user needs, pain points, and goals." },
					{ title: "Behavioral Insights", level: 2, prompt: "Describe observed user behaviors and patterns." },
				],
			},
			{
				title: "Personas",
				level: 1,
				prompt: "Present user personas.",
				subsections: [
					{ title: "Persona Profiles", level: 2, prompt: "Create detailed persona profiles." },
					{ title: "Journey Maps", level: 2, prompt: "Map user journeys for key personas." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide actionable recommendations.",
				subsections: [
					{ title: "Design Recommendations", level: 2, prompt: "Provide design recommendations based on findings." },
					{ title: "Product Opportunities", level: 2, prompt: "Identify product opportunities." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Research Topic", variableName: "{{topic}}", description: "Research topic", type: "text", required: true },
			{ id: "p2", name: "Researcher", variableName: "{{researcher}}", description: "Lead researcher", type: "text", required: true },
		],
	},
	{
		name: "Research Proposal",
		description: "Academic or commercial research proposal.",
		categoryIds: ["research", "academic"],
		tags: ["research", "proposal", "academic", "study", "methodology"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Introduction",
				level: 1,
				prompt: "Introduce the research.",
				subsections: [
					{ title: "Background", level: 2, prompt: "Provide background and context for the research." },
					{ title: "Problem Statement", level: 2, prompt: "Define the research problem and significance." },
					{ title: "Research Questions", level: 2, prompt: "State specific research questions or hypotheses." },
				],
			},
			{
				title: "Literature Review",
				level: 1,
				prompt: "Review relevant literature.",
				subsections: [
					{ title: "Current Knowledge", level: 2, prompt: "Summarize current state of knowledge." },
					{ title: "Research Gap", level: 2, prompt: "Identify gaps this research will address." },
				],
			},
			{
				title: "Methodology",
				level: 1,
				prompt: "Describe research methodology.",
				subsections: [
					{ title: "Research Design", level: 2, prompt: "Describe overall research design and approach." },
					{ title: "Data Collection", level: 2, prompt: "Define data collection methods and sources." },
					{ title: "Analysis Methods", level: 2, prompt: "Describe data analysis methods." },
				],
			},
			{
				title: "Project Plan",
				level: 1,
				prompt: "Plan the research project.",
				subsections: [
					{ title: "Timeline", level: 2, prompt: "Provide research timeline with milestones." },
					{ title: "Resources", level: 2, prompt: "Identify required resources and budget." },
				],
			},
			{
				title: "Expected Outcomes",
				level: 1,
				prompt: "Describe expected outcomes.",
				subsections: [
					{ title: "Deliverables", level: 2, prompt: "Define research deliverables." },
					{ title: "Impact", level: 2, prompt: "Describe expected impact and applications." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Research Title", variableName: "{{title}}", description: "Research title", type: "text", required: true },
			{ id: "p2", name: "Principal Investigator", variableName: "{{pi}}", description: "Lead researcher", type: "text", required: true },
		],
	},
	{
		name: "Technical White Paper",
		description: "Technical white paper for thought leadership and education.",
		categoryIds: ["tech", "marketing", "research"],
		tags: ["white-paper", "technical", "thought-leadership", "education", "research"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the white paper.",
				subsections: [
					{ title: "Overview", level: 2, prompt: "Provide high-level summary of the paper." },
					{ title: "Key Takeaways", level: 2, prompt: "List key takeaways for the reader." },
				],
			},
			{
				title: "Problem Definition",
				level: 1,
				prompt: "Define the problem space.",
				subsections: [
					{ title: "Industry Challenge", level: 2, prompt: "Describe the industry challenge or problem." },
					{ title: "Current Approaches", level: 2, prompt: "Review current approaches and limitations." },
				],
			},
			{
				title: "Solution",
				level: 1,
				prompt: "Present the solution or approach.",
				subsections: [
					{ title: "Proposed Approach", level: 2, prompt: "Describe the proposed solution or methodology." },
					{ title: "Technical Details", level: 2, prompt: "Provide technical depth and implementation details." },
					{ title: "Benefits", level: 2, prompt: "Articulate benefits and advantages." },
				],
			},
			{
				title: "Evidence",
				level: 1,
				prompt: "Provide supporting evidence.",
				subsections: [
					{ title: "Case Studies", level: 2, prompt: "Include relevant case studies or examples." },
					{ title: "Data and Research", level: 2, prompt: "Reference supporting data and research." },
				],
			},
			{
				title: "Conclusion",
				level: 1,
				prompt: "Conclude the white paper.",
				subsections: [
					{ title: "Summary", level: 2, prompt: "Summarize key points." },
					{ title: "Call to Action", level: 2, prompt: "Provide clear call to action for reader." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Title", variableName: "{{title}}", description: "White paper title", type: "text", required: true },
			{ id: "p2", name: "Author", variableName: "{{author}}", description: "Author name", type: "text", required: true },
		],
	},
	{
		name: "Patent Application Summary",
		description: "Summary document for patent application preparation.",
		categoryIds: ["legal", "research", "tech"],
		tags: ["patent", "ip", "invention", "legal", "application"],
		difficulty: "advanced",
		estimatedTime: 120,
		sections: [
			{
				title: "Invention Overview",
				level: 1,
				prompt: "Describe the invention.",
				subsections: [
					{ title: "Title", level: 2, prompt: "Provide descriptive title for the invention." },
					{ title: "Technical Field", level: 2, prompt: "Define the technical field of the invention." },
					{ title: "Invention Summary", level: 2, prompt: "Summarize the invention in non-technical terms." },
				],
			},
			{
				title: "Background",
				level: 1,
				prompt: "Provide background on prior art.",
				subsections: [
					{ title: "Prior Art", level: 2, prompt: "Describe relevant prior art and existing solutions." },
					{ title: "Problem Addressed", level: 2, prompt: "Explain the problem the invention solves." },
				],
			},
			{
				title: "Detailed Description",
				level: 1,
				prompt: "Describe the invention in detail.",
				subsections: [
					{ title: "Technical Description", level: 2, prompt: "Provide detailed technical description." },
					{ title: "Embodiments", level: 2, prompt: "Describe specific embodiments and variations." },
					{ title: "Advantages", level: 2, prompt: "List advantages over prior art." },
				],
			},
			{
				title: "Claims Outline",
				level: 1,
				prompt: "Outline patent claims.",
				subsections: [
					{ title: "Independent Claims", level: 2, prompt: "Draft key independent claims." },
					{ title: "Dependent Claims", level: 2, prompt: "Draft supporting dependent claims." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Invention Title", variableName: "{{title}}", description: "Invention title", type: "text", required: true },
			{ id: "p2", name: "Inventor(s)", variableName: "{{inventors}}", description: "Inventor names", type: "textarea", required: true },
		],
	},
	{
		name: "Product Roadmap Document",
		description: "Product roadmap and strategic planning document.",
		categoryIds: ["product", "strategy", "planning"],
		tags: ["roadmap", "product", "planning", "strategy", "prioritization"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Vision and Strategy",
				level: 1,
				prompt: "Define product vision and strategy.",
				subsections: [
					{ title: "Product Vision", level: 2, prompt: "State the long-term product vision." },
					{ title: "Strategic Objectives", level: 2, prompt: "Define key strategic objectives." },
				],
			},
			{
				title: "Current State",
				level: 1,
				prompt: "Assess current state.",
				subsections: [
					{ title: "Current Product", level: 2, prompt: "Describe current product state and capabilities." },
					{ title: "Market Position", level: 2, prompt: "Assess current market position." },
				],
			},
			{
				title: "Roadmap",
				level: 1,
				prompt: "Present the roadmap.",
				subsections: [
					{ title: "Themes and Initiatives", level: 2, prompt: "Define major themes and initiatives." },
					{ title: "Timeline View", level: 2, prompt: "Present timeline with key milestones." },
					{ title: "Feature Details", level: 2, prompt: "Detail planned features by time horizon." },
				],
			},
			{
				title: "Prioritization",
				level: 1,
				prompt: "Explain prioritization approach.",
				subsections: [
					{ title: "Prioritization Framework", level: 2, prompt: "Describe prioritization methodology." },
					{ title: "Trade-offs", level: 2, prompt: "Address key trade-offs and decisions." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Product", variableName: "{{product}}", description: "Product name", type: "text", required: true },
			{ id: "p2", name: "Time Horizon", variableName: "{{horizon}}", description: "Planning horizon", type: "text", required: true },
		],
	},
];

// ============================================================================
// GRANTS & FUNDING TEMPLATES
// ============================================================================

export const GRANTS_FUNDING_TEMPLATES: TemplateDef[] = [
	{
		name: "Grant Proposal",
		description: "Foundation or government grant proposal.",
		categoryIds: ["grants", "nonprofit"],
		tags: ["grant", "proposal", "funding", "foundation", "nonprofit"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize the grant request.",
				subsections: [
					{ title: "Organization Overview", level: 2, prompt: "Briefly describe your organization." },
					{ title: "Project Summary", level: 2, prompt: "Summarize the proposed project and funding request." },
				],
			},
			{
				title: "Statement of Need",
				level: 1,
				prompt: "Establish the need.",
				subsections: [
					{ title: "Problem Description", level: 2, prompt: "Describe the problem or need being addressed." },
					{ title: "Supporting Data", level: 2, prompt: "Provide data and evidence demonstrating need." },
					{ title: "Target Population", level: 2, prompt: "Define the population to be served." },
				],
			},
			{
				title: "Project Description",
				level: 1,
				prompt: "Describe the proposed project.",
				subsections: [
					{ title: "Goals and Objectives", level: 2, prompt: "State project goals and SMART objectives." },
					{ title: "Methods and Activities", level: 2, prompt: "Describe project methods and activities." },
					{ title: "Timeline", level: 2, prompt: "Provide project timeline and milestones." },
				],
			},
			{
				title: "Evaluation",
				level: 1,
				prompt: "Define evaluation approach.",
				subsections: [
					{ title: "Outcomes", level: 2, prompt: "Define expected outcomes and indicators." },
					{ title: "Evaluation Methods", level: 2, prompt: "Describe how outcomes will be measured." },
				],
			},
			{
				title: "Budget",
				level: 1,
				prompt: "Present project budget.",
				subsections: [
					{ title: "Budget Summary", level: 2, prompt: "Provide detailed budget by category." },
					{ title: "Budget Narrative", level: 2, prompt: "Justify budget items." },
				],
			},
			{
				title: "Organizational Capacity",
				level: 1,
				prompt: "Demonstrate organizational capacity.",
				subsections: [
					{ title: "Track Record", level: 2, prompt: "Describe relevant organizational experience." },
					{ title: "Key Personnel", level: 2, prompt: "Profile key personnel for the project." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Project Title", variableName: "{{project}}", description: "Project title", type: "text", required: true },
			{ id: "p3", name: "Amount Requested", variableName: "{{amount}}", description: "Funding amount", type: "currency", required: true },
		],
	},
	{
		name: "SBIR/STTR Phase I Proposal",
		description: "Small Business Innovation Research Phase I proposal.",
		categoryIds: ["grants", "rfp", "tech"],
		tags: ["sbir", "sttr", "innovation", "research", "government"],
		difficulty: "advanced",
		estimatedTime: 300,
		sections: [
			{
				title: "Technical Abstract",
				level: 1,
				prompt: "Provide technical abstract.",
				subsections: [
					{ title: "Technical Objectives", level: 2, prompt: "State technical objectives and innovation." },
					{ title: "Approach Summary", level: 2, prompt: "Summarize technical approach." },
				],
			},
			{
				title: "Identification and Significance",
				level: 1,
				prompt: "Establish problem and significance.",
				subsections: [
					{ title: "Problem Identification", level: 2, prompt: "Clearly identify the technical problem." },
					{ title: "Innovation", level: 2, prompt: "Describe the innovative aspects of the solution." },
					{ title: "Commercial Potential", level: 2, prompt: "Discuss commercial applications and market." },
				],
			},
			{
				title: "Technical Approach",
				level: 1,
				prompt: "Detail technical approach.",
				subsections: [
					{ title: "Technical Objectives", level: 2, prompt: "Define specific technical objectives." },
					{ title: "Work Plan", level: 2, prompt: "Describe detailed work plan and methodology." },
					{ title: "Risk Mitigation", level: 2, prompt: "Identify risks and mitigation strategies." },
				],
			},
			{
				title: "Key Personnel",
				level: 1,
				prompt: "Present key personnel.",
				subsections: [
					{ title: "Team Qualifications", level: 2, prompt: "Describe qualifications of key personnel." },
					{ title: "Facilities", level: 2, prompt: "Describe facilities and equipment." },
				],
			},
			{
				title: "Commercialization",
				level: 1,
				prompt: "Address commercialization.",
				subsections: [
					{ title: "Market Analysis", level: 2, prompt: "Analyze target market and competition." },
					{ title: "Commercialization Strategy", level: 2, prompt: "Outline path to commercialization." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Project Title", variableName: "{{project}}", description: "Project title", type: "text", required: true },
			{ id: "p3", name: "Agency", variableName: "{{agency}}", description: "Funding agency", type: "text", required: true },
		],
	},
	{
		name: "Funding Application",
		description: "General funding application for investors or grants.",
		categoryIds: ["grants", "finance", "business"],
		tags: ["funding", "application", "investment", "capital", "finance"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Company Overview",
				level: 1,
				prompt: "Introduce the company.",
				subsections: [
					{ title: "Company Description", level: 2, prompt: "Describe the company, mission, and history." },
					{ title: "Product/Service", level: 2, prompt: "Describe products or services offered." },
				],
			},
			{
				title: "Market Opportunity",
				level: 1,
				prompt: "Describe market opportunity.",
				subsections: [
					{ title: "Market Size", level: 2, prompt: "Define total addressable market and target market." },
					{ title: "Competitive Landscape", level: 2, prompt: "Analyze competition and differentiation." },
				],
			},
			{
				title: "Business Model",
				level: 1,
				prompt: "Explain the business model.",
				subsections: [
					{ title: "Revenue Model", level: 2, prompt: "Describe how the company generates revenue." },
					{ title: "Unit Economics", level: 2, prompt: "Present key unit economics." },
				],
			},
			{
				title: "Financial Projections",
				level: 1,
				prompt: "Present financial projections.",
				subsections: [
					{ title: "Historical Financials", level: 2, prompt: "Summarize historical financial performance." },
					{ title: "Projections", level: 2, prompt: "Present 3-5 year financial projections." },
				],
			},
			{
				title: "Funding Request",
				level: 1,
				prompt: "Detail the funding request.",
				subsections: [
					{ title: "Amount and Terms", level: 2, prompt: "State funding amount and proposed terms." },
					{ title: "Use of Funds", level: 2, prompt: "Detail how funds will be used." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company", variableName: "{{company}}", description: "Company name", type: "text", required: true },
			{ id: "p2", name: "Amount", variableName: "{{amount}}", description: "Funding amount", type: "currency", required: true },
		],
	},
	{
		name: "Grant Progress Report",
		description: "Progress report for grant-funded projects.",
		categoryIds: ["grants", "nonprofit"],
		tags: ["grant", "progress", "report", "outcomes", "nonprofit"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Project Summary",
				level: 1,
				prompt: "Summarize project status.",
				subsections: [
					{ title: "Project Overview", level: 2, prompt: "Brief reminder of project goals and scope." },
					{ title: "Reporting Period", level: 2, prompt: "Define the reporting period covered." },
				],
			},
			{
				title: "Progress Update",
				level: 1,
				prompt: "Report on progress.",
				subsections: [
					{ title: "Activities Completed", level: 2, prompt: "Describe activities completed during period." },
					{ title: "Milestones Achieved", level: 2, prompt: "Report on milestone achievement." },
					{ title: "Challenges", level: 2, prompt: "Describe challenges encountered and solutions." },
				],
			},
			{
				title: "Outcomes and Impact",
				level: 1,
				prompt: "Report outcomes and impact.",
				subsections: [
					{ title: "Outcome Metrics", level: 2, prompt: "Report on outcome indicators and metrics." },
					{ title: "Impact Stories", level: 2, prompt: "Share stories illustrating impact." },
				],
			},
			{
				title: "Financial Report",
				level: 1,
				prompt: "Report financial status.",
				subsections: [
					{ title: "Budget vs. Actual", level: 2, prompt: "Compare actual spending to budget." },
					{ title: "Variance Explanation", level: 2, prompt: "Explain significant variances." },
				],
			},
			{
				title: "Next Steps",
				level: 1,
				prompt: "Outline next steps.",
				subsections: [
					{ title: "Upcoming Activities", level: 2, prompt: "Describe planned activities for next period." },
					{ title: "Adjustments", level: 2, prompt: "Note any needed adjustments to plan." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Project", variableName: "{{project}}", description: "Project name", type: "text", required: true },
			{ id: "p2", name: "Grant ID", variableName: "{{grant_id}}", description: "Grant identifier", type: "text", required: true },
			{ id: "p3", name: "Reporting Period", variableName: "{{period}}", description: "Reporting period", type: "text", required: true },
		],
	},
	{
		name: "Donor Impact Report",
		description: "Impact report for donors and stakeholders.",
		categoryIds: ["grants", "nonprofit", "comms"],
		tags: ["donor", "impact", "report", "nonprofit", "stewardship"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Message from Leadership",
				level: 1,
				prompt: "Provide leadership message.",
				subsections: [
					{ title: "Thank You", level: 2, prompt: "Express gratitude to donors." },
					{ title: "Year Highlights", level: 2, prompt: "Highlight key accomplishments." },
				],
			},
			{
				title: "Mission in Action",
				level: 1,
				prompt: "Show mission in action.",
				subsections: [
					{ title: "Program Highlights", level: 2, prompt: "Highlight key programs and initiatives." },
					{ title: "Impact Stories", level: 2, prompt: "Share compelling beneficiary stories." },
				],
			},
			{
				title: "By the Numbers",
				level: 1,
				prompt: "Present impact metrics.",
				subsections: [
					{ title: "Key Metrics", level: 2, prompt: "Present key impact metrics and outcomes." },
					{ title: "Year-over-Year", level: 2, prompt: "Show growth and trends." },
				],
			},
			{
				title: "Financial Stewardship",
				level: 1,
				prompt: "Demonstrate financial stewardship.",
				subsections: [
					{ title: "Revenue Sources", level: 2, prompt: "Show breakdown of funding sources." },
					{ title: "Expense Allocation", level: 2, prompt: "Show how funds were allocated." },
				],
			},
			{
				title: "Looking Ahead",
				level: 1,
				prompt: "Share future plans.",
				subsections: [
					{ title: "Future Goals", level: 2, prompt: "Share goals and plans for coming year." },
					{ title: "Call to Action", level: 2, prompt: "Invite continued support." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Fiscal Year", variableName: "{{year}}", description: "Fiscal year", type: "text", required: true },
		],
	},
];

// ============================================================================
// REAL ESTATE & CONSTRUCTION TEMPLATES
// ============================================================================

export const REAL_ESTATE_CONSTRUCTION_TEMPLATES: TemplateDef[] = [
	{
		name: "Commercial Lease Agreement",
		description: "Commercial property lease agreement for office, retail, or industrial space.",
		categoryIds: ["legal", "realestate"],
		tags: ["lease", "commercial", "real-estate", "property", "rental"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Parties and Premises",
				level: 1,
				prompt: "Identify parties and property.",
				subsections: [
					{ title: "Landlord and Tenant", level: 2, prompt: "Identify landlord and tenant with full legal details." },
					{ title: "Premises Description", level: 2, prompt: "Describe the leased premises including address and square footage." },
					{ title: "Permitted Use", level: 2, prompt: "Define permitted use of the premises." },
				],
			},
			{
				title: "Lease Term",
				level: 1,
				prompt: "Define lease term.",
				subsections: [
					{ title: "Initial Term", level: 2, prompt: "Specify lease commencement and expiration dates." },
					{ title: "Renewal Options", level: 2, prompt: "Define renewal options and notice requirements." },
				],
			},
			{
				title: "Rent and Expenses",
				level: 1,
				prompt: "Define rent and expense obligations.",
				subsections: [
					{ title: "Base Rent", level: 2, prompt: "Specify base rent amount and payment schedule." },
					{ title: "Rent Escalations", level: 2, prompt: "Define annual rent increases (CPI, fixed, etc.)." },
					{ title: "Operating Expenses", level: 2, prompt: "Define CAM/operating expense pass-throughs (NNN, gross, modified gross)." },
					{ title: "Security Deposit", level: 2, prompt: "Specify security deposit amount and terms." },
				],
			},
			{
				title: "Tenant Obligations",
				level: 1,
				prompt: "Define tenant obligations.",
				subsections: [
					{ title: "Maintenance", level: 2, prompt: "Define tenant maintenance responsibilities." },
					{ title: "Insurance", level: 2, prompt: "Specify tenant insurance requirements." },
					{ title: "Compliance", level: 2, prompt: "Require compliance with laws and building rules." },
				],
			},
			{
				title: "Landlord Obligations",
				level: 1,
				prompt: "Define landlord obligations.",
				subsections: [
					{ title: "Services", level: 2, prompt: "Specify services landlord will provide." },
					{ title: "Building Maintenance", level: 2, prompt: "Define landlord maintenance responsibilities." },
				],
			},
			{
				title: "Default and Remedies",
				level: 1,
				prompt: "Address default and termination.",
				subsections: [
					{ title: "Events of Default", level: 2, prompt: "Define events constituting default." },
					{ title: "Remedies", level: 2, prompt: "Specify landlord remedies upon default." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Landlord", variableName: "{{landlord}}", description: "Landlord name", type: "text", required: true },
			{ id: "p2", name: "Tenant", variableName: "{{tenant}}", description: "Tenant name", type: "text", required: true },
			{ id: "p3", name: "Property Address", variableName: "{{address}}", description: "Property address", type: "textarea", required: true },
		],
	},
	{
		name: "Property Management Agreement",
		description: "Agreement for property management services.",
		categoryIds: ["legal", "realestate", "contracts"],
		tags: ["property-management", "real-estate", "services", "agreement", "landlord"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Parties and Property",
				level: 1,
				prompt: "Identify parties and property.",
				subsections: [
					{ title: "Owner and Manager", level: 2, prompt: "Identify property owner and management company." },
					{ title: "Property Description", level: 2, prompt: "Describe the property or properties to be managed." },
				],
			},
			{
				title: "Management Services",
				level: 1,
				prompt: "Define management services.",
				subsections: [
					{ title: "Scope of Services", level: 2, prompt: "Define comprehensive list of management services." },
					{ title: "Leasing Services", level: 2, prompt: "Specify tenant procurement and leasing responsibilities." },
					{ title: "Maintenance", level: 2, prompt: "Define maintenance and repair management." },
				],
			},
			{
				title: "Compensation",
				level: 1,
				prompt: "Define management fees.",
				subsections: [
					{ title: "Management Fee", level: 2, prompt: "Specify management fee (percentage of rent or flat fee)." },
					{ title: "Leasing Commissions", level: 2, prompt: "Define leasing commissions and fees." },
					{ title: "Expense Reimbursement", level: 2, prompt: "Address reimbursable expenses." },
				],
			},
			{
				title: "Owner Obligations",
				level: 1,
				prompt: "Define owner responsibilities.",
				subsections: [
					{ title: "Funding", level: 2, prompt: "Establish operating account and funding requirements." },
					{ title: "Insurance", level: 2, prompt: "Specify owner insurance requirements." },
				],
			},
			{
				title: "Term and Termination",
				level: 1,
				prompt: "Define term and termination.",
				subsections: [
					{ title: "Agreement Term", level: 2, prompt: "Specify term and renewal provisions." },
					{ title: "Termination", level: 2, prompt: "Define termination rights and notice periods." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Owner", variableName: "{{owner}}", description: "Property owner", type: "text", required: true },
			{ id: "p2", name: "Manager", variableName: "{{manager}}", description: "Management company", type: "text", required: true },
		],
	},
	{
		name: "Construction Contract",
		description: "Construction contract for building or renovation projects.",
		categoryIds: ["legal", "construction", "contracts"],
		tags: ["construction", "contract", "building", "contractor", "project"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Parties and Project",
				level: 1,
				prompt: "Identify parties and project.",
				subsections: [
					{ title: "Owner and Contractor", level: 2, prompt: "Identify project owner and general contractor." },
					{ title: "Project Description", level: 2, prompt: "Describe the construction project and scope." },
					{ title: "Project Location", level: 2, prompt: "Specify project site location." },
				],
			},
			{
				title: "Scope of Work",
				level: 1,
				prompt: "Define scope of work.",
				subsections: [
					{ title: "Work Description", level: 2, prompt: "Detail the work to be performed." },
					{ title: "Plans and Specifications", level: 2, prompt: "Reference contract documents, plans, and specs." },
					{ title: "Exclusions", level: 2, prompt: "Identify work excluded from scope." },
				],
			},
			{
				title: "Contract Price",
				level: 1,
				prompt: "Define contract price and payment.",
				subsections: [
					{ title: "Contract Sum", level: 2, prompt: "Specify contract price (fixed, GMP, cost-plus)." },
					{ title: "Payment Schedule", level: 2, prompt: "Define payment schedule and milestones." },
					{ title: "Change Orders", level: 2, prompt: "Establish change order process and pricing." },
				],
			},
			{
				title: "Schedule",
				level: 1,
				prompt: "Define project schedule.",
				subsections: [
					{ title: "Project Timeline", level: 2, prompt: "Establish start date, substantial completion, and final completion." },
					{ title: "Delays", level: 2, prompt: "Address delay provisions and liquidated damages." },
				],
			},
			{
				title: "Insurance and Bonds",
				level: 1,
				prompt: "Define insurance and bonding requirements.",
				subsections: [
					{ title: "Insurance Requirements", level: 2, prompt: "Specify required insurance coverages and limits." },
					{ title: "Bonds", level: 2, prompt: "Require performance and payment bonds if applicable." },
				],
			},
			{
				title: "Warranties",
				level: 1,
				prompt: "Define warranty provisions.",
				subsections: [
					{ title: "Workmanship Warranty", level: 2, prompt: "Define contractor warranty for workmanship." },
					{ title: "Manufacturer Warranties", level: 2, prompt: "Address pass-through of manufacturer warranties." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Owner", variableName: "{{owner}}", description: "Project owner", type: "text", required: true },
			{ id: "p2", name: "Contractor", variableName: "{{contractor}}", description: "General contractor", type: "text", required: true },
			{ id: "p3", name: "Project", variableName: "{{project}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Site Assessment Report",
		description: "Property site assessment and due diligence report.",
		categoryIds: ["realestate", "analysis"],
		tags: ["site-assessment", "due-diligence", "property", "evaluation", "real-estate"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Property Overview",
				level: 1,
				prompt: "Describe the property.",
				subsections: [
					{ title: "Property Identification", level: 2, prompt: "Identify property with address, parcel info, and legal description." },
					{ title: "Property Description", level: 2, prompt: "Describe physical characteristics of the site." },
				],
			},
			{
				title: "Site Conditions",
				level: 1,
				prompt: "Assess site conditions.",
				subsections: [
					{ title: "Physical Conditions", level: 2, prompt: "Assess topography, soil conditions, and access." },
					{ title: "Environmental", level: 2, prompt: "Note environmental considerations or concerns." },
					{ title: "Utilities", level: 2, prompt: "Document available utilities and capacity." },
				],
			},
			{
				title: "Zoning and Entitlements",
				level: 1,
				prompt: "Review zoning and entitlements.",
				subsections: [
					{ title: "Current Zoning", level: 2, prompt: "Identify current zoning and permitted uses." },
					{ title: "Development Potential", level: 2, prompt: "Assess development potential under current zoning." },
				],
			},
			{
				title: "Market Analysis",
				level: 1,
				prompt: "Analyze market conditions.",
				subsections: [
					{ title: "Location Analysis", level: 2, prompt: "Assess location factors and accessibility." },
					{ title: "Comparable Properties", level: 2, prompt: "Review comparable properties and market values." },
				],
			},
			{
				title: "Conclusions",
				level: 1,
				prompt: "Provide conclusions.",
				subsections: [
					{ title: "Summary of Findings", level: 2, prompt: "Summarize key findings from assessment." },
					{ title: "Recommendations", level: 2, prompt: "Provide recommendations for property use or acquisition." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Property Address", variableName: "{{address}}", description: "Property address", type: "textarea", required: true },
			{ id: "p2", name: "Assessor", variableName: "{{assessor}}", description: "Assessor name/company", type: "text", required: true },
		],
	},
	{
		name: "Tenant Improvement Agreement",
		description: "Agreement for tenant improvement construction in leased premises.",
		categoryIds: ["legal", "realestate", "construction"],
		tags: ["tenant-improvement", "ti", "buildout", "construction", "lease"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Parties and Premises",
				level: 1,
				prompt: "Identify parties and premises.",
				subsections: [
					{ title: "Landlord and Tenant", level: 2, prompt: "Identify landlord and tenant." },
					{ title: "Premises", level: 2, prompt: "Reference the lease and describe premises." },
				],
			},
			{
				title: "Tenant Improvements",
				level: 1,
				prompt: "Define the improvements.",
				subsections: [
					{ title: "Scope of Work", level: 2, prompt: "Describe the tenant improvements to be constructed." },
					{ title: "Plans and Specifications", level: 2, prompt: "Reference approved plans and specifications." },
				],
			},
			{
				title: "Cost and Allowance",
				level: 1,
				prompt: "Define costs and allowances.",
				subsections: [
					{ title: "TI Allowance", level: 2, prompt: "Specify landlord's TI allowance contribution." },
					{ title: "Cost Overruns", level: 2, prompt: "Address responsibility for costs exceeding allowance." },
				],
			},
			{
				title: "Construction Process",
				level: 1,
				prompt: "Define construction process.",
				subsections: [
					{ title: "Contractor Selection", level: 2, prompt: "Define contractor selection and approval process." },
					{ title: "Construction Management", level: 2, prompt: "Specify construction oversight and coordination." },
					{ title: "Timeline", level: 2, prompt: "Establish construction timeline and rent commencement." },
				],
			},
			{
				title: "Ownership",
				level: 1,
				prompt: "Address ownership of improvements.",
				subsections: [
					{ title: "Ownership", level: 2, prompt: "Define ownership of improvements upon completion." },
					{ title: "Removal", level: 2, prompt: "Address removal requirements at lease end." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Landlord", variableName: "{{landlord}}", description: "Landlord name", type: "text", required: true },
			{ id: "p2", name: "Tenant", variableName: "{{tenant}}", description: "Tenant name", type: "text", required: true },
		],
	},
];

// ============================================================================
// MANUFACTURING & QUALITY TEMPLATES
// ============================================================================

export const MANUFACTURING_QUALITY_TEMPLATES: TemplateDef[] = [
	{
		name: "Quality Management System Manual",
		description: "ISO 9001-aligned quality management system manual.",
		categoryIds: ["qa", "manufacturing", "compliance"],
		tags: ["qms", "quality", "iso9001", "manual", "management-system"],
		difficulty: "advanced",
		estimatedTime: 240,
		sections: [
			{
				title: "QMS Overview",
				level: 1,
				prompt: "Introduce the quality management system.",
				subsections: [
					{ title: "Scope", level: 2, prompt: "Define scope of the QMS and any exclusions." },
					{ title: "Quality Policy", level: 2, prompt: "State the organization's quality policy." },
					{ title: "Quality Objectives", level: 2, prompt: "Define measurable quality objectives." },
				],
			},
			{
				title: "Organization Context",
				level: 1,
				prompt: "Describe organizational context.",
				subsections: [
					{ title: "Organization Profile", level: 2, prompt: "Describe the organization and its context." },
					{ title: "Interested Parties", level: 2, prompt: "Identify interested parties and their requirements." },
				],
			},
			{
				title: "Leadership",
				level: 1,
				prompt: "Define leadership and governance.",
				subsections: [
					{ title: "Management Commitment", level: 2, prompt: "Document management commitment to quality." },
					{ title: "Roles and Responsibilities", level: 2, prompt: "Define quality roles and responsibilities." },
				],
			},
			{
				title: "Core Processes",
				level: 1,
				prompt: "Document core processes.",
				subsections: [
					{ title: "Process Overview", level: 2, prompt: "Map key business processes." },
					{ title: "Operational Controls", level: 2, prompt: "Define controls for operational processes." },
				],
			},
			{
				title: "Support Processes",
				level: 1,
				prompt: "Document support processes.",
				subsections: [
					{ title: "Resources", level: 2, prompt: "Define resource management requirements." },
					{ title: "Competence and Training", level: 2, prompt: "Address competence and training requirements." },
					{ title: "Document Control", level: 2, prompt: "Define document and record control." },
				],
			},
			{
				title: "Performance Evaluation",
				level: 1,
				prompt: "Define performance evaluation.",
				subsections: [
					{ title: "Monitoring and Measurement", level: 2, prompt: "Define monitoring and measurement activities." },
					{ title: "Internal Audit", level: 2, prompt: "Describe internal audit program." },
					{ title: "Management Review", level: 2, prompt: "Define management review process." },
				],
			},
			{
				title: "Improvement",
				level: 1,
				prompt: "Address continual improvement.",
				subsections: [
					{ title: "Nonconformity Management", level: 2, prompt: "Define nonconformity and corrective action process." },
					{ title: "Continual Improvement", level: 2, prompt: "Describe continual improvement approach." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "QMS Manager", variableName: "{{qms_manager}}", description: "QMS manager name", type: "text", required: false },
		],
	},
	{
		name: "Standard Operating Procedure (SOP)",
		description: "Standard operating procedure template for operational processes.",
		categoryIds: ["qa", "operations", "process"],
		tags: ["sop", "procedure", "standard", "operations", "process"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Document Control",
				level: 1,
				prompt: "Provide document control information.",
				subsections: [
					{ title: "Purpose", level: 2, prompt: "State the purpose of this SOP." },
					{ title: "Scope", level: 2, prompt: "Define scope and applicability." },
					{ title: "Definitions", level: 2, prompt: "Define key terms used in the procedure." },
				],
			},
			{
				title: "Responsibilities",
				level: 1,
				prompt: "Define responsibilities.",
				subsections: [
					{ title: "Roles", level: 2, prompt: "Identify roles involved in this procedure." },
					{ title: "Accountability", level: 2, prompt: "Define accountability for procedure execution." },
				],
			},
			{
				title: "Procedure",
				level: 1,
				prompt: "Document the procedure steps.",
				subsections: [
					{ title: "Prerequisites", level: 2, prompt: "List prerequisites and required materials." },
					{ title: "Step-by-Step Instructions", level: 2, prompt: "Provide detailed step-by-step instructions." },
					{ title: "Quality Checks", level: 2, prompt: "Define quality verification steps." },
				],
			},
			{
				title: "Documentation",
				level: 1,
				prompt: "Define documentation requirements.",
				subsections: [
					{ title: "Records", level: 2, prompt: "Specify records to be created and maintained." },
					{ title: "Forms", level: 2, prompt: "Reference any forms or checklists used." },
				],
			},
			{
				title: "References",
				level: 1,
				prompt: "List related references.",
				subsections: [
					{ title: "Related Documents", level: 2, prompt: "List related SOPs and documents." },
					{ title: "Revision History", level: 2, prompt: "Document revision history." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Procedure Title", variableName: "{{title}}", description: "Procedure title", type: "text", required: true },
			{ id: "p2", name: "Document Number", variableName: "{{doc_number}}", description: "Document number", type: "text", required: true },
		],
	},
	{
		name: "Work Instructions",
		description: "Detailed work instructions for specific tasks.",
		categoryIds: ["qa", "operations", "manufacturing"],
		tags: ["work-instructions", "task", "manufacturing", "operations", "detailed"],
		difficulty: "beginner",
		estimatedTime: 45,
		sections: [
			{
				title: "Task Overview",
				level: 1,
				prompt: "Introduce the task.",
				subsections: [
					{ title: "Task Description", level: 2, prompt: "Describe what task this instruction covers." },
					{ title: "Safety Considerations", level: 2, prompt: "List any safety requirements or PPE needed." },
				],
			},
			{
				title: "Materials and Equipment",
				level: 1,
				prompt: "List required materials.",
				subsections: [
					{ title: "Materials", level: 2, prompt: "List required materials and specifications." },
					{ title: "Equipment", level: 2, prompt: "List required tools and equipment." },
				],
			},
			{
				title: "Instructions",
				level: 1,
				prompt: "Provide detailed instructions.",
				subsections: [
					{ title: "Preparation", level: 2, prompt: "Describe preparation steps." },
					{ title: "Execution Steps", level: 2, prompt: "Provide numbered step-by-step execution instructions." },
					{ title: "Completion", level: 2, prompt: "Describe completion and cleanup steps." },
				],
			},
			{
				title: "Quality Criteria",
				level: 1,
				prompt: "Define quality criteria.",
				subsections: [
					{ title: "Acceptance Criteria", level: 2, prompt: "Define acceptance criteria for completed work." },
					{ title: "Common Defects", level: 2, prompt: "Identify common defects and how to avoid them." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Task Name", variableName: "{{task}}", description: "Task name", type: "text", required: true },
			{ id: "p2", name: "Work Area", variableName: "{{area}}", description: "Work area or station", type: "text", required: true },
		],
	},
	{
		name: "Bill of Materials (BOM)",
		description: "Bill of materials document for product assembly.",
		categoryIds: ["manufacturing", "product"],
		tags: ["bom", "bill-of-materials", "assembly", "manufacturing", "components"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Product Information",
				level: 1,
				prompt: "Identify the product.",
				subsections: [
					{ title: "Product Identification", level: 2, prompt: "Specify product name, part number, and revision." },
					{ title: "Product Description", level: 2, prompt: "Describe the finished product." },
				],
			},
			{
				title: "Component List",
				level: 1,
				prompt: "List all components.",
				subsections: [
					{ title: "Parts List", level: 2, prompt: "List all parts with part numbers, descriptions, and quantities." },
					{ title: "Raw Materials", level: 2, prompt: "List raw materials required." },
				],
			},
			{
				title: "Assembly Structure",
				level: 1,
				prompt: "Define assembly structure.",
				subsections: [
					{ title: "Assembly Hierarchy", level: 2, prompt: "Show parent-child relationships of assemblies." },
					{ title: "Sub-Assemblies", level: 2, prompt: "List and describe sub-assemblies." },
				],
			},
			{
				title: "Specifications",
				level: 1,
				prompt: "Document specifications.",
				subsections: [
					{ title: "Technical Specifications", level: 2, prompt: "Document technical specifications for key components." },
					{ title: "Supplier Information", level: 2, prompt: "Include approved suppliers for components." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Product Name", variableName: "{{product}}", description: "Product name", type: "text", required: true },
			{ id: "p2", name: "Part Number", variableName: "{{part_number}}", description: "Product part number", type: "text", required: true },
		],
	},
	{
		name: "Supplier Quality Agreement",
		description: "Quality agreement with suppliers defining quality requirements.",
		categoryIds: ["qa", "procurement", "legal"],
		tags: ["supplier", "quality", "agreement", "procurement", "vendor"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Parties and Purpose",
				level: 1,
				prompt: "Identify parties and purpose.",
				subsections: [
					{ title: "Parties", level: 2, prompt: "Identify buyer and supplier." },
					{ title: "Purpose", level: 2, prompt: "State purpose of the quality agreement." },
				],
			},
			{
				title: "Quality Requirements",
				level: 1,
				prompt: "Define quality requirements.",
				subsections: [
					{ title: "Quality Standards", level: 2, prompt: "Specify applicable quality standards and certifications." },
					{ title: "Product Specifications", level: 2, prompt: "Reference product specifications and tolerances." },
					{ title: "Testing Requirements", level: 2, prompt: "Define testing and inspection requirements." },
				],
			},
			{
				title: "Quality Management",
				level: 1,
				prompt: "Define quality management requirements.",
				subsections: [
					{ title: "Quality System", level: 2, prompt: "Require supplier quality management system." },
					{ title: "Process Control", level: 2, prompt: "Define process control requirements." },
					{ title: "Documentation", level: 2, prompt: "Specify documentation and traceability requirements." },
				],
			},
			{
				title: "Performance and Audits",
				level: 1,
				prompt: "Define performance monitoring.",
				subsections: [
					{ title: "Performance Metrics", level: 2, prompt: "Define supplier performance metrics and targets." },
					{ title: "Audit Rights", level: 2, prompt: "Establish buyer's right to audit supplier." },
				],
			},
			{
				title: "Non-Conformance",
				level: 1,
				prompt: "Address non-conforming product.",
				subsections: [
					{ title: "Notification", level: 2, prompt: "Require notification of quality issues." },
					{ title: "Corrective Action", level: 2, prompt: "Define corrective action requirements." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Buyer", variableName: "{{buyer}}", description: "Buying company", type: "text", required: true },
			{ id: "p2", name: "Supplier", variableName: "{{supplier}}", description: "Supplier company", type: "text", required: true },
		],
	},
];

// ============================================================================
// NON-PROFIT & NGO TEMPLATES
// ============================================================================

export const NONPROFIT_TEMPLATES: TemplateDef[] = [
	{
		name: "Non-Profit Grant Application",
		description: "Grant application for non-profit organizations.",
		categoryIds: ["grants", "nonprofit"],
		tags: ["grant", "nonprofit", "application", "funding", "foundation"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Organization Profile",
				level: 1,
				prompt: "Describe your organization.",
				subsections: [
					{ title: "Mission and History", level: 2, prompt: "Describe organization mission and history." },
					{ title: "Programs and Services", level: 2, prompt: "Summarize current programs and services." },
					{ title: "Governance", level: 2, prompt: "Describe board and leadership structure." },
				],
			},
			{
				title: "Need Statement",
				level: 1,
				prompt: "Establish the need.",
				subsections: [
					{ title: "Community Need", level: 2, prompt: "Describe the need in the community you serve." },
					{ title: "Supporting Evidence", level: 2, prompt: "Provide data supporting the need." },
				],
			},
			{
				title: "Project Proposal",
				level: 1,
				prompt: "Describe the proposed project.",
				subsections: [
					{ title: "Project Description", level: 2, prompt: "Describe the project in detail." },
					{ title: "Goals and Objectives", level: 2, prompt: "State project goals and measurable objectives." },
					{ title: "Activities and Timeline", level: 2, prompt: "Outline activities and implementation timeline." },
				],
			},
			{
				title: "Evaluation",
				level: 1,
				prompt: "Describe evaluation approach.",
				subsections: [
					{ title: "Outcomes", level: 2, prompt: "Define expected outcomes and indicators." },
					{ title: "Measurement", level: 2, prompt: "Describe how outcomes will be measured." },
				],
			},
			{
				title: "Budget",
				level: 1,
				prompt: "Present project budget.",
				subsections: [
					{ title: "Project Budget", level: 2, prompt: "Provide detailed project budget." },
					{ title: "Other Funding", level: 2, prompt: "Identify other funding sources for this project." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Project", variableName: "{{project}}", description: "Project name", type: "text", required: true },
		],
	},
	{
		name: "Impact Assessment Report",
		description: "Social impact assessment report for programs and initiatives.",
		categoryIds: ["nonprofit", "analysis"],
		tags: ["impact", "assessment", "evaluation", "nonprofit", "social"],
		difficulty: "advanced",
		estimatedTime: 180,
		sections: [
			{
				title: "Assessment Overview",
				level: 1,
				prompt: "Introduce the assessment.",
				subsections: [
					{ title: "Program Description", level: 2, prompt: "Describe the program being assessed." },
					{ title: "Assessment Methodology", level: 2, prompt: "Describe the assessment methodology used." },
				],
			},
			{
				title: "Theory of Change",
				level: 1,
				prompt: "Present theory of change.",
				subsections: [
					{ title: "Logic Model", level: 2, prompt: "Present the program logic model or theory of change." },
					{ title: "Assumptions", level: 2, prompt: "Identify key assumptions." },
				],
			},
			{
				title: "Findings",
				level: 1,
				prompt: "Present assessment findings.",
				subsections: [
					{ title: "Output Measures", level: 2, prompt: "Report on program outputs and activities." },
					{ title: "Outcome Measures", level: 2, prompt: "Report on outcomes achieved." },
					{ title: "Impact Evidence", level: 2, prompt: "Present evidence of long-term impact." },
				],
			},
			{
				title: "Analysis",
				level: 1,
				prompt: "Analyze findings.",
				subsections: [
					{ title: "Success Factors", level: 2, prompt: "Identify factors contributing to success." },
					{ title: "Challenges", level: 2, prompt: "Identify challenges and limitations." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide recommendations.",
				subsections: [
					{ title: "Program Recommendations", level: 2, prompt: "Recommend program improvements." },
					{ title: "Future Evaluation", level: 2, prompt: "Recommend future evaluation approaches." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Program", variableName: "{{program}}", description: "Program name", type: "text", required: true },
			{ id: "p2", name: "Assessment Period", variableName: "{{period}}", description: "Assessment period", type: "text", required: true },
		],
	},
	{
		name: "Donor Stewardship Report",
		description: "Report for major donors on gift impact and recognition.",
		categoryIds: ["nonprofit", "comms"],
		tags: ["donor", "stewardship", "report", "recognition", "nonprofit"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Acknowledgment",
				level: 1,
				prompt: "Acknowledge the donor's gift.",
				subsections: [
					{ title: "Thank You", level: 2, prompt: "Express heartfelt gratitude for the gift." },
					{ title: "Gift Summary", level: 2, prompt: "Summarize the gift details and designation." },
				],
			},
			{
				title: "Gift Impact",
				level: 1,
				prompt: "Report on gift impact.",
				subsections: [
					{ title: "How Gift Was Used", level: 2, prompt: "Describe specifically how the gift was used." },
					{ title: "Beneficiaries", level: 2, prompt: "Share stories of those who benefited." },
					{ title: "Outcomes", level: 2, prompt: "Report measurable outcomes achieved." },
				],
			},
			{
				title: "Recognition",
				level: 1,
				prompt: "Recognize the donor.",
				subsections: [
					{ title: "Recognition Activities", level: 2, prompt: "Describe how donor has been recognized." },
					{ title: "Giving History", level: 2, prompt: "Acknowledge giving history and cumulative impact." },
				],
			},
			{
				title: "Looking Forward",
				level: 1,
				prompt: "Share future plans.",
				subsections: [
					{ title: "Upcoming Initiatives", level: 2, prompt: "Share exciting upcoming initiatives." },
					{ title: "Invitation", level: 2, prompt: "Invite continued partnership and engagement." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Donor Name", variableName: "{{donor}}", description: "Donor name", type: "text", required: true },
			{ id: "p2", name: "Gift Amount", variableName: "{{amount}}", description: "Gift amount", type: "currency", required: true },
		],
	},
	{
		name: "Volunteer Handbook",
		description: "Handbook for volunteers with policies and procedures.",
		categoryIds: ["nonprofit", "hr"],
		tags: ["volunteer", "handbook", "nonprofit", "policies", "onboarding"],
		difficulty: "intermediate",
		estimatedTime: 120,
		sections: [
			{
				title: "Welcome",
				level: 1,
				prompt: "Welcome volunteers.",
				subsections: [
					{ title: "Welcome Message", level: 2, prompt: "Provide welcome message from leadership." },
					{ title: "Mission and Values", level: 2, prompt: "Share organizational mission and values." },
				],
			},
			{
				title: "Volunteer Program",
				level: 1,
				prompt: "Describe volunteer program.",
				subsections: [
					{ title: "Program Overview", level: 2, prompt: "Describe the volunteer program structure." },
					{ title: "Volunteer Roles", level: 2, prompt: "Describe available volunteer roles and responsibilities." },
				],
			},
			{
				title: "Policies",
				level: 1,
				prompt: "Present volunteer policies.",
				subsections: [
					{ title: "Code of Conduct", level: 2, prompt: "Define expected conduct and behavior." },
					{ title: "Attendance", level: 2, prompt: "Explain attendance and scheduling expectations." },
					{ title: "Confidentiality", level: 2, prompt: "Explain confidentiality requirements." },
				],
			},
			{
				title: "Procedures",
				level: 1,
				prompt: "Explain key procedures.",
				subsections: [
					{ title: "Check-In/Out", level: 2, prompt: "Explain sign-in and time tracking procedures." },
					{ title: "Safety", level: 2, prompt: "Cover safety procedures and emergency protocols." },
					{ title: "Communication", level: 2, prompt: "Explain communication channels and contacts." },
				],
			},
			{
				title: "Support",
				level: 1,
				prompt: "Describe volunteer support.",
				subsections: [
					{ title: "Training", level: 2, prompt: "Describe training and orientation provided." },
					{ title: "Recognition", level: 2, prompt: "Explain volunteer recognition program." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Organization", variableName: "{{organization}}", description: "Organization name", type: "text", required: true },
			{ id: "p2", name: "Volunteer Coordinator", variableName: "{{coordinator}}", description: "Coordinator name", type: "text", required: true },
		],
	},
];

// ============================================================================
// EVENT & CONFERENCE TEMPLATES
// ============================================================================

export const EVENT_CONFERENCE_TEMPLATES: TemplateDef[] = [
	{
		name: "Event Proposal",
		description: "Proposal for hosting or sponsoring an event.",
		categoryIds: ["events", "marketing"],
		tags: ["event", "proposal", "conference", "planning", "sponsorship"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Event Overview",
				level: 1,
				prompt: "Introduce the event.",
				subsections: [
					{ title: "Event Concept", level: 2, prompt: "Describe the event concept and theme." },
					{ title: "Objectives", level: 2, prompt: "Define event goals and objectives." },
					{ title: "Target Audience", level: 2, prompt: "Identify target audience and expected attendance." },
				],
			},
			{
				title: "Event Details",
				level: 1,
				prompt: "Provide event details.",
				subsections: [
					{ title: "Date and Venue", level: 2, prompt: "Propose date, time, and venue options." },
					{ title: "Program", level: 2, prompt: "Outline proposed program and activities." },
					{ title: "Speakers/Entertainment", level: 2, prompt: "Identify proposed speakers or entertainment." },
				],
			},
			{
				title: "Marketing Plan",
				level: 1,
				prompt: "Describe marketing approach.",
				subsections: [
					{ title: "Promotion Strategy", level: 2, prompt: "Outline event promotion and marketing plan." },
					{ title: "Target Metrics", level: 2, prompt: "Define registration and attendance targets." },
				],
			},
			{
				title: "Budget",
				level: 1,
				prompt: "Present event budget.",
				subsections: [
					{ title: "Expense Budget", level: 2, prompt: "Detail projected expenses by category." },
					{ title: "Revenue Projections", level: 2, prompt: "Project revenue from tickets, sponsors, etc." },
				],
			},
			{
				title: "Request",
				level: 1,
				prompt: "Make the ask.",
				subsections: [
					{ title: "Sponsorship Request", level: 2, prompt: "Detail sponsorship request and benefits." },
					{ title: "Next Steps", level: 2, prompt: "Propose next steps for decision." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Event Name", variableName: "{{event}}", description: "Event name", type: "text", required: true },
			{ id: "p2", name: "Proposed Date", variableName: "{{date}}", description: "Proposed event date", type: "date", required: true },
		],
	},
	{
		name: "Sponsorship Package",
		description: "Sponsorship opportunities and benefits package.",
		categoryIds: ["events", "marketing", "sales"],
		tags: ["sponsorship", "package", "event", "benefits", "partnership"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Event Overview",
				level: 1,
				prompt: "Introduce the event.",
				subsections: [
					{ title: "About the Event", level: 2, prompt: "Describe the event and its significance." },
					{ title: "Audience Profile", level: 2, prompt: "Profile the expected audience demographics." },
				],
			},
			{
				title: "Sponsorship Tiers",
				level: 1,
				prompt: "Present sponsorship levels.",
				subsections: [
					{ title: "Platinum/Title Sponsor", level: 2, prompt: "Define top-tier sponsorship benefits and investment." },
					{ title: "Gold Sponsor", level: 2, prompt: "Define gold-tier sponsorship benefits and investment." },
					{ title: "Silver Sponsor", level: 2, prompt: "Define silver-tier sponsorship benefits and investment." },
				],
			},
			{
				title: "Custom Opportunities",
				level: 1,
				prompt: "Describe custom opportunities.",
				subsections: [
					{ title: "A La Carte Options", level: 2, prompt: "List additional sponsorship opportunities." },
					{ title: "Custom Packages", level: 2, prompt: "Offer to create custom sponsorship packages." },
				],
			},
			{
				title: "Contact",
				level: 1,
				prompt: "Provide contact information.",
				subsections: [
					{ title: "Contact Details", level: 2, prompt: "Provide sponsorship contact information." },
					{ title: "Deadline", level: 2, prompt: "State sponsorship commitment deadline." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Event Name", variableName: "{{event}}", description: "Event name", type: "text", required: true },
			{ id: "p2", name: "Event Date", variableName: "{{date}}", description: "Event date", type: "date", required: true },
		],
	},
	{
		name: "Conference Program",
		description: "Conference agenda and program document.",
		categoryIds: ["events"],
		tags: ["conference", "program", "agenda", "schedule", "sessions"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Conference Overview",
				level: 1,
				prompt: "Introduce the conference.",
				subsections: [
					{ title: "Welcome", level: 2, prompt: "Welcome message from conference chair." },
					{ title: "Conference Theme", level: 2, prompt: "Describe conference theme and objectives." },
				],
			},
			{
				title: "Schedule at a Glance",
				level: 1,
				prompt: "Provide schedule overview.",
				subsections: [
					{ title: "Daily Overview", level: 2, prompt: "High-level schedule for each day." },
					{ title: "Track Overview", level: 2, prompt: "Overview of different tracks or streams." },
				],
			},
			{
				title: "Detailed Agenda",
				level: 1,
				prompt: "Provide detailed session information.",
				subsections: [
					{ title: "Keynote Sessions", level: 2, prompt: "Detail keynote speakers and sessions." },
					{ title: "Breakout Sessions", level: 2, prompt: "List all breakout sessions with descriptions." },
					{ title: "Workshops", level: 2, prompt: "Describe workshop sessions and requirements." },
				],
			},
			{
				title: "Speakers",
				level: 1,
				prompt: "Profile speakers.",
				subsections: [
					{ title: "Speaker Bios", level: 2, prompt: "Provide speaker biographies and credentials." },
				],
			},
			{
				title: "Practical Information",
				level: 1,
				prompt: "Provide logistics information.",
				subsections: [
					{ title: "Venue Information", level: 2, prompt: "Provide venue details and maps." },
					{ title: "Networking Events", level: 2, prompt: "Describe networking opportunities and social events." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Conference Name", variableName: "{{conference}}", description: "Conference name", type: "text", required: true },
			{ id: "p2", name: "Conference Date", variableName: "{{date}}", description: "Conference date", type: "text", required: true },
		],
	},
	{
		name: "Post-Event Report",
		description: "Post-event summary and analysis report.",
		categoryIds: ["events", "marketing"],
		tags: ["event", "report", "post-event", "analysis", "roi"],
		difficulty: "intermediate",
		estimatedTime: 90,
		sections: [
			{
				title: "Executive Summary",
				level: 1,
				prompt: "Summarize event results.",
				subsections: [
					{ title: "Event Overview", level: 2, prompt: "Summarize key event facts and figures." },
					{ title: "Key Highlights", level: 2, prompt: "Highlight major successes and accomplishments." },
				],
			},
			{
				title: "Attendance and Engagement",
				level: 1,
				prompt: "Report on attendance.",
				subsections: [
					{ title: "Attendance Metrics", level: 2, prompt: "Report registration vs. attendance numbers." },
					{ title: "Audience Demographics", level: 2, prompt: "Analyze attendee demographics." },
					{ title: "Engagement Metrics", level: 2, prompt: "Report on session attendance and engagement." },
				],
			},
			{
				title: "Financial Summary",
				level: 1,
				prompt: "Report financial results.",
				subsections: [
					{ title: "Revenue", level: 2, prompt: "Report actual revenue vs. budget." },
					{ title: "Expenses", level: 2, prompt: "Report actual expenses vs. budget." },
					{ title: "ROI Analysis", level: 2, prompt: "Analyze return on investment." },
				],
			},
			{
				title: "Feedback Analysis",
				level: 1,
				prompt: "Analyze attendee feedback.",
				subsections: [
					{ title: "Survey Results", level: 2, prompt: "Summarize post-event survey results." },
					{ title: "Testimonials", level: 2, prompt: "Include notable attendee feedback." },
				],
			},
			{
				title: "Recommendations",
				level: 1,
				prompt: "Provide recommendations.",
				subsections: [
					{ title: "What Worked", level: 2, prompt: "Identify what worked well to repeat." },
					{ title: "Areas for Improvement", level: 2, prompt: "Identify improvements for future events." },
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Event Name", variableName: "{{event}}", description: "Event name", type: "text", required: true },
			{ id: "p2", name: "Event Date", variableName: "{{date}}", description: "Event date", type: "date", required: true },
		],
	},
];

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const ALL_PROFESSIONAL_TEMPLATES: TemplateDef[] = [
	...ENHANCED_RFP_TEMPLATES,
	...CONSULTANCY_TEMPLATES,
	...BUSINESS_MANAGEMENT_TEMPLATES,
	...PMI_TEMPLATES,
	...PRINCE2_TEMPLATES,
	...PMI_EXTENDED_TEMPLATES,
	...PRINCE2_EXTENDED_TEMPLATES,
	...AGILE_TEMPLATES,
	...SOFTWARE_DEV_TEMPLATES,
	...SPECIALIZED_RFP_TEMPLATES,
	...FINANCIAL_TEMPLATES,
	...HR_TEMPLATES,
	...CONSULTANCY_EXTENDED_TEMPLATES,
	...GOVERNANCE_COMPLIANCE_TEMPLATES,
	...STRATEGIC_PLANNING_TEMPLATES,
	...LEGAL_TEMPLATES,
	...SALES_MARKETING_TEMPLATES,
	...TECHNICAL_ENGINEERING_TEMPLATES,
	...CORPORATE_GOVERNANCE_TEMPLATES,
	...RESEARCH_PRODUCT_TEMPLATES,
	...GRANTS_FUNDING_TEMPLATES,
	...REAL_ESTATE_CONSTRUCTION_TEMPLATES,
	...MANUFACTURING_QUALITY_TEMPLATES,
	...NONPROFIT_TEMPLATES,
	...EVENT_CONFERENCE_TEMPLATES,
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

export function generateTemplateRecords() {
	return ALL_PROFESSIONAL_TEMPLATES.map(template => ({
		id: uuidv4(),
		name: template.name,
		description: template.description,
		status: "published" as const,
		visibility: "organization" as const,
		createdBy: "system",
		categoryIds: template.categoryIds.map(id => PROFESSIONAL_CATEGORIES[id as keyof typeof PROFESSIONAL_CATEGORIES] || id),
		tags: template.tags,
		placeholders: template.placeholders,
		aiInstructions: template.sections.map((section, idx) => ({
			id: `ai-${idx}`,
			sectionId: section.title.toLowerCase().replace(/\s+/g, "-"),
			prompt: section.prompt,
			model: "claude-3-sonnet" as const,
			temperature: 0.7,
			maxTokens: 2000,
		})),
		complianceRequirements: [],
		useCount: 0,
		rating: null,
		ratingCount: 0,
		previewImageUrl: null,
		estimatedTime: template.estimatedTime,
		difficulty: template.difficulty,
		defaultMetadata: {
			sections: template.sections,
		},
		createdAt: new Date(),
		updatedAt: new Date(),
	}));
}

// Export template count for verification
export const TEMPLATE_COUNT = ALL_PROFESSIONAL_TEMPLATES.length;
logger.debug(`Total professional templates: ${TEMPLATE_COUNT}`);
