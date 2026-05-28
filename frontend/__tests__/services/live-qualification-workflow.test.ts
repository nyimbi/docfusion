import { describe, expect, it } from "vitest";
import {
	buildLiveQualificationPackage,
	buildLiveResponsePackage,
	type LiveQualificationPackage,
} from "@/lib/services/live-response-package";
import { buildLiveQualificationWorkflow } from "@/lib/services/live-qualification-workflow";

const sourceText = [
	"Registration of suppliers for goods, services and works.",
	"Bidders must submit company profile, tax compliance, registration certificate, declarations, and category-specific evidence.",
	"Bidders may register for software, API architecture, data platform, payment, records, security, compliance, integration, monitoring, reporting, and digital workflow categories.",
	"The registration also covers cleaning, construction, furniture, and vehicle services.",
	"Applicants shall submit implementation, consultancy, project management, technical assistance, training, and quality assurance experience for government procurement.",
].join("\n");

function supplierRegistrationPackage(): LiveQualificationPackage {
	const responsePackage = buildLiveResponsePackage({
		opportunity: {
			title: "Registration of suppliers for goods, services and works",
			organization: "Water Utility",
			source: "kenya_ppip",
			sourceId: "supplier-registration",
			projectSummary: "Registration covers ICT software system, workflow automation, data platforms, cleaning, construction, furniture, and vehicle services.",
		},
		sourceText,
		generatedAt: new Date("2026-05-28T00:00:00.000Z"),
	});
	const qualificationPackage = buildLiveQualificationPackage(responsePackage);
	if (!qualificationPackage) throw new Error("Expected supplier registration package");
	return qualificationPackage;
}

describe("live qualification workflow", () => {
	it("builds executable workflow gates from supplier-registration packages", () => {
		const workflow = buildLiveQualificationWorkflow(supplierRegistrationPackage());

		expect(workflow).toMatchObject({
			workflowKey: "live_qualification_package",
			pursuitRoute: "supplier_registration",
			status: "ready_for_operator_execution",
			currentState: "route_review",
			metrics: {
				gateCount: 5,
				blockedGateCount: 0,
				taskCount: 5,
				mandatoryTaskCount: 4,
				requiredArtifactCount: 9,
			},
		});
		expect(workflow.gates.map((gate) => gate.state)).toEqual([
			"route_review",
			"artifact_assembly",
			"capability_mapping",
			"compliance_review",
			"submission_control",
		]);
		expect(workflow.operatorBriefMarkdown).toContain("## Workflow Gates");
		expect(workflow.operatorBriefMarkdown).toContain("QWG-005 - Prepare final qualification pack");
	});

	it("blocks the workflow when mandatory compliance artifacts are missing", () => {
		const qualificationPackage = supplierRegistrationPackage();
		const workflow = buildLiveQualificationWorkflow({
			...qualificationPackage,
			requiredArtifacts: qualificationPackage.requiredArtifacts.filter((artifact) =>
				artifact !== "Tax compliance certificate"
			),
		});

		expect(workflow.status).toBe("blocked");
		expect(workflow.currentState).toBe("compliance_review");
		expect(workflow.metrics.blockedGateCount).toBe(1);
		expect(workflow.gates.find((gate) => gate.id === "QWG-004")?.blockers).toEqual([
			"Missing required artifact: Tax compliance certificate",
		]);
	});
});
