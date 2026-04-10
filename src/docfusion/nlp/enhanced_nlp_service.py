#!/usr/bin/env python3
"""
Enhanced NLP Service Integration Layer

Comprehensive NLP service that orchestrates all processors, extractors, analyzers,
and transformers for complete document understanding and content enhancement.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime

# Import all NLP components
from .nlp_service import NLPService, NLPServiceConfiguration, NLPAnalysisResult

# Import analyzers
from .analyzers.style_analyzer import StyleAnalyzer, create_style_analyzer
from .analyzers.semantic_analyzer import SemanticAnalyzer, create_semantic_analyzer
from .analyzers.coherence_analyzer import CoherenceAnalyzer, create_coherence_analyzer
from .analyzers.readability_analyzer import ReadabilityAnalyzer, create_readability_analyzer
from .analyzers.causal_analyzer import CausalAnalyzer, create_causal_analyzer

# Import transformers
from .transformers.content_generator import ContentGenerator, create_content_generator
from .transformers.style_transformer import StyleTransformer, create_style_transformer
from .transformers.document_summarizer import DocumentSummarizer, create_document_summarizer
from .transformers.content_optimizer import ContentOptimizer, create_content_optimizer
from ..core.utils import uuid7str

@dataclass
class EnhancedAnalysisResult:
	"""Comprehensive enhanced analysis result"""
	success: bool = False
	analysis_id: str = field(default_factory=uuid7str)
	
	# Core NLP analysis (from base service)
	nlp_analysis: Optional[NLPAnalysisResult] = None
	
	# Enhanced analysis components
	style_analysis: Optional[Any] = None
	semantic_analysis: Optional[Any] = None
	coherence_analysis: Optional[Any] = None
	readability_analysis: Optional[Any] = None
	causal_analysis: Optional[Any] = None
	
	# Content enhancement results
	generated_content: Optional[Any] = None
	optimized_content: Optional[Any] = None
	summary: Optional[Any] = None
	style_transformations: List[Any] = field(default_factory=list)
	
	# Comprehensive insights
	document_quality_score: float = 0.0
	improvement_recommendations: List[str] = field(default_factory=list)
	enhancement_opportunities: List[str] = field(default_factory=list)
	
	# Processing metadata
	total_processing_time: float = 0.0
	components_used: List[str] = field(default_factory=list)
	model_calls: int = 0
	tokens_used: int = 0
	
	# Feedback
	warnings: List[str] = field(default_factory=list)
	errors: List[str] = field(default_factory=list)
	statistics: Dict[str, Any] = field(default_factory=dict)

class EnhancedNLPServiceConfiguration:
	"""Enhanced configuration for comprehensive NLP service"""
	
	def __init__(
		self,
		# Base NLP service configuration
		base_config: Optional[NLPServiceConfiguration] = None,
		
		# Analyzer configurations
		enable_style_analysis: bool = True,
		enable_semantic_analysis: bool = True,
		enable_coherence_analysis: bool = True,
		enable_readability_analysis: bool = True,
		enable_causal_analysis: bool = False,
		
		# Transformer configurations
		enable_content_generation: bool = False,
		enable_style_transformation: bool = False,
		enable_summarization: bool = False,
		enable_content_optimization: bool = True,
		
		# Integration settings
		parallel_analysis: bool = True,
		quality_threshold: float = 0.7,
		comprehensive_reporting: bool = True,
		
		# Component-specific configs
		analyzer_configs: Optional[Dict[str, Dict[str, Any]]] = None,
		transformer_configs: Optional[Dict[str, Dict[str, Any]]] = None
	):
		# Base NLP configuration
		self.base_config = base_config or NLPServiceConfiguration()
		
		# Analyzer settings
		self.enable_style_analysis = enable_style_analysis
		self.enable_semantic_analysis = enable_semantic_analysis
		self.enable_coherence_analysis = enable_coherence_analysis
		self.enable_readability_analysis = enable_readability_analysis
		self.enable_causal_analysis = enable_causal_analysis
		
		# Transformer settings
		self.enable_content_generation = enable_content_generation
		self.enable_style_transformation = enable_style_transformation
		self.enable_summarization = enable_summarization
		self.enable_content_optimization = enable_content_optimization
		
		# Integration settings
		self.parallel_analysis = parallel_analysis
		self.quality_threshold = quality_threshold
		self.comprehensive_reporting = comprehensive_reporting
		
		# Component configurations
		base_config_dict = {
			'ollama_base_url': self.base_config.ollama_base_url,
			'ollama_model': self.base_config.ollama_model,
			'ollama_timeout': self.base_config.ollama_timeout,
			'use_ai_enhancement': self.base_config.use_ai_enhancement
		}
		
		self.analyzer_configs = analyzer_configs or {}
		self.transformer_configs = transformer_configs or {}
		
		# Merge base config into component configs
		for component_type in ['style', 'semantic', 'coherence', 'readability', 'causal']:
			if component_type not in self.analyzer_configs:
				self.analyzer_configs[component_type] = {}
			self.analyzer_configs[component_type].update(base_config_dict)
		
		for component_type in ['generator', 'transformer', 'summarizer', 'optimizer']:
			if component_type not in self.transformer_configs:
				self.transformer_configs[component_type] = {}
			self.transformer_configs[component_type].update(base_config_dict)

class EnhancedNLPService:
	"""Enhanced NLP service with comprehensive analysis and transformation capabilities"""
	
	def __init__(self, config: Optional[EnhancedNLPServiceConfiguration] = None):
		self.config = config or EnhancedNLPServiceConfiguration()
		self.logger = logging.getLogger(__name__)
		
		# Initialize base NLP service
		self.base_nlp_service = NLPService(self.config.base_config)
		
		# Initialize analyzer components
		self._initialize_analyzers()
		
		# Initialize transformer components
		self._initialize_transformers()
		
		self.logger.info("Enhanced NLP service initialized with comprehensive capabilities")
	
	def _initialize_analyzers(self):
		"""Initialize analysis components"""
		# Style analyzer
		if self.config.enable_style_analysis:
			self.style_analyzer = create_style_analyzer(self.config.analyzer_configs.get('style'))
		else:
			self.style_analyzer = None
		
		# Semantic analyzer
		if self.config.enable_semantic_analysis:
			self.semantic_analyzer = create_semantic_analyzer(self.config.analyzer_configs.get('semantic'))
		else:
			self.semantic_analyzer = None
		
		# Coherence analyzer
		if self.config.enable_coherence_analysis:
			self.coherence_analyzer = create_coherence_analyzer(self.config.analyzer_configs.get('coherence'))
		else:
			self.coherence_analyzer = None
		
		# Readability analyzer
		if self.config.enable_readability_analysis:
			self.readability_analyzer = create_readability_analyzer(self.config.analyzer_configs.get('readability'))
		else:
			self.readability_analyzer = None
		
		# Causal analyzer
		if self.config.enable_causal_analysis:
			self.causal_analyzer = create_causal_analyzer(self.config.analyzer_configs.get('causal'))
		else:
			self.causal_analyzer = None
	
	def _initialize_transformers(self):
		"""Initialize transformation components"""
		# Content generator
		if self.config.enable_content_generation:
			self.content_generator = create_content_generator(self.config.transformer_configs.get('generator'))
		else:
			self.content_generator = None
		
		# Style transformer
		if self.config.enable_style_transformation:
			self.style_transformer = create_style_transformer(self.config.transformer_configs.get('transformer'))
		else:
			self.style_transformer = None
		
		# Document summarizer
		if self.config.enable_summarization:
			self.document_summarizer = create_document_summarizer(self.config.transformer_configs.get('summarizer'))
		else:
			self.document_summarizer = None
		
		# Content optimizer
		if self.config.enable_content_optimization:
			self.content_optimizer = create_content_optimizer(self.config.transformer_configs.get('optimizer'))
		else:
			self.content_optimizer = None
	
	async def comprehensive_analysis(
		self,
		content: Union[str, bytes],
		content_type: Optional[str] = None,
		filename: Optional[str] = None,
		document_id: Optional[str] = None,
		include_transformations: bool = False
	) -> EnhancedAnalysisResult:
		"""Perform comprehensive document analysis with all available components"""
		start_time = asyncio.get_event_loop().time()
		result = EnhancedAnalysisResult()
		
		try:
			# Step 1: Base NLP analysis (processors and extractors)
			result.nlp_analysis = await self.base_nlp_service.analyze_document(
				content, content_type, filename, document_id
			)
			
			if not result.nlp_analysis.success:
				result.errors.extend(result.nlp_analysis.errors)
				return result
			
			text = result.nlp_analysis.cleaned_text
			result.components_used.append('base_nlp')
			result.model_calls += 1  # Base service model calls
			
			# Step 2: Enhanced analysis (analyzers)
			if self.config.parallel_analysis:
				await self._parallel_enhanced_analysis(text, result)
			else:
				await self._sequential_enhanced_analysis(text, result)
			
			# Step 3: Content transformations (if requested)
			if include_transformations:
				await self._apply_content_transformations(text, result)
			
			# Step 4: Generate comprehensive insights
			await self._generate_comprehensive_insights(result)
			
			# Step 5: Calculate overall quality score
			result.document_quality_score = self._calculate_document_quality(result)
			
			# Step 6: Compile comprehensive statistics
			result.statistics = self._compile_comprehensive_statistics(result)
			
			result.success = len(result.errors) == 0
			result.total_processing_time = asyncio.get_event_loop().time() - start_time
			
			self.logger.info(f"Comprehensive analysis completed: quality={result.document_quality_score:.3f}, "
							f"components={len(result.components_used)}")
			
		except Exception as e:
			result.errors.append(f"Comprehensive analysis failed: {str(e)}")
			self.logger.error(f"Enhanced NLP analysis error: {e}")
		
		return result
	
	async def _parallel_enhanced_analysis(self, text: str, result: EnhancedAnalysisResult):
		"""Run enhanced analyses in parallel"""
		tasks = []
		
		# Style analysis
		if self.style_analyzer:
			tasks.append(self._run_style_analysis(text))
		
		# Semantic analysis
		if self.semantic_analyzer:
			tasks.append(self._run_semantic_analysis(text))
		
		# Coherence analysis
		if self.coherence_analyzer:
			tasks.append(self._run_coherence_analysis(text))
		
		# Readability analysis
		if self.readability_analyzer:
			tasks.append(self._run_readability_analysis(text))
		
		# Causal analysis (only if data is available)
		if self.causal_analyzer:
			tasks.append(self._run_causal_analysis(text))
		
		# Execute analyses in parallel
		if tasks:
			results = await asyncio.gather(*tasks, return_exceptions=True)
			
			# Process results
			task_index = 0
			
			if self.style_analyzer:
				style_result = results[task_index]
				task_index += 1
				if isinstance(style_result, Exception):
					result.errors.append(f"Style analysis failed: {str(style_result)}")
				else:
					result.style_analysis = style_result
					result.components_used.append('style_analyzer')
					if hasattr(style_result, 'ai_analysis') and style_result.ai_analysis:
						result.model_calls += 1
			
			if self.semantic_analyzer:
				semantic_result = results[task_index]
				task_index += 1
				if isinstance(semantic_result, Exception):
					result.errors.append(f"Semantic analysis failed: {str(semantic_result)}")
				else:
					result.semantic_analysis = semantic_result
					result.components_used.append('semantic_analyzer')
					result.model_calls += semantic_result.model_calls if hasattr(semantic_result, 'model_calls') else 0
			
			if self.coherence_analyzer:
				coherence_result = results[task_index]
				task_index += 1
				if isinstance(coherence_result, Exception):
					result.errors.append(f"Coherence analysis failed: {str(coherence_result)}")
				else:
					result.coherence_analysis = coherence_result
					result.components_used.append('coherence_analyzer')
					if hasattr(coherence_result, 'ai_analysis') and coherence_result.ai_analysis:
						result.model_calls += 1
			
			if self.readability_analyzer:
				readability_result = results[task_index]
				task_index += 1
				if isinstance(readability_result, Exception):
					result.errors.append(f"Readability analysis failed: {str(readability_result)}")
				else:
					result.readability_analysis = readability_result
					result.components_used.append('readability_analyzer')
					if hasattr(readability_result, 'ai_analysis') and readability_result.ai_analysis:
						result.model_calls += 1
			
			if self.causal_analyzer:
				causal_result = results[task_index]
				task_index += 1
				if isinstance(causal_result, Exception):
					result.errors.append(f"Causal analysis failed: {str(causal_result)}")
				else:
					result.causal_analysis = causal_result
					result.components_used.append('causal_analyzer')
					# Causal analysis doesn't use model calls in this implementation
	
	async def _sequential_enhanced_analysis(self, text: str, result: EnhancedAnalysisResult):
		"""Run enhanced analyses sequentially"""
		# Style analysis
		if self.style_analyzer:
			try:
				result.style_analysis = await self._run_style_analysis(text)
				result.components_used.append('style_analyzer')
				if hasattr(result.style_analysis, 'ai_analysis') and result.style_analysis.ai_analysis:
					result.model_calls += 1
			except Exception as e:
				result.errors.append(f"Style analysis failed: {str(e)}")
		
		# Semantic analysis
		if self.semantic_analyzer:
			try:
				result.semantic_analysis = await self._run_semantic_analysis(text)
				result.components_used.append('semantic_analyzer')
				result.model_calls += result.semantic_analysis.model_calls if hasattr(result.semantic_analysis, 'model_calls') else 0
			except Exception as e:
				result.errors.append(f"Semantic analysis failed: {str(e)}")
		
		# Coherence analysis
		if self.coherence_analyzer:
			try:
				result.coherence_analysis = await self._run_coherence_analysis(text)
				result.components_used.append('coherence_analyzer')
				if hasattr(result.coherence_analysis, 'ai_analysis') and result.coherence_analysis.ai_analysis:
					result.model_calls += 1
			except Exception as e:
				result.errors.append(f"Coherence analysis failed: {str(e)}")
		
		# Readability analysis
		if self.readability_analyzer:
			try:
				result.readability_analysis = await self._run_readability_analysis(text)
				result.components_used.append('readability_analyzer')
				if hasattr(result.readability_analysis, 'ai_analysis') and result.readability_analysis.ai_analysis:
					result.model_calls += 1
			except Exception as e:
				result.errors.append(f"Readability analysis failed: {str(e)}")
		
		# Causal analysis
		if self.causal_analyzer:
			try:
				result.causal_analysis = await self._run_causal_analysis(text)
				result.components_used.append('causal_analyzer')
				# Causal analysis doesn't use model calls in this implementation
			except Exception as e:
				result.errors.append(f"Causal analysis failed: {str(e)}")
	
	async def _run_style_analysis(self, text: str):
		"""Run style analysis"""
		return await self.style_analyzer.analyze_style(text)
	
	async def _run_semantic_analysis(self, text: str):
		"""Run semantic analysis"""
		return await self.semantic_analyzer.analyze_semantics(text)
	
	async def _run_coherence_analysis(self, text: str):
		"""Run coherence analysis"""
		return await self.coherence_analyzer.analyze_coherence(text)
	
	async def _run_readability_analysis(self, text: str):
		"""Run readability analysis"""
		return await self.readability_analyzer.analyze_readability(text)
	
	async def _run_causal_analysis(self, text: str):
		"""Run causal analysis (requires structured data)"""
		# For now, return a placeholder result as causal analysis requires structured data
		# In a real implementation, this would analyze document patterns and relationships
		from .analyzers.causal_analyzer import CausalAnalysisResult
		
		result = CausalAnalysisResult()
		result.success = True
		result.analysis_id = "placeholder"
		result.sample_size = len(text.split())
		result.causal_insights = ["Causal analysis requires structured data for meaningful results"]
		result.recommendations = ["Collect quantitative data to enable causal inference analysis"]
		return result
	
	async def _apply_content_transformations(self, text: str, result: EnhancedAnalysisResult):
		"""Apply content transformations based on analysis results"""
		try:
			# Content optimization (if enabled and needed)
			if self.content_optimizer and self._should_optimize_content(result):
				from .transformers.content_optimizer import OptimizationType
				
				optimization_types = self._determine_optimization_types(result)
				if optimization_types:
					optimization_result = await self.content_optimizer.optimize_content(
						text, optimization_types
					)
					result.optimized_content = optimization_result
					result.components_used.append('content_optimizer')
					result.model_calls += optimization_result.model_calls
			
			# Document summarization (if enabled)
			if self.document_summarizer:
				from .transformers.document_summarizer import SummaryType, SummaryLength
				
				summary_result = await self.document_summarizer.summarize_document(
					text, SummaryType.ABSTRACTIVE, SummaryLength.MEDIUM
				)
				result.summary = summary_result
				result.components_used.append('document_summarizer')
				result.model_calls += summary_result.model_calls
		
		except Exception as e:
			result.warnings.append(f"Content transformation failed: {str(e)}")
			self.logger.warning(f"Content transformation error: {e}")
	
	def _should_optimize_content(self, result: EnhancedAnalysisResult) -> bool:
		"""Determine if content should be optimized based on analysis results"""
		# Check readability scores
		if (result.readability_analysis and 
			hasattr(result.readability_analysis, 'quality_assessment') and
			result.readability_analysis.quality_assessment.overall_quality < self.config.quality_threshold):
			return True
		
		# Check style scores
		if (result.style_analysis and 
			hasattr(result.style_analysis, 'coherence_scores') and
			result.style_analysis.coherence_scores.overall_score < self.config.quality_threshold):
			return True
		
		# Check coherence scores
		if (result.coherence_analysis and 
			hasattr(result.coherence_analysis, 'coherence_scores') and
			result.coherence_analysis.coherence_scores.overall_score < self.config.quality_threshold):
			return True
		
		return False
	
	def _determine_optimization_types(self, result: EnhancedAnalysisResult) -> List[Any]:
		"""Determine what types of optimization are needed"""
		from .transformers.content_optimizer import OptimizationType
		
		optimization_types = []
		
		# Based on readability analysis
		if result.readability_analysis and hasattr(result.readability_analysis, 'accessibility'):
			if result.readability_analysis.accessibility.overall_accessibility < 0.6:
				optimization_types.append(OptimizationType.ACCESSIBILITY)
			if result.readability_analysis.accessibility.clarity_score < 0.7:
				optimization_types.append(OptimizationType.CLARITY)
		
		# Based on style analysis
		if result.style_analysis and hasattr(result.style_analysis, 'style_analysis'):
			if result.style_analysis.style_analysis.clarity < 0.7:
				optimization_types.append(OptimizationType.CLARITY)
		
		# Based on coherence analysis
		if result.coherence_analysis and hasattr(result.coherence_analysis, 'coherence_scores'):
			if result.coherence_analysis.coherence_scores.overall_score < 0.7:
				optimization_types.append(OptimizationType.FLOW)
		
		# Default optimizations if no specific issues found
		if not optimization_types:
			optimization_types = [OptimizationType.CLARITY, OptimizationType.ENGAGEMENT]
		
		return optimization_types
	
	async def _generate_comprehensive_insights(self, result: EnhancedAnalysisResult):
		"""Generate comprehensive insights from all analyses"""
		insights = []
		recommendations = []
		opportunities = []
		
		# Insights from style analysis
		if result.style_analysis and hasattr(result.style_analysis, 'improvement_suggestions'):
			recommendations.extend(result.style_analysis.improvement_suggestions[:3])
		
		# Insights from semantic analysis
		if result.semantic_analysis and hasattr(result.semantic_analysis, 'topics'):
			if result.semantic_analysis.topics:
				insights.append(f"Document covers {len(result.semantic_analysis.topics)} main topics")
		
		# Insights from coherence analysis
		if result.coherence_analysis and hasattr(result.coherence_analysis, 'improvement_suggestions'):
			recommendations.extend(result.coherence_analysis.improvement_suggestions[:2])
		
		# Insights from readability analysis
		if result.readability_analysis and hasattr(result.readability_analysis, 'reading_level'):
			reading_level = result.readability_analysis.reading_level.primary_level.value
			insights.append(f"Content is written at {reading_level.replace('_', ' ')} level")
		
		# Generate enhancement opportunities
		if result.optimized_content and hasattr(result.optimized_content, 'improvement_opportunities'):
			opportunities.extend(result.optimized_content.improvement_opportunities)
		
		# Store insights
		result.improvement_recommendations = recommendations[:8]
		result.enhancement_opportunities = opportunities[:6]
	
	def _calculate_document_quality(self, result: EnhancedAnalysisResult) -> float:
		"""Calculate overall document quality score"""
		quality_factors = []
		
		# Base NLP quality (if available)
		if result.nlp_analysis and hasattr(result.nlp_analysis, 'statistics'):
			base_stats = result.nlp_analysis.statistics
			if 'overall' in base_stats:
				quality_factors.append(0.7)  # Baseline for successful base analysis
		
		# Style quality
		if result.style_analysis and hasattr(result.style_analysis, 'coherence_scores'):
			quality_factors.append(result.style_analysis.coherence_scores.overall_score)
		
		# Semantic quality
		if result.semantic_analysis and hasattr(result.semantic_analysis, 'confidence_score'):
			quality_factors.append(result.semantic_analysis.confidence_score)
		
		# Coherence quality
		if result.coherence_analysis and hasattr(result.coherence_analysis, 'coherence_scores'):
			quality_factors.append(result.coherence_analysis.coherence_scores.overall_score)
		
		# Readability quality
		if result.readability_analysis and hasattr(result.readability_analysis, 'quality_assessment'):
			quality_factors.append(result.readability_analysis.quality_assessment.overall_quality)
		
		# Calculate weighted average
		if quality_factors:
			return sum(quality_factors) / len(quality_factors)
		else:
			return 0.5  # Neutral score if no quality data available
	
	def _compile_comprehensive_statistics(self, result: EnhancedAnalysisResult) -> Dict[str, Any]:
		"""Compile comprehensive statistics from all analyses"""
		return {
			'comprehensive_summary': {
				'success': result.success,
				'components_used': result.components_used,
				'total_processing_time': result.total_processing_time,
				'model_calls': result.model_calls,
				'document_quality_score': result.document_quality_score,
				'recommendations_generated': len(result.improvement_recommendations),
				'opportunities_identified': len(result.enhancement_opportunities)
			},
			'analysis_coverage': {
				'base_nlp_analysis': result.nlp_analysis is not None,
				'style_analysis': result.style_analysis is not None,
				'semantic_analysis': result.semantic_analysis is not None,
				'coherence_analysis': result.coherence_analysis is not None,
				'readability_analysis': result.readability_analysis is not None
			},
			'transformation_results': {
				'content_optimized': result.optimized_content is not None,
				'summary_generated': result.summary is not None,
				'style_transformations': len(result.style_transformations)
			},
			'quality_assessment': {
				'overall_score': result.document_quality_score,
				'meets_threshold': result.document_quality_score >= self.config.quality_threshold,
				'areas_for_improvement': len(result.improvement_recommendations),
				'enhancement_potential': len(result.enhancement_opportunities)
			}
		}
	
	async def optimize_document(
		self,
		text: str,
		optimization_goals: List[str],
		target_audience: str = "professional"
	) -> Dict[str, Any]:
		"""Optimize document with specific goals"""
		if not self.content_optimizer:
			return {'error': 'Content optimization not enabled'}
		
		# Map optimization goals to types
		from .transformers.content_optimizer import OptimizationType
		
		goal_mapping = {
			'clarity': OptimizationType.CLARITY,
			'persuasiveness': OptimizationType.PERSUASIVENESS,
			'engagement': OptimizationType.ENGAGEMENT,
			'professionalism': OptimizationType.PROFESSIONALISM,
			'conciseness': OptimizationType.CONCISENESS
		}
		
		optimization_types = [goal_mapping.get(goal, OptimizationType.CLARITY) for goal in optimization_goals]
		
		result = await self.content_optimizer.optimize_content(
			text, optimization_types, target_audience
		)
		
		return {
			'success': result.success,
			'optimized_content': result.optimized_content.optimized_text if result.optimized_content else None,
			'suggestions_applied': len(result.optimized_content.suggestions_applied) if result.optimized_content else 0,
			'improvement_score': result.optimized_content.overall_improvement if result.optimized_content else 0,
			'recommendations': result.improvement_opportunities,
			'processing_time': result.processing_time
		}
	
	async def generate_summary(
		self,
		text: str,
		summary_type: str = "abstractive",
		length: str = "medium"
	) -> Dict[str, Any]:
		"""Generate document summary"""
		if not self.document_summarizer:
			return {'error': 'Document summarization not enabled'}
		
		from .transformers.document_summarizer import SummaryType, SummaryLength
		
		# Map string parameters to enums
		type_mapping = {
			'extractive': SummaryType.EXTRACTIVE,
			'abstractive': SummaryType.ABSTRACTIVE,
			'hybrid': SummaryType.HYBRID,
			'bullet_points': SummaryType.BULLET_POINTS,
			'executive': SummaryType.EXECUTIVE
		}
		
		length_mapping = {
			'brief': SummaryLength.BRIEF,
			'short': SummaryLength.SHORT,
			'medium': SummaryLength.MEDIUM,
			'long': SummaryLength.LONG,
			'detailed': SummaryLength.DETAILED
		}
		
		summary_type_enum = type_mapping.get(summary_type, SummaryType.ABSTRACTIVE)
		summary_length_enum = length_mapping.get(length, SummaryLength.MEDIUM)
		
		result = await self.document_summarizer.summarize_document(
			text, summary_type_enum, summary_length_enum
		)
		
		return {
			'success': result.success,
			'summary_text': result.summary_text,
			'word_count': result.word_count,
			'compression_ratio': result.compression_ratio,
			'quality_scores': {
				'coherence': result.coherence_score,
				'coverage': result.coverage_score,
				'informativeness': result.informativeness
			},
			'key_points': result.key_points,
			'processing_time': result.processing_time
		}
	
	def get_service_info(self) -> Dict[str, Any]:
		"""Get comprehensive service information"""
		base_info = self.base_nlp_service.get_service_info()
		
		enhanced_info = {
			'enhanced_nlp_service_version': '1.0.0',
			'base_service_info': base_info,
			'enabled_analyzers': {
				'style_analyzer': self.style_analyzer is not None,
				'semantic_analyzer': self.semantic_analyzer is not None,
				'coherence_analyzer': self.coherence_analyzer is not None,
				'readability_analyzer': self.readability_analyzer is not None,
				'causal_analyzer': self.causal_analyzer is not None
			},
			'enabled_transformers': {
				'content_generator': self.content_generator is not None,
				'style_transformer': self.style_transformer is not None,
				'document_summarizer': self.document_summarizer is not None,
				'content_optimizer': self.content_optimizer is not None
			},
			'enhanced_capabilities': {
				'comprehensive_analysis': True,
				'quality_scoring': True,
				'content_optimization': self.config.enable_content_optimization,
				'document_summarization': self.config.enable_summarization,
				'style_transformation': self.config.enable_style_transformation,
				'parallel_processing': self.config.parallel_analysis
			},
			'configuration': {
				'quality_threshold': self.config.quality_threshold,
				'comprehensive_reporting': self.config.comprehensive_reporting,
				'parallel_analysis': self.config.parallel_analysis
			}
		}
		
		return enhanced_info
	
	async def close(self):
		"""Close all service components"""
		# Close base service
		await self.base_nlp_service.close()
		
		# Close analyzer components
		analyzers = [
			self.style_analyzer,
			self.semantic_analyzer, 
			self.coherence_analyzer,
			self.readability_analyzer,
			self.causal_analyzer
		]
		
		for analyzer in analyzers:
			if analyzer and hasattr(analyzer, 'close'):
				try:
					await analyzer.close()
				except Exception as e:
					self.logger.warning(f"Failed to close analyzer {type(analyzer).__name__}: {e}")
		
		# Close transformer components
		transformers = [
			self.content_generator,
			self.style_transformer,
			self.document_summarizer,
			self.content_optimizer
		]
		
		for transformer in transformers:
			if transformer and hasattr(transformer, 'close'):
				try:
					await transformer.close()
				except Exception as e:
					self.logger.warning(f"Failed to close transformer {type(transformer).__name__}: {e}")
		
		self.logger.info("Enhanced NLP service closed")

# Factory function
def create_enhanced_nlp_service(config: Optional[EnhancedNLPServiceConfiguration] = None) -> EnhancedNLPService:
	"""Create EnhancedNLPService instance with configuration"""
	return EnhancedNLPService(config)