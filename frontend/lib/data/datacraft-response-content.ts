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
	...evaluatorWinThemesContent.content!,
	...technicalApproachContent.content!,
	...solutionArchitectureNarrativeContent.content!,
	...integrationMigrationContent.content!,
	...dataGovernanceContent.content!,
	...aiGovernanceContent.content!,
	...securityContent.content!,
	...complianceMatrixNarrativeContent.content!,
	...projectGovernanceContent.content!,
	...staffingKeyPersonnelContent.content!,
	...implementationContent.content!,
	...transitionMobilizationContent.content!,
	...trainingChangeManagementContent.content!,
	...qualityTestingContent.content!,
	...riskManagementContent.content!,
	...pastPerformanceContent.content!,
	...valueContent.content!,
	...pricingCommercialContent.content!,
	...serviceSupportContent.content!,
	...slaAvailabilityContent.content!,
	...reportingAnalyticsContent.content!,
	...complianceContent.content!,
	...assumptionsDependenciesContent.content!,
	...localCapacitySustainabilityContent.content!,
	...partnershipTeamingContent.content!,
	...accessibilityUxContent.content!,
	...innovationRoadmapContent.content!,
	...sectorPortfolioContent.content!,
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
	...integrationMigrationContent.content!,
	...implementationContent.content!,
	...qualityTestingContent.content!,
	...reportingAnalyticsContent.content!,
	...pastPerformanceContent.content!,
	...valueContent.content!,
	...slaAvailabilityContent.content!,
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
	...integrationMigrationContent.content!,
	...dataGovernanceContent.content!,
	...implementationContent.content!,
	...transitionMobilizationContent.content!,
	...trainingChangeManagementContent.content!,
	...qualityTestingContent.content!,
	...riskManagementContent.content!,
	...securityContent.content!,
	...serviceSupportContent.content!,
	...slaAvailabilityContent.content!,
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
