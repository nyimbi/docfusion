import type { DocumentContent } from "@/lib/types/document";
import type { ProposalDocumentType } from "@/lib/types/opportunity";
import type { SnippetPlaceholder } from "@/lib/types/snippets";
import type { CreateTemplateInput } from "@/lib/types/template";

type ContentNode = NonNullable<DocumentContent["content"]>[number];

export interface DatacraftResponseSnippetInput {
	name: string;
	shortcut: string;
	description: string;
	category: string;
	tags: string[];
	content: DocumentContent;
	placeholders: SnippetPlaceholder[];
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
	{ id: "client_name", key: "client_name", name: "Client Name", variableName: "client_name", type: "text" as const, required: true },
	{ id: "opportunity_name", key: "opportunity_name", name: "Opportunity Name", variableName: "opportunity_name", type: "text" as const, required: true },
	{ id: "solicitation_number", key: "solicitation_number", name: "Solicitation Number", variableName: "solicitation_number", type: "text" as const, required: false },
	{ id: "submission_date", key: "submission_date", name: "Submission Date", variableName: "submission_date", type: "date" as const, required: false },
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

const complianceMatrixNarrativeContent = doc([
	h(1, "Compliance Traceability Approach"),
	p("Datacraft treats compliance as an operating discipline rather than a table produced at the end of proposal writing. For {{opportunity_name}}, every requirement should resolve to a clear response location, an accountable owner, an evidence source, an implementation action, and a validation method. That traceability is how evaluators gain confidence that the proposal is not only persuasive, but executable."),
	p("Our delivery approach converts solicitation language into structured requirement records. Mandatory requirements, scored criteria, submission instructions, contractual obligations, security controls, data requirements, reporting obligations, service levels, and review gates are each assigned a status and linked to response sections. This lets the proposal team see whether a requirement has been addressed, whether the answer is strong enough, whether evidence exists, and whether a reviewer has accepted the response."),
	p("The same discipline carries into implementation. Requirements do not disappear after award; they become workflow gates, test cases, training items, operational reports, audit exports, and acceptance criteria. Datacraft's advantage is that our platforms already operate with traceable evidence, immutable audit events, and workflow-backed approvals, so the compliance matrix becomes the bridge between procurement promise and operational delivery."),
]);

const evaluatorWinThemesContent = doc([
	h(1, "Evaluator Win Themes"),
	p("Datacraft's win themes are designed to help evaluators make a defensible award decision. We do not ask {{client_name}} to accept vague claims about innovation. We show why Datacraft is uniquely suited to the operating context, why the delivery risk is lower, and why the platform will continue to gain value after go-live."),
	p("The first theme is African-first institutional fit. Datacraft builds for the payment rails, regulatory obligations, language environments, field constraints, and sovereignty requirements that shape African operations. This means less adaptation risk, fewer expensive workarounds, and a platform that respects the institution's legal and operational reality from day one."),
	p("The second theme is production proof under pressure. Lindela, MeGuard, and Wakala demonstrate intelligence, field-operations, and regulated-finance workloads already running in African institutional environments. The same engineering foundation that supports source-cited intelligence artefacts, biometric field verification, and transaction-grade reconciliation will support {{opportunity_name}}."),
	p("The third theme is compounding institutional capability. Datacraft does not deliver isolated modules that age into technical debt. We deliver a shared data spine, workflow runtime, audit chain, and content foundation that become more valuable as users, data sources, approvals, documents, integrations, and lessons learned accumulate."),
]);

const solutionArchitectureNarrativeContent = doc([
	h(1, "Solution Architecture Narrative"),
	p("Datacraft's architecture for {{opportunity_name}} is intentionally conservative where institutional risk is high and ambitious where platform leverage matters. The solution is organized around a shared data spine, a domain-service layer, a workflow runtime, a secure integration boundary, and user experiences designed around the jobs users must complete rather than the departments they sit in."),
	p("The data spine holds canonical records for the subjects that matter to {{client_name}}: people, organizations, cases, assets, documents, tasks, approvals, incidents, transactions, evidence, and audit events. This avoids the common failure mode in which each module creates a slightly different version of the truth. When a user makes a decision, uploads evidence, approves a record, or dispatches a task, the platform records that event once and makes it available to the right workflow, dashboard, report, and audit trail."),
	p("The workflow layer makes operational state explicit. Every priority process has defined states, transitions, permissions, tasks, notifications, service levels, exception paths, and reversal semantics. This is what turns the platform from a database with screens into a system of institutional control. It lets managers see work moving, lets supervisors intervene before deadlines fail, and lets auditors reconstruct the path from intake to decision."),
	p("The integration layer is designed for mixed maturity environments. Where modern APIs exist, Datacraft uses them. Where legacy systems require file exchange, secure batch processing, or human validation, the platform supports that reality without pretending it is ideal. The architecture therefore gives {{client_name}} a path to production now and a path to richer automation as the surrounding ecosystem matures."),
]);

const integrationMigrationContent = doc([
	h(1, "Integration and Data Migration Approach"),
	p("Datacraft approaches integration and migration as risk-managed institutional change. The objective is not merely to move data from one location to another; it is to preserve meaning, provenance, permissions, evidence, and operational continuity while retiring the manual reconciliation burden that legacy systems create."),
	p("The first step is source-system inventory. We identify systems of record, spreadsheets, document stores, APIs, databases, file drops, email workflows, field collection tools, and reporting artefacts. Each source is classified by authority, quality, ownership, update cadence, security sensitivity, and migration priority. This prevents the common error of treating all data as equally trusted."),
	p("Migration then proceeds in controlled waves. Reference data and configuration come first, followed by active operational records, then historical data required for analytics, audit, or continuity. Every migrated dataset receives validation rules, exception reports, and business sign-off. Records that fail validation are not silently discarded; they become remediation tasks with owners and decisions."),
	p("For integrations, Datacraft prefers deterministic interfaces with observable failure handling. Each integration should define authentication, payload shape, retry behaviour, idempotency, reconciliation, error routing, and audit logging. That discipline comes from our payment-switch and intelligence-platform background, where a failed integration can mean a settlement discrepancy, a missed alert, or an audit gap."),
]);

const dataGovernanceContent = doc([
	h(1, "Data Governance and Institutional Memory"),
	p("Datacraft's data governance posture is built around a simple principle: institutional systems should preserve context, not strip it away. A record is only useful if users can understand where it came from, who changed it, what evidence supports it, what permissions govern it, and how it relates to other institutional records."),
	p("For {{client_name}}, we propose a governance model that defines data owners, stewardship responsibilities, classification labels, retention rules, quality checks, approval gates, and escalation paths. Sensitive records inherit confidentiality and releasability metadata. Derived artefacts preserve source references. Dashboards show not only outputs but also data freshness, completeness, and unresolved quality exceptions."),
	p("This matters because institutional memory is one of the main returns on a platform investment. Without governance, users recreate the same analysis, repeat the same due diligence, and argue over inconsistent reports. With governance, every workflow completion improves the next one: entities become cleaner, evidence becomes easier to reuse, exceptions become visible earlier, and leadership can trust that operational decisions are based on records with a traceable history."),
]);

const aiGovernanceContent = doc([
	h(1, "AI Governance and Human Control"),
	p("Datacraft uses AI as an accelerator for institutional work, not as a substitute for institutional judgment. In {{opportunity_name}}, AI should shorten the time required to summarize, extract, classify, draft, triage, and recommend, while preserving the human authority, evidence chain, and auditability required for decisions that matter."),
	p("Our AI governance model defines where AI may act, what sources it may use, how confidence is represented, when human review is mandatory, and how corrections are captured. AI-generated content should carry source references, provenance, confidence signals, and review status. Human overrides should not be treated as errors; they should become calibration data for future model behaviour."),
	p("Datacraft's production intelligence work has already shaped this discipline. Lindela's AI outputs are designed as source-cited, classification-aware artefacts, not ungrounded prose. That same stance applies here. The platform can use AI to draft the first version of a response, identify missing evidence, flag risk, or recommend an action, but the institution remains in control of approval, publication, and accountability."),
]);

const projectGovernanceContent = doc([
	h(1, "Project Governance"),
	p("Datacraft proposes a governance structure that keeps delivery decisions close to the people who understand the work, while giving executives clear visibility into risk, progress, and trade-offs. The programme should not be managed only through status meetings. It should be managed through evidence: accepted requirements, working workflows, resolved dependencies, tested integrations, user readiness, and measurable operational outcomes."),
	p("At the executive level, a steering forum should own scope, prioritization, strategic risks, and acceptance of major milestones. At the delivery level, a joint implementation team should own configuration, data, workflow design, integrations, test scenarios, and training. At the operational level, nominated process owners should validate whether the platform reflects the way work must actually happen inside {{client_name}}."),
	p("This structure gives the programme a practical rhythm. Decisions that affect policy, security, budget, or institutional accountability escalate quickly. Configuration and workflow questions resolve with the people closest to the work. Risks are tracked openly. Acceptance is based on demonstrated capability rather than optimism. That is the governance model most likely to produce a system users trust after go-live."),
]);

const staffingKeyPersonnelContent = doc([
	h(1, "Staffing and Key Personnel Approach"),
	p("Datacraft will staff {{opportunity_name}} with a senior, cross-functional delivery pod rather than a loose collection of disconnected specialists. The work requires solution architecture, domain analysis, workflow modelling, integration engineering, data migration, security review, quality assurance, training, and customer success to operate as one team."),
	p("The solution architect owns coherence: the data spine, domain boundaries, integration approach, workflow model, and non-functional requirements. The workflow analyst translates institutional processes into states, transitions, tasks, approvals, service levels, and exception paths. Platform engineers configure services, APIs, dashboards, and data flows. Security and QA leads validate access control, auditability, regression coverage, and release readiness. Training and adoption specialists ensure administrators and end users can operate the system without vendor dependency for routine work."),
	p("Datacraft's executive leadership remains close to institutional deployments because these programmes require fast escalation and judgement. Where requirements create delivery risk, Datacraft will identify it directly, propose options, and document the decision. That operating style is more valuable than a large staffing chart: it keeps accountability clear and protects the architecture from drifting under delivery pressure."),
]);

const trainingChangeManagementContent = doc([
	h(1, "Training, Adoption, and Change Management"),
	p("A platform succeeds when users change the way work gets done. Datacraft therefore treats training as part of delivery, not an event at the end. The training model for {{opportunity_name}} should build confidence in real workflows: intake, search, assignment, evidence capture, review, approval, reporting, exception handling, and closure."),
	p("We propose role-based enablement. Executives learn how to interpret dashboards, risk signals, and decision queues. Supervisors learn how to manage workload, service levels, escalations, and approvals. Operational users learn how to complete their daily jobs faster and with better evidence. Administrators learn configuration, user management, templates, workflow monitoring, audit export, and first-line troubleshooting."),
	p("Adoption is reinforced through champions, office hours, workflow runbooks, quick-reference guides, and post-go-live support. Datacraft also recommends measuring adoption through operational signals rather than attendance sheets: active users, completed workflows, overdue tasks, exception rates, abandoned records, search behaviour, and support requests. Those metrics reveal where the institution needs more training, clearer workflow design, or better data."),
]);

const qualityTestingContent = doc([
	h(1, "Quality Assurance and Testing"),
	p("Datacraft's quality model is designed to prove that the platform works under the conditions {{client_name}} will actually face. It is not enough for a page to render or an API to return success. The system must preserve permissions, evidence, workflow state, notifications, audit events, data integrity, and user accountability across normal operations and predictable exceptions."),
	p("Testing begins with acceptance criteria tied to jobs to be done. For each critical workflow, Datacraft defines the subject record, roles, valid transitions, required documents, approval gates, SLA timers, notification paths, reversal options, dashboard metrics, and portal visibility. Test scenarios then cover both the happy path and the operational realities: incomplete data, duplicate records, late approvals, integration timeouts, rejected evidence, permission boundaries, and reopened decisions."),
	p("Quality assurance includes automated regression tests, integration tests, migration reconciliation, security checks, performance smoke tests, user acceptance testing, and operational readiness review. Defects are prioritized by institutional impact. A cosmetic issue and a broken approval gate are not equal. The release decision should be based on whether {{client_name}} can safely run the workflow in production."),
]);

const riskManagementContent = doc([
	h(1, "Risk Management"),
	p("Datacraft manages delivery risk by making it visible early and tying mitigation to specific actions. For {{opportunity_name}}, the primary risks are likely to include data quality, integration readiness, stakeholder alignment, security approvals, migration complexity, user adoption, scope expansion, reporting expectations, and the availability of client subject-matter experts."),
	p("Each risk should have an owner, a trigger, an impact assessment, a mitigation plan, and a decision path. Data-quality risk is managed through profiling, validation rules, exception queues, and business sign-off. Integration risk is managed through interface contracts, test harnesses, retries, idempotency, and reconciliation. Adoption risk is managed through role-based training, champions, and early pilot feedback. Scope risk is managed through a controlled backlog and explicit trade-off decisions."),
	p("Datacraft's strongest mitigation is staged delivery. We do not recommend waiting until the end of implementation to discover whether the core workflow works. We model the workflow, pilot the critical path, test the integrations, prove the audit trail, and expand from a validated foundation. This reduces programme uncertainty while keeping the long-term architecture intact."),
]);

const serviceSupportContent = doc([
	h(1, "Service Management and Support"),
	p("Datacraft's support model is built for institutional continuity. After go-live, {{client_name}} should have clear channels for incident reporting, service requests, change requests, configuration support, user assistance, and escalation. Support should not depend on informal messages to individual engineers; it should be governed by severity, response targets, ownership, and documented resolution."),
	p("The service model separates incidents from improvements. Incidents restore expected service. Service requests help users complete normal administrative tasks. Change requests alter configuration, workflow, integration, reporting, or permissions and therefore require review. This distinction protects operational stability while allowing the platform to evolve with the institution."),
	p("Datacraft recommends a support cadence that includes operational health reviews, backlog review, security patch planning, usage analytics, training needs, and continuous-improvement recommendations. The goal is not only to keep the platform running. The goal is to help {{client_name}} keep increasing the institutional return from the platform over time."),
]);

const slaAvailabilityContent = doc([
	h(1, "Service Levels, Availability, and Operational Resilience"),
	p("Service levels for {{opportunity_name}} should reflect the operational importance of each workflow. Not every issue has the same impact. A general content edit, a delayed report, a failed integration, and an unavailable approval workflow require different response priorities. Datacraft will work with {{client_name}} to define severity levels, response targets, restoration targets, communication obligations, and escalation paths."),
	p("Availability is addressed through architecture and operations together. The platform supports deployment models appropriate to the institution: cloud, on-premise, hybrid, or air-gap. Backup, recovery, monitoring, logging, and release rollback should be defined before production cutover. Integration failures should degrade gracefully where possible, queue safely where necessary, and alert the right owners before business impact compounds."),
	p("Operational resilience also depends on transparent reporting. Datacraft recommends dashboards for uptime, failed jobs, queued notifications, overdue workflows, integration errors, support tickets, security events, and data-quality exceptions. These signals make service management proactive instead of reactive."),
]);

const reportingAnalyticsContent = doc([
	h(1, "Reporting and Analytics"),
	p("Datacraft designs reporting around decisions, not decorative dashboards. For {{client_name}}, reports should answer the questions leaders, supervisors, auditors, and operational users actually ask: what work is pending, what is overdue, what risk is increasing, what evidence is missing, what decisions were made, what resources are constrained, and what outcomes are improving."),
	p("The platform should provide operational dashboards for day-to-day management, executive dashboards for strategic visibility, compliance reports for audit and oversight, and analytical views for trend detection. Because the platform uses a shared data spine and workflow events, reporting can connect workload, approvals, evidence, service levels, exceptions, and outcomes without requiring manual spreadsheet reconciliation."),
	p("Datacraft's long-term objective is to help {{client_name}} build institutional intelligence from ordinary operations. Every completed workflow adds a signal. Every exception adds a lesson. Every approval, rejection, delay, and reversal can improve planning. Reporting therefore becomes more than status. It becomes the institution's memory of how work actually moves."),
]);

const pricingCommercialContent = doc([
	h(1, "Commercial and Pricing Narrative"),
	p("Datacraft's pricing philosophy is to align cost with usable institutional capability. {{client_name}} should not pay for theatrical complexity, stranded licences, or implementation effort that produces no operational value. The commercial model should distinguish between one-time delivery work, recurring platform access, support obligations, hosting posture, integrations, training, and future enhancements."),
	p("The value comparison should include total cost of ownership, not only licence price. Imported platforms often appear predictable at procurement stage but become expensive when local payment rails, regulatory reports, data residency, offline workflows, language support, and audit requirements are treated as custom extensions. Datacraft's advantage is that these requirements are part of the platform thesis, which reduces adaptation cost and long-term workaround burden."),
	p("Where the scope is broad, Datacraft recommends phased commercial milestones tied to demonstrable outcomes: validated workflow model, pilot-ready platform, integrated production release, trained administrators, accepted reports, and post-go-live stabilization. This gives {{client_name}} commercial control and gives Datacraft a clear incentive to deliver working capability rather than billable ambiguity."),
]);

const assumptionsDependenciesContent = doc([
	h(1, "Assumptions and Client Dependencies"),
	p("Datacraft will take responsibility for platform delivery, but institutional success requires several client-side dependencies to be explicit. {{client_name}} will need to nominate process owners, approve the security posture, provide timely access to source systems, validate migrated data, participate in workflow design, make policy decisions where business rules are unclear, and make users available for testing and training."),
	p("The most important assumption is decision velocity. Enterprise platforms slow down when every open question becomes a hidden dependency. Datacraft will maintain a decision log that records the issue, options, recommendation, owner, due date, and final decision. This protects schedule, reduces rework, and creates an audit trail for design choices."),
	p("A second assumption is data realism. Legacy data will contain duplicates, missing fields, inconsistent naming, stale records, and undocumented business rules. Datacraft will help profile and remediate these issues, but business owners must decide which source is authoritative and which exceptions are acceptable. Migration is therefore a joint governance exercise, not a purely technical transfer."),
]);

const transitionMobilizationContent = doc([
	h(1, "Mobilization and Transition"),
	p("Datacraft's mobilization approach is designed to reduce time to useful capability. The first weeks should establish governance, confirm scope, identify decision-makers, collect source documentation, profile data, validate the security posture, and agree the first operational workflow to pilot. Momentum matters because stakeholders believe in a platform when they see their own work represented accurately."),
	p("Transition planning covers people, process, data, technology, and support. Users need to know when the old process stops, when the new process becomes authoritative, how exceptions will be handled, where to get help, and what evidence must be captured. Administrators need runbooks, configuration guidance, user-management procedures, and escalation paths. Leaders need readiness metrics and a clear cutover decision."),
	p("Datacraft recommends a controlled transition rather than a theatrical big bang. Priority workflows should move first with close support, visible metrics, and rapid feedback. Subsequent workflows can then inherit the same patterns. This lets the institution learn safely while preserving confidence in the direction of travel."),
]);

const localCapacitySustainabilityContent = doc([
	h(1, "Local Capacity and Sustainability"),
	p("Datacraft's proposition is grounded in African institutional capacity, not dependency on distant implementation teams. For {{client_name}}, this means the platform is designed, delivered, and supported by a company whose engineering and operating assumptions are aligned with the continent's regulatory, language, infrastructure, and procurement realities."),
	p("Sustainability is built through knowledge transfer. Datacraft will train administrators, document configuration decisions, provide runbooks, explain workflow models, and expose reporting logic so the client can operate routine changes without waiting for vendor intervention. Where advanced engineering support is required, Datacraft remains accountable, but the institution should not be helpless in ordinary administration."),
	p("Local capacity also affects resilience. A partner that understands M-Pesa, MTN MoMo, PSRA, KRA eTIMS, regional government procurement, African-language monitoring, and air-gap deployment can solve problems faster because those realities are not surprises. This is a practical advantage, not a branding statement."),
]);

const partnershipTeamingContent = doc([
	h(1, "Partnership and Teaming Approach"),
	p("Where {{opportunity_name}} requires partners, Datacraft will treat teaming as an integrated delivery model rather than a logo collection. Each partner must have a defined role, accountable deliverables, information-sharing boundaries, security obligations, acceptance criteria, and escalation path. The prime responsibility remains clear: Datacraft owns the coherence of the solution and the integrity of the delivery architecture."),
	p("The best partnerships combine Datacraft's platform foundation with specialized domain knowledge, local implementation reach, hardware providers, connectivity partners, data providers, training organizations, or sector experts. The test for inclusion is whether the partner reduces delivery risk or expands client value in a way that is visible to {{client_name}}."),
	p("Datacraft will maintain a responsibility matrix that maps each workstream to accountable owners. This avoids the common procurement failure in which partners are introduced during proposal writing but operationally disconnected during delivery. A team should be evaluated by the clarity of its operating model, not the number of names on the page."),
]);

const accessibilityUxContent = doc([
	h(1, "User Experience and Accessibility"),
	p("Datacraft designs user experience around work under pressure. Institutional users do not need decorative complexity; they need clear queues, trusted records, obvious next actions, reliable search, strong defaults, and interfaces that make the correct workflow easier than the workaround. For {{client_name}}, this means the platform should reduce cognitive load while increasing control."),
	p("The UX approach starts with role clarity. Executives need concise decision views. Supervisors need workload, exception, and service-level visibility. Operational users need fast data entry, evidence capture, assignment, review, and status updates. Administrators need configuration and audit tools. External users, where portals are required, need narrow, secure visibility into the actions and records relevant to them."),
	p("Accessibility and responsiveness are part of the quality bar. Interfaces should be usable on the devices and connectivity conditions users actually have. Field workflows should degrade gracefully, support offline-first patterns where required, and avoid designs that depend on perfect bandwidth. A beautiful screen that fails in the field is not a good interface for African institutional operations."),
]);

const innovationRoadmapContent = doc([
	h(1, "Innovation and Future Roadmap"),
	p("Datacraft's roadmap for {{opportunity_name}} should be understood as controlled institutional expansion, not feature sprawl. The first responsibility is to deliver the required capability reliably. Once the foundation is stable, the platform can expand through additional workflows, richer analytics, deeper integrations, AI-assisted decision support, mobile/offline surfaces, and external portals."),
	p("The reason this expansion is feasible is the shared foundation. A new workflow can inherit identity, permissions, audit, notifications, document generation, task assignment, reporting, and portal visibility. A new data source can enrich existing entity records. A new dashboard can combine historical operational events with current workload. A new AI assistant can operate against governed data rather than disconnected files."),
	p("Datacraft will work with {{client_name}} to maintain a roadmap that distinguishes mandatory obligations, high-value enhancements, experiments, and deferred ideas. This prevents innovation from becoming unmanaged scope while preserving the platform's ability to adapt as the institution learns."),
]);

const sectorPortfolioContent = doc([
	h(1, "Broader Sector Portfolio"),
	p("Datacraft's broader product portfolio demonstrates that the company is not a single-product implementer. The same foundation supports education, healthcare, e-government, media intelligence, research intelligence, marketplaces, fintech, security operations, and institutional intelligence. This breadth matters because modern RFPs often cross boundaries: a government platform may need payments, identity, case management, reporting, field collection, analytics, and document generation in one operating model."),
	p("In education, Datacraft ships AdapiLearn and AppGen. In healthcare, HealthMonitor and Impilo address biosignal monitoring and FHIR-aligned conversational healthcare management. In e-government, Serikal, CaseMgmt, and ECP address digital government exchange, justice case management, and AI-native ERP modernization. In media and research intelligence, NewsHound, Uhondo, RFPHound, and Thuon support monitoring, extraction, research, profiling, and automated reporting. In marketplaces and fintech, Soko, Personergy, FinAdvisor, Financial_Switch, and Wakala extend the same foundation into transaction-heavy domains."),
	p("The strategic point is reuse. Capabilities proven in one sector strengthen another. Payment integrity from Wakala informs premium collection, disbursement, and escrow. Intelligence audit discipline from Lindela informs compliance and evidence workflows. Field verification from MeGuard informs offline operations and identity assurance. Datacraft's platform economics improve because the foundation compounds."),
]);

const transmittalCoverLetterContent = doc([
	h(1, "Transmittal and Cover Letter Narrative"),
	p("Datacraft is pleased to submit this response for {{opportunity_name}} and confirms that we understand the seriousness of {{client_name}}'s procurement decision. A strong proposal should not merely acknowledge the solicitation; it should establish accountability, confirm that the bidder has read the requirement as an institutional problem, and give the evaluator confidence that the response is organized for execution after award."),
	p("Our transmittal position is direct: Datacraft accepts responsibility for translating the stated requirements into a secure, auditable, workflow-backed operating capability. We bring production systems in institutional intelligence, field operations, and regulated payment infrastructure, and those systems have shaped a delivery culture that values evidence, clear ownership, sovereign deployment, and operational continuity."),
	p("The cover letter should also make the commercial relationship feel serious and accessible. Datacraft will provide named executive sponsorship, technical clarification, demonstrations, security review support, and a delivery workshop where appropriate. We want {{client_name}} to evaluate not only our written proposal, but the operating discipline behind it: how we reason about risk, how we evidence claims, and how we move from procurement promise to working capability."),
]);

const requirementsInterpretationContent = doc([
	h(1, "Requirements Interpretation"),
	p("Datacraft reads the requirements for {{opportunity_name}} as a request for institutional capability, not a request for isolated software features. The functional requirements describe what the platform must do, but the deeper requirement is that users, supervisors, administrators, external stakeholders, and auditors must be able to trust the same operating record from intake through decision, reporting, and review."),
	p("This interpretation changes the delivery approach. We do not begin by mapping every requirement to a screen. We begin by identifying the subject records, user roles, workflow states, evidence obligations, approvals, service levels, notifications, reports, integrations, and exceptions implied by the solicitation. That creates a more defensible response because it shows how Datacraft will satisfy the job behind the clause, not only the wording of the clause."),
	p("Where the solicitation leaves ambiguity, Datacraft will make that ambiguity visible through assumptions, clarification questions, and implementation options. This prevents hidden interpretation risk from becoming delivery rework. It also gives {{client_name}} a stronger basis for award because the proposal explains what will be built, how it will be validated, and what decisions must be made before production use."),
]);

const scopeDeliverablesContent = doc([
	h(1, "Scope and Deliverables"),
	p("Datacraft recommends defining scope in terms of accepted operational capability. For {{opportunity_name}}, deliverables should not be limited to software components, documents, and meetings. They should include configured workflows, validated data, tested integrations, approved reports, trained users, migrated records, audit exports, operational dashboards, support runbooks, and a clear handover package."),
	p("This distinction matters because institutional projects often fail when delivery artefacts are accepted before the organization can actually operate the platform. Datacraft will therefore tie each deliverable to a practical outcome: the user can complete the workflow, the supervisor can see exceptions, the administrator can manage access, the auditor can reconstruct decisions, and leadership can trust the dashboard."),
	p("The scope model should also distinguish base delivery from optional expansion. Core workflows, mandatory integrations, required reports, security controls, and production readiness belong in the committed baseline. Enhancements, additional portals, advanced analytics, broader mobile coverage, and future AI assistants can be sequenced after the baseline is stable. This protects schedule while preserving ambition."),
]);

const workPlanScheduleContent = doc([
	h(1, "Work Plan and Schedule"),
	p("Datacraft's work plan is designed around progressive certainty. The earliest phase resolves the questions that can most affect cost, schedule, and acceptance: governance, security posture, workflow design, data sources, integration readiness, reporting obligations, and pilot success measures. Once those decisions are visible, engineering work can proceed with less rework and clearer accountability."),
	p("The schedule should move from mobilization to workflow modelling, then to pilot configuration, integration and migration, security hardening, user acceptance, production cutover, and stabilization. Each stage should end with evidence, not ceremony. A completed phase should produce accepted workflow definitions, working software, tested interfaces, validated data, trained users, or signed readiness criteria."),
	p("Datacraft will manage the plan as a living delivery instrument. Dependencies will be tracked explicitly, decisions will be recorded, risks will have owners, and progress will be measured by working capability. This is especially important where client-side inputs affect the path: source-system access, policy decisions, user availability, data validation, and security approvals."),
]);

const acceptanceHandoverContent = doc([
	h(1, "Acceptance and Handover"),
	p("Acceptance for {{opportunity_name}} should prove that the platform is ready for institutional use, not only that individual requirements have been checked. Datacraft proposes acceptance criteria that combine functional behaviour, workflow completion, permission enforcement, audit evidence, data quality, integration reliability, reporting accuracy, user readiness, and support preparedness."),
	p("For every priority workflow, acceptance should confirm that the right users can initiate work, move it through valid states, attach or generate required evidence, trigger approvals, receive notifications, handle exceptions, and produce the expected dashboard or audit output. Failed paths matter as much as happy paths because real operations include rejected submissions, late decisions, duplicate records, unavailable systems, and reopened cases."),
	p("Handover begins before go-live. Datacraft will provide configuration documentation, administrator training, support runbooks, escalation procedures, data migration evidence, open-issue registers, release notes, and a post-go-live stabilization plan. The goal is for {{client_name}} to inherit a platform it can operate with confidence, not a codebase or vendor relationship it does not understand."),
]);

const communicationsCadenceContent = doc([
	h(1, "Communications and Reporting Cadence"),
	p("Datacraft treats programme communication as a control mechanism. The right cadence prevents surprises, accelerates decisions, and gives executives a reliable view of progress without forcing them into every implementation detail. For {{opportunity_name}}, communication should be structured around decisions, risks, dependencies, acceptance evidence, and upcoming work."),
	p("At delivery level, Datacraft recommends regular working sessions with process owners, technical counterparts, data owners, and security reviewers. These sessions resolve configuration, integration, migration, and testing questions. At steering level, concise status reporting should focus on milestones, risks, blockers, change requests, budget implications, and decisions requiring executive authority."),
	p("The communication record should be useful after the meeting ends. Datacraft will maintain decision logs, action registers, risk registers, issue trackers, and acceptance evidence. This creates an institutional memory of why choices were made and helps avoid the common failure in which project knowledge sits in scattered email threads and informal messages."),
]);

const stakeholderEngagementContent = doc([
	h(1, "Stakeholder Engagement"),
	p("Stakeholder engagement is not a soft activity on institutional technology programmes; it is how the platform learns the reality of the organization. {{client_name}}'s users will include people who initiate work, review it, approve it, audit it, supervise it, report on it, and receive outputs from it. Each group sees different risks and each group needs the platform to reduce a different burden."),
	p("Datacraft will engage stakeholders through workflow discovery, role mapping, prototype review, pilot feedback, training sessions, and operational readiness checks. The purpose is not to collect opinions indefinitely. The purpose is to identify the decisions and design details that determine adoption: which records are authoritative, which approvals are mandatory, where exceptions occur, which notifications matter, and which reports leadership trusts."),
	p("The engagement model should also protect delivery from stakeholder drift. Feedback will be triaged into required changes, usability improvements, future enhancements, and policy questions. This gives users a voice without turning implementation into uncontrolled scope expansion. It also helps leaders see where operational resistance reflects a real process issue rather than simple reluctance to change."),
]);

const deploymentHostingContent = doc([
	h(1, "Deployment and Hosting Model"),
	p("Datacraft's deployment posture is designed for sovereignty-sensitive institutions. {{client_name}} should be able to choose the hosting model that matches its legal, security, performance, and operational obligations: managed cloud, private cloud, on-premise, hybrid, or air-gap. The platform architecture supports this flexibility because data residency and customer control are core assumptions, not premium exceptions."),
	p("The deployment design will define environments, network boundaries, identity integration, secrets management, backup location, monitoring access, release promotion, rollback procedure, and operational ownership. Where the platform is hosted in Datacraft-managed infrastructure, we will define service responsibilities clearly. Where it is hosted inside client-controlled infrastructure, we will provide deployment guidance, operational runbooks, and support boundaries."),
	p("A good hosting decision should reduce institutional risk rather than follow fashion. Some workflows benefit from cloud elasticity and managed operations. Others require physical custody, disconnected operation, or strict jurisdictional control. Datacraft will help {{client_name}} select and document the model that best preserves security, continuity, cost control, and long-term maintainability."),
]);

const devsecopsReleaseContent = doc([
	h(1, "DevSecOps and Release Management"),
	p("Datacraft's release management approach is built around controlled change. For {{opportunity_name}}, new functionality, security patches, workflow changes, integrations, configuration updates, and report changes should move through a predictable path: design, review, implementation, test, approval, release, monitoring, and rollback readiness."),
	p("Security is part of that path rather than a final gate. Access control, audit logging, input validation, dependency risk, secrets handling, infrastructure configuration, and data exposure are considered during design and tested during delivery. This is especially important for institutional platforms where a small permission error can expose sensitive records or weaken auditability."),
	p("Release governance will distinguish emergency fixes from planned improvements. Emergency fixes need fast risk assessment and clear communication. Planned releases need release notes, user impact review, regression coverage, deployment timing, and post-release monitoring. Datacraft's objective is to help {{client_name}} evolve the platform without making operations feel unstable."),
]);

const privacyDataProtectionContent = doc([
	h(1, "Privacy and Data Protection"),
	p("Datacraft designs privacy controls around purpose, access, minimization, provenance, retention, and accountability. {{opportunity_name}} may involve personal data, sensitive institutional records, operational evidence, payment information, or classified material. The platform must therefore make it clear why data is collected, who can view it, how it is used, how long it is retained, and what audit trail protects it."),
	p("The implementation should define lawful basis or institutional authority, data categories, user roles, consent or notice requirements where applicable, retention periods, export controls, deletion or archival procedures, and breach escalation paths. Permissions should be record-aware rather than only module-aware because sensitive data often sits beside ordinary operational data inside the same workflow."),
	p("Datacraft's privacy approach is pragmatic: protect people and institutions without making the platform unusable. Good controls should reduce unnecessary exposure, prevent casual over-sharing, preserve audit evidence, and support legitimate work. That balance is especially important where field operations, external portals, mobile devices, and AI-assisted drafting may all interact with the same source records."),
]);

const businessContinuityContent = doc([
	h(1, "Business Continuity and Disaster Recovery"),
	p("Business continuity for {{opportunity_name}} should be defined around the institution's most important workflows. The question is not only whether servers can be restored. The question is which operations must continue during disruption, what data loss is acceptable, which users need emergency access, which integrations can queue safely, and how leadership will know that service has recovered."),
	p("Datacraft will work with {{client_name}} to define recovery objectives, backup cadence, restoration tests, failover options, operational workarounds, communication paths, and post-incident review. The design should cover infrastructure failure, network disruption, integration outage, human error, security incident, and data-quality failure. Each scenario has different controls and different evidence requirements."),
	p("Continuity also includes offline and degraded-mode thinking. In African operating environments, connectivity cannot be assumed everywhere and all the time. Where workflows require field participation, Datacraft will design for safe queuing, synchronization, conflict handling, and clear user feedback so that operational records remain trustworthy when conditions are imperfect."),
]);

const performanceScalabilityContent = doc([
	h(1, "Performance and Scalability"),
	p("Datacraft evaluates performance by the experience of the user and the reliability of the institution. {{client_name}} needs pages, searches, reports, imports, approvals, notifications, AI-assisted tasks, and integrations to remain responsive as records, users, documents, and workflow events grow. Scalability is therefore both a technical requirement and an adoption requirement."),
	p("The platform should be designed around predictable growth: more users, more external data, more documents, more dashboards, more automated jobs, and more historical audit records. Datacraft will identify the expected workload profile, high-traffic workflows, peak submission periods, large data operations, and reporting bottlenecks. Those findings drive indexing, caching, queue design, pagination, background jobs, and infrastructure sizing."),
	p("Performance testing should include realistic scenarios rather than only synthetic success paths. Large imports, complex searches, concurrent approvals, dashboard refreshes, AI generation, and integration retries should be tested with representative data. This gives {{client_name}} confidence that the platform can grow without forcing a redesign after adoption begins."),
]);

const observabilityMonitoringContent = doc([
	h(1, "Observability and Operational Monitoring"),
	p("Datacraft treats observability as an operational obligation. Once {{opportunity_name}} is live, {{client_name}} and Datacraft must be able to see whether workflows are moving, integrations are healthy, notifications are dispatching, background jobs are completing, errors are rising, queues are backing up, and users are experiencing delays."),
	p("Monitoring should connect technical signals to institutional impact. A failed background job matters because it may delay an acknowledgement letter, an SLA escalation, a payment reconciliation, a report refresh, or an evidence sync. Datacraft will therefore design dashboards and alerts around the business meaning of failure, not only CPU, memory, and uptime."),
	p("The observability model should also support improvement. Logs, metrics, traces, audit events, support tickets, workflow durations, data-quality exceptions, and usage analytics reveal where the platform needs tuning or where the operating process itself needs attention. This turns production monitoring into a source of institutional learning."),
]);

const interoperabilityStandardsContent = doc([
	h(1, "Interoperability and Open Standards"),
	p("Datacraft's interoperability approach is based on durable institutional value. {{client_name}} should not be trapped in a platform that cannot exchange data, publish records, consume partner feeds, or support future systems. Interfaces should therefore be documented, versioned, secure, and designed around the meaning of the data rather than ad hoc file movement."),
	p("Where relevant, Datacraft will align with open or sector-recognized standards such as ISO 8583, ISO 20022, FHIR, OGC geospatial standards, STANAG handling patterns, ICAO border-data formats, and modern API conventions. Where no mature standard fits the local domain, we will document the exchange contract, ownership, validation rules, error handling, and change process."),
	p("Interoperability is also a governance issue. Every interface should have an owner, authentication model, data classification, retry policy, reconciliation approach, and audit trail. That discipline prevents integrations from becoming hidden dependencies that only work when the original implementation team remembers how they were built."),
]);

const knowledgeManagementContent = doc([
	h(1, "Knowledge Management and Documentation"),
	p("Datacraft's knowledge management approach is designed to leave {{client_name}} stronger after implementation. A platform of institutional importance should not depend on tribal knowledge held by a few vendor engineers or internal champions. Its design decisions, configurations, workflow rules, integration contracts, reports, permissions, and support procedures should be documented in a way administrators can use."),
	p("Documentation should be layered. Executives need decision and governance records. Administrators need configuration, user-management, and audit-export guidance. Technical teams need integration contracts, deployment notes, monitoring guidance, backup procedures, and release records. Operational users need practical runbooks that explain how to complete their work and what to do when exceptions occur."),
	p("The same principle applies to proposal content. Datacraft builds reusable templates and snippets because every bid, implementation, and lesson should improve the next one. Over time, {{client_name}} can use the platform not only to run operations, but to preserve institutional memory about how decisions, evidence, documents, and policies have evolved."),
]);

const legalCommercialContent = doc([
	h(1, "Legal, Commercial, and Contractual Position"),
	p("Datacraft's commercial position is to make responsibilities clear enough that delivery can proceed without avoidable contract ambiguity. For {{opportunity_name}}, the agreement should define scope, deliverables, acceptance, payment milestones, service levels, data ownership, confidentiality, intellectual property, security obligations, support responsibilities, change control, warranty boundaries, and termination or transition assistance."),
	p("Datacraft recognizes that institutional buyers need control over their data and continuity of service. Client data should remain the client's asset. Datacraft's platform intellectual property remains Datacraft's asset unless the contract expressly says otherwise. Configurations, templates, workflow definitions, reports, and implementation artefacts should be governed in a way that gives {{client_name}} practical operational control while preserving the reusable product foundation that makes Datacraft economically efficient."),
	p("The legal narrative should reduce procurement anxiety. Datacraft is prepared to work through reasonable security, privacy, audit, support, and transition terms. We will flag exceptions clearly rather than burying them. That transparency protects both parties and helps the contract reflect the same operating discipline as the solution."),
]);

const ethicsConflictContent = doc([
	h(1, "Ethics, Independence, and Conflict Management"),
	p("Datacraft understands that institutional technology procurements require trust in both the solution and the supplier. For {{opportunity_name}}, ethics and conflict management should be handled openly: no undisclosed conflicts, no improper use of confidential information, no misrepresentation of capability, and no shortcuts that compromise the integrity of the procurement or the resulting system."),
	p("The same standard applies inside the platform. Audit trails, approval records, role separation, evidence capture, and transparent reporting help institutions reduce opportunities for arbitrary decisions or hidden manipulation. Technology cannot replace institutional ethics, but it can make accountability easier and improper behaviour harder to hide."),
	p("Where Datacraft works with partners, subcontractors, or data providers, we will define responsibilities and information boundaries. The objective is to protect {{client_name}} from reputational and operational risk while preserving the collaborative delivery model needed for complex institutional programmes."),
]);

const environmentalSocialImpactContent = doc([
	h(1, "Environmental and Social Impact"),
	p("Datacraft's environmental and social value proposition begins with local institutional capacity. A platform built and supported from Africa reduces dependency on distant implementation models, strengthens local engineering capability, and keeps more of the economic value of digital transformation within the region. For {{client_name}}, that translates into faster contextual problem solving and a more sustainable support model."),
	p("Digital workflows can also reduce operational waste. Replacing paper-heavy approvals, repeated field trips, manual reconciliations, duplicated records, and fragmented reporting reduces time, transport, printing, and administrative burden. More importantly, it helps public and regulated institutions make better decisions with the resources they already have."),
	p("Social impact should be measured honestly. Datacraft will not claim that software alone transforms institutions. The value comes when the platform improves access, transparency, responsiveness, compliance, and service reliability. Where {{opportunity_name}} touches citizens, beneficiaries, clients, guards, patients, students, or external partners, those outcomes should be represented in the reporting model."),
]);

const demoOralPresentationContent = doc([
	h(1, "Demonstration and Oral Presentation Narrative"),
	p("Datacraft's demonstration approach is to show the evaluator's operating reality, not a generic product tour. For {{opportunity_name}}, the strongest demonstration should follow a credible end-to-end scenario: intake, classification, assignment, evidence capture, review, approval, notification, reporting, exception handling, and audit reconstruction."),
	p("The presentation should connect each screen and action to a procurement concern. When showing workflow state, explain operational control. When showing source-linked AI output, explain evidence discipline. When showing dashboards, explain decision usefulness. When showing permissions, explain privacy and sovereignty. When showing integration status, explain continuity and reconciliation."),
	p("Datacraft will prepare demonstrations around the client's language, data categories, and success measures where procurement rules allow. The goal is for evaluators to leave the session with a concrete sense that the platform can support their users on the first day of operation and then expand as the institution matures."),
]);

const clarificationResponseContent = doc([
	h(1, "Clarification and Addendum Response"),
	p("Datacraft treats clarifications as an opportunity to improve precision rather than as a defensive exercise. When {{client_name}} issues questions, addenda, or revised requirements, the proposal team should update the response, compliance matrix, assumptions, pricing, delivery schedule, and risk register so that the final submission reflects the current procurement record."),
	p("A strong clarification response explains the impact of the change. Some addenda simply correct wording. Others change scope, introduce new security obligations, alter submission instructions, affect integration effort, or shift acceptance criteria. Datacraft will classify those impacts and make corresponding updates visible rather than relying on hidden interpretation."),
	p("This discipline continues after award. Questions that arise during delivery become decisions, risks, change requests, or implementation notes. In both procurement and implementation, the objective is the same: keep the record coherent so that everyone can see what was asked, what was answered, what changed, and how the platform response adapted."),
]);

const consultingDiscoveryContent = doc([
	h(1, "Consulting Discovery and Diagnostic Approach"),
	p("Datacraft begins consulting-led engagements with disciplined discovery because the first risk in institutional technology is usually misunderstanding the work. For {{opportunity_name}}, discovery should identify the mandate, operating context, users, pain points, decision flows, data sources, controls, service obligations, reporting expectations, and constraints that shape delivery."),
	p("The discovery process combines document review, stakeholder interviews, workflow walkthroughs, data-source inspection, system demonstrations, field observation where appropriate, and executive alignment. The goal is not to produce a large report that sits apart from implementation. The goal is to convert institutional knowledge into a delivery-ready operating model that engineers, administrators, and users can validate."),
	p("Datacraft's diagnostic output is practical: findings, opportunities, risks, assumptions, dependencies, priority workflows, candidate quick wins, architecture implications, and decisions required. That output gives {{client_name}} a clearer path from current pain to future capability and gives the delivery team a grounded basis for configuration, migration, integration, and change management."),
]);

const pmoMobilizationContent = doc([
	h(1, "PMO Mobilization"),
	p("A strong project management office is not administrative overhead; it is the control system that keeps institutional delivery coherent. Datacraft will mobilize a lean PMO for {{opportunity_name}} that manages scope, schedule, RAID items, decisions, change control, reporting, meeting cadence, acceptance evidence, and stakeholder follow-through."),
	p("The PMO will establish the project charter, governance calendar, workstream plan, communication channels, document repository, issue register, risk register, action log, dependency tracker, decision log, and reporting pack. These instruments are useful only if they influence behaviour, so Datacraft keeps them concise, current, and tied to real delivery decisions."),
	p("The PMO also protects executive attention. Leaders should see the risks and decisions that require authority, not every operational detail. Delivery teams should have the structure to resolve normal blockers quickly. This balance keeps momentum without hiding the information needed for responsible oversight."),
]);

const raciDecisionRightsContent = doc([
	h(1, "RACI and Decision Rights"),
	p("Datacraft recommends defining decision rights early because ambiguity over ownership is one of the fastest ways to slow a technology programme. For {{opportunity_name}}, each workstream should identify who is responsible, accountable, consulted, and informed for scope, security, data, workflow design, integrations, reports, training, acceptance, and change requests."),
	p("A good RACI is not a bureaucratic table; it is a way to make escalation predictable. Process owners should decide workflow rules. Security owners should decide access posture. Data owners should validate migration quality. Executives should decide trade-offs that affect policy, budget, or institutional risk. Datacraft should own the coherence of the technical solution and the delivery of agreed outputs."),
	p("Decision rights should be paired with a decision log. When options arise, Datacraft will document the question, recommendation, alternatives, impact, owner, due date, and final decision. This prevents unresolved choices from becoming hidden schedule risk and gives auditors or future administrators a record of why the platform works the way it does."),
]);

const raidManagementContent = doc([
	h(1, "RAID Management"),
	p("Datacraft uses RAID management to keep risk, assumptions, issues, and dependencies visible throughout delivery. In {{opportunity_name}}, the RAID register should not be a passive document updated before governance meetings. It should be a working instrument that shapes priorities, escalations, and mitigation actions."),
	p("Risks describe uncertain future events that could affect outcomes. Assumptions record beliefs that need validation. Issues capture problems already affecting delivery. Dependencies identify inputs, decisions, access, people, or external systems required for progress. Treating these categories separately improves management discipline because each requires a different response."),
	p("Datacraft will maintain RAID items with owners, dates, severity, impact, mitigation, status, and escalation paths. The value is transparency: {{client_name}} can see where delivery is strong, where decisions are needed, where third parties are blocking progress, and where contingency plans should be activated before schedule or quality are compromised."),
]);

const changeControlContent = doc([
	h(1, "Change Control"),
	p("Change control should protect value rather than freeze learning. Institutional projects evolve because users clarify needs, data realities emerge, regulations shift, integrations reveal constraints, and leadership priorities change. Datacraft's approach is to make those changes explicit, evaluate their impact, and decide them through the right governance channel."),
	p("Every change request should describe the requested change, reason, affected requirements, workflow impact, data impact, security impact, schedule impact, cost impact, alternatives, recommendation, and approval route. This prevents small informal changes from accumulating into hidden scope expansion and prevents legitimate improvements from being dismissed because the process is unclear."),
	p("Datacraft will distinguish mandatory changes, value-enhancing changes, deferred enhancements, and rejected requests. The result is a controlled backlog that preserves delivery momentum while allowing {{client_name}} to adapt the platform intelligently as implementation produces new information."),
]);

const issueActionDependencyContent = doc([
	h(1, "Issue, Action, and Dependency Management"),
	p("Datacraft manages delivery through visible commitments. For {{opportunity_name}}, issues, actions, and dependencies should be captured in a way that tells the team what needs to happen, who owns it, when it is due, what decision is required, and what delivery outcome is affected if it slips."),
	p("Issues require diagnosis and resolution. Actions require completion. Dependencies require coordination with people or systems outside the immediate workstream. Conflating these categories makes governance noisy and weakens accountability. Datacraft separates them so each item receives the right follow-up and escalation path."),
	p("This management discipline is especially important where client-side inputs determine speed: access to source systems, security approvals, business rules, data validation, user availability, procurement decisions, and third-party coordination. The platform can move quickly only when the surrounding commitments are managed with equal clarity."),
]);

const currentStateAssessmentContent = doc([
	h(1, "Current-State Assessment"),
	p("Datacraft's current-state assessment documents how work happens today, not only how policies say it should happen. For {{opportunity_name}}, the assessment should examine processes, systems, records, spreadsheets, reports, approvals, communications, controls, pain points, informal workarounds, data-quality issues, and user behaviours."),
	p("This is consulting work with direct implementation value. Current-state findings reveal where workflow digitization will reduce friction, where policy decisions are needed, where migration will be difficult, where integrations are essential, and where training must address habits rather than features. They also reveal which existing practices are worth preserving because they reflect legitimate institutional knowledge."),
	p("The output should be a clear baseline: process maps, system inventory, data-source inventory, control gaps, duplication points, manual reconciliation points, reporting weaknesses, and priority improvement opportunities. Datacraft uses that baseline to make the future-state design credible rather than aspirational."),
]);

const futureStateBlueprintContent = doc([
	h(1, "Future-State Blueprint"),
	p("The future-state blueprint translates {{client_name}}'s objectives into an operating model that can actually be implemented. It describes how users will work, how records will move, which decisions will be automated or human-reviewed, what evidence will be required, what dashboards will show, and how controls will operate after go-live."),
	p("Datacraft builds the blueprint across several dimensions: processes, roles, data, workflows, integrations, controls, reports, user experience, support model, and governance. This prevents the common failure in which a future-state process looks elegant on paper but ignores data ownership, permission boundaries, technical constraints, or user capacity."),
	p("The blueprint becomes the bridge between consulting and delivery. It should produce workflow definitions, configuration requirements, migration priorities, integration specifications, reporting needs, training implications, and acceptance criteria. In Datacraft's view, a blueprint is only valuable if it can be executed."),
]);

const gapAnalysisRoadmapContent = doc([
	h(1, "Gap Analysis and Roadmap"),
	p("Datacraft's gap analysis compares the current state, solicitation requirements, target operating model, and platform capability to identify what must change. For {{opportunity_name}}, the analysis should distinguish process gaps, data gaps, integration gaps, policy gaps, security gaps, reporting gaps, skills gaps, and technology gaps."),
	p("Each gap should be evaluated by operational impact, regulatory exposure, delivery effort, dependency, and urgency. This avoids treating every gap as equal. Some gaps block go-live. Some create adoption risk. Some affect compliance. Others are useful future enhancements but do not belong in the first release."),
	p("The roadmap sequences work into practical horizons: mobilize, stabilize, pilot, scale, optimize, and innovate. Datacraft's recommendation is to deliver the smallest credible operating capability first, then expand from a foundation that has already proven workflow, data, security, reporting, and user adoption patterns."),
]);

const maturityAssessmentContent = doc([
	h(1, "Maturity Assessment"),
	p("Datacraft uses maturity assessment to help {{client_name}} understand not only what technology is missing, but how ready the institution is to operate it. Maturity should be evaluated across governance, process discipline, data quality, integration readiness, security controls, reporting culture, user capability, support model, and continuous improvement."),
	p("The maturity model is diagnostic, not judgmental. Low maturity in a domain is useful information because it tells the team where to simplify, phase, train, document, or add controls. High maturity tells the team where automation and analytics can move faster. The point is to match the implementation plan to institutional readiness."),
	p("Datacraft will use maturity findings to shape delivery sequencing. An institution with strong process ownership can adopt richer workflow configuration quickly. An institution with fragmented data may need early profiling and stewardship. An institution with limited administrator capacity may need more runbooks and hypercare. The assessment therefore reduces risk by aligning ambition with readiness."),
]);

const businessProcessReengineeringContent = doc([
	h(1, "Business Process Reengineering"),
	p("Datacraft approaches process reengineering with respect for institutional reality. The objective is not to digitize broken processes exactly as they are, nor to impose a theoretical process that users cannot operate. The objective is to remove unnecessary friction while preserving the controls, evidence, and decision rights that make the process legitimate."),
	p("For {{opportunity_name}}, reengineering should examine handoffs, duplicate entry, approval loops, paper dependencies, spreadsheet reconciliations, unclear ownership, unnecessary waiting, and missing feedback. Each proposed change should be tested against governance, compliance, user burden, data quality, and auditability."),
	p("The best process improvements usually come from making state explicit: what is pending, who owns it, what evidence is missing, what decision is next, what deadline applies, and what exception path exists. Datacraft's workflow foundation turns that reengineered process into operational software rather than leaving it as a consulting diagram."),
]);

const workshopFacilitationContent = doc([
	h(1, "Workshop Facilitation"),
	p("Datacraft uses workshops to make decisions, not to consume calendars. For {{opportunity_name}}, workshops should have a clear purpose: workflow discovery, requirements validation, data mapping, security review, reporting design, acceptance planning, training design, or cutover readiness."),
	p("Each workshop should begin with prepared materials and end with documented outputs. Participants should know what decision or validation is expected. Datacraft will facilitate with structured agendas, process maps, scenario walkthroughs, prototypes, decision prompts, and action tracking. This keeps stakeholder engagement productive and respectful of senior time."),
	p("Good facilitation also surfaces disagreement early. When users, supervisors, compliance teams, and technical owners see a process differently, the workshop is the right place to resolve or escalate the difference. Capturing those differences before configuration prevents rework and gives the final system stronger institutional legitimacy."),
]);

const requirementsElicitationContent = doc([
	h(1, "Requirements Elicitation and Validation"),
	p("Datacraft treats requirements elicitation as a translation exercise between policy, operations, technology, and procurement. For {{opportunity_name}}, the stated RFP requirements are the starting point, but complete delivery requirements also come from users, source systems, reports, controls, exceptions, external stakeholders, and audit obligations."),
	p("Elicited requirements should be written in a form that can be built and tested. A good requirement identifies the actor, trigger, desired outcome, data involved, permission boundary, evidence requirement, exception path, and acceptance test. This makes validation easier and reduces the risk that vague language becomes disputed scope later."),
	p("Datacraft will validate requirements through walkthroughs, prototypes, data samples, integration checks, and acceptance scenarios. The result is a requirements baseline that is strong enough for engineering, governance, and user acceptance, while remaining traceable to the procurement commitments made in the proposal."),
]);

const solutionOptionsTradeoffContent = doc([
	h(1, "Options Analysis and Trade-Off Advisory"),
	p("Complex institutional projects involve choices that cannot be answered by preference alone. Datacraft will support {{client_name}} with structured options analysis when decisions affect architecture, deployment, integration, workflow design, data migration, licensing, support model, or delivery sequencing."),
	p("Each option should be evaluated against value, risk, cost, schedule, security, user impact, maintainability, reversibility, and alignment with long-term operating goals. Datacraft will make recommendations, but the important consulting value is to expose the trade-off clearly enough that decision-makers understand what they are accepting and what they are rejecting."),
	p("This approach is especially useful when there is pressure to move fast. Speed is valuable, but speed without explicit trade-offs creates hidden debt. Datacraft's role is to help {{client_name}} choose the route that delivers useful capability early without compromising the foundation needed for scale, governance, and trust."),
]);

const benefitsRealizationContent = doc([
	h(1, "Benefits Realization"),
	p("Datacraft recommends defining benefits before implementation begins because a platform should be judged by institutional outcomes, not only by delivered features. For {{opportunity_name}}, benefits may include shorter cycle times, fewer overdue tasks, better data quality, stronger auditability, lower reconciliation effort, improved compliance visibility, faster reporting, and more reliable external communication."),
	p("Each benefit should have an owner, baseline, target, measurement method, data source, and realization timeframe. Some benefits appear during pilot, such as faster intake or clearer work queues. Others emerge after adoption, such as better trend analysis, fewer repeat errors, or stronger executive decision-making."),
	p("Benefits realization also requires honest governance. If a benefit depends on client-side behaviour, such as retiring spreadsheets or enforcing workflow use, that dependency should be visible. Datacraft can provide the platform and adoption support, but institutional leaders must reinforce the operating changes that allow the benefits to materialize."),
]);

const kpiMeasurementContent = doc([
	h(1, "KPI and Performance Measurement Framework"),
	p("Datacraft designs KPI frameworks around decisions. Metrics should tell {{client_name}} whether work is moving, whether users are adopting the platform, whether controls are working, whether service levels are being met, and whether the institution is improving. A KPI that does not prompt action is decorative."),
	p("The measurement framework should include operational KPIs, adoption KPIs, quality KPIs, compliance KPIs, service KPIs, and outcome KPIs. Examples include cycle time, backlog, overdue tasks, first-pass approval rate, evidence completeness, data-quality exceptions, report production time, integration failures, active users, portal submissions, and support response time."),
	p("Because Datacraft platforms record workflow events, approvals, evidence, and audit actions, many KPIs can be generated from operational data rather than manually assembled. This improves trust in the numbers and reduces the reporting burden that often undermines continuous improvement."),
]);

const vendorThirdPartyManagementContent = doc([
	h(1, "Vendor and Third-Party Management"),
	p("Many institutional programmes depend on more than one supplier. Datacraft will help manage third-party coordination for {{opportunity_name}} where source systems, hosting providers, data providers, hardware vendors, payment partners, identity providers, or implementation subcontractors affect delivery."),
	p("Third-party management should define responsibilities, interfaces, timelines, access requirements, security obligations, test scenarios, support contacts, escalation paths, and acceptance dependencies. Without that structure, integration and migration risk can hide behind informal coordination until late in delivery."),
	p("Datacraft's role is to preserve solution coherence. Even where another party owns a component or source system, the platform must still handle authentication, data quality, error routing, audit logging, reconciliation, and user impact. We will make cross-vendor dependencies visible so {{client_name}} can govern the whole delivery ecosystem."),
]);

const procurementSupportContent = doc([
	h(1, "Procurement and Evaluation Support"),
	p("Datacraft can support procurement teams with structured response materials, clarification tracking, compliance matrices, evaluation-ready demonstrations, pricing narratives, assumptions registers, and evidence packs. This matters because procurement success depends on clarity, traceability, and defensibility, not only persuasive writing."),
	p("For {{opportunity_name}}, proposal support should make it easy for evaluators to find the answer to every requirement and understand why the response is credible. Datacraft's content library, template system, and RFP parsing workflow support that discipline by linking requirements, response sections, snippets, evidence, and review status."),
	p("This consulting capability also benefits post-award delivery. The same compliance matrix that helped win the procurement can become the implementation traceability matrix. The same assumptions register can become a delivery risk register. The same evidence pack can become acceptance support. Procurement work should become operational memory, not discarded proposal labour."),
]);

const dataMigrationGovernanceContent = doc([
	h(1, "Data Migration Governance"),
	p("Data migration is one of the highest-risk workstreams in institutional transformation because it touches business meaning, system history, user trust, and audit continuity. Datacraft will govern migration for {{opportunity_name}} through source inventory, data profiling, mapping, cleansing rules, validation, exception management, sign-off, and post-migration reconciliation."),
	p("Migration governance starts by identifying authoritative sources and deciding how to handle duplicates, missing values, stale records, conflicting identifiers, document attachments, historical status, permissions, and retention obligations. These are business decisions as much as technical tasks. Datacraft will make them visible and assign ownership."),
	p("The migration plan should use controlled waves with evidence at each stage. Sample migration proves mapping. Pilot migration proves workflow usability. Production migration proves completeness and reconciliation. Exception reports show what could not be migrated automatically and what decision is needed. This protects {{client_name}} from silent data loss and preserves confidence in the new platform."),
]);

const readinessAssessmentContent = doc([
	h(1, "Operational Readiness Assessment"),
	p("Before go-live, {{client_name}} should know whether the organization is ready to operate the platform. Datacraft's readiness assessment covers product readiness, data readiness, integration readiness, security readiness, support readiness, user readiness, reporting readiness, and governance readiness."),
	p("The assessment should ask practical questions. Are critical defects resolved or accepted? Are users trained? Are administrators prepared? Are migrated records validated? Are integrations monitored? Are support channels active? Are dashboards trusted? Are fallback procedures documented? Are executive sponsors ready to enforce the new operating process?"),
	p("Datacraft will use readiness findings to recommend go, no-go, or conditional go-live decisions. A conditional decision may be reasonable if risks are understood and mitigated. What should be avoided is a ceremonial launch where unresolved issues become operational emergencies because no one made the readiness evidence explicit."),
]);

const cutoverCommandCenterContent = doc([
	h(1, "Cutover and Command Center"),
	p("Datacraft treats cutover as a managed operational event. For {{opportunity_name}}, the cutover plan should identify timing, freeze windows, final data migration, user access, communications, validation checks, rollback criteria, support coverage, escalation contacts, and executive decision points."),
	p("During cutover, a command center gives the programme a single view of status. Workstreams report on data load, integrations, authentication, workflow checks, dashboards, notifications, user access, support tickets, and open defects. Decisions are recorded in real time so the team can distinguish normal launch friction from issues that require escalation."),
	p("A strong cutover does not end when the system opens. The first hours and days are when user confidence is formed. Datacraft will maintain close support, rapid triage, usage monitoring, and executive updates so {{client_name}} can stabilize the new operating model without losing momentum."),
]);

const hypercareStabilizationContent = doc([
	h(1, "Hypercare and Stabilization"),
	p("Hypercare is the period where the platform moves from implementation project to trusted operation. Datacraft will support {{client_name}} through intensified monitoring, user assistance, defect triage, workflow tuning, data-quality review, dashboard validation, support handover, and adoption measurement."),
	p("The hypercare model should separate urgent production issues from improvement requests. Urgent issues restore service or correct material workflow problems. Improvement requests become backlog items with prioritization. This protects the stabilization period from becoming uncontrolled redesign while still capturing valuable user feedback."),
	p("At the end of hypercare, Datacraft recommends a stabilization review that examines incidents, support tickets, adoption metrics, workflow cycle times, unresolved risks, user feedback, and recommended enhancements. The output should be a transition to steady-state support and a practical roadmap for the next improvement horizon."),
]);

const lessonsLearnedContent = doc([
	h(1, "Lessons Learned and Continuous Improvement"),
	p("Datacraft treats lessons learned as an operating asset, not a closing ritual. For {{opportunity_name}}, lessons should be captured during delivery, not only after completion, so the team can adjust while there is still time to improve outcomes."),
	p("Useful lessons connect observation to action. If users struggle with a workflow, the lesson may require training, UX improvement, policy clarification, or report redesign. If an integration repeatedly fails, the lesson may require better monitoring, retry logic, vendor escalation, or reconciliation controls. If decisions stall, the lesson may require clearer governance."),
	p("The final lessons-learned output should inform the support model, roadmap, reusable templates, future procurement responses, and institutional operating procedures. This is how Datacraft's platform approach compounds: every implementation should improve both the client institution and Datacraft's reusable delivery playbook."),
]);

const executiveAdvisoryContent = doc([
	h(1, "Executive Advisory"),
	p("Datacraft's executive advisory role is to help senior leaders make informed trade-offs about technology, risk, operating model, and institutional value. For {{opportunity_name}}, executive decisions may involve scope, deployment posture, data governance, change enforcement, phased rollout, budget allocation, and long-term platform ownership."),
	p("The advisory approach is evidence-led. Datacraft will translate technical and operational findings into decision briefs that explain the choice, implications, risks, recommendation, and consequences of delay. This allows leaders to act without being drawn into unnecessary implementation detail."),
	p("Executive advisory is especially important when the platform changes how work is governed. Leaders must reinforce that the new workflow is authoritative, that data quality matters, that approvals belong in the system, and that exceptions should be visible. Without executive sponsorship, even excellent software can become another optional tool."),
]);

const programmeAssuranceContent = doc([
	h(1, "Programme Assurance"),
	p("Datacraft's programme assurance approach provides an independent-quality lens inside delivery. For {{opportunity_name}}, assurance should evaluate whether the programme is still aligned to objectives, whether risks are understood, whether scope remains controlled, whether quality evidence is sufficient, and whether go-live readiness is real."),
	p("Assurance reviews should examine requirements traceability, delivery progress, architecture integrity, security posture, test coverage, data migration evidence, stakeholder readiness, support model, and unresolved decisions. The goal is not to create fear or bureaucracy. The goal is to catch weak signals before they become expensive failures."),
	p("Datacraft will use assurance findings to recommend corrective action. Sometimes that means escalating a blocker, narrowing scope, increasing training, strengthening test evidence, or deferring a risky enhancement. The assurance function protects {{client_name}} by keeping optimism connected to evidence."),
]);

const agileHybridDeliveryContent = doc([
	h(1, "Agile-Hybrid Delivery Method"),
	p("Datacraft uses an agile-hybrid delivery model because institutional technology requires both adaptability and control. Pure waterfall can hide working-software risk until late. Uncontrolled agile can weaken governance, documentation, and acceptance. The right model for {{opportunity_name}} is iterative delivery inside clear stage gates."),
	p("Discovery, architecture, security posture, data migration, and acceptance criteria need enough upfront structure to guide delivery. Configuration, workflow refinement, dashboards, user experience, and training materials benefit from iterative cycles with stakeholder feedback. Datacraft will organize work into sprints or delivery increments while preserving formal approval points for scope, security, go-live, and acceptance."),
	p("This approach gives {{client_name}} early visibility into working capability without sacrificing the documentation, traceability, and audit evidence required for institutional accountability. It is pragmatic delivery: learn fast where learning is useful, govern tightly where risk is high."),
]);

const resourceCapacityPlanningContent = doc([
	h(1, "Resource and Capacity Planning"),
	p("Datacraft will plan resources around the work that actually drives delivery: workflow design, integration, data migration, configuration, testing, training, stakeholder engagement, support setup, and governance. For {{opportunity_name}}, resource planning must include both Datacraft capacity and client-side availability."),
	p("Client resource constraints are often more important than vendor staffing charts. Process owners must attend workshops, data owners must validate records, security teams must review controls, users must participate in testing, and executives must make decisions. Datacraft will make those required commitments visible early so the schedule reflects real capacity."),
	p("The capacity plan should be reviewed throughout delivery. If a workstream is blocked because key people are unavailable, the mitigation may be resequencing, narrower pilot scope, additional support, or executive escalation. Capacity planning keeps the programme honest about what can be achieved by when."),
]);

const riskAdjustedRoadmapContent = doc([
	h(1, "Risk-Adjusted Roadmap"),
	p("Datacraft recommends a risk-adjusted roadmap for {{opportunity_name}} because the best sequence is not always the most exciting sequence. Early work should retire the risks that could invalidate later effort: security posture, source-system access, data quality, critical workflow design, integration feasibility, and acceptance criteria."),
	p("Once foundational risks are reduced, the roadmap can expand into broader workflow coverage, advanced analytics, external portals, mobile/offline functions, AI assistants, and deeper automation. This sequence protects {{client_name}} from investing heavily in enhancements before the operating foundation is proven."),
	p("The roadmap should remain dynamic but governed. Datacraft will review delivery evidence, user adoption, risk movement, dependency status, and emerging priorities to recommend adjustments. The result is a roadmap that supports ambition without pretending that every capability carries the same urgency or implementation risk."),
]);

const decisionBriefingContent = doc([
	h(1, "Decision Briefing and Executive Papers"),
	p("Datacraft will prepare decision briefs when {{client_name}} needs to choose between meaningful alternatives. A good decision brief should define the question, context, options, analysis, recommendation, risks, financial or schedule impact, and consequences of no decision."),
	p("Decision briefs are useful for deployment model, integration scope, data migration cutover, workflow policy, role permissions, reporting definitions, change requests, and roadmap prioritization. They keep governance focused on choices that require authority rather than discussions that can be resolved at delivery level."),
	p("This consulting discipline protects institutional memory. Months later, administrators and auditors can understand why a design choice was made, what alternatives were considered, and who approved the direction. That matters in public, regulated, and mission-critical environments where decisions must remain defensible."),
]);

const operatingModelContent = doc([
	h(1, "Target Operating Model"),
	p("Datacraft defines the target operating model as the practical description of how {{client_name}} will run the capability after go-live. It covers roles, processes, data ownership, governance forums, support responsibilities, service levels, reporting cadence, continuous improvement, and the relationship between internal teams and Datacraft."),
	p("The target operating model prevents the platform from becoming an isolated technical asset. It answers operational questions: who owns workflow configuration, who approves user access, who monitors dashboards, who manages exceptions, who validates reports, who handles support, who approves changes, and how lessons from operations become improvements."),
	p("For Datacraft, the target operating model is as important as the software because institutional value depends on repeated use. When the operating model is clear, users know where work belongs, administrators know how to govern it, leaders know how to measure it, and the platform can mature without constant reinvention."),
]);

function dcSnippet(
	input: Omit<DatacraftResponseSnippetInput, "category" | "tags" | "placeholders"> & {
		tags: string[];
		placeholders?: SnippetPlaceholder[];
	}
): DatacraftResponseSnippetInput {
	return {
		...input,
		category: "Datacraft Response",
		tags: ["datacraft", ...input.tags.filter((tag) => tag !== "datacraft")],
		placeholders: input.placeholders ?? commonPlaceholders,
	};
}

const DATACRAFT_RESPONSE_SNIPPET_DEFINITIONS: Array<
	Omit<DatacraftResponseSnippetInput, "placeholders"> & { placeholders?: SnippetPlaceholder[] }
> = [
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
	{
		name: "Datacraft Compliance Traceability",
		shortcut: "/dc-traceability",
		description: "Narrative for compliance matrices, requirement ownership, and implementation traceability.",
		category: "Datacraft Response",
		tags: ["datacraft", "compliance", "traceability", "requirements"],
		content: complianceMatrixNarrativeContent,
		contentType: "compliance",
		topicCategory: "Compliance",
		sectors: ["government", "regulated finance", "enterprise"],
		technologies: ["requirements management", "workflow gates", "audit"],
		complianceFrameworks: ["ICD 206", "FATF", "STANAG 4774/4778"],
		keyTerms: ["compliance matrix", "traceability", "evidence", "acceptance criteria"],
	},
	{
		name: "Datacraft Evaluator Win Themes",
		shortcut: "/dc-win-themes",
		description: "Evaluator-focused win theme narrative for strategic positioning.",
		category: "Datacraft Response",
		tags: ["datacraft", "win-themes", "strategy", "evaluators"],
		content: evaluatorWinThemesContent,
		contentType: "win_theme",
		topicCategory: "Strategy",
		sectors: ["government", "regional bodies", "enterprise"],
		technologies: ["platform foundation", "workflow", "AI"],
		complianceFrameworks: [],
		keyTerms: ["African-first", "production proof", "compounding capability"],
	},
	{
		name: "Datacraft Solution Architecture",
		shortcut: "/dc-architecture",
		description: "Comprehensive solution architecture narrative for technical volumes.",
		category: "Datacraft Response",
		tags: ["datacraft", "architecture", "technical-approach"],
		content: solutionArchitectureNarrativeContent,
		contentType: "solution",
		topicCategory: "Architecture",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["data spine", "workflow runtime", "integration", "domain services"],
		complianceFrameworks: [],
		keyTerms: ["canonical records", "workflow layer", "integration layer"],
	},
	{
		name: "Datacraft Integration and Migration",
		shortcut: "/dc-integration-migration",
		description: "Integration and migration response for legacy, API, and data-quality environments.",
		category: "Datacraft Response",
		tags: ["datacraft", "integration", "migration", "data-quality"],
		content: integrationMigrationContent,
		contentType: "methodology",
		topicCategory: "Integration",
		sectors: ["government", "enterprise", "financial services"],
		technologies: ["APIs", "batch imports", "idempotency", "reconciliation"],
		complianceFrameworks: [],
		keyTerms: ["source-system inventory", "migration waves", "validation"],
	},
	{
		name: "Datacraft Data Governance",
		shortcut: "/dc-data-governance",
		description: "Data governance, quality, provenance, and institutional memory narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "data-governance", "quality", "provenance"],
		content: dataGovernanceContent,
		contentType: "compliance",
		topicCategory: "Data Governance",
		sectors: ["government", "regional bodies", "regulated finance"],
		technologies: ["data quality", "classification", "audit"],
		complianceFrameworks: ["STANAG 4774/4778", "ICD 206"],
		keyTerms: ["provenance", "stewardship", "retention", "institutional memory"],
	},
	{
		name: "Datacraft AI Governance",
		shortcut: "/dc-ai-governance",
		description: "Human-controlled AI governance block for RFPs with AI requirements.",
		category: "Datacraft Response",
		tags: ["datacraft", "ai", "governance", "human-review"],
		content: aiGovernanceContent,
		contentType: "compliance",
		topicCategory: "AI Governance",
		sectors: ["government", "intelligence", "enterprise"],
		technologies: ["AI agents", "source citation", "confidence scoring", "human review"],
		complianceFrameworks: ["ICD 203", "ICD 206"],
		keyTerms: ["human control", "confidence", "source references", "override"],
	},
	{
		name: "Datacraft Project Governance",
		shortcut: "/dc-project-governance",
		description: "Governance model for steering committees, delivery teams, and process owners.",
		category: "Datacraft Response",
		tags: ["datacraft", "governance", "delivery", "programme"],
		content: projectGovernanceContent,
		contentType: "methodology",
		topicCategory: "Governance",
		sectors: ["government", "enterprise"],
		technologies: ["delivery governance", "workflow acceptance"],
		complianceFrameworks: [],
		keyTerms: ["steering forum", "decision log", "process owners"],
	},
	{
		name: "Datacraft Staffing and Key Personnel",
		shortcut: "/dc-staffing",
		description: "Narrative staffing model for delivery teams and key personnel sections.",
		category: "Datacraft Response",
		tags: ["datacraft", "staffing", "key-personnel", "delivery-team"],
		content: staffingKeyPersonnelContent,
		contentType: "staffing",
		topicCategory: "Staffing",
		sectors: ["government", "enterprise"],
		technologies: ["solution architecture", "workflow analysis", "QA"],
		complianceFrameworks: [],
		keyTerms: ["delivery pod", "solution architect", "workflow analyst"],
	},
	{
		name: "Datacraft Training and Adoption",
		shortcut: "/dc-training",
		description: "Role-based training, adoption, and change management response block.",
		category: "Datacraft Response",
		tags: ["datacraft", "training", "adoption", "change-management"],
		content: trainingChangeManagementContent,
		contentType: "methodology",
		topicCategory: "Adoption",
		sectors: ["government", "enterprise", "field operations"],
		technologies: ["runbooks", "admin training", "usage analytics"],
		complianceFrameworks: [],
		keyTerms: ["role-based enablement", "champions", "adoption metrics"],
	},
	{
		name: "Datacraft Quality Assurance and Testing",
		shortcut: "/dc-qa-testing",
		description: "Quality assurance and testing narrative tied to workflow acceptance.",
		category: "Datacraft Response",
		tags: ["datacraft", "quality", "testing", "acceptance"],
		content: qualityTestingContent,
		contentType: "methodology",
		topicCategory: "Quality",
		sectors: ["government", "enterprise"],
		technologies: ["regression testing", "integration testing", "UAT"],
		complianceFrameworks: [],
		keyTerms: ["acceptance criteria", "happy path", "exceptions", "release readiness"],
	},
	{
		name: "Datacraft Risk Management",
		shortcut: "/dc-risk",
		description: "Delivery risk management narrative for management volumes.",
		category: "Datacraft Response",
		tags: ["datacraft", "risk", "mitigation", "delivery"],
		content: riskManagementContent,
		contentType: "methodology",
		topicCategory: "Risk",
		sectors: ["government", "enterprise"],
		technologies: ["risk register", "integration testing", "migration"],
		complianceFrameworks: [],
		keyTerms: ["risk owner", "mitigation", "staged delivery"],
	},
	{
		name: "Datacraft Service Management",
		shortcut: "/dc-service-management",
		description: "Post-go-live support and service management narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "support", "service-management", "operations"],
		content: serviceSupportContent,
		contentType: "operations",
		topicCategory: "Support",
		sectors: ["government", "enterprise"],
		technologies: ["service desk", "change requests", "health reviews"],
		complianceFrameworks: [],
		keyTerms: ["incidents", "service requests", "continuous improvement"],
	},
	{
		name: "Datacraft SLA and Resilience",
		shortcut: "/dc-sla",
		description: "Service levels, availability, resilience, backup, and operational monitoring block.",
		category: "Datacraft Response",
		tags: ["datacraft", "sla", "availability", "resilience"],
		content: slaAvailabilityContent,
		contentType: "operations",
		topicCategory: "Service Levels",
		sectors: ["government", "regulated finance", "enterprise"],
		technologies: ["monitoring", "backup", "rollback", "integration alerts"],
		complianceFrameworks: [],
		keyTerms: ["severity", "response targets", "availability", "resilience"],
	},
	{
		name: "Datacraft Reporting and Analytics",
		shortcut: "/dc-reporting",
		description: "Decision-focused reporting and analytics narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "reporting", "analytics", "dashboards"],
		content: reportingAnalyticsContent,
		contentType: "solution",
		topicCategory: "Reporting",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["dashboards", "analytics", "workflow events"],
		complianceFrameworks: [],
		keyTerms: ["decision dashboards", "audit reports", "institutional intelligence"],
	},
	{
		name: "Datacraft Commercial and Pricing Narrative",
		shortcut: "/dc-pricing",
		description: "Commercial model and TCO narrative for pricing volumes.",
		category: "Datacraft Response",
		tags: ["datacraft", "pricing", "commercial", "tco"],
		content: pricingCommercialContent,
		contentType: "pricing",
		topicCategory: "Commercial",
		sectors: ["government", "enterprise"],
		technologies: ["platform licensing", "implementation milestones"],
		complianceFrameworks: [],
		keyTerms: ["total cost of ownership", "milestones", "licence", "support"],
	},
	{
		name: "Datacraft Assumptions and Dependencies",
		shortcut: "/dc-assumptions",
		description: "Client dependencies, decision velocity, and data realism narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "assumptions", "dependencies", "delivery"],
		content: assumptionsDependenciesContent,
		contentType: "methodology",
		topicCategory: "Assumptions",
		sectors: ["government", "enterprise"],
		technologies: ["decision log", "data profiling", "migration"],
		complianceFrameworks: [],
		keyTerms: ["client dependencies", "decision log", "data realism"],
	},
	{
		name: "Datacraft Mobilization and Transition",
		shortcut: "/dc-transition",
		description: "Mobilization, cutover, and transition narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "transition", "mobilization", "cutover"],
		content: transitionMobilizationContent,
		contentType: "methodology",
		topicCategory: "Transition",
		sectors: ["government", "enterprise"],
		technologies: ["cutover", "runbooks", "workflow rollout"],
		complianceFrameworks: [],
		keyTerms: ["mobilization", "controlled transition", "readiness"],
	},
	{
		name: "Datacraft Local Capacity and Sustainability",
		shortcut: "/dc-local-capacity",
		description: "Local capacity, sustainability, knowledge transfer, and African operating fluency block.",
		category: "Datacraft Response",
		tags: ["datacraft", "local-capacity", "sustainability", "knowledge-transfer"],
		content: localCapacitySustainabilityContent,
		contentType: "impact",
		topicCategory: "Sustainability",
		sectors: ["government", "regional bodies", "enterprise"],
		technologies: ["knowledge transfer", "runbooks", "administrator enablement"],
		complianceFrameworks: [],
		keyTerms: ["local capacity", "knowledge transfer", "African institutional capacity"],
	},
	{
		name: "Datacraft Partnership and Teaming",
		shortcut: "/dc-teaming",
		description: "Prime contractor, partner accountability, and teaming narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "teaming", "partners", "prime"],
		content: partnershipTeamingContent,
		contentType: "management",
		topicCategory: "Partnerships",
		sectors: ["government", "enterprise"],
		technologies: ["responsibility matrix", "delivery governance"],
		complianceFrameworks: [],
		keyTerms: ["prime responsibility", "responsibility matrix", "partner roles"],
	},
	{
		name: "Datacraft UX and Accessibility",
		shortcut: "/dc-ux",
		description: "User experience, accessibility, responsive, and offline usability narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "ux", "accessibility", "offline"],
		content: accessibilityUxContent,
		contentType: "solution",
		topicCategory: "User Experience",
		sectors: ["government", "field operations", "enterprise"],
		technologies: ["offline-first", "responsive UI", "portals"],
		complianceFrameworks: [],
		keyTerms: ["role clarity", "field workflows", "accessibility"],
	},
	{
		name: "Datacraft Innovation Roadmap",
		shortcut: "/dc-roadmap",
		description: "Roadmap and future expansion narrative for long-term platform evolution.",
		category: "Datacraft Response",
		tags: ["datacraft", "roadmap", "innovation", "future"],
		content: innovationRoadmapContent,
		contentType: "strategy",
		topicCategory: "Roadmap",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["AI assistants", "workflow expansion", "portals", "analytics"],
		complianceFrameworks: [],
		keyTerms: ["roadmap", "controlled expansion", "future workflows"],
	},
	{
		name: "Datacraft Sector Portfolio",
		shortcut: "/dc-portfolio",
		description: "Broader Datacraft product portfolio and cross-sector reuse narrative.",
		category: "Datacraft Response",
		tags: ["datacraft", "portfolio", "products", "cross-sector"],
		content: sectorPortfolioContent,
		contentType: "capability",
		topicCategory: "Portfolio",
		sectors: ["education", "healthcare", "government", "media", "fintech", "marketplaces"],
		technologies: ["FHIR", "X-Road", "RFP extraction", "payment switch", "research intelligence"],
		complianceFrameworks: ["FHIR", "ISO 8583", "ISO 20022"],
		keyTerms: ["AdapiLearn", "Impilo", "Serikal", "RFPHound", "Thuon"],
	},
	dcSnippet({
		name: "Datacraft Transmittal and Cover Letter",
		shortcut: "/dc-cover-letter",
		description: "Formal cover letter and transmittal narrative with executive accountability.",
		tags: ["cover-letter", "transmittal", "executive"],
		content: transmittalCoverLetterContent,
		contentType: "boilerplate",
		topicCategory: "Transmittal",
		sectors: ["government", "enterprise"],
		technologies: ["proposal automation"],
		complianceFrameworks: [],
		keyTerms: ["cover letter", "executive sponsorship", "delivery workshop"],
	}),
	dcSnippet({
		name: "Datacraft Requirements Interpretation",
		shortcut: "/dc-requirements-interpretation",
		description: "Narrative for interpreting solicitation requirements as operational jobs.",
		tags: ["requirements", "interpretation", "rfp"],
		content: requirementsInterpretationContent,
		contentType: "methodology",
		topicCategory: "Requirements",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["requirements analysis", "workflow modelling"],
		complianceFrameworks: [],
		keyTerms: ["subject records", "workflow states", "clarification questions"],
	}),
	dcSnippet({
		name: "Datacraft Scope and Deliverables",
		shortcut: "/dc-scope-deliverables",
		description: "Scope and deliverables narrative tied to accepted operational capability.",
		tags: ["scope", "deliverables", "acceptance"],
		content: scopeDeliverablesContent,
		contentType: "management",
		topicCategory: "Scope",
		sectors: ["government", "enterprise"],
		technologies: ["workflow configuration", "dashboards", "audit exports"],
		complianceFrameworks: [],
		keyTerms: ["deliverables", "baseline", "optional expansion"],
	}),
	dcSnippet({
		name: "Datacraft Work Plan and Schedule",
		shortcut: "/dc-workplan",
		description: "Work plan and schedule narrative for implementation volumes.",
		tags: ["work-plan", "schedule", "implementation"],
		content: workPlanScheduleContent,
		contentType: "management",
		topicCategory: "Schedule",
		sectors: ["government", "enterprise"],
		technologies: ["project planning", "delivery increments"],
		complianceFrameworks: [],
		keyTerms: ["progressive certainty", "milestones", "dependencies"],
	}),
	dcSnippet({
		name: "Datacraft Acceptance and Handover",
		shortcut: "/dc-acceptance-handover",
		description: "Acceptance, readiness, and handover narrative for production transition.",
		tags: ["acceptance", "handover", "readiness"],
		content: acceptanceHandoverContent,
		contentType: "management",
		topicCategory: "Acceptance",
		sectors: ["government", "enterprise"],
		technologies: ["acceptance testing", "runbooks", "audit exports"],
		complianceFrameworks: [],
		keyTerms: ["handover", "go-live", "support runbooks"],
	}),
	dcSnippet({
		name: "Datacraft Communications Cadence",
		shortcut: "/dc-communications",
		description: "Programme communication cadence and governance reporting narrative.",
		tags: ["communications", "governance", "reporting"],
		content: communicationsCadenceContent,
		contentType: "management",
		topicCategory: "Communications",
		sectors: ["government", "enterprise"],
		technologies: ["decision logs", "risk registers"],
		complianceFrameworks: [],
		keyTerms: ["communication cadence", "status reporting", "action registers"],
	}),
	dcSnippet({
		name: "Datacraft Stakeholder Engagement",
		shortcut: "/dc-stakeholders",
		description: "Stakeholder engagement and feedback governance narrative.",
		tags: ["stakeholders", "engagement", "change-management"],
		content: stakeholderEngagementContent,
		contentType: "consulting",
		topicCategory: "Stakeholders",
		sectors: ["government", "enterprise", "field operations"],
		technologies: ["prototype review", "pilot feedback"],
		complianceFrameworks: [],
		keyTerms: ["stakeholder engagement", "workflow discovery", "scope triage"],
	}),
	dcSnippet({
		name: "Datacraft Deployment and Hosting",
		shortcut: "/dc-deployment-hosting",
		description: "Cloud, on-premise, hybrid, and air-gap deployment narrative.",
		tags: ["deployment", "hosting", "sovereignty"],
		content: deploymentHostingContent,
		contentType: "technical",
		topicCategory: "Deployment",
		sectors: ["government", "defence", "regulated finance"],
		technologies: ["cloud", "on-premise", "hybrid", "air-gap"],
		complianceFrameworks: ["Data Sovereignty"],
		keyTerms: ["hosting model", "data residency", "rollback"],
	}),
	dcSnippet({
		name: "Datacraft DevSecOps and Release Management",
		shortcut: "/dc-devsecops",
		description: "Controlled release management, security review, and rollback narrative.",
		tags: ["devsecops", "release-management", "security"],
		content: devsecopsReleaseContent,
		contentType: "technical",
		topicCategory: "Release Management",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["CI/CD", "rollback", "security review"],
		complianceFrameworks: [],
		keyTerms: ["controlled change", "release notes", "post-release monitoring"],
	}),
	dcSnippet({
		name: "Datacraft Privacy and Data Protection",
		shortcut: "/dc-privacy",
		description: "Privacy, retention, minimization, and record-aware access narrative.",
		tags: ["privacy", "data-protection", "retention"],
		content: privacyDataProtectionContent,
		contentType: "compliance",
		topicCategory: "Privacy",
		sectors: ["government", "healthcare", "regulated finance", "enterprise"],
		technologies: ["record-level authorization", "audit", "retention"],
		complianceFrameworks: ["Data Protection"],
		keyTerms: ["purpose limitation", "retention", "breach escalation"],
	}),
	dcSnippet({
		name: "Datacraft Business Continuity and Disaster Recovery",
		shortcut: "/dc-bcdr",
		description: "Business continuity, disaster recovery, and degraded-mode operations narrative.",
		tags: ["bcdr", "continuity", "resilience"],
		content: businessContinuityContent,
		contentType: "operations",
		topicCategory: "Business Continuity",
		sectors: ["government", "regulated finance", "field operations"],
		technologies: ["backup", "restore", "offline sync"],
		complianceFrameworks: [],
		keyTerms: ["recovery objectives", "failover", "degraded mode"],
	}),
	dcSnippet({
		name: "Datacraft Performance and Scalability",
		shortcut: "/dc-performance",
		description: "Performance, scalability, workload, and capacity narrative.",
		tags: ["performance", "scalability", "capacity"],
		content: performanceScalabilityContent,
		contentType: "technical",
		topicCategory: "Performance",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["queues", "caching", "indexing", "background jobs"],
		complianceFrameworks: [],
		keyTerms: ["workload profile", "large imports", "concurrent approvals"],
	}),
	dcSnippet({
		name: "Datacraft Observability and Monitoring",
		shortcut: "/dc-observability",
		description: "Observability, monitoring, alerting, and production learning narrative.",
		tags: ["observability", "monitoring", "alerts"],
		content: observabilityMonitoringContent,
		contentType: "operations",
		topicCategory: "Observability",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["logs", "metrics", "traces", "alerts"],
		complianceFrameworks: [],
		keyTerms: ["workflow monitoring", "queues", "production monitoring"],
	}),
	dcSnippet({
		name: "Datacraft Interoperability and Standards",
		shortcut: "/dc-interoperability",
		description: "Open standards, integration contracts, and interoperability narrative.",
		tags: ["interoperability", "standards", "apis"],
		content: interoperabilityStandardsContent,
		contentType: "technical",
		topicCategory: "Interoperability",
		sectors: ["government", "healthcare", "regulated finance", "security"],
		technologies: ["APIs", "FHIR", "OGC", "ISO 20022"],
		complianceFrameworks: ["FHIR", "OGC", "ISO 8583", "ISO 20022", "STANAG 4774/4778"],
		keyTerms: ["open standards", "versioned APIs", "exchange contract"],
	}),
	dcSnippet({
		name: "Datacraft Knowledge Management",
		shortcut: "/dc-knowledge-management",
		description: "Documentation, institutional memory, and knowledge-transfer narrative.",
		tags: ["knowledge-management", "documentation", "handover"],
		content: knowledgeManagementContent,
		contentType: "consulting",
		topicCategory: "Knowledge Management",
		sectors: ["government", "enterprise"],
		technologies: ["runbooks", "templates", "content library"],
		complianceFrameworks: [],
		keyTerms: ["documentation", "institutional memory", "administrator guidance"],
	}),
	dcSnippet({
		name: "Datacraft Legal and Commercial Position",
		shortcut: "/dc-legal-commercial",
		description: "Legal, commercial, contractual, IP, and data ownership narrative.",
		tags: ["legal", "commercial", "contract"],
		content: legalCommercialContent,
		contentType: "commercial",
		topicCategory: "Legal",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["contract management"],
		complianceFrameworks: [],
		keyTerms: ["data ownership", "intellectual property", "transition assistance"],
	}),
	dcSnippet({
		name: "Datacraft Ethics and Conflict Management",
		shortcut: "/dc-ethics",
		description: "Ethics, independence, conflict management, and procurement integrity narrative.",
		tags: ["ethics", "conflict-management", "integrity"],
		content: ethicsConflictContent,
		contentType: "compliance",
		topicCategory: "Ethics",
		sectors: ["government", "regulated finance", "enterprise"],
		technologies: ["audit trails", "role separation"],
		complianceFrameworks: ["Procurement Integrity"],
		keyTerms: ["conflict management", "independence", "accountability"],
	}),
	dcSnippet({
		name: "Datacraft Environmental and Social Impact",
		shortcut: "/dc-esg-impact",
		description: "Environmental, social impact, local capacity, and digital efficiency narrative.",
		tags: ["esg", "impact", "sustainability"],
		content: environmentalSocialImpactContent,
		contentType: "impact",
		topicCategory: "ESG",
		sectors: ["government", "regional bodies", "enterprise"],
		technologies: ["digital workflows", "analytics"],
		complianceFrameworks: [],
		keyTerms: ["local engineering", "digital workflows", "social impact"],
	}),
	dcSnippet({
		name: "Datacraft Demo and Oral Presentation",
		shortcut: "/dc-demo-oral",
		description: "Demonstration and oral presentation narrative for evaluator sessions.",
		tags: ["demo", "oral-presentation", "evaluation"],
		content: demoOralPresentationContent,
		contentType: "sales",
		topicCategory: "Demonstration",
		sectors: ["government", "enterprise"],
		technologies: ["workflow demo", "dashboards", "AI"],
		complianceFrameworks: [],
		keyTerms: ["demonstration", "oral presentation", "end-to-end scenario"],
	}),
	dcSnippet({
		name: "Datacraft Clarification and Addendum Response",
		shortcut: "/dc-clarifications",
		description: "Clarification, addendum, and response update narrative.",
		tags: ["clarifications", "addenda", "proposal-management"],
		content: clarificationResponseContent,
		contentType: "proposal_management",
		topicCategory: "Clarifications",
		sectors: ["government", "enterprise"],
		technologies: ["compliance matrix", "proposal workflow"],
		complianceFrameworks: [],
		keyTerms: ["addenda", "clarification response", "assumptions register"],
	}),
	dcSnippet({
		name: "Datacraft Consulting Discovery",
		shortcut: "/dc-consulting-discovery",
		description: "Discovery and diagnostic consulting narrative for early engagement phases.",
		tags: ["consulting", "discovery", "diagnostic"],
		content: consultingDiscoveryContent,
		contentType: "consulting",
		topicCategory: "Discovery",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["workflow walkthroughs", "system inventory"],
		complianceFrameworks: [],
		keyTerms: ["discovery", "diagnostic", "operating model"],
	}),
	dcSnippet({
		name: "Datacraft PMO Mobilization",
		shortcut: "/dc-pmo",
		description: "PMO setup, governance instruments, and project-control narrative.",
		tags: ["pmo", "project-management", "governance"],
		content: pmoMobilizationContent,
		contentType: "project_management",
		topicCategory: "PMO",
		sectors: ["government", "enterprise"],
		technologies: ["project controls", "reporting pack"],
		complianceFrameworks: [],
		keyTerms: ["PMO", "project charter", "governance calendar"],
	}),
	dcSnippet({
		name: "Datacraft RACI and Decision Rights",
		shortcut: "/dc-raci",
		description: "RACI, decision rights, and governance accountability narrative.",
		tags: ["raci", "decision-rights", "governance"],
		content: raciDecisionRightsContent,
		contentType: "project_management",
		topicCategory: "Decision Rights",
		sectors: ["government", "enterprise"],
		technologies: ["decision log", "role matrix"],
		complianceFrameworks: [],
		keyTerms: ["RACI", "accountable", "decision log"],
	}),
	dcSnippet({
		name: "Datacraft RAID Management",
		shortcut: "/dc-raid",
		description: "Risk, assumptions, issues, and dependencies management narrative.",
		tags: ["raid", "risk", "dependencies"],
		content: raidManagementContent,
		contentType: "project_management",
		topicCategory: "RAID",
		sectors: ["government", "enterprise"],
		technologies: ["risk register", "dependency tracker"],
		complianceFrameworks: [],
		keyTerms: ["RAID", "assumptions", "issues", "dependencies"],
	}),
	dcSnippet({
		name: "Datacraft Change Control",
		shortcut: "/dc-change-control",
		description: "Change request, scope governance, and impact analysis narrative.",
		tags: ["change-control", "scope", "governance"],
		content: changeControlContent,
		contentType: "project_management",
		topicCategory: "Change Control",
		sectors: ["government", "enterprise"],
		technologies: ["backlog", "impact analysis"],
		complianceFrameworks: [],
		keyTerms: ["change request", "scope expansion", "impact"],
	}),
	dcSnippet({
		name: "Datacraft Issues, Actions, and Dependencies",
		shortcut: "/dc-actions-dependencies",
		description: "Issue, action, and dependency tracking narrative for delivery governance.",
		tags: ["actions", "issues", "dependencies"],
		content: issueActionDependencyContent,
		contentType: "project_management",
		topicCategory: "Delivery Controls",
		sectors: ["government", "enterprise"],
		technologies: ["action log", "dependency tracker"],
		complianceFrameworks: [],
		keyTerms: ["issues", "actions", "dependencies", "escalation"],
	}),
	dcSnippet({
		name: "Datacraft Current-State Assessment",
		shortcut: "/dc-current-state",
		description: "Current-state assessment narrative for consulting and transformation proposals.",
		tags: ["current-state", "assessment", "consulting"],
		content: currentStateAssessmentContent,
		contentType: "consulting",
		topicCategory: "Current State",
		sectors: ["government", "enterprise", "field operations"],
		technologies: ["process maps", "system inventory"],
		complianceFrameworks: [],
		keyTerms: ["current state", "baseline", "workarounds"],
	}),
	dcSnippet({
		name: "Datacraft Future-State Blueprint",
		shortcut: "/dc-future-state",
		description: "Future-state operating blueprint narrative.",
		tags: ["future-state", "blueprint", "operating-model"],
		content: futureStateBlueprintContent,
		contentType: "consulting",
		topicCategory: "Future State",
		sectors: ["government", "enterprise"],
		technologies: ["workflow definitions", "configuration requirements"],
		complianceFrameworks: [],
		keyTerms: ["future state", "blueprint", "target operating model"],
	}),
	dcSnippet({
		name: "Datacraft Gap Analysis and Roadmap",
		shortcut: "/dc-gap-roadmap",
		description: "Gap analysis and phased roadmap consulting narrative.",
		tags: ["gap-analysis", "roadmap", "consulting"],
		content: gapAnalysisRoadmapContent,
		contentType: "consulting",
		topicCategory: "Gap Analysis",
		sectors: ["government", "enterprise"],
		technologies: ["roadmap", "maturity"],
		complianceFrameworks: [],
		keyTerms: ["gap analysis", "pilot", "scale", "optimize"],
	}),
	dcSnippet({
		name: "Datacraft Maturity Assessment",
		shortcut: "/dc-maturity",
		description: "Maturity assessment narrative across governance, data, security, and support.",
		tags: ["maturity-assessment", "readiness", "consulting"],
		content: maturityAssessmentContent,
		contentType: "consulting",
		topicCategory: "Maturity",
		sectors: ["government", "enterprise"],
		technologies: ["maturity model", "readiness"],
		complianceFrameworks: [],
		keyTerms: ["maturity", "institutional readiness", "governance"],
	}),
	dcSnippet({
		name: "Datacraft Business Process Reengineering",
		shortcut: "/dc-bpr",
		description: "Business process reengineering narrative for workflow transformation.",
		tags: ["bpr", "process-reengineering", "workflow"],
		content: businessProcessReengineeringContent,
		contentType: "consulting",
		topicCategory: "Process Reengineering",
		sectors: ["government", "enterprise", "field operations"],
		technologies: ["workflow runtime", "process maps"],
		complianceFrameworks: [],
		keyTerms: ["process reengineering", "handoffs", "state"],
	}),
	dcSnippet({
		name: "Datacraft Workshop Facilitation",
		shortcut: "/dc-workshops",
		description: "Workshop facilitation narrative for discovery, design, and readiness sessions.",
		tags: ["workshops", "facilitation", "stakeholders"],
		content: workshopFacilitationContent,
		contentType: "consulting",
		topicCategory: "Facilitation",
		sectors: ["government", "enterprise"],
		technologies: ["prototypes", "process maps"],
		complianceFrameworks: [],
		keyTerms: ["workshops", "facilitation", "decision prompts"],
	}),
	dcSnippet({
		name: "Datacraft Requirements Elicitation",
		shortcut: "/dc-requirements-elicitation",
		description: "Requirements elicitation, validation, and acceptance-scenario narrative.",
		tags: ["requirements", "elicitation", "validation"],
		content: requirementsElicitationContent,
		contentType: "consulting",
		topicCategory: "Requirements Elicitation",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["requirements baseline", "acceptance tests"],
		complianceFrameworks: [],
		keyTerms: ["actor", "trigger", "acceptance test"],
	}),
	dcSnippet({
		name: "Datacraft Options and Trade-Off Advisory",
		shortcut: "/dc-options-tradeoffs",
		description: "Options analysis and trade-off advisory narrative for executive decisions.",
		tags: ["options-analysis", "tradeoffs", "advisory"],
		content: solutionOptionsTradeoffContent,
		contentType: "consulting",
		topicCategory: "Options Analysis",
		sectors: ["government", "enterprise"],
		technologies: ["decision brief", "architecture options"],
		complianceFrameworks: [],
		keyTerms: ["options", "trade-off", "recommendation"],
	}),
	dcSnippet({
		name: "Datacraft Benefits Realization",
		shortcut: "/dc-benefits",
		description: "Benefits realization narrative for outcome-led proposals.",
		tags: ["benefits-realization", "outcomes", "kpi"],
		content: benefitsRealizationContent,
		contentType: "consulting",
		topicCategory: "Benefits Realization",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["analytics", "workflow events"],
		complianceFrameworks: [],
		keyTerms: ["benefits", "baseline", "target", "measurement"],
	}),
	dcSnippet({
		name: "Datacraft KPI Measurement Framework",
		shortcut: "/dc-kpis",
		description: "KPI and measurement framework narrative.",
		tags: ["kpi", "measurement", "analytics"],
		content: kpiMeasurementContent,
		contentType: "consulting",
		topicCategory: "Measurement",
		sectors: ["government", "enterprise"],
		technologies: ["dashboards", "workflow analytics"],
		complianceFrameworks: [],
		keyTerms: ["KPIs", "cycle time", "adoption", "service levels"],
	}),
	dcSnippet({
		name: "Datacraft Vendor and Third-Party Management",
		shortcut: "/dc-vendor-management",
		description: "Third-party, subcontractor, source-system, and partner coordination narrative.",
		tags: ["vendor-management", "third-party", "coordination"],
		content: vendorThirdPartyManagementContent,
		contentType: "project_management",
		topicCategory: "Vendor Management",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["integration contracts", "support contacts"],
		complianceFrameworks: [],
		keyTerms: ["third-party", "vendor", "cross-vendor dependencies"],
	}),
	dcSnippet({
		name: "Datacraft Procurement Support",
		shortcut: "/dc-procurement-support",
		description: "Procurement support, evaluation material, and compliance-matrix narrative.",
		tags: ["procurement", "evaluation", "proposal-management"],
		content: procurementSupportContent,
		contentType: "proposal_management",
		topicCategory: "Procurement Support",
		sectors: ["government", "enterprise"],
		technologies: ["RFP parsing", "content library", "compliance matrix"],
		complianceFrameworks: ["Procurement"],
		keyTerms: ["evaluation", "evidence pack", "traceability matrix"],
	}),
	dcSnippet({
		name: "Datacraft Data Migration Governance",
		shortcut: "/dc-migration-governance",
		description: "Data migration governance, profiling, validation, and reconciliation narrative.",
		tags: ["data-migration", "governance", "validation"],
		content: dataMigrationGovernanceContent,
		contentType: "consulting",
		topicCategory: "Migration Governance",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["data profiling", "migration waves", "reconciliation"],
		complianceFrameworks: [],
		keyTerms: ["authoritative sources", "exception reports", "sign-off"],
	}),
	dcSnippet({
		name: "Datacraft Operational Readiness Assessment",
		shortcut: "/dc-readiness",
		description: "Operational readiness assessment narrative for go-live governance.",
		tags: ["readiness", "go-live", "assessment"],
		content: readinessAssessmentContent,
		contentType: "project_management",
		topicCategory: "Readiness",
		sectors: ["government", "enterprise"],
		technologies: ["readiness checklist", "support model"],
		complianceFrameworks: [],
		keyTerms: ["readiness", "go/no-go", "conditional go-live"],
	}),
	dcSnippet({
		name: "Datacraft Cutover and Command Center",
		shortcut: "/dc-cutover",
		description: "Cutover plan and command-center narrative.",
		tags: ["cutover", "command-center", "go-live"],
		content: cutoverCommandCenterContent,
		contentType: "project_management",
		topicCategory: "Cutover",
		sectors: ["government", "enterprise", "regulated finance"],
		technologies: ["cutover plan", "rollback", "monitoring"],
		complianceFrameworks: [],
		keyTerms: ["cutover", "command center", "rollback criteria"],
	}),
	dcSnippet({
		name: "Datacraft Hypercare and Stabilization",
		shortcut: "/dc-hypercare",
		description: "Post-go-live hypercare, stabilization, and support transition narrative.",
		tags: ["hypercare", "stabilization", "support"],
		content: hypercareStabilizationContent,
		contentType: "operations",
		topicCategory: "Hypercare",
		sectors: ["government", "enterprise"],
		technologies: ["support tickets", "usage monitoring"],
		complianceFrameworks: [],
		keyTerms: ["hypercare", "stabilization", "steady-state support"],
	}),
	dcSnippet({
		name: "Datacraft Lessons Learned",
		shortcut: "/dc-lessons-learned",
		description: "Lessons learned and continuous improvement narrative.",
		tags: ["lessons-learned", "continuous-improvement", "retrospective"],
		content: lessonsLearnedContent,
		contentType: "consulting",
		topicCategory: "Lessons Learned",
		sectors: ["government", "enterprise"],
		technologies: ["retrospective", "roadmap"],
		complianceFrameworks: [],
		keyTerms: ["lessons learned", "continuous improvement", "delivery playbook"],
	}),
	dcSnippet({
		name: "Datacraft Executive Advisory",
		shortcut: "/dc-executive-advisory",
		description: "Executive advisory narrative for technology, risk, and operating-model decisions.",
		tags: ["executive-advisory", "leadership", "decision-support"],
		content: executiveAdvisoryContent,
		contentType: "consulting",
		topicCategory: "Executive Advisory",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["decision briefs", "governance"],
		complianceFrameworks: [],
		keyTerms: ["executive advisory", "trade-offs", "sponsorship"],
	}),
	dcSnippet({
		name: "Datacraft Programme Assurance",
		shortcut: "/dc-programme-assurance",
		description: "Programme assurance and independent quality lens narrative.",
		tags: ["programme-assurance", "quality", "governance"],
		content: programmeAssuranceContent,
		contentType: "project_management",
		topicCategory: "Programme Assurance",
		sectors: ["government", "enterprise"],
		technologies: ["assurance review", "quality evidence"],
		complianceFrameworks: [],
		keyTerms: ["programme assurance", "corrective action", "go-live readiness"],
	}),
	dcSnippet({
		name: "Datacraft Agile-Hybrid Delivery",
		shortcut: "/dc-agile-hybrid",
		description: "Agile-hybrid delivery method narrative with stage gates and iteration.",
		tags: ["agile", "hybrid", "delivery-method"],
		content: agileHybridDeliveryContent,
		contentType: "project_management",
		topicCategory: "Delivery Method",
		sectors: ["government", "enterprise"],
		technologies: ["sprints", "stage gates", "incremental delivery"],
		complianceFrameworks: [],
		keyTerms: ["agile-hybrid", "stage gates", "working capability"],
	}),
	dcSnippet({
		name: "Datacraft Resource and Capacity Planning",
		shortcut: "/dc-capacity-planning",
		description: "Resource and client-side capacity planning narrative.",
		tags: ["capacity-planning", "resources", "staffing"],
		content: resourceCapacityPlanningContent,
		contentType: "project_management",
		topicCategory: "Capacity Planning",
		sectors: ["government", "enterprise"],
		technologies: ["resource planning", "workstream planning"],
		complianceFrameworks: [],
		keyTerms: ["capacity", "client availability", "resource constraints"],
	}),
	dcSnippet({
		name: "Datacraft Risk-Adjusted Roadmap",
		shortcut: "/dc-risk-adjusted-roadmap",
		description: "Risk-adjusted roadmap sequencing narrative.",
		tags: ["roadmap", "risk", "sequencing"],
		content: riskAdjustedRoadmapContent,
		contentType: "consulting",
		topicCategory: "Risk-Adjusted Roadmap",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["roadmap", "risk management"],
		complianceFrameworks: [],
		keyTerms: ["risk-adjusted", "foundation", "enhancements"],
	}),
	dcSnippet({
		name: "Datacraft Decision Briefing",
		shortcut: "/dc-decision-brief",
		description: "Decision briefing and executive paper narrative.",
		tags: ["decision-brief", "executive-paper", "governance"],
		content: decisionBriefingContent,
		contentType: "consulting",
		topicCategory: "Decision Briefing",
		sectors: ["government", "enterprise"],
		technologies: ["decision log", "options analysis"],
		complianceFrameworks: [],
		keyTerms: ["decision brief", "options", "recommendation"],
	}),
	dcSnippet({
		name: "Datacraft Target Operating Model",
		shortcut: "/dc-operating-model",
		description: "Target operating model narrative for post-go-live institutional ownership.",
		tags: ["operating-model", "governance", "steady-state"],
		content: operatingModelContent,
		contentType: "consulting",
		topicCategory: "Operating Model",
		sectors: ["government", "enterprise", "regional bodies"],
		technologies: ["support model", "workflow governance"],
		complianceFrameworks: [],
		keyTerms: ["target operating model", "steady state", "ownership"],
	}),
];

export const DATACRAFT_RESPONSE_SNIPPETS: DatacraftResponseSnippetInput[] =
	DATACRAFT_RESPONSE_SNIPPET_DEFINITIONS.map((snippet) => ({
		...snippet,
		placeholders: snippet.placeholders ?? commonPlaceholders,
	}));

const fullInstitutionalTemplateContent = doc([
	h(1, "Proposal Response: {{opportunity_name}}"),
	p("Submitted to: {{client_name}}"),
	p("Submitted by: Datacraft Ltd"),
	p("Solicitation: {{solicitation_number}}"),
	p("Submission date: {{submission_date}}"),
	rule(),
	...transmittalCoverLetterContent.content!,
	...executiveSummaryContent.content!,
	...requirementsInterpretationContent.content!,
	...scopeDeliverablesContent.content!,
	...companyOverviewContent.content!,
	...africanFirstContent.content!,
	...evaluatorWinThemesContent.content!,
	...technicalApproachContent.content!,
	...solutionArchitectureNarrativeContent.content!,
	...deploymentHostingContent.content!,
	...devsecopsReleaseContent.content!,
	...integrationMigrationContent.content!,
	...interoperabilityStandardsContent.content!,
	...dataGovernanceContent.content!,
	...privacyDataProtectionContent.content!,
	...aiGovernanceContent.content!,
	...securityContent.content!,
	...businessContinuityContent.content!,
	...performanceScalabilityContent.content!,
	...observabilityMonitoringContent.content!,
	...complianceMatrixNarrativeContent.content!,
	...legalCommercialContent.content!,
	...ethicsConflictContent.content!,
	...projectGovernanceContent.content!,
	...consultingDiscoveryContent.content!,
	...pmoMobilizationContent.content!,
	...raciDecisionRightsContent.content!,
	...raidManagementContent.content!,
	...changeControlContent.content!,
	...issueActionDependencyContent.content!,
	...communicationsCadenceContent.content!,
	...stakeholderEngagementContent.content!,
	...staffingKeyPersonnelContent.content!,
	...resourceCapacityPlanningContent.content!,
	...workPlanScheduleContent.content!,
	...implementationContent.content!,
	...agileHybridDeliveryContent.content!,
	...currentStateAssessmentContent.content!,
	...futureStateBlueprintContent.content!,
	...gapAnalysisRoadmapContent.content!,
	...maturityAssessmentContent.content!,
	...businessProcessReengineeringContent.content!,
	...workshopFacilitationContent.content!,
	...requirementsElicitationContent.content!,
	...solutionOptionsTradeoffContent.content!,
	...riskAdjustedRoadmapContent.content!,
	...decisionBriefingContent.content!,
	...operatingModelContent.content!,
	...transitionMobilizationContent.content!,
	...dataMigrationGovernanceContent.content!,
	...readinessAssessmentContent.content!,
	...cutoverCommandCenterContent.content!,
	...trainingChangeManagementContent.content!,
	...qualityTestingContent.content!,
	...acceptanceHandoverContent.content!,
	...programmeAssuranceContent.content!,
	...riskManagementContent.content!,
	...pastPerformanceContent.content!,
	...valueContent.content!,
	...benefitsRealizationContent.content!,
	...kpiMeasurementContent.content!,
	...pricingCommercialContent.content!,
	...vendorThirdPartyManagementContent.content!,
	...procurementSupportContent.content!,
	...serviceSupportContent.content!,
	...slaAvailabilityContent.content!,
	...hypercareStabilizationContent.content!,
	...lessonsLearnedContent.content!,
	...reportingAnalyticsContent.content!,
	...complianceContent.content!,
	...assumptionsDependenciesContent.content!,
	...localCapacitySustainabilityContent.content!,
	...environmentalSocialImpactContent.content!,
	...partnershipTeamingContent.content!,
	...accessibilityUxContent.content!,
	...innovationRoadmapContent.content!,
	...sectorPortfolioContent.content!,
	...knowledgeManagementContent.content!,
	...executiveAdvisoryContent.content!,
	...demoOralPresentationContent.content!,
	...clarificationResponseContent.content!,
	...closingContent.content!,
]);

const lindelaTemplateContent = doc([
	h(1, "Institutional Intelligence Platform Response"),
	p("Submitted to: {{client_name}}"),
	p("Opportunity: {{opportunity_name}}"),
	rule(),
	...executiveSummaryContent.content!,
	...lindelaContent.content!,
	...dataGovernanceContent.content!,
	...aiGovernanceContent.content!,
	...securityContent.content!,
	...technicalApproachContent.content!,
	...solutionArchitectureNarrativeContent.content!,
	...deploymentHostingContent.content!,
	...privacyDataProtectionContent.content!,
	...businessContinuityContent.content!,
	...integrationMigrationContent.content!,
	...interoperabilityStandardsContent.content!,
	...implementationContent.content!,
	...workPlanScheduleContent.content!,
	...requirementsElicitationContent.content!,
	...qualityTestingContent.content!,
	...acceptanceHandoverContent.content!,
	...reportingAnalyticsContent.content!,
	...pastPerformanceContent.content!,
	...valueContent.content!,
	...slaAvailabilityContent.content!,
	...observabilityMonitoringContent.content!,
	...localCapacitySustainabilityContent.content!,
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
	...solutionArchitectureNarrativeContent.content!,
	...deploymentHostingContent.content!,
	...integrationMigrationContent.content!,
	...interoperabilityStandardsContent.content!,
	...dataGovernanceContent.content!,
	...implementationContent.content!,
	...workPlanScheduleContent.content!,
	...raidManagementContent.content!,
	...changeControlContent.content!,
	...transitionMobilizationContent.content!,
	...readinessAssessmentContent.content!,
	...cutoverCommandCenterContent.content!,
	...trainingChangeManagementContent.content!,
	...qualityTestingContent.content!,
	...acceptanceHandoverContent.content!,
	...riskManagementContent.content!,
	...securityContent.content!,
	...businessContinuityContent.content!,
	...observabilityMonitoringContent.content!,
	...serviceSupportContent.content!,
	...slaAvailabilityContent.content!,
	...hypercareStabilizationContent.content!,
	...reportingAnalyticsContent.content!,
	...valueContent.content!,
	...pricingCommercialContent.content!,
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
