import type {
	LiveQualificationChecklistItem,
	LiveQualificationPackage,
} from "@/lib/services/live-response-package";

export type LiveQualificationWorkflowState =
	| "route_review"
	| "artifact_assembly"
	| "capability_mapping"
	| "compliance_review"
	| "submission_control";

export type LiveQualificationWorkflowStatus = "ready_for_operator_execution" | "blocked";

export interface LiveQualificationWorkflowGate {
	id: string;
	state: LiveQualificationWorkflowState;
	title: string;
	ownerHint: LiveQualificationChecklistItem["ownerHint"];
	status: "ready" | "blocked";
	requiredArtifacts: string[];
	checklistItemIds: string[];
	blockers: string[];
}

export interface LiveQualificationWorkflowTask {
	taskKey: string;
	state: LiveQualificationWorkflowState;
	priority: LiveQualificationChecklistItem["priority"];
	assignedRole: LiveQualificationChecklistItem["ownerHint"];
	title: string;
	sourceRequirementIds: string[];
}

export interface LiveQualificationWorkflow {
	workflowKey: "live_qualification_package";
	pursuitRoute: LiveQualificationPackage["pursuitRoute"];
	title: string;
	status: LiveQualificationWorkflowStatus;
	currentState: LiveQualificationWorkflowState;
	gates: LiveQualificationWorkflowGate[];
	tasks: LiveQualificationWorkflowTask[];
	nextActions: string[];
	metrics: {
		gateCount: number;
		blockedGateCount: number;
		taskCount: number;
		mandatoryTaskCount: number;
		requiredArtifactCount: number;
		sourceSignalCount: number;
	};
	operatorBriefMarkdown: string;
}

export function buildLiveQualificationWorkflow(
	qualificationPackage: LiveQualificationPackage
): LiveQualificationWorkflow {
	const gates = buildQualificationWorkflowGates(qualificationPackage);
	const tasks = qualificationPackage.checklist.map((item) => qualificationChecklistTask(item));
	const blockedGates = gates.filter((gate) => gate.status === "blocked");
	const status: LiveQualificationWorkflowStatus = blockedGates.length > 0
		? "blocked"
		: "ready_for_operator_execution";
	const currentState = blockedGates[0]?.state ?? "route_review";
	const sourceSignalCount = new Set(tasks.flatMap((task) => task.sourceRequirementIds)).size;
	const workflowValue: Omit<LiveQualificationWorkflow, "operatorBriefMarkdown"> = {
		workflowKey: "live_qualification_package",
		pursuitRoute: qualificationPackage.pursuitRoute,
		title: `Qualification Workflow - ${qualificationPackage.title}`,
		status,
		currentState,
		gates,
		tasks,
		nextActions: gates
			.filter((gate) => gate.status === "ready")
			.slice(0, 5)
			.map((gate) => gate.title),
		metrics: {
			gateCount: gates.length,
			blockedGateCount: blockedGates.length,
			taskCount: tasks.length,
			mandatoryTaskCount: tasks.filter((task) => task.priority === "mandatory").length,
			requiredArtifactCount: qualificationPackage.requiredArtifacts.length,
			sourceSignalCount,
		},
	};

	return {
		...workflowValue,
		operatorBriefMarkdown: formatLiveQualificationWorkflowBrief(workflowValue, qualificationPackage),
	};
}

function buildQualificationWorkflowGates(
	qualificationPackage: LiveQualificationPackage
): LiveQualificationWorkflowGate[] {
	const routeSpecificArtifacts = qualificationPackage.pursuitRoute === "supplier_registration"
		? ["Selected supplier category matrix", "Category-specific licenses or certifications"]
		: ["Prequalification questionnaire response", "Financial capacity evidence"];
	return [
		workflowGate({
			id: "QWG-001",
			state: "route_review",
			title: "Confirm pursuit route and bid/no-bid owner",
			ownerHint: "proposal_manager",
			requiredArtifacts: [],
			checklistItemIds: ["QUAL-001", "QUAL-004"],
			qualificationPackage,
		}),
		workflowGate({
			id: "QWG-002",
			state: "artifact_assembly",
			title: "Assemble legal, eligibility, and declaration artifacts",
			ownerHint: "compliance",
			requiredArtifacts: [
				"Company profile",
				"Certificate of incorporation or business registration",
				"Signed declarations and eligibility forms",
			],
			checklistItemIds: ["QUAL-002"],
			qualificationPackage,
		}),
		workflowGate({
			id: "QWG-003",
			state: "capability_mapping",
			title: "Map Datacraft capability evidence to selected qualification categories",
			ownerHint: "technical_lead",
			requiredArtifacts: [
				"Relevant past performance evidence",
				"Key personnel qualifications",
				...routeSpecificArtifacts,
			],
			checklistItemIds: ["QUAL-003"],
			qualificationPackage,
		}),
		workflowGate({
			id: "QWG-004",
			state: "compliance_review",
			title: "Review tax, eligibility, and specialist-domain risks",
			ownerHint: "compliance",
			requiredArtifacts: ["Tax compliance certificate"],
			checklistItemIds: ["QUAL-002", "QUAL-004"],
			qualificationPackage,
		}),
		workflowGate({
			id: "QWG-005",
			state: "submission_control",
			title: "Prepare final qualification pack and capture submission receipt",
			ownerHint: "compliance",
			requiredArtifacts: ["Submission receipt or portal acknowledgement"],
			checklistItemIds: ["QUAL-005"],
			qualificationPackage,
		}),
	];
}

function workflowGate(input: {
	id: string;
	state: LiveQualificationWorkflowState;
	title: string;
	ownerHint: LiveQualificationChecklistItem["ownerHint"];
	requiredArtifacts: string[];
	checklistItemIds: string[];
	qualificationPackage: LiveQualificationPackage;
}): LiveQualificationWorkflowGate {
	const artifactSet = new Set(input.qualificationPackage.requiredArtifacts);
	const checklistSet = new Set(input.qualificationPackage.checklist.map((item) => item.id));
	const missingArtifacts = input.requiredArtifacts.filter((artifact) => !artifactSet.has(artifact));
	const missingChecklistItems = input.checklistItemIds.filter((id) => !checklistSet.has(id));
	const blockers = [
		...missingArtifacts.map((artifact) => `Missing required artifact: ${artifact}`),
		...missingChecklistItems.map((id) => `Missing checklist item: ${id}`),
	];

	return {
		id: input.id,
		state: input.state,
		title: input.title,
		ownerHint: input.ownerHint,
		status: blockers.length > 0 ? "blocked" : "ready",
		requiredArtifacts: input.requiredArtifacts,
		checklistItemIds: input.checklistItemIds,
		blockers,
	};
}

function qualificationChecklistTask(item: LiveQualificationChecklistItem): LiveQualificationWorkflowTask {
	return {
		taskKey: `live_qualification_package:${item.id}`,
		state: stateForChecklistItem(item),
		priority: item.priority,
		assignedRole: item.ownerHint,
		title: item.text,
		sourceRequirementIds: item.sourceRequirementIds,
	};
}

function stateForChecklistItem(item: LiveQualificationChecklistItem): LiveQualificationWorkflowState {
	if (item.id === "QUAL-001" || item.id === "QUAL-004") return "route_review";
	if (item.id === "QUAL-002") return "artifact_assembly";
	if (item.id === "QUAL-003") return "capability_mapping";
	if (item.id === "QUAL-005") return "submission_control";
	return "compliance_review";
}

function formatLiveQualificationWorkflowBrief(
	workflowValue: Omit<LiveQualificationWorkflow, "operatorBriefMarkdown">,
	qualificationPackage: LiveQualificationPackage
): string {
	const lines = [
		`# ${workflowValue.title}`,
		"",
		`Status: ${workflowValue.status}`,
		`Current state: ${workflowValue.currentState}`,
		`Route: \`${workflowValue.pursuitRoute}\``,
		"",
		"## Workflow Gates",
		"",
		...workflowValue.gates.flatMap((gate) => [
			`### ${gate.id} - ${gate.title}`,
			"",
			`- State: ${gate.state}`,
			`- Owner: ${gate.ownerHint}`,
			`- Status: ${gate.status}`,
			`- Required artifacts: ${gate.requiredArtifacts.length > 0 ? gate.requiredArtifacts.join("; ") : "operator decision record"}`,
			`- Checklist: ${gate.checklistItemIds.join(", ")}`,
			...(gate.blockers.length > 0 ? [`- Blockers: ${gate.blockers.join("; ")}`] : []),
			"",
		]),
		"## Operator Tasks",
		"",
		...workflowValue.tasks.map((task) =>
			`- ${task.taskKey}: ${task.title} (${task.assignedRole}, ${task.priority})`
		),
		"",
		"## Source Package Summary",
		"",
		qualificationPackage.summary,
		"",
	];
	return `${lines.join("\n").trimEnd()}\n`;
}
