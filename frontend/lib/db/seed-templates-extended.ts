/**
 * Extended Template Seed Data - DocFusion
 *
 * Additional templates including detailed RFP/EOI response templates,
 * letters, invoices, and more categories.
 */

import type { TemplateDef } from "./seed-templates";

// ============================================================================
// RFP Response Templates - Highly Detailed (15)
// ============================================================================

export const RFP_TEMPLATES: TemplateDef[] = [
	{
		name: "RFP Response - Complete IT Services",
		description: "Comprehensive RFP response template for IT services contracts covering all volumes including technical, management, past performance, and pricing.",
		categoryIds: ["exec", "tech", "mgmt"],
		tags: ["rfp", "it-services", "comprehensive", "full-response", "government"],
		difficulty: "advanced",
		estimatedTime: 480,
		sections: [
			{
				title: "Volume I - Technical Approach",
				level: 1,
				prompt: "Begin the Technical Volume with a compelling introduction that demonstrates deep understanding of {{client_name}}'s mission and requirements.",
				subsections: [
					{
						title: "1.0 Executive Summary",
						level: 2,
						prompt: "Write a 2-3 page executive summary highlighting {{company_name}}'s unique value proposition for this IT services contract. Include win themes, solution overview, and key differentiators.",
					},
					{
						title: "2.0 Understanding of Requirements",
						level: 2,
						prompt: "Demonstrate thorough understanding of all PWS requirements. For each major requirement area, explain your interpretation and approach. Reference specific sections and articulate success criteria.",
						subsections: [
							{
								title: "2.1 Mission Understanding",
								level: 3,
								prompt: "Articulate understanding of {{client_name}}'s mission, strategic objectives, and how IT services support mission achievement. Show insight beyond the written requirements.",
							},
							{
								title: "2.2 Technical Requirements Analysis",
								level: 3,
								prompt: "Analyze each technical requirement, identifying dependencies, constraints, and critical success factors. Create a requirements compliance matrix.",
							},
							{
								title: "2.3 Challenges and Opportunities",
								level: 3,
								prompt: "Identify anticipated challenges in meeting requirements and present proactive strategies. Also identify opportunities to exceed expectations.",
							},
						],
					},
					{
						title: "3.0 Technical Solution",
						level: 2,
						prompt: "Present the comprehensive technical solution that addresses all requirements with proven methodologies.",
						subsections: [
							{
								title: "3.1 Solution Architecture",
								level: 3,
								prompt: "Present the overall solution architecture with diagrams showing components, interfaces, and data flows. Explain how the architecture meets scalability, security, and performance requirements.",
							},
							{
								title: "3.2 Technology Stack",
								level: 3,
								prompt: "Detail the proposed technology stack including hardware, software, platforms, and tools. Justify each selection based on requirements and best practices.",
							},
							{
								title: "3.3 Implementation Approach",
								level: 3,
								prompt: "Describe the implementation methodology including phases, milestones, and deliverables. Show clear linkage between activities and requirements.",
							},
							{
								title: "3.4 Integration Strategy",
								level: 3,
								prompt: "Explain how the solution integrates with existing {{client_name}} systems and infrastructure. Address interface requirements and data exchange.",
							},
							{
								title: "3.5 Security Approach",
								level: 3,
								prompt: "Detail security architecture and controls aligned with {{client_name}}'s security requirements and federal standards (NIST, FISMA, FedRAMP as applicable).",
							},
						],
					},
					{
						title: "4.0 Service Delivery",
						level: 2,
						prompt: "Describe comprehensive service delivery approach ensuring consistent, high-quality IT services.",
						subsections: [
							{
								title: "4.1 Service Management Framework",
								level: 3,
								prompt: "Present the ITIL-aligned service management framework including processes, roles, and governance structure.",
							},
							{
								title: "4.2 Service Level Management",
								level: 3,
								prompt: "Detail SLA management approach including metrics, monitoring, reporting, and continuous improvement.",
							},
							{
								title: "4.3 Operations Model",
								level: 3,
								prompt: "Describe the day-to-day operations model including staffing, shift coverage, and escalation procedures.",
							},
							{
								title: "4.4 Continuous Improvement",
								level: 3,
								prompt: "Present the continuous improvement methodology for ongoing service enhancement and innovation.",
							},
						],
					},
					{
						title: "5.0 Quality Assurance",
						level: 2,
						prompt: "Detail comprehensive quality assurance program ensuring deliverable excellence.",
						subsections: [
							{
								title: "5.1 QA Framework",
								level: 3,
								prompt: "Present the QA framework aligned with ISO 9001 or equivalent standards. Show QA processes integrated throughout service delivery.",
							},
							{
								title: "5.2 Quality Metrics",
								level: 3,
								prompt: "Define quality metrics including targets, measurement methods, and reporting frequency.",
							},
							{
								title: "5.3 Quality Reviews",
								level: 3,
								prompt: "Describe quality review processes including peer reviews, audits, and management reviews.",
							},
						],
					},
					{
						title: "6.0 Risk Management",
						level: 2,
						prompt: "Present proactive risk management approach ensuring successful delivery.",
						subsections: [
							{
								title: "6.1 Risk Management Process",
								level: 3,
								prompt: "Describe risk management methodology including identification, assessment, response planning, and monitoring.",
							},
							{
								title: "6.2 Risk Register",
								level: 3,
								prompt: "Present initial risk register with top risks, probability, impact, and mitigation strategies.",
							},
							{
								title: "6.3 Risk Monitoring",
								level: 3,
								prompt: "Explain ongoing risk monitoring and control procedures integrated with project management.",
							},
						],
					},
				],
			},
			{
				title: "Volume II - Management Approach",
				level: 1,
				prompt: "Present the management approach demonstrating strong project management, staffing, and governance capabilities.",
				subsections: [
					{
						title: "1.0 Management Overview",
						level: 2,
						prompt: "Provide management approach overview highlighting {{company_name}}'s proven management capabilities and commitment to this contract.",
					},
					{
						title: "2.0 Program Management",
						level: 2,
						prompt: "Detail program management approach using PMI/PMBOK methodologies.",
						subsections: [
							{
								title: "2.1 Program Manager Qualifications",
								level: 3,
								prompt: "Present Program Manager qualifications demonstrating exceptional capability for this contract.",
							},
							{
								title: "2.2 Schedule Management",
								level: 3,
								prompt: "Describe schedule management including methodology, tools, and performance tracking.",
							},
							{
								title: "2.3 Cost Management",
								level: 3,
								prompt: "Present cost management approach including earned value management and variance analysis.",
							},
							{
								title: "2.4 Change Management",
								level: 3,
								prompt: "Detail change control process ensuring scope integrity while accommodating necessary changes.",
							},
						],
					},
					{
						title: "3.0 Staffing Approach",
						level: 2,
						prompt: "Present comprehensive staffing approach ensuring qualified personnel are available.",
						subsections: [
							{
								title: "3.1 Organizational Structure",
								level: 3,
								prompt: "Present organizational chart with clear reporting relationships and responsibility assignments.",
							},
							{
								title: "3.2 Key Personnel",
								level: 3,
								prompt: "Identify key personnel with qualifications summary and commitment letters.",
							},
							{
								title: "3.3 Staffing Plan",
								level: 3,
								prompt: "Detail staffing plan including labor categories, FTE allocation, and ramp-up schedule.",
							},
							{
								title: "3.4 Recruitment and Retention",
								level: 3,
								prompt: "Describe recruitment strategies for specialized skills and retention programs ensuring workforce stability.",
							},
						],
					},
					{
						title: "4.0 Transition Plan",
						level: 2,
						prompt: "Present transition plan ensuring seamless assumption of contract responsibilities.",
						subsections: [
							{
								title: "4.1 Transition Approach",
								level: 3,
								prompt: "Describe overall transition methodology minimizing disruption to {{client_name}} operations.",
							},
							{
								title: "4.2 Knowledge Transfer",
								level: 3,
								prompt: "Detail knowledge transfer activities ensuring complete understanding of current operations.",
							},
							{
								title: "4.3 Transition Schedule",
								level: 3,
								prompt: "Present transition timeline with milestones, deliverables, and go/no-go criteria.",
							},
							{
								title: "4.4 Risk Mitigation",
								level: 3,
								prompt: "Identify transition risks and mitigation strategies ensuring successful handover.",
							},
						],
					},
					{
						title: "5.0 Governance and Reporting",
						level: 2,
						prompt: "Present governance framework ensuring transparent, effective contract administration.",
						subsections: [
							{
								title: "5.1 Governance Structure",
								level: 3,
								prompt: "Describe governance structure including boards, committees, and decision-making authority.",
							},
							{
								title: "5.2 Status Reporting",
								level: 3,
								prompt: "Detail status reporting including formats, frequency, and distribution.",
							},
							{
								title: "5.3 Performance Reviews",
								level: 3,
								prompt: "Describe performance review cadence and metrics-driven improvement approach.",
							},
						],
					},
				],
			},
			{
				title: "Volume III - Past Performance",
				level: 1,
				prompt: "Present past performance demonstrating proven capability to successfully perform similar work.",
				subsections: [
					{
						title: "1.0 Past Performance Introduction",
						level: 2,
						prompt: "Introduce past performance volume highlighting consistent track record of excellence.",
					},
					{
						title: "2.0 Relevant Contract 1",
						level: 2,
						prompt: "Present first relevant contract reference with detailed performance narrative.",
						subsections: [
							{
								title: "Contract Information",
								level: 3,
								prompt: "Provide contract information: agency, contract number, value, period of performance, and POC.",
							},
							{
								title: "Scope Description",
								level: 3,
								prompt: "Describe contract scope demonstrating relevance to current opportunity.",
							},
							{
								title: "Performance Narrative",
								level: 3,
								prompt: "Present performance accomplishments with specific metrics, achievements, and value delivered.",
							},
							{
								title: "Lessons Learned",
								level: 3,
								prompt: "Describe lessons learned and how they will be applied to this contract.",
							},
						],
					},
					{
						title: "3.0 Relevant Contract 2",
						level: 2,
						prompt: "Present second relevant contract reference following same structure.",
					},
					{
						title: "4.0 Relevant Contract 3",
						level: 2,
						prompt: "Present third relevant contract reference following same structure.",
					},
					{
						title: "5.0 Past Performance Summary",
						level: 2,
						prompt: "Summarize past performance highlighting consistent excellence and low-risk status.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your organization name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "RFP solicitation number", type: "text", required: true },
			{ id: "p4", name: "Contract Name", variableName: "{{contract_name}}", description: "Name of the contract", type: "text", required: true },
			{ id: "p5", name: "Program Manager", variableName: "{{pm_name}}", description: "Proposed Program Manager name", type: "text", required: true },
		],
	},
	{
		name: "RFP Response - Professional Services",
		description: "Comprehensive RFP response for professional services including consulting, advisory, and support services.",
		categoryIds: ["exec", "mgmt"],
		tags: ["rfp", "professional-services", "consulting", "advisory", "government"],
		difficulty: "advanced",
		estimatedTime: 360,
		sections: [
			{
				title: "Technical/Management Proposal",
				level: 1,
				prompt: "Create integrated technical/management proposal for professional services demonstrating expertise and proven methodology.",
				subsections: [
					{
						title: "Executive Summary",
						level: 2,
						prompt: "Write compelling executive summary positioning {{company_name}} as the ideal partner for {{client_name}}'s professional services needs.",
					},
					{
						title: "Understanding and Approach",
						level: 2,
						prompt: "Demonstrate understanding of requirements and present consulting/advisory approach.",
						subsections: [
							{
								title: "Requirements Understanding",
								level: 3,
								prompt: "Articulate deep understanding of {{client_name}}'s challenges and objectives driving this requirement.",
							},
							{
								title: "Service Approach",
								level: 3,
								prompt: "Present professional services methodology showing how {{company_name}} delivers consistent, high-quality results.",
							},
							{
								title: "Value Proposition",
								level: 3,
								prompt: "Articulate unique value {{company_name}} brings through expertise, experience, and proven results.",
							},
						],
					},
					{
						title: "Technical Capability",
						level: 2,
						prompt: "Demonstrate technical and subject matter expertise for required services.",
						subsections: [
							{
								title: "Subject Matter Expertise",
								level: 3,
								prompt: "Present subject matter expertise relevant to the scope including certifications, thought leadership, and industry recognition.",
							},
							{
								title: "Analytical Capabilities",
								level: 3,
								prompt: "Describe analytical and research capabilities supporting professional services delivery.",
							},
							{
								title: "Tools and Methods",
								level: 3,
								prompt: "Present tools, frameworks, and methodologies applied to deliver services.",
							},
						],
					},
					{
						title: "Team Qualifications",
						level: 2,
						prompt: "Present highly qualified team capable of delivering exceptional professional services.",
						subsections: [
							{
								title: "Team Structure",
								level: 3,
								prompt: "Present team organization showing clear roles and responsibilities.",
							},
							{
								title: "Key Personnel",
								level: 3,
								prompt: "Present key personnel with exceptional credentials and relevant experience.",
							},
							{
								title: "Staff Augmentation",
								level: 3,
								prompt: "Describe ability to augment staff as needed with specialized expertise.",
							},
						],
					},
					{
						title: "Quality and Performance",
						level: 2,
						prompt: "Present quality management and performance measurement approach.",
						subsections: [
							{
								title: "Quality Assurance",
								level: 3,
								prompt: "Describe QA processes ensuring deliverable excellence.",
							},
							{
								title: "Performance Metrics",
								level: 3,
								prompt: "Define metrics demonstrating service quality and client satisfaction.",
							},
						],
					},
					{
						title: "Past Performance",
						level: 2,
						prompt: "Present relevant past performance demonstrating proven professional services delivery.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client agency", type: "text", required: true },
			{ id: "p3", name: "Service Type", variableName: "{{service_type}}", description: "Type of professional services", type: "text", required: true },
		],
	},
	{
		name: "RFP Response - Software Development",
		description: "Detailed RFP response for software development and application modernization contracts.",
		categoryIds: ["tech"],
		tags: ["rfp", "software", "development", "agile", "modernization"],
		difficulty: "advanced",
		estimatedTime: 420,
		sections: [
			{
				title: "Software Development Proposal",
				level: 1,
				prompt: "Create comprehensive software development proposal demonstrating Agile delivery excellence.",
				subsections: [
					{
						title: "Executive Summary",
						level: 2,
						prompt: "Write executive summary highlighting {{company_name}}'s software development expertise and approach for {{client_name}}.",
					},
					{
						title: "Development Approach",
						level: 2,
						prompt: "Present modern software development approach using Agile/DevOps methodologies.",
						subsections: [
							{
								title: "Agile Framework",
								level: 3,
								prompt: "Detail Agile framework (Scrum, SAFe) tailored to {{client_name}}'s needs including ceremonies, cadence, and governance.",
							},
							{
								title: "DevOps Pipeline",
								level: 3,
								prompt: "Present CI/CD pipeline with automation, testing, and deployment processes ensuring rapid, reliable delivery.",
							},
							{
								title: "Sprint Planning",
								level: 3,
								prompt: "Describe sprint planning including backlog management, estimation, and capacity planning.",
							},
							{
								title: "Technical Practices",
								level: 3,
								prompt: "Detail technical practices including TDD, code review, refactoring, and technical debt management.",
							},
						],
					},
					{
						title: "Technical Solution",
						level: 2,
						prompt: "Present technical solution architecture and design approach.",
						subsections: [
							{
								title: "Architecture Approach",
								level: 3,
								prompt: "Describe solution architecture approach including microservices, APIs, and cloud-native patterns.",
							},
							{
								title: "Technology Stack",
								level: 3,
								prompt: "Present proposed technology stack with justification aligned with {{client_name}} standards.",
							},
							{
								title: "Security by Design",
								level: 3,
								prompt: "Detail security-first development approach with DevSecOps integration.",
							},
							{
								title: "Quality Engineering",
								level: 3,
								prompt: "Present quality engineering including automated testing, code quality, and performance testing.",
							},
						],
					},
					{
						title: "Team and Management",
						level: 2,
						prompt: "Present qualified Agile team and management approach.",
						subsections: [
							{
								title: "Agile Team Structure",
								level: 3,
								prompt: "Present Agile team structure including roles (Product Owner, Scrum Master, Developers) and responsibilities.",
							},
							{
								title: "Key Personnel",
								level: 3,
								prompt: "Present key personnel qualifications emphasizing Agile experience and technical expertise.",
							},
							{
								title: "Agile Project Management",
								level: 3,
								prompt: "Describe Agile project management including velocity tracking, burndown, and release planning.",
							},
						],
					},
					{
						title: "Past Performance",
						level: 2,
						prompt: "Present relevant Agile software development past performance with metrics.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client agency", type: "text", required: true },
			{ id: "p3", name: "Development Type", variableName: "{{dev_type}}", description: "Type of development (new, modernization)", type: "select", required: true, options: [{ value: "new", label: "New Development" }, { value: "modernization", label: "Modernization" }, { value: "enhancement", label: "Enhancement" }] },
		],
	},
];

// ============================================================================
// EOI/Expression of Interest Templates (10)
// ============================================================================

export const EOI_TEMPLATES: TemplateDef[] = [
	{
		name: "Expression of Interest - Standard",
		description: "Standard expression of interest response demonstrating capability and interest in upcoming opportunity.",
		categoryIds: ["exec"],
		tags: ["eoi", "expression-of-interest", "capability", "upcoming"],
		difficulty: "beginner",
		estimatedTime: 60,
		sections: [
			{
				title: "Expression of Interest",
				level: 1,
				prompt: "Create a professional expression of interest response for the upcoming opportunity.",
				subsections: [
					{
						title: "Company Introduction",
						level: 2,
						prompt: "Introduce {{company_name}} including years in business, primary services, and relevant experience areas.",
					},
					{
						title: "Interest Statement",
						level: 2,
						prompt: "Express {{company_name}}'s strong interest in the opportunity and commitment to pursue if released.",
					},
					{
						title: "Relevant Capabilities",
						level: 2,
						prompt: "Summarize capabilities directly relevant to the anticipated scope of work.",
					},
					{
						title: "Relevant Experience",
						level: 2,
						prompt: "Highlight 3-5 relevant past contracts demonstrating capability to perform similar work.",
					},
					{
						title: "Certifications and Qualifications",
						level: 2,
						prompt: "List relevant certifications, clearances, and qualifications applicable to this opportunity.",
					},
					{
						title: "Teaming Interest",
						level: 2,
						prompt: "If applicable, indicate interest in teaming and types of partnerships sought.",
					},
					{
						title: "Questions and Clarifications",
						level: 2,
						prompt: "List any clarifying questions about the anticipated requirement to inform planning.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Opportunity Name", variableName: "{{opportunity_name}}", description: "Name of the opportunity", type: "text", required: true },
			{ id: "p3", name: "Agency", variableName: "{{agency}}", description: "Contracting agency", type: "text", required: true },
		],
	},
	{
		name: "Expression of Interest - IT Services",
		description: "EOI specifically for IT services opportunities with technical capability emphasis.",
		categoryIds: ["exec", "tech"],
		tags: ["eoi", "it-services", "technical", "capability"],
		difficulty: "intermediate",
		estimatedTime: 75,
		sections: [
			{
				title: "IT Services EOI Response",
				level: 1,
				prompt: "Create IT services expression of interest demonstrating technical capability.",
				subsections: [
					{
						title: "Company Overview",
						level: 2,
						prompt: "Introduce {{company_name}} with focus on IT services capabilities and technical expertise.",
					},
					{
						title: "Technical Capabilities",
						level: 2,
						prompt: "Detail IT technical capabilities including service areas, technologies, and certifications.",
						subsections: [
							{
								title: "Service Portfolio",
								level: 3,
								prompt: "List IT service offerings with brief descriptions demonstrating breadth and depth.",
							},
							{
								title: "Technical Expertise",
								level: 3,
								prompt: "Highlight specific technical expertise in platforms, tools, and methodologies.",
							},
							{
								title: "Certifications",
								level: 3,
								prompt: "List relevant IT certifications including ISO, CMMI, and vendor certifications.",
							},
						],
					},
					{
						title: "Relevant IT Experience",
						level: 2,
						prompt: "Present IT services past performance demonstrating successful delivery.",
					},
					{
						title: "Proposed Approach",
						level: 2,
						prompt: "Provide high-level approach to IT services delivery if the opportunity proceeds.",
					},
					{
						title: "Security Capabilities",
						level: 2,
						prompt: "Address security capabilities including clearances, compliance frameworks, and security controls.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Opportunity Name", variableName: "{{opportunity_name}}", description: "Opportunity name", type: "text", required: true },
			{ id: "p3", name: "Primary Service", variableName: "{{primary_service}}", description: "Primary IT service area", type: "text", required: false },
		],
	},
	{
		name: "Expression of Interest - Teaming Partner",
		description: "EOI response when seeking teaming arrangements as subcontractor or partner.",
		categoryIds: ["exec"],
		tags: ["eoi", "teaming", "subcontractor", "partnership"],
		difficulty: "intermediate",
		estimatedTime: 60,
		sections: [
			{
				title: "Teaming Partner EOI",
				level: 1,
				prompt: "Create EOI positioning {{company_name}} as valuable teaming partner.",
				subsections: [
					{
						title: "Partnership Value Proposition",
						level: 2,
						prompt: "Articulate the value {{company_name}} brings as a teaming partner for this opportunity.",
					},
					{
						title: "Complementary Capabilities",
						level: 2,
						prompt: "Describe capabilities that complement prime contractor needs.",
					},
					{
						title: "Teaming Experience",
						level: 2,
						prompt: "Highlight successful teaming arrangements and collaborative delivery experience.",
					},
					{
						title: "Proposed Role",
						level: 2,
						prompt: "Suggest potential role and work scope as teaming partner.",
					},
					{
						title: "Socioeconomic Benefits",
						level: 2,
						prompt: "If applicable, highlight small business certifications and socioeconomic benefits.",
					},
					{
						title: "Contact for Teaming",
						level: 2,
						prompt: "Provide teaming contact information and next steps for interested primes.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Opportunity Name", variableName: "{{opportunity_name}}", description: "Opportunity name", type: "text", required: true },
			{ id: "p3", name: "Target Prime", variableName: "{{target_prime}}", description: "Target prime contractor (optional)", type: "text", required: false },
		],
	},
];

// ============================================================================
// Letter Templates (15)
// ============================================================================

export const LETTER_TEMPLATES: TemplateDef[] = [
	{
		name: "Proposal Cover Letter",
		description: "Formal cover letter for proposal submission to government agencies.",
		categoryIds: ["exec"],
		tags: ["letter", "cover-letter", "proposal", "submission", "formal"],
		difficulty: "beginner",
		estimatedTime: 20,
		sections: [
			{
				title: "Cover Letter",
				level: 1,
				prompt: "Create a formal proposal cover letter addressed to {{co_name}} at {{client_name}}.",
				subsections: [
					{
						title: "Reference Line",
						level: 2,
						prompt: "Create reference line with solicitation number {{solicitation_number}} and contract name.",
					},
					{
						title: "Opening Paragraph",
						level: 2,
						prompt: "Express {{company_name}}'s pleasure in submitting this proposal in response to the solicitation.",
					},
					{
						title: "Key Points",
						level: 2,
						prompt: "Present 3 key reasons why {{company_name}} is the ideal contractor for this requirement.",
					},
					{
						title: "Commitment Statement",
						level: 2,
						prompt: "Express commitment to all terms and conditions and ability to begin work as required.",
					},
					{
						title: "Point of Contact",
						level: 2,
						prompt: "Provide authorized point of contact information for proposal discussions.",
					},
					{
						title: "Closing",
						level: 2,
						prompt: "Thank {{client_name}} for the opportunity and express availability for questions.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Agency name", type: "text", required: true },
			{ id: "p3", name: "CO Name", variableName: "{{co_name}}", description: "Contracting Officer name", type: "text", required: true },
			{ id: "p4", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "Solicitation number", type: "text", required: true },
			{ id: "p5", name: "Executive Name", variableName: "{{exec_name}}", description: "Signing executive name", type: "text", required: true },
			{ id: "p6", name: "Executive Title", variableName: "{{exec_title}}", description: "Signing executive title", type: "text", required: true },
		],
	},
	{
		name: "Teaming Agreement Letter of Intent",
		description: "Letter of Intent for teaming arrangements between prime and subcontractor.",
		categoryIds: ["exec"],
		tags: ["letter", "teaming", "loi", "partnership", "subcontractor"],
		difficulty: "intermediate",
		estimatedTime: 30,
		sections: [
			{
				title: "Teaming Letter of Intent",
				level: 1,
				prompt: "Create Letter of Intent establishing teaming relationship between {{company_name}} and {{partner_name}}.",
				subsections: [
					{
						title: "Purpose",
						level: 2,
						prompt: "State purpose of LOI to establish teaming arrangement for the specified opportunity.",
					},
					{
						title: "Opportunity Reference",
						level: 2,
						prompt: "Reference the specific opportunity including agency, name, and solicitation number.",
					},
					{
						title: "Roles and Responsibilities",
						level: 2,
						prompt: "Define preliminary roles with {{company_name}} as [prime/sub] and {{partner_name}} as [prime/sub].",
					},
					{
						title: "Scope of Work",
						level: 2,
						prompt: "Outline preliminary work scope allocation between the parties.",
					},
					{
						title: "Terms",
						level: 2,
						prompt: "State that this LOI is non-binding pending execution of formal teaming agreement.",
					},
					{
						title: "Exclusivity",
						level: 2,
						prompt: "Address exclusivity terms for pursuing this specific opportunity.",
					},
					{
						title: "Duration",
						level: 2,
						prompt: "Specify LOI duration and conditions for conversion to formal teaming agreement.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Partner Name", variableName: "{{partner_name}}", description: "Teaming partner name", type: "text", required: true },
			{ id: "p3", name: "Opportunity Name", variableName: "{{opportunity_name}}", description: "Opportunity name", type: "text", required: true },
			{ id: "p4", name: "Role", variableName: "{{role}}", description: "Your role", type: "select", required: true, options: [{ value: "prime", label: "Prime Contractor" }, { value: "subcontractor", label: "Subcontractor" }] },
		],
	},
	{
		name: "Key Personnel Commitment Letter",
		description: "Commitment letter from key personnel for government proposal.",
		categoryIds: ["hr"],
		tags: ["letter", "commitment", "key-personnel", "personnel", "proposal"],
		difficulty: "beginner",
		estimatedTime: 15,
		sections: [
			{
				title: "Key Personnel Commitment Letter",
				level: 1,
				prompt: "Create commitment letter from {{personnel_name}} confirming availability and commitment.",
				subsections: [
					{
						title: "Introduction",
						level: 2,
						prompt: "State purpose of letter as personal commitment to serve in the proposed role.",
					},
					{
						title: "Position Commitment",
						level: 2,
						prompt: "Confirm commitment to serve as {{position_title}} on the {{contract_name}} contract if awarded.",
					},
					{
						title: "Availability",
						level: 2,
						prompt: "Confirm availability to begin work as of the proposed start date or contract award.",
					},
					{
						title: "Qualifications Summary",
						level: 2,
						prompt: "Briefly summarize qualifications making {{personnel_name}} ideally suited for this role.",
					},
					{
						title: "Time Commitment",
						level: 2,
						prompt: "Confirm percentage of time committed to this contract.",
					},
					{
						title: "Personal Statement",
						level: 2,
						prompt: "Express personal enthusiasm for the opportunity to serve {{client_name}}.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Personnel Name", variableName: "{{personnel_name}}", description: "Key personnel name", type: "text", required: true },
			{ id: "p2", name: "Position Title", variableName: "{{position_title}}", description: "Proposed position", type: "text", required: true },
			{ id: "p3", name: "Contract Name", variableName: "{{contract_name}}", description: "Contract name", type: "text", required: true },
			{ id: "p4", name: "Client Name", variableName: "{{client_name}}", description: "Client agency", type: "text", required: true },
			{ id: "p5", name: "Time Percentage", variableName: "{{time_pct}}", description: "Time commitment %", type: "number", required: true, defaultValue: "100" },
		],
	},
	{
		name: "Past Performance Reference Request",
		description: "Letter requesting past performance reference from client.",
		categoryIds: ["exp"],
		tags: ["letter", "reference", "past-performance", "request"],
		difficulty: "beginner",
		estimatedTime: 15,
		sections: [
			{
				title: "Reference Request Letter",
				level: 1,
				prompt: "Create professional letter requesting past performance reference.",
				subsections: [
					{
						title: "Introduction",
						level: 2,
						prompt: "Introduce {{company_name}} and reference the contract performed for the recipient's organization.",
					},
					{
						title: "Purpose",
						level: 2,
						prompt: "Explain that {{company_name}} is pursuing a new opportunity and respectfully requests a reference.",
					},
					{
						title: "Reference Details",
						level: 2,
						prompt: "Provide details on the reference needed including format and submission instructions.",
					},
					{
						title: "Contract Reminder",
						level: 2,
						prompt: "Briefly remind recipient of contract scope, period of performance, and key achievements.",
					},
					{
						title: "Deadline",
						level: 2,
						prompt: "Specify deadline for reference submission and offer to provide additional information.",
					},
					{
						title: "Gratitude",
						level: 2,
						prompt: "Express appreciation for consideration and past working relationship.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Recipient Name", variableName: "{{recipient_name}}", description: "Reference contact name", type: "text", required: true },
			{ id: "p3", name: "Contract Name", variableName: "{{contract_name}}", description: "Past contract name", type: "text", required: true },
			{ id: "p4", name: "Deadline", variableName: "{{deadline}}", description: "Reference deadline", type: "date", required: true },
		],
	},
	{
		name: "Proposal Clarification Response",
		description: "Formal response letter to proposal clarification request from agency.",
		categoryIds: ["exec"],
		tags: ["letter", "clarification", "response", "proposal", "Q&A"],
		difficulty: "intermediate",
		estimatedTime: 25,
		sections: [
			{
				title: "Clarification Response Letter",
				level: 1,
				prompt: "Create formal response to proposal clarification request.",
				subsections: [
					{
						title: "Reference",
						level: 2,
						prompt: "Reference the clarification request date and specific questions received.",
					},
					{
						title: "Clarification Responses",
						level: 2,
						prompt: "Provide clear, complete responses to each clarification question in order.",
					},
					{
						title: "Proposal Impact",
						level: 2,
						prompt: "If clarifications result in proposal changes, note affected sections.",
					},
					{
						title: "Closing",
						level: 2,
						prompt: "Confirm no changes to pricing or other proposal elements unless otherwise noted.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Solicitation Number", variableName: "{{solicitation_number}}", description: "Solicitation number", type: "text", required: true },
			{ id: "p3", name: "Request Date", variableName: "{{request_date}}", description: "Date of clarification request", type: "date", required: true },
		],
	},
	{
		name: "Contract Award Acceptance Letter",
		description: "Formal letter accepting contract award.",
		categoryIds: ["exec"],
		tags: ["letter", "award", "acceptance", "contract"],
		difficulty: "beginner",
		estimatedTime: 15,
		sections: [
			{
				title: "Award Acceptance Letter",
				level: 1,
				prompt: "Create formal contract award acceptance letter.",
				subsections: [
					{
						title: "Acceptance Statement",
						level: 2,
						prompt: "Formally accept the contract award for {{contract_name}}.",
					},
					{
						title: "Appreciation",
						level: 2,
						prompt: "Express appreciation for {{client_name}}'s confidence in selecting {{company_name}}.",
					},
					{
						title: "Commitment",
						level: 2,
						prompt: "Reaffirm commitment to excellent performance and meeting all requirements.",
					},
					{
						title: "Transition Readiness",
						level: 2,
						prompt: "Confirm readiness to begin transition/mobilization activities immediately.",
					},
					{
						title: "Points of Contact",
						level: 2,
						prompt: "Provide key points of contact for contract administration.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Contracting agency", type: "text", required: true },
			{ id: "p3", name: "Contract Name", variableName: "{{contract_name}}", description: "Contract name", type: "text", required: true },
			{ id: "p4", name: "Contract Number", variableName: "{{contract_number}}", description: "Contract number", type: "text", required: true },
		],
	},
	{
		name: "Business Introduction Letter",
		description: "Letter introducing company to potential client or partner.",
		categoryIds: ["exec"],
		tags: ["letter", "introduction", "business", "networking"],
		difficulty: "beginner",
		estimatedTime: 20,
		sections: [
			{
				title: "Business Introduction Letter",
				level: 1,
				prompt: "Create professional business introduction letter.",
				subsections: [
					{
						title: "Introduction",
						level: 2,
						prompt: "Introduce {{company_name}} and the purpose of reaching out.",
					},
					{
						title: "Company Background",
						level: 2,
						prompt: "Provide brief company background including founding, mission, and core focus.",
					},
					{
						title: "Capabilities",
						level: 2,
						prompt: "Summarize key capabilities and services relevant to the recipient.",
					},
					{
						title: "Value Proposition",
						level: 2,
						prompt: "Articulate potential value of partnership or collaboration.",
					},
					{
						title: "Call to Action",
						level: 2,
						prompt: "Request meeting or call to discuss potential opportunities.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Recipient Name", variableName: "{{recipient_name}}", description: "Recipient name", type: "text", required: true },
			{ id: "p3", name: "Recipient Organization", variableName: "{{recipient_org}}", description: "Recipient organization", type: "text", required: true },
		],
	},
	{
		name: "Thank You Letter - Post Meeting",
		description: "Follow-up thank you letter after client or partner meeting.",
		categoryIds: ["exec"],
		tags: ["letter", "thank-you", "follow-up", "meeting"],
		difficulty: "beginner",
		estimatedTime: 10,
		sections: [
			{
				title: "Thank You Letter",
				level: 1,
				prompt: "Create professional thank you letter following meeting.",
				subsections: [
					{
						title: "Appreciation",
						level: 2,
						prompt: "Thank {{recipient_name}} for taking time to meet on {{meeting_date}}.",
					},
					{
						title: "Key Takeaways",
						level: 2,
						prompt: "Summarize key discussion points and mutual interests identified.",
					},
					{
						title: "Next Steps",
						level: 2,
						prompt: "Confirm agreed-upon next steps and {{company_name}}'s commitments.",
					},
					{
						title: "Closing",
						level: 2,
						prompt: "Express anticipation of future collaboration and provide contact information.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Recipient Name", variableName: "{{recipient_name}}", description: "Meeting participant name", type: "text", required: true },
			{ id: "p3", name: "Meeting Date", variableName: "{{meeting_date}}", description: "Date of meeting", type: "date", required: true },
		],
	},
];

// ============================================================================
// Invoice Templates (10)
// ============================================================================

export const INVOICE_TEMPLATES: TemplateDef[] = [
	{
		name: "Standard Invoice - Time & Materials",
		description: "Standard T&M invoice for government or commercial contracts.",
		categoryIds: ["cost"],
		tags: ["invoice", "billing", "time-materials", "T&M"],
		difficulty: "beginner",
		estimatedTime: 20,
		sections: [
			{
				title: "Invoice",
				level: 1,
				prompt: "Create professional invoice for time and materials billing.",
				subsections: [
					{
						title: "Invoice Header",
						level: 2,
						prompt: "Create invoice header with {{company_name}} information, invoice number, and date.",
					},
					{
						title: "Bill To",
						level: 2,
						prompt: "Add billing address for {{client_name}} with contract reference.",
					},
					{
						title: "Invoice Period",
						level: 2,
						prompt: "Specify invoice period from {{period_start}} to {{period_end}}.",
					},
					{
						title: "Labor Charges",
						level: 2,
						prompt: "Detail labor charges by category including hours, rates, and extended amounts.",
					},
					{
						title: "Other Direct Costs",
						level: 2,
						prompt: "List other direct costs (ODCs) with descriptions and amounts.",
					},
					{
						title: "Summary",
						level: 2,
						prompt: "Provide invoice summary with subtotals, applicable taxes, and total due.",
					},
					{
						title: "Payment Terms",
						level: 2,
						prompt: "State payment terms and remittance instructions.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client name", type: "text", required: true },
			{ id: "p3", name: "Contract Number", variableName: "{{contract_number}}", description: "Contract number", type: "text", required: true },
			{ id: "p4", name: "Invoice Number", variableName: "{{invoice_number}}", description: "Invoice number", type: "text", required: true },
			{ id: "p5", name: "Period Start", variableName: "{{period_start}}", description: "Billing period start", type: "date", required: true },
			{ id: "p6", name: "Period End", variableName: "{{period_end}}", description: "Billing period end", type: "date", required: true },
		],
	},
	{
		name: "Fixed Price Invoice",
		description: "Invoice for fixed price contract deliverables or milestones.",
		categoryIds: ["cost"],
		tags: ["invoice", "billing", "fixed-price", "milestone"],
		difficulty: "beginner",
		estimatedTime: 15,
		sections: [
			{
				title: "Fixed Price Invoice",
				level: 1,
				prompt: "Create invoice for fixed price deliverables or milestone payments.",
				subsections: [
					{
						title: "Invoice Header",
						level: 2,
						prompt: "Create invoice header with company information and invoice details.",
					},
					{
						title: "Contract Reference",
						level: 2,
						prompt: "Reference contract number, task order if applicable, and CLIN.",
					},
					{
						title: "Deliverable/Milestone",
						level: 2,
						prompt: "Identify the deliverable or milestone being invoiced with completion date.",
					},
					{
						title: "Amount",
						level: 2,
						prompt: "State the fixed price amount per contract terms.",
					},
					{
						title: "Certification",
						level: 2,
						prompt: "Include certification that deliverable was accepted by {{client_name}}.",
					},
					{
						title: "Payment Instructions",
						level: 2,
						prompt: "Provide payment instructions and due date.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client name", type: "text", required: true },
			{ id: "p3", name: "Contract Number", variableName: "{{contract_number}}", description: "Contract number", type: "text", required: true },
			{ id: "p4", name: "Deliverable", variableName: "{{deliverable}}", description: "Deliverable name", type: "text", required: true },
			{ id: "p5", name: "Amount", variableName: "{{amount}}", description: "Invoice amount", type: "currency", required: true },
		],
	},
	{
		name: "Invoice - Cost Plus",
		description: "Cost-plus contract invoice with fee calculation.",
		categoryIds: ["cost"],
		tags: ["invoice", "billing", "cost-plus", "CPFF", "CPIF"],
		difficulty: "intermediate",
		estimatedTime: 30,
		sections: [
			{
				title: "Cost Plus Invoice",
				level: 1,
				prompt: "Create cost-plus invoice with proper fee calculation.",
				subsections: [
					{
						title: "Invoice Header",
						level: 2,
						prompt: "Create invoice header with complete company and contract information.",
					},
					{
						title: "Direct Costs",
						level: 2,
						prompt: "Detail all direct costs including labor, materials, and ODCs.",
					},
					{
						title: "Indirect Costs",
						level: 2,
						prompt: "Calculate indirect costs using approved rates (fringe, overhead, G&A).",
					},
					{
						title: "Fee Calculation",
						level: 2,
						prompt: "Calculate fee based on contract type (fixed fee or incentive fee).",
					},
					{
						title: "Total Amount",
						level: 2,
						prompt: "Summarize total allowable costs plus fee for invoice total.",
					},
					{
						title: "Certification",
						level: 2,
						prompt: "Include required certifications for cost reimbursement invoicing.",
					},
				],
			},
		],
		placeholders: [
			{ id: "p1", name: "Company Name", variableName: "{{company_name}}", description: "Your company name", type: "text", required: true },
			{ id: "p2", name: "Client Name", variableName: "{{client_name}}", description: "Client name", type: "text", required: true },
			{ id: "p3", name: "Contract Number", variableName: "{{contract_number}}", description: "Contract number", type: "text", required: true },
			{ id: "p4", name: "Fee Rate", variableName: "{{fee_rate}}", description: "Fee rate percentage", type: "number", required: true },
		],
	},
];

// Export all extended templates
export const EXTENDED_TEMPLATES = [
	...RFP_TEMPLATES,
	...EOI_TEMPLATES,
	...LETTER_TEMPLATES,
	...INVOICE_TEMPLATES,
];
