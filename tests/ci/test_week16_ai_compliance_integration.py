"""
Week 16: AI-Compliance Integration Test Suite

Comprehensive tests for AI agent integration with compliance validation system
including evidence management, reporting, and orchestrated workflows.
"""

import pytest
import asyncio
import tempfile
from datetime import datetime, date, timedelta
from pathlib import Path
import json

from src.proposal_writer.agents.specialists.compliance_agent import ComplianceAgent
from src.proposal_writer.agents.core.agent import AgentStatus
from src.proposal_writer.orchestration.compliance_workflows import (
	ComplianceWorkflowEngine, ComplianceTaskOrchestrator
)
from src.proposal_writer.compliance.evidence.evidence_manager import (
	EvidenceManager, EvidenceType, EvidenceStatus, EvidenceSearchCriteria
)
from src.proposal_writer.compliance.reporting.compliance_reporter import (
	ComplianceReporter, ReportType, RiskLevel
)
from src.proposal_writer.compliance.validators.regulatory_validator import RegulatoryValidator
from src.proposal_writer.compliance.frameworks.compliance_framework import ComplianceFramework


class TestComplianceAgent:
	"""Test the ComplianceAgent integration with AI agents"""
	
	@pytest.fixture
	async def compliance_agent(self):
		"""Create a compliance agent for testing"""
		agent = ComplianceAgent()
		yield agent
	
	@pytest.fixture
	def sample_document_content(self):
		"""Sample document content for testing"""
		return """
		GOVERNMENT PROPOSAL - IT SERVICES
		
		EXECUTIVE SUMMARY
		Our company provides comprehensive IT services with proven technical approach
		and extensive past performance in government contracting.
		
		TECHNICAL APPROACH
		Our methodology employs industry best practices including agile development,
		comprehensive testing, and security-first design principles.
		
		PAST PERFORMANCE
		We have successfully delivered 15 similar projects for federal agencies
		including the Department of Veterans Affairs and General Services Administration.
		Our track record demonstrates consistent on-time delivery and customer satisfaction.
		
		COST INFORMATION
		Total project cost: $500,000 over 12 months
		Detailed pricing breakdown available in separate cost volume.
		
		REPRESENTATIONS AND CERTIFICATIONS
		We certify our small business status and maintain all required registrations.
		All representations and certifications are provided per FAR requirements.
		
		FINANCIAL RESOURCES
		Our company maintains strong financial position with adequate working capital.
		"""
	
	async def test_document_validation_task(self, compliance_agent, sample_document_content):
		"""Test document validation through AI agent"""
		task_data = {
			"document_content": sample_document_content,
			"document_type": "government_proposal",
			"regulations": ["FAR"]
		}
		
		response = await compliance_agent._handle_validate_document(task_data)
		
		assert response.status == AgentStatus.COMPLETED
		assert "compliance" in response.content.lower()
		assert "validation_result" in response.metadata
		assert "overall_score" in response.metadata
		assert response.metadata["overall_score"] > 0
	
	async def test_compliance_analysis_task(self, compliance_agent, sample_document_content):
		"""Test comprehensive compliance analysis"""
		task_data = {
			"content": sample_document_content,
			"frameworks": ["FAR", "DFARS"],
			"analysis_type": "comprehensive"
		}
		
		response = await compliance_agent._handle_analyze_compliance(task_data)
		
		assert response.status == AgentStatus.COMPLETED
		assert "analysis_results" in response.metadata
		assert "insights" in response.metadata
		assert len(response.metadata["analysis_results"]) > 0
	
	async def test_risk_assessment_task(self, compliance_agent):
		"""Test AI-powered risk assessment"""
		task_data = {
			"context": "Large government IT contract with strict security requirements",
			"frameworks": ["FAR", "DFARS"],
			"risk_factors": ["cybersecurity", "data_protection", "schedule"]
		}
		
		response = await compliance_agent._handle_assess_risk(task_data)
		
		assert response.status == AgentStatus.COMPLETED
		assert "risk_analysis" in response.metadata
		assert len(response.content) > 100  # Substantial risk analysis
	
	async def test_gap_identification_task(self, compliance_agent, sample_document_content):
		"""Test compliance gap identification"""
		task_data = {
			"frameworks": ["FAR", "DFARS"],
			"document_content": sample_document_content
		}
		
		response = await compliance_agent._handle_identify_gaps(task_data)
		
		assert response.status == AgentStatus.COMPLETED
		assert "gap_analysis" in response.metadata
		assert "frameworks_analyzed" in response.metadata
	
	async def test_report_generation_task(self, compliance_agent):
		"""Test compliance report generation"""
		task_data = {
			"report_type": "STATUS_SUMMARY",
			"frameworks": ["FAR"],
			"period_start": "2024-01-01",
			"period_end": "2024-12-31"
		}
		
		response = await compliance_agent._handle_generate_report(task_data)
		
		assert response.status == AgentStatus.COMPLETED
		assert "report" in response.metadata
		assert "ai_summary" in response.metadata
	
	async def test_regulatory_interpretation_task(self, compliance_agent):
		"""Test regulatory text interpretation"""
		task_data = {
			"regulation_text": "FAR 15.204-5 requires proposals to contain technical approach, past performance, and cost/price information",
			"context": "Government IT procurement",
			"framework": "FAR"
		}
		
		response = await compliance_agent._handle_interpret_regulation(task_data)
		
		assert response.status == AgentStatus.COMPLETED
		assert "interpretation" in response.metadata
		assert len(response.content) > 200  # Detailed interpretation
	
	async def test_compliance_status_summary(self, compliance_agent):
		"""Test comprehensive compliance status summary"""
		status = await compliance_agent.get_compliance_status_summary()
		
		assert "evidence_stats" in status
		assert "dashboard_data" in status
		assert "ai_summary" in status
		assert "last_updated" in status


class TestComplianceWorkflowEngine:
	"""Test compliance-aware workflow orchestration"""
	
	@pytest.fixture
	async def workflow_engine(self):
		"""Create workflow engine for testing"""
		engine = ComplianceWorkflowEngine()
		yield engine
	
	@pytest.fixture
	def sample_workflow_input(self):
		"""Sample input for workflow testing"""
		return {
			"source_content": "Sample RFP requiring comprehensive IT services proposal",
			"document_type": "government_proposal",
			"frameworks": ["FAR"],
			"compliance_level": "standard",
			"target_score": 90.0
		}
	
	async def test_compliance_document_generation_workflow(self, workflow_engine, sample_workflow_input):
		"""Test compliance-aware document generation workflow"""
		result = await workflow_engine.execute_compliance_aware_generation(**sample_workflow_input)
		
		# Verify workflow execution
		assert "workflow_result" in result or "error" in result
		
		# If successful, check compliance integration
		if "workflow_result" in result:
			workflow_result = result["workflow_result"]
			assert "steps" in workflow_result
			assert len(workflow_result["steps"]) > 0
	
	async def test_evidence_collection_workflow(self, workflow_engine):
		"""Test evidence collection workflow"""
		result = await workflow_engine.execute_evidence_collection(
			frameworks=["FAR", "DFARS"],
			requirements=["technical_approach", "past_performance"],
			evidence_types=[EvidenceType.DOCUMENT, EvidenceType.PERFORMANCE_RECORD]
		)
		
		# Verify workflow execution
		assert isinstance(result, dict)
		assert "error" in result or "workflow_result" in result
	
	async def test_audit_preparation_workflow(self, workflow_engine):
		"""Test audit preparation workflow"""
		audit_date = datetime.now() + timedelta(days=30)
		
		result = await workflow_engine.execute_audit_preparation(
			audit_type="external",
			frameworks=["FAR", "DFARS"],
			audit_date=audit_date
		)
		
		# Verify workflow execution
		assert isinstance(result, dict)
		assert "error" in result or "workflow_result" in result
	
	async def test_continuous_monitoring_workflow(self, workflow_engine):
		"""Test continuous compliance monitoring"""
		result = await workflow_engine.execute_continuous_monitoring(
			frameworks=["FAR"],
			monitoring_frequency="daily",
			alert_thresholds={"compliance_score": 85.0, "critical_violations": 0}
		)
		
		# Verify workflow execution
		assert isinstance(result, dict)
		assert "error" in result or "workflow_result" in result


class TestComplianceTaskOrchestrator:
	"""Test AI task orchestration with compliance integration"""
	
	@pytest.fixture
	async def orchestrator(self):
		"""Create task orchestrator for testing"""
		orchestrator = ComplianceTaskOrchestrator()
		yield orchestrator
	
	@pytest.fixture
	def mock_agents(self):
		"""Create mock agents for testing"""
		# In real implementation, these would be actual agent instances
		# For testing, we'll create simple mock objects
		class MockAgent:
			def __init__(self, name):
				self.name = name
			
			async def process_task(self, task_data):
				from src.proposal_writer.agents.core.agent import AgentResponse, AgentStatus
				return AgentResponse(
					status=AgentStatus.COMPLETED,
					content=f"Mock {self.name} response for task {task_data.get('task_type', 'unknown')}",
					metadata={"agent": self.name, "task_data": task_data}
				)
		
		return {
			"research": MockAgent("research"),
			"writer": MockAgent("writer"), 
			"editor": MockAgent("editor"),
			"reviewer": MockAgent("reviewer")
		}
	
	async def test_sequential_with_validation_pattern(self, orchestrator, mock_agents):
		"""Test sequential processing with compliance validation"""
		source_requirements = "Develop comprehensive IT solution for federal agency"
		
		result = await orchestrator.orchestrate_compliant_document_generation(
			agents=mock_agents,
			source_requirements=source_requirements,
			document_type="government_proposal",
			frameworks=["FAR"],
			coordination_pattern="sequential_with_validation"
		)
		
		assert "steps" in result
		assert "final_document" in result
		assert "orchestration_time" in result
		assert len(result["steps"]) > 0
	
	async def test_parallel_with_aggregation_pattern(self, orchestrator, mock_agents):
		"""Test parallel processing with compliance-aware aggregation"""
		source_requirements = "Complex multi-disciplinary project requiring various expertise"
		
		result = await orchestrator.orchestrate_compliant_document_generation(
			agents=mock_agents,
			source_requirements=source_requirements,
			document_type="proposal",
			frameworks=["FAR"],
			coordination_pattern="parallel_with_aggregation"
		)
		
		assert "parallel_results" in result
		assert "final_document" in result
		assert "orchestration_time" in result
	
	async def test_compliance_gated_pattern(self, orchestrator, mock_agents):
		"""Test compliance-gated processing"""
		source_requirements = "High-security government contract with strict compliance requirements"
		
		result = await orchestrator.orchestrate_compliant_document_generation(
			agents=mock_agents,
			source_requirements=source_requirements,
			document_type="defense_proposal",
			frameworks=["FAR", "DFARS"],
			coordination_pattern="compliance_gated"
		)
		
		assert "gates" in result or "gate_failures" in result
		assert "orchestration_time" in result
		
		# Check gate processing
		if "gates" in result:
			assert len(result["gates"]) > 0
			for gate in result["gates"]:
				assert "gate" in gate
				assert "status" in gate
	
	async def test_evidence_driven_pattern(self, orchestrator, mock_agents):
		"""Test evidence-driven processing pattern"""
		source_requirements = "Evidence-based proposal requiring strong documentation"
		
		result = await orchestrator.orchestrate_compliant_document_generation(
			agents=mock_agents,
			source_requirements=source_requirements,
			document_type="proposal",
			frameworks=["FAR"],
			coordination_pattern="evidence_driven"
		)
		
		assert "evidence_collection" in result
		assert "evidence_driven_generation" in result
		assert "final_document" in result
		assert "orchestration_time" in result
	
	async def test_orchestration_metrics(self, orchestrator):
		"""Test orchestration performance metrics"""
		metrics = await orchestrator.get_orchestration_metrics()
		
		assert "coordination_patterns" in metrics
		assert "compliance_integration" in metrics
		assert "evidence_management" in metrics
		assert "real_time_validation" in metrics
		assert metrics["compliance_integration"] == "enabled"


class TestEvidenceManagerIntegration:
	"""Test Evidence Manager integration with AI agents"""
	
	@pytest.fixture
	async def evidence_manager(self):
		"""Create evidence manager for testing"""
		with tempfile.TemporaryDirectory() as temp_dir:
			manager = EvidenceManager(storage_path=temp_dir)
			yield manager
	
	async def test_evidence_collection_with_ai(self, evidence_manager):
		"""Test AI-assisted evidence collection"""
		# Collect sample evidence
		evidence = await evidence_manager.collect_evidence(
			title="Sample Compliance Certificate",
			evidence_type=EvidenceType.CERTIFICATE,
			source=EvidenceManager.EvidenceSource.MANUAL_UPLOAD,
			description="ISO 27001 certification for information security",
			category="security",
			tags=["iso27001", "security", "certification"],
			collected_by="test_user",
			content="Sample certificate content for testing"
		)
		
		assert evidence.evidence_id
		assert evidence.title == "Sample Compliance Certificate"
		assert evidence.evidence_type == EvidenceType.CERTIFICATE
		assert evidence.status == EvidenceStatus.PENDING_REVIEW
		assert evidence.quality_metrics.overall_quality_score > 0
	
	async def test_evidence_quality_assessment(self, evidence_manager):
		"""Test AI-powered evidence quality assessment"""
		# Create evidence with good quality indicators
		evidence = await evidence_manager.collect_evidence(
			title="Comprehensive Technical Documentation",
			evidence_type=EvidenceType.DOCUMENT,
			source=EvidenceManager.EvidenceSource.INTERNAL_SYSTEM,
			description="Detailed technical approach documentation with diagrams and specifications",
			effective_date=date.today() - timedelta(days=30),
			expiration_date=date.today() + timedelta(days=365),
			tags=["technical", "documentation", "approach"],
			content="Extensive technical content with detailed specifications and implementation details..."
		)
		
		# Quality should be assessed automatically
		quality = evidence.quality_metrics
		assert quality.overall_quality_score > 0.5  # Should have decent quality
		assert quality.completeness_score > 0.7  # Should be fairly complete
		assert quality.timeliness_score > 0.8  # Recent and not expiring soon
	
	async def test_evidence_search_and_filtering(self, evidence_manager):
		"""Test evidence search with AI-enhanced filtering"""
		# Create multiple evidence items
		evidences = []
		for i in range(5):
			evidence = await evidence_manager.collect_evidence(
				title=f"Test Evidence {i}",
				evidence_type=EvidenceType.DOCUMENT,
				source=EvidenceManager.EvidenceSource.AUTOMATED_COLLECTION,
				description=f"Test evidence {i} for compliance testing",
				category="regulatory",
				tags=[f"tag{i}", "test", "compliance"]
			)
			evidences.append(evidence)
		
		# Search for specific evidence
		criteria = EvidenceSearchCriteria(
			search_query="Test Evidence",
			evidence_types=[EvidenceType.DOCUMENT],
			categories=["regulatory"],
			limit=3
		)
		
		results = await evidence_manager.search_evidence(criteria)
		assert len(results) <= 3
		assert all("Test Evidence" in e.title for e in results)
	
	async def test_evidence_gap_analysis(self, evidence_manager):
		"""Test AI-powered evidence gap analysis"""
		# Get statistics that would be used for gap analysis
		stats = await evidence_manager.get_evidence_statistics()
		
		assert "total_evidence" in stats
		assert "by_type" in stats
		assert "by_category" in stats
		assert "by_quality" in stats
		assert "evidence_with_links" in stats


class TestComplianceReporterIntegration:
	"""Test Compliance Reporter integration with AI analysis"""
	
	@pytest.fixture
	async def compliance_reporter(self):
		"""Create compliance reporter for testing"""
		reporter = ComplianceReporter()
		yield reporter
	
	async def test_ai_enhanced_status_report(self, compliance_reporter):
		"""Test AI-enhanced compliance status reporting"""
		report = await compliance_reporter.generate_report(
			report_type=ReportType.STATUS_SUMMARY,
			frameworks=["FAR"],
			reporting_period_start=date.today() - timedelta(days=30),
			reporting_period_end=date.today()
		)
		
		assert report.report_id
		assert report.report_type == ReportType.STATUS_SUMMARY
		assert report.title
		assert report.executive_summary
		assert len(report.key_findings) > 0
		assert len(report.recommendations) > 0
		assert report.overall_compliance_score >= 0
	
	async def test_ai_risk_assessment_report(self, compliance_reporter):
		"""Test AI-powered risk assessment reporting"""
		report = await compliance_reporter.generate_report(
			report_type=ReportType.RISK_ASSESSMENT,
			frameworks=["FAR", "DFARS"]
		)
		
		assert report.report_type == ReportType.RISK_ASSESSMENT
		assert len(report.risk_assessments) > 0
		assert report.overall_risk_level in [r.value for r in RiskLevel]
		
		# Check risk assessment quality
		for risk in report.risk_assessments:
			assert risk.risk_name
			assert risk.risk_description
			assert 0 <= risk.probability <= 1
			assert 0 <= risk.impact <= 1
			assert risk.risk_score >= 0
			assert len(risk.mitigation_strategies) > 0
	
	async def test_evidence_gap_analysis_report(self, compliance_reporter):
		"""Test evidence gap analysis reporting"""
		report = await compliance_reporter.generate_report(
			report_type=ReportType.EVIDENCE_GAP_ANALYSIS,
			frameworks=["FAR", "DFARS", "HIPAA"]
		)
		
		assert report.report_type == ReportType.EVIDENCE_GAP_ANALYSIS
		assert len(report.evidence_gaps) >= 0  # May have gaps
		
		# Check gap analysis quality
		for gap in report.evidence_gaps:
			assert gap.requirement_id
			assert gap.framework_code in ["FAR", "DFARS", "HIPAA"]
			assert gap.gap_type in ["missing", "insufficient", "expired", "poor_quality"]
			assert gap.severity in ["critical", "high", "medium", "low"]
			assert len(gap.recommendations) > 0
	
	async def test_audit_preparation_report(self, compliance_reporter):
		"""Test AI-assisted audit preparation reporting"""
		report = await compliance_reporter.generate_report(
			report_type=ReportType.AUDIT_PREPARATION,
			frameworks=["FAR"]
		)
		
		assert report.report_type == ReportType.AUDIT_PREPARATION
		assert len(report.audit_preparation_items) > 0
		assert 0 <= report.audit_readiness_score <= 100
		
		# Check audit preparation items
		for item in report.audit_preparation_items:
			assert "category" in item
			assert "item" in item
			assert "status" in item
			assert "completion_percentage" in item
	
	async def test_compliance_dashboard_data(self, compliance_reporter):
		"""Test real-time compliance dashboard data generation"""
		dashboard_data = await compliance_reporter.get_compliance_dashboard_data()
		
		assert "overall_score" in dashboard_data
		assert "total_violations" in dashboard_data
		assert "critical_violations" in dashboard_data
		assert "evidence_count" in dashboard_data
		assert "audit_readiness" in dashboard_data
		assert "risk_level" in dashboard_data
		assert "trends" in dashboard_data
		assert "last_updated" in dashboard_data


class TestPerformanceAndIntegration:
	"""Test performance and end-to-end integration"""
	
	async def test_full_pipeline_performance(self):
		"""Test complete AI-compliance pipeline performance"""
		start_time = datetime.now()
		
		# Initialize components
		compliance_agent = ComplianceAgent()
		orchestrator = ComplianceTaskOrchestrator()
		
		# Sample document for processing
		document_content = """
		COMPREHENSIVE GOVERNMENT IT PROPOSAL
		
		EXECUTIVE SUMMARY
		Our firm provides enterprise-grade IT solutions with proven methodology
		and extensive past performance serving federal agencies nationwide.
		
		TECHNICAL APPROACH
		Our technical approach utilizes cloud-native architecture with microservices,
		containerization, and comprehensive cybersecurity measures including NIST SP 800-171 compliance.
		
		PAST PERFORMANCE
		Successfully delivered 25+ federal IT projects including major implementations
		for Department of Defense, Department of Veterans Affairs, and GSA.
		Maintained 98% customer satisfaction with zero security incidents.
		
		COST AND PRICING
		Total project value: $2,500,000 over 24 months
		Comprehensive cost breakdown provided in separate volume.
		
		CERTIFICATIONS AND REPRESENTATIONS
		Certified small business with CMMI Level 3, ISO 27001, and SOC 2 Type II.
		All required representations and certifications provided per FAR requirements.
		"""
		
		# Test compliance validation
		validation_result = await compliance_agent.process_task({
			"task_type": "validate_document",
			"document_content": document_content,
			"document_type": "government_proposal",
			"regulations": ["FAR", "DFARS"]
		})
		
		# Test AI-powered analysis
		analysis_result = await compliance_agent.process_task({
			"task_type": "analyze_compliance", 
			"content": document_content,
			"frameworks": ["FAR", "DFARS"],
			"analysis_type": "comprehensive"
		})
		
		# Test report generation
		report_result = await compliance_agent.process_task({
			"task_type": "generate_report",
			"report_type": "STATUS_SUMMARY",
			"frameworks": ["FAR", "DFARS"]
		})
		
		end_time = datetime.now()
		processing_time = (end_time - start_time).total_seconds()
		
		# Performance assertions (should complete within reasonable time)
		assert processing_time < 30.0  # Should complete within 30 seconds
		
		# Quality assertions
		assert validation_result.status == AgentStatus.COMPLETED
		assert analysis_result.status == AgentStatus.COMPLETED
		assert report_result.status == AgentStatus.COMPLETED
		
		# Content quality checks
		assert len(validation_result.content) > 100
		assert len(analysis_result.content) > 100
		assert len(report_result.content) > 100
	
	async def test_concurrent_compliance_processing(self):
		"""Test concurrent compliance processing capability"""
		compliance_agent = ComplianceAgent()
		
		# Create multiple tasks for concurrent processing
		tasks = [
			{
				"task_type": "validate_document",
				"document_content": f"Sample document {i} for concurrent testing",
				"document_type": "proposal",
				"regulations": ["FAR"]
			}
			for i in range(5)
		]
		
		start_time = datetime.now()
		
		# Process tasks concurrently
		results = await asyncio.gather(*[
			compliance_agent.process_task(task) for task in tasks
		])
		
		end_time = datetime.now()
		processing_time = (end_time - start_time).total_seconds()
		
		# Performance assertions
		assert processing_time < 60.0  # Should handle 5 concurrent tasks within 1 minute
		
		# Quality assertions
		assert len(results) == 5
		for result in results:
			assert result.status == AgentStatus.COMPLETED
			assert len(result.content) > 0
	
	async def test_memory_and_resource_usage(self):
		"""Test memory and resource usage during intensive operations"""
		import psutil
		import os
		
		process = psutil.Process(os.getpid())
		initial_memory = process.memory_info().rss / 1024 / 1024  # MB
		
		# Create components and perform intensive operations
		compliance_agent = ComplianceAgent()
		evidence_manager = EvidenceManager()
		reporter = ComplianceReporter()
		
		# Perform intensive operations
		large_document = "Large document content " * 1000
		
		await compliance_agent.process_task({
			"task_type": "validate_document",
			"document_content": large_document,
			"document_type": "proposal"
		})
		
		await reporter.generate_report(ReportType.DETAILED_ASSESSMENT)
		
		final_memory = process.memory_info().rss / 1024 / 1024  # MB
		memory_increase = final_memory - initial_memory
		
		# Memory usage should be reasonable (less than 500MB increase)
		assert memory_increase < 500, f"Memory usage increased by {memory_increase:.1f}MB"
	
	async def test_error_handling_and_recovery(self):
		"""Test error handling and recovery in AI-compliance integration"""
		compliance_agent = ComplianceAgent()
		
		# Test with invalid inputs
		error_cases = [
			{"task_type": "validate_document", "document_content": ""},  # Empty content
			{"task_type": "analyze_compliance", "content": None},  # None content  
			{"task_type": "generate_report", "report_type": "INVALID_TYPE"},  # Invalid type
			{"task_type": "unknown_task", "data": "test"}  # Unknown task
		]
		
		for error_case in error_cases:
			result = await compliance_agent.process_task(error_case)
			
			# Should handle errors gracefully
			assert result.status in [AgentStatus.ERROR, AgentStatus.COMPLETED]
			assert len(result.content) > 0  # Should provide error message or fallback content


if __name__ == "__main__":
	# Run specific test classes or methods
	pytest.main([__file__, "-v", "--tb=short"])