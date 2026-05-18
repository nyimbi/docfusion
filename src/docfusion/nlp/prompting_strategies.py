#!/usr/bin/env python3
"""
Advanced Prompting Strategies Module

Implements Chain-of-Thought (CoT) and Tree-of-Thought (ToT) prompting techniques
optimized for deepseek-r1:232b thinking model, with utilities to filter thinking tags.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass, field
from ..core.utils import uuid7str

class PromptingStrategy(str, Enum):
	"""Types of prompting strategies"""
	BASIC = "basic"
	CHAIN_OF_THOUGHT = "chain_of_thought"
	TREE_OF_THOUGHT = "tree_of_thought"
	MULTI_STEP_REASONING = "multi_step_reasoning"
	SELF_REFLECTION = "self_reflection"
	GUIDED_GENERATION = "guided_generation"

class ThoughtBranch(str, Enum):
	"""Tree-of-thought branch types"""
	ANALYSIS = "analysis"
	SYNTHESIS = "synthesis"
	EVALUATION = "evaluation"
	CREATIVE = "creative"
	FACTUAL = "factual"
	CRITICAL = "critical"

@dataclass
class PromptTemplate:
	"""Advanced prompt template with reasoning structure"""
	id: str = field(default_factory=uuid7str)
	name: str = ""
	strategy: PromptingStrategy = PromptingStrategy.BASIC
	system_prompt: str = ""
	user_prompt_template: str = ""
	cot_reasoning_steps: List[str] = field(default_factory=list)
	tot_branches: List[ThoughtBranch] = field(default_factory=list)
	expected_output_format: Dict[str, str] = field(default_factory=dict)
	quality_criteria: List[str] = field(default_factory=list)
	examples: List[Dict[str, str]] = field(default_factory=list)

def filter_thinking_tags(text: str) -> str:
	"""
	Remove <think>...</think> tags and content from deepseek-r1 responses.
	
	Args:
		text: Raw response from deepseek-r1:32b model
		
	Returns:
		Cleaned text with thinking content removed
	"""
	if not text or not isinstance(text, str):
		return text
	
	# Remove <think>...</think> blocks (including nested tags and multiline)
	# Use DOTALL flag to match newlines within thinking blocks
	cleaned = re.sub(
		r'<think\s*>.*?</think\s*>', 
		'', 
		text, 
		flags=re.DOTALL | re.IGNORECASE
	)
	
	# Clean up any remaining whitespace artifacts
	cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)  # Remove excessive newlines
	cleaned = cleaned.strip()
	
	return cleaned

def create_chain_of_thought_prompt(
	task: str,
	context: str,
	reasoning_steps: List[str],
	output_format: Optional[str] = None,
	examples: Optional[List[Dict[str, str]]] = None
) -> str:
	"""
	Create a Chain-of-Thought prompt that guides the model through step-by-step reasoning.
	
	Args:
		task: The main task or question
		context: Background information and context
		reasoning_steps: List of reasoning steps to follow
		output_format: Expected output format
		examples: Optional examples to demonstrate the reasoning process
		
	Returns:
		Formatted CoT prompt
	"""
	prompt_parts = []
	
	# System instruction for Chain-of-Thought
	prompt_parts.append("""You are an expert analysis system. Please follow a systematic Chain-of-Thought approach to reason through this task step-by-step.

Think through each step carefully and show your reasoning process. Your response should demonstrate clear logical progression from initial analysis to final conclusion.""")
	
	# Add examples if provided
	if examples:
		prompt_parts.append("\n## Examples of Chain-of-Thought Reasoning:")
		for i, example in enumerate(examples, 1):
			prompt_parts.append(f"\n### Example {i}:")
			if 'input' in example:
				prompt_parts.append(f"Input: {example['input']}")
			if 'reasoning' in example:
				prompt_parts.append(f"Reasoning: {example['reasoning']}")
			if 'output' in example:
				prompt_parts.append(f"Output: {example['output']}")
	
	# Main task
	prompt_parts.append(f"\n## Task:\n{task}")
	
	# Context
	if context:
		prompt_parts.append(f"\n## Context:\n{context}")
	
	# Reasoning steps
	prompt_parts.append("\n## Please follow these reasoning steps:")
	for i, step in enumerate(reasoning_steps, 1):
		prompt_parts.append(f"{i}. {step}")
	
	# Output format
	if output_format:
		prompt_parts.append(f"\n## Expected Output Format:\n{output_format}")
	
	prompt_parts.append("\n## Your Analysis:")
	prompt_parts.append("Please work through each step systematically and provide your complete reasoning and final answer.")
	
	return "\n".join(prompt_parts)

def create_tree_of_thought_prompt(
	task: str,
	context: str,
	thought_branches: List[ThoughtBranch],
	depth: int = 3,
	evaluation_criteria: Optional[List[str]] = None
) -> str:
	"""
	Create a Tree-of-Thought prompt that explores multiple reasoning paths.
	
	Args:
		task: The main task or question
		context: Background information and context  
		thought_branches: Different types of reasoning branches to explore
		depth: How deep to explore each branch
		evaluation_criteria: Criteria for evaluating different thought paths
		
	Returns:
		Formatted ToT prompt
	"""
	prompt_parts = []
	
	# System instruction for Tree-of-Thought
	prompt_parts.append("""You are an expert reasoning system that explores multiple thought pathways. Please use a Tree-of-Thought approach to explore different reasoning branches systematically.

For each branch, think deeply and explore different possibilities. Then evaluate and synthesize the best insights from all branches.""")
	
	# Main task
	prompt_parts.append(f"\n## Task:\n{task}")
	
	# Context
	if context:
		prompt_parts.append(f"\n## Context:\n{context}")
	
	# Thought branches
	prompt_parts.append(f"\n## Explore these {len(thought_branches)} reasoning branches:")
	
	branch_descriptions = {
		ThoughtBranch.ANALYSIS: "Break down the problem systematically and analyze each component",
		ThoughtBranch.SYNTHESIS: "Combine different elements to form new insights and connections", 
		ThoughtBranch.EVALUATION: "Critically assess options, trade-offs, and implications",
		ThoughtBranch.CREATIVE: "Explore innovative and unconventional approaches",
		ThoughtBranch.FACTUAL: "Focus on objective data, evidence, and established facts",
		ThoughtBranch.CRITICAL: "Challenge assumptions and identify potential weaknesses"
	}
	
	for i, branch in enumerate(thought_branches, 1):
		description = branch_descriptions.get(branch, f"Explore the {branch.value} perspective")
		prompt_parts.append(f"\n### Branch {i}: {branch.value.title()} Reasoning")
		prompt_parts.append(f"- {description}")
		prompt_parts.append(f"- Explore this path with {depth} levels of depth")
		prompt_parts.append(f"- Consider multiple sub-possibilities within this branch")
	
	# Evaluation criteria
	if evaluation_criteria:
		prompt_parts.append("\n## Evaluation Criteria:")
		for criterion in evaluation_criteria:
			prompt_parts.append(f"- {criterion}")
	
	# Instructions
	prompt_parts.append("\n## Instructions:")
	prompt_parts.append("1. Explore each reasoning branch thoroughly")
	prompt_parts.append("2. Generate multiple thought paths within each branch")
	prompt_parts.append("3. Evaluate the quality and validity of each path")
	prompt_parts.append("4. Synthesize the best insights from all branches")
	prompt_parts.append("5. Provide a comprehensive conclusion based on your multi-path analysis")
	
	return "\n".join(prompt_parts)

def create_multi_step_reasoning_prompt(
	task: str,
	context: str,
	steps: List[Dict[str, str]],
	validation_questions: Optional[List[str]] = None
) -> str:
	"""
	Create a multi-step reasoning prompt with validation at each step.
	
	Args:
		task: The main task
		context: Background context
		steps: List of steps, each with 'name', 'description', and 'output' keys
		validation_questions: Questions to validate reasoning at each step
		
	Returns:
		Formatted multi-step reasoning prompt
	"""
	prompt_parts = []
	
	prompt_parts.append("""You are an expert analyst that follows a rigorous multi-step reasoning process. Please work through each step methodically and validate your reasoning at each stage.""")
	
	prompt_parts.append(f"\n## Task:\n{task}")
	
	if context:
		prompt_parts.append(f"\n## Context:\n{context}")
	
	prompt_parts.append("\n## Multi-Step Reasoning Process:")
	
	for i, step in enumerate(steps, 1):
		prompt_parts.append(f"\n### Step {i}: {step.get('name', f'Step {i}')}")
		prompt_parts.append(f"**Description:** {step.get('description', '')}")
		if 'output' in step:
			prompt_parts.append(f"**Expected Output:** {step['output']}")
		
		if validation_questions:
			prompt_parts.append("**Validation Questions:**")
			for q in validation_questions:
				prompt_parts.append(f"- {q}")
	
	prompt_parts.append("\n## Instructions:")
	prompt_parts.append("1. Complete each step thoroughly before moving to the next")
	prompt_parts.append("2. Validate your reasoning at each step")
	prompt_parts.append("3. If you find issues, revisit and refine previous steps")
	prompt_parts.append("4. Build each step on the solid foundation of previous steps")
	prompt_parts.append("5. Provide a comprehensive final synthesis")
	
	return "\n".join(prompt_parts)

def create_self_reflection_prompt(
	task: str,
	context: str,
	reflection_questions: List[str],
	quality_criteria: List[str]
) -> str:
	"""
	Create a self-reflection prompt that asks the model to evaluate its own reasoning.
	
	Args:
		task: The main task
		context: Background context
		reflection_questions: Questions for self-reflection
		quality_criteria: Criteria for evaluating response quality
		
	Returns:
		Formatted self-reflection prompt
	"""
	prompt_parts = []
	
	prompt_parts.append("""You are an expert analyst with strong self-reflection capabilities. Please approach this task thoughtfully, then critically evaluate your own reasoning and conclusions.""")
	
	prompt_parts.append(f"\n## Task:\n{task}")
	
	if context:
		prompt_parts.append(f"\n## Context:\n{context}")
	
	prompt_parts.append("\n## Phase 1: Initial Analysis")
	prompt_parts.append("Provide your initial analysis and conclusions for the task.")
	
	prompt_parts.append("\n## Phase 2: Self-Reflection")
	prompt_parts.append("Now critically examine your analysis by answering these reflection questions:")
	
	for i, question in enumerate(reflection_questions, 1):
		prompt_parts.append(f"{i}. {question}")
	
	prompt_parts.append("\n## Phase 3: Quality Assessment")
	prompt_parts.append("Evaluate your analysis against these quality criteria:")
	
	for criterion in quality_criteria:
		prompt_parts.append(f"- {criterion}")
	
	prompt_parts.append("\n## Phase 4: Refined Conclusion")
	prompt_parts.append("Based on your self-reflection, provide a refined and improved conclusion.")
	
	return "\n".join(prompt_parts)

class AdvancedPromptBuilder:
	"""Builder class for creating sophisticated prompts with advanced techniques"""
	
	def __init__(self, model_name: str = "deepseek-r1:32b"):
		self.model_name = model_name
		self.logger = logging.getLogger(__name__)
		
		# Pre-defined prompt templates for common NLP tasks
		self.templates = self._initialize_templates()
	
	def _initialize_templates(self) -> Dict[str, PromptTemplate]:
		"""Initialize pre-built templates for common NLP tasks"""
		templates = {}
		
		# Content Generation Template
		templates['content_generation'] = PromptTemplate(
			name="Advanced Content Generation",
			strategy=PromptingStrategy.CHAIN_OF_THOUGHT,
			system_prompt="""You are an expert content strategist and writer. Use systematic reasoning to create high-quality, targeted content.""",
			cot_reasoning_steps=[
				"Analyze the content requirements and target audience",
				"Identify key messages and value propositions",
				"Structure the content for maximum impact",
				"Draft content with appropriate tone and style",
				"Review and refine for clarity and persuasiveness"
			],
			expected_output_format={
				"reasoning": "Step-by-step analysis of content requirements",
				"content": "Generated content matching specifications",
				"quality_assessment": "Evaluation of content effectiveness"
			}
		)
		
		# Document Analysis Template
		templates['document_analysis'] = PromptTemplate(
			name="Advanced Document Analysis",
			strategy=PromptingStrategy.TREE_OF_THOUGHT,
			tot_branches=[
				ThoughtBranch.ANALYSIS,
				ThoughtBranch.EVALUATION, 
				ThoughtBranch.SYNTHESIS
			],
			quality_criteria=[
				"Thoroughness of analysis",
				"Accuracy of insights", 
				"Actionability of recommendations",
				"Clarity of presentation"
			]
		)
		
		# Style Analysis Template
		templates['style_analysis'] = PromptTemplate(
			name="Advanced Style Analysis", 
			strategy=PromptingStrategy.MULTI_STEP_REASONING,
			cot_reasoning_steps=[
				"Examine linguistic features and patterns",
				"Analyze tone, formality, and audience alignment",
				"Evaluate coherence and flow",
				"Assess persuasiveness and engagement",
				"Synthesize overall style assessment"
			]
		)
		
		return templates
	
	def build_cot_prompt(
		self,
		task: str,
		context: str,
		template_name: Optional[str] = None,
		custom_steps: Optional[List[str]] = None
	) -> str:
		"""Build a Chain-of-Thought prompt"""
		if template_name and template_name in self.templates:
			template = self.templates[template_name]
			steps = template.cot_reasoning_steps
		else:
			steps = custom_steps or [
				"Understand the task and requirements",
				"Analyze the given information",
				"Apply relevant knowledge and reasoning",
				"Draw logical conclusions",
				"Present findings clearly"
			]
		
		return create_chain_of_thought_prompt(
			task=task,
			context=context, 
			reasoning_steps=steps
		)
	
	def build_tot_prompt(
		self,
		task: str,
		context: str,
		template_name: Optional[str] = None,
		custom_branches: Optional[List[ThoughtBranch]] = None
	) -> str:
		"""Build a Tree-of-Thought prompt"""
		if template_name and template_name in self.templates:
			template = self.templates[template_name]
			branches = template.tot_branches
		else:
			branches = custom_branches or [
				ThoughtBranch.ANALYSIS,
				ThoughtBranch.EVALUATION,
				ThoughtBranch.SYNTHESIS
			]
		
		return create_tree_of_thought_prompt(
			task=task,
			context=context,
			thought_branches=branches
		)
	
	def process_model_response(self, raw_response: str) -> Dict[str, Any]:
		"""
		Process raw model response, filtering thinking tags and extracting insights.
		
		Args:
			raw_response: Raw response from deepseek-r1:232b
			
		Returns:
			Processed response with thinking content removed and metadata extracted
		"""
		# Filter out thinking tags
		cleaned_response = filter_thinking_tags(raw_response)
		
		# Extract any structured data (JSON blocks, etc.)
		structured_data = self._extract_structured_data(cleaned_response)
		
		# Analyze response quality
		quality_metrics = self._assess_response_quality(cleaned_response)
		
		return {
			'original_response': raw_response,
			'cleaned_response': cleaned_response,
			'structured_data': structured_data,
			'quality_metrics': quality_metrics,
			'has_thinking_content': '<think>' in raw_response.lower(),
			'response_length': len(cleaned_response),
			'processing_notes': []
		}
	
	def _extract_structured_data(self, text: str) -> Dict[str, Any]:
		"""Extract structured data from response text"""
		structured = {}
		
		# Look for JSON blocks
		json_pattern = r'```json\s*(\{.*?\})\s*```'
		json_matches = re.findall(json_pattern, text, re.DOTALL)
		
		for i, match in enumerate(json_matches):
			try:
				structured[f'json_block_{i}'] = json.loads(match)
			except json.JSONDecodeError:
				self.logger.warning("json.JSONDecodeError in _extract_structured_data")
		
		# Look for markdown sections
		section_pattern = r'## ([^#\n]+)\n(.*?)(?=\n## |\n### |\Z)'
		section_matches = re.findall(section_pattern, text, re.DOTALL)
		
		sections = {}
		for title, content in section_matches:
			sections[title.strip().lower().replace(' ', '_')] = content.strip()
		
		if sections:
			structured['sections'] = sections
		
		return structured
	
	def _assess_response_quality(self, text: str) -> Dict[str, float]:
		"""Assess the quality of the response"""
		if not text:
			return {'overall': 0.0}
		
		metrics = {}
		
		# Length appropriateness (not too short or excessively long)
		length = len(text)
		if 50 <= length <= 5000:
			metrics['length_score'] = 1.0
		elif length < 50:
			metrics['length_score'] = length / 50.0
		else:
			metrics['length_score'] = max(0.5, 5000 / length)
		
		# Structure score (presence of headings, bullet points, etc.)
		structure_indicators = len(re.findall(r'(^#+\s|\n#+\s|^\*\s|\n\*\s|^\d+\.\s|\n\d+\.\s)', text, re.MULTILINE))
		metrics['structure_score'] = min(1.0, structure_indicators / 5.0)
		
		# Coherence score (simple heuristic based on transitions and connectives)
		coherence_words = len(re.findall(r'\b(therefore|however|moreover|furthermore|consequently|thus|hence)\b', text, re.IGNORECASE))
		metrics['coherence_score'] = min(1.0, coherence_words / 3.0)
		
		# Calculate overall score
		metrics['overall'] = sum(metrics.values()) / len(metrics)
		
		return metrics

# Factory function
def create_advanced_prompt_builder(model_name: str = "deepseek-r1:32b") -> AdvancedPromptBuilder:
	"""Create AdvancedPromptBuilder instance"""
	return AdvancedPromptBuilder(model_name=model_name)