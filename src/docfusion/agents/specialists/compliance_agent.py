"""
Compliance Agent

AI agent specialized for compliance validation, analysis, and reporting.
Integrates with the compliance engine to provide intelligent compliance assistance.
"""

from typing import Any, Dict, List, Optional, Set, Union, Tuple
import asyncio
from datetime import datetime, date
import json

from ..core.agent import Agent, AgentCapability, AgentResponse, AgentStatus
from ...compliance.validators.regulatory_validator import RegulatoryValidator
from ...compliance.reporting.compliance_reporter import ComplianceReport
from ...compliance.validators.format_validator import FormatValidator, FormatReport
from ...compliance.frameworks.compliance_framework import ComplianceFramework
from ...compliance.evidence.evidence_manager import EvidenceManager, EvidenceRecord
from ...compliance.reporting.compliance_reporter import ComplianceReporter, ReportType
from ...document_engine.compliance_integration import DocumentComplianceIntegrator
from ...config.llm_config import LLMConfiguration, LLMTask, get_llm_config
from ...nlp.nlp_service import NLPService


class ComplianceAgent(Agent):
	"""
	Specialized AI agent for compliance validation and analysis.
	
	Provides intelligent compliance assistance including:
	- Document compliance validation
	- Regulatory requirement analysis
	- Evidence gap identification  
	- Compliance report generation
	- Risk assessment and mitigation
	"""
	
	def __init__(
		self,
		name: str = "ComplianceAgent",
		model_config: Optional[Dict[str, Any]] = None,
		**kwargs
	):
		from ..core.agent import AgentCapabilities, AgentConfig

		# Build AgentConfig from legacy kwargs
		config = AgentConfig(
			name=name,
			description="AI agent specialized for compliance validation and analysis",
			primary_role="compliance",
			capabilities=AgentCapabilities(
				expertise_domains=["compliance", "regulatory", "risk_assessment"],
				supported_task_types=["validate_document", "analyze_compliance", "check_evidence", "generate_report"],
				quality_threshold=0.95,
			),
			**kwargs
		)
		# Apply any LLM overrides from model_config
		if model_config:
			for key, value in model_config.items():
				if hasattr(config, key):
					setattr(config, key, value)

		super().__init__(config)
		
		# Initialize compliance components
		self.regulatory_field_validator = RegulatoryValidator()
		self.format_field_validator = FormatValidator()
		self.evidence_manager = EvidenceManager()
		self.compliance_reporter = ComplianceReporter()
		self.compliance_integrator = DocumentComplianceIntegrator()
		self._nlp_service: Optional[NLPService] = None
		self.task_handlers: Dict[str, Any] = {}

		# Compliance-specific system message
		self.system_message = """You are a Compliance Agent specialized in regulatory compliance validation and analysis.

Your expertise includes:
- Federal Acquisition Regulation (FAR) compliance
- Defense Federal Acquisition Regulation Supplement (DFARS)
- Industry regulations (HIPAA, SOX, etc.)
- Document format validation
- Evidence management and gap analysis
- Risk assessment and compliance reporting
- Regulatory requirement interpretation

Your responsibilities:
1. Validate documents against regulatory requirements
2. Identify compliance violations and recommend fixes
3. Analyze evidence sufficiency and quality
4. Generate compliance reports and dashboards
5. Assess compliance risks and mitigation strategies
6. Provide regulatory guidance and interpretation

Always provide:
- Clear compliance assessments
- Specific regulatory citations
- Actionable recommendations
- Risk-based prioritization
- Evidence-backed conclusions

Be thorough, accurate, and focused on regulatory compliance excellence."""

		# Task handlers for compliance operations
		self.task_handlers.update({
			"validate_document": self._handle_validate_document,
			"analyze_compliance": self._handle_analyze_compliance,
			"check_evidence": self._handle_check_evidence,
			"generate_report": self._handle_generate_report,
			"assess_risk": self._handle_assess_risk,
			"identify_gaps": self._handle_identify_gaps,
			"recommend_fixes": self._handle_recommend_fixes,
			"interpret_regulation": self._handle_interpret_regulation
		})

	@property
	def nlp_service(self) -> NLPService:
		if self._nlp_service is None:
			self._nlp_service = NLPService()
		return self._nlp_service

	async def _handle_validate_document(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle document compliance validation"""
		try:
			document_content = task_data.get("document_content", "")
			document_type = task_data.get("document_type", "proposal")
			document_path = task_data.get("document_path")
			regulations = task_data.get("regulations", [])
			
			if not document_content:
				return AgentResponse(
					status=AgentStatus.ERROR,
					content="No document content provided for validation",
					metadata={"error": "missing_content"}
				)
			
			# Perform comprehensive validation
			result = await self.compliance_integrator.validate_document_compliance(
				document_content=document_content,
				document_id=task_data.get("document_id", "validation_temp"),
				document_path=document_path,
				document_type=document_type
			)
			
			# Generate AI analysis of results
			ai_analysis = await self._generate_ai_compliance_analysis(result, document_content)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Document validation completed. Overall compliance: {result.compliance_score:.1f}%\n\n{ai_analysis}",
				metadata={
					"validation_result": result.dict(),
					"ai_analysis": ai_analysis,
					"overall_score": result.compliance_score,
					"violations": result.total_violations
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Validation failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_analyze_compliance(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle comprehensive compliance analysis"""
		try:
			content = task_data.get("content", "")
			frameworks = task_data.get("frameworks", ["FAR"])
			analysis_type = task_data.get("analysis_type", "comprehensive")
			
			# Use NLP service to extract compliance-relevant information
			extracted_requirements = await self.nlp_service.extract_requirements(content)
			
			# Analyze against each framework
			analysis_results = {}
			for framework in frameworks:
				if framework == "FAR":
					report = await self.regulatory_field_validator.validate_document(
						document_content=content,
						document_type="proposal",
						regulations=["FAR"]
					)
					analysis_results[framework] = report
			
			# Generate AI-powered compliance insights
			insights = await self._generate_compliance_insights(analysis_results, extracted_requirements)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Compliance analysis completed for frameworks: {', '.join(frameworks)}\n\n{insights}",
				metadata={
					"analysis_results": {k: v.dict() if hasattr(v, 'dict') else v for k, v in analysis_results.items()},
					"extracted_requirements": extracted_requirements,
					"insights": insights
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Analysis failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_check_evidence(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle evidence sufficiency checking"""
		try:
			requirement_id = task_data.get("requirement_id", "")
			framework_code = task_data.get("framework_code", "")
			
			if not requirement_id:
				return AgentResponse(
					status=AgentStatus.ERROR,
					content="No requirement ID provided for evidence check",
					metadata={"error": "missing_requirement_id"}
				)
			
			# Get evidence for requirement
			evidence_list = await self.evidence_manager.get_evidence_for_requirement(
				requirement_id=requirement_id,
				framework_code=framework_code
			)
			
			# Analyze evidence sufficiency using AI
			ai_assessment = await self._assess_evidence_sufficiency(
				requirement_id, framework_code, evidence_list
			)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Evidence check completed for {requirement_id}\n\n{ai_assessment}",
				metadata={
					"requirement_id": requirement_id,
					"evidence_count": len(evidence_list),
					"evidence_summary": [{"id": e.evidence_id, "type": e.evidence_type.value, "quality": e.quality_metrics.quality_level.value} for e in evidence_list],
					"ai_assessment": ai_assessment
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Evidence check failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_generate_report(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle compliance report generation"""
		try:
			report_type_str = task_data.get("report_type", "STATUS_SUMMARY")
			frameworks = task_data.get("frameworks", [])
			period_start = task_data.get("period_start")
			period_end = task_data.get("period_end")
			
			# Parse report type
			try:
				report_type = ReportType(report_type_str.lower())
			except ValueError:
				report_type = ReportType.STATUS_SUMMARY
			
			# Generate report
			report = await self.compliance_reporter.generate_report(
				report_type=report_type,
				frameworks=frameworks,
				reporting_period_start=period_start,
				reporting_period_end=period_end
			)
			
			# Generate AI summary of report
			ai_summary = await self._generate_report_summary(report)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Compliance report generated: {report.title}\n\n{ai_summary}",
				metadata={
					"report": report.dict(),
					"ai_summary": ai_summary,
					"report_type": report_type.value
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Report generation failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_assess_risk(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle compliance risk assessment"""
		try:
			context = task_data.get("context", "")
			frameworks = task_data.get("frameworks", ["FAR"])
			risk_factors = task_data.get("risk_factors", [])
			
			# Generate risk assessment using AI
			risk_analysis = await self._perform_ai_risk_assessment(
				context, frameworks, risk_factors
			)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Risk assessment completed\n\n{risk_analysis}",
				metadata={
					"risk_analysis": risk_analysis,
					"frameworks_assessed": frameworks,
					"risk_factors": risk_factors
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Risk assessment failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_identify_gaps(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle compliance gap identification"""
		try:
			frameworks = task_data.get("frameworks", ["FAR"])
			document_content = task_data.get("document_content", "")
			
			# Generate comprehensive gap analysis
			gap_analysis = await self._identify_compliance_gaps(frameworks, document_content)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Gap analysis completed for {len(frameworks)} frameworks\n\n{gap_analysis}",
				metadata={
					"gap_analysis": gap_analysis,
					"frameworks_analyzed": frameworks
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Gap identification failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_recommend_fixes(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle compliance fix recommendations"""
		try:
			violations = task_data.get("violations", [])
			context = task_data.get("context", "")
			priority = task_data.get("priority", "all")
			
			# Generate AI-powered fix recommendations
			recommendations = await self._generate_fix_recommendations(
				violations, context, priority
			)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Fix recommendations generated\n\n{recommendations}",
				metadata={
					"recommendations": recommendations,
					"violations_count": len(violations),
					"priority_filter": priority
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Recommendation generation failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _handle_interpret_regulation(
		self,
		task_data: Dict[str, Any]
	) -> AgentResponse:
		"""Handle regulatory interpretation"""
		try:
			regulation_text = task_data.get("regulation_text", "")
			context = task_data.get("context", "")
			framework = task_data.get("framework", "")
			
			if not regulation_text:
				return AgentResponse(
					status=AgentStatus.ERROR,
					content="No regulation text provided for interpretation",
					metadata={"error": "missing_regulation_text"}
				)
			
			# Generate AI interpretation of regulation
			interpretation = await self._interpret_regulation_text(
				regulation_text, context, framework
			)
			
			return AgentResponse(
				status=AgentStatus.COMPLETED,
				content=f"Regulatory interpretation completed\n\n{interpretation}",
				metadata={
					"interpretation": interpretation,
					"regulation_length": len(regulation_text),
					"framework": framework
				}
			)
			
		except Exception as e:
			return AgentResponse(
				status=AgentStatus.ERROR,
				content=f"Regulation interpretation failed: {str(e)}",
				metadata={"error": str(e)}
			)
	
	async def _generate_ai_compliance_analysis(
		self,
		validation_result: Any,
		document_content: str
	) -> str:
		"""Generate AI-powered analysis of compliance validation results"""
		
		prompt = f"""Analyze this compliance validation result and provide insights:

VALIDATION RESULTS:
- Overall Score: {validation_result.compliance_score:.1f}%
- Total Violations: {validation_result.total_violations}
- Critical: {validation_result.critical_violations}
- High: {validation_result.high_violations}
- Medium: {validation_result.medium_violations}
- Low: {validation_result.low_violations}

DOCUMENT LENGTH: {len(document_content)} characters

Please provide:
1. Assessment of compliance posture
2. Priority areas for improvement
3. Risk implications of violations
4. Recommended next steps

Be specific and actionable in your analysis."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to generate AI analysis")
		except Exception as e:
			return f"AI analysis unavailable: {str(e)}"
	
	async def _generate_compliance_insights(
		self,
		analysis_results: Dict[str, Any],
		extracted_requirements: List[str]
	) -> str:
		"""Generate AI-powered compliance insights"""
		
		prompt = f"""Analyze this compliance data and provide strategic insights:

FRAMEWORK ANALYSIS RESULTS:
{json.dumps({k: {"score": getattr(v, "compliance_score", 0), "violations": getattr(v, "violations_found", 0)} for k, v in analysis_results.items()}, indent=2)}

EXTRACTED REQUIREMENTS:
{json.dumps(extracted_requirements[:10], indent=2)}  # First 10 for brevity

Provide insights on:
1. Overall compliance maturity
2. Framework-specific strengths and weaknesses
3. Cross-framework compliance patterns
4. Strategic recommendations for improvement
5. Compliance program effectiveness

Focus on actionable strategic guidance."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to generate compliance insights")
		except Exception as e:
			return f"Compliance insights unavailable: {str(e)}"
	
	async def _assess_evidence_sufficiency(
		self,
		requirement_id: str,
		framework_code: str,
		evidence_list: List[EvidenceRecord]
	) -> str:
		"""AI assessment of evidence sufficiency"""
		
		evidence_summary = []
		for evidence in evidence_list:
			evidence_summary.append({
				"type": evidence.evidence_type.value,
				"quality": evidence.quality_metrics.quality_level.value,
				"effective_date": str(evidence.effective_date) if evidence.effective_date else "unknown",
				"expiration": str(evidence.expiration_date) if evidence.expiration_date else "no expiration",
				"status": evidence.status.value
			})
		
		prompt = f"""Assess the sufficiency of evidence for this compliance requirement:

REQUIREMENT: {requirement_id} ({framework_code})
EVIDENCE COUNT: {len(evidence_list)}

EVIDENCE DETAILS:
{json.dumps(evidence_summary, indent=2)}

Provide assessment on:
1. Evidence sufficiency (sufficient/insufficient)
2. Quality analysis of available evidence
3. Coverage gaps or weaknesses
4. Recommendations for evidence improvement
5. Risk level if evidence is insufficient

Be specific about what additional evidence may be needed."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to assess evidence sufficiency")
		except Exception as e:
			return f"Evidence assessment unavailable: {str(e)}"
	
	async def _generate_report_summary(self, report: Any) -> str:
		"""Generate AI summary of compliance report"""
		
		prompt = f"""Summarize this compliance report with key insights:

REPORT: {report.title}
TYPE: {report.report_type.value}
OVERALL SCORE: {report.overall_compliance_score:.1f}%
FRAMEWORKS: {', '.join(report.frameworks_covered)}
VIOLATIONS: {report.total_violations} (Critical: {report.critical_violations})
EVIDENCE: {report.total_evidence} pieces

KEY FINDINGS:
{chr(10).join(report.key_findings)}

RECOMMENDATIONS:
{chr(10).join(report.recommendations)}

Provide a concise executive summary highlighting:
1. Current compliance status
2. Key risks and concerns
3. Priority actions needed
4. Overall assessment

Keep it strategic and actionable."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to generate report summary")
		except Exception as e:
			return f"Report summary unavailable: {str(e)}"
	
	async def _perform_ai_risk_assessment(
		self,
		context: str,
		frameworks: List[str],
		risk_factors: List[str]
	) -> str:
		"""Perform AI-powered risk assessment"""
		
		prompt = f"""Perform a comprehensive compliance risk assessment:

CONTEXT: {context}
FRAMEWORKS: {', '.join(frameworks)}
RISK FACTORS: {', '.join(risk_factors) if risk_factors else 'General assessment'}

Assess and provide:
1. Primary compliance risks and their likelihood
2. Potential impact of each risk
3. Risk prioritization (Critical/High/Medium/Low)
4. Mitigation strategies for each risk
5. Overall risk posture assessment

Focus on practical, implementable risk management recommendations."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to perform risk assessment")
		except Exception as e:
			return f"Risk assessment unavailable: {str(e)}"
	
	async def _identify_compliance_gaps(
		self,
		frameworks: List[str],
		document_content: str
	) -> str:
		"""AI-powered compliance gap identification"""
		
		prompt = f"""Identify compliance gaps for the specified frameworks:

FRAMEWORKS: {', '.join(frameworks)}
DOCUMENT CONTENT: {document_content[:1000]}{'...' if len(document_content) > 1000 else ''}

Analyze and identify:
1. Missing compliance requirements by framework
2. Insufficient documentation areas
3. Process or control gaps
4. Evidence collection gaps
5. Training or capability gaps

Provide specific, actionable gap closure recommendations with priorities."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to identify compliance gaps")
		except Exception as e:
			return f"Gap identification unavailable: {str(e)}"
	
	async def _generate_fix_recommendations(
		self,
		violations: List[Dict],
		context: str,
		priority: str
	) -> str:
		"""Generate AI-powered fix recommendations"""
		
		prompt = f"""Generate specific fix recommendations for these compliance violations:

VIOLATIONS: {json.dumps(violations, indent=2)}
CONTEXT: {context}
PRIORITY FILTER: {priority}

For each violation, provide:
1. Root cause analysis
2. Specific corrective actions
3. Implementation timeline
4. Resources required
5. Prevention measures

Prioritize recommendations based on risk and implementation feasibility."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to generate fix recommendations")
		except Exception as e:
			return f"Fix recommendations unavailable: {str(e)}"
	
	async def _interpret_regulation_text(
		self,
		regulation_text: str,
		context: str,
		framework: str
	) -> str:
		"""AI interpretation of regulatory text"""
		
		prompt = f"""Interpret this regulatory text in practical terms:

FRAMEWORK: {framework}
REGULATION TEXT: {regulation_text}
CONTEXT: {context}

Provide interpretation including:
1. Plain language summary of requirements
2. Key compliance obligations
3. Implementation guidance
4. Common compliance pitfalls
5. Best practices for adherence

Make the interpretation practical and actionable for compliance professionals."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to interpret regulation")
		except Exception as e:
			return f"Regulation interpretation unavailable: {str(e)}"
	
	async def get_compliance_status_summary(self) -> Dict[str, Any]:
		"""Get comprehensive compliance status summary"""
		try:
			# Get evidence statistics
			evidence_stats = await self.evidence_manager.get_evidence_statistics()
			
			# Get dashboard data
			dashboard_data = await self.compliance_reporter.get_compliance_dashboard_data()
			
			# Generate AI-powered status summary
			ai_summary = await self._generate_status_summary(evidence_stats, dashboard_data)
			
			return {
				"evidence_stats": evidence_stats,
				"dashboard_data": dashboard_data,
				"ai_summary": ai_summary,
				"last_updated": datetime.now().isoformat()
			}
			
		except Exception as e:
			return {
				"error": f"Failed to get compliance status: {str(e)}",
				"last_updated": datetime.now().isoformat()
			}
	
	async def check_draft_against_matrix(
		self,
		draft_sections: Dict[str, str],
		matrix: Any,
	) -> Dict[str, Any]:
		"""Check a proposal draft against a compliance matrix.

		For each requirement in the matrix, verify that its requirement_text
		(or a key phrase extracted from it) appears in at least one draft section.
		Returns a diff report with coverage summary and per-requirement results.
		"""
		full_draft = "\n".join(draft_sections.values())
		mappings = getattr(matrix, "mappings", [])
		results: List[Dict[str, Any]] = []
		covered = 0

		for mapping in mappings:
			req_text = getattr(mapping, "requirement_text", "") or ""
			# Extract key phrase (first 20 chars or a significant word)
			key_phrase = req_text[:60].strip() if req_text else ""
			found = bool(key_phrase and key_phrase.lower() in full_draft.lower())
			if found:
				covered += 1

			results.append({
				"requirement_id": getattr(mapping, "requirement_id", ""),
				"requirement_text": req_text[:200],
				"category": getattr(getattr(mapping, "category", None), "value", "general"),
				"found": found,
			})

		total = len(mappings) or 1
		return {
			"total_requirements": len(mappings),
			"covered": covered,
			"missing": len(mappings) - covered,
			"coverage_ratio": round(covered / total, 3),
			"results": results,
		}

	async def _generate_status_summary(
		self,
		evidence_stats: Dict[str, Any],
		dashboard_data: Dict[str, Any]
	) -> str:
		"""Generate AI-powered compliance status summary"""
		
		prompt = f"""Generate a concise compliance status summary:

EVIDENCE STATISTICS:
{json.dumps(evidence_stats, indent=2)}

DASHBOARD DATA:
{json.dumps(dashboard_data, indent=2)}

Provide a brief executive summary covering:
1. Overall compliance health
2. Key metrics and trends
3. Areas needing attention
4. Recommended actions

Keep it concise but informative for leadership consumption."""

		try:
			response = await self.llm_client.query(prompt, system_message=self.system_message)
			return response.get("response", "Unable to generate status summary")
		except Exception as e:
			return f"Status summary unavailable: {str(e)}"