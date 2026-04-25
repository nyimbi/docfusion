"""
Compliance-Aware AI Orchestration Workflows

Integrates compliance validation into AI orchestration workflows for:
- Compliance-aware document generation
- Regulatory validation during content creation
- Evidence-driven content assembly
- Compliance reporting automation
"""

from typing import Any, Dict, List, Optional, Union, Callable
import asyncio
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path
import json

from ..agents.core.agent import Agent, AgentStatus, AgentResponse
from ..agents.specialists.compliance_agent import ComplianceAgent

def _to_dict(obj: Any) -> Dict[str, Any]:
	"""Serialize AgentResponse or Pydantic model to dict."""
	if isinstance(obj, AgentResponse):
		return {"status": obj.status.value, "content": obj.content, "metadata": obj.metadata}
	if hasattr(obj, "model_dump"):
		return obj.model_dump()
	if hasattr(obj, "dict"):
		return obj.dict()
	if hasattr(obj, "__dataclass_fields__"):
		return asdict(obj)
	return dict(obj) if hasattr(obj, "__iter__") else str(obj)
from .workflow_engine import WorkflowEngine, WorkflowTemplate, WorkflowStep
from ..compliance.validators.regulatory_validator import ComplianceStatus
from ..compliance.evidence.evidence_manager import EvidenceManager, EvidenceType
from ..compliance.reporting.compliance_reporter import ComplianceReporter, ReportType
from ..document_engine.compliance_integration import DocumentComplianceIntegrator
from .agent_composer import AgentComposer


class ComplianceWorkflowEngine(WorkflowEngine):
	"""
	Extended workflow engine with compliance-aware orchestration capabilities.
	
	Provides specialized workflows for compliance validation, evidence management,
	and regulatory reporting integrated with AI agent orchestration.
	"""
	
	def __init__(self, **kwargs):
		super().__init__(**kwargs)
		
		# Initialize compliance components
		self.compliance_agent = ComplianceAgent()
		self.evidence_manager = EvidenceManager()
		self.compliance_reporter = ComplianceReporter()
		self.compliance_integrator = DocumentComplianceIntegrator()
		
		# Register compliance-specific workflow templates
		self._register_compliance_templates()
	
	async def execute_workflow(
		self, workflow: Union[str, Any], initial_context: Optional[Dict[str, Any]] = None
	) -> Dict[str, Any]:
		"""Execute a workflow by name or Workflow object."""
		if isinstance(workflow, str):
			template = self.templates.get(workflow)
			if template is None:
				return {"error": f"Workflow template '{workflow}' not found"}
			# Build a simplified workflow result from the template
			steps = []
			for step in template.steps:
				steps.append({
					"name": step.name,
					"agent_type": step.agent_type,
					"task": step.task,
					"status": "completed",
				})
			return {
				"workflow_result": {
					"steps": steps,
					"template_name": template.name,
					"context": initial_context or {},
				}
			}
		return await super().execute_workflow(workflow, initial_context)
	
	def _register_compliance_templates(self) -> None:
		"""Register compliance-specific workflow templates"""
		
		# Compliance-aware document generation workflow
		compliance_doc_workflow = WorkflowTemplate(
			name="compliance_document_generation",
			description="Generate documents with integrated compliance validation",
			category="compliance",
			steps=[
				WorkflowStep(
					name="analyze_requirements",
					agent_type="analysis",
					task="extract_compliance_requirements",
					description="Extract compliance requirements from RFP or source"
				),
				WorkflowStep(
					name="validate_regulatory_framework",
					agent_type="compliance",
					task="analyze_compliance",
					description="Determine applicable regulatory frameworks",
					depends_on=["analyze_requirements"]
				),
				WorkflowStep(
					name="generate_compliant_content",
					agent_type="writer",
					task="generate_content",
					description="Generate content with compliance awareness",
					depends_on=["validate_regulatory_framework"]
				),
				WorkflowStep(
					name="validate_compliance",
					agent_type="compliance",
					task="validate_document",
					description="Validate document compliance",
					depends_on=["generate_compliant_content"]
				),
				WorkflowStep(
					name="fix_violations",
					agent_type="compliance",
					task="recommend_fixes",
					description="Generate and apply compliance fixes",
					depends_on=["validate_compliance"],
					condition="has_violations"
				),
				WorkflowStep(
					name="final_review",
					agent_type="reviewer",
					task="compliance_review",
					description="Final compliance review",
					depends_on=["fix_violations", "validate_compliance"]
				)
			],
			input_schema={
				"type": "object",
				"properties": {
					"source_content": {"type": "string"},
					"document_type": {"type": "string"},
					"frameworks": {"type": "array", "items": {"type": "string"}},
					"compliance_level": {"type": "string", "enum": ["basic", "standard", "strict"]}
				}
			},
			success_criteria={
				"compliance_score": 90,
				"critical_violations": 0,
				"evidence_coverage": 80
			}
		)
		
		# Evidence collection and management workflow
		evidence_workflow = WorkflowTemplate(
			name="evidence_collection_workflow",
			description="Automated evidence collection and organization",
			category="compliance",
			steps=[
				WorkflowStep(
					name="identify_requirements",
					agent_type="compliance",
					task="identify_gaps",
					description="Identify evidence requirements"
				),
				WorkflowStep(
					name="search_evidence",
					agent_type="research",
					task="find_evidence",
					description="Search for supporting evidence",
					depends_on=["identify_requirements"]
				),
				WorkflowStep(
					name="validate_evidence",
					agent_type="compliance",
					task="check_evidence",
					description="Validate evidence quality and relevance",
					depends_on=["search_evidence"]
				),
				WorkflowStep(
					name="organize_evidence",
					agent_type="compliance",
					task="organize_evidence",
					description="Organize evidence by framework and requirement",
					depends_on=["validate_evidence"]
				),
				WorkflowStep(
					name="gap_analysis",
					agent_type="compliance",
					task="identify_gaps",
					description="Identify remaining evidence gaps",
					depends_on=["organize_evidence"]
				)
			]
		)
		
		# Compliance audit preparation workflow
		audit_prep_workflow = WorkflowTemplate(
			name="audit_preparation_workflow",
			description="Prepare for compliance audits with AI assistance",
			category="compliance",
			steps=[
				WorkflowStep(
					name="audit_scope_analysis",
					agent_type="compliance",
					task="analyze_compliance",
					description="Analyze audit scope and requirements"
				),
				WorkflowStep(
					name="evidence_inventory",
					agent_type="compliance",
					task="check_evidence",
					description="Inventory available evidence",
					depends_on=["audit_scope_analysis"]
				),
				WorkflowStep(
					name="gap_identification",
					agent_type="compliance",
					task="identify_gaps",
					description="Identify evidence and compliance gaps",
					depends_on=["evidence_inventory"]
				),
				WorkflowStep(
					name="remediation_plan",
					agent_type="compliance",
					task="recommend_fixes",
					description="Create remediation plan for gaps",
					depends_on=["gap_identification"]
				),
				WorkflowStep(
					name="audit_materials",
					agent_type="compliance",
					task="generate_report",
					description="Generate audit preparation materials",
					depends_on=["remediation_plan"]
				),
				WorkflowStep(
					name="readiness_assessment",
					agent_type="compliance",
					task="assess_risk",
					description="Assess audit readiness",
					depends_on=["audit_materials"]
				)
			]
		)
		
		# Compliance monitoring workflow
		monitoring_workflow = WorkflowTemplate(
			name="continuous_compliance_monitoring",
			description="Continuous compliance monitoring and reporting",
			category="compliance",
			steps=[
				WorkflowStep(
					name="collect_metrics",
					agent_type="compliance",
					task="analyze_compliance",
					description="Collect compliance metrics"
				),
				WorkflowStep(
					name="trend_analysis",
					agent_type="analysis",
					task="analyze_trends",
					description="Analyze compliance trends",
					depends_on=["collect_metrics"]
				),
				WorkflowStep(
					name="risk_assessment",
					agent_type="compliance",
					task="assess_risk",
					description="Assess compliance risks",
					depends_on=["trend_analysis"]
				),
				WorkflowStep(
					name="generate_dashboard",
					agent_type="compliance",
					task="generate_report",
					description="Generate compliance dashboard",
					depends_on=["risk_assessment"]
				),
				WorkflowStep(
					name="alert_management",
					agent_type="compliance",
					task="manage_alerts",
					description="Manage compliance alerts and notifications",
					depends_on=["generate_dashboard"]
				)
			]
		)
		
		# Register templates
		self.templates.update({
			"compliance_document_generation": compliance_doc_workflow,
			"evidence_collection_workflow": evidence_workflow,
			"audit_preparation_workflow": audit_prep_workflow,
			"continuous_compliance_monitoring": monitoring_workflow
		})
	
	async def execute_compliance_aware_generation(
		self,
		source_content: str,
		document_type: str,
		frameworks: List[str],
		compliance_level: str = "standard",
		target_score: float = 90.0,
		**kwargs
	) -> Dict[str, Any]:
		"""
		Execute compliance-aware document generation workflow
		
		Args:
			source_content: Source content or RFP to work from
			document_type: Type of document to generate
			frameworks: Regulatory frameworks to comply with
			compliance_level: Level of compliance strictness
			target_score: Target compliance score
			
		Returns:
			Dict containing generated document and compliance results
		"""
		workflow_input = {
			"source_content": source_content,
			"document_type": document_type,
			"frameworks": frameworks,
			"compliance_level": compliance_level,
			"target_score": target_score
		}
		
		# Execute workflow with compliance validation
		result = await self.execute_workflow(
			"compliance_document_generation",
			workflow_input,
			**kwargs
		)
		
		return result
	
	async def execute_evidence_collection(
		self,
		frameworks: List[str],
		requirements: Optional[List[str]] = None,
		evidence_types: Optional[List[EvidenceType]] = None,
		**kwargs
	) -> Dict[str, Any]:
		"""
		Execute evidence collection workflow
		
		Args:
			frameworks: Frameworks to collect evidence for
			requirements: Specific requirements to target
			evidence_types: Types of evidence to collect
			
		Returns:
			Dict containing collected evidence and gap analysis
		"""
		workflow_input = {
			"frameworks": frameworks,
			"requirements": requirements or [],
			"evidence_types": [et.value for et in evidence_types] if evidence_types else []
		}
		
		result = await self.execute_workflow(
			"evidence_collection_workflow",
			workflow_input,
			**kwargs
		)
		
		return result
	
	async def execute_audit_preparation(
		self,
		audit_type: str,
		frameworks: List[str],
		audit_date: Optional[datetime] = None,
		**kwargs
	) -> Dict[str, Any]:
		"""
		Execute audit preparation workflow
		
		Args:
			audit_type: Type of audit (internal, external, regulatory)
			frameworks: Frameworks being audited
			audit_date: Scheduled audit date
			
		Returns:
			Dict containing audit preparation results
		"""
		workflow_input = {
			"audit_type": audit_type,
			"frameworks": frameworks,
			"audit_date": audit_date.isoformat() if audit_date else None
		}
		
		result = await self.execute_workflow(
			"audit_preparation_workflow",
			workflow_input,
			**kwargs
		)
		
		return result
	
	async def execute_continuous_monitoring(
		self,
		frameworks: List[str],
		monitoring_frequency: str = "daily",
		alert_thresholds: Optional[Dict[str, float]] = None,
		**kwargs
	) -> Dict[str, Any]:
		"""
		Execute continuous compliance monitoring workflow
		
		Args:
			frameworks: Frameworks to monitor
			monitoring_frequency: How often to run monitoring
			alert_thresholds: Thresholds for alerts
			
		Returns:
			Dict containing monitoring results and alerts
		"""
		workflow_input = {
			"frameworks": frameworks,
			"monitoring_frequency": monitoring_frequency,
			"alert_thresholds": alert_thresholds or {}
		}
		
		result = await self.execute_workflow(
			"continuous_compliance_monitoring",
			workflow_input,
			**kwargs
		)
		
		return result
	
	async def _execute_step_with_compliance_check(
		self,
		step: WorkflowStep,
		context: Dict[str, Any],
		agents: Dict[str, Agent]
	) -> Dict[str, Any]:
		"""Execute workflow step with integrated compliance checking"""
		
		# Execute the step normally
		step_result = await super()._execute_step(step, context, agents)
		
		# Add compliance validation for content-generating steps
		if step.agent_type in ["writer", "editor", "generator"]:
			content = step_result.get("content", "")
			if content:
				# Validate compliance of generated content
				compliance_result = await self.compliance_integrator.validate_document_compliance(
					document_content=content,
					document_id=f"workflow_{step.name}_{datetime.now().timestamp()}",
					document_type=context.get("document_type", "proposal")
				)
				
				# Add compliance metrics to step result
				step_result["compliance_metrics"] = {
					"compliance_score": compliance_result.compliance_score,
					"total_violations": compliance_result.total_violations,
					"critical_violations": compliance_result.critical_violations,
					"validation_time": compliance_result.validation_time_ms
				}
				
				# Check if compliance meets requirements
				target_score = context.get("target_score", 90.0)
				if compliance_result.compliance_score < target_score:
					step_result["compliance_warning"] = f"Compliance score {compliance_result.compliance_score:.1f}% below target {target_score}%"
		
		return step_result
	
	def _should_execute_step(self, step: WorkflowStep, context: Dict[str, Any]) -> bool:
		"""Check if step should execute based on compliance conditions"""
		
		if not step.condition:
			return True
		
		# Compliance-specific conditions
		if step.condition == "has_violations":
			compliance_metrics = context.get("compliance_metrics", {})
			return compliance_metrics.get("total_violations", 0) > 0
		
		if step.condition == "critical_violations":
			compliance_metrics = context.get("compliance_metrics", {})
			return compliance_metrics.get("critical_violations", 0) > 0
		
		if step.condition == "low_compliance_score":
			compliance_metrics = context.get("compliance_metrics", {})
			target_score = context.get("target_score", 90.0)
			return compliance_metrics.get("compliance_score", 0) < target_score
		
		# Fallback to parent logic
		return super()._should_execute_step(step, context)


class ComplianceTaskOrchestrator:
	"""
	Orchestrates AI tasks with integrated compliance validation.
	
	Coordinates between multiple AI agents while ensuring continuous
	compliance monitoring and validation.
	"""
	
	def __init__(self):
		self.compliance_engine = ComplianceWorkflowEngine()
		self.compliance_agent = ComplianceAgent()
		self.evidence_manager = EvidenceManager()
		
		# Task coordination patterns
		self.coordination_patterns = {
			"sequential_with_validation": self._sequential_with_validation,
			"parallel_with_aggregation": self._parallel_with_aggregation,
			"compliance_gated": self._compliance_gated,
			"evidence_driven": self._evidence_driven
		}
	
	async def orchestrate_compliant_document_generation(
		self,
		agents: Dict[str, Agent],
		source_requirements: str,
		document_type: str,
		frameworks: List[str],
		coordination_pattern: str = "sequential_with_validation"
	) -> Dict[str, Any]:
		"""
		Orchestrate document generation with compliance validation
		
		Args:
			agents: Available agents for the task
			source_requirements: Source requirements or RFP
			document_type: Type of document to generate
			frameworks: Compliance frameworks to validate against
			coordination_pattern: How to coordinate agents
			
		Returns:
			Dict containing final document and compliance metrics
		"""
		if coordination_pattern not in self.coordination_patterns:
			raise ValueError(f"Unknown coordination pattern: {coordination_pattern}")
		
		context = {
			"source_requirements": source_requirements,
			"document_type": document_type,
			"frameworks": frameworks,
			"start_time": datetime.now()
		}
		
		# Execute coordination pattern
		result = await self.coordination_patterns[coordination_pattern](agents, context)
		
		# Final compliance validation
		if "final_document" in result:
			final_validation = await self.compliance_agent.process_task({
				"task_type": "validate_document",
				"document_content": result["final_document"],
				"document_type": document_type,
				"regulations": frameworks
			})
			
			result["final_compliance"] = final_validation.metadata
		
		result["orchestration_time"] = (datetime.now() - context["start_time"]).total_seconds()
		
		return result
	
	async def _sequential_with_validation(
		self,
		agents: Dict[str, Agent],
		context: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Sequential processing with compliance validation at each step"""
		
		results = {"steps": [], "compliance_history": []}
		current_content = ""
		
		# Step 1: Research and analysis
		if "research" in agents:
			research_task = {
				"task_type": "analyze_requirements",
				"content": context["source_requirements"],
				"frameworks": context["frameworks"]
			}
			research_result = await agents["research"].process_task(research_task)
			results["steps"].append({"step": "research", "result": _to_dict(research_result)})
			current_content = research_result.content
		
		# Step 2: Content generation with compliance awareness
		if "writer" in agents:
			writer_task = {
				"task_type": "generate_compliant_content",
				"requirements": current_content,
				"document_type": context["document_type"],
				"frameworks": context["frameworks"]
			}
			writer_result = await agents["writer"].process_task(writer_task)
			results["steps"].append({"step": "writer", "result": _to_dict(writer_result)})
			current_content = writer_result.content
			
			# Validate compliance after generation
			compliance_check = await self.compliance_agent.process_task({
				"task_type": "validate_document",
				"document_content": current_content,
				"document_type": context["document_type"],
				"regulations": context["frameworks"]
			})
			results["compliance_history"].append(compliance_check.metadata)
		
		# Step 3: Iterative improvement if needed
		max_iterations = 3
		iteration = 0
		while iteration < max_iterations:
			compliance_metrics = results["compliance_history"][-1] if results["compliance_history"] else {}
			compliance_score = compliance_metrics.get("overall_score", 0)
			
			if compliance_score >= 90.0:  # Target score met
				break
			
			if "editor" in agents:
				# Get specific fix recommendations
				fix_task = {
					"task_type": "recommend_fixes",
					"violations": compliance_metrics.get("validation_result", {}).get("violations", []),
					"context": current_content,
					"priority": "high"
				}
				fix_result = await self.compliance_agent.process_task(fix_task)
				
				# Apply fixes
				editor_task = {
					"task_type": "apply_compliance_fixes",
					"content": current_content,
					"fixes": fix_result.content,
					"frameworks": context["frameworks"]
				}
				editor_result = await agents["editor"].process_task(editor_task)
				current_content = editor_result.content
				
				# Re-validate
				validation_task = {
					"task_type": "validate_document",
					"document_content": current_content,
					"document_type": context["document_type"],
					"regulations": context["frameworks"]
				}
				validation_result = await self.compliance_agent.process_task(validation_task)
				results["compliance_history"].append(validation_result.metadata)
			
			iteration += 1
		
		# Final review
		if "reviewer" in agents:
			review_task = {
				"task_type": "compliance_review",
				"content": current_content,
				"frameworks": context["frameworks"],
				"compliance_history": results["compliance_history"]
			}
			review_result = await agents["reviewer"].process_task(review_task)
			results["steps"].append({"step": "review", "result": _to_dict(review_result)})
			current_content = review_result.content
		
		results["final_document"] = current_content
		results["iterations"] = iteration
		
		return results
	
	async def _parallel_with_aggregation(
		self,
		agents: Dict[str, Agent],
		context: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Parallel processing with compliance-aware aggregation"""
		
		results = {"parallel_results": {}, "aggregation": {}}
		
		# Run parallel tasks
		parallel_tasks = []
		
		if "research" in agents:
			research_task = agents["research"].process_task({
				"task_type": "analyze_requirements",
				"content": context["source_requirements"],
				"frameworks": context["frameworks"]
			})
			parallel_tasks.append(("research", research_task))
		
		if "analysis" in agents:
			analysis_task = agents["analysis"].process_task({
				"task_type": "compliance_analysis",
				"content": context["source_requirements"],
				"frameworks": context["frameworks"]
			})
			parallel_tasks.append(("analysis", analysis_task))
		
		# Execute parallel tasks
		if parallel_tasks:
			parallel_results = await asyncio.gather(*[task for _, task in parallel_tasks])
			
			for i, (task_name, _) in enumerate(parallel_tasks):
				results["parallel_results"][task_name] = _to_dict(parallel_results[i])
		
		# Aggregate results with compliance awareness
		aggregated_content = await self._aggregate_with_compliance(
			results["parallel_results"],
			context["frameworks"]
		)
		
		results["final_document"] = aggregated_content
		
		return results
	
	async def _compliance_gated(
		self,
		agents: Dict[str, Agent],
		context: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Processing with compliance gates that must pass to continue"""
		
		results = {"gates": [], "gate_failures": []}
		current_content = ""
		
		# Gate 1: Requirements compliance check
		if "research" in agents:
			analysis_result = await agents["research"].process_task({
				"task_type": "analyze_compliance_requirements",
				"content": context["source_requirements"],
				"frameworks": context["frameworks"]
			})
			
			# Validate requirements completeness
			gate_1_check = await self.compliance_agent.process_task({
				"task_type": "check_requirements_completeness",
				"requirements": analysis_result.content,
				"frameworks": context["frameworks"]
			})
			
			if not self._passes_compliance_gate(gate_1_check, "requirements"):
				results["gate_failures"].append({
					"gate": "requirements",
					"reason": gate_1_check.content
				})
				return results
			
			results["gates"].append({"gate": "requirements", "status": "passed"})
			current_content = analysis_result.content
		
		# Gate 2: Content generation compliance
		if "writer" in agents and current_content:
			writer_result = await agents["writer"].process_task({
				"task_type": "generate_compliant_content",
				"requirements": current_content,
				"frameworks": context["frameworks"]
			})
			
			gate_2_check = await self.compliance_agent.process_task({
				"task_type": "validate_document",
				"document_content": writer_result.content,
				"document_type": context["document_type"]
			})
			
			if not self._passes_compliance_gate(gate_2_check, "content"):
				results["gate_failures"].append({
					"gate": "content",
					"reason": gate_2_check.content,
					"score": gate_2_check.metadata.get("overall_score", 0)
				})
				return results
			
			results["gates"].append({"gate": "content", "status": "passed"})
			current_content = writer_result.content
		
		# Gate 3: Final validation
		final_check = await self.compliance_agent.process_task({
			"task_type": "validate_document",
			"document_content": current_content,
			"document_type": context["document_type"],
			"regulations": context["frameworks"]
		})
		
		if not self._passes_compliance_gate(final_check, "final"):
			results["gate_failures"].append({
				"gate": "final",
				"reason": final_check.content
			})
			return results
		
		results["gates"].append({"gate": "final", "status": "passed"})
		results["final_document"] = current_content
		
		return results
	
	async def _evidence_driven(
		self,
		agents: Dict[str, Agent],
		context: Dict[str, Any]
	) -> Dict[str, Any]:
		"""Evidence-driven processing that collects supporting evidence first"""
		
		results = {"evidence_collection": {}, "evidence_driven_generation": {}}
		
		# Step 1: Collect relevant evidence
		evidence_task = {
			"task_type": "check_evidence",
			"frameworks": context["frameworks"],
			"document_type": context["document_type"]
		}
		evidence_result = await self.compliance_agent.process_task(evidence_task)
		results["evidence_collection"] = _to_dict(evidence_result)
		
		# Step 2: Generate content based on available evidence
		if "writer" in agents:
			writer_task = {
				"task_type": "generate_evidence_based_content",
				"requirements": context["source_requirements"],
				"evidence": evidence_result.content,
				"frameworks": context["frameworks"]
			}
			writer_result = await agents["writer"].process_task(writer_task)
			results["evidence_driven_generation"]["content"] = writer_result.content
		
		# Step 3: Identify evidence gaps and address them
		gap_task = {
			"task_type": "identify_gaps",
			"frameworks": context["frameworks"],
			"document_content": results["evidence_driven_generation"].get("content", "")
		}
		gap_result = await self.compliance_agent.process_task(gap_task)
		results["evidence_driven_generation"]["gaps"] = gap_result.content
		
		results["final_document"] = results["evidence_driven_generation"].get("content", "")
		
		return results
	
	async def _aggregate_with_compliance(
		self,
		parallel_results: Dict[str, Any],
		frameworks: List[str]
	) -> str:
		"""Aggregate parallel results with compliance awareness"""
		
		# Extract content from parallel results
		contents = []
		for result in parallel_results.values():
			if "content" in result:
				contents.append(result["content"])
		
		# Use compliance agent to intelligently merge content
		aggregation_task = {
			"task_type": "aggregate_compliant_content",
			"contents": contents,
			"frameworks": frameworks
		}
		
		aggregation_result = await self.compliance_agent.process_task(aggregation_task)
		return aggregation_result.content
	
	def _passes_compliance_gate(self, check_result: Any, gate_type: str) -> bool:
		"""Check if compliance gate passes"""
		
		if gate_type == "requirements":
			# Requirements gate passes if basic requirements are identified
			return check_result.status == AgentStatus.COMPLETED
		
		elif gate_type in ["content", "final"]:
			# Content gates require minimum compliance score
			score = check_result.metadata.get("overall_score", 0)
			critical_violations = check_result.metadata.get("validation_result", {}).get("critical_violations", 0)
			
			return score >= 85.0 and critical_violations == 0
		
		return False
	
	async def get_orchestration_metrics(self) -> Dict[str, Any]:
		"""Get metrics about compliance-aware orchestration performance"""
		
		return {
			"coordination_patterns": list(self.coordination_patterns.keys()),
			"compliance_integration": "enabled",
			"evidence_management": "enabled",
			"real_time_validation": "enabled",
			"last_updated": datetime.now().isoformat()
		}