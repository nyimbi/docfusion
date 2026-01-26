#!/usr/bin/env python3
"""
Style Transformer with Ollama Integration

Advanced text transformation for tone adjustment, formality modification, and style
adaptation with AI-powered rewriting capabilities.
"""

import asyncio
import json
import logging
import re
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum

try:
	import aiohttp
	from aiohttp import ClientTimeout, ClientError
except ImportError:
	aiohttp = None

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

try:
	from ..prompting_strategies import (
		create_chain_of_thought_prompt,
		filter_thinking_tags,
		create_advanced_prompt_builder,
		AdvancedPromptBuilder
	)
except ImportError:
	# Fallback if prompting strategies not available
	def create_chain_of_thought_prompt(task, context, reasoning_steps, output_format=None, examples=None):
		return f"{task}\n\nContext: {context}\n\nPlease complete this task."
	
	def filter_thinking_tags(text):
		return text
	
	def create_advanced_prompt_builder(model_name):
		return None
	
	AdvancedPromptBuilder = None


class ToneTransformation(Enum):
	"""Types of tone transformations"""
	MORE_FORMAL = "more_formal"
	LESS_FORMAL = "less_formal"
	MORE_PROFESSIONAL = "more_professional"
	MORE_CONVERSATIONAL = "more_conversational"
	MORE_PERSUASIVE = "more_persuasive"
	MORE_TECHNICAL = "more_technical"
	LESS_TECHNICAL = "less_technical"
	MORE_CONFIDENT = "more_confident"
	MORE_DIPLOMATIC = "more_diplomatic"
	MORE_DIRECT = "more_direct"


class StyleAttribute(Enum):
	"""Style attributes that can be modified"""
	FORMALITY = "formality"
	TECHNICALITY = "technicality"
	PERSUASIVENESS = "persuasiveness"
	CONFIDENCE = "confidence"
	DIRECTNESS = "directness"
	WARMTH = "warmth"
	AUTHORITY = "authority"
	CLARITY = "clarity"


@dataclass
class StyleProfile:
	"""Target style profile for transformation"""
	formality_level: float = 0.5  # 0.0 = very informal, 1.0 = very formal
	technical_level: float = 0.5  # 0.0 = non-technical, 1.0 = highly technical
	persuasiveness: float = 0.5   # 0.0 = neutral, 1.0 = highly persuasive
	confidence_level: float = 0.5  # 0.0 = tentative, 1.0 = very confident
	directness: float = 0.5       # 0.0 = indirect, 1.0 = very direct
	warmth: float = 0.5           # 0.0 = cold, 1.0 = very warm
	authority: float = 0.5        # 0.0 = humble, 1.0 = authoritative
	clarity: float = 0.8          # 0.0 = complex, 1.0 = very clear
	
	# Target audience considerations
	audience_level: str = "professional"  # general, professional, expert
	cultural_context: str = "business"    # business, academic, casual


@dataclass
class TransformationRule:
	"""Rule for style transformation"""
	pattern: str = ""
	replacement: str = ""
	condition: Optional[str] = None
	priority: int = 1
	description: str = ""


@dataclass
class TransformationResult:
	"""Result of a single transformation"""
	original_text: str = ""
	transformed_text: str = ""
	transformation_type: ToneTransformation = ToneTransformation.MORE_FORMAL
	
	# Transformation metadata
	changes_made: List[Dict[str, str]] = field(default_factory=list)
	confidence_score: float = 0.0
	improvement_score: float = 0.0
	
	# Analysis comparison
	original_style_scores: Dict[str, float] = field(default_factory=dict)
	transformed_style_scores: Dict[str, float] = field(default_factory=dict)
	style_delta: Dict[str, float] = field(default_factory=dict)


@dataclass
class StyleTransformationResult:
	"""Complete style transformation result"""
	success: bool = False
	transformation_id: str = field(default_factory=uuid7str)
	
	# Transformation results
	primary_result: Optional[TransformationResult] = None
	alternative_versions: List[TransformationResult] = field(default_factory=list)
	
	# Quality metrics
	transformation_quality: float = 0.0
	style_consistency: float = 0.0
	content_preservation: float = 0.0
	readability_change: float = 0.0
	
	# AI insights
	ai_analysis: Optional[Dict[str, Any]] = None
	transformation_suggestions: List[str] = field(default_factory=list)
	
	# Processing metadata
	processing_time: float = 0.0
	model_calls: int = 0
	tokens_used: int = 0
	
	# Feedback
	warnings: List[str] = field(default_factory=list)
	errors: List[str] = field(default_factory=list)
	statistics: Dict[str, Any] = field(default_factory=dict)


class StyleTransformer:
	"""Advanced style transformer with AI-powered text rewriting"""
	
	def __init__(
		self,
		ollama_base_url: str = 'http://localhost:11434',
		ollama_model: str = 'deepseek-r1:32b',
		ollama_timeout: float = 120.0,
		use_ai_enhancement: bool = True,
		preserve_meaning: bool = True,
		enable_quality_validation: bool = True,
		use_advanced_prompting: bool = True
	):
		self.ollama_base_url = ollama_base_url.rstrip('/')
		self.ollama_model = ollama_model
		self.ollama_timeout = ollama_timeout
		self.use_ai_enhancement = use_ai_enhancement
		self.preserve_meaning = preserve_meaning
		self.enable_quality_validation = enable_quality_validation
		self.use_advanced_prompting = use_advanced_prompting
		self.logger = logging.getLogger(__name__)
		
		# Initialize advanced prompting if available
		self.prompt_builder = None
		if self.use_advanced_prompting and AdvancedPromptBuilder:
			try:
				self.prompt_builder = create_advanced_prompt_builder(ollama_model)
			except Exception as e:
				self.logger.warning(f"Could not initialize advanced prompting: {e}")
		
		# Initialize transformation rules and style guides
		self._initialize_transformation_rules()
		self._initialize_style_profiles()
		
		self.logger.info(f"StyleTransformer initialized with model: {ollama_model}")
	
	def _initialize_transformation_rules(self):
		"""Initialize rule-based transformation patterns"""
		self.transformation_rules = {
			ToneTransformation.MORE_FORMAL: [
				TransformationRule(
					pattern=r"\bi'm\b",
					replacement="I am",
					description="Expand contractions"
				),
				TransformationRule(
					pattern=r"\bcan't\b",
					replacement="cannot",
					description="Expand negative contractions"
				),
				TransformationRule(
					pattern=r"\bwon't\b",
					replacement="will not",
					description="Expand will not contraction"
				),
				TransformationRule(
					pattern=r"\bthat's\b",
					replacement="that is",
					description="Expand that's contraction"
				),
				TransformationRule(
					pattern=r"\bwe're\b",
					replacement="we are",
					description="Expand we're contraction"
				)
			],
			ToneTransformation.LESS_FORMAL: [
				TransformationRule(
					pattern=r"\bI am\b",
					replacement="I'm",
					description="Use contractions"
				),
				TransformationRule(
					pattern=r"\bcannot\b",
					replacement="can't",
					description="Use contractions for negatives"
				),
				TransformationRule(
					pattern=r"\bwill not\b",
					replacement="won't",
					description="Contract will not"
				)
			],
			ToneTransformation.MORE_PROFESSIONAL: [
				TransformationRule(
					pattern=r"\bawesome\b",
					replacement="excellent",
					description="Professional vocabulary"
				),
				TransformationRule(
					pattern=r"\bgreat\b",
					replacement="effective",
					description="Professional alternatives"
				),
				TransformationRule(
					pattern=r"\bstuff\b",
					replacement="materials",
					description="Professional terminology"
				)
			],
			ToneTransformation.MORE_CONFIDENT: [
				TransformationRule(
					pattern=r"\bI think\b",
					replacement="I believe",
					description="More assertive language"
				),
				TransformationRule(
					pattern=r"\bmight be\b",
					replacement="is",
					description="Remove uncertainty"
				),
				TransformationRule(
					pattern=r"\bprobably\b",
					replacement="",
					description="Remove hedging words"
				),
				TransformationRule(
					pattern=r"\bmaybe\b",
					replacement="",
					description="Remove uncertainty markers"
				)
			],
			ToneTransformation.MORE_DIRECT: [
				TransformationRule(
					pattern=r"\bI would like to suggest that\b",
					replacement="I recommend",
					description="Direct recommendations"
				),
				TransformationRule(
					pattern=r"\bperhaps we could consider\b",
					replacement="we should",
					description="Direct action statements"
				)
			]
		}
	
	def _initialize_style_profiles(self):
		"""Initialize predefined style profiles"""
		self.style_profiles = {
			"business_formal": StyleProfile(
				formality_level=0.9,
				technical_level=0.4,
				persuasiveness=0.6,
				confidence_level=0.8,
				directness=0.7,
				authority=0.8,
				audience_level="professional"
			),
			"technical_expert": StyleProfile(
				formality_level=0.7,
				technical_level=0.9,
				confidence_level=0.8,
				directness=0.8,
				clarity=0.9,
				audience_level="expert"
			),
			"persuasive_proposal": StyleProfile(
				formality_level=0.7,
				persuasiveness=0.9,
				confidence_level=0.9,
				directness=0.6,
				warmth=0.6,
				authority=0.7,
				audience_level="professional"
			),
			"conversational": StyleProfile(
				formality_level=0.3,
				warmth=0.8,
				directness=0.6,
				clarity=0.8,
				audience_level="general"
			),
			"academic": StyleProfile(
				formality_level=0.9,
				technical_level=0.7,
				confidence_level=0.6,
				directness=0.5,
				authority=0.6,
				cultural_context="academic"
			)
		}
	
	async def transform_tone(
		self,
		text: str,
		transformation: ToneTransformation,
		intensity: float = 0.7,
		preserve_structure: bool = True
	) -> StyleTransformationResult:
		"""Transform text tone with specified transformation"""
		start_time = asyncio.get_event_loop().time()
		result = StyleTransformationResult()
		
		try:
			assert text and text.strip(), "Text content is required"
			assert 0.0 <= intensity <= 1.0, "Intensity must be between 0.0 and 1.0"
			
			# Step 1: Analyze original style
			original_scores = await self._analyze_text_style(text)
			
			# Step 2: Apply AI-powered transformation
			if self.use_ai_enhancement and aiohttp:
				try:
					transformation_result = await self._ai_transform_tone(
						text, transformation, intensity, preserve_structure
					)
					result.primary_result = transformation_result
					result.model_calls += 1
				except Exception as e:
					result.warnings.append(f"AI transformation failed: {str(e)}")
					self.logger.warning(f"AI transformation failed: {e}")
			
			# Step 3: Fallback to rule-based transformation if needed
			if not result.primary_result:
				result.primary_result = await self._rule_based_transform(
					text, transformation, intensity
				)
			
			# Step 4: Analyze transformed style
			if result.primary_result:
				transformed_scores = await self._analyze_text_style(result.primary_result.transformed_text)
				result.primary_result.original_style_scores = original_scores
				result.primary_result.transformed_style_scores = transformed_scores
				result.primary_result.style_delta = self._calculate_style_delta(original_scores, transformed_scores)
			
			# Step 5: Quality validation
			if self.enable_quality_validation and result.primary_result:
				await self._validate_transformation_quality(result)
			
			# Step 6: Generate suggestions and statistics
			result.transformation_suggestions = await self._generate_transformation_suggestions(result)
			result.statistics = self._compile_transformation_statistics(result, text)
			
			result.success = len(result.errors) == 0 and result.primary_result is not None
			result.processing_time = asyncio.get_event_loop().time() - start_time
			
			self.logger.info(f"Style transformation completed: {transformation.value}, "
							f"quality: {result.transformation_quality:.3f}")
			
		except Exception as e:
			result.errors.append(f"Style transformation failed: {str(e)}")
			self.logger.error(f"Style transformation error: {e}")
		
		return result
	
	async def transform_to_style_profile(
		self,
		text: str,
		target_profile: Union[str, StyleProfile],
		adaptation_strength: float = 0.8
	) -> StyleTransformationResult:
		"""Transform text to match a specific style profile"""
		start_time = asyncio.get_event_loop().time()
		result = StyleTransformationResult()
		
		try:
			assert text and text.strip(), "Text content is required"
			
			# Resolve style profile
			if isinstance(target_profile, str):
				if target_profile in self.style_profiles:
					profile = self.style_profiles[target_profile]
				else:
					raise ValueError(f"Unknown style profile: {target_profile}")
			else:
				profile = target_profile
			
			# Step 1: Analyze current style
			current_scores = await self._analyze_text_style(text)
			
			# Step 2: Determine needed transformations
			transformations_needed = self._plan_style_transformations(current_scores, profile)
			
			# Step 3: Apply transformations sequentially
			current_text = text
			transformation_chain = []
			
			for transformation_type, target_intensity in transformations_needed:
				transform_result = await self.transform_tone(
					current_text, transformation_type, target_intensity * adaptation_strength
				)
				
				if transform_result.success and transform_result.primary_result:
					current_text = transform_result.primary_result.transformed_text
					transformation_chain.append(transform_result.primary_result)
					result.model_calls += transform_result.model_calls
					result.tokens_used += transform_result.tokens_used
			
			# Step 4: Create final result
			if transformation_chain:
				final_result = TransformationResult()
				final_result.original_text = text
				final_result.transformed_text = current_text
				final_result.transformation_type = ToneTransformation.MORE_PROFESSIONAL  # Generic
				final_result.original_style_scores = current_scores
				final_result.transformed_style_scores = await self._analyze_text_style(current_text)
				final_result.style_delta = self._calculate_style_delta(
					current_scores, final_result.transformed_style_scores
				)
				
				# Aggregate changes from all transformations
				all_changes = []
				for transform in transformation_chain:
					all_changes.extend(transform.changes_made)
				final_result.changes_made = all_changes
				
				result.primary_result = final_result
			
			# Step 5: Quality validation
			if self.enable_quality_validation and result.primary_result:
				await self._validate_transformation_quality(result)
			
			result.success = len(result.errors) == 0 and result.primary_result is not None
			result.processing_time = asyncio.get_event_loop().time() - start_time
			
		except Exception as e:
			result.errors.append(f"Style profile transformation failed: {str(e)}")
			self.logger.error(f"Style profile transformation error: {e}")
		
		return result
	
	async def _analyze_text_style(self, text: str) -> Dict[str, float]:
		"""Analyze style attributes of text"""
		scores = {}
		text_lower = text.lower()
		words = text.split()
		sentences = re.split(r'[.!?]+', text)
		sentences = [s.strip() for s in sentences if s.strip()]
		
		# Formality assessment
		formal_indicators = ['furthermore', 'however', 'therefore', 'consequently', 'nevertheless']
		informal_indicators = ["'m", "'re", "'ve", "'ll", 'gonna', 'wanna']
		
		formal_count = sum(1 for indicator in formal_indicators if indicator in text_lower)
		informal_count = sum(1 for indicator in informal_indicators if indicator in text)
		
		if formal_count + informal_count > 0:
			scores['formality'] = formal_count / (formal_count + informal_count)
		else:
			scores['formality'] = 0.5  # Neutral
		
		# Technical level assessment
		technical_terms = [
			'system', 'process', 'methodology', 'implementation', 'architecture',
			'framework', 'algorithm', 'optimization', 'integration', 'specification'
		]
		technical_count = sum(1 for term in technical_terms if term in text_lower)
		scores['technicality'] = min(technical_count / len(words) * 100, 1.0) if words else 0
		
		# Confidence assessment
		confident_words = ['will', 'shall', 'must', 'definitely', 'certainly', 'ensures']
		uncertain_words = ['might', 'maybe', 'perhaps', 'possibly', 'probably', 'seems']
		
		confident_count = sum(1 for word in confident_words if word in text_lower)
		uncertain_count = sum(1 for word in uncertain_words if word in text_lower)
		
		if confident_count + uncertain_count > 0:
			scores['confidence'] = confident_count / (confident_count + uncertain_count)
		else:
			scores['confidence'] = 0.5
		
		# Persuasiveness assessment
		persuasive_words = ['benefit', 'advantage', 'improve', 'enhance', 'value', 'opportunity']
		persuasive_count = sum(1 for word in persuasive_words if word in text_lower)
		scores['persuasiveness'] = min(persuasive_count / len(words) * 50, 1.0) if words else 0
		
		# Directness assessment
		direct_indicators = ['must', 'should', 'will', 'recommend', 'require']
		indirect_indicators = ['might consider', 'perhaps', 'could possibly']
		
		direct_count = sum(1 for indicator in direct_indicators if indicator in text_lower)
		indirect_count = sum(1 for indicator in indirect_indicators if indicator in text_lower)
		
		if direct_count + indirect_count > 0:
			scores['directness'] = direct_count / (direct_count + indirect_count)
		else:
			# Use sentence structure as indicator
			avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 20
			scores['directness'] = max(1.0 - (avg_sentence_length - 10) / 20, 0.2)
		
		# Clarity assessment
		if words and sentences:
			avg_word_length = sum(len(word) for word in words) / len(words)
			avg_sentence_length = len(words) / len(sentences)
			
			# Shorter words and sentences = higher clarity
			word_clarity = max(1.0 - (avg_word_length - 4) / 6, 0.2)
			sentence_clarity = max(1.0 - (avg_sentence_length - 15) / 20, 0.2)
			scores['clarity'] = (word_clarity + sentence_clarity) / 2
		else:
			scores['clarity'] = 0.5
		
		# Warmth assessment (subjective indicators)
		warm_words = ['welcome', 'pleased', 'happy', 'appreciate', 'thank', 'grateful']
		cold_words = ['must', 'required', 'mandatory', 'obligation', 'compliance']
		
		warm_count = sum(1 for word in warm_words if word in text_lower)
		cold_count = sum(1 for word in cold_words if word in text_lower)
		
		if warm_count + cold_count > 0:
			scores['warmth'] = warm_count / (warm_count + cold_count)
		else:
			scores['warmth'] = 0.5
		
		# Authority assessment
		authority_words = ['establish', 'determine', 'ensure', 'guarantee', 'mandate']
		humble_words = ['suggest', 'propose', 'consider', 'perhaps', 'humbly']
		
		authority_count = sum(1 for word in authority_words if word in text_lower)
		humble_count = sum(1 for word in humble_words if word in text_lower)
		
		if authority_count + humble_count > 0:
			scores['authority'] = authority_count / (authority_count + humble_count)
		else:
			scores['authority'] = 0.5
		
		return scores
	
	def _calculate_style_delta(self, original: Dict[str, float], transformed: Dict[str, float]) -> Dict[str, float]:
		"""Calculate the change in style scores"""
		delta = {}
		for attribute in original:
			if attribute in transformed:
				delta[attribute] = transformed[attribute] - original[attribute]
		return delta
	
	def _plan_style_transformations(self, current_scores: Dict[str, float], target_profile: StyleProfile) -> List[Tuple[ToneTransformation, float]]:
		"""Plan sequence of transformations needed to reach target profile"""
		transformations = []
		
		# Compare current scores with target profile
		targets = {
			'formality': target_profile.formality_level,
			'technicality': target_profile.technical_level,
			'confidence': target_profile.confidence_level,
			'persuasiveness': target_profile.persuasiveness,
			'directness': target_profile.directness,
			'authority': target_profile.authority
		}
		
		for attribute, target_value in targets.items():
			if attribute in current_scores:
				current_value = current_scores[attribute]
				difference = target_value - current_value
				
				# Only transform if difference is significant
				if abs(difference) > 0.2:
					if attribute == 'formality':
						if difference > 0:
							transformations.append((ToneTransformation.MORE_FORMAL, abs(difference)))
						else:
							transformations.append((ToneTransformation.LESS_FORMAL, abs(difference)))
					
					elif attribute == 'technicality':
						if difference > 0:
							transformations.append((ToneTransformation.MORE_TECHNICAL, abs(difference)))
						else:
							transformations.append((ToneTransformation.LESS_TECHNICAL, abs(difference)))
					
					elif attribute == 'confidence':
						if difference > 0:
							transformations.append((ToneTransformation.MORE_CONFIDENT, abs(difference)))
					
					elif attribute == 'persuasiveness':
						if difference > 0:
							transformations.append((ToneTransformation.MORE_PERSUASIVE, abs(difference)))
					
					elif attribute == 'directness':
						if difference > 0:
							transformations.append((ToneTransformation.MORE_DIRECT, abs(difference)))
		
		# Sort by priority (confidence and formality changes first)
		priority_order = {
			ToneTransformation.MORE_CONFIDENT: 1,
			ToneTransformation.MORE_FORMAL: 2,
			ToneTransformation.LESS_FORMAL: 2,
			ToneTransformation.MORE_PROFESSIONAL: 3,
			ToneTransformation.MORE_DIRECT: 4,
			ToneTransformation.MORE_PERSUASIVE: 5
		}
		
		transformations.sort(key=lambda x: priority_order.get(x[0], 10))
		
		return transformations[:3]  # Limit to 3 transformations to avoid over-processing
	
	async def _ai_transform_tone(
		self,
		text: str,
		transformation: ToneTransformation,
		intensity: float,
		preserve_structure: bool
	) -> TransformationResult:
		"""AI-powered tone transformation using Ollama"""
		if not aiohttp:
			raise ImportError("aiohttp required for AI transformation")
		
		result = TransformationResult()
		result.original_text = text
		result.transformation_type = transformation
		
		# Build transformation prompt
		transformation_descriptions = {
			ToneTransformation.MORE_FORMAL: "more formal and professional",
			ToneTransformation.LESS_FORMAL: "less formal and more conversational",
			ToneTransformation.MORE_PROFESSIONAL: "more professional and business-appropriate",
			ToneTransformation.MORE_CONVERSATIONAL: "more conversational and approachable",
			ToneTransformation.MORE_PERSUASIVE: "more persuasive and compelling",
			ToneTransformation.MORE_TECHNICAL: "more technical and precise",
			ToneTransformation.LESS_TECHNICAL: "less technical and more accessible",
			ToneTransformation.MORE_CONFIDENT: "more confident and assertive",
			ToneTransformation.MORE_DIPLOMATIC: "more diplomatic and tactful",
			ToneTransformation.MORE_DIRECT: "more direct and straightforward"
		}
		
		transformation_desc = transformation_descriptions.get(
			transformation, "adjusted for better style"
		)
		
		intensity_desc = "significantly" if intensity > 0.8 else "moderately" if intensity > 0.5 else "slightly"
		structure_instruction = "Preserve the original structure and organization." if preserve_structure else "Feel free to reorganize for better flow."
		
		# Use advanced prompting if available
		if self.use_advanced_prompting and self.prompt_builder:
			try:
				reasoning_steps = [
					f"Analyze the current tone and style of the text",
					f"Identify specific elements that need to be made {transformation_desc}",
					f"Apply {intensity_desc} transformation while {structure_instruction.lower()}",
					f"Verify the meaning and key information are preserved",
					f"Review the final result for consistency and quality"
				]
				
				context = f"Text needs to be transformed to be {intensity_desc} {transformation_desc}. {structure_instruction}"
				task = f"Transform this text to make it {transformation_desc} while preserving meaning"
				
				prompt = create_chain_of_thought_prompt(
					task=task,
					context=f"{context}\n\nOriginal text: {text}",
					reasoning_steps=reasoning_steps,
					output_format="Provide only the transformed text without additional commentary."
				)
			except Exception as e:
				self.logger.warning(f"Advanced prompting failed, using basic prompt: {e}")
				prompt = f"""Rewrite the following text to make it {intensity_desc} {transformation_desc}. 
{structure_instruction}
Maintain the same meaning and key information while adjusting the tone and style.

Original text:
{text}

Rewritten text:"""
		else:
			prompt = f"""Rewrite the following text to make it {intensity_desc} {transformation_desc}. 
{structure_instruction}
Maintain the same meaning and key information while adjusting the tone and style.

Original text:
{text}

Rewritten text:"""
		
		# Make API call
		timeout = ClientTimeout(total=self.ollama_timeout)
		
		async with aiohttp.ClientSession(timeout=timeout) as session:
			async with session.post(
				f"{self.ollama_base_url}/api/generate",
				json={
					"model": self.ollama_model,
					"prompt": prompt,
					"stream": False,
					"options": {
						"temperature": 0.3,  # Lower temperature for consistent transformations
						"top_p": 0.9,
						"num_predict": min(len(text.split()) * 2, 1000)
					}
				}
			) as response:
				if response.status == 200:
					api_result = await response.json()
					raw_response = api_result.get('response', '').strip()
					
					# Filter thinking tags for deepseek-r1 model
					if 'deepseek-r1' in self.ollama_model.lower():
						transformed_text = filter_thinking_tags(raw_response)
					else:
						transformed_text = raw_response
					
					result.transformed_text = transformed_text
					result.confidence_score = 0.8  # High confidence for AI transformations
					
					# Basic change tracking
					if transformed_text != text:
						result.changes_made = [{
							'type': 'ai_transformation',
							'description': f'Applied {transformation_desc} transformation',
							'original_length': len(text),
							'new_length': len(transformed_text)
						}]
					
				else:
					raise Exception(f"Ollama API error: {response.status}")
		
		return result
	
	async def _rule_based_transform(
		self,
		text: str,
		transformation: ToneTransformation,
		intensity: float
	) -> TransformationResult:
		"""Rule-based transformation as fallback"""
		result = TransformationResult()
		result.original_text = text
		result.transformation_type = transformation
		result.confidence_score = 0.6  # Lower confidence for rule-based
		
		transformed_text = text
		changes_made = []
		
		# Apply transformation rules
		if transformation in self.transformation_rules:
			rules = self.transformation_rules[transformation]
			
			for rule in rules:
				# Apply intensity scaling
				if intensity < 0.5 and rule.priority > 1:
					continue  # Skip lower priority rules for low intensity
				
				# Apply the rule
				pattern = re.compile(rule.pattern, re.IGNORECASE)
				matches = pattern.findall(transformed_text)
				
				if matches:
					transformed_text = pattern.sub(rule.replacement, transformed_text)
					changes_made.append({
						'type': 'rule_based',
						'pattern': rule.pattern,
						'replacement': rule.replacement,
						'description': rule.description,
						'matches': len(matches)
					})
		
		result.transformed_text = transformed_text
		result.changes_made = changes_made
		
		# Calculate improvement score
		if changes_made:
			result.improvement_score = min(len(changes_made) * 0.2, 1.0)
		else:
			result.improvement_score = 0.0
		
		return result
	
	async def _validate_transformation_quality(self, result: StyleTransformationResult):
		"""Validate quality of transformation"""
		if not result.primary_result:
			return
		
		original = result.primary_result.original_text
		transformed = result.primary_result.transformed_text
		
		# Content preservation check
		original_words = set(original.lower().split())
		transformed_words = set(transformed.lower().split())
		
		# Calculate word overlap (should be high for good content preservation)
		overlap = len(original_words & transformed_words)
		total_unique = len(original_words | transformed_words)
		
		if total_unique > 0:
			result.content_preservation = overlap / total_unique
		else:
			result.content_preservation = 1.0
		
		# Length change assessment
		length_change = abs(len(transformed) - len(original)) / len(original) if original else 0
		
		# Penalize extreme length changes
		if length_change > 0.5:
			result.content_preservation *= 0.8
		
		# Style consistency check
		if result.primary_result.style_delta:
			# Check if changes align with intended transformation
			intended_changes = 0
			total_changes = len(result.primary_result.style_delta)
			
			for attribute, delta in result.primary_result.style_delta.items():
				if abs(delta) > 0.1:  # Significant change
					intended_changes += 1
			
			if total_changes > 0:
				result.style_consistency = intended_changes / total_changes
			else:
				result.style_consistency = 0.5
		else:
			result.style_consistency = 0.5
		
		# Overall transformation quality
		quality_factors = [
			result.content_preservation,
			result.style_consistency,
			result.primary_result.confidence_score
		]
		
		result.transformation_quality = sum(quality_factors) / len(quality_factors)
		
		# Add warnings for low quality
		if result.content_preservation < 0.6:
			result.warnings.append("Significant content changes detected - meaning may be altered")
		
		if result.style_consistency < 0.5:
			result.warnings.append("Style changes may not align with intended transformation")
		
		if result.transformation_quality < 0.6:
			result.warnings.append("Overall transformation quality is below recommended threshold")
	
	async def _generate_transformation_suggestions(self, result: StyleTransformationResult) -> List[str]:
		"""Generate suggestions for improving transformation"""
		suggestions = []
		
		if not result.primary_result:
			return suggestions
		
		# Quality-based suggestions
		if result.transformation_quality < 0.7:
			suggestions.append("Consider adjusting transformation intensity for better results")
		
		if result.content_preservation < 0.7:
			suggestions.append("Review transformed text to ensure meaning is preserved")
		
		if result.style_consistency < 0.6:
			suggestions.append("Additional style adjustments may be needed")
		
		# Style delta analysis
		if result.primary_result.style_delta:
			for attribute, delta in result.primary_result.style_delta.items():
				if abs(delta) < 0.1:
					suggestions.append(f"Consider stronger {attribute} adjustment for more noticeable change")
				elif abs(delta) > 0.8:
					suggestions.append(f"{attribute.capitalize()} change may be too extreme")
		
		# Transformation-specific suggestions
		transformation = result.primary_result.transformation_type
		
		if transformation == ToneTransformation.MORE_FORMAL:
			suggestions.append("Consider expanding contractions and using more formal vocabulary")
		elif transformation == ToneTransformation.MORE_PERSUASIVE:
			suggestions.append("Add benefit-focused language and compelling calls to action")
		elif transformation == ToneTransformation.MORE_CONFIDENT:
			suggestions.append("Remove hedging words and use more definitive statements")
		
		return suggestions[:5]  # Limit to 5 suggestions
	
	def _compile_transformation_statistics(self, result: StyleTransformationResult, original_text: str) -> Dict[str, Any]:
		"""Compile comprehensive transformation statistics"""
		stats = {
			'transformation_summary': {
				'success': result.success,
				'model_calls': result.model_calls,
				'tokens_used': result.tokens_used,
				'processing_time': result.processing_time
			}
		}
		
		if result.primary_result:
			stats['text_changes'] = {
				'original_length': len(original_text),
				'transformed_length': len(result.primary_result.transformed_text),
				'length_change_ratio': len(result.primary_result.transformed_text) / len(original_text) if original_text else 1.0,
				'changes_made': len(result.primary_result.changes_made),
				'transformation_type': result.primary_result.transformation_type.value
			}
			
			stats['quality_metrics'] = {
				'transformation_quality': result.transformation_quality,
				'content_preservation': result.content_preservation,
				'style_consistency': result.style_consistency,
				'confidence_score': result.primary_result.confidence_score
			}
			
			if result.primary_result.style_delta:
				stats['style_changes'] = result.primary_result.style_delta
		
		return stats
	
	async def batch_transform(
		self,
		texts: List[str],
		transformation: ToneTransformation,
		intensity: float = 0.7
	) -> List[StyleTransformationResult]:
		"""Transform multiple texts with the same transformation"""
		results = []
		
		# Process texts in parallel (limited concurrency to avoid API overload)
		semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent requests
		
		async def transform_single(text):
			async with semaphore:
				return await self.transform_tone(text, transformation, intensity)
		
		tasks = [transform_single(text) for text in texts]
		results = await asyncio.gather(*tasks, return_exceptions=True)
		
		# Handle any exceptions
		final_results = []
		for i, result in enumerate(results):
			if isinstance(result, Exception):
				error_result = StyleTransformationResult()
				error_result.errors.append(f"Transformation failed: {str(result)}")
				final_results.append(error_result)
			else:
				final_results.append(result)
		
		return final_results
	
	def get_transformer_info(self) -> Dict[str, Any]:
		"""Get comprehensive transformer information"""
		return {
			'transformer_version': '1.0.0',
			'ollama_model': self.ollama_model,
			'supported_transformations': [transform.value for transform in ToneTransformation],
			'supported_style_attributes': [attr.value for attr in StyleAttribute],
			'predefined_profiles': list(self.style_profiles.keys()),
			'features': {
				'ai_transformation': self.use_ai_enhancement and aiohttp is not None,
				'rule_based_fallback': True,
				'quality_validation': self.enable_quality_validation,
				'meaning_preservation': self.preserve_meaning,
				'batch_processing': True,
				'style_profiles': True
			},
			'configuration': {
				'ai_enhancement_enabled': self.use_ai_enhancement,
				'quality_validation_enabled': self.enable_quality_validation,
				'meaning_preservation_enabled': self.preserve_meaning,
				'timeout': self.ollama_timeout
			}
		}
	
	async def close(self):
		"""Close transformer and cleanup resources"""
		self.logger.info("StyleTransformer closed")


# Factory function
def create_style_transformer(config: Optional[Dict[str, Any]] = None) -> StyleTransformer:
	"""Create StyleTransformer instance with configuration"""
	if config is None:
		config = {}
	
	return StyleTransformer(
		ollama_base_url=config.get('ollama_base_url', 'http://localhost:11434'),
		ollama_model=config.get('ollama_model', 'deepseek-r1:32b'),
		ollama_timeout=config.get('ollama_timeout', 120.0),
		use_ai_enhancement=config.get('use_ai_enhancement', True),
		preserve_meaning=config.get('preserve_meaning', True),
		enable_quality_validation=config.get('enable_quality_validation', True),
		use_advanced_prompting=config.get('use_advanced_prompting', True)
	)