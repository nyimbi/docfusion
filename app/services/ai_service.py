"""
AI service for integrating with DocuFusion AI components.
"""

from typing import Dict, Any, List, Optional
import json

# Import DocuFusion AI components
try:
	from src.proposal_writer.nlp.nlp_service import NLPService
	from src.proposal_writer.voice_dna.analyzer.voice_pattern_analyzer import VoicePatternAnalyzer
	from src.proposal_writer.voice_dna.validator.voice_validator import VoiceValidator
	from src.proposal_writer.ai_agents.orchestration.agent_coordinator import AgentCoordinator
	from src.proposal_writer.intelligence.predictors.win_probability_predictor import WinProbabilityPredictor
	from src.proposal_writer.intelligence.recommenders.content_recommender import ContentRecommender
except ImportError:
	# Fallback for when proposal_writer components are not available
	NLPService = None
	VoicePatternAnalyzer = None
	VoiceValidator = None
	AgentCoordinator = None
	WinProbabilityPredictor = None
	ContentRecommender = None


class AIService:
	"""
	Service class for AI operations that integrates with DocuFusion
	AI components including NLP, voice analysis, and intelligent agents.
	"""
	
	def __init__(self):
		"""Initialize the AI service with backend components."""
		self.nlp_service = None
		self.voice_analyzer = None
		self.voice_validator = None
		self.agent_coordinator = None
		self.win_predictor = None
		self.content_recommender = None
		
		# Initialize components if available
		try:
			if NLPService:
				self.nlp_service = NLPService()
			if VoicePatternAnalyzer:
				self.voice_analyzer = VoicePatternAnalyzer()
			if VoiceValidator:
				self.voice_validator = VoiceValidator()
			if AgentCoordinator:
				self.agent_coordinator = AgentCoordinator()
			if WinProbabilityPredictor:
				self.win_predictor = WinProbabilityPredictor()
			if ContentRecommender:
				self.content_recommender = ContentRecommender()
		except Exception as e:
			print(f"Warning: Could not initialize AI components: {e}")
	
	def enhance_content(self, content: str, document_type: str) -> Dict[str, Any]:
		"""
		Use AI to enhance document content with suggestions and improvements.
		
		Args:
			content: Original document content
			document_type: Type of document (proposal, rfp_response, etc.)
			
		Returns:
			Dictionary containing enhancement suggestions
		"""
		if not content:
			return {'error': 'No content provided'}
		
		enhancements = {
			'original_length': len(content),
			'suggestions': [],
			'quality_score': 0,
			'readability_score': 0,
			'voice_consistency_score': 0
		}
		
		try:
			# NLP-based enhancements
			if self.nlp_service:
				# Analyze readability
				readability = self.nlp_service.analyze_readability(content)
				enhancements['readability_score'] = readability.get('score', 0)
				
				if readability.get('score', 0) < 60:
					enhancements['suggestions'].append({
						'type': 'readability',
						'priority': 'high',
						'message': 'Content may be difficult to read. Consider simplifying sentences and using more common words.',
						'action': 'simplify_language'
					})
				
				# Analyze sentiment and tone
				sentiment = self.nlp_service.analyze_sentiment(content)
				if sentiment.get('polarity', 0) < 0.1:
					enhancements['suggestions'].append({
						'type': 'tone',
						'priority': 'medium',
						'message': 'Content tone could be more positive and engaging.',
						'action': 'improve_tone'
					})
				
				# Extract and suggest keywords
				keywords = self.nlp_service.extract_keywords(content)
				if len(keywords) < 5:
					enhancements['suggestions'].append({
						'type': 'keywords',
						'priority': 'medium',
						'message': 'Consider adding more relevant keywords to improve document searchability.',
						'action': 'add_keywords'
					})
			
			# Voice DNA analysis
			if self.voice_analyzer:
				voice_score = self.analyze_voice_consistency(content)
				enhancements['voice_consistency_score'] = voice_score
				
				if voice_score < 0.7:
					enhancements['suggestions'].append({
						'type': 'voice',
						'priority': 'high',
						'message': 'Content may not match your organization\'s voice. Review tone and style.',
						'action': 'align_voice'
					})
			
			# Content recommendations
			if self.content_recommender:
				recommendations = self.content_recommender.get_recommendations(content, document_type)
				for rec in recommendations:
					enhancements['suggestions'].append({
						'type': 'content',
						'priority': rec.get('priority', 'medium'),
						'message': rec.get('message', ''),
						'action': rec.get('action', 'review')
					})
			
			# Calculate overall quality score
			enhancements['quality_score'] = self._calculate_quality_score(enhancements)
			
		except Exception as e:
			enhancements['error'] = f"Enhancement analysis failed: {str(e)}"
		
		return enhancements
	
	def analyze_voice_consistency(self, content: str) -> float:
		"""
		Analyze voice consistency of content.
		
		Args:
			content: Content to analyze
			
		Returns:
			Voice consistency score (0.0 to 1.0)
		"""
		if not self.voice_analyzer or not content:
			return 0.0
		
		try:
			voice_analysis = self.voice_analyzer.analyze_content(content)
			return voice_analysis.get('consistency_score', 0.0)
		except Exception as e:
			print(f"Voice analysis failed: {e}")
			return 0.0
	
	def analyze_quality(self, content: str) -> float:
		"""
		Analyze overall content quality.
		
		Args:
			content: Content to analyze
			
		Returns:
			Quality score (0.0 to 1.0)
		"""
		if not content:
			return 0.0
		
		quality_factors = []
		
		try:
			# Basic quality metrics
			word_count = len(content.split())
			if word_count > 100:  # Minimum content length
				quality_factors.append(0.8)
			else:
				quality_factors.append(word_count / 100 * 0.8)
			
			# Readability score
			if self.nlp_service:
				readability = self.nlp_service.analyze_readability(content)
				readability_score = readability.get('score', 50) / 100
				quality_factors.append(min(readability_score, 1.0))
			
			# Voice consistency
			voice_score = self.analyze_voice_consistency(content)
			quality_factors.append(voice_score)
			
			# Sentence structure variety
			sentences = content.split('.')
			avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
			if 10 <= avg_sentence_length <= 25:  # Optimal range
				quality_factors.append(0.9)
			else:
				quality_factors.append(0.6)
			
			# Calculate weighted average
			if quality_factors:
				return sum(quality_factors) / len(quality_factors)
			
		except Exception as e:
			print(f"Quality analysis failed: {e}")
		
		return 0.5  # Default moderate quality
	
	def comprehensive_analysis(self, content: str, document_type: str) -> Dict[str, Any]:
		"""
		Perform comprehensive AI analysis of document content.
		
		Args:
			content: Document content to analyze
			document_type: Type of document
			
		Returns:
			Dictionary containing comprehensive analysis results
		"""
		analysis = {
			'document_type': document_type,
			'content_length': len(content),
			'word_count': len(content.split()),
			'analysis_timestamp': '2024-01-01T00:00:00Z',  # Would use actual timestamp
			'scores': {},
			'insights': [],
			'recommendations': []
		}
		
		try:
			# Quality analysis
			analysis['scores']['quality_score'] = self.analyze_quality(content)
			analysis['scores']['voice_score'] = self.analyze_voice_consistency(content)
			
			# NLP analysis
			if self.nlp_service:
				# Readability
				readability = self.nlp_service.analyze_readability(content)
				analysis['scores']['readability_score'] = readability.get('score', 0) / 100
				
				# Sentiment
				sentiment = self.nlp_service.analyze_sentiment(content)
				analysis['scores']['sentiment_score'] = sentiment.get('polarity', 0)
				
				# Entity extraction
				entities = self.nlp_service.extract_entities(content)
				analysis['insights'].append({
					'type': 'entities',
					'count': len(entities),
					'entities': entities[:10]  # Top 10 entities
				})
				
				# Keywords
				keywords = self.nlp_service.extract_keywords(content)
				analysis['insights'].append({
					'type': 'keywords',
					'count': len(keywords),
					'keywords': keywords[:15]  # Top 15 keywords
				})
			
			# Generate recommendations based on analysis
			if analysis['scores']['quality_score'] < 0.6:
				analysis['recommendations'].append({
					'priority': 'high',
					'category': 'quality',
					'message': 'Overall content quality needs improvement. Focus on clarity and structure.'
				})
			
			if analysis['scores']['voice_score'] < 0.7:
				analysis['recommendations'].append({
					'priority': 'medium',
					'category': 'voice',
					'message': 'Content voice may not align with organizational standards.'
				})
			
			if analysis['scores'].get('readability_score', 0) < 0.6:
				analysis['recommendations'].append({
					'priority': 'medium',
					'category': 'readability',
					'message': 'Content readability could be improved for better comprehension.'
				})
			
		except Exception as e:
			analysis['error'] = f"Comprehensive analysis failed: {str(e)}"
		
		return analysis
	
	def generate_content_suggestions(self, context: str, document_type: str, section: str = None) -> List[str]:
		"""
		Generate AI-powered content suggestions.
		
		Args:
			context: Current content context
			document_type: Type of document
			section: Specific section if applicable
			
		Returns:
			List of content suggestions
		"""
		suggestions = []
		
		try:
			if self.content_recommender:
				ai_suggestions = self.content_recommender.generate_suggestions(
					context, document_type, section
				)
				suggestions.extend(ai_suggestions)
			else:
				# Fallback suggestions based on document type
				suggestions = self._get_fallback_suggestions(document_type, section)
			
		except Exception as e:
			print(f"Content suggestion generation failed: {e}")
			suggestions = self._get_fallback_suggestions(document_type, section)
		
		return suggestions
	
	def predict_success_probability(self, document_content: str, opportunity_data: Dict[str, Any]) -> float:
		"""
		Predict success probability for a proposal or document.
		
		Args:
			document_content: Content of the document
			opportunity_data: Information about the opportunity
			
		Returns:
			Success probability (0.0 to 1.0)
		"""
		if not self.win_predictor:
			return 0.5  # Default moderate probability
		
		try:
			prediction = self.win_predictor.predict_win_probability(
				document_content, opportunity_data
			)
			return prediction.get('probability', 0.5)
		except Exception as e:
			print(f"Success prediction failed: {e}")
			return 0.5
	
	def _calculate_quality_score(self, enhancements: Dict[str, Any]) -> float:
		"""
		Calculate overall quality score based on various factors.
		
		Args:
			enhancements: Enhancement analysis results
			
		Returns:
			Quality score (0.0 to 1.0)
		"""
		base_score = 0.5
		
		# Adjust based on readability
		readability_score = enhancements.get('readability_score', 50) / 100
		base_score += (readability_score - 0.5) * 0.3
		
		# Adjust based on voice consistency
		voice_score = enhancements.get('voice_consistency_score', 0.5)
		base_score += (voice_score - 0.5) * 0.2
		
		# Penalty for high-priority suggestions
		high_priority_suggestions = len([
			s for s in enhancements.get('suggestions', [])
			if s.get('priority') == 'high'
		])
		base_score -= high_priority_suggestions * 0.1
		
		# Ensure score stays within bounds
		return max(0.0, min(1.0, base_score))
	
	def _get_fallback_suggestions(self, document_type: str, section: str = None) -> List[str]:
		"""
		Get fallback content suggestions when AI components are not available.
		
		Args:
			document_type: Type of document
			section: Specific section if applicable
			
		Returns:
			List of content suggestions
		"""
		suggestions = {
			'proposal': [
				"Include a clear executive summary highlighting key value propositions",
				"Add specific metrics and KPIs to demonstrate impact",
				"Include testimonials or case studies from similar projects",
				"Ensure all requirements from the RFP are addressed",
				"Add a detailed project timeline with milestones"
			],
			'rfp_response': [
				"Address each requirement point by point",
				"Include compliance matrix for easy evaluation",
				"Add team qualifications and relevant experience",
				"Provide detailed pricing breakdown",
				"Include risk mitigation strategies"
			],
			'contract': [
				"Define all terms and conditions clearly",
				"Include specific deliverables and timelines",
				"Add payment terms and milestone schedule",
				"Include termination and dispute resolution clauses",
				"Specify intellectual property ownership"
			],
			'report': [
				"Start with an executive summary",
				"Include data visualizations and charts",
				"Provide clear recommendations based on findings",
				"Add methodology section for credibility",
				"Include appendices for detailed data"
			]
		}
		
		return suggestions.get(document_type, [
			"Ensure content is clear and well-structured",
			"Add supporting evidence and examples",
			"Review for consistency in tone and style",
			"Include relevant keywords for searchability",
			"Proofread for grammar and spelling errors"
		])