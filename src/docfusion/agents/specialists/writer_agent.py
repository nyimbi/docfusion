import asyncio
import logging
from typing import Any, Dict, List, Optional, Set, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
import statistics
from ..core.agent import Agent, AgentConfig, AgentCapabilities, AgentState
from ..core.roles import AgentRole, get_role_definition
from ..core.messages import AgentMessage, MessageType, MessageTemplates
from ...voice_dna import VoiceIntegrator, AnalysisRequest, AnalysisType
from ...document_engine.service import DocumentGenerationService
import re
"""
Writer Agent

Specialized agent for content creation, proposal writing, and document
generation with voice consistency and quality optimization.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""



# Integration imports


@dataclass
class WritingTask:
	"""Writing task specification"""
	task_id: str
	content_type: str  # "proposal", "executive_summary", "technical_doc", "marketing_content"
	topic: str
	requirements: Dict[str, Any]
	style_guide: Optional[Dict[str, Any]] = None
	target_audience: Optional[str] = None
	voice_profile: Optional[str] = None
	deadline: Optional[datetime] = None
	constraints: Dict[str, Any] = field(default_factory=dict)
	source_materials: List[Dict[str, Any]] = field(default_factory=list)
	quality_standards: Dict[str, float] = field(default_factory=dict)


@dataclass
class WritingResult:
	"""Writing task result"""
	task_id: str
	content_type: str
	generated_content: Dict[str, str]  # Different versions/sections
	voice_analysis: Optional[Dict[str, Any]]
	quality_metrics: Dict[str, float]
	style_compliance: Dict[str, float]
	word_count: int
	readability_score: float
	engagement_score: float
	recommendations: List[str]
	alternatives: List[Dict[str, str]]
	metadata: Dict[str, Any]


class WriterAgent(Agent[WritingTask]):
	"""
	Specialized writing agent for content creation and document generation
	
	Capabilities:
	- Proposal writing and structuring
	- Executive summary creation
	- Technical documentation
	- Marketing content development
	- Voice consistency maintenance
	- Style guide compliance
	- Content quality optimization
	"""
	
	def __init__(self, config: Optional[AgentConfig] = None):
		# Set up writer agent configuration
		if config is None:
			config = self._create_default_config()
		
		super().__init__(config)
		
		# Specialized components for writing
		self.document_service = DocumentGenerationService()
		
		# Writing-specific state
		self.active_writing_tasks: Dict[str, WritingTask] = {}
		self.content_templates: Dict[str, Dict[str, Any]] = {}
		self.voice_profiles: Dict[str, Any] = {}
		self.writing_styles: Set[str] = {
			"professional", "technical", "persuasive", "informative",
			"creative", "formal", "conversational", "executive"
		}
		
		# Writing tools and capabilities
		self.writing_tools = {
			"content_generation": True,
			"voice_analysis": True,
			"style_checking": True,
			"quality_assessment": True,
			"template_management": True,
			"collaboration": True
		}
		
		# Content type expertise
		self.content_expertise = {
			"proposal": 0.95,
			"executive_summary": 0.9,
			"technical_doc": 0.85,
			"marketing_content": 0.8,
			"business_plan": 0.85,
			"presentation": 0.8,
			"email": 0.9,
			"report": 0.9
		}
		
		# Initialize writing goals and templates
		self._setup_writing_goals()
		self._load_content_templates()
		
		self.logger.info(f"Writer Agent {self.name} initialized with content types: {list(self.content_expertise.keys())}")
	
	def _create_default_config(self) -> AgentConfig:
		"""Create default configuration for writer agent"""
		role_def = get_role_definition(AgentRole.WRITER)
		
		return AgentConfig(
			name="Content Writer",
			description="Professional content creation and proposal writing agent",
			primary_role="writer",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=3,
				expertise_domains=["content_writing", "proposal_generation", "technical_writing"],
				supported_task_types=["writing", "editing", "content_creation", "proposal_drafting"],
				quality_threshold=0.85
			),
			personality_traits={
				"creativity": 0.9,
				"attention_to_detail": 0.9,
				"communication": 0.95,
				"adaptability": 0.8
			},
			creativity_level=0.9,
			risk_tolerance=0.6,
			voice_analysis_enabled=True,
			intelligence_integration=True,
			# LLM configuration optimized for creative writing
			llm_model="qwen2.5:1.5b",
			llm_temperature=0.8,  # Higher temperature for more creative writing
			llm_max_tokens=4096   # Larger token limit for longer content
		)
	
	def _setup_writing_goals(self) -> None:
		"""Set up writing-specific goals"""
		self.set_goal("content_quality", "Maintain exceptional content quality", 0.9)
		self.set_goal("voice_consistency", "Ensure consistent brand voice", 0.92)
		self.set_goal("readability", "Achieve optimal readability scores", 0.85)
		self.set_goal("engagement", "Create engaging and compelling content", 0.88)
		self.set_goal("style_compliance", "Maintain style guide compliance", 0.95)
		self.set_goal("writing_efficiency", "Optimize writing speed and quality", 0.8)
	
	def _load_content_templates(self) -> None:
		"""Load content templates for different document types"""
		self.content_templates = {
			"proposal": {
				"structure": [
					"Executive Summary",
					"Problem Statement",
					"Proposed Solution",
					"Implementation Plan",
					"Timeline and Milestones",
					"Budget and Pricing",
					"Team and Qualifications",
					"Risk Assessment",
					"Conclusion"
				],
				"tone": "professional",
				"style": "persuasive",
				"word_count_range": (2000, 8000)
			},
			"executive_summary": {
				"structure": [
					"Overview",
					"Key Objectives",
					"Main Benefits",
					"Investment Requirements",
					"Expected Outcomes",
					"Recommendation"
				],
				"tone": "executive",
				"style": "concise",
				"word_count_range": (300, 1000)
			},
			"technical_doc": {
				"structure": [
					"Introduction",
					"Technical Requirements",
					"Architecture Overview",
					"Implementation Details",
					"Testing and Validation",
					"Deployment Considerations",
					"Appendices"
				],
				"tone": "technical",
				"style": "detailed",
				"word_count_range": (1500, 5000)
			},
			"marketing_content": {
				"structure": [
					"Attention-grabbing Hook",
					"Problem Identification",
					"Solution Presentation",
					"Benefits and Value",
					"Social Proof",
					"Call to Action"
				],
				"tone": "engaging",
				"style": "persuasive",
				"word_count_range": (500, 2000)
			}
		}
	
	# Core agent implementation
	
	async def process_task(self, task: WritingTask) -> WritingResult:
		"""Process a writing task"""
		self.logger.info(f"Processing writing task: {task.content_type} - {task.topic}")
		
		# Store active task
		self.active_writing_tasks[task.task_id] = task
		
		try:
			# Route to appropriate writing method
			if task.content_type == "proposal":
				result = await self._write_proposal(task)
			elif task.content_type == "executive_summary":
				result = await self._write_executive_summary(task)
			elif task.content_type == "technical_doc":
				result = await self._write_technical_document(task)
			elif task.content_type == "marketing_content":
				result = await self._write_marketing_content(task)
			else:
				result = await self._write_general_content(task)
			
			# Analyze voice consistency if voice analysis is enabled
			if self.voice_integrator and task.voice_profile:
				voice_analysis = await self._analyze_voice_consistency(
					result.generated_content.get("main_content", ""),
					task.voice_profile
				)
				result.voice_analysis = voice_analysis
			
			# Update writing metrics
			await self._update_writing_metrics(task, result)
			
			self.logger.info(f"Writing task {task.task_id} completed with quality score: {result.quality_metrics.get('overall', 0.0):.2f}")
			return result
			
		except Exception as e:
			self.logger.error(f"Writing task {task.task_id} failed: {e}")
			raise
		finally:
			# Clean up active task
			self.active_writing_tasks.pop(task.task_id, None)
	
	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle incoming messages"""
		message_type = message.header.message_type
		
		if message_type == MessageType.TASK_REQUEST:
			return await self._handle_writing_request(message)
		elif message_type == MessageType.COLLABORATION_REQUEST:
			return await self._handle_collaboration_request(message)
		elif message_type == MessageType.INFORMATION_SHARE:
			return await self._handle_content_feedback(message)
		elif message_type == MessageType.STATUS_REQUEST:
			return await self._handle_status_request(message)
		else:
			self.logger.debug(f"Unhandled message type: {message_type}")
			return None
	
	def get_capabilities(self) -> List[str]:
		"""Return writing agent capabilities"""
		return [
			"proposal_writing",
			"executive_summaries",
			"technical_documentation",
			"marketing_content",
			"business_plans",
			"content_editing",
			"voice_consistency",
			"style_compliance",
			"quality_optimization",
			"collaborative_writing"
		]
	
	async def evaluate_task_fit(self, task: WritingTask) -> float:
		"""Evaluate how well this agent fits a writing task"""
		fit_score = 0.0
		
		# Base fit for writing tasks
		if isinstance(task, WritingTask):
			fit_score = 0.8
		else:
			return 0.0
		
		# Content type expertise
		expertise_score = self.content_expertise.get(task.content_type, 0.6)
		fit_score *= expertise_score
		
		# Style compatibility
		if task.style_guide and task.style_guide.get("style") in self.writing_styles:
			fit_score *= 1.1
		
		# Current workload consideration
		workload_factor = 1.0 - (len(self.active_writing_tasks) / self.config.capabilities.max_concurrent_tasks)
		fit_score *= workload_factor
		
		# Quality requirements alignment
		if task.quality_standards:
			required_quality = task.quality_standards.get("overall", 0.8)
			if required_quality <= 0.9:  # Writer can handle high quality requirements
				fit_score *= 1.0
			else:
				fit_score *= 0.9  # Slight penalty for extreme quality requirements
		
		return min(1.0, fit_score)
	
	# Content generation methods
	
	async def _write_proposal(self, task: WritingTask) -> WritingResult:
		"""Write a comprehensive proposal"""
		self.logger.info(f"Writing proposal: {task.topic}")
		
		template = self.content_templates["proposal"]
		generated_content = {}
		
		# Generate each section of the proposal
		sections = template["structure"]
		
		# Executive Summary
		generated_content["executive_summary"] = await self._generate_executive_summary_section(task)
		
		# Problem Statement
		generated_content["problem_statement"] = await self._generate_problem_statement(task)
		
		# Proposed Solution
		generated_content["proposed_solution"] = await self._generate_solution_section(task)
		
		# Implementation Plan
		generated_content["implementation_plan"] = await self._generate_implementation_section(task)
		
		# Timeline and Milestones
		generated_content["timeline"] = await self._generate_timeline_section(task)
		
		# Budget and Pricing
		generated_content["budget"] = await self._generate_budget_section(task)
		
		# Team and Qualifications
		generated_content["team_qualifications"] = await self._generate_team_section(task)
		
		# Risk Assessment
		generated_content["risk_assessment"] = await self._generate_risk_section(task)
		
		# Conclusion
		generated_content["conclusion"] = await self._generate_conclusion_section(task)
		
		# Combine all sections
		main_content = "\n\n".join([
			f"# {section.upper()}\n\n{content}"
			for section, content in generated_content.items()
		])
		generated_content["main_content"] = main_content
		
		# Calculate metrics
		quality_metrics = await self._calculate_quality_metrics(main_content, task)
		style_compliance = await self._check_style_compliance(main_content, task)
		word_count = len(main_content.split())
		readability_score = await self._calculate_readability(main_content)
		engagement_score = await self._calculate_engagement(main_content)
		
		# Generate recommendations
		recommendations = await self._generate_content_recommendations(main_content, task)
		
		# Create alternative versions
		alternatives = await self._create_content_alternatives(main_content, task)
		
		return WritingResult(
			task_id=task.task_id,
			content_type=task.content_type,
			generated_content=generated_content,
			voice_analysis=None,  # Will be added if voice analysis is enabled
			quality_metrics=quality_metrics,
			style_compliance=style_compliance,
			word_count=word_count,
			readability_score=readability_score,
			engagement_score=engagement_score,
			recommendations=recommendations,
			alternatives=alternatives,
			metadata={
				"sections_generated": len(sections),
				"template_used": "proposal",
				"generation_approach": "section_by_section"
			}
		)
	
	async def _write_executive_summary(self, task: WritingTask) -> WritingResult:
		"""Write an executive summary"""
		self.logger.info(f"Writing executive summary: {task.topic}")
		
		template = self.content_templates["executive_summary"]
		
		# Generate concise, executive-focused content
		content_parts = []
		
		# Overview
		overview = f"""
**Executive Overview**

{task.topic} represents a strategic opportunity to enhance our competitive position 
and deliver measurable value to stakeholders. This initiative aligns with our 
organizational objectives and market positioning strategy.
		""".strip()
		content_parts.append(overview)
		
		# Key Objectives
		objectives = f"""
**Key Objectives**

• Establish market leadership in {task.requirements.get('domain', 'target market')}
• Deliver exceptional value to clients and stakeholders
• Achieve sustainable competitive advantage
• Generate measurable ROI within specified timeframe
		""".strip()
		content_parts.append(objectives)
		
		# Main Benefits
		benefits = f"""
**Strategic Benefits**

The proposed approach delivers significant advantages including enhanced operational 
efficiency, improved market positioning, and accelerated growth potential. Key benefits 
include reduced risk exposure, increased revenue opportunities, and strengthened 
stakeholder relationships.
		""".strip()
		content_parts.append(benefits)
		
		# Investment Requirements
		investment = f"""
**Investment Requirements**

Implementation requires strategic investment in technology, resources, and expertise. 
The proposed budget reflects market standards and ensures successful project delivery 
with appropriate risk mitigation measures.
		""".strip()
		content_parts.append(investment)
		
		# Expected Outcomes
		outcomes = f"""
**Expected Outcomes**

Success metrics include measurable improvements in operational efficiency, 
market share growth, and stakeholder satisfaction. Projected timeline for 
full benefits realization is {task.requirements.get('timeline', '12-18 months')}.
		""".strip()
		content_parts.append(outcomes)
		
		# Recommendation
		recommendation = f"""
**Recommendation**

We recommend proceeding with this strategic initiative. The combination of 
market opportunity, organizational readiness, and expected returns presents 
a compelling business case for immediate action.
		""".strip()
		content_parts.append(recommendation)
		
		# Combine all parts
		main_content = "\n\n".join(content_parts)
		generated_content = {
			"main_content": main_content,
			"overview": overview,
			"objectives": objectives,
			"benefits": benefits,
			"investment": investment,
			"outcomes": outcomes,
			"recommendation": recommendation
		}
		
		# Calculate metrics
		quality_metrics = await self._calculate_quality_metrics(main_content, task)
		style_compliance = await self._check_style_compliance(main_content, task)
		word_count = len(main_content.split())
		readability_score = await self._calculate_readability(main_content)
		engagement_score = await self._calculate_engagement(main_content)
		
		recommendations = [
			"Consider adding specific metrics and KPIs",
			"Include competitive differentiation points",
			"Strengthen value proposition statements"
		]
		
		alternatives = [
			{"version": "detailed", "content": main_content + "\n\n[Additional detail sections would be added here]"},
			{"version": "concise", "content": main_content.replace("\n\n", "\n")[:500] + "..."}
		]
		
		return WritingResult(
			task_id=task.task_id,
			content_type=task.content_type,
			generated_content=generated_content,
			voice_analysis=None,
			quality_metrics=quality_metrics,
			style_compliance=style_compliance,
			word_count=word_count,
			readability_score=readability_score,
			engagement_score=engagement_score,
			recommendations=recommendations,
			alternatives=alternatives,
			metadata={
				"template_used": "executive_summary",
				"target_audience": "executives",
				"style": "concise_persuasive"
			}
		)
	
	async def _write_technical_document(self, task: WritingTask) -> WritingResult:
		"""Write technical documentation"""
		self.logger.info(f"Writing technical document: {task.topic}")
		
		# Generate technical content with appropriate depth and precision
		content_sections = []
		
		# Introduction
		intro = f"""
# Introduction

This document provides comprehensive technical specifications and implementation 
guidance for {task.topic}. The solution architecture, design decisions, and 
implementation approach are detailed to ensure successful project delivery.

## Scope and Objectives

The technical solution addresses key requirements while maintaining scalability, 
security, and performance standards. Implementation follows industry best practices 
and organizational technical guidelines.
		""".strip()
		content_sections.append(intro)
		
		# Technical Requirements
		requirements = f"""
# Technical Requirements

## Functional Requirements
- Core functionality implementation
- Integration capabilities
- Performance specifications
- Security requirements

## Non-Functional Requirements
- Scalability: Support for concurrent users and data volume growth
- Reliability: 99.9% uptime with fault tolerance mechanisms
- Security: End-to-end encryption and access controls
- Performance: Response times under specified thresholds
		""".strip()
		content_sections.append(requirements)
		
		# Architecture Overview
		architecture = f"""
# Solution Architecture

## High-Level Architecture
The solution employs a modular architecture with clear separation of concerns. 
Key components include data layer, business logic layer, and presentation layer 
with appropriate abstraction and integration points.

## Technology Stack
- Platform: {task.requirements.get('platform', 'Cloud-native')}
- Framework: {task.requirements.get('framework', 'Modern frameworks')}
- Database: {task.requirements.get('database', 'Scalable database solution')}
- Integration: RESTful APIs and message queuing systems
		""".strip()
		content_sections.append(architecture)
		
		# Implementation Details
		implementation = f"""
# Implementation Approach

## Development Methodology
Implementation follows agile development practices with iterative delivery 
and continuous integration. Code quality is maintained through automated 
testing and code review processes.

## Key Implementation Phases
1. Foundation and core infrastructure setup
2. Core functionality development and testing
3. Integration and system testing
4. User acceptance testing and deployment
5. Production monitoring and optimization
		""".strip()
		content_sections.append(implementation)
		
		main_content = "\n\n".join(content_sections)
		generated_content = {
			"main_content": main_content,
			"introduction": intro,
			"requirements": requirements,
			"architecture": architecture,
			"implementation": implementation
		}
		
		# Calculate metrics
		quality_metrics = await self._calculate_quality_metrics(main_content, task)
		style_compliance = await self._check_style_compliance(main_content, task)
		word_count = len(main_content.split())
		readability_score = await self._calculate_readability(main_content)
		engagement_score = await self._calculate_engagement(main_content)
		
		recommendations = [
			"Add detailed diagrams and technical illustrations",
			"Include code samples and configuration examples",
			"Provide troubleshooting and FAQ sections"
		]
		
		alternatives = [
			{"version": "detailed", "content": main_content + "\n\n[Detailed technical appendices]"},
			{"version": "summary", "content": intro + "\n\n[Key points summary]"}
		]
		
		return WritingResult(
			task_id=task.task_id,
			content_type=task.content_type,
			generated_content=generated_content,
			voice_analysis=None,
			quality_metrics=quality_metrics,
			style_compliance=style_compliance,
			word_count=word_count,
			readability_score=readability_score,
			engagement_score=engagement_score,
			recommendations=recommendations,
			alternatives=alternatives,
			metadata={
				"template_used": "technical_doc",
				"technical_level": "detailed",
				"audience": "technical_professionals"
			}
		)
	
	async def _write_marketing_content(self, task: WritingTask) -> WritingResult:
		"""Write engaging marketing content"""
		self.logger.info(f"Writing marketing content: {task.topic}")
		
		# Generate persuasive, engaging marketing content
		content_parts = []
		
		# Hook
		hook = f"""
Transform your {task.requirements.get('domain', 'business')} with {task.topic} - 
the solution that industry leaders trust for exceptional results and 
competitive advantage.
		""".strip()
		content_parts.append(hook)
		
		# Problem identification
		problem = f"""
**The Challenge You Face**

Organizations struggle with complex challenges that demand innovative solutions. 
Traditional approaches fall short of delivering the results needed to thrive 
in today's competitive landscape. You need a proven solution that delivers 
measurable outcomes.
		""".strip()
		content_parts.append(problem)
		
		# Solution presentation
		solution = f"""
**Our Solution: {task.topic}**

We provide comprehensive solutions that address your specific needs with 
precision and expertise. Our approach combines industry best practices 
with innovative methodologies to deliver exceptional value and results.

Key differentiators:
• Proven track record of success
• Expert team and resources  
• Customized approach for your needs
• Ongoing support and optimization
		""".strip()
		content_parts.append(solution)
		
		# Benefits and value
		benefits = f"""
**Measurable Benefits**

✓ Increased operational efficiency and productivity
✓ Enhanced competitive positioning and market share
✓ Improved ROI and cost optimization
✓ Reduced risk and enhanced compliance
✓ Accelerated growth and scalability
		""".strip()
		content_parts.append(benefits)
		
		# Call to action
		cta = f"""
**Take Action Today**

Don't let another opportunity pass by. Contact us now to discover how 
{task.topic} can transform your organization and deliver the results 
you need to succeed.

Ready to get started? Let's discuss your specific requirements and 
create a customized solution that exceeds your expectations.
		""".strip()
		content_parts.append(cta)
		
		main_content = "\n\n".join(content_parts)
		generated_content = {
			"main_content": main_content,
			"hook": hook,
			"problem": problem,
			"solution": solution,
			"benefits": benefits,
			"cta": cta
		}
		
		# Calculate metrics
		quality_metrics = await self._calculate_quality_metrics(main_content, task)
		style_compliance = await self._check_style_compliance(main_content, task)
		word_count = len(main_content.split())
		readability_score = await self._calculate_readability(main_content)
		engagement_score = await self._calculate_engagement(main_content)
		
		recommendations = [
			"Add specific customer success stories",
			"Include compelling statistics and data points",
			"Strengthen emotional appeal and urgency"
		]
		
		alternatives = [
			{"version": "long_form", "content": main_content + "\n\n[Extended testimonials and case studies]"},
			{"version": "email", "content": hook + "\n\n" + benefits + "\n\n" + cta}
		]
		
		return WritingResult(
			task_id=task.task_id,
			content_type=task.content_type,
			generated_content=generated_content,
			voice_analysis=None,
			quality_metrics=quality_metrics,
			style_compliance=style_compliance,
			word_count=word_count,
			readability_score=readability_score,
			engagement_score=engagement_score,
			recommendations=recommendations,
			alternatives=alternatives,
			metadata={
				"template_used": "marketing_content",
				"style": "persuasive_engaging",
				"target_audience": "business_decision_makers"
			}
		)
	
	async def _write_general_content(self, task: WritingTask) -> WritingResult:
		"""Write general content for undefined types"""
		self.logger.info(f"Writing general content: {task.topic}")
		
		# Generate flexible, adaptable content
		main_content = f"""
# {task.topic}

## Overview

This document addresses {task.topic} with comprehensive coverage of key aspects, 
requirements, and implementation considerations. The content is structured to 
provide clear understanding and actionable insights.

## Key Considerations

The approach to {task.topic} requires careful consideration of multiple factors 
including stakeholder requirements, technical constraints, resource availability, 
and timeline considerations.

## Implementation Approach

A systematic approach ensures successful implementation with appropriate risk 
mitigation and quality assurance measures. Key phases include planning, 
development, testing, and deployment with ongoing monitoring and optimization.

## Expected Outcomes

Implementation delivers measurable value through improved efficiency, enhanced 
capabilities, and competitive advantage. Success metrics align with organizational 
objectives and stakeholder expectations.

## Conclusion

{task.topic} represents a valuable opportunity to advance organizational 
capabilities and achieve strategic objectives. The recommended approach 
provides a clear path to successful implementation and measurable results.
		""".strip()
		
		generated_content = {"main_content": main_content}
		
		# Calculate basic metrics
		quality_metrics = {"overall": 0.7, "structure": 0.8, "clarity": 0.75}
		style_compliance = {"overall": 0.8}
		word_count = len(main_content.split())
		readability_score = 0.75
		engagement_score = 0.7
		
		recommendations = [
			"Customize content for specific audience and requirements",
			"Add domain-specific expertise and insights",
			"Include relevant examples and case studies"
		]
		
		alternatives = [
			{"version": "detailed", "content": main_content + "\n\n[Additional sections with specific details]"},
			{"version": "summary", "content": main_content.split("\n\n")[0] + "\n\n" + main_content.split("\n\n")[-1]}
		]
		
		return WritingResult(
			task_id=task.task_id,
			content_type=task.content_type,
			generated_content=generated_content,
			voice_analysis=None,
			quality_metrics=quality_metrics,
			style_compliance=style_compliance,
			word_count=word_count,
			readability_score=readability_score,
			engagement_score=engagement_score,
			recommendations=recommendations,
			alternatives=alternatives,
			metadata={
				"template_used": "general_content",
				"approach": "flexible_structure"
			}
		)
	
	# Content generation helper methods
	
	async def _generate_executive_summary_section(self, task: WritingTask) -> str:
		"""Generate executive summary section for proposals using LLM"""
		self.logger.debug("Generating executive summary using LLM")
		
		# Create detailed prompt for executive summary
		context_info = ""
		if task.context.get("organization"):
			context_info = f"Organization: {task.context['organization']}\n"
		if task.context.get("industry"):
			context_info += f"Industry: {task.context['industry']}\n"
		
		prompt = f"""Write a professional executive summary for a business proposal about: {task.topic}

{context_info}
Requirements:
- 2-3 paragraphs
- Highlight key benefits and value proposition
- Include ROI implications
- Professional, persuasive tone
- Specific to the topic and organization

Focus on measurable business outcomes and strategic value."""

		system_prompt = """You are an expert proposal writer specializing in executive summaries. 
Create compelling, professional content that captures attention and clearly communicates value. 
Use business language and focus on outcomes that matter to decision-makers."""
		
		try:
			# Create task info for context management
			task_info = {
				"name": f"Executive Summary - {task.topic}",
				"task_type": "writing",
				"description": f"Generate executive summary for {task.topic}",
				"topic": task.topic,
				"context": task.context
			}
			
			# Generate with context-aware LLM
			generated_content = await self.generate_with_llm(prompt, system_prompt, task_info)
			
			# Fallback to template if LLM fails
			if not generated_content or "Error" in generated_content:
				self.logger.warning("LLM generation failed, using template fallback")
				return f"""
This proposal presents a comprehensive solution for {task.topic}, addressing key 
organizational needs and strategic objectives. Our approach delivers measurable 
value through innovative solutions, expert implementation, and ongoing support.

Key benefits include enhanced operational efficiency, competitive advantage, and 
significant return on investment. Implementation follows proven methodologies 
with appropriate risk mitigation and quality assurance measures.

We recommend proceeding with this strategic initiative to achieve organizational 
objectives and maintain competitive positioning in the marketplace.
				""".strip()
			
			return generated_content.strip()
			
		except Exception as e:
			self.logger.error(f"Executive summary generation failed: {e}")
			# Return template fallback
			return f"""
This proposal presents a comprehensive solution for {task.topic}, addressing key 
organizational needs and strategic objectives. Our approach delivers measurable 
value through innovative solutions, expert implementation, and ongoing support.

Key benefits include enhanced operational efficiency, competitive advantage, and 
significant return on investment. Implementation follows proven methodologies 
with appropriate risk mitigation and quality assurance measures.

We recommend proceeding with this strategic initiative to achieve organizational 
objectives and maintain competitive positioning in the marketplace.
			""".strip()
	
	async def _generate_problem_statement(self, task: WritingTask) -> str:
		"""Generate problem statement section"""
		return f"""
Organizations face complex challenges that require innovative solutions and expert 
implementation. Current approaches may not adequately address evolving requirements, 
competitive pressures, and stakeholder expectations.

The need for {task.topic} stems from:
• Market dynamics and competitive pressures
• Evolving customer requirements and expectations
• Technology advancement and innovation opportunities
• Regulatory compliance and risk management needs
• Operational efficiency and cost optimization requirements

Addressing these challenges requires comprehensive solutions that deliver measurable 
results while maintaining quality, security, and compliance standards.
		""".strip()
	
	async def _generate_solution_section(self, task: WritingTask) -> str:
		"""Generate proposed solution section"""
		return f"""
Our comprehensive solution for {task.topic} combines industry expertise, proven 
methodologies, and innovative approaches to deliver exceptional results.

**Solution Components:**
• Strategic analysis and planning
• Expert implementation and deployment
• Quality assurance and testing
• Training and knowledge transfer
• Ongoing support and optimization

**Key Differentiators:**
• Proven track record of successful implementations
• Expert team with relevant industry experience
• Customized approach tailored to specific requirements
• Comprehensive risk mitigation and quality assurance
• Ongoing support and partnership commitment

This solution addresses identified challenges while providing scalability, 
flexibility, and long-term value for organizational success.
		""".strip()
	
	async def _generate_implementation_section(self, task: WritingTask) -> str:
		"""Generate implementation plan section"""
		return f"""
Implementation follows a structured approach with clear phases, deliverables, 
and success criteria. Our methodology ensures successful delivery while 
maintaining quality standards and stakeholder alignment.

**Implementation Phases:**

1. **Planning and Analysis** (Weeks 1-2)
   - Requirements analysis and validation
   - Stakeholder alignment and communication
   - Resource planning and allocation

2. **Development and Configuration** (Weeks 3-8)
   - Solution development and customization
   - Integration and system configuration
   - Quality assurance and testing

3. **Deployment and Training** (Weeks 9-10)
   - Production deployment and go-live
   - User training and knowledge transfer
   - Documentation and support materials

4. **Optimization and Support** (Ongoing)
   - Performance monitoring and optimization
   - Ongoing support and maintenance
   - Continuous improvement initiatives

Each phase includes defined deliverables, success criteria, and stakeholder 
review points to ensure project success and stakeholder satisfaction.
		""".strip()
	
	async def _generate_timeline_section(self, task: WritingTask) -> str:
		"""Generate timeline and milestones section"""
		return f"""
The project timeline is structured to deliver value incrementally while maintaining 
quality standards and stakeholder alignment. Key milestones provide visibility 
and control throughout the implementation process.

**Project Timeline:** {task.requirements.get('duration', '10-12 weeks')}

**Major Milestones:**
• Week 2: Requirements validation and project kickoff
• Week 4: Solution design approval and development start
• Week 6: Initial system integration and testing
• Week 8: User acceptance testing and feedback incorporation
• Week 10: Production deployment and go-live
• Week 12: Project closure and transition to support

**Critical Path Activities:**
- Stakeholder alignment and requirements validation
- Solution development and integration
- Testing and quality assurance
- User training and change management
- Production deployment and stabilization

Timeline includes appropriate buffers for risk mitigation and ensures 
successful project delivery within specified constraints.
		""".strip()
	
	async def _generate_budget_section(self, task: WritingTask) -> str:
		"""Generate budget and pricing section"""
		return f"""
The project investment reflects market standards for similar implementations 
while providing exceptional value and return on investment. Pricing is 
structured to align with project phases and deliverable completion.

**Investment Summary:**
• Total Project Investment: {task.requirements.get('budget_range', 'To be determined based on scope')}
• Payment Schedule: Aligned with project milestones
• Value Proposition: Significant ROI through efficiency gains and competitive advantage

**Cost Components:**
- Strategic analysis and planning
- Solution development and configuration
- Implementation and deployment
- Training and knowledge transfer
- Ongoing support and maintenance (optional)

**Value Delivery:**
The investment delivers measurable returns through operational efficiency, 
cost reduction, competitive advantage, and enhanced capabilities. Expected 
ROI exceeds industry benchmarks for similar initiatives.

Pricing includes comprehensive project delivery with quality assurance, 
risk mitigation, and success guarantee provisions.
		""".strip()
	
	async def _generate_team_section(self, task: WritingTask) -> str:
		"""Generate team and qualifications section"""
		return f"""
Our expert team brings extensive experience and proven success in delivering 
{task.topic} solutions. Team qualifications align with project requirements 
and ensure successful implementation.

**Project Team Structure:**
• Project Manager: Overall project leadership and stakeholder coordination
• Technical Lead: Solution architecture and technical implementation
• Business Analyst: Requirements analysis and process optimization
• Quality Assurance: Testing, validation, and quality control
• Subject Matter Experts: Domain expertise and specialized knowledge

**Key Qualifications:**
- Extensive experience with similar implementations
- Industry certifications and professional credentials
- Proven track record of successful project delivery
- Deep expertise in relevant technologies and methodologies
- Strong communication and collaboration skills

**Team Commitment:**
Dedicated team members with clear roles, responsibilities, and accountability 
for project success. Regular communication and progress reporting ensure 
stakeholder alignment and project visibility.

Our team's expertise and commitment provide confidence in successful project 
delivery and long-term partnership value.
		""".strip()
	
	async def _generate_risk_section(self, task: WritingTask) -> str:
		"""Generate risk assessment section"""
		return f"""
Comprehensive risk assessment and mitigation strategies ensure successful 
project delivery despite potential challenges and uncertainties.

**Identified Risks and Mitigation Strategies:**

**Technical Risks:**
- Integration complexity: Comprehensive testing and phased deployment
- Performance issues: Load testing and optimization planning
- Security concerns: Security assessment and compliance validation

**Operational Risks:**
- Resource availability: Resource planning and backup arrangements
- Timeline constraints: Buffer time and priority management
- Stakeholder alignment: Regular communication and change management

**Business Risks:**
- Requirements changes: Structured change control process
- Budget constraints: Flexible pricing and phased implementation options
- Market conditions: Adaptable solution design and scalability planning

**Risk Management Approach:**
- Proactive risk identification and assessment
- Comprehensive mitigation strategies and contingency planning
- Regular risk monitoring and stakeholder communication
- Escalation procedures and decision-making frameworks

Our risk management approach provides confidence in successful project 
delivery while maintaining flexibility to address emerging challenges.
		""".strip()
	
	async def _generate_conclusion_section(self, task: WritingTask) -> str:
		"""Generate conclusion section"""
		return f"""
This proposal presents a compelling opportunity to advance organizational 
capabilities through {task.topic} implementation. Our comprehensive approach, 
expert team, and proven methodology ensure successful delivery and measurable 
value.

**Key Success Factors:**
• Proven solution approach and methodology
• Expert team with relevant experience and qualifications
• Comprehensive risk mitigation and quality assurance
• Strong partnership commitment and ongoing support
• Measurable value delivery and ROI achievement

**Next Steps:**
We recommend proceeding with this strategic initiative to achieve organizational 
objectives and maintain competitive advantage. Our team is ready to begin 
implementation immediately upon project approval.

**Partnership Commitment:**
We are committed to your success and look forward to partnering with you on 
this important initiative. Our expertise, resources, and dedication ensure 
project success and long-term value delivery.

Thank you for considering our proposal. We welcome the opportunity to discuss 
this initiative in detail and address any questions or requirements you may have.
		""".strip()
	
	# Analysis and metrics methods
	
	async def _analyze_voice_consistency(self, content: str, voice_profile: str) -> Dict[str, Any]:
		"""Analyze voice consistency using Voice DNA Engine"""
		if not self.voice_integrator:
			return {"error": "Voice analysis not available"}
		
		try:
			request = AnalysisRequest(
				analysis_type=AnalysisType.VALIDATION_ONLY,
				text_content=content,
				organization_name=voice_profile
			)
			
			result = await self.voice_integrator.analyze(request)
			
			return {
				"voice_score": result.overall_voice_score,
				"consistency_score": result.consistency_score,
				"authenticity_score": result.authenticity_score,
				"recommendations": result.key_recommendations,
				"analysis_complete": True
			}
			
		except Exception as e:
			self.logger.error(f"Voice analysis failed: {e}")
			return {"error": str(e), "analysis_complete": False}
	
	async def _calculate_quality_metrics(self, content: str, task: WritingTask) -> Dict[str, float]:
		"""Calculate content quality metrics"""
		metrics = {}
		
		# Structure quality
		sections = content.split('\n\n')
		structure_score = min(1.0, len(sections) / 5.0)  # Assume 5 sections is good structure
		metrics["structure"] = structure_score
		
		# Content completeness
		word_count = len(content.split())
		target_range = self.content_templates.get(task.content_type, {}).get("word_count_range", (500, 2000))
		if target_range[0] <= word_count <= target_range[1]:
			completeness_score = 1.0
		else:
			# Calculate penalty for being outside target range
			if word_count < target_range[0]:
				completeness_score = word_count / target_range[0]
			else:
				completeness_score = target_range[1] / word_count
		metrics["completeness"] = completeness_score
		
		# Clarity and readability (simplified)
		sentences = content.split('.')
		avg_sentence_length = word_count / max(len(sentences), 1)
		clarity_score = max(0.0, min(1.0, 1.0 - (avg_sentence_length - 20) / 30))
		metrics["clarity"] = clarity_score
		
		# Professional tone
		professional_indicators = [
			"comprehensive", "strategic", "implementation", "optimization",
			"stakeholder", "methodology", "deliverable", "excellence"
		]
		professional_count = sum(1 for indicator in professional_indicators if indicator in content.lower())
		professional_score = min(1.0, professional_count / 5.0)
		metrics["professional_tone"] = professional_score
		
		# Overall quality
		metrics["overall"] = statistics.mean([
			structure_score, completeness_score, clarity_score, professional_score
		])
		
		return metrics
	
	async def _check_style_compliance(self, content: str, task: WritingTask) -> Dict[str, float]:
		"""Check style guide compliance"""
		compliance = {}
		
		if task.style_guide:
			style_rules = task.style_guide
			
			# Check formatting compliance
			has_headings = bool(re.search(r'^#{1,6}\s+', content, re.MULTILINE))
			has_bullets = bool(re.search(r'^[•\-\*]\s+', content, re.MULTILINE))
			formatting_score = (int(has_headings) + int(has_bullets)) / 2.0
			compliance["formatting"] = formatting_score
			
			# Check tone compliance
			required_tone = style_rules.get("tone", "professional")
			tone_indicators = {
				"professional": ["comprehensive", "strategic", "implementation"],
				"technical": ["architecture", "specification", "configuration"],
				"executive": ["strategic", "value", "investment", "ROI"],
				"marketing": ["benefits", "advantage", "success", "results"]
			}.get(required_tone, [])
			
			tone_matches = sum(1 for indicator in tone_indicators if indicator in content.lower())
			tone_score = min(1.0, tone_matches / max(len(tone_indicators), 1))
			compliance["tone"] = tone_score
			
			# Overall compliance
			compliance["overall"] = statistics.mean([formatting_score, tone_score])
		else:
			# Default compliance scoring
			compliance = {
				"formatting": 0.8,
				"tone": 0.8,
				"overall": 0.8
			}
		
		return compliance
	
	async def _calculate_readability(self, content: str) -> float:
		"""Calculate readability score"""
		# Simplified readability calculation
		words = content.split()
		sentences = content.split('.')
		
		if not sentences:
			return 0.5
		
		avg_sentence_length = len(words) / len(sentences)
		
		# Simple readability score based on sentence length
		if avg_sentence_length <= 15:
			return 0.9
		elif avg_sentence_length <= 20:
			return 0.8
		elif avg_sentence_length <= 25:
			return 0.7
		else:
			return 0.6
	
	async def _calculate_engagement(self, content: str) -> float:
		"""Calculate engagement score"""
		engagement_indicators = [
			"benefits", "results", "success", "advantage", "value",
			"opportunity", "solution", "achieve", "deliver", "improve"
		]
		
		word_count = len(content.split())
		engagement_words = sum(1 for word in content.lower().split() 
							  if word in engagement_indicators)
		
		# Calculate engagement density
		engagement_density = engagement_words / max(word_count, 1)
		return min(1.0, engagement_density * 50)  # Scale to 0-1 range
	
	async def _generate_content_recommendations(self, content: str, task: WritingTask) -> List[str]:
		"""Generate recommendations for content improvement"""
		recommendations = []
		
		# Check word count
		word_count = len(content.split())
		target_range = self.content_templates.get(task.content_type, {}).get("word_count_range", (500, 2000))
		
		if word_count < target_range[0]:
			recommendations.append("Consider expanding content to meet minimum word count requirements")
		elif word_count > target_range[1]:
			recommendations.append("Consider condensing content for better readability")
		
		# Check structure
		sections = len(content.split('\n\n'))
		if sections < 3:
			recommendations.append("Add more sections for better content organization")
		
		# Check engagement elements
		if not any(word in content.lower() for word in ["benefits", "value", "results"]):
			recommendations.append("Include more value-focused language and benefit statements")
		
		# Check call-to-action for marketing content
		if task.content_type == "marketing_content" and not any(
			phrase in content.lower() for phrase in ["contact us", "get started", "learn more"]
		):
			recommendations.append("Add a clear call-to-action to drive engagement")
		
		return recommendations or ["Content meets quality standards"]
	
	async def _create_content_alternatives(self, content: str, task: WritingTask) -> List[Dict[str, str]]:
		"""Create alternative versions of content"""
		alternatives = []
		
		# Create shorter version
		sentences = content.split('. ')
		short_version = '. '.join(sentences[:len(sentences)//2]) + '.'
		alternatives.append({
			"version": "condensed",
			"content": short_version,
			"description": "Condensed version focusing on key points"
		})
		
		# Create executive version
		paragraphs = content.split('\n\n')
		exec_version = '\n\n'.join(paragraphs[:3])  # First 3 paragraphs
		alternatives.append({
			"version": "executive",
			"content": exec_version,
			"description": "Executive summary version for leadership review"
		})
		
		return alternatives
	
	# Message handling methods
	
	async def _handle_writing_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle writing task request"""
		try:
			task_data = message.payload.content
			
			# Create writing task from request
			writing_task = WritingTask(
				task_id=message.header.message_id,
				content_type=task_data.get("content_type", "general"),
				topic=task_data.get("topic", ""),
				requirements=task_data.get("requirements", {}),
				style_guide=task_data.get("style_guide"),
				target_audience=task_data.get("target_audience"),
				voice_profile=task_data.get("voice_profile")
			)
			
			# Evaluate task fit
			fit_score = await self.evaluate_task_fit(writing_task)
			
			if fit_score > 0.6:  # Accept if reasonably good fit
				# Process writing task
				result = await self.process_task(writing_task)
				
				return MessageTemplates.task_response(
					sender_id=self.agent_id,
					recipient_id=message.header.sender_id,
					result=result.__dict__,
					original_message_id=message.header.message_id
				)
			else:
				# Reject task
				return MessageTemplates.task_response(
					sender_id=self.agent_id,
					recipient_id=message.header.sender_id,
					result={
						"status": "rejected",
						"reason": f"Task fit score too low: {fit_score:.2f}",
						"suggestions": ["Consider technical writer for technical content", 
									   "Consider marketing specialist for marketing content"]
					},
					original_message_id=message.header.message_id
				)
				
		except Exception as e:
			self.logger.error(f"Error handling writing request: {e}")
			return MessageTemplates.error_report(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				error_info={"error": str(e), "message_id": message.header.message_id}
			)
	
	async def _handle_collaboration_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle collaboration request from other agents"""
		collaboration_data = message.payload.content
		
		# Evaluate collaboration potential
		if collaboration_data.get("writing_component") or collaboration_data.get("content_creation"):
			response_data = {
				"status": "accepted",
				"agent_capabilities": self.get_capabilities(),
				"content_expertise": self.content_expertise,
				"availability": self.get_health_status()
			}
		else:
			response_data = {
				"status": "declined", 
				"reason": "No writing component in collaboration request"
			}
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=response_data,
			original_message_id=message.header.message_id
		)
	
	async def _handle_content_feedback(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle content feedback from reviewers or other agents"""
		feedback = message.payload.content
		category = message.payload.context.get("category", "general_feedback")
		
		# Store feedback for learning and improvement
		self.store_knowledge(
			key=f"content_feedback_{message.header.message_id}",
			value=feedback,
			category=category
		)
		
		self.logger.info(f"Received content feedback: {category}")
		return None  # No response needed for feedback
	
	async def _handle_status_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle status request"""
		status_data = {
			"agent_status": self.get_health_status(),
			"active_writing_tasks": len(self.active_writing_tasks),
			"content_expertise": self.content_expertise,
			"writing_capabilities": self.get_capabilities(),
			"supported_content_types": list(self.content_templates.keys())
		}
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=status_data,
			original_message_id=message.header.message_id
		)
	
	async def _update_writing_metrics(self, task: WritingTask, result: WritingResult) -> None:
		"""Update writing performance metrics"""
		# Update goal progress
		self.update_goal_progress("content_quality", result.quality_metrics.get("overall", 0.0))
		self.update_goal_progress("readability", result.readability_score)
		self.update_goal_progress("engagement", result.engagement_score)
		
		if result.voice_analysis and "voice_score" in result.voice_analysis:
			self.update_goal_progress("voice_consistency", result.voice_analysis["voice_score"])
		
		if result.style_compliance:
			self.update_goal_progress("style_compliance", result.style_compliance.get("overall", 0.0))
	
	# Public interface methods
	
	async def write_proposal(self, topic: str, requirements: Dict[str, Any], 
							voice_profile: Optional[str] = None) -> WritingResult:
		"""Public method for proposal writing"""
		task = WritingTask(
			task_id=f"proposal_{hash(topic)}",
			content_type="proposal",
			topic=topic,
			requirements=requirements,
			voice_profile=voice_profile
		)
		
		return await self.process_task(task)
	
	async def create_executive_summary(self, topic: str, key_points: List[str]) -> WritingResult:
		"""Public method for executive summary creation"""
		task = WritingTask(
			task_id=f"exec_summary_{hash(topic)}",
			content_type="executive_summary",
			topic=topic,
			requirements={"key_points": key_points}
		)
		
		return await self.process_task(task)
	
	def get_writing_expertise(self) -> Dict[str, Any]:
		"""Get writing expertise and capabilities"""
		return {
			"content_types": list(self.content_expertise.keys()),
			"writing_styles": list(self.writing_styles),
			"capabilities": self.get_capabilities(),
			"templates_available": list(self.content_templates.keys()),
			"active_tasks": len(self.active_writing_tasks),
			"quality_metrics": {
				"average_quality": statistics.mean([
					0.85, 0.9, 0.88  # Placeholder - would be calculated from actual results
				]),
				"voice_consistency": self.get_goal_status().get("voice_consistency", {}).get("current", 0.0)
			}
		}