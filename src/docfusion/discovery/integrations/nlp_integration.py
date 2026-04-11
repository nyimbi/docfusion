"""
NLP Integration Service for Discovery Engine

This module provides comprehensive NLP integration capabilities for the
discovery engine, connecting text analysis, semantic matching, and other
NLP services with the opportunity analysis pipeline.
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field, ConfigDict

from ...nlp.services.text_analyzer import TextAnalyzer
from ...nlp.services.semantic_matcher import SemanticMatcher
from ...nlp.services.entity_extractor import EntityExtractor
from ...nlp.services.sentiment_analyzer import SentimentAnalyzer
from ...nlp.services.keyword_extractor import KeywordExtractor
from ..models.opportunity_models import OpportunityData
from ..analyzers.opportunity_analyzer import OpportunityAnalyzer
from ..analyzers.qualification_analyzer import QualificationAnalyzer
from ..matchers.capability_matcher import CapabilityMatcher


class NLPAnalysisRequest(BaseModel):
	"""Request for NLP analysis of opportunity text"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Unique opportunity identifier")
	text_sources: Dict[str, str] = Field(description="Text sources to analyze (source -> content)")
	analysis_types: List[str] = Field(description="Types of analysis to perform")
	priority: str = Field(default="normal", description="Processing priority (high, normal, low)")
	metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class NLPAnalysisResult(BaseModel):
	"""Result of NLP analysis"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	opportunity_id: str = Field(description="Opportunity identifier")
	
	# Text analysis results
	extracted_entities: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict, description="Extracted entities by type")
	keywords: Dict[str, List[str]] = Field(default_factory=dict, description="Keywords by source")
	sentiment_scores: Dict[str, float] = Field(default_factory=dict, description="Sentiment scores by source")
	
	# Semantic analysis
	text_embeddings: Dict[str, List[float]] = Field(default_factory=dict, description="Text embeddings by source")
	similarity_scores: Dict[str, float] = Field(default_factory=dict, description="Similarity scores to organizational capabilities")
	
	# Extracted insights
	requirements: List[str] = Field(default_factory=list, description="Extracted requirements")
	technologies: List[str] = Field(default_factory=list, description="Identified technologies")
	domains: List[str] = Field(default_factory=list, description="Identified domain areas")
	
	# Quality metrics
	confidence_score: float = Field(ge=0.0, le=1.0, description="Overall analysis confidence")
	processing_time: float = Field(description="Processing time in seconds")
	analysis_timestamp: datetime = Field(default_factory=datetime.now)


class DiscoveryNLPService:
	"""
	Comprehensive NLP integration service for discovery engine
	
	Orchestrates various NLP services to provide enhanced text analysis
	capabilities for opportunity discovery and analysis.
	"""
	
	def __init__(self):
		# Initialize NLP service components
		self.text_analyzer = TextAnalyzer()
		self.semantic_matcher = SemanticMatcher()
		self.entity_extractor = EntityExtractor()
		self.sentiment_analyzer = SentimentAnalyzer()
		self.keyword_extractor = KeywordExtractor()
		
		# Processing statistics
		self.analysis_count = 0
		self.total_processing_time = 0.0
		self.error_count = 0
		
		self._log_service_initialized()
	
	async def analyze_opportunity(self, request: NLPAnalysisRequest) -> NLPAnalysisResult:
		"""
		Perform comprehensive NLP analysis on opportunity text
		
		Args:
			request: NLP analysis request with text sources and parameters
			
		Returns:
			Complete NLP analysis results
		"""
		start_time = datetime.now()
		
		try:
			# Parallel processing of different analysis types
			analysis_tasks = []
			
			if "entity_extraction" in request.analysis_types:
				analysis_tasks.append(self._extract_entities(request.text_sources))
			
			if "keyword_extraction" in request.analysis_types:
				analysis_tasks.append(self._extract_keywords(request.text_sources))
			
			if "sentiment_analysis" in request.analysis_types:
				analysis_tasks.append(self._analyze_sentiment(request.text_sources))
			
			if "semantic_analysis" in request.analysis_types:
				analysis_tasks.append(self._perform_semantic_analysis(request.text_sources))
			
			if "requirement_extraction" in request.analysis_types:
				analysis_tasks.append(self._extract_requirements(request.text_sources))
			
			# Execute all analysis tasks in parallel
			results = await asyncio.gather(*analysis_tasks, return_exceptions=True)
			
			# Process results and handle any exceptions
			extracted_entities = {}
			keywords = {}
			sentiment_scores = {}
			text_embeddings = {}
			similarity_scores = {}
			requirements = []
			technologies = []
			domains = []
			
			for i, result in enumerate(results):
				if isinstance(result, Exception):
					self._log_analysis_error(f"Analysis task {i} failed: {str(result)}")
					continue
				
				# Merge results based on analysis type
				if i == 0 and "entity_extraction" in request.analysis_types:
					extracted_entities = result
				elif i == 1 and "keyword_extraction" in request.analysis_types:
					keywords = result
				elif i == 2 and "sentiment_analysis" in request.analysis_types:
					sentiment_scores = result
				elif i == 3 and "semantic_analysis" in request.analysis_types:
					text_embeddings, similarity_scores = result
				elif i == 4 and "requirement_extraction" in request.analysis_types:
					requirements, technologies, domains = result
			
			# Calculate overall confidence score
			confidence_score = self._calculate_confidence_score(
				extracted_entities, keywords, sentiment_scores, requirements
			)
			
			# Calculate processing time
			processing_time = (datetime.now() - start_time).total_seconds()
			
			# Update statistics
			self.analysis_count += 1
			self.total_processing_time += processing_time
			
			result = NLPAnalysisResult(
				opportunity_id=request.opportunity_id,
				extracted_entities=extracted_entities,
				keywords=keywords,
				sentiment_scores=sentiment_scores,
				text_embeddings=text_embeddings,
				similarity_scores=similarity_scores,
				requirements=requirements,
				technologies=technologies,
				domains=domains,
				confidence_score=confidence_score,
				processing_time=processing_time
			)
			
			self._log_analysis_complete(request.opportunity_id, processing_time, confidence_score)
			return result
			
		except Exception as e:
			self.error_count += 1
			self._log_analysis_error(f"NLP analysis failed for {request.opportunity_id}: {str(e)}")
			raise
	
	async def _extract_entities(self, text_sources: Dict[str, str]) -> Dict[str, List[Dict[str, Any]]]:
		"""Extract named entities from text sources"""
		entities_by_source = {}
		
		for source, text in text_sources.items():
			try:
				entities = await self.entity_extractor.extract_entities(text)
				entities_by_source[source] = entities
			except Exception as e:
				self._log_extraction_error(f"Entity extraction failed for {source}: {str(e)}")
				entities_by_source[source] = []
		
		return entities_by_source
	
	async def _extract_keywords(self, text_sources: Dict[str, str]) -> Dict[str, List[str]]:
		"""Extract keywords from text sources"""
		keywords_by_source = {}
		
		for source, text in text_sources.items():
			try:
				keywords = await self.keyword_extractor.extract_keywords(text, max_keywords=20)
				keywords_by_source[source] = keywords
			except Exception as e:
				self._log_extraction_error(f"Keyword extraction failed for {source}: {str(e)}")
				keywords_by_source[source] = []
		
		return keywords_by_source
	
	async def _analyze_sentiment(self, text_sources: Dict[str, str]) -> Dict[str, float]:
		"""Analyze sentiment of text sources"""
		sentiment_by_source = {}
		
		for source, text in text_sources.items():
			try:
				sentiment = await self.sentiment_analyzer.analyze_sentiment(text)
				sentiment_by_source[source] = sentiment.score
			except Exception as e:
				self._log_extraction_error(f"Sentiment analysis failed for {source}: {str(e)}")
				sentiment_by_source[source] = 0.0  # Neutral default
		
		return sentiment_by_source
	
	async def _perform_semantic_analysis(self, text_sources: Dict[str, str]) -> Tuple[Dict[str, List[float]], Dict[str, float]]:
		"""Perform semantic analysis including embeddings and similarity"""
		embeddings_by_source = {}
		similarity_scores = {}
		
		# Generate embeddings
		for source, text in text_sources.items():
			try:
				embedding = await self.semantic_matcher.generate_embedding(text)
				embeddings_by_source[source] = embedding
			except Exception as e:
				self._log_extraction_error(f"Embedding generation failed for {source}: {str(e)}")
				embeddings_by_source[source] = []
		
		# Calculate similarity to organizational capabilities
		org_capabilities = [
			"software development", "project management", "data analytics",
			"cybersecurity", "cloud computing", "artificial intelligence"
		]
		
		combined_text = ' '.join(text_sources.values())
		for capability in org_capabilities:
			try:
				similarity = await self.semantic_matcher.calculate_similarity(combined_text, capability)
				similarity_scores[capability] = similarity
			except Exception as e:
				self._log_extraction_error(f"Similarity calculation failed for {capability}: {str(e)}")
				similarity_scores[capability] = 0.0
		
		return embeddings_by_source, similarity_scores
	
	async def _extract_requirements(self, text_sources: Dict[str, str]) -> Tuple[List[str], List[str], List[str]]:
		"""Extract requirements, technologies, and domains from text"""
		requirements = []
		technologies = []
		domains = []
		
		combined_text = ' '.join(text_sources.values())
		
		try:
			# Extract requirements using pattern matching and NLP
			requirement_analysis = await self.text_analyzer.analyze_requirements(combined_text)
			
			requirements = requirement_analysis.get('requirements', [])
			technologies = requirement_analysis.get('technologies', [])
			domains = requirement_analysis.get('domains', [])
			
		except Exception as e:
			self._log_extraction_error(f"Requirement extraction failed: {str(e)}")
		
		return requirements, technologies, domains
	
	def _calculate_confidence_score(self, entities: Dict, keywords: Dict, 
	                                sentiments: Dict, requirements: List) -> float:
		"""Calculate overall analysis confidence score"""
		confidence_factors = []
		
		# Entity extraction confidence
		if entities:
			entity_counts = [len(entity_list) for entity_list in entities.values()]
			entity_confidence = min(sum(entity_counts) / 50.0, 1.0)  # Normalize to 50 entities max
			confidence_factors.append(entity_confidence)
		
		# Keyword extraction confidence
		if keywords:
			keyword_counts = [len(keyword_list) for keyword_list in keywords.values()]
			keyword_confidence = min(sum(keyword_counts) / 30.0, 1.0)  # Normalize to 30 keywords max
			confidence_factors.append(keyword_confidence)
		
		# Sentiment analysis confidence (higher confidence with neutral sentiment)
		if sentiments:
			avg_sentiment = sum(sentiments.values()) / len(sentiments)
			sentiment_confidence = 1.0 - abs(avg_sentiment)  # Neutral = high confidence
			confidence_factors.append(sentiment_confidence)
		
		# Requirement extraction confidence
		if requirements:
			requirement_confidence = min(len(requirements) / 20.0, 1.0)  # Normalize to 20 requirements max
			confidence_factors.append(requirement_confidence)
		
		# Calculate weighted average
		if confidence_factors:
			return sum(confidence_factors) / len(confidence_factors)
		else:
			return 0.5  # Default moderate confidence
	
	async def batch_analyze_opportunities(self, requests: List[NLPAnalysisRequest]) -> List[NLPAnalysisResult]:
		"""
		Process multiple opportunities in batch for efficiency
		
		Args:
			requests: List of NLP analysis requests
			
		Returns:
			List of analysis results
		"""
		try:
			# Sort by priority (high priority first)
			priority_order = {'high': 0, 'normal': 1, 'low': 2}
			sorted_requests = sorted(requests, key=lambda x: priority_order.get(x.priority, 1))
			
			# Process in parallel batches to avoid overwhelming the system
			batch_size = 5
			results = []
			
			for i in range(0, len(sorted_requests), batch_size):
				batch = sorted_requests[i:i + batch_size]
				batch_tasks = [self.analyze_opportunity(request) for request in batch]
				
				batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
				
				for result in batch_results:
					if isinstance(result, Exception):
						self._log_analysis_error(f"Batch analysis failed: {str(result)}")
					else:
						results.append(result)
				
				# Small delay between batches to prevent resource exhaustion
				await asyncio.sleep(0.1)
			
			self._log_batch_complete(len(requests), len(results))
			return results
			
		except Exception as e:
			self._log_batch_error(f"Batch analysis failed: {str(e)}")
			raise
	
	async def enhance_opportunity_analysis(self, opportunity_data: OpportunityData,
	                                       nlp_results: NLPAnalysisResult) -> Dict[str, Any]:
		"""
		Enhance opportunity analysis with NLP insights
		
		Args:
			opportunity_data: Base opportunity data
			nlp_results: NLP analysis results
			
		Returns:
			Enhanced opportunity analysis data
		"""
		enhanced_data = {
			'original_data': opportunity_data.model_dump(),
			'nlp_insights': nlp_results.model_dump(),
			'enhancement_timestamp': datetime.now().isoformat()
		}
		
		# Add extracted requirements to opportunity data
		if nlp_results.requirements:
			enhanced_data['extracted_requirements'] = nlp_results.requirements
		
		# Add identified technologies
		if nlp_results.technologies:
			enhanced_data['required_technologies'] = nlp_results.technologies
		
		# Add domain classification
		if nlp_results.domains:
			enhanced_data['domain_classification'] = nlp_results.domains
		
		# Add capability alignment scores
		if nlp_results.similarity_scores:
			enhanced_data['capability_alignment'] = nlp_results.similarity_scores
		
		# Add sentiment insights
		if nlp_results.sentiment_scores:
			avg_sentiment = sum(nlp_results.sentiment_scores.values()) / len(nlp_results.sentiment_scores)
			enhanced_data['opportunity_sentiment'] = {
				'average_score': avg_sentiment,
				'interpretation': self._interpret_sentiment(avg_sentiment)
			}
		
		# Add keyword-based insights
		if nlp_results.keywords:
			all_keywords = []
			for keyword_list in nlp_results.keywords.values():
				all_keywords.extend(keyword_list)
			
			enhanced_data['key_themes'] = list(set(all_keywords))[:15]  # Top 15 unique themes
		
		return enhanced_data
	
	def _interpret_sentiment(self, sentiment_score: float) -> str:
		"""Interpret sentiment score into actionable insight"""
		if sentiment_score > 0.3:
			return "Positive opportunity tone - client appears enthusiastic"
		elif sentiment_score < -0.3:
			return "Challenging opportunity tone - may indicate difficult requirements"
		else:
			return "Neutral opportunity tone - standard business language"
	
	def get_processing_statistics(self) -> Dict[str, Any]:
		"""Get NLP service processing statistics"""
		avg_processing_time = (
			self.total_processing_time / self.analysis_count 
			if self.analysis_count > 0 else 0.0
		)
		
		success_rate = (
			(self.analysis_count - self.error_count) / self.analysis_count
			if self.analysis_count > 0 else 1.0
		)
		
		return {
			'total_analyses': self.analysis_count,
			'total_processing_time': self.total_processing_time,
			'average_processing_time': avg_processing_time,
			'error_count': self.error_count,
			'success_rate': success_rate,
			'service_status': 'active'
		}
	
	async def health_check(self) -> Dict[str, Any]:
		"""Perform health check on all NLP services"""
		health_status = {}
		
		# Check each service component
		services = [
			('text_analyzer', self.text_analyzer),
			('semantic_matcher', self.semantic_matcher),
			('entity_extractor', self.entity_extractor),
			('sentiment_analyzer', self.sentiment_analyzer),
			('keyword_extractor', self.keyword_extractor)
		]
		
		for service_name, service in services:
			try:
				# Basic health check with simple text
				test_result = await self._test_service_health(service_name, service)
				health_status[service_name] = {
					'status': 'healthy' if test_result else 'degraded',
					'response_time': test_result.get('response_time', 0) if test_result else None
				}
			except Exception as e:
				health_status[service_name] = {
					'status': 'error',
					'error': str(e)
				}
		
		# Overall health determination
		healthy_services = sum(1 for status in health_status.values() if status['status'] == 'healthy')
		total_services = len(health_status)
		
		overall_health = 'healthy' if healthy_services == total_services else (
			'degraded' if healthy_services > total_services / 2 else 'unhealthy'
		)
		
		return {
			'overall_status': overall_health,
			'services': health_status,
			'healthy_services': healthy_services,
			'total_services': total_services,
			'last_check': datetime.now().isoformat()
		}
	
	async def _test_service_health(self, service_name: str, service) -> Dict[str, Any]:
		"""Test individual service health"""
		start_time = datetime.now()
		
		try:
			# Simple test based on service type
			if service_name == 'text_analyzer':
				await service.analyze_text("test health check")
			elif service_name == 'semantic_matcher':
				await service.calculate_similarity("test", "check")
			elif service_name == 'entity_extractor':
				await service.extract_entities("test health check")
			elif service_name == 'sentiment_analyzer':
				await service.analyze_sentiment("test health check")
			elif service_name == 'keyword_extractor':
				await service.extract_keywords("test health check")
			
			response_time = (datetime.now() - start_time).total_seconds()
			return {'success': True, 'response_time': response_time}
			
		except Exception as e:
			return {'success': False, 'error': str(e)}
	
	# Logging methods
	
	def _log_service_initialized(self) -> None:
		"""Log service initialization"""
		print("DiscoveryNLPService: Service initialized with all NLP components")
	
	def _log_analysis_complete(self, opportunity_id: str, processing_time: float, confidence: float) -> None:
		"""Log successful analysis completion"""
		print(f"DiscoveryNLPService: Analysis complete for {opportunity_id} "
		      f"({processing_time:.2f}s, confidence: {confidence:.2f})")
	
	def _log_analysis_error(self, message: str) -> None:
		"""Log analysis errors"""
		print(f"DiscoveryNLPService Error: {message}")
	
	def _log_extraction_error(self, message: str) -> None:
		"""Log extraction errors"""
		print(f"DiscoveryNLPService Extraction Error: {message}")
	
	def _log_batch_complete(self, requested: int, completed: int) -> None:
		"""Log batch processing completion"""
		print(f"DiscoveryNLPService: Batch processing complete - {completed}/{requested} successful")
	
	def _log_batch_error(self, message: str) -> None:
		"""Log batch processing errors"""
		print(f"DiscoveryNLPService Batch Error: {message}")


# Integration helpers for discovery analyzers
class AnalyzerNLPIntegration:
	"""
	Helper class to integrate NLP services with discovery analyzers
	"""
	
	def __init__(self, nlp_service: DiscoveryNLPService):
		self.nlp_service = nlp_service
	
	async def enhance_opportunity_analyzer(self, analyzer: OpportunityAnalyzer,
	                                       opportunity_data: OpportunityData) -> Dict[str, Any]:
		"""Enhance OpportunityAnalyzer with NLP insights"""
		
		# Prepare NLP analysis request
		text_sources = {
			'description': opportunity_data.description or '',
			'requirements': opportunity_data.requirements or '',
			'scope_of_work': opportunity_data.scope_of_work or ''
		}
		
		request = NLPAnalysisRequest(
			opportunity_id=opportunity_data.id,
			text_sources=text_sources,
			analysis_types=['entity_extraction', 'keyword_extraction', 'semantic_analysis', 'requirement_extraction']
		)
		
		# Get NLP analysis
		nlp_results = await self.nlp_service.analyze_opportunity(request)
		
		# Enhance opportunity analysis
		enhanced_data = await self.nlp_service.enhance_opportunity_analysis(opportunity_data, nlp_results)
		
		return enhanced_data
	
	async def enhance_capability_matcher(self, matcher: CapabilityMatcher,
	                                     requirements: List[str]) -> Dict[str, List[str]]:
		"""Enhance CapabilityMatcher with NLP-processed requirements"""
		
		enhanced_requirements = {}
		
		for i, requirement in enumerate(requirements):
			text_sources = {'requirement': requirement}
			
			request = NLPAnalysisRequest(
				opportunity_id=f"req_{i}",
				text_sources=text_sources,
				analysis_types=['entity_extraction', 'keyword_extraction']
			)
			
			nlp_results = await self.nlp_service.analyze_opportunity(request)
			
			# Extract enhanced requirement components
			entities = []
			for entity_list in nlp_results.extracted_entities.values():
				entities.extend([entity['text'] for entity in entity_list])
			
			keywords = []
			for keyword_list in nlp_results.keywords.values():
				keywords.extend(keyword_list)
			
			enhanced_requirements[requirement] = {
				'entities': entities,
				'keywords': keywords,
				'technologies': nlp_results.technologies
			}
		
		return enhanced_requirements


# Example usage and testing
async def test_nlp_integration():
	"""Test NLP integration with discovery services"""
	
	# Initialize NLP service
	nlp_service = DiscoveryNLPService()
	
	# Sample opportunity data
	opportunity = OpportunityData(
		id="test_nlp_001",
		title="AI-Powered Healthcare Analytics Platform",
		description="Develop machine learning solutions for healthcare data analysis using Python and cloud technologies",
		requirements="5+ years Python experience, machine learning expertise, AWS certification preferred",
		estimated_value=2500000.0
	)
	
	# Create analysis request
	text_sources = {
		'title': opportunity.title,
		'description': opportunity.description,
		'requirements': opportunity.requirements
	}
	
	request = NLPAnalysisRequest(
		opportunity_id=opportunity.id,
		text_sources=text_sources,
		analysis_types=['entity_extraction', 'keyword_extraction', 'sentiment_analysis', 
		                'semantic_analysis', 'requirement_extraction']
	)
	
	# Perform NLP analysis
	results = await nlp_service.analyze_opportunity(request)
	
	# Enhance opportunity data
	enhanced_data = await nlp_service.enhance_opportunity_analysis(opportunity, results)
	
	return enhanced_data, nlp_service.get_processing_statistics()


if __name__ == "__main__":
	# Test the NLP integration
	import asyncio
	
	async def main():
		enhanced_data, stats = await test_nlp_integration()
		print("Enhanced Opportunity Data:")
		print(f"- Requirements: {len(enhanced_data.get('extracted_requirements', []))}")
		print(f"- Technologies: {enhanced_data.get('required_technologies', [])}")
		print(f"- Key Themes: {len(enhanced_data.get('key_themes', []))}")
		print(f"- Processing Stats: {stats}")
		
	asyncio.run(main())