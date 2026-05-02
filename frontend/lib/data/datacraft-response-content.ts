import type { DocumentContent } from "@/lib/types/document";
import type { ProposalDocumentType } from "@/lib/types/opportunity";
import type { CreateTemplateInput } from "@/lib/types/template";

type ContentNode = NonNullable<DocumentContent["content"]>[number];

export interface DatacraftResponseSnippetInput {
	name: string;
	shortcut: string;
	description: string;
	category: string;
	tags: string[];
	content: DocumentContent;
	contentType: string;
	topicCategory: string;
	sectors: string[];
	technologies: string[];
	complianceFrameworks: string[];
	keyTerms: string[];
}

export interface DatacraftSectionSeed {
	sectionName: string;
	targetWordCount: number;
}

function t(text: string): ContentNode {
	return { type: "text", text };
}

function h(level: number, text: string): ContentNode {
	return {
		type: "heading",
		attrs: { level },
		content: [t(text)],
	};
}

function p(text: string): ContentNode {
	return {
		type: "paragraph",
		content: [t(text)],
	};
}

function bullets(items: string[]): ContentNode {
	return {
		type: "bulletList",
		content: items.map((item) => ({
			type: "listItem",
			content: [p(item)],
		})),
	};
}

function rule(): ContentNode {
	return { type: "horizontalRule" };
}

function doc(content: ContentNode[]): DocumentContent {
	return {
		type: "doc",
		content,
	};
}

function words(content: DocumentContent): number {
	return JSON.stringify(content)
		.replace(/"[^"]+":/g, " ")
		.replace(/[{}[\],"]/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
}

const commonPlaceholders = [
	{ id: "client_name", name: "Client Name", variableName: "client_name", type: "text" as const, required: true },
	{ id: "opportunity_name", name: "Opportunity Name", variableName: "opportunity_name", type: "text" as const, required: true },
	{ id: "solicitation_number", name: "Solicitation Number", variableName: "solicitation_number", type: "text" as const, required: false },
	{ id: "submission_date", name: "Submission Date", variableName: "submission_date", type: "date" as const, required: false },
];

export const DATACRAFT_RESPONSE_PROFILE = {
	companyName: "Datacraft Ltd",
	tagline: "Building Africa's institutional software, from first principles.",
	location: "Nairobi, Kenya",
	website: "www.datacraft.co.ke",
	email: "hello@datacraft.co.ke",
	phone: "+254 72 663 1615",
};

const executiveSummaryContent = doc([
	h(1, "Executive Summary"),
	p("Datacraft Ltd is a Nairobi-based African technology company that builds enterprise-grade software for governments, regional bodies, regulated financial institutions, and mission-critical operators. We are not proposing an imported platform with African settings added at the edge. We are proposing a sovereign institutional operating system: one data spine, one identity stack, one classification spine, and one audit chain, designed from the first line of code for African regulatory execution, African payment rails, intermittent-connectivity field operations, African languages, and institutional data sovereignty."),
	p("For {{client_name}}, this matters because the success of {{opportunity_name}} will not be determined by the number of screens delivered. It will be determined by whether the platform can operate under real institutional constraints: data that must remain under sovereign control, users who work in low-connectivity environments, records that must survive audit months after a decision, payments and reconciliations that must match local rails, and decision-makers who need reliable intelligence fast enough to change outcomes."),
	p("Datacraft brings a production footprint that directly de-risks this engagement: Lindela is live at IGAD, the Eastern Africa Standby Force, and two national security agencies under non-disclosure; Wakala clears and settles regulated payment traffic at TerraSwitch in Nigeria; and MeGuard operates a large integrated East African private-security footprint across more than 2,000 guards and 300 sites. These are not demonstrations. They are live institutional systems handling operational pressure, compliance demands, and audit obligations every day."),
	p("Our offer is therefore practical and ambitious at the same time: deliver a system that meets the stated requirements, then compound in value as users, data, workflows, and institutional memory accumulate. Datacraft's advantage is not a single feature. It is the operating discipline that comes from building intelligence, field operations, and financial-market infrastructure on one shared foundation."),
]);

const companyOverviewContent = doc([
	h(1, "Company Overview"),
	p("Datacraft Ltd is a fully African, Nairobi-based technology company founded in 2024 by Nyimbi Odero. The company operates across three countries and combines deep engineering capability with first-hand knowledge of African regulatory environments, institutional procurement, field operations, and data sovereignty requirements."),
	p("Our core thesis is simple: African institutions should not have to choose between operational depth and sovereignty. They should not have to run modern public, financial, security, or humanitarian workflows on spreadsheets, disconnected databases, and imported platforms whose roadmaps do not include M-Pesa, MTN MoMo, PSRA compliance, KRA eTIMS, African-language NLP, air-gap deployment, or offline-first mobile operations."),
	p("Datacraft closes that gap by building reusable institutional infrastructure. Every product sits on the same foundation: a coherent entity and event model, a federated identity layer, record-level authorization, immutable audit trails, classification metadata, deployment portability, and integration patterns that work across African payment, regulatory, and connectivity realities."),
	bullets([
		"Headquarters: Nairobi, Kenya.",
		"Primary contact: hello@datacraft.co.ke, www.datacraft.co.ke, +254 72 663 1615.",
		"Flagship platforms: Lindela for institutional intelligence, MeGuard for security operations, and Wakala for regulated payment switching.",
		"Deployment posture: cloud, on-premise, hybrid, and air-gap, with data residency controls and customer-controlled update cadence.",
	]),
]);

const africanFirstContent = doc([
	h(1, "Understanding of the Operating Environment"),
	p("Datacraft's strongest qualification is that we design for the environment in which the platform will actually operate. African institutions face a different combination of constraints than the Western markets for which most global software was designed: fragmented legacy data, intermittent connectivity, local mobile-money rails, multi-jurisdiction regulatory reporting, language diversity, sovereignty-sensitive infrastructure, and procurement committees that must defend long-term value under budget pressure."),
	p("We treat these constraints as the design brief, not as exceptions. Offline-first mobile is a foundation for guards, observers, civil-affairs teams, health workers, and field monitors. Local payment rails are part of the transactional substrate, not a custom integration afterthought. Regulatory rules such as PSRA, KRA eTIMS, NSSF, PAYE, NAICOM, FSCA, and IFRS 17 are encoded as workflow obligations. Classification, releasability, record-level authorization, and audit trails are built into the data model rather than appended after go-live."),
	p("The result is software that reduces institutional friction rather than transferring it from one team to another. Users can operate where the network is weak. Compliance teams can see evidence before an audit. Executives can trust dashboard numbers because the transaction, source, workflow, and approval chain resolve to the same underlying record. Technology becomes institutional infrastructure instead of another tool requiring manual reconciliation."),
]);

const technicalApproachContent = doc([
	h(1, "Technical Approach"),
	p("Datacraft will deliver {{opportunity_name}} as a workflow-backed institutional platform, not as a collection of disconnected screens. The implementation will start by making the client's operating model explicit: actors, subject records, states, transitions, approvals, evidence, documents, notifications, service levels, reversals, audit events, and dashboard metrics. Those definitions then become executable workflow templates and domain services rather than slideware."),
	h(2, "Unified Data Spine"),
	p("The platform will use a single canonical data spine for the entities that matter: people, organizations, cases, incidents, transactions, assets, documents, requirements, approvals, and evidence. This reduces reconciliation work and allows the same event to power operational views, compliance checks, analytics, and executive reporting."),
	h(2, "Workflow-First Delivery"),
	p("Every critical job will have a durable state model. Intake, triage, assignment, review, approval, exception handling, dispatch, notification, escalation, and closure will be auditable transitions. This gives operations managers visibility into work in progress and gives administrators a practical way to tune processes without weakening control."),
	h(2, "AI With Evidence Discipline"),
	p("AI will be used where it shortens cycle time and improves decision quality: summarization, extraction, triage, drafting, anomaly detection, and recommendation. Every AI-assisted output will preserve source references, confidence signals, human override points, and audit metadata. Datacraft's production intelligence platforms already use content-addressed artefacts and source-cited outputs because institutional users cannot accept black-box answers."),
	h(2, "Integration and Deployment"),
	p("The platform will integrate through documented APIs, batch imports where appropriate, event-driven connectors where available, and secure file exchange where legacy constraints require it. Deployment can be cloud-hosted, on-premise, hybrid, or air-gapped. Security-critical patches will be packaged for customer-controlled release with rollback paths."),
]);

const securityContent = doc([
	h(1, "Security, Sovereignty, and Auditability"),
	p("Datacraft's security posture begins with the assumption that institutional data is not generic SaaS data. It may include regulated personal data, operationally sensitive records, classified intelligence, financial transactions, biometric evidence, or audit material that must remain under the institution's legal and physical control."),
	p("Our architecture therefore supports sovereign data residency, on-premise and air-gap deployment, encryption at rest and in transit, record-level authorization, immutable audit trails, and classification metadata inherited by derivative artefacts. In Lindela, every record carries structured confidentiality metadata, handling caveats, releasability controls, originator context, and need-to-know restrictions. Those same principles inform Datacraft's broader platform foundation."),
	p("Auditability is treated as a product requirement. Access, export, classification change, approval, override, workflow transition, and document generation events are logged. Evidence artefacts can be content-addressed and linked back to their source. Reviewers can reconstruct what was known, who acted, what changed, what was approved, and which evidence supported the decision."),
	bullets([
		"Deployment options: cloud, on-premise, hybrid, and air-gap.",
		"Controls: record-level authorization, encryption, immutable audit trails, source-linked artefacts, and classification-aware publishing.",
		"Operational discipline: customer-controlled releases, security-critical patching, and one-command rollback patterns.",
		"Procurement value: sovereignty and compliance are default posture, not premium add-ons.",
	]),
]);

const lindelaContent = doc([
	h(1, "Relevant Capability: Lindela Institutional Intelligence"),
	p("Lindela is Datacraft's operating system for African institutional intelligence. It is live at IGAD, at the Eastern Africa Standby Force, and at two national security agencies operating under non-disclosure. The platform is organized into nine integrated workspaces: AI Agents, Counter-Insurgency, Counter-Terrorism, Intelligence, Military, Elections, Early Warning, GIS, and Master Overview. All share one data spine, one identity stack, one classification spine, and one audit chain."),
	p("The platform ingests and fuses data from African press and broadcast monitoring, ACLED, GDELT, UNHCR, WHO, FAO, CHIRPS rainfall, Copernicus climate reanalysis, NASA fire detections, sanctions lists, maritime AIS, aviation ADSB, satellite imagery, field collection, and partner-sharing feeds. The collection foundation is paired with AI agents for conflict monitoring, humanitarian response, climate-conflict analysis, electoral integrity, financial intelligence, network analysis, and executive synthesis."),
	p("For evaluators, Lindela proves Datacraft can deliver complex, workflow-heavy, security-sensitive systems where the user must trust the platform under operational pressure. It also proves our ability to encode doctrine and standards as data models: AU CEWS, IGAD CEWARN, EASF E-WARN, UN EW4All, F3EAD, MITRE ATT&CK, FATF, ICD 203, ICD 206, Sherman Kent estimative language, STANAG 4774/4778, OGC geospatial standards, and ICAO border-data patterns."),
]);

const meguardContent = doc([
	h(1, "Relevant Capability: MeGuard Operations Platform"),
	p("MeGuard is Datacraft's full-stack command center for Private Security Companies in East Africa. It replaces fragmented WhatsApp dispatch groups, paper logbooks, disconnected spreadsheets, and imported tools that do not understand East African regulatory or payment environments."),
	p("The platform spans guard management, workforce operations, command center, client management, billing, asset tracking, inventory, analytics, compliance, payroll, communications, mobile guard experience, admin configuration, alarm receiving, CCTV surveillance, visitor management, voice, cash-in-transit, ambulance dispatch, and courier logistics. When a guard clocks in biometrically at the assigned site, attendance, payroll, scheduling, and client dashboards update against the same record."),
	p("MeGuard demonstrates Datacraft's ability to convert field operations into auditable digital workflows. It includes facial recognition plus GPS co-location, predictive scheduling across large guard and site footprints, 14-day forecasting, anomaly detection, site and guard risk scoring, alarm receiving and nearest-response dispatch, M-Pesa and MTN MoMo bulk disbursement, KRA eTIMS, PSRA licence tracking, and multi-country statutory payroll calculations."),
]);

const wakalaContent = doc([
	h(1, "Relevant Capability: Wakala Regulated Payment Switching"),
	p("Wakala is Datacraft's regulated payment-switch and financial-market-infrastructure stack, live at TerraSwitch in Nigeria. It matters to this proposal because switch-grade software requires a discipline that ordinary enterprise systems often lack: idempotency, reconciliation, double-entry consistency, exactly-once retry semantics, settlement visibility, reversal handling, dispute traceability, and complete audit trails."),
	p("The platform covers ISO 8583 payment switching, multi-currency routing, clearing and settlement, tokenization, chargebacks, PCI DSS controls, 3D Secure, dynamic currency conversion, mobile-money and alternative payment methods, RTGS, ACH, EFT, ISO 20022, SWIFT integration, AML/KYC screening, SIEM and IDPS integration, and containerized deployment."),
	p("That engineering discipline transfers directly into government, insurance, donor, marketplace, disbursement, and procurement systems. Any workflow that involves value movement, claims, receipts, disbursements, reversals, approvals, or audit needs the same transaction integrity. Datacraft already ships to that bar."),
]);

const implementationContent = doc([
	h(1, "Implementation Approach"),
	p("Datacraft proposes a staged delivery model that gives {{client_name}} usable capability early while protecting architectural integrity. We begin with discovery and workflow modelling, move into an operational pilot, harden integrations and controls, then scale across users, data sources, and reporting obligations."),
	h(2, "Phase 1: Mobilize and Model"),
	p("We confirm objectives, governance, stakeholders, data sources, security posture, operating procedures, and acceptance criteria. The primary output is an implementation blueprint: workflow catalogue, subject-state models, role matrix, integration map, data migration plan, reporting pack, and risk register."),
	h(2, "Phase 2: Build and Pilot"),
	p("We configure the core platform, implement priority workflows, connect required data sources, load initial records, and train a pilot user group. Pilot success is measured against real jobs: intake, assignment, evidence capture, review, approval, notification, reporting, and closure."),
	h(2, "Phase 3: Harden and Integrate"),
	p("We complete production security controls, performance tuning, operational dashboards, audit exports, exception handling, data-quality checks, backup and recovery, and change management. Integrations are tested through failure scenarios, not only success paths."),
	h(2, "Phase 4: Scale and Transfer"),
	p("We expand usage, train administrators, hand over runbooks, refine dashboards, and establish a continuous-improvement cadence. The client should exit delivery with both a working platform and the internal confidence to operate it."),
]);

const pastPerformanceContent = doc([
	h(1, "Past Performance and Proof"),
	p("Datacraft's past performance is strongest where the requirement demands operational complexity, sovereignty, auditability, and African-market fluency. Lindela is in production for IGAD, the Eastern Africa Standby Force, and two national security agencies under non-disclosure. Wakala is clearing and settling live traffic at TerraSwitch in Nigeria. MeGuard operates a large integrated East African private-security footprint across more than 2,000 guards and 300 sites."),
	p("The company's founder and CEO, Nyimbi Odero, adds a rare individual delivery record. His prior work includes technical leadership of Nigeria's 2011 biometric voter registration effort, which registered 73.5 million citizens in 21 days through a disconnected field architecture, and advisory leadership in Kenya Judiciary digitization, reducing case filing times from 40 days to 7 days while reaching broad court-station adoption. That background matters because it shows familiarity with the kind of institutional scale, political visibility, field constraint, and audit pressure that major public-sector technology programs carry."),
	p("The practical value to {{client_name}} is lower execution risk. Datacraft has already delivered systems where users cannot pause operations while the software catches up; where evidence, identity, payments, and permissions must reconcile; and where the consequences of delay or weak auditability are institutional rather than cosmetic."),
]);

const valueContent = doc([
	h(1, "Value Proposition"),
	p("Datacraft offers {{client_name}} a rare combination: the ambition of a global institutional platform, the economics of an African technology partner, and the operating fluency of a team that designs for African regulatory, language, payment, and sovereignty constraints from the start."),
	p("The value case is not only license cost. It is the avoided cost of misfit software: manual reconciliation, compliance exposure, duplicated data entry, shadow spreadsheets, audit findings, delayed decisions, brittle integrations, and procurement lock-in to vendors whose product roadmaps do not include the client's operating context."),
	p("Our platform compounds. Every workflow digitized improves the audit trail. Every data source connected improves the institutional picture. Every approved template speeds the next response. Every integration retired reduces reconciliation drag. Every user action becomes measurable operational intelligence. That is why Datacraft frames delivery as infrastructure, not implementation theater."),
	bullets([
		"Lower total cost of ownership through local engineering economics and reusable platform foundations.",
		"Lower operational risk through workflow-backed approvals, evidence, SLAs, and audit events.",
		"Lower sovereignty risk through cloud, on-premise, hybrid, and air-gap deployment options.",
		"Higher institutional learning through a shared data spine, analytics, and reusable content assets.",
	]),
]);

const complianceContent = doc([
	h(1, "Compliance and Standards Alignment"),
	p("Datacraft designs compliance into workflows and data models. Where global vendors often map African requirements after implementation, Datacraft starts from the regulatory and doctrinal environment in which the client operates."),
	p("Across current products, the platform foundation aligns with or encodes PSRA, KRA eTIMS, NSSF, NHIF, PAYE, NAICOM returns, FSCA filings, IFRS 17 inputs, FATF Recommendations, ISO 8583, ISO 20022, PCI DSS, STANAG 4774/4778, OGC geospatial standards, ICAO API/PNR formats, AU CEWS, IGAD CEWARN, EASF E-WARN, UN EW4All, ICD 203, ICD 206, Sherman Kent estimative language, MITRE ATT&CK, and other sector-specific frameworks."),
	p("For {{opportunity_name}}, we will convert applicable compliance requirements into acceptance criteria, workflow gates, evidence records, review tasks, dashboards, and audit exports. Compliance will therefore be visible during delivery and operation, not reconstructed at the end."),
]);

const closingContent = doc([
	h(1, "Commitment Statement"),
	p("Datacraft is prepared to deliver {{opportunity_name}} with the seriousness it deserves: senior technical attention, transparent governance, disciplined workflow modelling, pragmatic integration choices, and a delivery posture that respects {{client_name}}'s institutional mandate."),
	p("We will be direct where requirements create risk, rigorous where evidence is needed, and ambitious where the platform can produce leverage beyond the minimum scope. Our objective is not merely to pass acceptance testing. It is to leave {{client_name}} with a working institutional capability that is secure, auditable, adaptable, and useful under real operational pressure."),
	p("Datacraft appreciates the opportunity to submit this response and stands ready to provide demonstrations, technical clarifications, reference discussions under appropriate confidentiality arrangements, and a delivery workshop to align scope, timeline, and success measures."),
]);

export const DATACRAFT_RESPONSE_SNIPPETS: DatacraftResponseSnippetInput[] = [
	{
		name: "Datacraft Executive Summary",
		shortcut: "/dc-exec-summary",
		description: "Persuasive opening for institutional technology RFPs.",
		category: "Datacraft Response",
		tags: ["datacraft", "executive-summary", "rfp", "sovereignty"],
		content: executiveSummaryContent,
		contentType: "capability",
		topicCategory: "Executive",
		sectors: ["government", "regional bodies", "regulated finance", "enterprise"],
		technologies: ["workflow automation", "AI", "data platform", "audit"],
		complianceFrameworks: ["STANAG 4774/4778", "ICD 206"],
		keyTerms: ["sovereign institutional operating system", "data spine", "audit chain", "African-first"],
	},
	{
		name: "Datacraft Company Overview",
		shortcut: "/dc-company",
		description: "Reusable Datacraft company profile block.",
		category: "Datacraft Response",
		tags: ["datacraft", "company", "profile"],
		content: companyOverviewContent,
		contentType: "boilerplate",
		topicCategory: "Company",
		sectors: ["government", "enterprise"],
		technologies: ["platform engineering"],
		complianceFrameworks: [],
		keyTerms: ["Nairobi", "Nyimbi Odero", "enterprise-grade software"],
	},
	{
		name: "African-First Operating Environment",
		shortcut: "/dc-african-first",
		description: "Frames Datacraft's market-specific understanding.",
		category: "Datacraft Response",
		tags: ["datacraft", "market", "africa", "strategy"],
		content: africanFirstContent,
		contentType: "solution",
		topicCategory: "Understanding",
		sectors: ["government", "field operations", "financial services"],
		technologies: ["offline-first mobile", "mobile money", "NLP"],
		complianceFrameworks: ["PSRA", "KRA eTIMS", "NAICOM", "FSCA", "IFRS 17"],
		keyTerms: ["offline-first", "payment rails", "data sovereignty"],
	},
	{
		name: "Datacraft Technical Approach",
		shortcut: "/dc-technical",
		description: "Workflow-first technical approach for platform delivery.",
		category: "Datacraft Response",
		tags: ["datacraft", "technical-approach", "workflow"],
		content: technicalApproachContent,
		contentType: "solution",
		topicCategory: "Technical",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["workflow runtime", "AI", "APIs", "data integration"],
		complianceFrameworks: ["ICD 206"],
		keyTerms: ["durable state model", "workflow templates", "canonical data spine"],
	},
	{
		name: "Security and Sovereignty",
		shortcut: "/dc-security",
		description: "Security, air-gap, sovereignty, and auditability block.",
		category: "Datacraft Response",
		tags: ["datacraft", "security", "sovereignty", "audit"],
		content: securityContent,
		contentType: "compliance",
		topicCategory: "Security",
		sectors: ["government", "defence", "regulated finance"],
		technologies: ["encryption", "record-level authorization", "audit trails"],
		complianceFrameworks: ["STANAG 4774/4778", "PCI DSS"],
		keyTerms: ["air-gap", "record-level authorization", "classification metadata"],
	},
	{
		name: "Lindela Institutional Intelligence",
		shortcut: "/dc-lindela",
		description: "Lindela proof and capability block.",
		category: "Datacraft Response",
		tags: ["datacraft", "lindela", "intelligence", "ai"],
		content: lindelaContent,
		contentType: "past_performance",
		topicCategory: "Institutional Intelligence",
		sectors: ["regional bodies", "defence", "intelligence", "humanitarian"],
		technologies: ["OSINT", "GIS", "AI agents", "classification"],
		complianceFrameworks: ["AU CEWS", "IGAD CEWARN", "EASF E-WARN", "STANAG 4774/4778"],
		keyTerms: ["IGAD", "EASF", "nine workspaces", "AI agents"],
	},
	{
		name: "MeGuard Operations Platform",
		shortcut: "/dc-meguard",
		description: "MeGuard operational proof and field-workflow block.",
		category: "Datacraft Response",
		tags: ["datacraft", "meguard", "operations", "field"],
		content: meguardContent,
		contentType: "past_performance",
		topicCategory: "Operations",
		sectors: ["private security", "field operations", "logistics"],
		technologies: ["biometrics", "GPS", "forecasting", "mobile money"],
		complianceFrameworks: ["PSRA", "KRA eTIMS", "NSSF", "PAYE"],
		keyTerms: ["2,000 guards", "300 sites", "ARC", "M-Pesa"],
	},
	{
		name: "Wakala Regulated Payment Switching",
		shortcut: "/dc-wakala",
		description: "Wakala proof block for transaction integrity and regulated finance.",
		category: "Datacraft Response",
		tags: ["datacraft", "wakala", "payments", "fintech"],
		content: wakalaContent,
		contentType: "past_performance",
		topicCategory: "Financial Infrastructure",
		sectors: ["regulated finance", "government disbursement", "marketplaces"],
		technologies: ["ISO 8583", "ISO 20022", "SWIFT", "mobile money"],
		complianceFrameworks: ["PCI DSS", "FATF", "ISO 20022"],
		keyTerms: ["TerraSwitch", "exactly-once", "reconciliation", "settlement"],
	},
	{
		name: "Datacraft Implementation Approach",
		shortcut: "/dc-implementation",
		description: "Four-phase delivery model for Datacraft proposals.",
		category: "Datacraft Response",
		tags: ["datacraft", "implementation", "delivery"],
		content: implementationContent,
		contentType: "methodology",
		topicCategory: "Delivery",
		sectors: ["government", "enterprise"],
		technologies: ["workflow modelling", "integration", "training"],
		complianceFrameworks: [],
		keyTerms: ["mobilize", "pilot", "harden", "scale"],
	},
	{
		name: "Datacraft Past Performance",
		shortcut: "/dc-proof",
		description: "Production references and leadership proof block.",
		category: "Datacraft Response",
		tags: ["datacraft", "past-performance", "proof"],
		content: pastPerformanceContent,
		contentType: "past_performance",
		topicCategory: "Proof",
		sectors: ["government", "security", "finance"],
		technologies: ["biometrics", "intelligence", "payments"],
		complianceFrameworks: [],
		keyTerms: ["IGAD", "EASF", "TerraSwitch", "INEC", "Kenya Judiciary"],
	},
	{
		name: "Datacraft Value Proposition",
		shortcut: "/dc-value",
		description: "Value, TCO, and institutional compounding block.",
		category: "Datacraft Response",
		tags: ["datacraft", "value", "tco", "differentiators"],
		content: valueContent,
		contentType: "win_theme",
		topicCategory: "Value",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["platform foundation", "analytics", "workflow"],
		complianceFrameworks: [],
		keyTerms: ["total cost of ownership", "institutional learning", "compounding"],
	},
	{
		name: "Datacraft Compliance Alignment",
		shortcut: "/dc-compliance",
		description: "Standards and regulatory alignment response block.",
		category: "Datacraft Response",
		tags: ["datacraft", "compliance", "standards"],
		content: complianceContent,
		contentType: "compliance",
		topicCategory: "Compliance",
		sectors: ["government", "regulated finance", "defence"],
		technologies: ["workflow gates", "audit exports"],
		complianceFrameworks: ["PSRA", "KRA eTIMS", "FATF", "ISO 8583", "ISO 20022", "STANAG 4774/4778"],
		keyTerms: ["workflow gates", "evidence records", "audit exports"],
	},
	{
		name: "Datacraft Commitment Statement",
		shortcut: "/dc-close",
		description: "Closing commitment for formal proposal submissions.",
		category: "Datacraft Response",
		tags: ["datacraft", "closing", "cover-letter"],
		content: closingContent,
		contentType: "boilerplate",
		topicCategory: "Closing",
		sectors: ["government", "enterprise"],
		technologies: [],
		complianceFrameworks: [],
		keyTerms: ["commitment", "delivery workshop", "clarifications"],
	},
];

const fullInstitutionalTemplateContent = doc([
	h(1, "Proposal Response: {{opportunity_name}}"),
	p("Submitted to: {{client_name}}"),
	p("Submitted by: Datacraft Ltd"),
	p("Solicitation: {{solicitation_number}}"),
	p("Submission date: {{submission_date}}"),
	rule(),
	...executiveSummaryContent.content!,
	...companyOverviewContent.content!,
	...africanFirstContent.content!,
	...technicalApproachContent.content!,
	...securityContent.content!,
	...implementationContent.content!,
	...pastPerformanceContent.content!,
	...valueContent.content!,
	...complianceContent.content!,
	...closingContent.content!,
]);

const lindelaTemplateContent = doc([
	h(1, "Institutional Intelligence Platform Response"),
	p("Submitted to: {{client_name}}"),
	p("Opportunity: {{opportunity_name}}"),
	rule(),
	...executiveSummaryContent.content!,
	...lindelaContent.content!,
	...securityContent.content!,
	...technicalApproachContent.content!,
	...implementationContent.content!,
	...pastPerformanceContent.content!,
	...valueContent.content!,
	...closingContent.content!,
]);

const operationsTemplateContent = doc([
	h(1, "Operations, Field Workflow, and Regulated Infrastructure Response"),
	p("Submitted to: {{client_name}}"),
	p("Opportunity: {{opportunity_name}}"),
	rule(),
	...executiveSummaryContent.content!,
	...meguardContent.content!,
	...wakalaContent.content!,
	...africanFirstContent.content!,
	...technicalApproachContent.content!,
	...implementationContent.content!,
	...securityContent.content!,
	...valueContent.content!,
]);

export const DATACRAFT_RESPONSE_TEMPLATE_INPUTS: CreateTemplateInput[] = [
	{
		name: "Datacraft Sovereign Institutional Platform Response",
		description: "A comprehensive Datacraft RFP response template populated with real company, platform, proof, security, delivery, and value narrative.",
		content: fullInstitutionalTemplateContent,
		visibility: "organization",
		categoryIds: ["rfp", "exec", "tech", "mgmt", "strategy"],
		tags: ["datacraft", "rfp", "sovereign", "institutional-platform", "africa", "workflow"],
		placeholders: commonPlaceholders,
		aiInstructions: [
			{
				prompt: "Adapt Datacraft's sovereign institutional platform story to the buyer's mission, preserving production proof and audit discipline.",
				tone: "professional",
				maxLength: 8000,
			},
		],
		complianceRequirements: [
			{ id: "dc-security", framework: "Security", clause: "Record-level authorization", description: "Explain access control, audit trail, and deployment posture.", mandatory: true },
			{ id: "dc-sovereignty", framework: "Data Sovereignty", clause: "Residency and air-gap", description: "State cloud, on-premise, hybrid, and air-gap deployment support.", mandatory: true },
		],
		estimatedTime: 240,
		difficulty: "advanced",
	},
	{
		name: "Datacraft Lindela Intelligence Platform Response",
		description: "Focused response template for intelligence, early-warning, GIS, elections, defence, and regional-body opportunities.",
		content: lindelaTemplateContent,
		visibility: "organization",
		categoryIds: ["rfp", "security", "strategy", "tech"],
		tags: ["datacraft", "lindela", "intelligence", "early-warning", "gis", "defence"],
		placeholders: commonPlaceholders,
		aiInstructions: [
			{
				prompt: "Tailor Lindela's nine-workspace intelligence story to the client's doctrine, operating model, data sources, and security requirements.",
				tone: "technical",
				maxLength: 7000,
			},
		],
		estimatedTime: 210,
		difficulty: "advanced",
	},
	{
		name: "Datacraft Operations and Regulated Infrastructure Response",
		description: "Focused response template for field operations, private security, payment rails, regulated workflow, and transaction-heavy platforms.",
		content: operationsTemplateContent,
		visibility: "organization",
		categoryIds: ["rfp", "operations", "finance", "tech"],
		tags: ["datacraft", "meguard", "wakala", "operations", "payments", "field-workflow"],
		placeholders: commonPlaceholders,
		aiInstructions: [
			{
				prompt: "Adapt MeGuard and Wakala proof points to the buyer's operational, compliance, transaction, and field-workflow requirements.",
				tone: "professional",
				maxLength: 6500,
			},
		],
		estimatedTime: 180,
		difficulty: "advanced",
	},
];

export const DATACRAFT_PROPOSAL_DOCUMENT_CONTENT: Partial<Record<ProposalDocumentType, DocumentContent>> = {
	cover_letter: doc([
		h(1, "Cover Letter"),
		p("Datacraft Ltd is pleased to submit this response for {{opportunity_name}}. We understand that {{client_name}} is seeking more than a compliant technology vendor; you need a delivery partner able to translate institutional requirements into secure, auditable, workflow-backed capability."),
		p("Datacraft brings production experience across institutional intelligence, private-security operations, and regulated payment infrastructure. Our platforms run in African operational environments where sovereignty, compliance, intermittent connectivity, local payment rails, and auditability are not optional requirements."),
		...closingContent.content!,
	]),
	executive_summary: executiveSummaryContent,
	technical_approach: technicalApproachContent,
	management_plan: implementationContent,
	past_performance: pastPerformanceContent,
	cost_proposal: valueContent,
	staffing_plan: doc([
		h(1, "Staffing and Delivery Team"),
		p("Datacraft will staff {{opportunity_name}} with a senior delivery pod combining solution architecture, workflow analysis, platform engineering, integration engineering, security review, data migration, quality assurance, training, and customer success. The team will be led with direct executive oversight because institutional delivery requires fast escalation, coherent architecture, and disciplined decision-making."),
		p("The delivery model pairs Datacraft platform specialists with client subject-matter owners. This keeps configuration grounded in the buyer's operating reality and ensures institutional knowledge is transferred throughout delivery rather than deferred to a final training event."),
		bullets([
			"Executive sponsor and solution architect for governance and architectural integrity.",
			"Workflow analyst for state models, approvals, evidence gates, and operational handoff.",
			"Platform engineers for domain configuration, integrations, data migration, and dashboards.",
			"Security and QA leads for access control, audit events, regression testing, and release readiness.",
			"Training and adoption lead for administrator enablement, runbooks, and change management.",
		]),
	]),
	quality_assurance: doc([
		h(1, "Quality Assurance"),
		p("Datacraft's quality approach treats acceptance criteria as executable evidence. Each workflow-backed job will define the subject record, valid states, transitions, permissions, documents, approvals, service levels, notifications, audit events, reversals, dashboard metrics, and portal visibility. Tests will cover the success path and the operational exceptions most likely to occur in production."),
		p("Quality assurance will combine automated regression tests, integration tests, security review, data reconciliation checks, user-acceptance scenarios, and operational readiness reviews. Defects will be triaged by business impact, with release gates tied to workflow completion rather than cosmetic screen readiness."),
	]),
	risk_mitigation: doc([
		h(1, "Risk Management"),
		p("Datacraft reduces delivery risk by making assumptions explicit early. The project risk register will track data quality, integration readiness, user adoption, security approvals, hosting decisions, migration cutover, reporting obligations, and workflow exceptions."),
		p("Mitigation starts with staged delivery: model the workflows, pilot the critical path, harden integrations, then scale. This allows {{client_name}} to see working capability before full rollout while preserving the architecture needed for long-term operation."),
	]),
	appendix: complianceContent,
	other: companyOverviewContent,
};

export const DATACRAFT_PROPOSAL_SECTION_SEEDS: Partial<Record<ProposalDocumentType, DatacraftSectionSeed[]>> = {
	cover_letter: [
		{ sectionName: "Opening and Submission Reference", targetWordCount: 180 },
		{ sectionName: "Datacraft Fit", targetWordCount: 260 },
		{ sectionName: "Commitment Statement", targetWordCount: 220 },
	],
	executive_summary: [
		{ sectionName: "Mission Understanding", targetWordCount: 350 },
		{ sectionName: "Datacraft Value Proposition", targetWordCount: 450 },
		{ sectionName: "Production Proof", targetWordCount: 300 },
		{ sectionName: "Compelling Close", targetWordCount: 200 },
	],
	technical_approach: [
		{ sectionName: "Unified Data Spine", targetWordCount: 350 },
		{ sectionName: "Workflow-First Delivery", targetWordCount: 450 },
		{ sectionName: "AI With Evidence Discipline", targetWordCount: 350 },
		{ sectionName: "Integration and Deployment", targetWordCount: 350 },
	],
	management_plan: [
		{ sectionName: "Mobilize and Model", targetWordCount: 250 },
		{ sectionName: "Build and Pilot", targetWordCount: 300 },
		{ sectionName: "Harden and Integrate", targetWordCount: 300 },
		{ sectionName: "Scale and Transfer", targetWordCount: 250 },
	],
	past_performance: [
		{ sectionName: "Lindela Institutional Intelligence", targetWordCount: 350 },
		{ sectionName: "MeGuard Operations Platform", targetWordCount: 350 },
		{ sectionName: "Wakala Payment Switching", targetWordCount: 300 },
		{ sectionName: "Leadership Delivery Record", targetWordCount: 300 },
	],
	cost_proposal: [
		{ sectionName: "Total Cost of Ownership", targetWordCount: 300 },
		{ sectionName: "Avoided Cost of Misfit Software", targetWordCount: 300 },
		{ sectionName: "Institutional Compounding", targetWordCount: 260 },
	],
};

export function getDatacraftProposalDocumentContent(
	documentType: ProposalDocumentType
): DocumentContent {
	return DATACRAFT_PROPOSAL_DOCUMENT_CONTENT[documentType] ?? companyOverviewContent;
}

export function getDatacraftProposalSectionSeeds(
	documentType: ProposalDocumentType
): DatacraftSectionSeed[] {
	return DATACRAFT_PROPOSAL_SECTION_SEEDS[documentType] ?? [
		{ sectionName: "Datacraft Context", targetWordCount: 300 },
		{ sectionName: "Buyer-Specific Adaptation", targetWordCount: 300 },
		{ sectionName: "Evidence and Proof", targetWordCount: 250 },
	];
}

export function getDatacraftSnippetWordCount(snippet: DatacraftResponseSnippetInput): number {
	return words(snippet.content);
}
