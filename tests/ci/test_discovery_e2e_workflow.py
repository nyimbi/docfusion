"""
End-to-End Discovery Workflow Tests

This module provides comprehensive end-to-end tests for the complete
opportunity discovery workflow, integrating all components and services.
"""

import asyncio
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any

from docfusion.discovery.models.opportunity_models import OpportunityData
from docfusion.discovery.analyzers.opportunity_analyzer import OpportunityAnalyzer
from docfusion.discovery.analyzers.qualification_analyzer import (
	QualificationAnalyzer, OrganizationalCapabilities
)
from docfusion.discovery.matchers.capability_matcher import CapabilityMatcher
from docfusion.discovery.matchers.relevance_filter import RelevanceFilter, OpportunityContext
from docfusion.intelligence.analyzers.competitive_analyzer import CompetitiveAnalyzer
from docfusion.discovery.integrations.nlp_integration import (
	DiscoveryNLPService, NLPAnalysisRequest, AnalyzerNLPIntegration
)
from docfusion.discovery.integrations.storage_integration import (
	DiscoveryStorageService, OpportunitySearchCriteria
)
from docfusion.discovery.integrations.notification_service import OpportunityNotificationService


class DiscoveryWorkflowOrchestrator:
	"""
	Orchestrator for complete discovery workflow
	
	Manages the end-to-end process of opportunity discovery, analysis,
	qualification, filtering, and notification.
	"""
	
	def __init__(self):
		# Initialize all service components
		self.opportunity_analyzer = OpportunityAnalyzer()
		self.qualification_analyzer = QualificationAnalyzer()
		self.capability_matcher = CapabilityMatcher()
		self.relevance_filter = RelevanceFilter()
		self.competitive_analyzer = CompetitiveAnalyzer()
		
		# Integration services
		self.nlp_service = DiscoveryNLPService()
		self.storage_service = DiscoveryStorageService()
		self.notification_service = OpportunityNotificationService()
		
		# NLP integration helper
		self.nlp_integration = AnalyzerNLPIntegration(self.nlp_service)
		
		# Workflow statistics
		self.processed_opportunities = 0
		self.successful_analyses = 0
		self.failed_analyses = 0
	
	async def process_opportunity_workflow(self, opportunity_data: OpportunityData,
	                                       org_capabilities: OrganizationalCapabilities) -> Dict[str, Any]:
		"""
		Execute complete opportunity discovery workflow
		
		Args:
			opportunity_data: Raw opportunity data
			org_capabilities: Organizational capabilities profile
			
		Returns:
			Complete workflow results
		"""
		workflow_start = datetime.now()
		workflow_results = {
			'opportunity_id': opportunity_data.id,
			'workflow_stages': {},
			'errors': [],
			'processing_time': 0.0,
			'success': False
		}
		
		try:
			self.processed_opportunities += 1
			
			# Stage 1: NLP Enhancement
			print(f"🔍 Starting workflow for opportunity: {opportunity_data.title}")
			
			stage_start = datetime.now()
			enhanced_data = await self.nlp_integration.enhance_opportunity_analyzer(
				self.opportunity_analyzer, opportunity_data
			)
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['nlp_enhancement'] = {
				'success': True,
				'processing_time': stage_time,
				'insights': {
					'requirements_count': len(enhanced_data.get('extracted_requirements', [])),
					'technologies_count': len(enhanced_data.get('required_technologies', [])),
					'themes_count': len(enhanced_data.get('key_themes', []))
				}
			}
			print(f"✅ NLP Enhancement completed ({stage_time:.2f}s)")
			
			# Stage 2: Opportunity Analysis
			stage_start = datetime.now()
			opportunity_analysis = await self.opportunity_analyzer.analyze_opportunity(
				opportunity_data, enhanced_data
			)
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['opportunity_analysis'] = {
				'success': True,
				'processing_time': stage_time,
				'results': {
					'opportunity_type': opportunity_analysis.classification.type,
					'complexity_level': opportunity_analysis.classification.complexity,
					'strategic_score': opportunity_analysis.strategic_alignment
				}
			}
			print(f"✅ Opportunity Analysis completed ({stage_time:.2f}s)")
			
			# Stage 3: Qualification Analysis
			stage_start = datetime.now()
			qualification_assessment = await self.qualification_analyzer.analyze_qualification(
				opportunity_data, org_capabilities
			)
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['qualification_analysis'] = {
				'success': True,
				'processing_time': stage_time,
				'results': {
					'qualification_level': qualification_assessment.qualification_level,
					'match_score': qualification_assessment.overall_match_score,
					'win_probability': qualification_assessment.win_probability,
					'gaps_count': len(qualification_assessment.qualification_gaps)
				}
			}
			print(f"✅ Qualification Analysis completed ({stage_time:.2f}s)")
			
			# Stage 4: Capability Matching
			stage_start = datetime.now()
			requirements = enhanced_data.get('extracted_requirements', [])
			org_caps_dict = {
				**org_capabilities.core_competencies,
				**org_capabilities.technical_skills
			}
			
			capability_results = await self.capability_matcher.match_capabilities(
				requirements, org_caps_dict, {'opportunity_id': opportunity_data.id}
			)
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['capability_matching'] = {
				'success': True,
				'processing_time': stage_time,
				'results': {
					'overall_match_score': capability_results.overall_match_score,
					'coverage_percentage': capability_results.coverage_percentage,
					'strong_matches': len(capability_results.strong_matches),
					'weak_matches': len(capability_results.weak_matches)
				}
			}
			print(f"✅ Capability Matching completed ({stage_time:.2f}s)")
			
			# Stage 5: Competitive Analysis
			stage_start = datetime.now()
			org_profile = {
				'capabilities': org_caps_dict,
				'employee_count': sum(org_capabilities.team_composition.values()),
				'years_in_business': 10  # Sample data
			}
			
			competitive_analysis = await self.competitive_analyzer.analyze_competition(
				opportunity_data, org_profile
			)
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['competitive_analysis'] = {
				'success': True,
				'processing_time': stage_time,
				'results': {
					'competitors_identified': len(competitive_analysis.identified_competitors),
					'competitive_intensity': competitive_analysis.competitive_positioning.competitive_intensity,
					'our_rank': competitive_analysis.competitive_positioning.our_rank,
					'primary_threats': len(competitive_analysis.competitive_positioning.primary_threats)
				}
			}
			print(f"✅ Competitive Analysis completed ({stage_time:.2f}s)")
			
			# Stage 6: Relevance Filtering
			stage_start = datetime.now()
			opportunity_context = OpportunityContext(
				opportunity_data=opportunity_data,
				opportunity_analysis=opportunity_analysis,
				qualification_assessment=qualification_assessment,
				strategic_priority=opportunity_analysis.strategic_alignment
			)
			
			filtering_results = await self.relevance_filter.filter_opportunities(
				[opportunity_context], 'balanced'
			)
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['relevance_filtering'] = {
				'success': True,
				'processing_time': stage_time,
				'results': {
					'passed_filtering': len(filtering_results.passed_opportunities) > 0,
					'overall_score': filtering_results.average_score,
					'recommended': len(filtering_results.recommended_opportunities) > 0
				}
			}
			print(f"✅ Relevance Filtering completed ({stage_time:.2f}s)")
			
			# Stage 7: Storage Persistence
			stage_start = datetime.now()
			
			# Store opportunity
			store_result = await self.storage_service.store_opportunity(
				opportunity_data, {'workflow_id': f"wf_{opportunity_data.id}"}
			)
			
			# Store all analyses
			analysis_results = []
			if store_result.success:
				analyses_to_store = [
					('opportunity_analysis', opportunity_analysis),
					('qualification_assessment', qualification_assessment),
					('competitive_analysis', competitive_analysis)
				]
				
				for analysis_type, analysis_data in analyses_to_store:
					result = await self.storage_service.store_analysis(
						opportunity_data.id, analysis_type, analysis_data
					)
					analysis_results.append(result.success)
			
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['storage_persistence'] = {
				'success': store_result.success and all(analysis_results),
				'processing_time': stage_time,
				'results': {
					'opportunity_stored': store_result.success,
					'analyses_stored': sum(analysis_results),
					'total_analyses': len(analysis_results)
				}
			}
			print(f"✅ Storage Persistence completed ({stage_time:.2f}s)")
			
			# Stage 8: Notification Processing
			stage_start = datetime.now()
			
			# Process notification events
			events_to_process = [
				('new_opportunity', {}),
				('analysis_complete', {
					'strategic_fit_score': opportunity_analysis.strategic_alignment,
					'capability_match_score': qualification_assessment.overall_match_score,
					'win_probability': qualification_assessment.win_probability,
					'analysis_status': 'completed'
				})
			]
			
			total_notifications = 0
			for event_type, event_data in events_to_process:
				notifications = await self.notification_service.process_opportunity_event(
					event_type, opportunity_data, event_data
				)
				total_notifications += len(notifications)
			
			stage_time = (datetime.now() - stage_start).total_seconds()
			
			workflow_results['workflow_stages']['notification_processing'] = {
				'success': True,
				'processing_time': stage_time,
				'results': {
					'events_processed': len(events_to_process),
					'notifications_generated': total_notifications
				}
			}
			print(f"✅ Notification Processing completed ({stage_time:.2f}s)")
			
			# Calculate total workflow time
			total_time = (datetime.now() - workflow_start).total_seconds()
			workflow_results['processing_time'] = total_time
			workflow_results['success'] = True
			
			# Compile final results summary
			workflow_results['summary'] = {
				'qualification_level': qualification_assessment.qualification_level,
				'overall_match_score': qualification_assessment.overall_match_score,
				'win_probability': qualification_assessment.win_probability,
				'strategic_fit': opportunity_analysis.strategic_alignment,
				'competitive_position': competitive_analysis.competitive_positioning.our_rank,
				'recommended_for_pursuit': len(filtering_results.recommended_opportunities) > 0,
				'total_processing_time': total_time
			}
			
			self.successful_analyses += 1
			print(f"🎉 Workflow completed successfully for {opportunity_data.title} ({total_time:.2f}s)")
			
			return workflow_results
			
		except Exception as e:
			# Handle workflow errors
			self.failed_analyses += 1
			workflow_results['errors'].append(str(e))
			workflow_results['processing_time'] = (datetime.now() - workflow_start).total_seconds()
			
			print(f"❌ Workflow failed for {opportunity_data.title}: {str(e)}")
			return workflow_results
	
	async def batch_process_opportunities(self, opportunities: List[OpportunityData],
	                                      org_capabilities: OrganizationalCapabilities) -> Dict[str, Any]:
		"""Process multiple opportunities in batch"""
		
		batch_start = datetime.now()
		batch_results = {
			'total_opportunities': len(opportunities),
			'successful_workflows': 0,
			'failed_workflows': 0,
			'individual_results': [],
			'batch_statistics': {},
			'processing_time': 0.0
		}
		
		print(f"🚀 Starting batch processing of {len(opportunities)} opportunities")
		
		# Process opportunities in parallel batches to avoid overwhelming system
		batch_size = 3  # Process 3 at a time
		
		for i in range(0, len(opportunities), batch_size):
			batch = opportunities[i:i + batch_size]
			
			# Process batch in parallel
			batch_tasks = [
				self.process_opportunity_workflow(opp, org_capabilities)
				for opp in batch
			]
			
			batch_workflow_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
			
			# Process batch results
			for j, result in enumerate(batch_workflow_results):
				if isinstance(result, Exception):
					batch_results['failed_workflows'] += 1
					error_result = {
						'opportunity_id': batch[j].id,
						'success': False,
						'error': str(result)
					}
					batch_results['individual_results'].append(error_result)
				else:
					if result['success']:
						batch_results['successful_workflows'] += 1
					else:
						batch_results['failed_workflows'] += 1
					
					batch_results['individual_results'].append(result)
			
			# Small delay between batches
			if i + batch_size < len(opportunities):
				await asyncio.sleep(1)
		
		# Calculate batch statistics
		total_time = (datetime.now() - batch_start).total_seconds()
		batch_results['processing_time'] = total_time
		
		successful_results = [r for r in batch_results['individual_results'] if r.get('success', False)]
		
		if successful_results:
			avg_processing_time = sum(r['processing_time'] for r in successful_results) / len(successful_results)
			
			# Calculate stage performance
			stage_times = {}
			for result in successful_results:
				for stage, stage_data in result.get('workflow_stages', {}).items():
					if stage not in stage_times:
						stage_times[stage] = []
					stage_times[stage].append(stage_data['processing_time'])
			
			avg_stage_times = {
				stage: sum(times) / len(times)
				for stage, times in stage_times.items()
			}
			
			batch_results['batch_statistics'] = {
				'average_processing_time': avg_processing_time,
				'total_throughput': len(opportunities) / total_time,
				'success_rate': batch_results['successful_workflows'] / len(opportunities),
				'average_stage_times': avg_stage_times
			}
		
		print(f"✅ Batch processing completed: {batch_results['successful_workflows']}/{len(opportunities)} successful ({total_time:.2f}s)")
		
		return batch_results


# Test fixtures and data
def create_test_opportunities() -> List[OpportunityData]:
	"""Create test opportunity data"""
	
	opportunities = [
		OpportunityData(
			id="test_e2e_001",
			title="Enterprise Cloud Migration",
			description="Migrate legacy systems to AWS cloud infrastructure with focus on security and scalability",
			requirements="5+ years AWS experience, security clearance, DevOps expertise",
			estimated_value=3500000.0,
			submission_deadline=datetime.now() + timedelta(days=30),
			industry="technology"
		),
		
		OpportunityData(
			id="test_e2e_002", 
			title="Healthcare AI Analytics Platform",
			description="Develop AI-powered analytics platform for healthcare data processing and insights",
			requirements="Python/ML expertise, healthcare domain knowledge, HIPAA compliance experience",
			estimated_value=2800000.0,
			submission_deadline=datetime.now() + timedelta(days=45),
			industry="healthcare"
		),
		
		OpportunityData(
			id="test_e2e_003",
			title="Financial Services Modernization",
			description="Modernize core banking systems with microservices architecture and real-time processing",
			requirements="Java/Spring expertise, financial services experience, high-volume transaction processing",
			estimated_value=8500000.0,
			submission_deadline=datetime.now() + timedelta(days=21),
			industry="financial_services"
		),
		
		OpportunityData(
			id="test_e2e_004",
			title="Government Digital Transformation",
			description="Digital transformation initiative for government agency including citizen portal and workflow automation",
			requirements="Government contracting experience, security clearance required, agile methodology",
			estimated_value=5200000.0,
			submission_deadline=datetime.now() + timedelta(days=38),
			industry="government"
		),
		
		OpportunityData(
			id="test_e2e_005",
			title="Manufacturing IoT Solution",
			description="Industrial IoT platform for smart manufacturing with predictive maintenance capabilities",
			requirements="IoT expertise, manufacturing domain knowledge, edge computing experience",
			estimated_value=1800000.0,
			submission_deadline=datetime.now() + timedelta(days=55),
			industry="manufacturing"
		)
	]
	
	return opportunities


def create_test_org_capabilities() -> OrganizationalCapabilities:
	"""Create test organizational capabilities"""
	
	return OrganizationalCapabilities(
		core_competencies={
			'software_development': 0.90,
			'cloud_computing': 0.85,
			'data_analytics': 0.80,
			'project_management': 0.85,
			'cybersecurity': 0.75,
			'artificial_intelligence': 0.70,
			'devops': 0.80,
			'microservices': 0.75
		},
		technical_skills={
			'python': 0.90,
			'java': 0.85,
			'aws': 0.80,
			'docker': 0.85,
			'kubernetes': 0.75,
			'tensorflow': 0.70,
			'spring': 0.80,
			'react': 0.75
		},
		industry_experience={
			'technology': 15,
			'healthcare': 8,
			'financial_services': 12,
			'government': 6,
			'manufacturing': 4
		},
		team_composition={
			'senior_developer': 12,
			'solution_architect': 4,
			'project_manager': 3,
			'data_scientist': 6,
			'devops_engineer': 5,
			'security_specialist': 2,
			'ui_ux_designer': 3
		},
		certifications={
			'aws_certified': ['dev1', 'arch1', 'dev2'],
			'pmp': ['pm1'],
			'cissp': ['sec1'],
			'certified_scrum_master': ['pm1', 'pm2']
		},
		security_clearances={
			'secret': ['dev1', 'pm1'],
			'public_trust': ['dev2', 'arch1']
		}
	)


# Test cases
@pytest.mark.asyncio
async def test_single_opportunity_workflow():
	"""Test complete workflow for single opportunity"""
	
	# Setup
	orchestrator = DiscoveryWorkflowOrchestrator()
	opportunities = create_test_opportunities()
	org_capabilities = create_test_org_capabilities()
	
	# Test single opportunity workflow
	test_opportunity = opportunities[0]  # Cloud Migration project
	
	workflow_result = await orchestrator.process_opportunity_workflow(
		test_opportunity, org_capabilities
	)
	
	# Assertions
	assert workflow_result['success'] is True
	assert workflow_result['opportunity_id'] == test_opportunity.id
	assert len(workflow_result['errors']) == 0
	assert workflow_result['processing_time'] > 0
	
	# Verify all workflow stages completed
	expected_stages = [
		'nlp_enhancement',
		'opportunity_analysis', 
		'qualification_analysis',
		'capability_matching',
		'competitive_analysis',
		'relevance_filtering',
		'storage_persistence',
		'notification_processing'
	]
	
	for stage in expected_stages:
		assert stage in workflow_result['workflow_stages']
		assert workflow_result['workflow_stages'][stage]['success'] is True
	
	# Verify summary results
	summary = workflow_result['summary']
	assert 'qualification_level' in summary
	assert 'overall_match_score' in summary
	assert 'win_probability' in summary
	assert 'strategic_fit' in summary
	assert 'recommended_for_pursuit' in summary
	
	print(f"✅ Single opportunity workflow test passed")
	print(f"   - Processing time: {workflow_result['processing_time']:.2f}s")
	print(f"   - Qualification level: {summary['qualification_level']}")
	print(f"   - Win probability: {summary['win_probability']:.2%}")


@pytest.mark.asyncio 
async def test_batch_opportunity_processing():
	"""Test batch processing of multiple opportunities"""
	
	# Setup
	orchestrator = DiscoveryWorkflowOrchestrator()
	opportunities = create_test_opportunities()
	org_capabilities = create_test_org_capabilities()
	
	# Test batch processing
	batch_results = await orchestrator.batch_process_opportunities(
		opportunities, org_capabilities
	)
	
	# Assertions
	assert batch_results['total_opportunities'] == len(opportunities)
	assert batch_results['successful_workflows'] > 0
	assert len(batch_results['individual_results']) == len(opportunities)
	
	# Verify batch statistics
	stats = batch_results['batch_statistics']
	assert 'average_processing_time' in stats
	assert 'total_throughput' in stats
	assert 'success_rate' in stats
	assert 'average_stage_times' in stats
	
	# Check success rate
	success_rate = stats['success_rate']
	assert success_rate > 0.7  # At least 70% success rate
	
	# Verify individual results
	successful_results = [r for r in batch_results['individual_results'] if r.get('success', False)]
	assert len(successful_results) > 0
	
	# Check that high-value opportunities were properly identified
	high_value_opportunities = [
		r for r in successful_results 
		if r.get('summary', {}).get('win_probability', 0) > 0.3
	]
	assert len(high_value_opportunities) > 0
	
	print(f"✅ Batch processing test passed")
	print(f"   - Success rate: {success_rate:.1%}")
	print(f"   - Throughput: {stats['total_throughput']:.1f} opportunities/second")
	print(f"   - Average processing time: {stats['average_processing_time']:.2f}s")


@pytest.mark.asyncio
async def test_workflow_performance():
	"""Test workflow performance requirements"""
	
	# Setup
	orchestrator = DiscoveryWorkflowOrchestrator()
	opportunities = create_test_opportunities()
	org_capabilities = create_test_org_capabilities()
	
	# Test performance with batch processing
	start_time = datetime.now()
	
	batch_results = await orchestrator.batch_process_opportunities(
		opportunities, org_capabilities
	)
	
	total_time = (datetime.now() - start_time).total_seconds()
	
	# Performance assertions
	stats = batch_results['batch_statistics']
	
	# Should process at least 0.1 opportunities per second (10s per opportunity max)
	assert stats['total_throughput'] >= 0.1
	
	# Average processing time should be reasonable
	assert stats['average_processing_time'] < 30.0  # Max 30 seconds per opportunity
	
	# Individual stage performance checks
	stage_times = stats['average_stage_times']
	
	# No single stage should take more than 10 seconds on average
	for stage, avg_time in stage_times.items():
		assert avg_time < 10.0, f"Stage {stage} took {avg_time:.2f}s on average"
	
	# Success rate should be high
	assert stats['success_rate'] >= 0.8  # At least 80% success rate
	
	print(f"✅ Performance test passed")
	print(f"   - Total throughput: {stats['total_throughput']:.2f} opp/sec")
	print(f"   - Batch processing time: {total_time:.2f}s")
	print(f"   - Success rate: {stats['success_rate']:.1%}")


@pytest.mark.asyncio
async def test_workflow_error_handling():
	"""Test workflow error handling and recovery"""
	
	# Setup
	orchestrator = DiscoveryWorkflowOrchestrator()
	org_capabilities = create_test_org_capabilities()
	
	# Create opportunity with invalid data to trigger errors
	invalid_opportunity = OpportunityData(
		id="test_invalid_001",
		title="",  # Empty title
		description="",  # Empty description
		estimated_value=-1000.0,  # Invalid value
		submission_deadline=datetime.now() - timedelta(days=30)  # Past deadline
	)
	
	# Test workflow with invalid data
	workflow_result = await orchestrator.process_opportunity_workflow(
		invalid_opportunity, org_capabilities
	)
	
	# The workflow should handle errors gracefully
	# Even if some stages fail, it should continue processing
	assert 'opportunity_id' in workflow_result
	assert 'workflow_stages' in workflow_result
	assert 'processing_time' in workflow_result
	
	# Check that at least some stages attempted processing
	assert len(workflow_result['workflow_stages']) > 0
	
	# Error handling validation - either success with warnings or controlled failure
	if not workflow_result['success']:
		assert len(workflow_result['errors']) > 0
	
	print(f"✅ Error handling test passed")
	print(f"   - Workflow success: {workflow_result['success']}")
	print(f"   - Errors captured: {len(workflow_result['errors'])}")
	print(f"   - Stages attempted: {len(workflow_result['workflow_stages'])}")


@pytest.mark.asyncio
async def test_service_integration():
	"""Test integration between all discovery services"""
	
	# Setup
	orchestrator = DiscoveryWorkflowOrchestrator()
	opportunities = create_test_opportunities()
	org_capabilities = create_test_org_capabilities()
	
	# Test that all services are properly integrated
	test_opportunity = opportunities[1]  # Healthcare AI project
	
	workflow_result = await orchestrator.process_opportunity_workflow(
		test_opportunity, org_capabilities
	)
	
	# Verify integration points
	assert workflow_result['success'] is True
	
	# Check NLP integration
	nlp_stage = workflow_result['workflow_stages']['nlp_enhancement']
	assert nlp_stage['success'] is True
	assert nlp_stage['insights']['requirements_count'] > 0
	
	# Check storage integration
	storage_stage = workflow_result['workflow_stages']['storage_persistence']
	assert storage_stage['success'] is True
	assert storage_stage['results']['opportunity_stored'] is True
	
	# Check notification integration
	notification_stage = workflow_result['workflow_stages']['notification_processing']
	assert notification_stage['success'] is True
	assert notification_stage['results']['events_processed'] > 0
	
	# Verify data flow between services
	summary = workflow_result['summary']
	assert summary['qualification_level'] in ['highly_qualified', 'qualified', 'partially_qualified', 'not_qualified']
	assert 0.0 <= summary['overall_match_score'] <= 1.0
	assert 0.0 <= summary['win_probability'] <= 1.0
	assert 0.0 <= summary['strategic_fit'] <= 1.0
	
	print(f"✅ Service integration test passed")
	print(f"   - All services integrated successfully")
	print(f"   - Data flow validated across services")
	print(f"   - Final recommendation: {summary['recommended_for_pursuit']}")


# Performance benchmark test
@pytest.mark.asyncio
async def test_high_volume_processing():
	"""Test processing capability for high-volume scenarios"""
	
	# This test simulates processing 20 opportunities (scaled down from 1000+ for CI)
	orchestrator = DiscoveryWorkflowOrchestrator()
	base_opportunities = create_test_opportunities()
	org_capabilities = create_test_org_capabilities()
	
	# Create extended opportunity set
	extended_opportunities = []
	for i in range(20):  # Scale to 20 for testing
		base_opp = base_opportunities[i % len(base_opportunities)]
		extended_opp = OpportunityData(
			id=f"high_vol_{i:03d}",
			title=f"{base_opp.title} - Variant {i}",
			description=base_opp.description,
			requirements=base_opp.requirements,
			estimated_value=base_opp.estimated_value * (0.8 + (i % 5) * 0.1),
			submission_deadline=datetime.now() + timedelta(days=20 + (i % 40)),
			industry=base_opp.industry
		)
		extended_opportunities.append(extended_opp)
	
	# Process high volume batch
	start_time = datetime.now()
	batch_results = await orchestrator.batch_process_opportunities(
		extended_opportunities, org_capabilities
	)
	total_time = (datetime.now() - start_time).total_seconds()
	
	# Volume processing assertions
	assert batch_results['successful_workflows'] >= 16  # At least 80% success
	assert total_time < 600  # Should complete within 10 minutes
	
	stats = batch_results['batch_statistics']
	throughput = stats['total_throughput']
	
	# Minimum throughput requirement
	assert throughput >= 0.03  # At least 1 opportunity per 30 seconds
	
	print(f"✅ High volume processing test passed")
	print(f"   - Processed {len(extended_opportunities)} opportunities")
	print(f"   - Success rate: {stats['success_rate']:.1%}")
	print(f"   - Throughput: {throughput:.3f} opportunities/second")
	print(f"   - Total time: {total_time:.1f} seconds")


if __name__ == "__main__":
	# Run all tests
	import sys
	
	async def run_all_tests():
		print("🧪 Running Discovery E2E Workflow Tests")
		print("=" * 50)
		
		tests = [
			test_single_opportunity_workflow,
			test_batch_opportunity_processing,
			test_workflow_performance,
			test_workflow_error_handling,
			test_service_integration,
			test_high_volume_processing
		]
		
		passed = 0
		failed = 0
		
		for test_func in tests:
			try:
				print(f"\n🔬 Running {test_func.__name__}")
				await test_func()
				passed += 1
			except Exception as e:
				print(f"❌ {test_func.__name__} failed: {str(e)}")
				failed += 1
		
		print("\n" + "=" * 50)
		print(f"📊 Test Results: {passed} passed, {failed} failed")
		
		if failed == 0:
			print("🎉 All tests passed!")
			return 0
		else:
			print("💥 Some tests failed!")
			return 1
	
	sys.exit(asyncio.run(run_all_tests()))